# JILL-WEB — environment and system map

Baseline verified 2026-10-12. This is a governance-only snapshot; not a deployment.

| Lane | Git source | Shopify target | Release artifact |
| --- | --- | --- | --- |
| Website | `jill/theme-core` (b7556fd9723f40e2abfde03f9643b190cabc2d90) | Website theme(s) | Theme package / pinned theme ID |
| Accounts | `jill/rewards-work` (4077f3812d8e29d74468352285ae56206b17a1eb) | JILL WORK Rewards app; customer-account extensions | App extension version |
| Custom Order WORK API | Work branch backend/service | Isolated Google QA Apps Script + existing Cloudflare Worker | Independently pinned backend deployments |
| LIVE | separately approved production commit | JILL production store only | Separate manual release |

GitHub `main` baseline: 14610aeb15bfde50dbf356ff2cc173b32da6ef76; it is **not** assumed to be the canonical deployable theme. Never promote `main` merely because of its branch name.

WORK Shopify store: `jill-work.myshopify.com`. Observed (read-only Shopify Admin inventory): published theme `test-data`, unpublished themes `Horizon` and `debut-vintage-theme`; pages `Contact` and `Your Privacy Choices`, **no Custom Order page**. The separate My JILL dev preview reads account timelines; a successful empty-state does not certify cross-customer access or owned submission.

Known WORK Cloudflare Worker: `jill-work-custom-orders-qa`; latest user-confirmed deployment version fd297209-977e-4f5e-a1a6-2b1ba62329cc. Google Custom Order QA deployment is separate from Rewards; user confirmed update from 4077f381 and passing jillCustomOrderQaPreflight. These are observations, not instructions to redeploy.

Release isolation is not guaranteed solely by Git branches. Artifact packaging, app configuration, Shopify store IDs, backend secrets, credential scope, runtime targets, and rollback must each be independently verified at release time.
