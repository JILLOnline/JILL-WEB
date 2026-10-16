// Phase 27 -- genuine LOCAL workerd D1 + existing Shopify signed proxy
// + simulated signed Google QA double-confirmation, no remote network.
// Runs entirely with fake D1 UUID and R2 binding remote:false. It is not
// a deployed route or actual Google/Shopify availability test.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createTestHarness} from 'wrangler';
import {receiptSignature} from '../../../../backend/custom-order-gateway.mjs';
import {handlePhase27LocalSignedIntake as handle}
  from './phase27-local-signed-intake.mjs';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const SRC=resolve(ROOT,'services/jill-order-desk');
const CFG=resolve(APP,'workerd-phase19/wrangler.jsonc');
const cfg=JSON.parse(readFileSync(CFG,'utf8'));
const DBID='00000000-0000-4000-8000-000000000019';
const SHOP='jill-work.myshopify.com';
const WORKER='jill-work-phase19-local-media-only';
const BUCKET='jill-phase19-local-synthetic-artwork';
const ORIGIN='https://jill-work.myshopify.com';
const APPSECRET='phase27-SHOPIFY-TEST-secret-abcdefghijklmnopqrstuvwxyz';
const GOOGLESECRET='phase27-GOOGLE-TEST-secret-abcdefghijklmnopqrstuvwxyz';
const MACSECRET='phase27-INTAKE-TEST-secret-abcdefghijklmnopqrstuvwxyz';
const ENDPOINT='https://script.google.com/macros/s/AKfycbPhase27SyntheticQaExampleNoNetwork/exec';
const NOW=Date.parse('2026-10-16T17:05:00.000Z');
const environment={marker:'phase27-synthetic-local-only',database_id:DBID,
  bucket_name:BUCKET,remote:false,name:WORKER};
