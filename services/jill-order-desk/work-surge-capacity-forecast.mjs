// JILL WORK SCALE GATE v1 — forecasting ONLY, no HTTP admission.
// Source-only, no deployment, provider access, payment, D1, R2 or Queues.
// Units are explicit. No customer identifiers or payloads are accepted.
// IMPORTANT: This is a hypothetical envelope and NEVER an authorization
// to accept payment, confirm an order, process uploads or increase spend.
// Sources reviewed October 2026: Workers, D1, R2 and Queues docs.
export const JILL_SCALE_FREE_REFERENCE=Object.freeze({
  worker_requests_per_day:100000,
  d1_rows_written_per_day:100000,
  d1_rows_read_per_day:5000000,
  queues_operations_per_day:10000,
  r2_standard_gb_month_bytes:10000000000, // 10 decimal GB-month
});
export const JILL_SCALE_WORK_PILOT=Object.freeze({
  media_uploads_per_month:40,
  max_single_sanitized_bytes:8*1024*1024,
  lifetime_media_reserved_bytes:256*1024*1024,
});
const INPUT_FIELDS=Object.freeze([
  'storefront_visitors_per_day',
  'worker_requests_per_day',
  'd1_rows_written_per_day',
  'd1_rows_read_per_day',
  'queue_operations_per_day',
  'media_uploads_per_month',
  'media_total_sanitized_bytes',
  'media_largest_sanitized_bytes',
]);
const err=()=>{throw Error('jill_work_scale_forecast_invalid');};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const freeze=o=>Object.freeze(o);
/**
 * @param {object} input Strict aggregate-only hypothetical counts; NOT live
 * metrics and not a Shopify authenticated customer/merchant request.
 * Daily requests count ONLY requests hitting the JILL Worker, not
 * independent Shopify storefront traffic. For R2 volume we compare
 * stored-for-a-whole-month bytes as a WORST-CASE occupancy example,
 * not a prediction of GB-month charges.
 */
export function evaluateJillWorkSurgeForecast(input){
  if(!obj(input)||Object.keys(input).length!==INPUT_FIELDS.length||
     INPUT_FIELDS.some(key=>!Object.hasOwn(input,key)||
       !integer(input[key])))err();
  const x=input;
  if((x.media_uploads_per_month===0 &&
      (x.media_total_sanitized_bytes!==0||
       x.media_largest_sanitized_bytes!==0))||
     (x.media_uploads_per_month>0 &&
      (x.media_largest_sanitized_bytes<20||
       x.media_total_sanitized_bytes<x.media_largest_sanitized_bytes||
       x.media_total_sanitized_bytes<x.media_uploads_per_month*20))||
     !Number.isSafeInteger(x.media_uploads_per_month*20))err();

  const flags=freeze({
    worker_free_daily_exceeded:
      x.worker_requests_per_day>
      JILL_SCALE_FREE_REFERENCE.worker_requests_per_day,
    d1_free_writes_exceeded:
      x.d1_rows_written_per_day>
      JILL_SCALE_FREE_REFERENCE.d1_rows_written_per_day,
    d1_free_reads_exceeded:
      x.d1_rows_read_per_day>
      JILL_SCALE_FREE_REFERENCE.d1_rows_read_per_day,
    queues_free_daily_exceeded:
      x.queue_operations_per_day>
      JILL_SCALE_FREE_REFERENCE.queues_operations_per_day,
    media_monthly_pilot_exceeded:
      x.media_uploads_per_month>
      JILL_SCALE_WORK_PILOT.media_uploads_per_month,
    media_single_pilot_bytes_exceeded:
      x.media_largest_sanitized_bytes>
      JILL_SCALE_WORK_PILOT.max_single_sanitized_bytes,
    media_total_pilot_reserved_bytes_exceeded:
      x.media_total_sanitized_bytes>
      JILL_SCALE_WORK_PILOT.lifetime_media_reserved_bytes,
    // Conditional on all these bytes remaining stored for ~30 days.
    r2_standard_free_volume_may_be_exceeded:
      x.media_total_sanitized_bytes>
      JILL_SCALE_FREE_REFERENCE.r2_standard_gb_month_bytes,
  });
  const blocking=freeze(Object.keys(flags).filter(k=>flags[k]));
  return freeze({
    status:'planning_only_never_process_or_bill',
    input_summary:freeze({...x}),
    limit_exceedances:flags,
    blocking_thresholds:blocking,
    free_reference_exceeded:blocking.some(k=>
      k.includes('_free_')||k==='r2_standard_free_volume_may_be_exceeded'),
    pilot_media_capacity_exceeded:blocking.some(k=>
      k.startsWith('media_')),
    storefront_checkout_owner:'shopify_native_not_jill_worker',
    custom_order_ack_rule:'only_after_durable_server_ack',
    custom_order_intake_when_unavailable:'explicit_unavailable_not_saved',
    queue_rule:'after_durable_commit_only_no_payload_images',
    queue_overflow_rule:'backpressure_and_deferred_work_not_lost_ack',
    private_media_rule:'off_until_separately_approved',
    merchant_identity_rule:'server_auth_required_before_private_reads',
    account_usage_is_actual:false,
    shopify_api_plan_and_throttle_not_verified:true,
    latency_load_test_completed:false,
    queue_durability_under_load_not_tested:true,
    spending_cap_proven:false,
    payment_approval_granted:false,
    paid_upgrade_authorized:false,
    production_admission_authorized:false,
    upload_authorized:false,
    customer_preview_authorized:false,
    remote_migration_authorized:false,
    deployment_authorized:false,
    // A simulation of one million inputs says nothing about throughput
    // without real concurrency/load/latency testing and billing review.
    million_customer_capacity_certified:false,
  });
}
