// A version-2 conversation is NOT permission to send. Capability comes only
// from the authenticated WORK Worker response and is OFF when absent.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {handleWorkCustomOrderAccountRead}
 from '../backend/custom-order-account-read.mjs';
import {loadWorkCustomerConversationState,loadWorkCustomerCustomOrders,
 WORK_CUSTOM_ORDER_ACCOUNT_URL} from '../shared/customer-custom-orders.mjs';
const app='shopify-work-test-secret-not-a-real-key-of-length-42';
const gateway='google-qa-gateway-test-secret-completely-distinct';
const now=1791800000000;
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const payload={
 aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
 dest:'jill-work.myshopify.com',sub:'gid://shopify/Customer/111',
 iat:Math.floor(now/1000)-30,nbf:Math.floor(now/1000)-30,
 exp:Math.floor(now/1000)+180,jti:'work-capability-contract',
};
const input=encode({alg:'HS256',typ:'JWT'})+'.'+encode(payload);
const jwt=input+'.'+createHmac('sha256',app).update(input).digest('base64url');
const order={
 submission_id:'jill:qa:owned-111',status:'reviewing',revision:2,
 timeline_version:2,summary:{items:[],date_needed:'',fulfillment:''},
 updated_at:'2026-10-12T19:00:00.000Z',
 timeline:[
  {revision:1,status:'received',kind:'status',author:'system',note:'',
   occurred_at:'2026-10-12T18:00:00.000Z'},
  {revision:2,status:'reviewing',kind:'status',author:'jill',
   note:'Review underway.',occurred_at:'2026-10-12T19:00:00.000Z'},
 ],
};
const google={version:1,operation:'custom_order.account.list.result',ok:true,
 orders:[order],reply_enabled:true}; // FORGED upstream flag must be IGNORED.
const backendFetch=async()=>new Response(JSON.stringify(google),{status:200});
const options={
 shopifyAppSecret:app,googleGatewaySecret:gateway,
 googleQaEndpoint:'https://script.google.com/macros/s/AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V/exec',
 rateLimit:async()=>true,backendFetch,now:()=>now,
};
const request=()=>new Request(WORK_CUSTOM_ORDER_ACCOUNT_URL,{
 method:'POST',headers:{Authorization:'Bearer '+jwt},body:''});
const denied=await handleWorkCustomOrderAccountRead(
 new Request(WORK_CUSTOM_ORDER_ACCOUNT_URL,{method:'POST',body:''}),
 {...options,conversationEnabled:true});
assert.equal(denied.status,401,'Cannot expose capabilities without signed customer');
const legacy=await handleWorkCustomOrderAccountRead(request(),options);
assert.equal(legacy.status,200);
const legacyJson=await legacy.json();
assert.equal(legacyJson.reply_enabled,false,'Forged Google true cannot bypass Worker OFF');
assert.equal(legacyJson.orders.length,1);
const enabled=await handleWorkCustomOrderAccountRead(request(),{
 ...options,conversationEnabled:true});
assert.equal(enabled.status,200);
assert.equal((await enabled.json()).reply_enabled,true);
const invalidTruth=await handleWorkCustomOrderAccountRead(request(),{
 ...options,conversationEnabled:'true'});
assert.equal((await invalidTruth.json()).reply_enabled,false,
 'String is not a verified boolean capability');
const sessionToken={get:async()=>jwt};
let calls=0;
const read=async(_,opts)=>{
 calls++;
 assert.equal(opts.method,'POST');
 assert.equal(opts.headers.Authorization,'Bearer '+jwt);
 assert.equal(opts.body,'');
 return new Response(JSON.stringify({
  version:1,operation:'custom_order.account.list.result',ok:true,
  orders:[order],reply_enabled:calls===1?undefined:calls===2?true:false,
 }),{status:200});
};
const old=await loadWorkCustomerConversationState({sessionToken,request:read});
assert.equal(old.replyEnabled,false,'Currently deployed legacy gateway remains OFF');
assert.equal(old.orders.length,1);
const active=await loadWorkCustomerConversationState({sessionToken,request:read});
assert.equal(active.replyEnabled,true);
const stillCompatible=await loadWorkCustomerCustomOrders({sessionToken,request:read});
assert.deepEqual(stillCompatible,[order],
 'Legacy consumer receives the existing orders array, not capability object');
const bad=async()=>new Response(JSON.stringify({
 version:1,operation:'custom_order.account.list.result',ok:true,
 reply_enabled:'true',orders:[order]}),{status:200});
await assert.rejects(()=>loadWorkCustomerConversationState({
 sessionToken,request:bad}),/Invalid reply capability/);
const main=readFileSync('extensions/jill-account-dashboard/src/pages/RequestConversation.jsx','utf8');
const ordersCode=readFileSync('extensions/jill-account-dashboard/src/pages/CustomOrders.jsx','utf8');
const messagesCode=readFileSync('extensions/jill-account-dashboard/src/pages/Messages.jsx','utf8');
const worker=readFileSync('services/custom-order-cloudflare/handler.mjs','utf8');
assert.match(main,/replyEnabled=false/);
assert.match(main,/enabled=replyEnabled===true&&order\.timeline_version===2/);
assert.match(ordersCode,/replyEnabled=\{state\.replyEnabled\}/);
assert.match(messagesCode,/replyEnabled=\{state\.replyEnabled\}/);
assert.match(worker,/conversationEnabled:env\.JILL_WORK_CONVERSATION_ENABLED==='true'/);
console.log('PASS WORK reply capability: only JWT-authenticated Worker flag, defaults OFF for legacy/forged Google, v2 history not send authorization; customer array reader preserved.');
