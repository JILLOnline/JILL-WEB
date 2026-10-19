// Read-only ephemeral log subscription. No upload, activation, signed POST,
// business command, secret read-back, storage service, or receipt mutation.
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {sourceGuard,allocation,HQ_WORKER,safeCloudReadFailure} from './stage-work-hq-connected-read-owner.mjs';
import {navigationTailParser,verifyNavigationTailBaseline,EXPECTED_HQ_VERSION,TAIL_STOP_PRELOAD} from './work-hq-navigation-tail.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
// Use the installed CLI entry directly: one child with a graceful IPC stop.
const CLI=path.join(APP,'node_modules/wrangler/wrangler-dist/cli.js');
export async function captureNavigationTail(){
 const runner=sourceGuard();verifyNavigationTailBaseline(allocation());
 const records=[];let dropped=0,stderr='',forced=false,stopRequested=false,closed=false;
 const child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(TAIL_STOP_PRELOAD),CLI,
  'tail',HQ_WORKER,'--config','./wrangler.canary.jsonc','--format','json'],{
  cwd:APP,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],
  env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'},
 });
 const parse=navigationTailParser(record=>{
  if(records.length<400)records.push(record);else dropped++;
 });
 child.stdout.on('data',parse);
 child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-8192);});
 let forceTimer;
 const stop=()=>{
  if(stopRequested||closed)return;stopRequested=true;
  if(child.connected)child.send('JILL_WORK_TAIL_STOP',()=>{});
  forceTimer=setTimeout(()=>{if(!closed){forced=true;child.kill();}},10000);
 };
 const onInterrupt=()=>stop();process.on('SIGINT',onInterrupt);process.on('SIGTERM',onInterrupt);
 console.log('WORK read-only capture started (75 seconds). Allow 5 seconds to connect, then switch Home → Requests → detail → back until the hang appears. If it hangs, wait 20 seconds, refresh once, then let this finish. No writes needed.');
 const timer=setTimeout(stop,75000);
 const result=await new Promise(resolve=>{
  child.once('error',error=>resolve({error}));
  child.once('close',(status,signal)=>{closed=true;resolve({status,signal});});
 });
 clearTimeout(timer);clearTimeout(forceTimer);
 process.removeListener('SIGINT',onInterrupt);process.removeListener('SIGTERM',onInterrupt);
 let baselineUnchanged=false;
 try{verifyNavigationTailBaseline(allocation());baselineUnchanged=true;}catch{}
 const report={environment:'WORK',mode:'read_only',runner,expected_runtime:EXPECTED_HQ_VERSION,
  allocation_unchanged:baselineUnchanged,tail_events_received:records.length,dropped_events:dropped,
  graceful_stop_requested:stopRequested,forced_child_stop:forced,
  tail_command_failure:!stopRequested||result.error?safeCloudReadFailure({...result,stderr}):null,
  records,raw_tail_printed:false,raw_tail_saved:false,no_upload_or_deployment:true,
  no_signed_post:true,no_receipt_changes:true,root_cause_verified:false,operational_acceptance:false};
 console.log(JSON.stringify(report,null,2));
 if(!baselineUnchanged||!records.length||forced||result.error||!stopRequested)process.exitCode=1;
 return report;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==2){console.error('STOP work_hq_tail_no_arguments_allowed');process.exitCode=1;}
 else try{await captureNavigationTail();}catch(error){
  const known=new Set(['work_hq_tail_baseline_changed','work_hq_connected_owner_windows_required',
   'work_hq_connected_source_not_clean_and_synced','work_hq_connected_local_wrangler_missing',
   'work_hq_connected_cloudflare_read_unverified']);
  console.error(JSON.stringify({environment:'WORK',phase:'preflight',
   reason:known.has(error?.message)?error.message:'work_hq_tail_preflight_unverified',
   cloudflare_read:error?.safeCliDiagnostic||null,no_application_changes_requested:true}));
  process.exitCode=1;
 }
}
