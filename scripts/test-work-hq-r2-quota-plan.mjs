// Entirely OFFLINE in-memory SQLite test of inert WORK R2 quota design.
// No Cloudflare, D1, R2, external image, customer data, auth or deployment.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  WORK_R2_QUOTA_POLICY as policy,
  planWorkR2QuotaReservation as plan,
  inspectWorkR2QuotaReservationRow as inspect,
} from '../services/jill-order-desk/work-private-r2-quota-plan.mjs';
const root='services/jill-order-desk/';
const active=readdirSync(root+'migrations').sort();
assert.deepEqual(active,[
  '0001_staff_authority.sql',
  '0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
]);
const registry=readFileSync(root+
  'migration-plans/0004_work_private_media_registry.sql','utf8');
assert.match(registry,/INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION/);
const sql=readFileSync(root+
  'migration-plans/0005_work_r2_quota_guard.sql','utf8');
assert.match(sql,/INERT PROPOSAL ONLY: NOT AN APPLIED D1 MIGRATION/);
assert.doesNotMatch(sql,/https?:|cloudinary|customer|email|url|token/i);
const db=new DatabaseSync(':memory:');
try{
  db.exec('PRAGMA foreign_keys=ON;');
  for(const file of active)
    db.exec(readFileSync(root+'migrations/'+file,'utf8'));
  db.exec(sql); db.exec(sql); // no duplication when replayed offline
  const table=()=>db.prepare(
    'SELECT * FROM jill_work_r2_quota_guard WHERE shop=?'
  ).get(policy.shop);
  assert.deepEqual({...table()},{
    shop:policy.shop,month_key:'0000-00',
    lifetime_reserved_bytes:0,month_uploads:0,
    month_class_a:0,month_class_b:0,lifetime_reservations:0,
  });
  assert.equal(policy.max_lifetime_reserved_bytes,256*1024*1024);
  assert.equal(policy.max_month_uploads,40);
  assert.equal(policy.max_object_bytes,8*1024*1024);

  const reserve=(size,month='2026-10')=>{
    const contract=plan({shop:policy.shop,byteLength:size,
      nowMs:Date.parse(month+'-16T12:00:00.000Z')});
    assert.equal(contract.state,'sql_plan_only_not_executed');
    assert.equal(contract.upload_enabled,false);
    assert.equal(contract.account_usage_verified,false);
    assert.equal(contract.private_delivery,'disabled');
    const stmt=db.prepare(contract.sql);
    return stmt.get(...contract.params);
  };
  assert.equal(reserve(1024).lifetime_reserved_bytes,1024);
  const first=inspect({row:table(),monthKey:'2026-10'});
  assert.equal(first.state,'quota_reserved_without_storage_authority');
  assert.equal(first.upload_enabled,false);
  assert.ok(Object.isFrozen(first));

  for(let n=1;n<40;n++)assert.ok(reserve(1024),
    'all 40 October reservations must fit');
  assert.equal(table().month_uploads,40);
  assert.equal(table().month_class_a,40);
  assert.equal(table().month_class_b,40);
  assert.equal(table().lifetime_reservations,40);
  const frozen=structuredClone(table());
  assert.equal(reserve(1024),undefined,'41st in same month denied');
  assert.deepEqual({...table()},frozen,'failed reservation is no-op');
  assert.ok(reserve(1024,'2026-11'),'month rollover permitted');
  assert.equal(table().month_uploads,1);
  assert.equal(table().month_key,'2026-11');
  assert.equal(table().lifetime_reservations,41);
  assert.equal(table().lifetime_reserved_bytes,41*1024);
  assert.equal(reserve(1024,'2026-10'),undefined,
    'older months cannot reset counters');

  // Consume remaining lifetime capacity in later months; never refund
  // even when a simulated PUT fails or a billing month changes.
  for(let i=0;i<31;i++) assert.ok(reserve(8*1024*1024,'2026-12'));
  let remain=policy.max_lifetime_reserved_bytes-
    table().lifetime_reserved_bytes;
  assert.ok(remain>20&&remain<8*1024*1024);
  assert.ok(reserve(remain,'2026-12'));
  assert.equal(table().lifetime_reserved_bytes,
    policy.max_lifetime_reserved_bytes);
  const cap=structuredClone(table());
  assert.equal(reserve(20,'2027-01'),undefined);
  assert.deepEqual({...table()},cap);
  assert.equal(db.prepare(
    'SELECT COUNT(*) n FROM jill_work_r2_quota_guard').get().n,1);

  for(const bad of [
    {shop:'jillonlinestore.myshopify.com',byteLength:20,nowMs:1792152000000},
    {shop:policy.shop,byteLength:0,nowMs:1792152000000},
    {shop:policy.shop,byteLength:8*1024*1024+1,nowMs:1792152000000},
    {shop:policy.shop,byteLength:3.14,nowMs:1792152000000},
    {shop:policy.shop,byteLength:100,nowMs:NaN},
    {shop:policy.shop,byteLength:100,nowMs:-10},
    {shop:policy.shop,byteLength:100,nowMs:0},
  ]) assert.throws(()=>plan(bad),/work_r2_quota_reservation_not_authorized/);
  for(const bad of [
    {...table(),shop:'jill-live.myshopify.com'},
    {...table(),month_uploads:41},
    {...table(),lifetime_reserved_bytes:999999999},
    {...table(),month_class_a:1},
    {...table(),lifetime_reservations:-1},
  ]) assert.throws(()=>inspect({row:bad,monthKey:'2026-12'}),
    /work_r2_quota_reservation_not_authorized/);

  // Schema-level refusal to wipe counters, backdate or alter shop.
  assert.throws(()=>db.prepare(
    'DELETE FROM jill_work_r2_quota_guard').run(),/quota_delete_forbidden/);
  assert.throws(()=>db.prepare(
    'UPDATE jill_work_r2_quota_guard SET lifetime_reserved_bytes=0'
  ).run(),/quota_monotonic_violation/);
  assert.throws(()=>db.prepare(
    "UPDATE jill_work_r2_quota_guard SET month_key='2026-01'"
  ).run(),/quota_monotonic_violation/);
  assert.throws(()=>db.prepare(
    "UPDATE jill_work_r2_quota_guard SET shop='jill-live.myshopify.com'"
  ).run());
  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_shopify_sessions').get().n,0);
  assert.equal(db.prepare('SELECT generation FROM jill_work_verified_inbox_index').get().generation,0);
  console.log('PASS WORK R2 quota SQL PLAN offline: atomic single-statement reservations, October 40/41 limit, monotonic lifetime 256MiB cap across months, wrong shop/period and destructive changes denied; no remote writes.');
}finally{db.close();}
