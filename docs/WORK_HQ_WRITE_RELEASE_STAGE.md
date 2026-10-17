# JILL HQ WORK — Inactive read/write candidate

**Do not use the historical `work:hq:ui:deploy` rollout.** It was
designed for read-only changes with three secrets. Our WORK write release
has exactly four dedicated secrets and one new opt-in flag, and needs
independent review.

## Already certified before staging
- GitHub WORK source and four checks pass.
- QA editor HEAD, original pinned WORK QA v7 and separate HQ R/W v8
  all match the certified GitHub WORK build.
- Local private WORK write key matches the Google QA endpoint by a
  signed **non-mutating** HMAC handshake. No CustomOrderEvents mutation.
- One key-only Cloudflare version
  `6b70350e-0a5f-4630-8888-fe8a356a0a54` is INACTIVE.
- Active WORK dashboard remains
  `e67a2209-f6d9-4671-b6fc-33994015af30`.

## Stage the reviewed Worker without switching traffic

Run on the owner's machine from a clean, synced `jill/rewards-work`:

```powershell
npm.cmd run work:hq:write-release:stage
```

This script verifies the exact active WORK Worker and older staged
key-only version, runs local WORK regressions and app build, and
generates a new manifest with OAuth ON, Owner bootstrap OFF,
`JILL_WORK_MERCHANT_WRITES_ENABLED=true` and the **same D1**.

It passes the dedicated key from the private WORK vault to Wrangler
as an ephemeral local `--secrets-file` and then deletes that file.
This guarantees the newly staged code version includes the correct
write secret even if a previous *inactive* key-only Worker version
would not be inherited during `versions upload`. Wrangler preserves
the other existing secrets; the script inspects every original
binding and refuses changed values/types or unrecognized extras.

The result is another **INACTIVE** version containing the new code,
the new secret, and the opt-in flag. The currently active WORK traffic
is checked before and after staging. No Shopify deployment, Google
Apps Script update, LIVE, KEEP, Rewards, payments or emails.

## Remaining release gate

A separate, reviewed, explicitly approved command is required
to switch WORK traffic to the resulting code+write-secret candidate.
Review the exact new version ID and full binding invariants before
authorizing. Test the anonymous command route, health, OAuth and
Owner commissioning disabled immediately after release. Then log
into Shopify WORK as the Owner and test one disposable QA request
status revision; check My JILL owner visibility and unrelated customer
denial. Never claim a customer email was SENT from a QUEUED outbox:
outbound provider integration/receipts remain separate work.

If staging stops after upload, **do not rerun** until the inactive
versions and active deployment have been inspected. Never share
your vault contents or Wrangler raw secret payloads.
