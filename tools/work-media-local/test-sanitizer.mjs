// WORK local-only real decoder regression. No customer images, Worker,
// Cloudflare billing, R2, D1, URLs, deployed routes or credentials.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  sanitizeWorkArtworkLocally as sanitize,
  LOCAL_WORK_ARTWORK_MAX_PIXELS,
} from './sanitize.mjs';
import {inspectWorkPrivateArtworkBytes}
  from '../../services/jill-order-desk/work-private-media-ingest-contract.mjs';
const raw=Buffer.alloc(80*100*4,155);
const image=sharp(raw,{raw:{width:80,height:100,channels:4}});
const formats=[['image/png','png'],['image/jpeg','jpeg'],['image/webp','webp']];
for(const [mime,format] of formats){
  const bytes=await image.clone().toFormat(format).toBuffer();
  const result=await sanitize({bytes,declaredMime:mime});
  assert.equal(result.sanitized,true);
  assert.equal(result.mime_type,mime);
  assert.ok(Object.isFrozen(result));
  inspectWorkPrivateArtworkBytes({bytes:result.bytes,declaredMime:mime});
  const meta=await sharp(result.bytes).metadata();
  assert.equal(meta.format,format);
  assert.equal(meta.exif,undefined);
  assert.equal(meta.icc,undefined);
  assert.equal(meta.xmp,undefined);
  assert.equal(meta.pages,undefined);
  assert.notDeepEqual(result.bytes,bytes,'must fully re-encode');
}
const jpg=await image.clone().jpeg()
  .withExif({IFD0:{Artist:'PRIVATE_TEST_METADATA_SENTINEL'}}).toBuffer();
assert.ok((await sharp(jpg).metadata()).exif);
const sanitizedJpg=await sanitize({bytes:jpg,declaredMime:'image/jpeg'});
assert.ok(!(await sharp(sanitizedJpg.bytes).metadata()).exif);
assert.ok(!sanitizedJpg.bytes.includes(
  Buffer.from('PRIVATE_TEST_METADATA_SENTINEL')));
const png=await image.clone().png().toBuffer();
const webp=await image.clone().webp().toBuffer();
const rejects=[
  {bytes:Buffer.from('<svg onload="alert(1)"/>'),declaredMime:'image/png'},
  {bytes:'https://public.example/x.png',declaredMime:'image/png'},
  {bytes:png,declaredMime:'image/jpeg'},
  {bytes:jpg,declaredMime:'image/svg+xml'},
  {bytes:png,declaredMime:'image/png',maxOutputBytes:24},
  {bytes:Buffer.alloc(8*1024*1024+1),declaredMime:'image/png'},
  {bytes:Buffer.from(png.subarray(0,25)),declaredMime:'image/png'},
  {bytes:Buffer.from(webp.subarray(0,36)),declaredMime:'image/webp'},
];
for(const input of rejects)
  await assert.rejects(()=>sanitize(input),/work_local_artwork_not_accepted/);
// Header-only spoofed PNGs must never qualify as real decoded images.
const forgedPng=Buffer.alloc(33);
Buffer.from([137,80,78,71,13,10,26,10]).copy(forgedPng);
forgedPng.writeUInt32BE(13,8);
forgedPng.write('IHDR',12);
forgedPng.writeUInt32BE(80,16);
forgedPng.writeUInt32BE(100,20);
await assert.rejects(()=>sanitize({bytes:forgedPng,declaredMime:'image/png'}),
  /work_local_artwork_not_accepted/);
const forgedLarge=Buffer.from(forgedPng);
forgedLarge.writeUInt32BE(5000,16);
forgedLarge.writeUInt32BE(5000,20);
await assert.rejects(()=>sanitize({bytes:forgedLarge,declaredMime:'image/png'}),
  /work_local_artwork_not_accepted/);
// Distinct two-frame WebP fixture, created locally from synthetic pixels.
const animated=Buffer.from('UklGRhYBAABXRUJQVlA4WAoAAAACAAAATwAAYwAAQU5JTQYAAAAAAAAAAABBTk1GcAAAAAAAAAAAAE8AAGMAAJYAAAJWUDggWAAAAJAFAJ0BKlAAZAA+bTaZSaQjIqEg6ACADYlpBigAmQAHRYPmWx99F4bbo818Nt0ea+G26OgAAP75Hdv//kB//kB//kB//ID//iF3shz8Hdpv277dCOuPgABBTk1GcgAAAAAAAAAAAE8AAGMAAJYAAABWUDggWgAAAFQFAJ0BKlAAZAA+bTKTSYIOAADYlpBigAmQH4AAeXhJz/78WYmXky8mXky8mXky8mXGAAD+8JtD//5BcsLrka///ID/kB/yA//kB+VNmcxeRoqsPrjIjCAAAA==','base64');
assert.equal((await sharp(animated).metadata()).pages,2);
await assert.rejects(()=>sanitize({bytes:animated,declaredMime:'image/webp'}),
  /work_local_artwork_not_accepted/);
// Valid image wider than 3000px must be bounded after re-encoding.
const wide=await sharp({create:{
  width:3500,height:40,channels:3,background:'#167bbf',
}}).png().toBuffer();
const shrink=await sanitize({bytes:wide,declaredMime:'image/png'});
const dims=await sharp(shrink.bytes).metadata();
assert.equal(dims.width,3000);
assert.ok(dims.height<=40);
assert.equal(LOCAL_WORK_ARTWORK_MAX_PIXELS,24_000_000);
console.log('PASS LOCAL WORK artwork decoder: genuine PNG/JPEG/WebP re-encode, EXIF removed, max dimensions, animated/malformed/oversized denied; zero cloud operations.');
