import { EtsyConnection } from "./connection.mjs";
import { CALLBACK, reply, result } from "./http.mjs";
export { EtsyConnection };

const WORK_ORIGIN = "https://jill-seo-etsy-work.jill-work-custom-orders.workers.dev";
const ROUTES = new Map([
  ["/", "GET"],
  ["/api/etsy/oauth/start", "POST"],
  [CALLBACK, "GET"],
  ["/api/etsy/listings/sample", "POST"],
]);
function setupPage() {
  return reply(`<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JILL SEO WORK</title><main><h1>JILL SEO WORK</h1>
<form method="post">
<label>WORK access key <input name="key" type="password" required autocomplete="off"></label>
<button formaction="/api/etsy/oauth/start">Connect Etsy</button>
<button formaction="/api/etsy/listings/sample">Check one active listing</button>
</form></main></html>`, 200, { "Content-Type": "text/html; charset=utf-8" });
}

function configured(env) {
  return /^[\w-]{43,128}$/.test(env.JILL_SEO_OWNER_KEY ?? "") &&
    /^[\w-]{43}$/.test(env.JILL_SEO_TOKEN_KEY ?? "") &&
    /^[a-zA-Z0-9_-]+$/.test(env.ETSY_KEYSTRING ?? "") &&
    /^[a-zA-Z0-9_-]+$/.test(env.ETSY_SHARED_SECRET ?? "") &&
    /^[1-9][0-9]{0,15}$/.test(env.ETSY_SHOP_ID ?? "") &&
    /^[1-9][0-9]{0,15}$/.test(env.ETSY_OWNER_USER_ID ?? "") &&
    env.ETSY_CONNECTION;
}

async function authorized(request, secret) {
  const length = Number(request.headers.get("Content-Length"));
  if (!Number.isInteger(length) || length < 1 || length > 512 ||
      request.headers.get("Content-Type") !== "application/x-www-form-urlencoded") return false;
  const input = new URLSearchParams(await request.text()).get("key");
  if (!input || input.length !== secret.length) return false;
  const bytes = new TextEncoder();
  return crypto.subtle.timingSafeEqual(bytes.encode(input), bytes.encode(secret));
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.origin !== WORK_ORIGIN || env.JILL_SEO_ORIGIN !== WORK_ORIGIN) {
        return result({ error: "wrong_work_host" }, 421);
      }
      if (url.pathname === "/healthz" && request.method === "GET") {
        return result({ service: "JILL_SEO_ETSY_WORK",
          ready: env.JILL_SEO_ETSY_ENABLED === "true" && Boolean(configured(env)) });
      }
      const method = ROUTES.get(url.pathname);
      if (!method) return result({ error: "not_found" }, 404);
      if (method !== request.method) return result({ error: "method_not_allowed" }, 405, { Allow: method });
      if (env.JILL_SEO_ETSY_ENABLED !== "true" || !configured(env)) {
        return result({ error: "etsy_work_unavailable" }, 503);
      }
      if (url.pathname === "/") return setupPage();
      if (method === "POST" && (request.headers.get("Origin") !== WORK_ORIGIN ||
          !await authorized(request, env.JILL_SEO_OWNER_KEY))) {
        return result({ error: "owner_authorization_required" }, 403);
      }
      const connection = env.ETSY_CONNECTION.getByName("targeted-seo");
      // Only the callback needs the incoming query and browser binding.
      // Keep the owner key out of the object request.
      return await connection.fetch(url, {
        method,
        redirect: "manual",
        headers: method === "GET" ? { Cookie: request.headers.get("Cookie") ?? "" } : {},
      });
    } catch {
      return result({ error: "etsy_work_unavailable" }, 503);
    }
  },
};
