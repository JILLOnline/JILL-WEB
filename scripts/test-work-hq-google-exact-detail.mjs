import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import vm from 'node:vm';
import {signWorkMerchantDetail,readWorkGoogleQaMerchantDetail,
  JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL}
  from '../services/jill-order-desk/work-google-merchant-detail.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';

const SHOP='jill-work.myshopify.com';
assert.notEqual(JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL,JILL_HQ_WORK_QA_GOOGLE_URL,
  'v9 detail must never reuse v7 merchant list endpoint');
assert.match(JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL,
  /^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]{20,}\/exec$/);
const SECRET='QA_ONLY_WORK_MERCHANT_DETAIL_HMAC_SECRET_123456';
const ID='jill:92b32355-900e-47ba-8946-ccd93190a3b7';
const TS=String(Date.now()),NONCE='M'.repeat(32);
const sign=(id=ID)=>signWorkMerchantDetail({
  secret:SECRET,submissionId:id,timestamp:TS,nonce:NONCE,
});
const signature=sign();
assert.match(signature,/^[a-f0-9]{64}$/);
assert.notEqual(signature,createHmac('sha256',SECRET).update(
  ['merchant_list_v1',SHOP,TS,NONCE].join('\n')).digest('hex'),
  'List HMAC must never authorize detail reads');
for(const opts of [
  {submissionId:'bad'}, {submissionId:ID,shop:'jqtdgr-1y.myshopify.com'},
  {submissionId:ID,secret:'short'},
])assert.throws(()=>signWorkMerchantDetail({
  secret:SECRET,submissionId:ID,timestamp:TS,nonce:NONCE,...opts,
}),/invalid_work/);
const source=readFileSync(
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
assert.match(source,/jill_order_merchant_detail\) === '1'/);
const start=source.indexOf('/* WORK HQ EXACT REQUEST DETAIL V1');
const end=source.indexOf('/* END WORK HQ EXACT REQUEST DETAIL V1 */',start);
assert.ok(start>0&&end>start);
const isolated=source.slice(start,end);
const HEADERS=[
  'submission_id','status','submitted_at','name','email','phone',
  'preferred_contact','event_date','date_needed','fulfillment','city',
  'state','zip','theme','colors','collections','products',
  'reference_images','marketing_consent','marketing_consent_at',
  'marketing_consent_source','raw_payload',
];
const EH=[
  'event_id','submission_id','revision','customer_status','internal_status',
  'public_note','internal_note','evidence_ref','actor','occurred_at','source',
];
const at='2026-10-13T21:13:57.364Z';
const raw=JSON.stringify({
  version:1,operation:'custom_order.submit',submission_id:ID,
  submitted_at:at,
  customer:{name:'PRIVATE CUSTOMER',email:'hidden@example.invalid'},
  planning:{fulfillment:'pickup',date_needed:'2026-10-29'},
  items:[{
    item_id:'item-1',product_id:'shopify-product:123',quantity:1,
    attributes:[{id:'theme',value:'Unicorn'}],
    personalization_groups:[{
      id:'P1',allocations:[{unit_id:'unit-1'}],
      attributes:[{id:'name',value:'JILL QA'}],
    }],
    reference_ids:['private-file-id'],
  }],
  request_attributes:[],reference_ids:[],
});
const row=HEADERS.map(key=>({
  submission_id:ID,submitted_at:at,raw_payload:raw,
})[key]??'');
const event=EH.map(key=>({
  submission_id:ID,revision:1,customer_status:'received',
  internal_status:'new',occurred_at:at,
})[key]??'');
function sheet(headers,rows){
  return {
    getLastRow:()=>rows.length+1,
    getRange(from,col,count,width){
      assert.equal(col,1);
      assert.equal(width,headers.length);
      return {getValues:()=>from===1?[headers]:rows.slice(from-2,from-2+count)};
    },
    insertSheet(){throw Error('FORBIDDEN MUTATION');},
    appendRow(){throw Error('FORBIDDEN MUTATION');},
  };
}
const sheets=new Map([
  ['Submissions',sheet(HEADERS,[row])],
  ['CustomOrderEvents',sheet(EH,[event])],
]);
const ctx={
  JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
  JILL:{SHEET_ID:'WORK_ONLY_TEST',SHEET_NAME:'Submissions'},
  HEADERS,
  JILL_CUSTOM_WORKFLOW:{EVENTS_SHEET:'CustomOrderEvents',HEADERS:EH,
    STATUSES:['received','reviewing','awaiting_approval','in_production',
      'ready_pickup','on_hold','cancelled','completed'],
    INTERNAL:['new','needs_quote','waiting_customer','materials_ordered',
      'proof_revision','printing','assembly','quality_check','ready','none']},
  SpreadsheetApp:{openById(id){
    assert.equal(id,'WORK_ONLY_TEST');
    return {getSheetByName:n=>sheets.get(n)};
  }},
  jillWorkHqReadOnlySheet_(ss,name,expected){
    const found=ss.getSheetByName(name);
    if(!found)throw Error('missing');
    assert.deepEqual(found.getRange(1,1,1,expected.length).getValues()[0],expected);
    return found;
  },
  PropertiesService:{getScriptProperties:()=>({
    getProperty:key=>key==='JILL_HQ_MERCHANT_READ_SECRET'?SECRET:null,
  })},
  Utilities:{computeHmacSha256Signature:(message,key)=>
    [...createHmac('sha256',key).update(message).digest()]
      .map(v=>v>127?v-256:v)},
  constantTimeEqual_:(a,b)=>a===b,
  json_:v=>v,Date,console,
};
vm.createContext(ctx);
vm.runInContext(isolated,ctx);
const params={
  jill_order_merchant_detail:'1',shop:SHOP,submission_id:ID,
  jill_hq_read_ts:TS,jill_hq_read_nonce:NONCE,jill_hq_read_sig:signature,
};
const invoke=(overrides={})=>ctx.jillWorkHqMerchantDetail_({
  parameter:{...params,...overrides},
});
assert.equal(ctx.jillWorkHqMerchantDetailVerified_({parameter:params}),true);
const accepted=invoke();
assert.equal(accepted.ok,true);
assert.equal(accepted.submission_id,ID);
assert.equal(accepted.revision,1);
assert.equal(accepted.raw_payload,raw);
assert.equal(accepted.operation,'custom_order.merchant.detail.source.result');
for(const bad of [
  {shop:'jqtdgr-1y.myshopify.com'},
  {jill_hq_read_sig:'0'.repeat(64)},
  {jill_hq_read_ts:String(Date.now()-360000)},
  {jill_hq_read_nonce:'SHORT'},
  {submission_id:'jill:another-request'},
  {email:'untrusted@example.invalid'},
]){
  const denied=invoke(bad);
  assert.equal(denied.ok,false);
  assert.equal(denied.error.code,'unauthorized');
}
const dup=ctx.jillWorkHqMerchantDetail_({
  parameter:params,
  parameters:{submission_id:[ID,'jill:injected-request']},
});
assert.equal(dup.error.code,'unauthorized');
ctx.JILL_REWARDS_RUNTIME='LIVE';
assert.equal(invoke().error.code,'unauthorized');
ctx.JILL_REWARDS_RUNTIME='WORK';ctx.JILL_CUSTOM_ORDER_SANDBOX=false;
assert.equal(invoke().error.code,'unauthorized');
ctx.JILL_CUSTOM_ORDER_SANDBOX=true;
sheets.set('Submissions',sheet(HEADERS,[]));
assert.equal(invoke().error.code,'not_found');
sheets.set('Submissions',sheet(HEADERS,[row,row]));
assert.equal(invoke().error.code,'not_found');
sheets.set('Submissions',sheet(HEADERS,[row]));
sheets.set('CustomOrderEvents',sheet(EH,[]));
assert.equal(invoke().error.code,'private_read_unavailable');
sheets.set('CustomOrderEvents',sheet(EH,[event]));
sheets.set('Submissions',sheet(HEADERS,[HEADERS.map(key=>({
  submission_id:ID,submitted_at:at,raw_payload:'Z'.repeat(262145),
})[key]??'')]));
assert.equal(invoke().error.code,'private_read_unavailable');
sheets.set('Submissions',sheet(HEADERS,[row]));

