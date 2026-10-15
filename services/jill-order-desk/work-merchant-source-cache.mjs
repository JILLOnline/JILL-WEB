// Bounded per-isolate cache for already-WHITELISTED WORK merchant metadata.
// Only call AFTER verified online Shopify Owner + WORK D1 permission.
// Short TTL avoids a second cold Google Apps Script call when an Owner opens
// a detail page; no customer contact, raw payload, private notes or secrets
// are cached. HTTP responses remain no-store. Never use as an auth shortcut.
import {createHash} from 'node:crypto';
import {projectWorkMerchantInbox} from './merchant-inbox-read.mjs';
import {readWorkGoogleQaMerchantList} from './work-google-merchant-read.mjs';

export const WORK_MERCHANT_CACHE_MS=20000;
const SHOP='jill-work.myshopify.com';
let cached=null;
let pending=null;
let generation=0;

export function invalidateWorkMerchantSourceCache() {
  generation++;
  cached=null;
  pending=null;
  // Even a pending old read cannot repopulate an invalidated snapshot.
  // A future write path must invalidate only AFTER canonical commit.
}

export async function readWorkMerchantSourceCached({
  secret='',reader=readWorkGoogleQaMerchantList,
  now=Date.now,onCache=(_mode)=>{},
}={}) {
  if(typeof secret!=='string'||secret.length<32||
     typeof reader!=='function'||typeof now!=='function')
    throw Error('invalid_work_merchant_cache_input');
  const key=createHash('sha256').update(secret,'utf8').digest('hex');
  const at=now();
  if(cached && cached.key===key && cached.expiresAt>at) {
    onCache('hit');
    return cached.source;
  }
  if(pending && pending.key===key) {
    onCache('joined');
    return pending.promise;
  }
  onCache('miss');
  const currentGeneration=generation;
  const task=(async()=>{
    const upstream=await reader({secret});
    // Reject untrusted source BEFORE saving anything; project strips all PII.
    const verified=projectWorkMerchantInbox(upstream);
    const source=Object.freeze({
      version:1,operation:'custom_order.merchant.list.result',
      ok:true,shop:SHOP,complete:true,records:verified.records,
    });
    const expiresAt=now()+WORK_MERCHANT_CACHE_MS;
    // Do not let an invalidated/superseded fetch warm the cache.
    if(pending?.promise===task && currentGeneration===generation)
      cached={key,expiresAt,source};
    return source;
  })();
  pending={key,promise:task};
  try{return await task;}
  finally{if(pending?.promise===task)pending=null;}
}
