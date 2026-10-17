import './test-rewards-redemption.mjs';
import assert from 'node:assert/strict';
import {
  REWARD_STATES,
  buildRewardJourney,
  chooseSolvencyRevocations,
  rewardAccounting,
  rewardCouponStatus,
  discountCartUrl,
  storefrontOrigin,
  loadCustomerAccountStorefront,
} from '../shared/rewards.mjs';

const FAR_FUTURE = '2099-10-01T00:00:00Z';
function active(points, createdAt = '2026-09-01T00:00:00Z') {
  return {points, status: 'active', created_at: createdAt, expires_at: FAR_FUTURE};
}
function used(points) {
  return {points, status: 'used', created_at: '2026-09-01T00:00:00Z'};
}
function expired(points) {
  return {points, status: 'expired', created_at: '2026-08-01T00:00:00Z'};
}
function revoked(points) {
  return {points, status: 'revoked', created_at: '2026-09-01T00:00:00Z'};
}

const boundaries = [
  [0, 10, REWARD_STATES.NEXT_REWARD],
  [5, 10, REWARD_STATES.NEXT_REWARD],
  [10, 20, REWARD_STATES.NEXT_REWARD],
  [19, 20, REWARD_STATES.NEXT_REWARD],
  [20, 35, REWARD_STATES.NEXT_REWARD],
  [30, 35, REWARD_STATES.NEXT_REWARD],
  [35, 50, REWARD_STATES.NEXT_REWARD],
  [49, 50, REWARD_STATES.NEXT_REWARD],
  [50, 50, REWARD_STATES.REDEEM],
  [80, 50, REWARD_STATES.REDEEM],
];

for (const [points, collapsedTier, collapsedState] of boundaries) {
  const journey = buildRewardJourney(points, []);
  assert.equal(journey.collapsed.tier.points, collapsedTier, `collapsed tier at ${points}`);
  assert.equal(journey.collapsed.state, collapsedState, `collapsed state at ${points}`);
  assert.ok(journey.items.filter((item) => item.state === REWARD_STATES.NEXT_REWARD).length <= 1);
}

// Next Reward wins collapsed mode even when lower tiers are redeemable.
{
  const journey = buildRewardJourney(30, []);
  assert.equal(journey.items.find((i) => i.tier.points === 20).state, REWARD_STATES.REDEEM);
  assert.equal(journey.collapsed.tier.points, 35);
  assert.equal(journey.collapsed.state, REWARD_STATES.NEXT_REWARD);
}

// Active coupon changes only that tier to USE_COUPON and does not erase other redeemable tiers.
{
  const journey = buildRewardJourney(60, [active(10)]);
  assert.equal(journey.items.find((i) => i.tier.points === 10).state, REWARD_STATES.USE_COUPON);
  assert.equal(journey.items.find((i) => i.tier.points === 20).state, REWARD_STATES.REDEEM);
  assert.equal(journey.collapsed.tier.points, 50);
}

// Expanded order is creating -> next -> redeemable -> usable -> locked.
{
  const journey = buildRewardJourney(30, [active(10)], {pendingPoints: 20});
  assert.equal(journey.expanded[0].tier.points, 20);
  assert.equal(journey.expanded[0].transientState, REWARD_STATES.CREATING);
  const persistent = journey.expanded.map((i) => i.state);
  assert.ok(persistent.indexOf(REWARD_STATES.NEXT_REWARD) < persistent.indexOf(REWARD_STATES.USE_COUPON));
}

// Revoked coupons release their reservation and can be earned/redeemed again.
{
  const journey = buildRewardJourney(10, [revoked(10)]);
  assert.equal(journey.items.find((i) => i.tier.points === 10).state, REWARD_STATES.REDEEM);
}

// Accounting: active points are reserved; used/expired are consumed; revoked are released.
{
  const account = rewardAccounting(50, [active(20), used(10), expired(10), revoked(10)]);
  assert.deepEqual(account, {earned: 50, reserved: 20, consumed: 20, committed: 40, balance: 10, deficit: 0});
}

// Refund solvency revokes newest unused rewards first.
{
  const wallet = [
    active(20, '2026-09-01T00:00:00Z'),
    active(35, '2026-09-05T00:00:00Z'),
    used(10),
  ];
  const revoke = chooseSolvencyRevocations(30, wallet);
  assert.deepEqual(revoke.map((coupon) => coupon.points), [35]);
}

