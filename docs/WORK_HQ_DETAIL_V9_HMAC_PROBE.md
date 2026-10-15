# WORK Google QA exact-detail v9 — verified deployment, private read-only HMAC probe

The owner independently ran **Google clasp `list-deployments`** after an ambiguous
Google detail creation response. Remote listing visibly included:
- Original QA merchant list/status `@7`, unchanged
- Previous HQ R/W `@8`, unchanged
- **`@9 JILL_HQ_WORK_EXACT_DETAIL_V1`**, newly created
- Editor HEAD, independently present

**Do not run `work:hq:qa:detail:stage` again.** The command's
`qa_detail_creation_unconfirmed_inspect_before_retry` was an ambiguous
confirmation, not evidence creation failed.

## Credential-safe WORK-only probe

Once merged, from the clean latest `jill/rewards-work`:

```powershell
npm.cmd run work:hq:qa:detail:reconcile
npm.cmd run work:hq:qa:detail:probe
```

The first only lists the remote QA deployments and verifies v7/v8 unchanged.
The second:
1. Validates isolated WORK QA script identity and exactly one new detail
   deployment at **version 9**; takes its deployment ID from the current
   verified Google listing (not a typed URL, screen transcription or CLI key).
2. Reads `JILL_HQ_MERCHANT_READ_SECRET` from the exact
   `[WORK.GOOGLE_CUSTOM_ORDERS_QA]` section of the user's pre-existing
   local Windows vault `%USERPROFILE%\JILL-PRIVATE\JILL-SECRETS.txt`.
   Refuses missing or duplicate entries, symlinks, invalid value and
   other sections. It never prints/sends the raw secret outside an
   authenticated HMAC signature, or passes it through CLI arguments.
3. Sends two signed POSTs to only the new Google WORK QA `@9` endpoint
   using a **random, deliberately nonexistent** submission ID:
   - An independently generated wrong key MUST get `unauthorized`.
   - The actual saved WORK QA read key MUST get `not_found`.
4. Rejects HTML/login pages, timeouts, over-4KiB acknowledgement and
   unexpected response operation/code; prints pass/fail codes only.
   The server may internally scan QA rows to find that the ID is absent,
   but no real customer record is returned to the probe.

**No actual status write, email, order intake, secret rotation, Google
deployment, or Cloudflare traffic change**. No LIVE/KEEP/Rewards access.

The new Google endpoint is still not selected by the WORK HQ private
full-detail route. The next reviewed step, only after the HMAC probe
passes, is to pin the exact v9 deployment URL *separately* for detail reads
in `work-google-merchant-detail.mjs`, preserving existing v7 list/status
source. Then stage an inactive WORK Worker with the currently OFF feature
flag and run Owner/D1 security and real Shopify render tests before any
traffic switch.

If the signed probe reports STOPPED, do **not** rotate keys or redeploy
Google. Investigate error code and protected deployment versions first.
