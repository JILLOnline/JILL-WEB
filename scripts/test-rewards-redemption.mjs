import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {assertRewardsWorkConfig, WORK_CLIENT_ID, LIVE_CLIENT_ID, WORK_STORE} from './verify-rewards-work-target.mjs';
import {
  REWARDS_REFRESH_MS,
  buildRewardJourney,
  rewardCouponStatus,
  rewardRequestIsPending,
  rewardRequestIsComplete,
  rewardRequestOutcome,
  rewardWallet,
} from '../shared/rewards.mjs';

const source = fs.readFileSync('extensions/jill-account-dashboard/src/Dashboard.jsx', 'utf8');
assert.match(source, /const STORE = storefrontOrigin\(shopify\.shop\);/, 'Dashboard must use Shopify shop storefront context');
assert.doesNotMatch(source, /const STORE = 'https:\/\/jillonlinestore\.com'/, 'Dashboard must never hard-code LIVE store');

// Execute the actual transport and handler with controlled Shopify responses and
// hook setters. No production network calls or real-time polling in these tests.
function between(start, end) {
  assert.ok(source.includes(start) && source.includes(end));
  return source.slice(source.indexOf(start), source.indexOf(end));
}
const transport = between('async function loadData()', 'function wait(');
const mutation = between('const REQUEST_REWARD_MUTATION', 'const COLLECTIONS');
const handler = between('  async function handleRedeem(tier)', '  function rewardStatusControl(');
const nonce = 'request-1';
const tier = {points: 10, value: 5, minimum: 25};
const coupon = {points: 10, request_nonce: nonce, code: 'JILL-TEST', status: 'active'};
const meta = (points, requestNonce, coupons = []) => ({
  redeem_request_points: String(points), redeem_request_nonce: requestNonce,
  coupons: JSON.stringify(coupons),
});
const customer = (values) => ({id: 'gid://shopify/Customer/1', metafields:
  Object.entries(values).map(([key, value]) => ({
    namespace: 'jill_rewards',
    key,
    value,
    compareDigest: `digest:${key}:${value}`,
  })),
});

assert.equal(rewardRequestIsPending(meta(10, nonce)), true);
assert.equal(rewardRequestIsPending(meta(10, `consumed:${nonce}`)), true);
assert.equal(rewardRequestIsPending(meta(0, `consumed:${nonce}`)), false);
assert.equal(rewardRequestIsComplete(meta(10, `consumed:${nonce}`), nonce), false);
assert.equal(rewardRequestIsComplete(meta(0, `consumed:${nonce}`), nonce), true);
assert.equal(rewardRequestIsComplete({}, nonce), false);
assert.equal(rewardRequestIsComplete(meta('invalid', `consumed:${nonce}`), nonce), false);
assert.equal(rewardRequestIsComplete(meta(0, 'consumed:older'), nonce), false);
assert.equal(buildRewardJourney(30, [], {confirmingPoints: 10}).collapsed.tier.points, 10);
assert.equal(buildRewardJourney(30, [], {pendingPoints: 10}).collapsed.tier.points, 10);

