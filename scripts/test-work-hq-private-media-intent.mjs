import assert from 'node:assert/strict';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';
import {chooseWorkOwnerReference,inspectWorkOwnerMediaIntent}
  from '../services/jill-order-desk/work-private-media-intent.mjs';

// Entirely synthetic WORK QA records; never touches Cloudinary, Shopify,
// Google, D1, Cloudflare, customer accounts or real artwork.
const shop='jill-work.myshopify.com';
const submissionId='jill:11111111-2222-4333-8444-555555555555';
const legacy='https://res.cloudinary.com/syntheticwork/image/upload/v1791926029/opaqueitem.png';
const raw={
  version:1,operation:'custom_order.submit',submission_id:submissionId,
  submitted_at:'2026-10-15T21:00:00.000Z',
  customer:{name:'Synthetic WORK Customer',email:'qa@example.invalid'},
  planning:{date_needed:'2026-10-30',fulfillment:'pickup'},
  items:[{
    item_id:'shopify-product:111',product_id:'shopify-product:111',
    title:'Synthetic Coloring Books',quantity:2,
    attributes:[{id:'color',value:'purple'}],
    personalization_groups:[
      {id:'P1',allocations:[{unit_id:'unit-1'}],
        attributes:[{id:'name',value:'Ava'},{id:'age',value:5}]},
      {id:'P2',allocations:[{unit_id:'unit-2'}],
        attributes:[{id:'name',value:'Mia'},{id:'age',value:6}]},
    ],
    reference_ids:['jill:private-media-001'],
  },{
    item_id:'shopify-product:222',product_id:'shopify-product:222',
    title:'Synthetic Party Favors',quantity:1,
    attributes:[],personalization_groups:[],
    reference_ids:['https://not-trusted.example/private-file.png'],
  }],
  request_attributes:[],
  reference_ids:[legacy],
};
const detail=project({
  rawPayload:JSON.stringify(raw),submissionId,revision:2,
  ownerAuthorized:true,
});
assert.equal(detail.items.length,2);
assert.equal(detail.items[0].personalization_groups.length,2);
assert.deepEqual(detail.items[0].personalization_groups.map(g=>g.id),['P1','P2']);
assert.deepEqual(detail.items[0].personalization_groups.map(g=>
  g.allocations.map(a=>a.unit_id)),[['unit-1'],['unit-2']]);
assert.deepEqual(detail.items[0].personalization_groups.map(g=>
  g.attributes.find(x=>x.id==='name').value),['Ava','Mia']);
assert.equal(detail.attachment_state,'unresolved');

const selected=chooseWorkOwnerReference({
  detail,submissionId,selector:{scope:'request',index:0},
});
assert.equal(selected.state,'preview_disabled');
assert.equal(selected.reason,'legacy_public_delivery_requires_migration');
assert.equal(selected.revision,2);
assert.ok(Object.isFrozen(selected));
assert.doesNotMatch(JSON.stringify(selected),
  /res\.cloudinary|https?:|opaqueitem|syntheticwork/);

const item=chooseWorkOwnerReference({
  detail,submissionId,
  selector:{scope:'item',itemId:'shopify-product:111',index:0},
});
assert.equal(item.reason,'private_asset_registry_not_connected');
assert.equal(item.item_id,'shopify-product:111');
assert.equal(item.kind,'opaque_id');
assert.ok(!Object.hasOwn(item,'url'));
assert.ok(!Object.hasOwn(item,'public_id'));
assert.ok(!Object.hasOwn(item,'signed_url'));

const other=chooseWorkOwnerReference({
  detail,submissionId,
  selector:{scope:'item',itemId:'shopify-product:222',index:0},
});
assert.equal(other.reason,'unverified_reference');
assert.equal(other.kind,'external_url_unverified');
assert.doesNotMatch(JSON.stringify(other),/not-trusted|private-file/);

