// Synthetic, offline regression test. Does not access Google or secrets.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyWorkQaDetailSourcePin}
  from './audit-work-hq-qa-detail-pin.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL}
  from '../services/jill-order-desk/work-google-merchant-detail.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';

const id=JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL.match(
  /^https:\/\/script\.google\.com\/macros\/s\/(AKfycb[A-Za-z0-9_-]{20,})\/exec$/,
)?.[1];
assert.ok(id,'detail endpoint must be a pinned Google script deployment');
// Independent operator-confirmed Google list-deployments @9 fingerprint.
// This offline guard detects truncation and case/0/O/l/1 transcription errors.
// The remote audit remains the final authority before any WORK deployment.
assert.equal(id.length,72,'certified Google QA detail deployment ID length');
assert.equal(createHash('sha256').update(id,'utf8').digest('hex'),
  '1dcc930446bfde35d8a2094c445cac473995bfa6b0a60020b4666716247fb69c',
  'certified Google QA v9 immutable deployment ID fingerprint');
assert.notEqual(JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL,JILL_HQ_WORK_QA_GOOGLE_URL);
const verified=verifyWorkQaDetailSourcePin({deploymentId:id,version:9});
assert.equal(verified.verified,true);
assert.equal(verified.legacyListPreserved,true);
assert.throws(()=>verifyWorkQaDetailSourcePin({
  deploymentId:id,version:8,
}),/uncertified_qa_detail_deployment/);
assert.throws(()=>verifyWorkQaDetailSourcePin({
  deploymentId:id+'x',version:9,
}),/work_detail_v9_pin_mismatch/);
assert.throws(()=>verifyWorkQaDetailSourcePin({
  deploymentId:id,version:9,detailUrl:JILL_HQ_WORK_QA_GOOGLE_URL,
}),/work_detail_v9_pin_mismatch/);
assert.throws(()=>verifyWorkQaDetailSourcePin({
  deploymentId:id,version:9,listUrl:JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL,
}),/work_detail_v9_pin_mismatch/);
console.log('PASS WORK detail v9 source pin contract: distinct from v7 list, rejects version drift, wrong IDs and source swapping.');
