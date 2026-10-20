import {useEffect,useMemo,useRef,useState} from "react";
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
  const cardNode=useRef<HTMLElement|null>(null);
  const requestedId=useRef<string|null>(null);
  // The nine-field canonical list intentionally contains no customer PII.
  // Read the verified name only from the existing signed exact-ID Owner route,
  // and only for cards near the viewport. Never cache names or guess from email.
  useEffect(()=>{
    const node=cardNode.current;
    if(!node)return;
    const loadName=()=>{
      if(requestedId.current===item.submission_id)return;
      requestedId.current=item.submission_id;
      orderDetails.load("/app/requests/"+encodeURIComponent(item.submission_id));
    };
    if(typeof IntersectionObserver==="undefined"){loadName();return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        observer.disconnect();
        loadName();
      }
    },{rootMargin:"120px 0px"});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[item.submission_id,orderDetails.load]);
  const original=orderDetails.data;
  const customerName=original?.state==="ready"&&
    original.detail?.submission_id===item.submission_id&&
    typeof original.detail.customer?.name==="string"
      ?original.detail.customer.name.trim():null;
  return <article ref={cardNode}
    className={"jill-inbox__card jill-inbox__card--"+statusTone+
      (detailsOpen?" jill-inbox__card--expanded":"")}>
    <div className="jill-inbox__card-head">
      <div className="jill-inbox__card-heading">
        <span className="jill-inbox__card-kicker">CUSTOM ORDER</span>
        {customerName?<p className="jill-inbox__customer-name">{customerName}</p>:null}
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
      if(open){
        if(requestedId.current!==item.submission_id){
          requestedId.current=item.submission_id;
          orderDetails.load("/app/requests/"+encodeURIComponent(item.submission_id));
        }
        // An open card occupies its own grid row. Once React applies the new
        // layout, keep the card visible inside the actual scroll container
        // (including the embedded Shopify Admin frame). Never lock body scroll.
        requestAnimationFrame(()=>{
          const node=cardNode.current;
          if(!node)return;
          const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
          node.scrollIntoView({block:"start",inline:"nearest",
            behavior:reduced?"auto":"smooth"});
        });
      }
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
