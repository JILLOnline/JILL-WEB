import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectMyJillWorkPreview} from './inspect-myjill-work-preview-readiness.mjs';

const baseline=inspectMyJillWorkPreview();
assert.equal(baseline.operation,'jill.myjill.work.preview.readiness.v1');
assert.equal(baseline.source_verified,true,
 'Do not report preview readiness unless OFF flags and canary source pass');
assert.equal(baseline.contact_replies_enabled,false);
assert.equal(baseline.real_shopify_browser_render_verified,false);
assert.equal(baseline.customer_A_B_guest_verified,false);
assert.equal(baseline.rewards_redemption_runtime_verified,false);
assert.equal(baseline.legacy_account_certification_cleared,false);
assert.equal(baseline.extension_published,false);
assert.equal(baseline.cloudflare_deployment_performed,false);
assert.equal(baseline.missing_source_count,0);
assert.equal(baseline.requested_shop,'jill-work.myshopify.com');

const scopes=[
 'customer_read_customers','customer_write_customers','customer_read_orders',
 'read_customers','write_customers','read_orders','write_orders',
 'read_discounts','write_discounts',
].join(',');
const work=['name = "JILL HQ — WORK"',
 'client_id = "f8e1ebdbae84490dc8ea5b133637e6c0"',
 'scopes = "'+scopes+'"'].join('\n');
const preview=inspectMyJillWorkPreview({linkedWorkConfig:work});
assert.equal(preview.source_verified,true);
assert.equal(preview.linked_work_app,'verified_work_app');
assert.equal(preview.local_preview_prerequisites_met,true);
assert.equal(preview.real_shopify_browser_render_verified,false,
 'Correct config does not prove browser authentication/rendering');
assert.equal(preview.legacy_account_certification_cleared,false);
const foreign=inspectMyJillWorkPreview({
 linkedWorkConfig:work.replace('f8e1ebdbae84490dc8ea5b133637e6c0',
 'ebf1a69d82f46619d2f2945faab78afa'),
});
assert.equal(foreign.linked_work_app,'unverified');
assert.equal(foreign.local_preview_prerequisites_met,false);
const live=inspectMyJillWorkPreview({
 linkedWorkConfig:work+'\napplication_url = "https://jillonlinestore.com"',
});
assert.equal(live.linked_work_app,'unverified');
assert.equal(live.local_preview_prerequisites_met,false);
const missingScope=inspectMyJillWorkPreview({
 linkedWorkConfig:work.replace('write_discounts',''),
});
assert.equal(missingScope.linked_work_app,'unverified');
const absent=inspectMyJillWorkPreview({linkedWorkConfig:''});
assert.equal(absent.local_preview_prerequisites_met,false);
assert.equal(absent.linked_work_app,'unverified');

for(const snapshot of [baseline,preview,foreign,live,missingScope,absent]){
 const serial=JSON.stringify(snapshot);
 assert.doesNotMatch(serial,/[a-f0-9]{32}/i,
 'Do not print client identifiers or secret values in QA reports');
 assert.equal(snapshot.extension_published,false);
 assert.equal(snapshot.cloudflare_deployment_performed,false);
}
const code=readFileSync('scripts/inspect-myjill-work-preview-readiness.mjs','utf8');
assert.doesNotMatch(code,/fetch\(|writeFile|rmSync|execFile|spawn\(|process\.env\.(?:SHOPIFY|CLOUDFLARE)/);
assert.match(code,/--require-local-work/);
assert.match(code,/legacy_account_certification_cleared:false/);
assert.match(code,/real_shopify_browser_render_verified:false/);
console.log('PASS My JILL WORK preview gate: exact WORK-only linked config verified offline; wrong/LIVE held; Contact OFF; legacy gate red; no secrets, browser or deploy claims.');
