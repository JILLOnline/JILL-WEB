// SOURCE-ONLY review: new Owner search/soft-archive are backend features.
// Unlike prior 13-file VISUAL overlays, this is NOT safe for UI-only release.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {REQUEST_CARD_FLOW_PACKAGE_BLOBS}
  from './work-hq-request-card-flow-package.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ARCHIVE_SEARCH_CHANGED_BLOBS=Object.freeze({
  "services/jill-order-desk/app-home/app/routes/app.requests.tsx": "35caf0e082a875ad46f851b72947371616ec368b",
  "services/jill-order-desk/app-home/app/styles/inbox.css": "73021e0ca94cb6b35c535fdcc68d1bcbcacb06fe",
  "services/jill-order-desk/app-home/app/routes.ts": "825f38d4b9346ad1d30b9450cf25eea4c9a83798",
  "services/jill-order-desk/app-home/app/routes/app.requests.archive.tsx": "80fb344bc06d9b554874c0c0653021666674ffb1",
  "services/jill-order-desk/app-home/app/routes/app.requests.search.tsx": "50e11bf07befbf64304bef3dd32412c1704def19",
  "services/jill-order-desk/work-request-archive-model.mjs": "8b5df67fb158b7e3a6d63d980a9d234ff03f0810",
  "services/jill-order-desk/work-request-archive-store.mjs": "a791321f9051a7d3c642f5cf77389f92da908706",
  "services/jill-order-desk/work-request-detail-search.mjs": "adc423df9e7f34118677fdde0a7c5c912fd6721b",
  "services/jill-order-desk/work-request-detail-search-action.mjs": "bc73afa2b69d6700d51c0151e1e11e4fe2ab5415",
  "services/jill-order-desk/archive-proposals/0010_work_request_soft_archive.sql": "e6f8b2f8b23680919c82acc1c732ed9815b5e163"
});
export const ARCHIVE_SEARCH_BLOBS=Object.freeze({
  ...REQUEST_CARD_FLOW_PACKAGE_BLOBS,
  ...ARCHIVE_SEARCH_CHANGED_BLOBS,
});
const gitBlob=source=>{
  const text=source.replace(/\r\n?/g,'\n');
  return createHash('sha1').update('blob '+Buffer.byteLength(text)+
    String.fromCharCode(0)).update(text,'utf8').digest('hex');
};
export function checkWorkHqArchiveSearchSource(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],
    {encoding:'utf8'}).trim();
  const ci=branch===''&&process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    process.env.GITHUB_EVENT_NAME==='pull_request'&&
    process.env.GITHUB_HEAD_REF==='jill/rewards-work';
  assert(branch==='jill/rewards-work'||ci,'Wrong WORK source branch');
  assert.equal(Object.keys(ARCHIVE_SEARCH_CHANGED_BLOBS).length,10);
  for(const [file,sha] of Object.entries(ARCHIVE_SEARCH_BLOBS)){
    const text=fs.readFileSync(path.join(ROOT,file),'utf8');
    assert.equal(gitBlob(text),sha,'ARCHIVE/SEARCH SOURCE DRIFT: '+file);
    if(file.endsWith('.css'))assert.doesNotMatch(text,/!important|@import|url\(/i);
  }
  const files=Object.keys(ARCHIVE_SEARCH_BLOBS);
  assert.equal(files.length,21);
  const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
  const route=read('services/jill-order-desk/app-home/app/routes/app.requests.tsx');
  const search=read('services/jill-order-desk/work-request-detail-search-action.mjs');
  const archive=read('services/jill-order-desk/work-request-archive-store.mjs');
  const schema=read('services/jill-order-desk/archive-proposals/0010_work_request_soft_archive.sql');
  assert.match(route,/partitionWorkRequests/);
  assert.match(route,/startFullSearch/);
  assert.match(route,/Search next 6 requests/);
  assert.match(route,/ArchiveControl/);
  assert.match(route,/JILL HQ Custom Orders/);
  assert.match(search,/readWorkMerchantPermission/);
  assert.match(search,/DETAIL_SEARCH_PAGE_SIZE/);
  assert.match(search,/Promise\.all/);
  assert.match(search,/input\.tag/);
  assert.doesNotMatch(search,/console\.|raw_payload|localStorage/i);
  assert.match(archive,/readWorkMerchantPermission/);
  assert.match(archive,/jill_work_request_archive_operations/);
  assert.match(archive,/archive_not_enabled/);
  assert.doesNotMatch(archive,/DELETE FROM|DROP TABLE|sendEmail|shopify\.order/i);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS jill_work_request_archive/);
  return {environment:'WORK',phase:'SOURCE_ONLY_HOLD',
    exact_files:files.length,changed_files:10,
    canonical_orders_deleted:false,private_data_indexed:false,
    full_detail_search_bounded:true,
    removed_archive_requires_separate_D1_approval:true,
    safe_to_use_historical_visual_release:false};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqArchiveSearchSource(),null,2));
