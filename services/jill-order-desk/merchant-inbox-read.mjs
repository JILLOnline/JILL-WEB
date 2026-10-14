// JILL WORK merchant-only read boundary. No customer-account or storefront access.
// Shopify SDK online authentication and D1 staff authorization always precede
// the eventual private Google QA source reader. Source is NOT wired until its
// independent authenticated merchant-list contract is certified.
import {readWorkMerchantPermission} from './merchant-access.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const STATUSES=new Set([
  'received','reviewing','awaiting_approval','in_production',
  'ready_pickup','on_hold','cancelled','completed',
]);
const INTERNAL=new Set([
  'new','needs_quote','waiting_customer','materials_ordered',
  'proof_revision','printing','assembly','quality_check','ready','none',
]);
const HEADERS=Object.freeze({
  'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff',
});

function validTime(value) {
  return typeof value==='string' && value.length<=40 &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value));
}
function safeModel(state,records=[],connected=false) {
  return Object.freeze({
    state,source:'google_qa',requestsConnected:connected,
    // Do not call an unconnected source an empty inbox.
    records:Object.freeze(records),
    readOnly:true,invoiceEnabled:false,fulfillmentEnabled:false,
  });
}
function result(status,model) {return Object.freeze({status,headers:HEADERS,model});}

// This is a contract for a FUTURE signed and bounded merchant read, not a
// claim that Google QA currently offers a merchant listing endpoint.
// Only explicitly whitelisted metadata may cross into the embedded UI.
export function projectWorkMerchantInbox(source) {
  if(!source || typeof source!=='object' || Array.isArray(source) ||
    source.version!==1 ||
    source.operation!=='custom_order.merchant.list.result' ||
    source.ok!==true || source.shop!==SHOP || source.complete!==true ||
    !Array.isArray(source.records) || source.records.length>50)
    throw Error('invalid_canonical_merchant_list');
  const seen=new Set();
  const records=source.records.map(item=>{
    if(!item || typeof item!=='object' || Array.isArray(item) ||
      !ID.test(item.submission_id||'') ||
      seen.has(item.submission_id) ||
      !Number.isSafeInteger(item.revision) ||
      item.revision<1 || item.revision>100 ||
      !STATUSES.has(item.customer_status) ||
      !INTERNAL.has(item.internal_status) ||
      !validTime(item.submitted_at) ||
      !validTime(item.updated_at) ||
      typeof item.date_needed!=='string' ||
      (item.date_needed!=='' && !DATE.test(item.date_needed)) ||
      !['pickup','shipping',''].includes(item.fulfillment) ||
      !Number.isSafeInteger(item.item_count) ||
      item.item_count<1 || item.item_count>500)
      throw Error('invalid_canonical_merchant_record');
    seen.add(item.submission_id);
    return Object.freeze({
      submission_id:item.submission_id,
      revision:item.revision,
      customer_status:item.customer_status,
      internal_status:item.internal_status,
      submitted_at:item.submitted_at,
      updated_at:item.updated_at,
      date_needed:item.date_needed,
      fulfillment:item.fulfillment,
      item_count:item.item_count,
    });
  });
  return safeModel('ready',records,true);
}

export async function loadWorkMerchantInbox({
  request,authenticate,db,readCanonicalSource,
}={}) {
  if(!request || typeof authenticate?.admin!=='function')
    throw new TypeError('Shopify SDK Admin authentication required');
  // Shopify owns the redirect/challenge. Do not replace it with session JSON.
  const {session}=await authenticate.admin(request);
  const access=await readWorkMerchantPermission({
    db,session,action:'requests.read',
  });
  if(!access.allowed) {
    const status=access.code==='authority_unavailable'?503:
      access.code==='unauthenticated'?401:403;
    return result(status,safeModel('access_denied'));
  }
  // Initial merchant listing is Owner-only until verified assignment-aware
  // filtering exists; staff roles alone must not receive a full inbox.
  if(access.role!=='owner')
    return result(403,safeModel('access_denied'));
  // Without a signed Google QA merchant feed, show a clearly unavailable
  // source, not fictional zero requests or cached customer account data.
  if(typeof readCanonicalSource!=='function')
    return result(200,safeModel('source_not_connected'));
  try {
    const source=await readCanonicalSource({shop:SHOP});
    return result(200,projectWorkMerchantInbox(source));
  } catch {
    // No stale data, source internals, customer PII or secret details.
    return result(503,safeModel('source_unavailable'));
  }
}
