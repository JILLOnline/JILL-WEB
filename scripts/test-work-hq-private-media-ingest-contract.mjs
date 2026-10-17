// Pure offline media header/size/hash tests: NO filesystem assets,
// D1, Cloudinary, R2, Shopify, Google, requests, secrets or deployment.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
  inspectWorkPrivateArtworkBytes as inspect,
  WORK_ARTWORK_MAX_BYTES,
} from '../services/jill-order-desk/work-private-media-ingest-contract.mjs';

const png=Buffer.alloc(33,0);
Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
png.writeUInt32BE(13,8);
png.write('IHDR',12,'ascii');
png.writeUInt32BE(100,16);
png.writeUInt32BE(100,20);
const jpeg=Buffer.alloc(48,0);
Buffer.from([0xff,0xd8,0xff,0xe0]).copy(jpeg);
jpeg[jpeg.length-2]=0xff;jpeg[jpeg.length-1]=0xd9;
const webp=Buffer.alloc(24,0);
webp.write('RIFF',0,'ascii');webp.writeUInt32LE(16,4);
webp.write('WEBP',8,'ascii');webp.write('VP8X',12,'ascii');

for(const [bytes,declaredMime] of [
  [png,'image/png'],[jpeg,'image/jpeg'],[webp,'image/webp'],
]){
  const result=inspect({bytes,declaredMime});
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(Object.keys(result).sort(),[
    'byte_length','content_sha256','delivery_state','kind','mime_type',
    'privacy_attested','requires','storage_state',
  ].sort());
  assert.equal(result.mime_type,declaredMime);
  assert.equal(result.byte_length,bytes.length);
  assert.equal(result.content_sha256,
    createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.storage_state,'not_written');
  assert.equal(result.privacy_attested,false);
  assert.equal(result.delivery_state,'disabled');
  assert.equal(result.kind,'unpersisted_private_artwork_candidate');
  assert.ok(!['url','href','object_key','storage_key','file','bytes','asset_id',
    'private_url','signed_url','token','provider'].some(k=>k in result));
  assert.doesNotMatch(JSON.stringify(result),/res\.cloudinary|https?:/);
}
const offsetSource=Buffer.concat([Buffer.from([3,4,5]),png,
  Buffer.from([6])]);
const view=new Uint8Array(offsetSource.buffer,
  offsetSource.byteOffset+3,png.length);
assert.equal(inspect({bytes:view,declaredMime:'image/png'}).content_sha256,
  createHash('sha256').update(png).digest('hex'));
const corruptPng=Buffer.from(png);corruptPng.writeUInt32BE(0,16);
const giantPng=Buffer.from(png);giantPng.writeUInt32BE(10001,16);
const bombPng=Buffer.from(png);bombPng.writeUInt32BE(9000,16);
bombPng.writeUInt32BE(9000,20);
const malformedWebp=Buffer.from(webp);malformedWebp.writeUInt32LE(32,4);
const truncatedJpeg=Buffer.from(jpeg);truncatedJpeg[truncatedJpeg.length-1]=0;
for(const bad of [
  null,undefined,{},[],{bytes:png},{bytes:png,declaredMime:'image/jpeg'},
  {bytes:png,declaredMime:'image/svg+xml'},
  {bytes:png,declaredMime:'image/heic'},
  {bytes:png,declaredMime:'IMAGE/PNG'},
  {bytes:png,declaredMime:'image/png',shop:'jillonlinestore.myshopify.com'},
  {bytes:'https://res.cloudinary.com/synthetic/image/upload/v1791/a.png',
    declaredMime:'image/png'},
  {bytes:'jill:opaque-media-id',declaredMime:'image/png'},
  {bytes:new ArrayBuffer(64),declaredMime:'image/png'},
  {bytes:new Uint8Array(32),declaredMime:'image/png'},
  {bytes:Buffer.alloc(WORK_ARTWORK_MAX_BYTES+1),declaredMime:'image/png'},
  {bytes:Buffer.from('<svg onload=alert(1)>'),declaredMime:'image/png'},
  {bytes:Buffer.from('%PDF-1.7'),declaredMime:'image/png'},
  {bytes:Buffer.from('PK\\x03\\x04'),declaredMime:'image/png'},
  {bytes:corruptPng,declaredMime:'image/png'},
  {bytes:giantPng,declaredMime:'image/png'},
  {bytes:bombPng,declaredMime:'image/png'},
  {bytes:malformedWebp,declaredMime:'image/webp'},
  {bytes:truncatedJpeg,declaredMime:'image/jpeg'},
]){
  assert.throws(()=>inspect(bad),/work_private_artwork_not_accepted/);
}
const src=readFileSync(
  'services/jill-order-desk/work-private-media-ingest-contract.mjs','utf8');
assert.doesNotMatch(src,/\bfetch\(|\bnew Request\(|\bINSERT INTO\b|\bUPDATE\b|\bDELETE FROM\b|createSignedUrl|putObject|\.put\(/);
assert.match(src,/NOT full image decoding, malware scanning, sanitization/);
const proposal=readFileSync(
  'services/jill-order-desk/migration-plans/0004_work_private_media_registry.sql','utf8');
assert.match(proposal,/INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION/);
console.log('PASS WORK private-artwork ingress contract: PNG/JPEG/WebP header, strict MIME/size/dimensions, hash-only output; rejects public URLs, SVG, wrong bytes, oversized and mismatched files; storage/preview OFF; NO remote operations.');