for(const bad of [
  {scope:'request',index:-1},{scope:'request',index:1},
  {scope:'request',index:0,itemId:'shopify-product:111'},
  {scope:'request',index:0,url:legacy},
  {scope:'request',index:'0'},
  {scope:'item',itemId:'shopify-product:other',index:0},
  {scope:'item',itemId:'shopify-product:111',index:1},
  {scope:'item',index:0},
  {scope:'item',itemId:'shopify-product:111',index:0,href:legacy},
  {scope:'item',itemId:'shopify-product:111',index:20},
  {scope:'foreign',index:0},null,
])assert.throws(()=>chooseWorkOwnerReference({
  detail,submissionId,selector:bad,
}),/work_private_media_access_denied/);
assert.throws(()=>chooseWorkOwnerReference({
  detail:{...detail,submission_id:'jill:foreign'},
  submissionId,selector:{scope:'request',index:0},
}),/work_private_media_access_denied/);
assert.throws(()=>chooseWorkOwnerReference({
  detail:{...detail,operation:'unverified'},
  submissionId,selector:{scope:'request',index:0},
}),/work_private_media_access_denied/);
assert.throws(()=>chooseWorkOwnerReference({
  detail:{...detail,attachment_state:'ready'},
  submissionId,selector:{scope:'request',index:0},
}),/work_private_media_access_denied/);

let authorizations=0,sourceReads=0;
const context={serverVerifiedSession:'SYNTHETIC_ONLY'};
const gate=async ({context:ctx,shop:checkedShop,
  submissionId:id,action})=>{
  authorizations++;
  assert.equal(ctx,context);
  assert.equal(checkedShop,shop);
  assert.equal(id,submissionId);
  assert.equal(action,'requests.read');
  return {allowed:true,role:'owner',shop,
    submission_id:submissionId,
    source:'shopify_online_plus_work_d1'};
};
const read=async ({submissionId:id})=>{
  sourceReads++;
  assert.equal(id,submissionId);
  return detail;
};
const params={
  shop,submissionId,selector:{scope:'request',index:0},
  verifiedAdminContext:context,authorizeWorkOwner:gate,
  readVerifiedRequestDetail:read,
};
const authorized=await inspectWorkOwnerMediaIntent(params);
assert.equal(authorized.state,'preview_disabled');
assert.equal(authorizations,1);
assert.equal(sourceReads,1);
for(const grant of [
  {allowed:true,role:'viewer',shop,submission_id:submissionId,
    source:'shopify_online_plus_work_d1'},
  {allowed:true,role:'owner',shop:'jillonlinestore.myshopify.com',
    submission_id:submissionId,source:'shopify_online_plus_work_d1'},
  {allowed:true,role:'owner',shop,submission_id:'jill:foreign',
    source:'shopify_online_plus_work_d1'},
  {allowed:true,role:'owner',shop,submission_id:submissionId,
    source:'client_supplied_role'},
  {allowed:false,role:'owner',shop,submission_id:submissionId,
    source:'shopify_online_plus_work_d1'},
  null,
]){
  sourceReads=0;
  await assert.rejects(()=>inspectWorkOwnerMediaIntent({
    ...params,authorizeWorkOwner:async()=>grant,
  }),/work_private_media_access_denied/);
  assert.equal(sourceReads,0,'Unauthenticated intent must not read Google');
}
for(const missing of [
  {...params,shop:'jillonlinestore.myshopify.com'},
  {...params,verifiedAdminContext:null},
  {...params,authorizeWorkOwner:null},
  {...params,readVerifiedRequestDetail:null},
  {...params,selector:{scope:'request',index:0,url:legacy}},
]){
  await assert.rejects(()=>inspectWorkOwnerMediaIntent(missing),
    /work_private_media_access_denied/);
}
await assert.rejects(()=>inspectWorkOwnerMediaIntent({
  ...params,readVerifiedRequestDetail:async()=>({
    ...detail,submission_id:'jill:other-owned-request',
  }),
}),/work_private_media_access_denied/);
await assert.rejects(()=>inspectWorkOwnerMediaIntent({
  ...params,readVerifiedRequestDetail:async()=>{throw Error('private backend error: SECRET');},
}),e=>e.message==='work_private_media_access_denied');

assert.equal(sourceReads,2); // both authenticated negative detail reads were attempted.
console.log('PASS WORK source-only media intent: Shopify online + D1 Owner before exact Google read, exact item/request index, P1/P2 unit allocations, 0 unverified previews, no URLs, no LIVE/Cloudinary mutations.');
