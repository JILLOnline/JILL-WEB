// WORK Contact Us: a PRIVATE named Cloudflare WorkerEntrypoint delegate.
// This module is never mounted on the public HQ fetch route.
// An explicitly configured Cloudflare Service Binding is the only caller.
// No email/customer hint can confer account ownership: each action still
// authenticates a signed Shopify app-proxy request or Customer Account JWT.
// Gateway quotas are enforced before the RPC; this named entrypoint does not
// expose a public HTTP path and the HQ Worker alone retains D1 access.
import {handleWorkContactTicketIntake} from '../../backend/work-contact-ticket-intake.mjs';
import {handleWorkContactTicketClaim} from '../../backend/work-contact-ticket-claim.mjs';
import {handleWorkContactAccountRead} from '../../backend/work-contact-account-read.mjs';
import {readWorkCustomerContactThread} from '../../backend/work-contact-thread-read.mjs';

const ROUTES=Object.freeze({
 '/jill-custom-order-proxy/contact':{
  flag:'JILL_WORK_CONTACT_INTAKE_ENABLED',
  handler:handleWorkContactTicketIntake},
 '/jill-contact-claim':{
  flag:'JILL_WORK_CONTACT_CLAIM_ENABLED',
  handler:handleWorkContactTicketClaim},
 '/jill-contact-account':{
  flag:'JILL_WORK_CONTACT_ACCOUNT_ENABLED',
  handler:handleWorkContactAccountRead},
 '/jill-contact-thread':{
  flag:'JILL_WORK_CONTACT_THREAD_ENABLED',
  handler:readWorkCustomerContactThread},
});
const HEADERS={'cache-control':'no-store',
 'x-content-type-options':'nosniff',
 'content-type':'application/json; charset=utf-8'};
const denied=(status,code)=>Response.json(
 {ok:false,code,kind:'jill_work_contact_private_bridge'},
 {status,headers:HEADERS});
export async function handleWorkContactPrivateBridge({
 request,env,now=Date.now,
}={}){
 // No auth/session, body, quota or D1 operations unless the INTERNAL HQ
 // switch is independently enabled after dual-Worker commissioning.
 if(env?.JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED!=='true')
  return denied(503,'not_connected');
 if(!(request instanceof Request))return denied(400,'invalid_request');
 let path;
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:')return denied(400,'invalid_request');
  path=url.pathname;
 }catch{return denied(400,'invalid_request');}
 const route=Object.hasOwn(ROUTES,path)?ROUTES[path]:null;
 if(!route)return denied(404,'not_found');
 if(env?.[route.flag]!=='true')return denied(503,'not_connected');
 if(request.method!=='POST'&&request.method!=='OPTIONS')
  return denied(405,'method_not_allowed');
 if(typeof env?.SHOPIFY_API_SECRET!=='string'||
    env.SHOPIFY_API_SECRET.length<32||
    typeof env?.JILL_ORDER_DESK_WORK_DB?.prepare!=='function')
  return denied(503,'source_unavailable');
 try{
  return await route.handler({
   request,enabled:true,shopifyAppSecret:env.SHOPIFY_API_SECRET,
   db:env.JILL_ORDER_DESK_WORK_DB,
   // The only permitted caller is the bound gateway, which has a
   // WORK-only shop/global + client Durable Object limiter. Customer
   // JWT, claim token and HMAC checks still occur again INSIDE HQ.
   rateLimit:async()=>true,now,
  });
 }catch{return denied(503,'source_unavailable');}
}
