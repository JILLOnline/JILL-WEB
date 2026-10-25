import {projectCustomerMessageInbox} from './custom-order-message-inbox.mjs';

// WORK-only My JILL Custom Orders account reader.
// Source of customer identity is Shopify's signed session token ONLY.
// Never send a user-supplied email, customer ID or order ID to the endpoint.
export const WORK_CUSTOM_ORDER_ACCOUNT_URL=
  'https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev/jill-custom-order-account';
const REPLY_URL=new URL('/jill-custom-order-reply',WORK_CUSTOM_ORDER_ACCOUNT_URL).href;

// Kept in memory by the composing screen across failed sends. A fresh token
// is acquired for EACH send or receipt read. No customer identity in input.
export async function sendWorkCustomerReply({sessionToken,command,request=fetch}={}){
  if(typeof sessionToken?.get!=='function')throw Error('session_unavailable');
  const jwt=await sessionToken.get();
  if(typeof jwt!=='string'||jwt.length<32||jwt.length>8192)throw Error('session_unavailable');
  const response=await request(REPLY_URL,{method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},
    body:JSON.stringify(command),signal:AbortSignal.timeout(25000)});
  const data=await response.json();
  if(data?.version!==1||data.operation!=='custom_order.account.reply.result')
    throw Error('reply_unconfirmed');
  if(!response.ok||!data.ok){
    const code=data.error?.code;
    throw Error(['stale_revision','receipt_not_found','request_unavailable',
      'thread_closed','history_full','conversation_not_connected'].includes(code)?code:'reply_unconfirmed');
  }
  if(data.submission_id!==command.submission_id||data.operation_id!==command.operation_id||
    data.revision!==command.expected_revision+1)throw Error('reply_unconfirmed');
  return {operation_id:data.operation_id,revision:data.revision};
}

// This is display-only, after the Worker has already verified JWT owner and
// stripped all private fields. Never allow the customer to choose an owner.
export function readAccountOrderSummary(value) {
  if(value===undefined)return {items:[],date_needed:'',fulfillment:''};
  if(!value||typeof value!=='object'||Array.isArray(value)||
    !Array.isArray(value.items)||value.items.length>20||
    typeof value.date_needed!=='string'||
    (value.date_needed!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(value.date_needed))||
    !['','pickup','shipping'].includes(value.fulfillment))
    throw Error('Invalid Custom Order item summary.');
  return {
    items:value.items.map(item=>{
      if(!item||typeof item.title!=='string'||item.title.length>120||
         !item.title.trim()||!Number.isSafeInteger(item.quantity)||
         item.quantity<1||item.quantity>999)
        throw Error('Invalid Custom Order item summary.');
      return {title:item.title,quantity:item.quantity};
    }),
    date_needed:value.date_needed,
    fulfillment:value.fulfillment,
  };
}

export async function loadWorkCustomerConversationState({
  sessionToken,request=fetch,endpoint=WORK_CUSTOM_ORDER_ACCOUNT_URL,
  signal,
}={}) {
  if(!sessionToken||typeof sessionToken.get!=='function')
    throw new Error('Authenticated Shopify customer session is unavailable.');
  if(endpoint!==WORK_CUSTOM_ORDER_ACCOUNT_URL)
    throw new Error('Refusing an unverified Custom Order account endpoint.');
  if(signal!==undefined&&!(typeof signal?.aborted==='boolean'&&
    typeof signal?.addEventListener==='function'))
    throw new Error('Invalid account verification cancellation signal.');
  // An old signed read must not be rendered after its screen/attempt leaves.
  signal?.throwIfAborted?.();
  const jwt=await sessionToken.get();
  if(typeof jwt!=='string'||jwt.length<32||jwt.length>8192)
    throw new Error('Shopify could not verify your current session.');
  signal?.throwIfAborted?.();
  const response=await request(endpoint,{
    method:'POST',
    signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)])
      :AbortSignal.timeout(20000),
    headers:{
      'Content-Type':'application/json',
      Authorization:'Bearer '+jwt,
    },
    body:'',
  });
  if(!response?.ok)throw new Error(
    response?.status===401
      ? 'Please sign in to view your Custom Orders.'
      : 'Your Custom Orders could not be verified. Please try again.',
  );
  const data=await response.json();
  signal?.throwIfAborted?.();
  if(data?.version!==1||
     data?.operation!=='custom_order.account.list.result'||
     data?.ok!==true||!Array.isArray(data.orders)||data.orders.length>20)
    throw new Error('Invalid Custom Orders response.');
  // Gateway already returns a strict public-only projection and validates
  // the JWT; use a tiny second check for corrupted data during rendering.
  const orders=data.orders.map(item=>{
    const thread=item.timeline_version===2;
    if(typeof item.submission_id!=='string'||item.submission_id.length>128||
       !Number.isSafeInteger(item.revision)||item.revision<1||
       typeof item.status!=='string'||!Array.isArray(item.timeline)||
       item.timeline.length<1||
       (thread?item.timeline.length>item.revision:item.timeline.length!==item.revision)||
       item.timeline.length>100)
      throw new Error('Invalid Custom Order history.');
    return {
      ...(thread?{timeline_version:2}:{}),
      submission_id:item.submission_id,
      summary:readAccountOrderSummary(item.summary),
      status:item.status,
      revision:item.revision,
      updated_at:String(item.updated_at||''),
      timeline:item.timeline.map(event=>{
        // Do not make malformed server data appear trustworthy through
        // string coercion or silent message truncation.
        if(!event||typeof event!=='object'||Array.isArray(event)||
           typeof event.status!=='string'||
           typeof event.note!=='string'||event.note.length>500||
           typeof event.occurred_at!=='string'||event.occurred_at.length>40)
          throw new Error('Invalid Custom Order history.');
        return {
          ...(thread?{revision:event.revision,kind:event.kind,author:event.author}:{}),
          status:event.status,note:event.note,occurred_at:event.occurred_at,
        };
      }),
    };
  });
  // Require the same bounded, unique, chronological public contract for
  // BOTH My JILL screens. Reject a malformed/duplicated order before the
  // Custom Orders page can render it (Messages already checks this).
  projectCustomerMessageInbox(orders);
  signal?.throwIfAborted?.();
  if(data.reply_enabled!==undefined&&typeof data.reply_enabled!=='boolean')
    throw new Error('Invalid reply capability.');
  return Object.freeze({orders,replyEnabled:data.reply_enabled===true});
}
// Historical callers still get exactly an array of orders. Only messaging
// screens consume the authenticated WORK reply capability.
export async function loadWorkCustomerCustomOrders(options={}){
 const state=await loadWorkCustomerConversationState(options);
 return state.orders;
}
