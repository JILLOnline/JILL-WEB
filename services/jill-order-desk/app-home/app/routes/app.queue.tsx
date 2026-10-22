// Owner-only read-only Operations Queue. No additional API or write authority.
import {useMemo,useState} from "react";
import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {loadVerifiedMerchantInbox} from "./app.requests-source.server";
import {requestShortId,customerStatusLabel,internalStatusLabel} from "../../../inbox-display.mjs";
import {planWorkHqFocusQueue,workStoreCalendarDate,filterWorkHqFocusQueue} from "../../../../../shared/work-hq-focus-queue.mjs";
import "../styles/hq-queue.css";
type QueueRecord={submission_id:string;revision:number;customer_status:string;internal_status:string;date_needed:string;item_count:number;fulfillment:string;updated_at:string;group:string;urgency:string};
type QueueModel={state:string;as_of_date:string|null;records:QueueRecord[];summary:null|{active:number;requested_within_7_days:number;requested_date_passed:number;groups:Record<string,number>}};
export async function loader(args:LoaderFunctionArgs){
 const response=await loadVerifiedMerchantInbox(args);
 const model=planWorkHqFocusQueue(await response.json(),{asOfDate:workStoreCalendarDate()});
 return Response.json(model,{status:response.status,headers:response.headers});
}
const TABS=[["active","Open work"],["quote","Needs quote"],["waiting_customer","Waiting customer"],["production","Production"],["ready","Ready"],["review","Review"],["on_hold","On hold"],["closed","Closed"]] as const;
const LABEL:Record<string,string>={quote:"Prepare quote",waiting_customer:"Waiting on customer",production:"Production",ready:"Ready / handoff",review:"Review request",on_hold:"On hold",closed:"Closed"};
const URGENCY:Record<string,string>={requested_date_passed:"Requested date passed",requested_today:"Requested today",requested_within_week:"Within 7 days",scheduled:"Scheduled",date_not_supplied:"No date supplied",closed:"Closed"};
export default function WorkFocusQueue(){
 const data=useLoaderData<typeof loader>() as unknown as QueueModel;
 const [tab,setTab]=useState("active"),[search,setSearch]=useState(""),[when,setWhen]=useState("all");
 const filtered=useMemo(()=>filterWorkHqFocusQueue(data,{group:tab,urgency:when,search}),[data,tab,when,search]);
 const count=(key:string)=>key==="active"?data.summary?.active??0:data.summary?.groups[key]??0;
 return <s-page heading="JILL HQ — Work Queue" inlineSize="large"><s-section><main className="jill-queue" aria-label="Owner work queue">
 <header className="jill-queue__intro"><div><Link to="/app">← HQ Home</Link><h2>Operations Queue</h2><p>Plan work from verified requests. Requested dates are not proof of late delivery.</p></div><span className="jill-queue__work">WORK · OWNER ONLY</span></header>
 {data.state!=="ready"||!data.summary?<p role="status" className="jill-queue__notice">The verified Owner request source is unavailable. No work counts are assumed.</p>:<>
 <div className="jill-queue__summary"><div><span>Open requests</span><strong>{data.summary.active}</strong></div><div><span>Need quote</span><strong>{data.summary.groups.quote}</strong></div><div><span>Requested within 7 days</span><strong>{data.summary.requested_within_7_days}</strong></div><div><span>Requested date passed</span><strong>{data.summary.requested_date_passed}</strong></div></div>
 <p className="jill-queue__hint">Jacksonville calendar: {data.as_of_date} · No inferred unread messages, inventory or invoices.</p>
 <div className="jill-queue__controls"><nav aria-label="Work categories" className="jill-queue__tabs">{TABS.map(([key,label])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label} <small>{count(key)}</small></button>)}</nav>
 <label>Find request ID<input aria-label="Find request ID" type="search" value={search} maxLength={100} onChange={event=>setSearch(event.target.value)} placeholder="Request ID"/></label>
 <label>Requested date<select value={when} onChange={event=>setWhen(event.target.value)}><option value="all">All dates</option><option value="overdue">Date passed</option><option value="today">Today</option><option value="next_week">Next 7 days</option><option value="no_date">No date</option></select></label>
 <button type="button" onClick={()=>{setWhen("all");setSearch("");}}>Reset</button></div>
 <p role="status" className="jill-queue__hint">Showing {filtered.shown} of {filtered.in_group} verified requests</p>
 <div className="jill-queue__table"><div className="jill-queue__head"><span>Requested</span><span>Request</span><span>Next step</span><span>Customer status</span><span>Items</span><span>Open</span></div>
 {filtered.records.length===0?<p className="jill-queue__notice">No matching requests.</p>:filtered.records.map((row:QueueRecord)=><article className="jill-queue__row" key={row.submission_id}>
 <div data-label="Requested"><strong>{row.date_needed||"Not supplied"}</strong><small>{URGENCY[row.urgency]||"Review"}</small></div>
 <div data-label="Request"><strong>#{requestShortId(row.submission_id)}</strong><small>Revision {row.revision}</small></div>
 <div data-label="Next step"><strong>{LABEL[row.group]||"Review"}</strong><small>{internalStatusLabel(row.internal_status)}</small></div>
 <div data-label="Customer status">{customerStatusLabel(row.customer_status)}</div>
 <div data-label="Items">{row.item_count}<small>{row.fulfillment||"Unspecified"}</small></div>
 <div data-label="Open"><Link to={"/app/requests/"+encodeURIComponent(row.submission_id)}>Open request →</Link></div></article>)}</div></>}
 <footer>Read-only WORK planning · No automatic updates, messages, invoices or payments.</footer>
 </main></s-section></s-page>;
}
