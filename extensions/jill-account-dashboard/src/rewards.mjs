export const REWARD_ENGINE_VERSION = '13';
export const REWARD_SPEND_CENTS_PER_POINT = 1000;
export const REWARD_COUPON_DAYS = 30;

export const REWARD_TIERS = Object.freeze([
  Object.freeze({points: 10, value: 5, minimum: 25}),
  Object.freeze({points: 20, value: 12, minimum: 50}),
  Object.freeze({points: 35, value: 25, minimum: 100}),
  Object.freeze({points: 50, value: 40, minimum: 150}),
]);

export const REWARD_STATES = Object.freeze({
  REDEEM: 'REDEEM',
  USE_COUPON: 'USE_COUPON',
  NEXT_REWARD: 'NEXT_REWARD',
  LOCKED: 'LOCKED',
  CONFIRMING: 'CONFIRMING',
  CREATING: 'CREATING',
  ERROR: 'ERROR',
});

const SORTED_REWARD_TIERS = [...REWARD_TIERS].sort((a, b) => a.points - b.points);

export function toRewardInteger(value) {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rewardWallet(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (Array.isArray(parsed?.coupons)) return parsed.coupons.filter(Boolean);
  } catch (error) {
    console.warn('JILL rewards wallet parse error', error);
  }

  return [];
}

export function rewardCouponStatus(coupon, now = Date.now()) {
  const rawStatus = String(coupon?.status || 'active').toLowerCase();
  if (['used', 'expired', 'revoked'].includes(rawStatus)) return rawStatus;

  const expiresAt = Date.parse(coupon?.expires_at || '');
  if (Number.isFinite(expiresAt) && expiresAt <= now) return 'expired';
  return 'active';
}

export function rewardRequestIsPending(meta) {
  const points = toRewardInteger(meta?.redeem_request_points);
  const nonce = String(meta?.redeem_request_nonce || '').trim();
  return points > 0 && Boolean(nonce) && !nonce.startsWith('consumed:');
}

export function rewardAccounting(pointsEarned, wallet, now = Date.now()) {
  const earned = Math.max(0, toRewardInteger(pointsEarned));
  const normalized = rewardWallet(wallet);
  let reserved = 0;
  let consumed = 0;

  for (const coupon of normalized) {
    const points = Math.max(0, toRewardInteger(coupon?.points));
    const status = rewardCouponStatus(coupon, now);
    if (status === 'active') reserved += points;
    if (status === 'used' || status === 'expired') consumed += points;
  }

  const committed = reserved + consumed;
  return {
    earned,
    reserved,
    consumed,
    committed,
    balance: Math.max(0, earned - committed),
    deficit: Math.max(0, committed - earned),
  };
}

export function chooseSolvencyRevocations(pointsEarned, wallet, now = Date.now()) {
  const normalized = rewardWallet(wallet);
  const accounting = rewardAccounting(pointsEarned, normalized, now);
  if (!accounting.deficit) return [];

  let remainingDeficit = accounting.deficit;
  const candidates = normalized
    .filter((coupon) => rewardCouponStatus(coupon, now) === 'active')
    .sort((a, b) => Date.parse(b?.created_at || '') - Date.parse(a?.created_at || ''));

  const revoke = [];
  for (const coupon of candidates) {
    if (remainingDeficit <= 0) break;
    revoke.push(coupon);
    remainingDeficit -= Math.max(0, toRewardInteger(coupon?.points));
  }

  return revoke;
}

export function buildRewardJourney(points, wallet, options = {}) {
  const availablePoints = Math.max(0, toRewardInteger(points));
  const pendingPoints = Math.max(0, toRewardInteger(options.pendingPoints));
  const confirmingPoints = Math.max(0, toRewardInteger(options.confirmingPoints));
  const errorPoints = Math.max(0, toRewardInteger(options.errorPoints));

  const activeCoupons = rewardWallet(wallet)
    .filter((coupon) => rewardCouponStatus(coupon) === 'active')
    .sort((a, b) => Date.parse(b?.created_at || '') - Date.parse(a?.created_at || ''));

  function couponForTier(tierPoints) {
    return activeCoupons.find((coupon) => Number(coupon?.points) === tierPoints) || null;
  }

  const items = SORTED_REWARD_TIERS.map((tier) => {
    const coupon = couponForTier(tier.points);
    let state = coupon
      ? REWARD_STATES.USE_COUPON
      : availablePoints >= tier.points
        ? REWARD_STATES.REDEEM
        : REWARD_STATES.LOCKED;

    let transientState = null;
    if (pendingPoints === tier.points) transientState = REWARD_STATES.CREATING;
    else if (confirmingPoints === tier.points) transientState = REWARD_STATES.CONFIRMING;
    else if (errorPoints === tier.points) transientState = REWARD_STATES.ERROR;

    return {tier, coupon, state, transientState};
  });

  const next = items.find((item) => item.state === REWARD_STATES.LOCKED) || null;
  if (next) next.state = REWARD_STATES.NEXT_REWARD;

  const redeemable = items.filter((item) => item.state === REWARD_STATES.REDEEM);
  const usable = items.filter((item) => item.state === REWARD_STATES.USE_COUPON);
  const bestRedeemable = [...redeemable].sort((a, b) => b.tier.points - a.tier.points)[0] || null;

  const priority = {
    [REWARD_STATES.NEXT_REWARD]: 1,
    [REWARD_STATES.REDEEM]: 2,
    [REWARD_STATES.USE_COUPON]: 3,
    [REWARD_STATES.LOCKED]: 4,
  };

  const expanded = [...items].sort((a, b) => {
    const aCreating = a.transientState === REWARD_STATES.CREATING;
    const bCreating = b.transientState === REWARD_STATES.CREATING;
    if (aCreating !== bCreating) return aCreating ? -1 : 1;

    const stateDifference = priority[a.state] - priority[b.state];
    if (stateDifference) return stateDifference;
    if (a.state === REWARD_STATES.REDEEM) return b.tier.points - a.tier.points;
    return a.tier.points - b.tier.points;
  });

  const collapsed =
    items.find((item) => item.transientState === REWARD_STATES.CREATING) ||
    next ||
    bestRedeemable ||
    usable[0] ||
    items[items.length - 1];

  return {
    activeCoupons,
    items,
    expanded,
    collapsed,
    next,
    redeemable,
    usable,
    couponForTier,
  };
}
