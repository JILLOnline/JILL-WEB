// Source-only, synthetic hypothetical million-WORK-transaction shock test.
// NOT a load test. No Cloudflare/Shopify calls, customer PII, deployment,
// billing, enrollment, account reads or real capacity authorization.
import {evaluateJillWorkSurgeForecast} from
  '../services/jill-order-desk/work-surge-capacity-forecast.mjs';
const scenario={
  storefront_visitors_per_day:1000000,
  worker_requests_per_day:1000000,
  d1_rows_written_per_day:3000000,
  d1_rows_read_per_day:10000000,
  queue_operations_per_day:3000000,
  media_uploads_per_month:1000000,
  media_total_sanitized_bytes:100000000000,
  media_largest_sanitized_bytes:100000,
};
function fail(){throw Error('jill_scale_simulation_not_certified');}
try{
  if(process.argv.length!==3||process.argv[2]!=='--simulate-million')
    fail();
  const r=evaluateJillWorkSurgeForecast(scenario);
  if(r.status!=='planning_only_never_process_or_bill'||
     !r.free_reference_exceeded||!r.pilot_media_capacity_exceeded||
     r.million_customer_capacity_certified!==false||
     r.paid_upgrade_authorized!==false||
     r.upload_authorized!==false||r.spending_cap_proven!==false)
    fail();
  console.log('SCENARIO ONLY: 1,000,000 Shopify visitors AND 1,000,000 JILL Worker requests/day.');
  console.log('Hypothetical D1 daily row writes: '+scenario.d1_rows_written_per_day);
  console.log('Hypothetical Queues daily operations: '+scenario.queue_operations_per_day);
  console.log('Hypothetical monthly media volume (decimal GB): '+
    scenario.media_total_sanitized_bytes/1000000000);
  console.log('CAPACITY BLOCKERS (source-only):');
  for(const k of r.blocking_thresholds)console.log('  '+k);
  console.log('HOLD: This is an arithmetic estimate, NOT a measured load test, billing guarantee, or production admission permission.');
  console.log('SAFE FALLBACK: Shopify-native checkout independent; WORK custom intake/media refuse unsaved, unfunded or unverified writes.');
}catch(error){
  console.error('STOP WORK SCALE SIMULATION: jill_scale_simulation_not_certified');
  process.exitCode=1;
}
