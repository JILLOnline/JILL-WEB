// My JILL ephemeral state owner fence. Read-only; server/Shopify still
// authorize every Custom Order and Contact read separately.
const ID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const safe=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function reconcileMyJillAccountScope(previous,event){
 const scope=ID.test(previous?.scope||'')?previous.scope:null;
 if(event?.type==='checking')
  return Object.freeze({status:'loading',scope,summary:null});
 if(event?.type==='failed')
  return Object.freeze({status:'error',scope:null,summary:null});
 if(event?.type!=='verified'||!ID.test(event.principal||'')||
    !safe(event.summary))
  return Object.freeze({status:'error',scope:null,summary:null});
 // The key of AccountHub is this freshly Shopify-verified scope. A change
 // destroys all previous account drafts, selection hints, and UI caches.
 return Object.freeze({
  status:'ready',scope:event.principal,summary:event.summary,
 });
}
