// Source edition certificate for the M1/M2 WORK preview. No deployment.
// This is a NEW edition: never modify/disable spent V4 release receipts,
// historic V4 blob certification, or original WORK branch protections.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const META='scripts/work-hq-m1-m2-source-edition.json';
const CI='.github/workflows/jill-m1-preview-ci.yml';
const CERT='scripts/certify-work-hq-m1-m2-source-edition.mjs';
const TEST='scripts/test-work-hq-m1-m2-source-edition.mjs';
const SHA=/^[0-9a-f]{40}$/;
const rel=p=>typeof p==='string'&&!p.startsWith('/')&&
 !p.split('/').some(x=>x===''||x==='..'||x==='.')&&!p.includes('\\');
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
// Windows git checkouts may use CRLF. Git blobs are LF; preserve content
// while rejecting lone carriage returns and all actual source drift.
export function normalizedSourceBytes(input){
 const raw=(Buffer.isBuffer(input)?input:Buffer.from(input)).toString('utf8');
 if(raw.replace(/\r\n/g,'').includes('\r'))
  throw Error('STOP invalid lone carriage return in source');
 return Buffer.from(raw.replace(/\r\n/g,'\n'),'utf8');
}
const hash=data=>{
 const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);
 return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
};
export function assessM1M2SourceEdition({manifest,observedPaths,observedBlobs,historicalMatches}={}){
 const fail=(code,detail)=>Object.freeze({ok:false,code,detail});
 if(manifest?.edition!=='JILL_WORK_M1_M2_SOURCE_ONLY_PREDEPLOY'||
  manifest.base_commit!=='b53b9f7f1146a0bad4b734a8e7f48c3ee66309f8'||
  manifest.release_branch!=='jill/rewards-work'||
  manifest.feature_scope!=='read_only_WORK_preview'||
  manifest.merge_or_deploy_authorized!==false||
  !manifest.pinned_blobs||Array.isArray(manifest.pinned_blobs)||
  typeof manifest.pinned_blobs!=='object'||
  !Array.isArray(manifest.protected_historical)||
  manifest.protected_historical.length!==7)
  return fail('manifest_unverified');
 const pins=Object.keys(manifest.pinned_blobs);
 if(pins.length!==68||new Set(pins).size!==pins.length||
   pins.some(p=>!rel(p)||!SHA.test(manifest.pinned_blobs[p])||
     [META,CI,CERT,TEST].includes(p)))
  return fail('source_pins_invalid');
 const allowed=[...pins,META,CI,CERT,TEST].sort();
 if(!Array.isArray(observedPaths)||!same([...observedPaths].sort(),allowed))
  return fail('change_scope_not_approved');
 if(!observedBlobs||typeof observedBlobs!=='object')
  return fail('source_blobs_unavailable');
 for(const p of pins)
  if(observedBlobs[p]!==manifest.pinned_blobs[p])
   return fail('source_blob_changed',p);
 if(!historicalMatches||typeof historicalMatches!=='object')
  return fail('historical_proofs_unavailable');
 for(const p of manifest.protected_historical){
  if(!rel(p)||pins.includes(p)||historicalMatches[p]!==true)
   return fail('historical_protection_changed',p);
 }
 return Object.freeze({ok:true,edition:manifest.edition,
  verified_source_files:pins.length,verified_change_paths:allowed.length,
  historical_guards_preserved:manifest.protected_historical.length,
  deployment:false,source_only:true});
}
const run=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',timeout:30000,
 maxBuffer:1024*1024}).trim();
export function certifyM1M2SourceEdition(){
 const manifest=JSON.parse(readFileSync(path.join(ROOT,META),'utf8'));
 const base=manifest.base_commit;
 if(!SHA.test(base))throw Error('STOP invalid release base');
 // Do not certify truncated/unknown ancestry or a changed WORK release base.
 run('merge-base','--is-ancestor',base,'HEAD');
 const paths=run('diff','--name-only',base,'HEAD').split('\n').filter(Boolean);
 const observedBlobs={};
 for(const file of Object.keys(manifest.pinned_blobs)){
  if(!rel(file))throw Error('STOP unsafe source path');
  observedBlobs[file]=hash(normalizedSourceBytes(readFileSync(path.join(ROOT,file))));
 }
 const historicalMatches={};
 for(const file of manifest.protected_historical){
  if(!rel(file))throw Error('STOP unsafe historical path');
  historicalMatches[file]=run('rev-parse',base+':'+file)===
   run('rev-parse','HEAD:'+file);
 }
 const result=assessM1M2SourceEdition({manifest,observedPaths:paths,
  observedBlobs,historicalMatches});
 if(!result.ok)throw Error('STOP M1/M2 source edition: '+result.code+
  (result.detail?':'+result.detail:''));
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(certifyM1M2SourceEdition(),null,2));}
 catch(e){console.error(String(e.message));process.exitCode=1;}
}
