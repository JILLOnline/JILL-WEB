// Read-only personal wallet and public promotion projection for the My JILL hub.
// Shopify authenticated customer context determines wallet ownership.
// The Apps Script Rewards engine exclusively owns coupon creation and points.
import {queryCustomerAccount} from './customer-account-api.mjs';
import {rewardCouponStatus, rewardWallet} from './rewards.mjs';

export const STOREFRONT_API = 'shopify://storefront/api/2026-07/graphql.json';
export const PROMOTIONS_MAX_AGE_MS = 10 * 60 * 1000;

export const PERSONAL_WALLET_QUERY = `
query JillHubPersonalCoupons {
  customer {
    id
    coupons: metafield(namespace: "jill_rewards", key: "coupons") {
      value
    }
  }
}
`;

export const PUBLIC_PROMOTIONS_QUERY = `
query JillHubPublicPromotions {
  shop {
    promotionSnapshot: metafield(namespace: "jill_promotions", key: "active_public_codes") {
      value
    }
  }
}
`;

export function parsePersonalWallet(field, now = Date.now()) {
  if (typeof field?.value !== 'string' || !field.value.trim()) {
    throw new Error('Personal Rewards wallet is unavailable.');
  }
  let decoded;
  try { decoded = JSON.parse(field.value); }
  catch { throw new Error('Personal Rewards wallet contains invalid JSON.'); }
  const array = Array.isArray(decoded) ? decoded :
    (Array.isArray(decoded?.coupons) ? decoded.coupons : null);
  if (!array) throw new Error('Personal Rewards wallet has an unsupported format.');
  // Reuse the engine's canonical wallet/status helpers, but validate before
  // its tolerant filtering. Malformed items can never be silently discarded.
  if (array.some((item)=>!item || typeof item !== 'object' || Array.isArray(item) ||
      !['active','used','expired','revoked'].includes(String(item.status || 'active').toLowerCase()))) {
    throw new Error('Personal Rewards wallet contains an invalid coupon status.');
  }
  return rewardWallet(array).map((coupon) => {
    if (!coupon || typeof coupon !== 'object' ||
        typeof coupon.code !== 'string' || !coupon.code.trim() ||
        !Number.isSafeInteger(Number(coupon.points)) || Number(coupon.points) <= 0 ||
        typeof coupon.expires_at !== 'string' ||
        !Number.isFinite(Date.parse(coupon.expires_at))) {
      throw new Error('Personal Rewards wallet contains an invalid coupon.');
    }
    const status = rewardCouponStatus(coupon, now);
    return {
      code: coupon.code.trim().slice(0, 160),
      value: Number.isFinite(Number(coupon.value)) && Number(coupon.value) > 0
        ? Number(coupon.value) : null,
      minimum: Number.isFinite(Number(coupon.minimum)) && Number(coupon.minimum) >= 0
        ? Number(coupon.minimum) : null,
      points: Number(coupon.points),
      expiresAt: coupon.expires_at,
      status,
    };
  });
}

export async function loadPersonalCoupons(request = fetch, now = Date.now()) {
  const data = await queryCustomerAccount(PERSONAL_WALLET_QUERY, request);
  if (!data?.customer?.id) throw new Error('Authenticated customer not available for wallet.');
  return parsePersonalWallet(data.customer.coupons, now);
}

export function parsePublicPromotionSnapshot(value, now = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Public promotions have not synchronized.');
  }
  let snapshot;
  try { snapshot = JSON.parse(value); }
  catch { throw new Error('Public promotions contain invalid JSON.'); }
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.offers)) {
    throw new Error('Public promotions returned an unsupported snapshot.');
  }
  const syncedAt = Date.parse(snapshot.synced_at || '');
  const age = now - syncedAt;
  if (!Number.isFinite(syncedAt) || age > PROMOTIONS_MAX_AGE_MS || age < -120000) {
    throw new Error('Public promotions are waiting for a fresh Shopify sync.');
  }
  return snapshot.offers.map((offer) => {
    if (!offer || typeof offer.code !== 'string' || !offer.code.trim() ||
        typeof offer.summary !== 'string' || !offer.summary.trim()) {
      throw new Error('Public promotions contain an invalid offer.');
    }
    return {
      code: offer.code.trim().slice(0, 160),
      summary: offer.summary.trim().slice(0, 300),
      details: typeof offer.details === 'string' ? offer.details.trim().slice(0, 500) : '',
      endsAt: typeof offer.ends_at === 'string' ? offer.ends_at : null,
    };
  });
}

export async function loadPublicPromotions(request = fetch, now = Date.now()) {
  const response = await request(STOREFRONT_API, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:PUBLIC_PROMOTIONS_QUERY}),
  });
  if (!response?.ok) throw new Error('Shopify public promotions are unavailable.');
  const payload = await response.json();
  if (payload?.errors?.length || !payload?.data?.shop) {
    throw new Error('Shopify public promotions query failed.');
  }
  return parsePublicPromotionSnapshot(
    payload.data.shop.promotionSnapshot?.value, now,
  );
}
