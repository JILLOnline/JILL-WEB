const JILL = {
  SOURCE: 'JILL custom order',
  STORE_URL: 'https://jillonlinestore.com',
  STORE_EMAIL: 'info@jillonlinestore.com',
  SHEET_NAME: 'Submissions',
  SHOPIFY_API_VERSION: '2026-07'
};

const HEADERS = [
  'submission_id',
  'status',
  'submitted_at',
  'name',
  'email',
  'phone',
  'preferred_contact',
  'event_date',
  'date_needed',
  'fulfillment',
  'city',
  'state',
  'zip',
  'theme',
  'colors',
  'collections',
  'products',
  'reference_images',
  'marketing_consent',
  'marketing_consent_at',
  'marketing_consent_source',
  'raw_payload'
];


/* ---------------------------
   RUN THIS ONCE MANUALLY
---------------------------- */

function setupJill() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('JILL_SHEET_ID');

  if (!sheetId) {
    const ss = SpreadsheetApp.create('JILL Custom Order Leads');
    const sheet = ss.getActiveSheet();

    sheet.setName(JILL.SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);

    props.setProperty('JILL_SHEET_ID', ss.getId());
    sheetId = ss.getId();
  }

  const url = 'https://docs.google.com/spreadsheets/d/' + sheetId;
  Logger.log('JILL lead sheet: ' + url);
  return url;
}


/* ---------------------------
   WEB APP
---------------------------- */

