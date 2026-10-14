import {createRequestHandler} from "react-router";
import {workAppHomeOrigin} from "../../shopify-host/sdk-config.mjs";

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
    if(request.method==="GET" && url.pathname==="/healthz") {
      const ready=await schemaReady(env.JILL_ORDER_DESK_WORK_DB);
      return Response.json({
        ok:ready,environment:"JILL_ORDER_DESK_WORK",
        database_ready:ready,admin_ready:false,
      },{status:ready?200:503,headers});
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
