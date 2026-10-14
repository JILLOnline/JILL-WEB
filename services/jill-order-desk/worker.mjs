// The only eventual WORK merchant Worker entrypoint.
// No Shopify Admin authentication is configured yet: deny EVERY merchant API
// route until an official SDK-authenticated App Home host is integrated.
// Never expose the D1 binding through public responses or client-side code.
const headers={
  'Cache-Control':'private, no-store, max-age=0',
  'X-Content-Type-Options':'nosniff',
};
export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/healthz')
      return Response.json({
        ok:true,environment:'JILL_ORDER_DESK_WORK',admin_ready:false,
      },{headers});
    return Response.json({ok:false,error:'merchant_host_not_configured'},
      {status:503,headers});
  },
};
