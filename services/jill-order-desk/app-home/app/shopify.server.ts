import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,AppDistribution,shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import {Session} from "@shopify/shopify-api";
import {createConfiguredWorkShopifyHost} from "../../shopify-host/work-shopify-runtime.mjs";

// Env bindings are injected by Cloudflare. Do not access process.env or
// local secret files. Shopify handles OAuth and signed Admin session tokens.
export function workShopify(env:Env) {
  return createConfiguredWorkShopifyHost({
    shopifyApp,Session,env,
    apiVersion:ApiVersion.July26,
    distribution:AppDistribution.SingleMerchant,
  });
}
