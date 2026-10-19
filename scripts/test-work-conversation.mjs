// Canonical Google source + customer ingress + HQ public projection, no network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {handleWorkCustomerReply} from '../backend/custom-order-conversation.mjs';
import {handleWorkCustomOrderAccountRead} from '../backend/custom-order-account-read.mjs';
import {readWorkRequestThread} from '../services/jill-order-desk/work-request-thread.mjs';

const gs=readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const slice=(a,b)=>gs.slice(gs.indexOf(a),gs.indexOf(b,gs.indexOf(a)+a.length));
class Sheet{
  constructor(rows=[]){this.rows=rows;}
  getLastRow(){return this.rows.length;}
  appendRow(row){this.rows.push([...row]);}
  setFrozenRows(){}
  getRange(row,col,count=1,width=1){return {
    getValues:()=>Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>this.rows[row+i-1]?.[col+j-1]??'')),
    getValue:()=>this.rows[row-1]?.[col-1]??'',
    setValues:values=>values.forEach((r,i)=>{
      while(this.rows.length<row+i)this.rows.push([]);
      r.forEach((v,j)=>{this.rows[row+i-1][col+j-1]=v;});
    })};}
}
const ID='jill:11111111-2222-4333-8444-555555555555';
const A='gid://shopify/Customer/111',B='gid://shopify/Customer/222';
const SECRET='synthetic-google-gateway-secret-000000000000000';
const READ='synthetic-distinct-merchant-read-111111111111111';
const APP='synthetic-shopify-app-secret-222222222222222222';
const URL='https://script.google.com/macros/s/AKfycbLOCAL_FIXTURE/exec';
const raw=JSON.stringify({version:1,operation:'custom_order.submit',submission_id:ID,
  customer:{email:'contact-only-other-account@example.invalid'},
  items:[{title:'Synthetic tote',quantity:1}],planning:{fulfillment:'pickup'}});
const source=new Sheet([['submission_id','raw_payload','submitted_at'],[ID,raw,'2026-10-18T00:00:00Z']]);
const sheets={Submissions:source};let locked=false,enabled=true;
const signedBytes=bytes=>[...bytes].map(n=>n>127?n-256:n);
const box={JILL_REWARDS_RUNTIME:'WORK',JILL_CUSTOM_ORDER_SANDBOX:true,
  JILL:{SHEET_ID:'LOCAL',SHEET_NAME:'Submissions'},HEADERS:source.rows[0],
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>({
    JILL_CUSTOM_ORDER_GATEWAY_SECRET:SECRET,JILL_HQ_MERCHANT_READ_SECRET:READ,
    JILL_WORK_CONVERSATION_ENABLED:enabled?'true':'false'})[k]||''})},
  SpreadsheetApp:{openById:()=>({getSheetByName:k=>sheets[k]||null,
    insertSheet:k=>(sheets[k]=new Sheet())}),flush(){}},
  CacheService:{getScriptCache:()=>({remove(){}})},
  LockService:{getScriptLock:()=>({waitLock(){assert(!locked);locked=true;},releaseLock(){locked=false;}})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},
    computeDigest:(_,text)=>signedBytes(createHash('sha256').update(text).digest()),
    computeHmacSha256Signature:(text,key)=>signedBytes(createHmac('sha256',key).update(text).digest())},
  getSheet_:()=>source,
  findSubmissionRow_:(_,id)=>source.rows.findIndex((r,i)=>i>0&&r[0]===id)+1,
  jillWorkHqReadOnlySheet_:(_,name)=>sheets[name],
  json_:x=>x,constantTimeEqual_:(a,b)=>a===b,clean_:x=>String(x??'').trim(),
  Date,Set,console};
vm.createContext(box);
vm.runInContext([
  slice('const JILL_CUSTOM_WORKFLOW =','/* END CUSTOM ORDER WORKFLOW V1 */'),
].join('\n'),box);
box.jillCustomOrderOwnerBind_(ID,A,raw,false);
box.jillCustomOrderEnsureReceived_(ID,'2026-10-18T00:00:00Z');
const merchant=(revision,note,privateNote='')=>box.jillCustomOrderMerchantUpdateAsActor_({
  submission_id:ID,operation_id:'jill:hq:message:'+randomUUID(),expected_revision:revision,
  customer_status:'received',internal_status:'new',public_note:note,
  internal_note:privateNote,handoff_reference:''},'shopify:WORK:staff:123');
