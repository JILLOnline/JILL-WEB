import {createHmac} from 'node:crypto';

// Portable Shopify App Proxy handler; deploy behind a real Shopify
// authenticate.public.appProxy request verifier. NEVER use this module
// directly on an unauthenticated public HTTP route.
//
// The proxy authenticates a SHOP, not a customer. A guest order receipt
// never proves account ownership; do not expose customer history here.
const MAX_BYTES=256*1024;
const REQUEST_ID=/^[A-Za-z0-9._:-]{8,128}$/;
const STORE=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const BACKEND=/^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/;

export function receiptSignature({action,id,timestamp,rawPayload='',secret,ownerGid=''}) {
  if (!['submit','receipt','customer_list'].includes(action) ||
      !REQUEST_ID.test(String(id)) || !/^[0-9]{13}$/.test(String(timestamp)) ||
      typeof secret!=='string' || secret.length<32) {
    throw new Error('Invalid Custom Order gateway signature input.');
  }
  if(ownerGid && (action!=='submit' ||
      !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(ownerGid))) {
    throw new Error('Invalid signed Custom Order owner.');
  }
  // For authenticated submissions, bind the trusted Shopify customer ID
  // into the Google HMAC. The unowned v1 guest signature is unchanged.
  const signedParts=[action,id,String(timestamp),rawPayload];
  if(ownerGid)signedParts.push(ownerGid);
  return createHmac('sha256',secret)
    .update(signedParts.join('\n'),'utf8').digest('hex');
}

export function validateCustomOrderPayload(formBody) {
  if(typeof formBody!=='string' || Buffer.byteLength(formBody,'utf8')>MAX_BYTES)
    throw new Error('Custom Order payload exceeds the size limit.');
  const params=new URLSearchParams(formBody);
  const unique=new Set();
  for(const [key] of params) {
    if(unique.has(key))throw new Error('Duplicate Custom Order fields are not allowed.');
    unique.add(key);
  }
  if(params.get('source')!=='JILL custom order' ||
      !REQUEST_ID.test(params.get('submission_id')||'') ||
      !params.get('raw_payload') ||
      typeof params.get('email')!=='string') {
    throw new Error('Incomplete Custom Order submission.');
  }
  let raw;
  try {raw=JSON.parse(params.get('raw_payload'));}
  catch {throw new Error('Invalid Custom Order request envelope.');}
  if(!raw || typeof raw!=='object' || Array.isArray(raw) ||
      raw.version!==1 || raw.operation!=='custom_order.submit' ||
      raw.submission_id!==params.get('submission_id') ||
      raw.submitted_at!==params.get('submitted_at') ||
      raw.customer?.email?.toLowerCase()!==params.get('email')?.toLowerCase() ||
      !Array.isArray(raw.items) || raw.items.length===0 ||
      raw.items.length>500) {
    throw new Error('Custom Order request envelope does not match the submission.');
  }
  return {params,id:params.get('submission_id')};
}

const response=(status,body)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff'},
});
const failure=(status,code,retryable=false)=>response(status,{
  version:1,operation:'custom_order.submit.result',ok:false,
  error:{code,message:retryable
    ? 'Your request could not be confirmed. Retry with the same request ID.'
    : 'Your request could not be accepted. Check your details and try again.',
    retryable},
});

async function readBackendResult(backendFetch,url,body) {
  const result=await backendFetch(url,{
    method:'POST',body,
    headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
      'accept':'application/json'},
    redirect:'follow',
    signal:AbortSignal.timeout(20000),
  });
  if(!result || !result.ok)throw new Error('Google backend unavailable.');
  const bytes=await result.text();
  if(bytes.length>8192)throw new Error('Invalid backend response size.');
  try{return JSON.parse(bytes);}
  catch{throw new Error('Backend returned no verified JSON result.');}
}

/**
 * @param {{
 * request: Request,
 * authenticateProxy: (request: Request) => Promise<{shop:string}>,
 * rateLimit: ({shop:string,request:Request}) => Promise<boolean>,
 * allowedOrigins: string[],
 * backendFetch?: typeof fetch,
 * expectedShop:string, appsScriptEndpoint:string, receiptSecret:string,
 * now?:()=>number
 * }} args
 */
