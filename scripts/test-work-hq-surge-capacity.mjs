// JILL WORK surge model OFFLINE tests. No load injection, customer
// records, network calls, Cloudflare/Shopify API access or paid actions.
import assert from 'node:assert/strict';
import {
  evaluateJillWorkSurgeForecast as evaluate,
  JILL_SCALE_FREE_REFERENCE as limits,
  JILL_SCALE_WORK_PILOT as pilot,
} from '../services/jill-order-desk/work-surge-capacity-forecast.mjs';

let checks=0;
const example={
  storefront_visitors_per_day:1000000,
  worker_requests_per_day:0, // Shopify-native visits don't hit WORK
  d1_rows_written_per_day:0,
  d1_rows_read_per_day:0,
  queue_operations_per_day:0,
  media_uploads_per_month:0,
  media_total_sanitized_bytes:0,
  media_largest_sanitized_bytes:0,
};
const check=values=>{
  const report=evaluate(values);
  checks++;
  assert.equal(report.production_admission_authorized,false);
  assert.equal(report.paid_upgrade_authorized,false);
  assert.equal(report.payment_approval_granted,false);
  assert.equal(report.spending_cap_proven,false);
  assert.equal(report.upload_authorized,false);
  assert.equal(report.customer_preview_authorized,false);
  assert.equal(report.million_customer_capacity_certified,false);
  assert.equal(report.account_usage_is_actual,false);
  assert.equal(report.latency_load_test_completed,false);
  assert.equal(report.deployment_authorized,false);
  assert.equal(report.remote_migration_authorized,false);
  assert.equal(report.custom_order_ack_rule,'only_after_durable_server_ack');
  assert.equal(report.storefront_checkout_owner,'shopify_native_not_jill_worker');
  assert.equal(Object.isFrozen(report),true);
  assert.equal(Object.isFrozen(report.limit_exceedances),true);
  assert.equal(Object.isFrozen(report.blocking_thresholds),true);
  const json=JSON.stringify(report);
  for(const forbidden of ['object_key','reference_mac','customer_email',
    'customer_id','phone','access_token','session_secret']){
    assert.equal(json.includes(forbidden),false,forbidden);
  }
  return report;
};
const storefrontOnly=check(example);
assert.equal(storefrontOnly.blocking_thresholds.length,0);
assert.equal(storefrontOnly.free_reference_exceeded,false);
// Exactly at pilot caps is a projection, never permission to upload.
const atThreshold=check({
  ...example,
  worker_requests_per_day:limits.worker_requests_per_day,
  d1_rows_written_per_day:limits.d1_rows_written_per_day,
  d1_rows_read_per_day:limits.d1_rows_read_per_day,
  queue_operations_per_day:limits.queues_operations_per_day,
  media_uploads_per_month:pilot.media_uploads_per_month,
  media_total_sanitized_bytes:40*1024*1024,
  media_largest_sanitized_bytes:1024*1024,
});
assert.equal(atThreshold.blocking_thresholds.length,0);
// 1 million calls directly to JILL WORK on Free needs a real
// capacity/paid tier decision. 1 million Shopify page views alone
// do not imply these Worker or D1 numbers.
const surge=check({
  ...example,worker_requests_per_day:1000000,
  d1_rows_written_per_day:3000000,
  d1_rows_read_per_day:10000000,
  queue_operations_per_day:3000000,
  media_uploads_per_month:1000000,
  media_total_sanitized_bytes:100000000000,
  media_largest_sanitized_bytes:100000,
});
assert.equal(surge.free_reference_exceeded,true);
assert.equal(surge.pilot_media_capacity_exceeded,true);
assert.equal(surge.blocking_thresholds.length,7);
assert.equal(surge.limit_exceedances.worker_free_daily_exceeded,true);
assert.equal(surge.limit_exceedances.d1_free_writes_exceeded,true);
assert.equal(surge.limit_exceedances.d1_free_reads_exceeded,true);
assert.equal(surge.limit_exceedances.queues_free_daily_exceeded,true);
assert.equal(surge.limit_exceedances.media_monthly_pilot_exceeded,true);
assert.equal(surge.limit_exceedances.r2_standard_free_volume_may_be_exceeded,true);
assert.equal(surge.limit_exceedances.media_single_pilot_bytes_exceeded,false);
// One oversized object must not be interpreted as legal even if
// overall volume is tiny.
const oversized=check({...example,media_uploads_per_month:1,
  media_total_sanitized_bytes:9*1024*1024,
  media_largest_sanitized_bytes:9*1024*1024});
assert.equal(oversized.limit_exceedances.media_single_pilot_bytes_exceeded,true);
// A total > lifetime cap must be surfaced, independently from number
// of uploads and per-object size.
const lifetime=check({...example,media_uploads_per_month:40,
  media_total_sanitized_bytes:40*8*1024*1024,
  media_largest_sanitized_bytes:8*1024*1024});
assert.equal(lifetime.limit_exceedances.media_total_pilot_reserved_bytes_exceeded,true);
assert.equal(lifetime.limit_exceedances.media_monthly_pilot_exceeded,false);
const reject=input=>{
  assert.throws(()=>evaluate(input),/jill_work_scale_forecast_invalid/);
  checks++;
};
for(const x of [
  null,undefined,'million',[],{},NaN,Infinity,0,
  {...example,email:'customer@example.invalid'},
  {...example,customer_id:'customer-1'},
  {...example,worker_requests_per_day:-1},
  {...example,worker_requests_per_day:NaN},
  {...example,worker_requests_per_day:Infinity},
  {...example,worker_requests_per_day:1.2},
  {...example,worker_requests_per_day:Number.MAX_SAFE_INTEGER+1},
  {...example,media_uploads_per_month:0,
    media_total_sanitized_bytes:1000},
  {...example,media_uploads_per_month:1,
    media_total_sanitized_bytes:0,media_largest_sanitized_bytes:0},
  {...example,media_uploads_per_month:1,
    media_total_sanitized_bytes:20,media_largest_sanitized_bytes:30},
  {...example,media_uploads_per_month:100,
    media_total_sanitized_bytes:100,media_largest_sanitized_bytes:30},
  {...example,media_largest_sanitized_bytes:25},
])reject(x);
assert.equal(limits.worker_requests_per_day,100000);
assert.equal(limits.d1_rows_written_per_day,100000);
assert.equal(limits.d1_rows_read_per_day,5000000);
assert.equal(limits.queues_operations_per_day,10000);
assert.equal(pilot.media_uploads_per_month,40);
console.log('PASS JILL WORK surge capacity: '+checks+
  ' aggregate-only scenarios, million-visitor Shopify separation,'+
  ' million-transaction limits and oversize/invalid fields rejected;'+
  ' NO load, billing, production throughput or deployment certification.');
