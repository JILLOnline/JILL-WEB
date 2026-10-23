import {useEffect,useState} from 'preact/hooks';
import {loadWorkCustomerContactTickets}
 from '../../../../shared/customer-contact-tickets.mjs';

// Source-only My JILL Contact Requests screen. Future certified WORK
// gateway must validate the Shopify Customer session + exact ticket owner.
// Hard OFF until a separately approved account endpoint actually exists.
const reasonLabel={
 existing:'Existing order',shipping:'Shipping / delivery',
 product:'Product question',custom:'Custom order / quote',
 pickup:'Local pickup',business:'Business inquiry',
 website:'Website issue',other:'Other',
};
const statusLabel={
 received:'Received',reviewing:'Under review',
 waiting_customer:'Waiting on you',resolved:'Resolved',
};
export default function ContactRequests({enabled=false,onNavigate}){
 const [state,setState]=useState({status:'not_connected',tickets:[]});
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  setState({status:enabled===true?'loading':'not_connected',tickets:[]});
  const sessionToken=typeof shopify!=='undefined'?shopify.sessionToken:null;
  loadWorkCustomerContactTickets({
   enabled:enabled===true,sessionToken,signal:controller.signal,
  }).then(result=>{
   if(!active)return;
   if(result.state==='ready')
    setState({status:'ready',tickets:result.tickets});
   else setState({status:'not_connected',tickets:[]});
  }).catch(()=>{
   if(active)setState({status:'error',tickets:[]});
  });
  return ()=>{active=false;controller.abort();};
 },[enabled,attempt]);
 return <s-stack direction="block" gap="large">
  <s-section>
   <s-stack direction="block" gap="base">
    <s-heading>Contact Requests</s-heading>
    <s-text color="subdued">
     Your Contact Us inquiries will appear here after we can securely
     verify they belong to this Shopify customer account.
    </s-text>
    {state.status==='not_connected'&&<s-banner tone="info">
      Contact Us history is not connected to My JILL yet.
      Messages sent through the website contact form are not automatically
      linked to an account by email or phone number.
    </s-banner>}
    {state.status==='loading'&&<s-stack direction="inline"
      gap="small-200" alignItems="center">
      <s-spinner size="small"/>
      <s-text>Checking verified contact requests…</s-text>
    </s-stack>}
    {state.status==='error'&&<s-stack direction="block" gap="base">
      <s-banner tone="warning">
       We couldn't verify Contact Requests. No other account's
       information is displayed.
      </s-banner>
      <s-button variant="secondary" onClick={()=>setAttempt(n=>n+1)}>
       Try again
      </s-button>
    </s-stack>}
    {state.status==='ready'&&<>
      {state.tickets.length===0&&<s-banner tone="info">
        No verified Contact Us inquiries are linked to this account.
        Guest inquiries stay private to JILL until ownership is verified.
      </s-banner>}
      {state.tickets.map(ticket=><s-box key={ticket.ticket_id}
       background="base" padding="base" borderRadius="large"
       border="base base solid">
       <s-stack direction="block" gap="small-200">
        <s-heading>{reasonLabel[ticket.reason]}</s-heading>
        <s-text>{statusLabel[ticket.status]}</s-text>
        <s-text color="subdued">{ticket.ticket_id}</s-text>
        <s-text color="subdued">
          Last verified update: {ticket.updated_at}
        </s-text>
        <s-text color="subdued">
         Conversation replies are not connected for Contact Requests.
        </s-text>
       </s-stack>
      </s-box>)}
      <s-button variant="secondary" onClick={()=>setAttempt(n=>n+1)}>
       Refresh verified inquiries
      </s-button>
    </>}
    <s-button variant="secondary" onClick={()=>onNavigate('custom-orders')}>
     View Custom Orders
    </s-button>
   </s-stack>
  </s-section>
 </s-stack>;
}
