import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  readWorkD1IndexedMerchantList as read,
  invalidateWorkD1InboxIndex as invalidate,
  WORK_INBOX_D1_TTL_MS as TTL,
} from '../services/jill-order-desk/work-merchant-d1-index.mjs';

const shop='jill-work.myshopify.com';
const row={generation:0,verified_payload_json:null,
  verified_at_ms:0,expires_at_ms:0};
let queries=0,updates=0;
const db={
  prepare(sql){
    assert.ok(sql.includes('jill_work_verified_inbox_index'));
    return {bind(...args){
      if(sql.startsWith('SELECT')){
        assert.deepEqual(args,[shop]);
        return {async first(){queries++;return {...row};}};
      }
      if(sql.includes('generation=generation+1')){
        assert.deepEqual(args,[shop]);
        return {async run(){
          row.generation++;
          row.verified_payload_json=null;
          row.verified_at_ms=0;
          row.expires_at_ms=0;
          return {success:true,meta:{changes:1}};
        }};
      }
      if(sql.startsWith('UPDATE')&&sql.includes('verified_payload_json=?')){
        const [payload,at,expires,target,generation,readStarted]=args;
        assert.equal(target,shop);
        return {async run(){
          updates++;
          if(generation!==row.generation || row.verified_at_ms>readStarted)
            return {success:true,meta:{changes:0}};
          row.verified_payload_json=payload;
          row.verified_at_ms=at;
          row.expires_at_ms=expires;
          return {success:true,meta:{changes:1}};
        }};
      }
      throw Error('Unexpected D1 SQL');
    }};
  },
};
assert.equal(TTL,60000);
const sample={
  version:1,operation:'custom_order.merchant.list.result',
  ok:true,complete:true,shop,records:[{
    submission_id:'jill:78270ba7-d58f-400e-b322-2c8241baa884',
    revision:3,customer_status:'reviewing',internal_status:'needs_quote',
    submitted_at:'2026-10-14T18:00:00.000Z',
    updated_at:'2026-10-15T18:00:00.000Z',
    date_needed:'2026-11-01',fulfillment:'shipping',item_count:2,
    email:'PRIVATE@example.invalid',raw_payload:'HIDDEN_CUSTOM_ORDER',
  }],
};
let ms=100_000,calls=0;
const modes=[];
const get=async()=>{
  calls++;
  return sample;
};
const options={db,readCanonicalSource:get,now:()=>ms,
  onCache:mode=>modes.push(mode)};
const first=await read(options);
assert.equal(calls,1);
assert.equal(queries,1);
assert.equal(first.records.length,1);
assert.equal(Object.keys(first.records[0]).length,9);
assert.equal(row.expires_at_ms,ms+TTL);
assert.ok(!row.verified_payload_json.includes('PRIVATE@example.invalid'));
assert.ok(!row.verified_payload_json.includes('HIDDEN_CUSTOM_ORDER'));
assert.equal((await read(options)).records[0].revision,3);
assert.equal(calls,1,'Shared D1 hit must NOT repeat Google');
assert.deepEqual(modes.slice(0,2),['d1-miss','d1-hit']);
ms+=TTL;
await read(options);
assert.equal(calls,2,'Expired index must reverify signed source');
ms+=1;
await read({...options,forceFresh:true});
assert.equal(calls,3,'Explicit owner refresh must bypass D1');
await invalidate(db);
assert.equal(row.verified_payload_json,null);
assert.equal(row.generation,1);
await read(options);
assert.equal(calls,4,'Confirmed command invalidation must force Google refresh');

// A read begun before a confirmed status append MUST NOT warm D1 again.
await invalidate(db);
let resume;
const pending=read({...options,readCanonicalSource:()=>new Promise(
  resolve=>{resume=resolve;}),
});
await Promise.resolve();
await invalidate(db);
resume(sample);
await pending;
assert.equal(row.verified_payload_json,null,
  'Stale in-flight source resurrected after confirmed write');
assert.ok(updates>=4);
await assert.rejects(()=>read({...options,readCanonicalSource:async()=>({
  ...sample,records:[{...sample.records[0],revision:0}],
})}),/invalid_canonical/);
assert.equal(row.verified_payload_json,null,
  'Invalid upstream Google projection should not be cached');

// Source-only: feature flag must be missing from existing WORK manifest and
// the auth/Owner D1 boundary must still run BEFORE the optional D1 index.
const server=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts',
  'utf8');
const writer=readFileSync('services/jill-order-desk/merchant-command.mjs','utf8');
const action=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests.command.tsx','utf8');
const config=readFileSync(
  'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8');
assert.match(server,/JILL_WORK_HQ_FAST_INBOX_ENABLED==="true"/);
assert.match(server,/readWorkD1IndexedMerchantList/);
assert.match(server,/loadWorkMerchantInbox\(/);
assert.match(writer,/invalidateWorkD1InboxIndex/);
assert.match(writer,/if\(fastIndexEnabled===true\)/);
assert.match(action,/fastIndexEnabled:/);
assert.ok(!config.includes('JILL_WORK_HQ_FAST_INBOX_ENABLED'),
  'Feature must remain opt-in OFF until dedicated WORK D1 migration');
console.log('PASS WORK D1 index: shared verified nine-field index, 60s TTL, forced refresh, atomic write invalidation, concurrent-generation race denial, WORK-only and OFF-by-default guards.');
