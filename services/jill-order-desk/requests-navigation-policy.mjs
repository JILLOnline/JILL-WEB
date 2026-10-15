// WORK-only verified navigation freshness policy. No browser storage,
// source read, customer records, Shopify sessions or credential access.
export const WORK_REQUESTS_NAVIGATION_REUSE_MS=15000;
const PATH='/app/requests';
export function isWorkRequestsPath(pathname){
  return typeof pathname==='string' &&
    (pathname===PATH||pathname.startsWith(PATH+'/')) &&
    pathname!=='/app/requests/command';
}
export function mayReuseWorkRequestsSnapshot({
  currentUrl,nextUrl,formMethod,formAction,snapshot,now=Date.now(),
}={}){
  if(formMethod||formAction||!currentUrl||!nextUrl||
     currentUrl.pathname===nextUrl.pathname ||
     !isWorkRequestsPath(currentUrl.pathname) ||
     !isWorkRequestsPath(nextUrl.pathname) ||
     currentUrl.search||nextUrl.search ||
     snapshot?.state!=='ready'||snapshot?.readOnly!==true ||
     !Number.isSafeInteger(snapshot.verifiedAt) ||
     !Number.isSafeInteger(now)||now<snapshot.verifiedAt ||
     now-snapshot.verifiedAt>=WORK_REQUESTS_NAVIGATION_REUSE_MS)
    return false;
  return true;
}
