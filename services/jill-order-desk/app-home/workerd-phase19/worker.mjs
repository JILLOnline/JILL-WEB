// DO NOT DEPLOY. Test harness only. No customer or merchant routes.
export default {
  async fetch() {
    return new Response('not_found',{status:404,
      headers:{'Cache-Control':'private, no-store'}});
  },
};
