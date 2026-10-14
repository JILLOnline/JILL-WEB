// Internal WORK D1 authorization adapter. No public HTTP router is registered
// here. Shopify's trusted authenticate.admin() must have completed before
// any function receives a session. No browser-provided grant is accepted.
import {
  requireWorkMerchantIdentity,JILL_WORK_MERCHANT_SHOP,
  JILL_WORK_MERCHANT_CLIENT_ID,
} from '../../backend/jill-merchant-auth.mjs';
import {evaluateJillMerchantPermission} from '../../backend/jill-merchant-policy.mjs';

function databaseReady(db) {
  return db && typeof db.prepare==='function';
}

export async function readWorkMerchantPermission({
  db,session,action,assignedStaffIds=null,
}={}) {
  // Authentication precedes all queries; fail closed on D1 faults.
  let identity;
  try {identity=requireWorkMerchantIdentity(session);}
  catch {return {allowed:false,code:'unauthenticated'};}
  if(!databaseReady(db))return {allowed:false,code:'authority_unavailable'};
  try {
    const authority=await db.prepare(
      'SELECT shop,environment,app_client_id,owner_staff_id,policy_version '+
      'FROM jill_merchant_authority WHERE shop=?',
    ).bind(identity.shop).first();
    if(!authority)return {allowed:false,code:'authority_unavailable'};
    const grant=await db.prepare(
      'SELECT shop,staff_id,role,active,capabilities_json '+
      'FROM jill_merchant_grants WHERE shop=? AND staff_id=?',
    ).bind(identity.shop,identity.staffId).first();
    return evaluateJillMerchantPermission({
      identity,authority,grant,action,assignedStaffIds,
    });
  } catch {
    return {allowed:false,code:'authority_unavailable'};
  }
}

// Explicit single-use commissioning operation, not a website endpoint.
// Requires verified Shopify WORK store owner AND opt-in flag. The first
// successful store binding wins; repeat by the same owner is idempotent.
// D1.batch is transactional, so the initial audit and owner record commit
// together or roll back together.
export async function bootstrapWorkMerchantOwner({
  db,session,allowBootstrap=false,now=()=>new Date().toISOString(),
}={}) {
  if(allowBootstrap!==true)throw Error('owner_bootstrap_disabled');
  const identity=requireWorkMerchantIdentity(session);
  if(!identity.shopifyAccountOwner)throw Error('owner_bootstrap_forbidden');
  if(!databaseReady(db)||typeof db.batch!=='function')
    throw Error('authority_unavailable');
  const at=now();
  if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))
    throw Error('invalid_bootstrap_timestamp');
  const auditId='jill:work:owner-bootstrap:'+identity.shop;
  await db.batch([
    db.prepare('INSERT INTO jill_merchant_authority '+
      '(shop,environment,app_client_id,owner_staff_id,owner_bound_at,policy_version) '+
      'VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(shop) DO NOTHING').bind(
      JILL_WORK_MERCHANT_SHOP,'WORK',JILL_WORK_MERCHANT_CLIENT_ID,
      identity.staffId,at),
    db.prepare('INSERT INTO jill_merchant_audit '+
      '(audit_id,shop,actor_staff_id,action,target_staff_id,decision,policy_version,happened_at) '+
      'SELECT ?,shop,owner_staff_id,?,owner_staff_id,?,policy_version,? '+
      'FROM jill_merchant_authority WHERE shop=? AND owner_staff_id=? '+
      'ON CONFLICT(audit_id) DO NOTHING').bind(
      auditId,'owner.bootstrap','allowed',at,identity.shop,identity.staffId),
  ]);
  const authority=await db.prepare(
    'SELECT shop,environment,app_client_id,owner_staff_id,policy_version '+
    'FROM jill_merchant_authority WHERE shop=?',
  ).bind(identity.shop).first();
  if(!authority || authority.environment!=='WORK' ||
     authority.app_client_id!==JILL_WORK_MERCHANT_CLIENT_ID ||
     String(authority.owner_staff_id)!==identity.staffId)
    throw Error('owner_already_bound');
  return Object.freeze({ok:true,shop:identity.shop,ownerStaffId:identity.staffId});
}
