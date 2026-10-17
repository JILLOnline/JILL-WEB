// WORK quote D1 owner migration: OFFLINE exact-schema, account identity,
// approved SQL, backup manifest and fail-closed command static tests.
// This file makes ZERO remote calls and reads ZERO real customer rows.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {
  checkMigrationSql,parseD1AccountInventory,parseD1Info,parseD1Size,
  parseD1Schema,parseEmptyQuotes,inspectBackupManifest,
} from './owner-work-quote-d1-migration.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const sql=readFileSync(join(ROOT,
  'services/jill-order-desk/quote-proposals/0008_work_quote_drafts.sql'),
  'utf8');
const ID='3f17c186-c794-4e00-8f20-017191373a19';
const DB='jill-order-desk-work';
let cases=0;
function pass(action){action();cases++;}
function deny(action){
  assert.throws(action,/^Error: jill_work_quote_d1_/);cases++;
}
pass(()=>{
  const p=checkMigrationSql(sql);
  assert.equal(p.count,2);
  assert.match(p.sha256,/^[0-9a-f]{64}$/);
});
for(const bad of [
  null,'','CREATE TABLE x (a INT);',
  sql+'DROP TABLE jill_shopify_sessions;',
  sql.replace('PRIMARY KEY(shop,operation_id)','PRIMARY KEY(shop,shop)'),
  sql.replace('FOREIGN KEY(shop,submission_id)','FOREIGN KEY(shop,foo)'),
  sql.replace('CREATE TABLE IF NOT EXISTS jill_work_quote_drafts',
    'CREATE TABLE IF NOT EXISTS jill_shopify_sessions'),
  sql.replace('WITHOUT ROWID;',';'),
])deny(()=>checkMigrationSql(bad));
const account=[{name:'jill-work-unknown',uuid:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},
  {name:DB,uuid:ID}];
pass(()=>assert.equal(parseD1AccountInventory(account).id,ID));
for(const a of [null,{},[],
  [{name:DB,uuid:'different'}],
  [...account,{name:DB,uuid:ID}],
  [{name:'another-name',uuid:ID}],])deny(()=>parseD1AccountInventory(a));
const info={name:DB,uuid:ID,file_size:1024*1024};
pass(()=>assert.equal(parseD1Info(info).database_bytes,1024*1024));
pass(()=>assert.equal(parseD1Info({result:info}).database_bytes,1024*1024));
for(const bad of [
  {},{...info,uuid:'live-id'},
  {...info,name:'jillonlinestore-work'},
  {...info,file_size:null},{...info,file_size:Infinity},
  {...info,file_size:-1},{...info,file_size:32*1024*1024+1},
])deny(()=>parseD1Info(bad));
// Wrangler 4 emits database_size; REST clients may emit file_size.
// Refuse inferred sizes, ambiguous mixed formats or oversized databases.
const modern={name:DB,uuid:ID,database_size:8192,
  read_queries_24h:200,write_queries_24h:8,
  rows_read_24h:9000,rows_written_24h:100};
pass(()=>assert.equal(parseD1Info(modern).database_bytes,8192));
pass(()=>assert.equal(parseD1Info({result:modern}).rows_read_24h,9000));
pass(()=>assert.equal(parseD1Info({...modern,database_size:'8.192 kB'})
  .database_bytes,8192));
pass(()=>assert.equal(parseD1Info({...modern,database_size:'8 KiB'})
  .database_bytes,8192));
pass(()=>assert.equal(parseD1Info({...modern,database_size:'0 B'})
  .database_bytes,0));
pass(()=>assert.equal(parseD1Info({...modern,database_size:'32 MiB'})
  .database_bytes,32*1024*1024));
pass(()=>assert.equal(parseD1Info({...modern,database_size:8192,
  file_size:8192}).database_bytes,8192));
pass(()=>assert.equal(parseD1Info({...modern,database_size:8192,
  rows_read_24h:'unknown'}).rows_read_24h,null));
pass(()=>assert.equal(parseD1Size('10.001 kB'),10001));
for(const bad of [
  {...modern,database_size:undefined},
  {...modern,database_size:null},
  {...modern,database_size:''},
  {...modern,database_size:'unknown'},
  {...modern,database_size:'1,024 B'},
  {...modern,database_size:'32.001 MiB'},
  {...modern,database_size:-1},
  {...modern,database_size:0.25},
  {...modern,database_size:'1.23 B'},
  {...modern,database_size:8192,file_size:4096},
  {...modern,database_size:'5e3'},
  {...modern,database_size:'12 KB '},
  {...modern,database_size:'12 terabytes'},
  {...modern,database_size:'1 KiB\nDROP'},
])deny(()=>parseD1Info(bad));
for(const bad of [-1,Infinity,NaN,null,undefined,
  {},'','-10 B','0.1 B','01 B','32.001 MiB',
  '33 MiB','100 GB','32 MB!','1e3 B','1.0000 kB'])
  deny(()=>parseD1Size(bad));
const base=[
  'jill_merchant_audit','jill_merchant_authority',
  'jill_merchant_grants','jill_shopify_sessions',
];
const proposal=['jill_work_quote_drafts','jill_work_quote_draft_operations'];
const response=names=>[{
  success:true,
  results:names.map(name=>({name,type:'table'})),
}];
pass(()=>assert.equal(parseD1Schema(response(base)).quote_tables_present,0));
pass(()=>assert.equal(parseD1Schema(response([...base,
  'jill_work_verified_inbox_index'])).inbox_index_present,true));
pass(()=>assert.equal(parseD1Schema(response([...base,...proposal]),
  {after:true}).quote_tables_present,2));
