import {workMerchantWritesReady} from "../../../work-merchant-write-readiness.mjs";
import {useMemo,useState} from "react";
import {Link,useRouteLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {loadWorkMerchantInbox} from "../../../merchant-inbox-read.mjs";
import {readWorkGoogleQaMerchantList} from "../../../work-google-merchant-read.mjs";
import {readWorkMerchantSourceCached} from "../../../work-merchant-source-cache.mjs";
import {
  customerStatusLabel,internalStatusLabel,requestShortId,dateLabel,
  selectInboxRecords,inboxStats,INBOX_FILTERS,
} from "../../../inbox-display.mjs";
import "../styles/inbox.css";
import {WorkRequestQuickActions} from "../components/WorkRequestQuickActions";
import "../styles/request-actions.css";

type InboxRecord={
  submission_id:string;
  revision:number;
  customer_status:string;
  internal_status:string;
  submitted_at:string;
  updated_at:string;
  date_needed:string;
  fulfillment:string;
  item_count:number;
};
type InboxModel={
  state:"ready"|"source_not_connected"|"source_unavailable"|"access_denied";
  requestsConnected:boolean;
  records:InboxRecord[];
  readOnly:boolean;
  controlsEnabled?:boolean;
};

// Data is owned exclusively by the verified parent request route.
// This must NOT be named `loader`: React Router would invoke it AGAIN for
// the child index route, duplicating Shopify/D1/Google calls on return.
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

const STATUS_TONE:Record<string,string>={
  received:"received",reviewing:"reviewing",awaiting_approval:"waiting",
  in_production:"working",ready_pickup:"ready",on_hold:"waiting",
  cancelled:"muted",completed:"ready",
};
function RequestCard({item,controlsEnabled}:{item:InboxRecord;controlsEnabled:boolean}) {
  const statusTone=STATUS_TONE[item.customer_status]??"muted";
  return <article className="jill-inbox__card">
    <div className="jill-inbox__card-head">
      <div className="jill-inbox__card-heading">
        <span className="jill-inbox__card-kicker">CUSTOM ORDER</span>
        <h3>Request #{requestShortId(item.submission_id)}</h3>
        <p className="jill-inbox__submitted">
          Submitted {dateLabel(item.submitted_at,{includeTime:true})}
        </p>
      </div>
      <div className="jill-inbox__status-group" aria-label="Request statuses">
        <span className={"jill-inbox__status jill-inbox__status--"+statusTone}>
          <span className="jill-inbox__status-dot" aria-hidden="true"/>
          {customerStatusLabel(item.customer_status)}
        </span>
        {item.internal_status!=="none"
          ? <span className="jill-inbox__internal">
              {internalStatusLabel(item.internal_status)}
            </span>
          : null}
      </div>
    </div>
    <div className="jill-inbox__facts" aria-label="Request summary">
      <div>
        <span className="jill-inbox__fact-label">Needed by</span>
        <strong>{dateLabel(item.date_needed)}</strong>
      </div>
      <div>
        <span className="jill-inbox__fact-label">Items</span>
        <strong>{item.item_count}</strong>
      </div>
      <div>
        <span className="jill-inbox__fact-label">Fulfillment</span>
        <strong>{item.fulfillment==="pickup"?"Pickup":
          item.fulfillment==="shipping"?"Shipping":"Not supplied"}</strong>
      </div>
    </div>
    <details className="jill-inbox__details">
      <summary>View request details <span className="jill-inbox__chevron" aria-hidden="true">⌄</span></summary>
      <dl>
        <div><dt>Full request ID</dt><dd className="jill-inbox__ref">{item.submission_id}</dd></div>
        <div><dt>Customer status</dt><dd>{customerStatusLabel(item.customer_status)}</dd></div>
        <div><dt>Internal stage</dt><dd>{internalStatusLabel(item.internal_status)}</dd></div>
        <div><dt>Last updated</dt><dd>{dateLabel(item.updated_at,{includeTime:true})}</dd></div>
        <div><dt>Source revision</dt><dd>{item.revision}</dd></div>
      </dl>
      <p className="jill-inbox__details-note">
        This is the verified request summary. Customer contact details,
        private notes and order changes are not exposed in this view.
      </p>
    </details>
    <WorkRequestQuickActions record={item} enabled={controlsEnabled} compact/>
    <div className="jill-inbox__open">
      <Link to={"/app/requests/"+encodeURIComponent(item.submission_id)}>
        Open request workspace →
      </Link>
    </div>
  </article>;
}

export default function WorkMerchantInbox() {
  const data=useRouteLoaderData("routes/app.requests.layout") as InboxModel;
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [sort,setSort]=useState("recent");
  const stats=useMemo(()=>inboxStats(data.records),[data.records]);
  const visible=useMemo(()=>selectInboxRecords(data.records,{query,status,sort}),
    [data.records,query,status,sort]);

  return <s-page heading="JILL HQ — WORK / Custom Orders">
    <s-section>
      <main className="jill-inbox" aria-label="JILL HQ Custom Orders">
        <div className="jill-inbox__nav">
          <Link to="/app" className="jill-inbox__back">← Back to JILL HQ</Link>
          <span className="jill-inbox__readonly">WORK · {data.controlsEnabled===true?"MANAGEMENT":"READ ONLY"}</span>
        </div>
        <header className="jill-inbox__intro">
          <p className="jill-inbox__eyebrow">REQUESTS &amp; OPERATIONS</p>
          <h2>Custom Orders inbox</h2>
          <p>Follow incoming requests, deadlines and production stages in one place.</p>
        </header>
        {data.state==="source_not_connected"
          ? <s-banner tone="warning">
              The canonical WORK Google QA merchant feed is not connected.
              Requests remain in their original source; no count is available.
            </s-banner>
          : data.state==="source_unavailable"
            ? <s-banner tone="critical">
                The request source is temporarily unavailable. No cached records are shown.
              </s-banner>
            : data.state==="access_denied"
              ? <s-banner tone="critical">
                  Merchant inbox access is not authorized for this account.
                </s-banner>
              : <>
                  <div className="jill-inbox__source">
                    <span className="jill-inbox__source-dot" aria-hidden="true"/>
                    Verified WORK source <span aria-hidden="true">·</span> {data.controlsEnabled===true?"Owner-managed requests":"Read-only snapshot"}
                  </div>
                  <div className="jill-inbox__stats" aria-label="Inbox overview">
                    <div className="jill-inbox__metric">
                      <span>All requests</span><strong>{stats.total}</strong>
                      <small>Verified records</small>
                    </div>
                    <div className="jill-inbox__metric">
                      <span>In review</span><strong>{stats.reviewing}</strong>
                      <small>Customer-facing stage</small>
                    </div>
                    <div className="jill-inbox__metric">
                      <span>Needs a quote</span><strong>{stats.needsQuote}</strong>
                      <small>Internal workflow</small>
                    </div>
                  </div>
                  <div className="jill-inbox__toolbar" aria-label="Filter requests">
                    <label className="jill-inbox__search">
                      Search requests
                      <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
                        placeholder="Request ID, date or stage" maxLength={128}
                        autoComplete="off"/>
                    </label>
                    <label>
                      Status
                      <select value={status} onChange={event=>setStatus(event.target.value)}>
                        {INBOX_FILTERS.map(([value,label])=>
                          <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label>
                      Sort
                      <select value={sort} onChange={event=>setSort(event.target.value)}>
                        <option value="recent">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="needed">Needed date</option>
                      </select>
                    </label>
                  </div>
                  <div className="jill-inbox__results-head">
                    <h3>Requests</h3>
                    <p role="status" aria-live="polite">
                      Showing {visible.length} of {stats.total}
                    </p>
                  </div>
                  {visible.length
                    ? <div className="jill-inbox__cards">
                        {visible.map((item:InboxRecord)=>
                          <RequestCard key={item.submission_id} item={item}
                            controlsEnabled={data.controlsEnabled===true}/>)}
                      </div>
                    : <div className="jill-inbox__empty" role="status">
                        {stats.total===0
                          ? "No requests were returned by the verified source."
                          : "No requests match these filters. Try a different search or status."}
                      </div>}
                </>}
        <footer className="jill-inbox__footer">
          <strong>{data.controlsEnabled===true?"Verified WORK merchant operations enabled.":"Read-only WORK preview."}</strong> Quotes, invoices, payments,
          Shopify fulfillment and direct production-file editing are not enabled.
          Existing My JILL customer tracking is unaffected.
        </footer>
      </main>
    </s-section>
  </s-page>;
}
