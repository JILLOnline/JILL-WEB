// OFFLINE-only WORK release contract. Cloudflare/receipts are never accessed.
import assert from 'node:assert/strict';
import {QUICK_PILL_PROFILE as profile} from './release-work-hq-quick-pill-owner.mjs';
import {INBOX_POLISH_PROFILE as prior} from './release-work-hq-inbox-polish-owner.mjs';
import {ORDER_DETAILS_PROFILE as older} from './release-work-hq-order-details-owner.mjs';
import {QUICK_PILL_FILES,QUICK_PILL_BLOBS,checkWorkHqQuickPill,quickPillManifest}
  from './work-hq-quick-pill-package.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {visualBaseline,ownedVisualAllocation} from './release-work-hq-visual-theme-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';

assert.equal(checkWorkHqQuickPill().reviewed_files,11);
assert.deepEqual(Object.keys(QUICK_PILL_BLOBS).sort(),[...QUICK_PILL_FILES].sort());
const manifest=quickPillManifest();
assert.equal(manifest.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual(Object.keys(manifest.files).sort(),[...QUICK_PILL_FILES].sort());
for(const digest of Object.values(manifest.files))assert.match(digest,/^[a-f0-9]{64}$/);
assert.equal(profile.base,'9dd60e19-9c77-4886-9c7e-56589ac0b401');
assert.equal(profile.deployment,'6cdff6bd-6743-4156-aaed-e874f2b3d914');
assert.equal(profile.baseSource,'4aee2c15603f4e6b6165eb5fe2168c1b24dd39df');
// This SHA is only a SOURCE EXPECTATION from the previous release. Exact
// Cloudflare marker must pass the release driver's runtime metadata gate.
assert.match(profile.baseSource,/^[a-f0-9]{40}$/);
for(const outdated of [prior,older]){
  for(const key of ['base','deployment','baseSource','receiptStem','activationOperation'])
    assert.notEqual(profile[key],outdated[key],'Reused spent release '+key);
}
assert.equal(profile.receiptStem,'work-hq-quick-pill-v1');
assert.equal(profile.uploadOperation,'HQ_QUICK_PILL_V1_INACTIVE_UPLOAD');
assert.equal(profile.activationOperation,'HQ_QUICK_PILL_V1_ACTIVATE');
assert.equal(profile.restoreOperation,'HQ_QUICK_PILL_V1_RESTORE');
assert.equal(profile.visualOnly,false);
assert.equal(profile.prepareBuild.constructor.name,'Function');
const original={deployment:profile.deployment,versions:[
  {id:profile.base,percentage:100},{id:HQ_QUOTE,percentage:0}
]};
visualBaseline(original,profile);
for(const invalid of [
  {deployment:prior.deployment,versions:[{id:prior.base,percentage:100},{id:HQ_QUOTE,percentage:0}]},
  {...original,versions:[{id:prior.base,percentage:100},{id:HQ_QUOTE,percentage:0}]},
  {...original,deployment:'00000000-0000-4000-8000-000000000000'},
  {...original,versions:[{id:profile.base,percentage:99},{id:HQ_QUOTE,percentage:1}]},
  {...original,versions:[{id:profile.base,percentage:100}]},
  {...original,versions:[{id:profile.base,percentage:100},{id:older.base,percentage:0}]},
])assert.throws(()=>visualBaseline(invalid,profile));
const attempt={
  candidate:'11111111-2222-4333-8444-555555555555',
  nonce:'22222222-3333-4444-8555-666666666666'
};
const deployed={
  deployment:'33333333-4444-4555-8666-777777777777',
  message:profile.activate+attempt.nonce,
  versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}],
};
ownedVisualAllocation(deployed,attempt,profile);
assert.throws(()=>ownedVisualAllocation({...deployed,message:'other release'},attempt,profile));
assert.throws(()=>ownedVisualAllocation({...deployed,versions:[
  {id:attempt.candidate,percentage:99},{id:HQ_QUOTE,percentage:1}
]},attempt,profile));
ownedVisualAllocation({...deployed,message:profile.restore+attempt.nonce,
  versions:original.versions},attempt,{...profile,restored:true});
console.log('PASS WORK HQ Quick pill release: 11 frozen UI files, new one-use receipts, exact active allocation, old deployments refused, no LIVE, no cloud calls.');
