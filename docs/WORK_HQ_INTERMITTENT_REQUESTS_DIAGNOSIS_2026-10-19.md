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

It verifies the exact active WORK allocation before subscribing, then sends at
most five unsigned `/healthz` GETs with a fresh diagnostic nonce. The existing
canonical health certifier checks the exact runtime; the collector must also
receive a WORK health-marker event through the tail stream. Cloudflare may
redact its UUID value, so this verifies stream liveness rather than uniquely
identifying one request. The report distinguishes exact from redacted-marker
correlation and never claims unique attribution for a redacted marker. Wait for **READY**,
then reproduce Home → Requests → detail → back. When loading hangs, wait 20
seconds and refresh once. The 75-second window begins only after READY. Share
only this command's filtered JSON output. If the self-check fails, the runner
stops without asking for clicks and reports safe parse/filter counters.
No status/message/quote writes are needed. No deployment command should run.

The subscription is only for `jill-order-desk-canary-work`. It pipes raw output
privately in memory, retains only fixed route categories, opaque phase traces,
numeric durations/status, allowlisted outcome/error categories and validated
runtime UUID. Raw URLs, query strings, headers, customer/request identifiers,
unrelated logs and exception messages/stacks are never printed or saved.
Cloudflare permits null/missing `scriptName` in its tail envelope. Such events
are accepted only for the exact fixed WORK HTTP origin, within the CLI's explicit
WORK-only subscription. An explicitly foreign Worker name is still rejected.
A missing runtime UUID is still unverified; it is never inferred from the name.
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
IPC preload were exercised with `--version`. The full installed Wrangler CLI
also passed a loopback-only API/WebSocket test, delivering null-name phase
events through the actual JSON formatter/parser and deleting its simulated
subscription on graceful IPC stop. No provider credentials, app writes or live
tail were accessed by the executor.

## Owner capture at runner 8941382: no retained events

Owner returned `allocation_unchanged: true`, `tail_events_received: 0`, empty
records, graceful stop requested, forced stop false, and no reported tail command
failure. This proves neither that no traffic arrived nor that any backend phase
completed. The previous runner had no end-to-end subscription readiness proof.
Evidence: `evidence/work-hq-navigation-empty-capture-2026-10-19.json`.

Source review reproduced a definite collector defect: its exact Worker-name
filter silently dropped a valid documented `scriptName: null` HTTP event.
Official format reference:
https://developers.cloudflare.com/workers/observability/logs/real-time-logs/.
No raw Owner event was retained, so its actual envelope and the exact reason
for this zero-result run cannot be reconstructed. The collector defect can
explain the result but is not proven to have caused it. It does not establish
the application's Requests root cause.

The corrected parser, safe input counters and matched health-event handshake
are diagnostic-only changes. Tests cover null/missing/foreign names and origins,
unknown/mismatched runtime versions, wrong probe nonce, absent event, unhealthy
response, callback failure cleanup, private field exclusion, and actual CLI
subscription deletion through a local mock provider. No app runtime release is
needed. Owner credentials are still the only missing capability for observing
the real intermittent authenticated navigation. Incident and WORK acceptance
remain OPEN; all existing release/upload receipts remain spent.


## Successful Home control, failed strict nonce check — 2026-10-19

Owner runner `e4f25c794d4298aec7e55d6cc0932b85899f3609` parsed eight JSON
events, all with the expected Worker name; retained one Home event at exact
runtime `6473444f-86f8-4a83-a47a-56d1a2e19f05`. Owner reports no hang during
this attempt. Allocation stayed unchanged; the health probe reported exact runtime verification
after five attempts. No command failure or forced stop was reported.
The strict nonce check saw no matching event, so READY never appeared and
the full 75-second application capture did NOT begin. Evidence:
`evidence/work-hq-navigation-home-control-2026-10-19.json`.

The observed Home invocation returned HTTP 200/outcome ok/no reported exceptions.
Its inbox phase took 4,105 ms: Shopify-auth phase rounded to 0 ms, WORK Owner
phase 89 ms, Google-feed phase 4,016 ms. This is a server phase measurement for
a Home dashboard feed read, not browser navigation time, a Requests-route
measurement, or independent verification of returned canonical records. The
zero auth duration does not measure all authentication work in the parent
loaders. Google dominates this measured control; this does not prove the
cause of the prior indefinite hang or a timeout/secret/cache defect.

A second definite diagnostic defect was reproduced against the provider
contract: UUID-shaped URL values are redacted to `REDACTED`, so equality to
the original UUID is unsuitable as the only stream-readiness condition.
Official reference: https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/.
The seven filtered Owner events were not retained, so their exact URLs and
the cause of this particular failed check cannot be reconstructed.

The collector now recognizes either the exact nonce or the provider-redacted
marker, ONLY at the fixed WORK origin, `/healthz` path and known probe query
key, inside the explicit WORK subscription. The independent health response
must still certify the exact runtime; a mismatched event runtime still blocks
READY. A redacted marker certifies liveness and does not uniquely correlate
one request. There is no attempt to unredact provider data. The report makes
that limit explicit. Actual installed-CLI loopback coverage now models UUID
URL redaction as well as null names, privacy projection and graceful cleanup.
The loopback test lives under root `scripts/`, preserving the exact seven-file
application release guard without weakening its inventory checks.

No app runtime, allocation, auth/cache policy, Google source, canonical
record, secret, paid service or release receipt changed. A full authenticated
Requests/detail capture and any recurrent failure event remain needed; the
intermittent incident and full WORK operational acceptance remain OPEN.
