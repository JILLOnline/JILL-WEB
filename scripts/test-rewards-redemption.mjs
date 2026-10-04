import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
assert.match(source, /<s-modal[\s\S]*?If you redeem these points, your coupon will expire in/);
assert.match(source, /No, keep my points/);
assert.match(source, /Yes, redeem/);
assert.match(source, /generating: 'Generating coupon'/);
assert.match(source, /setting_up: 'Setting up code'/);
assert.match(source, /redeemed: 'Code redeemed'/);
assert.match(source, />\s*Use Now\s*<\/s-button>/);
assert.doesNotMatch(source, /\{isThisConfirming && \(/);

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
const api = vm.createContext({API: 'shopify://customer-account/api/2026-07/graphql.json', QUERY: 'query {}'});
vm.runInContext(mutation + transport, api);
const writableCustomer = customer({
  redeem_request_points: '0',
  redeem_request_nonce: 'consumed:older',
});
let calls = 0;
api.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  calls += 1;

  if (body.query === 'query {}') {
    return {ok: true, json: async () => ({data: {customer: writableCustomer}})};
  }

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
