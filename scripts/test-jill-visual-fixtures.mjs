import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const root='scripts/jill-visual-fixtures/';
const evidence='docs/evidence/jill-hq-myjill-synthetic-visuals/';
const html=readFileSync(root+'preview.html','utf8');
const js=readFileSync(root+'preview.js','utf8');
const server=readFileSync(root+'server.mjs','utf8');
const css=readFileSync(root+'preview.css','utf8');
const manifest=JSON.parse(readFileSync(evidence+'manifest.json','utf8'));
for(const screen of manifest.screens)
  assert.match(js,new RegExp('"'+screen+'"'));
assert.deepEqual(manifest.viewportCssWidths,[390,768,1440]);
assert.equal(manifest.viewportCssHeightPixels,1200);
assert.equal(manifest.browserChecks.screenshots,36);
assert.equal(manifest.browserChecks.documentHorizontalOverflowCases,0);
assert.equal(manifest.browserChecks.externalNetworkRequests,0);
assert.equal(manifest.browserChecks.hqNavigationLinks,6);
assert.equal(manifest.browserChecks.hqMobileNavigationMinimumHeightPixels,44);
assert.match(js,/SYNTHETIC LOCAL PREVIEW/);
assert.match(js,/NO SHOPIFY AUTH · NO EXTERNAL APIS OR PROVIDER WRITES/);
assert.match(js,/SAMPLE-NOT-REDEEMABLE/);
assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|document\.cookie|localStorage|sessionStorage/);
assert.match(js,/jill-inbox__order-details"\)\.hidden=!open/);
assert.match(js,/available\s*\?`<s-button/);
assert.match(server,/server\.listen\(4179,'127\.0\.0\.1'/);
assert.match(server,/screenshotNames\.has\(name\)/);
assert.match(server,/docs\/evidence\/jill-hq-myjill-synthetic-visuals/);
assert.match(html,/preview\.js/);
assert.match(css,/@media\(max-width:480px\)/);
let screenshotCount=0;
for(const screen of manifest.screens)for(const width of manifest.viewportCssWidths){
  const file=`${evidence}${screen}-${width}.png`;
  const png=readFileSync(file);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`${file} is a PNG`);
  assert.equal(png.readUInt32BE(16),width,`${file} has the requested CSS viewport width`);
  assert.equal(png.readUInt32BE(20),manifest.viewportCssHeightPixels,`${file} has the requested viewport height`);
  assert.ok(statSync(file).size>1000,`${file} is not empty`);
  screenshotCount++;
}
assert.equal(screenshotCount,36);
console.log(`PASS isolated synthetic visual fixture: ${screenshotCount} screenshots, no Shopify auth, external data/API or provider-write paths; loopback-only screenshot receiver.`);
