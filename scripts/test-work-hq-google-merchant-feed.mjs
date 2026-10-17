import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import vm from 'node:vm';
import {
  signWorkMerchantList,readWorkGoogleQaMerchantList,JILL_HQ_WORK_QA_GOOGLE_URL,
} from '../services/jill-order-desk/work-google-merchant-read.mjs';
import {projectWorkMerchantInbox} from '../services/jill-order-desk/merchant-inbox-read.mjs';
const secret='JILL_HQ_WORK_TEST_ONLY_READ_SECRET_01234567';
const shop='jill-work.myshopify.com';
const ts=String(Date.now());
const nonce='A'.repeat(32);
const signature=signWorkMerchantList({secret,timestamp:ts,nonce});
assert.match(signature,/^[a-f0-9]{64}$/);
assert.throws(()=>signWorkMerchantList({secret:'short',timestamp:ts,nonce}),/invalid_work/);
assert.throws(()=>signWorkMerchantList({secret,timestamp:ts,nonce,shop:'jqtdgr-1y.myshopify.com'}),/invalid_work/);
const source=readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
assert.match(source,/if \(clean_\(e && e\.parameter && e\.parameter\.jill_order_merchant_list\) === '1'\)/);
const start=source.indexOf('/* WORK HQ MERCHANT READ V1');
const end=source.indexOf('/* END WORK HQ MERCHANT READ V1 */',start);
assert.ok(start>0&&end>start);
const isolated=source.slice(start,end);
// Actual mock sheet rejects every mutation. Comments are not executable calls.
const HEADERS=[
  'submission_id','status','submitted_at','name','email','phone','preferred_contact',
  'event_date','date_needed','fulfillment','city','state','zip','theme','colors',
  'collections','products','reference_images','marketing_consent',
  'marketing_consent_at','marketing_consent_source','raw_payload',
];
const EVENT_HEADERS=[
  'event_id','submission_id','revision','customer_status','internal_status',
  'public_note','internal_note','evidence_ref','actor','occurred_at','source',
];
const requestId='jill:92b32355-900e-47ba-8946-ccd93190a3b7';
const at='2026-10-13T21:13:57.364Z';
const raw=JSON.stringify({
  version:1,operation:'custom_order.submit',submission_id:requestId,
  submitted_at:at,
  customer:{email:'secret.customer@example.invalid',phone:'555-555-5555'},
  items:[{title:'Secret private design',quantity:1}],
  planning:{date_needed:'2026-10-29',fulfillment:'pickup'},
});
const row=HEADERS.map(key=>({
  submission_id:requestId,submitted_at:at,
  raw_payload:raw,email:'secret.customer@example.invalid',
  phone:'555-555-5555',name:'SECRET CUSTOMER NAME',
})[key]??'');
const event=EVENT_HEADERS.map(key=>({
  event_id:'received:'+requestId,submission_id:requestId,revision:1,
  customer_status:'received',internal_status:'new',
  internal_note:'PRIVATE_INTERNAL_NOTE',
  actor:'PRIVATE_OPERATOR',occurred_at:at,source:'intake',
})[key]??'');
function makeSheet(headers,records) {
  return {
    getLastRow(){return records.length+1;},
    getRange(from,col,count,width) {
      assert.equal(col,1);
      assert.equal(width,headers.length);
      return {getValues(){return from===1?[headers]:records.slice(from-2,from-2+count);}};
    },
    appendRow(){throw Error('MUTATION FORBIDDEN');},
    setValues(){throw Error('MUTATION FORBIDDEN');},
    insertSheet(){throw Error('MUTATION FORBIDDEN');},
  };
}
const intake=makeSheet(HEADERS,[row]);
const events=makeSheet(EVENT_HEADERS,[event]);
const stores=new Map([['Submissions',intake],['CustomOrderEvents',events]]);
const hmac=(message,key)=>Array.from(createHmac('sha256',key).update(message).digest())
  .map(v=>v>127?v-256:v);
