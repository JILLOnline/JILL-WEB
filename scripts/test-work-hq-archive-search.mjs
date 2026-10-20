import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {partitionWorkRequests,archiveReason,filterArchivedRequests}
  from '../services/jill-order-desk/work-request-archive-model.mjs';
import {validateWorkDetailSearch,validateWorkDetailSearchCursor,
  matchesVerifiedWorkDetail,DETAIL_SEARCH_PAGE_SIZE}
  from '../services/jill-order-desk/work-request-detail-search.mjs';
import {handleWorkRequestDetailSearch}
  from '../services/jill-order-desk/work-request-detail-search-action.mjs';
import {readWorkRemovedRequestIds,handleWorkArchiveRead,handleWorkArchiveWrite}
  from '../services/jill-order-desk/work-request-archive-store.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:12345678-aaaa-bbbb-cccc-123456789012';
const ID2='jill:12345678-aaaa-bbbb-cccc-123456789013';
const ID3='jill:12345678-aaaa-bbbb-cccc-123456789014';
const mk=(id,status)=>({submission_id:id,revision:1,
  customer_status:status,internal_status:'none',
  submitted_at:'2026-10-20T10:00:00.000Z',
  updated_at:'2026-10-20T10:00:00.000Z',
  date_needed:'2026-11-04',fulfillment:'pickup',item_count:1});
const records=[mk(ID,'received'),mk(ID2,'cancelled'),mk(ID3,'completed')];
const partition=partitionWorkRequests(records);
assert.deepEqual(partition.active.map(x=>x.submission_id),[ID]);
assert.deepEqual(partition.archive.map(x=>x.submission_id),[ID2,ID3]);
assert.equal(partition.completed_count,1);
assert.equal(partition.cancelled_count,1);
const removed=partitionWorkRequests(records,{removedIds:[ID]});
assert.deepEqual(removed.active,[]);
assert.deepEqual(removed.archive.map(x=>x.submission_id),[ID,ID2,ID3]);
assert.equal(removed.removed_count,1);
assert.equal(archiveReason(records[0],[ID]),'Removed');
assert.equal(archiveReason(records[1]),'Cancelled');
assert.equal(archiveReason(records[2]),'Completed');
assert.deepEqual(filterArchivedRequests(removed.archive,'removed',[ID]),[records[0]]);
assert.deepEqual(filterArchivedRequests(removed.archive,'completed',[ID]),[records[2]]);
assert.throws(()=>partitionWorkRequests(records,{removedIds:['bad']}));
assert.throws(()=>filterArchivedRequests(records,'deleted'));

const detail=id=>({
  version:1,operation:'custom_order.merchant.detail.result',
  submission_id:id,revision:1,submitted_at:'2026-10-20T10:00:00Z',
  customer:{name:'Ana María',email:'owner-private@example.invalid',
    phone:'555-0101',preferred_contact:'email'},
  planning:{date_needed:'2026-11-04',fulfillment:'pickup',
    address:{city:'Jacksonville',state:'Florida',postal_code:'32218',country_code:'US'},
    attributes:[{id:'event_type',label:'Event',value:'Under the Sea'}]},
  items:[{item_id:'item:11111111',product_id:'p-123',variant_id:'v-123',
    title:'Ariel cake topper',quantity:1,
    attributes:[{id:'color',label:'Color',value:'Ocean blue'}],
    variant_allocations:[{title:'Large',variant_id:'v-123',quantity:1}],
    personalization_groups:[{id:'P1',
      attributes:[{id:'text',label:'Name',value:'Sofía'}]}],
    reference_ids:['ref-123']}],
  request_attributes:[{id:'note',label:'Theme notes',value:'Seashells'}],
  reference_ids:[],attachment_state:'unresolved',
});
for(const term of ['ana maria','ANA MARÍA','owner-private@','555-0101',
  'jacksonville','32218','ariel','cake topper','ocean blue',
  'sofia','seashells','under the sea','P1','2026-11-04','ref-123'])
  assert.equal(matchesVerifiedWorkDetail(detail(ID),term),true,term);
assert.equal(matchesVerifiedWorkDetail(detail(ID),'dinosaurs'),false);
assert.equal(matchesVerifiedWorkDetail({...detail(ID),submission_id:ID2},'ana'),true);
assert.throws(()=>matchesVerifiedWorkDetail({},'ana'));
for(const bad of ['', ' ','a','a'.repeat(81),'a\nb'])assert.throws(()=>validateWorkDetailSearch(bad));
assert.equal(validateWorkDetailSearch(' ocean   blue '),'ocean blue');
assert.equal(DETAIL_SEARCH_PAGE_SIZE,6);
for(const c of ['1','-1','50','6'])assert.throws(()=>validateWorkDetailSearchCursor(c,3));
assert.equal(validateWorkDetailSearchCursor('0',3),0);

const source={version:1,operation:'custom_order.merchant.list.result',
  ok:true,complete:true,shop:SHOP,records};
