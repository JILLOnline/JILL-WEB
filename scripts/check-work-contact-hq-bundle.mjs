// Build artifact proof for HQ's private Contact named WorkerEntrypoint.
// NO remote access, provider credentials, upload, deploy, schema or traffic.
// Refuse success if the named export disappears from the actual Worker entry.
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root='services/jill-order-desk/app-home/dist/server';
const halt=reason=>{throw Error('contact_hq_bundle_'+reason);};
if(!existsSync(join(root,'index.js')))halt('missing_entry');
const entry=readFileSync(join(root,'index.js'),'utf8');
const assets=join(root,'assets');
const workers=existsSync(assets)?readdirSync(assets).filter(x=>
 /^worker-entry-.*\.js$/.test(x)):[];
if(workers.length!==1)halt('worker_entry_ambiguous');
const js=readFileSync(join(assets,workers[0]),'utf8');
// "present in bundled text" and "exported by deploy entry" are distinct.
if(!/JillContactPrivate/.test(js))halt('named_class_missing');
if(!/JillContactPrivate/.test(entry))halt('named_export_missing');
if(!/default/.test(entry))halt('default_entry_missing');
const compiled=join(root,'wrangler.json');
if(!existsSync(compiled))halt('missing_compiled_manifest');
let manifest;
try{manifest=JSON.parse(readFileSync(compiled,'utf8'));}
catch{halt('compiled_manifest_invalid');}
const cfg=manifest?.d1_databases;
if(manifest?.name!=='jill-order-desk-canary-work'||
  manifest?.vars?.JILL_WORK_HOST_STAGE!=='canary'||
  manifest?.vars?.JILL_WORK_OAUTH_ENABLED!=='false'||
  manifest?.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED!=='false'||
  !Array.isArray(cfg)||cfg.length!==1||
  cfg[0]?.binding!=='JILL_ORDER_DESK_WORK_DB'||
  cfg[0]?.database_id!=='3f17c186-c794-4e00-8f20-017191373a19'||
  manifest?.services?.length)
 halt('compiled_canary_scope_drift');
for(const name of [
 'JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED',
 'JILL_WORK_CONTACT_INTAKE_ENABLED','JILL_WORK_CONTACT_CLAIM_ENABLED',
 'JILL_WORK_CONTACT_ACCOUNT_ENABLED','JILL_WORK_CONTACT_THREAD_ENABLED',
 'JILL_WORK_CONTACT_INBOX_ENABLED','JILL_WORK_CONTACT_STATUS_ENABLED',
 'JILL_WORK_CONTACT_MESSAGES_ENABLED',
]){
 if(manifest.vars?.[name]==='true')halt('compiled_contact_flag_enabled');
}
console.log('PASS WORK HQ compiled canary manifest: fixed WORK D1, OAuth OFF in source-only candidate, Contact OFF. This manifest is NOT safe for live WORK OAuth rollout.');
console.log('PASS WORK HQ bundle exports default app + named private Contact entrypoint. No upload or deploy.');
