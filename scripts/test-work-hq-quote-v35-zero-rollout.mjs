// Offline-only JILL WORK zero-percent deployment policy regression.
// NO Wrangler/network, user login, private customer data or deployment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ACTIVE,CANDIDATE,FALLBACK,SOURCE,WORKER,ORIGIN,OVERRIDE,APPROVAL,
  splitTrafficArgs,parseScopedDeployments,inspectDeploymentState,
  makeVersionOverride,verifiedLegacyV34Baseline,anonymousSmokeContract,
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
// Real Owner v34 diagnostic: /healthz 200 JSON and quote endpoint 410
// HTML. A legacy route absence is NOT proof of Owner authorization.
const health={status:200,mime:'application/json',redirect:null,
  json:{ok:true,environment:'JILL_ORDER_DESK_WORK',
    database_ready:true,admin_ready:false}};
const legacyGone={status:410,mime:'text/html',redirect:null,json:null};
const explicitOff={status:503,mime:'application/json',redirect:null,
  json:{ok:false,error:'quote_drafts_not_enabled'}};
const ordinary={health,quote:legacyGone};
const denied={status:403,redirect:null,
  json:{ok:false,code:'access_denied'}};
const login={status:302,redirect:'/auth/login',json:null};
const goodState=inspectDeploymentState(zero,'zero');
pass(()=>{
  const b=verifiedLegacyV34Baseline(ordinary);
  assert.equal(b.v34_quote_route_unavailable,true);
  assert.equal(b.legacy_v34_410_html,true);
  assert.equal(b.v34_quote_authentication_gate_proven,false);
});
pass(()=>{
  const p=verifiedLegacyV34Baseline({health,quote:explicitOff});
  assert.equal(p.v34_quote_authentication_gate_proven,true);
});
pass(()=>{
  const r=anonymousSmokeContract({baseline:ordinary,candidate:denied,
    after:goodState});
  assert.equal(r.authenticated_browser_qa_complete,false);
  assert.equal(r.ordinary_traffic_to_v35,false);
  assert.equal(r.legacy_v34_410_html,true);
  assert.equal(r.v35_anonymous_owner_denied,true);
});
pass(()=>anonymousSmokeContract({baseline:ordinary,candidate:login,
  after:goodState}));
pass(()=>anonymousSmokeContract({
  baseline:{health,quote:explicitOff},candidate:denied,
  after:goodState}));
for(const wrong of [
  {...legacyGone,status:200},
  {...legacyGone,status:404},
  {...legacyGone,status:421},
  {...legacyGone,mime:'text/plain'},
  {...legacyGone,mime:'application/json'},
  {...legacyGone,redirect:'/auth/login'},
  {...legacyGone,json:{ok:true}},
  {...explicitOff,json:{...explicitOff.json,error:'wrong_host'}},
  {...explicitOff,json:{...explicitOff.json,token:'unsafe'}},
]){
  deny(()=>verifiedLegacyV34Baseline({health,quote:wrong}));
}
for(const wrong of [
  {...health,status:503},
  {...health,mime:'text/html'},
  {...health,json:{...health.json,ok:false}},
  {...health,json:{...health.json,database_ready:false}},
  {...health,json:{...health.json,environment:'LIVE'}},
]){
  deny(()=>verifiedLegacyV34Baseline({health:wrong,quote:legacyGone}));
}
for(const wrong of [
  {status:410,redirect:null,json:null,mime:'text/html'},
  {status:503,redirect:null,json:{ok:false,
    error:'quote_drafts_not_enabled'}},
  {status:200,redirect:null,json:{}},
  {status:403,redirect:null,json:{ok:false,code:'wrong_host'}},
  {status:302,redirect:'https://unknown.example/login',json:null},
  {status:302,redirect:'/evil/redirect',json:null},
]){
  deny(()=>anonymousSmokeContract({
    baseline:ordinary,candidate:wrong,after:goodState,
  }));
}
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
  "verifiedLegacyV34Baseline",
  "phase='pre_deployment_legacy_v34_http'",
  "previous_rollout_approval_exhausted",
  "probe({pathname:'/healthz'})",
  "v34_override_does_not_match_ordinary_v34",
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
