// One guarded WORK HQ local-certification runner. NO network, deploy,
// LIVE/KEEP, Google Apps Script, Cloudflare APIs, billing or remote data.
// Only tests that use synthetic fixtures and local workerd fake databases.
// Build and remote provider checks are separately gated.
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {prepareOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const SHOP='jill-work.myshopify.com';
const BRANCH='jill/rewards-work';
const steps=Object.freeze([
  {name:'Signed Shopify WORK app-proxy and quota',root:true,
    path:'scripts/test-cloudflare-custom-order-gateway.mjs'},
  {name:'WORK merchant status/message commands',root:true,
    path:'scripts/test-work-hq-merchant-command.mjs'},
  {name:'WORK Google QA mail-outbox logic',root:true,
    path:'scripts/test-work-hq-mail-outbox.mjs'},
  {name:'WORK surge limit and spending protections',root:true,
    path:'scripts/test-work-hq-surge-capacity.mjs'},
  {name:'WORK privacy-preserving retention safeguards',root:true,
    path:'scripts/test-work-hq-media-retention-review.mjs'},
  {name:'WORK local OAuth/Shopify route integration',root:false,
    path:'scripts/test-workerd-oauth-integration.mjs'},
  {name:'WORK private-media Owner authorization',root:false,
    path:'scripts/test-workerd-media-owner-boundary.mjs'},
  {name:'WORK local intake unique ledger and one-shot dispatch',root:false,
    path:'scripts/test-workerd-intake-ledger-local.mjs'},
  {name:'WORK new signed intake two-confirmation bridge',root:false,
    path:'scripts/test-workerd-signed-intake-local.mjs'},
  {name:'WORK sanitized media local complete transaction',root:false,
    path:'scripts/test-workerd-media-local-transaction.mjs'},
]);
function stop(reason){
  throw Error('work_hq_local_bundle_not_certified:'+reason);
}
function git(...args){
  try{
    return execFileSync('git',['-C',ROOT,...args],{
      encoding:'utf8',windowsHide:true,timeout:15000,
    }).trim();
  }catch{stop('git_unavailable');}
}
function verifyGuard(){
  if(git('branch','--show-current')!==BRANCH)stop('wrong_branch');
  if(git('status','--porcelain','--untracked-files=no'))
    stop('tracked_files_modified');
  if(git('rev-parse','HEAD')!==
     git('rev-parse','refs/remotes/origin/'+BRANCH))
    stop('not_synced_with_origin');
  const active=readdirSync(join(ROOT,
    'services/jill-order-desk/migrations')).sort();
  if(JSON.stringify(active)!==JSON.stringify([
    '0001_staff_authority.sql','0002_shopify_sessions.sql',
    '0003_work_verified_inbox_index.sql'
  ]))stop('remote_migration_not_inert');
  for(const name of ['wrangler.jsonc','wrangler.canary.jsonc']){
    const c=JSON.parse(readFileSync(join(APP,name),'utf8'));
    if(c.d1_databases?.[0]?.database_id!==
       '3f17c186-c794-4e00-8f20-017191373a19'||
       c.r2_buckets!==undefined||
       c.vars?.JILL_WORK_INTAKE_LEDGER_ENABLED!==undefined||
       c.vars?.JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED!==undefined)
      stop('production_config_mutated');
  }
  const cloud=readFileSync(join(ROOT,
    'services/custom-order-cloudflare/handler.mjs'),'utf8');
  if(cloud.includes('phase27-local-signed-intake')||
     cloud.includes('work-intake-ledger-plan'))
    stop('unexpected_prod_intake_wiring');
}
function runStep(name,cmd,args,cwd,extraEnv={}){
  process.stdout.write('\nHQ CHECK: '+name+'\n');
  const x=spawnSync(cmd,args,{
    cwd,encoding:'utf8',shell:false,windowsHide:true,
    env:{...process.env,WRANGLER_SEND_METRICS:'false',...extraEnv},
    timeout:180000,maxBuffer:2*1024*1024,
  });
  if(x.stdout)process.stdout.write(x.stdout.slice(-30000));
  if(x.stderr)process.stderr.write(x.stderr.slice(-12000));
  if(x.error||x.status!==0||x.signal)
    stop('failed_'+name.replace(/[^a-zA-Z0-9]/g,'_'));
  process.stdout.write('HQ CHECK PASS: '+name+'\n');
}
try{
  if(process.argv.length!==3||
     process.argv[2]!=='--verify-local')stop('invalid_cli');
  verifyGuard();
  // The local OAuth smoke test requires the canary's compiled Worker.
  // Build a fresh disposable LOCAL canary bundle; never deploy it.
  if(process.platform==='win32'){
    runStep('Compile LOCAL OAuth canary (no deployment)',
      process.env.ComSpec||'cmd.exe',
      ['/d','/s','/c','npm.cmd run build'],APP,
      {JILL_BUILD_TARGET:'canary'});
  }else{
    runStep('Compile LOCAL OAuth canary (no deployment)',
      'npm',['run','build'],APP,
      {JILL_BUILD_TARGET:'canary'});
  }
  const buildManifest=join(APP,'dist/server/wrangler.json');
  const oauthManifest=join(APP,'dist/server/wrangler.oauth-canary.json');
  if(!existsSync(buildManifest))stop('canary_bundle_not_built');
  const expected=prepareOAuthManifest(
    JSON.parse(readFileSync(buildManifest,'utf8')));
  if(!existsSync(oauthManifest)){
    runStep('Generate LOCAL OAuth-only canary candidate (no deployment)',
      process.execPath,[join(ROOT,
        'scripts/prepare-work-canary-oauth-manifest.mjs')],ROOT);
  }
  if(!existsSync(oauthManifest)||
     !isDeepStrictEqual(JSON.parse(readFileSync(oauthManifest,'utf8')),
       expected))stop('local_oauth_candidate_drift');
  for(const test of steps){
    const cwd=test.root?ROOT:APP;
    const full=resolve(cwd,test.path);
    runStep(test.name,process.execPath,[full],cwd);
  }
  // Do not interpolate any user-controlled string into command shells.
  if(process.platform==='win32'){
    runStep('WORK React Router TypeScript',
      process.env.ComSpec||'cmd.exe',
      ['/d','/s','/c','npm.cmd run typecheck'],
      APP);
  }else{
    runStep('WORK React Router TypeScript','npm',
      ['run','typecheck'],APP);
  }
  process.stdout.write(
    '\nPASS WORK HQ LOCAL BUNDLE: signed custom-order gateway, merchant commands, mail QA, surge controls, privacy, OAuth, Owner security, intake D1, dual Google confirmation bridge, real local media pipeline and TypeScript. NO real Shopify/Google/Cloudflare writes or production readiness claim.\n');
}catch(e){
  process.stderr.write('STOP WORK HQ LOCAL BUNDLE: '+
    String(e?.message||'local_verification_failed').slice(0,180)+'\n');
  process.exitCode=1;
}
