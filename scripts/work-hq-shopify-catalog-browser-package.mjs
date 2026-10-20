// Source-only WORK HQ Catalog next edition. Not a release manifest.
// Retain all prior unreleased Messaging/Quote pins and spent deployment receipts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DUAL_INBOX_BLOBS} from './work-hq-dual-inbox-package.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const files=Object.freeze({
  'services/jill-order-desk/work-catalog-read.mjs':'ff06e3945d0403afa2c153514191f1f7ee9a46f3',
  'services/jill-order-desk/app-home/app/routes/app.catalog.tsx':'0fbd0c34b131c9c61ec7ac2024725da1c003c1f6',
  'services/jill-order-desk/app-home/app/styles/hq-catalog.css':'581fafc86ba0cd877602f0f4716114289a3e38a6',
});
export const CATALOG_BROWSER_BLOBS=Object.freeze({...DUAL_INBOX_BLOBS,...files});
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const blob=s=>{
  const v=s.replace(/\r\n?/g,'\n');
  return createHash('sha1').update('blob '+Buffer.byteLength(v)+
    String.fromCharCode(0)).update(v,'utf8').digest('hex');
};
export function checkWorkHqShopifyCatalogBrowserSource(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],{encoding:'utf8'}).trim();
  const ci=branch===''&&process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    process.env.GITHUB_EVENT_NAME==='pull_request'&&
    process.env.GITHUB_HEAD_REF==='jill/rewards-work';
  assert(branch==='jill/rewards-work'||ci,'Wrong WORK source branch');
  assert.equal(Object.keys(DUAL_INBOX_BLOBS).length,32);
  assert.equal(Object.keys(files).length,3);
  assert.equal(Object.keys(CATALOG_BROWSER_BLOBS).length,35);
  for(const [file,sha] of Object.entries(CATALOG_BROWSER_BLOBS)){
    assert.equal(blob(read(file)),sha,'Unreviewed HQ source drift: '+file);
    if(file.endsWith('.css'))assert.doesNotMatch(read(file),/!important|@import|url\(/i);
  }
  const server=read('services/jill-order-desk/work-catalog-read.mjs');
  const page=read('services/jill-order-desk/app-home/app/routes/app.catalog.tsx');
  for(const term of ['readWorkMerchantPermission','authenticate.admin(request)',
    'JillWorkCatalog','workCatalogProductSearch','inventory.read']){
    if(term==='inventory.read')assert.match(server,/inventory\.read/);
    else assert(server.includes(term),'Missing backend boundary: '+term);
  }
  assert.match(server,/products\(first: 20/);
  assert.match(server,/variants\(first: 10\)/);
  assert.match(server,/inventoryLevels\(first: 5\)/);
  assert.match(server,/try\{\s*if\(search!==null\)productSearch=workCatalogProductSearch\(search\)/);
  assert.match(page,/<Form method="get" action="\/app\/catalog"/);
  assert.match(page,/next\.set\("q",data\.search!\)/);
  assert.match(page,/SKU \{variant\.sku\}/);
  assert.match(page,/JILL_WORK_CATALOG_ENABLED==="true"/);
  for(const f of [server,page]){
    assert.doesNotMatch(f,/productUpdate\(|inventoryAdjust\(|productCreate\(|draftOrderCreate|draftOrderInvoiceSend|localStorage/);
  }
  return {environment:'WORK',status:'SOURCE_ONLY_HOLD',
    reviewed_files:35,prior_unreleased_source_preserved:true,
    next_edition_files:3,shopify_admin_connection_reused:true,
    catalog_writes:false,flag_unchanged:true,cloudflare_deployment:false,
    live_untouched:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqShopifyCatalogBrowserSource(),null,2));
