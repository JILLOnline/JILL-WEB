// JILL HQ WORK Master V4: NEW source-only edition certification.
// Historic CI release manifests remain unmodified, receipts unspent.
// Never invokes Cloudflare, Shopify, GitHub API, scripts that write, or deploy.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const PINS=JSON.parse(fs.readFileSync(new URL('./work-hq-master-v4-blobs.json',import.meta.url),'utf8'));
const BASE='c47d081a868731e75ba8ab36736c5a15c4a70605';
// Pin the exact V4 source-only commit: PR merge checks must not certify
// unrelated base-branch history as part of this reviewed 26-file edition.
const CERTIFIED='6a825827abb10b1cfcb6bfde2ac423845de65285';
const GENERATED=new Set([
  'package-lock.json',
  'services/jill-order-desk/app-home/package-lock.json',
]);
const SHA=/^[0-9a-f]{40}$/;
const ORIGINAL_COUNT=21;
const SUPPORT=new Set([
  '.github/workflows/jill-account-work-ci.yml',
  'package.json',
  'scripts/work-hq-master-v4-blobs.json',
  'scripts/work-hq-master-v4-edition.mjs',
  'scripts/test-work-hq-master-v4.mjs',
]);
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:1024*1024,timeout:20000});
const blob=data=>{
  const bytes=Buffer.from(data,'utf8');
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
};
const normalize=data=>{
  const lf=data.replace(/\r\n/g,'\n');
  assert(!lf.includes('\r'),'Bare CR not allowed');
  return lf;
};
function statusPaths(){
  // Git porcelain -z has two status bytes + one separating space. Do not trim!
  const chunks=git('status','--porcelain=v1','-z','--untracked-files=all').split('\0').filter(Boolean);
  const paths=[];
  for(const record of chunks){
    assert(record.length>=4&&record[2]===' ','Unexpected Git status encoding');
    const code=record.slice(0,2);
    assert(code===' M'||code==='??','STOP staged, renamed, deleted or conflicting file: '+record);
    paths.push(record.slice(3));
  }
  return paths;
}
function diffNames(){
  const out=git('diff','--name-only',BASE,CERTIFIED);
  return out.split('\n').filter(Boolean);
}
export function certifyJillMasterHqV4({checkChangeScope=true}={}){
  assert.equal(PINS.base_commit,BASE);
  assert.equal(PINS.edition,'JILL_HQ_MASTER_V4_SOURCE_ONLY');
  assert.equal(Object.keys(PINS.files).length,ORIGINAL_COUNT);
  const branch=git('branch','--show-current').trim();
  const isCI=process.env.CI==='true'&&
    process.env.GITHUB_REPOSITORY==='JILLOnline/JILL-WEB'&&
    (process.env.GITHUB_REF==='refs/heads/jill/rewards-work'||
     process.env.GITHUB_HEAD_REF==='jill/rewards-work');
  assert(branch==='jill/rewards-work'||isCI,'STOP wrong source branch');
  execFileSync('git',['merge-base','--is-ancestor',BASE,CERTIFIED],{cwd:ROOT,timeout:20000});
  execFileSync('git',['merge-base','--is-ancestor',CERTIFIED,'HEAD'],{cwd:ROOT,timeout:20000});
  const installed=[];
  for(const [file,expected] of Object.entries(PINS.files)){
    assert(SHA.test(expected),'Invalid approved blob hash: '+file);
    assert(!file.includes('..')&&!path.isAbsolute(file),'Unsafe source path');
    const full=path.join(ROOT,file);
    assert(fs.existsSync(full)&&fs.statSync(full).isFile(),'Missing source '+file);
    assert.equal(blob(normalize(read(file))),expected,'STOP unreviewed Master V4 source change: '+file);
    installed.push(file);
  }
  // Historic source-edition and release scripts must stay at BASE. New
  // candidate safety checks are separate, never a repin of spent receipts.
  for(const relative of [
   'scripts/work-hq-row-disclosure-edition.mjs',
   'scripts/work-hq-row-disclosure-runtime-build.mjs',
   'scripts/release-work-hq-row-disclosure-owner.mjs',
  ]){
    assert.equal(git('rev-parse',BASE+':'+relative).trim(),
      git('rev-parse','HEAD:'+relative).trim(),
      'STOP historical release source was changed: '+relative);
  }
  if(checkChangeScope){
    const permitted=new Set([...installed,...SUPPORT]);
    const committed=diffNames();
    const local=statusPaths();
    // This change-scope proof inspects only the immutable certified commit,
    // not the host PR branch's unrelated merged history.
    assert.equal(committed.length,permitted.size,'STOP V4 certified commit file count drift');
    for(const file of committed)assert(permitted.has(file),
      'STOP unapproved path in certified V4 commit: '+file);
    for(const file of permitted)assert(committed.includes(file),
      'STOP certified V4 file missing: '+file);
    // npm install may produce these two UNTRACKED lockfiles. All staged,
    // modified, renamed or other untracked files still stop certification.
    for(const file of local)assert(GENERATED.has(file),
      'STOP unexpected local file during V4 certification: '+file);
    for(const file of [
      'package.json','scripts/work-hq-master-v4-blobs.json',
      'scripts/test-work-hq-master-v4.mjs',
    ])assert.equal(git('rev-parse','HEAD:'+file).trim(),
      git('rev-parse',CERTIFIED+':'+file).trim(),
      'STOP V4 certification support changed after certified commit: '+file);
  }
  const src=read('services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx');
  const request=read('services/jill-order-desk/app-home/app/routes/app.requests.tsx');
  const quote=read('services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx');
  assert(src.includes('createPortal('),'V4 editor portal missing');
  assert(src.includes('verifiedMerchantMessageAcknowledgment'),'Verified HQ message receipt missing');
  assert(src.includes('expected_revision:String(record.revision)'),'Owner revision guard changed');
  assert(request.includes('jill-inbox__editor-slot'),'Editor not in request row');
  assert(request.includes('editorHost={editorHost}'),'Missing request-scoped portal host');
  assert(quote.includes('inspectWorkQuoteUnitReview'),'P1/P2 quote review removed');
  assert(quote.includes('inspectWorkQuotePreflight'),'Quote preflight removed');
  const appRoute=read('services/jill-order-desk/app-home/app/routes/app.requests.quote-draft.tsx');
  assert(appRoute.includes('workQuoteDraftFeatureReady(env)'),'Quote hard-off server gate changed');
  const worker=read('services/jill-order-desk/app-home/workers/app.ts');
  assert(worker.includes('workQuoteDraftFeatureReady(env)'),'Quote Worker gate removed');
  return Object.freeze({edition:PINS.edition,base_commit:BASE,
    changed_source_files:ORIGINAL_COUNT,verified_sha1:true,
    historical_release_guards_untouched:true,
    checkout_changed:false,commerce_activated:false,cloudflare_deploy:false,
    github_push:false,live_untouched:true});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(certifyJillMasterHqV4(),null,2));
