// Dedicated Cloudflare D1 Shopify SDK session storage for JILL WORK.
// Not a staff grant, not a customer session, and never accessible by a public
// Worker route. Encrypts full Shopify Session.toPropertyArray(true) with
// AES-256-GCM; the separate 32-byte WORK key must be supplied as a secret.
//
// Session constructor comes from Shopify's officially installed SDK:
//   createWorkD1SessionStorage({db, keyBase64, Session})
// Do not use this module in a service that handles storefront app proxies.

import {JILL_WORK_MERCHANT_SHOP} from '../../../backend/jill-merchant-auth.mjs';

const MAX_PAYLOAD=32*1024;
const idPattern=/^[A-Za-z0-9_:.-]{1,250}$/;
const decoder=new TextDecoder();
const encoder=new TextEncoder();

function assert(condition,code) {if(!condition)throw new Error(code);}

function toBase64(bytes) {
  let value='';
  for(const byte of bytes)value+=String.fromCharCode(byte);
  return btoa(value);
}
function fromBase64(value) {
  assert(typeof value==='string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
    && value.length%4===0,'invalid_session_key_encoding');
  try {
    return Uint8Array.from(atob(value),char=>char.charCodeAt(0));
  } catch {throw new Error('invalid_session_key_encoding');}
}
function exactShop(session) {
  return session?.shop===JILL_WORK_MERCHANT_SHOP &&
    typeof session.id==='string' && idPattern.test(session.id);
}
function validSession(session) {
  assert(exactShop(session),'invalid_work_session');
  assert(typeof session.isOnline==='boolean','invalid_work_session');
  assert(typeof session.toPropertyArray==='function','invalid_work_session');
}

