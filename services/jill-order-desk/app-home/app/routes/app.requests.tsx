import {useEffect,useMemo,useRef,useState} from "react";
import {Link,useFetcher,useRouteLoaderData} from "react-router";
import {archiveReason,filterArchivedRequests,partitionWorkRequests,WORK_ARCHIVE_FILTERS}
  from "../../../work-request-archive-model.mjs";
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
type ArchiveModel={ok:boolean;code:string;enabled?:boolean;removed_ids?:string[]};
type SearchModel={ok:boolean;code:string;tag?:string;matches?:string[];
  scanned?:number;total?:number;next_cursor?:number|null;snapshot?:string};
type SearchProgress={tag:string;query:string;matches:string[];scanned:number;
  total:number;next_cursor:number|null;snapshot:string;error:string};
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
function ArchiveControl({item,removed,enabled,onSaved}:{
  item:InboxRecord;removed:boolean;enabled:boolean;onSaved:()=>void;
}) {
  const fetcher=useFetcher<{ok:boolean;code:string}>();
  const op=useRef<string|null>(null);
  const done=useRef(false);
  useEffect(()=>{
    if(fetcher.state!=="idle"||!fetcher.data||done.current)return;
    done.current=true;
    if(fetcher.data.ok===true){onSaved();}
  },[fetcher.state,fetcher.data,onSaved]);
  if(!enabled)return null;
  const pending=fetcher.state!=="idle";
  return <div className="jill-inbox__archive-control">
    <button type="button" disabled={pending||Boolean(fetcher.data&&!fetcher.data.ok)}
      onClick={()=>{
        const action=removed?"restore":"remove";
        if(!removed&&!window.confirm(
          "Move this request to Archive? The original order will NOT be deleted."))return;
        const id="jill:work:archive:"+action+":"+crypto.randomUUID();
        op.current=id;done.current=false;
        fetcher.submit({submission_id:item.submission_id,
          source_revision:String(item.revision),operation_id:id,action},
          {method:"post",action:"/app/requests/archive"});
      }}>
      {pending?"Updating…":removed?"Restore request":"Move to Archive"}
    </button>
    {fetcher.data&&!fetcher.data.ok?
      <p role="alert">Archive change not confirmed. Refresh the request status before trying again.</p>:null}
  </div>;
}
function RequestCard({item,controlsEnabled,archiveEnabled,removed,onArchiveChange}:{
  item:InboxRecord;controlsEnabled:boolean;archiveEnabled:boolean;
  removed:boolean;onArchiveChange:()=>void;
}) {
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
      {removed?<span className="jill-inbox__archive-stamp">Removed · kept in Archive</span>:null}
      <ArchiveControl item={item} removed={removed}
        enabled={archiveEnabled} onSaved={onArchiveChange}/>
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
  const [view,setView]=useState<"active"|"archive"|"all">("active");
  const [status,setStatus]=useState("all");
  const [sort,setSort]=useState("recent");
  const archiveFetch=useFetcher<ArchiveModel>();
  const detailSearch=useFetcher<SearchModel>();
  const [search,setSearch]=useState<SearchProgress|null>(null);
  const [archiveRefresh,setArchiveRefresh]=useState(0);
  // Soft-removal overlay is a separate, gated Owner+D1 read. If the feature
  // is off, status-based archives still work; no removed orders are guessed.
  useEffect(()=>{archiveFetch.load("/app/requests/archive");},
    [archiveRefresh]);
  const archiveReady=archiveFetch.data?.ok===true &&
    archiveFetch.data.enabled===true;
  const removedIds=useMemo(()=>archiveReady &&
    Array.isArray(archiveFetch.data?.removed_ids)
      ?archiveFetch.data.removed_ids:[],
    [archiveReady,archiveFetch.data]);
  const removedSet=useMemo(()=>new Set(removedIds),[removedIds]);
  const grouped=useMemo(()=>partitionWorkRequests(data.records,{removedIds}),
    [data.records,removedIds]);
  const stats=useMemo(()=>inboxStats(data.records),[data.records]);
  const selected=useMemo(()=>{
    if(view==="active")return grouped.active;
    if(view==="archive")return grouped.archive;
    return data.records;
  },[view,grouped,data.records]);
  const visible=useMemo(()=>{
    const pool=view==="archive"
      ?filterArchivedRequests(selected,status,removedIds):selected;
    const allowed=view==="archive"?"all":status;
    const matching=selectInboxRecords(pool,{query:"",status:allowed,sort});
    const textQuery=query.trim().toLowerCase();
    if(!textQuery)return matching;
    const local=selectInboxRecords(pool,{query,status:allowed,sort});
    const matched=new Set(local.map(r=>r.submission_id));
    if(search?.query===query.trim())
      for(const id of search.matches)matched.add(id);
    return matching.filter(row=>matched.has(row.submission_id));
  },[selected,view,status,sort,query,search,removedIds]);
  const startFullSearch=()=>{
    const term=query.trim();
    if(term.length<2)return;
    const tag=crypto.randomUUID();
    setView("all");setStatus("all");
    setSearch({tag,query:term,matches:[],scanned:0,total:data.records.length,
      next_cursor:0,snapshot:"",error:""});
    detailSearch.submit({q:term,cursor:"0",snapshot:"",tag},
      {method:"post",action:"/app/requests/search"});
  };
  const loadMore=()=>{
    if(!search||search.next_cursor===null||detailSearch.state!=="idle")return;
    detailSearch.submit({q:search.query,cursor:String(search.next_cursor),
      snapshot:search.snapshot,tag:search.tag},
      {method:"post",action:"/app/requests/search"});
  };
  useEffect(()=>{
    const result=detailSearch.data;
    if(!result)return;
    setSearch(current=>{
      if(!current||result.tag!==current.tag)return current;
      if(!result.ok)return {...current,error:
        "Search could not be verified. Refresh before searching again.",
        next_cursor:null};
      return {...current,error:"",scanned:current.scanned+(result.scanned??0),
        total:result.total??current.total,
        matches:[...new Set([...current.matches,...(result.matches??[])])],
        next_cursor:result.next_cursor??null,
        snapshot:result.snapshot??current.snapshot};
    });
  },[detailSearch.data]);
  const searching=detailSearch.state!=="idle";
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
