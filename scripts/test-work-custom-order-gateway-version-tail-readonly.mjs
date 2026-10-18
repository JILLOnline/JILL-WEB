// OFFLINE version-filtered Tail proof contracts, NO Cloudflare or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORKER,ACTIVE,CANDIDATE,DEPLOYMENT,HOST,OVERRIDE,
  candidateTailArguments,pinnedHealthUrl,versionOverrideHeader,
  verifiedTailHealthEvent,inspectGatewayZeroAllocation,
  classifyTailSessionExit,
} from './work-custom-order-gateway-version-tail-policy.mjs';
import {safeHealthResponse}
  from './prove-work-custom-order-gateway-v35-execution-readonly.mjs';
let count=0;
const pass=f=>{f();count++};
const deny=f=>{assert.throws(f,/work_gateway_tail_/);count++};
const now=1792270800000;
const uuid='c9d2a346-5564-4781-a120-df7f09190e55';
const url=pinnedHealthUrl(uuid);
pass(()=>{
  assert.equal(WORKER,'jill-work-custom-orders-qa');
  assert.equal(ACTIVE,'408bdf7c-eb20-4b6e-97dd-3d3b293c6120');
  assert.equal(CANDIDATE,'225cdbb4-46f5-492e-801d-6726bea2703e');
  assert.equal(DEPLOYMENT,'f6809b0e-c8b7-47b6-9cc9-13d071d1ecbb');
  assert.equal(OVERRIDE,'Cloudflare-Workers-Version-Overrides');
  assert.equal(url,HOST+'/healthz?jill_work_tail_probe='+uuid);
});
pass(()=>{
  const args=candidateTailArguments();
  assert.deepEqual(args,['tail',WORKER,'--config','./wrangler.toml',
    '--version-id',CANDIDATE,'--method','GET','--format','json',
    '--sampling-rate','1']);
  assert.equal(Object.isFrozen(args),true);
  assert.equal(versionOverrideHeader(),WORKER+'="'+CANDIDATE+'"');
});
deny(()=>pinnedHealthUrl('bad'));
deny(()=>pinnedHealthUrl(''));
deny(()=>pinnedHealthUrl('jill:customer:12345'));
const event={outcome:'ok',eventTimestamp:now,
  event:{request:{method:'GET',url}}};
pass(()=>assert.equal(verifiedTailHealthEvent(event,{
  url,sinceMs:now-1000,untilMs:now+15000}),true));
for(const bad of [
  null,undefined,{},[],
  {...event,outcome:'exception'},
  {...event,eventTimestamp:now-100000},
  {...event,eventTimestamp:now+100000},
  {...event,event:{request:{url,method:'POST'}}},
  {...event,event:{request:{url:HOST+'/healthz',method:'GET'}}},
  {...event,event:{request:{url:HOST+'/healthz?jill_work_tail_probe=some-other-uuid',method:'GET'}}},
  {...event,event:{request:{url:'https://jillonlinestore.com/',method:'GET'}}},
]){
  pass(()=>assert.equal(verifiedTailHealthEvent(bad,{
    url,sinceMs:now-1000,untilMs:now+15000}),false));
}
const wrapped=versions=>[{
  id:DEPLOYMENT,created_on:'2026-10-17T22:00:00Z',
  versions,
}];
const good=wrapped([{version_id:ACTIVE,percentage:100},
  {version_id:CANDIDATE,percentage:0}]);
pass(()=>{
  const data=inspectGatewayZeroAllocation(good);
  assert.equal(data.deployment_id,DEPLOYMENT);
  assert.equal(data.active_pct,100);
  assert.equal(data.candidate_pct,0);
});
for(const v of [
  null,[],[{}],
  wrapped([{version_id:ACTIVE,percentage:100}]),
  wrapped([{version_id:ACTIVE,percentage:99},{version_id:CANDIDATE,percentage:1}]),
  wrapped([{version_id:CANDIDATE,percentage:100},{version_id:ACTIVE,percentage:0}]),
  wrapped([{version_id:ACTIVE,percentage:100},{version_id:'unknown',percentage:0}]),
  [{...good[0],id:'11111111-1111-4111-8111-111111111111'}],
  [{...good[0],created_on:'not-a-date'}],
  [...good,{...good[0],id:'bad-id',created_on:'2026-10-18T00:00:00Z'}],
]){
  deny(()=>inspectGatewayZeroAllocation(v));
}
pass(()=>assert.equal(safeHealthResponse(
  200,'application/json;charset=utf-8',
  '{"ok":true,"environment":"WORK_CUSTOM_ORDERS_QA"}'),true));