export async function handleCustomOrderProxy(args) {
  if(typeof args?.authenticateProxy!=='function' ||
      typeof args?.rateLimit!=='function' ||
      !Array.isArray(args?.allowedOrigins) || !args.allowedOrigins.length ||
      args.allowedOrigins.some(origin=>{
        try {return new URL(origin).origin!==origin || !origin.startsWith('https://');}
        catch{return true;}
      }) ||
      typeof args?.backendFetch!=='function' && args?.backendFetch!==undefined ||
      typeof args?.receiptSecret!=='string' || args.receiptSecret.length<32 ||
      !STORE.test(args.expectedShop||'') ||
      !BACKEND.test(args.appsScriptEndpoint||'')) {
    throw new Error('Custom Order gateway missing secure configuration.');
  }
  const {request,authenticateProxy,expectedShop,appsScriptEndpoint,receiptSecret}=args;
  const backendFetch=args.backendFetch||fetch,now=args.now||Date.now;
  if(request.method!=='POST')return failure(405,'method_not_allowed');
  let auth;
  try {auth=await authenticateProxy(request);}
  catch{return failure(401,'unauthenticated_proxy');}
  if(!auth || auth.shop!==expectedShop)return failure(403,'wrong_shop');
  if(!args.allowedOrigins.includes(request.headers.get('origin')))
    return failure(403,'invalid_origin');
  let permitted=false;
  try {permitted=await args.rateLimit({shop:auth.shop,request});}
  catch{return failure(503,'rate_limit_unavailable',true);}
  if(permitted!==true)return failure(429,'rate_limited',true);
  const size=Number(request.headers.get('content-length')||0);
  if(!Number.isFinite(size)||size<0||size>MAX_BYTES)
    return failure(413,'payload_too_large');
  let submitted;
  try {submitted=validateCustomOrderPayload(await request.text());}
  catch{return failure(400,'invalid_submission');}
  const {params,id}=submitted;
  const timestamp=String(now());
  // Shopify's signed app proxy authenticates the shop and may supply a
  // logged-in customer number. Never use a form customer_id or email as
  // proof of account ownership. The guest/anonymous case remains unowned.
  let ownerGid='';
  if(auth.loggedInCustomerId!==null && auth.loggedInCustomerId!==undefined &&
     auth.loggedInCustomerId!=='') {
    const numeric=String(auth.loggedInCustomerId);
    if(!/^[1-9][0-9]*$/.test(numeric))
      return failure(401,'unauthenticated_proxy');
    ownerGid='gid://shopify/Customer/'+numeric;
  }
  const signed=new URLSearchParams(params);
  if(ownerGid)signed.set('jill_order_owner_gid',ownerGid);
  signed.set('jill_order_gateway_ts',timestamp);
  signed.set('jill_order_gateway_sig',receiptSignature({
    action:'submit',id,timestamp,
    rawPayload:params.get('raw_payload'),secret:receiptSecret,ownerGid,
  }));
  let result;
  try {result=await readBackendResult(backendFetch,appsScriptEndpoint,signed);}
  catch{return failure(503,'receipt_unconfirmed',true);}
  if(result?.operation!=='custom_order.submit.result' ||
      result.ok!==true || result.submission_id!==id ||
      result.status!=='received') {
    if(result?.ok===false && result?.error?.retryable===false)
      return failure(409,'upstream_rejected');
    return failure(503,'receipt_unconfirmed',true);
  }
  const receipt=new URLSearchParams({
    jill_order_receipt:'1',
    submission_id:id,
    jill_order_gateway_ts:String(now()),
  });
  receipt.set('jill_order_gateway_sig',receiptSignature({
    action:'receipt',id,
    timestamp:receipt.get('jill_order_gateway_ts'),
    secret:receiptSecret,
  }));
  let confirmation;
  try {confirmation=await readBackendResult(backendFetch,appsScriptEndpoint,receipt);}
  catch{return failure(503,'receipt_unconfirmed',true);}
  if(confirmation?.operation!=='custom_order.receipt.result' ||
      confirmation.ok!==true || confirmation.submission_id!==id ||
      confirmation.status!=='received' || confirmation.revision!==1) {
    return failure(503,'receipt_unconfirmed',true);
  }
  return response(200,{
    version:1,operation:'custom_order.submit.result',
    ok:true,submission_id:id,duplicate:Boolean(result.duplicate),
    status:'received',verified:true,
  });
}