assert.equal(cfg.name,WORKER);
assert.equal(cfg.workers_dev,false);
assert.equal(cfg.d1_databases[0].remote,false);
assert.equal(cfg.d1_databases[0].database_id,DBID);
assert.equal(cfg.r2_buckets[0].remote,false);
assert.equal(cfg.r2_buckets[0].bucket_name,BUCKET);
assert.deepEqual(readdirSync(resolve(SRC,'migrations')).sort(),[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql']);
for(const path of ['wrangler.jsonc','wrangler.canary.jsonc']){
  const c=JSON.parse(readFileSync(resolve(APP,path),'utf8'));
  assert.equal(c.r2_buckets,undefined);
  assert.equal(c.vars.JILL_WORK_INTAKE_LEDGER_ENABLED,undefined);
}
const existingGateway=readFileSync(resolve(ROOT,
  'services/custom-order-cloudflare/handler.mjs'),'utf8');
assert.doesNotMatch(existingGateway,/phase27-local-signed-intake/);
const mainEntry=readFileSync(resolve(APP,'workers/app.ts'),'utf8');
assert.doesNotMatch(mainEntry,/phase27-local-signed-intake/);
const proposal=readFileSync(resolve(SRC,
  'intake-ledger-proposals/0007_work_intake_ledger.sql'),'utf8');
function splitSql(text){
  const result=[];let accumulated=[],trigger=false;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('--'))continue;
    if(!accumulated.length)trigger=/^CREATE TRIGGER\b/i.test(line);
    accumulated.push(line);
    if(trigger?/^END;$/i.test(line):/;\s*$/.test(line)){
      result.push(accumulated.join(' '));accumulated=[];trigger=false;
    }
  }
  assert.equal(accumulated.length,0);
  assert.equal(result.length,4);
  return result;
}
function orderId(i){return 'jill:11111111-2222-4333-8444-'+String(i).padStart(12,'0');}
function payload(id,email='synthetic@example.invalid'){
  const raw={version:1,operation:'custom_order.submit',submission_id:id,
    submitted_at:'2026-10-16T17:00:00.000Z',
    customer:{email},items:[{product_id:'shopify-product:101',quantity:1}]};
  return new URLSearchParams({
    source:'JILL custom order',submission_id:id,
    submitted_at:raw.submitted_at,
    raw_payload:JSON.stringify(raw),email,
  }).toString();
}
function signedRequest({id,body,owner='123456',origin=ORIGIN,
  forge=false}={}){
  const u=new URL('https://example.workers.dev/jill-custom-order-proxy');
  u.searchParams.set('shop',SHOP);
  u.searchParams.set('timestamp',String(Math.floor(NOW/1000)));
  u.searchParams.set('path_prefix','/apps/jill-custom-order');
  u.searchParams.set('logged_in_customer_id',owner);
  const canonical=[...u.searchParams].map(([k,v])=>k+'='+v).sort().join('');
  u.searchParams.set('signature',forge?'f'.repeat(64):
    createHmac('sha256',APPSECRET).update(canonical).digest('hex'));
  return new Request(u,{
    method:'POST',body:body??payload(id),headers:{
      origin,'content-type':'application/x-www-form-urlencoded',
    },
  });
}
const yes=(operation,id,other={})=>new Response(JSON.stringify({
  version:1,operation,ok:true,submission_id:id,status:'received',...other,
}),{status:200,headers:{'content-type':'application/json'}});
let calls=0,submitCalls=0,receiptCalls=0,mode='normal';
async function googleFetch(url,{body}={}){
  assert.equal(url,ENDPOINT);
  assert.ok(body instanceof URLSearchParams);
  calls++;
  const id=body.get('submission_id');
  const ts=body.get('jill_order_gateway_ts');
  const signed=body.get('jill_order_gateway_sig');
  if(body.has('jill_order_receipt')){
    receiptCalls++;
    assert.equal(signed,receiptSignature({
      action:'receipt',id,timestamp:ts,secret:GOOGLESECRET,
    }));
    if(mode==='lost_receipt')throw Error('synthetic_google_timeout');
    if(mode==='forged_receipt')return yes('custom_order.receipt.result',
      'jill:foreign-request',{revision:1});
    return yes('custom_order.receipt.result',id,{revision:1});
  }
  submitCalls++;
  const raw=body.get('raw_payload');
  const owner=body.get('jill_order_owner_gid')||'';
  assert.equal(signed,receiptSignature({
    action:'submit',id,timestamp:ts,rawPayload:raw,
    secret:GOOGLESECRET,ownerGid:owner,
  }));
  if(mode==='lost_submit')throw Error('synthetic_google_timeout');
  if(mode==='wrong_submission')return yes('custom_order.submit.result',
    'jill:foreign-request');
  return yes('custom_order.submit.result',id,{duplicate:false});
}
let limiterMode='ok',limiterCalls=0;
const fakeRateLimit=async ({shop})=>{
  limiterCalls++;
  assert.equal(shop,SHOP);
  if(limiterMode==='down')throw Error('synthetic_limiter_unavailable');
  return limiterMode==='ok';
};
const harness=createTestHarness({root:APP,workers:[{configPath:CFG}]});
let open=false;
try{
  await harness.listen();open=true;
  const worker=harness.getWorker(WORKER);
  const env=await worker.getEnv();
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  assert.ok(db?.prepare);
  for(const sql of splitSql(proposal))await db.prepare(sql).run();
  const opts={environment,db,shopifyAppSecret:APPSECRET,
    googleGatewaySecret:GOOGLESECRET,macKey:MACSECRET,
    googleQaEndpoint:ENDPOINT,backendFetch:googleFetch,
    rateLimit:fakeRateLimit,now:()=>NOW};
  const exec=async p=>handle(p,opts);
  const state=async id=>db.prepare(
    'SELECT state,dispatch_attempts,payload_mac,owner_binding_mac '+
    'FROM jill_work_intake_ledger WHERE shop=? AND submission_id=?')
    .bind(SHOP,id).first();
  const id1=orderId(1);
  // Authentication, Origin, malformed form must reject BEFORE storage.
  for(const req of [
    signedRequest({id:id1,forge:true}),
    signedRequest({id:id1,origin:'https://evil.invalid'}),
    signedRequest({id:id1,body:'probe=1'}),
  ]){
    const response=await exec(req);
    assert.ok(response.status>=400);
  }
  assert.equal(await state(id1),null);
  assert.equal(calls,0);
  // Rate limits MUST reject before D1 reservation, preserving the
  // submission ID for a genuine authorized retry.
  limiterMode='reject';
  const throttle=await exec(signedRequest({id:id1}));
  assert.equal(throttle.status,429);
  assert.equal(await state(id1),null);
  limiterMode='down';
  const offline=await exec(signedRequest({id:id1}));
  assert.equal(offline.status,503);
  assert.equal(await state(id1),null);
  assert.equal(calls,0);
  // Authorized synthetic Google double confirmation then D1 final CAS.
  limiterMode='ok';
  mode='normal';
  const beforeFirst=limiterCalls;
  const accepted=await exec(signedRequest({id:id1}));
  assert.equal(limiterCalls,beforeFirst+1,
    'Admission must not count twice in existing gateway');
  assert.equal(accepted.status,200);
  const receipt=await accepted.json();
  assert.equal(receipt.verified,true);
  assert.equal(receipt.submission_id,id1);
  assert.equal((await state(id1)).state,'confirmed');
  assert.equal((await state(id1)).dispatch_attempts,1);
  assert.equal(submitCalls,1);assert.equal(receiptCalls,1);
  // Duplicate ID may not be resent even after local success. No
  // second customer ACK without independent signed receipt query.
  const duplicate=await exec(signedRequest({id:id1}));
  assert.equal(duplicate.status,503);
  assert.equal((await duplicate.json()).error.code,
    'independent_receipt_reconciliation_required');
  assert.equal(submitCalls,1);assert.equal(receiptCalls,1);
  // Same ID but changed payload or trusted signed owner -> conflict.
  const changed=await exec(signedRequest({
    id:id1,body:payload(id1,'different@example.invalid')}));
  assert.equal(changed.status,409);
  const otherOwner=await exec(signedRequest({id:id1,owner:'98765'}));
  assert.equal(otherOwner.status,409);
  assert.equal(submitCalls,1);assert.equal(receiptCalls,1);
  // Google submit might succeed, then receipt verification times out.
  // At most ONE forwarding attempt is claimed; no auto retry.
  const id2=orderId(2);mode='lost_receipt';
  const uncertain=await exec(signedRequest({id:id2}));
  assert.equal(uncertain.status,503);
  assert.equal((await state(id2)).state,'ambiguous');
  assert.equal((await state(id2)).dispatch_attempts,1);
  const attemptsAtUncertain=submitCalls;
  mode='normal';
  const repeat=await exec(signedRequest({id:id2}));
  assert.equal(repeat.status,503);
  assert.equal(submitCalls,attemptsAtUncertain);
  // Initial Google send timeout: durable row ambiguous, never ACK.
  const id3=orderId(3);mode='lost_submit';
  const lost=await exec(signedRequest({id:id3}));
  assert.equal(lost.status,503);
  assert.equal((await state(id3)).state,'ambiguous');
  assert.equal((await state(id3)).dispatch_attempts,1);
  // Wrong receipt request must not reach customer or confirmed state.
  const id4=orderId(4);mode='forged_receipt';
  const wrong=await exec(signedRequest({id:id4}));
  assert.equal(wrong.status,503);
  assert.equal((await state(id4)).state,'ambiguous');
  // Existing gateway cannot be bypassed by forged response confirmation.
  const id5=orderId(5);mode='wrong_submission';
  const falseSubmit=await exec(signedRequest({id:id5}));
  assert.equal(falseSubmit.status,503);
  assert.equal((await state(id5)).state,'ambiguous');
  const counts=await db.prepare(
    'SELECT state,count(*) AS n FROM jill_work_intake_ledger GROUP BY state'
  ).all();
  const byState=Object.fromEntries(counts.results.map(x=>[x.state,x.n]));
  assert.equal(byState.confirmed,1);
  assert.equal(byState.ambiguous,4);
  const stored=JSON.stringify((await db.prepare(
    'SELECT * FROM jill_work_intake_ledger').all()).results);
  assert.equal(stored.includes('example.invalid'),false);
  assert.equal(stored.includes('gid://shopify'),false);
  assert.equal(stored.includes('shopify-product:101'),false);
  assert.equal((await worker.fetch('http://localhost/jill-custom-order-proxy'))
    .status,404);
  console.log('PASS WORK Phase 27 LOCAL signed intake: real Shopify proxy HMAC, synthetic local D1 idempotency, existing dual Google QA confirmation, duplicate/cross-owner replay denied, lost submit/receipt -> ambiguity, no second dispatch or false ACK. No remote actions.');
}catch(e){
  console.error('STOP WORK Phase 27 LOCAL signed intake: '+
    String(e?.message||'unverified').slice(0,370));
  process.exitCode=1;
}finally{if(open)await harness.close();}
