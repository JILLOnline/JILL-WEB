// One-time local receipt for the separately approved SECOND WORK v35 0%
// deployment. This file contains NO secrets or customer data.
// A write-attempt reservation is never deleted automatically, even when
// Wrangler times out or the rollout rolls back: never retry unknowingly.
import {mkdirSync,openSync,writeFileSync,fsyncSync,closeSync}
  from 'node:fs';
import {dirname,join,isAbsolute} from 'node:path';

const fail=reason=>{throw Error('work_quote_once_'+reason);};
export const RECEIPT_FILE='work-quote-v35-second-0pct-attempt-20261017.json';
export function ownerReceiptPath(localAppData){
  if(typeof localAppData!=='string'||!isAbsolute(localAppData))
    fail('private_localappdata_unverified');
  return join(localAppData,'JILL-WEB','private-release-receipts',RECEIPT_FILE);
}
export function reserveOneDeploymentAttempt({
  filepath,worker,active,candidate,source,baselineDeployment,
}={}){
  if(typeof filepath!=='string'||!isAbsolute(filepath)||
    !filepath.endsWith(RECEIPT_FILE)||
    worker!=='jill-order-desk-canary-work'||
    active!=='4973b74d-d479-41da-897c-e36129303279'||
    candidate!=='dbc6341f-de7f-41de-8e97-6bf971201eeb'||
    source!=='4e4acfcc56e8b3ecb558fc7e10c80301f1cc0d9b'||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(
      baselineDeployment||''))
    fail('reservation_inputs_unverified');
  // Modeled after Windows NTFS O_EXCL; atomic 'wx' prevents concurrent
  // reservation, and an existing record prevents another deployment.
  mkdirSync(dirname(filepath),{recursive:true,mode:0o700});
  let fd;
  try{
    fd=openSync(filepath,'wx',0o600);
    const receipt={
      operation:'work_quote_v35_second_zero_percent_attempt',
      worker,active,candidate,source,baselineDeployment,
      reservedAt:new Date().toISOString(),
      canAutomaticallyRetry:false,
    };
    writeFileSync(fd,JSON.stringify(receipt,null,2)+'\n','utf8');
    fsyncSync(fd);
  }catch{
    fail('already_used_or_local_receipt_unavailable');
  }finally{
    if(fd!==undefined)closeSync(fd);
  }
  return Object.freeze({reserved:true,canAutomaticallyRetry:false});
}
