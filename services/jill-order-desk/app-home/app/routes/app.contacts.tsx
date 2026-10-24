// JILL HQ WORK — isolated Contact Us inbox candidate. SOURCE ONLY.
// The WORK feature flag is OFF in all currently released manifests; no D1
// migration, Shopify-native form rerouting or My JILL contact read is live.
import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce}
 from "../../../work-admin-auth-once.mjs";
import {readWorkContactTicketInbox}
 from "../../../work-contact-ticket-inbox.mjs";

type ContactRow={
 kind:"contact";ticket_id:string;reason:string;status:string;
 revision:number;created_at_ms:number;updated_at_ms:number;
 customer_reply_enabled:false;customer_owner_verified:false;
};
type Data={state:string;code:string;kind:"contact";
 records?:ContactRow[];has_more?:boolean};

export async function loader({request,context}:LoaderFunctionArgs){
 const env=context.cloudflare.env;
 return readWorkContactTicketInbox({
  request,enabled:env.JILL_WORK_CONTACT_INBOX_ENABLED==="true",
  db:env.JILL_ORDER_DESK_WORK_DB,
  authenticate:{admin:()=>authenticateWorkAdminOnce({
   scope:context.cloudflare,
   authenticate:()=>workShopify(env).authenticate.admin(request),
  })},
 });
}
export default function WorkContactRequests(){
 const data=useLoaderData<typeof loader>() as Data;
 const ready=data.state==="verified"&&data.code==="ready";
 const rows=ready?data.records||[]:[];
 return <s-page heading="JILL HQ — WORK / Contact Us" inlineSize="large">
  <s-section>
   <main aria-label="Verified Contact Us tickets">
    <h2>Contact Us inbox</h2>
    <p>Customer questions and Custom Order Requests use separate verified
       source records until the unified ticket bridge is certified.</p>
    {!ready?<p role="status">
       Contact Us ticket source is not connected or not authorized.
       Shopify's existing Contact Us form remains available;
       no ticket history or customer messages are assumed missing.
     </p>:<>
       <p role="status">
        {rows.length} verified Contact Us {rows.length===1?"ticket":"tickets"}
        {data.has_more?" · Additional records require paging":""}
       </p>
       {rows.length===0?<p>No verified tickets in the WORK source.</p>:
        <table>
         <thead><tr>
          <th scope="col">Ticket</th>
          <th scope="col">Reason</th>
          <th scope="col">Status</th>
          <th scope="col">Last update</th>
         </tr></thead>
         <tbody>{rows.map(item=><tr key={item.ticket_id}>
          <td><Link to={"/app/contacts/"+encodeURIComponent(item.ticket_id)}>{item.ticket_id}</Link></td>
          <td>{item.reason}</td>
          <td>{item.status}</td>
          <td>{new Date(item.updated_at_ms).toLocaleString()}</td>
         </tr>)}</tbody>
        </table>}
       <p>Replies, unread indicators and customer account ownership are
          not yet authorized for Contact Us tickets.</p>
     </>}
   </main>
  </s-section>
 </s-page>;
}
