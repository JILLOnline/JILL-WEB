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

export function customOrderStatus(status) {
  return Object.hasOwn(CUSTOM_ORDER_STATUS,status) ? CUSTOM_ORDER_STATUS[status] : {
    label:'Status unavailable',
    tone:'neutral',
    detail:'Please check again for an updated status.',
  };
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
