// JILL HQ WORK merchant P1/P2 review source edition. SOURCE ONLY.
// No deployment, schema mutation or historical one-time receipt repinning.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CATALOG_QUOTE_BLOBS} from './work-hq-catalog-quote-edition.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const newFiles=Object.freeze({
  'services/jill-order-desk/work-quote-unit-review.mjs':'400a6b5ff7c085aa94102d069b0bde81c23425c1',
  'services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx':'72ff1fd250d39d809c4347e96ae65d5277bcabe0',
  'services/jill-order-desk/app-home/app/styles/quote-worksheet.css':'f8e40039840a88613f97a97d85ed5f6b9af40d74',
});
export const QUOTE_UNITS_BLOBS=Object.freeze({...CATALOG_QUOTE_BLOBS,...newFiles});
const source=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const gitBlob=value=>{
  const content=value.replace(/\r\n?/g,'\n');
  return createHash('sha1').update('blob '+Buffer.byteLength(content)+
    String.fromCharCode(0)).update(content).digest('hex');
};
export function checkWorkHqQuoteUnitsEdition(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],
    {encoding:'utf8'}).trim();
  const ci=branch===''&&process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    process.env.GITHUB_EVENT_NAME==='pull_request'&&
    process.env.GITHUB_HEAD_REF==='jill/rewards-work';
  assert(branch==='jill/rewards-work'||ci,'Wrong WORK branch');
  assert.equal(Object.keys(CATALOG_QUOTE_BLOBS).length,36);
  assert.equal(Object.keys(newFiles).length,3);
  assert.equal(Object.keys(QUOTE_UNITS_BLOBS).length,37);
  for(const [file,sha] of Object.entries(QUOTE_UNITS_BLOBS)){
    assert.equal(gitBlob(source(file)),sha,'Reviewed WORK source drift: '+file);
    if(file.endsWith('.css'))
      assert.doesNotMatch(source(file),/!important|@import|url\(/i);
  }
  const code=source('services/jill-order-desk/work-quote-unit-review.mjs');
  const ui=source('services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx');
  assert.match(code,/invalid_or_duplicate_personalized_unit/);
  assert.match(code,/unassigned_unit_ids/);
  assert.match(code,/commerce_ready:false/);
  assert.match(ui,/<WorkQuoteUnitReview item=\{item\}\/>/);
  assert.match(ui,/inspectWorkQuoteUnitReview/);
  assert.doesNotMatch(code,/draftOrderCreate|draftOrderInvoiceSend|fetch\(|db\.prepare/);
  return {environment:'WORK',status:'SOURCE_ONLY_HOLD',
    reviewed_files:37,new_or_changed_unit_review_files:3,
    earlier_catalog_messaging_quote_files_preserved:true,
    shopify_variant_alias_resolution_held:true,
    draft_order_and_invoice_unapproved:true,live_untouched:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqQuoteUnitsEdition(),null,2));
