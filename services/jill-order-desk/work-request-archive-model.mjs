// Pure WORK merchant presentation. Canonical source rows are never deleted.
export const WORK_ARCHIVE_STATUSES=Object.freeze(['cancelled','completed']);
export const WORK_ARCHIVE_VIEWS=Object.freeze(['active','archive']);
const ARCHIVED=new Set(WORK_ARCHIVE_STATUSES);
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
/** @param {Array<{submission_id:string,customer_status:string}>} records
 * @param {{removedIds?:string[]}} [options] */
export function partitionWorkRequests(records,{removedIds=[]}={}){
  if(!Array.isArray(records)||!Array.isArray(removedIds)||
     records.length>50||removedIds.length>50 ||
     removedIds.some(id=>typeof id!=='string'||!ID.test(id)))
    throw Error('invalid_work_archive_projection');
  const removed=new Set(removedIds);
  const active=[],archive=[];
  for(const record of records){
    if(!record||typeof record.submission_id!=='string'||
       !ID.test(record.submission_id))
      throw Error('invalid_work_archive_record');
    (removed.has(record.submission_id)||
      ARCHIVED.has(record.customer_status)?archive:active).push(record);
  }
  return Object.freeze({
    active:Object.freeze(active),
    archive:Object.freeze(archive),
    removed_count:archive.filter(r=>removed.has(r.submission_id)).length,
    cancelled_count:archive.filter(r=>r.customer_status==='cancelled').length,
    completed_count:archive.filter(r=>r.customer_status==='completed').length,
  });
}
/** @param {{submission_id?:string,customer_status?:string}|undefined} record
 * @param {string[]} [removedIds] */
export function archiveReason(record,removedIds=[]){
  if(removedIds.includes(record?.submission_id))return 'Removed';
  if(record?.customer_status==='cancelled')return 'Cancelled';
  if(record?.customer_status==='completed')return 'Completed';
  return null;
}
export const WORK_ARCHIVE_FILTERS=Object.freeze([
  ['all','All archive records'],['cancelled','Cancelled'],
  ['completed','Completed'],['removed','Removed'],
]);
/** @param {ReadonlyArray<{submission_id:string,customer_status:string}>} records
 * @param {string} [category] @param {string[]} [removedIds] */
export function filterArchivedRequests(records,category='all',removedIds=[]){
  if(!WORK_ARCHIVE_FILTERS.some(([v])=>v===category))
    throw Error('invalid_archive_category');
  if(category==='all')return records;
  return records.filter(row=>{
    const reason=archiveReason(row,removedIds);
    return reason?.toLowerCase()===category;
  });
}
