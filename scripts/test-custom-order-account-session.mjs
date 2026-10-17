import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyWorkCustomerAccountSession} from '../backend/customer-account-work-session.mjs';

const secret='this-is-only-a-work-local-test-secret-and-not-a-real-app-secret';
const seconds=1791800000;
const opts={appSecret:secret,now:()=>seconds*1000};
const claims={
  aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
  dest:'jill-work.myshopify.com',
  sub:'gid://shopify/Customer/1234567',
  iat:seconds-60,nbf:seconds-60,exp:seconds+240,
  jti:'qa-test-unique-session-token',
};
const encoded=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function token(payload=claims,header={alg:'HS256',typ:'JWT'}) {
  const first=encoded(header)+'.'+encoded(payload);
  return first+'.'+createHmac('sha256',secret).update(first).digest('base64url');
}
const good=token();
assert.deepEqual(verifyWorkCustomerAccountSession(good,opts),{
  shop:'jill-work.myshopify.com',
  customerGid:'gid://shopify/Customer/1234567',
});
assert.equal(verifyWorkCustomerAccountSession(
  token({...claims,dest:'https://jill-work.myshopify.com'}),opts).customerGid,
  claims.sub);
const reject=(jwt,label)=>assert.throws(
  ()=>verifyWorkCustomerAccountSession(jwt,opts),
  /Invalid JILL WORK customer session/,label);
const signature=good.split('.')[2];
const wrongLast=signature.at(-1)==='A'?'B':'A';
reject(good.slice(0,-1)+wrongLast,'tampered signature');
const wrongFirst=signature[0]==='A'?'B':'A';
reject(good.slice(0,-signature.length)+wrongFirst+signature.slice(1),
  'forged signature');
reject(token({...claims,aud:'ebf1a69d82f46619d2f2945faab78afa'}),'LIVE app audience');
reject(token({...claims,dest:'jqtdgr-1y.myshopify.com'}),'LIVE shop');
reject(token({...claims,dest:'evil.myshopify.com'}),'wrong shop');
reject(token({...claims,sub:''}),'anonymous');
reject(token({...claims,sub:'gid://shopify/Customer/0'}),'invalid Shopify gid');
reject(token({...claims,sub:'gid://shopify/Customer/123/456'}),'malformed gid');
reject(token({...claims,sub:'customer@example.test'}),'email-as-identity');
reject(token({...claims,iat:seconds-600,nbf:seconds-600,exp:seconds+300}),
  'overlong lifetime');
reject(token({...claims,iat:seconds-400,nbf:seconds-400,exp:seconds-1}),
  'expired');
reject(token({...claims,iat:seconds+100,nbf:seconds+100,exp:seconds+300}),
  'not yet issued');
reject(token({...claims,nbf:seconds+31}),'not yet valid');
reject(token({...claims,exp:seconds-1}),'expired');
reject(token({...claims,jti:''}),'missing jti');
reject(token({...claims,iat:'wrong'}),'non-number date');
reject(token({...claims,nbf:seconds+100,iat:seconds-60}),
  'bad nbf/iat relationship');
reject(token(claims,{alg:'none',typ:'JWT'}),'unsigned');
reject(token(claims,{alg:'HS512',typ:'JWT'}),'wrong alg');
reject(token(claims,{alg:'HS256',crit:['x']}),'critical headers');
reject(token(claims,{alg:'HS256',b64:false}),'unsupported b64 header');
reject('a.b.c','invalid jwt shape');
reject(token(claims).split('.').slice(0,2).join('.'),'missing signature');
assert.throws(()=>verifyWorkCustomerAccountSession(good,{
  ...opts,appSecret:'incorrect-long-secret-for-negative-work-test-cases',
}),/Invalid JILL WORK customer session/);
const otherShop=token({...claims,dest:'https://jillonlinestore.com'});
reject(otherShop,'public production URL instead of WORK shop');
console.log('WORK customer account JWT verifier negative privacy and audience tests passed.');
