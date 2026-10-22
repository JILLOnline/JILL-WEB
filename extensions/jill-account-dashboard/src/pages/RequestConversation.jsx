import {useEffect,useRef,useState} from 'preact/hooks';
import {sendWorkCustomerReply} from '../../../../shared/customer-custom-orders.mjs';

const COPY={
  en:{title:'Conversation with JILL',you:'You',message:'Your message',send:'Send message',
    check:'Check delivery',busy:'Checking…',sent:'Message received by JILL.',
    pending:'Delivery is not confirmed. Your message is saved here; check delivery before sending again.',
    missing:'No delivery receipt found. You can retry this same message.',retry:'Retry same message',
    stale:'New updates are available. Refresh the conversation; your message will stay here.',
    refresh:'Refresh conversation',closed:'This conversation is closed.',
    unavailable:'Replies will be available here when the secure connection is ready.',
    saved:'Unsent draft in this open My JILL session. It has not been delivered.'},
  es:{title:'Conversación con JILL',you:'Tú',message:'Tu mensaje',send:'Enviar mensaje',
    check:'Verificar entrega',busy:'Verificando…',sent:'JILL recibió tu mensaje.',
    pending:'La entrega no está confirmada. Conservamos tu mensaje aquí; verifica la entrega antes de enviarlo de nuevo.',
    missing:'No encontramos confirmación. Puedes volver a enviar este mismo mensaje.',retry:'Reintentar el mismo mensaje',
    stale:'Hay novedades. Actualiza la conversación; tu mensaje se conservará aquí.',
    refresh:'Actualizar conversación',closed:'Esta conversación está cerrada.',
    unavailable:'Podrás responder aquí cuando la conexión segura esté lista.',
    saved:'Borrador sin enviar en esta sesión abierta de My JILL. No se ha entregado.'},
};
export default function RequestConversation({order,onRefresh,draft,onDraftChange,replyEnabled=false}){
  const [language,setLanguage]=useState('en');
  // The composing screen owns this in-memory draft across history reloads.
  // No local storage, contact matching or second durable conversation.
  const {text='',state='idle',operation=null,busy=false,staleRevision=null}=draft;
  const busyRef=useRef(false);
  const copy=COPY[language];
  const pending=['unconfirmed','missing'].includes(state)||busy&&operation!==null;
  const closed=['completed','cancelled'].includes(order.status);
  const enabled=replyEnabled===true&&order.timeline_version===2&&!closed&&order.revision<100;
  const recoverable=order.timeline_version===2&&operation!==null;
  useEffect(()=>{
    if(state==='stale'&&staleRevision!==null&&order.revision>staleRevision)
      onDraftChange({state:'idle',staleRevision:null},{expectedOperationId:operation?.operation_id??null});
  },[order.revision,state,staleRevision]);
  const submit=async(mode)=>{
    if(busyRef.current||busy||mode==='send'&&state==='stale'||
      !(mode==='receipt'?recoverable:enabled))return;
    let command=operation;
    if(!command){
      if(!text.trim())return;
      command={submission_id:order.submission_id,
        operation_id:'jill:customer:reply:'+crypto.randomUUID(),
        expected_revision:order.revision,text:text.trim()};
    }
    busyRef.current=true;
    onDraftChange({operation:command,busy:true,state:'busy'},
      {expectedOperationId:operation?.operation_id??null});
    try{
      await sendWorkCustomerReply({sessionToken:shopify.sessionToken,
        command:{...command,mode}});
      onDraftChange({operation:null,text:'',state:'sent',staleRevision:null,busy:false},
        {expectedOperationId:command.operation_id});
      onRefresh();
    }catch(error){
      if(error.message==='stale_revision'){
        onDraftChange({operation:null,state:'stale',staleRevision:command.expected_revision,busy:false},
          {expectedOperationId:command.operation_id});
      }else onDraftChange({state:error.message==='receipt_not_found'?'missing':'unconfirmed',busy:false},
        {expectedOperationId:command.operation_id});
    }finally{busyRef.current=false;}
  };
  return <s-stack direction="block" gap="base">
    <s-heading>{copy.title}</s-heading>
    <s-select label="Language / Idioma" value={language}
      onChange={event=>setLanguage(event.currentTarget.value)}>
      <s-option value="en">English</s-option><s-option value="es">Español</s-option>
    </s-select>
    {!enabled&&<s-text color="subdued">{closed?copy.closed:copy.unavailable}</s-text>}
    {!enabled&&!recoverable&&Boolean(text.trim())&&
      <s-box padding="base" background="subdued" borderRadius="large">
        <s-stack direction="block" gap="small-100">
          <s-text color="subdued">{copy.saved}</s-text>
          <s-text>{text}</s-text>
        </s-stack>
      </s-box>}
    {(enabled||recoverable)&&<>
      <s-text-area label={copy.message} value={text} maxLength={500} rows={4}
        disabled={busy||pending}
        onInput={event=>onDraftChange({text:event.currentTarget.value,
          state:state==='stale'?'stale':'idle'},
          {expectedOperationId:operation?.operation_id??null})}/>
      {state==='sent'&&<s-banner tone="success">{copy.sent}</s-banner>}
      {['unconfirmed','missing','stale'].includes(state)&&
        <s-banner tone="warning">{state==='stale'?copy.stale:state==='missing'?copy.missing:copy.pending}</s-banner>}
      <s-stack direction="inline" gap="base">
        {pending?<>
          <s-button disabled={busy} onClick={()=>submit('receipt')}>{copy.check}</s-button>
          {state==='missing'&&enabled&&<s-button disabled={busy} onClick={()=>submit('send')}>{copy.retry}</s-button>}
        </>:<s-button variant="primary" disabled={busy||!text.trim()||state==='stale'}
          onClick={()=>submit('send')}>{busy?copy.busy:copy.send}</s-button>}
        <s-button variant="secondary" disabled={busy} onClick={onRefresh}>{copy.refresh}</s-button>
      </s-stack>
    </>}
  </s-stack>;
}
