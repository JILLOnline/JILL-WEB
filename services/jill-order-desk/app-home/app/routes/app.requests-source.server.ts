// The ONLY WORK inbox source loader. Never register this as an index route.
// Every request must pass Shopify online Owner auth, WORK D1 and signed
// canonical QA read. UI modules import only their nine-field projection.
import {workMerchantWritesReady} from "../../../work-merchant-write-readiness.mjs";
import {type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {loadWorkMerchantInbox} from "../../../merchant-inbox-read.mjs";
import {readWorkGoogleQaMerchantList} from "../../../work-google-merchant-read.mjs";
import {readWorkMerchantSourceCached} from "../../../work-merchant-source-cache.mjs";

export async function loadVerifiedMerchantInbox({request,context}:LoaderFunctionArgs) {
  const env=context.cloudflare.env;
  const started=performance.now();
  let sourceMs=0;
  let cacheMode="not-requested";
  const result=await loadWorkMerchantInbox({
    request,
    authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,
    // Keep the authenticated owner-only, WHITELISTED Google read boundary.
    // No Shopify session or customer identity is forwarded to the source.
    readCanonicalSource:env.JILL_WORK_HOST_STAGE==="canary" &&
      env.JILL_HQ_MERCHANT_READ_SECRET
      ? async () => {
          const began=performance.now();
          try {
            return await readWorkMerchantSourceCached({
              secret:env.JILL_HQ_MERCHANT_READ_SECRET!,
              reader:readWorkGoogleQaMerchantList,
              onCache:(mode:string)=>{cacheMode=mode;},
            });
          } finally {sourceMs=performance.now()-began;}
        }
      : undefined,
  });
  const headers=new Headers(result.headers);
  const total=performance.now()-started;
  const source=Math.min(total,sourceMs);
  headers.set("server-timing",
    `merchant-auth;dur=${Math.max(0,total-source).toFixed(1)}, merchant-feed;dur=${source.toFixed(1)}, merchant-total;dur=${total.toFixed(1)}`);
  headers.set("x-jill-feed-cache",cacheMode);
  const controlsEnabled=result.model.state==="ready" &&
    workMerchantWritesReady(env);
  return Response.json({...result.model,controlsEnabled},{
    status:result.status,headers,
  });
}

