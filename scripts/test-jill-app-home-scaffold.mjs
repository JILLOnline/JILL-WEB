import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root='services/jill-order-desk/app-home/';
const read=file=>readFileSync(root+file,'utf8');
const pkg=JSON.parse(read('package.json'));
const routes=read('app/routes.ts');
const wrangler=JSON.parse(read('wrangler.jsonc'));
assert.equal(pkg.private,true);
assert.equal(pkg.type,'module');
for(const dep of ['@shopify/shopify-app-react-router',
  '@shopify/shopify-api','react-router','@cloudflare/vite-plugin']) {
  assert.ok(pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]);
}
assert.equal(wrangler.name,'jill-order-desk-work');
assert.equal(wrangler.compatibility_flags.includes('nodejs_compat'),true);
assert.deepEqual(wrangler.d1_databases.map(v=>v.binding),
  ['JILL_ORDER_DESK_WORK_DB']);
assert.equal(wrangler.d1_databases[0].database_id,
  '3f17c186-c794-4e00-8f20-017191373a19');
assert.match(routes,/route\("auth\/login"/);
assert.match(routes,/route\("auth\/\*"/);
assert.match(routes,/route\("app"/);
const app=read('app/routes/app.tsx');
const page=read('app/routes/app.index.tsx');
const login=read('app/routes/auth.login.tsx');
const sdk=read('app/shopify.server.ts');
assert.match(app,/authenticate\.admin\(request\)/);
assert.match(page,/loadWorkShopifyAdminRoute/);
assert.match(login,/submittedShop!==WORK_SHOP/);
assert.match(sdk,/createConfiguredWorkShopifyHost/);
assert.match(sdk,/AppDistribution\.SingleMerchant/);
for(const path of [
  'app/routes/app.tsx','app/routes/app.index.tsx','app/routes/auth.login.tsx',
  'app/shopify.server.ts',
]) {
  assert.doesNotMatch(read(path),
    /jillonlinestore\.com|jqtdgr-1y\.myshopify\.com|discountCodeBasicCreate|draftOrderCreate/,
    'WORK App Home cannot mutate LIVE or financial resources: '+path);
}
assert.doesNotMatch(page,/useActionData|useSubmit|<Form/,
  'Owner bootstrap and staff mutations must not be implemented as UI actions');
assert.doesNotMatch(wrangler.assets?.directory || '',/theme|live/i);
console.log('WORK embedded App Home scaffold: official SDK routes, pinned D1, Node compatibility and deny-only merchant landing verified.');
