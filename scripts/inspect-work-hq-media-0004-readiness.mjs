// WORK media 0004: read-only prerequisite gate. NO migration, secret,
// registry provisioning, file retrieval, Cloudinary, or D1 customer rows.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {
  WORK_MEDIA_D1_ID,WORK_MEDIA_BASE_TABLES,
  WORK_MEDIA_TABLE,assertWorkMediaD1Config,
  assertWorkMediaD1Schema,assertWorkMediaD1LedgerPresence,
  assertWorkMediaD1LedgerHistory,
  workMediaD1ReadCommand,
} from './inspect-work-hq-media-d1-preflight.mjs';
import {
  assertWork0003Postflight,work0003ReleaseCommand,
} from './release-work-hq-inbox-0003.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const WRANGLER=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const PROPOSAL=path.join(ROOT,'services/jill-order-desk/migration-plans/0004_work_private_media_registry.sql');
const ACTIVE=path.join(ROOT,'services/jill-order-desk/migrations');
const EXPECTED_MIGRATIONS=Object.freeze([
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
]);
const fail=(s)=>{throw Error(s);};
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function readArgs(args){
  if(!fs.existsSync(WRANGLER))fail('media_0004_wrangler_missing');
  const r=spawnSync(process.execPath,[WRANGLER,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    timeout:60000,maxBuffer:8*1024*1024,
  });
  if(r.error||r.status!==0)fail('media_0004_remote_metadata_unavailable');
  try{return JSON.parse(r.stdout);}catch{fail('media_0004_remote_metadata_unverifiable');}
}
export function assertMedia0004Source({filenames,proposal,config}={}){
  if(JSON.stringify(filenames)!==JSON.stringify(EXPECTED_MIGRATIONS)||
    typeof proposal!=='string'||
    !proposal.includes('INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION')||
    !proposal.includes('CREATE TABLE IF NOT EXISTS '+WORK_MEDIA_TABLE)||
    !proposal.includes('pending_verification')||
    !proposal.includes('FOREIGN KEY(shop) REFERENCES jill_merchant_authority(shop)')||
    !proposal.includes('work_media_registry_insert_must_be_pending')||
    !proposal.includes('work_media_registry_delete_forbidden')||
    !proposal.includes('immutable_work_media_reference')||
    !assertWorkMediaD1Config(config))
    fail('media_0004_proposal_or_work_scope_drift');
  return Object.freeze({proposal_inert:true,applied_migrations:3,
    registry_not_applied:true,privacy_not_proven:true});
}
export function assertMedia0004Post0003Baseline({
  schema,ledgerPresence,ledgerHistory,seed,
}={}){
  const schemaInfo=assertWorkMediaD1Schema(schema);
  if(schemaInfo.pending_0003_inbox_index||
    schemaInfo.tables_verified!==WORK_MEDIA_BASE_TABLES.length||
    !schemaInfo.registry_absent||
    !assertWorkMediaD1LedgerPresence(ledgerPresence))
    fail('media_0004_requires_certified_0003');
  const ledger=assertWorkMediaD1LedgerHistory(ledgerHistory,{
    inboxTablePresent:true,
  });
  if(!ledger.inbox_0003_recorded||ledger.migration_count!==3)
    fail('media_0004_requires_certified_0003');
  const expected=assertWork0003Postflight({
    schema:{success:true,results:WORK_MEDIA_BASE_TABLES.map(name=>({name}))},
    ledger:ledgerHistory,
    seed,
  });
  if(expected.initial_index_rows!==1)
    fail('media_0004_inbox_seed_unverified');
  return Object.freeze({work_0003_verified:true,
    active_tables:5,active_migrations:3,registry_absent:true,
    proposed_0004_inert:true,secret_not_verified:true,
    private_storage_not_verified:true});
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='start';
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      fail('media_0004_read_only_mode_required');
    phase='work_source';
    if(git('branch','--show-current')!=='jill/rewards-work'||
      git('rev-parse','HEAD')!==git('rev-parse',
        'refs/remotes/origin/jill/rewards-work')||
      git('status','--porcelain','--untracked-files=no'))
      fail('media_0004_git_unverified');
    const source=assertMedia0004Source({
      filenames:fs.readdirSync(ACTIVE).sort(),
      proposal:fs.readFileSync(PROPOSAL,'utf8'),
      config:JSON.parse(fs.readFileSync(
        path.join(APP,'wrangler.canary.jsonc'),'utf8')),
    });
    phase='v34_and_work_identity';
    const pre=spawnSync(process.execPath,[
      path.join(ROOT,'scripts/inspect-work-hq-media-d1-preflight.mjs'),
      '--inspect',
    ],{cwd:ROOT,encoding:'utf8',shell:false,windowsHide:true,
      timeout:180000,maxBuffer:8*1024*1024});
    if(pre.error||pre.status!==0||
      !String(pre.stdout).includes('PASS exact WORK canary v34 and exact D1 binding/Cloudflare account database identity.')||
      !String(pre.stdout).includes('PASS WORK inbox-index table is present.')||
      !String(pre.stdout).includes('PASS migration 0003 is recorded in D1 ledger.'))
      fail('media_0004_v34_or_0003_unverified');
    phase='read_only_five_table_three_migration_receipt';
    const receipt=assertMedia0004Post0003Baseline({
      schema:readArgs(workMediaD1ReadCommand('schema_only')),
      ledgerPresence:readArgs(workMediaD1ReadCommand('ledger_presence')),
      ledgerHistory:readArgs(workMediaD1ReadCommand('ledger_history')),
      seed:readArgs(work0003ReleaseCommand('post_seed')),
    });
    if(!source.proposal_inert||!receipt.registry_absent)
      fail('media_0004_unexpected_registry_state');
    console.log('PASS WORK v34 + exact D1 identity, migration 0003 complete: 5 JILL tables, 3 ledger records, 1 empty index seed.');
    console.log('PASS 0004 PRIVATE MEDIA registry ABSENT; proposal remains INERT outside active migrations.');
    console.log('HOLD dedicated registry HMAC secret, provider-private asset storage, retention and owner-authenticated delivery remain unverified.');
    console.log('READ ONLY. No registry writes, Cloudinary downloads, keys, Worker deployment or LIVE/KEEP changes.');
  }catch(e){
    const allowed=new Set([
      'media_0004_wrangler_missing','media_0004_remote_metadata_unavailable',
      'media_0004_remote_metadata_unverifiable',
      'media_0004_proposal_or_work_scope_drift',
      'media_0004_requires_certified_0003',
      'media_0004_inbox_seed_unverified',
      'media_0004_read_only_mode_required','media_0004_git_unverified',
      'media_0004_v34_or_0003_unverified',
      'media_0004_unexpected_registry_state',
    ]);
    console.error('WORK MEDIA 0004 READINESS STOPPED: '+
      (allowed.has(e?.message)?e.message:'media_0004_unverified'));
    console.error('READ ONLY PHASE: '+phase);
    process.exitCode=1;
  }
}
