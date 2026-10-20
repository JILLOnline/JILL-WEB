import {useFetcher} from "react-router";
import {dateLabel,customerStatusLabel} from "../../../inbox-display.mjs";

type Thread={submission_id:string;updated_at:string;revision:number;
  timeline:{revision:number;kind:string;author:string;status:string;note:string;occurred_at:string}[]};
export function WorkRequestConversation({submissionId}:{submissionId:string}){
  const fetcher=useFetcher<{ok:boolean;thread?:Thread;code?:string}>();
  const busy=fetcher.state!=="idle";
  const thread=fetcher.data?.ok&&fetcher.data.thread?.submission_id===submissionId?
    fetcher.data.thread:null;
  const refresh=()=>fetcher.load("/app/requests/thread?"+
    new URLSearchParams({submission_id:submissionId}));
  return <section className="jill-request__panel jill-request__full" aria-label="Customer conversation">
    <div className="jill-request__panel-head">
      <h3>Customer conversation</h3>
      <button type="button" className="jill-inbox__back" disabled={busy} onClick={refresh}>
        {busy?"Loading conversation…":thread?"Refresh conversation":"View conversation"}
      </button>
    </div>
    {!thread&&fetcher.data&&!fetcher.data.ok&&<p className="jill-request__muted" role="status">
      The conversation could not be verified. Try again after the connection is ready.
    </p>}
    {thread&&<>
      <p className="jill-request__muted">Last public update {dateLabel(thread.updated_at,{includeTime:true})}</p>
      <ol className="jill-request__messages">
        {thread.timeline.map(event=><li key={event.revision}>
          <strong>{event.author==="customer"?"Customer":event.author==="jill"?"JILL":customerStatusLabel(event.status)}</strong>
          <time dateTime={event.occurred_at}>{dateLabel(event.occurred_at,{includeTime:true})}</time>
          {event.note&&<p>{event.note}</p>}
        </li>)}
      </ol>
      <p className="jill-request__muted">Use “Message customer” in Request management to reply.</p>
    </>}
  </section>;
}
