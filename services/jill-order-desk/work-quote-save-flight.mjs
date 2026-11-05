// Browser recovery metadata only. D1 receipts/CAS remain authoritative.
// One Owner/request marker survives remount/reload; Web Locks serialize tabs.
// Never store prices, quote payloads, customer fields or credentials here.
const OP=/^jill:hq:quote:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
export function validWorkQuotePendingSave(value){
 return value!==null&&typeof value==='object'&&
  Object.keys(value).sort().join(',')==='expectedDraftRevision,operationId,sourceRevision'&&
  OP.test(value.operationId||'')&&
  Number.isSafeInteger(value.expectedDraftRevision)&&
  value.expectedDraftRevision>=0&&value.expectedDraftRevision<100&&
  Number.isSafeInteger(value.sourceRevision)&&
  value.sourceRevision>=1&&value.sourceRevision<=100;
}
/** @param {{scope?:string,submissionId?:string,storage?:any,locks?:any}} [options] */
export function createWorkQuoteSaveFlight({scope,submissionId,
 storage=globalThis.localStorage,locks=globalThis.navigator?.locks}={}){
 if(!/^[a-f0-9]{64}$/.test(scope||'')||!ID.test(submissionId||'')||
    typeof storage?.getItem!=='function'||typeof storage?.setItem!=='function'||
    typeof storage?.removeItem!=='function'||typeof locks?.request!=='function')
  throw Error('quote_recovery_unavailable');
 const key='jill:work:quote-flight:'+scope+':'+submissionId;
 let acquiring=false;
 const pending=()=>{
  const raw=storage.getItem(key);
  if(raw===null)return null;
  if(raw.length>512)throw Error('quote_recovery_unverified');
  const value=JSON.parse(raw);
  if(!validWorkQuotePendingSave(value))throw Error('quote_recovery_unverified');
  return Object.freeze(value);
 };
 return Object.freeze({scope,pending,
  isReserved(){try{return acquiring||pending()!==null;}catch{return true;}},
  async reserve(value){
   if(!validWorkQuotePendingSave(value))throw Error('quote_recovery_unverified');
   if(acquiring)return false;
   acquiring=true;
   try{return await locks.request(key,()=>{
    if(pending()!==null)return false;
    storage.setItem(key,JSON.stringify(value));
    const stored=pending();
    if(stored?.operationId!==value.operationId)
     throw Error('quote_recovery_unverified');
    return true;
   });}finally{acquiring=false;}
  },
  async verifiedRelease(proof){
   return locks.request(key,()=>{
    const value=pending();
    if(!value||proof?.operation_id!==value.operationId||
       proof.expected_draft_revision!==value.expectedDraftRevision||
       !['committed','not_applied'].includes(proof.state))return false;
    storage.removeItem(key);
    if(pending()!==null)throw Error('quote_recovery_unverified');
    return true;
   });
  },
 });
}
