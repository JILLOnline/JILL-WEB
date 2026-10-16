// Entirely offline WORK 0003 release contract regression.
// NO Cloudflare/Shopify/Google/D1 calls, no migration apply or restore.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
  WORK_0003_APPROVAL,
  WORK_0003_POST_SEED_SQL,WORK_0003_POST_SCHEMA_SQL,
  WORK_0003_POST_LEDGER_SQL,
  work0003ReleaseCommand,
  assertWork0003FileState,assertWork0003Postflight,
  encryptForCurrentWindowsUser,decryptForVerification,
} from './release-work-hq-inbox-0003.mjs';

const dir='services/jill-order-desk/migrations/';
const realFiles=readdirSync(dir).sort();
const sql=readFileSync(dir+'0003_work_verified_inbox_index.sql','utf8');
const config=JSON.parse(readFileSync(
  'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const fastFlagSource=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts',
  'utf8');
const args={files:realFiles,sql,config,fastFlagSource};
const state=assertWork0003FileState(args);
assert.equal(state.only_pending,'0003_work_verified_inbox_index.sql');
assert.equal(state.fast_inbox,'off');
assert.match(state.sha256,/^[a-f0-9]{64}$/);
assert.ok(Object.isFrozen(state));
assert.equal(WORK_0003_APPROVAL,'APPLY JILL WORK D1 0003 ONLY');
for(const changes of [
  {files:[...realFiles,'0004_work_private_media_registry.sql']},
  {files:realFiles.slice(0,2)},
  {sql:sql+'\nCREATE TABLE malicious (id TEXT);'},
  {sql:sql+'\nINSERT INTO customer_data VALUES (1);'},
  {sql:sql.replace('INSERT INTO jill_work_verified_inbox_index','SELECT 1')},
  {config:{...config,name:'jill-LIVE'}},
  {config:{...config,d1_databases:[{
    ...config.d1_databases[0],database_id:'LIVE_ID',
  }]}},
  {config:{...config,d1_databases:[{
    ...config.d1_databases[0],migrations_dir:'../migration-plans',
  }]}},
  {config:{...config,vars:{...config.vars,
    JILL_WORK_HQ_FAST_INBOX_ENABLED:'true'}}},
  {fastFlagSource:fastFlagSource.replace(
    'if(!fast)return await readGoogle()','FAST_INBOX_ALWAYS_ON')},
]){
  assert.throws(()=>assertWork0003FileState({...args,...changes}),
    /work_0003_migration_source_drift/);
}
const base=[
  'd1','execute','jill-order-desk-work',
  '--remote','--config','./wrangler.canary.jsonc',
];
for(const [op,sql] of [
  ['post_seed',WORK_0003_POST_SEED_SQL],
  ['post_schema',WORK_0003_POST_SCHEMA_SQL],
  ['post_ledger',WORK_0003_POST_LEDGER_SQL],
]){
  const got=work0003ReleaseCommand(op);
  assert.deepEqual(got,[...base,'--command',sql,'--json']);
  assert.match(sql,/^SELECT /);
  assert.doesNotMatch(sql,/;|PRAGMA|DROP|ALTER|CREATE|INSERT|UPDATE|DELETE/i);
}
assert.deepEqual(work0003ReleaseCommand('apply_0003'),[
  'd1','migrations','apply','jill-order-desk-work',
  '--remote','--config','./wrangler.canary.jsonc',
]);
for(const op of ['apply_0004','LIVE','restore','secret','export',
  'd1','apply','sql',null,undefined]){
  assert.throws(()=>work0003ReleaseCommand(op),
    /work_0003_disallowed_operation/);
}
const fixture=results=>[{
  success:true,results,meta:{changed_db:false,rows_written:0},
}];
const schema=fixture([
  {name:'jill_merchant_audit'},
  {name:'jill_merchant_authority'},
  {name:'jill_merchant_grants'},
  {name:'jill_shopify_sessions'},
  {name:'jill_work_verified_inbox_index'},
]);
const ledger=fixture([
  {name:'0001_staff_authority.sql'},
  {name:'0002_shopify_sessions.sql'},
  {name:'0003_work_verified_inbox_index.sql'},
]);
const seed=fixture([{
  shop:'jill-work.myshopify.com',generation:0,
  verified_payload_json:null,verified_at_ms:0,expires_at_ms:0,
}]);
assert.deepEqual(assertWork0003Postflight({schema,ledger,seed}),{
  tables_verified:5,migrations_verified:3,
  initial_index_rows:1,fast_inbox:'off',
});
const fails=[
  {schema:fixture(schema[0].results.slice(0,4))},
  {schema:fixture([...schema[0].results,{name:'jill_work_private_media_registry'}])},
  {schema:fixture([...schema[0].results].reverse())},
  {schema:fixture([{name:'jill_LIVE'},...schema[0].results.slice(1)])},
  {schema:fixture([...schema[0].results,{name:'private',url:'https://example.com'}])},
  {schema:[{success:false,results:schema[0].results}]},
  {schema:[{success:true,results:schema[0].results,
    meta:{changed_db:true,rows_written:1}}]},
  {ledger:fixture(ledger[0].results.slice(0,2))},
  {ledger:fixture([...ledger[0].results,{name:'0004_work_private_media_registry.sql'}])},
  {ledger:fixture([{name:'0003_work_verified_inbox_index.sql'},
    ...ledger[0].results.slice(0,2)])},
  {seed:fixture([])},
  {seed:fixture([{...seed[0].results[0],generation:1}])},
  {seed:fixture([{...seed[0].results[0],verified_payload_json:'LEAK'}])},
  {seed:fixture([{...seed[0].results[0],
    shop:'jillonlinestore.myshopify.com'}])},
  {seed:fixture([{...seed[0].results[0],extra_field:'PII'}])},
];
for(const delta of fails)
  assert.throws(()=>assertWork0003Postflight({
    schema,ledger,seed,...delta,
  }),/work_0003_postflight_/);
const release=readFileSync('scripts/release-work-hq-inbox-0003.mjs','utf8');
assert.match(release,/process\.stdin\.isTTY/);
assert.match(release,/approved!==WORK_0003_APPROVAL/);
assert.match(release,/fs\.writeFileSync\(filepath,cipher,\{flag:'wx'/);
assert.match(release,/fs\.lstatSync\(dest\)\.isSymbolicLink\(\)/);
assert.match(release,/readBaseline\(\);[\s\S]*capture_private_time_travel_bookmark/);
assert.match(release,/phase='final_prewrite_recheck';[\s\S]*readBaseline\(\)/);
assert.match(release,/No automatic restore or schema rollback was attempted/);
assert.doesNotMatch(release,/'time-travel','restore'|'secret','put'|'d1','delete'/);
assert.doesNotMatch(release,/execSync\(.*?shell:true/);
if(process.platform==='win32'){
  const sample='SYNTHETIC_WORK_0003_CHECKPOINT_ONLY_'+Date.now();
  let encrypted;
  try{encrypted=encryptForCurrentWindowsUser(sample);}
  catch(e){
    const probe=spawnSync('powershell.exe',
      ['-NoProfile','-NonInteractive','-Command',
        '$ErrorActionPreference="Stop";'+
        'Add-Type -AssemblyName System.Security;'+
        '$bytes=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());'+
        '$blob=[System.Security.Cryptography.ProtectedData]::Protect($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);'+
        '[Console]::Out.Write([Convert]::ToBase64String($blob))'],
      {input:'SYNTHETIC_DPAPI_NET_DIAGNOSTIC_ONLY',
        encoding:'utf8',shell:false,windowsHide:true,timeout:20000});
    console.error('SYNTHETIC DPAPI .NET DIAGNOSTIC:',
      JSON.stringify({status:probe.status,errorCode:probe.error?.code||null,
        stderr:String(probe.stderr||'').slice(0,1600),
        stdoutBytes:String(probe.stdout||'').length}));
    throw e;
  }
  assert.ok(!encrypted.includes(sample));
  assert.equal(decryptForVerification(encrypted),sample,
    'Win32 DPAPI must roundtrip for the current user');
}
console.log('PASS WORK 0003 OWNER-GATED release OFFLINE: exact migration-only args, TTY approval, Windows DPAPI checkpoint contract, strict after-state, 0004/LIVE blocked; NO remote writes.');
