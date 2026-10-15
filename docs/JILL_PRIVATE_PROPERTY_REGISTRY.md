# JILL property registry — names, ownership, and boundaries

This file contains **property NAMES only**, never values. The property
screenshots include entries that **may belong to LIVE**. Their environment
is UNKNOWN until the originating Google Apps Script project, store, or
Cloudflare Worker is independently identified. Do not copy an unknown
value to WORK, KEEP, or LIVE based on matching name alone.

## Verified WORK bindings (different services, distinct secret stores)

| Exact name | Verified system | Treatment |
| --- | --- | --- |
| JILL_HQ_MERCHANT_READ_SECRET | Google **WORK Custom Orders QA** Script Property, and separately Cloudflare **WORK JILL HQ** secret | Secret. Already signed-tested against WORK QA using an existing 32-character value; inactive Cloudflare version staged. The two sides must match. Never rotate incidentally. |
| SHOPIFY_API_SECRET | Cloudflare **WORK Order Desk Worker** secret | Secret. Do not auto-alias or overwrite with SHOPIFY_CLIENT_SECRET. |
| JILL_WORK_SESSION_KEY_B64 | Cloudflare **WORK Order Desk Worker** secret | Secret. Session encryption key; never regenerate as part of a list update. |

The exact Worker is \`jill-order-desk-canary-work\`; the exact Shopify WORK
shop is \`jill-work.myshopify.com\`. These bindings are verified independently
of which Apps Script project supplied a screenshot.

## Google Apps Script property names seen in screenshots — origin UNKNOWN

Do not assume these were all copied from the same project. They can be
present in LIVE or WORK; verify the actual project identifier and associated
store *before* classifying, copying or using any values.

| Exact name | Kind | Caution |
| --- | --- | --- |
| JILL_CUSTOM_ORDER_GATEWAY_SECRET | Secret | Distinct from HQ merchant-read HMAC. Could be LIVE or isolated QA; verify project. |
| SHOPIFY_ACCESS_TOKEN | Secret | Sensitive Shopify token; never copy LIVE token into WORK. |
| SHOPIFY_CLIENT_SECRET | Secret | OAuth app client secret in Apps Script; not automatically equivalent to Cloudflare SHOPIFY_API_SECRET. |
| JILL_CUSTOM_ORDER_ADMINS | Authorization setting | Access-control list; not a token. Preserve environment-specific staff identity. |
| SHOPIFY_CLIENT_ID | Identifier | May identify a LIVE or WORK app. Do not overwrite automatically. |
| SHOPIFY_REDIRECT_URI | Configuration | Environment-specific redirect URL. |
| SHOPIFY_SHOP | Configuration | Environment-specific permanent Shopify domain. |
| SHOPIFY_STORE | Configuration | Environment-specific store reference. |
| JILL_SHEET_ID | Configuration | Environment-specific spreadsheet ID; protect access but not an API key. |
| JILL_PUBLIC_PROMOTIONS_INFRA_CHECK_AT | Runtime timestamp | Not a credential; do not treat as a secret to restore. |
| JILL_REWARDS_INFRA_CHECK_AT | Runtime timestamp | Not a credential; do not treat as a secret to restore. |
| JILL_REWARDS_LAST_SWEEP | Runtime state | Not a credential; do not copy across environments. |

The visible screenshot was of PROPERTY **NAMES**, not values; the names do
not prove a given project has the correct secret configured, nor identify its
environment. Google Apps Script \`PropertiesService\` is scoped to each script.

## Names from an earlier speculative local template — NOT verified mappings

\`SHOPIFY_WORK_API_SECRET\`, \`SHOPIFY_KEEP_API_SECRET\`,
\`SHOPIFY_LIVE_API_SECRET\`, \`CLOUDFLARE_WORK_API_TOKEN\`, and
\`GOOGLE_WORK_APPS_SCRIPT_KEY\` were illustrative local storage labels,
**not** verified Apps Script property names or Cloudflare binding names.
Do not rename deployed properties, auto-alias these fields to actual secrets,
or migrate any existing value without explicit environment validation.

## Local storage contract

Run \`npm run jill:private:initialize\` **only on the user's own computer**
to create/update \`%USERPROFILE%\\JILL-PRIVATE\\JILL-SECRETS.txt\` in an
append-only, value-preserving way. This is a plaintext local file, NOT a cloud
vault. User must manually assign screenshot-derived properties to the correct
environment; unknown-origin fields remain quarantined.

No runtime, CI, Shopify, Cloudflare or Google code should automatically read
this file. A future local command may obtain a specific secret only through
an explicit user-triggered, environment-scoped operation; never print it.
Do not put this file inside the Git repository, OneDrive or a shared folder.
If the device is accessible to others, prefer Windows device encryption /
BitLocker and restrictive NTFS permissions.

## Current staged WORK state

The signed WORK QA Google read returned 2 canonical requests and rejected an
invalid HMAC. Cloudflare's \`wrangler versions secret put\` reported successful
**inactive** staging using that same existing key. The known active Worker
was version \`49b10c46-8e00-4ef3-8075-74eea29e9c9e\` at last verification.
**Do not promote any candidate until its ID and bindings are independently
inspected.** No LIVE changes are authorized.
