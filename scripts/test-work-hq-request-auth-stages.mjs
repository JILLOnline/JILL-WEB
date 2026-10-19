import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authenticateWorkAdminOnce as once}
  from '../services/jill-order-desk/work-admin-auth-once.mjs';
import {loadWorkMerchantInbox}
  from '../services/jill-order-desk/merchant-inbox-read.mjs';

let calls=0,release;
const oneRequest={}; // Equivalent to context.cloudflare for ONE fetch.
const task=()=>{calls++;return new Promise(resolve=>{release=resolve;});};
const p1=once({scope:oneRequest,authenticate:task});
const p2=once({scope:oneRequest,authenticate:task});
// SDK work is shared; each caller may independently consume SDK responses.
await Promise.resolve();
assert.equal(calls,1);
release({session:{shop:'jill-work.myshopify.com'}});
assert.deepEqual(await p1,await p2);
assert.equal(calls,1);
const secondRequest={};
const value=await once({scope:secondRequest,
  authenticate:async()=>{calls++;return {session:{shop:'other'}};}});
assert.equal(calls,2,'Every new HTTP request must authenticate again');
assert.equal(value.session.shop,'other');
// Same scope can see the successful earlier result, without refreshing.
assert.equal((await once({scope:secondRequest,
  authenticate:async()=>{throw Error('unexpected second auth');}})).session.shop,
  'other');
const badScope={};
const rejected=once({scope:badScope,
  authenticate:async()=>{throw Error('Shopify auth rejection');}});
await assert.rejects(rejected,/Shopify auth rejection/);
await assert.rejects(once({scope:badScope,
  authenticate:async()=>{throw Error('unexpected retry');}}),/Shopify auth rejection/);
assert.throws(()=>once({scope:null,authenticate:task}),
  /invalid_work_admin_auth_scope/);
assert.throws(()=>once({scope:{}}),/invalid_work_admin_auth_scope/);

const base='services/jill-order-desk/app-home/app/routes/';
const app=readFileSync(base+'app.tsx','utf8');
const reader=readFileSync(base+'app.requests-source.server.ts','utf8');
const worker=readFileSync(
  'services/jill-order-desk/app-home/workers/app.ts','utf8');
for(const src of [app,reader]) {
  assert.match(src,/authenticateWorkAdminOnce/);
  assert.match(src,/scope:context\.cloudflare/);
}
assert.match(worker,/return handler\(request,\{cloudflare:\{env,ctx\}\}\)/);
assert.match(reader,/onPhaseStart/);
assert.match(reader,/x-jill-inbox-trace/);
assert.match(reader,/JILL_WORK_INBOX_PHASE/);
for(const phrase of ['shopify_auth','work_owner','google_feed']) {
  assert.match(reader,new RegExp(phrase));
}
assert.doesNotMatch(reader,
  /console\.(?:log|info|warn|error)\([^)]*(?:session|token|email|request\.url)/);
const phases=[];
const time=[];
let ms=0;
const denied=await loadWorkMerchantInbox({
  request:new Request('https://work.example/app/requests'),
  authenticate:{admin:async()=>{
    ms+=7;return {session:{shop:'wrong-store'}};
  }},
  db:null,
  clock:()=>ms,
  onPhaseStart:name=>phases.push(name),
  onTiming:(name,duration)=>time.push([name,duration]),
});
assert.equal(denied.status===401||denied.status===403||denied.status===503,true);
assert.deepEqual(phases,['shopify_auth','work_owner'],
  'Unauthorized request must never call Google');
assert.deepEqual(time,[['shopify_auth',7],['work_owner',0]]);
console.log('PASS WORK pending-data diagnostics: one Shopify auth promise per incoming HTTP fetch, second request reauthenticates, rejected auth never bypasses Owner, stage markers do not reveal identity.');

// A thrown SDK response is consumable once per parallel route, never shared.
for(const status of [200,401,403,302]){
 const scope={},body='<script>SYNTHETIC_SHOPIFY_BOOTSTRAP</script>';
 let count=0;
 const authenticate=async()=>{count++;throw new Response(body,{status,headers:{'content-type':'text/html','x-synthetic-auth':'preserved',...(status===302?{location:'/auth/session-token'}:{})}})};
 const rejected=await Promise.allSettled([once({scope,authenticate}),once({scope,authenticate}),once({scope,authenticate})]);
 assert.equal(count,1);assert.equal(new Set(rejected.map(x=>x.reason)).size,3);
 for(const item of rejected){assert.equal(item.status,'rejected');assert.equal(item.reason.status,status);assert.equal(item.reason.headers.get('x-synthetic-auth'),'preserved');assert.equal(await item.reason.text(),body);}
}
console.log('PASS per-loader SDK response bodies: parallel HTML bootstrap, 401/403 denial and redirect preserve status/headers/body with one SDK authentication attempt.');
