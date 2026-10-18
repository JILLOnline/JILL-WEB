// Offline fixture tests: never read real Shopify TOML or use cloud credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {proposeWorkHqPreviewRepair} from './repair-work-hq-preview-once.mjs';
import {WORK_HQ_HOME} from './verify-work-hq-dev-preview-config.mjs';
const scopes='customer_read_customers,customer_write_customers,customer_read_orders,'+
  'read_customers,write_customers,read_orders,write_orders,read_discounts,write_discounts';
const proxy='https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev/jill-custom-order-proxy';
const source=[
  'name = "JILL HQ — WORK"',
  'client_id = "f8e1ebdbae84490dc8ea5b133637e6c0"',
  'application_url = "https://shopify.dev/apps/default-app-home"',
  'embedded = false',
  'handle = "jill-hq-work"',
  '',
  '[access_scopes]',
  'scopes = "'+scopes+'"',
  '',
  '[auth]',
  'redirect_urls = ["https://old-work.example.com/auth/callback"]',
  '',
  '[app_proxy]',
  'url = "'+proxy+'"',
  'prefix = "apps"',
  'subpath = "jill-custom-order"',
  '',
  '[[webhooks.subscriptions]]',
  'uri = "/webhooks"',
  'topics = ["orders/updated"]',
  '',
  '[build]',
  'automatically_update_urls_on_dev = true',
  '',
].join('\n');
const current=proposeWorkHqPreviewRepair(source);
const expected=source
  .replace('"https://shopify.dev/apps/default-app-home"',
    '"'+WORK_HQ_HOME+'"')
  .replace('embedded = false','embedded = true')
  .replace('redirect_urls = ["https://old-work.example.com/auth/callback"]',
    'redirect_urls = ["'+WORK_HQ_HOME+'/auth/callback"]')
  .replace('automatically_update_urls_on_dev = true',
    'automatically_update_urls_on_dev = false');
assert.equal(current.candidate,expected,
  'The exact candidate must change ONLY the four approved fields.');
assert.equal(current.changed,true);
assert.equal(proposeWorkHqPreviewRepair(expected).changed,false);
const withoutBuild=source.replace(
  '\n[build]\nautomatically_update_urls_on_dev = true','');
assert.match(proposeWorkHqPreviewRepair(withoutBuild).candidate,
  /\[build\]\nautomatically_update_urls_on_dev = false/);
const multiline=source.replace(
  'redirect_urls = ["https://old-work.example.com/auth/callback"]',
  'redirect_urls = [\n  "https://old-work.example.com/auth/callback",\n  "https://another-work.example.com/auth/callback",\n]');
assert.equal(proposeWorkHqPreviewRepair(multiline).summary.auth_redirect_urls,
  '2_url(s)_to_pinned_work_hq_callback');
const windows=source.replaceAll('\n','\r\n');
assert.equal(proposeWorkHqPreviewRepair(windows).candidate,expected.replaceAll('\n','\r\n'));
for(const dangerous of [
  source.replace(proxy,'https://wrong.example.com'),
  source.replace('embedded = false','embedded = false\nembedded = true'),
  source.replace('name = "JILL HQ — WORK"','name = "Different app"'),
  source.replace('client_id = "f8e1ebdbae84490dc8ea5b133637e6c0"',
    'client_id = "ebf1a69d82f46619d2f2945faab78afa"'),
  source.replace('[auth]','[not_auth]'),
  source.replace('redirect_urls = ["https://old-work.example.com/auth/callback"]',
    'redirect_urls = ["https://jillonlinestore.com/auth/callback"]'),
  source.replace('[build]\nautomatically_update_urls_on_dev = true',
    '[build]\nautomatically_update_urls_on_dev = true\n'+
    'automatically_update_urls_on_dev = false'),
  source.replace('application_url = "https://shopify.dev/apps/default-app-home"',
    'application_url = "https://unknown.example.com"'),
])assert.throws(()=>proposeWorkHqPreviewRepair(dangerous));
const code=readFileSync(new URL('./repair-work-hq-preview-once.mjs',import.meta.url),'utf8');
assert.ok(code.includes("fs.openSync(filename,'wx',0o600)"));
assert.ok(code.includes("const backup=path.join(privateFolder"));
assert.ok(code.includes("saveNew(spent,"));
assert.doesNotMatch(code,/shopify app dev|wrangler deploy|secret put|fetch\(/,
  'The repair tool must be local and must never deploy or contact networks.');
console.log('PASS: WORK preview exact four-field repair, immutable backup, '+
  'extension identity and failure gates (offline).');
