// Frozen 11-file WORK HQ presentation package; no provider mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ORDER_DETAILS_FILES} from './work-hq-order-details-package.mjs';
import {DENSITY_RUNTIME_BASE,prepareReviewedPresentationBuild} from './work-hq-density-package.mjs';
import {studioDigest} from './check-work-hq-studio-only.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const EXTRA='services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx';
export const INBOX_POLISH_FILES=Object.freeze([...ORDER_DETAILS_FILES,EXTRA]);
export const INBOX_POLISH_BLOBS=Object.freeze({
  'services/jill-order-desk/app-home/app/routes/app.index.tsx':'8521646544cd58c9e0b823e2dd92fce657677c7c',
  'services/jill-order-desk/app-home/app/styles/hq-home.css':'90a7038c5e33c84d4d1568a144dc73870610b701',
  'services/jill-order-desk/app-home/app/styles/hq-theme.css':'d7943a283a348046531bf862aa46677cd6045bec',
  'services/jill-order-desk/app-home/app/styles/inbox.css':'0b3eff5140d5930e5558990ec9ef3d3682f62768',
  'services/jill-order-desk/app-home/app/styles/quote-worksheet.css':'7e5116868320cb18eb9915bda884cb417528df18',
  'services/jill-order-desk/app-home/app/styles/request-actions.css':'e415e727171b0fbde8eac0bab1493f2a492a29d3',
  'services/jill-order-desk/app-home/app/styles/request-detail.css':'d423d2cf1d02108cbee4bdb23cf52e9b42729974',
  'services/jill-order-desk/app-home/app/routes/app.requests.tsx':'b6553646637aa8d78cf853f6f8094442e8be0d01',
  'services/jill-order-desk/app-home/app/routes/app.requests.$submissionId.tsx':'dbcdab1c33db3c5c775223676579fa1332a790b8',
  'services/jill-order-desk/app-home/app/components/WorkOriginalRequestDetails.tsx':'b8db152678670d926c5a4e2eab99070e965c0413',
  'services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx':'d2831a1f53df6699512988e9cca5845760956855',
});
const normalize=s=>s.replace(/\r\n?/g,'\n');
const gitBlob=s=>{
  const body=normalize(s);
  return createHash('sha1').update('blob '+Buffer.byteLength(body)+String.fromCharCode(0)).update(body).digest('hex');
};
const sourceFile=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
export function checkWorkHqInboxPolish(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],{encoding:'utf8'}).trim();
  assert.equal(branch,'jill/rewards-work');
  assert.deepEqual(Object.keys(INBOX_POLISH_BLOBS).sort(),[...INBOX_POLISH_FILES].sort());
  for(const [file,sha] of Object.entries(INBOX_POLISH_BLOBS)){
    const source=sourceFile(file);
    assert.equal(gitBlob(source),sha,'Frozen inbox polish source changed: '+file);
    if(file.endsWith('.css'))
      assert(!/!important|\bzoom\s*:|scale\(|\.Polaris|::part\(/i.test(source),'Forbidden visual override: '+file);
  }
  const route=sourceFile('services/jill-order-desk/app-home/app/routes/app.requests.tsx');
  const actions=sourceFile(EXTRA);
  assert.match(route,/<summary>ORDER DETAILS/);
  assert.doesNotMatch(route,/jill-inbox__facts|jill-inbox__open|Open request/);
  assert.match(route,/orderDetails\.load\("\/app\/requests\/"\+encodeURIComponent\(item\.submission_id\)\)/);
  assert.match(actions,/\{compact&&<Link className="jill-actions__open-link"/);
  assert.match(actions,/to=\{"\/app\/requests\/"\+encodeURIComponent\(record\.submission_id\)\}/);
  assert.match(actions,/fetcher\.submit\(payload/);
  assert.match(actions,/action:"\/app\/requests\/command"/);
  const styles=sourceFile('services/jill-order-desk/app-home/app/styles/request-actions.css');
  assert.match(styles,/\.jill-actions--compact \.jill-actions__heading strong/);
  assert.match(styles,/min-height:44px/);
  return {environment:'WORK',scope:'frozen_request_presentation_plus_existing_on_open_read',
    reviewed_files:INBOX_POLISH_FILES.length,source_locked:true,
    overlay_only:true,no_backend_extensions_theme_or_quote_logic:true};
}
export function inboxPolishManifest(){
  checkWorkHqInboxPolish();
  return {runtime_baseline:DENSITY_RUNTIME_BASE,
    files:Object.fromEntries(INBOX_POLISH_FILES.map(file=>[file,studioDigest(sourceFile(file))]))};
}
export function prepareInboxPolishBuild({runner}={}){
  return prepareReviewedPresentationBuild({runner,manifest:inboxPolishManifest(),
    guard:checkWorkHqInboxPolish,prefix:'inbox-polish-package-'});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqInboxPolish(),null,2));
