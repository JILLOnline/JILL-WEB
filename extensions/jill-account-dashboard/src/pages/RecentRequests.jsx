import {useEffect,useState} from 'preact/hooks';
import {loadWorkCustomerConversationState}
 from '../../../../shared/customer-custom-orders.mjs';
import {projectMyJillRecentRequests}
 from './myjill-recent-requests.mjs';
import {customOrderShortId,customOrderStatus,customOrderNextStep,customOrderDateTime}
 from './custom-order-presentation.mjs';

// Uses exactly the same signed Shopify Customer Account reader as Custom
// Orders and Messages. No email matching, guest claims or shadow request DB.
export default function RecentRequests({onNavigate}){
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState({status:'loading',recent:[],total:0});
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  setState({status:'loading',recent:[],total:0});
  const sessionToken=typeof shopify!=='undefined'?shopify.sessionToken:null;
  loadWorkCustomerConversationState({sessionToken,signal:controller.signal})
   .then(({orders})=>{
    if(!active)return;
    const projected=projectMyJillRecentRequests(orders);
    setState({status:'ready',...projected});
   })
   .catch(()=>{
    if(active)setState({status:'unavailable',recent:[],total:0});
   });
  return ()=>{active=false;controller.abort();};
 },[attempt]);
 return <s-stack direction="block" gap="base">
  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
   <s-heading>Your recent requests</s-heading>
   {state.status==='ready'&&<s-badge tone="info">
    {state.total} verified {state.total===1?'request':'requests'}
   </s-badge>}
  </s-stack>
  {state.status==='loading'&&
   <s-stack direction="inline" gap="small-200" alignItems="center">
    <s-spinner size="small"/>
    <s-text color="subdued">Checking your signed-in requests…</s-text>
   </s-stack>}
  {state.status==='unavailable'&&
   <s-banner tone="warning">
    Recent requests couldn't be verified. We won't show unconfirmed
    activity from another account.
    <s-button variant="secondary" onClick={()=>setAttempt(x=>x+1)}>
     Try again
    </s-button>
   </s-banner>}
  {state.status==='ready'&&state.total===0&&
   <s-box padding="base" background="subdued" borderRadius="large">
    <s-stack direction="block" gap="small-300">
     <s-heading>Your next celebration starts here</s-heading>
     <s-text color="subdued">
      Once a Custom Order is linked to your signed-in account, its updates
      will appear here. Guest requests stay separate unless securely claimed.
     </s-text>
     <s-button variant="secondary" onClick={()=>onNavigate('custom-orders')}>
      Explore Custom Orders
     </s-button>
    </s-stack>
   </s-box>}
  {state.status==='ready'&&state.recent.map(item=>{
   const status=customOrderStatus(item.status);
   const nextStep=customOrderNextStep(item.status);
   return <s-box key={item.submission_id}
    padding="base" borderRadius="large" background="base"
    border="base base solid">
    <s-stack direction="block" gap="small-300">
     <s-text color="subdued">
      CUSTOM REQUEST · {customOrderShortId(item.submission_id)}
     </s-text>
     <s-text type="strong">{item.title}</s-text>
     <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-badge tone={status.tone}>{status.label}</s-badge>
      <s-text color="subdued">
       Updated {customOrderDateTime(item.updated_at)}
      </s-text>
     </s-stack>
     <s-box padding="small-300" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-100">
       <s-text>{status.detail}</s-text>
       <s-text type="strong">{nextStep.heading}</s-text>
       <s-text color="subdued">{nextStep.text}</s-text>
      </s-stack>
     </s-box>
     <s-stack direction="inline" gap="small-200">
      <s-button variant="primary"
       onClick={()=>onNavigate('custom-orders',{
        submissionId:item.submission_id,
       })}>Track details</s-button>
      <s-button variant="secondary"
       onClick={()=>onNavigate('messages',{
        submissionId:item.submission_id,
       })}>Conversation</s-button>
     </s-stack>
    </s-stack>
   </s-box>;
  })}
  {state.status==='ready'&&state.total>0&&
   <s-stack direction="inline" gap="base">
    <s-button variant="primary" onClick={()=>onNavigate('custom-orders')}>
     View all requests
    </s-button>
    <s-button variant="secondary" onClick={()=>setAttempt(x=>x+1)}>
     Refresh activity
    </s-button>
   </s-stack>}
 </s-stack>;
}
