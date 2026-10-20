// WORK HQ single-line Request columns. New UI-only edition, incorporating
// the already released Archive/Search server source; old receipts are immutable.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ARCHIVE_SEARCH_BLOBS}
  from './work-hq-archive-search-package.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DIR='services/jill-order-desk/app-home/app/';
const ROUTE=DIR+'routes/app.requests.tsx';
const CSS=DIR+'styles/inbox.css';
export const TABLE_ROWS_BLOBS=Object.freeze({
  ...ARCHIVE_SEARCH_BLOBS,
  [ROUTE]:'8228a1efb72563009f5b612085ffecb0384dc0d8',
  [CSS]:'7d161929e790bcf5001284b4e9988e8718ab6a6c',
});
export const TABLE_ROWS_FILES=Object.freeze(Object.keys(TABLE_ROWS_BLOBS));
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const blob=src=>{
  const content=src.replace(/\r\n?/g,'\n');
  return createHash('sha1').update('blob '+Buffer.byteLength(content)+
    String.fromCharCode(0)).update(content,'utf8').digest('hex');
};
export function checkWorkHqTableRows(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],
    {encoding:'utf8'}).trim();
  const ci=branch===''&&process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    process.env.GITHUB_EVENT_NAME==='pull_request'&&
    process.env.GITHUB_HEAD_REF==='jill/rewards-work';
  assert(branch==='jill/rewards-work'||ci,'Wrong WORK source branch');
  assert.equal(TABLE_ROWS_FILES.length,21);
  for(const [file,sha] of Object.entries(TABLE_ROWS_BLOBS)){
    assert.equal(blob(read(file)),sha,'WORK table source drift: '+file);
    if(file.endsWith('.css'))assert.doesNotMatch(read(file),/!important|@import|url\(/i);
  }
  const route=read(ROUTE),css=read(CSS);
  assert.match(route,/<div className="jill-inbox__columns"/);
  assert.match(route,/<div className="jill-inbox__row"/);
  for(const name of ['Customer','Request','Status','Stage',
    'Needed by','Submitted','Actions'])assert.match(route,new RegExp('<span>'+name+'</span>'));
  assert.match(route,/aria-expanded=\{detailsOpen\}/);
  assert.match(route,/aria-controls=\{"jill-inbox-details-"/);
  assert.match(route,/setDetailsOpen\(next\)/);
  assert.match(route,/orderDetails\.load\("/);
  assert.match(route,/<WorkRequestQuickActions record=\{item\} enabled=\{controlsEnabled\} compact\/>/);
  assert.match(route,/partitionWorkRequests/);
  assert.match(route,/startFullSearch/);
  assert.match(route,/ArchiveControl/);
  assert.match(route,/typeof original\.detail\.customer\?\.name==="string"/);
  assert.match(css,/--jill-list-cols/);
  assert.match(css,/\.jill-inbox__columns\{/);
  assert.match(css,/\.jill-inbox__row\{/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.jill-inbox__cell--actions/);
  assert.match(css,/\.jill-inbox__order-details\{/);
  assert.doesNotMatch(css,/height:\s*100vh|overflow-y:\s*(?:auto|scroll)|position:\s*fixed/);
  return {environment:'WORK',status:'SOURCE_ONLY_HOLD',
    reviewed_files:21,changed_files_from_archive_search:2,
    compact_columns:7,expanded_details_in_normal_flow:true,
    owner_archive_search_preserved:true,remote_database_changed:false};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqTableRows(),null,2));
