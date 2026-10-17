// Synthetic/offline only. No Cloudflare Wrangler deploy is executed.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ownerReceiptPath,reserveOneDeploymentAttempt,RECEIPT_FILE}
  from './work-quote-v35-once-receipt.mjs';
import {ACTIVE,CANDIDATE,SOURCE,WORKER}
  from './work-quote-v35-zero-deployment-policy.mjs';
let cases=0;
const pass=fn=>{fn();cases++;};
const deny=fn=>{assert.throws(fn,/work_quote_once_/);cases++;};
const baselineDeployment='11111111-1111-4111-8111-111111111111';
const values={worker:WORKER,active:ACTIVE,candidate:CANDIDATE,
  source:SOURCE,baselineDeployment};
const dir=mkdtempSync(join(tmpdir(),'jill-v35-second-zero-fixture-'));
try{
  const filepath=ownerReceiptPath(dir);
  pass(()=>assert.ok(filepath.endsWith(RECEIPT_FILE)));
  pass(()=>assert.equal(existsSync(filepath),false));
  pass(()=>{
    const r=reserveOneDeploymentAttempt({filepath,...values});
    assert.equal(r.reserved,true);
    assert.equal(r.canAutomaticallyRetry,false);
    assert.equal(Object.isFrozen(r),true);
  });
  pass(()=>{
    const receipt=JSON.parse(readFileSync(filepath,'utf8'));
    assert.equal(receipt.operation,
      'work_quote_v35_second_zero_percent_attempt');
    assert.equal(receipt.worker,WORKER);
    assert.equal(receipt.active,ACTIVE);
    assert.equal(receipt.candidate,CANDIDATE);
    assert.equal(receipt.baselineDeployment,baselineDeployment);
    assert.equal(receipt.canAutomaticallyRetry,false);
    assert.ok(Number.isFinite(Date.parse(receipt.reservedAt)));
    assert.equal(Object.keys(receipt).length,8);
    assert.doesNotMatch(JSON.stringify(receipt),
      /SHOPIFY_API_SECRET|JILL_WORK_SESSION_KEY|password|email/i);
  });
  deny(()=>reserveOneDeploymentAttempt({filepath,...values}));
  for(const bad of [
    {active:'bad'},
    {candidate:'bad'},
    {source:'bad'},
    {worker:'jill-order-desk-live'},
    {baselineDeployment:'not-a-uuid'},
    {filepath:'./relative-'+RECEIPT_FILE},
  ])deny(()=>reserveOneDeploymentAttempt({...values,filepath,...bad}));
  deny(()=>ownerReceiptPath(''));
  deny(()=>ownerReceiptPath('relative'));
}finally{rmSync(dir,{recursive:true,force:true});}
const old=readFileSync(new URL('./deploy-work-hq-quote-v35-zero-owner.mjs',
  import.meta.url),'utf8');
const next=readFileSync(new URL(
  './deploy-work-hq-quote-v35-zero-second-owner.mjs',import.meta.url),
  'utf8');
pass(()=>assert.match(old,/
    requireTrue\(false,'previous_rollout_approval_exhausted'\);/));
pass(()=>assert.doesNotMatch(next,
  /requireTrue\(false,'previous_rollout_approval_exhausted'\)/));
for(const marker of [
  "verifiedLegacyV34Baseline",
  "phase='pre_deployment_legacy_v34_http'",
  "probe({pathname:'/healthz'})",
  "v34_override_does_not_match_ordinary_v34",
  "anonymousSmokeContract",
  "verifyInspectedQuoteVersions",
  "verifyQuoteTableReadback",
  "inspectDeploymentState(deployments(),'zero')",
  "splitTrafficArgs(),'--dry-run'",
  "sourceCheck();",
  "ownerReceiptPath(process.env.LOCALAPPDATA)",
  "reserveOneDeploymentAttempt({",
  "phase='owner_approved_second_zero_deployment'",
  "deployAttempted=true;",
  "splitTrafficArgs({mode:'restore'})",
  "recoverIfSafe",
  "Never rerun this command",
  "credentials:'omit'",
  "redirect:'manual'",
  "method:'GET'",
]){
  assert.ok(next.toLowerCase().includes(marker.toLowerCase()),
    'Second WORK rollout security gate missing: '+marker);
  cases++;
}
pass(()=>{
  const posR=next.lastIndexOf('reserveOneDeploymentAttempt({');
  const posA=next.indexOf('deployAttempted=true;',posR);
  const posD=next.indexOf('cli([...splitTrafficArgs()],{timeout:120000})',
    posR);
  assert.ok(posR>0&&posR<posA&&posA<posD,
    'Only reserve once before actual cloud deployment');
});
for(const unsafe of [
  /['"]versions['"],['"]upload['"]/,
  /['"]secret['"],['"]put['"]/,
  /['"]d1['"],['"]execute['"][^;]*--file/,
  /['"]POST['"]/,
  /['"]r2['"],['"]object['"]/,
  /['"]deploy['"],['"]--name['"]/,
]){
  assert.doesNotMatch(next,unsafe);cases++;
}
console.log('PASS WORK v35 second authorized ZERO% attempt OFFLINE: '+
  cases+' once-only local receipt, v34 legacy 410, strict v35 Owner denial, verified fallback and no-upload guards.');
console.log('HOLD: no Cloudflare writes or customer records used by CI. Owner Windows must execute exactly once; no automatic retry.');
