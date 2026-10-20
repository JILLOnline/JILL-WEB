// WORK HQ + My JILL: one validated, public, read-only conversation rendering.
// NEVER provides read receipts, delivery claims, customer authorization or a writer.
import {summarizePublicOrderThread} from './custom-order-message-inbox.mjs';

export function projectVerifiedConversation(order){
  const summary=summarizePublicOrderThread(order);
  if(summary.timeline_version!==2)return Object.freeze({
    state:'legacy_status_only',submission_id:summary.submission_id,
    last_message:null,messages:Object.freeze([]),
    unread_count:null,delivery_verified:false,
  });
  const messages=[];
  // summarizePublicOrderThread above validates EVERY event's revision,
  // actor/kind relationship, timestamp and bounded note length.
  for(const event of order.timeline){
    if(event.kind==='merchant_message'||event.kind==='customer_reply'){
      if(!event.note.trim())continue;
      messages.push(Object.freeze({
        revision:event.revision,
        author:event.author,
        kind:event.kind,
        occurred_at:event.occurred_at,
        note:event.note,
      }));
    }
  }
  return Object.freeze({state:'verified',submission_id:summary.submission_id,
    last_message:summary.last_message,
    messages:Object.freeze(messages),
    unread_count:null,delivery_verified:false,
  });
}
