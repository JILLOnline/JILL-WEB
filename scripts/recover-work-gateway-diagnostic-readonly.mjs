// Resume the already uploaded WORK diagnostic version after Wrangler did
// not return a parseable Version URL. No upload, deploy or secret mutation.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CANDIDATE}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {inspectUploaded,MARKER,SOURCE,versionUrlForId,
  certifyVersionHealth}
  from './work-gateway-diagnostic-release-policy.mjs';
import {
  sourceGuard,json,commands,version,allocation,receiptPath,
  ownerKey,verifyGoogle,probe,
} from './probe-work-gateway-connection-owner.mjs';

const stop=code=>{throw Error('work_gateway_recovery_'+code);};
const check=(condition,code)=>{if(!condition)stop(code);};
function receipt(){
  const file=receiptPath();
  check(fs.existsSync(file)&&!fs.lstatSync(file).isSymbolicLink()&&
    fs.statSync(file).size<2048,'one_use_receipt_missing');
  let data;
  try{data=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch{stop('one_use_receipt_invalid');}
  check(data?.operation==='WORK_GATEWAY_DIAGNOSTIC_INACTIVE_ONCE'&&
    data.source===SOURCE&&data.active===CANDIDATE&&
    data.retry_allowed===false&&/^[a-f0-9]{40}$/.test(data.runner||'')&&
    Number.isFinite(Date.parse(data.reserved_at||'')),
    'one_use_receipt_invalid');
  return data;
}
async function versionHealth(url,id){
  const query=new URL(url+'/healthz');
  query.searchParams.set('jill_work_version_probe',randomUUID());
  let result;
  try{result=await fetch(query,{method:'GET',redirect:'manual',
    headers:{Accept:'application/json','Cache-Control':'no-store'},
    signal:AbortSignal.timeout(15000)});}
  catch{stop('version_url_unreachable');}
  let body;
  try{
    const raw=await result.text();
    check(raw.length>0&&raw.length<=512,'health_response_size_invalid');
    body=JSON.parse(raw);
  }catch{stop('health_response_unreadable');}
  certifyVersionHealth({status:result.status,
    mime:(result.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase(),
    body,versionHeader:result.headers.get('x-jill-work-gateway-version'),
    cacheControl:result.headers.get('cache-control'),
    redirect:result.headers.get('location')},id);
}
async function execute(){
  const commit=sourceGuard();
  const spent=receipt();
  allocation();
  const versions=json(commands.versions);
  const arr=Array.isArray(versions)?versions:
    Array.isArray(versions?.versions)?versions.versions:
      Array.isArray(versions?.result)?versions.result:null;
  check(arr&&arr.filter(v=>v?.annotations?.['workers/message']===MARKER)
    .length===1,'uploaded_version_not_unique');
  const id=arr.find(v=>v.annotations?.['workers/message']===MARKER).id;
  check((!spent.version||spent.version===id)&&
    (!spent.url||spent.url===versionUrlForId(id)),
    'receipt_version_mismatch');
  const confirmed=inspectUploaded({versions,active:version(CANDIDATE),
    uploaded:version(id)});
  check(confirmed===id,'uploaded_version_unverified');
  const url=versionUrlForId(id);
  await versionHealth(url,id);
  const secret=ownerKey();
  await verifyGoogle(secret);
  check(sourceGuard()===commit,'source_changed_during_check');
  allocation();
  await probe(url,secret);
  allocation();
  check(inspectUploaded({versions:json(commands.versions),
    active:version(CANDIDATE),uploaded:version(id)})===id,
    'version_changed_during_probe');
  console.log('PASS existing inactive WORK gateway '+id+' signed Google QA nonexistent-receipt check.');
  console.log('PASS active candidate remains 100%, original 0%; no upload, order or secret change.');
}
const called=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(called){
  try{
    check(process.argv.length===2,'arguments_not_allowed');
    await execute();
  }catch(error){
    const msg=String(error?.message||'');
    const safe=/^(work_gateway_recovery_|work_gateway_diagnostic_|work_custom_promotion_|gateway_inactive_policy_)[a-z0-9_]+$/.test(msg)?
      msg:'work_gateway_recovery_unverified';
    console.error('STOP '+safe+'. Do not retry the upload or submit an order.');
    process.exitCode=1;
  }
}
