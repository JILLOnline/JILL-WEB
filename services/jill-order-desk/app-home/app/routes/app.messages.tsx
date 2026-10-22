import {useEffect,useMemo,useState} from "react";
import {Link,useFetcher,useLoaderData,useSearchParams,type LoaderFunctionArgs}
  from "react-router";
import {loadVerifiedMerchantInbox} from "./app.requests-source.server";
import {dateLabel,requestShortId,customerStatusLabel}
  from "../../../inbox-display.mjs";
import {summarizeMerchantPublicThread}
  from "../../../../../shared/custom-order-message-inbox.mjs";
import {projectVerifiedConversation}
  from "../../../../../shared/custom-order-conversation-view.mjs";
import {reconcileOwnerRequestThread}
  from "../../../../../shared/work-conversation-inbox-policy.mjs";
import {WorkRequestQuickActions} from "../components/WorkRequestQuickActions";
import "../styles/hq-messages.css";
import "../styles/request-actions.css";

type Record={submission_id:string;revision:number;customer_status:string;
  internal_status:string;updated_at:string;submitted_at:string;};
type Data={state:string;records:Record[];controlsEnabled?:boolean;
  conversationEnabled:boolean;};
type ThreadResult={ok:boolean;code?:string;thread?:{
  submission_id:string;revision:number;status:string;updated_at:string;
  timeline_version:2;
  timeline:Array<{revision:number;kind:string;author:string;
    note:string;occurred_at:string;status:string}>;
}};

