#!/usr/bin/env node
// Read-only certification of the isolated WORK theme package.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('.work-custom-order-theme');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const marker=JSON.parse(get('.jill-work-theme.json'));
assert.equal(marker.owner,'jill-work-custom-order-theme');
assert.equal(marker.shop,'jill-work.myshopify.com');
assert.equal(marker.endpoint,'/apps/jill-custom-order');
assert.equal(marker.kind,'unpublished-preview-only');
const home=JSON.parse(get('templates/index.json'));
assert.equal(home.sections.custom.settings.button_link,'/pages/custom-order');
const section=get('sections/main-custom-order.liquid');
const schema=JSON.parse(section.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
const settings=Object.fromEntries(schema.settings.map(s=>[s.id,s]));
assert.equal(settings.verified_submission_endpoint.default,'/apps/jill-custom-order');
assert.equal(settings.submission_endpoint.default,undefined);
const js=get('assets/jill-custom-order.js');
assert.ok(js.includes("verifiedPath !== endpoint"));
assert.ok(js.includes("gateway.pathname!=='/apps/jill-custom-order'"));
assert.ok(js.includes('receipt?.verified!==true'));
assert.ok(js.includes('requestSentOnce'));
assert.ok(!js.includes("mode:'no-cors'"),'Legacy transport present');
assert.ok(!js.includes("fetch(endpoint,{method:'POST'"),'Legacy direct fetch present');
assert.ok(!section.includes('script.google.com/macros/s/'));
console.log('WORK theme fail-closed transport, navigation, and stage guards PASS');
console.log('No Shopify deployment or customer writes performed.');
