// Read-only visual comparison of one verified Catalog snapshot and current
// Owner worksheet's lossless P1/P2 unit review. No shopper authority,
// discount/payment/stock inference or mutation. Private option text is absent.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const GID=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const GRP=/^[A-Za-z0-9._:-]{1,128}$/;
const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const held=reason=>Object.freeze({state:'held',reason,rows:Object.freeze([]),
  difference_count:null,inactive_count:null,can_publish:false,
  can_invoice:false,can_create_order:false});
export function compareWorkQuoteUnitCatalogPrices({
  review,snapshot,submissionId,sourceRevision,nowMs=Date.now(),
}={}){
 if(!ID.test(submissionId||'')||!Number.isSafeInteger(sourceRevision)||
    sourceRevision<1||sourceRevision>100||review?.state!=='review_only'||
    !Array.isArray(review.units)||review.units.length<1||
    review.units.length>100||snapshot?.state!=='verified_catalog_snapshot'||
    snapshot.review_only!==true||snapshot.can_publish!==false||
    snapshot.submission_id!==submissionId||
    snapshot.source_revision!==sourceRevision||snapshot.currency!=='USD'||
    !Number.isSafeInteger(snapshot.verified_at_ms)||
    !Number.isSafeInteger(nowMs)||snapshot.verified_at_ms>nowMs||
    nowMs-snapshot.verified_at_ms>300000||
    !Array.isArray(snapshot.variants)||snapshot.variants.length<1||
    snapshot.variants.length>20)
   return held('fresh_catalog_and_matching_source_required');
 const map=new Map();
 for(const v of snapshot.variants){
   if(!GID.test(v?.variant_id||'')||map.has(v.variant_id)||
      !['ACTIVE','DRAFT','ARCHIVED','UNLISTED'].includes(v.product_status)||
      !cents(v.shopify_unit_price_cents))
     return held('unverified_shopify_catalog');
   map.set(v.variant_id,v);
 }
 const rows=[];const seen=new Set(),used=new Set();
 let difference=0,inactive=0;
 for(const u of review.units){
   if(!GRP.test(u?.source_item_id||'')||!GRP.test(u.unit_id||'')||
      !(u.group_id===null||GRP.test(u.group_id||''))||
      !GID.test(u.variant_id||'')||!cents(u.quoted_unit_cents))
     return held('unverified_worksheet_unit');
   const key=u.source_item_id+'\0'+u.unit_id;
   if(seen.has(key))return held('duplicate_physical_unit');
   seen.add(key);
   const v=map.get(u.variant_id);
   if(!v)return held('variant_missing_from_catalog');
   used.add(v.variant_id);
   const priceDiff=u.quoted_unit_cents!==v.shopify_unit_price_cents;
   const nonActive=v.product_status!=='ACTIVE';
   if(priceDiff)difference++;
   if(nonActive)inactive++;
   rows.push(Object.freeze({source_item_id:u.source_item_id,
     unit_id:u.unit_id,group_id:u.group_id,variant_id:u.variant_id,
     quoted_unit_cents:u.quoted_unit_cents,
     shopify_unit_price_cents:v.shopify_unit_price_cents,
     status:nonActive?'inactive_product':priceDiff?'price_difference':'price_equal'}));
 }
 if(used.size!==map.size)return held('unexpected_catalog_variants');
 return Object.freeze({state:'review_only',reason:null,rows:Object.freeze(rows),
   difference_count:difference,inactive_count:inactive,
   checked_at_ms:snapshot.verified_at_ms,
   // An equal catalog price does not prove approved customization pricing.
   can_publish:false,can_invoice:false,can_create_order:false});
}