for(const bad of [
  [],
  response(['jill_shopify_sessions']),
  response([...base,'jill_unknown_customer_data']),
  response([...base,proposal[0]]),
  response([...base,base[0]]),
  [{success:false,results:response(base)[0].results}],
  [{success:true,results:[{name:'jill_auth',type:'view'}]}],
])deny(()=>parseD1Schema(bad));
deny(()=>parseD1Schema(response([...base,...proposal])));
deny(()=>parseD1Schema(response(base),{after:true}));
pass(()=>assert.equal(parseEmptyQuotes([{
  success:true,results:[{drafts:0,operations:0}],
}]),true));
for(const bad of [
  null,[{success:false,results:[{drafts:0,operations:0}]}],
  [{success:true,results:[{drafts:1,operations:0}]}],
  [{success:true,results:[{drafts:0,operations:3}]}],
  [{success:true,results:[]}],
])deny(()=>parseEmptyQuotes(bad));
const time=Date.parse('2026-10-17T15:00:00Z');
const manifest={
  version:1,database:DB,database_id:ID,
  git_head:'a'.repeat(40),
  proposal_sha256:checkMigrationSql(sql).sha256,
  backup_sha256:'b'.repeat(64),
  backup_bytes:12345,saved_at_ms:time-60_000,
  free_tier_review_required:true,
};
const conditions={now:time,gitHead:manifest.git_head,
  sqlSha:manifest.proposal_sha256,bytes:12345,
  digest:manifest.backup_sha256};
pass(()=>assert.equal(inspectBackupManifest(manifest,conditions),true));
for(const bad of [
  null,{...manifest,database:'jillonlinestore.com'},
  {...manifest,database_id:'live'},
  {...manifest,git_head:'c'.repeat(40)},
  {...manifest,proposal_sha256:'a'.repeat(64)},
  {...manifest,backup_bytes:1},
  {...manifest,backup_sha256:'c'.repeat(64)},
  {...manifest,free_tier_review_required:false},
  {...manifest,saved_at_ms:time-7_300_000},
  {...manifest,saved_at_ms:time+1000},
])deny(()=>inspectBackupManifest(bad,conditions));

const code=readFileSync(new URL('./owner-work-quote-d1-migration.mjs',
  import.meta.url),'utf8');
const config=JSON.parse(readFileSync(join(APP,
  'wrangler.canary.jsonc'),'utf8'));
assert.equal(config.d1_databases[0].database_id,ID);
assert.deepEqual(readdirSync(join(ROOT,
  'services/jill-order-desk/migrations')).sort(),[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
]);
for(const text of [
  "mode==='--backup'",
  "mode==='--apply'",
  "mode==='--inspect'",
  "mode==='--verify'",
  "'--free-tier-reviewed'",
  "'--remote'",
  "'--skip-confirmation'",
  "'--output',target.backup",
  "'--file'",
  "'../quote-proposals/0008_work_quote_drafts.sql'",
  "'--yes'",
  'backup_manifest_mismatch',
  'backup_exists_no_overwrite',
  'private-d1-backups',
  'currentWorkerVersion(stdout)',
  'WRANGLER_SEND_METRICS',
  'new_tables_not_empty',
  'MAX_DB=32*1024*1024',
  'MAX_EXPORT=64*1024*1024',
  'database_size',
  'file_size',
  'rows_read_24h',
  'rows_written_24h',
]){assert.ok(code.includes(text),'Missing required safety marker '+text);cases++;}
for(const bad of [
  'versions upload','versions deploy','migrations apply',
  'd1 create','r2 object put','shopify app deploy',
]){
  assert.equal(code.includes(bad),false,'Unsafe command: '+bad);cases++;
}

// One-shot Windows workflow: no step may run after a failed previous
// process. Confirm both the Free-tier review and remote write separately.
const ps=readFileSync(new URL('./run-work-quote-d1-owner.ps1',
  import.meta.url),'utf8');
for(const required of [
  "#Requires -Version 5.1",
  "ValidateSet('Inspect', 'Migrate')",
  "Set-StrictMode -Version Latest",
  "$ErrorActionPreference = 'Stop'",
  "function Invoke-Required",
  "$LASTEXITCODE -ne 0",
  "throw ('STOP:",
  "if ($Mode -ceq 'Inspect')",
  "FREE VERIFIED",
  "MIGRATE WORK QUOTES",
  "Invoke-Required 'work:hq:quote:d1:inspect'",
  "Invoke-Required 'work:hq:quote:d1:backup'",
  "Invoke-Required 'work:hq:quote:d1:apply'",
  "Invoke-Required 'work:hq:quote:d1:verify'",
  "exit 1",
]){
  assert.ok(ps.includes(required),'Missing Owner PS gate: '+required);
  cases++;
}
const order=["work:hq:quote:d1:inspect","FREE VERIFIED",
  "work:hq:quote:d1:backup","MIGRATE WORK QUOTES",
  "work:hq:quote:d1:apply","work:hq:quote:d1:verify"];
for(let i=1;i<order.length;i++){
  assert.ok(ps.indexOf(order[i-1])<ps.indexOf(order[i]),
    'Owner PS allowed out-of-order write: '+order[i]);
  cases++;
}
assert.doesNotMatch(ps,/Invoke-Expression|Start-Job|Invoke-WebRequest|Remove-Item|iex\b/);
cases++;
console.log('PASS WORK quote D1 owner migration OFFLINE: '+cases+
  ' security/schema/backup/cost-prompt/target/pinning fixtures. No Cloudflare calls, schema writes, customer data, Worker release or LIVE/KEEP.');
console.log('HOLD: actual remote metadata, Workers billing tier/free usage, private export and two-table migration must still be verified on Owner Windows.');
