// JILL WORK custom order gateway HMAC diagnostic: no submission, D1,
// Cloudflare deployment, secret change, customer read or Shopify operation.
// Sends ONE signed receipt lookup for a fresh nonexistent QA id to the
// pinned isolated Google WORK QA /exec. Never prints secret, HMAC or body.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {verifyLocalWorkQaIdentity,auditWorkQaReadOnly}
  from './audit-work-qa-script-readonly.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';
import {receiptSignature}
  from '../backend/custom-order-gateway.mjs';
import {inspectWorkGatewayRemote}
  from './inspect-work-custom-order-gateway-bindings.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SECTION='[WORK.GOOGLE_CUSTOM_ORDERS_QA]';
const LABEL='JILL_CUSTOM_ORDER_GATEWAY_SECRET';
const MAX_REPLY=2048;
const stop=reason=>{throw Error('work_gateway_diagnosis_'+reason);};
const expect=(v,why)=>{if(!v)stop(why);};
export function readVerifiedWorkGatewayKey(content){
  expect(typeof content==='string'&&content.length<200000,
    'private_catalog_invalid');
  const lines=content.split(/\r?\n/);
  const sections=lines.flatMap((s,i)=>s.trim()===SECTION?[i]:[]);
  expect(sections.length===1,'verified_work_section_missing_or_duplicate');
  const start=sections[0];
  let end=lines.length;
  for(let i=start+1;i<lines.length;i++){
    if(/^\[[A-Za-z0-9._-]+\]$/.test(lines[i].trim())){
      end=i;break;
    }
  }
  const fields=lines.slice(start+1,end)
    .filter(x=>x.startsWith(LABEL+'='));
  expect(fields.length===1,'verified_work_gateway_key_missing_or_duplicate');
  const value=fields[0].slice(LABEL.length+1);
  expect(value.length>=32&&value.length<=256&&
    /^[\x21-\x7e]+$/.test(value),'verified_work_gateway_key_invalid');
  return value;
}
export function makeFakeSignedReceipt({secret,now=Date.now,
  uuid=randomUUID}={}){
  expect(typeof secret==='string'&&secret.length>=32,
    'gateway_secret_invalid');
  const id='jill:qa-gateway-diagnostic:'+uuid();
  expect(/^jill:qa-gateway-diagnostic:[a-f0-9-]{36}$/.test(id),
    'probe_id_invalid');
  const timestamp=String(now());
  expect(/^[0-9]{13}$/.test(timestamp),'probe_timestamp_invalid');
  return new URLSearchParams({
    jill_order_receipt:'1',submission_id:id,
    jill_order_gateway_ts:timestamp,
    jill_order_gateway_sig:receiptSignature({
      action:'receipt',id,timestamp,secret,
    }),
  });
}
export async function checkIsolatedQaGatewaySecret({
  secret,backendFetch=fetch,now=Date.now,uuid=randomUUID,
}={}){
  expect(typeof backendFetch==='function',
    'transport_invalid');
  const body=makeFakeSignedReceipt({secret,now,uuid});
  let response;
  try{
    response=await backendFetch(JILL_HQ_WORK_QA_GOOGLE_URL,{
      method:'POST',redirect:'follow',
      headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
        accept:'application/json'},
      body,signal:AbortSignal.timeout(15000),
    });
  }catch{stop('google_qa_unreachable');}
  expect(response?.ok===true,'google_qa_unavailable');
  const indicated=Number(response.headers?.get('content-length')||'0');
  expect(Number.isFinite(indicated)&&indicated<=MAX_REPLY,
    'google_response_unverifiable');
  let raw;
  try{raw=await response.text();}
  catch{stop('google_response_unreadable');}
  expect(raw.length<=MAX_REPLY,'google_response_oversized');
  let reply;
  try{reply=JSON.parse(raw);}
  catch{stop('google_response_unrecognized');}
  expect(reply?.version===1&&
    reply.operation==='custom_order.receipt.result'&&
    reply.ok===false&&typeof reply.error?.code==='string',
    'google_response_unrecognized');
  if(reply.error.code==='receipt_not_found'&&
     reply.error.retryable===true)
    return Object.freeze({googleQaSigningKeyMatches:true,
      syntheticRequestCreated:false,noExistingReceiptRead:true,
      cloudflareKeyCompared:false});
  if(reply.error.code==='unauthorized_receipt'&&
     reply.error.retryable===false)
    return Object.freeze({googleQaSigningKeyMatches:false,
      syntheticRequestCreated:false,noExistingReceiptRead:true,
      cloudflareKeyCompared:false});
  stop('unexpected_google_qa_receipt_result');
}
function checkedGit(){
  const git=(...a)=>{
    try{return execFileSync('git',['-C',ROOT,...a],{
      encoding:'utf8',timeout:15000,maxBuffer:4096,
      windowsHide:true,
    }).trim();}
    catch{stop('git_unverifiable');}
  };
  expect(process.platform==='win32','owner_windows_only');
  expect(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'work_branch_not_synced');
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    expect(process.argv.length===2,'arguments_not_allowed');
    checkedGit();
    verifyLocalWorkQaIdentity(ROOT);
    // Certify published sandbox build before even a read-only receipt check.
    const audit=await auditWorkQaReadOnly({root:ROOT});
    expect(audit.publishedRevisionVerified===true&&
      audit.deploymentFound===true&&
      /^[a-f0-9]{64}$/.test(audit.publishedDigest),
      'published_google_qa_not_verified');
    const cloud=inspectWorkGatewayRemote();
    console.log('PASS WORK Cloudflare Custom Order gateway secret binding names.');
    if(cloud.backend_url_verified)
      console.log('PASS WORK gateway targets the certified isolated Google QA endpoint.');
    else
      console.log('HOLD WORK gateway upstream URL stored as a secret; destination cannot be read back.');
    const {full,folder}=localFilePath({repo:ROOT});
    expect(fs.existsSync(full)&&!fs.lstatSync(full).isSymbolicLink()&&
      !fs.lstatSync(folder).isSymbolicLink(),
      'private_catalog_missing');
    const key=readVerifiedWorkGatewayKey(fs.readFileSync(full,'utf8'));
    const result=await checkIsolatedQaGatewaySecret({secret:key});
    console.log('PASS isolated published WORK Google QA sandbox identity.');
    if(result.googleQaSigningKeyMatches)
      console.log('PASS local verified WORK gateway key matches Google QA.');
    else{
      console.error('STOP local verified WORK gateway key does NOT match Google QA Script Property.');
      process.exitCode=1;
    }
    console.log('NOTE Cloudflare Worker secret VALUE cannot be read or compared with this Google-only proof.');
    console.log('NO submission created, no existing order read, no D1/Google/Cloudflare/Shopify writes, no emails or traffic changes.');
  }catch(err){
    const name=String(err?.message||'');
    const safe=/^work_gateway_diagnosis_[a-z0-9_]+$/.test(name)?
      name:'work_gateway_diagnosis_unverified';
    console.error('STOP WORK gateway secret diagnostic: '+safe);
    console.error('DO NOT resubmit the Custom Order until gateway signing is independently verified.');
    process.exitCode=1;
  }
}
