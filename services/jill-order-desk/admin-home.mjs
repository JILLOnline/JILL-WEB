// JILL Order Desk — Shopify App Home read-only authorization boundary.
// Route integration MUST call this from a server-side loader after the
// official Shopify React Router SDK is configured with useOnlineTokens: true.
// No direct public endpoint, OAuth implementation, HTTP listener, or mutation
// is registered by this module.
import {readWorkMerchantPermission} from './merchant-access.mjs';

const HEADERS=Object.freeze({
  'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff',
});

function outcome(status,state,access=null) {
  const model={
    state,
    title:'JILL Order Desk',
    description:status===200
      ? 'Your staff access is verified. Order management will be connected after source and runtime certification.'
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
