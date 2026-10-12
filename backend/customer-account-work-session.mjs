import {createHmac,timingSafeEqual} from 'node:crypto';

// Verify Shopify Customer Account UI extension session identity.
// WORK ONLY. This module does not authorize a Custom Order on its own:
// a separate immutable submission-ownership index is still required.
// Source: https://shopify.dev/docs/api/customer-account-ui-extensions/2025-10/target-apis/platform-apis/session-token-api
const CUSTOMER_ID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const ENCODED=/^[A-Za-z0-9_-]+$/;
const CLIENT_ID='f8e1ebdbae84490dc8ea5b133637e6c0';
const SHOP='jill-work.myshopify.com';

function invalid() {
  throw new Error('Invalid JILL WORK customer session.');
}
function decodeJson(encoded) {
  if(typeof encoded!=='string'||encoded.length>4096||!ENCODED.test(encoded))
    invalid();
  try {
    const raw=Buffer.from(encoded,'base64url');
    // Refuse alternate noncanonical base64 encodings.
    if(raw.toString('base64url')!==encoded)invalid();
    const obj=JSON.parse(raw.toString('utf8'));
    if(!obj||typeof obj!=='object'||Array.isArray(obj))invalid();
    return obj;
  } catch {
    invalid();
  }
}
function numericDate(value) {
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
}

/**
 * Strict WORK account token proof; never extract the customer ID from a
 * request body, email, app proxy customer field or an unverified JWT.
 * @param {string} jwt
 * @param {{appSecret:string,now?:()=>number}} options
 * @returns {{shop:string, customerGid:string}}
 */
export function verifyWorkCustomerAccountSession(jwt,{
  appSecret,now=Date.now,
}={}) {
  if(typeof jwt!=='string'||jwt.length>8192||typeof appSecret!=='string'||
     appSecret.length<32||typeof now!=='function')invalid();
  const segments=jwt.split('.');
  if(segments.length!==3||segments.some(x=>!ENCODED.test(x)))invalid();
  const [h,p,s]=segments;
  if(h.length>1024||p.length>4096||s.length!==43)invalid();
  const header=decodeJson(h);
  if(header.alg!=='HS256'||(header.typ!==undefined&&header.typ!=='JWT')||
     header.crit!==undefined||header.b64===false)invalid();
  const expected=createHmac('sha256',appSecret)
    .update(h+'.'+p,'utf8').digest();
  const signature=Buffer.from(s,'base64url');
  if(signature.length!==expected.length||!timingSafeEqual(expected,signature))
    invalid();
  const claims=decodeJson(p);
  const current=Math.floor(now()/1000);
  if(!Number.isSafeInteger(current)||current<=0)invalid();
  if(claims.aud!==CLIENT_ID||
     ![SHOP,'https://'+SHOP].includes(claims.dest)||
     !CUSTOMER_ID.test(claims.sub||'')||
     !numericDate(claims.exp)||!numericDate(claims.nbf)||
     !numericDate(claims.iat)||typeof claims.jti!=='string'||
     claims.jti.length<8||claims.jti.length>256||
     claims.exp-claims.iat>360||claims.exp<=claims.iat||
     claims.nbf>claims.iat+30||
     claims.iat>current+30||claims.nbf>current+30||
     claims.exp<=current)invalid();
  return Object.freeze({shop:SHOP,customerGid:claims.sub});
}
