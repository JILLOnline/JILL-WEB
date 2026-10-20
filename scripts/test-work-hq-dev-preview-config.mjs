import assert from 'node:assert/strict';
import {
  WORK_HQ_HOME,verifyWorkHqDevPreviewConfig,
} from './verify-work-hq-dev-preview-config.mjs';

const scopes=[
  'customer_read_customers','customer_write_customers',
  'customer_read_orders','read_customers','write_customers',
  'read_orders','write_orders','read_discounts','write_discounts',
].join(',');
const base=[
  'name = "JILL HQ — WORK"',
  'client_id = "f8e1ebdbae84490dc8ea5b133637e6c0"',
  'application_url = "'+WORK_HQ_HOME+'"',
  'embedded = true',
  '',
  '[access_scopes]',
  'scopes = "'+scopes+'"',
  '',
  '[auth]',
  'redirect_urls = ["'+WORK_HQ_HOME+'/auth/callback"]',
  '',
  '[app_proxy]',
  'prefix = "apps"',
  'subpath = "jill-custom-order"',
  'url = "https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev/jill-custom-order-proxy"',
  '',
  '[build]',
  'automatically_update_urls_on_dev = false',
  '',
].join('\n');
assert.equal(verifyWorkHqDevPreviewConfig(base),true);
const bad=[
  base.replace('application_url = "'+WORK_HQ_HOME+'"',
    'application_url = "https://shopify.dev/apps/default-app-home"'),
  base.replace('embedded = true','embedded = false'),
  base.replace(WORK_HQ_HOME+'/auth/callback',WORK_HQ_HOME+'/auth/unknown'),
  base.replace('automatically_update_urls_on_dev = false',
    'automatically_update_urls_on_dev = true'),
  base.replace('automatically_update_urls_on_dev = false',''),
  base.replace('[auth]','[auth-other]'),
  base.replace('embedded = true','embedded = true\nembedded = false'),
  base.replace('client_id = "f8e1ebdbae84490dc8ea5b133637e6c0"',
    'client_id = "ebf1a69d82f46619d2f2945faab78afa"'),
  base.replace('[build]','[auth]'),
];
for(const test of bad) {
  assert.throws(()=>verifyWorkHqDevPreviewConfig(test));
}
// The guard must not write an ignored TOML, send a request, or deploy.
console.log('PASS: nine WORK HQ preview regression cases prevent '+
  'placeholder, unembedded, changed callback and URL tunnel override.');
