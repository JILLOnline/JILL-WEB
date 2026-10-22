// JILL HQ WORK — exact Shopify Customer read, SOURCE ONLY.
// No route, writes, invoices, or shipping calculation. The canonical signed
// Owner binding reader is NOT deployed. Email/name/postal code are never IDs.
import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {JILL_WORK_MERCHANT_CLIENT_ID as APP,
 JILL_WORK_MERCHANT_SHOP as SHOP} from '../../backend/jill-merchant-auth.mjs';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const HASH=/^[a-f0-9]{64}$/;
const NONCE=/^[A-Za-z0-9_-]{32}$/;
const MAX_AGE=300000;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const halt=reason=>Object.freeze({
 state:'held',reason,customer_gid:null,owner_verified:false,
 can_publish:false,can_invoice:false,can_create_order:false,
 can_charge_customer:false,can_send_email:false,
});
export const WORK_QUOTE_CUSTOMER_QUERY=
 'query JillWorkQuoteExactCustomer($id: ID!) {'+
 ' shop { myshopifyDomain currencyCode }'+
 ' currentAppInstallation { app { apiKey } }'+
 ' node(id: $id) { __typename ... on Customer { id } }'+
 '}';

// The future source MUST be an HMAC-verified server-to-server Google QA
// owner-ledger read, not a typed email or the merchant detail JSON.
// Shape checks alone are not cryptographic authentication.
export function projectWorkQuoteOwnerBinding({
 source,submissionId,sourceRevision,nowMs=Date.now(),
}={}){
 if(!ID.test(submissionId||'')||
    !Number.isSafeInteger(sourceRevision)||sourceRevision<1||
    sourceRevision>100||!Number.isSafeInteger(nowMs)||nowMs<=0||
    !object(source)||source.version!==1||
    source.operation!=='custom_order.merchant.owner_binding.result'||
    source.ok!==true||source.shop!==SHOP||
    source.submission_id!==submissionId||
    source.source_revision!==sourceRevision||
    source.owner_status!=='signed_shopify_customer'||
    !GID.test(source.owner_customer_gid||'')||
    !HASH.test(source.raw_payload_sha256||'')||
    !Number.isSafeInteger(source.verified_at_ms)||
    source.verified_at_ms>nowMs||
    nowMs-source.verified_at_ms>MAX_AGE)
   return halt('signed_owner_binding_missing_or_stale');
 return Object.freeze({
  state:'owner_binding_projected',reason:null,
  submission_id:submissionId,source_revision:sourceRevision,
  owner_customer_gid:source.owner_customer_gid,
  source_sha256:source.raw_payload_sha256,
  verified_at_ms:source.verified_at_ms,
  // This is an internal projection, not independent signed source proof.
  backend_signature_verified:false,
  can_publish:false,can_invoice:false,can_create_order:false,
 });
}
// Verify a future private Google QA ledger response, including a Worker
// one-time challenge. The server must HMAC these exact fields using the
// isolated WORK merchant read secret. No unsigned/source-shaped JSON suffices.
export function verifyWorkQuoteOwnerBindingReceipt({
 source,submissionId,sourceRevision,nonce,secret,nowMs=Date.now(),
}={}){
 const projected=projectWorkQuoteOwnerBinding({
  source,submissionId,sourceRevision,nowMs,
 });
 if(projected.state!=='owner_binding_projected')return projected;
 if(typeof secret!=='string'||secret.length<32||
    !NONCE.test(nonce||'')||source.nonce!==nonce||
    !HASH.test(source.signature||'')||
    nowMs-source.verified_at_ms>120000)
  return halt('signed_owner_binding_authentication_failed');
 const message=[
  'work_quote_owner_binding_v1',SHOP,submissionId,
  String(sourceRevision),source.owner_customer_gid,
  source.raw_payload_sha256,String(source.verified_at_ms),nonce,
 ].join('\n');
 const digest=createHmac('sha256',secret).update(message,'utf8').digest();
 const signature=Buffer.from(source.signature,'hex');
 if(signature.length!==digest.length||
    !timingSafeEqual(signature,digest))
  return halt('signed_owner_binding_authentication_failed');
 return Object.freeze({...projected,
  state:'owner_binding_verified',backend_signature_verified:true,
 });
}

