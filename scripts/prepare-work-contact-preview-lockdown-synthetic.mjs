// Compile-only, SYNTHETIC preview-lockdown candidate. This is created
// only inside the CI-generated ignored WORK build folder. Never uses
// real Cloudflare metadata, local Owner candidate or customer secrets.
// NO upload, deploy, settings changes, website traffic or D1 operations.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {proposeHqPreviewDisabledManifest}
 from './plan-work-contact-preview-lockdown.mjs';
const root='services/jill-order-desk/app-home/dist/server';
const original=join(root,'wrangler.contact-reconcile-synthetic.json');
const output=join(root,'wrangler.contact-preview-disabled-synthetic.json');
if(!existsSync(original)||existsSync(output))
 throw Error('HOLD: synthetic HQ preview lockdown source missing or exists');
const source=JSON.parse(readFileSync(original,'utf8'));
const proposed=proposeHqPreviewDisabledManifest(source);
if(proposed.status!=='HOLD'||proposed.manifest.preview_urls!==false||
 proposed.manifest.workers_dev!==true||
 proposed.changed_keys.length!==1||
 proposed.changed_keys[0]!=='preview_urls'||
 proposed.release_authorized!==false)
 throw Error('HOLD: unsafe WORK Version URL candidate');
writeFileSync(output,JSON.stringify(proposed.manifest,null,2)+'\n',{
 encoding:'utf8',mode:0o600,flag:'wx',
});
console.log('PASS synthetic WORK HQ preview-locked candidate: version URLs false, workers.dev true, no other config changed and NO upload.');
