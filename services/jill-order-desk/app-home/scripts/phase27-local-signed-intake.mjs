// JILL HQ Phase 27 — isolated LOCAL bridge test executor, NOT a Worker route.
// All D1 calls require fake remote:false local workerd test harness.
// NEVER import into a deployed WORK/LIVE/KEEP handler. Simulates one
// full signed app-proxy -> D1 intake -> signed Google QA gateway flow.
// No provider-authenticated Google/Shopify network or real customer data.
import {createCustomOrderWorkProxyRoute}
  from '../../../../backend/custom-order-work-proxy-route.mjs';
import {verifyShopifyAppProxyRequest}
  from '../../../../backend/shopify-work-app-proxy-auth.mjs';
import {validateCustomOrderPayload}
  from '../../../../backend/custom-order-gateway.mjs';
import {
  planLocalWorkIntakeReserve as reserve,
  inspectLocalWorkIntakeExisting as inspect,
  planLocalWorkIntakeClaimFirstDispatch as claim,
  planLocalWorkIntakeUncertain as uncertain,
  planLocalWorkIntakeSyntheticConfirmation as confirm,
} from '../../work-intake-ledger-plan.mjs';

const SHOP='jill-work.myshopify.com';
const ORIGIN='https://jill-work.myshopify.com';
const FAKE_D1='00000000-0000-4000-8000-000000000019';
const FAKE_BUCKET='jill-phase19-local-synthetic-artwork';
const ERROR_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'private, no-store',
  'x-content-type-options':'nosniff',
};
const error=(status,code)=>new Response(JSON.stringify({
  version:1,operation:'custom_order.submit.result',ok:false,
  error:{code,retryable:status>=500},
}),{status,headers:ERROR_HEADERS});
const fail=()=>{throw Error('phase27_local_bridge_unverified');};
const exact=(x,name)=>typeof x==='string'&&x.length>=32&&
  !x.includes('\u0000')&&x!==name;
async function readBounded(request){
  if(!request.body)fail();
  const rawLength=request.headers.get('content-length');
  if(rawLength!==null && (!/^[0-9]{1,6}$/.test(rawLength)||
     Number(rawLength)>256*1024))fail();
  const reader=request.body.getReader();
  const buffers=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))fail();
      size+=value.byteLength;
      if(size>256*1024)fail();
      buffers.push(value);
    }
  }finally{await reader.cancel().catch(()=>{});}
  const out=new Uint8Array(size);let at=0;
  for(const part of buffers){out.set(part,at);at+=part.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(out);
}
function configReady(o){
  if(!o||o.environment?.marker!=='phase27-synthetic-local-only'||
     o.environment?.database_id!==FAKE_D1||
     o.environment?.bucket_name!==FAKE_BUCKET||
     o.environment?.remote!==false||
     o.environment?.name!=='jill-work-phase19-local-media-only'||
     !o.db||typeof o.db.prepare!=='function'||
     !exact(o.shopifyAppSecret,'')||
     !exact(o.googleGatewaySecret,o.shopifyAppSecret)||
     !exact(o.macKey,o.shopifyAppSecret)||
     o.macKey===o.googleGatewaySecret||
     !/^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/.test(o.googleQaEndpoint||'')||
     typeof o.backendFetch!=='function'||
     typeof o.rateLimit!=='function'||
     typeof o.now!=='function')fail();
}
async function apply(db,p){
  const r=await db.prepare(p.sql).bind(...p.params).all();
  if(!r||r.success!==true||!Array.isArray(r.results))fail();
  return r.results;
}
async function read(db,p){
  return db.prepare(p.lookupSql).bind(...p.lookupParams).first();
}
/**
 * This is a local test coordinator; it does not make any promises
 * about production availability, concurrency or billing.
 * Even a 200 is only a local synthetic gateway test response.
 */
