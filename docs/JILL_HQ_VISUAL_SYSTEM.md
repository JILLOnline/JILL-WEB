# JILL HQ shared visual theme

Presentation only. This is the common template for existing and future HQ
tabs; canonical requests, authorizations, quotes, wallet and Shopify truth
remain with their existing owners.

## Foundation and page template

`app/styles/hq-theme.css`, imported once in the authenticated `app.tsx`, owns
shared palette, font, density, neutral buttons, navigation states, focus,
control heights and responsive catalog/scope grids. Existing screen CSS files
own their compositions and consume these variables. There is no override
stylesheet, zoom/scaling, shadow-DOM modification, external font download or
new UI dependency in the deployed application.

All six existing pages use the documented `s-page inlineSize="large"` property.
It exposes available width inside native Shopify Admin chrome. The outer
workspace has a generous 1680px reading cap for very large monitors. Home
uses four cards above 1120px, two at intermediate widths and one on phones.
Inbox and catalog use adaptive grids; the wide request summary uses its main
record plus two side panels, and original item cards share the row.

```tsx
// The authenticated parent supplies .jill-workspace and shared CSS.
<s-page inlineSize="large" heading="JILL HQ — Page name">
  <s-section>
    <main className="jill-inbox">
      <Link className="jill-inbox__back" to="/app">← HQ overview</Link>
      <header className="jill-inbox__intro"><h2>Task heading</h2></header>
      {/* Render only the existing authenticated loader's verified model. */}
      <section className="jill-request__panel">Page content</section>
    </main>
  </s-section>
</s-page>
```

| Shared choice | Value / behavior |
| --- | --- |
| Ink / muted | `#29232c` / `#68616b` |
| Accent / plum | `#765040` / `#4a2841` |
| Surface / soft | white / `#faf7f8` |
| Panel / control borders | `#e7dfe4` / `#918697` |
| Spacing | 4, 8, 12, 16px; composition-specific larger space only when useful |
| Panel radius | 12px; hero 16px |
| Native controls | 36px desktop, minimum 44px on coarse pointers and phone widths |
| Body | System font stack; compact 13px foundation, 14px on phones |
| Focus | Visible 3px blue outline with 3px offset |
| Motion | No new animation; existing reduced-motion rules retained |

Keep labels, help, errors, loading/disabled states, source freshness, notices,
Save/Reload status and all permitted actions visible. Do not make an interface
look enabled by changing a policy, scope or release flag. Native Shopify
customers/orders pages keep their own Shopify design.

## Verified scope and local review

`work:hq:visuals:check` compares runtime files to the active bundle's source
`69b709d9c2c6d0a4c075bef073381ec698b39373`. Only listed route presentation/CSS
may differ. AST comparison preserves server declarations, imports, default
component hooks, behavior attributes, controls and customer/policy copy.
This guard is scoped to this one-use visual release; CI tests its contract
without prohibiting future authorized functional work. Negative tests reject
changes to auth output, state initialization, event
handlers, control removal and wording. Backend, theme and extensions cannot
change in this release.

Real Chromium rendered the actual six route components with Shopify's
published Polaris web components and explicitly synthetic local loaders at
1600, 1024, 390 and 320 CSS pixels: 24 cases with no horizontal overflow.
Phone native input/button/select heights are at least 44px. Inbox filtering,
opening the existing status form and the existing quote calculation (12×$5 +
2×$10 = $80) passed without submitting any command. Local screenshot review
covered wide Home/Request and phone Catalog. Source handlers/hooks are
unchanged. These fixtures are not authenticated Shopify acceptance or
performance measurements. Public summary:
`evidence/work-hq-visual-local-review-2026-10-19.json`.

Official page API: https://shopify.dev/docs/api/app-home/v1.1/web-components/layout-and-structure/page

## New WORK-only visual release

