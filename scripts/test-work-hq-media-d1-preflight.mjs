import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {
  assertWorkMediaD1Config,assertWorkMediaD1AccountList,
  assertWorkMediaD1Worker,assertWorkMediaD1Schema,
  workMediaD1ReadCommand,WORK_MEDIA_D1_ID,
  WORK_MEDIA_SCHEMA_SQL,WORK_MEDIA_BASE_TABLES,WORK_MEDIA_CORE_TABLES,
  assertWorkMediaD1LedgerPresence,assertWorkMediaD1LedgerHistory,
  WORK_MEDIA_LEDGER_PRESENCE_SQL,WORK_MEDIA_LEDGER_HISTORY_SQL,
} from './inspect-work-hq-media-d1-preflight.mjs';
import {DETAIL_ON_CANDIDATE}
  from './release-work-hq-detail-v9-on.mjs';

// ALL SYNTHETIC: no external requests and no Cloudflare operations.
const config=JSON.parse(readFileSync(
  'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
assert.equal(assertWorkMediaD1Config(config),true);
for(const mutated of [
  {...config,name:'jill-order-desk-LIVE'},
  {...config,d1_databases:[]},
  {...config,d1_databases:[{
    ...config.d1_databases[0],database_id:'LIVE_DB'}]},
  {...config,d1_databases:[{
    ...config.d1_databases[0],database_name:'jill-order-desk-LIVE'}]},
  {...config,d1_databases:[{
    ...config.d1_databases[0],migrations_dir:'../migration-plans'}]},
  {...config,vars:{...config.vars,
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},
]){
  assert.throws(()=>assertWorkMediaD1Config(mutated));
}
const account={name:'jill-order-desk-work',uuid:WORK_MEDIA_D1_ID};
assert.equal(assertWorkMediaD1AccountList([account]).id,WORK_MEDIA_D1_ID);
assert.equal(assertWorkMediaD1AccountList([
  {name:'UNRELATED_DB',uuid:'11111111-1111-1111-1111-111111111111'},
  {name:account.name,id:account.uuid},
]).id,WORK_MEDIA_D1_ID);
for(const bad of [
  [],{},null,
  [{name:'jill-order-desk-work',uuid:'WRONG'}],
  [{name:'jill-order-desk-LIVE',uuid:WORK_MEDIA_D1_ID}],
  [account,account],
  [account,{name:'other',uuid:WORK_MEDIA_D1_ID}],
]){
  assert.throws(()=>assertWorkMediaD1AccountList(bad));
}
const binding={
  name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:WORK_MEDIA_D1_ID,
};
const flags=Object.entries({
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
  JILL_WORK_HQ_DETAIL_ENABLED:'true',
}).map(([name,text])=>({name,type:'plain_text',text}));
const worker={id:DETAIL_ON_CANDIDATE,
  resources:{bindings:[binding,...flags]}};
assert.equal(assertWorkMediaD1Worker(worker),true);
for(const mut of [
  {...worker,id:'WORK_UNKNOWN'},
  {...worker,resources:{bindings:flags}},
  {...worker,resources:{bindings:[
    {...binding,id:'LIVE_D1'},...flags]}},
  {...worker,resources:{bindings:[binding,binding,...flags]}},
  {...worker,resources:{bindings:[
    binding,...flags.map(b=>b.name==='JILL_WORK_HQ_DETAIL_ENABLED'?
      {...b,text:'false'}:b)]}},
  {...worker,resources:{bindings:[
    binding,...flags.map(b=>b.name==='JILL_WORK_OWNER_BOOTSTRAP_ENABLED'?
      {...b,text:'true'}:b)]}},
]){
  assert.throws(()=>assertWorkMediaD1Worker(mut));
}
// Exact four-table state observed in the real WORK D1 on 2026-10-16.
assert.equal(WORK_MEDIA_CORE_TABLES.length,4);
const core=WORK_MEDIA_CORE_TABLES.map(name=>({name,type:'table'}));
const four=[{success:true,results:core}];
assert.deepEqual(assertWorkMediaD1Schema(four),{
  tables_verified:4,registry_absent:true,
  schema_state:'four_table_pre_0003',pending_0003_inbox_index:true,
});
const rows=WORK_MEDIA_BASE_TABLES.map(name=>({name,type:'table'}));
const fixture=[{success:true,results:rows}];
assert.deepEqual(assertWorkMediaD1Schema(fixture),{
  tables_verified:5,registry_absent:true,
  schema_state:'five_table_index_present',pending_0003_inbox_index:false,
});
assert.deepEqual(assertWorkMediaD1Schema(fixture[0]),{
  tables_verified:5,registry_absent:true,
  schema_state:'five_table_index_present',pending_0003_inbox_index:false,
});
for(const bad of [
  [{success:false,results:rows}],
  [{success:true,results:rows.slice(1)}],
  [{success:true,results:[...rows,rows[0]]}],
  [{success:true,results:[
    ...rows,{name:'jill_work_private_media_registry',type:'table'}]}],
  [{success:true,results:[...rows.slice(0,4),{
    name:rows[4].name,type:'view'}]}],
  [{success:true,results:[]}],[],
  [{success:true,results:core.slice(1)}],
  [{success:true,results:[...core,core[0]]}],
  [{success:true,results:[
    ...core,{name:'jill_work_private_media_registry',type:'table'}]}],
  [{success:true,results:[...rows,{name:'jill_LIVE_orders',type:'table'}]}],
]){
  assert.throws(()=>assertWorkMediaD1Schema(bad));
}
// Read-only Cloudflare D1 ledger detection does not create or initialize
// the migration table. Missing ledger is a recognized HOLD, not a PASS.
assert.equal(assertWorkMediaD1LedgerPresence([
  {success:true,results:[]},
]),false);
assert.equal(assertWorkMediaD1LedgerPresence([
  {success:true,results:[{name:'d1_migrations'}]},
]),true);
for(const bad of [
  [],null,[{success:false,results:[]}],
  [{success:true,results:[{name:'d1_migrations'},
    {name:'d1_migrations'}]}],
  [{success:true,results:[{name:'jill_merchant_authority'}]}],
  [{success:true,results:[{name:'d1_migrations',id:1}]}],
]){
  assert.throws(()=>assertWorkMediaD1LedgerPresence(bad));
}
assert.deepEqual(assertWorkMediaD1LedgerHistory([
  {success:true,results:[
    {name:'0001_staff_authority.sql'},
    {name:'0002_shopify_sessions.sql'},
  ]},
],{inboxTablePresent:false}),{
  migration_count:2,inbox_0003_recorded:false,
});
assert.deepEqual(assertWorkMediaD1LedgerHistory([
  {success:true,results:[
    {name:'0001_staff_authority.sql'},
    {name:'0002_shopify_sessions.sql'},
    {name:'0003_work_verified_inbox_index.sql'},
  ]},
],{inboxTablePresent:true}),{
  migration_count:3,inbox_0003_recorded:true,
});
for(const bad of [
  [{success:false,results:[]}],[],
  [{success:true,results:[{name:'0004_work_private_media_registry.sql'}]}],
  [{success:true,results:[{name:'0001_staff_authority.sql'},
    {name:'0001_staff_authority.sql'}]}],
  [{success:true,results:[{name:'0001_staff_authority.sql',
    customer_email:'private@example.invalid'}]}],
]){
  assert.throws(()=>assertWorkMediaD1LedgerHistory(bad));
}
assert.throws(()=>assertWorkMediaD1LedgerHistory([
  {success:true,results:[{name:'0003_work_verified_inbox_index.sql'}]},
],{inboxTablePresent:false}),/work_media_0003_recorded_but_table_missing/);
assert.equal(WORK_MEDIA_LEDGER_PRESENCE_SQL,
  "SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'");
assert.equal(WORK_MEDIA_LEDGER_HISTORY_SQL,
  'SELECT name FROM d1_migrations ORDER BY name');
for(const [step,sql] of [
  ['ledger_presence',WORK_MEDIA_LEDGER_PRESENCE_SQL],
  ['ledger_history',WORK_MEDIA_LEDGER_HISTORY_SQL],
]){
  const args=workMediaD1ReadCommand(step);
  assert.deepEqual(args.slice(0,3),
    ['d1','execute','jill-order-desk-work']);
  assert.ok(args.includes('--remote')&&args.includes('--json'));
  assert.equal(args[args.indexOf('--command')+1],sql);
  assert.doesNotMatch(sql,/;|PRAGMA|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE/i);
}

const parts=workMediaD1ReadCommand('schema_only');
assert.deepEqual(parts.slice(0,3),[
  'd1','execute','jill-order-desk-work']);
assert.ok(parts.includes('--remote'));
assert.ok(parts.includes('--json'));
assert.ok(parts.includes('--command'));
assert.equal(parts[parts.indexOf('--command')+1],WORK_MEDIA_SCHEMA_SQL);
assert.match(WORK_MEDIA_SCHEMA_SQL,/^SELECT name,type FROM sqlite_master/);
assert.doesNotMatch(WORK_MEDIA_SCHEMA_SQL,
  /;|PRAGMA|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE/i);
assert.deepEqual(workMediaD1ReadCommand('database_list'),
  ['d1','list','--config','./wrangler.canary.jsonc','--json']);
assert.deepEqual(workMediaD1ReadCommand('worker_status'),
  ['deployments','status','--name','jill-order-desk-canary-work',
    '--config','./wrangler.canary.jsonc']);
assert.ok(workMediaD1ReadCommand('worker_v34')
  .includes(DETAIL_ON_CANDIDATE));
for(const unsafe of ['migrate','deploy','secret','sql','execute',null,
  'worker_v33','list-tables']){
  assert.throws(()=>workMediaD1ReadCommand(unsafe),
    /disallowed_work_media_d1_operation/);
}
const root='services/jill-order-desk/';
assert.deepEqual(readdirSync(root+'migrations').sort(),[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
]);
const proposal=readFileSync(root+
  'migration-plans/0004_work_private_media_registry.sql','utf8');
assert.match(proposal,/INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION/);
const runtime=readFileSync(
  'scripts/inspect-work-hq-media-d1-preflight.mjs','utf8');
assert.doesNotMatch(runtime,
  /\bversions','(deploy|upload)'\b|wrangler d1 migrations apply|secret put/);
assert.match(runtime,/READ ONLY FAILURE PHASE/);
console.log('PASS WORK D1 READ-ONLY reconciliation: four-table pre-0003 and five-table states, optional migration-ledger metadata/history, invalid and forged records rejected; no migrations, secrets, customer queries or writes.');
