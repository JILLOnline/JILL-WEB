#!/usr/bin/env node
// Assemble an isolated WORK theme preview; never writes back into theme/ or deploys.
// Requires the reviewed governance branch. Refuses wrong store, dirty tracked files,
// unexpected source markers, and accidental fallback to a Google endpoint.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const source=path.join(root,'theme');
const dest=path.join(root,'.work-custom-order-theme');
const sentinel=path.join(dest,'.jill-work-theme.json');
const branch='jill/work-custom-order-integration';
const shop='jill-work.myshopify.com';
const read=(p)=>fs.readFileSync(p,'utf8');
function assert(ok,msg){if(!ok)throw Error(msg);}
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert(git('branch','--show-current')===branch,'Wrong branch; use the governance WORK branch');
assert(!git('status','--porcelain','--untracked-files=no'),'Dirty tracked files');
assert(fs.existsSync(path.join(source,'templates/page.custom-order.json')),'Missing canonical template');
const sectionFile=path.join(source,'sections/main-custom-order.liquid');
const assetFile=path.join(source,'assets/jill-custom-order.js');
const section=read(sectionFile);
const asset=read(assetFile);
const legacy='https://script.google.com/macros/s/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/exec';
assert(section.includes(legacy),'Unknown legacy endpoint; review before staging');
assert(section.includes('"id": "verified_submission_endpoint"'),'Missing verified endpoint setting');
assert(asset.includes("gateway.pathname!=='/apps/jill-custom-order'"),'Missing strict app proxy enforcement');
assert(asset.includes('receipt?.verified!==true'),'Missing verified receipt check');
assert(asset.includes('requestSentOnce'),'Missing replay protections');
if(fs.existsSync(dest)){
  assert(fs.existsSync(sentinel),'Refusing to replace an unknown directory');
  const old=JSON.parse(read(sentinel));
  assert(old.owner==='jill-work-custom-order-theme'&&old.shop===shop,'Wrong staging owner');
  fs.rmSync(dest,{recursive:true,force:true});
}
fs.cpSync(source,dest,{recursive:true});
const stagedFile=path.join(dest,'sections/main-custom-order.liquid');
let staged=read(stagedFile);
assert(staged.split(legacy).length===2,'Unexpected legacy URL count');
// Remove the default entirely so the staged form can NEVER silently POST to legacy Google.
staged=staged.replace(/,\s*"default":\s*"https:\/\/script\.google\.com\/macros\/s\/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA\/exec"\s*,?/,'');
assert(!staged.includes(legacy),'Legacy URL still present');
// Enable same-origin proxy only on the isolated staging copy.
const needle='"id": "verified_submission_endpoint",';
assert(staged.includes(needle),'Verified field not found');
staged=staged.replace(needle,needle+'\n      "default": "/apps/jill-custom-order",');
fs.writeFileSync(stagedFile,staged);
// Force the QA theme's browser transport to fail closed. The WEBSITE owner
// remains untouched: this replacement is confined to the ignored WORK package.
const stagedJSFile=path.join(dest,'assets/jill-custom-order.js');
let stagedJS=read(stagedJSFile);
const before=`    const endpoint = String(root.dataset.submitEndpoint || '').trim();
    if (!endpoint) fail('submission is temporarily unavailable');`;
const after=`    // WORK QA must never use the legacy direct-Google transport.
    const endpoint = '/apps/jill-custom-order';`;
assert(stagedJS.includes(before),'WORK JS endpoint guard changed; review source');
stagedJS=stagedJS.replace(before,after);
const fallback=`    if (!verifiedPath) {
      await fetch(endpoint,{method:'POST',mode:'no-cors',keepalive:true,body});
      return; // Legacy transport; must be retired after gateway launch.
    }`;
assert(stagedJS.includes(fallback),'WORK JS legacy fallback changed; review source');
stagedJS=stagedJS.replace(fallback,`    if (verifiedPath !== endpoint) {
      fail('WORK verified Shopify app proxy is not configured');
    }`);
assert(!stagedJS.includes('mode:\'no-cors\''),'Unverified submission transport remains');
fs.writeFileSync(stagedJSFile,stagedJS);

// Only change the homepage link in the isolated QA package; website lane remains canonical.
const homeFile=path.join(dest,'templates/index.json');
const home=JSON.parse(read(homeFile));
assert(home.sections?.custom?.settings?.button_link==='/pages/quote?view=custom-order',
  'Homepage link differs from certified old route; inspect before changing');
home.sections.custom.settings.button_link='/pages/custom-order';
fs.writeFileSync(homeFile,JSON.stringify(home,null,2)+'\n');

const schema=staged.match(/{% schema %}([\s\S]*?){% endschema %}/);
assert(schema,'Missing Liquid schema');
JSON.parse(schema[1]);
assert(!read(stagedFile).includes('script.google.com/macros/s/'),'Google Script fallback still present');
// The published store can override section defaults using templates/settings data.
 // Refuse staging an inherited template that points at a different endpoint.
const template=JSON.parse(read(path.join(dest,'templates/page.custom-order.json')));
const settings=template.sections?.main?.settings||{};
assert(!settings.submission_endpoint,'Unexpected explicit legacy submission override');
assert(!settings.verified_submission_endpoint ||
  settings.verified_submission_endpoint==='/apps/jill-custom-order',
  'Unexpected verified endpoint override');
template.sections.main.settings={
  ...settings,
  submission_endpoint:'',
  verified_submission_endpoint:'/apps/jill-custom-order',
};
fs.writeFileSync(path.join(dest,'templates/page.custom-order.json'),
  JSON.stringify(template,null,2)+'\n');
const info={owner:'jill-work-custom-order-theme',shop,sourceCommit:git('rev-parse','HEAD'),endpoint:'/apps/jill-custom-order',kind:'unpublished-preview-only'};
fs.writeFileSync(sentinel,JSON.stringify(info,null,2)+'\n');
console.log('Prepared isolated WORK staging theme at .work-custom-order-theme/');
console.log('Pinned source '+info.sourceCommit);
console.log('Proxy /apps/jill-custom-order; legacy Google default removed from staging.');
console.log('Next: node scripts/audit-theme-dependencies.mjs .work-custom-order-theme');
console.log('NO THEME UPLOAD, LIVE RELEASE, APP RELEASE OR BACKEND WRITE.');
