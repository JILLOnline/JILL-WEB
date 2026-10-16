// JILL WORK Phase 13: OFFLINE ONLY real SQLite object ownership proposal.
// No Cloudflare connection, R2 access, D1 remote writes, customer data,
// HTTP handler, secrets, paid services, previews, migration or deployments.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';
import {draftWorkMediaRegistryBinding}
  from '../services/jill-order-desk/work-private-media-registry.mjs';
import {planWorkR2QuotaReservation}
  from '../services/jill-order-desk/work-private-r2-quota-plan.mjs';
import {draftWorkR2ObjectIntent,inspectWorkR2ObjectReconciliation}
  from '../services/jill-order-desk/work-private-r2-object-intent.mjs';

const ROOT='services/jill-order-desk/';
const live=readdirSync(ROOT+'migrations').sort();
assert.deepEqual(live,[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
],'0004, 0005 and 0006 MUST remain outside the active migrations folder');
const proposal=n=>readFileSync(
  ROOT+'migration-plans/'+n,'utf8');
for(const file of [
  '0004_work_private_media_registry.sql',
  '0005_work_r2_quota_guard.sql',
  '0006_work_r2_object_intents.sql',
])assert.match(proposal(file),/INERT PROPOSAL/);
const shop='jill-work.myshopify.com';
const request='jill:11111111-2222-4333-8444-555555555555';
const key='SYNTHETIC_ONLY_32_BYTE_PRIVATE_WORK_REGISTRY_KEY';
const at=Date.parse('2026-10-16T12:00:00.000Z');
const payload={
  version:1,operation:'custom_order.submit',submission_id:request,
  submitted_at:'2026-10-16T10:00:00.000Z',
  customer:{name:'Synthetic',email:'invalid@example.invalid'},
  planning:{date_needed:'2026-11-01',fulfillment:'pickup'},
  items:[{item_id:'shopify-product:101',product_id:'shopify-product:101',
    title:'Synthetic',quantity:2,attributes:[],
    personalization_groups:[
      {id:'P1',allocations:[{unit_id:'unit-1'}],attributes:[]},
      {id:'P2',allocations:[{unit_id:'unit-2'}],attributes:[]},
    ],
    reference_ids:['jill:opaque-one','jill:opaque-two']}],
  request_attributes:[],
  reference_ids:['https://res.cloudinary.com/synthetic/image/upload/legacy.png'],
};
const detail=project({rawPayload:JSON.stringify(payload),
  submissionId:request,revision:2,ownerAuthorized:true});
const selectors=[
  {scope:'item',itemId:'shopify-product:101',index:0},
  {scope:'item',itemId:'shopify-product:101',index:1},
];
const bindings=selectors.map(selector=>draftWorkMediaRegistryBinding({
  detail,submissionId:request,selector,registryKey:key,
}));
const sha='a'.repeat(64);
const makeIntent=index=>draftWorkR2ObjectIntent({
  detail,submissionId:request,selector:selectors[index],registryKey:key,
  contentSha256:sha,byteLength:1024,nowMs:at,
});
const first=makeIntent(0),second=makeIntent(1);
assert.notEqual(first.reference_mac,second.reference_mac);
assert.notEqual(first.object_key,second.object_key);
assert.ok(Object.isFrozen(first));
assert.equal(first.state,'reserved');
assert.ok(!JSON.stringify(first).includes('https://'));
assert.throws(()=>draftWorkR2ObjectIntent({
  detail,submissionId:request,selector:{scope:'request',index:0},
  registryKey:key,contentSha256:sha,byteLength:1024,nowMs:at,
}));
assert.throws(()=>draftWorkR2ObjectIntent({
  detail,submissionId:request,selector:selectors[0],
  registryKey:key,contentSha256:'invalid',byteLength:1024,nowMs:at,
}));
assert.throws(()=>draftWorkR2ObjectIntent({
  detail,submissionId:request,selector:selectors[0],
  registryKey:key,contentSha256:sha,byteLength:8*1024*1024+1,nowMs:at,
}));

