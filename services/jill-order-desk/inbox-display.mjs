// Pure presentation helpers for the already authorized WORK merchant inbox.
// No network requests, data persistence, customer PII, or mutation.
const CUSTOMER_LABELS=Object.freeze({
  received:'Received',
  reviewing:'In review',
  awaiting_approval:'Awaiting approval',
  in_production:'In production',
  ready_pickup:'Ready for pickup',
  on_hold:'On hold',
  cancelled:'Cancelled',
  completed:'Completed',
});
const INTERNAL_LABELS=Object.freeze({
  new:'New request',
  needs_quote:'Needs quote',
  waiting_customer:'Waiting on customer',
  materials_ordered:'Materials ordered',
  proof_revision:'Proof revision',
  printing:'Printing',
  assembly:'Assembly',
  quality_check:'Quality check',
  ready:'Ready',
  none:'Not assigned',
});
export const INBOX_FILTERS=Object.freeze([
  ['all','All statuses'],['received','Received'],['reviewing','In review'],
  ['awaiting_approval','Awaiting approval'],['in_production','In production'],
  ['ready_pickup','Ready for pickup'],['on_hold','On hold'],
  ['cancelled','Cancelled'],['completed','Completed'],
]);
export function customerStatusLabel(value){
  return CUSTOMER_LABELS[value]??'Unknown status';
}
export function internalStatusLabel(value){
  return INTERNAL_LABELS[value]??'Not assigned';
}
export function requestShortId(id){
  if(typeof id!=='string'||id.length<8)return 'Unknown';
  return id.slice(-8).toUpperCase();
}
export function dateLabel(value,{includeTime=false}={}){
  if(!value)return 'Not supplied';
  const iso=includeTime?value:value+'T12:00:00.000Z';
  const date=new Date(iso);
  if(!Number.isFinite(date.getTime()))return 'Not supplied';
  const formatted=new Intl.DateTimeFormat('en-US',{
    month:'short',day:'numeric',year:'numeric',timeZone:'UTC',
    ...(includeTime?{hour:'numeric',minute:'2-digit',hour12:true}:{}),
  }).format(date);
  return includeTime?formatted+' UTC':formatted;
}
export function inboxStats(records){
  return {
    total:records.length,
    reviewing:records.filter(r=>r.customer_status==='reviewing').length,
    needsQuote:records.filter(r=>r.internal_status==='needs_quote').length,
  };
}
export function selectInboxRecords(records,{query='',status='all',sort='recent'}={}){
  const search=String(query).trim().toLowerCase().slice(0,128);
  const matches=records.filter(r=>{
    if(status!=='all'&&r.customer_status!==status)return false;
    if(!search)return true;
    return [r.submission_id,r.customer_status,r.internal_status,
      r.date_needed,r.fulfillment].some(v=>String(v??'').toLowerCase().includes(search));
  });
  // Keep source immutable. Bounded canonical feed (<=50) is always the owner.
  return [...matches].sort((a,b)=>{
    if(sort==='oldest')return Date.parse(a.submitted_at)-Date.parse(b.submitted_at)||
      a.submission_id.localeCompare(b.submission_id);
    if(sort==='needed') {
      const ad=a.date_needed||'9999-12-31',bd=b.date_needed||'9999-12-31';
      return ad.localeCompare(bd)||
        Date.parse(b.submitted_at)-Date.parse(a.submitted_at)||
        a.submission_id.localeCompare(b.submission_id);
    }
    return Date.parse(b.submitted_at)-Date.parse(a.submitted_at)||
      a.submission_id.localeCompare(b.submission_id);
  });
}
