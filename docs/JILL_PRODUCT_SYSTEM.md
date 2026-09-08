# JILL Product System

This document is the product-system contract for JILL storefront and customer-account work.

The goal is not to make individual screens look similar by coincidence. The goal is to make shared primitives, state rules, and ownership boundaries produce consistent behavior automatically.

## Constitution

1. **System over one-offs.** If the same visual or behavioral concept appears more than once, it gets a canonical owner. Fix the owner, not every occurrence.
2. **One owner per behavior.** Business rules, state transitions, presentation, and platform integration must not be independently reimplemented in multiple files.
3. **Semantic primitives first.** Actions, pills, status indicators, cards, fields, headings, spacing, and feedback states use shared semantic roles rather than screen-specific styling.
4. **State is centralized.** UI components render state; they do not invent reward, product, personalization, allocation, pricing, or fulfillment rules.
5. **Shopify is a platform boundary.** Keep the Shopify contracts required for Online Store 2.0, Customer Accounts, app blocks, product/cart/search/localization behavior, analytics, and accessibility. Replace Dawn implementation only when JILL owns an equivalent implementation.
6. **No ghost UI.** No flash-of-old-state, hidden duplicate controls, delayed cleanup patches, competing observers, or multiple scripts fighting for the same DOM/state authority.
7. **Responsive and accessible by default.** A component is not complete until keyboard, labels, disabled/loading behavior, small screens, and long/translated content are safe.
8. **Housekeeping is part of every change.** Remove superseded logic in the touched path, update guards/tests, and leave no temporary runners, patchers, deploy junk, or dead compatibility code.

## Architecture boundaries

### Shopify contract layer

Owns the minimum platform contracts JILL must preserve:

- Online Store 2.0 JSON templates and section schemas
- required Liquid objects, routes, forms, app blocks, and theme settings
- product variants, selling plans where applicable, cart, search, localization, and customer links
- Shopify analytics/integrations and platform accessibility contracts
- Customer Account UI component restrictions and semantic platform styling

This layer is deliberately boring. JILL does not fork a Shopify requirement merely to make it look custom.

### JILL design-system layer

Owns presentation and interaction primitives:

- typography scale
- spacing and surface rhythm
- radii
- action hierarchy
- compact action/status pills
- cards and panels
- fields and validation feedback
- loading, disabled, confirmation, success, empty, and error states
- responsive behavior
- motion rules, including reduced-motion and no-flicker requirements

Screens consume these primitives. They do not reproduce them.

### JILL business-module layer

Owns JILL-specific features and their UI orchestration:

- product customization and progressive disclosure
- personalization and allocation
- custom-order request flow
- rewards presentation
- account/dashboard modules

Business modules may compose design-system primitives and platform contracts. They must not become a second design system.

### Backend/business-authority layer

Server-side systems remain authoritative for accounting, integrity, fulfillment-side reconciliation, and privileged writes. UI may request an operation and present its state, but it does not reproduce backend truth.

For JILL Rewards specifically, `rewards.mjs` owns customer-facing reward state derivation and the Apps Script v13 engine owns reward accounting/integrity. Presentational components must not duplicate either.

## Action model

Every action has a semantic role before it has a visual treatment.

- **Primary action** — the main action for a page or decisive flow step.
- **Secondary action** — safe alternative/navigation action.
- **Success action** — an available positive operation such as redeem/apply.
- **Info action** — an available informational/use action such as opening a ready coupon.
- **Destructive action** — irreversible/removal behavior; requires explicit semantics and confirmation where appropriate.
- **Status pill** — compact state display; interactive only when the state itself has a meaningful action.
- **Locked/disabled state** — visibly unavailable and semantically disabled; never implemented as a fake clickable.
- **Pending state** — replaces the initiating control immediately with deterministic progress feedback.

A confirmation action does not get a unique shape just because it lives inside a confirmation panel. It uses the same semantic action primitive as the rest of the product.

## Storefront migration rules

The current live theme is a Dawn-derived production theme with JILL behavior mixed into both Dawn core files and many accumulated `jill-*` patch layers. Migration therefore follows these rules:

1. Capture the exact live theme in Git before refactoring.
2. Never reset the store to stock Dawn as a shortcut.
3. Classify each existing behavior into Shopify contract, JILL design system, or JILL business module.
4. Consolidate overlapping patch files into canonical owners.
5. Remove an old patch only after its behavior is either deliberately removed or covered by its canonical replacement.
6. Do development against the unpublished `Copy of JILL` theme.
7. Keep `JILL - KEEP` untouched as the recovery copy.
8. The live `JILL` theme is read-only input until the replacement passes validation and smoke testing.

Legacy names such as `final`, `fix`, `cleanup`, `polish`, and numbered authority fragments are migration evidence, not acceptable long-term module architecture.

## Required validation gates

Before storefront promotion:

- exact source snapshot exists in Git
- Theme Check passes or every retained exception is explicitly documented
- required Shopify theme directories/contracts exist
- no `.shopify`, credentials, temporary files, generated debug assets, or local secrets are committed
- product, collection, cart, search, localization, custom-order, and account entry points smoke-test successfully
- mobile and desktop flows are checked
- no duplicate controls or competing state owners remain in touched flows
- flicker/ghost-state regression check passes
- accessibility baseline passes

Before Customer Account promotion:

- repository install succeeds
- reward guards/state tests pass when rewards are touched
- Shopify app config validates
- extension build succeeds
- shared action/state primitives are used instead of new one-off equivalents
- platform component semantics are preserved

## Definition of done

A change is done when the requested behavior works, its shared owner is correct, superseded code in the touched path is removed, automated checks protect the invariant, and the repository is cleaner than before the change.

That is the JILL version of the JTC rule: build the product system once, then let the product inherit it everywhere.
