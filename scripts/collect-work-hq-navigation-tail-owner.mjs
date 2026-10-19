// Read-only ephemeral log subscription. No upload, activation, signed POST,
// business command, secret read-back, storage service, or receipt mutation.
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {sourceGuard,allocation,HQ_WORKER,safeCloudReadFailure} from './stage-work-hq-connected-read-owner.mjs';
import {observeNavigationTail,readNavigationTailProbe,verifyNavigationTailBaseline,EXPECTED_HQ_VERSION,TAIL_STOP_PRELOAD} from './work-hq-navigation-tail.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
// Use the installed CLI entry directly: one child with a graceful IPC stop.
const CLI=path.join(APP,'node_modules/wrangler/wrangler-dist/cli.js');
export async function captureNavigationTail(){
 const runner=sourceGuard();verifyNavigationTailBaseline(allocation());
 const child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(TAIL_STOP_PRELOAD),CLI,
  'tail',HQ_WORKER,'--config','./wrangler.canary.jsonc','--format','json'],{
  cwd:APP,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],
  env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'},
 });
 console.log('Checking the WORK log stream with unsigned health GETs. Wait for READY before reproducing the hang.');
 const session=await observeNavigationTail({child,probeNonce:randomUUID(),probe:readNavigationTailProbe,
  onReady:()=>console.log('READY — log stream verified. Capture runs for 75 seconds now. Reproduce Home → Requests → detail → back. If loading hangs, wait 20 seconds, refresh once, and let capture finish. No writes needed.'),
 });
 let baselineUnchanged=false;
 try{verifyNavigationTailBaseline(allocation());baselineUnchanged=true;}catch{}
 const applicationRecords=session.records.filter(record=>record.route!=='diagnostic_probe');
 const commandFailed=Boolean(session.result.error)||
  (Number.isInteger(session.result.status)&&session.result.status!==0)||!session.stopRequested;
 const report={environment:'WORK',mode:'read_only',runner,expected_runtime:EXPECTED_HQ_VERSION,
  allocation_unchanged:baselineUnchanged,
  capture_outcome:!session.ready?'log_stream_self_check_failed':commandFailed||session.forced?'tail_command_failed':applicationRecords.length?'application_events_captured':'no_application_events_captured',
  log_stream_verified:session.ready,
  health_probe:{exact_runtime_verified:session.probe_verified,matching_tail_event_seen:session.probe_event_seen,
   version_mismatch_seen:session.probe_version_mismatch,attempts:session.probe_attempts},
  tail_events_received:session.records.length,application_events_received:applicationRecords.length,
  input_diagnostics:session.metrics,dropped_events:session.dropped,
  graceful_stop_requested:session.stopRequested,forced_child_stop:session.forced,
  tail_command_failure:commandFailed?safeCloudReadFailure({...session.result,stderr:session.stderr}):null,
  records:applicationRecords,raw_tail_printed:false,raw_tail_saved:false,no_upload_or_deployment:true,
  no_signed_post:true,no_receipt_changes:true,root_cause_verified:false,operational_acceptance:false};
 console.log(JSON.stringify(report,null,2));
 if(!baselineUnchanged||!session.ready||!applicationRecords.length||session.forced||commandFailed)process.exitCode=1;
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
