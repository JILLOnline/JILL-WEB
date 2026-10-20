// OFFLINE source-only WORK HQ customer-name card edition; no Cloudflare deploy.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DENSITY_RUNTIME_BASE,prepareReviewedPresentationBuild}
  from './work-hq-density-package.mjs';
import {studioDigest} from './check-work-hq-studio-only.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DIR='services/jill-order-desk/app-home/app/';
export const CUSTOMER_NAME_PACKAGE_BLOBS=Object.freeze({
  'services/jill-order-desk/app-home/app/routes/app.index.tsx':'8521646544cd58c9e0b823e2dd92fce657677c7c',
  'services/jill-order-desk/app-home/app/styles/hq-home.css':'90a7038c5e33c84d4d1568a144dc73870610b701',
  'services/jill-order-desk/app-home/app/styles/hq-theme.css':'d7943a283a348046531bf862aa46677cd6045bec',
  'services/jill-order-desk/app-home/app/styles/inbox.css':'b48d1ca29afbebe127990e190a54aa8a6eb2a6fe',
  'services/jill-order-desk/app-home/app/styles/quote-worksheet.css':'7e5116868320cb18eb9915bda884cb417528df18',
  'services/jill-order-desk/app-home/app/styles/request-actions.css':'4479b08b45cdfdf1f62edc9103e08e3dde2f1849',
  'services/jill-order-desk/app-home/app/styles/request-detail.css':'8d9c98141a59721aad3571056772802061233530',
  'services/jill-order-desk/app-home/app/routes/app.requests.tsx':'0fe428425e0750824921f7ae10e7905e206dbc36',
  'services/jill-order-desk/app-home/app/routes/app.requests.$submissionId.tsx':'021aa2b8a5f8c517be11317d3db6ce32b83d580f',
  'services/jill-order-desk/app-home/app/components/WorkOriginalRequestDetails.tsx':'b729eceb021bf5e3ac5afa3e100be5fb98e15dea',
  'services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx':'0d93d698b5185d4be98ca27c53601b3eedb49562',
  'services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx':'cf4c66c7fca9325673a22366326f83daf7316a1b',
  'services/jill-order-desk/app-home/app/components/WorkRequestConversation.tsx':'4463ef99fadbb6ae54219f690214d0d7103b983b',
});
export const CUSTOMER_NAME_PACKAGE_FILES=Object.freeze(Object.keys(CUSTOMER_NAME_PACKAGE_BLOBS));
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const gitBlob=value=>{
  const source=value.replace(/\r\n?/g,'\n');
  return createHash('sha1')
    .update('blob '+Buffer.byteLength(source)+String.fromCharCode(0))
    .update(source).digest('hex');
};
export function checkWorkHqCustomerNamePackage(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],{encoding:'utf8'}).trim();
  const trustedCI=branch===''&&process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    process.env.GITHUB_HEAD_REF==='jill/rewards-work'&&
    process.env.GITHUB_EVENT_NAME==='pull_request';
  assert(branch==='jill/rewards-work'||trustedCI,'Wrong WORK branch');
  assert.equal(CUSTOMER_NAME_PACKAGE_FILES.length,13);
  for(const [file,hash] of Object.entries(CUSTOMER_NAME_PACKAGE_BLOBS)){
    const content=read(file);
    assert.equal(gitBlob(content),hash,'Customer-name UI file changed: '+file);
    if(file.endsWith('.css'))assert.doesNotMatch(content,/!important|@import|url\(/i);
  }
  const components=read(DIR+'components/WorkOriginalRequestDetails.tsx');
  const quote=read(DIR+'components/WorkQuoteWorksheet.tsx');
  const conversation=read(DIR+'components/WorkRequestConversation.tsx');
  const detail=read(DIR+'routes/app.requests.$submissionId.tsx');
  const css=read(DIR+'styles/request-detail.css');
  const quick=read(DIR+'components/WorkRequestQuickActions.tsx');
  const cards=read(DIR+'routes/app.requests.tsx');
  const inboxStyle=read(DIR+'styles/inbox.css');
  // Order details is permanently displayed in the detail page, unlike Inbox.
  const orderDetails=components.split('export function WorkOrderDetails(')[1]
    .split('export function WorkOriginalRequestDetails(')[0];
  assert.match(orderDetails,/return <section/);
  assert.match(orderDetails,/jill-workspace__overview/);
  assert.match(orderDetails,/<h3 id="jill-request-order-details-title">Order details<\/h3>/);
  assert.doesNotMatch(orderDetails,/<details|<summary/);
  // Original item/personalization content starts collapsed, with native keyboard
  // semantics. Existing product reference disclosures remain nested.
  const items=components.split('export function WorkOriginalRequestDetails(')[1];
  assert.match(items,/return <details className="jill-request__panel/);
  assert.match(items,/jill-request__fold"/);
  assert.match(items,/<summary className="jill-request__fold-head"/);
  assert.match(items,/Items & personalization/);
  assert.match(items,/details\.items\.map/);
  assert.match(items,/details\.reference_ids/);
  assert.doesNotMatch(items,/\bopen=\{/);
  // Quote uses a native disclosure rather than conditional component mounting,
  // preserving each unsaved value and all existing save/reload safeguards.
  assert.match(quote,/return <details className="jill-request__panel/);
  assert.match(quote,/aria-label="Quote worksheet"/);
  assert.match(quote,/<summary className="jill-request__fold-head"/);
  assert.match(quote,/NOT SAVED · NOT SENT/);
  assert.match(quote,/RESTORED DRAFT · NOT SENT/);
  assert.match(quote,/setPrices\(prev=>/);
  assert.match(quote,/setFees\(prev=>/);
  assert.match(quote,/action:"\/app\/requests\/quote-draft"/);
  assert.match(quote,/readFetcher\.load\(workQuoteDraftReadPath\(submissionId\)\)/);
  assert.doesNotMatch(quote,/\bopen=\{|<details[^>]*open\b/);
  assert.doesNotMatch(quote,/Private USD estimate\. Quantities match the original request/);
  assert.doesNotMatch(quote,/Internal estimate only\. No customer message/);
  // Only nonessential helper copy was removed; errors still surface and
  // locked/unsupported quote actions remain unavailable.
  assert.doesNotMatch(detail,/Latest verified snapshot|Changes are confirmed before they appear/);
  assert.match(detail,/Quotes below are internal drafts/);
  assert.match(detail,/Customer approval and Shopify payments are not enabled here/);
  assert.doesNotMatch(components,/Original request · Not an approved quote/);
  assert.doesNotMatch(conversation,/Customer-visible messages only\. Internal notes stay private/);
  assert.match(conversation,/The conversation could not be verified/);
  assert.match(quote,/Saving is unavailable in this WORK version/);
  assert.match(css,/\.jill-request__fold>.jill-request__fold-head\{/);
  assert.match(css,/\.jill-request__fold-chevron\{/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(quick,/<span>QUICK ACTIONS<\/span>/);
  assert.match(cards,/original\.detail\?\.submission_id===item\.submission_id/);
  assert.match(cards,/typeof original\.detail\.customer\?\.name===\"string\"/);
  assert.match(cards,/new IntersectionObserver\(/);
  assert.match(inboxStyle,/\.jill-inbox__customer-name\{/);
  return {environment:'WORK',status:'SOURCE_ONLY_HOLD',
    reviewed_files:CUSTOMER_NAME_PACKAGE_FILES.length,
    static_order_details:true,collapsed_items:true,collapsed_quote:true,
    quote_state_preserved_by_native_details:true,
    owner_verified_customer_name:true,no_provider_changes:true};
}
export function customerNamePackageManifest(){
  checkWorkHqCustomerNamePackage();
  return {runtime_baseline:DENSITY_RUNTIME_BASE,
    files:Object.fromEntries(CUSTOMER_NAME_PACKAGE_FILES.map(file=>[file,studioDigest(read(file))]))};
}
export function prepareCustomerNameBuild({runner}={}){
  return prepareReviewedPresentationBuild({runner,manifest:customerNamePackageManifest(),
    guard:checkWorkHqCustomerNamePackage,prefix:'customer-name-package-'});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqCustomerNamePackage(),null,2));
