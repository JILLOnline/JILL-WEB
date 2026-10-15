// One WORK-only fail-closed switch for authenticated merchant mutations.
// Does not grant identity or scope. The command handler independently
// re-checks Shopify Owner + WORK D1 on EVERY POST.
export function workMerchantWritesReady(env) {
  const key=env?.JILL_HQ_MERCHANT_WRITE_SECRET;
  return env?.JILL_WORK_HOST_STAGE==='canary' &&
    env?.JILL_WORK_MERCHANT_WRITES_ENABLED==='true' &&
    typeof key==='string' && key.length>=32 &&
    key!==env?.JILL_HQ_MERCHANT_READ_SECRET &&
    key!==env?.SHOPIFY_API_SECRET &&
    key!==env?.JILL_WORK_SESSION_KEY_B64;
}
