// JILL HQ WORK read-only Owner queue. One verified nine-field source; zero writes.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const STATUS=new Set(['received','reviewing','awaiting_approval','in_production','ready_pickup','on_hold','cancelled','completed']);
const STAGE=new Set(['new','needs_quote','waiting_customer','materials_ordered','proof_revision','printing','assembly','quality_check','ready','none']);
const GROUPS=['quote','waiting_customer','production','ready','review','on_hold','closed'];
const GROUP_RANK={quote:0,waiting_customer:1,production:2,ready:3,review:4,on_hold:5,closed:6};
const OUT_KEYS=['submission_id','revision','customer_status','internal_status','date_needed','item_count','fulfillment','updated_at','group','due_in_days','urgency'];
const date=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return null;const t=Date.parse(x+'T00:00:00.000Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===x?t:null;};
const held=reason=>({state:reason,as_of_date:null,summary:null,records:[],source_verified:false,can_mutate:false});
export function workStoreCalendarDate(now=new Date()){if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('invalid_clock');const x=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const d=Object.fromEntries(x.map(v=>[v.type,v.value]));return [d.year,d.month,d.day].join('-');}
const group=r=>r.customer_status==='cancelled'||r.customer_status==='completed'?'closed':r.customer_status==='on_hold'?'on_hold':r.customer_status==='ready_pickup'||r.internal_status==='ready'?'ready':r.internal_status==='needs_quote'?'quote':r.customer_status==='awaiting_approval'||['waiting_customer','proof_revision'].includes(r.internal_status)?'waiting_customer':r.customer_status==='in_production'||['materials_ordered','printing','assembly','quality_check'].includes(r.internal_status)?'production':'review';
const valid=r=>r&&typeof r==='object'&&!Array.isArray(r)&&ID.test(r.submission_id||'')&&Number.isSafeInteger(r.revision)&&r.revision>0&&r.revision<=100&&STATUS.has(r.customer_status)&&STAGE.has(r.internal_status)&&typeof r.submitted_at==='string'&&Number.isFinite(Date.parse(r.submitted_at))&&typeof r.updated_at==='string'&&Number.isFinite(Date.parse(r.updated_at))&&Date.parse(r.updated_at)>=Date.parse(r.submitted_at)&&typeof r.date_needed==='string'&&(r.date_needed===''||date(r.date_needed)!==null)&&['','pickup','shipping'].includes(r.fulfillment)&&Number.isSafeInteger(r.item_count)&&r.item_count>0&&r.item_count<=500;
export function planWorkHqFocusQueue(source,{asOfDate}={}){
 if(source?.state!=='ready'||source?.readOnly!==true||source?.requestsConnected!==true)return held('source_unverified');
 const today=date(asOfDate);if(today===null||!Array.isArray(source.records)||source.records.length>50)return held('invalid_source');
 const seen=new Set(),queue=[];for(const r of source.records){if(!valid(r)||seen.has(r.submission_id))return held('invalid_source');seen.add(r.submission_id);
 const g=group(r);const days=r.date_needed?Math.round((date(r.date_needed)-today)/86400000):null;
 const urgency=g==='closed'?'closed':days===null?'date_not_supplied':days<0?'requested_date_passed':days===0?'requested_today':days<=7?'requested_within_week':'scheduled';
 const rank=g==='closed'?5:urgency==='requested_date_passed'?0:urgency==='requested_today'?1:urgency==='requested_within_week'?2:urgency==='scheduled'?3:4;
 queue.push({submission_id:r.submission_id,revision:r.revision,customer_status:r.customer_status,internal_status:r.internal_status,date_needed:r.date_needed,item_count:r.item_count,fulfillment:r.fulfillment,updated_at:r.updated_at,group:g,due_in_days:days,urgency,_sort:rank});}
 queue.sort((a,b)=>a._sort-b._sort||GROUP_RANK[a.group]-GROUP_RANK[b.group]||(a.date_needed||'9999').localeCompare(b.date_needed||'9999')||Date.parse(b.updated_at)-Date.parse(a.updated_at)||a.submission_id.localeCompare(b.submission_id));
 const groups=Object.fromEntries(GROUPS.map(k=>[k,0]));let active=0,soon=0,past=0;
 const rows=queue.map(({_sort,...r})=>{groups[r.group]++;if(r.group!=='closed'){active++;if(['requested_today','requested_within_week'].includes(r.urgency))soon++;if(r.urgency==='requested_date_passed')past++;}return Object.freeze(r);});
 return Object.freeze({state:'ready',as_of_date:asOfDate,summary:Object.freeze({total:rows.length,active,requested_within_7_days:soon,requested_date_passed:past,groups:Object.freeze(groups)}),records:Object.freeze(rows),source_verified:true,can_mutate:false,unread_verified:false,shopify_stock_verified:false});
}
export function filterWorkHqFocusQueue(queue,{group='active',urgency='all',search=''}={}){
 const fail=reason=>({state:'held',reason,records:[],shown:0,in_group:0});
 if(queue?.state!=='ready'||queue.source_verified!==true||!Array.isArray(queue.records)||queue.records.length>50||!['active',...GROUPS].includes(group)||!['all','overdue','today','next_week','no_date'].includes(urgency)||typeof search!=='string'||search.length>100||/[\x00-\x1f\x7f]/.test(search)||queue.records.some(r=>!r||typeof r!=='object'||Object.keys(r).some(k=>!OUT_KEYS.includes(k))||!ID.test(r.submission_id||'')||!GROUPS.includes(r.group)))return fail('unverified_queue');
 const grouped=queue.records.filter(r=>group==='active'?r.group!=='closed':r.group===group),term=search.trim().toLowerCase();
 const records=grouped.filter(r=>(urgency==='all'||urgency==='overdue'&&r.urgency==='requested_date_passed'||urgency==='today'&&r.urgency==='requested_today'||urgency==='next_week'&&['requested_today','requested_within_week'].includes(r.urgency)||urgency==='no_date'&&r.urgency==='date_not_supplied')&&(!term||r.submission_id.toLowerCase().includes(term)));
 return Object.freeze({state:'ready',records:Object.freeze(records),shown:records.length,in_group:grouped.length});
}
