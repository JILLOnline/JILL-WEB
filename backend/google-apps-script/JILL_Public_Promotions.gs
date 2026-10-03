const JILL_PUBLIC_PROMOTIONS = Object.freeze({
  HANDLER: 'syncJillPublicPromotions',
  NAMESPACE: 'jill_promotions',
  KEY: 'active_public_codes',
  VERSION: 1,
  PAGE_SIZE: 50,
  MAX_PAGES: 100,
  MAX_SNAPSHOT_AGE_MS: 10 * 60 * 1000,
  INFRA_CHECK_PROPERTY: 'JILL_PUBLIC_PROMOTIONS_INFRA_CHECK_AT',
  INFRA_CHECK_MS: 5 * 60 * 1000
});

function setupJillPublicPromotions() {
  const infrastructure = ensureJillPublicPromotionsInfrastructure_(true);
  const sync = syncJillPublicPromotions();
  const result = {
    ok: true,
    trigger: infrastructure.trigger,
    sync: sync
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function ensureJillPublicPromotionsInfrastructure_(force) {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  const lastCheck = Number(
    props.getProperty(JILL_PUBLIC_PROMOTIONS.INFRA_CHECK_PROPERTY) || 0
  );

  if (
    !force &&
    lastCheck &&
    now - lastCheck < JILL_PUBLIC_PROMOTIONS.INFRA_CHECK_MS
  ) {
    return {
      ok: true,
      checked: false,
      throttled: true,
      trigger: 'recently verified'
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const lockedNow = Date.now();
    const lockedLastCheck = Number(
      props.getProperty(JILL_PUBLIC_PROMOTIONS.INFRA_CHECK_PROPERTY) || 0
    );

    if (
      !force &&
      lockedLastCheck &&
      lockedNow - lockedLastCheck < JILL_PUBLIC_PROMOTIONS.INFRA_CHECK_MS
    ) {
      return {
        ok: true,
        checked: false,
        throttled: true,
        trigger: 'recently verified'
      };
    }

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
    } else if (triggers.length > 1) {
      triggerStatus = 'deduplicated (every minute)';
    }

    props.setProperty(
      JILL_PUBLIC_PROMOTIONS.INFRA_CHECK_PROPERTY,
      String(lockedNow)
    );

    return {
      ok: true,
      checked: true,
      throttled: false,
      trigger: triggerStatus
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}

function syncJillPublicPromotions() {
  const pageData = fetchJillPublicDiscountNodes_();
  const shopId = clean_(pageData.shop_id);

  if (!shopId) {
    throw new Error('Shopify public promotions sync returned no Shop ID.');
  }

  const offers = collectJillPublicOffers_(pageData.nodes);
  const snapshot = {
    version: JILL_PUBLIC_PROMOTIONS.VERSION,
    synced_at: new Date().toISOString(),
    offers: offers
  };

  writeJillPublicPromotionSnapshot_(shopId, snapshot);

  const response = {
    ok: true,
    version: JILL_PUBLIC_PROMOTIONS.VERSION,
    offer_count: offers.length,
    pages_scanned: pageData.pages_scanned,
    discounts_scanned: pageData.nodes.length,
    codes: offers.map(function(offer) {
      return offer.code;
    }),
    synced_at: snapshot.synced_at
  };

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function fetchJillPublicDiscountNodes_() {
  const query = `
    query JillPublicDiscountSnapshot($first: Int!, $after: String) {
      shop { id }
      discountNodes(
        first: $first,
        after: $after,
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
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let after = null;
  let shopId = '';
  let pagesScanned = 0;
  const nodes = [];

  while (true) {
    pagesScanned += 1;
    if (pagesScanned > JILL_PUBLIC_PROMOTIONS.MAX_PAGES) {
      throw new Error(
        'Shopify public promotions exceeded the bounded pagination limit.'
      );
    }

    const data = shopifyGraphQL_(query, {
      first: JILL_PUBLIC_PROMOTIONS.PAGE_SIZE,
      after: after
    });

    if (!shopId) {
      shopId = clean_(data.shop && data.shop.id);
    }

    const connection = data.discountNodes || {};
    const pageNodes = Array.isArray(connection.nodes)
      ? connection.nodes
      : [];

    Array.prototype.push.apply(nodes, pageNodes);

    const pageInfo = connection.pageInfo || {};
    if (!pageInfo.hasNextPage) break;

    const nextCursor = clean_(pageInfo.endCursor);
    if (!nextCursor || nextCursor === after) {
      throw new Error(
        'Shopify public promotions pagination returned an invalid cursor.'
      );
    }

    after = nextCursor;
  }

  return {
    shop_id: shopId,
    nodes: nodes,
    pages_scanned: pagesScanned
  };
}

function collectJillPublicOffers_(nodes) {
  const offers = [];

  (Array.isArray(nodes) ? nodes : []).forEach(function(node) {
    const discount = node && node.discount;

    if (!discount || discount.status !== 'ACTIVE') return;

    if (
      !discount.context ||
      discount.context.__typename !== 'DiscountBuyerSelectionAll'
    ) {
      return;
    }

    const codes =
      discount.codes && Array.isArray(discount.codes.nodes)
        ? discount.codes.nodes
            .map(function(item) {
              return clean_(item && item.code);
            })
            .filter(Boolean)
        : [];

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

  return offers;
}

function writeJillPublicPromotionSnapshot_(shopId, snapshot) {
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
}

function readJillPublicPromotionSnapshot_() {
  const query = `
    query JillPublicPromotionHealth {
      shop {
        metafield(
          namespace: "jill_promotions"
          key: "active_public_codes"
        ) {
          value
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, {});
  const raw = clean_(
    data.shop &&
    data.shop.metafield &&
    data.shop.metafield.value
  );

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function jillPublicPromotionsHealth_() {
  const snapshot = readJillPublicPromotionSnapshot_();
  const syncedAt = Date.parse(
    snapshot && snapshot.synced_at ? snapshot.synced_at : ''
  );
  const ageMs = Number.isFinite(syncedAt)
    ? Math.max(0, Date.now() - syncedAt)
    : null;
  const fresh = Boolean(
    snapshot &&
    snapshot.version === JILL_PUBLIC_PROMOTIONS.VERSION &&
    Array.isArray(snapshot.offers) &&
    ageMs !== null &&
    ageMs <= JILL_PUBLIC_PROMOTIONS.MAX_SNAPSHOT_AGE_MS
  );
  const triggerCount = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === JILL_PUBLIC_PROMOTIONS.HANDLER;
  }).length;

  return {
    ok: fresh && triggerCount === 1,
    fresh: fresh,
    version: snapshot ? snapshot.version : null,
    synced_at: snapshot ? snapshot.synced_at || null : null,
    snapshot_age_ms: ageMs,
    offer_count:
      snapshot && Array.isArray(snapshot.offers)
        ? snapshot.offers.length
        : 0,
    trigger_count: triggerCount,
    trigger_ok: triggerCount === 1
  };
}

function ensureJillPublicPromotionsHealthy_(force) {
  const infrastructure = ensureJillPublicPromotionsInfrastructure_(force);
  let health = jillPublicPromotionsHealth_();
  let sync = null;

  if (force || !health.fresh) {
    sync = syncJillPublicPromotions();
    health = {
      ok: true,
      fresh: true,
      version: sync.version,
      synced_at: sync.synced_at,
      snapshot_age_ms: 0,
      offer_count: sync.offer_count,
      trigger_count: 1,
      trigger_ok: true
    };
  }

  return {
    ok: health.ok,
    infrastructure: infrastructure,
    health: health,
    sync: sync
  };
}
