// Pure offline synthetic budget-gate test; no Cloudflare, D1 or R2.
import assert from 'node:assert/strict';
import {
  WORK_IMAGES_ACCOUNT_ID,WORK_IMAGES_POLICY,makeWorkImagesFreeBudgetGate,
} from '../services/jill-order-desk/work-private-media-budget-gate.mjs';
import {sanitizeWorkArtworkWithImages}
  from '../services/jill-order-desk/work-private-images-sanitizer.mjs';
const now=1792160000000,shop='jill-work.myshopify.com';
const period=new Date(now).toISOString().slice(0,7);
const snapshot={
  source:'verified_cloudflare_account_usage_v1',
  account_id:WORK_IMAGES_ACCOUNT_ID,shop,period,plan:'free',
  complete:true,includes_other_services:true,checked_at_ms:now-1000,
  account_unique_transformations:10,work_reserved_transformations:0,
};
const res=async args=>({
  source:'work_atomic_images_reservation_v1',approved:true,
  account_id:args.accountId,shop:args.shop,period:args.period,
  nonce:args.nonce,previous_account_count:args.expectedAccountCount,
  previous_work_reservations:args.expectedWorkReservations,
  new_work_reservations:args.expectedWorkReservations+1,
});
const input={shop,kind:'private_artwork_sanitize_v1'};
const g=makeWorkImagesFreeBudgetGate({nowMs:now,
  readAccountSnapshot:async()=>snapshot,reserveAtomic:res});
assert.deepEqual(await g(input),{
  allowed:true,plan:'free',source:'trusted_work_images_free_gate_v1'
});
assert.ok(Object.isFrozen(await g(input)));
assert.equal(WORK_IMAGES_POLICY.max_account_unique_month,4500);
assert.equal(WORK_IMAGES_POLICY.max_work_reservations_month,100);
assert.equal(WORK_IMAGES_POLICY.shop,shop);
await assert.rejects(()=>g({...input,shop:'jillonlinestore.myshopify.com'}),/not_authorized/);
await assert.rejects(()=>g({...input,kind:'media_public_preview'}),/not_authorized/);
for (const change of [
  {source:'browser_claim'}, {account_id:'wrong'}, {shop:'other'},
  {period:'2026-09'}, {plan:'paid'}, {plan:'unknown'},
  {complete:false},{includes_other_services:false},
  {checked_at_ms:now+1},{checked_at_ms:now-400000},
  {account_unique_transformations:4500},
  {account_unique_transformations:99999999},
  {work_reserved_transformations:100},
  {work_reserved_transformations:-1},
  {account_unique_transformations:1.4},
]){
  let reserved=0;
  const gate=makeWorkImagesFreeBudgetGate({nowMs:now,
    readAccountSnapshot:async()=>({...snapshot,...change}),
    reserveAtomic:async()=>{reserved++;return null;}});
  await assert.rejects(()=>gate(input),/not_authorized/);
  assert.equal(reserved,0,'invalid provider usage must not reserve');
}
for(const callback of [
  async()=>{throw Error('DB SECRET');},
  async()=>null,
  async args=>({...await res(args),approved:false}),
  async args=>({...await res(args),nonce:'forged'}),
  async args=>({...await res(args),new_work_reservations:999}),
]) {
  const gate=makeWorkImagesFreeBudgetGate({nowMs:now,
    readAccountSnapshot:async()=>snapshot,reserveAtomic:callback});
  await assert.rejects(()=>gate(input),/not_authorized/);
}
let attempted=0;
const gate=makeWorkImagesFreeBudgetGate({nowMs:now,
  readAccountSnapshot:async()=>snapshot,
  reserveAtomic:async args=>{attempted++;return res(args);}});
await Promise.all([gate(input),gate(input)]);
assert.equal(attempted,2,
  'mock only; real durable CAS must reject concurrent stale snapshots');
for(const bad of [
  {nowMs:now,readAccountSnapshot:undefined,reserveAtomic:res},
  {nowMs:now,readAccountSnapshot:async()=>snapshot},
  {nowMs:0,readAccountSnapshot:async()=>snapshot,reserveAtomic:res},
])assert.throws(()=>makeWorkImagesFreeBudgetGate(bad),/not_authorized/);

// Check that a rejected budget prevents ANY Images binding call.
const png=Buffer.alloc(33);
Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
png.writeUInt32BE(13,8);png.write('IHDR',12);
png.writeUInt32BE(60,16);png.writeUInt32BE(60,20);
let imageCalls=0;
const images={
  input(){
    imageCalls++;
    return {
      transform(){return this;},
      output(){
        return {response:async()=>new Response(new ReadableStream({
          start(c){c.enqueue(png);c.close();}
        }),{headers:{'content-type':'image/png'}})};
      },
    };
  },
};
const args={shop,bytes:png,declaredMime:'image/png',images};
const rejectGate=makeWorkImagesFreeBudgetGate({nowMs:now,
  readAccountSnapshot:async()=>({...snapshot,plan:'paid'}),reserveAtomic:res});
await assert.rejects(()=>sanitizeWorkArtworkWithImages({
  ...args,authorizeFreeTransformation:rejectGate,
}),/work_private_images_sanitization_unavailable/);
assert.equal(imageCalls,0,'Images must not run when budget denied');
await sanitizeWorkArtworkWithImages({...args,authorizeFreeTransformation:g});
assert.equal(imageCalls,1);
console.log('PASS WORK Images budget gate offline: current-month account scope, Free-only, low caps, atomic reservation contract, denied forgeries/races and sanitizer invocation order. No Cloudflare operations.');
