// Exact Google WORK QA detail v9 — READ-ONLY HMAC negative/positive proof.
// It sends a deliberately NONEXISTENT request ID. No real customer
// payload is RETURNED by the endpoint; Google may scan QA intake rows.
// No event, mail, private key or production shop is modified.
// The endpoint is obtained from the certified isolated clasp deployment
// listing. Never take URL, raw HMAC key or submission ID from CLI arguments.
import fs from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {verifyLocalWorkQaIdentity}
  from './audit-work-qa-script-readonly.mjs';
import {reconcileWorkQaDetailRemote}
  from './reconcile-work-hq-qa-detail-deployment.mjs';
import {signWorkMerchantDetail}
  from '../services/jill-order-desk/work-google-merchant-detail.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SHOP='jill-work.myshopify.com';
const LABEL='JILL_HQ_MERCHANT_READ_SECRET';
const SECTION='[WORK.GOOGLE_CUSTOM_ORDERS_QA]';
const EXPECTED_VERSION=9;
const MAX_ACK_BYTES=4096;
const ID=/^AKfycb[A-Za-z0-9_-]{20,}$/;
const MISSING_ID=/^jill:hq:detail-diagnostic:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function stop(code){throw Error(code);}

export function privateQaMerchantReadKey(content){
  if(typeof content!=='string'||content.length>200000)
    stop('invalid_private_catalog');
  const sections=content.split(/\r?\n/);
  const positions=sections.flatMap((v,i)=>v.trim()===SECTION?[i]:[]);
  if(positions.length!==1)stop('missing_or_duplicate_private_qa_section');
  const start=positions[0];
  let end=sections.length;
  for(let i=start+1;i<sections.length;i++){
    if(/^\[[A-Za-z0-9._-]+\]$/.test(sections[i].trim())){
      end=i;break;
    }
  }
  const matches=sections.slice(start+1,end)
    .filter(line=>line.startsWith(LABEL+'='));
  if(matches.length!==1)stop('missing_or_duplicate_private_read_key');
  const secret=matches[0].slice(LABEL.length+1).trim();
  if(!/^[\x21-\x7E]{32,256}$/.test(secret))
    stop('invalid_private_qa_read_key');
  return secret;
}
export function detailProbeEndpoint(deploymentId,version){
  if(!ID.test(deploymentId||'') || version!==EXPECTED_VERSION)
    stop('uncertified_qa_detail_deployment');
  return 'https://script.google.com/macros/s/'+deploymentId+'/exec';
}
export function signedMissingDetailBody({
  secret,submissionId,timestamp,nonce,
}={}){
  if(!MISSING_ID.test(submissionId||''))stop('invalid_diagnostic_id');
  const signature=signWorkMerchantDetail({
    secret,submissionId,timestamp,nonce,
  });
  return new URLSearchParams({
    jill_order_merchant_detail:'1',shop:SHOP,submission_id:submissionId,
    jill_hq_read_ts:String(timestamp),
    jill_hq_read_nonce:nonce,jill_hq_read_sig:signature,
  });
}
async function boundedJson(response){
  if(!response?.ok)stop('detail_qa_http_unavailable');
  const reported=Number(response.headers?.get('content-length')||'0');
  if(!Number.isFinite(reported)||reported>MAX_ACK_BYTES)
    stop('invalid_detail_qa_ack');
  const reader=response.body?.getReader();
  if(!reader)stop('invalid_detail_qa_ack');
  let bytes=0;
  const chunks=[];
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>MAX_ACK_BYTES)stop('invalid_detail_qa_ack');
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const buffer=new Uint8Array(bytes);
  let offset=0;
  for(const part of chunks){buffer.set(part,offset);offset+=part.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(buffer));}
  catch{stop('invalid_detail_qa_ack');}
}
export async function probeIsolatedWorkQaDetail({
  deploymentId,version=EXPECTED_VERSION,secret,
  backendFetch=fetch,
  createId=()=> 'jill:hq:detail-diagnostic:'+randomUUID(),
  now=Date.now,
  makeNonce=()=>randomBytes(24).toString('base64url'),
  wrongSecret=()=>randomBytes(48).toString('base64url'),
}={}){
  const endpoint=detailProbeEndpoint(deploymentId,version);
  if(typeof backendFetch!=='function'||typeof now!=='function'||
     typeof makeNonce!=='function'||typeof wrongSecret!=='function'||
     typeof createId!=='function'||typeof secret!=='string'||secret.length<32)
    stop('invalid_probe_preflight');
  const submissionId=createId();
  if(!MISSING_ID.test(submissionId))stop('invalid_diagnostic_id');
  const negativeKey=wrongSecret();
  if(typeof negativeKey!=='string'||negativeKey===secret ||
     negativeKey.length<32)stop('invalid_negative_control');
  const send=async secretValue=>{
    const timestamp=String(now()),nonce=makeNonce();
    const body=signedMissingDetailBody({
      secret:secretValue,submissionId,timestamp,nonce,
    });
    const answer=await backendFetch(endpoint,{
      method:'POST',redirect:'follow',
      headers:{
        'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
        accept:'application/json',
      },
      body,signal:AbortSignal.timeout(15000),
    });
    const ack=await boundedJson(answer);
    if(ack?.version!==1||
       ack.operation!=='custom_order.merchant.detail.source.result' ||
       ack.ok!==false||ack.error?.retryable!==false ||
       typeof ack.error.code!=='string')
      stop('invalid_detail_qa_ack');
    return ack.error.code;
  };
  // Wrong HMAC must be rejected before accessing even an absent request.
  if(await send(negativeKey)!=='unauthorized')
    stop('bad_detail_hmac_not_denied');
  // Valid HMAC + a generated absent ID MUST reach not_found, proving the
  // v9 code recognized the secret and the exact-ID authorization contract.
  if(await send(secret)!=='not_found')
    stop('detail_hmac_or_route_not_verified');
  return Object.freeze({
    verified:true,version,negativeDenied:true,existingRecordsReturned:0,
    customerDetailsExposed:0,mutations:0,
  });
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],
    {encoding:'utf8'}).trim();
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try {
    if(process.argv.length!==2 ||
       git('branch','--show-current')!=='jill/rewards-work' ||
       git('rev-parse','HEAD')!==
         git('rev-parse','refs/remotes/origin/jill/rewards-work') ||
       git('status','--porcelain','--untracked-files=no'))
      stop('work_source_not_synced');
    verifyLocalWorkQaIdentity(ROOT);
    const deployed=await reconcileWorkQaDetailRemote({root:ROOT});
    if(deployed.state!=='present_unprobed'||
       deployed.version!==EXPECTED_VERSION)
      stop('uncertified_qa_detail_deployment');
    console.log('PASS isolated WORK QA project and v7/v8 original deployments intact.');
    console.log('PASS separate exact-request detail deployment @9 found.');
    const {full,folder}=localFilePath({repo:ROOT});
    if(!fs.existsSync(full)||!fs.existsSync(folder)||
       fs.lstatSync(full).isSymbolicLink()||
       fs.lstatSync(folder).isSymbolicLink())
      stop('missing_local_private_vault');
    let secret=privateQaMerchantReadKey(fs.readFileSync(full,'utf8'));
    try{
      await probeIsolatedWorkQaDetail({
        deploymentId:deployed.deploymentId,
        version:deployed.version,secret,
      });
    }finally{secret=undefined;}
    console.log('PASS wrong HMAC denied; dedicated WORK QA read HMAC accepted.');
    console.log('PASS random NONEXISTENT request returns not_found; no real request payload returned.');
    console.log('PASS WORK exact-detail v9 read-only signed source READY for distinct Worker pinning.');
    console.log('No Google deployment, customer records, status, mail, Cloudflare, LIVE or Rewards changes.');
  } catch(e){
    const known=new Set([
      'work_source_not_synced','uncertified_qa_detail_deployment',
      'invalid_private_catalog','missing_or_duplicate_private_qa_section',
      'missing_or_duplicate_private_read_key',
      'invalid_private_qa_read_key','missing_local_private_vault',
      'invalid_diagnostic_id','invalid_negative_control',
      'invalid_probe_preflight','detail_qa_http_unavailable',
      'invalid_detail_qa_ack','bad_detail_hmac_not_denied',
      'detail_hmac_or_route_not_verified',
    ]);
    console.error('WORK QA exact-detail signed proof STOPPED: '+
      (known.has(e?.message)?e.message:'qa_transport_or_identity_unverified'));
    process.exitCode=1;
  }
}
