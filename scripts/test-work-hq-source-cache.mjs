import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  readWorkMerchantSourceCached,invalidateWorkMerchantSourceCache,
  WORK_MERCHANT_CACHE_MS,
} from '../services/jill-order-desk/work-merchant-source-cache.mjs';
import {projectWorkMerchantInbox} from '../services/jill-order-desk/merchant-inbox-read.mjs';
const record={
  submission_id:'jill:12345678-aaaa-bbbb-cccc-123456789012',
  revision:1,customer_status:'received',internal_status:'new',
  submitted_at:'2026-10-14T20:00:00.000Z',
  updated_at:'2026-10-14T20:00:00.000Z',
  date_needed:'2026-10-30',fulfillment:'pickup',item_count:1,
  email:'private@example.invalid',raw_payload:'SECRET_PAYLOAD',
};
const raw={version:1,operation:'custom_order.merchant.list.result',
  shop:'jill-work.myshopify.com',ok:true,complete:true,records:[record]};
let calls=0,at=1000;
const modes=[];
const reader=async()=>{calls++;return raw;};
const args={secret:'A'.repeat(40),reader,now:()=>at,onCache:x=>modes.push(x)};
assert.equal(WORK_MERCHANT_CACHE_MS,20000);
invalidateWorkMerchantSourceCache();
const first=await readWorkMerchantSourceCached(args);
assert.equal(calls,1);
assert.equal(first.records.length,1);
assert.equal(Object.keys(first.records[0]).length,9);
assert.ok(!JSON.stringify(first).includes('SECRET_PAYLOAD'));
assert.ok(!JSON.stringify(first).includes('private@example.invalid'));
assert.equal(projectWorkMerchantInbox(first).state,'ready');
at+=1000;
assert.equal(await readWorkMerchantSourceCached(args),first);
assert.equal(calls,1);
assert.deepEqual(modes,['miss','hit']);
at+=WORK_MERCHANT_CACHE_MS;
await readWorkMerchantSourceCached(args);
assert.equal(calls,2,'expired snapshot must re-read');
invalidateWorkMerchantSourceCache();
await readWorkMerchantSourceCached(args);
assert.equal(calls,3,'successful status writes may invalidate immediately');

// Concurrent, separately authenticated readers can share only the
// SOURCE operation. Authentication remains outside this module.
invalidateWorkMerchantSourceCache();
let complete;
const slow=()=>new Promise(resolve=>{complete=resolve;});
const slower={...args,reader:slow};
const p1=readWorkMerchantSourceCached(slower);
const p2=readWorkMerchantSourceCached(slower);
await Promise.resolve();
complete(raw);
assert.deepEqual(await Promise.all([p1,p2]),[first,first]);
assert.equal(modes.at(-1),'joined');

// Invalidation during an in-flight old read must not resurrect stale source.
invalidateWorkMerchantSourceCache();
let finishOld;
const oldReader=()=>new Promise(resolve=>{finishOld=resolve;});
const oldPending=readWorkMerchantSourceCached({...args,reader:oldReader});
await Promise.resolve();
invalidateWorkMerchantSourceCache();
finishOld(raw);
await oldPending;
await readWorkMerchantSourceCached(args);
assert.equal(calls,4,'invalidated in-flight snapshot must never warm cache');

// Malformed / failed canonical reads are NEVER cached or transformed to zero.
invalidateWorkMerchantSourceCache();
let failures=0;
await assert.rejects(()=>readWorkMerchantSourceCached({...args,reader:async()=>{
  failures++;throw Error('private upstream error');
}}));
await assert.rejects(()=>readWorkMerchantSourceCached({...args,reader:async()=>{
  failures++;return {...raw,records:[{...record,revision:0}]};
}}));
assert.equal(failures,2);
await readWorkMerchantSourceCached(args);
assert.equal(calls,5);
await assert.rejects(()=>readWorkMerchantSourceCached({...args,secret:'short'}));

// Signing secret change can never reuse an old credential's snapshot.
await readWorkMerchantSourceCached({...args,secret:'B'.repeat(40)});
assert.equal(calls,6);
const route=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
const reader=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts','utf8');
const boundary=readFileSync('services/jill-order-desk/merchant-inbox-read.mjs','utf8');
assert.match(reader,/readWorkMerchantSourceCached/);
assert.match(reader,/server-timing/);
assert.match(reader,/x-jill-feed-cache/);
assert.match(boundary,/readWorkMerchantPermission/);
assert.match(boundary,/access\.role!=='owner'/);
assert.match(reader,/loadWorkMerchantInbox/);
assert.doesNotMatch(route,/readWorkMerchantSourceCached|loadWorkMerchantInbox|server-timing/);
assert.doesNotMatch(route,/localStorage|sessionStorage/);
console.log('PASS 20-second WORK source-only cache: Owner gate preserved, source projections only, concurrent read coalescing, expiry, invalidation, credential isolation and fail-closed errors.');
