import {useEffect,useMemo,useState} from 'preact/hooks';
import {loadWorkCustomerConversationState}
  from '../../../../shared/customer-custom-orders.mjs';
import {projectCustomerMessageInbox}
  from '../../../../shared/custom-order-message-inbox.mjs';
import {projectVerifiedConversation}
  from '../../../../shared/custom-order-conversation-view.mjs';
import {selectOwnedMessageRequest,retainOwnedMessageDrafts,updateOwnedMessageDraft,
  filterOwnedMessageThreads,MYJILL_MESSAGE_FILTERS}
  from '../../../../shared/customer-message-selection.mjs';
import {customOrderShortId,customOrderDateTime,customOrderTitle,customOrderNextStep}
  from './custom-order-presentation.mjs';
import RequestConversation from './RequestConversation.jsx';

// My JILL customer inbox: one signed-in account, one canonical conversation
// per owned Custom Order. NOT a new account identifier or message store.
export default function Messages({requestedSubmissionId=null,drafts,onDraftsChange,onNavigate}){
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState({status:'loading',orders:[],replyEnabled:false});
  const [selected,setSelected]=useState(null);
  const [filter,setFilter]=useState('all');
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    // A signed navigation hint must not be hidden by the previous
    // Active/Finished filter. Open the full verified list first, then
    // select only if the freshly authenticated account actually owns it.
    if(requestedSubmissionId!==null)setFilter('all');
    setState({status:'loading',orders:[],replyEnabled:false});
    const sessionToken=typeof shopify!=='undefined'?shopify.sessionToken:null;
    loadWorkCustomerConversationState({sessionToken,signal:controller.signal}).then(({orders,replyEnabled})=>{
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
    return ()=>{active=false;controller.abort();};
  },[attempt,requestedSubmissionId]);
  const inbox=useMemo(()=>state.status==='ready'
    ?projectCustomerMessageInbox(state.orders):[],[state]);
  const availableThreads=inbox.filter(item=>item.timeline_version===2).length;
  const visibleInbox=useMemo(()=>filterOwnedMessageThreads(inbox,filter),[inbox,filter]);
  const currentSelection=visibleInbox.some(x=>x.submission_id===selected)
    ?selected:visibleInbox[0]?.submission_id??null;
  const order=state.orders.find(x=>x.submission_id===currentSelection);
  const current=visibleInbox.find(x=>x.submission_id===currentSelection);
  const visibleConversation=order&&current?projectVerifiedConversation(order):null;
  return <s-stack direction="block" gap="large">
    <s-section>
      <s-stack direction="block" gap="base">
        <s-heading>Messages</s-heading>
        <s-text color="subdued">
          Your verified Custom Orders and messages with JILL.
          {state.status==='ready'&&state.replyEnabled
            ?' Secure replies are available for eligible conversations.'
            :' You can review available messages here. Replies are not available yet.'}
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
              <s-heading>Nothing in your inbox yet</s-heading>
              <s-text>When a Custom Order is linked to your account, you can find its messages here.</s-text>
              <s-text color="subdued">
                Guest requests aren't attached to your account by email alone.
              </s-text>
              <s-button variant="secondary" onClick={()=>onNavigate?.('custom-orders')}>
                View Custom Orders
              </s-button>
            </s-stack>
          </s-box>}
        {state.status==='ready'&&inbox.length>0&&<>
          {availableThreads===0&&<s-banner tone="info">
            Secure conversations are not yet available for these requests.
            Tracking history remains available in Custom Orders.
          </s-banner>}
          {availableThreads>0&&!state.replyEnabled&&<s-banner tone="info">
            Verified conversation history is available to read.
            You can read your conversation history here. Replying from My JILL isn't available yet.
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
          <s-grid gridTemplateColumns="minmax(0, 1fr)"
            gap="base">
            <s-box padding="base" background="subdued" borderRadius="large">
              <s-stack direction="block" gap="small-300">
                <s-heading>Requests & conversations</s-heading>
                <s-select label="Show conversations" value={filter}
                  onChange={event=>{
                    const next=event.currentTarget.value;
                    setFilter(next);
                    setSelected(previous=>selectOwnedMessageRequest(
                      filterOwnedMessageThreads(inbox,next),{previousId:previous}));
                  }}>
                  {MYJILL_MESSAGE_FILTERS.map(option=>
                    <s-option key={option.id} value={option.id}>{option.label}</s-option>)}
                </s-select>
                {visibleInbox.length===0&&<s-text color="subdued">
                  No verified conversations match this filter.
                </s-text>}
                {visibleInbox.length>0&&<s-select label="Choose a verified conversation"
                  value={currentSelection??''}
                  onChange={event=>setSelected(
                    selectOwnedMessageRequest(visibleInbox,{
                      requestedId:event.currentTarget.value,
                      previousId:selected,
                    })
                  )}>
                  {visibleInbox.map(item=>{
                    const source=state.orders.find(o=>
                      o.submission_id===item.submission_id);
                    return <s-option key={item.submission_id}
                      value={item.submission_id}>
                      {customOrderShortId(item.submission_id)} ·
                      {' '}{customOrderTitle(source?.summary)}
                      {item.timeline_version===1?' · Status history only'
                        :item.last_message?' · '+(item.last_message.author==='customer'
                        ?'You':'JILL')+' replied':' · No messages yet'}
                    </s-option>;
                  })}
                </s-select>}
                <s-text color="subdued">
                  Showing {visibleInbox.length} of {inbox.length} verified requests.
                  Select a signed-in request to read its conversation.
                  Unread indicators and delivery receipts aren't available.
                </s-text>
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
                <s-box padding="small-300" background="subdued" borderRadius="base">
                  <s-stack direction="block" gap="small-200">
                    <s-text type="strong">{customOrderNextStep(order.status).heading}</s-text>
                    <s-text color="subdued">{customOrderNextStep(order.status).text}</s-text>
                  </s-stack>
                </s-box>
                <s-button variant="secondary"
                  onClick={()=>onNavigate?.('custom-orders',{
                    submissionId:order.submission_id,
                  })}>
                  Track this request
                </s-button>
                <s-divider/>
                <s-heading>Conversation</s-heading>
                {order.timeline_version!==2?<s-stack direction="block" gap="small-200">
                  <s-banner tone="info">
                    This older request has status history only.
                    A verified conversation is not available here yet.
                  </s-banner>
                  <s-button variant="secondary" onClick={()=>onNavigate?.('custom-orders')}>
                    View tracking in Custom Orders
                  </s-button>
                </s-stack>:visibleConversation?.messages.length===0?
                  <s-text color="subdued">
                    No messages yet. Request status updates remain in Custom Orders.
                  </s-text>:null}
                {visibleConversation?.messages.map(event=>
                  <s-box key={event.revision} padding="base"
                    background={event.author==='customer'?'subdued':'base'}
                    border="base base solid" borderRadius="large">
                    <s-stack direction="block" gap="small-200">
                      <s-stack direction="inline" gap="small-200"
                        alignItems="center" justifyContent="space-between">
                        <s-badge tone={event.author==='customer'?'info':'neutral'}>
                          {event.author==='customer'?'You':'JILL'}
                        </s-badge>
                        <s-text color="subdued">
                          {customOrderDateTime(event.occurred_at)}
                        </s-text>
                      </s-stack>
                      <s-text>{event.note}</s-text>
                    </s-stack>
                  </s-box>
                )}
                <s-divider/>
                <RequestConversation order={order} replyEnabled={state.replyEnabled}
                  draft={drafts[order.submission_id]||{}}
                  onDraftChange={(change,meta)=>onDraftsChange(previous=>
                    updateOwnedMessageDraft(previous,order.submission_id,change,meta))}
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
