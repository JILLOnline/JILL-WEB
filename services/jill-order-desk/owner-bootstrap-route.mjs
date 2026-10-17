// Trusted, single-use WORK Shopify store-owner commissioning.
// This module does not expose an HTTP route; the embedded React Router route
// must inject the official Shopify SDK authenticate.admin(request).
// Creation is disabled unless BOTH a server-only flag and owner confirmation
// are present. Never bind by typed email, staff ID, or shop parameter.
import {requireWorkMerchantIdentity} from '../../backend/jill-merchant-auth.mjs';
import {bootstrapWorkMerchantOwner} from './merchant-access.mjs';
import {workAppHomeOrigin} from './shopify-host/sdk-config.mjs';

const deny=(code,status)=>Object.freeze({ok:false,code,status});
const safeResponse=(status,body)=>Response.json(body,{
  status,headers:{
    'Cache-Control':'private, no-store, max-age=0',
    'X-Content-Type-Options':'nosniff',
  },
});

export async function authorizeWorkOwnerSetup({
  request,authenticate,env,
}={}) {
  if(!request || typeof authenticate?.admin!=='function')
    throw new TypeError('verified_shopify_admin_required');

  // Only SDK-verified online staff sessions can reach a setup decision.
  // Let Shopify's redirect/challenge propagate unchanged.
  const {session}=await authenticate.admin(request);
  let identity;
  try {identity=requireWorkMerchantIdentity(session);}
  catch {return {decision:deny('invalid_work_staff',401)};}

  if(!identity.shopifyAccountOwner)
    return {decision:deny('not_work_store_owner',403)};

  if(env?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED!=='true')
    return {decision:deny('owner_setup_disabled',503)};

  const db=env.JILL_ORDER_DESK_WORK_DB;
  if(!db || typeof db.prepare!=='function')
    return {decision:deny('authority_unavailable',503)};

  try {
    const record=await db.prepare(
      'SELECT owner_staff_id FROM jill_merchant_authority WHERE shop=?'
    ).bind(identity.shop).first();
    if(record && String(record.owner_staff_id)!==identity.staffId)
      return {decision:deny('owner_already_bound',409)};
    return {identity,session,db,alreadyBound:!!record};
  } catch {
    return {decision:deny('authority_unavailable',503)};
  }
}

export async function readWorkOwnerSetup({request,authenticate,env}={}) {
  const proof=await authorizeWorkOwnerSetup({request,authenticate,env});
  if(proof.decision)return safeResponse(proof.decision.status,{
    ok:false,code:proof.decision.code,
  });
  return safeResponse(200,{
    ok:true,state:proof.alreadyBound?'already_bound':'ready_to_bind',
    shop:'jill-work.myshopify.com',
  });
}

export async function commitWorkOwnerSetup({request,authenticate,env}={}) {
  // Authenticate before inspecting body, Origin, or any D1 content.
  const proof=await authorizeWorkOwnerSetup({request,authenticate,env});
  if(proof.decision)return safeResponse(proof.decision.status,{
    ok:false,code:proof.decision.code,
  });
  if(request.method!=='POST')
    return safeResponse(405,{ok:false,code:'method_not_allowed'});
  if(request.headers.get('origin')!==workAppHomeOrigin(env.JILL_WORK_HOST_STAGE))
    return safeResponse(403,{ok:false,code:'invalid_origin'});
  const mime=(request.headers.get('content-type')||'').split(';')[0].trim();
  if(mime!=='application/x-www-form-urlencoded')
    return safeResponse(415,{ok:false,code:'invalid_content_type'});
  if(Number(request.headers.get('content-length')||0)>1024)
    return safeResponse(413,{ok:false,code:'form_too_large'});

  let data;
  try {data=await request.formData();}
  catch {return safeResponse(400,{ok:false,code:'invalid_form'});}
  const fields=[...data.keys()];
  if(fields.length!==1 || fields[0]!=='confirm' ||
     data.get('confirm')!=='bind-my-work-shopify-owner')
    return safeResponse(400,{ok:false,code:'confirmation_required'});

  try {
    await bootstrapWorkMerchantOwner({
      db:proof.db,session:proof.session,allowBootstrap:true,
    });
    return safeResponse(200,{ok:true,state:'owner_bound'});
  } catch (error) {
    if(error?.message==='owner_already_bound')
      return safeResponse(409,{ok:false,code:'owner_already_bound'});
    return safeResponse(503,{ok:false,code:'owner_binding_failed'});
  }
}