export function createWorkD1SessionStorage({db,keyBase64,Session,cryptoImpl=crypto}={}) {
  assert(db && typeof db.prepare==='function' && typeof db.batch==='function',
    'missing_work_session_database');
  assert(Session && typeof Session.fromPropertyArray==='function',
    'missing_shopify_session_class');
  assert(cryptoImpl?.subtle && typeof cryptoImpl.getRandomValues==='function',
    'missing_webcrypto');
  const raw=fromBase64(keyBase64);
  assert(raw.length===32,'invalid_session_key_length');
  const imported=cryptoImpl.subtle.importKey(
    'raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
  raw.fill(0);

  async function seal(session) {
    validSession(session);
    const properties=session.toPropertyArray(true);
    assert(Array.isArray(properties),'invalid_shopify_session_properties');
    // Shopify's current toPropertyArray(true) omits the verified effective
    // online associated_user_scope when fromPropertyArray reconstructs it.
    // Save that issuer-provided field INSIDE the authenticated ciphertext.
    // Never synthesize it from session.scope (app-level requested scopes).
    const staffScope=session.isOnline
      ? session.onlineAccessInfo?.associated_user_scope : null;
    assert(!session.isOnline || typeof staffScope==='string',
      'missing_verified_staff_scope');
    const encoded=encoder.encode(JSON.stringify({
      version:1,properties,staffScope,
    }));
    assert(encoded.length>0 && encoded.length<=MAX_PAYLOAD,
      'shopify_session_too_large');
    const nonce=cryptoImpl.getRandomValues(new Uint8Array(12));
    const key=await imported;
    // Bind ciphertext cryptographically to the immutable Shopify session ID
    // and WORK shop. Swapped DB rows cannot rehydrate as another session.
    const ad=encoder.encode(JILL_WORK_MERCHANT_SHOP+'\n'+session.id);
    const sealed=await cryptoImpl.subtle.encrypt({
      name:'AES-GCM',iv:nonce,additionalData:ad,tagLength:128,
    },key,encoded);
    return {payload:toBase64(new Uint8Array(sealed)),
      nonce:toBase64(nonce)};
  }

  async function open(row) {
    if(!row || row.shop!==JILL_WORK_MERCHANT_SHOP ||
       !idPattern.test(row.id))return undefined;
    if(row.expires_at_ms!==null && row.expires_at_ms!==undefined &&
       Number(row.expires_at_ms)<=Date.now())return undefined;
    const nonce=fromBase64(row.payload_nonce);
    assert(nonce.length===12,'invalid_stored_nonce');
    const ciphertext=fromBase64(row.payload_ciphertext);
    assert(ciphertext.length<=MAX_PAYLOAD+16,'invalid_stored_session');
    const key=await imported;
    const data=await cryptoImpl.subtle.decrypt({
      name:'AES-GCM',iv:nonce,
      additionalData:encoder.encode(JILL_WORK_MERCHANT_SHOP+'\n'+row.id),
      tagLength:128,
    },key,ciphertext);
    const envelope=JSON.parse(decoder.decode(new Uint8Array(data)));
    assert(envelope?.version===1 && Array.isArray(envelope.properties),
      'unsupported_shopify_session_envelope');
    const session=Session.fromPropertyArray(envelope.properties,true);
    assert(exactShop(session) && session.id===row.id &&
      typeof session.isOnline==='boolean','stored_session_identity_mismatch');
    if(session.isOnline) {
      assert(typeof envelope.staffScope==='string' &&
        session.onlineAccessInfo &&
        typeof session.onlineAccessInfo==='object' &&
        session.onlineAccessInfo.associated_user,
        'missing_verified_staff_scope');
      // Restored only from encrypted, authenticated OAuth session storage.
      session.onlineAccessInfo.associated_user_scope=envelope.staffScope;
    } else {
      assert(envelope.staffScope===null,'offline_session_scope_mismatch');
    }
    return session;
  }

  return Object.freeze({
    async storeSession(session) {
      const {payload,nonce}=await seal(session);
      const expiry=session.expires==null?null:session.expires.getTime();
      assert(expiry===null || Number.isSafeInteger(expiry),
        'invalid_session_expiry');
      const result=await db.prepare(
        'INSERT INTO jill_shopify_sessions '+
        '(id,shop,payload_ciphertext,payload_nonce,expires_at_ms) '+
        'VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET '+
        'payload_ciphertext=excluded.payload_ciphertext,'+
        'payload_nonce=excluded.payload_nonce,'+
        'expires_at_ms=excluded.expires_at_ms,updated_at=CURRENT_TIMESTAMP '
      ).bind(session.id,JILL_WORK_MERCHANT_SHOP,payload,nonce,expiry).run();
      return result?.success===true;
    },
    async loadSession(id) {
      assert(typeof id==='string' && idPattern.test(id),'invalid_session_id');
      const row=await db.prepare(
        'SELECT id,shop,payload_ciphertext,payload_nonce,expires_at_ms '+
        'FROM jill_shopify_sessions WHERE id=? AND shop=?'
      ).bind(id,JILL_WORK_MERCHANT_SHOP).first();
      return row ? open(row) : undefined;
    },
    async deleteSession(id) {
      assert(typeof id==='string' && idPattern.test(id),'invalid_session_id');
      const result=await db.prepare(
        'DELETE FROM jill_shopify_sessions WHERE id=? AND shop=?'
      ).bind(id,JILL_WORK_MERCHANT_SHOP).run();
      return result?.success===true;
    },
    async deleteSessions(ids) {
      assert(Array.isArray(ids) && ids.length<=100 &&
        ids.every(id=>typeof id==='string' && idPattern.test(id)),
        'invalid_session_ids');
      if(ids.length===0)return true;
      const statements=ids.map(id=>db.prepare(
        'DELETE FROM jill_shopify_sessions WHERE id=? AND shop=?'
      ).bind(id,JILL_WORK_MERCHANT_SHOP));
      const results=await db.batch(statements);
      return results?.length===ids.length &&
        results.every(r=>r?.success===true);
    },
    async findSessionsByShop(shop) {
      assert(shop===JILL_WORK_MERCHANT_SHOP,'invalid_work_shop');
      const rows=await db.prepare(
        'SELECT id,shop,payload_ciphertext,payload_nonce,expires_at_ms '+
        'FROM jill_shopify_sessions WHERE shop=? '+
        'AND (expires_at_ms IS NULL OR expires_at_ms > ?) '+
        'ORDER BY id LIMIT 250'
      ).bind(shop,Date.now()).all();
      assert(Array.isArray(rows?.results),'session_db_unavailable');
      // Encrypted corruption is fatal, never silently reinterpret user state.
      return Promise.all(rows.results.map(open));
    },
  });
}
