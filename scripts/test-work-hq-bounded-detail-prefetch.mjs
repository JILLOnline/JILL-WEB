import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkRequestDetailPrefetchQueue} from
 '../services/jill-order-desk/work-request-name-prefetch.mjs';

// Inject a deterministic clock: tests never leave real timers or HTTP
// requests active. Cancellation and the deadline are separate operations.
const timers=new Map();
let nextTimer=0;
const clock={
 setTimer:(callback,ms)=>{
  assert.equal(ms,30000);
  const id=++nextTimer;timers.set(id,callback);return id;
 },
 clearTimer:id=>timers.delete(id),
};
for(const n of [0,5,1.5,NaN,'2',null])
 assert.throws(()=>createWorkRequestDetailPrefetchQueue(n),/invalid_detail_prefetch_limit/);
for(const timeoutMs of [0,999,60001,NaN,'30000'])
 assert.throws(()=>createWorkRequestDetailPrefetchQueue(2,{...clock,timeoutMs}),
  /invalid_detail_prefetch_timeout/);
const create=limit=>createWorkRequestDetailPrefetchQueue(limit,clock);
const q=create(2);
const launched=[];
const one=q.schedule(()=>launched.push('one'));
const two=q.schedule(()=>launched.push('two'));
const three=q.schedule(()=>launched.push('three'));
const canceled=q.schedule(()=>launched.push('canceled'));
const five=q.schedule(()=>launched.push('five'));
assert.deepEqual(launched,['one','two'],'At most two optional reads start');
assert.equal(three.started,false);
canceled.cancel();
assert.equal(canceled.started,false);
one.finish();
assert.deepEqual(launched,['one','two','three'],'Queue is FIFO');
two.finish();
assert.deepEqual(launched,['one','two','three','five']);
const sixth=q.schedule(()=>launched.push('sixth'));
three.cancel(); // Started fetch is NOT confirmed stopped.
assert.equal(sixth.started,false,'Started cancel must not free its network slot');
five.finish();
assert.equal(sixth.started,true);
const seventh=q.schedule(()=>launched.push('seventh'));
assert.equal(seventh.started,false);
three.finish();
assert.equal(seventh.started,true,'Only actual completion releases started slot');
sixth.finish();seventh.finish();one.finish();three.finish();
assert.equal(timers.size,0,'All completed reads clear their deadlines');
assert.equal(Object.isFrozen(q),true);
assert.throws(()=>q.schedule(null),/invalid_detail_prefetch_task/);

const deadline=create(1);
const first=deadline.schedule(()=>launched.push('timeout-first'));
const second=deadline.schedule(()=>launched.push('timeout-next'));
first.cancel();
assert.equal(second.started,false,'A canceled started request retains lease');
assert.equal(timers.size,1,'Running request has a bounded expiry');
const callback=[...timers.values()][0];
callback();
assert.equal(second.started,true,'Timed out lease cannot starve visible rows');
first.finish();second.finish();
assert.equal(timers.size,0);

const fail=create(1);
const trace=[];
fail.schedule(()=>{trace.push('failed');throw Error('signed_source_unavailable');});
const recovered=fail.schedule(()=>trace.push('recovered'));
assert.deepEqual(trace,['failed','recovered'],
 'Synchronous failed starts cannot starve the queue');
recovered.finish();
assert.equal(timers.size,0);

const source=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
assert.match(source,/const namePrefetchQueue=useMemo\(\(\)=>\s*createWorkRequestDetailPrefetchQueue\(2\),\[\]\)/);
assert.match(source,/namePrefetchQueue=\{namePrefetchQueue\}/);
assert.match(source,/namePrefetchQueue\.schedule\(\(\)=>/);
assert.match(source,/namePrefetch\.current\?\.finish\(\)/);
assert.match(source,/namePrefetch\.current\?\.cancel\(\)/);
assert.match(source,/if\(typeof IntersectionObserver==="undefined"\)/);
assert.match(source,/return \(\)=>\{namePrefetch\.current\?\.cancel\(\)/);
assert.match(source,/orderDetails\.load\("\/app\/requests\/"\+encodeURIComponent\(item\.submission_id\)\)/);
assert.match(source,/WorkRequestQuickActions record=\{item\} enabled=\{controlsEnabled\}/);
assert.match(source,/direct editorHost=\{editorHost\}/);
assert.match(source,/WorkOrderDetailsContent model=\{orderDetails\.data\}/);
assert.doesNotMatch(source,/localStorage|sessionStorage|metafieldsSet|draftOrderCreate/);
console.log('PASS HQ prefetch leases: bounded FIFO, true started-cancel protection, deadline recovery, no customer cache, signed row-click bypass.');
