import {useEffect,useMemo,useState} from 'preact/hooks';
import {loadWorkCustomerConversationState}
  from '../../../../shared/customer-custom-orders.mjs';
import {projectCustomerMessageInbox}
  from '../../../../shared/custom-order-message-inbox.mjs';
import {projectVerifiedConversation}
  from '../../../../shared/custom-order-conversation-view.mjs';
import {selectOwnedMessageRequest,retainOwnedMessageDrafts}
  from '../../../../shared/customer-message-selection.mjs';
import {customOrderShortId,customOrderDateTime,customOrderTitle}
  from './custom-order-presentation.mjs';
import RequestConversation from './RequestConversation.jsx';

// My JILL customer inbox: one signed-in account, one canonical conversation
// per owned Custom Order. NOT a new account identifier or message store.
export default function Messages({requestedSubmissionId=null,drafts,onDraftsChange}){
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState({status:'loading',orders:[],replyEnabled:false});
  const [selected,setSelected]=useState(null);
  useEffect(()=>{
    let active=true;
    setState({status:'loading',orders:[],replyEnabled:false});
    const sessionToken=typeof shopify!=='undefined'?shopify.sessionToken:null;
    loadWorkCustomerConversationState({sessionToken}).then(({orders,replyEnabled})=>{
      const list=projectCustomerMessageInbox(orders);
      if(!active)return;
      // A new authenticated response reauthorizes EVERY displayed ID.
      onDraftsChange(previous=>retainOwnedMessageDrafts(previous,orders));
      // Reject foreign hints; only freshly authenticated IDs are selectable.
      setSelected(previous=>selectOwnedMessageRequest(list,{
        requestedId:requestedSubmissionId,previousId:previous,
      }));
      setState({status:'ready',orders,replyEnabled});
    }).catch(()=>{
      if(!active)return;
      // Never show stale messages from another signed-in account.
      onDraftsChange({});setSelected(null);
      setState({status:'error',orders:[],replyEnabled:false});
    });
    return ()=>{active=false};
  },[attempt,requestedSubmissionId]);
  const inbox=useMemo(()=>state.status==='ready'
    ?projectCustomerMessageInbox(state.orders):[],[state]);
  const availableThreads=inbox.filter(item=>item.timeline_version===2).length;
  const order=state.orders.find(x=>x.submission_id===selected);
  const current=inbox.find(x=>x.submission_id===selected);
  const visibleConversation=order&&current?projectVerifiedConversation(order):null;
  return <s-stack direction="block" gap="large">
    <s-section>
      <s-stack direction="block" gap="base">
        <s-heading>Messages</s-heading>
        <s-text color="subdued">
          Your verified Custom Orders and messages with JILL.
          Replies become available when the secure conversation is connected.
        </s-text>
        {state.status==='loading'&&<s-stack direction="inline"
          gap="small-200" alignItems="center">
          <s-spinner size="small"/>
          <s-text>Checking your verified Custom Orders…</s-text>
        </s-stack>}
        {state.status==='error'&&<s-stack direction="block" gap="small-200">
          <s-banner tone="warning">
            We couldn't verify your messages. No previous account's
            conversations are displayed.
          </s-banner>
          <s-button variant="secondary" onClick={()=>setAttempt(x=>x+1)}>
            Try again
          </s-button>
        </s-stack>}
        {state.status==='ready'&&inbox.length===0&&
          <s-box padding="base" background="subdued" borderRadius="large">
            <s-stack direction="block" gap="small-300">
              <s-heading>No verified requests yet</s-heading>
              <s-text>Account-owned Custom Orders will appear here when available.</s-text>
              <s-text color="subdued">
                Guest requests aren't attached to your account by email alone.
              </s-text>
            </s-stack>
          </s-box>}
        {state.status==='ready'&&inbox.length>0&&<>
          {availableThreads===0&&<s-banner tone="info">
            Secure conversations are not yet available for these requests.
            Tracking history remains available in Custom Orders.
          </s-banner>}
          <s-stack direction="inline" justifyContent="space-between"
            alignItems="center">
            <s-text color="subdued">
              {inbox.length} verified {inbox.length===1?'request':'requests'}
              {' · '}{availableThreads} secure {availableThreads===1?'thread':'threads'} available
              {' · '}Unread counts are not available.
            </s-text>
            <s-button variant="secondary" onClick={()=>setAttempt(x=>x+1)}>
              Refresh messages
            </s-button>
          </s-stack>
          <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1.6fr)"
            gap="base">
            <s-box padding="base" background="subdued" borderRadius="large">
              <s-stack direction="block" gap="small-300">
                <s-heading>Requests & conversations</s-heading>
                {inbox.map(item=>{
                  const source=state.orders.find(o=>
                    o.submission_id===item.submission_id);
                  return <s-button key={item.submission_id}
                    variant={selected===item.submission_id?'primary':'secondary'}
                    onClick={()=>setSelected(item.submission_id)}>
                    {customOrderShortId(item.submission_id)} ·
                    {' '}{customOrderTitle(source?.summary)}
                    {item.timeline_version===1?' · Status history only'
                      :item.last_message?' · '+(item.last_message.author==='customer'
                      ?'You':'JILL')+' replied':' · No messages yet'}
                  </s-button>;
                })}
              </s-stack>
            </s-box>
            <s-box padding="base" background="base" borderRadius="large"
              border="base base solid">
              {order&&current?<s-stack direction="block" gap="base">
                <s-heading>{customOrderTitle(order.summary)}</s-heading>
                <s-text color="subdued">
                  {customOrderShortId(order.submission_id)}
                  {' · '}Last request activity: {customOrderDateTime(order.updated_at)}
                </s-text>
                <s-divider/>
                <s-heading>Conversation</s-heading>
                {order.timeline_version!==2?<s-banner tone="info">
                  This older request has status history only.
                  A verified conversation is not available here yet.
                </s-banner>:visibleConversation?.messages.length===0?
                  <s-text color="subdued">
                    No messages yet. Request status updates remain in Custom Orders.
                  </s-text>:null}
                {visibleConversation?.messages.map(event=>
                  <s-box key={event.revision} padding="base" background="subdued"
                    borderRadius="large">
                    <s-stack direction="block" gap="small-100">
                      <s-text type="strong">
                        {event.author==='customer'?'You':'JILL'}
                      </s-text>
                      <s-text>{event.note}</s-text>
                      <s-text color="subdued">
                        {customOrderDateTime(event.occurred_at)}
                      </s-text>
                    </s-stack>
                  </s-box>
                )}
                <s-divider/>
                <RequestConversation order={order} replyEnabled={state.replyEnabled}
                  draft={drafts[order.submission_id]||{}}
                  onDraftChange={change=>onDraftsChange(previous=>
                    Object.hasOwn(previous,order.submission_id)
                      ?{...previous,[order.submission_id]:{
                        ...previous[order.submission_id],...change}}:previous)}
                  onRefresh={()=>setAttempt(x=>x+1)}/>
              </s-stack>:<s-text color="subdued">
                Choose a verified request to view its conversation.
              </s-text>}
            </s-box>
          </s-grid>
        </>}
      </s-stack>
    </s-section>
  </s-stack>;
}
