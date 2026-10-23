import {useEffect,useRef,useState} from 'preact/hooks';
import {loadWorkCustomerContactTickets}
 from '../../../../shared/customer-contact-tickets.mjs';
import {claimWorkCustomerContactTicket}
 from '../../../../shared/customer-contact-claim.mjs';

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
 const [claimId,setClaimId]=useState('');
 const [claimCode,setClaimCode]=useState('');
 const [claimState,setClaimState]=useState('idle');
 const [ticketFilter,setTicketFilter]=useState('all');
 const claiming=useRef(false);
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
 const filteredTickets=state.tickets.filter(ticket=>
  ticketFilter==='all'||(ticketFilter==='open'
    ?ticket.status!=='resolved':ticket.status==='resolved'));
 const linkClaim=async()=>{
  if(enabled!==true||state.status!=='ready'||claiming.current)return;
  claiming.current=true;
  setClaimState('checking');
  try{
   await claimWorkCustomerContactTicket({
    enabled:true,sessionToken:shopify.sessionToken,
    ticketId:claimId.trim(),claimCode:claimCode.trim(),
   });
   // Once verified, remove the private proof from the UI memory.
   setClaimCode('');setClaimId('');
   setClaimState('claimed');
   setAttempt(n=>n+1);
  }catch(error){
   setClaimState(error.message==='contact_claim_unverified'
    ?'unverified':'unconfirmed');
  }finally{claiming.current=false;}
 };
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
    {state.status==='ready'&&enabled===true&&
     <s-box padding="base" background="subdued" borderRadius="large">
      <s-stack direction="block" gap="small-200">
       <s-heading>Link a Contact Us ticket to My JILL</s-heading>
       <s-text color="subdued">
        Enter the ticket ID and private claim code you saved from the
        website form. Your Shopify sign-in verifies who will own it.
        Email or phone details alone cannot link tickets.
       </s-text>
       <s-text-field label="Contact ticket ID" value={claimId}
         disabled={claimState==='checking'}
         onInput={event=>setClaimId(event.currentTarget.value)} />
       <s-text-field label="Private claim code" type="password"
         value={claimCode} disabled={claimState==='checking'}
         onInput={event=>setClaimCode(event.currentTarget.value)} />
       {claimState==='claimed'&&<s-banner tone="success">
         Ticket linked to your verified account. Refreshing your history.
       </s-banner>}
       {['unconfirmed','unverified'].includes(claimState)&&
        <s-banner tone="warning">
         {claimState==='unverified'
           ?"This ticket could not be linked with that code. No account history was changed."
           :"We couldn't confirm the claim. Retry with the same ticket and code; do not create another request."}
        </s-banner>}
       <s-button variant="primary"
         disabled={claimState==='checking'||!claimId.trim()||!claimCode.trim()}
         onClick={linkClaim}>
         {claimState==='checking'?'Verifying…':'Link verified ticket'}
       </s-button>
      </s-stack>
     </s-box>}
    {state.status==='ready'&&<>
      {state.tickets.length>0&&
       <s-select label="Filter verified Contact Requests"
         value={ticketFilter}
         onChange={event=>setTicketFilter(event.currentTarget.value)}>
         <s-option value="all">All requests ({state.tickets.length})</s-option>
         <s-option value="open">Active ({state.tickets.filter(t=>t.status!=='resolved').length})</s-option>
         <s-option value="resolved">Resolved ({state.tickets.filter(t=>t.status==='resolved').length})</s-option>
       </s-select>}
      {state.tickets.length===0&&<s-banner tone="info">
        No verified Contact Us inquiries are linked to this account.
        Guest inquiries stay private to JILL until ownership is verified.
      </s-banner>}
      {state.tickets.length>0&&filteredTickets.length===0&&
       <s-text color="subdued">No verified tickets match this filter.</s-text>}
      {filteredTickets.map(ticket=><s-box key={ticket.ticket_id}
       background="base" padding="base" borderRadius="large"
       border="base base solid">
       <s-stack direction="block" gap="small-200">
        <s-heading>{reasonLabel[ticket.reason]}</s-heading>
        <s-badge>{statusLabel[ticket.status]}</s-badge>
        <s-text color="subdued">Tracking revision {ticket.revision}</s-text>
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
