// JILL HQ — WORK: Shopify App Home read-only authorization boundary.
// Route integration MUST call this from a server-side loader after the
// official Shopify React Router SDK is configured with useOnlineTokens: true.
// No direct public endpoint, OAuth implementation, HTTP listener, or mutation
// is registered by this module.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {requireWorkMerchantIdentity} from '../../backend/jill-merchant-auth.mjs';
import {JILL_MERCHANT_ACTIONS} from '../../backend/jill-merchant-policy.mjs';

const HEADERS=Object.freeze({
  'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff',
});

function outcome(status,state,access=null) {
  const model={
    state,
    title:'JILL HQ — WORK',
    description:status===200
      ? 'Your merchant access is verified. JILL HQ modules become available after their individual source and permission checks.'
      : status===503
        ? 'The merchant access registry is not connected yet.'
        : 'You do not have permission to open this merchant workspace.',
    requestsConnected:false,
    invoicingEnabled:false,
    fulfillmentEnabled:false,
    teamManagementEnabled:false,
  };
  if(status===200 && access?.role) {
    model.role=access.role;
    model.teamSectionVisible=access.role==='owner';
  }
  return Object.freeze({status,headers:HEADERS,model:Object.freeze(model)});
}

export async function loadJillOrderDeskHome({request,authenticate,db}={}) {
  // authenticate.admin may redirect when login or installation is needed.
  // Propagate those SDK responses unchanged. Never replace Shopify auth with
  // caller-supplied decoded JWT claims or arbitrary session JSON.
  if(!request || typeof authenticate?.admin!=='function')
    throw new TypeError('Shopify authenticated Admin route is required.');
  const context=await authenticate.admin(request);
  const access=await readWorkMerchantPermission({
    db,session:context?.session,action:'requests.read',
  });
  if(access.allowed)return outcome(200,'staff_verified',access);
  if(access.code==='authority_unavailable')
    return outcome(503,'merchant_setup_required');
  if(access.code==='unauthenticated')
    return outcome(401,'online_staff_required');
  return outcome(403,'access_denied');
}

// Owner-only operational read: verified online intersection, never app-level
// scopes or browser identity. No token, customer, secret or D1 session payload.
/** @param {{request?:Request,authenticate?:any,db?:any,runtimeVersion?:string|null}} options */
export async function readWorkOwnerAccessEvidence({request,authenticate,db,runtimeVersion=null}={}) {
  const result=(status,body)=>Response.json(body,{status,headers:HEADERS});
  if(request?.method!=='GET')return result(405,{state:'unavailable'});
  const {session}=await authenticate.admin(request);
  const permission=await readWorkMerchantPermission({db,session,action:'team.read'});
  if(!permission.allowed||permission.role!=='owner')return result(403,{state:'access_denied'});
  const identity=requireWorkMerchantIdentity(session);
  const actions=['catalog.read','locations.read','inventory.read','draft.create','invoice.send'];
  return result(200,{state:'verified_owner',shop:identity.shop,online:true,
    runtime_version:typeof runtimeVersion==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(runtimeVersion)?runtimeVersion:null,
    staff_id:identity.staffId,scopes:[...identity.scopes].sort(),
    actions:actions.map(action=>({action,feature_enabled:JILL_MERCHANT_ACTIONS[action].enabled,
      shopify_scope_intersection:JILL_MERCHANT_ACTIONS[action].scopes.every(scope=>identity.scopes.includes(scope))}))});
}
