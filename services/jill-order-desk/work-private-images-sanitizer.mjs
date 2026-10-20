// JILL HQ WORK — source-only Cloudflare Images byte sanitizer adapter.
// NOT an HTTP endpoint, Worker binding, grant, R2 upload or deployment.
// Caller MUST establish Shopify online Owner + WORK D1 authorization and
// canonical signed Google detail BEFORE calling. Caller MUST independently
// enforce an authoritative WORK-only Images Free-plan/quota gate.
// No public URL is accepted or created; output is still untrusted for delivery.
import {
  inspectWorkPrivateArtworkBytes,
  WORK_ARTWORK_MAX_BYTES,
} from './work-private-media-ingest-contract.mjs';

const SHOP='jill-work.myshopify.com';
const IMAGE_MIME=new Set(['image/png','image/jpeg','image/webp']);
const LIMIT=WORK_ARTWORK_MAX_BYTES;
const deny=()=>{throw Error('work_private_images_sanitization_unavailable');};
function safeBytes(input){
  if(!(Buffer.isBuffer(input)||
    (input instanceof Uint8Array && input.buffer instanceof ArrayBuffer)))deny();
  if(input.byteLength<20||input.byteLength>LIMIT)deny();
  return Buffer.from(input);
}
async function limitedResponseBytes(response){
  if(!response || response.ok!==true ||
    !response.body || typeof response.body.getReader!=='function')deny();
  const reader=response.body.getReader();
  const chunks=[];
  let total=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array)||value.byteLength===0)deny();
      total+=value.byteLength;
      if(total>LIMIT)deny();
      chunks.push(Buffer.from(value));
    }
  } catch{ deny(); }
  finally { try{await reader.cancel();}catch{} }
  if(total<20)deny();
  return Buffer.concat(chunks,total);
}
/**
 * Images binding transforms private bytes; no network calls in offline mocks.
 * Fail-closed if trusted free-plan/quota gate absent. Gate MUST be server-side,
 * atomic and account-scoped before this method can be used in production.
 * Offline mock cannot prove actual image decoding or metadata removal.
 */
export async function sanitizeWorkArtworkWithImages({
  shop,bytes,declaredMime,images,authorizeFreeTransformation,
}={}){
  if(shop!==SHOP || !IMAGE_MIME.has(declaredMime) ||
     !images || typeof images.input!=='function' ||
     typeof authorizeFreeTransformation!=='function')deny();
  const source=safeBytes(bytes);
  try{ inspectWorkPrivateArtworkBytes({bytes:source,declaredMime}); }
  catch{ deny(); }
  // Budget gate must fail before invoking the metered Images binding.
  let gate;
  try { gate=await authorizeFreeTransformation({shop,kind:'private_artwork_sanitize_v1'}); }
  catch { deny(); }
  if(!gate||gate.allowed!==true||gate.plan!=='free'||
     gate.source!=='trusted_work_images_free_gate_v1')deny();
  let response;
  try{
    const stream=new ReadableStream({
      start(controller){ controller.enqueue(new Uint8Array(source));controller.close(); },
    });
    const handle=images.input(stream).transform({
      width:3000,height:3000,fit:'scale-down',metadata:'none',
    });
    const options={format:declaredMime,anim:false};
    if(declaredMime!=='image/png')options.quality=90;
    response=await handle.output(options).response();
  }catch { deny(); }
  if(response?.headers?.get('content-type')?.split(';')[0]?.trim().toLowerCase()!==declaredMime)deny();
  const output=await limitedResponseBytes(response);
  try{ inspectWorkPrivateArtworkBytes({bytes:output,declaredMime}); }
  catch{ deny(); }
  return Object.freeze({sanitized:true,mime_type:declaredMime,bytes:output});
}
