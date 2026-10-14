// JILL WORK merchant identity extraction.
// This module consumes ONLY a session returned by Shopify's trusted
// authenticate.admin(request) with useOnlineTokens: true.
// Never pass browser JSON, decoded-but-unverified JWTs or an offline session.
export const JILL_WORK_MERCHANT_SHOP='jill-work.myshopify.com';
export const JILL_WORK_MERCHANT_CLIENT_ID='f8e1ebdbae84490dc8ea5b133637e6c0';

const ID=/^[1-9][0-9]{0,19}$/;
const SCOPE=/^(?:read|write|customer_read|customer_write|unauthenticated_read|unauthenticated_write)_[a-z0-9_]{2,96}$/;

function fail() { throw new Error('unverified_shopify_staff'); }

export function requireWorkMerchantIdentity(session,{
  expectedShop=JILL_WORK_MERCHANT_SHOP,
  expectedClientId=JILL_WORK_MERCHANT_CLIENT_ID,
  now=Date.now,
}={}) {
  // These checks fail closed if a LIVE environment or an unsafe app
  // configuration is ever accidentally passed to the WORK adapter.
  if(expectedShop!==JILL_WORK_MERCHANT_SHOP ||
     expectedClientId!==JILL_WORK_MERCHANT_CLIENT_ID ||
     typeof now!=='function' ||
     !session || typeof session!=='object' ||
     session.shop!==expectedShop || session.isOnline!==true) fail();
  const info=session.onlineAccessInfo;
  const staff=info?.associated_user;
  const id=staff?.id;
  if((typeof id!=='number' || !Number.isSafeInteger(id) || id<=0) &&
     (typeof id!=='string' || !ID.test(id)))fail();
  const staffId=String(id);
  if(!ID.test(staffId) || staff.account_owner!==true && staff.account_owner!==false)
    fail();
  if(typeof info.associated_user_scope!=='string')fail();

  // App scopes alone MUST NOT grant staff privileges. Only the
  // Shopify-online user intersection is used below.
  const raw=info.associated_user_scope;
  const scopes=raw==='' ? [] : raw.split(',').map(x=>x.trim());
  if(scopes.some(x=>!SCOPE.test(x)) || new Set(scopes).size!==scopes.length)fail();
  if(session.expires!==undefined && session.expires!==null) {
    const end=session.expires instanceof Date
      ? session.expires.getTime() : NaN;
    if(!Number.isFinite(end) || end<=now())fail();
  }
  return Object.freeze({
    shop:expectedShop,
    staffId,
    shopifyAccountOwner:staff.account_owner===true,
    scopes:Object.freeze(scopes),
  });
}
