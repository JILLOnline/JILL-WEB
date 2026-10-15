# WORK Custom Orders pending `requests.data` — v4 staging

**Browser evidence**: the `requests.data` fetch remains pending across a
>60-second Network waterfall while UI JS/CSS is loaded. Source investigation
identified **two independent Shopify SDK `authenticate.admin` calls per
React Router data request**, which PR #92 now deduplicates within the same
Cloudflare incoming HTTP context. PR #92 also emits safe
`JILL_WORK_INBOX_PHASE` begin/end timing logs for Shopify authentication,
Owner/D1 permission and Google QA reading; the completed response includes
`Server-Timing` and `x-jill-inbox-trace`. This is a proven duplicate
authentication and a diagnostic improvement, not a promise of sub-second
navigation without actual runtime measurements.

Cloudflare confirmed v3 WORK at
`545795da-c7f4-40cf-baab-19ab8f04df69`; preserve as ACTIVE baseline.

The existing guarded `npm.cmd run work:hq:navigation:stage` is now pinned
to that exact active v3 version and stages only a **new inactive v4**
candidate with the marker
`JILL HQ WORK shared request auth + phase tracing v4; inactive`.

It verifies all **four unchanged WORK secrets**, WORK D1, OAuth ON,
Owner commissioning OFF, merchant writes ON, same Worker routing, and
distinct compiled code, plus request-scoped authentication unit tests.
No secret is printed, no LIVE/KEEP/Rewards changes, no remote D1 migration,
no Google Apps Script deployment and **no traffic switch**.

The old v3 `work:hq:navigation:inspect` and `...:activate` commands were
retired before this stage; they must only be restored after the exact
new inactive v4 candidate is known and a separate guarded release PR
passes CI. Do not reactivate the old `f777` candidate.

## Inspection after approved activation, not before

Use Chrome Developer Tools Network **without sharing secrets**:
- Open Custom Orders once, look at `requests.data` → **Timing**.
  Record Waiting / TTFB and whether request remains pending.
- If it completes, record only status code, content-type,
  `Server-Timing`, `x-jill-feed-cache` and `x-jill-inbox-trace`.
- If it never completes, sanitized Cloudflare logs containing only
  `JILL_WORK_INBOX_PHASE` reveal the last phase started. Do not
  share raw request URLs, shop JWTs, authorization headers or cookies.
- If the phase is Shopify authentication, investigate SDK session
  storage/token exchange. If Google QA, consider the independently
  tested shared WORK-only D1 index only after its isolated migration
  and freshness commissioning. Do not replace evidence with spinners.

The status-save workflow remains governed by verified canonical Google
QA CAS and the existing WORK Owner/secret checks.
