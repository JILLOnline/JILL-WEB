// JILL HQ WORK — read-only R2 privacy / zero-object preflight.
// Does not deploy, upload, download, list individual objects, create routes,
// enable public URLs, modify D1, provision secrets, or mutate Cloudflare.
// This validates a point-in-time snapshot, NOT an R2 billing/spending cap.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const SHOP='jill-work.myshopify.com';
export const WORK_R2_BUCKET='jill-work-private-artwork';
export const WORK_R2_BINDING='JILL_WORK_PRIVATE_ARTWORK_R2';
export const WORK_R2_D1_ID='3f17c186-c794-4e00-8f20-017191373a19';
export const WORK_CLOUDFLARE_ACCOUNT='1cae999d55b9df68a81ad876fb040e60';

const deny=(why='work_r2_read_only_preflight_unverified')=>{throw Error(why);};
const cmd=step=>{
  switch(step){
    case 'identity':return ['whoami'];
    case 'd1':return ['d1','info','jill-order-desk-work',
      '--config','./wrangler.canary.jsonc','--json'];
    case 'bucket':return ['r2','bucket','info',WORK_R2_BUCKET,'--json'];
    case 'public_url':return ['r2','bucket','dev-url','get',WORK_R2_BUCKET];
    case 'domains':return ['r2','bucket','domain','list',WORK_R2_BUCKET];
    default:deny('work_r2_unapproved_command');
  }
};
export const workR2ReadCommand=step=>Object.freeze([...cmd(step)]);
const positiveInt=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
export function verifyWorkR2ReadOnlySnapshot({
  whoami,d1,bucket,devUrl,domains,workConfig,canaryConfig,localConfig,
}={}){
  if(typeof whoami!=='string'||
     !whoami.includes('info@jillonlinestore.com')||
     !whoami.includes(WORK_CLOUDFLARE_ACCOUNT))
    deny('work_r2_cloudflare_account_unverified');
  if(!d1||d1.name!=='jill-order-desk-work'||
     d1.uuid!==WORK_R2_D1_ID)deny('work_r2_d1_identity_mismatch');
  if(!bucket||bucket.name!==WORK_R2_BUCKET||
     bucket.default_storage_class!=='Standard'||
     !(bucket.object_count===0||bucket.object_count==='0')||
     bucket.bucket_size!=='0 B'||
     typeof bucket.created!=='string'||
     !Number.isFinite(Date.parse(bucket.created)))
    deny('work_r2_bucket_not_empty_or_unverified');
  if(typeof devUrl!=='string'||
     !devUrl.includes('Public access via the r2.dev URL is disabled.')||
     devUrl.includes('enabled.'))
    deny('work_r2_public_url_unverified');
  if(typeof domains!=='string'||
     !domains.includes('There are no custom domains connected to this bucket.'))
    deny('work_r2_custom_domains_unverified');
  const validApp=x=>x&&typeof x==='object'&&
    x.d1_databases?.length===1&&
    x.d1_databases[0].database_id===WORK_R2_D1_ID&&
    (!Object.hasOwn(x,'r2_buckets')||x.r2_buckets?.length===0);
  if(!validApp(workConfig)||workConfig.name!=='jill-order-desk-work'||
     !validApp(canaryConfig)||canaryConfig.name!=='jill-order-desk-canary-work')
    deny('work_r2_deploy_binding_unexpected');
  if(!localConfig||localConfig.name!=='jill-order-desk-work'||
     localConfig.d1_databases?.[0]?.database_id!==WORK_R2_D1_ID||
     !Array.isArray(localConfig.r2_buckets)||
     localConfig.r2_buckets.length!==1||
     localConfig.r2_buckets[0]?.bucket_name!==WORK_R2_BUCKET||
     localConfig.r2_buckets[0]?.binding!==WORK_R2_BINDING||
     localConfig.r2_buckets[0]?.remote!==false)
    deny('work_r2_local_config_unverified');
  return Object.freeze({
    state:'read_only_pass',shop:SHOP,bucket:WORK_R2_BUCKET,
    objects:0,bytes:0,storage_class:'Standard',
    public_delivery:false,bindings_deployed:false,
    real_r2_budget_enforced:false,uploads_enabled:false,
  });
}
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:15000}).trim();}
  catch{deny('work_r2_git_unverified');}
}
function remoteRead(step){
  if(!fs.existsSync(BIN))deny('work_r2_wrangler_missing');
  const p=spawnSync(process.execPath,[BIN,...cmd(step)],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    timeout:60000,maxBuffer:2*1024*1024,
  });
  if(p.error||p.status!==0)deny('work_r2_metadata_read_failed');
  const out=String(p.stdout||'');
  if(step==='identity'||step==='public_url'||step==='domains')
    return out;
  try{return JSON.parse(out);}
  catch{deny('work_r2_json_unverifiable');}
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='argument';
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      deny('work_r2_read_only_mode_required');
    phase='git';
    if(git('branch','--show-current')!=='jill/rewards-work'||
       git('rev-parse','HEAD')!==
         git('rev-parse','refs/remotes/origin/jill/rewards-work')||
       git('status','--porcelain','--untracked-files=no'))
      deny('work_r2_git_unverified');
    const readConfig=name=>JSON.parse(
      fs.readFileSync(path.join(APP,name),'utf8'));
    phase='local_config';
    const workConfig=readConfig('wrangler.jsonc');
    const canaryConfig=readConfig('wrangler.canary.jsonc');
    const localConfig=readConfig('wrangler.r2-local.jsonc');
    phase='cloudflare_account';
    const whoami=remoteRead('identity');
    phase='work_d1_identity';
    const d1=remoteRead('d1');
    phase='private_r2_inventory';
    const bucket=remoteRead('bucket');
    phase='public_development_url';
    const devUrl=remoteRead('public_url');
    phase='custom_domains';
    const domains=remoteRead('domains');
    phase='verify';
    const checked=verifyWorkR2ReadOnlySnapshot({
      whoami,d1,bucket,devUrl,domains,
      workConfig,canaryConfig,localConfig,
    });
    if(checked.state!=='read_only_pass')
      deny('work_r2_read_only_receipt_unverified');
    console.log('PASS: Correct WORK Cloudflare account, WORK D1 and Standard R2 bucket.');
    console.log('PASS: Bucket is empty (0 objects, 0 B) with no public r2.dev URL or custom domains.');
    console.log('PASS: Local-only R2 binding is remote:false; WORK/canary deploy configs have no R2 binding.');
    console.log('HOLD: No account-wide storage/operation quota, customer storage or previews authorized.');
    console.log('READ ONLY: No Cloudflare mutations, object reads, D1 writes, deployments or billing changes.');
  }catch(e){
    console.error('STOP WORK R2 READ-ONLY PREFLIGHT: '+String(e?.message||'unverified'));
    console.error('READ ONLY PHASE: '+phase);
    process.exitCode=1;
  }
}
