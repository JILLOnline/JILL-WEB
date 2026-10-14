// Factory for the OFFICIAL Shopify React Router SDK hosted App Home.
// The host must supply Shopify's shopifyApp(), ApiVersion, distribution,
// durable Shopify SessionStorage, and secure environment bindings.
// This code must never be used to authenticate raw client-provided session
// objects; trust only the SDK's authenticate.admin(request) output.
import {
  JILL_WORK_MERCHANT_CLIENT_ID,
  JILL_WORK_MERCHANT_SHOP,
} from '../../../backend/jill-merchant-auth.mjs';

export const JILL_WORK_APP_HOME_ORIGIN =
  'https://jill-order-desk-work.jill-work-custom-orders.workers.dev';

// Planned hostname, not a deployed endpoint until Wrangler confirms it.
export const JILL_WORK_CANARY_APP_HOME_ORIGIN =
  'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';

export function workAppHomeOrigin(stage) {
  if(stage==='work')return JILL_WORK_APP_HOME_ORIGIN;
  if(stage==='canary')return JILL_WORK_CANARY_APP_HOME_ORIGIN;
  throw new Error('invalid_work_host_stage');
}

export function createWorkShopifyHost({
  shopifyApp,apiVersion,distribution,sessionStorage,
  apiSecretKey,appUrl,shop=JILL_WORK_MERCHANT_SHOP,stage='work',
}={}) {
  if(shop!==JILL_WORK_MERCHANT_SHOP ||
     appUrl!==workAppHomeOrigin(stage) ||
     typeof shopifyApp!=='function' ||
     typeof apiVersion!=='string' || !apiVersion ||
     typeof distribution!=='string' || !distribution ||
     typeof apiSecretKey!=='string' || apiSecretKey.length<20 ||
     !sessionStorage ||
     typeof sessionStorage.storeSession!=='function' ||
     typeof sessionStorage.loadSession!=='function' ||
     typeof sessionStorage.deleteSession!=='function') {
    throw new Error('work_host_configuration_incomplete');
  }
  // No new scopes or Shopify app identity; scope approval is a separate gate.
  // The real host must store online AND expiring offline Shopify sessions
  // through a durable, encrypted session storage adapter.
  const client=shopifyApp({
    apiKey:JILL_WORK_MERCHANT_CLIENT_ID,
    apiSecretKey,
    apiVersion,
    appUrl,
    distribution,
    authPathPrefix:'/auth',
    useOnlineTokens:true,
    sessionStorage,
    future:{expiringOfflineAccessTokens:true},
  });
  if(typeof client?.authenticate?.admin!=='function') {
    throw new Error('shopify_sdk_authenticate_admin_missing');
  }
  return client;
}
