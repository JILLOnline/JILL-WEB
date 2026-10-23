// WORK HQ — private Contact Us detail. SOURCE ONLY, flag defaults OFF.
import {useRef} from "react";
import {useFetcher,useLoaderData,type LoaderFunctionArgs,type ActionFunctionArgs,Link} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce}
 from "../../../work-admin-auth-once.mjs";
import {readWorkContactTicketDetail}
 from "../../../work-contact-ticket-detail.mjs";
import {handleWorkContactStatusChange}
 from "../../../work-contact-status-change.mjs";
type Detail={ticket_id:string;name:string;email:string;phone:string;
 reason:string;message:string;preferred_contact:string;status:string;
 revision:number;details:Record<string,string>};
type Data={ok:boolean;code:string;detail?:Detail;can_change_status?:boolean};
type UpdateData={ok:boolean;code:string;revision?:number;status?:string};
type StatusOp={ticket_id:string;operation_id:string;expected_revision:number;
 expected_status:string;next_status:string};

export async function loader({request,params,context}:LoaderFunctionArgs){
 const env=context.cloudflare.env;
 return readWorkContactTicketDetail({
  request,ticketId:params.ticketId,
  enabled:env.JILL_WORK_CONTACT_INBOX_ENABLED==="true",
  statusControlsEnabled:env.JILL_WORK_CONTACT_STATUS_ENABLED==="true",
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
