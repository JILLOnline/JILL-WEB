import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import vm from 'node:vm';

const source=readFileSync(
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const first=source.indexOf("const JILL_WORK_HQ_CACHE_KEY=");
const end=source.indexOf("/* END WORK HQ MERCHANT READ V1 */",first);
assert.ok(first>0&&end>first);
const block=source.slice(first,end);
const secret='QA_TEST_HQ_READ_SECRET_NEVER_USE_IN_PRODUCTION_ABC';
const timestamp=String(Date.now()),nonce='A'.repeat(32);
const shop='jill-work.myshopify.com';
const signed=['merchant_list_v1',shop,timestamp,nonce].join('\n');
const signature=createHmac('sha256',secret).update(signed).digest('hex');
const stored=new Map();
let puts=0,removes=0,reads=0,lockHeld=false;
const cache={
  get:key=>stored.get(key)||null,
  put:(key,value,seconds)=>{
    assert.equal(seconds,15);stored.set(key,value);puts++;
  },
  remove:key=>{stored.delete(key);removes++;},
};
const ctx={
  JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
  JILL_CUSTOM_WORKFLOW:{
    HEADERS:['event_id','submission_id','revision','customer_status',
      'internal_status','public_note','internal_note','evidence_ref',
      'actor','occurred_at','source'],
    STATUSES:['received','reviewing','awaiting_approval','in_production',
      'ready_pickup','on_hold','cancelled','completed'],
    INTERNAL:['new','needs_quote','waiting_customer','materials_ordered',
      'proof_revision','printing','assembly','quality_check','ready','none'],
  },
  CacheService:{getScriptCache:()=>cache},
  LockService:{getScriptLock:()=>({
    waitLock:()=>{assert.equal(lockHeld,false);lockHeld=true;},
    releaseLock:()=>{assert.equal(lockHeld,true);lockHeld=false;},
  })},
  PropertiesService:{getScriptProperties:()=>({
    getProperty:key=>key==='JILL_HQ_MERCHANT_READ_SECRET'?secret:null,
  })},
  Utilities:{computeHmacSha256Signature:(text,key)=>
    [...createHmac('sha256',key).update(text).digest()].map(x=>x>127?x-256:x)},
  constantTimeEqual_:(a,b)=>a===b,
  json_:value=>value,
  Date,JSON,Number,String,Math,Array,Object,Error,
};
vm.createContext(ctx);
vm.runInContext(block,ctx,{filename:'JILL_Google_QA_Merchant_Cache.gs'});
const id='jill:92b32355-900e-47ba-8946-ccd93190a3b7';
const item={
  submission_id:id,revision:1,customer_status:'received',
  internal_status:'new',submitted_at:'2026-10-13T21:13:57.364Z',
  updated_at:'2026-10-13T21:13:57.364Z',date_needed:'2026-10-30',
  fulfillment:'pickup',item_count:1,
};
const make=()=>({
  version:1,operation:'custom_order.merchant.list.result',ok:true,
  complete:true,shop,records:[item],
});
ctx.jillWorkHqCanonicalList_=()=>{reads++;return make();};
const params={
  jill_order_merchant_list:'1',shop,jill_hq_read_ts:timestamp,
  jill_hq_read_nonce:nonce,jill_hq_read_sig:signature,
};
const request={parameter:params};
assert.equal(ctx.jillWorkHqMerchantList_(request).ok,true);
assert.equal(reads,1);
assert.equal(puts,1);
assert.equal(ctx.jillWorkHqMerchantList_(request).records[0].revision,1);
assert.equal(reads,1,'repeat read must avoid canonical Google Sheet scan');
assert.equal(lockHeld,false);
assert.equal(ctx.jillWorkHqMerchantList_({
  parameter:{...params,jill_hq_read_sig:'0'.repeat(64)},
}).error.code,'unauthorized');
assert.equal(reads,1,'unauthorized reads must not touch cache or data');

const cacheKey=[...stored.keys()][0];
stored.set(cacheKey,JSON.stringify({...make(),records:[{
  ...item,email:'private@example.invalid',
}]}));
assert.equal(ctx.jillWorkHqMerchantList_(request).ok,true);
assert.equal(reads,2,'unexpected cached fields must be rejected');
assert.ok(removes>=1);
assert.ok(!JSON.stringify(ctx.jillWorkHqMerchantList_(request))
  .includes('private@example.invalid'));

const appendStart=source.indexOf('function jillCustomOrderAppendEvent_(');
const appendEnd=source.indexOf('function jillCustomOrderEnsureReceived_(',appendStart);
assert.ok(appendStart>0&&appendEnd>appendStart);
ctx.SpreadsheetApp={flush:()=>{}};
vm.runInContext(source.slice(appendStart,appendEnd),ctx);
const records=[];
ctx.jillCustomOrderAppendEvent_({
  appendRow:row=>records.push(row),
},{
  event_id:'test-event',submission_id:id,revision:2,
  customer_status:'reviewing',internal_status:'needs_quote',
});
assert.equal(records.length,1);
assert.equal(stored.has(cacheKey),false,
  'canonical event commit MUST invalidate shared Google QA cache');
assert.equal(ctx.jillWorkHqMerchantList_(request).ok,true);
assert.equal(reads,3,'subsequent read must return new canonical revision');
ctx.JILL_REWARDS_RUNTIME='LIVE';
assert.equal(ctx.jillWorkHqMerchantList_(request).error.code,'unauthorized');
ctx.JILL_REWARDS_RUNTIME='WORK';
ctx.JILL_CUSTOM_ORDER_SANDBOX=false;
assert.equal(ctx.jillWorkHqMerchantList_(request).error.code,'unauthorized');
assert.equal(lockHeld,false);
console.log('PASS WORK HQ shared Google QA cache: signed Owner request, short TTL, corrupt-entry rejection, canonical event invalidation, no PII and LIVE denial.');
