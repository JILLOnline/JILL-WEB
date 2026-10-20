// WORK SOURCE ONLY. Variant read/price cross-check is internal and
// intentionally omitted from old spent release manifests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CATALOG_BROWSER_BLOBS}
  from './work-hq-shopify-catalog-browser-package.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const BRIDGE='services/jill-order-desk/work-quote-shopify-catalog-bridge.mjs';
const BRIDGE_BLOB='19faf991b38bd1ed7673529a26a689913fd4d0d3';
export const CATALOG_QUOTE_BLOBS=Object.freeze({
  ...CATALOG_BROWSER_BLOBS,[BRIDGE]:BRIDGE_BLOB,
});
const source=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const blob=text=>{
  const v=text.replace(/\r\n?/g,'\n');
  return createHash('sha1').update('blob '+Buffer.byteLength(v)+
    String.fromCharCode(0)).update(v).digest('hex');
};
export function checkWorkHqCatalogQuoteEdition(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],
    {encoding:'utf8'}).trim();
  const ci=branch===''&&process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    process.env.GITHUB_EVENT_NAME==='pull_request'&&
    process.env.GITHUB_HEAD_REF==='jill/rewards-work';
  assert(branch==='jill/rewards-work'||ci,'Expected WORK source only');
  assert.equal(Object.keys(CATALOG_BROWSER_BLOBS).length,35);
  assert.equal(Object.keys(CATALOG_QUOTE_BLOBS).length,36);
  for(const [file,sha] of Object.entries(CATALOG_QUOTE_BLOBS)){
    assert.equal(blob(source(file)),sha,'Reviewed WORK source drift: '+file);
    if(file.endsWith('.css'))
      assert.doesNotMatch(source(file),/!important|@import|url\(/i);
  }
  const bridge=source(BRIDGE);
  assert.match(bridge,/readWorkMerchantPermission/);
  assert.match(bridge,/action:'catalog.read'/);
  assert.match(bridge,/currentAppInstallation/);
  assert.match(bridge,/projectVerifiedWorkQuoteCatalog/);
  assert.match(bridge,/reconcileWorkQuoteWithCatalog/);
  assert.match(bridge,/catalog_price_review_required/);
  assert.match(bridge,/ready_for_native_shopify_calculation/);
  assert.doesNotMatch(bridge,/draftOrderCreate|draftOrderInvoiceSend|productUpdate|inventoryAdjust|fetch\(/);
  return {environment:'WORK',status:'SOURCE_ONLY_HOLD',reviewed_files:36,
    prior_reviewed_source_unchanged:true,
    new_internal_shopify_catalog_quote_bridge:true,
    new_routes:0,catalog_writes:false,
    invoice_and_order_creation:false,live_untouched:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqCatalogQuoteEdition(),null,2));
