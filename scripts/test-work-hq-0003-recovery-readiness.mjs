import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  work0003RecoveryReadArgs,assertWork0003D1Info,
  assertWork0003Bookmark,assertWork0003ReadOnlyBaseline,
} from './inspect-work-hq-0003-recovery-readiness.mjs';
const id='3f17c186-c794-4e00-8f20-017191373a19';
assert.deepEqual(work0003RecoveryReadArgs('database_info'),
  ['d1','info','jill-order-desk-work',
    '--config','./wrangler.canary.jsonc','--json']);
assert.deepEqual(work0003RecoveryReadArgs('time_travel_current'),
  ['d1','time-travel','info','jill-order-desk-work',
    '--config','./wrangler.canary.jsonc','--json']);
for(const cmd of ['restore','time_travel_restore','apply',
  'd1','export','secret','deploy','database_delete',
  'time_travel_past',null,undefined]){
  assert.throws(()=>work0003RecoveryReadArgs(cmd),
    /unsafe_recovery_operation_refused/);
}
const expected=[
  'PASS exact WORK canary v34 and exact D1 binding/Cloudflare account database identity.',
  'PASS remote WORK D1 schema recognized: 4 existing JILL tables; media registry ABSENT.',
  'HOLD: jill_work_verified_inbox_index is MISSING from remote D1.',
  'HOLD: D1 ledger contains 2 recognized migration name(s); 0003 not recorded.',
].join('\n');
assert.equal(assertWork0003ReadOnlyBaseline(expected),true);
for(const bad of [
  expected.replace('4 existing','5 existing'),
  expected.replace('0003 not recorded','0003 recorded'),
  expected.replace('media registry ABSENT','media registry PRESENT'),
  expected+' WORK MEDIA D1 PREFLIGHT STOPPED',null,undefined,
]){
  assert.throws(()=>assertWork0003ReadOnlyBaseline(bad),
    /work_0003_baseline_changed/);
}
assert.deepEqual(assertWork0003D1Info({
  name:'jill-order-desk-work',uuid:id,version:'production',
}),{database:'jill-order-desk-work',backend:'production'});
assert.deepEqual(assertWork0003D1Info({result:{
  name:'jill-order-desk-work',id,version:'production',
}}),{database:'jill-order-desk-work',backend:'production'});
// Exact field names observed in the real WORK Wrangler JSON on 2026-10-16.
// The optional storage "version" is absent: this alone must NEVER claim
// a production backend. The bookmark endpoint must prove capability.
const actualInfo={
  uuid:id,name:'jill-order-desk-work',
  created_at:'2026-10-14T00:00:00Z',num_tables:6,
  running_in_region:'ENAM',read_replication:{mode:'disabled'},
  jurisdiction:null,database_size:69632,
  read_queries_24h:22,write_queries_24h:0,
  rows_read_24h:70,rows_written_24h:0,
};
assert.equal(Object.hasOwn(actualInfo,'version'),false);
assert.deepEqual(assertWork0003D1Info(actualInfo),{
  database:'jill-order-desk-work',backend:'not_reported',
});
assert.deepEqual(assertWork0003D1Info({result:actualInfo}),{
  database:'jill-order-desk-work',backend:'not_reported',
});
assert.notEqual(assertWork0003D1Info(actualInfo).backend,'production');
for(const bad of [
  null,[],{},{
    name:'jill-order-desk-work',uuid:id,version:'alpha',
  },{
    name:'jill-order-desk-work',uuid:'LIVE',version:'production',
  },{
    name:'jillonlinestore',uuid:id,version:'production',
  },{
    name:'jill-order-desk-work',version:'production',
  },
  {...actualInfo,version:'alpha'},
  {...actualInfo,version:'staging'},
  {...actualInfo,version:null},
  {...actualInfo,uuid:'LIVE_DB'},
  {...actualInfo,id:'LIVE_DB'},
  {...actualInfo,name:'jillonlinestore'},
]){
  assert.throws(()=>assertWork0003D1Info(bad),
    /work_0003_time_travel_backend_unverified/);
}
// Provider bookmark format is opaque. Never allow its bytes into a
// receipt, log, D1 write, browser payload or attached evidence.
const bookmark='00000085-0000024c-00004c6d-8e61117bf38d7adb71b934ebbf891683';
const expectedReceipt={retrievable:true,bookmarkStored:false};
assert.deepEqual(assertWork0003Bookmark({bookmark}),expectedReceipt);
assert.deepEqual(assertWork0003Bookmark({result:{bookmark}}),expectedReceipt);
assert.ok(!JSON.stringify(assertWork0003Bookmark({bookmark}))
  .includes(bookmark));
for(const bad of [
  {},null,{bookmark:''},{bookmark:'x'},
  {bookmark:'a'.repeat(200)},
  {bookmark:'restore --bookmark malicious'},
  {bookmark:'https://evil.example'},
  {bookmark:42},
]){
  assert.throws(()=>assertWork0003Bookmark(bad),
    /work_0003_bookmark_unverified/);
}
const runtime=readFileSync(
  'scripts/inspect-work-hq-0003-recovery-readiness.mjs','utf8');
assert.match(runtime,/READ ONLY FAILURE PHASE/);
assert.match(runtime,/bookmark NOT printed or stored/);
assert.doesNotMatch(runtime,/\b(?:spawnSync|execFileSync)\([^)]*['"]restore['"]/);
assert.doesNotMatch(runtime,/d1.*\bmigrations.*apply/);
assert.doesNotMatch(runtime,/wrangler.*\bsecret\s+put/);
console.log('PASS WORK 0003 recovery contract: observed D1 info without version accepted only for read-only Time Travel probe; explicit alpha/unknown rejected, exact WORK UUID pinned, bookmark unexposed; no real provider calls.');