Current baseline: deployment `d5d1f522-fcc0-4fbb-9052-dc9d951e6029`, existing
`e866e2f2-0746-44d0-8caa-b37a1c9bcf45` at 100%, quote canary
`dbc6341f-de7f-41de-8e97-6bf971201eeb` at 0%. A fresh independent unsigned GET
still verified the exact current HQ runtime. Provider allocation must be
rechecked on the Owner host; no Cloudflare credentials are available here.

`work:hq:visuals:release-once` is a NEW reviewed one-use flow, not a rerun of
any previous upload/deployment. It checks clean synced WORK source, the
visual-only AST/file boundary and exact baseline; moves the previous generated
build to a local temporary backup, then freshly builds/tests/dry-runs the
package; uploads one inactive candidate; verifies the exact source marker,
new code and unchanged current bindings/runtime/flags; then reserves a
separate new receipt and activates that candidate at 100% with existing quote
canary retained at 0%. The final receipt requires independently read provider
allocation and an unpinned response identifying the exact new runtime.

All current security flags, secrets, D1 and application identities are
preserved. Quote drafts/conversation stay OFF on ordinary traffic, catalog
stays ON and Owner commissioning stays OFF. No schema, customer data, wallet,
app/proxy/extension identity, key, gateway, billing or LIVE operation.

New private receipt files in the existing Owner receipt directory:

- `work-hq-visual-theme-v1-upload-once-20261019.json`
- `work-hq-visual-theme-v1-activate-once-20261019.json`
- `work-hq-visual-theme-v1-restore-once-20261019.json`

Never reset or repeat them. On uncertain output use only
`work:hq:visuals:inspect`, which reads metadata/public health and sends no
signed POST or deployment. Failed activation may restore once only when
fresh reads identify this runner's exact deployment and unique operation
message with no intervening allocation. Changed/unreadable state holds.
`work:hq:visuals:restore-once` uses the same guarded, separately spent restore
receipt. The provider API has no compare-and-swap deployment lease; reads are
rechecked immediately before the requested transition.

This new visual candidate has NOT been uploaded or deployed yet. After its
Owner receipt, verify actual authenticated rendering and navigation in the
existing WORK app. The old 0% quote canary is intentionally retained exactly;
its separate Save → leave → Reload workflow keeps its existing testing limits.
Full WORK operational acceptance and customer-facing LIVE review remain open.

## Visual release preflight stop — Windows source comparison

Owner runner `4da85f24c92e7150656f9e4ffc6ae3693f9d5d4f` stopped with
`work_hq_visual_unverified` at preflight; its output explicitly reports no
upload or activation requested. No visual runtime change is certified.

Locally reproduced: converting the unchanged Requests route from LF to Windows
CRLF makes the visual AST comparison fail because TypeScript preserves JSX
line endings inside helper declarations. The guard now normalizes line endings
before parsing. Regression coverage compares all seven actual routes both ways
and retains rejection of auth, hook, event handler, control and copy changes,
including CRLF inputs. A genuine behavioral mismatch now reports the safe
repository route path instead of hiding behind the generic preflight error.
No browser, server, flag, deployment, secret or receipt behavior changed.

Next Owner step: pull the correction, run `work:hq:visuals:check` and
`test:work-hq-visual-release`, then `work:hq:visuals:inspect` read-only. Preserve
the output. Confirm all three visual receipt-presence fields are false and
allocation remains `e866e2f2-0746-44d0-8caa-b37a1c9bcf45` at 100% with
`dbc6341f-de7f-41de-8e97-6bf971201eeb` at 0% before considering the first actual
visual upload. Any receipt present or changed/unreadable allocation holds;
never reset receipts or repeat an upload/activation with uncertain outcome.
Full authenticated visual and WORK operational acceptance remain open.

## Visual theme activated on WORK — 2026-10-19 18:26 UTC

Owner release receipt supersedes earlier not-uploaded/not-deployed visual status.
Runner `9a92d0287e69628c63bd7bec9a5e3dace63f1c94` uploaded and activated
`80b47610-4d8a-4186-a4c8-fe4f05daf964` at 100%, retaining existing quote canary
`dbc6341f-de7f-41de-8e97-6bf971201eeb` at 0%. Deployment:
`dc3350e2-c394-4a5f-9d48-325ed23a1394`. Package SHA-256:
`f936ee373297bd042c63a1e024bf6f988cd5a576ebca832298916a890b7b3e81`.
Independent provider allocation and unpinned exact runtime health were verified
by the Owner runner (HTTP 200, database ready). Canonical evidence:
`docs/evidence/work-hq-visual-activation-2026-10-19.json`.

