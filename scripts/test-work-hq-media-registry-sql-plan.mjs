// Offline, IN-MEMORY SQLite execution of an INERT WORK migration proposal.
// Never connects to real D1, Cloudflare, Shopify, Google or Cloudinary.
// Node >=22 built-in node:sqlite; no new npm dependencies or privileged keys.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';
import {draftWorkMediaRegistryBinding as draft,
  inspectWorkMediaRegistryBinding as inspect}
  from '../services/jill-order-desk/work-private-media-registry.mjs';

const ROOT='services/jill-order-desk/';
const LIVE_MIGRATIONS=ROOT+'migrations/';
const PLAN=ROOT+'migration-plans/0004_work_private_media_registry.sql';
const existing=readdirSync(LIVE_MIGRATIONS).sort();
assert.deepEqual(existing,[
  '0001_staff_authority.sql',
  '0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
], 'Registry proposal must NOT be automatically discoverable in the active migration directory');
const sql=readFileSync(PLAN,'utf8');
assert.match(sql,/INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION/);
assert.match(sql,/WITHOUT ROWID/);
assert.doesNotMatch(sql,/\b(?:https?:\/\/|res\.cloudinary\.com|API[_ ]KEY|customer_email)\b/i);
const db=new DatabaseSync(':memory:');
try{
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(readFileSync(LIVE_MIGRATIONS+'0001_staff_authority.sql','utf8'));
  db.exec(readFileSync(LIVE_MIGRATIONS+'0002_shopify_sessions.sql','utf8'));
  db.exec(readFileSync(LIVE_MIGRATIONS+'0003_work_verified_inbox_index.sql','utf8'));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_shopify_sessions').get().n,0);
  assert.equal(db.prepare('SELECT generation FROM jill_work_verified_inbox_index').get().generation,0);
  db.exec(sql);
  db.exec(sql); // proposal is idempotent; no duplicate table/triggers
  const table=db.prepare("PRAGMA table_info('jill_work_private_media_registry')").all();
  const columns=table.map(x=>x.name);
  assert.deepEqual(columns,[
    'shop','submission_id','scope','item_key','reference_index',
    'reference_mac','status','created_at_ms','updated_at_ms',
  ]);
  assert.ok(!columns.some(name=>/url|asset|file|provider|email|phone|customer|token|secret/i.test(name)));
  const shop='jill-work.myshopify.com';
  const request='jill:bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
  const registryKey='SYNTHETIC_ONLY_WORK_MAC_KEY_FOR_TESTING_987654321';
  const legacy='https://res.cloudinary.com/synthetic-work/image/upload/v1791926029/art.png';
  const raw={
    version:1,operation:'custom_order.submit',submission_id:request,
    submitted_at:'2026-10-15T22:00:00.000Z',
    customer:{name:'Synthetic',email:'work@example.invalid'},
    planning:{date_needed:'2026-11-10',fulfillment:'pickup'},
    items:[{
      item_id:'shopify-product:101',product_id:'shopify-product:101',
      title:'Synthetic Coloring Books',quantity:2,attributes:[],
      personalization_groups:[
        {id:'P1',allocations:[{unit_id:'u1'}],
          attributes:[{id:'name',value:'Ava'}]},
        {id:'P2',allocations:[{unit_id:'u2'}],
          attributes:[{id:'name',value:'Mia'}]},
      ],
      reference_ids:['jill:artwork-1'],
    },{
      item_id:'shopify-product:202',product_id:'shopify-product:202',
      title:'Synthetic Party Favor',quantity:1,
      attributes:[],personalization_groups:[],
      reference_ids:['jill:artwork-1'],
    }],
    request_attributes:[],reference_ids:[legacy,'jill:artwork-1'],
  };
  const detail=project({
    rawPayload:JSON.stringify(raw),submissionId:request,
    ownerAuthorized:true,revision:2,
  });
  assert.deepEqual(detail.items[0].personalization_groups.map(x=>x.id),['P1','P2']);
  const authInsert=db.prepare('INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,owner_bound_at) '+
    'VALUES (?,?,?,?,?)');
  authInsert.run(shop,'WORK','synthetic-app','synthetic-owner',
    '2026-10-15T22:00:00.000Z');
  const insert=db.prepare(
    'INSERT INTO jill_work_private_media_registry ('+
    'shop,submission_id,scope,item_key,reference_index,reference_mac,'+
    'status,created_at_ms,updated_at_ms) VALUES (?,?,?,?,?,?,?,?,?)');
  const at=1792101600000;
  const params=(r)=>[
    r.shop,r.submission_id,r.scope,r.item_id??'',r.reference_index,
    r.reference_mac,r.status,at,at,
  ];
  const requestSelector={scope:'request',index:0};
  const itemSelector={scope:'item',itemId:'shopify-product:101',index:0};
  const otherSelector={scope:'item',itemId:'shopify-product:202',index:0};
  const requestBinding=draft({
    detail,submissionId:request,selector:requestSelector,registryKey,
  });
  const itemBinding=draft({
    detail,submissionId:request,selector:itemSelector,registryKey,
  });
  const otherBinding=draft({
    detail,submissionId:request,selector:otherSelector,registryKey,
  });
  insert.run(...params(requestBinding));
  insert.run(...params(itemBinding));
  insert.run(...params(otherBinding));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_work_private_media_registry').get().n,3);
  assert.notEqual(itemBinding.reference_mac,otherBinding.reference_mac,
    'Same opaque reference copied to a different item must not share a MAC');
  const persisted=db.prepare(
    'SELECT shop,submission_id,scope,item_key,reference_index,reference_mac,status '+
    'FROM jill_work_private_media_registry WHERE shop=? AND submission_id=? '+
    'AND scope=? AND item_key=? AND reference_index=?').get(
      shop,request,'item','shopify-product:101',0);
  assert.equal(persisted.reference_mac,itemBinding.reference_mac);
  const mapped={version:1,shop:persisted.shop,
    submission_id:persisted.submission_id,
    scope:persisted.scope,item_id:persisted.item_key||null,
    reference_index:persisted.reference_index,
    reference_mac:persisted.reference_mac,
    status:persisted.status,provider:null};
  assert.deepEqual(inspect({
    detail,submissionId:request,selector:itemSelector,
    registryKey,record:mapped,
  }),{
    state:'preview_disabled',reason:'provider_storage_not_verified',
    scope:'item',item_id:'shopify-product:101',index:0,
  });

  // D1 must contain no raw source URLs, people, files or HMAC key values.
  const rawRows=JSON.stringify(db.prepare(
    'SELECT * FROM jill_work_private_media_registry').all());
  assert.doesNotMatch(rawRows,
    /res\.cloudinary|https?:|work@example|Synthetic Coloring|SYNTHETIC_ONLY_WORK_MAC_KEY/);
  const badRow=(fields)=>{
    const values=params(itemBinding);
    return insert.run(...fields(values));
  };
  const corruptions=[
    v=>{v[0]='jillonlinestore.myshopify.com';return v;},
    v=>{v[1]='other';return v;},
    v=>{v[2]='foreign';return v;},
    v=>{v[2]='request';return v;}, // requires empty item key
    v=>{v[3]='';return v;}, // item requires item key
    v=>{v[4]=-1;return v;},
    v=>{v[4]=20;return v;},
    v=>{v[4]=0.5;return v;},
    v=>{v[5]='a'.repeat(63);return v;},
    v=>{v[5]='Z'.repeat(64);return v;},
    v=>{v[5]='0'.repeat(64);return v;}, // no duplicate? actually valid & unique -> omit
    v=>{v[6]='verified';return v;},
    v=>{v[6]='revoked';return v;}, // inserts must start pending
    v=>{v[7]=0;return v;},
    v=>{v[8]=-1;return v;},
  ];
  for(const corrupt of corruptions){
    const values=params(itemBinding),v=corrupt(values);
    assert.throws(()=>insert.run(...v));
  }
  assert.throws(()=>insert.run(...params(itemBinding)),
    'Duplicate (shop,request,scope,item,index) must be rejected');
  // An HMAC from a different scope also cannot be reused.
  assert.throws(()=>insert.run(...[
    shop,request,'request','',4,itemBinding.reference_mac,
    'pending_verification',at,at,
  ]));
  // FK prevents registry entries with no commissioned WORK shop.
  assert.throws(()=>insert.run(...[
    shop.replace('jill-work','untrusted-work'),
    request,'request','',3,'f'.repeat(64),
    'pending_verification',at,at,
  ]));
  // Immutable keys and MAC cannot be rewritten or deleted.
  for(const [column,value] of [
    ['reference_mac','f'.repeat(64)],
    ['item_key','shopify-product:202'],
    ['reference_index',1],
    ['submission_id','jill:11111111-2222-4333-8444-555555555555'],
  ]){
    const stmt=db.prepare(
      'UPDATE jill_work_private_media_registry SET '+column+
      '=? WHERE shop=? AND submission_id=? AND scope=? AND item_key=?');
    assert.throws(()=>stmt.run(value,shop,request,'item','shopify-product:101'));
  }
  assert.throws(()=>db.prepare('DELETE FROM jill_work_private_media_registry WHERE shop=?').run(shop));
  db.prepare(
    'UPDATE jill_work_private_media_registry '+
    'SET status=?,updated_at_ms=? WHERE reference_mac=?'
  ).run('revoked',at+1000,itemBinding.reference_mac);
  assert.throws(()=>db.prepare(
    'UPDATE jill_work_private_media_registry '+
    'SET status=?,updated_at_ms=? WHERE reference_mac=?'
  ).run('pending_verification',at+2000,itemBinding.reference_mac),
  'Revoked reference cannot be revived by editing status');
  const revoked={...mapped,status:'revoked'};
  assert.throws(()=>inspect({
    detail,submissionId:request,selector:itemSelector,
    registryKey,record:revoked,
  }));
  // Existing D1 authority/session/inbox surfaces remain unchanged.
  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_merchant_authority').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM jill_shopify_sessions').get().n,0);
  assert.equal(db.prepare('SELECT generation FROM jill_work_verified_inbox_index').get().generation,0);
  console.log('PASS WORK registry SQL PLAN in-memory: pending-only, WORK-only FK, immutable source HMAC, no PII/URLs, duplicate/copy/status forgery denied; original 3 migrations unchanged, no real D1 writes.');
}finally{
  db.close();
}
