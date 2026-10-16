// WORK JILL HQ: description ONLY for original, untrusted file references.
// Auth is enforced by the parent Owner-only route; this helper grants none.
// Do not fetch, open, link, trust, sign or proxy raw stored URL values.
const ALLOWED_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CLOUD=/^[a-z0-9][a-z0-9_-]{1,63}$/;
const FILENAME=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const VERSION=/^v[0-9]{7,16}$/;
const FORMATS=new Set(['png','jpg','jpeg','webp','heic','heif']);
export function describeWorkReference(value){
  if(typeof value!=='string'||value.length>512||!value.trim())
    return Object.freeze({kind:'unverified',label:'Unverified reference',
      identifier:'Not verified'});
  const original=value.trim();
  // Recognize only the strict Cloudinary path structure. Classification
  // does NOT establish the true account, file ownership or file privacy.
  // Never output the original URL or a browser-usable destination.
  try{
    const u=new URL(original);
    const parts=u.pathname.split('/').filter(Boolean);
    if(u.protocol==='https:' && u.hostname==='res.cloudinary.com' &&
      !u.username&&!u.password&&!u.port&&!u.search&&!u.hash &&
      parts.length===5 && CLOUD.test(parts[0]) &&
      parts[1]==='image' && parts[2]==='upload' &&
      VERSION.test(parts[3]) && FILENAME.test(parts[4])){
      const filename=parts[4],extension=filename.split('.').at(-1)?.toLowerCase();
      if(FORMATS.has(extension) && filename.includes('.'))
        return Object.freeze({kind:'legacy_cloudinary_url',
          label:'Cloudinary image reference',identifier:filename});
    }
    // Even HTTPS links cannot be treated as authenticated artwork. No
    // provider URL or raw token belongs in this view.
    return Object.freeze({kind:'external_url_unverified',
      label:'External URL reference',identifier:'Not verified'});
  }catch{
    if(ALLOWED_ID.test(original))
      return Object.freeze({kind:'opaque_id',
        label:'Opaque reference ID',identifier:original});
    return Object.freeze({kind:'unverified',
      label:'Unverified reference',identifier:'Not verified'});
  }
}