export function projectExactWorkShopifyCustomer({
 result,expectedGid,nowMs=Date.now(),
}={}){
 if(!GID.test(expectedGid||'')||
    !Number.isSafeInteger(nowMs)||nowMs<=0||
    !object(result)||
    (result.errors!==undefined&&(!Array.isArray(result.errors)||
      result.errors.length!==0))||
    result.data?.shop?.myshopifyDomain!==SHOP||
    result.data.shop.currencyCode!=='USD'||
    result.data.currentAppInstallation?.app?.apiKey!==APP||
    result.data.node?.__typename!=='Customer'||
    result.data.node.id!==expectedGid)
   return halt('shopify_customer_identity_unverified');
 // No email/address read; a default address does NOT prove this request's
 // approved delivery instructions or customer agreement.
 return Object.freeze({
  state:'exact_shopify_customer_verified',reason:null,
  customer_gid:expectedGid,shop:SHOP,verified_at_ms:nowMs,
  full_delivery_address_verified:false,shipping_terms_verified:false,
  can_publish:false,can_invoice:false,can_create_order:false,
 });
}
export async function readAuthorizedWorkQuoteCustomer({
 request,authenticate,db,enabled=false,submissionId,sourceRevision,
 readSignedOwnerBinding,ownerBindingSecret,
 makeNonce=()=>randomBytes(24).toString('base64url'),now=Date.now,
}={}){
 if(enabled!==true)return halt('owner_customer_lookup_disabled');
 if(!ID.test(submissionId||'')||
    !Number.isSafeInteger(sourceRevision)||sourceRevision<1||
    sourceRevision>100||
    typeof authenticate?.admin!=='function'||
    typeof db?.prepare!=='function'||
    typeof readSignedOwnerBinding!=='function'||
    typeof ownerBindingSecret!=='string'||ownerBindingSecret.length<32||
    typeof makeNonce!=='function'||typeof now!=='function')
   return halt('owner_customer_source_unavailable');
 const sdk=await authenticate.admin(request);
 let allowed;
 try{allowed=await readWorkMerchantPermission({
  db,session:sdk.session,action:'quote.calculate',
 });}catch{return halt('owner_customer_authority_unavailable');}
 if(allowed.allowed!==true||allowed.role!=='owner')
  return halt('owner_customer_access_denied');
 let nonce,bindingSource;
 try{
  nonce=makeNonce();
  if(!NONCE.test(nonce||''))
   return halt('signed_owner_binding_authentication_failed');
  bindingSource=await readSignedOwnerBinding({
   submissionId,sourceRevision,nonce,
  });
 }catch{return halt('signed_owner_binding_unavailable');}
 const binding=verifyWorkQuoteOwnerBindingReceipt({
  source:bindingSource,submissionId,sourceRevision,nonce,
  secret:ownerBindingSecret,nowMs:now(),
 });
 if(binding.state!=='owner_binding_verified')return halt(binding.reason);
 const admin=sdk.admin;
 if(typeof admin?.graphql!=='function')
  return halt('shopify_customer_reader_unavailable');
 try{
  const response=await admin.graphql(WORK_QUOTE_CUSTOMER_QUERY,{
   variables:{id:binding.owner_customer_gid},
   tries:1,signal:AbortSignal.timeout(10000),
  });
  if(!response?.ok)return halt('shopify_customer_identity_unverified');
  const result=await response.json();
  const verified=projectExactWorkShopifyCustomer({
   result,expectedGid:binding.owner_customer_gid,nowMs:now(),
  });
  if(verified.state!=='exact_shopify_customer_verified')
   return halt(verified.reason);
  return Object.freeze({
   state:'owner_customer_identity_verified',reason:null,
   customer_gid:verified.customer_gid,
   // No trusted complete address or explicit shipping confirmation.
   owner_binding_verified:true,
   customer_verified_at_ms:verified.verified_at_ms,
   full_delivery_address_verified:false,shipping_terms_verified:false,
   can_publish:false,can_invoice:false,can_create_order:false,
   can_charge_customer:false,can_send_email:false,
  });
 }catch{return halt('shopify_customer_identity_unverified');}
}
