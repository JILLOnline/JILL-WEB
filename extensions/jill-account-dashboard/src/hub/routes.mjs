// Single internal route registry for My JILL. No duplicate Shopify app pages.
export const HUB_ROUTES = Object.freeze([
  {id:'overview',label:'Overview',path:''},
  {id:'rewards',label:'Rewards',path:'rewards'},
  {id:'coupons',label:'Coupons',path:'coupons'},
  {id:'custom-orders',label:'Custom Orders',path:'custom-orders'},
  {id:'celebrations',label:'Celebrations',path:'celebrations'},
  {id:'saved',label:'Saved for You',path:'saved'},
  {id:'settings',label:'JILL Settings',path:'settings'},
]);

export function canonicalRoute(route) {
  return HUB_ROUTES.some((item) => item.id===route) ? route : 'overview';
}
export function routeFromEntry(entry) {
  if (!entry?.url) return 'overview';
  try {
    const pathname = new URL(entry.url).pathname;
    const last = pathname.split('/').filter(Boolean).at(-1);
    return canonicalRoute(last);
  } catch {
    return 'overview';
  }
}
export function extensionRoute(route) {
  const item=HUB_ROUTES.find((x)=>x.id===canonicalRoute(route));
  return 'extension://' + item.path;
}
