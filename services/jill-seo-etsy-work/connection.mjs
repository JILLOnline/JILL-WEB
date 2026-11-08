import { CALLBACK, reply, result } from "./http.mjs";

const API = "https://api.etsy.com";
const SCOPE = "listings_r";
const SESSION_SECONDS = 600;
const DAILY_WINDOW = 86_400_000;
const DAILY_BUDGET = 1_000;
const COOKIE = "__Host-jill-seo-etsy";
const COOKIE_OPTIONS = "Path=/; Secure; HttpOnly; SameSite=Lax";
const encode = new TextEncoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64url(value) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
}

const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

function responseError(error, status, headers) {
  return { response: result({ error }, status, headers) };
}

function retryAfter(until, now = Date.now()) {
  return { "Retry-After": String(Math.max(1, Math.ceil((until - now) / 1000))) };
}

function etsyCooldown(header, now) {
  if (/^\d{1,10}$/.test(header ?? "")) return now + Math.max(1, Number(header)) * 1000;
  const timestamp = Date.parse(header ?? "");
  return timestamp > now ? timestamp : now + 60_000;
}

// All Etsy calls for this app share one SQLite-backed object and one budget.
// Reserving before fetch also counts failed or interrupted attempts.
export class EtsyConnection {
  constructor(ctx, env, upstream = (url, init) => fetch(url, init)) {
    this.store = ctx.storage.kv;
    this.env = env;
    this.upstream = upstream;
    this.busy = false;
  }

