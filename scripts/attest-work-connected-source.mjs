// Read-only provenance of a clean joined tree and its local build outputs.
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(git('status','--porcelain','--untracked-files=no'))
 throw Error('source_receipt_requires_clean_tracked_tree');
const output=process.env.JILL_SOURCE_RECEIPT;
const account=process.env.JILL_MYJILL_BUNDLES;
if(!output||!account)throw Error('source_receipt_output_paths_required');
const roots=['services/jill-order-desk/app-home/dist',account];
const files=['package-lock.json','services/jill-order-desk/app-home/package-lock.json',
 'extensions/jill-account-dashboard/package-lock.json','tools/work-account-local/package-lock.json'];
const walk=dir=>{for(const entry of readdirSync(dir)){
 const path=join(dir,entry);if(statSync(path).isDirectory())walk(path);else files.push(path);
}};
for(const dir of roots)walk(dir);
if(!files.some(p=>p.endsWith('ConnectedHub.js'))||!files.some(p=>p.endsWith('Dashboard.js')))
 throw Error('source_receipt_missing_account_bundles');
const digests=files.sort().map(path=>({path:relative(process.cwd(),resolve(path)),
 sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const receipt={version:1,classification:'SOURCE_ONLY',
 source_commit:git('rev-parse','HEAD'),source_tree:git('rev-parse','HEAD^{tree}'),
 integration_source:process.env.GITHUB_SHA??null,node:process.version,
 workflow_sha256:createHash('sha256').update(readFileSync('.github/workflows/jill-connected-journey-rehearsal.yml')).digest('hex'),
 artifacts:digests,authenticated_work_acceptance:false,deployment_authorized:false};
writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log('SOURCE_ONLY_TREE='+receipt.source_tree);
