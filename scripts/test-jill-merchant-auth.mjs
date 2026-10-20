import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  JILL_WORK_MERCHANT_CLIENT_ID,JILL_WORK_MERCHANT_SHOP,
  requireWorkMerchantIdentity,
} from '../backend/jill-merchant-auth.mjs';
import {
  JILL_MERCHANT_ROLES,JILL_MERCHANT_ACTIONS,
  evaluateJillMerchantPermission,authorizeJillMerchantOnlineSession,
} from '../backend/jill-merchant-policy.mjs';
import {
  readWorkMerchantPermission,bootstrapWorkMerchantOwner,
} from '../services/jill-order-desk/merchant-access.mjs';

const base={shop:JILL_WORK_MERCHANT_SHOP,isOnline:true,
  onlineAccessInfo:{
    associated_user:{id:105,account_owner:true},
    associated_user_scope:'read_orders,write_orders',
  },expires:new Date(Date.now()+3600000)};
const staff=(id,owner=false,scope='read_orders,write_orders')=>({
  ...base,onlineAccessInfo:{
    associated_user:{id,account_owner:owner},associated_user_scope:scope,
  },
});
const owner=staff(105,true);
const admin=staff(205,false);
const other=staff(306,false);
const authority={
  shop:JILL_WORK_MERCHANT_SHOP,environment:'WORK',
  app_client_id:JILL_WORK_MERCHANT_CLIENT_ID,
  owner_staff_id:'105',policy_version:1,
};
const grant=(who,role,more={})=>({
  shop:JILL_WORK_MERCHANT_SHOP,staff_id:String(who),
  active:1,role,capabilities_json:'[]',...more,
});

assert.deepEqual(JILL_MERCHANT_ROLES,
  ['owner','administrator','order_manager','production','viewer']);
for (const a of ['production.update','production.internal_note','quote.prepare',
  'draft.create','invoice.send','fulfillment.manage','refund.approve',
  'team.grant','team.revoke','owner.transfer']) {
  assert.equal(JILL_MERCHANT_ACTIONS[a].enabled,false,
    'No merchant mutation can be enabled in foundational source: '+a);
}
const identity=requireWorkMerchantIdentity(owner);
assert.equal(identity.staffId,'105');
assert.equal(identity.shopifyAccountOwner,true);
assert.deepEqual(identity.scopes,['read_orders','write_orders']);
assert.equal(Object.isFrozen(identity),true);
assert.equal(Object.isFrozen(identity.scopes),true);

for(const bad of [
  {...owner,isOnline:false},
  {...owner,shop:'jqtdgr-1y.myshopify.com'},
  {...owner,shop:'evil.test'},
  {...owner,expires:new Date(Date.now()-60000)},
  {...owner,onlineAccessInfo:{associated_user:{id:0,account_owner:true},associated_user_scope:''}},
  {...owner,onlineAccessInfo:{associated_user:{id:105,account_owner:'true'},associated_user_scope:''}},
  {...owner,onlineAccessInfo:{associated_user:{id:105,account_owner:true},associated_user_scope:undefined}},
  {...owner,onlineAccessInfo:{associated_user:{id:105,account_owner:true},associated_user_scope:'read_orders,read_orders'}},
  {...owner,onlineAccessInfo:{associated_user:{id:105,account_owner:true},associated_user_scope:'write_orders, admin'}},
  {...owner,onlineAccessInfo:null},
  null,
]) assert.throws(()=>requireWorkMerchantIdentity(bad),/unverified/, 'Unsafe SDK context not accepted');
assert.throws(()=>requireWorkMerchantIdentity(owner,{
  expectedShop:'jqtdgr-1y.myshopify.com',
}),/unverified/);
assert.throws(()=>requireWorkMerchantIdentity(owner,{
  expectedClientId:'ebf1a69d82f46619d2f2945faab78afa',
}),/unverified/);
const allowed=(s,action,g,assignedStaffIds=null,a=authority)=>
  authorizeJillMerchantOnlineSession({
    session:s,authority:a,grant:g,action,assignedStaffIds,
  });
assert.equal(allowed(owner,'requests.read').allowed,true);
assert.equal(allowed(owner,'team.read').allowed,true);
assert.equal(allowed(owner,'invoice.send').code,'feature_not_enabled');
assert.equal(allowed(owner,'owner.transfer').allowed,false);
assert.equal(allowed(owner,'not_existing').code,'unknown_action');
assert.equal(allowed(admin,'requests.read',grant(205,'administrator')).allowed,true);
assert.equal(allowed(admin,'team.read',grant(205,'administrator')).code,'forbidden');
assert.equal(allowed(admin,'invoice.send',grant(205,'administrator',{
  capabilities_json:'["invoice.send"]',
})).code,'feature_not_enabled');
assert.equal(allowed(other,'requests.read').code,'forbidden');
assert.equal(allowed(other,'requests.read',grant(306,'viewer')).code,'unassigned');
assert.equal(allowed(other,'requests.read',grant(306,'viewer'),['306']).allowed,true);
assert.equal(allowed(other,'requests.read',grant(306,'production'),['306']).allowed,true);
assert.equal(allowed(other,'requests.read',grant(306,'viewer',{active:0}),['306']).code,'forbidden');
assert.equal(allowed(other,'requests.read',grant(306,'owner'),['306']).code,'forbidden');
assert.equal(allowed(other,'requests.read',grant(306,'viewer',{shop:'another.myshopify.com'}),['306']).code,'forbidden');
assert.equal(allowed(other,'requests.read',grant(306,'viewer',{staff_id:'999'}),['306']).code,'forbidden');
assert.equal(allowed(other,'requests.read',grant(306,'__proto__'),['306']).code,'forbidden');
assert.equal(allowed(admin,'requests.read',grant(205,'administrator'),null,{
  ...authority,app_client_id:'LIVE_APP_ID',
}).code,'authority_unavailable');
assert.equal(allowed(admin,'requests.read',grant(205,'administrator'),null,{
  ...authority,environment:'LIVE',
}).code,'authority_unavailable');
assert.equal(allowed(staff(105,false),'team.read').code,'forbidden',
  'Owner registry alone is insufficient without Shopify account_owner proof');
