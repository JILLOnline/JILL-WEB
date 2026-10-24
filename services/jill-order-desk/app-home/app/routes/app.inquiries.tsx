// JILL HQ WORK — future Owner-only unified inquiries screen.
// Source-only candidate. Feature hard-OFF at Worker ingress and source loader.
// Existing Home/Requests/Contact/Messages routes are not replaced.
import {useMemo,useState} from "react";
import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {loader as unifiedQueueLoader} from "./app.queue-unified";
import "../styles/hq-inquiries.css";

type Entry={
 kind:"custom_order"|"contact";id:string;status:string;
 revision:number;source:string;
 updated_at:string;updated_at_ms:number;created_at:string;
 href:string;can_send_message:false;unread_count:null;
 item_count?:number;date_needed?:string;fulfillment?:string;
 stage?:string;reason?:string;
};
type Queue={
 state:"ready"|"partial"|"held"|"not_connected";
 contact_connected:boolean;custom_orders_connected:boolean;
 contact_state:string;records:Entry[];total_visible:number;
 unread_count:null;can_send_message:false;
};
export async function loader(args:LoaderFunctionArgs){
 // Auth and source reads are performed ONLY by the same guarded server
 // loader as the JSON route. No duplicate customer or D1 projection.
 return unifiedQueueLoader(args);
}
const pretty=(value:string)=>value.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase());
const displayTime=(iso:string)=>{
 const parsed=Date.parse(iso);
 return Number.isFinite(parsed)?new Date(parsed).toLocaleString():"Time unavailable";
};

export default function WorkInquiries(){
 const data=useLoaderData<typeof loader>() as unknown as Queue;
 const [query,setQuery]=useState("");
 const [kind,setKind]=useState("all");
 const ready=data?.state==="ready"||data?.state==="partial";
 const entries=ready&&Array.isArray(data.records)?data.records:[];
 const shown=useMemo(()=>{
  const term=query.trim().toLocaleLowerCase().slice(0,120);
  return entries.filter(row=>
   (kind==="all"||row.kind===kind)&&
   (!term||row.id.toLocaleLowerCase().includes(term)||
    row.status.toLocaleLowerCase().includes(term)));
 },[entries,kind,query]);
 return <s-page heading="JILL HQ — WORK / Inquiries" inlineSize="large">
  <s-section>
   <main className="jill-inquiries" aria-label="Authorized merchant inquiry queue">
    <header className="jill-inquiries__heading">
     <div>
      <p className="jill-inquiries__eyebrow">JILL HQ / WORK</p>
      <h2>Inquiries</h2>
      <p>Verified Custom Orders and Contact Us tickets in one Owner view.</p>
     </div>
     <span className="jill-inquiries__readonly">READ ONLY</span>
    </header>
    {!ready?<section className="jill-inquiries__notice" role="status">
      <strong>Combined inquiry source is unavailable.</strong>
      <p>No unverified customer or Contact records are shown. Use the existing
       Requests and Contact Us sections while the connection is being checked.</p>
      <Link to="/app/requests">Open verified Requests →</Link>
     </section>:<>
      {data.contact_connected!==true&&
       <p role="status" className="jill-inquiries__notice">
        <strong>Contact Us is not connected here.</strong>
        {" "}Showing only verified Custom Orders. This does not mean
        there are zero customer inquiries in Shopify Contact Us.
       </p>}
      <div className="jill-inquiries__tools">
       <label>Find inquiry
        <input type="search" value={query} maxLength={120}
         placeholder="Request or ticket ID, status"
         onChange={event=>setQuery(event.target.value)}/>
       </label>
       <label>Source
        <select value={kind} onChange={event=>setKind(event.target.value)}>
         <option value="all">All connected sources</option>
         <option value="custom_order">Custom Orders</option>
         <option value="contact" disabled={!data.contact_connected}>Contact Us</option>
        </select>
       </label>
      </div>
      <p className="jill-inquiries__count" role="status">
       {shown.length} of {entries.length} verified records visible
       {" · "}No unread counts or message delivery status is assumed.
      </p>
      {shown.length===0?<div className="jill-inquiries__empty">
        {entries.length===0?"No verified records were returned by the connected sources."
         :"No inquiries match these filters."}
       </div>:
       <div className="jill-inquiries__list">
        {shown.map(row=><article key={row.kind+":"+row.id}
          className="jill-inquiries__item">
          <div className="jill-inquiries__identity">
           <span className="jill-inquiries__kind">
            {row.kind==="custom_order"?"Custom Order":"Contact Us"}
           </span>
           <h3>{row.kind==="custom_order"?"Request":"Ticket"} · {row.id}</h3>
           <p>{row.kind==="custom_order"
             ?row.item_count+" verified item(s)"+
               (row.date_needed?" · Needed "+row.date_needed:"")
             :"Reason: "+pretty(row.reason??"other")}</p>
          </div>
          <div className="jill-inquiries__state">
           <strong>{pretty(row.status)}</strong>
           <time dateTime={row.updated_at}>
            Updated {displayTime(row.updated_at)}
           </time>
          </div>
          <Link className="jill-inquiries__open" to={row.href}
           aria-label={"Open "+(row.kind==="custom_order"?"Custom Order ":"Contact ticket ")+row.id}>
           Open details <span aria-hidden="true">→</span>
          </Link>
         </article>)}
       </div>}
      <footer className="jill-inquiries__footer">
       <p>Sources remain authoritative in their original systems.
        Messages, customer ownership, quotes and orders require
        their separate verified workflows.</p>
       <Link to="/app/requests">Custom Orders</Link>
       {" · "}<Link to="/app/contacts">Contact Us</Link>
      </footer>
     </>}
   </main>
  </s-section>
 </s-page>;
}
