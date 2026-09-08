import assert from 'node:assert/strict';
import {
  REWARD_STATES,
  buildRewardJourney,
  chooseSolvencyRevocations,
  rewardAccounting,
  rewardCouponStatus,
} from '../extensions/jill-account-dashboard/src/rewards.mjs';

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