assert.equal(REWARDS_REFRESH_MS, 25000);
assert.equal(rewardRequestOutcome(meta(10, nonce), nonce).status, 'pending');
assert.equal(rewardRequestOutcome(meta(0, `consumed:${nonce}`), nonce).status, 'complete_without_coupon');
assert.equal(rewardRequestOutcome(meta(0, `consumed:${nonce}`, [coupon]), nonce).status, 'coupon');
assert.equal(rewardRequestOutcome(meta(0, 'consumed:older'), nonce).status, 'waiting');
assert.ok(source.includes('rewardRequestOutcome(meta, lastRequest.nonce)'));
assert.ok(source.includes('Rewards may be out of date.'));
// The live modal must expose platform-native, actionable footer buttons.
const modal = between('          <s-modal', '          </s-modal>');
assert.match(modal, /Your coupon expires \{REWARD_COUPON_POLICY\.expirationDays\} days after redemption/);
assert.match(modal, /<s-button[\s\S]*?slot="secondary-actions"[\s\S]*?command="--hide"[\s\S]*?Keep my points/);
assert.match(modal, /<s-button[\s\S]*?slot="primary-action"[\s\S]*?onClick=\{\(\) => \{[\s\S]*?hideOverlay\(\);[\s\S]*?handleRedeem\(tier\)/);
assert.doesNotMatch(modal, /<s-clickable/, 'confirmation controls must not be clickable-card imitations');
assert.match(source, /stage === 'redeemed'[\s\S]*?<s-icon type="check-circle-filled" tone="success" \/>/);
assert.match(source, /stage === 'setting_up' \? 'Setting up code' : 'Generating coupon'/);
assert.match(source, /if \(coupon\)[\s\S]*?Use Now/);
assert.match(source, />\s*Use Now\s*<\/s-button>/);
assert.match(source, /setRedemptionStage\(null\);\s*setLastRequest\(null\);\s*return;/);
assert.match(source, /\{redeemError && <s-banner tone="critical">\{redeemError\}<\/s-banner>\}/);
assert.match(source, /const featuredReward = journey\.items\.find\(\(item\) => item\.tier\.points === Number\(featuredPoints\)\)/);
assert.match(source, /const collapsedReward = featuredReward \|\| journey\.collapsed/);
assert.match(source, /\[collapsedReward\]/, 'a confirmed new coupon stays on screen until Use Now');
assert.match(source, /redemptionStage\.status !== 'redeemed'/);
assert.equal(source.includes('const isGeneratingReward = Boolean(pendingPoints) && !redeemError;'), false);
assert.doesNotMatch(source, /\{isThisConfirming && \(/);

 
// Execute the real confirmation callback found in the Preact modal, not a
// synthetic invocation of handleRedeem.  A modal can look correct and still
// fail to call the transaction handler (the original production regression).
{
  const primary = modal.match(
    /<s-button\s+slot="primary-action"[\s\S]*?onClick=\{\(\) => \{([\s\S]*?)\}\}\s*>/,
  );
  assert.ok(primary, 'native modal action must have an executable click handler');
  const tier = {points: 10, value: 5, minimum: 25};
  const events = [];
  const context = {
    tier,
    rewardModalRefs: {
      current: {
        10: {hideOverlay: () => events.push('modal closed')},
      },
    },
    handleRedeem: (value) => {
      assert.equal(value, tier);
      events.push('redemption requested');
    },
  };
  vm.runInNewContext(`(() => {${primary[1]}})()`, context);
  assert.deepEqual(events, ['modal closed', 'redemption requested']);

  // Cancelling never invokes the redemption callback.
  assert.match(modal, /slot="secondary-actions"[\s\S]*?command="--hide"[\s\S]*?Keep my points/);
  assert.equal(events.length, 2);
}


function harness(overrides = {}) {
  const state = {};
  const context = vm.createContext({
    console: {warn() {}},
    customer: customer({}), points: 30, pendingPoints: 0,
    redemptionInFlight: {current: false}, activeCouponForTier: () => null,
    rewardRequestIsPending, rewardRequestIsComplete, rewardWallet, rewardCouponStatus,
    metaMap: (data) => Object.fromEntries((data?.metafields || []).map((f) => [f.key, f.value])),
    wait: async () => {}, onCustomerUpdate() {}, requestReward: async () => nonce,
    ...Object.fromEntries(['FreshCoupon', 'RedeemError',
      'SubmittingPoints', 'LocalPendingPoints', 'LastRequest'].map((key) => [`set${key}`, (value) => {state[key] = value;}])),
    setRedemptionStage(value) {
      state.RedemptionStage = value;
      state.RedemptionStageHistory = [...(state.RedemptionStageHistory || []), value?.status || null];
    },
    ...overrides,
  });
  vm.runInContext(handler, context);
  return {context, state, redeem: () => context.handleRedeem(tier)};
}

// Immediate feedback precedes the response; a second click cannot submit twice.
{
  let resolveRequest;
  let writes = 0;
  const h = harness({requestReward: () => {writes++; return new Promise((resolve) => {resolveRequest = resolve;});},
    loadData: async () => customer(meta(0, `consumed:${nonce}`, [coupon])),
  });
  const result = h.redeem();
  assert.equal(h.state.SubmittingPoints, 10);
  assert.equal(h.state.LocalPendingPoints, 10);
  assert.equal(h.state.RedemptionStage.status, 'generating');
  await h.redeem();
  assert.equal(writes, 1);
  resolveRequest(nonce);
  await result;
  assert.equal(h.state.FreshCoupon.code, coupon.code);
  assert.deepEqual(
    h.state.RedemptionStageHistory.filter(Boolean),
    ['generating', 'setting_up', 'redeemed'],
  );
  assert.equal(h.context.redemptionInFlight.current, false);
}

// Stale pre-write reads and the worker's intermediate claim must keep polling.
{
  const reads = [meta(0, 'consumed:older'), meta(0, 'consumed:older'),
    meta(10, `consumed:${nonce}`), meta(10, `consumed:${nonce}`),
    meta(0, `consumed:${nonce}`, [coupon])];
  let count = 0;
  const h = harness({loadData: async () => customer(reads[count++])});
  await h.redeem();
  assert.equal(count, 5);
  assert.equal(h.state.FreshCoupon.code, coupon.code);
  assert.equal(h.state.RedeemError, '');
}

for (const overrides of [{customer: null}, {pendingPoints: 10}, {points: 0}, {activeCouponForTier: () => coupon}]) {
  let writes = 0;
  const h = harness({...overrides, requestReward: async () => {writes++;}});
  await h.redeem();
  assert.equal(writes, 0);
  assert.ok(h.state.RedeemError);
}
for (const overrides of [
  {requestReward: async () => {throw new Error('Access denied');}},
  {loadData: async () => {throw new Error('Unable to refresh');}},
  {loadData: async () => customer(meta(0, `consumed:${nonce}`))},
  {loadData: async () => customer(meta(10, `consumed:${nonce}`))},
]) {
  const h = harness(overrides);
  await h.redeem();
  assert.ok(h.state.RedeemError);
  assert.equal(h.state.SubmittingPoints, 0);
  assert.equal(h.context.redemptionInFlight.current, false);
}

// Validate actual mutation variables, CAS behavior and all error/acknowledgment branches.
const READ_API = 'shopify://customer-account/api/2026-07/graphql.json';
const WRITE_API = 'shopify:customer-account/api/2026-07/graphql.json';
assert.match(source, /const API = 'shopify:\/\/customer-account\/api\/2026-07\/graphql\.json'/);
assert.match(source, /const WRITE_API = 'shopify:customer-account\/api\/2026-07\/graphql\.json'/);
const api = vm.createContext({API: READ_API, WRITE_API, QUERY: 'query {}'});
vm.runInContext(mutation + transport, api);
const writableCustomer = customer({
  redeem_request_points: '0',
  redeem_request_nonce: 'consumed:older',
});
let calls = 0;
api.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  calls += 1;

  if (body.query === 'query {}') {
    assert.equal(url, READ_API, 'customer read must use the read transport');
    return {ok: true, json: async () => ({data: {customer: writableCustomer}})};
  }

  assert.equal(url, WRITE_API, 'redemption write must use Shopify documented write transport');
  const {variables} = body;
  assert.deepEqual(variables.metafields.map((f) => f.key), ['redeem_request_points', 'redeem_request_nonce']);
  assert.ok(variables.metafields.every((f) => f.ownerId === 'gid://shopify/Customer/1'));
  assert.ok(variables.metafields.every((f) => typeof f.compareDigest === 'string'));
  assert.ok(variables.metafields.every((f) => !Object.hasOwn(f, 'type')));
  return {
    ok: true,
    json: async () => ({
      data: {
        metafieldsSet: {
          metafields: variables.metafields.map((field) => ({
            namespace: field.namespace,
            key: field.key,
            value: field.value,
            compareDigest: 'next',
          })),
          userErrors: [],
        },
      },
    }),
  };
};
assert.match(await api.requestReward('gid://shopify/Customer/1', 10), /^jill:/);
assert.equal(calls, 2);

// A digest conflict is refreshed and retried once.
{
  let mutationCalls = 0;
  api.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.query === 'query {}') {
      return {ok: true, json: async () => ({data: {customer: writableCustomer}})};
    }
    mutationCalls += 1;
    if (mutationCalls === 1) {
      return {
        ok: true,
        json: async () => ({
          data: {metafieldsSet: {metafields: [], userErrors: [{code: 'STALE_OBJECT', message: 'Compare digest mismatch'}]}},
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        data: {
          metafieldsSet: {
            metafields: body.variables.metafields.map((field) => ({
              namespace: field.namespace,
              key: field.key,
              value: field.value,
              compareDigest: 'next',
            })),
            userErrors: [],
          },
        },
      }),
    };
  };
  assert.match(await api.requestReward('gid://shopify/Customer/1', 10), /^jill:/);
  assert.equal(mutationCalls, 2);
}

// Authorization and business errors are surfaced with the Shopify error code.
api.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  if (body.query === 'query {}') {
    return {ok: true, json: async () => ({data: {customer: writableCustomer}})};
  }
  return {
    ok: true,
    json: async () => ({
      errors: [{message: 'Access denied for metafieldsSet field.', extensions: {code: 'ACCESS_DENIED'}}],
    }),
  };
};
await assert.rejects(
  api.requestReward('gid://shopify/Customer/1', 10),
  /Access denied for metafieldsSet field\. \(ACCESS_DENIED\)/,
);

api.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  if (body.query === 'query {}') {
    return {ok: true, json: async () => ({data: {customer: writableCustomer}})};
  }
  return {ok: true, json: async () => ({data: {metafieldsSet: {metafields: [], userErrors: []}}})};
};
await assert.rejects(api.requestReward('gid://shopify/Customer/1', 10), /did not confirm/);

