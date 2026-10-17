// Synthetic LOCAL WORKERD only; NEVER deploy. No storage bindings,
// customer files, remote fetch, D1/Google/Shopify/Cloudinary access.
// Real image codecs are @jsquash JPEG/PNG/WebP WASM, using npm packages.
import decodeJpeg,{init as initJpeg} from '@jsquash/jpeg/decode';
import decodePng,{init as initPng} from '@jsquash/png/decode';
import decodeWebp,{init as initWebpDec} from '@jsquash/webp/decode';
import encodeWebp,{init as initWebpEnc} from '@jsquash/webp/encode';
import JPEG_WASM from './node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import PNG_WASM from './node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import WEBP_DEC_WASM from './node_modules/@jsquash/webp/codec/dec/webp_dec.wasm';
import WEBP_ENC_WASM from './node_modules/@jsquash/webp/codec/enc/webp_enc.wasm';
import {sanitizeEdgeArtwork,EDGE_LIMITS} from './sanitize.mjs';

const forbidden=()=>new Response('not_found',{status:404,
  headers:{'Cache-Control':'private, no-store'}});
let initialized;
function init(){
  if(!initialized)initialized=Promise.all([
    initJpeg(JPEG_WASM),initPng(PNG_WASM),
    initWebpDec(WEBP_DEC_WASM),initWebpEnc(WEBP_ENC_WASM),
  ]).catch(()=>{initialized=undefined;throw Error('edge_codec_init_failed');});
  return initialized;
}
async function boundedBytes(request){
  const n=Number(request.headers.get('content-length'));
  if(Number.isFinite(n)&&n>EDGE_LIMITS.maxInputBytes)
    throw Error('oversized');
  if(!request.body)throw Error('empty');
  const reader=request.body.getReader();
  const chunks=[];
  let size=0;
  try{
    while(true){
      const result=await reader.read();
      if(result.done)break;
      const chunk=result.value;
      if(!(chunk instanceof Uint8Array))throw Error('invalid');
      size+=chunk.length;
      if(size>EDGE_LIMITS.maxInputBytes)throw Error('oversized');
      chunks.push(chunk);
    }
  }finally{reader.releaseLock();}
  const buffer=new Uint8Array(size);
  let index=0;
  for(const chunk of chunks){buffer.set(chunk,index);index+=chunk.length;}
  return buffer;
}
export default {
  async fetch(request){
    if(request.method!=='POST'||
      new URL(request.url).pathname!=='/__jill_local_codec_probe'||
      request.headers.get('X-Jill-Synthetic-Only')!=='phase18')
      return forbidden();
    let content;
    try{
      content=await boundedBytes(request);
      await init();
      const output=await sanitizeEdgeArtwork({
        bytes:content,
        declaredMime:request.headers.get('content-type'),
        codecs:{
          decode(mime,arrayBuffer){
            return mime==='image/png'?decodePng(arrayBuffer):
              mime==='image/jpeg'?decodeJpeg(arrayBuffer):
                decodeWebp(arrayBuffer);
          },
          encodeWebp(img){return encodeWebp(img,{quality:80});},
        },
      });
      return new Response(output.bytes,{
        status:200,
        headers:{
          'Content-Type':'image/webp',
          'Cache-Control':'private, no-store',
          'X-Jill-Sanitized':'true',
          'X-Jill-Source-Type':output.source_mime_type,
          'X-Jill-Width':String(output.width),
          'X-Jill-Height':String(output.height),
          'X-Jill-Persisted':'false',
        },
      });
    }catch{
      // Do not leak pixels, content, WASM errors or stack traces.
      return new Response('artwork_not_accepted',{
        status:422,
        headers:{'Cache-Control':'private, no-store'},
      });
    }
  },
};
