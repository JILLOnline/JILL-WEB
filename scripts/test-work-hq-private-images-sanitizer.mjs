// WORK-only source-level Images binding mock test. NO live Images, R2,
// HTTP route, D1, Shopify, Cloudinary, secret, customer file or deployment.
import assert from 'node:assert/strict';
import {sanitizeWorkArtworkWithImages as sanitize} from '../services/jill-order-desk/work-private-images-sanitizer.mjs';
const shop='jill-work.myshopify.com';
const png=(w)=>{
  const b=Buffer.alloc(33);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
  b.writeUInt32BE(13,8);
  b.write('IHDR',12);
  b.writeUInt32BE(w,16);
  b.writeUInt32BE(80,20);
  return b;
};
const input=png(80),output=png(60);
let calls=0,approvals=0;
const approve=async(a)=>{
  approvals++;
  assert.deepEqual(a,{shop,kind:'private_artwork_sanitize_v1'});
  return {allowed:true,plan:'free',source:'trusted_work_images_free_gate_v1'};
};
const imageApi=(bytes=output,mime='image/png',status=200)=>({
  input(stream){
    calls++;
    assert.ok(stream instanceof ReadableStream);
    return {
      transform(opt){
        assert.deepEqual(opt,{width:3000,height:3000,fit:'scale-down',metadata:'none'});
        return this;
      },
      output(opt){
        assert.deepEqual(opt,{format:'image/png',anim:false});
        return {
          response:()=>new Response(new ReadableStream({
            start(c){c.enqueue(bytes);c.close();}
          }),{status,headers:{'content-type':mime}})
        };
      }
    };
  }
});
const base={
  shop,bytes:input,declaredMime:'image/png',
  images:imageApi(),authorizeFreeTransformation:approve,
};
const out=await sanitize(base);
assert.equal(out.sanitized,true);
assert.equal(out.mime_type,'image/png');
assert.deepEqual(out.bytes,output);
assert.ok(Object.isFrozen(out));
assert.equal(calls,1);
const rejectBeforeImages=async(obj)=>{
  const before=calls;
  await assert.rejects(
    ()=>sanitize(obj),
    /work_private_images_sanitization_unavailable/
  );
  assert.equal(calls,before);
};
for(const o of [
  {...base,shop:'jill-live.myshopify.com'},
  {...base,bytes:'https://res.cloudinary.com/x'},
  {...base,bytes:Buffer.from('<script>alert(1)</script>')},
  {...base,declaredMime:'image/svg+xml'},
  {...base,authorizeFreeTransformation:null},
  {...base,authorizeFreeTransformation:async()=>({
    allowed:true,plan:'paid',source:'trusted_work_images_free_gate_v1'
  })},
  {...base,authorizeFreeTransformation:async()=>({
    allowed:true,plan:'free',source:'browser_claim'
  })},
  {...base,authorizeFreeTransformation:async()=>{throw Error('SECRET')}},
]) await rejectBeforeImages(o);
for(const {bytes,mime,status} of [
  {bytes:output,mime:'text/html',status:200},
  {bytes:output,mime:'image/png',status:404},
  {bytes:Buffer.from('hi'),mime:'image/png',status:200},
  {bytes:Buffer.alloc(8*1024*1024+1),mime:'image/png',status:200},
  {bytes:Buffer.from('<svg onload=alert(1)>'),mime:'image/png',status:200},
]){
  await assert.rejects(
    ()=>sanitize({...base,images:imageApi(bytes,mime,status)}),
    /work_private_images_sanitization_unavailable/
  );
}
assert.ok(approvals>0);
console.log('PASS offline WORK Images sanitizer adapter: trusted free gate required; rejects foreign/malformed/media URL bytes; fixed strip-metadata options and bounded output; no remote calls.');