api.fetch = async () => ({ok: false, json: async () => ({})});
await assert.rejects(api.requestReward('gid://shopify/Customer/1', 10));
api.fetch = async () => ({ok: true, json: async () => {throw new Error('Invalid JSON');}});
await assert.rejects(api.requestReward('gid://shopify/Customer/1', 10));
api.fetch = async () => ({ok: true, json: async () => ({data: {customer: customer({})}, errors: [{message: 'Metafields denied'}]})});
await assert.rejects(api.loadData(), /Metafields denied/);
api.fetch = async () => ({ok: true, json: async () => ({data: {customer: null}})});
await assert.rejects(api.loadData());

console.log('JILL Rewards redemption interaction/transport regression tests passed.');

// Exercise the real backend request pipeline, including its intermediate claim
// and atomic wallet/points write. Preserve its CAS and rollback protections.
const backendSource = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
function backendHarness(failCommit = false) {
  const backend = vm.createContext({console});
  vm.runInContext(backendSource, backend);
  let record = {
    id: 'gid://shopify/Customer/1',
    pointsBalance: {value: '30', compareDigest: 'balance'},
    pointsEarned: {value: '30', compareDigest: 'earned'},
    pointsRedeemed: {value: '0', compareDigest: 'redeemed'},
    coupons: {value: '[]', compareDigest: 'wallet'},
    redeemRequestPoints: {value: '10', compareDigest: 'points'},
    redeemRequestNonce: {value: nonce, compareDigest: 'nonce'},
  };
  let created = 0;
  let deleted = 0;
  let committed = false;
  backend.getRewardsCustomer_ = () => structuredClone(record);
  backend.normalizeRewardWalletForCustomer_ = () => false;
  backend.shopifyGraphQL_ = (_query, {metafields}) => {
    assert.equal(metafields[0].key, 'redeem_request_nonce');
    assert.equal(metafields[0].compareDigest, record.redeemRequestNonce.compareDigest);
    record.redeemRequestNonce = {value: metafields[0].value, compareDigest: 'claimed'};
    return {metafieldsSet: {metafields, userErrors: []}};
  };
  backend.createRewardDiscount_ = () => {
    assert.equal(rewardRequestIsPending(meta(record.redeemRequestPoints.value, record.redeemRequestNonce.value)), true);
    created++;
    return {id: 'gid://shopify/DiscountCodeNode/1', code: coupon.code};
  };
  backend.deleteRewardDiscountIfPresent_ = () => {deleted++;};
  backend.setRewardMetafields_ = (fields) => {
    const wallet = fields.find((f) => f.key === 'coupons');
    if (wallet) {
      assert.equal(fields.some((f) => f.key === 'redeem_request_nonce'), false);
      assert.equal(wallet.compareDigest, 'wallet');
      assert.equal(fields.find((f) => f.key === 'redeem_request_points').compareDigest, 'points');
      if (failCommit) throw new Error('CAS conflict');
      assert.equal(fields.find((f) => f.key === 'points_balance').value, '20');
      assert.equal(fields.find((f) => f.key === 'points_redeemed_lifetime').value, '10');
      assert.equal(JSON.parse(wallet.value)[0].request_nonce, nonce);
      committed = true;
    }
    for (const field of fields) {
      const key = {coupons: 'coupons', points_balance: 'pointsBalance',
        points_redeemed_lifetime: 'pointsRedeemed', redeem_request_points: 'redeemRequestPoints',
        redeem_request_nonce: 'redeemRequestNonce'}[field.key];
      record[key] = {value: field.value, compareDigest: `updated:${key}`};
    }
  };
  return {backend, stats: () => ({created, deleted, committed, record})};
}
{
  const h = backendHarness();
  const result = h.backend.processRewardRequest_('gid://shopify/Customer/1', nonce);
  assert.equal(result.coupon.code, coupon.code);
  assert.equal(h.stats().committed, true);
  assert.equal(h.stats().record.redeemRequestPoints.value, '0');
  h.backend.processRewardRequest_('gid://shopify/Customer/1', nonce);
  assert.equal(h.stats().created, 1);
}
{
  const h = backendHarness(true);
  assert.throws(() => h.backend.processRewardRequest_('gid://shopify/Customer/1', nonce), /CAS conflict/);
  assert.equal(h.stats().deleted, 1);
  assert.equal(h.stats().committed, false);
  assert.equal(h.stats().record.pointsBalance.value, '30');
  assert.equal(h.stats().record.redeemRequestPoints.value, '0');
}
console.log('JILL Rewards backend claim/commit/rollback regression tests passed.');


