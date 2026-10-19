// This new repair is explicitly NOT a visual-only release. Exact reviewed
// transport/dashboard inventory; no business data, policy or flag changes.
import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const NAVIGATION_BASE='5815213b29999310ea44049ef99d20b5178948c5';
export const navigationDigest=s=>createHash('sha256').update(s.replace(/\r\n?/g,'\n')).digest('hex');
export function checkWorkHqNavigationOnly(){
 const git=(...args)=>execFileSync('git',['-C',ROOT,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 assert.equal(git('branch','--show-current'),'jill/rewards-work');
 const review=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/work-hq-navigation-reviewed.json'),'utf8'));
 assert.equal(review.baseline,NAVIGATION_BASE);
 const changed=git('diff','--name-only',NAVIGATION_BASE,'--','backend','extensions','theme','services').split(/\r?\n/).filter(Boolean);
 assert.deepEqual(changed.sort(),Object.keys(review.files).sort(),'Navigation repair inventory changed');
 for(const file of changed)assert.equal(navigationDigest(fs.readFileSync(path.join(ROOT,file),'utf8')),review.files[file],'Reviewed navigation source changed: '+file);
 return {change_scope:'navigation_transport_and_authorized_dashboard',visual_only:false,reviewed_files:changed.length,
  backend_policies_extensions_theme_and_data_unchanged:true,flags_and_bindings_must_be_preserved:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(checkWorkHqNavigationOnly(),null,2));
