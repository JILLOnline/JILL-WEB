// Read-only WORK merchant quote-to-Shopify preparation checklist.
// This is NOT an authority, approval, publish gate or Shopify calculation.
// All inputs must originate from the existing verified Owner request reader.
const GID=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const step=(id,status,label)=>Object.freeze({id,status,label});
const hasContent=x=>Array.isArray(x)&&x.length>0;
const emptyList=x=>Array.isArray(x)&&x.length===0;
const safeZero=x=>Number.isSafeInteger(x)&&x===0;
const report=checks=>Object.freeze({state:'estimate_review_only',
  checks:Object.freeze(checks),
  blocks:checks.filter(x=>x.status==='hold').length,
  verifications:checks.filter(x=>x.status==='verify').length,
  can_publish:false,can_invoice:false,can_create_order:false});

export function inspectWorkQuotePreflight({
  submissionId,detail,sourceRevision,worksheet,
}={}){
  const source=object(detail)&&detail.submission_id===submissionId&&
    typeof submissionId==='string'&&submissionId.length>=8&&
    Number.isSafeInteger(sourceRevision)&&sourceRevision>0&&
    detail.revision===sourceRevision&&Array.isArray(detail.items)&&
    detail.items.length>=1&&detail.items.length<=20;
  const checks=[step('source',source?'clear':'hold',
    source?'Signed request revision and items match':'Verify the original request revision and item list')];
  if(!source){
    checks.push(step('pricing','hold','Complete the verified quote worksheet'));
  }else{
    const priced=worksheet?.state==='ready'&&
      Number.isSafeInteger(worksheet.estimatedTotalCents);
    checks.push(step('pricing',priced?'clear':'hold',
      priced?'Valid item prices produce an estimate':'Enter and validate all item prices in USD'));
    const native=detail.items.every(item=>object(item)&&
      GID.test(item.variant_id||'')&&Number.isSafeInteger(item.quantity)&&
      item.quantity>0&&item.quantity<=999&&
      Array.isArray(item.variant_allocations)&&(
        item.variant_allocations.length===0||
        item.variant_allocations.length===1&&
        item.variant_allocations[0]?.variant_id===item.variant_id&&
        item.variant_allocations[0]?.quantity===item.quantity));
    const unique=native&&new Set(detail.items.map(x=>x.variant_id)).size===detail.items.length;
    checks.push(step('variants',unique?'verify':'hold',
      unique?'Resolve these exact variant IDs against the live WORK Shopify catalog':
        'Confirm exact Shopify ProductVariant IDs and all unit allocations'));
    const groupsClean=detail.items.every(item=>object(item)&&
      emptyList(item.personalization_groups)&&emptyList(item.reference_ids)&&
      Array.isArray(item.attributes));
    checks.push(step('personalization',groupsClean?'verify':'hold',
      groupsClean?'Validate the lossless item-wide personalization mapping':
        'Resolve every P1/P2 unit group, attachment, and item reference'));
    const orderClean=emptyList(detail.reference_ids)&&
      emptyList(detail.request_attributes)&&
      emptyList(detail.planning?.attributes);
    checks.push(step('instructions',orderClean?'clear':'hold',
      orderClean?'No separate request-wide instructions or references':
        'Map original request instructions and reference files without loss'));
    const fees=worksheet?.state==='ready'?worksheet.feesCents:null;
    const moneyClean=fees&&safeZero(fees.materials)&&safeZero(fees.labor)&&
      safeZero(fees.other)&&safeZero(fees.tax)&&safeZero(fees.discount);
    checks.push(step('charges',moneyClean?'clear':'hold',
      moneyClean?'No unmatched fees, estimated taxes or manual discounts':
        'Reconcile fees, manual taxes and discounts with Shopify amounts'));
    checks.push(step('fulfillment',
      ['pickup','shipping'].includes(detail.planning?.fulfillment)?'verify':'hold',
      'Confirm verified delivery address or pickup, shipping service and price'));
  }
  checks.push(step('identity','verify',
    'Verify the authenticated Shopify customer owner and applicable scopes'));
  checks.push(step('calculation','verify',
    'Run a fresh native Shopify calculation and reconcile price, currency and tax'));
  checks.push(step('agreement','verify',
    'Publish immutable quote terms, then record exact customer acceptance'));
  checks.push(step('commerce','verify',
    'Separately authorize a one-create Shopify draft and invoice read-back'));
  return report(checks);
}