let backendCalls=0;
const details=await readWorkGoogleQaMerchantDetail({
  secret:SECRET,submissionId:ID,now:()=>Number(TS),makeNonce:()=>NONCE,
  backendFetch:async(url,{method,body,redirect,signal})=>{
    backendCalls++;
    assert.equal(url,JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL);
    assert.equal(method,'POST');assert.equal(redirect,'follow');
    assert.ok(signal);
    assert.equal(body.get('jill_hq_read_sig'),signature);
    assert.equal(body.get('submission_id'),ID);
    assert.ok(!body.has('shopify_customer_id'));
    return Response.json(accepted);
  },
});
assert.equal(backendCalls,1);
assert.equal(details.items[0].personalization_groups[0].attributes[0].value,
  'JILL QA');
assert.deepEqual([...details.items[0].reference_ids],['private-file-id']);
assert.equal(details.attachment_state,'unresolved');
assert.equal(details.raw_payload,undefined);
const invalidSources=[
  {...accepted,submission_id:'jill:wrong'},
  {...accepted,shop:'jqtdgr-1y.myshopify.com'},
  {...accepted,revision:0},
  {...accepted,operation:'custom_order.merchant.list.result'},
  {...accepted,raw_payload:'Z'.repeat(262145)},
  {version:1,operation:accepted.operation,ok:false,error:{code:'not_found'}},
];
for(const ack of invalidSources)
  await assert.rejects(()=>readWorkGoogleQaMerchantDetail({
    secret:SECRET,submissionId:ID,
    backendFetch:async()=>Response.json(ack),
  }));
for(const forbiddenEndpoint of [JILL_HQ_WORK_QA_GOOGLE_URL,
  'https://jillonlinestore.com'])
  await assert.rejects(()=>readWorkGoogleQaMerchantDetail({
    secret:SECRET,submissionId:ID,
    endpoint:forbiddenEndpoint,
    backendFetch:async()=>Response.json(accepted),
  }),/invalid_work/);
assert.doesNotMatch(isolated,/setupJill\(|appendRow\(|setValues\(|MailApp|UrlFetchApp/);
console.log('PASS WORK full-detail source: separate HMAC domain, exact ID, no LIVE, no mutations, revision validation, bounded private raw, opaque file IDs and whitelisted output.');
