import {useEffect,useState} from 'preact/hooks';
import {loadWorkCustomerConversationState} from '../../../../shared/customer-custom-orders.mjs';
import RequestConversation from './RequestConversation.jsx';
import {retainOwnedMessageDrafts,updateOwnedMessageDraft} from '../../../../shared/customer-message-selection.mjs';
import {
  customOrderStatus,customOrderTitle,customOrderShortId,
  customOrderDateTime,customOrderDateOnly,customOrderFulfillment,
} from './custom-order-presentation.mjs';

// UI-only WORK account screen. Every read obtains a fresh Shopify session
// token through the existing canonical reader. Never select orders by email.
export default function CustomOrders({onNavigate,drafts,onDraftsChange}) {
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState({status:'loading',orders:[],replyEnabled:false});
  const [refreshing,setRefreshing]=useState(false);

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setState({status:'loading',orders:[],replyEnabled:false});
    setRefreshing(true);
    const sessionToken=typeof shopify!=='undefined'
      ? shopify.sessionToken : null;
    loadWorkCustomerConversationState({sessionToken,signal:controller.signal})
      .then(({orders,replyEnabled})=>{
        if(active){
          // Keep text and the SAME uncertain operation only for requests in
          // the newly verified account response. Other accounts' drafts go.
          onDraftsChange(previous=>retainOwnedMessageDrafts(previous,orders));
          setState({status:'ready',orders,replyEnabled});setRefreshing(false);
        }
      })
      .catch(()=>{
        if(active){
          onDraftsChange({}); // Account could have changed; clear uncertain replies.
          setState({status:'error',orders:[],replyEnabled:false});setRefreshing(false);
        }
      });
    return ()=>{active=false;controller.abort();};
  },[attempt]);

  const loading=state.status==='loading';
  return (
    <s-stack direction="block" gap="large">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Your Custom Orders</s-heading>
              <s-text color="subdued">A little magic in the making — follow every real update, from request to finish.</s-text>
            </s-stack>
            {state.status==='ready' && (
              <s-badge tone="info">
                {state.orders.length} {state.orders.length===1?'request':'requests'}
              </s-badge>
            )}
          </s-stack>
          {loading && (
            <s-box background="subdued" borderRadius="large" padding="base">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-spinner size="small"/>
                <s-text>Checking your private order history…</s-text>
              </s-stack>
            </s-box>
          )}
          {state.status==='error' && (
            <s-stack direction="block" gap="base">
              <s-banner tone="warning">We couldn't verify your Custom Order history. Your requests haven't been changed.</s-banner>
              <s-button variant="secondary" onClick={()=>setAttempt(value=>value+1)}>
                Try again
              </s-button>
            </s-stack>
          )}
          {state.status==='ready' && state.orders.length===0 && (
            <s-box background="subdued" borderRadius="large" padding="base">
              <s-stack direction="block" gap="small-300">
                <s-heading>No requests to show yet</s-heading>
                <s-text>Signed-in account requests will appear here as soon as they're verified.</s-text>
                <s-banner tone="info">Guest requests are not automatically linked to a signed-in account by email or phone.</s-banner>
              </s-stack>
            </s-box>
          )}
          {state.orders.map((order)=> {
            const current=customOrderStatus(order.status);
            const summary=order.summary;
            const firstEvent=order.timeline[0];
            return (
              <s-box key={order.submission_id}
                padding="base" background="base" borderRadius="large" border="base base solid">
                <s-stack direction="block" gap="base">
                  <s-stack direction="inline" gap="base" justifyContent="space-between" alignItems="start">
                    <s-stack direction="block" gap="small-100">
                      <s-text color="subdued">JILL CUSTOM REQUEST · {customOrderShortId(order.submission_id)}</s-text>
                      <s-heading>{customOrderTitle(summary)}</s-heading>
                      {firstEvent && <s-text color="subdued">Requested {customOrderDateTime(firstEvent.occurred_at)}</s-text>}
                    </s-stack>
                    <s-badge tone={current.tone}>{current.label}</s-badge>
                  </s-stack>

                  <s-box background="subdued" padding="base" borderRadius="large">
                    <s-stack direction="block" gap="small-300">
                      <s-text type="strong">{current.detail}</s-text>
                      <s-text color="subdued">Last update: {customOrderDateTime(order.updated_at)}{refreshing?' · Refreshing…':''}</s-text>
                    </s-stack>
                  </s-box>

                  {(summary.items.length>0 || summary.date_needed || summary.fulfillment) && (
                    <s-stack direction="block" gap="small-300">
                      <s-heading>Request details</s-heading>
                      {summary.items.map((item,index)=>(
                        <s-stack key={order.submission_id+'-item-'+index}
                          direction="inline" gap="base" justifyContent="space-between" alignItems="center">
                          <s-text>{item.title}</s-text>
                          <s-badge>Qty {item.quantity}</s-badge>
                        </s-stack>
                      ))}
                      {(summary.date_needed || summary.fulfillment) && (
                        <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
                          {summary.date_needed && (
                            <s-stack direction="block" gap="small-100">
                              <s-text color="subdued">Needed by</s-text>
                              <s-text type="strong">{customOrderDateOnly(summary.date_needed)}</s-text>
                            </s-stack>
                          )}
                          {summary.fulfillment && (
                            <s-stack direction="block" gap="small-100">
                              <s-text color="subdued">Delivery method</s-text>
                              <s-text type="strong">{customOrderFulfillment(summary.fulfillment)}</s-text>
                            </s-stack>
                          )}
                        </s-grid>
                      )}
                    </s-stack>
                  )}

                  <s-divider/>
                  <s-stack direction="block" gap="small-300">
                    <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                      <s-heading>Tracking history</s-heading>
                      <s-badge>{order.timeline.length} {order.timeline.length===1?'update':'updates'}</s-badge>
                    </s-stack>
                    {order.timeline.map((event,index)=>(
                      <s-grid key={order.submission_id+'-history-'+index}
                        gridTemplateColumns="28px minmax(0, 1fr)" gap="small-300">
                        <s-stack direction="block" alignItems="center" gap="small-100">
                          <s-icon type="check-circle-filled" tone="neutral" size="small-200"/>
                          {index<order.timeline.length-1 && (
                            <s-box inlineSize={1} blockSize={24} border="base base solid"/>
                          )}
                        </s-stack>
                        <s-stack direction="block" gap="small-100">
                          <s-text type="strong">{event.author==='customer'?'You':event.kind==='merchant_message'?'JILL':customOrderStatus(event.status).label}</s-text>
                          <s-text color="subdued">{customOrderDateTime(event.occurred_at)}</s-text>
                          {event.note && <s-text>{event.note}</s-text>}
                        </s-stack>
                      </s-grid>
                    ))}
                  </s-stack>
                  <RequestConversation order={order} replyEnabled={state.replyEnabled}
                    draft={drafts[order.submission_id]||{}}
                    onDraftChange={(change,meta)=>onDraftsChange(previous=>
                      updateOwnedMessageDraft(previous,order.submission_id,change,meta))}
                    onRefresh={()=>setAttempt(value=>value+1)}/>
                  <s-button variant="secondary"
                    onClick={()=>onNavigate('messages',{submissionId:order.submission_id})}>
                    View in Messages
                  </s-button>
                  <s-divider/>
                  <s-stack direction="block" gap="small-100">
                    <s-text color="subdued">Your request reference</s-text>
                    <s-text>{order.submission_id}</s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            );
          })}
          {state.status==='ready' && state.orders.length>0 && (
            <s-stack direction="inline" justifyContent="end">
              <s-button variant="secondary" onClick={()=>setAttempt(value=>value+1)}>
                Refresh updates
              </s-button>
            </s-stack>
          )}
        </s-stack>
      </s-section>
      <s-section>
        <s-box background="subdued" padding="base" borderRadius="large">
          <s-stack direction="block" gap="small-300">
            <s-heading>Looking for a regular order?</s-heading>
            <s-text color="subdued">Shopify purchases have their own secure order history. Custom requests are tracked here separately.</s-text>
            <s-link href="shopify:customer-account/orders">View Shopify orders</s-link>
          </s-stack>
        </s-box>
      </s-section>
    </s-stack>
  );
}
