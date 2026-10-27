import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkRequestDetailPrefetchQueue} from
 '../services/jill-order-desk/work-request-name-prefetch.mjs';

for(const n of [0,5,1.5,NaN,'2',null])
 assert.throws(()=>createWorkRequestDetailPrefetchQueue(n),/invalid_detail_prefetch_limit/);
const q=createWorkRequestDetailPrefetchQueue(2);
const launched=[];
const one=q.schedule(()=>launched.push('one'));
const two=q.schedule(()=>launched.push('two'));
const three=q.schedule(()=>launched.push('three'));
const canceled=q.schedule(()=>launched.push('canceled'));
const five=q.schedule(()=>launched.push('five'));
assert.deepEqual(launched,['one','two'],'At most two automatic reads launch');
assert.equal(three.started,false);
canceled.cancel();
assert.equal(canceled.started,false);
one.finish();
assert.deepEqual(launched,['one','two','three'],'Queue is FIFO for visible requests');
assert.equal(three.started,true);
two.finish();
assert.deepEqual(launched,['one','two','three','five'],'Cancelled row never launches');
three.cancel();five.finish();one.finish(); // Double release is safe.
assert.equal(Object.isFrozen(q),true);
assert.throws(()=>q.schedule(null),/invalid_detail_prefetch_task/);

const fail=createWorkRequestDetailPrefetchQueue(1);
const trace=[];
fail.schedule(()=>{trace.push('failed');throw Error('signed_source_unavailable');});
fail.schedule(()=>trace.push('recovered'));
assert.deepEqual(trace,['failed','recovered'],
 'A synchronous failed start must not starve the next row');

const source=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
assert.match(source,/const namePrefetchQueue=useMemo\(\(\)=>\s*createWorkRequestDetailPrefetchQueue\(2\),\[\]\)/);
assert.match(source,/namePrefetchQueue=\{namePrefetchQueue\}/);
assert.match(source,/namePrefetchQueue\.schedule\(\(\)=>/);
assert.match(source,/namePrefetch\.current\?\.finish\(\)/);
assert.match(source,/namePrefetch\.current\?\.cancel\(\)/);
assert.match(source,/if\(typeof IntersectionObserver==="undefined"\)/);
assert.match(source,/return \(\)=>\{namePrefetch\.current\?\.cancel\(\)/);
assert.match(source,/requestedId\.current=item\.submission_id;/);
assert.match(source,/orderDetails\.load\("\/app\/requests\/"\+encodeURIComponent\(item\.submission_id\)\)/);
assert.match(source,/WorkRequestQuickActions record=\{item\} enabled=\{controlsEnabled\}/);
assert.match(source,/direct editorHost=\{editorHost\}/);
assert.match(source,/WorkOrderDetailsContent model=\{orderDetails\.data\}/);
assert.doesNotMatch(source,/localStorage|sessionStorage|metafieldsSet|draftOrderCreate/);
console.log('PASS HQ bounded optional detail prefetch: two concurrent slots, FIFO, cancel, exception recovery, signed click bypass and no data cache.');
