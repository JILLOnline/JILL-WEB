// WORK HQ: honor only an acknowledged original merchant message operation.
// An uncertain, failed or stale response is NOT confirmation of a send.
const OP=/^jill:hq:message:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export function verifiedMerchantMessageAcknowledgment({result,previousRevision}={}){
  if(result?.ok!==true||typeof result.operation_id!=='string'||
     !OP.test(result.operation_id)||
     !Number.isSafeInteger(previousRevision)||previousRevision<1||
     !Number.isSafeInteger(result.revision)||
     result.revision<=previousRevision||result.revision>100)
    return null;
  return Object.freeze({operation_id:result.operation_id,
    revision:result.revision});
}
