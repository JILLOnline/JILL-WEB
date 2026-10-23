import {useEffect,useState} from 'preact/hooks';
import {loadOwnedContactThread} from '../../../../shared/customer-contact-thread.mjs';

// Status and public messages only. Not a composer, delivery receipt, email,
// notification, Shopify Order, private contact form or staff action.
export default function ContactThread({ticketId,enabled=false}){
 const [opened,setOpened]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState({status:'closed',messages:[]});
 useEffect(()=>{
  if(!opened||enabled!==true){
   setState({status:'closed',messages:[]});
   return;
  }
  let active=true;
  const controller=new AbortController();
  const sessionToken=typeof shopify!=='undefined'?shopify.sessionToken:null;
  setState({status:'loading',messages:[]});
  loadOwnedContactThread({
   enabled:true,ticketId,sessionToken,signal:controller.signal,
  }).then(result=>{
   if(active)setState({status:result.state,messages:result.messages});
  }).catch(()=>{
   if(active)setState({status:'error',messages:[]});
  });
  return ()=>{active=false;controller.abort();};
 },[ticketId,enabled,opened,attempt]);
 if(enabled!==true)return <s-text color="subdued">
  Verified My JILL conversation history is not connected yet.
 </s-text>;
 return <s-stack direction="block" gap="small-200">
  <s-button variant="secondary" onClick={()=>setOpened(x=>!x)}>
   {opened?'Hide verified conversation':'View verified conversation'}
  </s-button>
  {opened&&state.status==='loading'&&<s-text>Checking your verified conversation…</s-text>}
  {opened&&state.status==='error'&&<>
   <s-banner tone="warning">
    This conversation could not be verified. No other customer's
    messages are displayed.
   </s-banner>
   <s-button variant="secondary" onClick={()=>setAttempt(x=>x+1)}>
    Retry verification
   </s-button>
  </>}
  {opened&&state.status==='ready'&&<>
   {state.messages.length===0?
     <s-text color="subdued">No verified messages recorded yet.</s-text>:
     state.messages.map(message=>
      <s-box key={message.sequence} padding="base" background="subdued"
       borderRadius="large">
       <s-stack direction="block" gap="small-200">
        <s-text fontWeight="bold">JILL</s-text>
        <s-text>{message.text}</s-text>
        <s-text color="subdued">{message.created_at}</s-text>
       </s-stack>
      </s-box>)}
   <s-text color="subdued">
    These are saved account messages, not evidence of an email,
    push notification or read receipt.
   </s-text>
   <s-button variant="secondary" onClick={()=>setAttempt(x=>x+1)}>
    Refresh conversation
   </s-button>
  </>}
 </s-stack>;
}
