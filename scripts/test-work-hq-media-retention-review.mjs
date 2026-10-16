// Phase 24: offline manual retention review; no real Cloudflare/D1,
// customer accounts or image bytes. Never approves an R2 deletion.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  summarizeWorkPrivateMediaRetention as summarize,
  WORK_RETENTION_READ_ONLY_SQL as SQL,
} from '../services/jill-order-desk/work-private-media-retention-review.mjs';

const DAY=86400000;
const now=Date.parse('2026-10-16T18:00:00Z');
const rows=[
  {state:'reserved',byte_length:100,
    created_at_ms:now-11*DAY,updated_at_ms:now-11*DAY},
  {state:'ambiguous',byte_length:110,
    created_at_ms:now-7*DAY,updated_at_ms:now-2*DAY},
  {state:'quarantined_unlinked',byte_length:120,
    created_at_ms:now-6*DAY,updated_at_ms:now-DAY},
  {state:'revoked',byte_length:130,
    created_at_ms:now-4*DAY,updated_at_ms:now-DAY},
];
const base={rows,nowMs:now,quotaReservedBytes:460,
  quotaLifetimeReservations:4};
let cases=0;
function verifySafety(summary){
  for(const field of [
    'upload_authorized','preview_enabled','auto_retry',
    'auto_delete','manual_delete_authorized','auto_refund',
    'quota_release_authorized','retention_days_defined',
    'legal_hold_checked','provider_evidence_authenticated',
    'owner_disposition_authorized','remote_migration_authorized',
    'revoked_is_provider_deletion_proof',
  ])assert.equal(summary[field],false,field+' must be disabled');
  assert.equal(summary.unknown_object_existence,true);
  const serialized=JSON.stringify(summary);
  for(const forbidden of [
    'work/quarantine/v1/','jill:','example@','object_key',
    'reference_mac','reservation_id','customer_id','phone',
    'https://',
  ])assert.equal(serialized.includes(forbidden),false,
    'Never expose identifier '+forbidden);
  assert.equal(Object.isFrozen(summary),true);
  cases++;
}
const full=summarize(base);
verifySafety(full);
assert.equal(full.state,'manual_owner_review_required');
assert.equal(full.intent_count,4);
assert.equal(full.bytes_in_retained_intent_records,460);
assert.equal(full.reserved_quota_bytes,460);
assert.equal(full.lifetime_quota_reservations,4);
assert.equal(full.unmatched_accounting_possible,false);
for(const state of ['reserved','ambiguous','quarantined_unlinked','revoked']){
  assert.equal(full.states[state].count,1);
  assert.equal(Object.isFrozen(full.states[state]),true);
}
assert.equal(full.states.reserved.oldest_age_days,11);
assert.equal(full.states.ambiguous.latest_change_age_days,2);
assert.equal(full.states.revoked.bytes,130);
const empty=summarize({
  rows:[],nowMs:now,quotaReservedBytes:0,quotaLifetimeReservations:0,
});
verifySafety(empty);
assert.equal(empty.state,'no_records_in_approved_projection');
const orphan=summarize({
  rows:[],nowMs:now,quotaReservedBytes:999,
  quotaLifetimeReservations:1,
});
verifySafety(orphan);
assert.equal(orphan.state,'manual_owner_review_required');
assert.equal(orphan.unmatched_accounting_possible,true);
const partial=summarize({...base,quotaReservedBytes:1000,
  quotaLifetimeReservations:9});
verifySafety(partial);
assert.equal(partial.unmatched_accounting_possible,true);
const deny=x=>{
  assert.throws(()=>summarize(x),/work_media_retention_observation_unverified/);
  cases++;
};
for(const value of [undefined,null,{},'hello',[],42])
  deny(value);
for(const value of [null,{},'x',5])
  deny({...base,rows:value});
for(const state of ['uploaded','private','public','deleted','pending','']){
  deny({...base,rows:[{...rows[0],state}]});
}
for(const invalid of [
  {...rows[0],byte_length:0},
  {...rows[0],byte_length:19},
  {...rows[0],byte_length:8388609},
  {...rows[0],byte_length:NaN},
  {...rows[0],byte_length:55.5},
  {...rows[0],created_at_ms:now+1},
  {...rows[0],updated_at_ms:now+1},
  {...rows[0],updated_at_ms:rows[0].created_at_ms-1},
  {...rows[0],updated_at_ms:undefined},
  {...rows[0],object_key:'work/quarantine/v1/hidden'},
  {...rows[0],reference_mac:'a'.repeat(64)},
  {...rows[0],email:'private@example.invalid'},
  {...rows[0],phone:'0000000000'},
  {...rows[0],customer_id:1},
  {state:'reserved',byte_length:30,created_at_ms:now-1000},
]){
  deny({...base,rows:[invalid]});
}
for(const x of [
  {...base,quotaReservedBytes:459},
  {...base,quotaReservedBytes:268435457},
  {...base,quotaReservedBytes:-1},
  {...base,quotaLifetimeReservations:3},
  {...base,quotaLifetimeReservations:-1},
  {...base,nowMs:rows[3].updated_at_ms-1},
  {...base,rows:Array.from({length:10001},()=>rows[0])},
  {...base,rows:[{...rows[0],byte_length:8388608}],
    quotaReservedBytes:8388607},
])deny(x);
assert.equal(SQL,
  'SELECT state,byte_length,created_at_ms,updated_at_ms '+
  'FROM jill_work_r2_object_intents');
const file=readFileSync(fileURLToPath(new URL(
  '../services/jill-order-desk/work-private-media-retention-review.mjs',
  import.meta.url)),'utf8');
assert.doesNotMatch(file,
  /\bfetch\(|\br2\.put\(|\bdb\.(?:prepare|batch|exec)\(|\bdeleteFrom\(/);
assert.doesNotMatch(file,
  /shopify\.authenticate|R2Bucket\.delete|wrangler deploy/);
console.log('PASS WORK Phase 24 OFFLINE retention review: '+cases+
  ' synthetic cases, all four states, redacted aggregate-only reporting, '+
  'orphan quota escalation, no fabricated deletion deadlines, '+
  'auto-delete, retry, refund, preview or remote I/O.');
