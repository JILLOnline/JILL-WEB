// Derive bounded, PII-free priorities from the authenticated Owner's existing
// nine-field WORK request list. No network, writes, payments or inbox guessing.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export function selectWorkHomePriorities(records,{today=new Date().toISOString().slice(0,10),limit=5}={}){
 if(!Array.isArray(records)||!DAY.test(today)||
  !Number.isInteger(limit)||limit<1||limit>10)return [];
 const threshold=new Date(Date.parse(today+'T12:00:00Z')+3*86400000).toISOString().slice(0,10);
 const list=[];
 for(const r of records.slice(0,50)){
  if(!r||!ID.test(r.submission_id)||['cancelled','completed'].includes(r.customer_status))continue;
  const due=typeof r.date_needed==='string'&&DAY.test(r.date_needed)&&
   !Number.isNaN(Date.parse(r.date_needed+'T12:00:00Z'))?r.date_needed:null;
  let rank=9,attention='';
  if(r.internal_status==='needs_quote'){rank=0;attention='Needs a quote';}
  else if(due&&due<today){rank=1;attention='Requested date passed';}
  else if(r.customer_status==='received'){rank=2;attention='New request';}
  else if(r.customer_status==='reviewing'){rank=3;attention='In review';}
  else if(due&&due<=threshold){rank=4;attention='Requested date approaching';}
  if(!attention)continue;
  list.push({submission_id:r.submission_id,customer_status:r.customer_status,
   date_needed:due,attention,rank,updated_at:typeof r.updated_at==='string'?r.updated_at:''});
 }
 list.sort((a,b)=>a.rank-b.rank||
  (a.date_needed||'9999-12-31').localeCompare(b.date_needed||'9999-12-31')||
  (Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)||
  a.submission_id.localeCompare(b.submission_id));
 return list.slice(0,limit).map(({submission_id,customer_status,date_needed,attention})=>
  ({submission_id,customer_status,date_needed,attention}));
}
