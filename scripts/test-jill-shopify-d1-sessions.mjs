import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createWorkD1SessionStorage} from
  '../services/jill-order-desk/shopify-host/d1-session-storage.mjs';

const SHOP='jill-work.myshopify.com';
const KEY=Buffer.alloc(32,37).toString('base64'); // synthetic only
const sessions=new Map();
const ops=[];
function db() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              ops.push(sql);
              if(sql.startsWith('INSERT INTO jill_shopify_sessions')) {
                const [id,shop,payload_ciphertext,payload_nonce,expires_at_ms]=args;
                sessions.set(id,{id,shop,payload_ciphertext,payload_nonce,expires_at_ms});
              } else if(sql.startsWith('DELETE FROM jill_shopify_sessions')) {
                sessions.delete(args[0]);
              } else throw Error('Unexpected write SQL');
              return {success:true};
            },
            async first() {
              ops.push(sql);
              if(!sql.includes('WHERE id=? AND shop=?'))throw Error('No shop isolation');
              return sessions.get(args[0])?.shop===args[1] ? sessions.get(args[0]) : null;
            },
            async all() {
              ops.push(sql);
              if(!sql.includes('WHERE shop=?'))throw Error('No shop scoping');
              return {results:[...sessions.values()].filter(row=>
                row.shop===args[0] &&
                (row.expires_at_ms==null || row.expires_at_ms>args[1]))};
            },
            sql,args,
          };
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map(stmt=>stmt.run()));
    },
  };
}

class ShopifySession {
  constructor(data) {
    Object.assign(this,data);
    if(data.expires!=null)this.expires=new Date(data.expires);
  }
  toPropertyArray(includeUser) {
    assert.equal(includeUser,true,'Must persist verified Shopify owner and scopes');
    return Object.entries({
      id:this.id,shop:this.shop,
      isOnline:this.isOnline,state:this.state,scope:this.scope,
      accessToken:this.accessToken,
      expires:this.expires?.getTime() ?? null,
      onlineAccessInfo:this.onlineAccessInfo,
    });
  }
  static fromPropertyArray(pairs,includeUser) {
    assert.equal(includeUser,true);
    return new ShopifySession(Object.fromEntries(pairs));
  }
}
const item=id=>new ShopifySession({
  id,shop:SHOP,isOnline:true,state:'authenticated',
  scope:'read_orders,write_orders',
  accessToken:'SYNTHETIC_SHOULD_NEVER_APPEAR_IN_SQL',
  expires:Date.now()+3600000,
  onlineAccessInfo:{
    associated_user:{id:100,account_owner:true},
    associated_user_scope:'read_orders,write_orders',
  },
});
const storage=createWorkD1SessionStorage({
  db:db(),keyBase64:KEY,Session:ShopifySession,cryptoImpl:webcrypto,
});
assert.equal(await storage.storeSession(item('online_jill-work_100')),true);
assert.equal(sessions.size,1);
const sealed=sessions.get('online_jill-work_100');
assert.ok(sealed.payload_ciphertext);
assert.ok(sealed.payload_nonce);
assert.doesNotMatch(JSON.stringify(sealed),
  /SYNTHETIC_SHOULD_NEVER_APPEAR|associated_user|account_owner|read_orders/);
const loaded=await storage.loadSession('online_jill-work_100');
assert.equal(loaded.accessToken,'SYNTHETIC_SHOULD_NEVER_APPEAR_IN_SQL');
assert.equal(loaded.onlineAccessInfo.associated_user.account_owner,true);
assert.deepEqual((await storage.findSessionsByShop(SHOP)).map(x=>x.id),
  ['online_jill-work_100']);
assert.equal(await storage.storeSession(item('online_jill-work_101')),true);
assert.equal((await storage.findSessionsByShop(SHOP)).length,2);
const [one,two]=[sessions.get('online_jill-work_100'),
  sessions.get('online_jill-work_101')];
sessions.set(one.id,{...one,payload_ciphertext:two.payload_ciphertext,
  payload_nonce:two.payload_nonce});
await assert.rejects(()=>storage.loadSession(one.id));
sessions.set(one.id,one);
sessions.set(one.id,{...one,expires_at_ms:Date.now()-1});
assert.equal(await storage.loadSession(one.id),undefined);
sessions.set(one.id,one);
assert.equal(await storage.deleteSession('online_jill-work_100'),true);
assert.equal(await storage.loadSession('online_jill-work_100'),undefined);
assert.equal(await storage.deleteSessions(['online_jill-work_101']),true);
assert.equal(sessions.size,0);
assert.equal(await storage.deleteSessions([]),true);

await assert.rejects(()=>storage.storeSession(new ShopifySession({
  ...item('any'),shop:'jqtdgr-1y.myshopify.com',
})),/invalid_work_session/);
await assert.rejects(()=>storage.loadSession('invalid id'),/invalid_session_id/);
await assert.rejects(()=>storage.findSessionsByShop('jqtdgr-1y.myshopify.com'),
  /invalid_work_shop/);
assert.throws(()=>createWorkD1SessionStorage({
  db:db(),keyBase64:'abcd',Session:ShopifySession,
  cryptoImpl:webcrypto,
}),/invalid_session_key_length|invalid_session_key_encoding/);
assert.ok(ops.every(sql=>!sql.includes('accessToken')));
const schema=readFileSync(
  'services/jill-order-desk/migrations/0002_shopify_sessions.sql','utf8');
assert.match(schema,/payload_ciphertext TEXT NOT NULL/);
assert.match(schema,/payload_nonce TEXT NOT NULL/);
assert.match(schema,/jill_shopify_sessions/);
assert.doesNotMatch(schema,/access_token\s+TEXT|CREATE TABLE .*payments/i);
console.log('Encrypted Shopify WORK D1 sessions: full owner data round trip, AES-GCM isolation, expiration, deletion and foreign-shop rejection passed.');