const ctx={
  JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
  JILL:{SHEET_ID:'TEST_ONLY_WORK_QA',SHEET_NAME:'Submissions'},
  HEADERS,JILL_CUSTOM_WORKFLOW:{
    EVENTS_SHEET:'CustomOrderEvents',HEADERS:EVENT_HEADERS,
    STATUSES:['received','reviewing','awaiting_approval','in_production','ready_pickup','on_hold','cancelled','completed'],
    INTERNAL:['new','needs_quote','waiting_customer','materials_ordered','proof_revision','printing','assembly','quality_check','ready','none'],
  },
  CacheService:{getScriptCache:()=>({get:()=>null,put:()=>{},remove:()=>{}})},
  SpreadsheetApp:{openById(id){
    assert.equal(id,'TEST_ONLY_WORK_QA');
    return {getSheetByName:name=>stores.get(name)||null};
  }},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>
    k==='JILL_HQ_MERCHANT_READ_SECRET'?secret:null})},
  Utilities:{computeHmacSha256Signature:hmac},
  constantTimeEqual_:(a,b)=>a===b,
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  json_:body=>body,
  Date,console,
};
vm.createContext(ctx);
vm.runInContext(isolated,ctx);
const params={
  jill_order_merchant_list:'1',shop,jill_hq_read_ts:ts,
  jill_hq_read_nonce:nonce,jill_hq_read_sig:signature,
};
const request={parameter:params};
assert.equal(ctx.jillWorkHqMerchantReadVerified_(request),true);
const emitted=ctx.jillWorkHqMerchantList_(request);
assert.equal(emitted.ok,true);
assert.equal(emitted.records.length,1);
const projected=projectWorkMerchantInbox(emitted);
assert.equal(projected.state,'ready');
assert.equal(projected.records[0].submission_id,requestId);
assert.equal(projected.records[0].revision,1);
assert.equal(projected.records[0].customer_status,'received');
const shown=JSON.stringify(projected);
for(const forbidden of [
  'secret.customer@example.invalid','555-555-5555','PRIVATE_INTERNAL_NOTE',
  'PRIVATE_OPERATOR','Secret private design','SECRET CUSTOMER NAME',
])assert.ok(!shown.includes(forbidden),'Leaked private source: '+forbidden);
for(const edit of [
  {shop:'jqtdgr-1y.myshopify.com'},
  {jill_hq_read_sig:'0'.repeat(64)},
  {jill_hq_read_ts:String(Date.now()-900000)},
  {jill_hq_read_nonce:'INVALID'},
]) {
  const denied=ctx.jillWorkHqMerchantList_({parameter:{...params,...edit}});
  assert.equal(denied.ok,false);
  assert.equal(denied.error.code,'unauthorized');
}
ctx.JILL_REWARDS_RUNTIME='LIVE';
assert.equal(ctx.jillWorkHqMerchantList_(request).ok,false);
ctx.JILL_REWARDS_RUNTIME='WORK';ctx.JILL_CUSTOM_ORDER_SANDBOX=false;
assert.equal(ctx.jillWorkHqMerchantList_(request).ok,false);
ctx.JILL_CUSTOM_ORDER_SANDBOX=true;
stores.set('Submissions',makeSheet(HEADERS,Array(51).fill(row)));
assert.equal(ctx.jillWorkHqMerchantList_(request).error.code,'private_read_unavailable');
stores.set('Submissions',intake);
stores.set('CustomOrderEvents',makeSheet(EVENT_HEADERS,[]));
assert.equal(ctx.jillWorkHqMerchantList_(request).error.code,'private_read_unavailable');
stores.set('CustomOrderEvents',events);
// The editor-visible diagnostic must NEVER expose raw rows, customer data,
// Shopify tokens or exceptions. Its only output is a count or safe error code.
const diagnosticStart=source.indexOf('/* WORK HQ QA DIAGNOSTIC V1');
const diagnosticEnd=source.indexOf('/* END WORK HQ QA DIAGNOSTIC V1 */',
  diagnosticStart);
