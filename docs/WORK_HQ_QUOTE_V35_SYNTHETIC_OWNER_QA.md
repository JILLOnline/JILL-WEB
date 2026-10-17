# JILL HQ WORK — authorized one-request synthetic Save Draft + Reload QA

## Scope

Owner explicitly approved creation of **one new synthetic WORK Custom
Order** and a signed-in Shopify WORK Owner Save Draft → leave → Reload
test against existing inactive v35 using **version override only**.
The already verified deployment has v34 100%, v35 0%; no deploy, upload,
new provider, paid tier, LIVE/KEEP, R2, email, invoice, payment, or
modification to the two historical customer requests is authorized.

**This runbook does not create a request, log into Shopify or perform
a quote save by itself.** These require Owner action within the
existing WORK storefront/merchant account.

## Mandatory read-only preflight

Run once on the Owner's PC, using the existing Cloudflare and clasp
logins. The preflight reads exactly the known WORK metadata:

```powershell
cd C:\Users\itzen\JILL-WEB
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked files changed' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git pull failed' }
npm.cmd run work:hq:quote:v35:synthetic:preflight
if ($LASTEXITCODE -ne 0) { throw 'STOP: Preflight failed, create NO synthetic order' }
```

The preflight verifies v34 100% + v35 0% allocation, exact inactive
v35 metadata/secret names and v33 rollback, the published isolated
Google Custom Orders QA source against Git (including sandbox flag
and a different spreadsheet from LIVE), and anonymous version-
overridden Owner access refusal on v35. It never prints secrets
or reads customer request rows. **If any check fails, stop.**

## One synthetic request — existing WORK form only

1. Go to **jill-work.myshopify.com**, not `jillonlinestore.com`.
   Use the already verified WORK Custom Order form. If the WORK
   app proxy/form is unavailable or the store password is unknown,
   STOP; do not submit directly to a guessed Apps Script endpoint.
2. Use a clearly fake QA identity such as
   `JILL WORK QUOTE QA — NOT A CUSTOMER`. Prefer
   `jill-quote-qa@example.invalid` only if the form accepts it;
   otherwise use an Owner-controlled test mailbox. Do NOT enter
   another person's contact details or use real customer info.
3. Choose exactly **one sample catalog item**, quantity 1,
   pickup, a future test-needed date and QA-only theme/notes.
   No files, artwork or real personalized names. Decline marketing.
4. Submit **once**. Require the WORK form's verified receipt
   (`operation=custom_order.submit.result`, `verified=true`,
   request ID and Received status). A submission spinner or
   generic success toast alone is NOT authoritative. If ambiguous,
   do not resubmit; stop for read-only reconciliation.
5. Privately record the exact generated request ID and receipt.
   Verify that this exact ID appears once in the signed-in
   **WORK JILL HQ** inbox with the single QA item and appropriate
   status. This is the dedicated test record. A similar display
   name/email does NOT prove request identity.

Google's isolated Custom Orders QA sandbox returns after source
receipt/event persistence **before Shopify synchronization and both
customer/merchant email notifications**. The WORK QA build
excludes mail OAuth scopes. The published build must be checked by
the preflight first; never assume LIVE has the sandbox behavior.

## Open signed-in JILL HQ with v35 pinned for one tab

1. In Chrome visit `chrome://extensions`, enable Developer mode,
   click **Load unpacked**, and choose:
   `C:\Users\itzen\JILL-WEB\tools\work-quote-v35-browser-pin`.
   This is local source only. Do not install look-alike extensions
   or give any tool your Shopify cookie or access token.
2. In the real WORK Shopify Admin open JILL HQ and its WORK
   Custom Orders screen. Be signed in as the verified WORK Owner.
3. Click the extension's toolbar icon **in the WORK Admin tab**
   and select **Enable 15-minute QA**. The rule adds the Cloudflare
   version override header **only** to requests in that tab
   reaching the exact WORK Worker hostname. It does not modify
   Google, Shopify, LIVE or KEEP requests.
4. Refresh the JILL HQ page **in that same tab**. Make sure
   it still shows WORK management and the verified Owner inbox.
   Open only the exact disposable test request. Avoid customer
   requests. Reenable only if the 15-minute session expires.
5. If the browser helper cannot enable, the app redirects outside
   the verified WORK authentication boundary, the request cannot
   be located or the quote controls remain disabled, STOP.
   Do not use DevTools to forge session cookies, bypass Owner
   checks or execute arbitrary POSTs.

## Authorized Save → leave → Reload acceptance

On the verified synthetic request only:

1. Enter a unit price of **$4.00** for the single item,
   **$1.00** materials, zero labor/shipping/tax/discount/other.
   Expected worksheet estimate: **$5.00**.
2. Click **Save Draft once**. Look for confirmed
   `draft_saved` / 'Draft revision 1 was acknowledged'.
   The worksheet's top badge may still use legacy
   `NOT SAVED` copy immediately after acknowledgement;
   **server acknowledgement AND independent reload** are
   required, not the cosmetic badge alone.
3. Navigate back to WORK Custom Orders, reopen **the same**
   test request using the same v35-pinned tab. Confirm an
   automatic verified draft restore: exactly $4.00 per item,
   $1.00 materials, $5.00 total, revision 1. Click
   **Reload saved draft** once for independent verification.
4. Optional within this approval for the **same synthetic ID**:
   change unit price to $6.00, save once and independently
   reload. Revision should advance to **2** and total to $7.00.
   Stop if status is cancelled/completed or source revision
   changed. Never manufacture a new request just to retry.
5. On any `403`, `409`, `503`, `commit_unconfirmed`, no verified
   saved revision or wrong ID: STOP. Do not automatically retry
   a Save, change the operation ID, or report success from a
   browser toast. Reconcile with read-only WORK D1 and source
   checks without exposing raw customer/session data.
6. Disable the browser extension from its popup, then remove
   the unpacked extension when finished. The rule also expires
   after 15 minutes or upon tab close/browser restart.

## Owner result to report to ChatGPT (no private data)

Use only the following sanitized fields:

```text
Preflight: PASS / STOP
Synthetic WORK receipt: verified / not verified
WORK JILL HQ Owner view: available / unavailable
v35 pinned session: enabled / unavailable
Save revision 1: confirmed / unconfirmed
Reopened draft revision 1 and $5.00: yes / no
Optional revision 2 and $7.00: yes / no / not tried
Browser pin: disabled
Any STOP code: [known short code only]
```

No customer names, full request IDs, signed querystrings,
cookies, D1 SQL rows, Google Sheet exports or private keys.

## Evidence boundary

Successful WORK QA proves only owner-scoped Draft Save/Reload on
one synthetic record. It does NOT approve ordinary v35 traffic,
new customer quote/approval delivery, Shopify Draft Orders,
billing or LIVE/KEEP changes. A release decision requires
new authorization and independent safeguards.

Cloudflare version overrides:
https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/

Chrome session-scoped header rules:
https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
