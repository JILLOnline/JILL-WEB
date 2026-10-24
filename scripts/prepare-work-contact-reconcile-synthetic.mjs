// Create a throwaway synthetic HQ canary candidate for Wrangler --dry-run.
// This NEVER reads Cloudflare metadata or real secrets. Output remains under
// the generated, gitignored WORK build directory and is NEVER published.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {reconcileActiveHqContactManifest,RESTORE_EXISTING_HQ_FLAGS}
 from './plan-work-contact-binding-parity.mjs';
const path='services/jill-order-desk/app-home/dist/server';
const source=join(path,'wrangler.json');
const output=join(path,'wrangler.contact-reconcile-synthetic.json');
if(!existsSync(source)||existsSync(output))
 throw Error('HOLD: compiled HQ source missing or synthetic candidate exists');
const compiled=JSON.parse(readFileSync(source,'utf8'));
const existingFlags=RESTORE_EXISTING_HQ_FLAGS.map((name,i)=>({
 name,type:'plain_text',text:i%2?'false':'true',
}));
const synthetic={resources:{bindings:[
 {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',
  id:'3f17c186-c794-4e00-8f20-017191373a19'},
 {name:'JILL_WORK_OAUTH_ENABLED',type:'plain_text',text:'true'},
 {name:'JILL_WORK_OWNER_BOOTSTRAP_ENABLED',type:'plain_text',text:'false'},
 {name:'JILL_WORK_HOST_STAGE',type:'plain_text',text:'canary'},
 {name:'SHOPIFY_API_SECRET',type:'secret_text'},
 {name:'JILL_WORK_SESSION_KEY_B64',type:'secret_text'},
 {name:'JILL_HQ_MERCHANT_READ_SECRET',type:'secret_text'},
 {name:'JILL_HQ_MERCHANT_WRITE_SECRET',type:'secret_text'},
 ...existingFlags,
]}};
const result=reconcileActiveHqContactManifest({
 activeView:synthetic,compiled,
});
if(result.status!=='HOLD'||result.restored_existing_flag_names.length!==5||
 result.upload_or_deployment_authorized!==false)
 throw Error('HOLD: synthetic WORK reconciliation failed');
writeFileSync(output,JSON.stringify(result.manifest,null,2)+'\n',{
 encoding:'utf8',flag:'wx',mode:0o600,
});
console.log('PASS generated synthetic OAuth-ON WORK HQ candidate with five preserved existing toggles and required secret names. No real metadata or deployment.');
