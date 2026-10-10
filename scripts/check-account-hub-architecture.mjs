import assert from 'node:assert/strict';
import fs from 'node:fs';

// This is a SOURCE/CONFIG guard, not a substitute for Shopify runtime tests.
// During migration Coupons is still a separately published compatibility page.
const read = (path) => fs.readFileSync(path, 'utf8');
const specs = [
  {
    dir: 'jill-account-dashboard',
    name: 'My JILL',
    target: 'customer-account.page.render',
    module: './src/Dashboard.jsx',
    uid: '2f093e56-265e-4263-57fc-eb7b7a8a3f49ccd3b19a',
  },
  {
    dir: 'jill-account-coupons',
    name: 'Coupons',
    target: 'customer-account.page.render',
    module: './src/Coupons.jsx',
    uid: 'dfb3e6f0-162d-b114-19a1-d854706d0d45166f43aa',
  },
  {
    dir: 'jill-account-home',
    name: 'JILL Settings',
    target: 'customer-account.profile.block.render',
    module: './src/AccountHome.jsx',
    uid: '923e30e6-dbf9-f48a-57a6-0dbd1ab57763f55ebbde',
  },
];
const capture = (source, field) => source.match(new RegExp(
  '^\\s*' + field + '\\s*=\\s*"([^"\\r\\n]+)"', 'm',
))?.[1] ?? null;

const paths = fs.readdirSync('extensions', {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
assert.deepEqual(paths.sort(), specs.map((spec) => spec.dir).sort(),
  'Unexpected Shopify extension: update the ownership decision and guard before adding a new app target.');

const uids = new Set();
const handles = new Set();
for (const spec of specs) {
  const source = read('extensions/' + spec.dir + '/shopify.extension.toml');
  const module = 'extensions/' + spec.dir + '/' + spec.module.slice(2);
  assert.equal(capture(source,'api_version'), '2026-07');
  assert.equal(capture(source,'type'), 'ui_extension');
  assert.equal(capture(source,'name'), spec.name);
  assert.equal(capture(source,'handle'), spec.dir);
  assert.equal(capture(source,'uid'), spec.uid,
    'Do not replace a released extension UID during the hybrid migration.');
  assert.equal(capture(source,'target'), spec.target);
  assert.equal(capture(source,'module'), spec.module);
  assert.ok(fs.existsSync(module), 'Missing module for ' + spec.dir);
  assert.ok(!uids.has(spec.uid) && !handles.has(spec.dir), 'Duplicate extension identity');
  uids.add(spec.uid);
  handles.add(spec.dir);
}
const hub = read('extensions/jill-account-dashboard/src/Dashboard.jsx');
const coupon = read('extensions/jill-account-coupons/src/Coupons.jsx');
const profile = read('extensions/jill-account-home/src/AccountHome.jsx');
assert.match(hub, /export default/);
assert.match(coupon, /export default/);
assert.match(profile, /export default/);
for (const [name,source] of [['My JILL',hub],['Coupons',coupon],['Profile bridge',profile]]) {
  assert.doesNotMatch(source, /const STORE = 'https:\/\/jillonlinestore\.com'/,
    name + ' must not hardcode the production storefront origin into WORK.');
}
const script = JSON.parse(read('package.json')).scripts;
assert.equal(script['rewards:work:app:deploy'],
 'node scripts/prepare-rewards-work-config.mjs && node scripts/verify-rewards-work-target.mjs && shopify app deploy --config work');
assert.match(read('.gitignore'), /shopify\.app\.work\.toml/);
assert.match(read('docs/CUSTOMER_ACCOUNT_HYBRID.md'), /one coherent \*\*My JILL\*\*/);
assert.match(read('docs/DOMAIN_OWNERSHIP.md'), /My JILL full-page hub entrypoint and shell/);
console.log('My JILL hybrid migration preflight: exact WORK-safe extension UIDs, targets, source owners and release command verified.');
console.log('WARNING: This does not prove deployed WORK account pages render. Runtime smoke certification remains blocked.');
