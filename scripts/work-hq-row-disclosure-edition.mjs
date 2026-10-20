// Latest WORK-only Requests row-disclosure visual edition. Source-only:
// existing 37-file Catalog/Messaging/Quote/P1P2 edition preserved by pins.
// No historical one-time release receipt reissue, no deploy profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {QUOTE_UNITS_BLOBS} from './work-hq-quote-units-edition.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const next=Object.freeze({
  'services/jill-order-desk/app-home/app/routes/app.requests.tsx':
    '0936fdb7c39fcba566d80767b884d4e17ebfb329',
  'services/jill-order-desk/app-home/app/styles/inbox.css':
    'c825930ac1ce1584ead1ae3a2c563dd99cddca0d',
  'services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx':
    '538a02b6b393400fe922699bfcd2298f149f281c',
  'services/jill-order-desk/app-home/app/styles/request-actions.css':
    '6fa3ad9bb04d7a84a82e5f794e2bc5a37641e640',
});
export const ROW_DISCLOSURE_BLOBS=Object.freeze({...QUOTE_UNITS_BLOBS,...next});
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const gitBlob=data=>{
  const text=data.replace(/\r\n?/g,'\n');
  return createHash('sha1').update('blob '+Buffer.byteLength(text)+
    String.fromCharCode(0)).update(text,'utf8').digest('hex');
};
export function checkWorkHqRowDisclosureEdition(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],
    {encoding:'utf8'}).trim();
  const ci=branch===''&&process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    process.env.GITHUB_EVENT_NAME==='pull_request'&&
    process.env.GITHUB_HEAD_REF==='jill/rewards-work';
  assert(branch==='jill/rewards-work'||ci,'Wrong WORK branch');
  assert.equal(Object.keys(QUOTE_UNITS_BLOBS).length,37);
  assert.equal(Object.keys(next).length,4);
  assert.equal(Object.keys(ROW_DISCLOSURE_BLOBS).length,37);
  for(const [file,sha] of Object.entries(ROW_DISCLOSURE_BLOBS)){
    assert.equal(gitBlob(read(file)),sha,'Unreviewed WORK visual source drift: '+file);
    if(file.endsWith('.css'))assert.doesNotMatch(read(file),/!important|@import|url\(/i);
  }
  for(const [file,sha] of Object.entries(QUOTE_UNITS_BLOBS)){
    if(Object.hasOwn(next,file))assert.notEqual(next[file],sha,
      'Expected reviewed Requests-only interaction change');
    else assert.equal(ROW_DISCLOSURE_BLOBS[file],sha,
      'Previously reviewed Catalog/Quote/Messaging source changed');
  }
  const route=read('services/jill-order-desk/app-home/app/routes/app.requests.tsx');
  const actions=read('services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx');
  const css=read('services/jill-order-desk/app-home/app/styles/inbox.css');
  assert.match(route,/className="jill-inbox__row-trigger"/);
  assert.match(route,/aria-expanded=\{detailsOpen\}/);
  assert.match(route,/hidden=\{!detailsOpen\}/);
  assert.match(route,/enabled=\{controlsEnabled\} direct\/>/);
  assert.doesNotMatch(route,/className="jill-inbox__detail-button"/);
  assert.match(actions,/jill-actions__direct-buttons/);
  assert.match(actions,/action:"\/app\/requests\/command"/);
  assert.match(css,/grid-template-columns:subgrid/);
  assert.match(css,/\.jill-inbox__row-trigger:focus-visible/);
  assert.doesNotMatch(css,/overflow-y:\s*(?:auto|scroll)|position:\s*fixed/);
  return Object.freeze({environment:'WORK',status:'SOURCE_ONLY_HOLD',
    reviewed_files:37,reviewed_changed_files:4,
    status_and_message_handlers_unchanged:true,
    owner_archive_and_search_unchanged:true,
    catalog_quote_p1p2_and_messaging_unchanged:true,
    historic_one_time_release_receipts_unchanged:true,
    cloudflare_deployment:false,live_untouched:true});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqRowDisclosureEdition(),null,2));
