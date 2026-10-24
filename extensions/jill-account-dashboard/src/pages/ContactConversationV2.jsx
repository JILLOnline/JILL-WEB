import {useEffect,useRef,useState} from 'preact/hooks';
import {loadOwnedContactConversationV2,postOwnedContactReply}
 from '../../../../shared/customer-contact-conversation-v2.mjs';

// Future My JILL Contact reply composer. Hard OFF until Contact claims,
// the private WORK gateway, V2 schema, and exact account acceptance pass.
// Do not infer email, push delivery, unread counts, or customer read receipts.
export default function ContactConversationV2({ticketId,enabled=false}){
 const [opened,setOpened]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState({ticketId:null,status:'closed',thread:null});
 const [text,setText]=useState('');
 const [pending,setPending]=useState(null);
 const [feedback,setFeedback]=useState('idle');
 const [busy,setBusy]=useState(false);
 const busyRef=useRef(false);
 const liveTicket=useRef(ticketId);
 liveTicket.current=ticketId;
 useEffect(()=>{
  setOpened(false);
  setText('');
  setPending(null);
  setFeedback('idle');
  setState({ticketId:null,status:'closed',thread:null});
 },[ticketId,enabled]);
 useEffect(()=>{
  if(!opened||enabled!==true){
   setState({ticketId,status:'closed',thread:null});
   return;
  }
  let active=true;
  const controller=new AbortController();
  setState({ticketId,status:'loading',thread:null});
  const sessionToken=typeof shopify!=='undefined'?shopify.sessionToken:null;
  loadOwnedContactConversationV2({
   enabled:true,sessionToken,ticketId,signal:controller.signal,
  }).then(thread=>{
   if(active&&liveTicket.current===ticketId)
    setState({ticketId,status:'ready',thread});
  }).catch(()=>{
   if(active&&liveTicket.current===ticketId){
    setState({ticketId,status:'error',thread:null});
    setFeedback(current=>current==='checking'?'unconfirmed':current);
   }
  });
  return ()=>{active=false;controller.abort();};
 },[ticketId,enabled,opened,attempt]);

 const thread=state.ticketId===ticketId&&state.status==='ready'
  ?state.thread:null;
 const activePending=pending?.ticketId===ticketId?pending:null;
 const canWrite=enabled===true&&opened&&thread?.reply_enabled===true;
 const refresh=()=>setAttempt(n=>n+1);
 const checkReadback=async(command)=>{
  const sessionToken=typeof shopify!=='undefined'?shopify.sessionToken:null;
  // A fresh JWT and protected read is required, independently of POST ACK.
  const latest=await loadOwnedContactConversationV2({
   enabled:true,sessionToken,ticketId,
  });
  if(liveTicket.current!==ticketId)return;
  setState({ticketId,status:'ready',thread:latest});
  const matches=latest.messages.filter(item=>
   item.author==='customer'&&
   item.source_sequence===command.expectedReplySequence+1&&
   item.text===command.message);
  if(matches.length!==1){
   setFeedback('unconfirmed');
   return;
  }
  setPending(null);
  setText('');
  setFeedback('confirmed');
 };
 const send=async(onlyVerify=false)=>{
  if(enabled!==true||!opened||busyRef.current||
   (onlyVerify?!activePending:(!canWrite&&!activePending)))return;
  let command=activePending;
  if(!command){
   const message=text.trim();
   if(!message||message.length>500||!canWrite)return;
   command={
    ticketId,operationId:'jill:customer:contact:reply:'+crypto.randomUUID(),
    expectedReplySequence:thread.next_customer_reply_sequence,
    message,
   };
  }
  busyRef.current=true;
  setBusy(true);
  setPending(command);
  setFeedback('checking');
  try{
   if(!onlyVerify){
    // On an uncertain POST, preserve this SAME operation for retry.
    // An accepted ACK still requires an independent signed readback.
    try{
     await postOwnedContactReply({
      enabled:true,
      sessionToken:typeof shopify!=='undefined'?shopify.sessionToken:null,
      ticketId,operationId:command.operationId,
      expectedReplySequence:command.expectedReplySequence,
      message:command.message,
     });
    }catch{
     // A timeout might mean the reply WAS saved; verify before retry.
    }
   }
   await checkReadback(command);
  }catch{
   if(liveTicket.current===ticketId){
    setState({ticketId,status:'error',thread:null});
    setFeedback('unconfirmed');
   }
  }finally{
   busyRef.current=false;
   setBusy(false);
  }
 };
 if(enabled!==true)return <s-text color="subdued">
  Contact Us customer replies are not connected yet.
 </s-text>;
 return <s-stack direction="block" gap="base">
  <s-button variant="secondary" disabled={busy}
   onClick={()=>setOpened(value=>!value)}>
   {opened?'Hide conversation':'View conversation & replies'}
  </s-button>
  {opened&&state.status==='loading'&&
   <s-stack direction="inline" gap="small-200" alignItems="center">
    <s-spinner size="small"/>
    <s-text>Verifying your private conversation…</s-text>
   </s-stack>}
  {opened&&state.status==='error'&&
   <s-banner tone="warning">
    Your conversation could not be verified. We won't show messages
    from another account.
    <s-button variant="secondary" onClick={refresh}>Try again</s-button>
   </s-banner>}
  {opened&&thread&&<>
   <s-stack direction="block" gap="small-300">
    <s-heading>Conversation with JILL</s-heading>
    {thread.messages.length===0?
     <s-text color="subdued">No verified messages yet.</s-text>:
     thread.messages.map(message=>
      <s-box key={message.author+':'+message.source_sequence}
       padding="base" background="subdued" borderRadius="large">
       <s-stack direction="block" gap="small-100">
        <s-text type="strong">
         {message.author==='customer'?'You':'JILL'}
        </s-text>
        <s-text>{message.text}</s-text>
        <s-text color="subdued">{message.created_at}</s-text>
       </s-stack>
      </s-box>)}
   </s-stack>
   <s-text color="subdued">
    Messages shown here are verified account history. They don't prove
    email delivery, a notification, or whether someone read them.
   </s-text>
   {!thread.reply_enabled&&
    <s-banner tone="info">
     This conversation is closed or full. New replies are unavailable.
    </s-banner>}
   {(thread.reply_enabled||activePending)&&
    <s-stack direction="block" gap="small-300">
     <s-text-area label="Your reply to JILL" rows={4}
      maxLength={500} value={text}
      disabled={busy||activePending!==null}
      onInput={event=>setText(event.currentTarget.value)}/>
     {feedback==='unconfirmed'&&
      <s-banner tone="warning">
       We couldn't confirm your reply in a fresh account read.
       Your text is still here. Check before trying the same reply again.
      </s-banner>}
     {feedback==='confirmed'&&
      <s-banner tone="success">
       Your reply appears in the verified conversation.
       This is not an email or read receipt.
      </s-banner>}
     <s-stack direction="inline" gap="small-200">
      {activePending?<>
       <s-button variant="primary" disabled={busy}
        onClick={()=>send(true)}>
        {busy?'Checking…':'Check saved reply'}
       </s-button>
       {thread.reply_enabled&&
        <s-button variant="secondary" disabled={busy}
         onClick={()=>send(false)}>Retry same reply</s-button>}
      </>:<s-button variant="primary"
       disabled={busy||!text.trim()||!thread.reply_enabled}
       onClick={()=>send(false)}>
       {busy?'Checking…':'Send reply'}
      </s-button>}
      <s-button variant="secondary" disabled={busy}
       onClick={refresh}>Refresh</s-button>
     </s-stack>
    </s-stack>}
  </>}
  {opened&&!thread&&activePending&&
   <s-banner tone="warning">
    A reply is awaiting verification. Do not start another reply until
    the private conversation can be loaded again.
    <s-button variant="secondary" disabled={busy}
     onClick={()=>send(true)}>Check saved reply</s-button>
   </s-banner>}
 </s-stack>;
}
