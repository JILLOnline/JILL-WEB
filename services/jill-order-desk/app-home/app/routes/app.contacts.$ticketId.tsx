// WORK HQ — private Contact Us detail. SOURCE ONLY, flag defaults OFF.
import {useEffect,useRef,useState} from "react";
import {useFetcher,useLoaderData,useRevalidator,type LoaderFunctionArgs,type ActionFunctionArgs,Link} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce}
 from "../../../work-admin-auth-once.mjs";
import {readWorkContactTicketDetail}
 from "../../../work-contact-ticket-detail.mjs";
import {handleWorkContactStatusChange}
 from "../../../work-contact-status-change.mjs";
import {verifyWorkContactMessageReadback}
 from "../../../work-contact-message-readback-policy.mjs";
type Detail={ticket_id:string;name:string;email:string;phone:string;
 reason:string;message:string;preferred_contact:string;status:string;
 revision:number;details:Record<string,string>};
type PublicMessage={sequence:number;author:string;message:string;created_at:string};
type Data={ok:boolean;code:string;detail?:Detail;can_change_status?:boolean;
 can_post_message?:boolean;messages?:PublicMessage[]};
type UpdateData={ok:boolean;code:string;revision?:number;status?:string;
 ticket_id?:string;sequence?:number;kind?:string};
type StatusOp={ticket_id:string;operation_id:string;expected_revision:number;
 expected_status:string;next_status:string};