const authority={shop:SHOP,environment:'WORK',
  app_client_id:'f8e1ebdbae84490dc8ea5b133637e6c0',
  owner_staff_id:'123',policy_version:1};
const session=(id=123,owner=true)=>({
  shop:SHOP,isOnline:true,expires:new Date(Date.now()+600000),
  onlineAccessInfo:{associated_user:{id,account_owner:owner},
    associated_user_scope:'read_orders,write_orders'},
});
const auth=s=>({admin:async()=>({session:s})});
let readCalls=0,detailCalls=0;
const db={
  prepare(sql) {
    return {bind(...args) {
      return {first:async()=>{
        if(sql.includes('jill_merchant_authority'))return authority;
        if(sql.includes('jill_merchant_grants'))return null;
        throw Error('Unexpected database read');
      }};
    }};
  },
};
const searchURL='https://work.example/app/requests/search';
const requestSearch=(overrides={})=>new Request(searchURL,{
  method:'POST',headers:{origin:'https://work.example',
    'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({
    q:'Ariel',cursor:'0',snapshot:'',
    tag:'00000000-1111-4222-8333-444444444444',...overrides,
  }),
});
const search=(overrides={})=>handleWorkRequestDetailSearch({
  request:requestSearch(),authenticate:auth(session()),
  db,enabled:true,
  readFreshList:async()=>{readCalls++;return source;},
  readExactDetail:async({submissionId})=>{detailCalls++;return detail(submissionId);},
  ...overrides,
});
let result=await search({enabled:false});
assert.equal(result.status,503);
assert.equal(readCalls,0);
result=await search({authenticate:auth(session(456,false))});
assert.equal(result.status,403);
assert.equal(readCalls,0);
result=await search({request:requestSearch({q:'x'})});
assert.equal(result.status,400);
assert.equal(readCalls,0);
result=await search();
assert.equal(result.status,200);
let body=await result.json();
assert.deepEqual(body.matches,[ID,ID2,ID3]);
assert.equal(body.scanned,3);
assert.equal(body.total,3);
assert.equal(body.next_cursor,null);
assert.equal(readCalls,1);
assert.equal(detailCalls,3);
assert.match(body.snapshot,/^[a-f0-9]{64}$/);
for(const privateValue of ['owner-private','Ana María','555-0101','Ariel cake topper','Sofía'])
  assert.ok(!JSON.stringify(body).includes(privateValue),'Response leaked private detail');
result=await search({request:requestSearch({cursor:'6',snapshot:body.snapshot})});
assert.equal(result.status,400,'Out of range search fails before detail reads');
result=await search({request:requestSearch({q:'Ariel'}),
  readExactDetail:async()=>{throw Error('Google detail unavailable');}});
assert.equal(result.status,503,'No silent false negative on missing detail');
result=await search({request:requestSearch({q:'Ariel'}),
  readExactDetail:async()=>detail('wrong-request')});
assert.equal(result.status,409);
assert.equal((await result.json()).code,'source_changed');

const noArchive=await handleWorkArchiveRead({
  request:new Request('https://work.example/app/requests/archive'),enabled:false,
});
assert.equal(noArchive.status,200);
assert.equal((await noArchive.json()).enabled,false);
const none=await handleWorkArchiveWrite({
  request:new Request('https://work.example/app/requests/archive',{
    method:'POST',
  }),enabled:false});
assert.equal(none.status,503);
assert.equal((await none.json()).code,'archive_not_enabled');
// Read-side tombstones never store PII or raw intake.
let read=await readWorkRemovedRequestIds({db:{
  prepare(sql){assert.match(sql,/SELECT submission_id/);
    assert.doesNotMatch(sql,/SELECT \*/);
    return {bind(){return {all:async()=>({success:true,
      results:[{submission_id:ID}]})};}};},
}});
assert.deepEqual(read,[ID]);
assert.match(readFileSync(
  'services/jill-order-desk/archive-proposals/0010_work_request_soft_archive.sql','utf8'),
  /CREATE TABLE IF NOT EXISTS jill_work_request_archive_operations/);
const appRoutes=readFileSync(
  'services/jill-order-desk/app-home/app/routes.ts','utf8');
assert.match(appRoutes,/route\("requests\/archive"/);
assert.match(appRoutes,/route\("requests\/search"/);
const archiveRoute=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests.archive.tsx','utf8');
assert.match(archiveRoute,/JILL_WORK_HQ_ARCHIVE_ENABLED==="true"/);
assert.doesNotMatch(archiveRoute,/deleteFrom|removeOrder|\\.delete\\(/);
const ui=readFileSync('services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
assert.match(ui,/partitionWorkRequests/);
assert.match(ui,/WORK_ARCHIVE_FILTERS/);
assert.match(ui,/ArchiveControl/);
assert.match(ui,/startFullSearch/);
assert.match(ui,/Search next 6 requests/);
assert.doesNotMatch(ui,/localStorage|sessionStorage/);
console.log('PASS WORK HQ: non-destructive status Archive, sealed removed tombstones, Owner-only six-at-a-time detailed search, no PII response, gated DB writes and immutable source. No deployment.');
