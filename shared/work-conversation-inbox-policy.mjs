// Shared source-only inbox consistency gate for Owner HQ and My JILL.
// Actual auth remains in Shopify online Owner/D1 and customer JWT gateway.
// This module never authorizes reads, merges sources, or stores messages.
import {projectVerifiedConversation} from './custom-order-conversation-view.mjs';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const record=x=>x&&typeof x==='object'&&!Array.isArray(x)&&
  ID.test(x.submission_id||'')&&Number.isSafeInteger(x.revision)&&
  x.revision>=1&&x.revision<=100;
const hold=(state)=>Object.freeze({state,conversation:null,
  unread_count:null,delivery_verified:false});
export function reconcileOwnerRequestThread({authorizedRequest,thread}={}){
  if(!record(authorizedRequest))return hold('access_unverified');
  if(thread==null)return hold('thread_not_loaded');
  if(!record(thread)||thread.submission_id!==authorizedRequest.submission_id)
    return hold('thread_identity_mismatch');
  let conversation;
  try{conversation=projectVerifiedConversation(thread);}
  catch{return hold('thread_unverified');}
  if(conversation.state!=='verified')return hold('legacy_thread_only');
  if(thread.revision<authorizedRequest.revision)return hold('thread_snapshot_stale');
  return Object.freeze({state:'verified',conversation,
    source_revision:thread.revision,unread_count:null,delivery_verified:false});
}
export function compareOwnedAndMerchantThreads({merchant,customer}={}){
  // This is an OFFLINE QA comparison, not a runtime cross-account reader.
  if(!record(merchant)||!record(customer)||
    merchant.submission_id!==customer.submission_id)
    return Object.freeze({state:'different_request',identical:false});
  let a,b;
  try{a=projectVerifiedConversation(merchant);b=projectVerifiedConversation(customer);}
  catch{return Object.freeze({state:'invalid_projection',identical:false});}
  if(a.state!=='verified'||b.state!=='verified')
    return Object.freeze({state:'legacy_or_disconnected',identical:false});
  if(merchant.revision!==customer.revision)
    return Object.freeze({state:'revision_not_synchronized',identical:false});
  // Only public message fields are compared. Private staff notes and email
  // outcomes do not belong in either projection or the comparison.
  const same=JSON.stringify(a.messages)===JSON.stringify(b.messages);
  return Object.freeze({state:same?'same_public_thread':'public_thread_mismatch',
    identical:same});
}