// A used coupon is never clawed back. The deficit is absorbed by future earning.
{
  const account = rewardAccounting(5, [used(10)]);
  assert.equal(account.balance, 0);
  assert.equal(account.deficit, 5);
  assert.deepEqual(chooseSolvencyRevocations(5, [used(10)]), []);
}

// Full-refund active reward: all unused reservations can be revoked.
{
  const wallet = [active(10), active(20, '2026-09-02T00:00:00Z')];
  assert.deepEqual(chooseSolvencyRevocations(0, wallet).map((c) => c.points), [20, 10]);
}

// Expiration is deterministic and remains a committed spend of points.
{
  const coupon = {points: 10, status: 'active', expires_at: '2026-09-01T00:00:00Z'};
  assert.equal(rewardCouponStatus(coupon, Date.parse('2026-09-02T00:00:00Z')), 'expired');
  const account = rewardAccounting(10, [coupon], Date.parse('2026-09-02T00:00:00Z'));
  assert.equal(account.balance, 0);
  assert.equal(account.consumed, 10);
}

console.log('JILL Rewards v13 state/accounting tests passed.');

 
// The two Customer Account surfaces must share the same native Shopify route.
// This is a link contract only, not a claim of session-bound cart persistence.
assert.equal(
  discountCartUrl('https://jillonlinestore.com', 'JILL-TEST'),
  'https://jillonlinestore.com/discount/JILL-TEST?redirect=/cart',
);
assert.equal(
  discountCartUrl('https://jillonlinestore.com/', 'HELLO 5%'),
  'https://jillonlinestore.com/discount/HELLO%205%25?redirect=/cart',
);
assert.throws(() => discountCartUrl('javascript:alert(1)', 'CODE'));
assert.throws(() => discountCartUrl('https://jillonlinestore.com', ''));

 
// Both WORK and LIVE account extensions must navigate only to Shopify's
// current shop. No hard-coded LIVE fallback is permitted in a WORK preview.
assert.equal(
  storefrontOrigin({myshopifyDomain: 'jill-work.myshopify.com', storefrontUrl: 'https://jill-work.myshopify.com/'}),
  'https://jill-work.myshopify.com',
);
assert.equal(
  storefrontOrigin({myshopifyDomain: 'jqtdgr-1y.myshopify.com', storefrontUrl: 'https://jillonlinestore.com/collections/all'}),
  'https://jillonlinestore.com',
);
assert.equal(
  storefrontOrigin({myshopifyDomain: 'jill-work.myshopify.com'}),
  'https://jill-work.myshopify.com',
);
assert.equal(
  discountCartUrl(storefrontOrigin({myshopifyDomain: 'jill-work.myshopify.com'}), 'TEST 5'),
  'https://jill-work.myshopify.com/discount/TEST%205?redirect=/cart',
);
assert.throws(() => storefrontOrigin({storefrontUrl: 'http://jill-work.myshopify.com'}), /invalid storefront URL/);
assert.throws(() => storefrontOrigin({storefrontUrl: 'https://user:pass@jill-work.myshopify.com'}), /invalid storefront URL/);
assert.throws(() => storefrontOrigin({myshopifyDomain: 'jillonlinestore.com'}), /identity is unavailable/);
assert.throws(() => storefrontOrigin({}), /identity is unavailable/);

assert.equal(
  storefrontOrigin({url: 'https://jill-work.myshopify.com/collections/all', myshopifyDomain: 'jill-work.myshopify.com'}),
  'https://jill-work.myshopify.com',
);
assert.equal(
  storefrontOrigin({url: 'https://jillonlinestore.com/collections/all', myshopifyDomain: 'jqtdgr-1y.myshopify.com'}),
  'https://jillonlinestore.com',
);

// Exercise the real shared storefront lookup without calling Shopify.
// A general account page must not assume the order-only shopify.shop global.
const originalFetch = globalThis.fetch;
let capturedShopQuery = null;
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'shopify://customer-account/api/2026-07/graphql.json');
    capturedShopQuery = JSON.parse(options.body).query;
    assert.match(capturedShopQuery, /shop \{ url myshopifyDomain \}/);
    return {
      ok: true,
      json: async () => ({data: {shop: {
        url: 'https://jill-work.myshopify.com',
        myshopifyDomain: 'jill-work.myshopify.com',
      }}}),
    };
  };
  assert.equal(await loadCustomerAccountStorefront(), 'https://jill-work.myshopify.com');
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({errors: [{message:'Shop lookup unavailable'}]}),
  });
  await assert.rejects(loadCustomerAccountStorefront(), /Shop lookup unavailable/);
} finally {
  globalThis.fetch = originalFetch;
}
