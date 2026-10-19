import {createHmac,randomUUID} from 'node:crypto';
import {verifyWorkCustomerAccountSession} from './customer-account-work-session.mjs';
import {readBackendResult} from './custom-order-gateway.mjs';

const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const OP=/^jill:customer:reply:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const BACKEND=/^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/;
const HEADERS={'content-type':'application/json; charset=utf-8',
  'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff',
  'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'Authorization, Content-Type'};
const reply=(status,body)=>new Response(JSON.stringify({version:1,
  operation:'custom_order.account.reply.result',...body}),{status,headers:HEADERS});
const failure=(status,code)=>reply(status,{ok:false,error:{code}});

export function validateCustomerReply(value){
  const keys=['mode','submission_id','operation_id','expected_revision','text'];
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k))||
    !['send','receipt'].includes(value.mode)||!ID.test(value.submission_id)||
    !OP.test(value.operation_id)||!Number.isSafeInteger(value.expected_revision)||
    value.expected_revision<1||value.expected_revision>99||
    typeof value.text!=='string'||!value.text.trim()||value.text.length>500||
    value.text.trim()!==value.text)throw Error('invalid_reply');
  return Object.freeze({...value});
}
export function signCustomerReply({command,customerGid,timestamp,nonce,secret}){
  validateCustomerReply(command);
  if(!/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(customerGid)||
    !/^[0-9]{13}$/.test(String(timestamp))||!UUID.test(nonce)||
    typeof secret!=='string'||secret.length<32)throw Error('invalid_reply_signature');
  return createHmac('sha256',secret).update([
    'customer_reply_v1','jill-work.myshopify.com',customerGid,
    command.submission_id,command.operation_id,String(command.expected_revision),
    String(timestamp),nonce,command.mode,JSON.stringify(command.text),
  ].join('\n'),'utf8').digest('hex');
}
async function boundedJson(request){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')
    throw Error('invalid_reply');
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^\d{1,5}$/.test(length)||Number(length)>4096))
    throw Error('invalid_reply');
  if(!request.body)throw Error('invalid_reply');
  const reader=request.body.getReader();let timer;
  try {
    return await Promise.race([(async()=>{
      const chunks=[];let size=0;
      for(let n=0;n<64;n++){
        const {done,value}=await reader.read();if(done){
          const bytes=new Uint8Array(size);let offset=0;
          for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
          return validateCustomerReply(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
        }
        size+=value.byteLength;if(size>4096)throw Error('invalid_reply');chunks.push(value);
      }
      throw Error('invalid_reply');
    })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('invalid_reply')),2000);})]);
  }finally{clearTimeout(timer);reader.cancel().catch(()=>{});}
}
export async function handleWorkCustomerReply(request,{
  enabled=false,shopifyAppSecret,googleGatewaySecret,googleQaEndpoint,
  rateLimit,backendFetch=fetch,now=Date.now,uuid=randomUUID,
}={}){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
  if(request.method!=='POST')return failure(405,'method_not_allowed');
  let identity;
  try{
    const auth=request.headers.get('authorization')||'';
    if(!auth.startsWith('Bearer ')||auth.length>8300)throw Error();
    identity=verifyWorkCustomerAccountSession(auth.slice(7),{appSecret:shopifyAppSecret,now});
  }catch{return failure(401,'unauthenticated_account');}
  if(enabled!==true)return failure(503,'conversation_not_connected');
  if(typeof googleGatewaySecret!=='string'||googleGatewaySecret.length<32||
    googleGatewaySecret===shopifyAppSecret||!BACKEND.test(googleQaEndpoint||'')||
    typeof rateLimit!=='function')return failure(503,'conversation_not_connected');
  try{if(await rateLimit(identity)!==true)return failure(429,'rate_limited');}
  catch{return failure(503,'conversation_unavailable');}
  let command;
  try{command=await boundedJson(request);}catch{return failure(400,'invalid_reply');}
  const timestamp=String(now()),nonce=uuid();
  const payload=new URLSearchParams({jill_order_customer_reply:'1',
    shop:identity.shop,jill_order_owner_gid:identity.customerGid,
    submission_id:command.submission_id,operation_id:command.operation_id,
    expected_revision:String(command.expected_revision),text:command.text,mode:command.mode,
    jill_order_gateway_ts:timestamp,jill_order_reply_nonce:nonce,
    jill_order_gateway_sig:signCustomerReply({command,customerGid:identity.customerGid,
      timestamp,nonce,secret:googleGatewaySecret})});
  try{
    const result=await readBackendResult(backendFetch,googleQaEndpoint,payload,2048);
    if(result?.version!==1||result.operation!=='custom_order.account.reply.result')throw Error();
    if(result.ok!==true){
      const code=result.error?.code;
      if(code==='stale_revision')return failure(409,code);
      if(code==='receipt_not_found'&&command.mode==='receipt')return failure(404,code);
      if(code==='forbidden')return failure(403,'request_unavailable');
      if(code==='thread_closed'||code==='history_full')return failure(409,code);
      throw Error();
    }
    if(result.submission_id!==command.submission_id||
      result.operation_id!==command.operation_id||
      result.revision!==command.expected_revision+1||typeof result.duplicate!=='boolean')throw Error();
    return reply(200,{ok:true,submission_id:result.submission_id,
      operation_id:result.operation_id,revision:result.revision,duplicate:result.duplicate});
  }catch{return failure(503,'reply_unconfirmed');}
}
