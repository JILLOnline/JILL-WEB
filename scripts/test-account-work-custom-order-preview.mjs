#!/usr/bin/env node
// Certifies the actual Shopify-connectable ACCOUNT root, not nested /theme sources.
// Never submits requests, publishes pages/products, or connects a customer.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file,'utf8');
const homepage=JSON.parse(read('templates/index.json'));
const page=JSON.parse(read('templates/page.custom-order.json'));
const layout=read('layout/theme.liquid');
const section=read('sections/main-custom-order.liquid');
const script=read('assets/jill-custom-order.js');
const runtime=read('snippets/jill-custom-order-runtime.liquid');

assert.equal(page.sections.main.type,'main-custom-order');
assert.equal(page.sections.main.settings.submission_endpoint,'');
assert.equal(page.sections.main.settings.verified_submission_endpoint,'/apps/jill-custom-order');

const preview=homepage.sections.work_custom_order_preview;
assert.ok(preview,'WORK QA homepage must contain a Custom Order preview section');
assert.equal(preview.type,'main-custom-order');
assert.equal(preview.disabled,true,'QA wizard must not unexpectedly appear on published homepage');
assert.ok(homepage.order.includes('work_custom_order_preview'));
assert.equal(preview.settings.verified_submission_endpoint,'/apps/jill-custom-order');
assert.equal(homepage.sections.home.settings.custom_order_link,'/pages/custom-order');

assert.ok(section.includes("request.page_type == 'index'"),'Homepage preview must gate scripts by template');
assert.ok(section.includes("render 'jill-custom-order-runtime'"),'Use shared Custom Order scripts');
assert.ok(section.includes('data-jill-catalog-unavailable'),'Draft product catalog limitation needs visible warning');
assert.ok(section.includes('id="JillWorkCustomOrderPreview"'),'QA preview needs a stable anchor');
assert.ok(section.includes("assign all_products = collections['jill']"),'WORK must be isolated to JILL catalog');
assert.ok(section.includes('jill_work_allowed_collections'),'Only canonical WORK collections are allowed');

for (const step of ['customer','order','products','configuration','planning','final']){
  assert.ok(section.includes('data-jill-stage="'+step+'"'),'Custom Order step missing: '+step);
}
for (const name of ['data-jill-custom-order-review','data-jill-request-submit',
   'data-jill-custom-order-success','data-jill-review-confirm']) {
  assert.ok(section.includes(name),'Missing review/receipt element: '+name);
}
const requiredAssets=[
  'jill-product-capabilities.js',
  'jill-form-engine.js',
  'jill-product-options.js',
  'jill-personalization.js',
  'jill-personalization-ui.js',
  'jill-product.js',
  'jill-variant-allocation.js',
  'jill-email-validation.js',
  'jill-custom-order.js',
  'jill-custom-order-catalog-groups.js',
];
for(const asset of requiredAssets){
  assert.ok(fs.existsSync('assets/'+asset),'WORK custom-order dependency missing '+asset);
  assert.equal(runtime.split("'"+asset+"' | asset_url").length-1,1,
    'Exactly one canonical script reference required: '+asset);
}
assert.ok(layout.includes("{% render 'jill-custom-order-runtime' %}"));
assert.ok(!layout.includes("'jill-variant-allocation.js' | asset_url"),'No duplicate inline Custom Order runtime');
assert.ok(!layout.includes("template.suffix == 'our-story'"),'Our Story must never initialize custom orders');
assert.ok(layout.includes("template.suffix == 'custom-order'"),'Dedicated page must own Custom Order runtime');
assert.ok(script.includes("const endpoint = '/apps/jill-custom-order'"));
assert.ok(script.includes('verifiedPath !== endpoint'),'WORK must fail closed without configured proxy');
assert.ok(script.includes("credentials:'same-origin'"),'Authenticated session must be same-origin');
assert.ok(script.includes('receipt?.verified!==true'),'No unverified success allowed');
assert.ok(!script.includes("mode:'no-cors'"),'Legacy blind submission must be blocked');
assert.ok(!section.includes('script.google.com/macros/s/'),'Never expose legacy backend URL');
console.log('ACCOUNT Custom Orders root/page/optional homepage preview, 10 canonical dependencies, fail-closed WORK receipt tests PASS.');
console.log('No theme publication, product exposure, Shopify credentials or account app release performed.');
