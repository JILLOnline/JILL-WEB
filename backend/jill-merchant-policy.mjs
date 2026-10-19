// One JILL merchant authorization policy. The storefront and customer account
// have no dependency on this module. Nothing here grants Shopify permissions.
import {
  requireWorkMerchantIdentity,JILL_WORK_MERCHANT_SHOP,
  JILL_WORK_MERCHANT_CLIENT_ID,
} from './jill-merchant-auth.mjs';

export const JILL_MERCHANT_ROLES=Object.freeze([
  'owner','administrator','order_manager','production','viewer',
]);

// Enabled means the policy evaluator can authorize the operation, NOT that
// a deployed HTTP route exists. High-risk actions stay intentionally disabled
// until their phase-specific source and browser certification.
export const JILL_MERCHANT_ACTIONS=Object.freeze({
  'inventory.read':         {roles:['owner'],scopes:['read_products','read_inventory','read_locations'],enabled:true},
  'locations.read':         {roles:['owner'],scopes:['read_locations'],enabled:true},
  'catalog.read':           {roles:['owner'],scopes:['read_products'],enabled:true},
  'requests.read':          {roles:JILL_MERCHANT_ROLES,scopes:[],enabled:true,assigned:true},
  'team.read':              {roles:['owner'],scopes:[],enabled:true},
  // Command route still requires an explicit WORK-only deployment flag and
  // separate merchant WRITE HMAC secret; no public/customer write authority.
  'requests.write':          {roles:['owner'],scopes:[],enabled:true},
  'production.update':      {roles:['owner','administrator','order_manager'],scopes:[],enabled:false},
  'production.internal_note':{roles:['owner','administrator','order_manager','production'],scopes:[],enabled:false,assigned:true},
  'quote.prepare':          {roles:['owner','administrator','order_manager'],scopes:[],enabled:false},
  // Calculation previews do not create drafts or publish customer agreements.
  // No HTTP ingress is connected; the adapter also requires explicit opt-in.
  'quote.calculate':        {roles:['owner'],scopes:['write_draft_orders','read_draft_orders','read_customers','read_products'],enabled:true},
  'draft.create':           {roles:['owner','administrator'],scopes:['write_draft_orders'],enabled:false},
  'invoice.send':           {roles:['owner','administrator'],scopes:['write_draft_orders'],enabled:false,explicitGrant:true},
  'fulfillment.manage':     {roles:['owner','administrator'],scopes:[],enabled:false},
  'refund.approve':         {roles:['owner'],scopes:[],enabled:false},
  'team.grant':             {roles:['owner'],scopes:[],enabled:false},
  'team.revoke':            {roles:['owner'],scopes:[],enabled:false},
  'owner.transfer':         {roles:[],scopes:[],enabled:false},
});

// grant row is server-loaded from ONE protected registry, never from client.
function isActiveGrant(grant,identity) {
  return Boolean(grant && grant.shop===identity.shop &&
    String(grant.staff_id)===identity.staffId &&
    grant.active===1 &&
    JILL_MERCHANT_ROLES.includes(grant.role) &&
    grant.role!=='owner');
}

export function evaluateJillMerchantPermission({
  identity,authority,grant=null,action,assignedStaffIds=null,
}={}) {
  const deny=(code)=>Object.freeze({allowed:false,code});
  if(!identity || identity.shop!==JILL_WORK_MERCHANT_SHOP ||
     !/^[1-9][0-9]*$/.test(identity.staffId||'') ||
     !Array.isArray(identity.scopes))return deny('unauthenticated');
  if(!authority || authority.shop!==identity.shop ||
     authority.environment!=='WORK' ||
     authority.app_client_id!==JILL_WORK_MERCHANT_CLIENT_ID ||
     !/^[1-9][0-9]*$/.test(String(authority.owner_staff_id||'')))
    return deny('authority_unavailable');

  const spec=Object.hasOwn(JILL_MERCHANT_ACTIONS,action)
    ? JILL_MERCHANT_ACTIONS[action] : null;
  if(!spec)return deny('unknown_action');
  if(!spec.enabled)return deny('feature_not_enabled');

  const owner=String(authority.owner_staff_id)===identity.staffId &&
    identity.shopifyAccountOwner===true;
  const role=owner ? 'owner' : isActiveGrant(grant,identity)
    ? grant.role : null;
  if(!role || !spec.roles.includes(role))return deny('forbidden');
  if(spec.scopes.some(s=>!identity.scopes.includes(s)))
    return deny('insufficient_shopify_permissions');

  if(spec.explicitGrant && role!=='owner') {
    let caps;
    try { caps=JSON.parse(grant.capabilities_json); } catch {return deny('forbidden');}
    if(!Array.isArray(caps)||!caps.includes(action))return deny('forbidden');
  }
  // Assigned-only roles do not receive a full merchant inbox by default.
  if(spec.assigned && (role==='production'||role==='viewer')) {
    if(!Array.isArray(assignedStaffIds) ||
       !assignedStaffIds.includes(identity.staffId))return deny('unassigned');
  }
  return Object.freeze({allowed:true,code:'allowed',role,staffId:identity.staffId});
}

// The only session-to-policy ingress must receive a Shopify SDK-verified
// online session from authenticate.admin, never a directly supplied JWT.
export function authorizeJillMerchantOnlineSession({
  session,authority,grant,action,assignedStaffIds,expectedShop,expectedClientId,
}={}) {
  let identity;
  try {
    identity=requireWorkMerchantIdentity(session,{expectedShop,expectedClientId});
  } catch {return Object.freeze({allowed:false,code:'unauthenticated'});}
  return evaluateJillMerchantPermission({
    identity,authority,grant,action,assignedStaffIds,
  });
}
