import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadJillOrderDeskHome} from '../services/jill-order-desk/admin-home.mjs';
import {
  JILL_WORK_MERCHANT_SHOP,JILL_WORK_MERCHANT_CLIENT_ID,
} from '../backend/jill-merchant-auth.mjs';

const authority={
  shop:JILL_WORK_MERCHANT_SHOP,
  environment:'WORK',
  app_client_id:JILL_WORK_MERCHANT_CLIENT_ID,
  owner_staff_id:'123',
  policy_version:1,
};
function mockDb({found=authority,grant=null,fail=false}={}) {
  const audit={reads:0,writes:0};
  const db={
    audit,
    prepare(query) {
      audit.reads++;
      assert.match(query,/^SELECT /);
      assert.doesNotMatch(query,/INSERT|UPDATE|DELETE|DROP/i);
      return {
        bind(...params){
          return {
            async first() {
              if(fail)throw new Error('db unavailable');
              if(query.includes('FROM jill_merchant_authority')){
                assert.deepEqual(params,[JILL_WORK_MERCHANT_SHOP]);
                return found;
              }
              if(query.includes('FROM jill_merchant_grants')){
                assert.equal(params[0],JILL_WORK_MERCHANT_SHOP);
                return grant;
              }
              throw new Error('Unexpected SQL');
            },
          };
        },
      };
    },
  };
  return db;
}
const session=(id,owner,online=true)=>({
  shop:JILL_WORK_MERCHANT_SHOP,
  isOnline:online,
  expires:new Date(Date.now()+600000),
  onlineAccessInfo:{
    associated_user:{id,account_owner:owner},
    associated_user_scope:'read_orders,write_orders',
  },
});
const request=new Request('https://work-admin.example.invalid/app');
const authenticated=(s)=>({
  admin:async r=>{
    assert.equal(r,request);
    return {session:s};
  },
});
async function run(s,db){
  return loadJillOrderDeskHome({request,authenticate:authenticated(s),db});
}

const db=mockDb();
const ok=await run(session(123,true),db);
assert.equal(ok.status,200);
assert.equal(ok.model.state,'staff_verified');
assert.equal(ok.model.role,'owner');
assert.equal(ok.model.teamSectionVisible,true);
assert.equal(ok.model.requestsConnected,false);
assert.equal(ok.model.invoicingEnabled,false);
assert.equal(ok.model.fulfillmentEnabled,false);
assert.equal(ok.model.teamManagementEnabled,false);
assert.match(ok.headers['cache-control'],/no-store/);
assert.ok(!JSON.stringify(ok).includes('123'));
assert.ok(db.audit.reads>0);
assert.equal(db.audit.writes,0);

const noDb=await run(session(123,true),null);
assert.equal(noDb.status,503);
assert.equal(noDb.model.state,'merchant_setup_required');
const missing=await run(session(123,true),mockDb({found:null}));
assert.equal(missing.status,503);
const failed=await run(session(123,true),mockDb({fail:true}));
assert.equal(failed.status,503);

const nonOwner=await run(session(444,false),mockDb());
assert.equal(nonOwner.status,403);
assert.equal(nonOwner.model.state,'access_denied');
const manager=await run(session(444,false),mockDb({grant:{
  shop:JILL_WORK_MERCHANT_SHOP,staff_id:'444',role:'order_manager',active:1,
  capabilities_json:'[]',
}}));
assert.equal(manager.status,200);
assert.equal(manager.model.role,'order_manager');
assert.equal(manager.model.teamSectionVisible,false);
assert.equal(manager.model.teamManagementEnabled,false);

const revoked=await run(session(444,false),mockDb({grant:{
  shop:JILL_WORK_MERCHANT_SHOP,staff_id:'444',role:'order_manager',active:0,
  capabilities_json:'[]',
}}));
assert.equal(revoked.status,403);
const offline=await run(session(123,true,false),db);
assert.equal(offline.status,401);
const mismatched=await run({...session(123,true),shop:'jqtdgr-1y.myshopify.com'},db);
assert.equal(mismatched.status,401);
const missingSession=await loadJillOrderDeskHome({
  request,authenticate:{admin:async()=>({})},db,
});
assert.equal(missingSession.status,401);
await assert.rejects(()=>loadJillOrderDeskHome({request,db}),
  /authenticated Admin route is required/);

// Preserve official Shopify SDK responses (e.g. redirect to auth) rather than
// fabricating an application-owned login system.
const authRedirect=new Response(null,{status:302,headers:{location:'/auth/login'}});
await assert.rejects(()=>loadJillOrderDeskHome({
  request,authenticate:{admin:async()=>{throw authRedirect;}},db,
}),err=>err===authRedirect);

const source=readFileSync('services/jill-order-desk/admin-home.mjs','utf8');
assert.match(source,/authenticate\.admin\(request\)/);
assert.match(source,/readWorkMerchantPermission/);
assert.doesNotMatch(source,/customer[_-]?id|discountCodeBasicCreate|draftOrderCreate|paymentCapture|fetch\(/i);
console.log('WORK merchant App Home contract passed: official Shopify auth first, D1 deny-by-default, staff roles, no writes, redirects preserved.');
