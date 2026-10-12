import http from 'node:http';
import {pathToFileURL} from 'node:url';
import Redis from 'ioredis';
import {createCustomOrderWorkProxyRoute} from '../../backend/custom-order-work-proxy-route.mjs';
import {createCustomOrderWorkRateLimiter} from './rate-limit.mjs';

import {handleWorkGatewayHttp,loadWorkGatewayConfig} from './http-handler.mjs';

export async function startWorkGateway(env=process.env,{createRedis}={}) {
  const settings=loadWorkGatewayConfig(env);
  const redis=createRedis
    ? createRedis(settings.redisUrl)
    : new Redis(settings.redisUrl,{
        lazyConnect:true,
        enableOfflineQueue:false,
        maxRetriesPerRequest:1,
        connectTimeout:5000,
        retryStrategy:()=>null,
      });
  try {
    if(typeof redis.connect==='function')await redis.connect();
    if(await redis.ping()!=='PONG')throw new Error('WORK Redis did not pass preflight.');
  } catch {
    if(typeof redis.disconnect==='function')redis.disconnect();
    throw new Error('WORK gateway cannot start without shared Redis.');
  }
  const rateLimit=createCustomOrderWorkRateLimiter(redis);
  const route=createCustomOrderWorkProxyRoute({
    shopifyAppSecret:settings.shopifyAppSecret,
    googleGatewaySecret:settings.googleGatewaySecret,
    googleQaEndpoint:settings.googleQaEndpoint,
    rateLimit,
  });
  const server=http.createServer((req,res)=>{
    void handleWorkGatewayHttp(req,res,{route,redis});
  });
  const port=Number(env.PORT||10000);
  if(!Number.isSafeInteger(port)||port<1||port>65535){
    if(typeof redis.disconnect==='function')redis.disconnect();
    throw new Error('Invalid WORK gateway listening port.');
  }
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'0.0.0.0',resolve);
  });
  // No credentials or user-supplied request details in logs.
  console.log('JILL Custom Orders WORK HTTPS upstream listening, health + signed proxy only.');
  const shutdown=()=>{
    server.close();
    if(typeof redis.disconnect==='function')redis.disconnect();
  };
  process.once('SIGTERM',shutdown);
  process.once('SIGINT',shutdown);
  return {server,redis};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  startWorkGateway().catch(()=>{
    console.error('JILL WORK gateway startup blocked by configuration or shared Redis.');
    process.exitCode=1;
  });
}
