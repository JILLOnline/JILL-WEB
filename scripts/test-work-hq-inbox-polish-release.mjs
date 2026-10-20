// OFFLINE WORK-only checks; never uploads, deploys, reads secrets or writes receipts.
import assert from 'node:assert/strict';
import {INBOX_POLISH_PROFILE as profile} from './release-work-hq-inbox-polish-owner.mjs';
import {
  INBOX_POLISH_FILES,INBOX_POLISH_BLOBS,checkWorkHqInboxPolish,inboxPolishManifest,
} from './work-hq-inbox-polish-package.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {ORDER_DETAILS_PROFILE} from './release-work-hq-order-details-owner.mjs';
import {visualBaseline,ownedVisualAllocation} from './release-work-hq-visual-theme-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';

const review=checkWorkHqInboxPolish();
assert.equal(review.reviewed_files,11);
assert.deepEqual(Object.keys(INBOX_POLISH_BLOBS).sort(),[...INBOX_POLISH_FILES].sort());
const manifest=inboxPolishManifest();
assert.equal(manifest.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual(Object.keys(manifest.files).sort(),[...INBOX_POLISH_FILES].sort());
for(const digest of Object.values(manifest.files))assert.match(digest,/^[0-9a-f]{64}$/);
for(const key of ['base','baseSource','deployment'])
  assert.equal(profile[key],ORDER_DETAILS_PROFILE[key]);
assert.equal(profile.receiptStem,'work-hq-inbox-polish-v1');
assert.notEqual(profile.receiptStem,ORDER_DETAILS_PROFILE.receiptStem);
assert.equal(profile.visualOnly,false);
assert.equal(profile.prepareBuild.constructor.name,'Function');
const original={deployment:profile.deployment,versions:[
  {id:profile.base,percentage:100},{id:HQ_QUOTE,percentage:0}
]};
visualBaseline(original,profile);
for(const wrong of [
  {...original,deployment:'00000000-0000-4000-8000-000000000000'},
  {...original,versions:[{id:profile.base,percentage:99},{id:HQ_QUOTE,percentage:1}]},
  {...original,versions:[{id:profile.base,percentage:100}]},
])assert.throws(()=>visualBaseline(wrong,profile));
const attempt={
  candidate:'11111111-2222-4333-8444-555555555555',
  nonce:'22222222-3333-4444-8555-666666666666',
};
const deployed={
  deployment:'33333333-4444-4555-8666-777777777777',
  message:profile.activate+attempt.nonce,
  versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}],
};
ownedVisualAllocation(deployed,attempt,profile);
assert.throws(()=>ownedVisualAllocation({...deployed,message:'unknown owner'},attempt,profile));
assert.throws(()=>ownedVisualAllocation({...deployed,versions:[
  {id:attempt.candidate,percentage:99},{id:HQ_QUOTE,percentage:1},
]},attempt,profile));
ownedVisualAllocation({...deployed,message:profile.restore+attempt.nonce,
  versions:original.versions},attempt,{...profile,restored:true});
console.log('PASS WORK HQ inbox polish: exactly 11 frozen presentation files, no unrelated code, prior base and 0% quote canary, one-use receipts, fail-closed allocation and owned restoration. No deployment.');
