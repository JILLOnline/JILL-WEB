# JILL HQ WORK — Archive + detailed search release v1

**Status: GITHUB SOURCE PREPARED; Cloudflare release NOT yet attempted.**

## Approved behavior

- Active, Archive and All requests tabs render from the canonical signed, max-50-row WORK Google QA request list. Completed and cancelled requests automatically appear in Archive; their original records are **not duplicated or modified**.
- Owner-only detailed search POST checks a maximum of 6 exact-ID verified original records per explicit page, with at most 2 parallel Google calls. It returns matching IDs only; no names, personal details or search query are persisted in D1 or sent through a GET URL.
- Manual Remove/Restore remains DISABLED. Its D1 SQL is a proposal only and is deliberately excluded from all 20 runtime files. No remote schema migration, new binding, new Archive feature flag, Google mutation, Shopify order action or billing tier is approved.
- The 13-file reviewed card and workspace presentation overlay is included, preserving the customer name, colored borders, scrolling behavior, QR/quote display and existing merchant authorization. All other business code comes from immutable prior verified runtime source `576d6b0bcde43c43fda939f42513eefcb5adefb7`.

## Exact Owner read-only baseline — 2026-10-20T14:13:41.617Z

Owner PowerShell preflight passed all Archive/Search tests, React Router typecheck/build and read-only Cloudflare inventory. The currently observed HQ WORK allocation:

- deployment: `d3df60a1-b715-48e7-a557-cb5af1fda868`
- 100% version: `66738e55-4890-4be1-868d-cc9dde19798d`
- version annotation: `JILL HQ WORK connected catalog/access v1 INACTIVE source 782d866944ca9cdef0220fba254f6cd0a30e865a`
- 0% quote canary: `dbc6341f-de7f-41de-8e97-6bf971201eeb`
- 14 HQ bindings, existing merchant writes/OAuth/catalog/detail enabled, quote drafts/conversation/bootstrap disabled, WORK health HTTP 200
- No billable services enabled by this source; resource usage remains unverified.

This was evidence at one moment, not permission to assume the current allocation is unchanged. Every release attempt must verify current Cloudflare deployment, source annotation, exact bindings, health and 0% quote canary again. Any drift: HOLD, no upload.

## Frozen release and one-use receipts

Source guard: `scripts/work-hq-archive-search-package.mjs` pins 21 reviewed files including the inert SQL proposal. Isolated runtime composer `scripts/work-hq-archive-search-build.mjs` copies **only 20 approved TS/TSX/CSS/MJS files** to a temporary clone of the historical runtime; the proposal `.sql` file is excluded and absent from the generated runtime. New backend routes are included; old visual-only overlay compilers are not used.

The canonical release driver `scripts/release-work-hq-visual-theme-owner.mjs` performs Owner Windows clean-branch and origin synchronization, preflight Cloudflare pinned readback, source/receipt checks, isolated typecheck/build/compiled navigation tests, generated Wrangler binding/flag comparison, inactive upload and only afterward a 100%-WORK activation while retaining the quote canary at 0%. It records one-use attempt receipts **before** cloud mutations; ambiguous outcomes MUST NOT be retried.

Fresh profile `scripts/release-work-hq-archive-search-owner.mjs` uses receipt stem `work-hq-archive-search-v1`, operation IDs `HQ_ARCHIVE_SEARCH_V1_*`. None of the older one-use receipt files are changed, replaced or reusable.

Commands:
- `npm.cmd run work:hq:archive-search:runtime:check` — offline exact source
- `npm.cmd run test:work-hq-archive-search-release` — offline allocation/receipts
- `npm.cmd run work:hq:archive-search:inspect` — Owner read-only Cloudflare state
- `npm.cmd run work:hq:archive-search:release-once` — **ONE TIME**, guarded inactive upload and WORK-only activation. Never retry after a STOP/HOLD.
- `npm.cmd run work:hq:archive-search:restore-once` — one-time restore only if this attempt's own activation receipt and exact deployment ownership are verified.

**Do not run old** `work:hq:workspace-layout:release-once`, `work:hq:quick-pill:release-once`, `work:hq:inbox-polish:release-once` or any other retired deployment path. Do not run remote D1 migrations or enable `JILL_WORK_HQ_ARCHIVE_ENABLED`; a separate future Owner review is required.

## Acceptance before calling this done

Open WORK Shopify Admin HQ as authorized Owner. Verify Active/Archive/All views, completed/cancelled visibility without source deletion, name/border colors, expanded-card scrolling, and deep exact search with bounded pagination, origin and access-denial handling. Attempt no real Remove/Restore (must be gated) and no customer/Shopify commerce mutations. Verify WORK health/allocation again after activation. App code build/HTTP 200 alone is not visual or user-authorized operational acceptance.