const db=new DatabaseSync(':memory:');
try{
  db.exec('PRAGMA foreign_keys=ON');
  for(const f of live)db.exec(readFileSync(ROOT+'migrations/'+f,'utf8'));
  db.exec(proposal('0004_work_private_media_registry.sql'));
  db.exec(proposal('0005_work_r2_quota_guard.sql'));
  db.exec(proposal('0006_work_r2_object_intents.sql'));
  db.exec(proposal('0006_work_r2_object_intents.sql'));
  db.prepare('INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,owner_bound_at) '+
    'VALUES (?,?,?,?,?)').run(shop,'WORK','synthetic-app',
    'synthetic-owner','2026-10-16T12:00:00Z');
  const bind=db.prepare('INSERT INTO jill_work_private_media_registry '+
    '(shop,submission_id,scope,item_key,reference_index,reference_mac,'+
    'status,created_at_ms,updated_at_ms) VALUES (?,?,?,?,?,?,?,?,?)');
  for(const b of bindings)bind.run(shop,request,b.scope,b.item_id??'',
    b.reference_index,b.reference_mac,'pending_verification',at,at);

  const insert=db.prepare(
    'INSERT INTO jill_work_r2_object_intents ('+
      'shop,submission_id,scope,item_key,reference_index,reference_mac,'+
      'reservation_id,object_key,content_sha256,byte_length,state,'+
      'created_at_ms,updated_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const params=o=>[o.shop,o.submission_id,o.scope,o.item_key,
    o.reference_index,o.reference_mac,o.reservation_id,o.object_key,
    o.content_sha256,o.byte_length,o.state,o.created_at_ms,o.updated_at_ms];
  const countQuota=()=>db.prepare(
    'SELECT lifetime_reserved_bytes,month_uploads,lifetime_reservations '+
    'FROM jill_work_r2_quota_guard').get();
  const nIntents=()=>db.prepare(
    'SELECT COUNT(*) n FROM jill_work_r2_object_intents').get().n;
  const atomicPlan=planWorkR2QuotaReservation({
    shop,byteLength:1024,nowMs:at,
  });
  assert.equal(atomicPlan.upload_enabled,false);
  // ONLY an in-memory transaction demonstrates pre-write quota + intent.
  // This is NOT a remote D1 batch/transaction compatibility guarantee.
  const reserveAndRecord=object=>{
    db.exec('BEGIN IMMEDIATE');
    try{
      const quota=db.prepare(atomicPlan.sql).get(...atomicPlan.params);
      if(!quota)throw Error('no_capacity');
      insert.run(...params(object));
      db.exec('COMMIT');
      return true;
    }catch{
      db.exec('ROLLBACK');
      return false;
    }
  };
  assert.ok(reserveAndRecord(first));
  assert.deepEqual({...countQuota()},{
    lifetime_reserved_bytes:1024,month_uploads:1,
    lifetime_reservations:1,
  });
  assert.equal(nIntents(),1);
  const afterFirst=structuredClone(countQuota());
  // Duplicate item slot must roll back the quota transaction.
  assert.equal(reserveAndRecord(makeIntent(0)),false);
  assert.deepEqual({...countQuota()},afterFirst);
  assert.equal(nIntents(),1);
  assert.ok(reserveAndRecord(second));
  assert.equal(nIntents(),2);
  assert.equal(countQuota().lifetime_reserved_bytes,2048);
  assert.equal(countQuota().lifetime_reservations,2);

  // A bogus reference MAC cannot claim another request/slot.
  const cross={...makeIntent(1),reference_index:0,
    reference_mac:bindings[1].reference_mac};
  assert.throws(()=>insert.run(...params(cross)));
  const wrongShop={...makeIntent(1),shop:'jillonlinestore.myshopify.com'};
  assert.throws(()=>insert.run(...params(wrongShop)));
  const missing={...makeIntent(1),reference_index:7};
  assert.throws(()=>insert.run(...params(missing)));
  const replaced={...makeIntent(1),object_key:first.object_key};
  assert.throws(()=>insert.run(...params(replaced)));
  const badId={...makeIntent(1),reservation_id:'INVALID'};
  assert.throws(()=>insert.run(...params(badId)));

  const firstRow=db.prepare(
    'SELECT * FROM jill_work_r2_object_intents WHERE reference_index=0').get();
  assert.equal(firstRow.state,'reserved');
  assert.equal(firstRow.object_key,first.object_key);
  assert.equal(firstRow.reference_mac,bindings[0].reference_mac);
  const update=(state,stamp,index=0)=>db.prepare(
    'UPDATE jill_work_r2_object_intents SET state=?,updated_at_ms=? '+
    'WHERE reference_index=?').run(state,stamp,index);
  assert.throws(()=>db.prepare(
    "UPDATE jill_work_r2_object_intents SET object_key='work/quarantine/v1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'").run());
  assert.throws(()=>db.prepare('DELETE FROM jill_work_r2_object_intents').run());
  assert.throws(()=>update('quarantined_unlinked',at,0));
  update('ambiguous',at+1,0);
  assert.throws(()=>update('quarantined_unlinked',at+2,0));
  assert.throws(()=>update('reserved',at+2,0));
  update('revoked',at+3,0);
  assert.throws(()=>update('quarantined_unlinked',at+4,0));
  update('quarantined_unlinked',at+1,1);
  assert.throws(()=>update('reserved',at+2,1));

  const privacy={
    source:'trusted_server_cloudflare_r2_privacy_snapshot_v1',
    bucket:'jill-work-private-artwork',storage_class:'Standard',
    public_dev_url_enabled:false,custom_domain_count:0,
    checked_at_ms:at-1000,
  };
  const head={
    source:'trusted_server_r2_head_v1',key:first.object_key,
    size:first.byte_length,
    httpMetadata:{contentType:'application/octet-stream',
      cacheControl:'private, no-store',contentDisposition:'attachment'},
    customMetadata:{work_stage:'quarantine_v1',
      sha256:first.content_sha256,reference_mac:first.reference_mac},
  };
  const classify=(change={})=>inspectWorkR2ObjectReconciliation({
    intent:first,privacyAudit:privacy,providerHead:head,nowMs:at,...change,
  });
  const clean=classify();
  assert.equal(clean.state,'quarantined_unlinked_candidate');
  assert.equal(clean.preview_enabled,false);
  assert.equal(clean.auto_retry,false);
  assert.equal(clean.auto_delete,false);
  assert.equal(clean.quota_refund,false);
  assert.ok(Object.isFrozen(clean));
  for(const change of [
    {providerHead:null},
    {providerHead:{...head,key:second.object_key}},
    {providerHead:{...head,size:999}},
    {providerHead:{...head,customMetadata:{
      ...head.customMetadata,reference_mac:bindings[1].reference_mac,
    }}},
    {privacyAudit:{...privacy,public_dev_url_enabled:true}},
    {privacyAudit:{...privacy,checked_at_ms:at-3600000}},
  ]){
    const denied=classify(change);
    assert.equal(denied.state,'manual_review_required');
    assert.equal(denied.auto_retry,false);
    assert.equal(denied.quota_refund,false);
    assert.equal(denied.preview_enabled,false);
  }
  assert.throws(()=>classify({intent:{...first,object_key:second.object_key}}));
  assert.throws(()=>classify({intent:{...first,state:'revoked'}}));

  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_shopify_sessions').get().n,0);
  assert.equal(db.prepare('SELECT generation FROM jill_work_verified_inbox_index').get().generation,0);
  console.log('PASS WORK R2 object intents OFFLINE: atomic quota+intent synthetic transaction, unique canonical slot, immutable random private keys, forged MAC rejected, failure rollback, ambiguous/revoked lifecycle, HEAD mismatch manual review; uploads/previews OFF.');
}finally{db.close();}
