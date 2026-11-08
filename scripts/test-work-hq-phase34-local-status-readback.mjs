// Phase 34: isolated WORK merchant status command -> real QA GAS writer ->
// append-only synthetic sheet -> HQ and signed My JILL status readback.
// OFFLINE: no real Google Apps Script, Cloudflare, Shopify, email, R2 or D1.
// The spreadsheet and Owner session are in-memory fixtures, not live evidence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {handleWorkMerchantCommand} from '../services/jill-order-desk/merchant-command.mjs';
import {readWorkGoogleQaMerchantList,JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';
import {readWorkGoogleQaMerchantDetail,JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL}
  from '../services/jill-order-desk/work-google-merchant-detail.mjs';
import {handleWorkCustomOrderAccountRead} from '../backend/custom-order-account-read.mjs';
import {loadWorkCustomerConversationState} from '../shared/customer-custom-orders.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:22222222-3333-4444-8555-666666666666';
const OP='jill:hq:status:10000000-2000-4000-8000-900000000000';
const SECOND='jill:hq:status:10000000-2000-4000-8000-900000000001';
const READ_SECRET='SYNTHETIC_PHASE34_READ_SECRET_abcdefghijklmnopqrstuvwxyz';
const WRITE_SECRET='SYNTHETIC_PHASE34_WRITE_SECRET_abcdefghijklmnopqrstuvwxyz';
const GATEWAY_SECRET='SYNTHETIC_PHASE34_GATEWAY_SECRET_abcdefghijklmnopqrstuvwxyz';
const APP_SECRET='SYNTHETIC_PHASE34_APP_SECRET_abcdefghijklmnopqrstuvwxyz';
const CUSTOMER_ENDPOINT='https://script.google.com/macros/s/AKfycbLOCAL_STATUS_FIXTURE/exec';
const OWNER_GID='gid://shopify/Customer/111';
const OTHER_GID='gid://shopify/Customer/222';
const SUBMITTED='2026-10-16T12:00:00.000Z';
const SRC=readFileSync(
  new URL('../backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs',
    import.meta.url),'utf8');
function extract(begin,end){
  const i=SRC.indexOf(begin);
  const j=SRC.indexOf(end,i+begin.length);
  assert.ok(i>=0&&j>i,'Missing pinned real Google source segment');
  return SRC.slice(i,j);
}
const workflow=Object.freeze({
  EVENTS_SHEET:'CustomOrderEvents',
  HEADERS:['event_id','submission_id','revision','customer_status',
    'internal_status','public_note','internal_note','evidence_ref',
    'actor','occurred_at','source'],
  STATUSES:['received','reviewing','awaiting_approval','in_production',
    'ready_pickup','on_hold','cancelled','completed'],
  INTERNAL:['new','needs_quote','waiting_customer','materials_ordered',
    'proof_revision','printing','assembly','quality_check','ready','none'],
  TRANSITIONS:{
    received:['reviewing','on_hold','cancelled'],
    reviewing:['awaiting_approval','in_production','on_hold','cancelled'],
    awaiting_approval:['reviewing','on_hold','cancelled'],
    in_production:['ready_pickup','on_hold','cancelled'],
    ready_pickup:['completed','on_hold'],
    on_hold:['reviewing','in_production','cancelled'],
    cancelled:[],completed:[],
  },
});
const HEADERS=['submission_id','status','submitted_at','name','email',
  'phone','preferred_contact','event_date','date_needed','fulfillment',
  'city','state','zip','theme','colors','collections','products',
  'reference_images','marketing_consent','marketing_consent_at',
  'marketing_consent_source','raw_payload'];
const raw=JSON.stringify({
  version:1,operation:'custom_order.submit',submission_id:ID,
  submitted_at:SUBMITTED,
  customer:{name:'Synthetic Customer',email:'synthetic@example.invalid'},
  planning:{fulfillment:'pickup',date_needed:'2026-10-29'},
  items:[{item_id:'synthetic-item-1',product_id:'shopify-product:101',
    title:'Synthetic item',quantity:1,
    attributes:[],personalization_groups:[],reference_ids:[]}],
  request_attributes:[],reference_ids:[],
});
const intakeData=HEADERS.map(key=>({
  submission_id:ID,submitted_at:SUBMITTED,raw_payload:raw,
})[key]??'');
const received=workflow.HEADERS.map(key=>({
  event_id:'received:'+ID,submission_id:ID,revision:'1',
  customer_status:'received',internal_status:'new',
  occurred_at:SUBMITTED,actor:'system:intake',source:'intake',
})[key]??'');
const sheet=(header,entries)=>({
  entries,
  getLastRow(){return this.entries.length+1;},
  getRange(row,column,count,width){
    assert.ok(Number.isInteger(row)&&row>=1);
    assert.ok(Number.isInteger(column)&&column>=1);
    return {
      getValues:()=>Array.from({length:count},(_,n)=>{
        const values=row+n===1?header:entries[row+n-2];
        assert.ok(Array.isArray(values),'Missing synthetic sheet row');
        return values.slice(column-1,column-1+width);
      }),
      getValue:()=>{
        const values=row===1?header:entries[row-2];
        assert.ok(Array.isArray(values));
        return values[column-1];
      },
    };
  },
  appendRow(row){
    assert.equal(row.length,header.length);
    this.entries.push(row);
  },
});
const intake=sheet(HEADERS,[intakeData]);
const events=sheet(workflow.HEADERS,[received]);
const sheets=new Map([['Submissions',intake],['CustomOrderEvents',events]]);
const cache=new Map();
let flushes=0,cacheRemovals=0,locks=0,authCalls=0,qaRequests=0;
const signedBytes=bytes=>Array.from(bytes,v=>v>127?v-256:v);
const secretHmac=(message,key)=>signedBytes(createHmac('sha256',key).update(message).digest());
const context={
  JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
  JILL:{SHEET_ID:'SYNTHETIC_ONLY_PHASE34',SHEET_NAME:'Submissions'},
  HEADERS,JILL_CUSTOM_WORKFLOW:workflow,
  PropertiesService:{getScriptProperties:()=>({
    getProperty:key=>({JILL_HQ_MERCHANT_READ_SECRET:READ_SECRET,
      JILL_HQ_MERCHANT_WRITE_SECRET:WRITE_SECRET,
      JILL_CUSTOM_ORDER_GATEWAY_SECRET:GATEWAY_SECRET})[key]??null,
  })},
  Utilities:{computeHmacSha256Signature:secretHmac,DigestAlgorithm:{SHA_256:'sha256'},
    computeDigest:(algorithm,text)=>signedBytes(createHash(algorithm).update(text).digest())},
  constantTimeEqual_:(a,b)=>a===b,
  SpreadsheetApp:{
    openById(id){
      assert.equal(id,'SYNTHETIC_ONLY_PHASE34');
      return {getSheetByName:n=>sheets.get(n),
        insertSheet(){throw Error('Unexpected new synthetic sheet');}};
    },
    flush(){flushes++;},
  },
  CacheService:{getScriptCache:()=>({
    get:key=>cache.get(key)??null,
    put(key,value){cache.set(key,value);},
    remove(key){cacheRemovals++;cache.delete(key);},
  })},
  LockService:{getScriptLock:()=>({
    waitLock(n){assert.equal(n,10000);locks++;},
    releaseLock(){locks--;assert.ok(locks>=0);},
  })},
  jillCustomOrderAssertLive_(){
    assert.equal(context.JILL_REWARDS_RUNTIME,'WORK');
    assert.equal(context.JILL_CUSTOM_ORDER_SANDBOX,true);
  },
  getSheet_:()=>intake,
  findSubmissionRow_:(_sheet,id)=>id===ID?2:null,
  jillCustomOrderEventsSheet_:()=>events,
  clean_:value=>String(value??'').trim(),
  json_:x=>x,Date,JSON,Math,String,Number,Array,Object,Error,console,
};
vm.createContext(context);
for(const code of [
  extract('function jillCustomOrderEventsFor_',
    'function jillCustomOrderMerchantRead('),
  extract('function jillCustomOrderGatewaySignature_',
    'function jillCustomOrderGatewaySubmissionAllowed_'),
  extract('/* WORK CUSTOM ORDER OWNERSHIP V1',
    '/* END WORK CUSTOM ORDER OWNERSHIP V1 */'),
  extract('function jillCustomOrderMerchantUpdateAsActor_',
    'function jillCustomOrderMerchantBackfill'),
  extract('/* WORK HQ MERCHANT READ V1',
    '/* END WORK HQ MERCHANT READ V1 */'),
  extract('/* WORK HQ EXACT REQUEST DETAIL V1',
    '/* END WORK HQ EXACT REQUEST DETAIL V1 */'),
  extract('/* WORK HQ MERCHANT COMMAND V1',
    '/* END WORK HQ MERCHANT COMMAND V1 */'),
])vm.runInContext(code,context,{timeout:2000});
const owners=sheet(['submission_id','owner_gid','payload_sha256','bound_at'],
  [[ID,OWNER_GID,context.jillCustomOrderOwnerHash_(raw),SUBMITTED]]);
sheets.set('CustomOrderOwners',owners);

const makeEvent=body=>{
  const p=Object.fromEntries(new URLSearchParams(body));
  return {parameter:p,parameters:Object.fromEntries(
    Object.entries(p).map(([k,v])=>[k,[v]]))};
};
const backendFetch=async(url,req)=>{
  qaRequests++;
  assert.equal(req.method,'POST');
  assert.ok(req.signal);
  const event=makeEvent(req.body);
  if(url===CUSTOMER_ENDPOINT&&event.parameter.jill_order_customer_list==='1')
    return Response.json(context.jillCustomOrderGatewayCustomerList_(event));
  if(url===JILL_HQ_WORK_QA_GOOGLE_URL){
    if(event.parameter.jill_order_merchant_command==='1')
      return Response.json(context.jillWorkHqMerchantCommand_(event));
    if(event.parameter.jill_order_merchant_list==='1')
      return Response.json(context.jillWorkHqMerchantList_(event));
  }
  if(url===JILL_HQ_WORK_QA_GOOGLE_DETAIL_URL)
    return Response.json(context.jillWorkHqMerchantDetail_(event));
  throw Error('Unexpected simulated endpoint');
};
const readList=()=>readWorkGoogleQaMerchantList({
  secret:READ_SECRET,backendFetch,
});
const readDetail=()=>readWorkGoogleQaMerchantDetail({
  secret:READ_SECRET,submissionId:ID,backendFetch,
});
const first=(await readList()).records;
assert.equal(first.length,1);
assert.equal(first[0].revision,1);
assert.equal(first[0].customer_status,'received');
assert.equal((await readDetail()).revision,1);

const authority={shop:SHOP,environment:'WORK',
  app_client_id:'f8e1ebdbae84490dc8ea5b133637e6c0',
  owner_staff_id:'123',policy_version:1};
const readCustomer=async(gid)=>{
  const now=Math.floor(Date.now()/1000);
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const claim=encode({alg:'HS256',typ:'JWT'})+'.'+encode({
    aud:authority.app_client_id,dest:SHOP,sub:gid,iat:now,nbf:now,exp:now+300,jti:randomUUID(),
  });
  const jwt=claim+'.'+createHmac('sha256',APP_SECRET).update(claim).digest('base64url');
  return loadWorkCustomerConversationState({sessionToken:{get:async()=>jwt},
    request:(url,options)=>handleWorkCustomOrderAccountRead(new Request(url,options),{
      shopifyAppSecret:APP_SECRET,googleGatewaySecret:GATEWAY_SECRET,
      googleQaEndpoint:CUSTOMER_ENDPOINT,backendFetch,rateLimit:async()=>true,
    }),
  });
};
const initialCustomer=await readCustomer(OWNER_GID);
assert.equal(initialCustomer.orders.length,1);
assert.equal(initialCustomer.orders[0].revision,1);
assert.equal(initialCustomer.orders[0].status,'received');
const db={prepare(sql){
  return {bind(){return {first:async()=>sql.includes('jill_merchant_authority')
    ?authority:null};}};
}};
const session={shop:SHOP,isOnline:true,
  expires:new Date(Date.now()+60000),
  onlineAccessInfo:{associated_user:{id:'123',account_owner:true},
    associated_user_scope:'read_orders,write_orders'},
};
const authenticate={admin:async()=>{
  authCalls++;return {session};
}};
const command={
  kind:'status',submission_id:ID,operation_id:OP,expected_revision:'1',
  current_status:'received',customer_status:'reviewing',
  internal_status:'needs_quote',
  public_note:'Synthetic QA review started.',
  internal_note:'SYNTHETIC_INTERNAL_STATUS_NOTE',handoff_reference:'',
};
function request(data=command,origin='https://work.example'){
  return new Request('https://work.example/app/requests/command',{
    method:'POST',headers:{origin,
      'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(data),
  });
}
async function send(data=command,origin){
  const response=await handleWorkMerchantCommand({
    request:request(data,origin),authenticate,db,enabled:true,
    secret:WRITE_SECRET,backendFetch,
  });
  return {status:response.status,body:await response.json()};
}
let out=await send();
assert.equal(out.status,200);
assert.equal(out.body.code,'saved');
assert.equal(out.body.revision,2);
assert.equal(out.body.duplicate,false);
assert.equal(out.body.email_status,'not_requested');
assert.equal(events.entries.length,2);
assert.equal(events.entries[1][0],OP);
assert.equal(events.entries[1][3],'reviewing');
assert.equal(events.entries[1][4],'needs_quote');
assert.equal(events.entries[1][8],'shopify:WORK:staff:123');
assert.equal(cacheRemovals>=1,true,'canonical write must clear Google cache');

const fresh=(await readList()).records;
assert.equal(fresh.length,1);
assert.equal(fresh[0].revision,2);
assert.equal(fresh[0].customer_status,'reviewing');
assert.equal(fresh[0].internal_status,'needs_quote');
const detail=await readDetail();
assert.equal(detail.revision,2);
assert.equal(detail.items.length,1);
assert.equal(detail.raw_payload,undefined);
const history=context.jillCustomOrderEventsFor_(events,ID);
assert.equal(history.length,2);
assert.equal(history[1].public_note,'Synthetic QA review started.');
assert.equal(history[1].actor,'shopify:WORK:staff:123');
assert.equal(history[1].internal_note,command.internal_note);
const updatedCustomer=await readCustomer(OWNER_GID);
assert.equal(updatedCustomer.orders.length,1);
const [updatedOrder]=updatedCustomer.orders;
assert.equal(updatedOrder.submission_id,ID);
assert.equal(updatedOrder.revision,detail.revision);
assert.equal(updatedOrder.status,fresh[0].customer_status);
assert.equal(updatedOrder.timeline.at(-1).note,command.public_note);
assert.doesNotMatch(JSON.stringify(updatedOrder),/SYNTHETIC_INTERNAL_STATUS_NOTE|shopify:WORK:staff|synthetic@example\.invalid/);
assert.deepEqual((await readCustomer(OTHER_GID)).orders,[]);
assert.deepEqual((await readCustomer(OWNER_GID)).orders,updatedCustomer.orders);
assert.equal(locks,0);
out=await send(); // Same signed payload and idempotency key, new HMAC nonce.
assert.equal(out.status,200);
assert.equal(out.body.duplicate,true);
assert.equal(out.body.revision,2);
assert.equal(events.entries.length,2,'Idempotent retry must not append');
const stale=await send({...command,operation_id:SECOND});
assert.equal(stale.status,409);
assert.equal(stale.body.code,'stale_revision');
assert.equal(events.entries.length,2);
const foreign=await send({...command,operation_id:SECOND},
  'https://jillonlinestore.com');
assert.equal(foreign.status,403);
assert.equal(events.entries.length,2);
assert.equal((await readList()).records[0].revision,2);
assert.equal(locks,0);
assert.equal(flushes,1,'Only one synthetic append is allowed');
assert.ok(authCalls>=4);
assert.ok(qaRequests>=7);
assert.deepEqual([...sheets.keys()],['Submissions','CustomOrderEvents','CustomOrderOwners']);
console.log('PASS WORK OFFLINE status: signed HQ command -> canonical event append -> matching HQ and signed My JILL readback, A/B/A isolation, private-note exclusion, idempotency and stale/cross-origin denials.');
console.log('HOLD: all sheet rows, sessions, keys and backend responses were synthetic; NO real WORK QA mutation, Shopify session or deployed-v34 byte parity was proved.');