assert.equal(allowed({...owner,isOnline:false},'team.read').code,'unauthenticated');
assert.equal(evaluateJillMerchantPermission({identity:null,authority,action:'team.read'}).code,
  'unauthenticated');

// D1-like mock stores only the authority and grants needed by this phase.
// The adapter only uses parameterized SQL and never opens Shopify or Google.
function memoryD1() {
  let row=null;
  const grants=new Map();
  const audit=new Map();
  let batchCalls=0;
  return {
    get authority(){return row;},
    get auditCount(){return audit.size;},
    get batchCalls(){return batchCalls;},
    grants,
    prepare(sql) {
      assert.ok(sql.includes('?'), 'All dynamic SQL must use D1 binds.');
      return {
        bind(...args) {
          return {
            async first() {
              if(sql.includes('FROM jill_merchant_authority'))return row;
              if(sql.includes('FROM jill_merchant_grants'))return grants.get(args[1])||null;
              throw Error('Unrecognized select');
            },
            sql,args,
          };
        },
      };
    },
    async batch(statements) {
      batchCalls++;
      assert.equal(statements.length,2);
      assert.match(statements[0].sql,/INSERT INTO jill_merchant_authority/);
      assert.match(statements[0].sql,/ON CONFLICT\(shop\) DO NOTHING/);
      assert.match(statements[1].sql,/INSERT INTO jill_merchant_audit/);
      if(!row) {
        const [shop,environment,app_client_id,owner_staff_id,owner_bound_at]=statements[0].args;
        row={shop,environment,app_client_id,owner_staff_id,owner_bound_at,
          policy_version:1};
      }
      const [auditId,action,decision,at,shop,ownerId]=statements[1].args;
      if(row.shop===shop && row.owner_staff_id===ownerId)
        audit.set(auditId,{action,decision,at});
      return [{success:true},{success:true}];
    },
  };
}
const db=memoryD1();
assert.deepEqual(await readWorkMerchantPermission({db,session:owner,action:'team.read'}),
  {allowed:false,code:'authority_unavailable'});
await assert.rejects(()=>bootstrapWorkMerchantOwner({db,session:owner}),
  /owner_bootstrap_disabled/);
await assert.rejects(()=>bootstrapWorkMerchantOwner({
  db,session:admin,allowBootstrap:true,
}),/owner_bootstrap_forbidden/);
assert.equal(db.batchCalls,0);
const first=await bootstrapWorkMerchantOwner({
  db,session:owner,allowBootstrap:true,
});
assert.equal(first.ownerStaffId,'105');
assert.equal(db.authority.owner_staff_id,'105');
assert.equal(db.auditCount,1);
await bootstrapWorkMerchantOwner({db,session:owner,allowBootstrap:true});
assert.equal(db.auditCount,1,'Exact owner bootstrap is idempotent');
await assert.rejects(()=>bootstrapWorkMerchantOwner({
  db,session:staff(999,true),allowBootstrap:true,
}),/owner_already_bound/);
assert.equal(db.authority.owner_staff_id,'105','Untrusted second owner cannot replace binding');
assert.equal(db.auditCount,1);
assert.equal((await readWorkMerchantPermission({db,session:owner,action:'team.read'})).allowed,true);
assert.equal((await readWorkMerchantPermission({
  db,session:admin,action:'requests.read',
})).allowed,false);
db.grants.set('205',grant(205,'administrator'));
assert.equal((await readWorkMerchantPermission({
  db,session:admin,action:'requests.read',
})).allowed,true);
assert.equal((await readWorkMerchantPermission({
  db,session:admin,action:'team.read',
})).code,'forbidden');
db.grants.get('205').active=0;
assert.equal((await readWorkMerchantPermission({
  db,session:admin,action:'requests.read',
})).allowed,false,'Immediate grant revocation is checked on each read');
assert.equal((await readWorkMerchantPermission({
  db,session:{...owner,isOnline:false},action:'requests.read',
})).code,'unauthenticated');

const schema=fs.readFileSync(
  'services/jill-order-desk/migrations/0001_staff_authority.sql','utf8');
for(const expected of [
  'jill_merchant_authority','jill_merchant_grants','jill_merchant_audit',
  'PRIMARY KEY(shop,staff_id)','FOREIGN KEY(shop)',
  "CHECK(environment='WORK')",
])assert.ok(schema.includes(expected),'Missing D1 authority integrity constraint: '+expected);
assert.doesNotMatch(schema,/CREATE TABLE.*(payments|custom_order_events)/i,
  'Do not duplicate Shopify financial or Google production authority in D1');
console.log('JILL WORK merchant online identity, protected owner bootstrap, roles, revocation, cross-shop denial and D1 contract tests passed.');

