# JILL SEO Etsy connection for WORK

This standalone Worker owns the connection between JILL SEO and the Etsy Seller App
`targeted-seo`. Its first operation is a manual read of one active listing from the
configured shop. The Worker requests only the `listings_r` OAuth scope.

The service defaults to disabled. It accepts requests only on its designated WORK
origin. Once enabled, its home page lets the owner connect Etsy and run the listing
check with a separate WORK access key. The callback verifies a browser cookie,
single-use state, and PKCE. It checks the Etsy owner and shop before storing
encrypted access and refresh tokens in the service's own Durable Object.

Every Etsy request from this service shares a rolling budget of 1,000 attempts per
24 hours and a minimum one-second gap. An Etsy 429 pauses requests for its
`Retry-After` interval. The service has no scheduled jobs.

## Local checks

Run `node services/jill-seo-etsy-work/test.mjs <path-to-package.json>` from the repo
root. Pass the path to the package whose installed Wrangler provides Miniflare.
The test uses a local Worker and SQLite Durable Object with synthetic credentials
and a mock Etsy API.

Use Wrangler's `deploy --dry-run` with this directory's `wrangler.toml` to validate
the build. Put the output in this service's ignored `.wrangler-dist` directory.

## First WORK setup

The candidate callback is
`https://jill-seo-etsy-work.jill-work-custom-orders.workers.dev/api/etsy/oauth/callback`.
Verify the hostname and handler after provisioning the dedicated Worker before
saving the callback in Etsy. A configured, enabled callback with no OAuth state
should return `400 invalid_or_expired_etsy_state`.

Configure these values in the dedicated Worker. Use Cloudflare secrets for
credential values. Generate the two WORK keys independently from 32 random bytes,
encoded as unpadded base64url. Keep the token encryption key stable across releases.

| Binding | Value |
| --- | --- |
| `ETSY_KEYSTRING` | Keystring for `targeted-seo` |
| `ETSY_SHARED_SECRET` | Shared secret for that same Etsy app |
| `ETSY_SHOP_ID` | Numeric Etsy shop ID |
| `ETSY_OWNER_USER_ID` | Numeric Etsy user ID that owns the configured shop |
| `JILL_SEO_OWNER_KEY` | WORK access key for the setup form |
| `JILL_SEO_TOKEN_KEY` | Separate key used to encrypt stored Etsy tokens |
| `JILL_SEO_ETSY_ENABLED` | Set to `true` when the isolated WORK release is ready to verify |

After the callback probe, save the exact URL in Etsy. Open the WORK home page,
connect as the configured Etsy owner, and select **Check one active listing**.
A successful response shows the shop ID, active listing count, and one listing
ID and title when available. Use the result as the acceptance check before
connecting any SEO jobs. Set `JILL_SEO_ETSY_ENABLED` to `false` to stop all access
and Etsy requests while preserving the encrypted connection.
