# WORK Requests intermittent loading — diagnosis remains open

Owner clarification after runtime `6473444f-86f8-4a83-a47a-56d1a2e19f05`
activation: Requests initially works, then loading never finishes after repeated
clicks/navigation; waiting and refreshing can restore it. Other tabs and the
current theme are reported good. This is NOT authenticated incident acceptance.
Pause further visual changes while investigating this failure.

The previous independently reproduced shared SDK Response-body consumption was
repaired and its anonymous compiled/platform probes pass. That establishes a
specific prior repair, not the cause of this continuing intermittent hang.

## Investigation without changing the live app

Source baseline: clean `jill/rewards-work`,
`938a7f542a7fb5fb67397424774d5bedf845a1f8`. Requests data waits on Shopify online
authentication, WORK D1 Owner authority, then the canonical Google feed. Existing
`JILL_WORK_INBOX_PHASE` logs identify phase begin/end with opaque trace and numeric
duration only. Home's new aggregate summary also reads that same feed; the
20-second source cache coalesces concurrent reads. Google has a 15-second fetch
timeout. No source inspection alone proves which stage stalled for the Owner.

A local actual workerd test imported the unmodified canonical source-cache
module and used a delayed local HTTP upstream with synthetic empty records:

| Scenario | Observed result |
| --- | --- |
| Two concurrent HTTP requests | Both completed; miss/joined; one upstream call |
| Abort the first HTTP request while a second joins | First AbortError; second completed joined |
| Next HTTP request after cancellation | Completed hit; no extra upstream call |

The harness used installed Wrangler 4.151.2, compatibility date 2026-10-14 and
nodejs_compat. Upstream delay was one second and synthetic timeout 2.5 seconds.
This does not reproduce the reported hang, test a real signed-in session or
exclude Cloudflare production/client lifecycle differences. Do NOT remove the
cache or alter SDK renewal based on this unconfirmed hypothesis. No new app
runtime code, flags, secrets, bindings, data or deployment changed.

## Concrete next evidence: Owner-only read-only capture

Executor has no Cloudflare Owner credentials. Run the prepared command from the
clean, synced branch on the existing Owner machine:

```powershell
npm.cmd run work:hq:navigation:diagnose
```

It verifies the exact active WORK allocation before subscribing. After its
capture message, allow five seconds to connect, then reproduce Home → Requests
→ detail → back. When loading hangs, wait 20 seconds and refresh once. Let the
75-second window finish and share only this command's filtered JSON output.
No status/message/quote writes are needed. No deployment command should run.

The subscription is only for `jill-order-desk-canary-work`. It pipes raw output
privately in memory, retains only fixed route categories, opaque phase traces,
numeric durations/status, allowlisted outcome/error categories and validated
runtime UUID. Raw URLs, query strings, headers, customer/request identifiers,
unrelated logs and exception messages/stacks are never printed or saved.
The parser handles chunked/formatted JSON with bounded memory and at most 400
projected events. The runner stops via Wrangler's SIGINT cleanup handler over
IPC (Windows-compatible), with a bounded forced-child fallback, then independently
checks unchanged allocation. Forced stop is reported, not claimed as confirmed
subscription cleanup. No new logging storage or paid service is enabled.

Tail events may arrive only when a request completes or is cancelled. Waiting
then refreshing helps collect the unfinished request's phases. No events, missing
phase endings or missing runtime metadata are NOT proof of an absent canonical
record, a particular failed backend stage, or a verified runtime. The report
explicitly leaves root cause and operational acceptance false. Diagnostic capture
does not consume or reset upload/deployment receipts and may be repeated if the
incident was not captured; it is not a new release operation.

Interpret with browser evidence: if a failing navigation has no corresponding
server event, obtain only sanitized Network status/Timing (TTFB versus frontend
pending), never a raw HAR or headers. A completed server event alongside a
persisting browser spinner points to a different boundary from an unfinished
Shopify/Owner/Google phase. Do not close the incident from successful control
requests. Fix the evidenced boundary, reproduce the failure before/after, then
review any genuinely necessary NEW release separately.

## Current guard and acceptance

Expected deployment `1ffdde49-e556-43a6-b7bb-e10cd3a71048`, runtime
`6473444f-86f8-4a83-a47a-56d1a2e19f05` 100%; quote canary
`dbc6341f-de7f-41de-8e97-6bf971201eeb` 0%. Drift stops capture before subscription.
All prior release receipts stay spent; never rerun navigation repair, studio,
visual or gateway release/upload commands. Full WORK acceptance and separate
customer-facing LIVE release remain OPEN.

Verified locally: fragmented/oversized event handling, exclusion of synthetic
private tokens/customer IDs/headers/URLs/stack traces, exact/unknown version
attribution and baseline drift denial. Existing navigation runtime guard passes
with its seven reviewed files unchanged. The installed CLI direct entry and
IPC preload were exercised with `--version`; no provider credentials, app writes
or live tail were accessed by the executor.
