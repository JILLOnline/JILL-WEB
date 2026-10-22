import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessM1M2SourceEdition,certifyM1M2SourceEdition,normalizedSourceBytes}
 from './certify-work-hq-m1-m2-source-edition.mjs';
const m=JSON.parse(readFileSync('scripts/work-hq-m1-m2-source-edition.json','utf8'));
const scope=[...Object.keys(m.pinned_blobs),
 '.github/workflows/jill-m1-preview-ci.yml',
 'scripts/work-hq-m1-m2-source-edition.json',
 'scripts/certify-work-hq-m1-m2-source-edition.mjs',
 'scripts/test-work-hq-m1-m2-source-edition.mjs'];
const history=Object.fromEntries(m.protected_historical.map(x=>[x,true]));
const safe=()=>({manifest:m,observedPaths:[...scope],
 observedBlobs:{...m.pinned_blobs},historicalMatches:{...history}});
assert.equal(assessM1M2SourceEdition(safe()).ok,true);
assert.equal(normalizedSourceBytes(Buffer.from('one\r\ntwo\r\n')).toString(),
 'one\ntwo\n');
assert.throws(()=>normalizedSourceBytes(Buffer.from('one\rtwo')),/lone carriage return/);
const bad=(mutate,code)=>{
 const v=safe();mutate(v);
 const r=assessM1M2SourceEdition(v);
 assert.equal(r.ok,false);assert.equal(r.code,code);
};
bad(x=>x.observedPaths.push('services/shopify/live-write-route.mjs'),'change_scope_not_approved');
bad(x=>x.observedPaths.pop(),'change_scope_not_approved');
bad(x=>x.observedPaths[1]=x.observedPaths[0],'change_scope_not_approved');
bad(x=>x.observedBlobs[Object.keys(m.pinned_blobs)[0]]='0'.repeat(40),'source_blob_changed');
bad(x=>x.historicalMatches[m.protected_historical[0]]=false,'historical_protection_changed');
bad(x=>x.manifest={...m,merge_or_deploy_authorized:true},'manifest_unverified');
bad(x=>x.manifest={...m,base_commit:'0'.repeat(40)},'manifest_unverified');
bad(x=>x.manifest={...m,pinned_blobs:{...m.pinned_blobs,
 ['../../../secret.env']:'0'.repeat(40)}},'source_pins_invalid');
const real=certifyM1M2SourceEdition();
assert.equal(real.ok,true);
assert.equal(real.verified_source_files,58);
assert.equal(real.verified_change_paths,62);
assert.equal(real.historical_guards_preserved,7);
console.log('PASS M1/M2 pinned 58 source blobs, 62 changed paths, 7 protected legacy proofs; extras/drift/tamper denied.');
