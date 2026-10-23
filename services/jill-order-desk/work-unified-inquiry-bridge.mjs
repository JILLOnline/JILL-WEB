// JILL WORK — source-only shared intake boundary for Custom Orders + Contact Us.
// This module is NOT an ingress endpoint and cannot authenticate Shopify,
// Google or a merchant. Caller authentication and durable canonical recording
// remain separate, mandatory prerequisites. No email/name ownership inference.
import {createHmac,timingSafeEqual} from 'node:crypto';

const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const HASH=/^[a-f0-9]{64}$/;
const NONCE=/^[A-Za-z0-9_-]{32}$/;
const TYPES=Object.freeze({
 custom_order:'google_work_qa',
 contact:'shopify_contact_bridge',
});
const FIELDS=['version','operation','shop','kind','source',
 'submission_id','source_revision','record_sha256',
 'owner_customer_gid','recorded_at_ms','nonce','signature'];
const noActions=Object.freeze({
 can_send_reply:false,can_publish_quote:false,can_invoice:false,
 can_create_order:false,can_charge_customer:false,
 can_mark_delivered:false,
});
const held=reason=>Object.freeze({state:'held',reason,...noActions});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const valid=x=>typeof x==='string'&&x.length>0;
const canonical=r=>[
 'jill_unified_intake_receipt_v1',r.shop,r.kind,r.source,
 r.submission_id,String(r.source_revision),r.record_sha256,
 r.owner_customer_gid??'',String(r.recorded_at_ms),r.nonce,
].join('\n');
export function verifyWorkUnifiedInquiryReceipt({
 source,secret,nonce,nowMs=Date.now(),expectedKind,expectedId,
}={}){
 if(!plain(source)||Object.keys(source).length!==FIELDS.length||
    !FIELDS.every(key=>Object.hasOwn(source,key))||
    source.version!==1||source.operation!=='jill.work.intake.receipt.v1'||
    source.shop!==SHOP||!Object.hasOwn(TYPES,source.kind)||
    source.source!==TYPES[source.kind]||
    (expectedKind!==undefined&&expectedKind!==source.kind)||
    !ID.test(source.submission_id||'')||
    (expectedId!==undefined&&expectedId!==source.submission_id)||
    !Number.isSafeInteger(source.source_revision)||
    source.source_revision<1||source.source_revision>100||
    !HASH.test(source.record_sha256||'')||
    !(source.owner_customer_gid===null||GID.test(source.owner_customer_gid||''))||
    !Number.isSafeInteger(source.recorded_at_ms)||
    !Number.isSafeInteger(nowMs)||nowMs<=0||
    source.recorded_at_ms>nowMs||nowMs-source.recorded_at_ms>120000||
    !NONCE.test(nonce||'')||source.nonce!==nonce||
    !HASH.test(source.signature||'')||
    !valid(secret)||secret.length<32)
   return held('signed_intake_receipt_unverified');
 const expected=createHmac('sha256',secret)
  .update(canonical(source),'utf8').digest();
 const supplied=Buffer.from(source.signature,'hex');
 if(supplied.length!==expected.length||
    !timingSafeEqual(expected,supplied))
  return held('signed_intake_receipt_unverified');
 // A signed CONTACT receipt requires a future server-side canonical
 // intake bridge. Shopify's native email-only contact form cannot issue it.
 return Object.freeze({
  state:'verified_source_receipt',kind:source.kind,
  submission_id:source.submission_id,source_revision:source.source_revision,
  record_sha256:source.record_sha256,
  owner_customer_gid:source.owner_customer_gid,
  ...noActions,
 });
}
export function planWorkInquiryVisibility({
 verified,merchantAuthenticated=false,customerAuthenticatedGid=null,
}={}){
 if(verified?.state!=='verified_source_receipt')
  return held('canonical_intake_unverified');
 // Authenticated flags/context MUST come from an independently authorized
 // Shopify Owner/D1 read or signed customer-account JWT, not a browser POST.
 const hq=merchantAuthenticated===true;
 const mine=GID.test(customerAuthenticatedGid||'')&&
   verified.owner_customer_gid!==null&&
   customerAuthenticatedGid===verified.owner_customer_gid;
 // A guest Contact Us submission belongs in the merchant inbox ONLY.
 // Customer email/name/phone/Shopify order-number are NOT ownership proof.
 return Object.freeze({
  state:hq||mine?'display_eligible':'held',
  kind:verified.kind,submission_id:verified.submission_id,
  hq_visible:hq,my_jill_visible:mine,
  shopify_order_link_verified:false,
  customer_reply_enabled:false,
  // This is UI eligibility, not proof of delivery or a commerce permission.
  ...noActions,
 });
}
