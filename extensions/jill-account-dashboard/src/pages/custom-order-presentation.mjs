// Presentation-only formatting for the canonical My JILL Custom Orders screen.
// No account identity, backend reads, or durable order state is owned here.
export const CUSTOM_ORDER_STATUS = Object.freeze({
  received: {label:'Received',tone:'info',detail:'Your request has been received.'},
  reviewing: {label:'In review',tone:'info',detail:'We are reviewing your request.'},
  awaiting_approval: {label:'Awaiting approval',tone:'warning',detail:'Your request is awaiting approval.'},
  in_production: {label:'In production',tone:'info',detail:'Your request is in production.'},
  ready_pickup: {label:'Ready for pickup',tone:'success',detail:'Your request is marked ready for pickup.'},
  on_hold: {label:'On hold',tone:'warning',detail:'Your request is currently on hold.'},
  cancelled: {label:'Cancelled',tone:'critical',detail:'This request is marked cancelled.'},
  completed: {label:'Completed',tone:'success',detail:'This request is marked completed.'},
});

// Informational customer journey copy only. None of these statuses grants
// quote approval, payment, shipping, notifications or reply capability.
// Text deliberately avoids ETAs and commitments not in the signed source.
export const CUSTOM_ORDER_NEXT_STEP = Object.freeze({
  received: Object.freeze({
    heading:'What happens next?',
    text:'JILL has your request. Check back here for the next verified update after review.',
  }),
  reviewing: Object.freeze({
    heading:'What happens next?',
    text:'Your details are being reviewed. Any new status or message will appear in your account when available.',
  }),
  awaiting_approval: Object.freeze({
    heading:'Review the latest details',
    text:'This request is marked awaiting approval. Check the conversation and tracking history for instructions. Quote approval and payment are not available on this screen.',
  }),
  in_production: Object.freeze({
    heading:'Your creation is in progress',
    text:'The request is marked in production. Keep an eye on tracking for confirmed progress updates; no completion date is guaranteed here.',
  }),
  ready_pickup: Object.freeze({
    heading:'Before you collect',
    text:'The request is marked ready for pickup. Check the latest conversation for collection details and confirm arrangements with JILL before traveling.',
  }),
  on_hold: Object.freeze({
    heading:'Check for an update',
    text:'This request is on hold. Review the timeline and conversation for any explanation or next instructions.',
  }),
  cancelled: Object.freeze({
    heading:'Your request history',
    text:'The request is marked cancelled. Your tracking history remains available; this status does not establish any refund or payment outcome.',
  }),
  completed: Object.freeze({
    heading:'Thanks for celebrating with JILL!',
    text:'This request is marked completed. You can still review its details and conversation in your account.',
  }),
});
export function customOrderNextStep(status){
  return Object.hasOwn(CUSTOM_ORDER_NEXT_STEP,status)
    ? CUSTOM_ORDER_NEXT_STEP[status]
    : Object.freeze({
      heading:'Request details unavailable',
      text:'We cannot verify the next step yet. Refresh your signed-in request history for the latest status.',
    });
}

export function customOrderStatus(status) {
  return Object.hasOwn(CUSTOM_ORDER_STATUS,status) ? CUSTOM_ORDER_STATUS[status] : {
    label:'Status unavailable',
    tone:'neutral',
    detail:'Please check again for an updated status.',
  };
}

// Presentation-only count from the already signed, bounded customer summary.
// Never derive quantities from the Shopify Orders API or a guessed SKU.
export function customOrderRequestedQuantity(summary) {
  if(!Array.isArray(summary?.items)||summary.items.length<1||
     summary.items.length>20)return null;
  let total=0;
  for(const item of summary.items) {
    if(!Number.isSafeInteger(item?.quantity)||item.quantity<1||
       item.quantity>999)return null;
    total+=item.quantity;
  }
  return total;
}

export function customOrderTitle(summary) {
  const items=Array.isArray(summary?.items) ? summary.items : [];
  if (!items.length) return 'Personalized Custom Order';
  const first=items[0]?.title;
  if (typeof first!=='string' || !first.trim()) return 'Personalized Custom Order';
  const remaining=items.length-1;
  return remaining ? first+' + '+remaining+' more '+(remaining===1?'item':'items') : first;
}

export function customOrderShortId(id) {
  // Match the WORK merchant inbox reference: the LAST eight characters
  // of the immutable submission ID. Keep the complete ID below for audit.
  // This is display-only and never used to authorize account reads.
  const value=String(id || '');
  return value.length>=8 ? '#'+value.slice(-8).toUpperCase() : 'JILL request';
}

export function customOrderDateTime(value,locale='en-US') {
  const timestamp=Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return 'Date unavailable';
  return new Intl.DateTimeFormat(locale,{
    month:'short',day:'numeric',year:'numeric',
    hour:'numeric',minute:'2-digit',
  }).format(new Date(timestamp));
}

export function customOrderDateOnly(value,locale='en-US') {
  // Date-needed is a calendar date, not a UTC timestamp. Format in UTC
  // so customers west of Greenwich never see the previous calendar day.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'Date unavailable';
  const date=new Date(value+'T12:00:00.000Z');
  if (!Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0,10)!==value) return 'Date unavailable';
  return new Intl.DateTimeFormat(locale,{
    month:'short',day:'numeric',year:'numeric',timeZone:'UTC',
  }).format(date);
}

export function customOrderFulfillment(value) {
  if (value==='pickup') return 'Jacksonville pickup';
  if (value==='shipping') return 'Shipping';
  return 'Not selected';
}