export async function loader({request,params,context}:LoaderFunctionArgs){
 const env=context.cloudflare.env;
 return readWorkContactTicketDetail({
  request,ticketId:params.ticketId,
  enabled:env.JILL_WORK_CONTACT_INBOX_ENABLED==="true",
  statusControlsEnabled:env.JILL_WORK_CONTACT_STATUS_ENABLED==="true",
  messageControlsEnabled:env.JILL_WORK_CONTACT_MESSAGES_ENABLED==="true",
  db:env.JILL_ORDER_DESK_WORK_DB,
  authenticate:{admin:()=>authenticateWorkAdminOnce({
   scope:context.cloudflare,
   authenticate:()=>workShopify(env).authenticate.admin(request),
  })},
 });
}
export async function action({request,context}:ActionFunctionArgs){
 const env=context.cloudflare.env;
 return handleWorkContactStatusChange({
  request,enabled:env.JILL_WORK_CONTACT_STATUS_ENABLED==="true"&&
    env.JILL_WORK_CONTACT_INBOX_ENABLED==="true",
  db:env.JILL_ORDER_DESK_WORK_DB,
  authenticate:{admin:()=>authenticateWorkAdminOnce({
   scope:context.cloudflare,
   authenticate:()=>workShopify(env).authenticate.admin(request),
  })},
 });
}
const NEXT:Record<string,string[]>={
 received:["reviewing","waiting_customer","resolved"],
 reviewing:["waiting_customer","resolved"],
 waiting_customer:["reviewing","resolved"],
 resolved:["reviewing"],
};
const LABEL:Record<string,string>={
 reviewing:"Under review",waiting_customer:"Waiting for customer",
 resolved:"Resolved",
};
export default function ContactTicketDetail(){
 const data=useLoaderData<typeof loader>() as Data;
 const ticket=data.ok===true&&data.code==="ready"?data.detail:null;
 const fetcher=useFetcher<UpdateData>();
 const messageFetcher=useFetcher<UpdateData>();
 const revalidator=useRevalidator();
 const [messageDraft,setMessageDraft]=useState("");
 const messageOp=useRef<{operation_id:string;message:string}|null>(null);
 const processedAck=useRef<string|null>(null);
 type Receipt={ticketId:string;operation_id:string;message:string;
  sequence:number;code:string};
 const [pendingReceipt,setPendingReceipt]=useState<Receipt|null>(null);
 const [readbackWasLoading,setReadbackWasLoading]=useState(false);
 const [confirmedReceipt,setConfirmedReceipt]=useState<number|null>(null);
 // A D1 handler ACK is not enough to discard unsaved merchant text.
 // First request a separate authenticated Owner detail revalidation.
 useEffect(()=>{
  const op=messageOp.current,ack=messageFetcher.data;
  if(!ticket||!op||messageFetcher.state!=="idle"||!ack||
     ack.ok!==true||ack.ticket_id!==ticket.ticket_id||
     !["persisted_for_customer_account","already_persisted"].includes(ack.code)||
     typeof ack.sequence!=="number"||
     !Number.isSafeInteger(ack.sequence)||ack.sequence<1||
     processedAck.current===op.operation_id)return;
  processedAck.current=op.operation_id;
  setReadbackWasLoading(false);
  setPendingReceipt({ticketId:ticket.ticket_id,
   operation_id:op.operation_id,message:op.message,
   sequence:ack.sequence,code:ack.code});
  revalidator.revalidate();
 },[messageFetcher.state,messageFetcher.data,ticket?.ticket_id,revalidator.revalidate]);
 useEffect(()=>{
  if(pendingReceipt&&revalidator.state==="loading")
   setReadbackWasLoading(true);
 },[pendingReceipt,revalidator.state]);
 useEffect(()=>{
  if(!ticket||!pendingReceipt||!readbackWasLoading||
     revalidator.state!=="idle"||pendingReceipt.ticketId!==ticket.ticket_id)
   return;
  const verdict=verifyWorkContactMessageReadback({
   ticketId:ticket.ticket_id,
   command:{operation_id:pendingReceipt.operation_id,
    message:pendingReceipt.message},
   ack:{ok:true,kind:"contact",code:pendingReceipt.code,
    ticket_id:pendingReceipt.ticketId,sequence:pendingReceipt.sequence},
   refreshedThread:{ticket_id:ticket.ticket_id,
    messages:data.messages},
  });
  if(verdict.state!=="verified_public_thread_readback")return;
  // Only a matching refreshed public thread authorizes clearing the editor.
  if(messageOp.current?.operation_id!==pendingReceipt.operation_id)return;
  messageOp.current=null;
  setMessageDraft("");
  setConfirmedReceipt(pendingReceipt.sequence);
  setPendingReceipt(null);
  setReadbackWasLoading(false);
 },[ticket?.ticket_id,data.messages,pendingReceipt,
  readbackWasLoading,revalidator.state]);
 const pending=useRef<StatusOp|null>(null);
 const busy=fetcher.state!=="idle";
 const sendStatus=(next:string)=>{
  if(!ticket||data.can_change_status!==true||busy)return;
  const current=pending.current;
  if(current&&(current.expected_revision!==ticket.revision||
    current.next_status!==next))return;
  const op:StatusOp=current||{
   ticket_id:ticket.ticket_id,
   operation_id:"jill:work:contact:status:"+crypto.randomUUID(),
   expected_revision:ticket.revision,
   expected_status:ticket.status,
   next_status:next,
  };
  pending.current=op;
  fetcher.submit(op,{method:"post",encType:"application/json"});
 };
 const sendMessage=()=>{
  if(!ticket||data.can_post_message!==true||
    messageFetcher.state!=="idle")return;
  const message=messageDraft.trim();
  if(!message||message.length>1000)return;
  // An uncertain delivery is retried with the SAME payload and receipt ID.
  if(messageOp.current&&messageOp.current.message!==message)return;
  const op=messageOp.current||{
   operation_id:"jill:work:contact:msg:"+crypto.randomUUID(),message,
  };
  messageOp.current=op;
  setConfirmedReceipt(null);
  messageFetcher.submit({
   ticket_id:ticket.ticket_id,operation_id:op.operation_id,
   message:op.message,
  },{method:"post",encType:"application/json",
   action:"/app/contacts/"+encodeURIComponent(ticket.ticket_id)+"/message"});
 };
 if(ticket&&pending.current&&ticket.revision>pending.current.expected_revision)
  pending.current=null;
 return <s-page heading="JILL HQ — Contact Us detail" inlineSize="large">
  <s-section>
   <Link to="/app/contacts">← Back to Contact Us inbox</Link>
   {!ticket?<p role="status">
      This private Contact Us ticket is unavailable or not authorized.
      No contact details are displayed.
    </p>:<main aria-label="Owner verified Contact Us message">
      <h2>Ticket {ticket.ticket_id}</h2>
      <p>Reason: {ticket.reason} · Status: {ticket.status}</p>
      {data.can_change_status===true&&
       <section aria-label="Update verified contact ticket status">
        <h3>Update status</h3>
        <p>These updates change ticket tracking only. They do not send
          messages, create Shopify orders or confirm delivery.</p>
        {NEXT[ticket.status]?.map(next=>
         <button type="button" key={next} disabled={busy||
           Boolean(pending.current&&pending.current.next_status!==next)}
           onClick={()=>sendStatus(next)}>
           {busy?"Saving…":LABEL[next]}
         </button>)}
        {fetcher.data?.ok===true&&
         <p role="status">Status update verified. Refresh to view the latest revision.</p>}
        {fetcher.data&&fetcher.data.ok!==true&&
         <p role="alert">The update is unconfirmed or stale. Retry the same
          status action or refresh; no customer message was sent.</p>}
       </section>}
      <section aria-label="Contact Us customer conversation">
       <h3>Messages visible in My JILL</h3>
       {!data.can_post_message&&<p>Messages are not available until
        this ticket is securely linked to a Shopify customer account
        and the WORK messaging feature is approved.</p>}
       {data.can_post_message===true&&<>
        {(data.messages||[]).length===0?<p>No verified customer-visible
         messages have been recorded.</p>:<ol>
         {(data.messages||[]).map(item=><li key={item.sequence}>
          <strong>JILL</strong> — {item.message}
          <small> {new Date(item.created_at).toLocaleString()}</small>
         </li>)}
        </ol>}
        <label htmlFor="work-contact-public-message">Message for customer</label>
        <textarea id="work-contact-public-message" value={messageDraft}
          maxLength={1000} rows={4} disabled={messageFetcher.state!=="idle"||
           pendingReceipt!==null}
          onChange={event=>setMessageDraft(event.currentTarget.value)}/>
        <button type="button" disabled={messageFetcher.state!=="idle"||
         pendingReceipt!==null||!messageDraft.trim()||Boolean(messageOp.current&&
         messageOp.current.message!==messageDraft.trim())}
         onClick={sendMessage}>Save message to My JILL thread</button>
        {pendingReceipt&&<div role="status">
         <p>Message save acknowledged. Verifying the exact message in a
          refreshed Owner-approved public thread before clearing the editor.
          This does not confirm email delivery or customer reading.</p>
         <button type="button" disabled={revalidator.state!=="idle"}
          onClick={()=>{setReadbackWasLoading(false);revalidator.revalidate();}}>
          {revalidator.state==="idle"?"Verify saved message":"Verifying…"}
         </button>
        </div>}
        {confirmedReceipt!==null&&
         <p role="status">Message #{confirmedReceipt} confirmed in a fresh
          verified customer-visible Contact thread. No email, push notification
          or customer read receipt has been verified.</p>}
        {messageFetcher.data&&messageFetcher.data.ok!==true&&
         <p role="alert">Message save unconfirmed. Retry the same text;
          no customer notification is confirmed.</p>}
       </>}
      </section>
      <h3>Contact</h3>
      <p>{ticket.name}</p>
      <p>Email: {ticket.email}</p>
      <p>Phone: {ticket.phone||"Not provided"}</p>
      <p>Preferred contact: {ticket.preferred_contact}</p>
      <h3>Customer message</h3>
      <p>{ticket.message}</p>
      <h3>Request details</h3>
      <dl>{Object.entries(ticket.details)
       .filter(([,value])=>value!=="").map(([name,value])=>
        <div key={name}><dt>{name.replaceAll("_"," ")}</dt>
          <dd>{value}</dd></div>)}</dl>
      <p>Customer identity and reply availability are not yet verified
       for this contact ticket. Shopify order numbers are references only.</p>
     </main>}
  </s-section>
 </s-page>;
}
