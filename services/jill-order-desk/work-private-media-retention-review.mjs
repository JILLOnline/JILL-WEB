// JILL WORK PHASE 24 — aggregate ONLY, source-only media review.
// No R2 reads/writes, SQL execution, Shopify API, object keys, URLs, PII,
// retention deadlines, automatic delete, refills, refunds or previews.
// This returns ONLY counts/bytes/age for a future Owner-approved review.
// It is NOT a provider attestation or a production retention policy.
const TYPES=Object.freeze([
  'reserved','ambiguous','quarantined_unlinked','revoked',
]);
const FIELDS=Object.freeze([
  'state','byte_length','created_at_ms','updated_at_ms',
]);
const DAY=86400000;
const LIMIT=10000;
const MAX=268435456;
const STOP=()=>{throw Error('work_media_retention_observation_unverified');};
const int=(n)=>Number.isSafeInteger(n)&&n>=0;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const WORK_RETENTION_READ_ONLY_SQL=
  'SELECT state,byte_length,created_at_ms,updated_at_ms '+
  'FROM jill_work_r2_object_intents';

/**
 * All rows MUST be server-projected from the four public-safe columns
 * above. Reject object identifiers and personal fields outright.
 * No specific retention period is assumed: only Owner may decide
 * retention/legal holds, manual deletion approval and audit controls.
 */
export function summarizeWorkPrivateMediaRetention({
  rows,nowMs,quotaReservedBytes,quotaLifetimeReservations,
}={}){
  if(!Array.isArray(rows)||rows.length>LIMIT||
     !int(nowMs)||nowMs<DAY||
     !int(quotaReservedBytes)||quotaReservedBytes>MAX||
     !int(quotaLifetimeReservations)||quotaLifetimeReservations>100000)
    STOP();
  const groups=Object.fromEntries(TYPES.map(k=>[
    k,{count:0,bytes:0,oldest_age_days:0,latest_change_age_days:0},
  ]));
  let sum=0;
  for(const row of rows){
    if(!object(row)||Object.keys(row).length!==FIELDS.length||
       FIELDS.some(key=>!Object.hasOwn(row,key))||
       !TYPES.includes(row.state)||
       !int(row.byte_length)||row.byte_length<20||
       row.byte_length>8388608||
       !int(row.created_at_ms)||row.created_at_ms<1||
       row.created_at_ms>nowMs||
       !int(row.updated_at_ms)||row.updated_at_ms<row.created_at_ms||
       row.updated_at_ms>nowMs)STOP();
    const g=groups[row.state];
    g.count++;
    g.bytes+=row.byte_length;
    g.oldest_age_days=Math.max(g.oldest_age_days,
      Math.floor((nowMs-row.created_at_ms)/DAY));
    g.latest_change_age_days=Math.max(g.latest_change_age_days,
      Math.floor((nowMs-row.updated_at_ms)/DAY));
    sum+=row.byte_length;
    if(!Number.isSafeInteger(sum)||sum>MAX)STOP();
  }
  if(rows.length>quotaLifetimeReservations||
     sum>quotaReservedBytes)STOP();
  const output=Object.freeze(Object.fromEntries(TYPES.map(k=>[
    k,Object.freeze({...groups[k]}),
  ])));
  return Object.freeze({
    state:rows.length?'manual_owner_review_required':
      'no_records_in_approved_projection',
    reporting_scope:'synthetic_or_authorized_server_aggregate_only',
    intent_count:rows.length,
    bytes_in_retained_intent_records:sum,
    reserved_quota_bytes:quotaReservedBytes,
    lifetime_quota_reservations:quotaLifetimeReservations,
    states:output,
    unknown_object_existence:true,
    provider_evidence_authenticated:false,
    retention_days_defined:false,
    legal_hold_checked:false,
    owner_disposition_authorized:false,
    auto_delete:false,
    manual_delete_authorized:false,
    auto_retry:false,
    auto_refund:false,
    quota_release_authorized:false,
    preview_enabled:false,
    upload_authorized:false,
    remote_migration_authorized:false,
    // A revoked D1 state does NOT prove object deletion or charge reversal.
    revoked_is_provider_deletion_proof:false,
  });
}