export async function handlePhase27LocalSignedIntake(request,options){
  configReady(options);
  if(!(request instanceof Request)||request.method!=='POST')
    return error(405,'method_not_allowed');
  if(request.headers.get('origin')!==ORIGIN)
    return error(403,'invalid_origin');
  let auth;
  try{
    auth=verifyShopifyAppProxyRequest(request,{
      appSecret:options.shopifyAppSecret,expectedShop:SHOP,now:options.now,
    });
  }catch{return error(401,'unauthenticated_proxy');}
  if(auth?.shop!==SHOP)return error(403,'wrong_shop');

  let source,parsed;
  try{
    source=await readBounded(request);
    parsed=validateCustomOrderPayload(source);
  }catch{return error(400,'invalid_submission');}
  let ownerGid='';
  if(auth.loggedInCustomerId!==null &&
     auth.loggedInCustomerId!==undefined&&auth.loggedInCustomerId!==''){
    const id=String(auth.loggedInCustomerId);
    if(!/^[1-9][0-9]*$/.test(id))
      return error(401,'unauthenticated_proxy');
    ownerGid='gid://shopify/Customer/'+id;
  }
  const issued=options.now();
  if(!Number.isSafeInteger(issued)||issued<=0)fail();
  let p;
  try{
    p=reserve({
      shop:SHOP,submissionId:parsed.id,formBody:source,
      ownerGid,macKey:options.macKey,nowMs:issued,
    });
  }catch{return error(400,'invalid_submission');}
  let result,row;
  try{
    result=await apply(options.db,p);
    if(result.length===0){
      row=await read(options.db,p);
      const existing=inspect({plan:p,row});
      if(existing.kind==='payload_or_owner_conflict')
        return error(409,'request_id_conflict');
      // Matching previous request must NOT be re-forwarded.
      // Even a confirmed ledger row needs Google signed readback
      // before a customer receipt may be returned.
      return error(503,'independent_receipt_reconciliation_required');
    }
    if(result.length!==1||result[0].state!=='reserved')fail();
  }catch{return error(503,'intake_reservation_unconfirmed');}

  const details=(previous,nowMs)=>({
    shop:SHOP,submissionId:parsed.id,
    payloadMac:p.identity_mac,ownerMac:p.owner_mac,
    priorUpdatedAtMs:previous,nowMs,
  });
  const claimedAt=issued+1;
  try{
    result=await apply(options.db,
      claim(details(issued,claimedAt)));
    if(result.length!==1||result[0].state!=='forwarding'||
       result[0].dispatch_attempts!==1)fail();
  }catch{return error(503,'dispatch_claim_unconfirmed');}

  // Gateway uses the SAME signed Shopify input and existing two-stage
  // Google QA receipt rule. Never ack from the D1 reservation alone.
  let backendOutcome;
  try{
    const gateway=createCustomOrderWorkProxyRoute({
      shopifyAppSecret:options.shopifyAppSecret,
      googleGatewaySecret:options.googleGatewaySecret,
      googleQaEndpoint:options.googleQaEndpoint,
      backendFetch:options.backendFetch,
      rateLimit:options.rateLimit,
      now:options.now,
    });
    const forwarded=new Request(request.url,{
      method:'POST',headers:new Headers(request.headers),
      body:source,
    });
    backendOutcome=await gateway(forwarded);
    if(!(backendOutcome instanceof Response))fail();
  }catch{backendOutcome=error(503,'upstream_unconfirmed');}
  let verified=false;
  if(backendOutcome.status===200){
    try{
      const body=await backendOutcome.clone().json();
      verified=body?.operation==='custom_order.submit.result'&&
        body?.ok===true&&body?.verified===true&&
        body?.submission_id===parsed.id&&body?.status==='received';
    }catch{/* Fail closed */ }
  }
  const finishedAt=issued+2;
  try{
    const next=verified?
      confirm({input:details(claimedAt,finishedAt),
        from:'forwarding',evidenceMarker:'synthetic_local_only_google_receipt'}):
      uncertain(details(claimedAt,finishedAt));
    result=await apply(options.db,next);
    if(result.length!==1||result[0].state!==
       (verified?'confirmed':'ambiguous'))fail();
  }catch{return error(503,'intake_final_state_unconfirmed');}
  if(!verified)return error(503,'upstream_receipt_unconfirmed');
  return backendOutcome;
}
