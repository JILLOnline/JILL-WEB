// WORK quote draft capability policy. No remote writes or HTTP here.
// A new explicit switch is ABSENT from every deployed/current manifest.
// Even on a future approved WORK release, flags do not grant access:
// the endpoint separately rechecks authenticated Shopify online Owner,
// D1 authorization and fresh signed canonical Google WORK QA detail.
import {workMerchantWritesReady} from './work-merchant-write-readiness.mjs';
const SHOP='jill-work.myshopify.com';
const NAMES=Object.freeze([
  'jill_work_quote_draft_operations',
  'jill_work_quote_drafts',
]);
export function workQuoteDraftFeatureReady(env){
  const read=env?.JILL_HQ_MERCHANT_READ_SECRET;
  return env?.JILL_WORK_HOST_STAGE==='canary'&&
    env?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false'&&
    env?.JILL_WORK_OAUTH_ENABLED==='true'&&
    env?.JILL_WORK_HQ_DETAIL_ENABLED==='true'&&
    env?.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED==='true'&&
    workMerchantWritesReady(env)&&
    typeof env?.SHOPIFY_API_SECRET==='string'&&
    env.SHOPIFY_API_SECRET.length>=32&&
    typeof env?.JILL_WORK_SESSION_KEY_B64==='string'&&
    env.JILL_WORK_SESSION_KEY_B64.length>=32&&
    typeof read==='string'&&read.length>=32&&
    read!==env.SHOPIFY_API_SECRET&&
    read!==env.JILL_WORK_SESSION_KEY_B64&&
    env?.JILL_ORDER_DESK_WORK_DB?.prepare instanceof Function;
}
export async function workQuoteDraftSchemaReady(db){
  if(typeof db?.prepare!=='function')return false;
  try {
    const data=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND "+
      "name IN ('jill_work_quote_drafts',"+
      "'jill_work_quote_draft_operations') ORDER BY name"
    ).all();
    return Array.isArray(data?.results)&&
      data.results.length===NAMES.length&&
      data.results.every((row,index)=>
        row?.name===NAMES[index]&&Object.keys(row).length===1);
  }catch{return false;}
}
export const WORK_QUOTE_DRAFT_RELEASE_STATUS=Object.freeze({
  schema_migrated_on_work_by_owner:true,
  source_only_candidate:true,
  current_worker_version_unchanged:true,
  release_authorized:false,
  paid_resources_authorized:false,
  customer_quote_delivery_authorized:false,
  shopify_invoice_authorized:false,
  live_keep_authorized:false,
  shop:SHOP,
});