{
  const backendSource = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
  assert.match(backendSource, /JILL_REWARDS_SWEEP_CURSOR_PROPERTY = 'JILL_REWARDS_SWEEP_CURSOR'/);
  assert.match(backendSource, /JILL_REWARDS_SWEEP_MAX_PAGES_PER_RUN = 5/);
  assert.match(
    backendSource,
    /props\.setProperty\(JILL_REWARDS_SWEEP_CURSOR_PROPERTY, nextCursor\)[\s\S]*?after = nextCursor/,
    'resumable sweep cursor contract commits a handled page before advancing',
  );
  assert.match(
    backendSource,
    /if \(after && pagesScanned === 0 && !cursorRecovered\)[\s\S]*?deleteProperty\(JILL_REWARDS_SWEEP_CURSOR_PROPERTY\)[\s\S]*?after = null/,
    'resumable sweep cursor contract recovers a rejected stored cursor once',
  );
  const sweepStart = backendSource.indexOf('function processPendingJillRewardRequests() {');
  const sweepEnd = backendSource.indexOf('\nfunction rewardWebhookSubscriptionForKey_(', sweepStart);
  assert.ok(sweepStart >= 0 && sweepEnd > sweepStart, 'normal Rewards sweep function boundaries must exist');
  const sweepSource = backendSource.slice(sweepStart, sweepEnd);
  assert.doesNotMatch(
    sweepSource,
    /while \(hasNextPage && scanned < 1000\)/,
    'normal Rewards sweep must not restart with a permanent 1,000-customer ceiling',
  );
}
console.log('JILL Rewards resumable sweep cursor contract passed.');


