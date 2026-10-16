// JILL WORK: genuine WASM image decode / WebP re-encode safety boundary.
// Worker-safe JS (no Node, Sharp, Images binding, network or object storage).
// This is NOT a deployed upload handler. All tests use local synthetic data.
// 8 MiB input, 4 million decoded pixels and 3000px/axis protect workerd RAM.
export const EDGE_LIMITS=Object.freeze({
  maxInputBytes:8*1024*1024,
  maxOutputBytes:8*1024*1024,
  maxPixels:4_000_000,
  maxDimension:3000,
});
const fail=()=>{throw Error('work_edge_artwork_rejected');};
const type=new Set(['image/png','image/jpeg','image/webp']);
const pngSig=[137,80,78,71,13,10,26,10];
function equalAt(b,offset,seq){
  if(offset<0||offset+seq.length>b.length)return false;
  return seq.every((v,i)=>b[offset+i]===v);
}
function letters(b,offset,len){
  return String.fromCharCode(...b.subarray(offset,offset+len));
}
const be16=(b,i)=>(b[i]<<8)|b[i+1];
const be32=(b,i)=>((b[i]*16777216)+(b[i+1]<<16)+(b[i+2]<<8)+b[i+3])>>>0;
const le24=(b,i)=>b[i]+b[i+1]*256+b[i+2]*65536;
const le32=(b,i)=>(b[i]+b[i+1]*256+b[i+2]*65536+b[i+3]*16777216)>>>0;
function dimensions(w,h){
  if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||
     w<1||h<1||w>EDGE_LIMITS.maxDimension||
     h>EDGE_LIMITS.maxDimension||w*h>EDGE_LIMITS.maxPixels)fail();
  return {width:w,height:h};
}
function png(b){
  if(!equalAt(b,0,pngSig)||b.length<45||
     be32(b,8)!==13||letters(b,12,4)!=='IHDR')fail();
  const size=dimensions(be32(b,16),be32(b,20));
  let off=8,seenIEND=false,seenIHDR=false;
  while(off+12<=b.length){
    const len=be32(b,off);
    if(len>EDGE_LIMITS.maxInputBytes || off+12+len>b.length)fail();
    const chunk=letters(b,off+4,4);
    if(!/^[a-zA-Z]{4}$/.test(chunk))fail();
    if(!seenIHDR){if(chunk!=='IHDR'||len!==13)fail();seenIHDR=true;}
    else if(chunk==='IHDR')fail();
    if(chunk==='acTL'||chunk==='fcTL'||chunk==='fdAT')fail();
    off+=12+len;
    if(chunk==='IEND'){
      if(len!==0||off!==b.length)fail();
      seenIEND=true;break;
    }
  }
  if(!seenIEND)fail();
  return {...size,orientation:1,mime:'image/png'};
}
function exifOrientation(b,start,end){
  if(end-start<14||letters(b,start,4)!=='Exif'||
     b[start+4]!==0||b[start+5]!==0)return 1;
  const base=start+6;
  const little=letters(b,base,2)==='II';
  const big=letters(b,base,2)==='MM';
  if(!little&&!big)fail();
  const u16=p=>{if(p+2>end)fail();return little?b[p]+b[p+1]*256:be16(b,p);};
  const u32=p=>{if(p+4>end)fail();return little?le32(b,p):be32(b,p);};
  if(u16(base+2)!==42)fail();
  const ifd=base+u32(base+4);
  if(ifd+2>end)fail();
  const count=u16(ifd);
  if(count>256||ifd+2+count*12>end)fail();
  for(let n=0;n<count;n++){
    const p=ifd+2+n*12;
    if(u16(p)===0x0112){
      if(u16(p+2)!==3||u32(p+4)!==1)fail();
      const v=u16(p+8);
      if(v<1||v>8)fail();
      return v;
    }
  }
  return 1;
}
const SOF=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
function jpeg(b){
  if(b.length<20||!equalAt(b,0,[255,216])||
     !equalAt(b,b.length-2,[255,217]))fail();
  let off=2,w=0,h=0,orientation=1,seenExif=false,sos=false;
  while(off+4<=b.length){
    if(b[off++]!==255)fail();
    while(b[off]===255)off++;
    const marker=b[off++];
    if(marker===0xd9)break;
    if(marker===0xda){sos=true;break;}
    if(marker===0x00||marker===0xd8||marker===0x01||
       (marker>=0xd0&&marker<=0xd7))fail();
    if(off+2>b.length)fail();
    const len=be16(b,off);
    if(len<2||off+len>b.length)fail();
    const start=off+2,end=off+len;
    if(SOF.has(marker)){
      if(w||h||len<8)fail();
      h=be16(b,start+1);w=be16(b,start+3);
    }
    if(marker===0xe1&&equalAt(b,start,[69,120,105,102,0,0])){
      if(seenExif)fail();
      seenExif=true;
      orientation=exifOrientation(b,start,end);
    }
    off=end;
  }
  if(!sos)fail();
  return {...dimensions(w,h),orientation,mime:'image/jpeg'};
}
function webp(b){
  if(b.length<30||letters(b,0,4)!=='RIFF'||
     letters(b,8,4)!=='WEBP'||le32(b,4)+8!==b.length)fail();
  let off=12,w=0,h=0,features=false,frame=false,animated=false;
  while(off+8<=b.length){
    const name=letters(b,off,4),n=le32(b,off+4),p=off+8;
    if(n>EDGE_LIMITS.maxInputBytes||p+n>b.length)fail();
    if(name==='ANIM'||name==='ANMF')animated=true;
    if(name==='VP8X'){
      if(features||frame||n<10)fail();
      features=true;
      if(b[p]&0x02)animated=true;
      w=le24(b,p+4)+1;h=le24(b,p+7)+1;
    }
    if(name==='VP8 '){
      if(frame||n<10||!equalAt(b,p+3,[0x9d,0x01,0x2a]))fail();
      frame=true;
      const fw=be16(Uint8Array.of(b[p+7],b[p+6]),0)&0x3fff;
      const fh=be16(Uint8Array.of(b[p+9],b[p+8]),0)&0x3fff;
      if(features){if(w!==fw||h!==fh)fail();}
      else{w=fw;h=fh;}
    }
    if(name==='VP8L'){
      if(frame||n<5||b[p]!==0x2f)fail();
      frame=true;
      const fw=1+(((b[p+2]&0x3f)<<8)|b[p+1]);
      const fh=1+(((b[p+4]&0x0f)<<10)|(b[p+3]<<2)|((b[p+2]&0xc0)>>6));
      if(features){if(w!==fw||h!==fh)fail();}
      else{w=fw;h=fh;}
    }
    off=p+n+(n&1);
  }
  if(off!==b.length||animated||!frame)fail();
  return {...dimensions(w,h),orientation:1,mime:'image/webp'};
}
export function inspectEdgeImageHeader(input,mime){
  if(!(input instanceof Uint8Array)||!type.has(mime)||
     input.length<20||input.length>EDGE_LIMITS.maxInputBytes)fail();
  const v=mime==='image/png'?png(input):
    mime==='image/jpeg'?jpeg(input):webp(input);
  if(v.mime!==mime)fail();
  return Object.freeze(v);
}
function oriented(image,orientation){
  if(orientation===1)return image;
  const {width:w,height:h,data}=image;
  const transposed=orientation>=5;
  const ow=transposed?h:w,oh=transposed?w:h;
  const output=new Uint8ClampedArray(ow*oh*4);
  for(let y=0;y<oh;y++){
    for(let x=0;x<ow;x++){
      let sx,sy;
      switch(orientation){
        case 2:sx=w-1-x;sy=y;break;
        case 3:sx=w-1-x;sy=h-1-y;break;
        case 4:sx=x;sy=h-1-y;break;
        case 5:sx=y;sy=x;break;
        case 6:sx=y;sy=h-1-x;break;
        case 7:sx=w-1-y;sy=h-1-x;break;
        case 8:sx=w-1-y;sy=x;break;
        default:fail();
      }
      output.set(data.subarray((sy*w+sx)*4,(sy*w+sx)*4+4),(y*ow+x)*4);
    }
  }
  return {width:ow,height:oh,data:output};
}
export async function sanitizeEdgeArtwork({bytes,declaredMime,codecs}={}){
  if(!(bytes instanceof Uint8Array)||!codecs||
     typeof codecs.decode!=='function'||typeof codecs.encodeWebp!=='function')fail();
  const header=inspectEdgeImageHeader(bytes,declaredMime);
  let pixels;
  try{
    const input=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    pixels=await codecs.decode(declaredMime,input);
  }catch{fail();}
  if(!pixels||pixels.width!==header.width||pixels.height!==header.height||
     !ArrayBuffer.isView(pixels.data)||
     pixels.data.BYTES_PER_ELEMENT!==1||
     pixels.data.byteLength!==pixels.width*pixels.height*4)fail();
  pixels=oriented(pixels,header.orientation);
  let encoded;
  try{encoded=await codecs.encodeWebp(pixels);}catch{fail();}
  if(!(encoded instanceof ArrayBuffer)&&!(encoded instanceof Uint8Array))fail();
  const out=new Uint8Array(encoded);
  if(out.length<20||out.length>EDGE_LIMITS.maxOutputBytes)fail();
  const safe=inspectEdgeImageHeader(out,'image/webp');
  if(safe.width!==pixels.width||safe.height!==pixels.height)fail();
  // Output must be a simple VP8/VP8L stream. Reject EXIF, ICCP or XMP
  // chunks even if a future encoder starts adding metadata by default.
  for(let p=12;p+8<=out.length;){
    const chunk=letters(out,p,4),length=le32(out,p+4);
    if(['EXIF','XMP ','ICCP','ANIM','ANMF'].includes(chunk))fail();
    p+=8+length+(length&1);
  }
  return Object.freeze({
    mime_type:'image/webp',bytes:out,width:pixels.width,
    height:pixels.height,source_mime_type:declaredMime,
    sanitized:true,metadata_copied:false,
    // No R2/HTTP/store authorization is returned.
    upload_authorized:false,
  });
}
