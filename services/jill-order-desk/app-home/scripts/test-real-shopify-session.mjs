// Run inside services/jill-order-desk/app-home after npm install:
// node scripts/test-real-shopify-session.mjs
// Uses REAL Shopify SDK Session class and fake tokens only. No Shopify API calls.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {Session} from '@shopify/shopify-api';
import {createWorkD1SessionStorage} from '../../shopify-host/d1-session-storage.mjs';
import {requireWorkMerchantIdentity} from '../../../../backend/jill-merchant-auth.mjs';

const shop='jill-work.myshopify.com';
const fakeToken='SYNTHETIC_ONLY_NOT_A_REAL_ACCESS_TOKEN';
const key=Buffer.alloc(32,47).toString('base64');
const records=new Map();
const sqlCalls=[];

const db={
  prepare(sql) {
    sqlCalls.push(sql);
    return {
      bind(...params) {
        return {
          async run() {
            if(sql.startsWith('INSERT INTO jill_shopify_sessions')) {
              const [id,shop,payload_ciphertext,payload_nonce,expires_at_ms]=params;
              records.set(id,{id,shop,payload_ciphertext,payload_nonce,expires_at_ms});
            } else if(sql.startsWith('DELETE FROM jill_shopify_sessions')) {
              records.delete(params[0]);
            } else {
              throw Error('Unexpected SQL write');
            }
            return {success:true};
          },
          async first() {
            const row=records.get(params[0]);
            return row?.shop===params[1]?row:null;
          },
          async all() {
            return {results:[...records.values()].filter(row=>
              row.shop===params[0] &&
              (row.expires_at_ms==null||row.expires_at_ms>params[1]))};
          },
        };
      },
    };
  },
  async batch(statements) {
    return Promise.all(statements.map(stmt=>stmt.run()));
  },
};

const s=new Session({
  id:'online_jill-work_real-sdk_12345',
  shop,
  state:'verified-test-state',
  isOnline:true,
  accessToken:fakeToken,
  scope:'read_orders,write_orders',
  expires:new Date(Date.now()+600000),
  onlineAccessInfo:{
    associated_user_scope:'read_orders,write_orders',
    expires_in:3600,
    associated_user:{
      id:987654321,
      account_owner:true,
      collaborator:false,
      email:'not-real@example.invalid',
      email_verified:true,
      first_name:'Synthetic',
      last_name:'Owner',
      locale:'en',
    },
  },
});
assert.ok(s instanceof Session);
const store=createWorkD1SessionStorage({
  db,keyBase64:key,Session,cryptoImpl:webcrypto,
});
assert.equal(await store.storeSession(s),true);
assert.equal(records.size,1);
const raw=JSON.stringify([...records.values()]);
assert.ok(!raw.includes(fakeToken),'Access token written without encryption');
assert.ok(!raw.includes('not-real@example.invalid'),'Staff email stored in plaintext');
const loaded=await store.loadSession(s.id);
assert.ok(loaded instanceof Session,'Must restore actual Shopify Session class');
assert.equal(loaded.accessToken,fakeToken);
assert.equal(loaded.isOnline,true);
assert.equal(loaded.shop,shop);
assert.equal(loaded.id,s.id);
const verified=requireWorkMerchantIdentity(loaded);
assert.equal(verified.staffId,'987654321');
assert.equal(verified.shopifyAccountOwner,true);
assert.deepEqual(verified.scopes,['read_orders','write_orders']);
// Real Shopify SDK serialization must preserve effective staff permissions,
// not replace them with session.scope (the app-level grant).
assert.equal(loaded.onlineAccessInfo.associated_user_scope,
  'read_orders,write_orders');
const missingScope=new Session({
  ...s.toObject(),
  id:'online_jill-work_missing_staff_scope',
  onlineAccessInfo:{
    ...s.onlineAccessInfo,
    associated_user_scope:undefined,
  },
});
await assert.rejects(()=>store.storeSession(missingScope),
  /missing_verified_staff_scope/);
assert.equal((await store.findSessionsByShop(shop)).length,1);
assert.equal(await store.deleteSession(s.id),true);
assert.equal(await store.loadSession(s.id),undefined);
const offline=new Session({
  id:'offline_jill-work',
  shop,
  state:'offline-synthetic',
  isOnline:false,
  accessToken:fakeToken,
  scope:'read_orders',
});
assert.equal(await store.storeSession(offline),true);
const recoveredOffline=await store.loadSession(offline.id);
assert.ok(recoveredOffline instanceof Session);
assert.equal(recoveredOffline.isOnline,false);
assert.equal(recoveredOffline.onlineAccessInfo,undefined);
assert.equal(await store.deleteSession(offline.id),true);
assert.ok(sqlCalls.every(sql=>!sql.includes(fakeToken)));
console.log('PASS actual Shopify Session SDK AES-GCM D1 serialization and verified WORK staff identity round trip; zero real tokens or API calls.');
