// OFFLINE: a styling revision must never silently repurpose the previous
// v1 one-time release guard/receipt. No provider reads or writes.
import assert from 'node:assert/strict';
import {QUICK_PILL_BLOBS as priorBlobs} from './work-hq-quick-pill-package.mjs';
import {QUICK_PILL_POLISH_BLOBS as refinedBlobs,
  checkWorkHqQuickPillPolish} from './work-hq-quick-pill-polish-package.mjs';
import {QUICK_PILL_PROFILE as oldProfile} from './release-work-hq-quick-pill-owner.mjs';

assert.equal(oldProfile.receiptStem,'work-hq-quick-pill-v1');
assert.equal(oldProfile.checkCommand,'work:hq:quick-pill:check');
assert.equal(oldProfile.testCommand,'test:work-hq-quick-pill-release');
assert.equal(oldProfile.activationOperation,'HQ_QUICK_PILL_V1_ACTIVATE');
for(const file of Object.keys(priorBlobs)){
  assert.equal(typeof refinedBlobs[file],'string');
  if(file.endsWith('/styles/request-actions.css')||
     file.endsWith('/components/WorkRequestQuickActions.tsx')){
    assert.notEqual(priorBlobs[file],refinedBlobs[file],
      'Prior released UI SHA must remain historical: '+file);
  }else assert.equal(priorBlobs[file],refinedBlobs[file],
    'Only approved UI files may change: '+file);
}
assert.equal(checkWorkHqQuickPillPolish().reviewed_files,11);
console.log('PASS WORK HQ polished pill is source-only; old v1 receipts/source gates stay frozen and unusable for this change. No Cloudflare actions.');
