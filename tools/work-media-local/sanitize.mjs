// JILL WORK: LOCAL NODE-ONLY artwork sanitizer (source-only).
// No HTTP listener, Cloudflare Worker import, R2, D1, Google or Shopify IO.
// Only an already-authorized private server/operator could ever call this.
// The caller must enforce WORK Owner authorization and provider privacy.
// DO NOT bundle into Cloudflare Worker: Sharp is a native Node library.
import sharp from 'sharp';
import {
  inspectWorkPrivateArtworkBytes,
  WORK_ARTWORK_MAX_BYTES,
} from '../../services/jill-order-desk/work-private-media-ingest-contract.mjs';

export const LOCAL_WORK_ARTWORK_MAX_PIXELS=24_000_000;
export const LOCAL_WORK_ARTWORK_MAX_SIDE=10_000;
export const LOCAL_WORK_ARTWORK_MAX_OUTPUT_SIDE=3_000;
const TYPES=Object.freeze({
  'image/png':'png',
  'image/jpeg':'jpeg',
  'image/webp':'webp',
});
const deny=()=>{throw Error('work_local_artwork_not_accepted');};
const validNumber=(n,max)=>Number.isSafeInteger(n)&&n>0&&n<=max;

export async function sanitizeWorkArtworkLocally({
  bytes,declaredMime,maxOutputBytes=WORK_ARTWORK_MAX_BYTES,
}={}){
  if(!Object.hasOwn(TYPES,declaredMime)||
     !validNumber(maxOutputBytes,WORK_ARTWORK_MAX_BYTES)||
     !(Buffer.isBuffer(bytes)||
       (bytes instanceof Uint8Array && bytes.buffer instanceof ArrayBuffer)))deny();
  const original=Buffer.from(bytes);
  try{inspectWorkPrivateArtworkBytes({bytes:original,declaredMime});}
  catch{deny();}

  let output;
  try{
    // Ignore source metadata. Decode pixels and re-encode from scratch.
    // animated=true permits rejecting multi-page WebP/APNG before decode.
    const decoder=()=>sharp(original,{
      animated:true,
      failOn:'warning',
      limitInputPixels:LOCAL_WORK_ARTWORK_MAX_PIXELS,
      sequentialRead:true,
    });
    const meta=await decoder().metadata();
    if(meta.format!==TYPES[declaredMime]||
       !validNumber(meta.width,LOCAL_WORK_ARTWORK_MAX_SIDE)||
       !validNumber(meta.height,LOCAL_WORK_ARTWORK_MAX_SIDE)||
       meta.width*meta.height>LOCAL_WORK_ARTWORK_MAX_PIXELS||
       (meta.pages!==undefined && meta.pages!==1))deny();
    let image=decoder()
      .rotate()
      .resize({width:LOCAL_WORK_ARTWORK_MAX_OUTPUT_SIDE,
        height:LOCAL_WORK_ARTWORK_MAX_OUTPUT_SIDE,
        fit:'inside',withoutEnlargement:true})
      .toColourspace('srgb');
    if(declaredMime==='image/png'){
      image=image.png({compressionLevel:7,palette:false});
    }else if(declaredMime==='image/jpeg'){
      image=image.jpeg({quality:90,progressive:false});
    }else{
      image=image.webp({quality:90,effort:4});
    }
    output=await image.toBuffer();
    if(output.byteLength>maxOutputBytes)deny();
    inspectWorkPrivateArtworkBytes({bytes:output,declaredMime});
    const verified=await sharp(output,{
      limitInputPixels:LOCAL_WORK_ARTWORK_MAX_PIXELS,
    }).metadata();
    if(verified.format!==TYPES[declaredMime]||
       !validNumber(verified.width,LOCAL_WORK_ARTWORK_MAX_OUTPUT_SIDE)||
       !validNumber(verified.height,LOCAL_WORK_ARTWORK_MAX_OUTPUT_SIDE)||
       verified.pages>1||
       verified.exif||verified.xmp||verified.iptc||verified.icc||
       verified.orientation)deny();
  }catch{deny();}
  // Bytes are server-only; never serialize this return object into an HTTP
  // response, log, public media registry, or customer-facing preview.
  return Object.freeze({sanitized:true,mime_type:declaredMime,bytes:output});
}
