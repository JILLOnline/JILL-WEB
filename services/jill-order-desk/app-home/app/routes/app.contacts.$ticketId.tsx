// WORK HQ — private Contact Us detail. SOURCE ONLY, flag defaults OFF.
import {useLoaderData,type LoaderFunctionArgs,Link} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce}
 from "../../../work-admin-auth-once.mjs";
import {readWorkContactTicketDetail}
 from "../../../work-contact-ticket-detail.mjs";
type Detail={ticket_id:string;name:string;email:string;phone:string;
 reason:string;message:string;preferred_contact:string;status:string;
 revision:number;details:Record<string,string>};
type Data={ok:boolean;code:string;detail?:Detail};

export async function loader({request,params,context}:LoaderFunctionArgs){
 const env=context.cloudflare.env;
 return readWorkContactTicketDetail({
  request,ticketId:params.ticketId,
  enabled:env.JILL_WORK_CONTACT_INBOX_ENABLED==="true",
  db:env.JILL_ORDER_DESK_WORK_DB,
  authenticate:{admin:()=>authenticateWorkAdminOnce({
   scope:context.cloudflare,
   authenticate:()=>workShopify(env).authenticate.admin(request),
  })},
 });
}
export default function ContactTicketDetail(){
 const data=useLoaderData<typeof loader>() as Data;
 const ticket=data.ok===true&&data.code==="ready"?data.detail:null;
 return <s-page heading="JILL HQ — Contact Us detail" inlineSize="large">
  <s-section>
   <Link to="/app/contacts">← Back to Contact Us inbox</Link>
   {!ticket?<p role="status">
      This private Contact Us ticket is unavailable or not authorized.
      No contact details are displayed.
    </p>:<main aria-label="Owner verified Contact Us message">
      <h2>Ticket {ticket.ticket_id}</h2>
      <p>Reason: {ticket.reason} · Status: {ticket.status}</p>
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
