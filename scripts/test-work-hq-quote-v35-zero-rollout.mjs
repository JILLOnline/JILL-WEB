// Offline-only JILL WORK zero-percent deployment policy regression.
// NO Wrangler/network, user login, private customer data or deployment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ACTIVE,CANDIDATE,FALLBACK,SOURCE,WORKER,ORIGIN,OVERRIDE,APPROVAL,
  splitTrafficArgs,parseScopedDeployments,inspectDeploymentState,
  makeVersionOverride,anonymousSmokeContract,
} from './work-quote-v35-zero-deployment-policy.mjs';
let cases=0;
const pass=x=>{x();cases++;};
const deny=x=>{assert.throws(x,/quote_v35_zero_/);cases++;};
const id='11111111-1111-4111-8111-111111111111';
const prev='22222222-2222-4222-8222-222222222222';
const next='33333333-3333-4333-8333-333333333333';
const good=(versions,created_on='2026-10-17T18:00:00.000Z')=>
  [{id,created_on,source:'api',strategy:'percentage',
    versions:versions.map(([version_id,percentage])=>({version_id,percentage}))}];
const baseline=good([[ACTIVE,100]]);
const zero=good([[ACTIVE,100],[CANDIDATE,0]]);
const accidental=good([[ACTIVE,97],[CANDIDATE,3]]);
const candidateOnly=good([[CANDIDATE,100]]);
pass(()=>{
  const cmd=splitTrafficArgs();
  assert.deepEqual(cmd.slice(0,4),['versions','deploy',
    ACTIVE+'@100%',CANDIDATE+'@0%']);
  assert.deepEqual(cmd.slice(-7),[
    '--name',WORKER,'--config','./wrangler.canary.jsonc',
    '--yes','--message','JILL HQ WORK v35 ZERO percent QA only; v34 remains 100 percent']);
  assert.equal(cmd.includes('jill-order-desk-canary-work'),true);
  assert.ok(Object.isFrozen(cmd));
});
pass(()=>{
  const cmd=splitTrafficArgs({mode:'restore'});
  assert.deepEqual(cmd.slice(0,3),['versions','deploy',ACTIVE+'@100%']);
  assert.equal(cmd.includes(CANDIDATE+'@0%'),false);
});
deny(()=>splitTrafficArgs({mode:'promote'}));
pass(()=>assert.equal(inspectDeploymentState(baseline).state,'baseline'));
pass(()=>{
  const v=inspectDeploymentState({deployments:zero},'zero');
  assert.equal(v.state,'zero');
  assert.equal(v.active_pct,100);
  assert.equal(v.candidate_pct,0);
  assert.equal(v.can_recover_to_v34,true);
});
pass(()=>assert.equal(inspectDeploymentState({result:{deployments:zero}},
  'zero').active_pct,100));
pass(()=>assert.equal(inspectDeploymentState(accidental,'known')
  .state,'unexpected_known'));
pass(()=>assert.equal(inspectDeploymentState(candidateOnly,'known')
  .can_recover_to_v34,true));
for(const wrong of [
  null,undefined,{},[],{deployments:[]},[{}],
  [{...baseline[0],id:'not-uuid'}],
  [{...baseline[0],created_on:'invalid'}],
  [{...baseline[0],versions:[]}],
  [{...baseline[0],versions:[{version_id:ACTIVE,percentage:101}]}],
  [{...baseline[0],versions:[{version_id:ACTIVE,percentage:NaN}]}],
  [{...baseline[0],versions:[{version_id:ACTIVE,percentage:'100'}]}],
  [{...baseline[0],versions:[{version_id:ACTIVE,percentage:90}]}],
  [{...baseline[0],versions:[{version_id:ACTIVE,percentage:100},
    {version_id:ACTIVE,percentage:0}]}],
  [...baseline,{...baseline[0],id:prev}],
]){
  deny(()=>parseScopedDeployments(wrong));
}
for(const wrong of [
  zero,accidental,candidateOnly,
  good([[FALLBACK,100]]),
  good([[ACTIVE,99],[CANDIDATE,1]]),
])deny(()=>inspectDeploymentState(wrong,'baseline'));
for(const wrong of [
  baseline,accidental,candidateOnly,
  good([[ACTIVE,100],[FALLBACK,0]]),
  good([[CANDIDATE,0],[ACTIVE,99]]),
])deny(()=>inspectDeploymentState(wrong,'zero'));
deny(()=>inspectDeploymentState(good([[FALLBACK,100]]),'known'));
deny(()=>inspectDeploymentState(good([[CANDIDATE,50],[FALLBACK,50]]),'known'));
deny(()=>inspectDeploymentState(baseline,'promote'));
pass(()=>assert.equal(makeVersionOverride(),WORKER+'="'+CANDIDATE+'"'));
pass(()=>assert.equal(makeVersionOverride(ACTIVE),WORKER+'="'+ACTIVE+'"'));
deny(()=>makeVersionOverride(FALLBACK));
const ordinary={status:503,redirect:null,
  json:{ok:false,error:'quote_drafts_not_enabled'}};