{
  const backendSource = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
  assert.match(
    backendSource,
    /enqueueDeletedRewardDiscount_\(discountId\)/,
    'DISCOUNTS_DELETE should enqueue durable reconciliation work',
  );
  assert.match(
    backendSource,
    /queue\.some\(function\(job\)[\s\S]*?job\.discount_id\) === targetId/,
    'deleted-discount queue should deduplicate repeated deliveries',
  );
  assert.match(
    backendSource,
    /job\.cursor = nextCursor;[\s\S]*?saveRewardDeletedDiscountQueue_\(queue\);[\s\S]*?after = nextCursor/,
    'deleted-discount queue should persist a handled page before advancing',
  );
  assert.match(
    backendSource,
    /queue\.shift\(\);[\s\S]*?saveRewardDeletedDiscountQueue_\(queue\);[\s\S]*?cycleComplete = true/,
    'deleted-discount queue should remove a job only after full traversal',
  );
  assert.doesNotMatch(
    backendSource.slice(
      backendSource.indexOf('function processDeletedRewardDiscountQueue_() {'),
      backendSource.indexOf('\nfunction normalizeRewardWalletForCustomer_', backendSource.indexOf('function processDeletedRewardDiscountQueue_() {')),
    ),
    /while \(hasNextPage && scanned < 1000\)/,
    'deleted-discount reconciliation must not have a permanent 1,000-customer ceiling',
  );
}
console.log('JILL Rewards deleted-discount durable queue contract passed.');


{
  const backendSource = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
  const watchdogStart = backendSource.indexOf('function runJillRewardsWatchdog_() {');
  const watchdogEnd = backendSource.indexOf('\nfunction processPendingJillRewardRequests()', watchdogStart);
  assert.ok(watchdogStart >= 0 && watchdogEnd > watchdogStart, 'watchdog function boundaries must exist');
  const watchdogSource = backendSource.slice(watchdogStart, watchdogEnd);

  for (const forbidden of [
    'ensureJillRewardsInfrastructure_(',
    'ensureJillPublicPromotionsHealthy_(',
    'processPendingJillRewardRequests(',
    'setProperty(',
    'deleteProperty(',
  ]) {
    assert.equal(
      watchdogSource.includes(forbidden),
      false,
      `read-only watchdog contract must not contain ${forbidden}`,
    );
  }

  assert.match(backendSource, /JILL_REWARDS_LAST_SWEEP_PROPERTY = 'JILL_REWARDS_LAST_SWEEP'/);
  assert.match(backendSource, /ensureJillPublicPromotionsHealthy_\(false\)/);
  assert.match(backendSource, /jillRewardsInfrastructureHealth_\(\)/);
  assert.match(backendSource, /jillRewardsSweepHealth_\(\)/);
}
console.log('JILL Rewards read-only watchdog contract passed.');


