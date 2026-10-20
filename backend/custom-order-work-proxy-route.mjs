import {verifyShopifyAppProxyRequest} from './shopify-work-app-proxy-auth.mjs';
import {handleCustomOrderProxy} from './custom-order-gateway.mjs';

// Framework-neutral WORK-only route action. A hosting adapter must supply:
// 1) its Request (including Shopify's signed query), 2) HTTPS transport,
// 3) a distributed durable rate limiter keyed by verified shop/client IP,
// 4) the TWO distinct private secrets (Shopify app vs Google QA HMAC).
// A hosting adapter must also ensure a trusted forwarding proxy; never
// accept an arbitrary user-supplied client IP as a rate-limit identity.
export function createCustomOrderWorkProxyRoute({
  shopifyAppSecret,googleGatewaySecret,googleQaEndpoint,rateLimit,
  backendFetch,now=Date.now,
  expectedShop='jill-work.myshopify.com',
  allowedOrigins=['https://jill-work.myshopify.com'],
}={}) {
  if(typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32 ||
      typeof googleGatewaySecret!=='string'||googleGatewaySecret.length<32 ||
      googleGatewaySecret===shopifyAppSecret ||
      typeof rateLimit!=='function' ||
      expectedShop!=='jill-work.myshopify.com') {
    throw new Error('Refusing an incomplete or non-WORK Custom Order proxy.');
  }
  return async function customOrderWorkProxyAction(request) {
    return handleCustomOrderProxy({
      request,expectedShop,allowedOrigins,
      appsScriptEndpoint:googleQaEndpoint,receiptSecret:googleGatewaySecret,
      rateLimit,
      backendFetch,now,
      authenticateProxy:async(req)=>verifyShopifyAppProxyRequest(req,{
        appSecret:shopifyAppSecret,expectedShop,now,
      }),
    });
  };
}
