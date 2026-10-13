#!/usr/bin/env node
// Harmless anonymous WORK ingress probe from GitHub Actions.
// An intentionally invalid form body CANNOT create a Custom Order.
// Never use customer details, credentials, cookies or private gateway URLs.
const origin='https://jill-work.myshopify.com';
const url=origin+'/apps/jill-custom-order';
const allowed=new Set([
  'invalid_submission','unauthenticated_proxy','wrong_shop','invalid_origin',
  'rate_limited','rate_limit_unavailable','gateway_unavailable',
  'receipt_unconfirmed','upstream_rejected','not_found','method_not_allowed',
  'payload_too_large',
]);
try {
  const response=await fetch(url,{
    method:'POST',redirect:'manual',
    headers:{
      origin,
      'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
      'accept':'application/json',
    },
    body:'jill_work_proxy_contract_probe=invalid_on_purpose',
    signal:AbortSignal.timeout(14000),
  });
  let route='none';
  const location=response.headers.get('location');
  if(location) {
    try {
      const target=new URL(location,origin);
      route=target.hostname==='jill-work.myshopify.com'&&target.pathname==='/password'
        ? 'shop_password' : target.origin===origin?'shop_redirect':'external_redirect';
    } catch {route='unknown_redirect';}
  }
  const kind=response.headers.get('content-type')||'';
  let code='non_json';
  if(kind.includes('application/json')) {
    try {
      const payload=await response.json();
      const raw=typeof payload?.error?.code==='string'
        ? payload.error.code : typeof payload?.error==='string'?payload.error:'';
      code=allowed.has(raw)?raw:'other_json';
    }catch{code='malformed_json';}
  }
  const assessment=response.status===400&&code==='invalid_submission'
    ? 'SHOPIFY_PROXY_REACHES_VERIFIED_GATEWAY'
    :route==='shop_password'
      ? 'EXTERNAL_PROBE_BLOCKED_BY_WORK_PASSWORD'
      :response.status===401&&code==='unauthenticated_proxy'
        ? 'WORK_SHOPIFY_PROXY_SIGNATURE_FAILED'
        :response.status===503&&code==='gateway_unavailable'
          ? 'WORKER_CONFIG_OR_DEPLOYMENT_UNAVAILABLE'
          :response.status===404
            ? 'WORK_PROXY_ROUTE_NOT_FOUND'
            : 'NEEDS_AUTHENTICATED_BROWSER_INSPECTION';
  console.log(JSON.stringify({
    shop:'jill-work.myshopify.com',
    probe:'intentionally_invalid_no_order_created',
    http_status:response.status,
    response_format:code,
    redirect:route,
    assessment,
  }));
} catch(error) {
  console.log(JSON.stringify({
    shop:'jill-work.myshopify.com',
    probe:'intentionally_invalid_no_order_created',
    assessment:'PUBLIC_NETWORK_PROBE_UNAVAILABLE',
    error_class:error?.name||'Error'
  }));
}

const worker='https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev';
const classify=async (endpoint,method)=> {
  try {
    const response=await fetch(worker+endpoint,{
      method,redirect:'manual',
      headers:method==='POST'?{'content-type':'application/x-www-form-urlencoded'}:{},
      ...(method==='POST'?{body:'jill_work_proxy_contract_probe=invalid_on_purpose'}:{}),
      signal:AbortSignal.timeout(14000),
    });
    let code='non_json';
    try {
      const payload=await response.json();
      if(endpoint==='/healthz') {
        code=payload?.ok===true&&payload?.environment==='WORK_CUSTOM_ORDERS_QA'
          ?'WORK_CUSTOM_ORDERS_QA':'health_unavailable';
      }else{
        const raw=payload?.error?.code||payload?.error;
        code=typeof raw==='string'&&allowed.has(raw)?raw:'other_json';
      }
    }catch{}
    const assessment=endpoint==='/healthz'&&response.status===200&&
       code==='WORK_CUSTOM_ORDERS_QA'?'WORKER_READY':
       endpoint!=='/healthz'&&response.status===401&&code==='unauthenticated_proxy'
        ?'WORKER_ROUTE_REQUIRES_SHOPIFY_SIGNATURE':'CHECK_WORKER_RUNTIME';
    console.log(JSON.stringify({probe:'WORKER_READ_ONLY_'+method,endpoint,http_status:response.status,
      response_format:code,assessment}));
  }catch(error){
    console.log(JSON.stringify({probe:'WORKER_READ_ONLY_'+method,endpoint,
      assessment:'WORKER_HEALTH_PROBE_UNAVAILABLE',error_class:error?.name||'Error'}));
  }
};
await classify('/healthz','GET');
await classify('/jill-custom-order-proxy','POST');

 // Read-only negative account proof: no JWT, no customer ID and no body.
 // Success means rejecting this probe with 401, never returning order data.
try {
  const resp=await fetch(worker+'/jill-custom-order-account',{
    method:'POST',redirect:'manual',
    headers:{'content-type':'application/json','accept':'application/json'},
    body:'',
    signal:AbortSignal.timeout(14000)
  });
  let code='non_json';
  try {
    const payload=await resp.json();
    const raw=payload?.error?.code;
    code=['unauthenticated_account','account_service_unavailable',
      'invalid_request','rate_limit_unavailable'].includes(raw)?raw:'unclassified';
  }catch{}
  const assessment=resp.status===401&&code==='unauthenticated_account'
    ?'ACCOUNT_JWT_GATE_ONLINE'
    :resp.status===503&&code==='account_service_unavailable'
      ?'ACCOUNT_GATE_CONFIG_MISSING'
      :resp.status===404?'ACCOUNT_ROUTE_NOT_DEPLOYED'
        :'ACCOUNT_GATE_UNEXPECTED_RESPONSE';
  console.log(JSON.stringify({probe:'WORK_ACCOUNT_ANONYMOUS_DENIAL',
    http_status:resp.status,response_format:code,assessment}));
}catch(error) {
  console.log(JSON.stringify({probe:'WORK_ACCOUNT_ANONYMOUS_DENIAL',
    assessment:'WORKER_HEALTH_PROBE_UNAVAILABLE',error_class:error?.name||'Error'}));
}
