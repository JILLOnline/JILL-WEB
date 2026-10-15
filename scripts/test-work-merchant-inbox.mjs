import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  loadWorkMerchantInbox,projectWorkMerchantInbox,
} from '../services/jill-order-desk/merchant-inbox-read.mjs';
import {
  JILL_WORK_MERCHANT_SHOP,JILL_WORK_MERCHANT_CLIENT_ID,
} from '../backend/jill-merchant-auth.mjs';

const shop=JILL_WORK_MERCHANT_SHOP;
const authority={
  shop,environment:'WORK',app_client_id:JILL_WORK_MERCHANT_CLIENT_ID,
  owner_staff_id:'123',policy_version:1,
};
const request=new Request('https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/app/requests');
function session(id=123,owner=true) {
  return {
    shop,isOnline:true,expires:new Date(Date.now()+600000),
    onlineAccessInfo:{
      associated_user:{id,account_owner:owner},
      associated_user_scope:'read_orders,write_orders',
    },
  };
}
function mockDb({grant=null,missing=false,fail=false}={}) {
  let reads=0;
  return {
    get reads(){return reads;},
    prepare(sql) {
      reads++;
      assert.match(sql,/^SELECT /);
      assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE|DROP/i);
      return {
        bind(...args) {
          assert.equal(args[0],shop);
          return {
            async first() {
              if(fail)throw Error('D1 unavailable');
              if(sql.includes('jill_merchant_authority'))
                return missing?null:authority;
              if(sql.includes('jill_merchant_grants'))return grant;
              throw Error('Unexpected merchant SQL');
            },
          };
        },
      };
    },
  };
}
const auth=s=>({admin:async value=>{
  assert.equal(value,request);
  return {session:s};
}});
const example={
  version:1,operation:'custom_order.merchant.list.result',
  ok:true,shop,complete:true,
  records:[{
    submission_id:'jill:12345678-aaaa-bbbb-cccc-123456789012',
    revision:1,customer_status:'received',internal_status:'new',
    submitted_at:'2026-10-14T20:00:00.000Z',
    updated_at:'2026-10-14T20:00:00.000Z',
    date_needed:'2026-10-29',fulfillment:'pickup',item_count:2,
    email:'private@example.invalid',phone:'5555555555',actor:'secret-staff',
    internal_note:'private',raw_payload:'sensitive',
  }],
};

const db=mockDb();
const unavailable=await loadWorkMerchantInbox({
  request,authenticate:auth(session()),db,
});
assert.equal(unavailable.status,200);
assert.equal(unavailable.model.state,'source_not_connected');
assert.equal(unavailable.model.requestsConnected,false);
assert.deepEqual(unavailable.model.records,[]);
assert.ok(db.reads>=2);
assert.match(unavailable.headers['cache-control'],/no-store/);

let readerCalls=0;
const reader=async ({shop:verified})=>{
  readerCalls++;
  assert.equal(verified,shop);
  return example;
};
const permitted=await loadWorkMerchantInbox({
  request,authenticate:auth(session()),db:mockDb(),readCanonicalSource:reader,
});
assert.equal(permitted.status,200);
assert.equal(permitted.model.state,'ready');
assert.equal(permitted.model.requestsConnected,true);
assert.equal(permitted.model.records.length,1);
assert.equal(readerCalls,1);
const publicJSON=JSON.stringify(permitted);
for(const word of ['private@example.invalid','5555555555','secret-staff','sensitive'])
  assert.ok(!publicJSON.includes(word),'PII leaked from upstream projection: '+word);

// Pure numeric measurements for auth, D1 authorization and Google fetch;
// no customer, session, secret or request identifiers may be exported.
let ticks=0;
const phases=[];
const instrumented=await loadWorkMerchantInbox({
  request,db:mockDb(),
  authenticate:{admin:async()=>{
    ticks+=11;
    return {session:session()};
  }},
  readCanonicalSource:async()=>{
    ticks+=23;
    return example;
  },
  clock:()=>ticks,
  onTiming:(name,duration)=>phases.push([name,duration]),
});
assert.equal(instrumented.status,200);
assert.deepEqual(phases,[
  ['shopify_auth',11],['work_owner',0],['google_feed',23],
]);
const timingSource=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts','utf8');
for(const header of [
  'merchant-shopify;dur=','merchant-authority;dur=',
  'merchant-google;dur=','merchant-total;dur=',
  'x-jill-feed-cache',
])assert.ok(timingSource.includes(header),'Missing timing '+header);
assert.doesNotMatch(timingSource,/session\.id|session\.accessToken|customer\.email/);

