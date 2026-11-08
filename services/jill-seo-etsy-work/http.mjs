export const CALLBACK = "/api/etsy/oauth/callback";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; form-action 'self' https://www.etsy.com; frame-ancestors 'none'; base-uri 'none'",
};

export function reply(body, status, headers) {
  return new Response(body, { status, headers: { ...PRIVATE_HEADERS, ...headers } });
}

export function result(body, status = 200, headers = {}) {
  return reply(JSON.stringify(body), status, { "Content-Type": "application/json", ...headers });
}