merchant(1,'Hi, what color would you like?');
merchant(2,'','PRIVATE_MATERIAL_COST');
let calls=0,loseReply=false;
const backendFetch=async(_url,init)=>{
  calls++;
  const p=Object.fromEntries(new URLSearchParams(init.body));
  const e={parameter:p,parameters:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,[v]]))};
  const result=p.jill_order_customer_reply?box.jillWorkCustomerReply_(e):
    p.jill_order_merchant_thread?box.jillWorkMerchantThread_(e):box.jillCustomOrderGatewayCustomerList_(e);
  if(loseReply){loseReply=false;throw Error('synthetic timeout AFTER commit');}
  return new Response(JSON.stringify(result));
};
const token=(gid=A)=>{
  const t=Math.floor(Date.now()/1000);
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const payload=enc({alg:'HS256',typ:'JWT'})+'.'+enc({
    aud:'f8e1ebdbae84490dc8ea5b133637e6c0',dest:'jill-work.myshopify.com',
    sub:gid,iat:t,nbf:t,exp:t+300,jti:randomUUID()});
  return payload+'.'+createHmac('sha256',APP).update(payload).digest('base64url');
};
const command={mode:'send',submission_id:ID,operation_id:'jill:customer:reply:'+randomUUID(),
  expected_revision:3,text:'Azul y morado, por favor. 💜'};
const opts={enabled:true,shopifyAppSecret:APP,googleGatewaySecret:SECRET,
  googleQaEndpoint:URL,backendFetch,rateLimit:async()=>true};
const request=(cmd=command,gid=A)=>new Request('https://local/jill-custom-order-reply',{
  method:'POST',headers:{authorization:'Bearer '+token(gid),'content-type':'application/json'},
  body:JSON.stringify(cmd)});
const send=(cmd=command,gid=A)=>handleWorkCustomerReply(request(cmd,gid),opts);
assert.equal((await send(command,B)).status,403,'Contact email must not transfer ownership');
assert.equal(sheets.CustomOrderEvents.getLastRow(),4);
loseReply=true;
assert.equal((await send()).status,503,'Lost acknowledgement must remain unconfirmed');
assert.equal(sheets.CustomOrderEvents.getLastRow(),5,'Canonical event actually committed once');
const receipt=await send({...command,mode:'receipt'});
assert.equal(receipt.status,200);assert.equal((await receipt.json()).revision,4);
assert.equal((await send()).status,200,'Same operation replay returns original receipt');
assert.equal(sheets.CustomOrderEvents.getLastRow(),5);
assert.equal((await send({...command,text:'Different terms'})).status,503);
assert.equal((await send({...command,operation_id:'jill:customer:reply:'+randomUUID()})).status,409);
assert.equal((await send({...command,mode:'receipt',operation_id:'jill:customer:reply:'+randomUUID()})).status,404);
assert.equal((await send({...command,customer_gid:B})).status,400);
const before=calls;
assert.equal((await handleWorkCustomerReply(request(),{...opts,enabled:false})).status,503);
assert.equal((await handleWorkCustomerReply(new Request('https://local',{method:'POST'}),opts)).status,401);
assert.equal(calls,before,'Disabled/unauthenticated calls never reach Google');
const account=await handleWorkCustomOrderAccountRead(new Request('https://local',{
  method:'POST',headers:{authorization:'Bearer '+token()}}),opts);
assert.equal(account.status,200);
const customer=(await account.json()).orders[0];
assert.equal(customer.timeline_version,2);
assert.equal(customer.timeline.length,3,'Internal-only event does not enter public thread');
assert.equal(customer.timeline.at(-1).author,'customer');
assert.equal(customer.timeline.at(-1).note,command.text);
assert(!JSON.stringify(customer).includes('PRIVATE_MATERIAL_COST'));
assert(!JSON.stringify(customer).includes('contact-only-other-account'));
const hq=await readWorkRequestThread({submissionId:ID,secret:READ,backendFetch});
assert.deepEqual(hq,customer,'HQ and My JILL consume one public thread');
enabled=false;
assert.equal((await send()).status,403,'Google independently fails closed when feature disabled');
assert.equal(locked,false);
console.log('PASS actual canonical Google writer: HQ -> customer -> HQ, A/B isolation, private-note exclusion, lost acknowledgement/receipt, duplicate/stale/edited command and dual release gates.');
