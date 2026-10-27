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
import {JillChevronDown} from "../components/JillChevronDown";
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
  // Only trusted server auth may eventually populate this field; no role grants here.
  verifiedRole?:"owner"|"order_manager";
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
  const [editorHost,setEditorHost]=useState<HTMLDivElement|null>(null);
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
  const toggleDetails=()=>{
    const next=!detailsOpen;
    setDetailsOpen(next);
    if(!next)return;
    // A failed background detail read must not permanently poison this row.
    // The merchant can reopen it to retry the same exact-ID signed route;
    // successful authorized reads remain unchanged and are not duplicated.
    if(requestedId.current!==item.submission_id||
      (orderDetails.state==="idle"&&orderDetails.data?.state==="source_unavailable")){
      requestedId.current=item.submission_id;
      orderDetails.load("/app/requests/"+encodeURIComponent(item.submission_id));
    }
    // Expanded details occupy a normal full-width row beneath the summary.
    // Scroll within the Shopify frame without locking or moving its parent.
    requestAnimationFrame(()=>{
      const node=cardNode.current;
      if(!node)return;
      const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      node.scrollIntoView({block:"nearest",inline:"nearest",
        behavior:reduced?"auto":"smooth"});
    });
  };
  const fullSubmitted=dateLabel(item.submitted_at,{includeTime:true});
  return <article ref={cardNode}
    className={"jill-inbox__card jill-inbox__card--"+statusTone+
      (detailsOpen?" jill-inbox__card--expanded":"")}>
    <div className="jill-inbox__row">
      <button type="button" className="jill-inbox__row-trigger"
        aria-expanded={detailsOpen}
        aria-controls={"jill-inbox-details-"+requestShortId(item.submission_id)}
        aria-label={(detailsOpen?"Hide":"Show")+" order details for request #"+
          requestShortId(item.submission_id)}
        onClick={toggleDetails}>
      <span className="jill-inbox__cell jill-inbox__cell--customer" data-label="Customer">
        {customerName
          ?<span className="jill-inbox__customer-name" title={customerName}>{customerName}</span>
          :<span className="jill-inbox__customer-unverified">
            {orderDetails.state!=="idle"?"Checking name…":"Name unavailable"}
          </span>}
      </span>
      <span className="jill-inbox__cell jill-inbox__cell--request" data-label="Request">
        <span className="jill-inbox__request-id">
          #{requestShortId(item.submission_id)}
        </span>
      </span>
      <span className="jill-inbox__cell jill-inbox__cell--status" data-label="Status">
        <span className={"jill-inbox__status jill-inbox__status--"+statusTone}>
          <span className="jill-inbox__status-dot" aria-hidden="true"/>
          {customerStatusLabel(item.customer_status)}
        </span>
        {removed?<span className="jill-inbox__archive-stamp">Removed</span>:null}
      </span>
      <span className="jill-inbox__cell jill-inbox__cell--stage" data-label="Stage">
        {item.internal_status!=="none"
          ?<span className="jill-inbox__internal">{internalStatusLabel(item.internal_status)}</span>
          :<span className="jill-inbox__cell-muted">—</span>}
      </span>
      <span className="jill-inbox__cell jill-inbox__cell--needed" data-label="Needed by">
        <span title={item.date_needed||"Not supplied"}>{dateLabel(item.date_needed)}</span>
      </span>
      <span className="jill-inbox__cell jill-inbox__cell--submitted" data-label="Submitted">
        <time dateTime={item.submitted_at} title={fullSubmitted}>
          {dateLabel(item.submitted_at)}
        </time>
      </span>
      </button>
      <div className="jill-inbox__cell jill-inbox__cell--actions" data-label="Actions">
        <WorkRequestQuickActions record={item} enabled={controlsEnabled}
          direct editorHost={editorHost}/>
        <ArchiveControl item={item} removed={removed}
          enabled={archiveEnabled} onSaved={onArchiveChange}/>
      </div>
      <button type="button" className="jill-inbox__row-end"
        aria-label={(detailsOpen?"Hide":"Show")+" order details for request #"+
          requestShortId(item.submission_id)}
        aria-expanded={detailsOpen}
        aria-controls={"jill-inbox-details-"+requestShortId(item.submission_id)}
        onClick={toggleDetails}>
        <JillChevronDown/>
      </button>
      <div className="jill-inbox__editor-slot" ref={setEditorHost}
        id={"jill-inbox-editor-"+requestShortId(item.submission_id)}/>
    </div>
    <section className="jill-inbox__order-details"
      id={"jill-inbox-details-"+requestShortId(item.submission_id)}
      hidden={!detailsOpen}
      aria-label={"Order details for request #"+requestShortId(item.submission_id)}>
      {detailsOpen?<>
        <div className="jill-inbox__details-heading">
          <strong>ORDER DETAILS · #{requestShortId(item.submission_id)}</strong>
          <Link to={"/app/requests/"+encodeURIComponent(item.submission_id)}>
            Open full request <span aria-hidden="true">→</span>
          </Link>
        </div>
        {orderDetails.state!=="idle"
          ?<p role="status">Checking verified request details…</p>
          :orderDetails.data
            ?<WorkOrderDetailsContent model={orderDetails.data}
              submissionId={item.submission_id} stacked/>
            :<p role="status">Request details could not be loaded yet.</p>}
        {orderDetails.state==="idle"&&
          (!orderDetails.data||orderDetails.data.state==="source_unavailable")&&
          <button type="button" className="jill-button jill-button--quiet"
            onClick={()=>{
              requestedId.current=item.submission_id;
              orderDetails.load("/app/requests/"+encodeURIComponent(item.submission_id));
            }}>
            Retry verified details
          </button>}
      </>:null}
    </section>
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
  const stats=useMemo(()=>inboxStats(grouped.active),[grouped.active]);
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
      if(!current||(result.tag&&result.tag!==current.tag))return current;
      // Pre-auth errors deliberately have no request tag; still show a clear
      // failure rather than leaving the Owner with an endless search spinner.
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
  const accessLabel=data.state==="access_denied"?"REQUEST PERMISSIONS":
    data.state==="ready"&&data.verifiedRole==="order_manager"?"SELLER":
    data.state==="ready"?"MANAGEMENT":"ACCESS UNVERIFIED";
  return <s-page heading="JILL HQ — WORK / Custom Orders" inlineSize="large">
    <s-section>
      <main className="jill-inbox" aria-label="JILL HQ Custom Orders">
        <div className="jill-inbox__nav">
          <Link to="/app" className="jill-inbox__back">← Home</Link>
          <span className="jill-inbox__access-badge">
            {accessLabel}
          </span>
        </div>
        <header className="jill-inbox__intro">
          <h2>REQUESTS</h2>
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
                  <div className="jill-inbox__stats" aria-label="Inbox overview">
                    <div className="jill-inbox__metric">
                      <span>Active requests</span><strong>{grouped.active.length}</strong>
                    </div>
                    <div className="jill-inbox__metric">
                      <span>Archived</span><strong>{grouped.archive.length}</strong>
                    </div>
                    <div className="jill-inbox__metric">
                      <span>In review</span><strong>{stats.reviewing}</strong>
                    </div>
                    <div className="jill-inbox__metric">
                      <span>Needs a quote</span><strong>{stats.needsQuote}</strong>
                    </div>
                  </div>
                  <nav className="jill-inbox__views" aria-label="Request folders">
                    {(["active","archive","all"] as const).map(folder=>
                      <button type="button" key={folder}
                        aria-pressed={view===folder}
                        onClick={()=>{setView(folder);setStatus("all");}}>
                        {folder==="active"?"Active":folder==="archive"?"Archive":"All requests"}
                        <span>{folder==="active"?grouped.active.length:
                          folder==="archive"?grouped.archive.length:data.records.length}</span>
                      </button>)}
                  </nav>
                  {view==="archive"?
                    <p className="jill-inbox__archive-note">
                      Cancelled and completed requests stay here automatically.
                      {archiveReady
                        ?" Removed requests are recoverable and are never erased from the original source."
                        :" Recoverable removal is held until the secure WORK archive is enabled."}
                    </p>:null}
                  <div className="jill-inbox__toolbar" aria-label="Filter requests">
                    <div className="jill-inbox__search">
                      <label htmlFor="jill-request-search">Search requests</label>
                      <form className="jill-inbox__search-form" onSubmit={event=>{
                        event.preventDefault();startFullSearch();
                      }}>
                        <input id="jill-request-search" type="search" value={query}
                          onChange={event=>{setQuery(event.target.value);setSearch(null);}}
                          placeholder="Customer, item, theme, date, ID, personalization…"
                          maxLength={80} autoComplete="off"
                          aria-label="Search requests and order details"/>
                        <button type="submit" disabled={query.trim().length<2||searching}>
                          {searching?"Searching…":"Search details"}
                        </button>
                      </form>
                    </div>
                    <label>
                      Status
                      <span className="jill-ui__select">
                      <select value={status} onChange={event=>setStatus(event.target.value)}>
                        {(view==="archive"?WORK_ARCHIVE_FILTERS:INBOX_FILTERS)
                          .filter(([value])=>view==="archive"||
                            view==="all"||!["cancelled","completed"].includes(value))
                          .map(([value,label])=>
                            <option key={value} value={value}>{label}</option>)}
                      </select>
                      <JillChevronDown/>
                      </span>
                    </label>
                    <label>
                      Sort
                      <span className="jill-ui__select">
                      <select value={sort} onChange={event=>setSort(event.target.value)}>
                        <option value="recent">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="needed">Needed date</option>
                      </select>
                      <JillChevronDown/>
                      </span>
                    </label>
                  </div>
                  {search&&search.query===query.trim()?
                    <div className="jill-inbox__search-progress" role="status" aria-live="polite">
                      {search.error?<span>{search.error}</span>:
                        <span>Full-detail search: examined {search.scanned} of {search.total}
                          {" "}verified requests · {search.matches.length} detail matches.
                          Only verified results are shown.</span>}
                      {!search.error&&search.next_cursor!==null&&
                        detailSearch.state==="idle"?
                        <button type="button" onClick={loadMore}>Search next 6 requests</button>:null}
                      {searching?<span>Checking signed request details…</span>:null}
                    </div>:null}
                  <div className="jill-inbox__results-head">
                    <h3>{view==="archive"?"Archive":view==="active"?"Active requests":"All requests"}</h3>
                    <p role="status" aria-live="polite">
                      Showing {visible.length} of {selected.length}
                    </p>
                  </div>
                  {visible.length
                    ? <div className="jill-inbox__table" aria-label="Request rows">
                        <div className="jill-inbox__columns" aria-hidden="true">
                          <span>Customer</span><span>Request</span>
                          <span>Status</span><span>Stage</span>
                          <span>Needed by</span><span>Submitted</span>
                          <span>Actions</span><span aria-hidden="true"/>
                        </div>
                        <div className="jill-inbox__cards">
                          {visible.map((item:InboxRecord)=>
                            <RequestCard key={item.submission_id} item={item}
                              controlsEnabled={data.controlsEnabled===true}
                              archiveEnabled={archiveReady}
                              removed={removedSet.has(item.submission_id)}
                              onArchiveChange={()=>setArchiveRefresh(n=>n+1)}/>)}
                        </div>
                      </div>
                    : <div className="jill-inbox__empty" role="status">
                        {data.records.length===0
                          ? "No requests were returned by the verified source."
                          : view==="archive"&&grouped.archive.length===0
                            ? "No archived requests yet. Cancelled and completed orders will appear here."
                            : query&&search?.next_cursor!==null
                              ? "No matches in the scanned requests yet. Search the next batch to continue."
                              : "No requests match these filters. Try a different search or status."}
                      </div>}
                </>}

      </main>
    </s-section>
  </s-page>;
}
