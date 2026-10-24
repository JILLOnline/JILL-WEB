import {useEffect,useState} from 'preact/hooks';
import {loadWorkCustomerConversationState} from '../../../../shared/customer-custom-orders.mjs';
import RequestConversation from './RequestConversation.jsx';
import {MYJILL_ORDER_FILTERS,projectMyJillOrderActivity,selectMyJillOrderIds}
 from './myjill-order-activity.mjs';
import {retainOwnedMessageDrafts,updateOwnedMessageDraft} from '../../../../shared/customer-message-selection.mjs';
import {
  customOrderStatus,customOrderTitle,customOrderShortId,
  customOrderDateTime,customOrderDateOnly,customOrderFulfillment,
} from './custom-order-presentation.mjs';

// UI-only WORK account screen. Every read obtains a fresh Shopify session
// token through the existing canonical reader. Never select orders by email.
export default function CustomOrders({onNavigate,drafts,onDraftsChange,requestedSubmissionId=null}) {
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState({status:'loading',orders:[],activity:null,replyEnabled:false});
  const [filter,setFilter]=useState('all');
  const [expandedIds,setExpandedIds]=useState({});
  const [refreshing,setRefreshing]=useState(false);

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setState({status:'loading',orders:[],activity:null,replyEnabled:false});
    setRefreshing(true);
    const sessionToken=typeof shopify!=='undefined'
      ? shopify.sessionToken : null;
    loadWorkCustomerConversationState({sessionToken,signal:controller.signal})
      .then(({orders,replyEnabled})=>{
        if(active){
          // Keep text and the SAME uncertain operation only for requests in
          // the newly verified account response. Other accounts' drafts go.
          const activity=projectMyJillOrderActivity(orders);
          onDraftsChange(previous=>retainOwnedMessageDrafts(previous,orders));
          // The Home navigation ID is an untrusted selection hint. Only
          // a freshly signed account list can authorize which details open.
          const ownedTarget=typeof requestedSubmissionId==='string'&&
            orders.some(order=>order.submission_id===requestedSubmissionId)
            ?requestedSubmissionId:null;
          setExpandedIds(ownedTarget?{[ownedTarget]:true}:{});
          if(ownedTarget)setFilter('all');
          setState({status:'ready',orders,activity,replyEnabled});
          setRefreshing(false);
        }
      })
      .catch(()=>{
        if(active){
          onDraftsChange({}); // Account could have changed; clear uncertain replies.
          setExpandedIds({});
          setState({status:'error',orders:[],activity:null,replyEnabled:false});
          setRefreshing(false);
        }
      });
    return ()=>{active=false;controller.abort();};
  },[attempt,requestedSubmissionId]);

  const loading=state.status==='loading';
  const ids=selectMyJillOrderIds(state.activity,filter);
  const byId=new Map(state.orders.map(order=>[order.submission_id,order]));
  const visibleOrders=ids.map(id=>byId.get(id)).filter(Boolean);
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
          {state.status==='ready' && <s-stack direction="block" gap="base">
            <s-box padding="base" background="subdued" borderRadius="large">
              <s-stack direction="block" gap="small-300">
                <s-heading>Your request activity</s-heading>
                <s-stack direction="inline" gap="base">
                  <s-badge tone="info">{state.activity.active} active</s-badge>
                  <s-badge>{state.activity.finished} finished</s-badge>
                  {state.activity.awaiting_approval>0 &&
                    <s-badge tone="warning">
                      {state.activity.awaiting_approval} awaiting approval
                    </s-badge>}
                  {state.activity.ready_pickup>0 &&
                    <s-badge tone="success">
                      {state.activity.ready_pickup} marked ready for pickup
                    </s-badge>}
                </s-stack>
                <s-text color="subdued">
                  Counts reflect confirmed request statuses, not Shopify purchases,
                  estimated delivery dates or unread messages.
                </s-text>
              </s-stack>
            </s-box>
            <s-select label="Show Custom Orders" value={filter}
              onChange={event=>setFilter(event.currentTarget.value)}>
              {MYJILL_ORDER_FILTERS.map(option=>
                <s-option key={option.id} value={option.id}>
                  {option.label}
                </s-option>)}
            </s-select>
            {visibleOrders.length===0 && state.orders.length>0 &&
              <s-box padding="base" background="subdued" borderRadius="large">
                <s-text>No verified Custom Orders match this filter.</s-text>
              </s-box>}
          </s-stack>}
          {visibleOrders.map((order)=> {
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

                  <s-stack direction="inline" gap="small-200">
                    <s-button variant="secondary"
                      onClick={()=>setExpandedIds(previous=>({
                        ...previous,[order.submission_id]:!previous[order.submission_id],
                      }))}>
                      {expandedIds[order.submission_id]
                        ?'Hide tracking & details':'View tracking & details'}
                    </s-button>
                    <s-button variant="primary"
                      onClick={()=>onNavigate('messages',{submissionId:order.submission_id})}>
                      Conversation
                    </s-button>
                  </s-stack>
                  {Boolean(drafts?.[order.submission_id]?.operation) &&
                    <s-badge tone="warning">
                      Message delivery needs verification
                    </s-badge>}
                  {expandedIds[order.submission_id] && <>
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
                        <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="base">
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
                  <s-divider/>
                  <s-stack direction="block" gap="small-100">
                    <s-text color="subdued">Your request reference</s-text>
                    <s-text>{order.submission_id}</s-text>
                  </s-stack>
                  </>}
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
