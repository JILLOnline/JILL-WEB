interface Env {
  JILL_ORDER_DESK_WORK_DB: D1Database;
  SHOPIFY_API_SECRET: string;
  JILL_WORK_SESSION_KEY_B64: string;
  // Independently provisioned WORK QA read-only key (not an app/customer key).
  JILL_HQ_MERCHANT_READ_SECRET?: string;
  // WORK-only signed command key; must differ from read/gateway/Shopify keys.
  JILL_HQ_MERCHANT_WRITE_SECRET?: string;
  JILL_WORK_MERCHANT_WRITES_ENABLED?: string;
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED?: string;
  JILL_WORK_OAUTH_ENABLED?: string;
  JILL_WORK_HOST_STAGE: 'work'|'canary';
}
