import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  authorizeWorkOwnerSetup,readWorkOwnerSetup,commitWorkOwnerSetup,
} from '../services/jill-order-desk/owner-bootstrap-route.mjs';

const shop='jill-work.myshopify.com';
const origin='https://jill-order-desk-work.jill-work-custom-orders.workers.dev';
let ownerId=null,audits=0,batchCount=0,reads=0;
const db={
  prepare(sql) {
    assert.match(sql,/^(SELECT |INSERT INTO )/);
    return {bind(...args){
      return {
        async first() {
          reads++;
          assert.match(sql,/^SELECT /);
          return ownerId?{shop,environment:'WORK',app_client_id:'f8e1ebdbae84490dc8ea5b133637e6c0',owner_staff_id:ownerId,policy_version:1}:null;
        },
        sql,args,
      };
    }};
  },
  async batch(stmts) {
    batchCount++;
    assert.equal(stmts.length,2);
    assert.match(stmts[0].sql,/ON CONFLICT\(shop\) DO NOTHING/);
    const requestedId=String(stmts[0].args[3]);
    if(!ownerId) {ownerId=requestedId;audits++;}
    return [{success:true},{success:true}];
  },
};
const valid=id=>({
  shop,isOnline:true,expires:new Date(Date.now()+100000),
  onlineAccessInfo:{
    associated_user:{id,account_owner:true},
    associated_user_scope:'read_orders,write_orders',
  },
});
function auth(session=valid(100)) {
  return {admin:async request=> {
    assert.ok(request instanceof Request);
    return {session};
  }};
}
function env(enabled=true) {
  return {
    JILL_ORDER_DESK_WORK_DB:db,
    JILL_WORK_HOST_STAGE:'work',
    JILL_WORK_OWNER_BOOTSTRAP_ENABLED:enabled?'true':'false',
  };
}
function request(method='GET',confirm='bind-my-work-shopify-owner',{
  originHeader=origin,mime='application/x-www-form-urlencoded',
}={}) {
  const headers={'Origin':originHeader};
  if(method==='POST')headers['Content-Type']=mime;
  return new Request(origin+'/app/setup-owner',{
    method,headers,body:method==='POST'
      ? new URLSearchParams({confirm}).toString():undefined,
  });
}
const get=async(opts={})=>{
  const result=await readWorkOwnerSetup({
    request:request(),authenticate:auth(opts.session),env:env(opts.enabled),
  });
  return {status:result.status,body:await result.json()};
};
let a=await get();
assert.equal(a.status,200);
assert.equal(a.body.state,'ready_to_bind');
assert.equal(ownerId,null);
assert.equal(batchCount,0,'GET never changes owner');
assert.equal((await get({enabled:false})).status,503);
assert.equal((await get({session:valid(200)})).status,200);
const nonOwner={...valid(500),onlineAccessInfo:{
  ...valid(500).onlineAccessInfo,
  associated_user:{id:500,account_owner:false},
}};
assert.equal((await get({session:nonOwner})).status,403);
assert.equal((await get({session:{...valid(100),shop:'jqtdgr-1y.myshopify.com'}})).status,401);
assert.equal(batchCount,0);

async function submit({id=100,confirm='bind-my-work-shopify-owner',
  originHeader=origin,mime='application/x-www-form-urlencoded',
  enabled=true,session=valid(id),method='POST',
}={}) {
  const r=await commitWorkOwnerSetup({
    request:request(method,confirm,{originHeader,mime}),
    authenticate:auth(session),env:env(enabled),
  });
  return {status:r.status,body:await r.json(),headers:r.headers};
}
assert.equal((await submit({enabled:false})).status,503);
assert.equal((await submit({session:nonOwner})).status,403);
assert.equal((await submit({method:'GET'})).status,405);
assert.equal((await submit({originHeader:'https://evil.invalid'})).status,403);
assert.equal((await submit({mime:'application/json'})).status,415);
assert.equal((await submit({confirm:'yes'})).status,400);
assert.equal(batchCount,0);

a=await submit();
assert.equal(a.status,200);
assert.equal(a.body.state,'owner_bound');
assert.match(a.headers.get('cache-control'),/no-store/);
assert.equal(ownerId,'100');
assert.equal(batchCount,1);
assert.equal(audits,1);
assert.doesNotMatch(JSON.stringify(a.body),/100|owner_staff_id|token/i);
assert.equal((await get()).body.state,'already_bound');
a=await submit();
assert.equal(a.status,200,'same authenticated owner retry is safe');
assert.equal(audits,1,'owner is immutable under retry');
a=await submit({id:200});
assert.equal(a.status,409,'different WORK Shopify owner cannot override binding');
assert.equal(a.body.code,'owner_already_bound');
assert.equal(audits,1);
assert.equal(ownerId,'100');
assert.ok(reads>0);

const sdkRedirect=new Response(null,{status:302,headers:{location:'/auth/login'}});
await assert.rejects(()=>readWorkOwnerSetup({
  request:request(),
  authenticate:{admin:async()=>{throw sdkRedirect;}},env:env(),
}),error=>error===sdkRedirect);
await assert.rejects(()=>commitWorkOwnerSetup({
  request:request('POST'),authenticate:{admin:async()=>{throw sdkRedirect;}},
  env:env(),
}),error=>error===sdkRedirect);
await assert.rejects(()=>authorizeWorkOwnerSetup({
  request:request(),authenticate:null,env:env(),
}),/verified_shopify_admin_required/);

const setupUI=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.setup-owner.tsx','utf8');
const homeUI=readFileSync(
  'services/jill-order-desk/app-home/app/routes/app.index.tsx','utf8');
// A full-page link or form navigation in embedded Shopify Admin can lose
// the SDK/App Bridge context and show an unhelpful successful HTTP page.
assert.match(homeUI,/import \{Link,/);
assert.match(homeUI,/<Link to="\/app\/setup-owner">/);
assert.doesNotMatch(homeUI,/<a href="\/app\/setup-owner">/);
assert.match(setupUI,/useFetcher<Result>\(\)/);
assert.match(setupUI,/<fetcher\.Form method="post">/);
assert.match(setupUI,/submitted\?\.state==="owner_bound"/);
assert.doesNotMatch(setupUI,/<Form method="post">/);

const source=readFileSync('services/jill-order-desk/owner-bootstrap-route.mjs','utf8');
assert.match(source,/authenticate\.admin\(request\)/);
assert.match(source,/origin/);
assert.match(source,/JILL_WORK_OWNER_BOOTSTRAP_ENABLED/);
assert.doesNotMatch(source,/draftOrderCreate|discountCodeBasicCreate|fetch\(/i);
console.log('JILL WORK Owner commissioning: authenticated online account owner, flag and confirmation, origin checks, immutable binding, no sensitive response and zero guest privileges passed.');
