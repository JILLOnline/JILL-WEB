# HQ inbox readback correction — November 5, 2026

Source-only correction after authenticated WORK QA of tree
`ce1c57bd0dcb74dd37be184fd0d52f5721b87955`. That deployed candidate remains
unchanged by this work. No provider upload, activation or business operation.

## Submitted dates

The Requests card passes full `submitted_at` timestamps to the shared
`inbox-display.mjs` formatter without requesting a time. The old formatter
appended a noon suffix to an already complete timestamp, producing an invalid
date and `Not supplied`. Only date-only event strings now receive the suffix.
Complete ISO timestamps retain their instant and are formatted in UTC.
Date-only labels, full date/time labels and missing/invalid fallbacks remain.

## Optional customer names

Authenticated QA saw resolved names on some visits and `Name unavailable`
on a mobile visit. Source inspection and mounted reproduction establish one
specific cause of misleading presentation: off-screen rows intentionally
have no exact-ID read until IntersectionObserver admits them, yet their idle
state was labeled as unavailable. Queued rows had the same label. This does
not prove that every observed fallback was caused by viewport deferral or
exclude occasional upstream failures.

The existing row now distinguishes `Name not loaded` before its exact-ID read,
`Checking name…` during loading, and `Name unavailable` after a completed read
without a verified matching customer name. Successful names still come only
from the signed exact-ID route. No name cache, new endpoint, eager bulk read,
automatic retry or new authority is introduced. The existing disclosure and
Retry verified details action remain the explicit recovery path.

## Verification and boundaries

`test-work-hq-inbox-ui.mjs` covers full ISO/date-only dates, UTC offset/day/year
boundaries and invalid input. Its two obsolete current-UI assertions now
recognize the already approved Home request links and direct editor host;
historical release executors and certificates are untouched.

`test-work-hq-inbox-mounted.mjs` mounts the actual inbox with synthetic Router
fetchers and IntersectionObserver: no off-screen reads, two concurrent optional
reads, queued/loading/failure distinctions, matching-ID-only names, explicit
failure recovery, no automatic retries, no names retained across remount, and
rendered ISO submission dates. Existing bounded queue and exact-ID recovery
guards remain. The source workflows include the current inbox and mounted
regressions. All these tests are local; they do not certify real Shopify
authentication, upstream latency or deployed behavior.

The replacement candidate requires a separate provider upload/activation
approval after exact source, build and current provider state are reviewed.
Conversation, quote, private-media, Shopify publishing, LIVE/KEEP, migration,
financial and actual message/status/archive gates remain unchanged.
