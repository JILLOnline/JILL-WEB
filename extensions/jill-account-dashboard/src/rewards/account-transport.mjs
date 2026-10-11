// Single authenticated Customer Account data + redemption request transport.
// This module writes only Shopify's customer-owned request metafields; the
// existing Apps Script v13 backend remains the only coupon/ledger owner.
const API = 'shopify://customer-account/api/2026-07/graphql.json';
// Shopify Customer Account GraphQL uses the same authenticated fetch
// endpoint for read queries and metafieldsSet mutations.
const WRITE_API = API;

const JILL_KEYS = [
  'last_custom_request_at',
  'preferred_contact',
  'event_date',
  'date_needed',
  'fulfillment_preference',
  'city',
  'state',
  'zip',
  'theme_interest',
  'color_preferences',
  'product_interests',
  'collection_interests',
  'reference_images',
  'annual_reminder_enabled',
  'next_event_reminder_date',
  'last_custom_request_id',
  'custom_request_status',
];

const REWARD_KEYS = [
  'points_balance',
  'eligible_spend_cents',
  'points_earned_lifetime',
  'points_redeemed_lifetime',
  'redeem_request_points',
  'redeem_request_nonce',
  'coupons',
];

const IDENTIFIERS = [
  ...JILL_KEYS.map((key) => `{namespace:\"jill\",key:\"${key}\"}`),
  ...REWARD_KEYS.map((key) => `{namespace:\"jill_rewards\",key:\"${key}\"}`),
].join(',');

const QUERY = `
  query JillDashboard {
    customer {
      id
      displayName
      firstName
      orders(first: 3, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          statusPageUrl
          totalPrice { amount currencyCode }
          lineItems(first: 4) {
            nodes { id title quantity }
          }
        }
      }
      metafields(identifiers: [${IDENTIFIERS}]) {
        namespace
        key
        value
        type
        compareDigest
      }
    }
  }
`;

const REQUEST_REWARD_MUTATION = `
  mutation RequestJillReward($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { namespace key value compareDigest }
      userErrors { field message code }
    }
  }
`;

export async function loadData() {
  const response = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query: QUERY}),
  });
  const payload = await response.json();
  if (!response.ok || payload?.errors?.length || !payload?.data?.customer) {
    throw new Error(payload?.errors?.[0]?.message || 'Unable to load JILL dashboard data');
  }
  return payload?.data?.customer || null;
}

function createRewardNonce() {
  return `jill:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
}

function rewardRequestMetafield(customer, key) {
  return (customer?.metafields || []).find(
    (field) => field?.namespace === 'jill_rewards' && field.key === key,
  ) || null;
}

function rewardRequestError(payload, fallback) {
  const userError = payload?.data?.metafieldsSet?.userErrors?.[0];
  const graphQLError = payload?.errors?.[0];
  const error = userError || graphQLError;
  const code = error?.code || error?.extensions?.code || '';
  const message = error?.message || fallback;
  return new Error(code ? `${message} (${code})` : message);
}

function rewardRequestHasDigestConflict(payload) {
  const errors = [
    ...(payload?.data?.metafieldsSet?.userErrors || []),
    ...(payload?.errors || []),
  ];
  return errors.some((error) =>
    /compare.?digest|digest.*match|stale/i.test(
      `${error?.code || error?.extensions?.code || ''} ${error?.message || ''}`,
    ),
  );
}

async function writeRewardRequest(customer, points, nonce) {
  const pointsField = rewardRequestMetafield(customer, 'redeem_request_points');
  const nonceField = rewardRequestMetafield(customer, 'redeem_request_nonce');

  if (!customer?.id || !pointsField?.compareDigest || !nonceField?.compareDigest) {
    throw new Error('Your reward request state could not be verified. Refresh the page and try again.');
  }

  // Re-read and check the authoritative request slot before every CAS write.
  // Two tabs can see stale balances; a digest retry must never overwrite an
  // already pending request owned by the existing v13 worker.
  const pendingRaw = String(pointsField.value ?? '');
  if (!/^(0|[1-9][0-9]*)$/.test(pendingRaw) ||
      !Number.isSafeInteger(Number(pendingRaw))) {
    throw new Error('Your reward request is unavailable. Refresh before redeeming.');
  }
  if (Number(pendingRaw) > 0) {
    throw new Error('A previous reward request is still processing. Refresh your rewards before trying again.');
  }

  const response = await fetch(WRITE_API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      query: REQUEST_REWARD_MUTATION,
      variables: {
        metafields: [
          {
            ownerId: customer.id,
            namespace: 'jill_rewards',
            key: 'redeem_request_points',
            value: String(points),
            compareDigest: pointsField.compareDigest,
          },
          {
            ownerId: customer.id,
            namespace: 'jill_rewards',
            key: 'redeem_request_nonce',
            value: nonce,
            compareDigest: nonceField.compareDigest,
          },
        ],
      },
    }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Shopify returned an invalid response while creating your reward.');
  }

  const userErrors = payload?.data?.metafieldsSet?.userErrors || [];
  if (!response.ok || payload?.errors?.length || userErrors.length) {
    return {ok: false, payload};
  }

  const written = payload?.data?.metafieldsSet?.metafields;
  const acknowledged = Array.isArray(written) && [
    ['redeem_request_points', String(points)],
    ['redeem_request_nonce', nonce],
  ].every(([key, value]) => written.some((field) =>
    field?.namespace === 'jill_rewards' && field.key === key && field.value === value,
  ));

  if (!acknowledged) {
    throw new Error('Shopify did not confirm your reward request. Refresh your rewards before trying again.');
  }

  return {ok: true};
}

export async function requestReward(customerId, points) {
  const nonce = createRewardNonce();
  let customer = await loadData();

  if (!customer?.id || customer.id !== customerId) {
    throw new Error('Your signed-in account changed. Refresh the page before redeeming.');
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await writeRewardRequest(customer, points, nonce);
    if (result.ok) return nonce;

    if (attempt === 0 && rewardRequestHasDigestConflict(result.payload)) {
      customer = await loadData();
      if (!customer?.id || customer.id !== customerId) {
        throw new Error('Your signed-in account changed. Refresh the page before redeeming.');
      }
      continue;
    }

    throw rewardRequestError(
      result.payload,
      'Unable to request your JILL reward right now.',
    );
  }

  throw new Error('Unable to request your JILL reward right now.');
}

export function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function metaMap(customer) {
  return Object.fromEntries(
    (customer?.metafields || []).filter(Boolean).map((item) => [item.key, item.value]),
  );
}

