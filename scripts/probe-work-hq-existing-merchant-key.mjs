// Probe the existing Google WORK QA merchant key. READ-ONLY.
// The operator copies the ALREADY SAVED Script Property from Google's
// Project Settings to the Windows clipboard. No new key, Cloudflare version,
// Apps Script deployment, D1 change, customer session, or Google sheet write.
// Never print or pass the key in a command-line argument or source file.
import {spawnSync,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {readWorkGoogleQaMerchantList} from '../services/jill-order-desk/work-google-merchant-read.mjs';
import {projectWorkMerchantInbox} from '../services/jill-order-desk/merchant-inbox-read.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const EXPECTED_SCRIPT='10Wnf8JaV1mUnXcGiO59UO7u_X8JKI3JJx_kqfE3S16rpvjAzgPBqhf0r';
const EXPECTED_SHEET='1T3xe_I3kfM6HtluXxq9PLjWp9XUBw1wvEOAAhiTq7OA';
const EXPECTED_REQUEST='jill:92b32355-900e-47ba-8946-ccd93190a3b7';

export function validateCopiedExistingKey(value) {
  // 48 random bytes produced a 64-character base64url key in the earlier
  // staging tool. Whitespace only from clipboard transport is removed.
  const key=typeof value==='string'?value.trim():'';
  if(!/^[A-Za-z0-9_-]{64}$/.test(key))
    throw Error('No valid existing WORK merchant key copied. STOP. Do not generate another key.');
  return key;
}
export function classifyGoogleMerchantEnvelope(value) {
  if(value?.ok===false) {
    const kind=value.error?.code;
    const code=['unauthorized','private_read_unavailable'].includes(kind)
      ? kind:'unexpected_google_error';
    return Object.freeze({ok:false,code});
  }
  if(value?.ok!==true)return Object.freeze({ok:false,code:'invalid_google_response'});
  try {
    const projection=projectWorkMerchantInbox(value);
    if(projection.state!=='ready' || !projection.requestsConnected ||
        projection.records.length<1 || projection.records.length>50 ||
        !projection.records.some(r=>r.submission_id===EXPECTED_REQUEST))
      return Object.freeze({ok:false,code:'incomplete_verified_records'});
    return Object.freeze({ok:true,requestCount:projection.records.length});
  } catch {
    return Object.freeze({ok:false,code:'invalid_google_projection'});
  }
}
export async function testExistingMerchantSecret({
  secret,reader=readWorkGoogleQaMerchantList,
  invalidKey=()=>randomBytes(48).toString('base64url'),
}={}) {
  const key=validateCopiedExistingKey(secret);
  const fake=invalidKey();
  if(typeof fake!=='string'||fake===key||!/^[A-Za-z0-9_-]{64}$/.test(fake))
    throw Error('Unable to create independent negative-control signature.');
  const denied=classifyGoogleMerchantEnvelope(await reader({secret:fake}));
  if(denied.code!=='unauthorized')
    return Object.freeze({ok:false,code:'bad_signature_not_denied'});
  return classifyGoogleMerchantEnvelope(await reader({secret:key}));
}
function clipboardText() {
  if(process.platform!=='win32')
    throw Error('This guided clipboard check is available only on Windows.');
  // The key travels by clipboard to memory, never by argv, env or file.
  const result=spawnSync('powershell.exe',[
    '-NoProfile','-NonInteractive','-Command',
    '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Clipboard -Raw',
  ],{encoding:'utf8',windowsHide:true,maxBuffer:4096});
  if(result.error||result.status!==0)
    throw Error('Could not read Windows clipboard.');
  return result.stdout;
}
function clearClipboardIfUnchanged(secret) {
  if(process.platform!=='win32')return;
  try {
    // Do not destroy a different clipboard entry the user copied meanwhile.
    if(validateCopiedExistingKey(clipboardText())!==secret)return;
    spawnSync('clip.exe',[],{
      input:'',encoding:'utf8',windowsHide:true,
      stdio:['pipe','ignore','ignore'],
    });
  } catch {
    // Clipboard may have changed. Never print its contents.
  }
}
function git(...args) {
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
const run=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
export function safeProbeStageCode(stage) {
  const codes=Object.freeze({
    git:'work_source_not_synced',
    qa:'local_qa_project_mismatch',
    clipboard_read:'clipboard_read_failed',
    clipboard_format:'clipboard_key_missing_or_invalid',
    signed_http:'signed_http_transport_failed',
  });
  return codes[stage]||'preflight_failed';
}
if(run) {
  let secret, stage='git';
  try {
    if(git('branch','--show-current')!=='jill/rewards-work' ||
       git('rev-parse','HEAD')!==git('rev-parse','refs/remotes/origin/jill/rewards-work') ||
       git('status','--porcelain','--untracked-files=no'))
      throw Error('WORK Git source must be clean and synced before private probe.');
    console.log('PASS clean and synced WORK Git source.');
    stage='qa';
    const fs=await import('node:fs');
    const qa=path.join(ROOT,'.work-custom-orders');
    const project=JSON.parse(fs.readFileSync(path.join(qa,'.qa-project.json'),'utf8'));
    const clasp=JSON.parse(fs.readFileSync(path.join(qa,'.clasp.json'),'utf8'));
    if(project.scriptId!==EXPECTED_SCRIPT||clasp.scriptId!==EXPECTED_SCRIPT ||
       project.sheetId!==EXPECTED_SHEET||project.shop!=='jill-work.myshopify.com')
      throw Error('Isolated Google WORK QA project identity mismatch.');
    console.log('PASS isolated Google WORK QA project identity.');
    stage='clipboard_read';
    const clipboard=clipboardText();
    stage='clipboard_format';
    secret=validateCopiedExistingKey(clipboard);
    console.log('PASS clipboard format for existing 64-character WORK key.');
    stage='signed_http';
    const result=await testExistingMerchantSecret({secret});
    if(!result.ok) {
      console.error('WORK QA HTTP PROBE STOPPED: '+result.code);
      process.exitCode=1;
    } else {
      console.log('PASS invalid HMAC denied by WORK Google QA.');
      console.log('PASS existing Script Property key authenticates signed /exec.');
      console.log('PASS '+result.requestCount+' bounded canonical WORK requests.');
      console.log('PASS existing My JILL request found in read-only projection.');
      console.log('No Google/Cloudflare deployment, secret rotation, staging, or LIVE changes.');
    }
  } catch {
    // Never print raw exceptions, clipboard values, or server responses:
    // Google transport exceptions may contain private request details.
    console.error('WORK QA HTTP PROBE STOPPED: '+safeProbeStageCode(stage));
    process.exitCode=1;
  } finally {
    if(secret)clearClipboardIfUnchanged(secret);
    secret=undefined;
  }
}
