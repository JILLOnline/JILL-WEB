import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac,createHash} from 'node:crypto';
import vm from 'node:vm';
const code=readFileSync('backend/google-apps-script/JILL_WORK_HQ_OWNER_BINDING_QA_SOURCE.gs','utf8');
assert.doesNotMatch(code,/function doPost|\.appendRow\(|\.setValues\(|draftOrderCreate|MailApp|GmailApp/);
const SHOP='jill-work.myshopify.com', ID='jill:11111111-2222-4333-8444-555555555555';
const GID='gid://shopify/Customer/111', NONCE='0123456789abcdefghijklmnopqrstuv';
const SECRET='merchant-work-owner-binding-test-hmac-secret-never-production';
const raw=JSON.stringify({version:1,operation:'custom_order.submit',submission_id:ID,items:[{quantity:1}]});
const hash=createHash('sha256').update(raw).digest('hex');
const hmac=parts=>createHmac('sha256',SECRET).update(parts.join('\n')).digest('hex');
const now=1792497600000, revision=3;
const params={jill_order_merchant_owner_binding:'1',shop:SHOP,submission_id:ID,
  source_revision:'3',jill_hq_read_ts:String(now),jill_hq_read_nonce:NONCE};
params.jill_hq_read_sig=hmac(['merchant_owner_binding_request_v1',SHOP,ID,'3',String(now),NONCE]);
const eventHeader=['event_id','submission_id','revision','customer_status','internal_status'];
const intakeHeader=['submission_id','raw_payload'];
let reads=0, ledgerGid=GID, storedHash=hash, revisionValue=revision;
const rows={
  CustomOrderOwners:()=>[[ID,ledgerGid,storedHash,'date']],
  Intake:()=>[[ID,raw]],
  Events:()=>Array.from({length:revisionValue},(_,i)=>['e'+i,ID,i+1,'received','new'])
};
const replayState={};
let challengeCount=0;
const ctx={
 JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
 JILL:{SHEET_ID:'synthetic',SHEET_NAME:'Intake'},HEADERS:intakeHeader,
 JILL_CUSTOM_OWNER_SHEET:'CustomOrderOwners',
 JILL_CUSTOM_OWNER_HEADERS:['submission_id','owner_gid','payload_sha256','bound_at'],
 JILL_CUSTOM_WORKFLOW:{EVENTS_SHEET:'Events',HEADERS:eventHeader,
   STATUSES:['received'],INTERNAL:['new']},
 Date:{now:()=>now},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='JILL_WORK_OWNER_BINDING_QA_ENABLED'?'true':
    k==='JILL_HQ_MERCHANT_READ_SECRET'?SECRET:null,
 getProperties:()=>({...replayState}),
 setProperty:(key,value)=>{replayState[key]=value;},
 deleteProperty:key=>{delete replayState[key];}})},
 SpreadsheetApp:{openById:()=>({})},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
 Utilities:{computeHmacSha256Signature:(msg,secret)=>Array.from(createHmac('sha256',secret).update(msg).digest()).map(v=>v>127?v-256:v)},
 jillCustomOrderOwnerHash_:x=>createHash('sha256').update(x).digest('hex'),
 jillWorkHqReadOnlySheet_(_ss,name,_header){reads++;return {
    getLastRow:()=>rows[name]().length+1,
    getRange:()=>({getValues:()=>rows[name]()})
  };},
 constantTimeEqual_:(a,b)=>a===b,
 json_:x=>x,
};
vm.createContext(ctx);vm.runInContext(code,ctx);
const read=(provided)=>{
 const p=provided||(()=>{
  const nonce=challengeCount++===0?NONCE:String(challengeCount).padStart(32,'0');
  const fresh={...params,jill_hq_read_nonce:nonce};
  fresh.jill_hq_read_sig=hmac(['merchant_owner_binding_request_v1',
   SHOP,ID,'3',String(now),nonce]);
  return fresh;
 })();
 return ctx.jillWorkHqOwnerBindingProof_({
  parameter:p,parameters:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,[v]]))
 });
};
const good=read();assert.equal(good.ok,true);assert.equal(good.owner_customer_gid,GID);
assert.equal(good.raw_payload_sha256,hash);
assert.equal(good.signature,hmac(['work_quote_owner_binding_v1',SHOP,ID,'3',GID,hash,String(now),NONCE]));
assert.equal(Object.keys(good).length,12);
assert.doesNotMatch(JSON.stringify(good),/email|address|raw_payload":/);
function denial(setup,cleanup){setup();try{assert.equal(read().ok,false);}finally{cleanup();}}
denial(()=>ledgerGid='',()=>ledgerGid=GID);
// Identity comes exclusively from the immutable ledger, not a caller-supplied GID.
ledgerGid='gid://shopify/Customer/222';
assert.equal(read().owner_customer_gid,ledgerGid);
ledgerGid=GID;
denial(()=>storedHash='b'.repeat(64),()=>storedHash=hash);
denial(()=>revisionValue=2,()=>revisionValue=3);
assert.equal(read({...params,jill_hq_read_sig:'a'.repeat(64)}).ok,false);
assert.equal(read({...params,shop:'other.myshopify.com'}).ok,false);
assert.equal(read(params).ok,false,'first nonce cannot be replayed');
const count=reads;ctx.JILL_REWARDS_RUNTIME='LIVE';
assert.equal(read().ok,false);assert.equal(reads,count);
console.log('PASS isolated WORK Google owner-ledger proof: canonical hash/revision, signed response, tamper denial, LIVE no reads.');
