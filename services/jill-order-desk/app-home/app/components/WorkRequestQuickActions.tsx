import {useEffect,useRef,useState} from "react";
import {useFetcher,useRevalidator} from "react-router";
import {
  WORK_INTERNAL_STAGES,WORK_STATUS_TRANSITIONS,
} from "../../../merchant-command-contract.mjs";
import {
  customerStatusLabel,internalStatusLabel,
} from "../../../inbox-display.mjs";

type RequestRecord={
  submission_id:string;revision:number;customer_status:string;internal_status:string;
};
type Result={ok:boolean;code:string;revision?:number;email_status?:string};
const STATUS_OPTIONS=WORK_STATUS_TRANSITIONS as Record<string,string[]>;
const INTERNAL=WORK_INTERNAL_STAGES as string[];

export function WorkRequestQuickActions({
  record,enabled,compact=false,
}:{record:RequestRecord;enabled:boolean;compact?:boolean}){
  const fetcher=useFetcher<Result>();
  const revalidator=useRevalidator();
  const lastRefresh=useRef<string|null>(null);
  const [status,setStatus]=useState(record.customer_status);
  const [stage,setStage]=useState(record.internal_status);
  const [publicNote,setPublicNote]=useState("");
  const [internalNote,setInternalNote]=useState("");
  const [message,setMessage]=useState("");
  const [handoff,setHandoff]=useState("");
  const [panel,setPanel]=useState<"status"|"message"|null>(null);
  const operation=useRef<string|null>(null);
  const pending=fetcher.state!=="idle";
  const completed=fetcher.data?.ok===true;
  const confirmedRevision=completed?fetcher.data?.revision:undefined;
  const awaitingRefresh=typeof confirmedRevision==="number" &&
    record.revision<confirmedRevision;
  useEffect(()=>{
    setStatus(record.customer_status);
    setStage(record.internal_status);
    operation.current=null;
  },[record.revision,record.customer_status,record.internal_status]);
  useEffect(()=>{
    if(fetcher.data?.ok){
      operation.current=null;
      setPublicNote("");setInternalNote("");setMessage("");setHandoff("");
    }
  },[fetcher.data]);
  // Re-load ONLY verified canonical metadata after a confirmed source commit.
  // Other Worker isolates may briefly have a prior 20-second source snapshot.
  // Never show an optimistic status as if Google had committed it.
  useEffect(()=>{
    const id=fetcher.data?.operation_id;
    if(fetcher.state==="idle" && completed && awaitingRefresh &&
       typeof id==="string" && lastRefresh.current!==id) {
      lastRefresh.current=id;
      revalidator.revalidate();
    }
  },[fetcher.state,fetcher.data,completed,awaitingRefresh,revalidator]);

  const submit=(kind:"status"|"message")=>{
    if(!enabled||pending||awaitingRefresh||record.revision>=100)return;
    if(kind==="message" && !message.trim())return;
    if(kind==="status" && record.revision>=100)return;
    if(!operation.current || !operation.current.startsWith("jill:hq:"+kind+":"))
      operation.current="jill:hq:"+kind+":"+crypto.randomUUID();
    const payload=new URLSearchParams({
      kind,submission_id:record.submission_id,
      operation_id:operation.current,
      expected_revision:String(record.revision),
      current_status:record.customer_status,
      customer_status:kind==="message"?record.customer_status:status,
      internal_status:kind==="message"?record.internal_status:stage,
      public_note:kind==="message"?message.trim():publicNote.trim(),
      internal_note:kind==="message"?"":internalNote.trim(),
      handoff_reference:kind==="message"?"":handoff.trim(),
    });
    fetcher.submit(payload,{
      method:"post",action:"/app/requests/command",
      encType:"application/x-www-form-urlencoded",
    });
  };
  const choices=[record.customer_status,...(STATUS_OPTIONS[record.customer_status]||[])];
  const onEdit=()=>{operation.current=null;};
  return <section className={"jill-actions"+(compact?" jill-actions--compact":"")}
    aria-label="Manage request">
    <div className="jill-actions__heading">
      <strong>Quick actions</strong>
      {!enabled&&<span>Pending secure connection</span>}
    </div>
    {!enabled&&<p className="jill-actions__hint">
      Status updates and customer messages are prepared, but the verified
      WORK-only write connection is not enabled yet.
    </p>}
    <div className="jill-actions__tabs">
      <button type="button" onClick={()=>setPanel(panel==="status"?null:"status")}
        aria-expanded={panel==="status"}>Update status</button>
      <button type="button" onClick={()=>setPanel(panel==="message"?null:"message")}
        aria-expanded={panel==="message"}>Message customer</button>
    </div>
    {panel==="status"&&<div className="jill-actions__body">
      <label>Customer status
        <select value={status} disabled={!enabled||pending||awaitingRefresh}
          onChange={e=>{onEdit();setStatus(e.target.value);}}>
          {choices.map(value=><option key={value} value={value}>{customerStatusLabel(value)}</option>)}
        </select>
      </label>
      <label>Internal stage
        <select value={stage} disabled={!enabled||pending||awaitingRefresh}
          onChange={e=>{onEdit();setStage(e.target.value);}}>
          {INTERNAL.map(value=><option key={value} value={value}>{internalStatusLabel(value)}</option>)}
        </select>
      </label>
      <label>Customer-visible status note (optional)
        <textarea value={publicNote} maxLength={500} disabled={!enabled||pending||awaitingRefresh}
          onChange={e=>{onEdit();setPublicNote(e.target.value);}} rows={2}/>
      </label>
      <label>Private production note (optional)
        <textarea value={internalNote} maxLength={2000} disabled={!enabled||pending||awaitingRefresh}
          onChange={e=>{onEdit();setInternalNote(e.target.value);}} rows={2}/>
      </label>
      {status==="completed"&&<label>Handoff reference (required)
        <input value={handoff} maxLength={256} disabled={!enabled||pending||awaitingRefresh}
          onChange={e=>{onEdit();setHandoff(e.target.value);}}/>
      </label>}
      <button className="jill-actions__primary" type="button"
        disabled={!enabled||pending||awaitingRefresh||record.revision>=100||
          (status===record.customer_status && stage===record.internal_status &&
           !publicNote.trim() && !internalNote.trim()) ||
          (status==="completed"&&!handoff.trim())}
        onClick={()=>submit("status")}>
        {pending?"Saving…":"Save verified update"}
      </button>
    </div>}
    {panel==="message"&&<div className="jill-actions__body">
      <label>Message to customer
        <textarea rows={4} maxLength={500} value={message}
          placeholder="Write a warm, clear update about this request…"
          disabled={!enabled||pending||awaitingRefresh}
          onChange={e=>{onEdit();setMessage(e.target.value);}}/>
      </label>
      <p className="jill-actions__hint">
        A verified message appears in My JILL for the request owner.
        Email is queued in the private WORK outbox; it is not considered
        delivered until a sending provider confirms delivery.
      </p>
      <button className="jill-actions__primary" type="button"
        disabled={!enabled||pending||awaitingRefresh||!message.trim()||record.revision>=100}
        onClick={()=>submit("message")}>
        {pending?"Recording…":"Post to My JILL + queue email"}
      </button>
    </div>}
    {fetcher.data && <p className={"jill-actions__feedback"+
      (completed?" jill-actions__feedback--ok":"")} role="status">
      {completed?fetcher.data.email_status==="queued"?
        "Saved in My JILL. Email queued, not yet sent.":
        "Saved in the verified request history.":
        fetcher.data.code==="stale_revision"?
          "Someone updated this request. Refresh before retrying.":
          "Not confirmed. No success is assumed. Retry using the same operation or refresh."}
    </p>}
    {awaitingRefresh&&<div className="jill-actions__refresh" role="status">
      Revision {confirmedRevision} was committed. Waiting for the latest
      verified request snapshot before allowing another edit.
      <button type="button" disabled={revalidator.state!=="idle"}
        onClick={()=>revalidator.revalidate()}>
        {revalidator.state==="idle"?"Refresh latest status":"Refreshing…"}
      </button>
    </div>}
  </section>;
}
