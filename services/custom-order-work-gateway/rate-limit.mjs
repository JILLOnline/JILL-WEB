import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

// Two fixed-window buckets are updated ATOMICALLY in one Redis Lua script.
// Every signed request consumes the shop-wide quota, including replayed
// requests with forged/missing client headers. No in-process cache/fallback.
export const RATE_LIMIT_LUA = [
  "local global = redis.call('INCR', KEYS[1])",
  "if global == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "local client = redis.call('INCR', KEYS[2])",
  "if client == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end",
  "if global > tonumber(ARGV[2]) or client > tonumber(ARGV[3]) then return 0 end",
  "return 1",
].join('\n');

function clientBucket(request) {
  // X-Forwarded-For is an advisory client partition only, NEVER
  // authenticated identity. Shopify may strip/append it, so the
  // independent shop-wide quota is mandatory.
  const header=request.headers.get('x-forwarded-for')||'';
  const client=header.length<512?header.split(',')[0]?.trim():'';
  return isIP(client)?createHash('sha256').update(client).digest('hex').slice(0,32):'unknown';
}

export function createCustomOrderWorkRateLimiter(redis,{
  now=Date.now,windowSeconds=60,shopLimit=30,clientLimit=6,
}={}) {
  if(typeof redis?.eval!=='function'||typeof now!=='function' ||
      !Number.isSafeInteger(windowSeconds)||windowSeconds<10 ||
      !Number.isSafeInteger(shopLimit)||shopLimit<1 ||
      !Number.isSafeInteger(clientLimit)||clientLimit<1 ||
      clientLimit>shopLimit) {
    throw new Error('WORK Custom Order limiter requires a healthy shared Redis client.');
  }
  return async function rateLimit({shop,request}) {
    if(shop!=='jill-work.myshopify.com'||!(request instanceof Request))return false;
    const bucket=Math.floor(now()/1000/windowSeconds);
    const keys=[
      'jill:work:customorders:shop:'+bucket,
      'jill:work:customorders:client:'+bucket+':'+clientBucket(request),
    ];
    // Redis errors propagate; the caller fails closed as 503. No fallback.
    const result=await redis.eval(
      RATE_LIMIT_LUA,2,...keys,
      String(windowSeconds+2),String(shopLimit),String(clientLimit)
    );
    return result===1;
  };
}
