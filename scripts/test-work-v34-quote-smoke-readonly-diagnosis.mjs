// Offline-only diagnostic contract; no Cloudflare, remote GET or deploy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitizeAnonymousResponse,diagnoseReadOnly}
  from './diagnose-work-v34-quote-rollback-readonly.mjs';
import {ACTIVE,ORIGIN}
  from './work-quote-v35-zero-deployment-policy.mjs';
let count=0;
const pass=fn=>{fn();count++;};
const deny=fn=>{assert.throws(fn,/work_v34_diagnosis_/);count++;};
pass(()=>{
  const r=sanitizeAnonymousResponse({status:404,location:null,
    contentType:'text/html; charset=utf-8',body:'<html>Sign in</html>'});
  assert.deepEqual(r,{status:404,mime:'html',code:'unavailable',
    redirect:'none'});
  assert.equal(Object.isFrozen(r),true);
});
pass(()=>{
  const r=sanitizeAnonymousResponse({status:302,
    location:'https://jill-work.myshopify.com/admin?token=DO_NOT_PRINT',
    contentType:'',body:''});
  assert.equal(r.redirect,'shopify_work');
  assert.equal(JSON.stringify(r).includes('DO_NOT_PRINT'),false);
});
pass(()=>{
  const r=sanitizeAnonymousResponse({status:302,
    location:'/auth/login?state=SENSITIVE',
    contentType:'text/plain',body:''});
  assert.equal(r.redirect,'work_auth');
  assert.equal(JSON.stringify(r).includes('SENSITIVE'),false);
});
pass(()=>{
  const r=sanitizeAnonymousResponse({status:503,
    location:null,contentType:'application/json',
    body:'{"ok":false,"error":"quote_drafts_not_enabled"}'});
  assert.equal(r.code,'quote_drafts_not_enabled');
  assert.equal(r.json_ok,'false');
  assert.equal(r.json_keys,2);
});
pass(()=>{
  const r=sanitizeAnonymousResponse({status:500,
    location:null,contentType:'application/json',
    body:JSON.stringify({ok:false,error:'s3cr3t-customer-name'})});
  assert.equal(r.code,'unrecognized');
  assert.equal(JSON.stringify(r).includes('s3cr3t'),false);
});
for(const args of [
  {status:0,body:''},{status:600,body:''},{status:null,body:''},
  {status:200,body:'x'.repeat(8193)},
  {status:200,location:'javascript:alert(1)',body:''},
  {status:503,contentType:'application/json',body:'not-json'},
  {status:503,contentType:'application/json',body:'[]'},
])deny(()=>sanitizeAnonymousResponse(args));
let calls=[];
function mockResponse(status,body,headers={}){
  return new Response(body,{status,headers});
}
const request=async(url,opts)=>{
  assert.equal(opts.method,'GET');
  assert.equal(opts.credentials,'omit');
  assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.Accept,'application/json');
  assert.equal(opts.headers['Cache-Control'],'no-store');
  assert.equal(opts.headers.Authorization,undefined);
  assert.equal(opts.headers.Cookie,undefined);
  assert.ok(url.startsWith(ORIGIN));
  calls.push(new URL(url).pathname);
  if(url.endsWith('/healthz'))
    return mockResponse(200,'{"ok":true,"database_ready":true}',
      {'content-type':'application/json'});
  if(url.endsWith('/app/requests/quote-draft'))
    return mockResponse(404,'<html>No route</html>',
      {'content-type':'text/html'});
  throw Error('unrecognized URL');
};
const deploymentId='11111111-1111-4111-8111-111111111111';
const report=await diagnoseReadOnly({
  request,before:()=>ACTIVE,after:()=>ACTIVE,
  deployments:()=>({id:deploymentId,state:'baseline',active_pct:100}),
});
assert.deepEqual(calls,['/healthz','/app/requests/quote-draft']);
assert.equal(report.active,ACTIVE);
assert.equal(report.quote.status,404);
assert.equal(report.quote_denial_proven,false);
assert.equal(report.traffic_changed,false);
assert.equal(report.quote_customer_workflow_tested,false);
count+=6;
for(const fail of [
  {before:()=>null},
  {before:()=>ACTIVE,after:()=>null},
  {deployments:()=>({state:'zero',active_pct:100})},
  {deployments:()=>({state:'baseline',active_pct:99})},
]){
  await assert.rejects(
    ()=>diagnoseReadOnly({request,before:()=>ACTIVE,after:()=>ACTIVE,
      deployments:()=>({id:deploymentId,state:'baseline',active_pct:100}),
      ...fail}),
    /work_v34_diagnosis_/);
  count++;
}
const source=readFileSync(new URL('./diagnose-work-v34-quote-rollback-readonly.mjs',
  import.meta.url),'utf8');
for(const marker of [
  "'deployments','status'",
  "'deployments','list'",
  "'--json'",
  "method:'GET'",
  "redirect:'manual'",
  "credentials:'omit'",
  "before()===ACTIVE",
  "after()===ACTIVE",
  "quote_denial_proven:",
  "readPublic('/app/requests/quote-draft'",
  "No retry of deployment",
]){
  assert.ok(source.includes(marker),'Missing read-only safety '+marker);
  count++;
}
for(const unsafe of [
  /['"]versions['"],['"]deploy['"]/,
  /['"]versions['"],['"]upload['"]/,
  /['"]d1['"],['"]execute['"]/,
  /['"]secret['"],['"]put['"]/,
  /method:['"]POST['"]/,
  /headers:[^{]*Authorization/,
]){
  assert.doesNotMatch(source,unsafe);
  count++;
}
console.log('PASS WORK legacy v34 quote response diagnostic OFFLINE: '+
  count+' sanitized status/redirect/known-code, 100% allocation and no-POST/no-deploy guards.');
console.log('HOLD: genuine WORK v34 HTTP response not yet observed; no deployment reattempt or traffic permission inferred.');
