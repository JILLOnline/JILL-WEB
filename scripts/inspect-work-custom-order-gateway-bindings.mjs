// Cloudflare WORK gateway: read-only Worker/Google endpoint/binding audit.
// Cloudflare does NOT allow reading back secret values. Never pretend it does.
import {spawnSync} from 'node:child_process';
import {join,fileURLToPath} from 'node:path';
import {fileURLToPath as fileURL, pathToFileURL} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import {currentWorkerVersion}
  from './deploy-work-hq-inbox-shell.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';

const ROOT=fileURL(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CFG='./wrangler.toml';
const WORKER='jill-work-custom-orders-qa';
const stop=x=>{throw Error('work_gateway_cloudflare_'+x);};
const requireIt=(ok,code)=>{if(!ok)stop(code);};
export function inspectWorkGatewayBindings(version){
  requireIt(version&&typeof version==='object'&&
    Array.isArray(version.resources?.bindings)&&
    version.resources.bindings.length<=25,
    'version_resource_metadata_missing');
  const bindings=version.resources.bindings;
  const map=new Map(bindings.map(x=>[x.name,x]));
  requireIt(map.size===bindings.length,
    'duplicate_binding_name');
  for(const label of ['SHOPIFY_WORK_APP_SECRET',
    'JILL_CUSTOM_ORDER_GATEWAY_SECRET']){
    requireIt(map.get(label)?.type==='secret_text',
      'required_work_secret_binding_missing');
  }
  const backend=map.get('JILL_CUSTOM_ORDER_QA_BACKEND_URL');
  requireIt(backend&&
    ['plain_text','secret_text'].includes(backend.type),
    'qa_backend_binding_missing');
  if(backend.type==='plain_text'){
    requireIt(backend.text===JILL_HQ_WORK_QA_GOOGLE_URL,
      'gateway_points_to_wrong_google_qa');
  }
  requireIt(map.has('RATE_LIMITER'),
    'work_rate_limiter_binding_missing');
  return Object.freeze({
    required_secret_names_present:true,
    backend_url_verified:backend.type==='plain_text',
    backend_url_not_visible:backend.type==='secret_text',
    cloudflare_secret_value_verified:false,
  });
}
function cli(args) {
  requireIt(fs.existsSync(CLI),'local_wrangler_missing');
  const r=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
    timeout:45000,maxBuffer:5*1024*1024,
  });
  requireIt(!r.error&&!r.signal&&r.status===0,
    'cloudflare_read_unavailable');
  return String(r.stdout||'');
}
export function inspectWorkGatewayRemote(){
  const status=cli(['deployments','status','--name',WORKER,
    '--config',CFG]);
  let active;
  try{active=currentWorkerVersion(status);}
  catch{stop('single_active_work_version_unverifiable');}
  let version;
  try{version=JSON.parse(cli(['versions','view',active,
    '--name',WORKER,'--config',CFG,'--json']));}
  catch{stop('worker_version_json_unverified');}
  requireIt(version?.id===active,'worker_version_drift');
  return inspectWorkGatewayBindings(version);
}
