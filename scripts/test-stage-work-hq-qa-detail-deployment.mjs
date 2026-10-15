import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  parseDeployments,certifyDetailQaGate,SCRIPT_ID,SHEET_ID,
  PINNED,PREVIOUS_HQ,MARKER,APPROVAL,
} from './stage-work-hq-qa-detail-deployment.mjs';
const HEAD='a'.repeat(40);
const read=(file)=>readFileSync(file,'utf8');
const base=new Map([
  [PINNED,{version:7,description:'WORK_QA_CANONICAL'}],
  [PREVIOUS_HQ,{version:8,description:'WORK_HQ_MANAGEMENT'}],
]);
const source=read('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs');
const data={
  head:HEAD,remote:HEAD,branch:'jill/rewards-work',dirty:'',
  identity:{scriptId:SCRIPT_ID,sheetId:SHEET_ID},
  audit:{historicalCommit:HEAD,headMatchesCertifiedGit:true,
    publishedRevisionVerified:true,publishedVersion:7},
  deployments:base,canonicalSource:source,
};
const listing=[
  'Found 2 deployments:',
  '- '+PINNED+' @7 - WORK_QA_CANONICAL',
  '- '+PREVIOUS_HQ+' @8 - WORK_HQ_MANAGEMENT',
].join('\n');
assert.deepEqual(parseDeployments(listing),base);
const accepted=certifyDetailQaGate(data);
assert.equal(accepted.pinnedVersion,7);
assert.equal(accepted.otherVersion,8);
assert.equal(accepted.head,HEAD);
for(const [label,change] of [
  ['wrong branch',{branch:'main'}],
  ['different Git',{remote:'b'.repeat(40)}],
  ['dirty Git',{dirty:' M file'}],
  ['wrong Google',{identity:{...data.identity,scriptId:'another'}}],
  ['wrong QA Sheet',{identity:{...data.identity,sheetId:'another'}}],
  ['wrong editor HEAD',{audit:{...data.audit,historicalCommit:'b'.repeat(40)}}],
  ['uncertified QA',{audit:{...data.audit,headMatchesCertifiedGit:false}}],
  ['pinned v7 mutated',{deployments:new Map([
    [PINNED,{version:9,description:'BAD'}],[PREVIOUS_HQ,base.get(PREVIOUS_HQ)]])}],
  ['v8 missing',{deployments:new Map([[PINNED,base.get(PINNED)]])}],
  ['source missing',{canonicalSource:source.replace(
    'function jillWorkHqMerchantDetailVerified_(', 'function BROKEN(')}],
  ['existing detail version',{deployments:new Map([
    ...base,['AKfycbNewDetailDeployment123456789',
      {version:9,description:MARKER}]])}],
]){
  assert.throws(()=>certifyDetailQaGate({...data,...change}),
    undefined,'Must reject '+label);
}
assert.throws(()=>parseDeployments(listing+'\n'+
  '- '+PINNED+' @8 - DUPLICATE'),/duplicate_deployment/);
assert.throws(()=>parseDeployments('Found 0 deployments'),/missing_deployments/);
assert.equal(APPROVAL,'CREATE JILL HQ WORK DETAIL QA DEPLOYMENT');
const script=read('scripts/stage-work-hq-qa-detail-deployment.mjs');
assert.match(script,/const mode=process\.argv\[2\]\|\|'--inspect'/);
assert.match(script,/if\(mode==='--inspect'\)/);
assert.match(script,/answer!==APPROVAL/);
assert.match(script,/create-deployment/);
assert.match(script,/--description/);
assert.doesNotMatch(script,/[,'"]--deploymentId[,'"]/);
assert.doesNotMatch(script,/update-deployment|delete-deployment|push --force/);
assert.match(script,/auditWorkQaReadOnly/);
assert.match(script,/verifyLocalWorkQaIdentity/);
assert.match(script,/detail_qa_already_staged/);
assert.match(script,/qa_detail_creation_unconfirmed_inspect_before_retry/);
console.log('PASS WORK QA detail: read-only default, exact QA HEAD+v7/v8 revision gates, unique deployment marker, explicit operator approval, create-only/no overwrite or secrets.');
