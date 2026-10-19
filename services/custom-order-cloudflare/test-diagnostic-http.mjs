// Real loopback HTTP -> workerd -> canonical gateway. Synthetic secrets only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gatewayDiagnosticSignature,receiptSignature}
  from '../../backend/custom-order-gateway.mjs';

// Resolve Workers runtime/bundler from our declared Wrangler dependency;
// do not rely on npm hoisting its implementation dependencies.
const require=createRequire(import.meta.url);
const workerRequire=createRequire(require.resolve('wrangler'));
const {Miniflare,convertV4MiniflareOptions}=workerRequire('miniflare');
const {build}=workerRequire('esbuild');
const runtimeOptions=convertV4MiniflareOptions||((value)=>value);

const ROOT=fileURLToPath(new URL('./',import.meta.url));
const SECRET='synthetic-local-diagnostic-secret-000000000000';
const ENDPOINT='https://script.google.com/macros/s/AKfycbLOCAL_DIAGNOSTIC/exec';
const bundle=await build({stdin:{contents:`
  import worker,{CustomOrderRateLimiter} from './worker.mjs';
  export {CustomOrderRateLimiter};
  export default {async fetch(request,env) {
    const hasStream=request.body!==null;
    const length=request.headers.get('content-length');
    const result=await worker.fetch(request,env);
    result.headers.set('x-test-body-stream',String(hasStream));
    result.headers.set('x-test-content-length',String(length));
    return result;
  }};`,resolveDir:ROOT,sourcefile:'local-http-fixture.mjs'},
  bundle:true,write:false,format:'esm',platform:'neutral',
  external:['node:*','cloudflare:workers']});
let upstream=0;
const mf=new Miniflare(runtimeOptions({modules:true,script:bundle.outputFiles[0].text,
  compatibilityDate:'2026-10-12',compatibilityFlags:['nodejs_compat'],
  bindings:{SHOPIFY_WORK_APP_SECRET:'synthetic-shopify-secret-111111111111111',
    JILL_CUSTOM_ORDER_GATEWAY_SECRET:SECRET,
    JILL_CUSTOM_ORDER_QA_BACKEND_URL:ENDPOINT},
  durableObjects:{RATE_LIMITER:{className:'CustomOrderRateLimiter',useSQLite:true}},
  outboundService:async request=>{
    upstream++;
    assert.equal(request.url,ENDPOINT);
    const body=new URLSearchParams(await request.text());
    assert.equal(body.get('jill_order_receipt'),'1');
    assert.equal(body.has('raw_payload'),false);
    assert.equal(body.get('jill_order_gateway_sig'),receiptSignature({
      action:'receipt',id:body.get('submission_id'),
      timestamp:body.get('jill_order_gateway_ts'),secret:SECRET}));
    return new Response(JSON.stringify({version:1,
      operation:'custom_order.receipt.result',ok:false,
      error:{code:'receipt_not_found',retryable:true}}));
  }}));
try {
  const origin=await mf.ready;
  const url=new URL('/jill-work-gateway-diagnostic',origin);
  const send=async({body,skew=0,secret=SECRET,length}={})=>{
    const timestamp=String(Date.now()+skew),nonce=randomUUID();
    const headers={'x-jill-qa-diagnostic-ts':timestamp,
      'x-jill-qa-diagnostic-nonce':nonce,
      'x-jill-qa-diagnostic-signature':gatewayDiagnosticSignature({
        secret,timestamp,nonce})};
    if(length!==undefined)headers['content-length']=String(length);
    return fetch(url,{method:'POST',headers,body,redirect:'manual'});
  };
  for(const body of [undefined,'',new Uint8Array(0)]) {
    const response=await send({body});
    console.log(JSON.stringify({case:body===undefined?'omitted':
      typeof body==='string'?'empty_string':'empty_bytes',
      body_stream:response.headers.get('x-test-body-stream'),
      content_length:response.headers.get('x-test-content-length'),
      status:response.status}));
    assert.equal(response.status,200,'Zero-byte HTTP POST must pass a valid challenge');
    assert.equal((await response.json()).code,'gateway_google_signature_verified');
  }
  assert.equal(upstream,3);
  for(const args of [{body:'x'}, {skew:-61000}, {skew:61000},
    {secret:'different-synthetic-secret-000000000000000'}]) {
    const response=await send(args);
    assert.equal(response.status,403);
    assert.deepEqual(await response.json(),{ok:false,code:'diagnostic_denied'});
  }
  assert.equal(upstream,3,'Denied challenges must not contact Google');
  console.log('PASS actual Workers HTTP empty POST, HMAC, clock and nonempty-body denial. No remote calls.');
} finally {await mf.dispose();}
