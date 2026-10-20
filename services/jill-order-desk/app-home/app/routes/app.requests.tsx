import {useMemo,useState} from "react";
import {Link,useFetcher,useRouteLoaderData} from "react-router";
import {
  customerStatusLabel,internalStatusLabel,requestShortId,dateLabel,
  selectInboxRecords,inboxStats,INBOX_FILTERS,
} from "../../../inbox-display.mjs";
import "../styles/inbox.css";
import "../styles/request-detail.css";
import {WorkOrderDetailsContent} from "../components/WorkOriginalRequestDetails";
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

const STATUS_TONE:Record<string,string>={
  received:"received",reviewing:"reviewing",awaiting_approval:"waiting",
  in_production:"working",ready_pickup:"ready",on_hold:"waiting",
  cancelled:"muted",completed:"ready",
};
function RequestCard({item,controlsEnabled}:{item:InboxRecord;controlsEnabled:boolean}) {
  const statusTone=STATUS_TONE[item.customer_status]??"muted";
  type OrderModel=NonNullable<Parameters<typeof WorkOrderDetailsContent>[0]["model"]>;
  const orderDetails=useFetcher<OrderModel>();
  const [detailsOpen,setDetailsOpen]=useState(false);
  return <article className="jill-inbox__card">
    <div className="jill-inbox__card-head">
      <div className="jill-inbox__card-heading">
        <span className="jill-inbox__card-kicker">CUSTOM ORDER</span>
        <h3>Request #{requestShortId(item.submission_id)}</h3>
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
      <p className="jill-inbox__submitted">
        Submitted {dateLabel(item.submitted_at,{includeTime:true})}
      </p>
    </div>
    <details className="jill-inbox__details" onToggle={event=>{
      const open=event.currentTarget.open;
      setDetailsOpen(open);
      // Explicit per-card read only. Every reopened disclosure reauthenticates
      // through the existing exact-ID route; never preload private inbox data.
      if(open&&orderDetails.state==="idle")
        orderDetails.load("/app/requests/"+encodeURIComponent(item.submission_id));
    }}>
      <summary>ORDER DETAILS <span className="jill-inbox__chevron" aria-hidden="true">⌄</span></summary>
      {detailsOpen?<div className="jill-inbox__order-details">
        {orderDetails.state!=="idle"||!orderDetails.data
          ?<p role="status">Loading order details…</p>
          :<WorkOrderDetailsContent model={orderDetails.data} submissionId={item.submission_id} stacked/>}
      </div>:null}
    </details>
    <WorkRequestQuickActions record={item} enabled={controlsEnabled} compact/>
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

  return <s-page heading="JILL HQ — WORK / Custom Orders" inlineSize="large">
    <s-section>
      <main className="jill-inbox" aria-label="JILL HQ Custom Orders">
        <div className="jill-inbox__nav">
          <Link to="/app" className="jill-inbox__back">← Home</Link>
          <span className="jill-inbox__readonly">WORK · {data.controlsEnabled===true?"MANAGEMENT":"READ ONLY"}</span>
        </div>
        <header className="jill-inbox__intro">
          <p className="jill-inbox__eyebrow">MAKE IT HAPPEN</p>
          <h2>Requests</h2>
          <p>Every detail. Every deadline. One place.</p>
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

                    </div>
                    <div className="jill-inbox__metric">
                      <span>In review</span><strong>{stats.reviewing}</strong>

                    </div>
                    <div className="jill-inbox__metric">
                      <span>Needs a quote</span><strong>{stats.needsQuote}</strong>

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

      </main>
    </s-section>
  </s-page>;
}