assert.ok(diagnosticStart>0 && diagnosticEnd>diagnosticStart);
const diagnostics=[];
ctx.Logger={log:(line)=>diagnostics.push(String(line))};
vm.runInContext(source.slice(diagnosticStart,diagnosticEnd),ctx);
assert.equal(ctx.jillWorkHqQaReadDiagnostic(),true);
assert.ok(diagnostics.includes('WORK_HQ_QA_DIAGNOSTIC: read_key_configured=true'));
assert.ok(diagnostics.includes('WORK_HQ_QA_DIAGNOSTIC: PASS request_count=1'));
stores.set('CustomOrderEvents',makeSheet(EVENT_HEADERS,[]));
assert.throws(()=>ctx.jillWorkHqQaReadDiagnostic(),
  /WORK_HQ_QA_DIAGNOSTIC: missing_event_history/);
assert.ok(diagnostics.includes(
  'WORK_HQ_QA_DIAGNOSTIC: FAIL code=missing_event_history'));
stores.set('CustomOrderEvents',events);
ctx.JILL_REWARDS_RUNTIME='LIVE';
assert.throws(()=>ctx.jillWorkHqQaReadDiagnostic(),/wrong_runtime/);
ctx.JILL_REWARDS_RUNTIME='WORK';ctx.JILL_CUSTOM_ORDER_SANDBOX=false;
assert.throws(()=>ctx.jillWorkHqQaReadDiagnostic(),/wrong_runtime/);
ctx.JILL_CUSTOM_ORDER_SANDBOX=true;
const diagnosticLog=diagnostics.join('\n');
for(const forbidden of [
  'secret.customer@example.invalid','555-555-5555','PRIVATE_INTERNAL_NOTE',
  'PRIVATE_OPERATOR','Secret private design','SECRET CUSTOMER NAME',secret,
]) assert.ok(!diagnosticLog.includes(forbidden),'Diagnostic leaked sensitive data');
const calls=[];
const payload=await readWorkGoogleQaMerchantList({
  secret,now:()=>Number(ts),makeNonce:()=>nonce,
  backendFetch:async(url,opts)=>{
    calls.push({url,opts});
    assert.equal(url,JILL_HQ_WORK_QA_GOOGLE_URL);
    assert.equal(opts.method,'POST');
    assert.equal(opts.redirect,'follow');
    assert.equal(opts.headers.accept,'application/json');
    assert.equal(opts.body.get('jill_hq_read_sig'),signature);
    assert.ok(!opts.body.has('access_token'));
    return new Response(JSON.stringify(emitted),{
      status:200,headers:{'content-type':'application/json'},
    });
  },
});
assert.equal(calls.length,1);
assert.equal(projectWorkMerchantInbox(payload).records.length,1);
await assert.rejects(()=>readWorkGoogleQaMerchantList({
  secret,endpoint:'https://jillonlinestore.com',backendFetch:async()=>new Response('{}'),
}),/invalid_work_merchant_source/);
await assert.rejects(()=>readWorkGoogleQaMerchantList({
  secret,backendFetch:async()=>new Response('X'.repeat(65537)),
}),/oversized/);
const route=readFileSync('services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
const reader=readFileSync('services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts','utf8');
const parent=readFileSync('services/jill-order-desk/app-home/app/routes/app.requests.layout.tsx','utf8');
assert.match(reader,/JILL_HQ_MERCHANT_READ_SECRET/);
assert.match(reader,/JILL_WORK_HOST_STAGE==="canary"/);
assert.match(reader,/readWorkGoogleQaMerchantList/);
assert.match(parent,/loadVerifiedMerchantInbox/);
assert.doesNotMatch(route,/JILL_HQ_MERCHANT_READ_SECRET|readWorkGoogleQaMerchantList|loadWorkMerchantInbox/);
assert.doesNotMatch(reader,/jill_order_owner_gid|CUSTOMER_LIST|SHOPIFY_API_SECRET/);
console.log('PASS WORK HQ Google QA merchant feed: scoped HMAC parity, Owner gate, QA-only, read-only, no PII, bounds, and secret opt-in.');
