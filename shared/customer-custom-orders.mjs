// WORK-only My JILL Custom Orders account reader.
// Source of customer identity is Shopify's signed session token ONLY.
// Never send a user-supplied email, customer ID or order ID to the endpoint.
export const WORK_CUSTOM_ORDER_ACCOUNT_URL=
  'https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev/jill-custom-order-account';

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

export async function loadWorkCustomerCustomOrders({
  sessionToken,request=fetch,endpoint=WORK_CUSTOM_ORDER_ACCOUNT_URL,
}={}) {
  if(!sessionToken||typeof sessionToken.get!=='function')
    throw new Error('Authenticated Shopify customer session is unavailable.');
  if(endpoint!==WORK_CUSTOM_ORDER_ACCOUNT_URL)
    throw new Error('Refusing an unverified Custom Order account endpoint.');
  const jwt=await sessionToken.get();
  if(typeof jwt!=='string'||jwt.length<32||jwt.length>8192)
    throw new Error('Shopify could not verify your current session.');
  const response=await request(endpoint,{
    method:'POST',
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
  if(data?.version!==1||
     data?.operation!=='custom_order.account.list.result'||
     data?.ok!==true||!Array.isArray(data.orders)||data.orders.length>20)
    throw new Error('Invalid Custom Orders response.');
  // Gateway already returns a strict public-only projection and validates
  // the JWT; use a tiny second check for corrupted data during rendering.
  return data.orders.map(item=>{
    if(typeof item.submission_id!=='string'||item.submission_id.length>128||
       !Number.isSafeInteger(item.revision)||item.revision<1||
       typeof item.status!=='string'||!Array.isArray(item.timeline)||
       item.timeline.length!==item.revision||item.timeline.length>100)
      throw new Error('Invalid Custom Order history.');
    return {
      submission_id:item.submission_id,
      summary:readAccountOrderSummary(item.summary),
      status:item.status,
      revision:item.revision,
      updated_at:String(item.updated_at||''),
      timeline:item.timeline.map(event=>({
        status:String(event.status||''),
        note:String(event.note||'').slice(0,500),
        occurred_at:String(event.occurred_at||''),
      })),
    };
  });
}
