// WORK ONLY — authenticated merchant media readiness boundary, SOURCE ONLY.
// This handler is NOT an upload route. No R2, D1 mutation, customer media,
// private file delivery, Google fetch, presigned link or provider activation.
// Exact Shopify SDK online session + WORK D1 Owner authorization MUST occur
// before reading the request body or the exact signed canonical Google detail.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {chooseWorkOwnerReference} from './work-private-media-intent.mjs';
import {workAppHomeOrigin} from './shopify-host/sdk-config.mjs';

const SHOP='jill-work.myshopify.com';
const PATH='/app/requests/media/inspect';
const MAX_BODY=1024;
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const ITEM=/^[A-Za-z0-9._:-]{1,256}$/;
const HEADERS=Object.freeze({
  'Cache-Control':'private, no-store, max-age=0',
  'X-Content-Type-Options':'nosniff',
  'Content-Type':'application/json; charset=utf-8',
});
function answer(status,code){
  // No reference, object key, customer details or privileged state returned.
  return new Response(JSON.stringify({ok:false,code}),{
    status,headers:HEADERS,
  });
}
const strict=Object.freeze({
  not_found:()=>answer(404,'not_found'),
  denied:()=>answer(403,'access_denied'),
  offline:()=>answer(503,'private_media_not_enabled'),
  noStorage:()=>answer(503,'private_media_storage_not_connected'),
});
async function parseBoundedSelector(request){
  const declared=request.headers.get('content-length');
  if(declared!==null&&(!/^[0-9]{1,4}$/.test(declared)||
     Number(declared)>MAX_BODY))throw Error('invalid_media_input');
  if(!request.body)throw Error('invalid_media_input');
  const reader=request.body.getReader();
  const chunks=[];let length=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw Error('invalid_media_input');
      length+=value.length;
      if(length>MAX_BODY)throw Error('invalid_media_input');
      chunks.push(value);
    }
  }finally{await reader.cancel().catch(()=>{});}
  if(length<1)throw Error('invalid_media_input');
  const bytes=new Uint8Array(length);
  let n=0;
  for(const chunk of chunks){bytes.set(chunk,n);n+=chunk.length;}
  const params=new URLSearchParams(new TextDecoder('utf-8',{
    fatal:true,
  }).decode(bytes));
  const data=Object.create(null);
  for(const [key,value] of params){
    if(!['submission_id','scope','item_id','index'].includes(key)||
       Object.hasOwn(data,key))throw Error('invalid_media_input');
    data[key]=value;
  }
  if(Object.keys(data).length<3||Object.keys(data).length>4||
     !ID.test(data.submission_id||'')||
     !/^(?:[0-9]|1[0-9])$/.test(data.index||''))throw Error('invalid_media_input');
  const index=Number(data.index);
  if(data.scope==='request'){
    if(Object.hasOwn(data,'item_id')||Object.keys(data).length!==3)
      throw Error('invalid_media_input');
    return Object.freeze({
      submissionId:data.submission_id,
      selector:Object.freeze({scope:'request',index}),
    });
  }
  if(data.scope==='item'&&ITEM.test(data.item_id||'')&&
     Object.keys(data).length===4){
    return Object.freeze({
      submissionId:data.submission_id,
      selector:Object.freeze({
        scope:'item',itemId:data.item_id,index,
      }),
    });
  }
  throw Error('invalid_media_input');
}

/**
 * The only prospective merchant media HTTP entry point. Even after a
 * complete authorized preflight it ALWAYS returns storage_not_connected.
 * 'enabled' opens only this no-storage OWNER-INSPECT diagnostic, not uploads.
 * Authenticate must be the real Shopify SDK authenticate.admin(request),
 * never a request-provided role, JWT, session, customer email or ID.
 * readExactDetail must be pinned to the signed WORK Google QA exact-ID reader.
 */
export async function handleWorkPrivateMediaOwnerInspect({
  request,stage,enabled=false,authenticate,db,readExactDetail,
}={}){
  if(request?.method!=='POST')return answer(405,'method_not_allowed');
  let url,expectedOrigin;
  try{
    url=new URL(request.url);
    expectedOrigin=workAppHomeOrigin(stage);
  }catch{return strict.not_found();}
  if(stage!=='canary'||enabled!==true)return strict.offline();
  if(url.origin!==expectedOrigin||url.pathname!==PATH||
     url.search!==''||url.hash!=='')return strict.not_found();
  // Shopify embedded sessions do not replace an exact browser CSRF check.
  // An Origin alone is never considered authentication.
  if(request.headers.get('origin')!==expectedOrigin)
    return answer(403,'invalid_origin');
  if(request.headers.get('content-type')?.split(';',1)[0]?.toLowerCase()!==
     'application/x-www-form-urlencoded')
    return answer(415,'unsupported_media_type');
  if(typeof authenticate!=='function'||typeof readExactDetail!=='function')
    return strict.offline();

  let session;
  try{
    const resolved=await authenticate(request);
    session=resolved?.session;
  }catch{return strict.denied();}
  const permission=await readWorkMerchantPermission({
    db,session,action:'requests.read',
  });
  if(permission.allowed!==true||permission.role!=='owner'||
     typeof permission.staffId!=='string')
    return permission.code==='authority_unavailable'?
      answer(503,'owner_authority_unavailable'):strict.denied();

  // Never read untrusted form/body or Google source before Shopify+D1 Owner.
  let parsed;
  try{parsed=await parseBoundedSelector(request);}
  catch{return answer(400,'invalid_media_input');}
  let detail;
  try{detail=await readExactDetail({submissionId:parsed.submissionId});}
  catch{return answer(503,'verified_request_unavailable');}
  try{
    const selection=chooseWorkOwnerReference({
      detail,submissionId:parsed.submissionId,
      selector:parsed.selector,
    });
    // Legacy public Cloudinary URLs and other external references cannot
    // silently become new private media through the old adapter.
    if(selection.kind!=='opaque_id')return strict.not_found();
  }catch{return strict.not_found();}
  return strict.noStorage();
}

export const WORK_PRIVATE_MEDIA_INSPECT_PATH=PATH;
export const WORK_PRIVATE_MEDIA_INSPECT_BODY_CAP=MAX_BODY;
export const WORK_PRIVATE_MEDIA_INSPECT_SHOP=SHOP;
