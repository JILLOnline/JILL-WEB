// Request-scoped Shopify Admin authentication. Parallel React Router
// layout and child loaders for ONE HTTP request MUST share ONE SDK
// authentication result instead of independently exchanging session tokens.
// The scope MUST be the per-fetch Cloudflare context object that is created
// afresh by workers/app.ts. Never pass env, shop, a user ID, or a global object.
// WeakMap automatically drops the in-memory promise after the request dies.
// SDK response status/headers/body are preserved per caller; authorization is never
// replaced by trusting cached data from another request.
const authByIncomingRequest=new WeakMap();

/**
 * @template T
 * @param {{scope:object, authenticate:()=>Promise<T>}} options
 * @returns {Promise<T>}
 */
export function authenticateWorkAdminOnce({scope,authenticate}={}) {
  if(!scope||typeof scope!=='object'||
     typeof authenticate!=='function')
    throw Error('invalid_work_admin_auth_scope');
  let existing=authByIncomingRequest.get(scope);
  if(existing)return deliver(existing);
  // Save the promise before calling the SDK, so concurrent layout loaders
  // use the exact same authentication attempt. No retries or auth bypass.
  const task=Promise.resolve().then(authenticate);
  authByIncomingRequest.set(scope,task);
  return deliver(task);
}

// React Router consumes thrown Response bodies separately for every parallel
// loader. Sharing the response stream can lose Shopify bootstrap/error HTML.
// Keep the single SDK attempt, but give each caller its own untouched body.
function deliver(task){
  return task.catch(error=>{throw error instanceof Response?error.clone():error;});
}
