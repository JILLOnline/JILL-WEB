import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import vm from 'node:vm';
import {
  validateWorkMerchantCommand,signWorkMerchantCommand,
  handleWorkMerchantCommand,submitWorkMerchantCommand,
  WORK_STATUS_TRANSITIONS,
} from '../services/jill-order-desk/merchant-command.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';

const SHOP='jill-work.myshopify.com';
const SECRET='QA_ONLY_SIGNED_WRITE_KEY_abcdefghijklmnopqrstuvwxyz';
const command={
  kind:'message',
  submission_id:'jill:92b32355-900e-47ba-8946-ccd93190a3b7',
  operation_id:'jill:hq:09e67134-cd3e-47d4-b371-555a121b5f99',
  expected_revision:'1',
  current_status:'received',customer_status:'received',
  internal_status:'new',public_note:'Your custom item is being reviewed.',
  internal_note:'',handoff_reference:'',
};
const request=new Request('https://work.example/app/requests/command',{
  method:'POST',headers:{origin:'https://work.example',
    'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams(command),
});
const model=validateWorkMerchantCommand(command);
assert.equal(model.expected_revision,1);
assert.deepEqual(WORK_STATUS_TRANSITIONS.received,['reviewing','on_hold','cancelled']);
for(const input of [
  {...command,kind:'delete'}, {...command,submission_id:'bad'},
  {...command,public_note:''}, {...command,expected_revision:'0'},
  {...command,internal_status:'admin'}, {...command,kind:'message',customer_status:'reviewing'},
  {...command,body:'duplicate'}, {...command,operation_id:'other'},
  {...command,public_note:'a'.repeat(501)},
])assert.throws(()=>validateWorkMerchantCommand(input));
const status={
  ...command,kind:'status',customer_status:'reviewing',internal_status:'needs_quote',
  public_note:'We are reviewing.',internal_note:'Inventory check',
};
assert.equal(validateWorkMerchantCommand(status).customer_status,'reviewing');
assert.throws(()=>validateWorkMerchantCommand({...status,customer_status:'completed'}));
const stamp=String(Date.now()),nonce='Z'.repeat(32);
const signature=signWorkMerchantCommand({command:model,staffId:'123',
  timestamp:stamp,nonce,secret:SECRET});
assert.match(signature,/^[a-f0-9]{64}$/);
assert.throws(()=>signWorkMerchantCommand({command:model,staffId:'123',
  timestamp:stamp,nonce,secret:'wrong'}));
let backendCalls=0;
const response={version:1,operation:'custom_order.merchant.command.result',
  ok:true,submission_id:command.submission_id,operation_id:command.operation_id,
  revision:2,customer_status:'received',duplicate:false,email_status:'queued'};
const backendFetch=async(url,options)=>{
  backendCalls++;
  assert.equal(url,JILL_HQ_WORK_QA_GOOGLE_URL);
  assert.equal(options.method,'POST');
  const p=new URLSearchParams(options.body);
  assert.equal(p.get('jill_hq_write_staff'),'123');
  assert.equal(p.get('jill_hq_write_sig'),signature);
  return Response.json(response);
};
const done=await submitWorkMerchantCommand({
  command:model,staffId:'123',timestamp:stamp,secret:SECRET,
  now:()=>Number(stamp),nonceFn:()=>nonce,backendFetch,
});
assert.equal(done.ok,true);
assert.equal(done.email_status,'queued');
assert.equal(backendCalls,1);
const invalidAck=async()=>Response.json({...response,operation_id:'other'});
await assert.rejects(()=>submitWorkMerchantCommand({
  command:model,staffId:'123',secret:SECRET,backendFetch:invalidAck,
}),/invalid_ack/);
const stale=await submitWorkMerchantCommand({command:model,staffId:'123',
  secret:SECRET,backendFetch:async()=>Response.json({
    version:1,operation:'custom_order.merchant.command.result',ok:false,
    error:{code:'stale_revision'}
  })});
assert.equal(stale.code,'stale_revision');

// Read authorization is never authorization for mutation.
const authority={shop:SHOP,environment:'WORK',
  app_client_id:'f8e1ebdbae84490dc8ea5b133637e6c0',
  owner_staff_id:'123',policy_version:1};
const db={
  prepare(sql){return {bind(){return {first:async()=>
    sql.includes('jill_merchant_authority')?authority:null};}};},
};
function session(id='123',owner=true){return {
  shop:SHOP,isOnline:true,expires:new Date(Date.now()+120000),
  onlineAccessInfo:{associated_user:{id,account_owner:owner},
    associated_user_scope:'read_orders,write_orders'},
};}
const auth=s=>({admin:async()=>({session:s})});
const invoke=(overrides={})=>handleWorkMerchantCommand({
  request:request.clone(),authenticate:auth(session()),db,enabled:true,secret:SECRET,
  now:()=>Number(stamp),backendFetch:async()=>Response.json(response),...overrides,
});
let out=await invoke({enabled:false});assert.equal(out.status,503);
assert.equal((await out.json()).code,'writes_not_connected');
out=await invoke({authenticate:auth(session('456',false))});
assert.equal(out.status,403);
out=await invoke({request:new Request(request.url,{
  method:'POST',headers:{origin:'https://evil.example',
    'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams(command),
})});
assert.equal(out.status,403);
out=await invoke();assert.equal(out.status,200);
assert.equal((await out.json()).email_status,'queued');
out=await invoke({backendFetch:async()=>Response.json({
  version:1,operation:'custom_order.merchant.command.result',
  ok:false,error:{code:'stale_revision'},
})});assert.equal(out.status,409);
out=await invoke({backendFetch:async()=>{throw Error('SECRET NEVER LEAK');}});
assert.equal(out.status,503);
assert.equal(JSON.stringify(await out.json()).includes('SECRET'),false);
out=await invoke({request:new Request(request.url,{
  method:'POST',headers:{origin:'https://work.example',
    'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams([...Object.entries(command),['kind','status']]),
})});assert.equal(out.status,400);

// Execute actual QA verifier (not a mirrored parser) against signed mock.
const gs=readFileSync(
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const begin=gs.indexOf('/* WORK HQ MERCHANT COMMAND V1');
const end=gs.indexOf('/* END WORK HQ MERCHANT COMMAND V1 */',begin);
assert.ok(begin>=0&&end>begin);
const events=[];
const bytes=(m,key)=>Array.from(createHmac('sha256',key).update(m).digest())
  .map(n=>n>127?n-256:n);
const sandbox={
  JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
  JILL_CUSTOM_WORKFLOW:{
    STATUSES:['received','reviewing','awaiting_approval','in_production',
      'ready_pickup','on_hold','cancelled','completed'],
    INTERNAL:['new','needs_quote','waiting_customer','materials_ordered',
      'proof_revision','printing','assembly','quality_check','ready','none'],
  },
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>
    k==='JILL_HQ_MERCHANT_WRITE_SECRET'?SECRET:null})},
  Utilities:{computeHmacSha256Signature:bytes},
  constantTimeEqual_:(a,b)=>a===b,
  json_:x=>x,
  jillCustomOrderMerchantUpdateAsActor_:(cmd,actor)=>{
    assert.equal(actor,'shopify:WORK:staff:123');events.push(cmd);
    return {revision:2,duplicate:false};
  },
  Date,JSON,Math,String,Number,Array,Object,Error,console,
};
vm.createContext(sandbox);
vm.runInContext(gs.slice(begin,end),sandbox);
const payload={
  jill_order_merchant_command:'1',shop:SHOP,...command,
  jill_hq_write_ts:stamp,jill_hq_write_nonce:nonce,
  jill_hq_write_staff:'123',jill_hq_write_sig:signature,
};
const event={parameter:payload,parameters:Object.fromEntries(
  Object.entries(payload).map(([k,v])=>[k,[String(v)]]))};
assert.equal(sandbox.jillWorkHqMerchantCommandVerified_(event),true);
assert.equal(sandbox.jillWorkHqMerchantCommand_({
  ...event,parameter:{...payload,jill_hq_write_sig:'0'.repeat(64)},
}).error.code,'unauthorized');
assert.equal(sandbox.jillWorkHqMerchantCommand_({
  ...event,parameters:{...event.parameters,kind:['message','status']},
}).error.code,'unauthorized');
sandbox.JILL_REWARDS_RUNTIME='LIVE';
assert.equal(sandbox.jillWorkHqMerchantCommand_(event).error.code,'unauthorized');
sandbox.JILL_REWARDS_RUNTIME='WORK';sandbox.JILL_CUSTOM_ORDER_SANDBOX=false;
assert.equal(sandbox.jillWorkHqMerchantCommand_(event).error.code,'unauthorized');
assert.equal(events.length,0,'No unauthorized Google events');
// QA email dispatch must stay OUTSIDE web-app mutation and QA mail scopes.
assert.doesNotMatch(gs.slice(begin,end),/MailApp\.|GmailApp\.|sendEmail\(/);
const route=readFileSync('services/jill-order-desk/app-home/app/routes/app.requests.command.tsx','utf8');
assert.match(route,/handleWorkMerchantCommand/);
assert.match(route,/workMerchantWritesReady/);
const readiness=readFileSync('services/jill-order-desk/work-merchant-write-readiness.mjs','utf8');
assert.match(readiness,/JILL_WORK_MERCHANT_WRITES_ENABLED==='true'/);
assert.match(readiness,/SHOPIFY_API_SECRET/);
assert.doesNotMatch(route,/SHOPIFY_ACCESS_TOKEN|JILL_CUSTOM_ORDER_GATEWAY_SECRET/);
console.log('PASS WORK HQ commands: Owner-only, HMAC, input bounds, revision conflicts, idempotent references, fail-closed QA verifier, My JILL event + pending email contract.');
