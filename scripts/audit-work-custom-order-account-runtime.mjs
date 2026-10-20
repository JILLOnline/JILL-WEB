import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

// Read-only public WORK gateway certification. No session tokens, customer IDs,
// Shopify connections, rewards mutations or Google requests are supplied.
// The POST requests have no valid Authorization header; the backend must reject
// both before any account-specific quota or data lookup can occur.
export const WORK_ACCOUNT_GATEWAY =
  'https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonResponse(response, checkName) {
  const type = response.headers.get('content-type') || '';
  assert(type.toLowerCase().includes('application/json'),
    `${checkName}: expected JSON response.`);
  const text = await response.text();
  assert(text.length < 4096, `${checkName}: unexpectedly large response.`);
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`${checkName}: invalid JSON response.`); }
  assert(data && typeof data === 'object' && !Array.isArray(data),
    `${checkName}: invalid JSON object.`);
  return data;
}

export async function auditWorkCustomOrderAccountRuntime({
  request = fetch,
  timeoutMs = 15000,
} = {}) {
  assert(typeof request === 'function', 'The request adapter must be a function.');
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60000,
    'Invalid audit timeout.');
  const results = [];
  const checks = [
    {name:'WORK health', path:'/healthz', method:'GET', status:200},
    {name:'Extension CORS preflight', path:'/jill-custom-order-account', method:'OPTIONS', status:204},
    {name:'Anonymous account read denied', path:'/jill-custom-order-account', method:'POST', status:401},
    {name:'Unapproved body rejected', path:'/jill-custom-order-account', method:'POST', status:400, body:'{}'},
  ];
  for (const check of checks) {
    const headers = check.method === 'POST' && check.body === undefined
      ? {'Content-Length':'0'}
      : check.body !== undefined ? {'Content-Type':'application/json'} : {};
    const response = await request(WORK_ACCOUNT_GATEWAY + check.path, {
      method:check.method,
      headers,
      ...(check.body !== undefined ? {body:check.body} : {}),
      redirect:'error',
      signal:AbortSignal.timeout(timeoutMs),
    });
    assert(response.status === check.status,
      `${check.name}: expected HTTP ${check.status}, received HTTP ${response.status}.`);
    if (check.method === 'OPTIONS') {
      assert(response.headers.get('access-control-allow-origin') === '*',
        `${check.name}: extension CORS header is missing.`);
      assert((response.headers.get('access-control-allow-headers') || '').toLowerCase().includes('authorization'),
        `${check.name}: authorization preflight is not permitted.`);
    } else {
      const data = await jsonResponse(response, check.name);
      if (check.name === 'WORK health') {
        assert(data.ok === true && data.environment === 'WORK_CUSTOM_ORDERS_QA',
          'WORK health: wrong shop/environment or unhealthy Worker.');
      } else {
        const code = check.status === 401 ? 'unauthenticated_account' : 'invalid_request';
        assert(data.ok === false && data.version === 1 &&
          data.operation === 'custom_order.account.list.result' &&
          data.error?.code === code,
          `${check.name}: unexpected fail-closed response.`);
        assert(response.headers.get('access-control-allow-origin') === '*',
          `${check.name}: missing extension CORS header.`);
        assert((response.headers.get('cache-control') || '').includes('no-store'),
          `${check.name}: account error response may be cached.`);
      }
    }
    results.push({check:check.name, status:response.status, passed:true});
  }
  return results;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const results = await auditWorkCustomOrderAccountRuntime();
    for (const result of results) console.log(`PASS ${result.status} ${result.check}`);
    console.log('WORK public gateway contract passed. Authenticated customer history and deployed SHA remain separate gates.');
  } catch (error) {
    console.error(`WORK public gateway audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