const empty=projectWorkMerchantInbox({...example,records:[]});
assert.equal(empty.state,'ready');
assert.equal(empty.requestsConnected,true);
assert.deepEqual(empty.records,[]);

for(const changed of [
  {...example,shop:'jqtdgr-1y.myshopify.com'},
  {...example,complete:false},
  {...example,records:[example.records[0],example.records[0]]},
  {...example,records:Array(51).fill(example.records[0])},
  {...example,records:[{...example.records[0],revision:0}]},
  {...example,records:[{...example.records[0],customer_status:'PAID'}]},
  {...example,records:[{...example.records[0],item_count:9999}]},
  {...example,records:[{...example.records[0],date_needed:'tomorrow'}]},
])assert.throws(()=>projectWorkMerchantInbox(changed),/invalid_canonical/);

const bad=await loadWorkMerchantInbox({
  request,authenticate:auth(session()),db:mockDb(),
  readCanonicalSource:async()=>({...example,records:[{
    ...example.records[0],internal_status:'injected',
  }]}),
});
assert.equal(bad.status,503);
assert.equal(bad.model.state,'source_unavailable');
assert.deepEqual(bad.model.records,[]);

const throws=await loadWorkMerchantInbox({
  request,authenticate:auth(session()),db:mockDb(),
  readCanonicalSource:async()=>{throw Error('UPSTREAM SECRET NEVER LEAK');},
});
assert.equal(throws.status,503);
assert.ok(!JSON.stringify(throws).includes('UPSTREAM SECRET'));

for(const testcase of [
  {session:{...session(),shop:'jqtdgr-1y.myshopify.com'},db:mockDb(),status:401},
  {session:{...session(),isOnline:false},db:mockDb(),status:401},
  {session:session(456,false),db:mockDb(),status:403},
  {session:session(),db:mockDb({missing:true}),status:503},
  {session:session(),db:mockDb({fail:true}),status:503},
  {session:session(456,false),db:mockDb({grant:{
    shop,staff_id:'456',role:'order_manager',active:1,capabilities_json:'[]',
  }}),status:403},
]) {
  const start=readerCalls;
  const out=await loadWorkMerchantInbox({
    request,authenticate:auth(testcase.session),
    db:testcase.db,readCanonicalSource:reader,
  });
  assert.equal(out.status,testcase.status);
  assert.equal(out.model.state,'access_denied');
  assert.deepEqual(out.model.records,[]);
  assert.equal(readerCalls,start,'Unverified staff triggered source read');
}
const redirect=new Response(null,{status:302,headers:{location:'/auth/login'}});
await assert.rejects(()=>loadWorkMerchantInbox({
  request,authenticate:{admin:async()=>{throw redirect;}},db:mockDb(),
  readCanonicalSource:reader,
}),error=>error===redirect);

// Never wire a customer JWT account-reader as the merchant source.
const route=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
const source=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.requests-source.server.ts','utf8');
assert.match(source,/workShopify\(env\)\.authenticate/);
assert.match(source,/loadWorkMerchantInbox/);
assert.doesNotMatch(route,/workShopify\(|loadWorkMerchantInbox|export async function loader/);
assert.doesNotMatch(route,/custom-order-account-read|jill-custom-order-account|merchant\.list\?/,);
const appRoutes=readFileSync(
  'services/jill-order-desk/app-home/app/routes.ts','utf8');
assert.match(appRoutes,/route\("requests","routes\/app\.requests\.layout\.tsx",\[/);
assert.match(appRoutes,/index\("routes\/app\.requests\.tsx"\)/);
console.log('PASS WORK Owner-only inbox boundary: authenticated, read-only, isolated source, no invented counts, whitelisted records, and fail-closed unauthorized staff.');
