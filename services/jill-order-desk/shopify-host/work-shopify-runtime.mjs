// WORK Shopify SDK runtime composition. Server-only. This is NOT a login
// endpoint; Shopify's official package must supply shopifyApp and its Session
// constructor. Do not import into the storefront or Customer Account extension.
//
// A separate dedicated D1 table holds AES-GCM-encrypted SDK access tokens.
// The staff grant D1 tables control user permissions independently.
import {createWorkD1SessionStorage} from './d1-session-storage.mjs';
import {
  createWorkShopifyHost,workAppHomeOrigin,
} from './sdk-config.mjs';

export function createConfiguredWorkShopifyHost({
  shopifyApp,Session,env,apiVersion,distribution,
}={}) {
  if(!env || typeof env!=='object' ||
     !env.JILL_ORDER_DESK_WORK_DB ||
     typeof env.SHOPIFY_API_SECRET!=='string' ||
     typeof env.JILL_WORK_SESSION_KEY_B64!=='string') {
    throw new Error('work_shopify_host_secrets_or_d1_missing');
  }
  // Only Cloudflare stage bindings determine the authorized WORK hostname.
  const stage=env.JILL_WORK_HOST_STAGE;
  const appUrl=workAppHomeOrigin(stage);
  const sessionStorage=createWorkD1SessionStorage({
    db:env.JILL_ORDER_DESK_WORK_DB,
    keyBase64:env.JILL_WORK_SESSION_KEY_B64,
    Session,
  });
  return createWorkShopifyHost({
    shopifyApp,apiVersion,distribution,
    sessionStorage,apiSecretKey:env.SHOPIFY_API_SECRET,
    appUrl,stage,
  });
}
