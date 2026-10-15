import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileWorkQaDetailVersions}
  from './reconcile-work-hq-qa-detail-deployment.mjs';
import {parseDeployments,PINNED,PREVIOUS_HQ,MARKER}
  from './stage-work-hq-qa-detail-deployment.mjs';
const base=new Map([
  [PINNED,{version:7,description:'WORK_QA_CANONICAL'}],
  [PREVIOUS_HQ,{version:8,description:'WORK_HQ_MANAGEMENT'}],
]);
const id='AKfycb123456789012345678901234567890';
assert.deepEqual(reconcileWorkQaDetailVersions(base),{
  state:'not_found',deploymentId:null,version:null,
});
const existing=new Map([...base,[id,{version:9,description:MARKER}]]);
const found=reconcileWorkQaDetailVersions(existing);
assert.equal(found.state,'present_unprobed');
assert.equal(found.deploymentId,id);
assert.equal(found.version,9);
assert.deepEqual(reconcileWorkQaDetailVersions(parseDeployments([
  'Found 3 deployments:',
  '- '+PINNED+' @7 - WORK_QA_CANONICAL',
  '- '+PREVIOUS_HQ+' @8 - WORK_HQ_MANAGEMENT',
  '- '+id+' @9 - '+MARKER,
].join('\n'))),found);
for(const bad of [
  new Map([...base,[id,{version:8,description:MARKER}]]),
  new Map([...existing,['AKfycb123456789012345678901234567891',
    {version:10,description:MARKER}]]),
  new Map([[PINNED,{version:9,description:'BAD'}],[PREVIOUS_HQ,base.get(PREVIOUS_HQ)]]),
  new Map([[PINNED,base.get(PINNED)],[PREVIOUS_HQ,{version:9,description:'BAD'}]]),
  new Map([[PREVIOUS_HQ,base.get(PREVIOUS_HQ)]]),
  new Map([[PINNED,{version:7,description:MARKER}],[PREVIOUS_HQ,base.get(PREVIOUS_HQ)]]),
])assert.throws(()=>reconcileWorkQaDetailVersions(bad),
  undefined,'Invalid or ambiguous deployed state must fail closed');
const file=readFileSync('scripts/reconcile-work-hq-qa-detail-deployment.mjs','utf8');
assert.match(file,/read\(dir,'list-deployments'\)/);
assert.doesNotMatch(file,/['"]create-deployment['"]|['"]update-deployment['"]|['"]push['"]|['"]delete-deployment['"]/);
assert.match(file,/NO detail deployment with expected marker found/);
assert.match(file,/DO NOT rerun create-deployment/);
console.log('PASS QA read-only deployment reconciliation: exact v7/v8 intact, found/absent distinction, duplicate/version drift rejected, no mutating API.');
