// Phase 36 — anonymous PUBLIC v34 browser asset sample, read-only.
// Shows only bounded counts and aggregate hashes: never prints HTML/JS/CSS,
// credentials, customers, full remote metadata or source code.
// IMPORTANT: static URLs can be served from an independent asset store.
// Even sample equality does NOT prove all v34 browser assets, uploaded
// build commit, Worker binary, or source provenance.
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {lstatSync,readFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {workLiveAuditReadArgs} from './audit-work-hq-detail-v9-live.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const WRANGLER=join(APP,'node_modules/wrangler/bin/wrangler.js');
const CLIENT=join(APP,'dist/client');
const ORIGIN='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const VERSION='4973b74d-d479-41da-897c-e36129303279';
const MAX_ASSETS=8;
const MAX_HTML=512*1024;
const MAX_ASSET=2*1024*1024;
const STOP=code=>{throw Error('work_hq_phase36_public_assets_'+code);};
const SHA=data=>createHash('sha256').update(data).digest('hex');

// Deliberately narrow: only Vite same-origin /assets/<basename>.js|css
// found in quoted HTML src/href attributes. No URL resolution, query
// strings, wildcard or externally hosted URLs.
export function extractWorkPublicAssetPaths(html){
  if(typeof html!=='string'||Buffer.byteLength(html,'utf8')>MAX_HTML)
    STOP('invalid_login_html');
  const found=new Set();
  const re=/(?:\s|<)(?:src|href)\s*=\s*["'](\/assets\/[A-Za-z0-9_.-]+\.(?:js|css))["']/g;
  let m;
  while((m=re.exec(html))!==null){
    const p=m[1],name=p.slice('/assets/'.length);
    if(name.startsWith('.')||name.includes('..')||
       p.includes('\\')||p.includes('//'))STOP('unsafe_asset_path');
    found.add(p);
    if(found.size>MAX_ASSETS)STOP('too_many_assets');
  }
  return Object.freeze([...found].sort());
}
export function compareWorkPublicAssets({paths,remote,readLocal}={}){
  if(!Array.isArray(paths)||paths.length===0||
     paths.length>MAX_ASSETS||typeof readLocal!=='function'||
     !(remote instanceof Map)||
     paths.some(p=>typeof p!=='string'||!
       /^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(p)||
       p.includes('..')||p.startsWith('/assets/.'))||
     new Set(paths).size!==paths.length||
     remote.size!==paths.length)
    STOP('invalid_census_input');
  const publicHash=createHash('sha256');
  const localHash=createHash('sha256');
  let matching=0,different=0,missing=0,total=0;
  for(const path of paths){
    const bytes=remote.get(path);
    if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>MAX_ASSET)
      STOP('invalid_public_asset_bytes');
    total+=bytes.length;
    const hash=SHA(bytes);
    publicHash.update(path+'\0'+bytes.length+'\0'+hash+'\n');
    const local=readLocal(path);
    if(local===null){
      missing++;
      localHash.update(path+'\0MISSING\n');
    }else{
      if(!Buffer.isBuffer(local)||local.length===0||
         local.length>MAX_ASSET)STOP('invalid_local_asset_bytes');
      const digest=SHA(local);
      localHash.update(path+'\0'+local.length+'\0'+digest+'\n');
      if(hash===digest && bytes.length===local.length)matching++;
      else different++;
    }
  }
  return Object.freeze({
    state:'public_anonymous_v34_asset_sample_only',
    public_assets_observed:paths.length,
    matched_local_candidate:matching,different_local_candidate:different,
    missing_local_candidate:missing,
    public_bytes_observed:total,
    public_sample_inventory_sha256:publicHash.digest('hex'),
    local_sample_inventory_sha256:localHash.digest('hex'),
    deployed_worker_binary_verified:false,
    v34_all_browser_assets_verified:false,
    v34_source_commit_verified:false,
    version_upload_authorized:false,
    status_mutation_authorized:false,
    remote_d1_r2_write_authorized:false,
  });
}
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:4096,
  }).trim();}
  catch{STOP('git_unavailable');}
}
function cleanWorkCheckout(){
  if(git('branch','--show-current')!=='jill/rewards-work'||
     git('rev-parse','HEAD')!==
       git('rev-parse','refs/remotes/origin/jill/rewards-work')||
     git('status','--porcelain','--untracked-files=no'))
    STOP('work_checkout_not_synced');
  if(!existsSync(CLIENT)||lstatSync(CLIENT).isSymbolicLink()||
     !lstatSync(CLIENT).isDirectory())STOP('local_client_build_missing');
}
function activeVersion(){
  if(!existsSync(WRANGLER))STOP('wrangler_not_found');
  const args=workLiveAuditReadArgs('deployment_status');
  const p=spawnSync(process.execPath,[WRANGLER,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    timeout:35000,maxBuffer:128*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  if(p.error||p.signal||p.status!==0)
    STOP('cloudflare_metadata_unverified');
  let version;
  try{version=currentWorkerVersion(p.stdout);}
  catch{STOP('cloudflare_metadata_unverified');}
  if(version!==VERSION)STOP('active_version_drift');
  return version;
}
async function boundedGet(url,max,mime){
  const response=await fetch(url,{
    method:'GET',redirect:'manual',
    headers:{accept:mime==='html'?'text/html':'*/*'},
    signal:AbortSignal.timeout(18000),
  });
  if(response.status!==200||response.url!==url||
     response.headers.get('location'))
    STOP('public_asset_http_drift');
  const type=response.headers.get('content-type')||'';
  if(mime==='html'&&!/^text\/html(?:\s*;|$)/i.test(type))
    STOP('unexpected_login_content_type');
  if(mime==='asset'&&!/javascript|css|octet-stream/i.test(type))
    STOP('unexpected_asset_content_type');
  const len=response.headers.get('content-length');
  if(len!==null&&(!/^\d+$/.test(len)||Number(len)>max))
    STOP('public_asset_too_large');
  if(!response.body)STOP('public_asset_unavailable');
  const chunks=[];
  let total=0;const reader=response.body.getReader();
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>max)STOP('public_asset_too_large');
      chunks.push(Buffer.from(value));
    }
  }finally{reader.releaseLock();}
  if(total===0)STOP('public_asset_empty');
  return Buffer.concat(chunks,total);
}
function localRead(path){
  const filename=path.slice('/assets/'.length);
  const p=join(CLIENT,'assets',filename);
  if(!existsSync(p))return null;
  const info=lstatSync(p);
  if(info.isSymbolicLink()||!info.isFile()||info.size===0||
     info.size>MAX_ASSET)STOP('local_asset_file_unsafe');
  return readFileSync(p);
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='arguments';
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      STOP('readonly_inspect_only');
    phase='synced_work_checkout';
    cleanWorkCheckout();
    phase='pinned_v34_deployment_before';
    activeVersion();
    phase='anonymous_public_html';
    const login=await boundedGet(ORIGIN+'/auth/login',MAX_HTML,'html');
    const paths=extractWorkPublicAssetPaths(login.toString('utf8'));
    if(paths.length===0)STOP('no_public_asset_references');
    phase='anonymous_public_assets';
    const remote=new Map();
    for(const path of paths)
      remote.set(path,await boundedGet(ORIGIN+path,MAX_ASSET,'asset'));
    phase='pinned_v34_deployment_after';
    activeVersion(); // Refuse version drift during the public sample.
    phase='local_sample_comparison';
    const result=compareWorkPublicAssets({paths,remote,readLocal:localRead});
    console.log('PASS WORK Phase36 READ ONLY: pinned v34 before and after anonymous public asset sample.');
    console.log('PUBLIC ASSET SAMPLE: '+result.public_assets_observed+
      ' files, '+result.public_bytes_observed+' bytes.');
    console.log('LOCAL CANDIDATE COMPARISON: '+result.matched_local_candidate+
      ' exact matches, '+result.different_local_candidate+' differences, '+
      result.missing_local_candidate+' not found locally.');
    console.log('PUBLIC ASSET SAMPLE SHA256: '+result.public_sample_inventory_sha256);
    console.log('LOCAL SAMPLE SHA256: '+result.local_sample_inventory_sha256);
    console.log('HOLD: This is only the anonymous login-page asset sample. It is not deployed v34 Worker byte provenance, a complete asset inventory or build commit certification.');
    console.log('READ ONLY: No authenticated Shopify, Google QA, D1/R2, status writes, provider code downloads, uploads, traffic changes, LIVE/KEEP or billing.');
  }catch(error){
    const code=String(error?.message||'');
    console.error('STOP WORK Phase36 PUBLIC ASSET SAMPLE: '+
      (/^work_hq_phase36_public_assets_[a-z0-9_]+$/.test(code)?
        code:'work_hq_phase36_public_assets_unverified'));
    console.error('READ ONLY PHASE: '+phase);
    process.exitCode=1;
  }
}
