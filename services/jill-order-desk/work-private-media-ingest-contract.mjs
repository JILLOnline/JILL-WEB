// JILL HQ WORK — private artwork byte-check boundary, SOURCE ONLY.
// Not an HTTP upload route, not image decoding, R2/Cloudinary write,
// Owner authentication, registry insert, presigned grant or preview.
// Existing public Cloudinary URLs and canonical reference strings MUST NOT
// be passed as file bytes or reclassified as private storage.
// This function provides only a bounded, hash-only candidate for a later
// authenticated, provider-private, scanned/re-encoded ingestion process.
import {createHash} from 'node:crypto';

export const WORK_ARTWORK_MAX_BYTES=8*1024*1024;
const MAX_DIMENSION=10000;
const MAX_PIXELS=40_000_000;
const MEDIA=new Set(['image/png','image/jpeg','image/webp']);
const HEADER_PNG=Buffer.from([137,80,78,71,13,10,26,10]);
function deny(){throw Error('work_private_artwork_not_accepted');}
function bytesOf(input){
  if(Buffer.isBuffer(input))return input;
  if(input instanceof Uint8Array &&
     input.buffer instanceof ArrayBuffer)
    return Buffer.from(input.buffer,input.byteOffset,input.byteLength);
  deny();
}
function fileType(buffer){
  if(buffer.length>=24 &&
    buffer.subarray(0,8).equals(HEADER_PNG) &&
    buffer.readUInt32BE(8)===13 &&
    buffer.toString('ascii',12,16)==='IHDR'){
    const w=buffer.readUInt32BE(16),h=buffer.readUInt32BE(20);
    if(w<1||h<1||w>MAX_DIMENSION||h>MAX_DIMENSION||
       w*h>MAX_PIXELS)deny();
    return 'image/png';
  }
  if(buffer.length>=16 &&
    buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff &&
    buffer[buffer.length-2]===0xff&&buffer[buffer.length-1]===0xd9)
    return 'image/jpeg';
  if(buffer.length>=20 &&
    buffer.toString('ascii',0,4)==='RIFF' &&
    buffer.toString('ascii',8,12)==='WEBP' &&
    ['VP8 ','VP8L','VP8X'].includes(buffer.toString('ascii',12,16)) &&
    buffer.readUInt32LE(4)+8===buffer.length)
    return 'image/webp';
  deny();
}
export function inspectWorkPrivateArtworkBytes(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).length!==2||
     !Object.hasOwn(input,'bytes')||
     !Object.hasOwn(input,'declaredMime')||
     typeof input.declaredMime!=='string'||
     !MEDIA.has(input.declaredMime))deny();
  const bytes=bytesOf(input.bytes);
  if(bytes.byteLength<20||bytes.byteLength>WORK_ARTWORK_MAX_BYTES)
    deny();
  const detected=fileType(bytes);
  if(detected!==input.declaredMime)deny();
  // This is NOT full image decoding, malware scanning, sanitization or
  // complete format validity. No provider storage may be labelled private
  // without its independent server-side attestation and read-back checks.
  return Object.freeze({
    kind:'unpersisted_private_artwork_candidate',
    mime_type:detected,
    byte_length:bytes.byteLength,
    content_sha256:createHash('sha256').update(bytes).digest('hex'),
    storage_state:'not_written',
    privacy_attested:false,
    delivery_state:'disabled',
    requires:'authenticated_owner_private_storage_validation',
  });
}
