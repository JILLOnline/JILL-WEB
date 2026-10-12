import {useEffect,useState} from 'preact/hooks';
import {loadWorkCustomerCustomOrders} from '../../../../shared/customer-custom-orders.mjs';

// WORK account hub screen; no merchant mutation, no email-based lookup.
// Read access is bound to Shopify's fresh session token on every request.
export default function CustomOrders() {
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState({status:'loading',orders:[]});

  useEffect(()=>{
    let active=true;
    setState({status:'loading',orders:[]});
    const sessionToken=typeof shopify!=='undefined'
      ? shopify.sessionToken : null;
    loadWorkCustomerCustomOrders({sessionToken})
      .then(orders=>{
        if(active)setState({status:'ready',orders});
      })
      .catch(()=>{
        if(active)setState({status:'error',orders:[]});
      });
    return ()=>{active=false;};
  },[attempt]);

  return (
    <s-stack direction="block" gap="base">
      <s-section heading="Your custom orders">
        <s-text>Follow the progress of your personalized JILL requests.</s-text>
        {state.status==='loading' && (
          <s-text>Checking your private Custom Order history…</s-text>
        )}
        {state.status==='error' && (
          <s-stack direction="block" gap="base">
            <s-banner tone="warning">Your Custom Order history could not be verified. No orders were changed.</s-banner>
            <s-button onClick={()=>setAttempt(value=>value+1)}>Try again</s-button>
          </s-stack>
        )}
        {state.status==='ready' && state.orders.length===0 && (
          <s-banner tone="info">No Custom Orders are connected to this signed-in account yet. Guest requests are not automatically linked by email.</s-banner>
        )}
        {state.status==='ready' && state.orders.map(order=>(
          <s-section key={order.submission_id} heading={order.submission_id}>
            <s-stack direction="block" gap="small">
              <s-text>Current status: {order.status} · Revision {order.revision}</s-text>
              <s-text>Updated: {order.updated_at}</s-text>
              {order.timeline.map((event,index)=>(
                <s-stack key={order.submission_id+'-'+index} direction="block" gap="none">
                  <s-text>{index+1}. {event.status} — {event.occurred_at}</s-text>
                  {event.note && <s-text>{event.note}</s-text>}
                </s-stack>
              ))}
            </s-stack>
          </s-section>
        ))}
      </s-section>
    </s-stack>
  );
}
