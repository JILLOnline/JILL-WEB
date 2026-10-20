import {DurableObject} from 'cloudflare:workers';
import {consumeQuota} from './limiter.mjs';
import {handleCloudflareCustomOrderWork} from './handler.mjs';

// Only SQLite-backed DOs are available on the Cloudflare Workers Free plan.
export class CustomOrderRateLimiter extends DurableObject {
  async ping() {
    return this.ctx.storage.sql.exec('SELECT 1 AS ok').one()?.ok===1;
  }
  async allow({shop,client,minute}) {
    if(shop!=='jill-work.myshopify.com')return false;
    // The Durable Object is single-threaded and these SQL statements are
    // synchronous. Both counters are committed before returning the result.
    return consumeQuota(this.ctx.storage.sql,{bucket:minute,client});
  }
}

export default {
  async fetch(request,env) {
    return handleCloudflareCustomOrderWork(request,env);
  },
};
