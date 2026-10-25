import {verifyWorkCustomerAccountSession} from './customer-account-work-session.mjs';
import {receiptSignature,readBackendResult} from './custom-order-gateway.mjs';
import {hasEmptyHttpBody} from './empty-http-body.mjs';

// Authenticated Customer Account extension endpoint, distinct from the
// public Shopify app proxy. It never accepts an email, owner GID or order ID
// from the caller. Only the verified Shopify session 'sub' selects records.
const BACKEND=/^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/;
const SUBMISSION=/^[A-Za-z0-9._:-]{8,128}$/;
const PUBLIC_STATUS=new Set([
  'received','reviewing','awaiting_approval','in_production',
  'ready_pickup','on_hold','cancelled','completed',
]);
const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff',
  // Shopify account extensions run in a sandboxed Worker with null origin.
  // CORS is not authentication; the Bearer JWT is verified server-side.
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'Authorization, Content-Type',
};
function reply(status,body) {
  return new Response(JSON.stringify(body),{status,headers:HEADERS});
}
function failure(status,code) {
  return reply(status,{version:1,operation:'custom_order.account.list.result',
    ok:false,error:{code}});
}
function safeText(x,limit) {
  if(typeof x!=='string'||x.length>limit)throw Error('Bad public projection text.');
  return x;
}
function safeDate(x) {
  if(typeof x!=='string'||x.length>40||!/^\d{4}-\d{2}-\d{2}T/.test(x)||
     !Number.isFinite(Date.parse(x)))throw Error('Bad public projection date.');
  return x;
}
function publicOrderSummary(value) {
  if(value===undefined)return {items:[],date_needed:'',fulfillment:''};
  if(!value||typeof value!=='object'||Array.isArray(value)||
     !Array.isArray(value.items)||value.items.length>20||
     typeof value.date_needed!=='string'||
     (value.date_needed!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(value.date_needed))||
     !['','pickup','shipping'].includes(value.fulfillment))
    throw Error('Invalid public Custom Order summary.');
  const items=value.items.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item)||
       typeof item.title!=='string'||item.title.trim()!==item.title||
       !item.title||item.title.length>120||
       !Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>999)
      throw Error('Invalid public Custom Order item.');
    return {title:item.title,quantity:item.quantity};
  });
  return {items,date_needed:value.date_needed,fulfillment:value.fulfillment};
}

export function onlyPublicCustomOrderProjection(orders) {
  if(!Array.isArray(orders)||orders.length>20)throw Error('Invalid public order list.');
  const seen=new Set();
  return orders.map(item=>{
    const thread=item?.timeline_version===2;
    if(!item||typeof item!=='object'||Array.isArray(item)||
       !SUBMISSION.test(item.submission_id)||seen.has(item.submission_id)||
       !Number.isSafeInteger(item.revision)||item.revision<1||
       item.revision>100||!PUBLIC_STATUS.has(item.status)||
       !Array.isArray(item.timeline)||item.timeline.length<1||
       (thread?item.timeline.length>item.revision:item.timeline.length!==item.revision)||
       item.timeline.length>100)throw Error('Invalid public order projection.');
    seen.add(item.submission_id);
    let previous=0;
    const timeline=item.timeline.map((event)=>{
      if(!event||typeof event!=='object'||Array.isArray(event)||
         !PUBLIC_STATUS.has(event.status))throw Error('Invalid public timeline event.');
      if(thread){
        if(!Number.isSafeInteger(event.revision)||event.revision<=previous||
          event.revision>item.revision||
          !['status','merchant_message','customer_reply'].includes(event.kind)||
          !['system','jill','customer'].includes(event.author)||
          ((event.kind==='customer_reply')!==(event.author==='customer')))
          throw Error('Invalid public thread event.');
        previous=event.revision;
      }
      return {
        ...(thread?{revision:event.revision,kind:event.kind,author:event.author}:{}),
        status:event.status,
        note:safeText(event.note,500),
        occurred_at:safeDate(event.occurred_at),
      };
    });
    if(timeline.at(-1)?.status!==item.status ||
       timeline.at(-1)?.occurred_at!==item.updated_at)
      throw Error('Inconsistent public order timeline.');
    // Deliberately whitelist values even if upstream unexpectedly adds
    // internal_note, evidence_ref, actor, email or merchant data.
    return {
      ...(thread?{timeline_version:2}:{}),
      submission_id:item.submission_id,
      summary:publicOrderSummary(item.summary),
      revision:item.revision,
      status:item.status,
      updated_at:safeDate(item.updated_at),
      timeline,
    };
  });
}

export async function handleWorkCustomOrderAccountRead(request,{
  shopifyAppSecret,googleGatewaySecret,googleQaEndpoint,
  rateLimit,backendFetch=fetch,now=Date.now,conversationEnabled=false,
}={}) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
  if(request.method!=='POST')return failure(405,'method_not_allowed');
  if(typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32||
     typeof googleGatewaySecret!=='string'||googleGatewaySecret.length<32||
     shopifyAppSecret===googleGatewaySecret||
     !BACKEND.test(googleQaEndpoint||'')||
     typeof rateLimit!=='function'||typeof backendFetch!=='function'||
     typeof now!=='function')return failure(503,'account_service_unavailable');
  // Do not buffer an arbitrary public POST body while checking identity.
  // This endpoint has no caller-selectable IDs, pagination or filters.
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^[0-9]{1,9}$/.test(length)||Number(length)>0))
    return failure(400,'invalid_request');
  const authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer ')||authorization.length>8300)
    return failure(401,'unauthenticated_account');
  let identity;
  try {
    identity=verifyWorkCustomerAccountSession(authorization.slice(7),{
      appSecret:shopifyAppSecret,now,
    });
  } catch {
    return failure(401,'unauthenticated_account');
  }
  // Verify the session first, then reject any nonempty body WITHOUT
  // allocating it; one stream read is enough to detect injected filters.
  if(!await hasEmptyHttpBody(request))return failure(400,'invalid_request');
  let permitted;
  try {permitted=await rateLimit({shop:identity.shop,customer:identity.customerGid});}
  catch {return failure(503,'rate_limit_unavailable');}
  if(permitted!==true)return failure(429,'rate_limited');
  // Google has NO public customer listing. The only accepted backend
  // operation is signed by the separate private gateway HMAC secret.
  const timestamp=String(now());
  const id='jill:account-orders';
  const payload=new URLSearchParams({
    jill_order_customer_list:'1',
    submission_id:id,
    jill_order_owner_gid:identity.customerGid,
    jill_order_gateway_ts:timestamp,
  });
  payload.set('jill_order_gateway_sig',receiptSignature({
    action:'customer_list',id,timestamp,rawPayload:identity.customerGid,
    secret:googleGatewaySecret,
  }));
  let result;
  try {
    result=await readBackendResult(backendFetch,googleQaEndpoint,payload,131072);
    if(result?.version!==1||
       result?.operation!=='custom_order.account.list.result'||
       result?.ok!==true)throw Error('Unverified Google account projection.');
    const orders=onlyPublicCustomOrderProjection(result.orders);
    return reply(200,{version:1,operation:'custom_order.account.list.result',
      ok:true,orders,
      // Only this verified WORK Worker runtime may declare capability.
      // Ignore untrusted Google payload flags and fail closed by default.
      reply_enabled:conversationEnabled===true});
  } catch {
    // A backend failure must never show cached requests from another user.
    return failure(503,'account_status_unavailable');
  }
}
