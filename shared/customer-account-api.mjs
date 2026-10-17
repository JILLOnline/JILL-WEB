// Canonical read-only Customer Account API adapter for the My JILL hub.
// The browser's Shopify Customer Account API determines the signed-in customer;
// never accept customer IDs or privileged Admin API credentials from page inputs.
export const CUSTOMER_ACCOUNT_API = 'shopify://customer-account/api/2026-07/graphql.json';

export const ACCOUNT_HUB_SUMMARY_QUERY = `
query JillAccountHubSummary {
  customer {
    id
    displayName
    pointsBalance: metafield(namespace: "jill_rewards", key: "points_balance") { value }
    pointsEarned: metafield(namespace: "jill_rewards", key: "points_earned_lifetime") { value }
    pointsRedeemed: metafield(namespace: "jill_rewards", key: "points_redeemed_lifetime") { value }
  }
}
`;

export function readNonnegativePoints(field) {
  if (!field || field.value === null || field.value === undefined) return null;
  const text = String(field.value);
  if (!/^(0|[1-9][0-9]*)$/.test(text)) {
    throw new Error('Invalid customer Rewards points value.');
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    throw new Error('Customer Rewards points exceed safe integer range.');
  }
  return value;
}

export function normalizeAccountHubSummary(data) {
  const customer = data?.customer;
  if (!customer?.id || typeof customer.id !== 'string') {
    throw new Error('Authenticated Shopify customer not available.');
  }
  // Missing metafields are **unknown**, never zero. Do not infer wallet or
  // eligibility from one field, and do not create customer-side balances.
  return {
    displayName: typeof customer.displayName === 'string'
      ? customer.displayName.trim().slice(0, 120)
      : '',
    pointsBalance: readNonnegativePoints(customer.pointsBalance),
    pointsEarned: readNonnegativePoints(customer.pointsEarned),
    pointsRedeemed: readNonnegativePoints(customer.pointsRedeemed),
  };
}

// Single authenticated Customer Account API query transport for all My JILL
// reads. All personal coupon queries use this owner rather than a second client.
export async function queryCustomerAccount(query, request = fetch) {
  const response = await request(CUSTOMER_ACCOUNT_API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query}),
  });
  if (!response?.ok) throw new Error('Customer Account API unavailable.');
  const payload = await response.json();
  if (payload?.errors?.length) {
    throw new Error('Customer Account API rejected the account query.');
  }
  if (!payload?.data) throw new Error('Customer Account API response missing data.');
  return payload.data;
}

export async function loadAccountHubSummary(request = fetch) {
  return normalizeAccountHubSummary(
    await queryCustomerAccount(ACCOUNT_HUB_SUMMARY_QUERY, request),
  );
}