function doGet(e) {
  if (e && e.parameter && e.parameter.code) {
    return handleShopifyOAuthCallback_(e);
  }

  // Permanent rewards watchdog. This endpoint is intentionally safe to call
  // without a shared secret: it only verifies/recreates JILL-owned Shopify
  // webhook subscriptions, verifies the minute sweep trigger, and runs the
  // source-of-truth reconciler. Expensive work is throttled server-side.
  if (
    e &&
    e.parameter &&
    clean_(e.parameter.jill_rewards_watchdog) === '1'
  ) {
    try {
      return json_(runJillRewardsWatchdog_());
    } catch (err) {
      console.error(
        'JILL Rewards watchdog failed: ' +
        (err && err.stack ? err.stack : err)
      );
      return json_({
        ok: false,
        watchdog: true,
        error: String(err)
      });
    }
  }

  return ContentService
    .createTextOutput('JILL Custom Order Automation is online.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  const suppliedRewardSecret = clean_(
    e && e.parameter ? e.parameter.jill_rewards_hook : ''
  );
  let verifiedRewardHook = false;

  try {
    lock.waitLock(10000);

    if (suppliedRewardSecret) {
      verifiedRewardHook =
        suppliedRewardSecret === rewardWebhookSecret_();

      if (!verifiedRewardHook) {
        return json_({ ok: false, error: 'Invalid rewards webhook' });
      }

      return handleJillRewardsWebhook_(e);
    }

    const data = parsePayload_(e);

    if (clean_(data.source) !== JILL.SOURCE) {
      return json_({ ok: false, error: 'Invalid source' });
    }

    const email = clean_(data.email).toLowerCase();

    if (!isValidEmail_(email)) {
      return json_({ ok: false, error: 'Invalid email' });
    }

    data.email = email;

    const submissionId =
      clean_(data.submission_id) ||
      fingerprint_([
        email,
        data.name,
        data.date_needed,
        data.submitted_at
      ].join('|'));

    data.submission_id = submissionId;

    const sheet = getSheet_();
    const existingRow = findSubmissionRow_(sheet, submissionId);
    const statusColumn = HEADERS.indexOf('status') + 1;

    let currentStatus = '';
    if (existingRow) {
      currentStatus = clean_(
        sheet.getRange(existingRow, statusColumn).getValue()
      );

      if (currentStatus === 'SENT + SHOPIFY') {
        return json_({ ok: true, duplicate: true });
      }
    }

    const row = existingRow || saveSubmission_(sheet, data);
    const confirmationAlreadySent = currentStatus.indexOf('SENT') === 0;

    // Confirmation email first. Shopify sync failure must never block this.
    // If Shopify failed on an earlier attempt, do not send the email twice.
    if (!confirmationAlreadySent) {
      sendConfirmation_(data);
      sheet.getRange(row, statusColumn).setValue('SENT');
    }

    try {
      const customerId = syncShopifyCustomer_(data);
      sheet.getRange(row, statusColumn).setValue('SENT + SHOPIFY');
      console.log('Shopify customer synced: ' + customerId);
    } catch (shopifyErr) {
      sheet.getRange(row, statusColumn).setValue('SENT / SHOPIFY ERROR');
      console.error(
        'Shopify sync failed: ' +
        (shopifyErr && shopifyErr.stack ? shopifyErr.stack : shopifyErr)
      );
    }

    return json_({
      ok: true,
      submission_id: submissionId
    });

  } catch (err) {
    console.error(err);

    // Let Shopify retry a verified rewards webhook when processing fails.
    if (verifiedRewardHook) {
      throw err;
    }

    return json_({
      ok: false,
      error: String(err)
    });

  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}

/* ---------------------------
   JILL REWARDS
---------------------------- */

const JILL_REWARD_TIERS = {
  10: { value: 5, minimum: 25 },
  20: { value: 12, minimum: 50 },
  35: { value: 25, minimum: 100 },
  50: { value: 40, minimum: 150 }
};

const JILL_REWARD_COUPON_DAYS = 30;
const JILL_REWARDS_SWEEP_HANDLER = 'processPendingJillRewardRequests';
const JILL_REWARDS_INFRA_CHECK_PROPERTY = 'JILL_REWARDS_INFRA_CHECK_AT';
const JILL_REWARDS_INFRA_CHECK_MS = 5 * 60 * 1000;
const JILL_REWARD_SUBSCRIPTIONS = [
  { topic: 'ORDERS_PAID', key: 'orders_paid' },
  { topic: 'REFUNDS_CREATE', key: 'refunds_create' },
  { topic: 'ORDERS_CANCELLED', key: 'orders_cancelled' },
  { topic: 'ORDERS_EDITED', key: 'orders_edited' },
  { topic: 'CUSTOMERS_UPDATE', key: 'customers_update' },
  { topic: 'DISCOUNTS_DELETE', key: 'discounts_delete' }
];

function setupJillRewards() {
  // Full setup remains available as a manual recovery button, but it is no
  // longer the only thing keeping Rewards alive. The minute worker and the
  // public watchdog both re-check this infrastructure automatically.
  const infrastructure = ensureJillRewardsInfrastructure_(true);
  const reconciliation = processPendingJillRewardRequests();

  const result = {
    ok: true,
    created: infrastructure.created,
    updated: infrastructure.updated,
    existing: infrastructure.existing,
    webhook_url: rewardsBaseUrl_(),
    sweep_trigger: infrastructure.sweep_trigger,
    reconciliation: reconciliation
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function ensureJillRewardsInfrastructure_(force) {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  const lastCheck = Number(
    props.getProperty(JILL_REWARDS_INFRA_CHECK_PROPERTY) || 0
  );

  if (!force && lastCheck && now - lastCheck < JILL_REWARDS_INFRA_CHECK_MS) {
    return {
      ok: true,
      checked: false,
      throttled: true,
      created: [],
      updated: [],
      existing: [],
      sweep_trigger: 'recently verified'
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    // Re-check after obtaining the lock so concurrent watchdog calls cannot
    // create duplicate subscriptions.
    const lockedNow = Date.now();
    const lockedLastCheck = Number(
      props.getProperty(JILL_REWARDS_INFRA_CHECK_PROPERTY) || 0
    );

    if (
      !force &&
      lockedLastCheck &&
      lockedNow - lockedLastCheck < JILL_REWARDS_INFRA_CHECK_MS
    ) {
      return {
        ok: true,
        checked: false,
        throttled: true,
        created: [],
        updated: [],
        existing: [],
        sweep_trigger: 'recently verified'
      };
    }

    const created = [];
    const updated = [];
    const existing = [];

    JILL_REWARD_SUBSCRIPTIONS.forEach(function(item) {
      const uri = rewardsWebhookUri_(item.key);
      const found = findRewardsWebhook_(item.topic, uri);

      if (found) {
        if (clean_(found.uri) === uri) {
          existing.push(item.topic);
        } else {
          updateRewardsWebhook_(found.id, uri);
          updated.push(item.topic);
        }
        return;
      }

      createRewardsWebhook_(item.topic, uri);
      created.push(item.topic);
    });

    const sweepTrigger = ensureJillRewardsSweepTrigger_();
    props.setProperty(
      JILL_REWARDS_INFRA_CHECK_PROPERTY,
      String(lockedNow)
    );

    const result = {
      ok: true,
      checked: true,
      throttled: false,
      created: created,
      updated: updated,
      existing: existing,
      sweep_trigger: sweepTrigger
    };

    Logger.log(
      'JILL Rewards infrastructure check: ' + JSON.stringify(result)
    );
    return result;
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}

function ensureJillRewardsSweepTrigger_() {
  const matching = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === JILL_REWARDS_SWEEP_HANDLER;
  });

  matching.slice(1).forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  if (!matching.length) {
    ScriptApp.newTrigger(JILL_REWARDS_SWEEP_HANDLER)
      .timeBased()
      .everyMinutes(1)
      .create();
    return 'created (every minute)';
  }

  return 'already installed (every minute)';
}

// Safe manual test button in Apps Script. The installed time trigger calls the
// same worker every minute, so a metafield-only redemption request cannot get
// stranded even if Shopify does not emit CUSTOMERS_UPDATE for that write.
function runJillRewardsSweep() {
  return processPendingJillRewardRequests();
}

// External fail-safe used by GitHub Actions. If Shopify ever drops a
// shop-specific webhook, or the Google minute trigger is removed, this call
// reinstalls the missing infrastructure and reconciles customer wallets.
function runJillRewardsWatchdog_() {
  const infrastructure = ensureJillRewardsInfrastructure_(false);
  let reconciliation = null;

  if (infrastructure.checked) {
    reconciliation = processPendingJillRewardRequests();
  }

  return {
    ok: true,
    watchdog: true,
    checked: infrastructure.checked,
    throttled: infrastructure.throttled,
    created: infrastructure.created,
    updated: infrastructure.updated,
    existing: infrastructure.existing,
    sweep_trigger: infrastructure.sweep_trigger,
    reconciliation: reconciliation
  };
}

function processPendingJillRewardRequests() {
  // Self-heal the webhook layer every few minutes from the same minute trigger.
  // This means manual admin coupon deletion does not depend on someone
  // remembering to rerun setupJillRewards().
  try {
    ensureJillRewardsInfrastructure_(false);
  } catch (infraErr) {
    console.error(
      'JILL Rewards infrastructure self-heal failed: ' +
      (infraErr && infraErr.stack ? infraErr.stack : infraErr)
    );
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    let after = null;
    let scanned = 0;
    let processed = 0;
    let normalized = 0;
    let hasNextPage = true;

    while (hasNextPage && scanned < 1000) {
      const query = `
        query JillRewardsSweep($first: Int!, $after: String) {
          customers(first: $first, after: $after) {
            nodes {
              id
              pointsBalance: metafield(
                namespace: "jill_rewards",
                key: "points_balance"
              ) {
                value
                compareDigest
              }
              pointsRedeemed: metafield(
                namespace: "jill_rewards",
                key: "points_redeemed_lifetime"
              ) {
                value
                compareDigest
              }
              redeemRequestPoints: metafield(
                namespace: "jill_rewards",
                key: "redeem_request_points"
              ) {
                value
                compareDigest
              }
              redeemRequestNonce: metafield(
                namespace: "jill_rewards",
                key: "redeem_request_nonce"
              ) {
                value
                compareDigest
              }
              coupons: metafield(
                namespace: "jill_rewards",
                key: "coupons"
              ) {
                value
                compareDigest
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const data = shopifyGraphQL_(query, {
        first: 100,
        after: after
      });
      const connection = data.customers || {};
      const customers = connection.nodes || [];

      customers.forEach(function(customer) {
        scanned += 1;

        const requestedPoints = rewardInt_(customer.redeemRequestPoints);
        const nonce = clean_(
          customer.redeemRequestNonce && customer.redeemRequestNonce.value
        );
        const pendingNonce = nonce && nonce.indexOf('consumed:') !== 0;

        try {
          if (requestedPoints > 0 && pendingNonce) {
            const result = processRewardRequest_(customer.id, nonce);
            if (result && result.coupon) processed += 1;
            return;
          }

          // Housekeeping: legacy/malformed requests created without a nonce
          // must never strand the customer in a permanent pending state.
          if (requestedPoints > 0 && !pendingNonce) {
            clearRewardRequest_(customer);
            return;
          }

          if (normalizeRewardWalletForCustomer_(customer)) {
            normalized += 1;
          }
        } catch (err) {
          console.error(
            'JILL Rewards sweep customer ' + customer.id + ': ' +
            (err && err.stack ? err.stack : err)
          );

          // A deterministic backend failure must never leave the customer
          // trapped in a permanent pending state. processRewardRequest_
          // already rolls back a newly-created discount if the state write
          // fails, so clearing the request here is safe.
          try {
            clearRewardRequest_(customer);
          } catch (clearErr) {
            console.error(
              'JILL Rewards sweep clear failed ' + customer.id + ': ' +
              (clearErr && clearErr.stack ? clearErr.stack : clearErr)
            );
          }
        }
      });

      const pageInfo = connection.pageInfo || {};
      hasNextPage = Boolean(pageInfo.hasNextPage);
      after = pageInfo.endCursor || null;

      if (!after) hasNextPage = false;
    }

    const result = {
      ok: true,
      scanned: scanned,
      processed: processed,
      normalized: normalized
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}

function rewardWebhookSecret_() {
  const props = PropertiesService.getScriptProperties();
  const clientSecret = clean_(props.getProperty('SHOPIFY_CLIENT_SECRET'));

  if (!clientSecret) {
    throw new Error(
      'Missing SHOPIFY_CLIENT_SECRET Script Property for JILL Rewards.'
    );
  }

  return fingerprint_('jill-rewards-webhook|' + clientSecret).slice(0, 48);
}

function rewardsBaseUrl_() {
  // Always use the public production /exec deployment. ScriptApp can return
  // /dev when setup is launched from the editor, which Shopify cannot use.
  return shopifyOAuthRedirectUri_();
}

function rewardsWebhookUri_(topicKey) {
  return (
    rewardsBaseUrl_() +
    '?jill_rewards_hook=' +
    encodeURIComponent(rewardWebhookSecret_()) +
    '&jill_rewards_topic=' +
    encodeURIComponent(topicKey)
  );
}

function findRewardsWebhook_(topic, uri) {
  const query = `
    query FindJillRewardsWebhooks($topic: WebhookSubscriptionTopic!) {
      webhookSubscriptions(first: 50, topics: [$topic]) {
        nodes {
          id
          topic
          uri
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, { topic: topic });
  const nodes =
    data.webhookSubscriptions && data.webhookSubscriptions.nodes
      ? data.webhookSubscriptions.nodes
      : [];

  const exact = nodes.find(function(node) {
    return clean_(node.uri) === uri;
  });

  if (exact) return exact;

  return nodes.find(function(node) {
    const nodeUri = clean_(node.uri);
    return (
      nodeUri.indexOf('jill_rewards_hook=') !== -1 &&
      nodeUri.indexOf('jill_rewards_topic=') !== -1
    );
  }) || null;
}

function updateRewardsWebhook_(id, uri) {
  const mutation = `
    mutation UpdateJillRewardsWebhook($id: ID!, $uri: String!) {
      webhookSubscriptionUpdate(
        id: $id,
        webhookSubscription: { uri: $uri, format: JSON }
      ) {
        webhookSubscription { id topic uri }
        userErrors { field message }
      }
    }
  `;

  const data = shopifyGraphQL_(mutation, { id: id, uri: uri });
  const payload = data.webhookSubscriptionUpdate || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify webhookSubscriptionUpdate: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.webhookSubscription || null;
}

function createRewardsWebhook_(topic, uri) {
  const mutation = `
    mutation CreateJillRewardsWebhook(
      $topic: WebhookSubscriptionTopic!,
      $uri: String!
    ) {
      webhookSubscriptionCreate(
        topic: $topic,
        webhookSubscription: { uri: $uri, format: JSON }
      ) {
        webhookSubscription { id topic uri }
        userErrors { field message }
      }
    }
  `;

  const data = shopifyGraphQL_(mutation, { topic: topic, uri: uri });
  const payload = data.webhookSubscriptionCreate || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify webhookSubscriptionCreate: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.webhookSubscription || null;
}

function handleJillRewardsWebhook_(e) {
  const topic = clean_(
    e && e.parameter ? e.parameter.jill_rewards_topic : ''
  );
  const payload = parsePayload_(e);

  if (!topic) {
    throw new Error('Missing JILL Rewards webhook topic.');
  }

  if (topic === 'customers_update') {
    const customerId = clean_(payload.admin_graphql_api_id);

    if (!customerId) {
      throw new Error('Customer update webhook did not include a customer ID.');
    }

    processRewardRequest_(customerId);

    return json_({ ok: true, rewards: true, topic: topic });
  }

  if (topic === 'discounts_delete') {
    const discountId = clean_(payload.admin_graphql_api_id);

    if (!discountId) {
      throw new Error('Discount delete webhook did not include a discount ID.');
    }

    const result = reconcileDeletedRewardDiscount_(discountId);

    return json_({
      ok: true,
      rewards: true,
      topic: topic,
      discount_id: discountId,
      reconciled_customers: result.reconciled_customers,
      restored_points: result.restored_points
    });
  }

  let orderId = '';

  if (topic === 'refunds_create') {
    const numericOrderId = clean_(payload.order_id);
    if (numericOrderId) {
      orderId = 'gid://shopify/Order/' + numericOrderId;
    }
  } else {
    orderId = clean_(payload.admin_graphql_api_id);
  }

  if (!orderId) {
    throw new Error('Rewards webhook did not include an order ID.');
  }

  const allowInitialCredit = topic === 'orders_paid';
  reconcileRewardsOrder_(orderId, allowInitialCredit);

  return json_({
    ok: true,
    rewards: true,
    topic: topic,
    order_id: orderId
  });
}

function reconcileRewardsOrder_(orderId, allowInitialCredit) {
  const query = `
    query JillRewardsOrder($id: ID!) {
      order: node(id: $id) {
        ... on Order {
          id
          cancelledAt
          displayFinancialStatus
          customer {
            id
            pointsBalance: metafield(
              namespace: "jill_rewards",
              key: "points_balance"
            ) { value compareDigest }
            eligibleSpend: metafield(
              namespace: "jill_rewards",
              key: "eligible_spend_cents"
            ) { value compareDigest }
            pointsEarned: metafield(
              namespace: "jill_rewards",
              key: "points_earned_lifetime"
            ) { value compareDigest }
            pointsRedeemed: metafield(
              namespace: "jill_rewards",
              key: "points_redeemed_lifetime"
            ) { value compareDigest }
            coupons: metafield(
              namespace: "jill_rewards",
              key: "coupons"
            ) { value compareDigest }
          }
          creditedCents: metafield(
            namespace: "jill_rewards",
            key: "credited_cents"
          ) { value compareDigest }
          lineItems(first: 250) {
            nodes {
              currentQuantity
              isGiftCard
              discountedUnitPriceAfterAllDiscountsSet {
                shopMoney { amount currencyCode }
              }
            }
          }
          discountApplications(first: 20) {
            nodes {
              __typename
              ... on DiscountCodeApplication { code }
            }
          }
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, { id: orderId });
  const order = data.order;

  if (!order || !order.id || !order.customer || !order.customer.id) {
    return { ok: true, skipped: 'No customer-linked order' };
  }

  const previousCreditedCents = rewardInt_(order.creditedCents);

  // Never pull a pre-program historical order into Rewards because of a later
  // refund/edit/cancellation. Only orders/paid can establish initial credit.
  if (!allowInitialCredit && previousCreditedCents <= 0) {
    return { ok: true, skipped: 'Order was never credited' };
  }

  let eligibleCents = 0;

  if (!order.cancelledAt) {
    const lines =
      order.lineItems && order.lineItems.nodes
        ? order.lineItems.nodes
        : [];

    lines.forEach(function(line) {
      if (!line || line.isGiftCard) return;

      const quantity = Math.max(0, Number(line.currentQuantity || 0));
      const money =
        line.discountedUnitPriceAfterAllDiscountsSet &&
        line.discountedUnitPriceAfterAllDiscountsSet.shopMoney;

      if (!money || money.currencyCode !== 'USD') return;

      eligibleCents +=
        Math.round(Number(money.amount || 0) * 100) * quantity;
    });
  }

  eligibleCents = Math.max(0, Math.round(eligibleCents));

  const deltaCents = eligibleCents - previousCreditedCents;
  const customer = order.customer;
  const priorSpend = rewardInt_(customer.eligibleSpend);
  const redeemed = rewardInt_(customer.pointsRedeemed);

  const newSpend = Math.max(0, priorSpend + deltaCents);
  const newEarned = Math.floor(newSpend / 1000);
  const newBalance = Math.max(0, newEarned - redeemed);

  if (deltaCents !== 0 || previousCreditedCents !== eligibleCents) {
    setRewardLedger_(
      customer,
      order,
      newSpend,
      newEarned,
      newBalance,
      eligibleCents
    );
  }

  markUsedRewardCoupons_(customer, order);

  return {
    ok: true,
    order_id: order.id,
    eligible_cents: eligibleCents,
    delta_cents: deltaCents,
    points_balance: newBalance
  };
}

function setRewardLedger_(
  customer,
  order,
  newSpend,
  newEarned,
  newBalance,
  eligibleCents
) {
  const metafields = [
    rewardMetafieldInput_(
      customer.id,
      'points_balance',
      'number_integer',
      newBalance,
      customer.pointsBalance
    ),
    rewardMetafieldInput_(
      customer.id,
      'eligible_spend_cents',
      'number_integer',
      newSpend,
      customer.eligibleSpend
    ),
    rewardMetafieldInput_(
      customer.id,
      'points_earned_lifetime',
      'number_integer',
      newEarned,
      customer.pointsEarned
    ),
    rewardMetafieldInput_(
      order.id,
      'credited_cents',
      'number_integer',
      eligibleCents,
      order.creditedCents
    )
  ];

  setRewardMetafields_(metafields);
}

function processRewardRequest_(customerId, expectedNonce) {
  const customer = getRewardsCustomer_(customerId);

  if (!customer || !customer.id) return null;

  const requestedPoints = rewardInt_(customer.redeemRequestPoints);
  const nonce = clean_(
    customer.redeemRequestNonce && customer.redeemRequestNonce.value
  );

  if (requestedPoints <= 0) {
    return null;
  }

  // A request is only valid when points + nonce were written together by the
  // Customer Account extension. Clean up legacy/malformed states instead of
  // leaving the Dashboard locked forever.
  if (!nonce || nonce.indexOf('consumed:') === 0) {
    clearRewardRequest_(customer);
    return { ok: true, skipped: 'Malformed or already-consumed reward request' };
  }

  if (expectedNonce && nonce !== expectedNonce) {
    return { ok: true, skipped: 'Stale redemption request' };
  }

  const tier = JILL_REWARD_TIERS[requestedPoints];
  if (!tier) {
    clearRewardRequest_(customer);
    return { ok: true, skipped: 'Unsupported reward tier' };
  }

  const balance = rewardInt_(customer.pointsBalance);
  if (balance < requestedPoints) {
    clearRewardRequest_(customer);
    return { ok: true, skipped: 'Insufficient points' };
  }

  const wallet = normalizeRewardCoupons_(
    rewardWallet_(customer.coupons),
    new Date()
  );
  const existingTierCoupon = wallet.find(function(coupon) {
    return (
      rewardCouponIsActive_(coupon, new Date()) &&
      Number(coupon.points) === requestedPoints
    );
  });

  if (existingTierCoupon) {
    clearRewardRequest_(customer);
    return {
      ok: true,
      skipped: 'Active reward already exists for this tier',
      coupon: existingTierCoupon
    };
  }

  consumeRewardRequest_(customer, nonce);

  let discount = null;

  try {
    discount = createRewardDiscount_(customer, requestedPoints, tier);

    const createdAt = new Date();
    const coupon = {
      points: requestedPoints,
      value: tier.value,
      minimum: tier.minimum,
      code: discount.code,
      discount_id: discount.id,
      created_at: createdAt.toISOString(),
      expires_at: new Date(
        createdAt.getTime() + JILL_REWARD_COUPON_DAYS * 24 * 60 * 60 * 1000
      ).toISOString(),
      status: 'active',
      request_nonce: nonce
    };

    const updatedWallet = wallet.concat([coupon]);
    const redeemed = rewardInt_(customer.pointsRedeemed);

    setRewardMetafields_([
      rewardMetafieldInput_(
        customer.id,
        'points_balance',
        'number_integer',
        balance - requestedPoints,
        customer.pointsBalance
      ),
      rewardMetafieldInput_(
        customer.id,
        'points_redeemed_lifetime',
        'number_integer',
        redeemed + requestedPoints,
        customer.pointsRedeemed
      ),
      rewardMetafieldInput_(
        customer.id,
        'coupons',
        'json',
        JSON.stringify(updatedWallet),
        customer.coupons
      ),
      rewardMetafieldInput_(
        customer.id,
        'redeem_request_points',
        'number_integer',
        0,
        customer.redeemRequestPoints
      ),
      rewardMetafieldInput_(
        customer.id,
        'redeem_request_nonce',
        'single_line_text_field',
        'consumed:' + nonce,
        customer.redeemRequestNonce
      )
    ]);

    return {
      ok: true,
      coupon: coupon,
      points_balance: balance - requestedPoints
    };
  } catch (err) {
    if (discount && discount.id) {
      try {
        deleteRewardDiscount_(discount.id);
      } catch (rollbackErr) {
        console.error(
          'JILL Rewards discount rollback failed ' + discount.id + ': ' +
          (rollbackErr && rollbackErr.stack ? rollbackErr.stack : rollbackErr)
        );
      }
    }

    try {
      const latestCustomer = getRewardsCustomer_(customer.id);
      if (latestCustomer && latestCustomer.id) {
        clearRewardRequest_(latestCustomer);
      }
    } catch (clearErr) {
      console.error(
        'JILL Rewards request rollback failed ' + customer.id + ': ' +
        (clearErr && clearErr.stack ? clearErr.stack : clearErr)
      );
    }

    throw err;
  }
}

function getRewardsCustomer_(customerId) {
  const query = `
    query JillRewardsCustomer($id: ID!) {
      customer: node(id: $id) {
        ... on Customer {
          id
          pointsBalance: metafield(
            namespace: "jill_rewards",
            key: "points_balance"
          ) { value compareDigest }
          pointsRedeemed: metafield(
            namespace: "jill_rewards",
            key: "points_redeemed_lifetime"
          ) { value compareDigest }
          redeemRequestPoints: metafield(
            namespace: "jill_rewards",
            key: "redeem_request_points"
          ) { value compareDigest }
          redeemRequestNonce: metafield(
            namespace: "jill_rewards",
            key: "redeem_request_nonce"
          ) { value compareDigest }
          coupons: metafield(
            namespace: "jill_rewards",
            key: "coupons"
          ) { value compareDigest }
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, { id: customerId });
  return data.customer || null;
}

function consumeRewardRequest_(customer, nonce) {
  const mutation = `
    mutation ConsumeJillRewardRequest($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key value compareDigest }
        userErrors { field message code }
      }
    }
  `;

  const inputs = [
    rewardMetafieldInput_(
      customer.id,
      'redeem_request_nonce',
      'single_line_text_field',
      'consumed:' + nonce,
      customer.redeemRequestNonce
    )
  ];

  const data = shopifyGraphQL_(mutation, { metafields: inputs });
  const payload = data.metafieldsSet || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify reward request claim: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.metafields || [];
}

function clearRewardRequest_(customer) {
  if (!customer || !customer.id) return;

  const nonce = clean_(
    customer.redeemRequestNonce && customer.redeemRequestNonce.value
  );

  setRewardMetafields_([
    rewardMetafieldInput_(
      customer.id,
      'redeem_request_points',
      'number_integer',
      0,
      customer.redeemRequestPoints
    ),
    rewardMetafieldInput_(
      customer.id,
      'redeem_request_nonce',
      'single_line_text_field',
      nonce && nonce.indexOf('consumed:') === 0
        ? nonce
        : (nonce ? 'consumed:' + nonce : 'consumed:cleared'),
      customer.redeemRequestNonce
    )
  ]);
}

function createRewardDiscount_(customer, points, tier) {
  const code = rewardCode_(tier.value);
  const startsAt = new Date().toISOString();
  const endsAt = new Date(
    Date.now() + JILL_REWARD_COUPON_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const mutation = `
    mutation CreateJillRewardDiscount($input: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $input) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 1) { nodes { code } }
            }
          }
        }
        userErrors { field message code }
      }
    }
  `;

  const input = {
    title: 'JILL Rewards - $' + tier.value + ' OFF - ' + customer.id,
    code: code,
    startsAt: startsAt,
    endsAt: endsAt,
    customerSelection: {
      customers: { add: [customer.id] }
    },
    customerGets: {
      value: {
        discountAmount: {
          amount: Number(tier.value),
          appliesOnEachItem: false
        }
      },
      items: { all: true }
    },
    minimumRequirement: {
      subtotal: { greaterThanOrEqualToSubtotal: Number(tier.minimum) }
    },
    usageLimit: 1,
    appliesOncePerCustomer: true,
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false
    }
  };

  const data = shopifyGraphQL_(mutation, { input: input });
  const payload = data.discountCodeBasicCreate || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify discountCodeBasicCreate: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  const node = payload.codeDiscountNode;
  const codeDiscount = node && node.codeDiscount;
  const codeNode =
    codeDiscount && codeDiscount.codes && codeDiscount.codes.nodes
      ? codeDiscount.codes.nodes[0]
      : null;

  if (!node || !node.id || !codeNode || !codeNode.code) {
    throw new Error('Shopify did not return the created JILL reward coupon.');
  }

  return {
    id: node.id,
    code: codeNode.code
  };
}

function deleteRewardDiscount_(discountId) {
  const mutation = `
    mutation DeleteJillRewardDiscount($id: ID!) {
      discountCodeDelete(id: $id) {
        deletedCodeDiscountId
        userErrors { field message code }
      }
    }
  `;

  const data = shopifyGraphQL_(mutation, { id: discountId });
  const payload = data.discountCodeDelete || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify discountCodeDelete: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.deletedCodeDiscountId || discountId;
}

function rewardWallet_(metafield) {
  if (!metafield || !metafield.value) return [];

  try {
    const parsed = JSON.parse(metafield.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function normalizeRewardCoupons_(wallet, now) {
  const currentTime = (now || new Date()).getTime();

  return (Array.isArray(wallet) ? wallet : []).map(function(raw) {
    const coupon = Object.assign({}, raw || {});
    const status = clean_(coupon.status).toLowerCase();

    if (!status) coupon.status = 'active';

    if (
      coupon.status === 'active' &&
      coupon.expires_at &&
      Date.parse(coupon.expires_at) <= currentTime
    ) {
      coupon.status = 'expired';
    }

    return coupon;
  });
}

function rewardCouponIsActive_(coupon, now) {
  if (!coupon) return false;

  const status = clean_(coupon.status).toLowerCase() || 'active';
  if (status !== 'active') return false;

  const expiresAt = Date.parse(coupon.expires_at || '');
  if (!Number.isFinite(expiresAt)) return true;

  return expiresAt > (now || new Date()).getTime();
}

function reconcileDeletedRewardDiscount_(discountId) {
  const targetId = clean_(discountId);

  if (!targetId) {
    return { reconciled_customers: 0, restored_points: 0 };
  }

  // Never trust a delete notification blindly. Confirm against Shopify first.
  // This also makes retries and watchdog-driven cleanup idempotent.
  const stillExists = rewardDiscountIdsThatStillExist_([targetId]);
  if (stillExists[targetId]) {
    return {
      reconciled_customers: 0,
      restored_points: 0,
      skipped: 'Discount still exists in Shopify'
    };
  }

  let after = null;
  let hasNextPage = true;
  let scanned = 0;
  let reconciledCustomers = 0;
  let restoredPoints = 0;

  while (hasNextPage && scanned < 1000) {
    const query = `
      query JillDeletedRewardDiscount($first: Int!, $after: String) {
        customers(first: $first, after: $after) {
          nodes {
            id
            pointsBalance: metafield(
              namespace: "jill_rewards",
              key: "points_balance"
            ) {
              value
              compareDigest
            }
            pointsRedeemed: metafield(
              namespace: "jill_rewards",
              key: "points_redeemed_lifetime"
            ) {
              value
              compareDigest
            }
            coupons: metafield(
              namespace: "jill_rewards",
              key: "coupons"
            ) {
              value
              compareDigest
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const data = shopifyGraphQL_(query, {
      first: 100,
      after: after
    });
    const connection = data.customers || {};
    const customers = connection.nodes || [];

    customers.forEach(function(customer) {
      scanned += 1;
      if (!customer || !customer.id || !customer.coupons) return;

      const now = new Date();
      const wallet = rewardWallet_(customer.coupons);
      let pointsToRestore = 0;
      let foundActiveDeletedCoupon = false;

      const reconciled = wallet.filter(function(coupon) {
        if (!coupon) return false;

        if (
          clean_(coupon.discount_id) === targetId &&
          rewardCouponIsActive_(coupon, now)
        ) {
          pointsToRestore += Math.max(0, Number(coupon.points) || 0);
          foundActiveDeletedCoupon = true;
          return false;
        }

        return true;
      });

      if (!foundActiveDeletedCoupon) return;

      const balance = rewardInt_(customer.pointsBalance);
      const redeemed = rewardInt_(customer.pointsRedeemed);

      setRewardMetafields_([
        rewardMetafieldInput_(
          customer.id,
          'coupons',
          'json',
          JSON.stringify(reconciled),
          customer.coupons
        ),
        rewardMetafieldInput_(
          customer.id,
          'points_balance',
          'number_integer',
          balance + pointsToRestore,
          customer.pointsBalance
        ),
        rewardMetafieldInput_(
          customer.id,
          'points_redeemed_lifetime',
          'number_integer',
          Math.max(0, redeemed - pointsToRestore),
          customer.pointsRedeemed
        )
      ]);

      reconciledCustomers += 1;
      restoredPoints += pointsToRestore;
    });

    const pageInfo = connection.pageInfo || {};
    hasNextPage = Boolean(pageInfo.hasNextPage);
    after = pageInfo.endCursor || null;
    if (!after) hasNextPage = false;
  }

  const result = {
    reconciled_customers: reconciledCustomers,
    restored_points: restoredPoints
  };

  Logger.log(
    'JILL Rewards deleted discount reconciliation ' +
    targetId + ': ' + JSON.stringify(result)
  );

  return result;
}

function rewardDiscountIdsThatStillExist_(discountIds) {
  const ids = (Array.isArray(discountIds) ? discountIds : [])
    .map(function(id) { return clean_(id); })
    .filter(Boolean);

  if (!ids.length) return {};

  const query = `
    query JillRewardDiscountsExist($ids: [ID!]!) {
      nodes(ids: $ids) { id }
    }
  `;

  const data = shopifyGraphQL_(query, { ids: ids });
  const existing = {};

  (data.nodes || []).forEach(function(node) {
    if (node && node.id) existing[node.id] = true;
  });

  return existing;
}

function normalizeRewardWalletForCustomer_(customer) {
  if (!customer || !customer.id || !customer.coupons) return false;

  const now = new Date();
  const wallet = rewardWallet_(customer.coupons);
  const normalized = normalizeRewardCoupons_(wallet, now);
  const activeDiscountIds = normalized
    .filter(function(coupon) { return rewardCouponIsActive_(coupon, now); })
    .map(function(coupon) { return clean_(coupon.discount_id); })
    .filter(Boolean);
  const existingDiscounts = rewardDiscountIdsThatStillExist_(activeDiscountIds);
  let pointsToRestore = 0;

  const reconciled = normalized.filter(function(coupon) {
    if (!rewardCouponIsActive_(coupon, now)) return true;

    const discountId = clean_(coupon.discount_id);
    if (!discountId || existingDiscounts[discountId]) return true;

    // A merchant/admin deleted this unused Shopify reward coupon. Remove it
    // from the customer-facing wallet and return the points because the
    // customer can no longer use what they paid points for.
    pointsToRestore += Math.max(0, Number(coupon.points) || 0);
    return false;
  });

  const walletChanged = JSON.stringify(wallet) !== JSON.stringify(reconciled);
  if (!walletChanged && pointsToRestore <= 0) return false;

  const metafields = [
    rewardMetafieldInput_(
      customer.id,
      'coupons',
      'json',
      JSON.stringify(reconciled),
      customer.coupons
    )
  ];

  if (pointsToRestore > 0) {
    const balance = rewardInt_(customer.pointsBalance);
    const redeemed = rewardInt_(customer.pointsRedeemed);

    metafields.push(
      rewardMetafieldInput_(
        customer.id,
        'points_balance',
        'number_integer',
        balance + pointsToRestore,
        customer.pointsBalance
      ),
      rewardMetafieldInput_(
        customer.id,
        'points_redeemed_lifetime',
        'number_integer',
        Math.max(0, redeemed - pointsToRestore),
        customer.pointsRedeemed
      )
    );
  }

  setRewardMetafields_(metafields);
  return true;
}

function markUsedRewardCoupons_(customer, order) {
  if (!customer || !customer.id) return false;

  const original = rewardWallet_(customer.coupons);
  const wallet = normalizeRewardCoupons_(original, new Date());
  const codes = orderDiscountCodes_(order);
  const usedAt = new Date().toISOString();
  let changed = JSON.stringify(original) !== JSON.stringify(wallet);

  wallet.forEach(function(coupon) {
    if (!rewardCouponIsActive_(coupon, new Date())) return;

    const code = clean_(coupon.code);
    if (code && codes.indexOf(code) !== -1) {
      coupon.status = 'used';
      coupon.used_at = usedAt;
      coupon.order_id = order.id;
      changed = true;
    }
  });

  if (!changed) return false;

  setRewardMetafields_([
    rewardMetafieldInput_(
      customer.id,
      'coupons',
      'json',
      JSON.stringify(wallet),
      customer.coupons
    )
  ]);

  return true;
}

function orderDiscountCodes_(order) {
  const applications =
    order && order.discountApplications && order.discountApplications.nodes
      ? order.discountApplications.nodes
      : [];

  return applications
    .map(function(application) {
      return clean_(application && application.code);
    })
    .filter(Boolean);
}

function setRewardMetafields_(metafields) {
  const mutation = `
    mutation SetJillRewardMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
          compareDigest
        }
        userErrors { field message code }
      }
    }
  `;

  const data = shopifyGraphQL_(mutation, { metafields: metafields });
  const payload = data.metafieldsSet || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify metafieldsSet: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.metafields || [];
}

function rewardMetafieldInput_(ownerId, key, type, value, existing) {
  const input = {
    ownerId: ownerId,
    namespace: 'jill_rewards',
    key: key,
    type: type,
    value: String(value)
  };

  input.compareDigest = existing ? existing.compareDigest : null;
  return input;
}

function rewardInt_(metafield) {
  const value =
    metafield && metafield.value != null
      ? Number.parseInt(metafield.value, 10)
      : 0;

  return Number.isFinite(value) ? value : 0;
}

function rewardCode_(value) {
  const token = Utilities
    .getUuid()
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase();

  return 'JILL' + value + '-' + token;
}



/* ---------------------------
   CUSTOMER CONFIRMATION
---------------------------- */

function sendConfirmation_(data) {
  const name = escapeHtml_(clean_(data.name) || 'there');
  const dateNeeded = escapeHtml_(
    clean_(data.date_needed) || 'Not provided'
  );
  const fulfillment = escapeHtml_(
    clean_(data.fulfillment) || 'Not provided'
  );

  const subject = 'We received your JILL custom order request 💜';

  const html = `
    <p>Hi ${name},</p>

    <p>We received your custom order request and it’s now in review.</p>
    <p>
      <strong>
        This is not yet a confirmed order, price, production slot,
        or delivery date.
      </strong>
      We’ll review the details you submitted and contact you with
      the next steps.
    </p>

    <p>
      <strong>Date needed:</strong> ${dateNeeded}<br>
      <strong>Fulfillment:</strong> ${fulfillment}
    </p>

    <p>
      If we need clarification, we’ll contact you using your
      preferred contact method.
    </p>

    <p>Thank you for choosing JILL!</p>

    <p>
      <strong>JILL</strong><br>
      <a href="${JILL.STORE_URL}">jillonlinestore.com</a>
    </p>
  `;

  const plainText =
`Hi ${clean_(data.name) || 'there'},

We received your custom order request and it’s now in review.

This is not yet a confirmed order, price, production slot, or delivery date. We’ll review the details you submitted and contact you with the next steps.

Date needed: ${clean_(data.date_needed) || 'Not provided'}
Fulfillment: ${clean_(data.fulfillment) || 'Not provided'}

If we need clarification, we’ll contact you using your preferred contact method.

Thank you for choosing JILL!

JILL
jillonlinestore.com`;

  MailApp.sendEmail(
    data.email,
    subject,
    plainText,
    {
      htmlBody: html,
      name: 'JILL',
      replyTo: JILL.STORE_EMAIL
    }
  );
}


/* ---------------------------
   SHOPIFY CUSTOMER SYNC
---------------------------- */

function syncShopifyCustomer_(data) {
  const existing = findShopifyCustomerByEmail_(data.email);
  const customerId = existing ? existing.id : createShopifyCustomer_(data);

  setShopifyCustomerMetafields_(customerId, data);
  return customerId;
}

function findShopifyCustomerByEmail_(email) {
  const query = `
    query FindCustomer($query: String!) {
      customers(first: 1, query: $query) {
        nodes {
          id
          email
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, {
    query: 'email:' + JSON.stringify(email)
  });

  const nodes = data.customers ? data.customers.nodes : [];
  return nodes && nodes.length ? nodes[0] : null;
}

function createShopifyCustomer_(data) {
  const mutation = `
    mutation CreateCustomer($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = {
    email: data.email,
    firstName: firstName_(data.name),
    lastName: lastName_(data.name)
  };

  const phone = clean_(data.phone);
  if (phone) input.phone = phone;

  const result = shopifyGraphQL_(mutation, { input: input });
  const payload = result.customerCreate;
  const errors = payload.userErrors || [];

  if (errors.length) {
    const duplicate = errors.some(function(error) {
      return /taken|already|exists/i.test(error.message || '');
    });

    if (duplicate) {
      const existing = findShopifyCustomerByEmail_(data.email);
      if (existing) return existing.id;
    }

    throw new Error(
      'Shopify customerCreate: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.customer.id;
}

function setShopifyCustomerMetafields_(customerId, data) {
  const metafields = buildCustomerMetafields_(customerId, data);

  if (!metafields.length) return;

  const mutation = `
    mutation SetCustomerMetafields(
      $metafields: [MetafieldsSetInput!]!
    ) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          namespace
          key
          value
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const result = shopifyGraphQL_(mutation, {
    metafields: metafields
  });

  const errors = result.metafieldsSet.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify metafieldsSet: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }
}

function buildCustomerMetafields_(ownerId, data) {
  const now = new Date().toISOString();
  const entries = [
    ['request_status', 'single_line_text_field', 'Received'],
    ['last_request_id', 'single_line_text_field', clean_(data.submission_id)],
    ['request_submitted_at', 'date_time', isoDateTime_(data.submitted_at) || now],
    ['event_date', 'date', isoDate_(data.event_date)],
    ['date_needed', 'date', isoDate_(data.date_needed)],
    ['fulfillment', 'single_line_text_field', clean_(data.fulfillment)],
    ['theme', 'multi_line_text_field', clean_(data.theme)],
    ['colors', 'multi_line_text_field', clean_(data.colors)],
    ['collections', 'json', jsonArrayString_(data.collections)],
    ['products', 'json', jsonArrayString_(data.products)],
    ['preferred_contact', 'single_line_text_field', clean_(data.preferred_contact)],
    ['phone', 'single_line_text_field', clean_(data.phone)],
    ['city', 'single_line_text_field', clean_(data.city)],
    ['state', 'single_line_text_field', clean_(data.state)],
    ['zip', 'single_line_text_field', clean_(data.zip)],
    ['reference_images', 'json', jsonArrayString_(data.reference_images)],
    ['marketing_consent', 'boolean', booleanString_(data.marketing_consent)],
    ['marketing_consent_at', 'date_time', isoDateTime_(data.marketing_consent_at)],
    ['marketing_consent_source', 'single_line_text_field', clean_(data.marketing_consent_source)]
  ];

  return entries
    .filter(function(entry) {
      return entry[2] !== '' && entry[2] != null;
    })
    .map(function(entry) {
      return {
        ownerId: ownerId,
        namespace: 'jill',
        key: entry[0],
        type: entry[1],
        value: String(entry[2])
      };
    });
}


/* ---------------------------
   SHOPIFY GRAPHQL
---------------------------- */

function shopifyGraphQL_(query, variables) {
  let attempt = 0;

  while (attempt < 2) {
    attempt++;

    const auth = getShopifyAuth_();
    const response = UrlFetchApp.fetch(
      'https://' + auth.shop +
      '/admin/api/' + JILL.SHOPIFY_API_VERSION + '/graphql.json',
      {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'X-Shopify-Access-Token': auth.accessToken
        },
        payload: JSON.stringify({
          query: query,
          variables: variables || {}
        }),
        muteHttpExceptions: true
      }
    );

    const status = response.getResponseCode();
    const text = response.getContentText();

    if ((status === 401 || status === 403) && attempt === 1) {
      getShopifyAuth_(true);
      continue;
    }

    if (status < 200 || status >= 300) {
      throw new Error(
        'Shopify GraphQL HTTP ' + status + ': ' + text
      );
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error('Invalid Shopify JSON: ' + text);
    }

    if (json.errors && json.errors.length) {
      throw new Error(
        'Shopify GraphQL: ' +
        json.errors.map(function(error) {
          return error.message;
        }).join(' | ')
      );
    }

    return json.data || {};
  }

  throw new Error('Shopify authorization failed.');
}


/* ---------------------------
   SHOPIFY AUTH
---------------------------- */

function getShopifyAuth_(forceRefresh) {
  const props = PropertiesService.getScriptProperties();
  const shop = normalizeShopDomain_(
    props.getProperty('SHOPIFY_SHOP') || 'jill-online-store.myshopify.com'
  );

  let accessToken = clean_(props.getProperty('SHOPIFY_ACCESS_TOKEN'));

  if (!forceRefresh && accessToken) {
    return {
      shop: shop,
      accessToken: accessToken
    };
  }

  const clientId = clean_(props.getProperty('SHOPIFY_CLIENT_ID'));
  const clientSecret = clean_(props.getProperty('SHOPIFY_CLIENT_SECRET'));

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET Script Property.'
    );
  }

  accessToken = exchangeShopifyClientCredentials_(
    shop,
    clientId,
    clientSecret
  );

  props.setProperty('SHOPIFY_ACCESS_TOKEN', accessToken);

  return {
    shop: shop,
    accessToken: accessToken
  };
}

function exchangeShopifyClientCredentials_(shop, clientId, clientSecret) {
  const response = UrlFetchApp.fetch(
    'https://' + shop + '/admin/oauth/access_token',
    {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      },
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      'Shopify token exchange HTTP ' + status + ': ' + text
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error('Invalid Shopify token JSON: ' + text);
  }

  const accessToken = clean_(json.access_token);

  if (!accessToken) {
    throw new Error('Shopify token exchange returned no access_token.');
  }

  return accessToken;
}

function setupShopifyOAuth() {
  const props = PropertiesService.getScriptProperties();
  const shop = normalizeShopDomain_(
    props.getProperty('SHOPIFY_SHOP') || 'jill-online-store.myshopify.com'
  );
  const clientId = clean_(props.getProperty('SHOPIFY_CLIENT_ID'));

  if (!clientId) {
    throw new Error('Missing SHOPIFY_CLIENT_ID Script Property.');
  }

  const state = Utilities.getUuid();
  props.setProperty('SHOPIFY_OAUTH_STATE', state);

  const url =
    'https://' + shop + '/admin/oauth/authorize' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&scope=' + encodeURIComponent(shopifyRequiredScopes_()) +
    '&redirect_uri=' + encodeURIComponent(shopifyOAuthRedirectUri_()) +
    '&state=' + encodeURIComponent(state);

  Logger.log('Open this Shopify authorization URL: ' + url);
  return url;
}

function handleShopifyOAuthCallback_(e) {
  const props = PropertiesService.getScriptProperties();
  const error = clean_(e && e.parameter ? e.parameter.error : '');

  if (error) {
    throw new Error(
      'Shopify OAuth error: ' +
      error + ' ' + clean_(e.parameter.error_description)
    );
  }

  const state = clean_(e && e.parameter ? e.parameter.state : '');
  const expectedState = clean_(props.getProperty('SHOPIFY_OAUTH_STATE'));

  if (!state || !expectedState || state !== expectedState) {
    throw new Error('Invalid Shopify OAuth state.');
  }

  const code = clean_(e.parameter.code);
  const shop = normalizeShopDomain_(e.parameter.shop);
  const clientId = clean_(props.getProperty('SHOPIFY_CLIENT_ID'));
  const clientSecret = clean_(props.getProperty('SHOPIFY_CLIENT_SECRET'));

  if (!code || !shop || !clientId || !clientSecret) {
    throw new Error('Incomplete Shopify OAuth callback.');
  }

  const response = UrlFetchApp.fetch(
    'https://' + shop + '/admin/oauth/access_token',
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      }),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      'Shopify OAuth token exchange HTTP ' + status + ': ' + text
    );
  }

  const json = JSON.parse(text);
  const accessToken = clean_(json.access_token);

  if (!accessToken) {
    throw new Error('Shopify OAuth did not return an access token.');
  }

  props.setProperties({
    SHOPIFY_SHOP: shop,
    SHOPIFY_ACCESS_TOKEN: accessToken
  });
  props.deleteProperty('SHOPIFY_OAUTH_STATE');

  return ContentService
    .createTextOutput(
      'JILL Shopify authorization is complete. You can close this tab.'
    )
    .setMimeType(ContentService.MimeType.TEXT);
}

function shopifyRequiredScopes_() {
  return [
    'read_customers',
    'write_customers',
    'read_orders',
    'write_orders',
    'read_discounts',
    'write_discounts'
  ].join(',');
}

function shopifyOAuthRedirectUri_() {
  const props = PropertiesService.getScriptProperties();
  const configured = clean_(props.getProperty('SHOPIFY_REDIRECT_URI'));

  if (!configured) {
    throw new Error(
      'Missing SHOPIFY_REDIRECT_URI Script Property. Set it to the public Apps Script Web app /exec URL.'
    );
  }

  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/i.test(configured)) {
    throw new Error(
      'SHOPIFY_REDIRECT_URI must be the public Apps Script Web app URL ending in /exec, not /dev: ' + configured
    );
  }

  return configured;
}

function normalizeShopDomain_(value) {
  return clean_(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
    .toLowerCase();
}


/* ---------------------------
   SHEET STORAGE
---------------------------- */

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('JILL_SHEET_ID');

  if (!sheetId) {
    throw new Error('Run setupJill() once before using the web app.');
  }

  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(JILL.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(JILL.SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function saveSubmission_(sheet, data) {
  const row = HEADERS.map(function(header) {
    return serializeValue_(data[header]);
  });

  sheet.appendRow(row);
  return sheet.getLastRow();
}

function findSubmissionRow_(sheet, submissionId) {
  if (!submissionId || sheet.getLastRow() < 2) return 0;

  const idColumn = HEADERS.indexOf('submission_id') + 1;
  const values = sheet
    .getRange(2, idColumn, sheet.getLastRow() - 1, 1)
    .getValues();

  for (let i = 0; i < values.length; i++) {
    if (clean_(values[i][0]) === submissionId) {
      return i + 2;
    }
  }

  return 0;
}

function ensureHeaders_(sheet) {
  const current = sheet
    .getRange(1, 1, 1, HEADERS.length)
    .getValues()[0];

  let needsUpdate = false;

  for (let i = 0; i < HEADERS.length; i++) {
    if (clean_(current[i]) !== HEADERS[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}


/* ---------------------------
   HELPERS
---------------------------- */

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body.');
  }

  const raw = e.postData.contents;
  const type = clean_(e.postData.type).toLowerCase();

  if (type.indexOf('application/json') !== -1) {
    return JSON.parse(raw);
  }

  // Fallback for form-encoded payloads.
  const data = {};
  raw.split('&').forEach(function(pair) {
    const parts = pair.split('=');
    const key = decodeURIComponent(parts.shift() || '');
    const value = decodeURIComponent(parts.join('=') || '').replace(/\+/g, ' ');
    data[key] = value;
  });
  return data;
}

function clean_(value) {
  return value == null ? '' : String(value).trim();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function firstName_(name) {
  const parts = clean_(name).split(/\s+/).filter(Boolean);
  return parts.length ? parts[0] : 'JILL';
}

function lastName_(name) {
  const parts = clean_(name).split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

function serializeValue_(value) {
  if (value == null) return '';
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function jsonArrayString_(value) {
  if (Array.isArray(value)) return JSON.stringify(value);

  const raw = clean_(value);
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed]);
  } catch (err) {
    return JSON.stringify([raw]);
  }
}

function booleanString_(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return 'true';
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return 'false';
  }
  return '';
}

function isoDate_(value) {
  const raw = clean_(value);
  if (!raw) return '';

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : '';
}

function isoDateTime_(value) {
  const raw = clean_(value);
  if (!raw) return '';

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function fingerprint_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(function(byte) {
      const normalized = byte < 0 ? byte + 256 : byte;
      return ('0' + normalized.toString(16)).slice(-2);
    })
    .join('');
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
