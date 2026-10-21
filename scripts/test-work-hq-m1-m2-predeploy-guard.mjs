// M1+M2 predeployment fail-closed configuration guard.
// Source-only validation. No environment/secret/network reads, migrations,
// store mutations, deploy commands or runtime feature activation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));
const config=json('services/jill-order-desk/app-home/wrangler.jsonc');
assert.equal(config.name,'jill-order-desk-work');
assert.equal(config.vars.JILL_WORK_HOST_STAGE,'work');
assert.notEqual(config.vars.JILL_WORK_OAUTH_ENABLED,'true');
const off=[
 'JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED',
 'JILL_WORK_QUOTE_CATALOG_REVIEW_ENABLED',
 'JILL_WORK_CONVERSATION_ENABLED',
 'JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED',
 'JILL_WORK_HQ_PRIVATE_MEDIA_ENABLED',
 'JILL_WORK_HQ_INVOICE_ENABLED',
 'JILL_WORK_HQ_DRAFT_ORDER_CREATE_ENABLED',
 'JILL_WORK_HQ_QUOTE_PUBLICATION_ENABLED',
];
for(const key of off)
 assert.notEqual(config.vars[key],'true','Unexpected WORK source feature activation: '+key);
const worker=read('services/jill-order-desk/app-home/workers/app.ts');
assert.match(worker,/if\(url\.pathname===\"\/app\/requests\/quote-catalog\"/);
assert.match(worker,/!workQuoteCatalogReviewReady\(env\)/);
assert.match(worker,/return unavailable\(\"quote_catalog_not_enabled\"\)/);
assert.match(worker,/if\(url\.pathname===\"\/app\/requests\/quote-draft\"\)/);
assert.match(worker,/!workQuoteDraftFeatureReady\(env\)/);
assert.match(worker,/workQuoteDraftSchemaReady\(env\.JILL_ORDER_DESK_WORK_DB\)/);
assert.ok(worker.indexOf('quote_catalog_not_enabled')<
 worker.indexOf('JILL_WORK_OAUTH_ENABLED'));
const signed=read('services/jill-order-desk/work-quote-catalog-review.mjs');
assert.match(signed,/deriveVerifiedWorkQuoteVariantIds/);
assert.match(signed,/readWorkMerchantPermission/);
assert.match(signed,/action:'requests\.read'/);
assert.match(signed,/readCatalog/);
assert.match(signed,/can_publish:false/);
assert.match(signed,/can_invoice:false/);
assert.match(signed,/can_create_order:false/);
const calc=read('services/jill-order-desk/work-quote-per-unit-authorized-preview.mjs');
assert.match(calc,/enabled=false/);
assert.match(calc,/action:'quote\.calculate'/);
assert.match(calc,/readAuthorizedWorkQuoteCatalog/);
assert.match(calc,/return held\('not_enabled'\)/);
assert.match(calc,/can_invoice:false/);
assert.match(calc,/can_create_order:false/);
assert.doesNotMatch(worker,/WORK_QUOTE_PER_UNIT_CALCULATE|calculateAuthorizedWorkPerUnitQuote/);
const routeRegistry=read('services/jill-order-desk/app-home/app/routes.ts');
assert.doesNotMatch(routeRegistry,/quote-preview|quote-calculate|invoice-send|draft-create/);
const quote=read('services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx');
assert.match(quote,/canSaveDraft=canReloadDraft&&!blocked/);
assert.match(quote,/disabled=\{!canReloadDraft\}/);
assert.match(quote,/WorkQuoteArtworkAudit/);
const media=read('services/jill-order-desk/work-quote-artwork-audit.mjs');
assert.match(media,/preview_enabled:false/);
assert.match(media,/private_storage_verified:false/);
assert.doesNotMatch(media,/fetch\(|getSignedUrl|presignedUrl|cloudinary\.com/);
for(const path of [
 'extensions/jill-account-dashboard/src/hub/AccountHub.jsx',
 'extensions/jill-account-dashboard/src/pages/Messages.jsx',
 'extensions/jill-account-dashboard/src/pages/RequestConversation.jsx',
]){
 assert.ok(read(path).length>100,'Unexpected missing My JILL extension source: '+path);
}
console.log('PASS M1/M2 predeploy guard: WORK source flags remain OFF, no invoice/create routes, signed Owner reads, safe Reload and artwork no-preview; zero writes');
