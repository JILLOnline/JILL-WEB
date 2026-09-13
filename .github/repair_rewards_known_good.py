from pathlib import Path

# Restore the exact Customer Account reward request transport that was live and working
# before the Sep 13 enqueue regression. Keep all current UI and Rewards v13 logic.
dashboard = Path('extensions/jill-account-dashboard/src/Dashboard.jsx')
source = dashboard.read_text()
source = source.replace("const WRITE_API = 'shopify://customer-account/api/2026-07/graphql.json';\n", '', 1)
source = source.replace('const REWARD_REQUEST_TIMEOUT_MS = 10000;\n', '', 1)

start = source.index('async function requestReward(customerId, points) {')
end = source.index('\nfunction wait(milliseconds) {', start)
known_good = '''async function requestReward(customerId, points) {
  const nonce = createRewardNonce();
  const response = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      query: REQUEST_REWARD_MUTATION,
      variables: {
        metafields: [
          {
            ownerId: customerId,
            namespace: 'jill_rewards',
            key: 'redeem_request_points',
            type: 'number_integer',
            value: String(points),
          },
          {
            ownerId: customerId,
            namespace: 'jill_rewards',
            key: 'redeem_request_nonce',
            type: 'single_line_text_field',
            value: nonce,
          },
        ],
      },
    }),
  });

  const payload = await response.json();
  const userErrors = payload?.data?.metafieldsSet?.userErrors || [];
  if (!response.ok || payload?.errors?.length || userErrors.length) {
    throw new Error(
      userErrors?.[0]?.message ||
        payload?.errors?.[0]?.message ||
        'Unable to request your JILL reward right now.',
    );
  }
  const written = payload?.data?.metafieldsSet?.metafields;
  if (!Array.isArray(written) || ![
    ['redeem_request_points', String(points)],
    ['redeem_request_nonce', nonce],
  ].every(([key, value]) => written.some((field) =>
    field?.namespace === 'jill_rewards' && field.key === key && field.value === value,
  ))) {
    throw new Error('Shopify did not confirm your reward request. Refresh your rewards before trying again.');
  }
  return nonce;
}
'''
source = source[:start] + known_good + source[end + 1:]
dashboard.write_text(source)

test = Path('scripts/test-rewards-redemption.mjs')
t = test.read_text()
guard = 'assert.ok(!source.includes("shopify:customer-account/api/"));\n'
assert guard in t
if 'assert.ok(!source.includes("const WRITE_API"));' not in t:
    t = t.replace(guard, guard + 'assert.ok(!source.includes("const WRITE_API"));\nassert.ok(!source.includes("AbortController"));\n', 1)
old_ctx = """const api = vm.createContext({
  API: 'shopify://customer-account/api/2026-07/graphql.json',
  WRITE_API: 'shopify://customer-account/api/2026-07/graphql.json',
  QUERY: 'query {}',
  REWARD_REQUEST_TIMEOUT_MS: 10000,
  AbortController,
  setTimeout,
  clearTimeout,
});"""
new_ctx = """const api = vm.createContext({
  API: 'shopify://customer-account/api/2026-07/graphql.json',
  QUERY: 'query {}',
});"""
assert old_ctx in t
t = t.replace(old_ctx, new_ctx, 1)
t = t.replace("  assert.equal(url, 'shopify://customer-account/api/2026-07/graphql.json');\n  assert.ok(options.signal);", "  assert.equal(url, 'shopify://customer-account/api/2026-07/graphql.json');\n  assert.equal(options.signal, undefined);", 1)
t = t.replace('assert.equal(api.REWARD_REQUEST_TIMEOUT_MS, 10000);\n', '', 1)
test.write_text(t)
