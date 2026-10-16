// JILL WORK source-only durable R2 reservation SQL contract.
// No D1 network/API calls, Worker route, R2 binding, customer payload or
// authorization claim. DO NOT execute against remote D1 without approval.
// Account-wide R2 usage from all Cloudflare sources MUST be certified first.
export const WORK_R2_QUOTA_POLICY=Object.freeze({
  shop:'jill-work.myshopify.com',
  bucket:'jill-work-private-artwork',
  max_object_bytes:8*1024*1024,
  max_lifetime_reserved_bytes:256*1024*1024,
  max_month_uploads:40,
  estimated_class_a_per_upload:1, // R2 PUT
  estimated_class_b_per_upload:1, // R2 HEAD
  // Only modeled PUT + HEAD. Other R2 operations need their own gates.
});
const deny=()=>{throw Error('work_r2_quota_reservation_not_authorized');};
/**
 * One UPDATE is the entire reserved-operation decision. SQL WHERE bounds
 * decide atomically, not a separate SELECT. It is NOT yet a production
 * reservation: no real DB schema, account-wide proof, or Owner auth wired.
 * One failed/ambiguous upload continues to count. Month rollover cannot
 * reset the lifetime byte ceiling. No customer URL, object key or PII.
 */
export function planWorkR2QuotaReservation({shop,byteLength,nowMs}={}){
  const p=WORK_R2_QUOTA_POLICY;
  if(shop!==p.shop || !Number.isSafeInteger(nowMs)||nowMs<=0||
     !Number.isSafeInteger(byteLength)||
     byteLength<20||byteLength>p.max_object_bytes||
     new Date(nowMs).getUTCFullYear()<2026||
     new Date(nowMs).getUTCFullYear()>2100)deny();
  const monthKey=new Date(nowMs).toISOString().slice(0,7);
  const sql=[
    'UPDATE jill_work_r2_quota_guard',
    'SET lifetime_reserved_bytes=lifetime_reserved_bytes+?,',
    'month_uploads=CASE WHEN month_key=? THEN month_uploads+1 ELSE 1 END,',
    'month_class_a=CASE WHEN month_key=? THEN month_class_a+1 ELSE 1 END,',
    'month_class_b=CASE WHEN month_key=? THEN month_class_b+1 ELSE 1 END,',
    'month_key=?,lifetime_reservations=lifetime_reservations+1',
    'WHERE shop=? AND lifetime_reserved_bytes<=268435456-?',
    'AND lifetime_reservations<100000',
    'AND (month_key<? OR (month_key=? AND month_uploads<40',
    'AND month_class_a<40 AND month_class_b<40))',
    'RETURNING shop,month_key,lifetime_reserved_bytes,month_uploads,',
    'month_class_a,month_class_b,lifetime_reservations',
  ].join(' ');
  return Object.freeze({
    state:'sql_plan_only_not_executed',
    sql,
    params:Object.freeze([
      byteLength,monthKey,monthKey,monthKey,monthKey,
      p.shop,byteLength,monthKey,monthKey,
    ]),
    private_delivery:'disabled',
    upload_enabled:false,
    account_usage_verified:false,
    remote_migration_authorized:false,
  });
}
export function inspectWorkR2QuotaReservationRow({row,monthKey}={}){
  const p=WORK_R2_QUOTA_POLICY;
  if(!row||typeof row!=='object'||Array.isArray(row)||
     row.shop!==p.shop||row.month_key!==monthKey||
     !Number.isSafeInteger(row.lifetime_reserved_bytes)||
     row.lifetime_reserved_bytes<20||
     row.lifetime_reserved_bytes>p.max_lifetime_reserved_bytes||
     !Number.isSafeInteger(row.month_uploads)||
     row.month_uploads<1||row.month_uploads>p.max_month_uploads||
     row.month_class_a!==row.month_uploads||
     row.month_class_b!==row.month_uploads||
     !Number.isSafeInteger(row.lifetime_reservations)||
     row.lifetime_reservations<1||
     row.lifetime_reservations>100000)deny();
  return Object.freeze({
    state:'quota_reserved_without_storage_authority',
    month:monthKey,private_delivery:'disabled',
    upload_enabled:false,provider_usage_unverified:true,
  });
}
