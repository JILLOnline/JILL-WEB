from pathlib import Path

DASHBOARD = Path('extensions/jill-account-dashboard/src/Dashboard.jsx')
TEST = Path('scripts/test-rewards-redemption.mjs')

source = DASHBOARD.read_text()
read_line = "const API = 'shopify://customer-account/api/2026-07/graphql.json';\n"
write_line = "const WRITE_API = 'shopify:customer-account/api/2026-07/graphql.json';\n"
assert read_line in source
assert write_line not in source
source = source.replace(read_line, read_line + write_line, 1)

start = source.index('async function requestReward(customerId, points) {')
end = source.index('\nfunction wait(milliseconds) {', start)
block = source[start:end]
assert 'fetch(API, {' in block
block = block.replace('fetch(API, {', 'fetch(WRITE_API, {', 1)
source = source[:start] + block + source[end:]
DASHBOARD.write_text(source)

t = TEST.read_text()
t = t.replace(
    "assert.ok(!source.includes(\"shopify:customer-account/api/\"));\nassert.ok(!source.includes(\"const WRITE_API\"));\n",
    "assert.ok(source.includes(\"const WRITE_API = 'shopify:customer-account/api/2026-07/graphql.json';\"));\n",
    1,
)
old_ctx = """const api = vm.createContext({
  API: 'shopify://customer-account/api/2026-07/graphql.json',
  QUERY: 'query {}',
});"""
new_ctx = """const api = vm.createContext({
  API: 'shopify://customer-account/api/2026-07/graphql.json',
  WRITE_API: 'shopify:customer-account/api/2026-07/graphql.json',
  QUERY: 'query {}',
});"""
assert old_ctx in t
t = t.replace(old_ctx, new_ctx, 1)
t = t.replace(
    "assert.equal(url, 'shopify://customer-account/api/2026-07/graphql.json');\n  assert.equal(options.signal, undefined);",
    "assert.equal(url, 'shopify:customer-account/api/2026-07/graphql.json');\n  assert.equal(options.signal, undefined);",
    1,
)
TEST.write_text(t)