const denied={status:403,redirect:null,
  json:{ok:false,code:'access_denied'}};
const login={status:302,redirect:'/auth/login',json:null};
const goodState=inspectDeploymentState(zero,'zero');
pass(()=>{
  const r=anonymousSmokeContract({baseline:ordinary,candidate:denied,
    after:goodState});
  assert.equal(r.authenticated_browser_qa_complete,false);
  assert.equal(r.ordinary_traffic_to_v35,false);
});
pass(()=>anonymousSmokeContract({baseline:ordinary,candidate:login,
  after:goodState}));
for(const wrong of [
  {...ordinary,status:200},
  {...ordinary,status:421},
  {...ordinary,json:{...ordinary.json,error:'wrong_host'}},
  {...ordinary,json:{...ordinary.json,token:'unsafe'}},
])deny(()=>anonymousSmokeContract({
  baseline:wrong,candidate:denied,after:goodState,
}));
for(const wrong of [
  {status:503,redirect:null,json:{ok:false,
    error:'quote_drafts_not_enabled'}},
  {status:200,redirect:null,json:{}},
  {status:403,redirect:null,json:{ok:false,code:'wrong_host'}},
  {status:302,redirect:'https://unknown.example/login',json:null},
  {status:302,redirect:'/evil/redirect',json:null},
])deny(()=>anonymousSmokeContract({
  baseline:ordinary,candidate:wrong,after:goodState,
}));
deny(()=>anonymousSmokeContract({
  baseline:ordinary,candidate:denied,
  after:inspectDeploymentState(accidental,'known'),
}));
const source=readFileSync(new URL('./deploy-work-hq-quote-v35-zero-owner.mjs',
  import.meta.url),'utf8');
for(const marker of [
  "process.platform==='win32'",
  "splitTrafficArgs(),'--dry-run'",
  "deployAttempted=true",
  "splitTrafficArgs({mode:'restore'})",
  "inspectDeploymentState(deployments(),'known')",
  "inspectDeploymentState(deployments(),'zero')",
  "verifyInspectedQuoteVersions",
  "verifyQuoteTableReadback",
  "makeVersionOverride(version)",
  "credentials:'omit'",
  "redirect:'manual'",
  "method:'GET'",
  "anonymousSmokeContract",
  "quoteTables();",
  "No deployment request made by this run.",
  "No LIVE, KEEP, R2",
  "Never rerun --zero",
]){
  // Respect case in printed messages for strict contracts.
  assert.ok(source.toLowerCase().includes(marker.toLowerCase()),
    'Missing 0%-only safety gate: '+marker);
  cases++;
}
for(const unsafe of [
  /['"]POST['"]/,
  /['"]versions['"],['"]upload['"]/,
  /['"]deploy['"],['"]--name['"]/,
  /['"]d1['"],['"]execute['"][^;]*--file/,
  /['"]secret['"],['"]put['"]/,
  /['"]r2['"],['"]object['"]/,
  /@(?:1|5|10|25|50|100)%.*CANDIDATE/,
]){
  assert.doesNotMatch(source,unsafe);cases++;
}
assert.equal(OVERRIDE,'Cloudflare-Workers-Version-Overrides');
assert.equal(APPROVAL,'DEPLOY WORK V35 AT ZERO PERCENT');
assert.equal(ORIGIN,'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev');
assert.match(SOURCE,/^[a-f0-9]{40}$/);
assert.match(FALLBACK,/^[a-f0-9-]{36}$/);
cases+=5;
console.log('PASS WORK v35 ZERO% rollout OFFLINE: '+cases+
  ' exact version/allocation, 0% override and safe rollback tests; no Cloudflare or customer access.');
console.log('HOLD: Owner Windows must verify real CLI/dry-run and deployment. No ordinary v35 traffic or paid service authorized.');