{
  const backendSource = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
  assert.match(
    backendSource,
    /rewardWebhookSubscriptionForKey_\(\s*suppliedRewardTopic\s*\)/,
    'webhook ingress must validate the requested topic before processing',
  );
  assert.match(
    backendSource,
    /jill-rewards-webhook-v2\|' \+ subscription\.key \+ '\|' \+ clientSecret/,
    'webhook query secret must be topic-scoped',
  );
  assert.match(
    backendSource,
    /constantTimeEqual_\([\s\S]*?suppliedRewardSecret[\s\S]*?rewardWebhookSecret_\(subscription\.key\)/,
    'webhook ingress must compare the topic-scoped secret with constant work',
  );
  assert.doesNotMatch(
    backendSource,
    /suppliedRewardSecret === rewardWebhookSecret_\(\)/,
    'global webhook query secret must not return',
  );
  assert.match(
    backendSource,
    /webhook_auth_mode: 'topic_scoped_query_secret_v2'/,
    'health must report the actual webhook auth mode',
  );
  assert.match(
    backendSource,
    /standard_hmac_verified: false/,
    'health must not falsely claim Shopify HMAC verification while Apps Script is the ingress',
  );
}
console.log('JILL Rewards topic-scoped webhook ingress contract passed.');


{
  const backendSource = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
  const sharedSource = fs.readFileSync('shared/rewards.mjs', 'utf8');
  const dashboardSource = fs.readFileSync('extensions/jill-account-dashboard/src/Dashboard.jsx', 'utf8');
  const couponsSource = fs.readFileSync('extensions/jill-account-coupons/src/Coupons.jsx', 'utf8');
  for (const key of ['active_coupon_code', 'active_coupon_value_cents', 'active_coupon_points']) {
    for (const source of [backendSource, sharedSource, dashboardSource, couponsSource]) {
      assert.equal(source.includes(key), false, `retired Rewards field must stay removed: ${key}`);
    }
  }
}
console.log('JILL Rewards retired Rewards schema contract passed.');


// WORK Preview must remain tied to the independently created dev app and store.
{
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.notEqual(WORK_CLIENT_ID, LIVE_CLIENT_ID);
  assert.equal(WORK_STORE, 'jill-work.myshopify.com');
  assert.equal(pkg.scripts['rewards:work:link'],
    `shopify app config link --client-id ${WORK_CLIENT_ID} --file-name work`);
  assert.equal(pkg.scripts['rewards:work:preview'],
    `node scripts/prepare-rewards-work-config.mjs && node scripts/verify-rewards-work-target.mjs && shopify app dev --config work --store ${WORK_STORE}`);

  const scopes = 'customer_read_customers,customer_write_customers,customer_read_orders,read_customers,write_customers,read_orders,write_orders,read_discounts,write_discounts';
  const source = `name = "JILL WORK Rewards"
client_id = "${WORK_CLIENT_ID}"
application_url = "https://example.com"
embedded = false

[access_scopes]
scopes = "${scopes}"
`;
  assert.equal(assertRewardsWorkConfig(source).clientId, WORK_CLIENT_ID);
  assert.throws(() => assertRewardsWorkConfig(source.replace(WORK_CLIENT_ID, LIVE_CLIENT_ID)), /Client ID/);
  assert.throws(() => assertRewardsWorkConfig(source.replace('JILL WORK Rewards', 'JILL Custom Form')), /app name/);
  assert.throws(() => assertRewardsWorkConfig(source.replace('customer_write_customers,', '')), /missing Rewards scopes/);
  assert.throws(() => assertRewardsWorkConfig(source.replace('https://example.com', 'https://jillonlinestore.com')), /LIVE store/);
  assert.throws(() => assertRewardsWorkConfig(''), /Missing WORK app configuration/);
}
console.log('JILL Rewards WORK app isolation contract passed.');


// WORK backend must be built from the canonical engine rather than maintained
// as a separate Rewards implementation. Never upload production identifiers.
{
  execFileSync(process.execPath,['scripts/build-rewards-work-backend.mjs'],{stdio:'pipe'});
  const work = fs.readFileSync('.work-backend/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
  const canonical = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
  assert.match(canonical, /const JILL_REWARDS_RUNTIME = 'LIVE';/);
  assert.match(work, /const JILL_REWARDS_RUNTIME = 'WORK';/);
  assert.match(work, /assertJillRewardsRuntimeTarget_\(\)/);
  assert.match(work, /shop !== 'jill-work.myshopify.com'/);
  assert.match(work, /app !== 'f8e1ebdbae84490dc8ea5b133637e6c0'/);
  assert.doesNotMatch(work, /jillonlinestore\.com|jqtdgr-1y\.myshopify\.com|1xVG4Jvh-vLB6BH5QitNcLQuaLj6DkXeSlFHg_LkECT8/);
  assert.match(work, /WORK Rewards worker cannot access the Custom Order sheet/);
  assert.match(work, /WORK backend accepts Rewards webhooks only/);
  assert.match(work, /function processPendingJillRewardRequests\(\)/);
  assert.match(work, /function createRewardDiscount_\(/);
  const manifest = JSON.parse(fs.readFileSync('.work-backend/appsscript.json','utf8'));
  assert.equal(manifest.runtimeVersion,'V8');
  assert.equal(manifest.webapp.access,'ANYONE_ANONYMOUS');
  assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
  const bootstrap = fs.readFileSync('scripts/bootstrap-rewards-work-backend.mjs','utf8');
  assert.match(bootstrap, /assertRewardsWorkConfig/);
  assert.match(bootstrap,
    /execFileSync\(process\.execPath,\['scripts\/prepare-rewards-work-config\.mjs'\]/,
    'WORK bootstrap must prepare local scopes before validation');
  assert.ok(bootstrap.indexOf("prepare-rewards-work-config.mjs") <
    bootstrap.indexOf("assertRewardsWorkConfig(fs.readFileSync"),
    'WORK scope preparation must precede all bootstrap configuration verification');

  assert.match(bootstrap, /jill\/rewards-work/);
  assert.match(bootstrap, /record\.clientId !== WORK_CLIENT_ID/);
  assert.match(bootstrap, /record\.shop !== WORK_STORE/);
  assert.match(bootstrap, /runClasp\('push','--force'\)/);
  // Exercise the exact Windows cmd.exe argument quoting that previously
  // broke --title "JILL WORK Rewards Engine" into extra positional tokens.
  const quoteFunction = bootstrap.match(/^function windowsClaspArg\(value\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(quoteFunction, 'Windows clasp shell argument encoder must be present');
  const quoteWindows = vm.runInNewContext(`${quoteFunction}\nwindowsClaspArg`);
  assert.equal(quoteWindows('JILL WORK Rewards Engine'), '"JILL WORK Rewards Engine"');
  assert.equal(quoteWindows('create-script'), 'create-script');
  assert.equal(quoteWindows('--title'), '--title');
  assert.throws(() => quoteWindows('bad & shell'), /Unsafe Windows clasp argument/);
  assert.throws(() => quoteWindows('bad" quote'), /Unsafe Windows clasp argument/);

  assert.match(bootstrap, /JSON\.parse\(authCheck\.stdout\.trim\(\)\)\.loggedIn === true/);
  assert.match(bootstrap, /runClasp\('login'\)/);

  assert.doesNotMatch(bootstrap, /runClasp\('create-deployment'/);
  const workPackage = JSON.parse(fs.readFileSync('package.json','utf8'));
  assert.equal(workPackage.scripts['rewards:work:backend:bootstrap'],
    'node scripts/bootstrap-rewards-work-backend.mjs');
  assert.equal(workPackage.scripts['rewards:work:backend:update'],
    'node scripts/update-rewards-work-deployment.mjs');
  const deploymentUpdater = fs.readFileSync('scripts/update-rewards-work-deployment.mjs','utf8');
  assert.match(deploymentUpdater, /assertRewardsWorkConfig/);
  assert.match(deploymentUpdater, /project.clientId !== WORK_CLIENT_ID/);
  assert.match(deploymentUpdater, /project.shop !== WORK_STORE/);
  assert.match(deploymentUpdater, /clasp.scriptId !== project.scriptId/);
  assert.match(deploymentUpdater, /claspRun\('list-deployments'\)/);
  assert.match(deploymentUpdater, /existing.includes\(WORK_DEPLOYMENT_ID\)/);
  assert.match(deploymentUpdater, /claspRun\('update-deployment',WORK_DEPLOYMENT_ID\)/);
  assert.doesNotMatch(deploymentUpdater, /claspRun\('create-deployment'/);
  assert.doesNotMatch(deploymentUpdater, /claspRun\('run-function'/);


}
console.log('JILL WORK canonical backend packaging and isolation passed.');


// The deployed WORK webhook must propagate the original processing error,
// rather than obscuring it with an undeclared verifiedRewardHook ReferenceError.
{
  const backend = fs.readFileSync(
    'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
  const start = backend.indexOf('function doPost(e) {');
  const end = backend.indexOf('/* ---------------------------\n   JILL REWARDS', start);
  assert.ok(start >= 0 && end > start);
  const postSource = backend.slice(start, end);
  const originalError = new Error('WORK backend test: Shopify webhook failed');
  let released = false;
  const context = {
    JILL_REWARDS_RUNTIME: 'WORK',
    LockService: {getScriptLock: () => ({
      waitLock() {},
      releaseLock() {released = true;},
    })},
    clean_: value => String(value ?? '').trim(),
    rewardWebhookSubscriptionForKey_: key => ({key}),
    constantTimeEqual_: (a,b) => a === b,
    rewardWebhookSecret_: () => 'test-hook-token',
    handleJillRewardsWebhook_: () => {throw originalError;},
    json_: value => value,
    console: {error() {}},
  };
  const doPost = vm.runInNewContext(postSource + '\ndoPost', context);
  const event = {parameter: {
    jill_rewards_topic: 'customers_update',
    jill_rewards_hook: 'test-hook-token',
  }};
  assert.throws(() => doPost(event), error => error === originalError);
  assert.equal(released, true, 'Webhook lock should be released after a failure');
  const rejected = doPost({parameter: {...event.parameter,jill_rewards_hook:'wrong'}});
  assert.equal(rejected.ok,false);
  assert.equal(rejected.error,'Invalid rewards webhook');
  const customOrderRejected = doPost({parameter:{}});
  assert.equal(customOrderRejected.ok,false);
  assert.match(customOrderRejected.error,/WORK backend accepts Rewards webhooks only/);
}


// Schema-level regression: Shopify basic discounts cannot receive tags.
// Exercise the actual backend function with mocked Shopify responses.
{
  const source = fs.readFileSync(
    'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
  const discountSource = source.slice(
    source.indexOf('function createRewardDiscount_(customer, points, tier) {'),
    source.indexOf('function deleteRewardDiscount_(discountId)')
  );
  let input;
  const context = {
    rewardCode_: ()=>'JILL5-SCHEMA',
    JILL_REWARD_COUPON_DAYS:30,
    JILL_REWARD_USAGE_LIMIT:1,
    JILL_REWARD_APPLIES_ONCE_PER_CUSTOMER:true,
    JILL_REWARD_ORDER_STACKING:false,
    JILL_REWARD_PRODUCT_STACKING:false,
    JILL_REWARD_SHIPPING_STACKING:false,
    JILL_REWARDS_ENGINE_VERSION:'13',
    shopifyGraphQL_: (_query, variables)=>{
      input = variables.input;
      return {discountCodeBasicCreate:{
        codeDiscountNode:{id:'gid://shopify/DiscountCodeNode/1',
          codeDiscount:{codes:{nodes:[{code:'JILL5-SCHEMA'}]}}},
        userErrors:[],
      }};
    },
  };
  const create = vm.runInNewContext(discountSource+'\ncreateRewardDiscount_',context);
  const result = create({id:'gid://shopify/Customer/1'},10,{value:5,minimum:25});
  assert.equal(result.code,'JILL5-SCHEMA');
  // Keys confirmed in the Shopify 2026-07 DiscountCodeBasicInput schema.
  assert.deepEqual(Object.keys(input).sort(), [
    'title','code','startsAt','endsAt','context','customerGets',
    'minimumRequirement','usageLimit','appliesOncePerCustomer','combinesWith',
  ].sort());
  assert.equal(input.customerGets.value.discountAmount.amount,'5');
  assert.equal(input.minimumRequirement.subtotal.greaterThanOrEqualToSubtotal,'25');
  assert.equal(input.context.customers.add[0],'gid://shopify/Customer/1');
}

// The Shopify 2026-07 LineItem type has no
// priceAfterAllDiscountsBeforeTaxesSet field. Use an available price which
// accounts for order discounts times currentQuantity (surviving units).
{
  const source=fs.readFileSync(
    'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
  const start=source.indexOf('function reconcileRewardsOrder_(orderId, allowInitialCredit) {');
  const end=source.indexOf('function setRewardLedger_(',start);
  assert.ok(start>=0 && end>start);
  const fn=source.slice(start,end);
  assert.doesNotMatch(fn,/priceAfterAllDiscountsBeforeTaxesSet/);
  assert.match(fn,/discountedUnitPriceAfterAllDiscountsSet/);
  assert.match(fn,/currentQuantity/);
  let recorded;
  const order={
    id:'gid://shopify/Order/1',
    cancelledAt:null,
    customer:{
      id:'gid://shopify/Customer/1',
      eligibleSpend:{value:'3750'},
      pointsEarned:{value:'3'},
      pointsRedeemed:{value:'0'},
      pointsBalance:{value:'3'},
      coupons:{value:'[]'}
    },
    creditedCents:{value:'3750'},
    lineItems:{nodes:[
      {isGiftCard:false,currentQuantity:2,
        discountedUnitPriceAfterAllDiscountsSet:{
          shopMoney:{amount:'12.50',currencyCode:'USD'}}},
      {isGiftCard:true,currentQuantity:1,
        discountedUnitPriceAfterAllDiscountsSet:{
          shopMoney:{amount:'999',currencyCode:'USD'}}},
    ]},
    discountApplications:{nodes:[]},
  };
  const context={
    shopifyGraphQL_:()=>({order}),
    rewardInt_: x=>Number(x?.value||0),
    rewardWallet_:()=>[],
    normalizeRewardCoupons_:wallet=>wallet,
    markRewardCouponsUsedInWallet_:()=>false,
    revokeActiveRewardsForSolvency_:()=>({revoked_points:0}),
    rewardCommittedPoints_:()=>0,
    setRewardLedger_:(...args)=>{recorded=args},
    JILL_REWARD_SPEND_CENTS_PER_POINT:1000,
    JILL_REWARDS_ENGINE_VERSION:'13',
  };
  const reconcile=vm.runInNewContext(fn+'\nreconcileRewardsOrder_',context);
  const result=reconcile(order.id,false);
  assert.equal(result.eligible_cents,2500);
  assert.equal(result.delta_cents,-1250);
  assert.equal(result.points_earned,2);
  assert.equal(result.points_balance,2);
  assert.equal(recorded[2],2500);
  assert.equal(recorded[3],2);
  assert.equal(recorded[5],2);
  assert.equal(recorded[6],2500);
}
