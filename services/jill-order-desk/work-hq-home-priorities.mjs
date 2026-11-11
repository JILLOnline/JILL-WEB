// Derive bounded, PII-free priorities from the authenticated Owner's existing
// nine-field WORK request list. No network, writes, payments or inbox guessing.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
function priorityFor(r,today,threshold){
 if(!r||!ID.test(r.submission_id)||
  ['cancelled','completed'].includes(r.customer_status))return null;
 const due=typeof r.date_needed==='string'&&DAY.test(r.date_needed)&&
  !Number.isNaN(Date.parse(r.date_needed+'T12:00:00Z'))?r.date_needed:null;
 if(r.internal_status==='needs_quote')
  return {rank:0,attention:'Needs a quote',category:'needsQuote',due};
 if(due&&due<today)
  return {rank:1,attention:'Requested date passed',category:'pastDue',due};
 if(r.customer_status==='received')
  return {rank:2,attention:'New request',category:'newRequests',due};
 if(r.customer_status==='reviewing')
  return {rank:3,attention:'In review',category:'inReview',due};
 if(due&&due<=threshold)
  return {rank:4,attention:'Requested date approaching',category:'approaching',due};
 return null;
}
function priorityWindow(today){
 if(!DAY.test(today))return null;
 const time=Date.parse(today+'T12:00:00Z');
 if(Number.isNaN(time))return null;
 return new Date(time+3*86400000).toISOString().slice(0,10);
}
export function selectWorkHomePriorities(records,{today=new Date().toISOString().slice(0,10),limit=5}={}){
 if(!Array.isArray(records)||!DAY.test(today)||
  !Number.isInteger(limit)||limit<1||limit>10)return [];
 const threshold=priorityWindow(today);
 if(!threshold)return [];
 const list=[];
 for(const r of records.slice(0,50)){
  const priority=priorityFor(r,today,threshold);
  if(!priority)continue;
  list.push({submission_id:r.submission_id,customer_status:r.customer_status,
   date_needed:priority.due,attention:priority.attention,rank:priority.rank,
   updated_at:typeof r.updated_at==='string'?r.updated_at:''});
 }
 list.sort((a,b)=>a.rank-b.rank||
  (a.date_needed||'9999-12-31').localeCompare(b.date_needed||'9999-12-31')||
  (Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)||
  a.submission_id.localeCompare(b.submission_id));
 return list.slice(0,limit).map(({submission_id,customer_status,date_needed,attention})=>
  ({submission_id,customer_status,date_needed,attention}));
}
export function summarizeWorkHomePriorities(records,{today=new Date().toISOString().slice(0,10)}={}){
 if(!Array.isArray(records))return null;
 const threshold=priorityWindow(today);
 if(!threshold)return null;
 const counts={pastDue:0,newRequests:0,approaching:0};
 for(const record of records.slice(0,50)){
  const priority=priorityFor(record,today,threshold);
  if(priority&&Object.hasOwn(counts,priority.category))
   counts[priority.category]++;
 }
 return counts;
}
