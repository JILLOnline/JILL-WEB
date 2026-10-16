// REAL local Cloudflare workerd + WASM decode/re-encode smoke.
// Synthetic Sharp-generated source pixels; verifies output with real Sharp.
// No Cloudflare account/billing, remote D1, R2, Shopify or production Worker.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,readdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createTestHarness} from 'wrangler';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const EDGE=resolve(ROOT,'tools/work-media-edge');
const cfgPath=resolve(EDGE,'wrangler.jsonc');
const cfg=JSON.parse(readFileSync(cfgPath,'utf8'));
assert.equal(cfg.name,'jill-work-edge-codec-local-only');
assert.equal(cfg.workers_dev,false);
assert.equal(cfg.main,'./worker.mjs');
for(const field of ['r2_buckets','d1_databases','images','vars',
  'routes','route','services','env','durable_objects','kv_namespaces'])
  assert.equal(cfg[field],undefined,'A test-only codec needs NO '+field);
const safeMigrations=[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
];
assert.deepEqual(readdirSync(resolve(ROOT,
  'services/jill-order-desk/migrations')).sort(),safeMigrations);
for(const file of ['wrangler.jsonc','wrangler.canary.jsonc']){
  const deployed=JSON.parse(readFileSync(resolve(APP,file),'utf8'));
  assert.equal(deployed.r2_buckets,undefined);
  assert.equal(deployed.images,undefined);
}
const requireSharp=createRequire(resolve(ROOT,
  'tools/work-media-local/package.json'));
const sharp=requireSharp('sharp');
const marker='SYNTHETIC_PRIVATE_EXIF_REMOVE_SENTINEL';
const sample=sharp({create:{width:64,height:48,
  channels:4,background:{r:55,g:111,b:177,alpha:1}}});
const fixtures=[
  ['image/png',await sample.clone().png().toBuffer()],
  ['image/jpeg',await sample.clone().jpeg({quality:90})
    .withExif({IFD0:{Artist:marker}}).toBuffer()],
  ['image/webp',await sample.clone().webp().toBuffer()],
];
assert.ok((await sharp(fixtures[1][1]).metadata()).exif,
  'Synthetic JPEG must contain actual removable EXIF');
const server=createTestHarness({
  root:EDGE,
  workers:[{configPath:cfgPath}],
});
let completed=0;
try{
  await server.listen();
  const worker=server.getWorker('jill-work-edge-codec-local-only');
  const url='http://localhost/__jill_local_codec_probe';
  const call=async (mime,bytes,headers={})=>worker.fetch(url,{
    method:'POST',
    headers:{
      'X-Jill-Synthetic-Only':'phase18',
      'Content-Type':mime,...headers,
    },
    body:bytes,
    redirect:'manual',
  });
  const anon=await worker.fetch(url,{method:'GET'});
  assert.equal(anon.status,404);await anon.arrayBuffer();
  const disallowed=await worker.fetch(url,{method:'POST',
    headers:{'Content-Type':'image/png'},body:fixtures[0][1]});
  assert.equal(disallowed.status,404);await disallowed.arrayBuffer();

  for(const [mime,bytes] of fixtures){
    const started=performance.now();
    const response=await call(mime,bytes);
    const result=Buffer.from(await response.arrayBuffer());
    assert.equal(response.status,200,
      'Real local workerd '+mime+' must decode/re-encode successfully');
    assert.equal(response.headers.get('content-type'),'image/webp');
    assert.equal(response.headers.get('x-jill-sanitized'),'true');
    assert.equal(response.headers.get('x-jill-source-type'),mime);
    assert.equal(response.headers.get('x-jill-persisted'),'false');
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.ok(result.byteLength>=20&&result.byteLength<=8*1024*1024);
    assert.notDeepEqual(result,bytes,'Codec must really re-encode');
    assert.equal(result.includes(Buffer.from(marker)),false);
    const meta=await sharp(result).metadata();
    assert.equal(meta.format,'webp');
    assert.equal(meta.width,64);
    assert.equal(meta.height,48);
    assert.equal(meta.exif,undefined);
    assert.equal(meta.icc,undefined);
    assert.equal(meta.xmp,undefined);
    assert.ok(meta.pages===undefined||meta.pages===1);
    const rgba=await sharp(result).ensureAlpha().raw().toBuffer();
    let diffs=0;
    for(let i=0;i<rgba.length;i+=4)
      diffs+=Math.abs(rgba[i]-55)+Math.abs(rgba[i+1]-111)+
        Math.abs(rgba[i+2]-177);
    assert.ok(diffs/(rgba.length/4*3)<32,
      'Real decoded/re-encoded colors should survive quality setting');
    completed++;
    console.log('PASS LOCAL WORKERD real '+mime+
      ' -> WebP '+result.length+' bytes, metadata stripped, '+
      Math.round(performance.now()-started)+'ms elapsed (NOT CPU billing).');
  }

  // Use an actually animated, two-frame synthetic WebP fixture. Even
  // decoders capable of playing it must never accept it as one still image.
  const animated=Buffer.from(
    'UklGRhYBAABXRUJQVlA4WAoAAAACAAAATwAAYwAAQU5JTQYAAAAAAAAAAABBTk1GcAAAAAAAAAAAAE8AAGMAAJYAAAJWUDggWAAAAJAFAJ0BKlAAZAA+bTaZSaQjIqEg6ACADYlpBigAmQAHRYPmWx99F4bbo818Nt0ea+G26OgAAP75Hdv//kB//kB//kB//ID//iF3shz8Hdpv277dCOuPgABBTk1GcgAAAAAAAAAAAE8AAGMAAJYAAABWUDggWgAAAFQFAJ0BKlAAZAA+bTKTSYIOAADYlpBigAmQH4AAeXhJz/78WYmXky8mXky8mXky8mXGAAD+8JtD//5BcsLrka///ID/kB/yA//kB+VNmcxeRoqsPrjIjCAAAA==',
    'base64');
  assert.equal((await sharp(animated).metadata()).pages,2);
  const forgedPng=Buffer.alloc(33);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(forgedPng);
  forgedPng.writeUInt32BE(13,8);
  forgedPng.write('IHDR',12);
  forgedPng.writeUInt32BE(64,16);
  forgedPng.writeUInt32BE(48,20);
  const tooManyPixels=Buffer.from(forgedPng);
  tooManyPixels.writeUInt32BE(5000,16);
  tooManyPixels.writeUInt32BE(5000,20);
  const rejected=[
    ['image/webp',animated],
    ['image/png',Buffer.from('<svg onload="alert(1)"/>')],
    ['image/jpeg',fixtures[0][1]],
    ['image/png',forgedPng],
    ['image/png',tooManyPixels],
    ['image/png',fixtures[0][1].subarray(0,30)],
    ['image/webp',fixtures[2][1].subarray(0,24)],
    ['image/png',Buffer.alloc(8*1024*1024+1)],
  ];
  for(const [mime,bytes] of rejected){
    const response=await call(mime,bytes);
    assert.equal(response.status,422,'Must reject unsafe '+mime);
    assert.equal((await response.text()),'artwork_not_accepted');
    completed++;
  }
  assert.equal(completed,11);
  console.log('PASS local WORKERD EDGE: genuine PNG/JPEG/WebP -> metadata-free WebP; animated, mislabeled, malformed, oversized denied. No R2/D1/cloud operations.');
}catch(err){
  console.error('STOP local WORKERD edge WASM feasibility: '+
    String(err?.message||'unverified').slice(0,400));
  process.exitCode=1;
}finally{
  await server.close();
}