// Reuse the ONLY authenticated Owner/D1/signed-list boundary for HQ.
// Conversation connectivity is a capability, not assumed from a route.
export async function loader(args:LoaderFunctionArgs){
  const response=await loadVerifiedMerchantInbox(args);
  const model=await response.json() as Data;
  const conversationEnabled=model.state==="ready"&&
    args.context.cloudflare.env.JILL_WORK_CONVERSATION_ENABLED==="true";
  return Response.json({...model,conversationEnabled},{
    status:response.status,headers:response.headers,
  });
}
export default function WorkMessages(){
  const data=useLoaderData<typeof loader>() as Data;
  const threadRead=useFetcher<ThreadResult>();
  const [searchParams,setSearchParams]=useSearchParams();
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const records=useMemo(()=>data.state==="ready"?[...data.records].sort(
    (a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)||
      a.submission_id.localeCompare(b.submission_id)):[],[data]);
  // Filters use ONLY the authorized nine-field list. Names or message text
  // require the separately authenticated exact-ID detail/thread endpoint.
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase().slice(0,120);
    return records.filter(item=>
      (status==="all"||item.customer_status===status)&&
      (!q||item.submission_id.toLocaleLowerCase().includes(q)||
       requestShortId(item.submission_id).toLocaleLowerCase().includes(q)||
       customerStatusLabel(item.customer_status).toLocaleLowerCase().includes(q)));
  },[records,query,status]);
  // Only a request in the authenticated Owner list can become selected.
  const requestedId=searchParams.get("submission_id");
  const selected=records.some(x=>x.submission_id===requestedId)?requestedId:null;
  const record=records.find(x=>x.submission_id===selected)||null;
  const thread=record&&threadRead.data?.ok===true&&
    threadRead.data.thread?.submission_id===record.submission_id
    ?threadRead.data.thread:null;
  const canRead=data.conversationEnabled===true;
  const threadSync=record?reconcileOwnerRequestThread({
    authorizedRequest:record,thread,
  }):null;
  let last=null;
  let visibleMessages:ReturnType<typeof projectVerifiedConversation>["messages"]=[];
  if(thread&&threadSync?.state==="verified"){
    try{
      last=summarizeMerchantPublicThread(thread,record!.submission_id);
      visibleMessages=threadSync.conversation!.messages;
    }catch{last=null;visibleMessages=[];}
  }
  useEffect(()=>{
    if(canRead&&selected)threadRead.load("/app/requests/thread?"+
      new URLSearchParams({submission_id:selected}));
  },[selected,canRead,threadRead.load]);
  const open=(id:string)=>{
    if(!records.some(item=>item.submission_id===id))return;
    setSearchParams({submission_id:id});
  };
  return <s-page heading="JILL HQ — WORK / Messages" inlineSize="large">
    <s-section>
      <main className="jill-messages" aria-label="Merchant custom order inbox">
        <header className="jill-messages__intro">
          <div>
            <h2>Messages</h2>
            <p>One verified conversation per Custom Order, shared with My JILL.</p>
          </div>
          <span className="jill-messages__work">WORK · OWNER</span>
        </header>
        {data.state!=="ready"
          ?<p role="status">Your request inbox could not be verified. No customer conversations are displayed.</p>
          :<>
            {!canRead&&<p className="jill-messages__notice" role="status">
              Secure conversation history is not connected in this WORK version.
              Messages will appear here after the verified two-sided connection
              is enabled. Existing requests remain available.
            </p>}
            <p className="jill-messages__hint">
              {records.length} {records.length===1?"request thread":"request threads"}
              {" · "}Unread and delivery receipts are not yet available.
              The list is ordered by request activity, not message delivery.
            </p>
            <div className="jill-messages__filters" role="search" aria-label="Find request conversations">
              <label>Find request
                <input type="search" value={query} maxLength={120}
                  placeholder="Request ID or status" onChange={event=>setQuery(event.target.value)}/>
              </label>
              <label>Request status
                <select value={status} onChange={event=>setStatus(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="received">Received</option>
                  <option value="reviewing">In review</option>
                  <option value="awaiting_approval">Awaiting approval</option>
                  <option value="in_production">In production</option>
                  <option value="ready_pickup">Ready for pickup</option>
                  <option value="on_hold">On hold</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <p role="status">{filtered.length} of {records.length} verified request threads</p>
            </div>
            <div className="jill-messages__layout">
              <nav className="jill-messages__threads"
                aria-label="Custom Order conversations">
                {records.length===0?<p>No verified requests yet.</p>:
                  filtered.length===0?<p>No matching requests. Clear your filters to see all threads.</p>:
                  filtered.map(item=>
                  <button type="button" key={item.submission_id}
                    className={"jill-messages__thread"+
                      (selected===item.submission_id?" jill-messages__thread--active":"")}
                    onClick={()=>open(item.submission_id)}
                    aria-current={selected===item.submission_id?"true":undefined}>
                    <strong>Request #{requestShortId(item.submission_id)}</strong>
                    <span>{customerStatusLabel(item.customer_status)}</span>
                    <small>Request updated {dateLabel(item.updated_at,{includeTime:true})}</small>
                  </button>)}
              </nav>
              <section className="jill-messages__conversation"
                aria-label="Selected request conversation">
                {!record?<p className="jill-messages__placeholder">
                  Select a request to view its verified customer-visible timeline.
                </p>:<>
                  <div className="jill-messages__conversation-head">
                    <div>
                      <h3>Request #{requestShortId(record.submission_id)}</h3>
                      <p>{customerStatusLabel(record.customer_status)}</p>
                    </div>
                    <div className="jill-messages__conversation-tools">
                      {canRead&&<button type="button"
                        disabled={threadRead.state!=="idle"}
                        onClick={()=>threadRead.load("/app/requests/thread?"+
                          new URLSearchParams({submission_id:record.submission_id}))}>
                        {threadRead.state!=="idle"?"Verifying…":"Refresh conversation"}
                      </button>}
                      <Link to={"/app/requests/"+encodeURIComponent(record.submission_id)}>
                        Open request →
                      </Link>
                    </div>
                  </div>
                  {!canRead?<p role="status">
                    Conversation history is waiting for the secure WORK connection.
                    No messages are assumed missing or delivered.
                  </p>:threadRead.state!=="idle"&&!thread
                    ?<p role="status">Verifying conversation…</p>
                    :!thread?<p role="status">
                      {threadRead.data?.ok===false
                        ?"Conversation could not be verified. Try selecting the request again."
                        :"Select this request again to load the latest verified timeline."}
                    </p>:last===null?<p role="status">
                      {threadSync?.state==="thread_snapshot_stale"
                        ?"The request has a newer revision. Refresh this conversation."
                        :"Conversation could not be verified. No untrusted messages are shown."}
                    </p>:<>
                      {last.last_message?<p className="jill-messages__hint">
                        Latest public message from {last.last_message.author==="customer"?"Customer":"JILL"}
                        {" · "}{dateLabel(last.last_message.occurred_at,{includeTime:true})}
                      </p>:<p className="jill-messages__hint">
                        No public messages yet. Status events aren't customer replies.
                      </p>}
                      <ol className="jill-messages__timeline">
                        {visibleMessages.map(event=>
                          <li key={event.revision}
                            className={event.author==="customer"?"jill-messages__customer":""}>
                            <strong>{event.author==="customer"?"Customer":"JILL"}</strong>
                            <time dateTime={event.occurred_at}>
                              {dateLabel(event.occurred_at,{includeTime:true})}
                            </time>
                            <p>{event.note}</p>
                          </li>)}
                      </ol>
                      <div className="jill-messages__reply">
                        <h3>Reply to customer</h3>
                        <p className="jill-messages__hint">
                          Existing verified Message customer action; no second message writer.
                          Sending must be acknowledged before it is considered saved.
                        </p>
                        <WorkRequestQuickActions key={record.submission_id}
                          record={record} enabled={data.controlsEnabled===true}
                          messageOnly onMessageCommitted={()=>{
                            if(canRead)threadRead.load("/app/requests/thread?"+
                              new URLSearchParams({submission_id:record.submission_id}));
                          }}/>
                      </div>
                    </>}
                </>}
              </section>
            </div>
          </>}
      </main>
    </s-section>
  </s-page>;
}
