import {createHmac,timingSafeEqual} from 'node:crypto';

// Shopify's app-proxy signature authenticates the forwarding SHOP, not a
// logged-in customer. No account ownership can be conferred by this helper.
// https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
const signaturePattern=/^[a-f0-9]{64}$/i;
const shopPattern=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function verifyShopifyAppProxyRequest(request,{
  appSecret,expectedShop,expectedPathPrefix='/apps/jill-custom-order',
  now=Date.now,maxAgeSeconds=300,
}={}) {
  if(!(request instanceof Request) ||
      typeof appSecret!=='string' || appSecret.length<32 ||
      !shopPattern.test(expectedShop||'') ||
      typeof now!=='function' || maxAgeSeconds<1 ||
      maxAgeSeconds>300 || expectedPathPrefix!=='/apps/jill-custom-order') {
    throw new Error('Missing secure WORK Shopify app-proxy configuration.');
  }
  const url=new URL(request.url);
  if(url.search.length>8192)throw new Error('Oversized Shopify app-proxy signature.');
  const parts=new Map();
  for(const [name,value] of url.searchParams) {
    if(!parts.has(name))parts.set(name,[]);
    parts.get(name).push(value);
  }
  for(const required of ['shop','timestamp','signature','path_prefix']) {
    if(parts.get(required)?.length!==1)throw new Error('Missing or repeated signed Shopify field.');
  }
  const shop=parts.get('shop')[0];
  const stamp=parts.get('timestamp')[0];
  const signature=parts.get('signature')[0];
  const prefix=parts.get('path_prefix')[0];
  if(shop!==expectedShop || prefix!==expectedPathPrefix ||
      !/^\d{10}$/.test(stamp) ||
      Math.abs(now()/1000-Number(stamp))>maxAgeSeconds ||
      !signaturePattern.test(signature)) {
    throw new Error('Invalid WORK Shopify app-proxy identity or timestamp.');
  }
  parts.delete('signature');
  // Shopify sorts unencoded key=value groups, joins repeated values with
  // commas, then concatenates groups without "&". Do not use a webhook
  // HMAC canonicalization algorithm here: it is a DIFFERENT contract.
  const canonical=[...parts].map(([key,values])=>key+'='+values.join(','))
    .sort().join('');
  const expected=Buffer.from(createHmac('sha256',appSecret)
    .update(canonical,'utf8').digest('hex'),'hex');
  const submitted=Buffer.from(signature,'hex');
  if(submitted.length!==expected.length ||
      !timingSafeEqual(submitted,expected)) {
    throw new Error('Invalid Shopify app-proxy HMAC.');
  }
  return {
    shop,
    // A signed ID is informational only; a different authenticated
    // Customer Account token/verified claim is required for account reads.
    loggedInCustomerId:parts.get('logged_in_customer_id')?.[0]||null,
  };
}
