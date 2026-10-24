import {useEffect,useRef,useState} from 'preact/hooks';
import {loadOwnedContactConversationV2,postOwnedContactReply}
 from '../../../../shared/customer-contact-conversation-v2.mjs';

// Future My JILL Contact reply composer. Hard OFF until Contact claims,
// the private WORK gateway, V2 schema, and exact account acceptance pass.
// Draft and uncertain operation live ONLY in the My JILL hub's in-memory,
// signed-ticket-scoped ledger. They survive section navigation, never
// browser storage. No inferred email, push delivery or read receipts.
export default function ContactConversationV2({
 ticketId,enabled=false,draft={},onDraftChange=()=>{},
}){
 const [opened,setOpened]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState({ticketId:null,status:'closed',thread:null});
 const [busy,setBusy]=useState(false);
 const busyRef=useRef(false);
 const liveTicket=useRef(ticketId);
 liveTicket.current=ticketId;
 const text=typeof draft.text==='string'?draft.text:'';
 const activePending=draft.operation?.ticketId===ticketId?draft.operation:null;
 const feedback=draft.state??'idle';

 useEffect(()=>{
  setOpened(false);
  setState({ticketId:null,status:'closed',thread:null});
 },[ticketId,enabled]);
 useEffect(()=>()=>{
  // Old asynchronous results must not render on an unmounted account screen.
  liveTicket.current=null;
 },[]);
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
   if(active&&liveTicket.current===ticketId)
    setState({ticketId,status:'error',thread:null});
  });
  return ()=>{active=false;controller.abort();};
 },[ticketId,enabled,opened,attempt]);

 const thread=state.ticketId===ticketId&&state.status==='ready'
  ?state.thread:null;
 const canWrite=enabled===true&&opened&&thread?.reply_enabled===true;
 const refresh=()=>setAttempt(n=>n+1);
 const checkReadback=async(command)=>{
  const sessionToken=typeof shopify!=='undefined'?shopify.sessionToken:null;
  // A fresh signed account read is independent of the POST acknowledgment.
  const latest=await loadOwnedContactConversationV2({
   enabled:true,sessionToken,ticketId,
  });
  if(liveTicket.current!==ticketId)return;
  setState({ticketId,status:'ready',thread:latest});
  // The hub ledger performs the final ticket + operation ID + exact public
  // author/sequence/text check. An unverified readback CANNOT clear text.
  onDraftChange({text:'',operation:null,state:'confirmed',busy:false},{
   expectedOperationId:command.operationId,verifiedThread:latest,
  });
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
  // Establish the immutable receipt BEFORE the network call. If this
  // component is unmounted, only the hub ledger can retain or clear it.
  onDraftChange({
   text:command.message,operation:command,state:'busy',busy:true,
  },{expectedOperationId:activePending?.operationId??null});
  try{
   if(!onlyVerify){
    try{
     const receipt=await postOwnedContactReply({
      enabled:true,
      sessionToken:typeof shopify!=='undefined'?shopify.sessionToken:null,
      ticketId,operationId:command.operationId,
      expectedReplySequence:command.expectedReplySequence,
      message:command.message,
     });
     // The exact operation-specific POST ACK is mandatory, in addition
     // to the independent readback. A concurrent identical-text reply
     // from another tab cannot confirm this operation.
     onDraftChange({acknowledgedSequence:receipt.sequence},{
      expectedOperationId:command.operationId,serverReceipt:receipt,
     });
    }catch{
     // A timeout can mean the original operation succeeded. NEVER
     // generate a new ID automatically or erase the pending text.
    }
   }
   await checkReadback(command);
  }catch{
   if(liveTicket.current===ticketId)
    setState({ticketId,status:'error',thread:null});
  }finally{
   onDraftChange({state:'unconfirmed',busy:false},{
    expectedOperationId:command.operationId,
   });
   busyRef.current=false;
   if(liveTicket.current===ticketId)setBusy(false);
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
   {(thread.reply_enabled||activePending||text)&&
    <s-stack direction="block" gap="small-300">
     <s-text-area label="Your reply to JILL" rows={4}
      maxLength={500} value={text}
      disabled={busy||activePending!==null||!thread.reply_enabled}
      onInput={event=>onDraftChange({
       text:event.currentTarget.value,state:'idle',busy:false,
      },{expectedOperationId:null})}/>
     {feedback==='unconfirmed'&&activePending&&
      <s-banner tone="warning">
       The reply has not been confirmed using both its save receipt
       and the signed conversation history. Your text stays here
       when navigating My JILL. If the receipt was lost, retry the
       SAME reply safely; do not create another message.
      </s-banner>}
     {feedback==='confirmed'&&
      <s-banner tone="success">
       Your reply appears in the verified conversation.
       This is not an email or read receipt.
      </s-banner>}
     <s-stack direction="inline" gap="small-200">
      {activePending?<>
       {draft.acknowledgedSequence===activePending.expectedReplySequence+1&&
        <s-button variant="primary" disabled={busy}
         onClick={()=>send(true)}>
         {busy?'Checking…':'Check saved reply'}
        </s-button>}
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
