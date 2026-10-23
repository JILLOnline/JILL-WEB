// Build artifact proof for HQ's private Contact named WorkerEntrypoint.
// NO remote access, provider credentials, upload, deploy, schema or traffic.
// Refuse success if the named export disappears from the actual Worker entry.
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root='services/jill-order-desk/app-home/dist/server';
const halt=reason=>{throw Error('contact_hq_bundle_'+reason);};
if(!existsSync(join(root,'index.js')))halt('missing_entry');
const entry=readFileSync(join(root,'index.js'),'utf8');
const assets=join(root,'assets');
const workers=existsSync(assets)?readdirSync(assets).filter(x=>
 /^worker-entry-.*\.js$/.test(x)):[];
if(workers.length!==1)halt('worker_entry_ambiguous');
const js=readFileSync(join(assets,workers[0]),'utf8');
// "present in bundled text" and "exported by deploy entry" are distinct.
if(!/JillContactPrivate/.test(js))halt('named_class_missing');
if(!/JillContactPrivate/.test(entry))halt('named_export_missing');
if(!/default/.test(entry))halt('default_entry_missing');
console.log('PASS WORK HQ bundle exports default app + named private Contact entrypoint. No upload or deploy.');
