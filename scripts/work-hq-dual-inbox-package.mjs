// WORK-only dual inbox and reversible quote-personalization SOURCE review. Not a release manifest.
// Prior one-time compact-table release pinning remains immutable/spent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {TABLE_ROWS_BLOBS} from './work-hq-table-rows-package.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ROUTES='services/jill-order-desk/app-home/app/routes.ts';
export const DUAL_INBOX_NEW_BLOBS=Object.freeze({
  'services/jill-order-desk/app-home/app/routes.ts':'c08f8b085a0cc81c63013aa8af477202f747e494',
  'services/jill-order-desk/app-home/app/routes/app.tsx':'e6c1d37ce97570947e131983063a2e0dddc6eda3',
  'services/jill-order-desk/app-home/app/routes/app.messages.tsx':'ee88a8ceb0f56c1d512bfa59203ccd213fb1d3f0',
  'services/jill-order-desk/app-home/app/styles/hq-messages.css':'12bfcdb22962c5d99a42bdd0c67c6635e22c7382',
  'shared/custom-order-message-inbox.mjs':'939452d6921eaa2587b58706d8f8c2e81cfdcd7d',
  'extensions/jill-account-dashboard/src/hub/routes.mjs':'174f5cd06b04547b04ba6d3e8973166eb15bebfd',
  'extensions/jill-account-dashboard/src/hub/AccountHub.jsx':'b80a7948b78eb6079b6cfd6b7c0dbd4ae306b9da',
  'extensions/jill-account-dashboard/src/pages/Messages.jsx':'8e3382fabf1a785e14fdf6038138bf8fc28d0407',
  'extensions/jill-account-dashboard/src/pages/Overview.jsx':'aea95a791a89d2a83c02eb05d57b25af81ae1d2b',
  'scripts/prepare-account-hub-canary.mjs':'21d8f0380665a819f019da7162fff5346c22e042',
  'services/jill-order-desk/work-quote-commerce-handoff.mjs':'a4f2d5a5a7cde5e7c56eb2d291b91db249eb2ed3',
  'services/jill-order-desk/work-quote-personalization-map.mjs':'881f5694de5b8fcedb4f2c94c91c0e1f3eec8f8a',
});
export const DUAL_INBOX_BLOBS=Object.freeze({
  ...TABLE_ROWS_BLOBS,
  ...DUAL_INBOX_NEW_BLOBS,
});
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const blob=content=>{
  const source=content.replace(/\r\n?/g,'\n');
  return createHash('sha1').update('blob '+Buffer.byteLength(source)+
    String.fromCharCode(0)).update(source,'utf8').digest('hex');
};
export function checkWorkHqDualInboxSource(){
  const branch=execFileSync('git',['-C',ROOT,'branch','--show-current'],
    {encoding:'utf8'}).trim();
  const ci=branch===''&&process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    process.env.GITHUB_EVENT_NAME==='pull_request'&&
    process.env.GITHUB_HEAD_REF==='jill/rewards-work';
  assert(branch==='jill/rewards-work'||ci,'Wrong WORK branch');
  assert.equal(Object.keys(TABLE_ROWS_BLOBS).length,21);
  assert.equal(Object.keys(DUAL_INBOX_NEW_BLOBS).length,12);
  assert.equal(Object.keys(DUAL_INBOX_BLOBS).length,32);
  for(const [file,sha] of Object.entries(DUAL_INBOX_BLOBS)){
    assert.equal(blob(read(file)),sha,'Dual inbox source changed: '+file);
    if(file.endsWith('.css'))assert.doesNotMatch(read(file),/!important|@import|url\(/i);
  }
  for(const [file,sha] of Object.entries(TABLE_ROWS_BLOBS)){
    if(file===ROUTES)assert.notEqual(DUAL_INBOX_BLOBS[file],sha,
      'The new HQ Messages route must be explicitly reviewed');
    else assert.equal(DUAL_INBOX_BLOBS[file],sha,
      'Previously reviewed business/requests source changed: '+file);
  }
  assert.match(read(ROUTES),/route\("messages","routes\/app\.messages\.tsx"\)/);
  const admin=read('services/jill-order-desk/app-home/app/routes/app.messages.tsx');
  const customer=read('extensions/jill-account-dashboard/src/pages/Messages.jsx');
  assert.match(admin,/loadVerifiedMerchantInbox\(args\)/);
  assert.match(admin,/JILL_WORK_CONVERSATION_ENABLED==="true"/);
  assert.match(admin,/summarizeMerchantPublicThread/);
  assert.match(admin,/WorkRequestQuickActions/);
  assert.match(admin,/\/app\/requests\/thread/);
  assert.match(customer,/loadWorkCustomerCustomOrders/);
  assert.match(customer,/projectCustomerMessageInbox/);
  assert.match(customer,/RequestConversation/);
  const handoff=read('services/jill-order-desk/work-quote-commerce-handoff.mjs');
  const map=read('services/jill-order-desk/work-quote-personalization-map.mjs');
  assert.match(handoff,/mapSimpleWorkItemPersonalization/);
  assert.match(map,/decodeSimpleWorkItemPersonalization/);
  assert.match(map,/personalization_exceeds_native_limit/);
  assert.doesNotMatch(handoff,/draftOrderCreate|draftOrderInvoiceSend|fetch\(/);
  assert.doesNotMatch(map,/fetch\(|graphql\(|db\.prepare/);
  assert.doesNotMatch(admin,/document\.body\.style|localStorage|sessionStorage|window\.parent/);
  assert.doesNotMatch(customer,/owner_gid|customer\.email|localStorage|sessionStorage|window\.parent/);
  return {environment:'WORK',status:'SOURCE_ONLY_NO_RELEASE',
    reviewed_files:Object.keys(DUAL_INBOX_BLOBS).length,
    reviewed_quote_personalization_handoff:true,
    previous_table_release_blobs_unchanged:true,
    source_only_customer_and_owner_inboxes:true,
    new_api_endpoint:false,new_database:false,
    conversation_flag_unchanged:true,shopify_app_not_deployed:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  console.log(JSON.stringify(checkWorkHqDualInboxSource(),null,2));
