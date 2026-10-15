// The ONLY WORK inbox source loader. Never register this as an index route.
// Every request must pass Shopify online Owner auth, WORK D1 and signed
// canonical QA read. UI modules import only their nine-field projection.
import {workMerchantWritesReady} from "../../../work-merchant-write-readiness.mjs";
import {type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce} from "../../../work-admin-auth-once.mjs";
import {loadWorkMerchantInbox} from "../../../merchant-inbox-read.mjs";
import {readWorkGoogleQaMerchantList} from "../../../work-google-merchant-read.mjs";
import {readWorkMerchantSourceCached} from "../../../work-merchant-source-cache.mjs";
import {readWorkD1IndexedMerchantList} from "../../../work-merchant-d1-index.mjs";

export async function loadVerifiedMerchantInbox({request,context}:LoaderFunctionArgs) {
  const env=context.cloudflare.env;
  const started=performance.now();
  // A random trace ID groups ONLY numeric phase durations. Never log
  // session tokens, shop/customer identity, URLs or request bodies.
  const trace=crypto.randomUUID();
  const report=(phase:string,event:"begin"|"end",ms?:number)=>{
    console.info("JILL_WORK_INBOX_PHASE",JSON.stringify({
      trace,phase,event,...(ms===undefined?{}:{duration_ms:Math.round(ms)}),
    }));
  };
  let sourceMs=0;
  let cacheMode="not-requested";
  const timings:Record<string,number>={};
  report("inbox","begin");
  let result:Awaited<ReturnType<typeof loadWorkMerchantInbox>>;
  try {
  result=await loadWorkMerchantInbox({
    onPhaseStart:(name:string)=>report(name,"begin"),
    onTiming:(name:string,ms:number)=>{
      if(["shopify_auth","work_owner","google_feed"].includes(name) &&
         Number.isFinite(ms)){
        timings[name]=Math.max(0,ms);
        report(name,"end",ms);
      }
    },
    request,
    authenticate:{admin:()=>authenticateWorkAdminOnce({
      scope:context.cloudflare,
      authenticate:()=>workShopify(env).authenticate.admin(request),
    })},
    db:env.JILL_ORDER_DESK_WORK_DB,
    // Keep the authenticated owner-only, WHITELISTED Google read boundary.
    // No Shopify session or customer identity is forwarded to the source.
    readCanonicalSource:env.JILL_WORK_HOST_STAGE==="canary" &&
      env.JILL_HQ_MERCHANT_READ_SECRET
      ? async () => {
          const began=performance.now();
          try {
            const readGoogle=()=>readWorkMerchantSourceCached({
              secret:env.JILL_HQ_MERCHANT_READ_SECRET!,
              reader:readWorkGoogleQaMerchantList,
              onCache:(mode:string)=>{cacheMode=mode;},
            });
            // This flag is intentionally NOT in the active Worker manifest.
            // Only after WORK D1 migration 0003 + explicit release may the
            // distributed index be activated. Auth happened upstream.
            const fast=(env as typeof env & {
              JILL_WORK_HQ_FAST_INBOX_ENABLED?:string
            }).JILL_WORK_HQ_FAST_INBOX_ENABLED==="true";
            if(!fast)return await readGoogle();
            const refreshed=new URL(request.url).searchParams.get("refresh")==="1";
            return await readWorkD1IndexedMerchantList({
              db:env.JILL_ORDER_DESK_WORK_DB,
              readCanonicalSource:readGoogle,
              forceFresh:refreshed,
              onCache:(mode:string)=>{
                if(mode==="d1-hit")cacheMode=mode;
              },
            });
          } finally {sourceMs=performance.now()-began;}
        }
      : undefined,
  });
  } finally {report("inbox","end",performance.now()-started);}
  const headers=new Headers(result.headers);
  headers.set("x-jill-inbox-trace",trace);
  const total=performance.now()-started;
  const source=Math.min(total,sourceMs);
  // Header values are only aggregate milliseconds, never account details.
  // If total is over a minute, DevTools tells us whether Shopify SDK,
  // WORK D1 permissions, or Google QA actually consumed that time.
  const timing=(name:string)=>(timings[name]??0).toFixed(1);
  headers.set("server-timing",
    `merchant-auth;dur=${Math.max(0,total-source).toFixed(1)}, merchant-feed;dur=${source.toFixed(1)}, merchant-shopify;dur=${timing("shopify_auth")}, merchant-authority;dur=${timing("work_owner")}, merchant-google;dur=${timing("google_feed")}, merchant-total;dur=${total.toFixed(1)}`);
  headers.set("x-jill-feed-cache",cacheMode);
  const controlsEnabled=result.model.state==="ready" &&
    workMerchantWritesReady(env);
  return Response.json({...result.model,controlsEnabled},{
    status:result.status,headers,
  });
}