for(const [status,mime,body] of [
  [404,'application/json','{"ok":true,"environment":"WORK_CUSTOM_ORDERS_QA"}'],
  [200,'text/html','<html/>'],
  [200,'application/json','{"ok":false,"environment":"WORK_CUSTOM_ORDERS_QA"}'],
  [200,'application/json','{"ok":true,"environment":"LIVE"}'],
  [200,'application/json','{"ok":true,"environment":"WORK_CUSTOM_ORDERS_QA","email":"x"}'],
  [200,'application/json','{not JSON}'],
  [200,'application/json','x'.repeat(600)],
])deny(()=>safeHealthResponse(status,mime,body));

// Only fixed categorical codes may be reported; never raw private log lines.
for(const [privateDiagnostic,expectedCode] of [
  ['', 'unclassified'],
  ['Unauthorized access: API token invalid. bearer SECRET-EXAMPLE', 'authentication'],
  ['Not logged in. Please authenticate', 'authentication'],
  ['error code: 10000', 'authentication'],
  ['Forbidden: missing permission for workers tail', 'permission'],
  ['HTTP 403 from API', 'permission'],
  ['HTTP 429 too many requests', 'rate_limited'],
  ['Worker version not found', 'target_missing'],
  ['WebSocket connection failed, private host: example.invalid', 'transport'],
  ['fetch failed: private token example-token', 'transport'],
  ['unknown argument --version-id', 'unsupported_cli_option'],
  ['Private unknown diagnostic token=ABCDEF', 'unclassified'],
]){
  pass(()=>assert.equal(classifyTailSessionExit(privateDiagnostic),expectedCode));
  assert.doesNotMatch(classifyTailSessionExit(privateDiagnostic),/ABCDEF|SECRET|example-token|example\.invalid/);
  count++;
}

const source=readFileSync(new URL(
  './prove-work-custom-order-gateway-v35-execution-readonly.mjs',
  import.meta.url),'utf8');
for(const marker of [
  "process.platform!=='win32'",
  "git('branch','--show-current')",
  "status()!==ACTIVE",
  "inspectGatewayZeroAllocation(result)",
  "candidateTailArguments()",
  "versionOverrideHeader()",
  "credentials:'omit'",
  "method:'GET'",
  "redirect:'manual'",
  "safeHealthResponse(res.status",
  "responseVerified=true;",
  "if(responseVerified)finish(null,true)",
  "if(matched)finish(null,true)",
  "verifiedTailHealthEvent(event",
  "child.kill()",
  "child.on('close'",
  "classifyTailSessionExit(stderr)",
  "No deployment retry",
  "not independently proven",
]){
  if(marker==="not independently proven")continue;
  assert.ok(source.includes(marker),'Missing version-tail safety check '+marker);
  count++;
}
for(const unsafe of [
  /['"]versions['"],['"]deploy['"]/,
  /['"]versions['"],['"]upload['"]/,
  /['"]secret['"],['"]put['"]/,
  /['"]d1['"],['"]execute['"]/,
  /['"]r2['"]/,
  /['"]POST['"]/,
  /console\.log\(\s*raw/,
  /writeFileSync/,
  /['"]logpush['"]\s*[,)]/,
  /--logpush/,
  /['"]logpush['"]\s*:/,
]){
  assert.doesNotMatch(source,unsafe);count++;
}
console.log('PASS WORK gateway candidate Tail proof OFFLINE: '+
  count+' exact 100/0 deployment, server-filtered version events, random probe, sanitized logs and two-part PASS.');
console.log('HOLD: no Cloudflare tail started or HTTP request sent in CI.');
