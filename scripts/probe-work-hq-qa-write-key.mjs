// Non-mutating HMAC match proof for the VERIFIED WORK QA /exec.
// The signed operation has kind "diagnostic": the Apps Script handler
// rejects it BEFORE calling the canonical event writer or email outbox.
// No keys in args, environment, stdout, source control or remote properties.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {privateWorkWriteKey} from './stage-work-hq-write-key.mjs';
import {verifyLocalWorkQaIdentity}
  from './audit-work-qa-script-readonly.mjs';
import {signWorkMerchantCommand}
  from '../services/jill-order-desk/merchant-command.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SHOP='jill-work.myshopify.com';
const MAX_RESPONSE=4096;
export function assertNonMutatingQaHandler(source) {
  if(typeof source!=='string')throw Error('uncertified_qa_handler');
  const begin=source.indexOf('function jillWorkHqMerchantCommand_(e) {');
  const end=source.indexOf('/* END WORK HQ MERCHANT COMMAND V1 */',begin);
  if(begin<0||end<begin)throw Error('uncertified_qa_handler');
  const handler=source.slice(begin,end);
  const kindCheck=handler.indexOf("!['status','message'].includes(kind)");
  const writer=handler.indexOf('jillCustomOrderMerchantUpdateAsActor_(');
  const queue=handler.indexOf('jillWorkHqQueueEmail_(');
  if(kindCheck<0||writer<0||queue<0||kindCheck>writer||
     kindCheck>queue || !handler.includes("return failed('invalid_command')"))
    throw Error('uncertified_qa_handler');
  return true;
}
export function makeNonMutatingProbe({secret,now=Date.now,
  makeUuid=randomUUID,makeNonce=()=>randomBytes(24).toString('base64url')}={}) {
  const timestamp=String(now());
  const nonce=makeNonce();
  const command={
    kind:'diagnostic', // Signed and AUTHENTICATED, but cannot mutate.
    submission_id:'jill:non-mutating-diagnostic',
    operation_id:'jill:hq:status:'+makeUuid(),
    expected_revision:1,current_status:'received',
    customer_status:'received',internal_status:'new',
    public_note:'',internal_note:'',handoff_reference:'',
  };
  const signature=signWorkMerchantCommand({
    command,staffId:'1',timestamp,nonce,secret,
  });
  const body=new URLSearchParams({
    jill_order_merchant_command:'1',shop:SHOP,
    ...Object.fromEntries(Object.entries(command).map(([key,value])=>[
      key,String(value)
    ])),
    jill_hq_write_ts:timestamp,jill_hq_write_nonce:nonce,
    jill_hq_write_staff:'1',jill_hq_write_sig:signature,
  });
  return body;
}
export async function probeWorkHqQaWriteKey({
  secret,backendFetch=fetch,now=Date.now,
  makeUuid=randomUUID,makeNonce=()=>randomBytes(24).toString('base64url'),
}={}) {
  const body=makeNonMutatingProbe({secret,now,makeUuid,makeNonce});
  const response=await backendFetch(JILL_HQ_WORK_QA_GOOGLE_URL,{
    method:'POST',redirect:'follow',
    headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
      accept:'application/json'},
    body,signal:AbortSignal.timeout(15000),
  });
  if(!response?.ok)throw Error('qa_endpoint_unavailable');
  const content=await response.text();
  if(content.length>MAX_RESPONSE)throw Error('qa_ack_unrecognized');
  let data;
  try{data=JSON.parse(content);}catch{throw Error('qa_ack_unrecognized');}
  if(data?.version!==1 ||
     data.operation!=='custom_order.merchant.command.result' ||
     data.ok!==false || typeof data.error?.code!=='string')
    throw Error('qa_ack_unrecognized');
  // A verified signature reaches "invalid_command", before the write.
  if(data.error.code==='invalid_command')return {matched:true,mutated:false};
  if(data.error.code==='unauthorized')return {matched:false,mutated:false};
  throw Error('qa_ack_unrecognized');
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{
      encoding:'utf8'}).trim();
    if(git('branch','--show-current')!=='jill/rewards-work' ||
       git('status','--porcelain','--untracked-files=no') ||
       git('rev-parse','HEAD')!==
         git('rev-parse','refs/remotes/origin/jill/rewards-work'))
      throw Error('work_source_not_synced');
    verifyLocalWorkQaIdentity(ROOT);
    const code=fs.readFileSync(path.join(ROOT,
      'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs'),
    'utf8');
    assertNonMutatingQaHandler(code);
    const {full,folder}=localFilePath({repo:ROOT});
    if(!fs.existsSync(full)||fs.lstatSync(full).isSymbolicLink()||
       fs.lstatSync(folder).isSymbolicLink())
      throw Error('missing_local_private_vault');
    const key=privateWorkWriteKey(fs.readFileSync(full,'utf8'));
    const result=await probeWorkHqQaWriteKey({secret:key});
    if(!result.matched)throw Error('qa_write_key_missing_or_mismatched');
    console.log('PASS signed WORK QA write-key handshake.');
    console.log('PASS Google verified the dedicated local WORK key.');
    console.log('PASS diagnostic rejected BEFORE order events or mail outbox.');
    console.log('No status writes, customer messages, email or LIVE changes.');
  }catch(err){
    const allowed=new Set([
      'work_source_not_synced','uncertified_qa_handler',
      'missing_local_private_vault','qa_write_key_missing_or_mismatched',
      'qa_endpoint_unavailable','qa_ack_unrecognized',
    ]);
    console.error('WORK HQ QA key handshake STOPPED: '+
      (allowed.has(err?.message)?err.message:'qa_identity_or_connection_unverified'));
    process.exitCode=1;
  }
}
