const JILL_PUBLIC_PROMOTIONS = Object.freeze({
  HANDLER: 'syncJillPublicPromotions',
  NAMESPACE: 'jill_promotions',
  KEY: 'active_public_codes',
  VERSION: 1
});

/**
 * One-time setup for the public promotion mirror used by Customer Accounts.
 * The trigger is intentionally separate from Rewards accounting: promotions
 * can fail or be rebuilt without blocking points/coupon processing.
 */
function setupJillPublicPromotions() {
  const triggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === JILL_PUBLIC_PROMOTIONS.HANDLER;
  });

  triggers.slice(1).forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  let triggerStatus = 'already installed (every minute)';
  if (!triggers.length) {
    ScriptApp.newTrigger(JILL_PUBLIC_PROMOTIONS.HANDLER)
      .timeBased()
      .everyMinutes(1)
      .create();
    triggerStatus = 'created (every minute)';
  }

  const sync = syncJillPublicPromotions();
  const result = {
    ok: true,
    trigger: triggerStatus,
    sync: sync
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Canonical scheduled worker. Shopify Discounts remain the source of truth;
 * this function publishes only a sanitized, display-safe snapshot to a Shop
 * metafield readable by the Customer Account Storefront API.
 */
function syncJillPublicPromotions() {
  const query = `
    query JillPublicDiscountSnapshot($first: Int!) {
      shop { id }
      discountNodes(
        first: $first,
        query: "status:active method:code",
        sortKey: UPDATED_AT,
        reverse: true
      ) {
        nodes {
          discount {
            __typename
            ... on DiscountCodeBasic {
              title
              status
              startsAt
              endsAt
              summary
              shortSummary
              appliesOncePerCustomer
              codes(first: 2) { nodes { code } }
              context { __typename }
            }
            ... on DiscountCodeFreeShipping {
              title
              status
              startsAt
              endsAt
              summary
              shortSummary
              appliesOncePerCustomer
              codes(first: 2) { nodes { code } }
              context { __typename }
            }
            ... on DiscountCodeBxgy {
              title
              status
              startsAt
              endsAt
              summary
              appliesOncePerCustomer
              codes(first: 2) { nodes { code } }
              context { __typename }
            }
          }
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, { first: 50 });
  const shopId = clean_(data.shop && data.shop.id);

  if (!shopId) {
    throw new Error('Shopify public promotions sync returned no Shop ID.');
  }

  const nodes =
    data.discountNodes && data.discountNodes.nodes
      ? data.discountNodes.nodes
      : [];
  const offers = [];

  nodes.forEach(function(node) {
    const discount = node && node.discount;

    if (!discount || discount.status !== 'ACTIVE') return;

    // Never leak subscriber-only, segment-only, customer-specific, or Rewards
    // codes into the public Storewide section. Shopify's buyer context is the
    // authority; search syntax alone is not trusted for this decision.
    if (
      !discount.context ||
      discount.context.__typename !== 'DiscountBuyerSelectionAll'
    ) {
      return;
    }

    const codes =
      discount.codes && discount.codes.nodes
        ? discount.codes.nodes
            .map(function(item) {
              return clean_(item && item.code);
            })
            .filter(Boolean)
        : [];

    // A Storewide card must map to one deterministic checkout code. Campaigns
    // with multiple generated codes belong to targeted distribution instead.
    if (codes.length !== 1) return;

    const summary =
      clean_(discount.shortSummary) ||
      clean_(discount.summary) ||
      clean_(discount.title);

    if (!summary) return;

    offers.push({
      kind:
        discount.__typename === 'DiscountCodeFreeShipping'
          ? 'free_shipping'
          : discount.__typename === 'DiscountCodeBxgy'
            ? 'bxgy'
            : 'basic',
      code: codes[0],
      title: clean_(discount.title) || codes[0],
      summary: summary,
      details: clean_(discount.summary) || summary,
      starts_at: clean_(discount.startsAt) || null,
      ends_at: clean_(discount.endsAt) || null,
      applies_once_per_customer: Boolean(discount.appliesOncePerCustomer)
    });
  });

  const snapshot = {
    version: JILL_PUBLIC_PROMOTIONS.VERSION,
    synced_at: new Date().toISOString(),
    offers: offers
  };

  const mutation = `
    mutation SetJillPublicPromotions($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { namespace key value }
        userErrors { field message code }
      }
    }
  `;

  const result = shopifyGraphQL_(mutation, {
    metafields: [
      {
        ownerId: shopId,
        namespace: JILL_PUBLIC_PROMOTIONS.NAMESPACE,
        key: JILL_PUBLIC_PROMOTIONS.KEY,
        type: 'json',
        value: JSON.stringify(snapshot)
      }
    ]
  });
  const payload = result.metafieldsSet || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify public promotions metafieldsSet: ' +
        errors
          .map(function(error) {
            return error.message;
          })
          .join(' | ')
    );
  }

  const response = {
    ok: true,
    version: JILL_PUBLIC_PROMOTIONS.VERSION,
    offer_count: offers.length,
    codes: offers.map(function(offer) {
      return offer.code;
    }),
    synced_at: snapshot.synced_at
  };

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}
