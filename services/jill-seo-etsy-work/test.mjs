import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CALLBACK } from "./http.mjs";
import { EtsyConnection } from "./connection.mjs";

// Resolve Miniflare through the installed Wrangler package used for validation.
const require = createRequire(resolve(process.argv[2]));
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const origin = "https://jill-seo-etsy-work.jill-work-custom-orders.workers.dev";
const bindings = {
  JILL_SEO_ORIGIN: origin,
  JILL_SEO_ETSY_ENABLED: "true",
  JILL_SEO_OWNER_KEY: randomBytes(32).toString("base64url"),
  JILL_SEO_TOKEN_KEY: randomBytes(32).toString("base64url"),
  ETSY_KEYSTRING: "test_key",
  ETSY_SHARED_SECRET: "test_secret",
  ETSY_SHOP_NAME: "JillOnlineStore",
};
const calls = [];
let challenge;
let throttle = false;
const options = {
  modules: ["worker.mjs", "connection.mjs", "http.mjs"].map(name => {
    const path = fileURLToPath(new URL(name, import.meta.url));
    return { type: "ESModule", path, contents: readFileSync(path, "utf8") };
  }),
  modulesRoot: fileURLToPath(new URL(".", import.meta.url)),
  compatibilityDate: "2026-11-08",
  bindings,
  durableObjects: { ETSY_CONNECTION: { className: "EtsyConnection", useSQLite: true } },
  outboundService: async request => {
    const url = new URL(request.url);
    assert.equal(url.origin, "https://api.etsy.com");
    calls.push(url.pathname);
    if (url.pathname === "/v3/public/oauth/token") {
      const form = new URLSearchParams(await request.text());
      assert.equal(form.get("client_id"), "test_key");
      if (form.get("grant_type") === "authorization_code") {
        assert.equal(form.get("redirect_uri"), origin + CALLBACK);
        assert.equal(form.get("code"), "mock-code");
        assert.equal(createHash("sha256").update(form.get("code_verifier")).digest("base64url"), challenge);
      } else {
        assert.equal(form.get("grant_type"), "refresh_token");
        assert.equal(form.get("refresh_token"), "20.refresh");
      }
      return Response.json({ token_type: "Bearer", access_token: "20.access",
        refresh_token: "20.refresh", expires_in: form.has("code") ? 1 : 3600, scope: "listings_r" });
    }
    assert.equal(request.headers.get("x-api-key"), "test_key:test_secret");
    if (url.pathname === "/v3/application/users/20/shops") {
      return Response.json({ shop_id: 10, user_id: 20, shop_name: "JillOnlineStore" });
    }
    assert.equal(url.pathname, "/v3/application/shops/10/listings");
    assert.equal(url.search, "?state=active&limit=1");
    assert.equal(request.headers.get("Authorization"), "Bearer 20.access");
    if (throttle) return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
    return Response.json({ count: 7, results: [{ shop_id: 10, listing_id: 30, title: "Example", state: "active" }] });
  },
};
const runtimeOptions = options => convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options;
const runtime = new Miniflare(runtimeOptions(options));

const get = (path, headers = {}) => runtime.dispatchFetch(origin + path, { headers, redirect: "manual" });
const post = (path, key, source = origin) => {
  const body = new URLSearchParams({ key }).toString();
  return runtime.dispatchFetch(origin + path, {
    method: "POST",
    headers: { Origin: source, "Content-Type": "application/x-www-form-urlencoded" },
    body, redirect: "manual",
  });
};
const start = "/api/etsy/oauth/start";
const sample = "/api/etsy/listings/sample";
try {
  assert.equal((await runtime.dispatchFetch("https://wrong.example/healthz")).status, 421);
  assert.equal((await get(CALLBACK)).status, 400);
  assert.equal((await post(start, "x".repeat(43))).status, 403);
  assert.equal((await post(start, bindings.JILL_SEO_OWNER_KEY, "https://wrong.example")).status, 403);
  assert.equal((await post(sample, bindings.JILL_SEO_OWNER_KEY)).status, 409);
  assert.equal(calls.length, 0);

  const consent = await post(start, bindings.JILL_SEO_OWNER_KEY);
  assert.equal(consent.status, 303);
  const location = new URL(consent.headers.get("Location"));
  assert.equal(location.origin + location.pathname, "https://www.etsy.com/oauth/connect");
  assert.equal(location.searchParams.get("scope"), "listings_r");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  challenge = location.searchParams.get("code_challenge");
  const cookie = consent.headers.get("Set-Cookie");
  assert.match(cookie, /; Secure; HttpOnly; SameSite=Lax/);
  const browser = { Cookie: cookie.split(";")[0] };
  const callback = CALLBACK + "?code=mock-code&state=" + location.searchParams.get("state");
  assert.equal((await get(callback)).status, 400);
  assert.equal((await get(CALLBACK + "?code=mock-code&state=wrong", browser)).status, 400);
  assert.equal(calls.length, 0);
  const completed = await get(callback, browser);
  assert.equal(completed.status, 303, JSON.stringify({ calls, body: await completed.text() }));
  assert.equal(completed.headers.get("Location"), "/");
  assert.match(completed.headers.get("Set-Cookie"), /Max-Age=0/);
  assert.equal((await get(callback, browser)).status, 400);
  assert.equal(calls.length, 2);

  const listing = await post(sample, bindings.JILL_SEO_OWNER_KEY);
  assert.equal(listing.status, 200);
  assert.deepEqual(await listing.json(), { shop_id: "10", count: 7, listing: { listing_id: 30, title: "Example" } });
  assert.equal(calls.length, 4); // Expired token was refreshed first.
  throttle = true;
  const limited = await post(sample, bindings.JILL_SEO_OWNER_KEY);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) >= 59);
  assert.equal((await post(sample, bindings.JILL_SEO_OWNER_KEY)).status, 429);
  assert.equal(calls.length, 5);

  const storage = new Map();
  const wrongShop = new EtsyConnection({ storage: { kv: {
    get: key => storage.get(key), put: (key, value) => storage.set(key, value),
  } } }, bindings,
    async url => url.endsWith("/token")
      ? Response.json({ token_type: "Bearer", access_token: "20.access",
        refresh_token: "20.refresh", expires_in: 3600 })
      : Response.json({ shop_id: 10, user_id: 20, shop_name: "AnotherShop" }));
  await assert.rejects(wrongShop.exchange({ grant_type: "authorization_code" }),
    error => error.response?.status === 502);
  assert.equal(storage.has("tokens"), false);

  await runtime.setOptions(runtimeOptions({ ...options, bindings: { ...bindings, JILL_SEO_ETSY_ENABLED: "false" } }));
  assert.equal((await get(CALLBACK)).status, 503);
  assert.equal((await get("/healthz")).status, 200);
} finally {
  await runtime.dispose();
}

const now = Date.now();
const stored = new Map([["requests", Array.from({ length: 1000 }, (_, i) => now - 1000 * (1000 - i))]]);
const connection = new EtsyConnection({ storage: { kv: stored } }, bindings,
  () => assert.fail("exhausted budget must prevent fetch"));
await assert.rejects(connection.call("/test"), error => error.response?.status === 429);
console.log("JILL SEO WORK OAuth, Etsy listing read, and quota tests passed.");
