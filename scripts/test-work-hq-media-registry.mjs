// Offline only: no D1, Cloudinary, Shopify, Google, or HTTP calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';
import {draftWorkMediaRegistryBinding as draft,
  inspectWorkMediaRegistryBinding as inspect}
  from '../services/jill-order-desk/work-private-media-registry.mjs';

const SHOP='jill-work.myshopify.com';
const id='jill:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const key='SYNTHETIC_ONLY_work_registry_mac_key_32_bytes_long';
const legacy='https://res.cloudinary.com/fakework/image/upload/v1791926029/a.png';
const source={
  version:1,operation:'custom_order.submit',submission_id:id,
  submitted_at:'2026-10-15T20:00:00.000Z',
  customer:{name:'Synthetic WORK QA',email:'test@example.invalid'},
  planning:{fulfillment:'pickup',date_needed:'2026-11-01'},
  items:[
    {item_id:'shopify-product:101',product_id:'shopify-product:101',
      title:'Coloring Books',quantity:2,attributes:[],
      personalization_groups:[
        {id:'P1',allocations:[{unit_id:'unit-1'}],
          attributes:[{id:'name',value:'Ava'}]},
        {id:'P2',allocations:[{unit_id:'unit-2'}],
          attributes:[{id:'name',value:'Mia'}]},
      ],
      reference_ids:['jill:artwork-a','jill:artwork-b']},
    {item_id:'shopify-product:202',product_id:'shopify-product:202',
      title:'Party Favors',quantity:1,
      attributes:[],personalization_groups:[],
      reference_ids:['jill:artwork-a']},
  ],
  request_attributes:[],reference_ids:[legacy,'jill:artwork-a'],
};
const make=(raw=source,revision=2)=>project({
  rawPayload:JSON.stringify(raw),submissionId:id,
  revision,ownerAuthorized:true,
});
const detail=make();
const selector={scope:'item',itemId:'shopify-product:101',index:0};
const args={detail,submissionId:id,selector,registryKey:key};
const row=draft(args);
assert.equal(row.shop,SHOP);
assert.equal(row.submission_id,id);
assert.equal(row.scope,'item');
assert.equal(row.item_id,'shopify-product:101');
assert.equal(row.reference_index,0);
assert.equal(row.status,'pending_verification');
assert.equal(row.provider,null);
assert.match(row.reference_mac,/^[a-f0-9]{64}$/);
assert.ok(Object.isFrozen(row));
assert.doesNotMatch(JSON.stringify(row),
  /res.cloudinary.com|https:|jill:artwork-a|fakework/);
const match=inspect({...args,record:row});
assert.deepEqual(match,{
  state:'preview_disabled',reason:'provider_storage_not_verified',
  scope:'item',item_id:'shopify-product:101',index:0,
});
assert.ok(Object.isFrozen(match));
assert.ok(!Object.hasOwn(match,'reference_mac'));
assert.ok(!Object.hasOwn(match,'url'));
assert.ok(!Object.hasOwn(match,'asset_id'));

// A status-only revision update cannot lose the immutable original binding.
const revised=make(source,3);
assert.equal(draft({...args,detail:revised}).reference_mac,
  row.reference_mac);
assert.equal(inspect({...args,detail:revised,record:row}).state,
  'preview_disabled');

// A copied identical source ref must not authorize a different item/slot.
const second=draft({...args,selector:{
  scope:'item',itemId:'shopify-product:202',index:0,
}});
const requestRef=draft({...args,selector:{scope:'request',index:1}});
assert.notEqual(second.reference_mac,row.reference_mac);
assert.notEqual(requestRef.reference_mac,row.reference_mac);
assert.notEqual(requestRef.reference_mac,second.reference_mac);
const publicLegacy=draft({...args,selector:{scope:'request',index:0}});
assert.equal(inspect({...args,
  selector:{scope:'request',index:0},record:publicLegacy,
}).state,'preview_disabled');
assert.doesNotMatch(JSON.stringify(publicLegacy),
  /https|res.cloudinary|a.png/);

// Cross-secret and swapped original reference must fail.
const modified=structuredClone(source);
modified.items[0].reference_ids[0]='jill:artwork-replaced';
const mutatedDetail=make(modified);
for(const attempt of [
  {...args,registryKey:'ANOTHER_SYNTHETIC_32_BYTE_KEY_FOR_TESTING',record:row},
  {...args,detail:mutatedDetail,record:row},
  {...args,selector:{scope:'item',itemId:'shopify-product:101',index:1},record:row},
  {...args,selector:{scope:'item',itemId:'shopify-product:202',index:0},record:row},
  {...args,selector:{scope:'request',index:1},record:row},
  {...args,registryKey:'short',record:row},
  {...args,detail:{...detail,submission_id:'jill:foreign'},record:row},
  {...args,selector:{scope:'item',itemId:'shopify-product:missing',index:0},record:row},
  {...args,selector:{scope:'request',index:0,url:legacy},record:row},
]){
  assert.throws(()=>inspect(attempt),/work_media_registry_not_authorized|work_private_media_access_denied/);
}
const copy=()=>structuredClone(row);
for(const change of [
  x=>x.shop='jillonlinestore.myshopify.com',
  x=>x.submission_id='jill:foreign',
  x=>x.item_id='shopify-product:202',
  x=>x.reference_index=1,
  x=>x.scope='request',
  x=>x.reference_mac='0'.repeat(64),
  x=>x.reference_mac='not-sha-256',
  x=>x.status='verified',
  x=>x.status='revoked',
  x=>x.provider='cloudinary',
  x=>x.asset_id='someone-elses-asset',
  x=>x.url=legacy,
  x=>{delete x.reference_mac;},
]){
  const bad=copy();change(bad);
  assert.throws(()=>inspect({...args,record:bad}),
    /work_media_registry_not_authorized/);
}

// Reject external URLs and public URL copycat variants: no fingerprints
// or media grants from unknown references.
const unknown=structuredClone(source);
unknown.items[0].reference_ids[0]='https://attacker.example/file.png';
assert.throws(()=>draft({...args,detail:make(unknown)}),
  /work_media_registry_not_authorized/);
for(const badKey of [null,undefined,123,'','short',
  'SYNTHETIC'.repeat(100)]){
  assert.throws(()=>draft({...args,registryKey:badKey}),
    /work_media_registry_not_authorized/);
}
const component=readFileSync(
  'services/jill-order-desk/app-home/app/components/WorkOriginalRequestDetails.tsx','utf8');
assert.doesNotMatch(component,/<img\s+src=|<a\s+href=|createObjectURL|fetch\(/);
const code=readFileSync(
  'services/jill-order-desk/work-private-media-registry.mjs','utf8');
assert.doesNotMatch(code,/fetch\(|\bnew Request\(|\bINSERT INTO\b|\bUPDATE\b|\bDELETE FROM\b|createSignedUrl/);
console.log('PASS WORK media registry source MAC: canonical shop/request/scope/item/index/ref binding, revision-stable, P1/P2 preserved, wrong role data/copy/URL/provider forgery denied, NO preview/D1/network/storage changes.');
