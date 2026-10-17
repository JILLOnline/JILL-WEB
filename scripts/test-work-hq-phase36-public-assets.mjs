// OFFLINE ONLY. Adversarial parser/hash comparison; zero network or files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractWorkPublicAssetPaths as extract,
  compareWorkPublicAssets as compare}
  from './inspect-work-hq-v34-public-assets.mjs';

let cases=0;
const js='/assets/entry.client-AbC012.js';
const css='/assets/root-zyx987.css';
const html='<html><link rel="stylesheet" href="'+css+'"/>'+
  '<script type="module" crossorigin src="'+js+'"></script>'+
  '<script defer src="'+js+'"></script></html>';
const paths=extract(html);
assert.deepEqual(paths,[js,css].sort());cases++;
const bufferA=Buffer.from('synthetic javascript only');
const bufferB=Buffer.from('synthetic css only');
const samples=new Map([[js,bufferA],[css,bufferB]]);
const local=new Map(samples);
const localRead=path=>local.get(path)??null;
const good=compare({paths,remote:samples,readLocal:localRead});
assert.equal(good.public_assets_observed,2);
assert.equal(good.matched_local_candidate,2);
assert.equal(good.different_local_candidate,0);
assert.equal(good.missing_local_candidate,0);
assert.equal(good.deployed_worker_binary_verified,false);
assert.equal(good.v34_all_browser_assets_verified,false);
assert.equal(good.v34_source_commit_verified,false);
assert.equal(good.version_upload_authorized,false);
assert.equal(good.status_mutation_authorized,false);
assert.ok(Object.isFrozen(good));
assert.match(good.public_sample_inventory_sha256,/^[a-f0-9]{64}$/);
assert.equal(good.public_sample_inventory_sha256,
  good.local_sample_inventory_sha256);cases++;
const changed=compare({paths,remote:samples,
  readLocal:path=>path===js?Buffer.from('different'):localRead(path)});
assert.equal(changed.matched_local_candidate,1);
assert.equal(changed.different_local_candidate,1);
assert.notEqual(changed.public_sample_inventory_sha256,
  changed.local_sample_inventory_sha256);cases++;
const missing=compare({paths,remote:samples,
  readLocal:path=>path===js?null:localRead(path)});
assert.equal(missing.matched_local_candidate,1);
assert.equal(missing.missing_local_candidate,1);cases++;
function fail(fn){assert.throws(fn,/work_hq_phase36_public_assets_/);cases++;}
fail(()=>extract(null));
fail(()=>extract('A'.repeat(512*1024+1)));
fail(()=>extract('<script src="/assets/evil..chunk.js"></script>'));
fail(()=>extract('<script src="/assets/.hidden.js"></script>'));
fail(()=>extract(Array.from({length:9},(_,i)=>
  '<script src="/assets/chunk-'+i+'.js"></script>').join('')));
for(const [html,expected] of [
  ['<img src="https://evil.example/assets/hack.js">',0],
  ['<script src="/assets/../x.js"></script>',0],
  ['<script src="/assets/nested/x.js"></script>',0],
  ['<script src="/assets/evil.js?secret=a"></script>',0],
  ['<script src="//evil.example/assets/hack.js"></script>',0],
  ['<script src="/assets/image.png"></script>',0],
  ['<link href="/assets/good.css">',1],
]){
  assert.equal(extract(html).length,expected);cases++;
}
fail(()=>compare());
fail(()=>compare({paths:[],remote:new Map(),readLocal:localRead}));
fail(()=>compare({paths:[js,js],remote:samples,readLocal:localRead}));
fail(()=>compare({paths,remote:new Map([[js,bufferA]]),readLocal:localRead}));
fail(()=>compare({paths,remote:samples,readLocal:null}));
fail(()=>compare({paths:['/assets/../evil.js'],remote:samples,readLocal:localRead}));
fail(()=>compare({paths:['/assets/x.js?key=abc'],remote:samples,readLocal:localRead}));
fail(()=>compare({paths,remote:new Map([[js,Buffer.alloc(0)],[css,bufferB]]),
  readLocal:localRead}));
fail(()=>compare({paths,remote:new Map([[js,Buffer.alloc(2*1024*1024+1)],[css,bufferB]]),
  readLocal:localRead}));
fail(()=>compare({paths,remote:samples,readLocal:()=>Buffer.alloc(0)}));
fail(()=>compare({paths,remote:samples,readLocal:()=>Buffer.alloc(2*1024*1024+1)}));
const source=readFileSync(new URL('./inspect-work-hq-v34-public-assets.mjs',
  import.meta.url),'utf8');
assert.match(source,/workLiveAuditReadArgs\('deployment_status'\)/);
assert.match(source,/activeVersion\(\); \/\/ Refuse version drift/);
assert.match(source,/redirect:'manual'/);
assert.match(source,/MAX_ASSETS=8/);
assert.match(source,/MAX_ASSET=2\*1024\*1024/);
assert.match(source,/work_checkout_not_synced/);
assert.match(source,/WRANGLER_SEND_METRICS:'false'/);
assert.doesNotMatch(source,/versions','deploy|versions','upload|r2\.put|d1\.execute/);
cases++;
console.log('PASS WORK Phase36 OFFLINE anonymous-public-asset sample: '+
  cases+' parser/hash/bounds/version-pin contract cases; matching vs mismatching vs missing candidate classified; NO remote HTTP or cloud mutations.');
console.log('HOLD: public asset sample never certifies all deployed browser assets or v34 Worker source/binary.');
