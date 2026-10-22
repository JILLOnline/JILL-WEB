import assert from 'node:assert/strict';
import {RELEASE,verifyActivationReceipt,verifyRestorationReceipt,
 checkReleaseAllocation,releaseArguments,classifyRelease}
 from './release-work-hq-connected-content-owner.mjs';
import {BASELINE} from './stage-work-hq-connected-content-owner.mjs';
import {UPLOADED} from './inspect-work-hq-connected-content-uploaded-owner.mjs';
const nonce='22df975f-0475-45f5-ab3c-f1976eb1dbb9';
const base={deployment:BASELINE.deployment,
 created_at:'2026-10-22T00:41:05.90979Z',
 versions:[{id:BASELINE.active,percentage:100},
 {id:BASELINE.quote,percentage:0}]};
const proof={
 operation:'HQ_CONNECTED_CONTENT_WORK_INACTIVE_UPLOAD',
 source:UPLOADED.source,package_sha256:UPLOADED.package,
 retry_allowed:false,nonce:'3ea26674-1698-407d-9630-b511d120c590',
 baseline:base};
const attempt={
 operation:'HQ_CONNECTED_CONTENT_WORK_ACTIVATE_ONCE',
 source:RELEASE.source,candidate:RELEASE.candidate,
 package_sha256:RELEASE.package,original_deployment:BASELINE.deployment,
 nonce,retry_allowed:false};
const activated={deployment:'11111111-2222-4333-8444-555555555555',
 created_at:'2026-10-22T02:00:00.000Z',
 message:'JILL HQ WORK CONNECTED-CONTENT activate '+nonce,
 versions:[{id:RELEASE.candidate,percentage:100},
 {id:RELEASE.quote,percentage:0}]};
const restored={...activated,
 deployment:'bbbbbbbb-2222-4333-8444-555555555555',
 created_at:'2026-10-22T02:05:00.000Z',
 message:'JILL HQ WORK CONNECTED-CONTENT restore '+nonce,
 versions:base.versions};
const restoreReceipt={
 operation:'HQ_CONNECTED_CONTENT_WORK_RESTORE_ONCE',
 source:RELEASE.source,candidate:RELEASE.candidate,
 activation_nonce:nonce,activation_deployment:activated.deployment,
 retry_allowed:false};
assert.equal(verifyActivationReceipt(attempt),attempt);
assert.equal(verifyRestorationReceipt(restoreReceipt,attempt),restoreReceipt);
assert.equal(checkReleaseAllocation({...base,message:null},'baseline'),true);
assert.equal(checkReleaseAllocation(activated,'activated',attempt),true);
assert.equal(checkReleaseAllocation(restored,'restored',attempt),true);
assert.equal(classifyRelease({current:{...base,message:null},proof,
 activation:null,restoration:null}).status,'CONNECTED_CONTENT_INACTIVE_READY');
assert.equal(classifyRelease({current:activated,proof,activation:attempt,
 restoration:null}).status,'CONNECTED_CONTENT_WORK_ACTIVE');
assert.equal(classifyRelease({current:restored,proof,activation:attempt,
 restoration:restoreReceipt}).status,'CONNECTED_CONTENT_WORK_ORIGINAL_RESTORED');
assert.deepEqual(releaseArguments('activated',nonce),[
 'versions','deploy',RELEASE.candidate+'@100',RELEASE.quote+'@0',
 '--name','jill-order-desk-canary-work',
 '--config','./wrangler.canary.jsonc',
 '--message','JILL HQ WORK CONNECTED-CONTENT activate '+nonce,'--yes']);
assert.deepEqual(releaseArguments('restored',nonce),[
 'versions','deploy',RELEASE.previous+'@100',RELEASE.quote+'@0',
 '--name','jill-order-desk-canary-work',
 '--config','./wrangler.canary.jsonc',
 '--message','JILL HQ WORK CONNECTED-CONTENT restore '+nonce,'--yes']);
const deny=fn=>assert.throws(fn,/connected_content_release_|connected_content_recovery_|connected_content_stage_/);
deny(()=>verifyActivationReceipt({...attempt,retry_allowed:true}));
deny(()=>verifyActivationReceipt({...attempt,source:'wrong'}));
deny(()=>verifyRestorationReceipt({...restoreReceipt,
 activation_nonce:'wrong'},attempt));
deny(()=>checkReleaseAllocation({...activated,versions:[
 {id:RELEASE.candidate,percentage:99},
 {id:RELEASE.quote,percentage:1}]},'activated',attempt));
deny(()=>checkReleaseAllocation({...activated,message:'foreign version switch'},
 'activated',attempt));
deny(()=>checkReleaseAllocation({...activated,versions:base.versions},
 'activated',attempt));
deny(()=>checkReleaseAllocation({...base,message:null},
 'activated',attempt));
deny(()=>checkReleaseAllocation({...restored,message:'foreign rollback'},
 'restored',attempt));
deny(()=>classifyRelease({current:activated,proof,
 activation:null,restoration:null}));
deny(()=>classifyRelease({current:activated,proof,activation:attempt,
 restoration:restoreReceipt}));
deny(()=>classifyRelease({current:restored,proof,activation:null,
 restoration:restoreReceipt}));
deny(()=>classifyRelease({current:{...base,message:null},proof:{
 ...proof,package_sha256:'bad'},activation:null,restoration:null}));
deny(()=>releaseArguments('activated','bad nonce'));
deny(()=>releaseArguments('other',nonce));
console.log('PASS exact five-tab WORK one-use activation, nonce ownership, 100/0 only, staged receipt, restoration/new deployment and foreign-drift denials; no Cloudflare calls.');
