// Signed WORK-preview command contract; never starts Shopify CLI.
// A --hub smoke screen cannot satisfy Customer A/B account acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCanaryModule} from './prepare-account-hub-canary.mjs';
import {inspectMyJillWorkPreview}
 from './inspect-myjill-work-preview-readiness.mjs';

const script=JSON.parse(readFileSync('package.json','utf8')).scripts;
const store='jill-work.myshopify.com';
const run='shopify app dev --path .work-account-canary --config work --store '+store;
assert.equal(script['rewards:work:hub:preview'],
 'node scripts/prepare-account-hub-canary.mjs --hub && '+run);
assert.equal(script['myjill:work:preview:preflight'],
 'node scripts/inspect-myjill-work-preview-readiness.mjs --require-local-work');
assert.equal(script['myjill:work:preview:signed'],
 script['myjill:work:preview:preflight']+' && '+
 'node scripts/prepare-account-hub-canary.mjs --read && '+run);
const shell=makeCanaryModule('jill-account-dashboard','hub');
const connected=makeCanaryModule('jill-account-dashboard','read');
const template=makeCanaryModule('jill-account-dashboard','template');
assert.match(shell,/import AccountHub from/);
assert.doesNotMatch(shell,/ConnectedHub/);
assert.match(connected,/import ConnectedHub from/);
assert.match(connected,/render\(<ConnectedHub \/>/);
assert.equal(connected,template);
assert.notEqual(shell,connected);
assert.throws(()=>makeCanaryModule('jill-account-dashboard','release'),
 /Unsupported WORK canary mode/);

const inspector=inspectMyJillWorkPreview({linkedWorkConfig:''});
assert.equal(inspector.source_verified,true);
assert.equal(inspector.connected_preview_source_verified,true);
assert.equal(inspector.local_preview_prerequisites_met,false);
assert.equal(inspector.connected_work_account_session_started,false);
assert.equal(inspector.owner_approved_launch_verified,false);
assert.equal(inspector.real_shopify_browser_render_verified,false);
assert.equal(inspector.customer_A_B_guest_verified,false);
assert.equal(inspector.extension_published,false);

const hub=readFileSync('extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
const identity=readFileSync('extensions/jill-account-dashboard/src/hub/ConnectedHub.jsx','utf8');
assert.match(hub,/'contact-requests': <ContactRequests enabled=\{false\}/);
assert.match(hub,/const guardedScreen=accountState\?\.status==='ready'\?screen:null/);
assert.match(identity,/loadAccountHubScopedSummary\(\)/);
assert.match(identity,/key=\{accountState\.scope\?\?'unverified'\}/);
for (const code of [shell,connected,template]) {
 assert.doesNotMatch(code,/shopify app deploy|wrangler deploy|migration|discountCodeBasicCreate/);
}
console.log('PASS My JILL signed WORK preview source: old --hub is a shell only; new --read has connected signed account and exact WORK+preflight guards. No Shopify CLI run or account QA claim.');
