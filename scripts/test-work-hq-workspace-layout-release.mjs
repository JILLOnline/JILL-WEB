// Offline-only guard for unique WORK HQ visual rollout. No Cloudflare I/O.
import assert from 'node:assert/strict';
import {WORKSPACE_LAYOUT_PROFILE as p} from './release-work-hq-workspace-layout-owner.mjs';
import {QUICK_PILL_PROFILE as quick} from './release-work-hq-quick-pill-owner.mjs';
import {INBOX_POLISH_PROFILE as inbox} from './release-work-hq-inbox-polish-owner.mjs';
import {ORDER_DETAILS_PROFILE as older} from './release-work-hq-order-details-owner.mjs';
import {WORKSPACE_LAYOUT_DRAFT_FILES,WORKSPACE_LAYOUT_DRAFT_BLOBS,
  checkWorkHqWorkspaceLayoutDraft,workspaceLayoutDraftManifest}
  from './work-hq-workspace-layout-draft.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {visualBaseline,ownedVisualAllocation}
  from './release-work-hq-visual-theme-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';

const review=checkWorkHqWorkspaceLayoutDraft();
assert.equal(review.reviewed_files,13);
assert.equal(review.no_provider_changes,true);
const manifest=workspaceLayoutDraftManifest();
assert.equal(manifest.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual([...WORKSPACE_LAYOUT_DRAFT_FILES].sort(),
  Object.keys(WORKSPACE_LAYOUT_DRAFT_BLOBS).sort());
assert.deepEqual(Object.keys(manifest.files).sort(),[...WORKSPACE_LAYOUT_DRAFT_FILES].sort());
for(const hash of Object.values(manifest.files))assert.match(hash,/^[a-f0-9]{64}$/);
assert.equal(p.base,'389a3378-833e-438c-ad55-d71e2238dded');
assert.equal(p.deployment,'3f52ee4b-414e-499a-8854-b89c7a7fb610');
assert.equal(p.baseSource,'b3992cb7f747cb1ae9816c7c6244653ea2dbe2b7');
assert.equal(p.receiptStem,'work-hq-workspace-layout-v1');
assert.equal(p.uploadOperation,'HQ_WORKSPACE_LAYOUT_V1_INACTIVE_UPLOAD');
assert.equal(p.activationOperation,'HQ_WORKSPACE_LAYOUT_V1_ACTIVATE');
assert.equal(p.restoreOperation,'HQ_WORKSPACE_LAYOUT_V1_RESTORE');
assert.equal(p.guard,checkWorkHqWorkspaceLayoutDraft);
assert.equal(p.changeScope,'frozen_thirteen_file_hq_request_workspace_and_accordion_presentation');
assert.equal(p.visualOnly,false);
assert.equal(p.checkCommand,'work:hq:workspace-layout:check');
assert.equal(p.testCommand,'test:work-hq-workspace-layout-release');
for(const prior of [quick,inbox,older]){
  for(const key of ['base','deployment','baseSource','receiptStem',
    'uploadOperation','activationOperation','restoreOperation']){
    assert.notEqual(p[key],prior[key],'Spent receipt or old allocation reused: '+key);
  }
}
const original={deployment:p.deployment,versions:[
  {id:p.base,percentage:100},{id:HQ_QUOTE,percentage:0},
]};
visualBaseline(original,p);
for(const invalid of [
  {...original,deployment:quick.deployment},
  {...original,versions:[{id:quick.base,percentage:100},{id:HQ_QUOTE,percentage:0}]},
  {...original,versions:[{id:p.base,percentage:99},{id:HQ_QUOTE,percentage:1}]},
  {...original,versions:[{id:p.base,percentage:100}]},
  {...original,versions:[{id:p.base,percentage:100},{id:older.base,percentage:0}]},
])assert.throws(()=>visualBaseline(invalid,p));
const attempt={candidate:'11111111-2222-4333-8444-555555555555',
  nonce:'22222222-3333-4444-8555-666666666666'};
const activated={deployment:'33333333-4444-4555-8666-777777777777',
  message:p.activate+attempt.nonce,
  versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}]};
ownedVisualAllocation(activated,attempt,p);
assert.throws(()=>ownedVisualAllocation({...activated,message:'unrelated release'},attempt,p));
assert.throws(()=>ownedVisualAllocation({...activated,versions:[
  {id:attempt.candidate,percentage:99},{id:HQ_QUOTE,percentage:1}
]},attempt,p));
ownedVisualAllocation({...activated,message:p.restore+attempt.nonce,
  versions:original.versions},attempt,{...p,restored:true});
console.log('PASS WORK HQ 13-file workspace layout release: new one-time receipts, exact Owner-verified base/version/source, 0% canary, old releases denied and owned restore; OFFLINE only.');
