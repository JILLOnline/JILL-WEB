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
// A flat-color lossy WebP can encode to exactly the same deterministic
// bytes after a full decode/re-encode. Use a nonuniform LOSSLESS source
// with genuine EXIF to prove that the Worker produces a NEW lossy WebP.
const width=64,height=48;
const webpPattern=Buffer.alloc(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  webpPattern[i]=55+x*2;
  webpPattern[i+1]=65+y*3;
  webpPattern[i+2]=80+((x+y)*2)%128;
  webpPattern[i+3]=255;
}
const exifWebp=await sharp(webpPattern,{
  raw:{width,height,channels:4},
}).webp({lossless:true}).withExif({
  IFD0:{Artist:marker},
}).toBuffer();
const sourceWebpMeta=await sharp(exifWebp).metadata();
assert.equal(sourceWebpMeta.format,'webp');
assert.ok(sourceWebpMeta.exif,
  'Lossless WebP fixture must carry removable EXIF');
assert.ok(exifWebp.includes(Buffer.from(marker)),
  'WebP source must actually include the private EXIF sentinel');
const fixtures=[
  ['image/png',await sample.clone().png().toBuffer()],
  ['image/jpeg',await sample.clone().jpeg({quality:90})
    .withExif({IFD0:{Artist:marker}}).toBuffer()],
  ['image/webp',exifWebp],
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
    assert.notDeepEqual(result,bytes,
      'Distinct source encoding must result in newly encoded WebP');
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
    for(let i=0;i<rgba.length;i+=4){
      const target=mime==='image/webp'?
        [webpPattern[i],webpPattern[i+1],webpPattern[i+2]]:
        [55,111,177];
      diffs+=Math.abs(rgba[i]-target[0])+
        Math.abs(rgba[i+1]-target[1])+
        Math.abs(rgba[i+2]-target[2]);
    }
    assert.ok(diffs/(rgba.length/4*3)<32,
      'Output pixels must match genuine source pixels after conversion');
    completed++;
    console.log('PASS LOCAL WORKERD real '+mime+
      ' -> WebP '+result.length+' bytes, metadata stripped, '+
      Math.round(performance.now()-started)+'ms elapsed (NOT CPU billing).');
  }

  // Realistic HD JPEG: exercise both codec WASM and Worker memory/time.
  // Deterministic synthetic pattern, not personal or customer artwork.
  const W=1280,H=720;
  const noise=Buffer.alloc(W*H*3);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*3;
    noise[i]=(x*17+y*3)&255;
    noise[i+1]=(x*5+y*11)&255;
    noise[i+2]=((x^y)*7)&255;
  }
  const hd=await sharp(noise,{raw:{width:W,height:H,channels:3}})
    .jpeg({quality:88}).toBuffer();
  const bigStart=performance.now();
  const hdResponse=await call('image/jpeg',hd);
  const hdResult=Buffer.from(await hdResponse.arrayBuffer());
  assert.equal(hdResponse.status,200,'HD photo must decode and encode');
  const hdMeta=await sharp(hdResult).metadata();
  assert.equal(hdMeta.width,W);assert.equal(hdMeta.height,H);
  assert.equal(hdMeta.format,'webp');assert.equal(hdMeta.exif,undefined);
  assert.ok(hdResult.length<8*1024*1024);
  completed++;
  console.log('PASS LOCAL WORKERD HD 1280x720 JPEG -> WebP '+
    hd.length+' to '+hdResult.length+' bytes, '+
    Math.round(performance.now()-bigStart)+
    'ms elapsed (NOT Cloudflare CPU billing).');

  // EXIF Orientation 6 (common phone photo): rotate the actual pixels,
  // not just the reported dimensions, and discard all input metadata.
  // Sharp's withExif({Orientation:6}) expects a string and silently
  // serializes '6' as orientation 1. withMetadata({orientation:6}) is
  // the correct way to create this test fixture with EXIF Orientation 6.
  const rotatedFixtureWidth=64,rotatedFixtureHeight=48;
  const rotationPixels=Buffer.alloc(rotatedFixtureWidth*rotatedFixtureHeight*3);
  const quadrantColors=[
    [230,40,40], // source top-left red
    [35,210,65], // source top-right green
    [20,75,225], // source bottom-left blue
    [235,200,35], // source bottom-right yellow
  ];
  for(let y=0;y<rotatedFixtureHeight;y++){
    for(let x=0;x<rotatedFixtureWidth;x++){
      const quadrant=(y>=rotatedFixtureHeight/2?2:0)+
        (x>=rotatedFixtureWidth/2?1:0);
      const p=(y*rotatedFixtureWidth+x)*3;
      for(let channel=0;channel<3;channel++)
        rotationPixels[p+channel]=quadrantColors[quadrant][channel];
    }
  }
  const withRotation=await sharp(rotationPixels,{
    raw:{width:rotatedFixtureWidth,height:rotatedFixtureHeight,channels:3},
  }).jpeg({quality:95,chromaSubsampling:'4:4:4'})
    .withMetadata({orientation:6}).toBuffer();
  const rotationInput=await sharp(withRotation).metadata();
  assert.equal(rotationInput.orientation,6,
    'Fixture must actually include EXIF orientation 6');
  assert.ok(rotationInput.exif,'Orientation fixture must carry EXIF');
  const rotateResponse=await call('image/jpeg',withRotation);
  const rotatedBytes=Buffer.from(await rotateResponse.arrayBuffer());
  assert.equal(rotateResponse.status,200,
    'EXIF-orientated JPEG must be corrected in local Worker');
  const rotateMeta=await sharp(rotatedBytes).metadata();
  assert.equal(rotateMeta.width,48);assert.equal(rotateMeta.height,64);
  assert.equal(rotateMeta.orientation,undefined);
  assert.equal(rotateMeta.exif,undefined);
  assert.equal(rotateMeta.icc,undefined);
  const orientedPixels=await sharp(rotatedBytes)
    .removeAlpha().raw().toBuffer();
  // After rotating source JPEG 90 degrees clockwise, the source
  // corners end up at: TL blue, TR red, BL yellow, BR green.
  const corners=[
    {x:8,y:8,color:quadrantColors[2]},
    {x:39,y:8,color:quadrantColors[0]},
    {x:8,y:55,color:quadrantColors[3]},
    {x:39,y:55,color:quadrantColors[1]},
  ];
  for(const corner of corners){
    const p=(corner.y*48+corner.x)*3;
    for(let channel=0;channel<3;channel++)
      assert.ok(Math.abs(orientedPixels[p+channel]-
        corner.color[channel])<=38,
      'Orientation 6 must rotate each asymmetric source quadrant correctly');
  }
  completed++;
  console.log('PASS LOCAL WORKERD real EXIF Orientation 6 correction and 4-corner pixel verification.');

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
  assert.equal(completed,13);
  console.log('PASS local WORKERD EDGE: genuine PNG/JPEG/WebP -> metadata-free WebP; animated, mislabeled, malformed, oversized denied. No R2/D1/cloud operations.');
}catch(err){
  console.error('STOP local WORKERD edge WASM feasibility: '+
    String(err?.message||'unverified').slice(0,400));
  process.exitCode=1;
}finally{
  await server.close();
}