Current flags/bindings and quote canary preserved; catalog ON, quote drafts and
conversation OFF on ordinary traffic. No secret, data/schema or paid-service
change. Visual upload and activation receipts are SPENT: never rerun the
release or reset receipts. Read-back uses `work:hq:visuals:inspect` only.
Prior catalog/access version `e866e2f2-0746-44d0-8caa-b37a1c9bcf45` is the
visual release's guarded restoration baseline, not the ordinary active runtime.

Authenticated Owner browser verification remains pending: refresh the existing
WORK app; inspect Home, Requests, request detail, Catalog and Access at desktop
and narrow widths; verify navigation, readable focus and no horizontal overflow.
Do not invoke commissioning or create new requests/quotes for visual review.
Record screenshots and authenticated performance evidence. This receipt proves
deployment, not authenticated visual or full WORK operational acceptance.
Customer-facing LIVE promotion remains a separate reviewed release.

## JILL visual theme v2 prepared — 2026-10-19

User-authorized presentation-only continuation: bolder purple/cherry/gold/ink
palette, shared active-tab navigation, button-style actions, shorter task copy
and native disclosures for technical evidence. Quote/customer/security/error
boundaries remain visible. Canonical visual owner remains `hq-theme.css` and
the existing page styles; runtime backend, hooks and command props are unchanged.
See `docs/WORK_HQ_STUDIO_VISUAL_RELEASE_2026-10-19.md` for reviewed source,
24 local browser cases, guarded new v2 release/receipt boundaries and remaining
authenticated checks. Current visual v1 `80b47610-4d8a-4186-a4c8-fe4f05daf964`
is still active. v2 is source-prepared, not uploaded/deployed. v1 receipts remain
spent; never rerun historical releases or reset receipts. WORK operational
acceptance and separate customer-facing LIVE review remain incomplete.

## Visual theme v2 activated — 2026-10-19 19:00 UTC

Successful Owner receipt supersedes all preceding v2 prepared/not-deployed
status. Runner `5815213b29999310ea44049ef99d20b5178948c5`; package SHA-256
`c6652c586a6db71625764869306e816c19e1eebb0325e7c331119c613fd60719`.
Current HQ ordinary runtime: `d301efb4-b015-40d4-87ad-159a9fff82eb` at 100%.
Existing quote canary `dbc6341f-de7f-41de-8e97-6bf971201eeb` stays at 0%.
Deployment `3fbc20ff-1f9e-4e70-8f14-3e941638347c`, created
`2026-10-19T19:00:42.066909Z`. Provider allocation and unpinned exact runtime
health verified by the Owner runner; HTTP 200, database ready.
Canonical receipt: `docs/evidence/work-hq-studio-activation-2026-10-19.json`.

Visual v2 upload/activation receipts are SPENT. Never repeat
`work:hq:studio:release-once`, reset receipts or repeat historical releases.
Read-only inspection uses `work:hq:studio:inspect`. Visual v1
`80b47610-4d8a-4186-a4c8-fe4f05daf964` is now the guarded restoration baseline,
not ordinary active traffic. Current bindings and flags preserved: catalog ON,
quote drafts/conversation OFF, commissioning OFF. No secret, data/schema or
new billable service change. Existing quote testing limits remain unchanged.

Next visual check: refresh the existing authenticated JILL HQ — WORK app and
review Home, Requests, detail, Catalog and Access; verify shared navigation,
button affordances, technical disclosures, focus and narrow-width rendering.
Do not create requests/quotes or submit commands for a visual review.
Authenticated visual acceptance and full WORK operational acceptance remain
open. Customer-facing LIVE promotion remains a separate reviewed release.
