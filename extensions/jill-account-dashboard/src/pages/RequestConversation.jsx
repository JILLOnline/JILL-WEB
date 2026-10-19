import {useRef,useState} from 'preact/hooks';
import {sendWorkCustomerReply} from '../../../../shared/customer-custom-orders.mjs';

const COPY={
  en:{title:'Conversation with JILL',you:'You',message:'Your message',send:'Send message',
    check:'Check delivery',busy:'Checking…',sent:'Message received by JILL.',
    pending:'Delivery is not confirmed. Your message is saved here; check delivery before sending again.',
    missing:'No delivery receipt found. You can retry this same message.',retry:'Retry same message',
    stale:'New updates are available. Copy your message before refreshing the conversation.',
    refresh:'Refresh conversation',closed:'This conversation is closed.',
    unavailable:'Replies will be available here when the secure connection is ready.'},
  es:{title:'Conversación con JILL',you:'Tú',message:'Tu mensaje',send:'Enviar mensaje',
    check:'Verificar entrega',busy:'Verificando…',sent:'JILL recibió tu mensaje.',
    pending:'La entrega no está confirmada. Conservamos tu mensaje aquí; verifica la entrega antes de enviarlo de nuevo.',
    missing:'No encontramos confirmación. Puedes volver a enviar este mismo mensaje.',retry:'Reintentar el mismo mensaje',
    stale:'Hay novedades. Copia tu mensaje antes de actualizar la conversación.',
    refresh:'Actualizar conversación',closed:'Esta conversación está cerrada.',
    unavailable:'Podrás responder aquí cuando la conexión segura esté lista.'},
};
export default function RequestConversation({order,onRefresh}){
  const [language,setLanguage]=useState('en');
  const [text,setText]=useState('');
  const [state,setState]=useState('idle');
  const operation=useRef(null),busyRef=useRef(false);
  const copy=COPY[language];
  const pending=['unconfirmed','missing'].includes(state);
  const busy=state==='busy';
  const closed=['completed','cancelled'].includes(order.status);
  const enabled=order.timeline_version===2&&!closed&&order.revision<100;
  const submit=async(mode)=>{
    if(busyRef.current||!enabled)return;
    if(!operation.current){
      if(!text.trim())return;
      operation.current={submission_id:order.submission_id,
        operation_id:'jill:customer:reply:'+crypto.randomUUID(),
        expected_revision:order.revision,text:text.trim()};
    }
    busyRef.current=true;setState('busy');
    try{
      await sendWorkCustomerReply({sessionToken:shopify.sessionToken,
        command:{...operation.current,mode}});
      operation.current=null;setText('');setState('sent');onRefresh();
    }catch(error){
      if(error.message==='stale_revision'){
        operation.current=null;setState('stale');
      }else setState(error.message==='receipt_not_found'?'missing':'unconfirmed');
    }finally{busyRef.current=false;}
  };
  return <s-stack direction="block" gap="base">
    <s-heading>{copy.title}</s-heading>
    <s-select label="Language / Idioma" value={language}
      onChange={event=>setLanguage(event.currentTarget.value)}>
      <s-option value="en">English</s-option><s-option value="es">Español</s-option>
    </s-select>
    {!enabled&&<s-text color="subdued">{closed?copy.closed:copy.unavailable}</s-text>}
    {enabled&&<>
      <s-text-area label={copy.message} value={text} maxLength={500} rows={4}
        disabled={busy||pending}
        onInput={event=>{setText(event.currentTarget.value);setState('idle');}}/>
      {state==='sent'&&<s-banner tone="success">{copy.sent}</s-banner>}
      {['unconfirmed','missing','stale'].includes(state)&&
        <s-banner tone="warning">{state==='stale'?copy.stale:state==='missing'?copy.missing:copy.pending}</s-banner>}
      <s-stack direction="inline" gap="base">
        {pending?<>
          <s-button disabled={busy} onClick={()=>submit('receipt')}>{copy.check}</s-button>
          {state==='missing'&&<s-button disabled={busy} onClick={()=>submit('send')}>{copy.retry}</s-button>}
        </>:<s-button variant="primary" disabled={busy||!text.trim()||state==='stale'}
          onClick={()=>submit('send')}>{busy?copy.busy:copy.send}</s-button>}
        <s-button variant="secondary" disabled={busy} onClick={onRefresh}>{copy.refresh}</s-button>
      </s-stack>
    </>}
  </s-stack>;
}