  async fetch(request) {
    if (this.busy) return result({ error: "connection_busy" }, 409);
    this.busy = true;
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/etsy/oauth/start" && request.method === "POST") {
        return await this.start();
      }
      if (url.pathname === CALLBACK && request.method === "GET") {
        return await this.callback(request, url);
      }
      if (url.pathname === "/api/etsy/listings/sample" && request.method === "POST") {
        return await this.sample();
      }
      return result({ error: "not_found" }, 404);
    } catch (error) {
      return error?.response instanceof Response
        ? error.response
        : result({ error: "etsy_work_unavailable" }, 503);
    } finally {
      this.busy = false;
    }
  }

  async start() {
    const state = random();
    const verifier = random();
    const browser = random();
    const challenge = await crypto.subtle.digest("SHA-256", encode.encode(verifier));
    this.store.put("pending", { state, verifier, browser, expires: Date.now() + SESSION_SECONDS * 1000 });
    const consent = new URL("https://www.etsy.com/oauth/connect");
    consent.search = new URLSearchParams({
      response_type: "code",
      client_id: this.env.ETSY_KEYSTRING,
      redirect_uri: this.env.JILL_SEO_ORIGIN + CALLBACK,
      scope: SCOPE,
      state,
      code_challenge: base64url(new Uint8Array(challenge)),
      code_challenge_method: "S256",
    });
    return reply(null, 303, {
      Location: consent.toString(),
      "Set-Cookie": `${COOKIE}=${browser}; Max-Age=${SESSION_SECONDS}; ${COOKIE_OPTIONS}`,
    });
  }

  async callback(request, url) {
    const pending = this.store.get("pending");
    const browser = request.headers.get("Cookie")?.split(/;\s*/)
      .find(value => value.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
    if (!pending || pending.expires <= Date.now() || pending.browser !== browser ||
        url.searchParams.getAll("state").length !== 1 || pending.state !== url.searchParams.get("state")) {
      return result({ error: "invalid_or_expired_etsy_state" }, 400);
    }
    this.store.delete("pending");
    const clearCookie = { "Set-Cookie": `${COOKIE}=; Max-Age=0; ${COOKIE_OPTIONS}` };
    if (url.searchParams.has("error")) {
      return result({ error: "etsy_authorization_declined" }, 400, clearCookie);
    }
    const code = url.searchParams.get("code");
    if (!code || code.length > 2048 || url.searchParams.getAll("code").length !== 1) {
      return result({ error: "missing_or_invalid_etsy_code" }, 400, clearCookie);
    }
    await this.exchange({
      grant_type: "authorization_code", code,
      redirect_uri: this.env.JILL_SEO_ORIGIN + CALLBACK,
      code_verifier: pending.verifier,
    });
    return reply(null, 303, { ...clearCookie, Location: "/" });
  }

  async cipher() {
    return crypto.subtle.importKey("raw", fromBase64url(this.env.JILL_SEO_TOKEN_KEY),
      "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  context(iv) {
    const { JILL_SEO_ORIGIN, ETSY_KEYSTRING, ETSY_SHOP_NAME } = this.env;
    return { name: "AES-GCM", iv,
      additionalData: encode.encode(JSON.stringify([JILL_SEO_ORIGIN, ETSY_KEYSTRING, ETSY_SHOP_NAME])) };
  }

  async save(tokens) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt(this.context(iv), await this.cipher(),
      encode.encode(JSON.stringify(tokens)));
    this.store.put("tokens", { iv: base64url(iv), sealed: base64url(new Uint8Array(sealed)) });
  }

  async load() {
    const stored = this.store.get("tokens");
    if (!stored) throw responseError("etsy_connection_required", 409);
    const plain = await crypto.subtle.decrypt(this.context(fromBase64url(stored.iv)), await this.cipher(),
      fromBase64url(stored.sealed));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async exchange(fields, previous) {
    const body = await this.call("/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...fields, client_id: this.env.ETSY_KEYSTRING }),
    });
    const { access_token, refresh_token, token_type, expires_in, scope } = body;
    const tokenOwner = token => typeof token === "string" && token.length <= 2048
      ? /^([1-9]\d{0,15})\.[\w-]+$/.exec(token)?.[1] : undefined;
    const owner = tokenOwner(access_token);
    if (!owner || tokenOwner(refresh_token) !== owner || (previous && previous.owner !== owner) ||
        token_type !== "Bearer" ||
        !Number.isSafeInteger(expires_in) || expires_in < 1 || expires_in > 86400 ||
        (scope !== undefined && scope !== SCOPE)) {
      throw responseError("unexpected_etsy_token_or_owner", 502);
    }
    let shopId = previous?.shopId;
    if (!previous) {
      const shop = await this.call(`/v3/application/users/${owner}/shops`, {
        headers: { "x-api-key": this.apiKey() },
      });
      if (String(shop.user_id) !== owner || !/^[1-9]\d{0,15}$/.test(String(shop.shop_id)) ||
          typeof shop.shop_name !== "string" ||
          shop.shop_name.toLowerCase() !== this.env.ETSY_SHOP_NAME.toLowerCase()) {
        throw responseError("unexpected_etsy_shop_owner", 502);
      }
      shopId = String(shop.shop_id);
    }
    const tokens = { access_token, refresh_token, owner, shopId, expires: Date.now() + expires_in * 1000 };
    await this.save(tokens);
    return tokens;
  }

  apiKey() {
    return `${this.env.ETSY_KEYSTRING}:${this.env.ETSY_SHARED_SECRET}`;
  }

  async sample() {
    let tokens = await this.load();
    if (tokens.expires <= Date.now() + 30_000) {
      tokens = await this.exchange({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }, tokens);
    }
    const shop = tokens.shopId;
    const page = await this.call(`/v3/application/shops/${shop}/listings?state=active&limit=1`, {
      headers: {
        "x-api-key": this.apiKey(),
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    if (!Number.isSafeInteger(page.count) || page.count < 0 ||
        !Array.isArray(page.results) || page.results.length > 1) {
      throw responseError("invalid_etsy_listing_response", 502);
    }
    const listing = page.results[0];
    if (listing && (String(listing.shop_id) !== shop || listing.state !== "active" ||
        !Number.isSafeInteger(listing.listing_id) || typeof listing.title !== "string")) {
      throw responseError("unexpected_etsy_listing", 502);
    }
    return result({ shop_id: shop, count: page.count, listing: listing ? {
      listing_id: listing.listing_id, title: listing.title,
    } : null });
  }

  async call(path, init) {
    let now = Date.now();
    const blockedUntil = this.store.get("blockedUntil") ?? 0;
    if (blockedUntil > now) throw responseError("etsy_cooldown", 429, retryAfter(blockedUntil, now));
    const timestamps = (this.store.get("requests") ?? []).filter(time => time > now - DAILY_WINDOW);
    if (timestamps.length >= DAILY_BUDGET) {
      throw responseError("etsy_daily_budget_reached", 429, retryAfter(timestamps[0] + DAILY_WINDOW, now));
    }
    const delay = (timestamps.at(-1) ?? 0) + 1000 - now;
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    now = Date.now();
    this.store.put("requests", [...timestamps, now]);
    const response = await this.upstream(API + path, {
      ...init, redirect: "manual", signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429) {
      const until = etsyCooldown(response.headers.get("Retry-After"), Date.now());
      this.store.put("blockedUntil", until);
      throw responseError("etsy_cooldown", 429, retryAfter(until));
    }
    if (!response.ok) throw responseError("etsy_request_failed", 502);
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw responseError("invalid_etsy_response", 502);
    }
    return data;
  }
}
