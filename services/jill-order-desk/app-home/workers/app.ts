import {createRequestHandler} from "react-router";
import {WorkerEntrypoint} from "cloudflare:workers";
import {handleWorkContactPrivateBridge}
  from "../../work-contact-private-bridge.mjs";

import {workAppHomeOrigin,workAdminAppDestination} from "../../shopify-host/sdk-config.mjs";
import {workQuoteDraftFeatureReady,workQuoteDraftSchemaReady}
  from "../../work-quote-release-readiness.mjs";
import {workQuoteCatalogReviewReady}
  from "../../work-quote-catalog-review.mjs";

declare module "react-router" {
  interface AppLoadContext {
    cloudflare:{env:Env;ctx:ExecutionContext};
  }
}

const handler=createRequestHandler(
  ()=>import("virtual:react-router/server-build"),
  import.meta.env.MODE
);
const headers={
  "Cache-Control":"private, no-store, max-age=0",
  "X-Content-Type-Options":"nosniff",
};
const tables=["jill_merchant_audit","jill_merchant_authority",
  "jill_merchant_grants","jill_shopify_sessions"];

async function schemaReady(db:Env["JILL_ORDER_DESK_WORK_DB"]|undefined) {
  if(!db || typeof db.prepare!=="function")return false;
  try {
    const rows=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND "+
      "name IN ('jill_merchant_audit','jill_merchant_authority',"+
      "'jill_merchant_grants','jill_shopify_sessions') ORDER BY name"
    ).all();
    return Array.isArray(rows.results) && rows.results.length===4 &&
      rows.results.every((r,i)=>r.name===tables[i]);
  } catch {return false;}
}

function unavailable(code:string,status=503) {
  return Response.json({ok:false,error:code},{status,headers});
}

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext) {
    // The Worker may ONLY serve its exact stage-pinned Cloudflare hostname.
    // Neither spoofed Host headers nor LIVE app URLs may change OAuth origin.
    let expected:string;
    try {expected=workAppHomeOrigin(env.JILL_WORK_HOST_STAGE);}
    catch {return unavailable("work_host_unavailable");}
    const url=new URL(request.url);
    if(url.origin!==expected)return unavailable("wrong_host",421);
    // A new browser tab has no Shopify iframe parent. Re-enter the existing
    // WORK Admin app before SDK bootstrap; do not redirect data requests,
    // iframe reloads, authenticated requests or any command POST.
    if(request.method==="GET" && /^\/app(?:\/|$)/.test(url.pathname) &&
       !url.pathname.endsWith(".data") && !request.headers.has("authorization") &&
       request.headers.get("sec-fetch-dest")==="document"){
      return new Response(null,{status:302,headers:{...headers,
        Location:workAdminAppDestination(url.pathname),
      }});
    }
    // Anonymous/foreign-origin command posts must fail before Shopify's
    // embedded auth redirect machinery, D1 or any request body processing.
    // A matching Origin is ONLY a browser CSRF precondition, never merchant
    // authorization: the downstream action still verifies Shopify Owner,
    // the WORK D1 grant, write flag, and the Google QA HMAC signature.
    // Match the whole Contact detail subtree: React Router percent-encodes
    // ticket colons, so a literal-ID regexp would miss valid write paths.
    if(request.method==="POST" &&
       (url.pathname==="/app/requests/command" ||
        url.pathname==="/app/requests/media/inspect" ||
        url.pathname==="/app/requests/quote-draft" ||
        url.pathname.startsWith("/app/contacts/")) &&
       request.headers.get("origin")!==expected)
      return unavailable("invalid_origin",403);
    // The current v34 Worker continues to deny quote routes. This
    // SOURCE-ONLY candidate requires an entirely NEW, absent-by-default
    // WORK-only explicit switch AND the two owner-migrated D1 tables.
    // No release command or manifest flag is changed in this PR.
    // M2 read-only catalog price checks are opt-in. Refuse disabled routes
    // BEFORE generic database schema, Shopify OAuth, or request source work.
    // No quote publishing, product mutation, or customer contact is enabled.
    if(url.pathname==="/app/requests/quote-catalog" &&
       !workQuoteCatalogReviewReady(env))
      return unavailable("quote_catalog_not_enabled");
    if(url.pathname==="/app/requests/quote-draft"){
      if(!workQuoteDraftFeatureReady(env))
        return unavailable("quote_drafts_not_enabled");
      if(!await workQuoteDraftSchemaReady(env.JILL_ORDER_DESK_WORK_DB))
        return unavailable("quote_storage_unavailable");
    }
    // Media inspect is OFF before D1 access or Shopify OAuth by default.
    // Enabling this INSPECT flag never enables real uploads or delivery.
    if(url.pathname==="/app/requests/media/inspect"){
      const mediaEnv=env as Env & {
        JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED?:string;
        JILL_WORK_HQ_DETAIL_ENABLED?:string;
      };
      if(env.JILL_WORK_HOST_STAGE!=="canary" ||
         mediaEnv.JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED!=="true" ||
         mediaEnv.JILL_WORK_HQ_DETAIL_ENABLED!=="true" ||
         typeof env.JILL_HQ_MERCHANT_READ_SECRET!=="string" ||
         env.JILL_HQ_MERCHANT_READ_SECRET.length<32)
        return unavailable("private_media_not_enabled");
    }
    if(request.method==="GET" && url.pathname==="/healthz") {
      const ready=await schemaReady(env.JILL_ORDER_DESK_WORK_DB);
      return Response.json({
        ok:ready,environment:"JILL_ORDER_DESK_WORK",
        database_ready:ready,admin_ready:false,
      },{status:ready?200:503,headers:{...headers,
        ...(env.CF_VERSION_METADATA?.id&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(env.CF_VERSION_METADATA.id)
          ? {"X-JILL-WORK-HQ-Version":env.CF_VERSION_METADATA.id}:{}),
      }});
    }
    if(!await schemaReady(env.JILL_ORDER_DESK_WORK_DB))
      return unavailable("merchant_storage_unavailable");
    // Before the two WORK-only secrets are provisioned, no Shopify auth
    // routes, HTML, owner setup or SDK processing may run.
    // A separate, opt-in canary switch is required even AFTER both secrets
    // exist. Cloudflare secret rotation must never auto-open Shopify login.
    if(env.JILL_WORK_OAUTH_ENABLED!=="true" ||
       !env.SHOPIFY_API_SECRET || !env.JILL_WORK_SESSION_KEY_B64)
      return unavailable("shopify_auth_not_configured");
    return handler(request,{cloudflare:{env,ctx}});
  },
} satisfies ExportedHandler<Env>;

/** A named, private Service Binding RPC endpoint — never an HTTP URL.
 *  The default fetch handler above remains unchanged.
 *  A separate HQ hard-OFF flag is required even with this binding. */
export class JillContactPrivate extends WorkerEntrypoint {
  async fetch(request:Request):Promise<Response>{
    return handleWorkContactPrivateBridge({
      request,env:this.env as Env,
    });
  }
}
