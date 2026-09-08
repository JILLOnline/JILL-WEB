import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  buildRewardJourney,
  rewardCouponStatus,
  rewardRequestIsPending,
  rewardRequestIsComplete,
  rewardWallet,
} from '../extensions/jill-account-dashboard/src/rewards.mjs';

const source = fs.readFileSync('extensions/jill-account-dashboard/src/Dashboard.jsx', 'utf8');
// Execute the actual transport and handler with controlled Shopify responses and
// hook setters. No production network calls or real-time polling in these tests.
function between(start, end) {
  assert.ok(source.includes(start) && source.includes(end));
  return source.slice(source.indexOf(start), source.indexOf(end));
}
const transport = between('async function loadData()', 'function wait(');
const mutation = between('const REQUEST_REWARD_MUTATION', 'const COLLECTIONS');
const handler = between('  async function handleRedeem(tier, trigger)', '  function rewardStatusControl(');
const nonce = 'request-1';
const tier = {points: 10, value: 5, minimum: 25};
const coupon = {points: 10, request_nonce: nonce, code: 'JILL-TEST', status: 'active'};
const meta = (points, requestNonce, coupons = []) => ({
  redeem_request_points: String(points), redeem_request_nonce: requestNonce,
  coupons: JSON.stringify(coupons),
});
const customer = (values) => ({id: 'gid://shopify/Customer/1', metafields:
  Object.entries(values).map(([key, value]) => ({key, value})),
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

function harness(overrides = {}) {
  const state = {};
  const context = vm.createContext({
    console: {warn() {}},
    customer: customer({}), points: 30, pendingPoints: 0,
    activeCouponForTier: () => null,
    rewardRequestIsPending, rewardRequestIsComplete, rewardWallet, rewardCouponStatus,
    metaMap: (data) => Object.fromEntries((data?.metafields || []).map((f) => [f.key, f.value])),
    wait: async () => {}, onCustomerUpdate() {}, requestReward: async () => nonce,
    ...Object.fromEntries(['ConfirmTier', 'FreshCoupon', 'RedeemError', 'SlowRequest',
      'SubmittingPoints', 'LocalPendingPoints'].map((key) => [`set${key}`, (value) => {state[key] = value;}])),
    ...overrides,
  });
  vm.runInContext(handler, context);
  const trigger = {disabled: false, loading: false};
  return {context, state, trigger, redeem: () => context.handleRedeem(tier, trigger)};
}

// Immediate feedback precedes the response; the clicked control itself blocks a duplicate submission.
{
  let resolveRequest;
  let writes = 0;
  const h = harness({requestReward: () => {writes++; return new Promise((resolve) => {resolveRequest = resolve;});},
    loadData: async () => customer(meta(0, `consumed:${nonce}`, [coupon])),
  });
  const result = h.redeem();
  assert.equal(h.trigger.disabled, true);
  assert.equal(h.trigger.loading, true);
  assert.equal(h.state.SubmittingPoints, 10);
  assert.equal(h.state.LocalPendingPoints, 10);
  assert.equal(h.state.ConfirmTier, null);
  await h.redeem();
  assert.equal(writes, 1);
  resolveRequest(nonce);
  await result;
  assert.equal(h.state.FreshCoupon.code, coupon.code);
  assert.equal(h.trigger.disabled, false);
  assert.equal(h.trigger.loading, false);
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
  assert.equal(h.trigger.disabled, false);
  assert.equal(h.trigger.loading, false);
}

for (const overrides of [{customer: null}, {pendingPoints: 10}, {points: 0}, {activeCouponForTier: () => coupon}]) {
  let writes = 0;
  const h = harness({...overrides, requestReward: async () => {writes++;}});
  await h.redeem();
  assert.equal(writes, 0);
  assert.ok(h.state.RedeemError);
  assert.equal(h.trigger.disabled, false);
  assert.equal(h.trigger.loading, false);
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
  assert.equal(h.trigger.disabled, false);
  assert.equal(h.trigger.loading, false);
}

// Validate actual mutation variables and all error/acknowledgment branches.
const api = vm.createContext({API: 'shopify://customer-account/api/2026-07/graphql.json', QUERY: 'query {}'});
vm.runInContext(mutation + transport, api);
api.fetch = async (_url, options) => {
  const {variables} = JSON.parse(options.body);
  assert.deepEqual(variables.metafields.map((f) => f.key), ['redeem_request_points', 'redeem_request_nonce']);
  assert.ok(variables.metafields.every((f) => f.ownerId === 'gid://shopify/Customer/1'));
  return {ok: true, json: async () => ({data: {metafieldsSet: {metafields: variables.metafields, userErrors: []}}})};
};
assert.match(await api.requestReward('gid://shopify/Customer/1', 10), /^jill:/);
for (const payload of [
  {}, {data: {metafieldsSet: null}},
  {data: {metafieldsSet: {metafields: [], userErrors: []}}},
  {errors: [{message: 'Access denied'}]},
  {data: {metafieldsSet: {userErrors: [{message: 'Not writable'}]}}},
]) {
  api.fetch = async () => ({ok: true, json: async () => payload});
  await assert.rejects(api.requestReward('gid://shopify/Customer/1', 10));
}
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
