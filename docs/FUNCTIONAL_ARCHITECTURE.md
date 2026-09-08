# JILL Functional Architecture

This document owns how the JILL platform executes behavior end-to-end: browser state, Shopify commerce, application/backend authority, persistence, events, retries, integrations, and failure recovery.

It does not own visual design or individual feature semantics. Those remain in the Design System and Feature Contracts.

## Core principle

JILL is not one giant theme script.

Every action flows through the narrowest authoritative layer capable of owning it:

```text
Customer
  ↓
Theme / Customer Account UI
  ↓
Browser feature state
  ↓
Shopify platform OR JILL backend adapter
  ↓
Authoritative persistence / privileged execution
  ↓
Events + reconciliation
  ↓
Authoritative state returned to UI
```

The browser may validate and present state optimistically. It may never become the sole authority for money, rewards, orders, discount creation, durable customer records, or privileged integration state.

## Platform layers

### Layer 1 — Shopify platform authority

Shopify remains canonical for standard commerce concerns:

- products
- variants
- product availability
- prices
- discounts applied to checkout/orders
- cart/checkout contracts
- orders
- payments
- refunds
- customers
- customer authentication
- fulfillment/shipping platform state
- merchant-managed metafields/metaobjects where used

Theme Core consumes these contracts instead of recreating them.

### Layer 2 — Theme presentation and ephemeral browser state

`theme/` owns:

- Liquid-rendered storefront markup
- canonical UI primitives
- responsive presentation
- browser-only interaction state
- product capability rendering
- required-field validation
- progression/cascade state
- Product Options presentation/state
- personalization allocation presentation/state
- cart interaction
- request-building for Custom Order
- user feedback for pending/success/error states

Theme code may construct a request, but privileged execution belongs elsewhere.

### Layer 3 — Shopify Customer Account extensions

`extensions/` owns account surfaces that Shopify requires to run as Customer Account UI extensions.

They consume:

- authenticated customer context
- Shopify Customer Account APIs
- shared semantic UI/state definitions
- authoritative JILL backend/customer data

They do not reproduce storefront CSS or reward accounting.

### Layer 4 — JILL application/backend authority

`backend/` owns operations requiring durable storage, secrets, privileged Shopify access, external integrations, reconciliation, or cross-request integrity.

Examples:

- custom-order persistence
- confirmation/notification execution
- Shopify customer synchronization
- reward accounting
- reward redemption
- coupon creation/revocation
- webhook handling
- asynchronous reconciliation
- upload persistence/metadata where required
- external service integration
- operational health/watchdogs

The initial production backend is Google Apps Script. Theme Core treats backend behavior through contracts/adapters so implementation can later migrate to another runtime without rewriting storefront behavior.

## The functional rule: command, event, query

Backend interactions are classified into three categories.

### Commands

A command asks the system to change durable state.

Examples:

- submit custom order
- request reward redemption
- update customer preference
- create/revoke reward coupon

Command requirements:

- explicit input contract
- validation at the backend boundary
- authenticated/authorized where required
- idempotency key or deterministic operation identity
- one canonical handler
- deterministic success/error response
- safe retry behavior

### Events

An event says something authoritative already happened.

Examples:

- order paid
- order edited
- refund created
- order cancelled
- discount deleted
- customer updated

Event requirements:

- verify source/authenticity
- deduplicate/reprocess safely
- calculate state from authoritative source data
- persist event consequence idempotently
- retry on temporary failure
- reconcile if an event is missed

### Queries

A query reads authoritative state without changing it.

Examples:

- current rewards wallet
- current coupon status
- custom-order status
- customer dashboard data

Query requirements:

- no hidden mutation
- authenticated when customer-specific
- stable response contract
- cache only where stale data is acceptable

## End-to-end commerce functionality

### Standard product purchase

```text
Shopify product
  ↓
Liquid render
  ↓
variant + quantity state
  ↓
Add to Cart
  ↓
Shopify cart
  ↓
Shopify checkout
  ↓
Shopify order/payment
```

No JILL backend is inserted into ordinary commerce unless a real business requirement exists.

### Personalized product purchase

```text
Shopify product
  ↓
Product Capability Profile
  ↓
Customization state
  ↓
Validation + progression
  ↓
Product Options / personalization / references
  ↓
Add to Cart validation boundary
  ↓
Supported Shopify line-item properties / identifiers
  ↓
Shopify cart → checkout → order
```

Customization data that must survive checkout is attached using supported Shopify commerce contracts. The browser does not maintain a private parallel order record merely to preserve customization.

Where large media cannot safely travel as direct line-item data, the line item carries a durable reference ID/URL produced by the upload adapter rather than duplicated binary state.

## Product Capability execution

One normalized Product Capability Profile is resolved for the product.

```text
Shopify-native merchant configuration
  ↓ adapter
normalized Product Capability Profile
  ↓
shared field/rendering contracts
  ↓
validation + progression
  ↓
Product Options + personalization
```

Product names, collection names and tags are not execution switches unless an explicit adapter contract deliberately maps them during migration.

The long-term merchant-facing source should use Shopify-native structured data such as product metafields/metaobjects. The normalized profile contract isolates runtime behavior from Shopify storage shape.

## Universal browser state architecture

Each interactive feature owns explicit state rather than inferring truth from CSS classes or DOM visibility.

Common field/stage states:

- `UNAVAILABLE` — prerequisite does not allow the field/stage
- `EMPTY` — available but unresolved
- `VALID` — currently valid
- `INVALID` — currently invalid after validation attempt/change
- `PENDING` — durable action is in progress
- `SUCCESS` — durable action completed
- `ERROR` — durable action failed/requires user recovery

Feature-specific stable states may extend these semantics, for example Rewards `REDEEM`, `USE_COUPON`, `NEXT_REWARD`, and `LOCKED`.

### State ownership rules

- application state determines rendered state
- CSS describes appearance only
- DOM is an output, not a database
- one feature owner performs state transitions
- dependent state is derived from upstream canonical state
- regression is synchronous/deterministic
- durable responses replace optimistic assumptions
- no competing MutationObservers may act as state authorities

## Universal validation engine

Validation is shared infrastructure.

Every field contract declares enough information for validation to evaluate:

- availability
- requiredness
- type/kind
- allowed values
- range/length/file constraints
- dependencies/conditions

The engine returns structured results. Presentation consumes those results.

Example conceptual result:

```text
field_id: customer_name
available: true
required: true
valid: false
reason: required
```

No feature writes a separate `if empty then alert` engine.

Final command boundaries always validate again server-side when the backend is involved.

## Progression / cascade execution

Progression is derived from validation state.

```text
prerequisite fields valid
  ↓
stage available
  ↓
user completes stage
  ↓
dependent stage available
```

If an upstream requirement becomes invalid, dependent stages become unavailable immediately and stale hidden values cannot satisfy completion.

Product page and Custom Order configure the same progression engine rather than cloning reveal/hide logic.

## Product Options execution

Product Options receives:

- selected products/variants
- authoritative quantity
- Product Capability Profile
- current option state

It returns:

- required option groups
- valid/incomplete status
- allocation state where required
- normalized option payload

It never owns product quantity itself.

Changing one dependency invalidates/reconciles only affected option state. Unrelated completed groups remain stable.

## Personalization execution

Personalization receives already-selected eligible items/quantities.

Canonical state contains:

- mode: none / same / different
- eligible unit/item identities
- groups
- group → allocated units
- group personalization values
- validation/completion state

Completion requires exact allocation of every required eligible unit once.

The allocator never changes the commerce quantity.

## Custom Order command pipeline

Custom Order is a composition of existing engines plus one durable backend command.

### Browser phase

```text
products + quantities
  ↓
Product Options
  ↓
dates / fulfillment
  ↓
personalization
  ↓
references / consent
  ↓
Review
  ↓
normalized Custom Order request
```

### Backend phase

```text
POST command
  ↓
parse + validate
  ↓
calculate/verify submission identity
  ↓
idempotency check
  ↓
persist request
  ↓
customer confirmation
  ↓
Shopify/customer synchronization
  ↓
return stable submission ID/status
```

Current production behavior already demonstrates several good invariants:

- deterministic/deduplicated submission identity
- persisted request survives Shopify sync failure
- confirmation is not repeatedly sent during retries
- Shopify sync is a recoverable secondary operation

These behaviors are retained when backend ownership is split.

## Rewards execution

Rewards is a backend-owned financial/loyalty ledger.

### Earning

```text
Shopify order event
  ↓
verified webhook
  ↓
read authoritative order financial lines
  ↓
calculate eligible spend
  ↓
idempotent credited amount per order
  ↓
reconcile customer wallet
```

### Redemption

```text
Customer Account action
  ↓
confirm
  ↓
command with tier + nonce/idempotency identity
  ↓
backend reconciles wallet
  ↓
atomically claims request
  ↓
creates Shopify discount
  ↓
persists wallet/coupon result
  ↓
returns authoritative state
```

If the final persistence step fails after discount creation, rollback deletes the newly created discount and clears pending state.

### Self-healing

Rewards already uses the pattern we want platform-wide:

- webhooks for immediate change
- scheduled reconciliation for missed/failed events
- infrastructure verification
- external watchdog
- customer-facing refresh/query

The principle is: **events make it fast; reconciliation makes it correct.**

## Customer Account functionality

Customer Account extensions query authenticated customer state and render it through shared account UI semantics.

Desired functional surfaces:

- Dashboard
- Orders
- Coupons
- Contact JILL
- Settings
- Log Out

The account is a view/controller over Shopify and JILL backend truth, not a second database.

Customer preferences or JILL-specific durable profile state should have one explicit persistence owner, normally Shopify customer metafields when platform access and data semantics fit, otherwise the JILL backend datastore.

## Upload functionality

Uploads require a dedicated adapter because binary media is different from ordinary form state.

Target flow:

```text
customer selects file
  ↓
client validates basic count/type/size
  ↓
backend/storage adapter validates again
  ↓
media stored by provider
  ↓
durable media reference returned
  ↓
reference enters product/custom-order payload
```

Rules:

- client-side validation is convenience only
- provider credentials never live in theme JavaScript
- one upload adapter supports product and Custom Order flows
- line items/forms carry stable media references rather than raw binary payloads where practical
- failed uploads are recoverable and removable
- orphaned uploads require an expiration/cleanup policy when persistent storage is introduced

No specific storage provider becomes architecture until chosen; provider details stay behind the adapter.

## Data ownership map

### Shopify owns

- catalog
- variants/pricing
- carts/checkouts/orders
- payments/refunds
- customers/authentication
- discount objects
- native metafields/metaobjects selected as merchant/customer data owners

### Theme/browser owns temporarily

- current input values
- validation results
- progression state
- open/closed UI state
- unsent option/personalization allocation
- pending command presentation

Refresh may discard this state unless an explicit draft feature is later created.

### JILL backend owns

- Custom Order durable submissions/status synchronization
- reward ledger/wallet integrity
- privileged coupon operations
- webhook processing/reconciliation
- external integration secrets
- backend operational metadata

### Shopify order line owns

- purchase-specific customization properties/references that must remain attached to the purchased item

## Backend module target

The current Apps Script file combines Custom Order and Rewards. During migration, preserve the deployed endpoint while splitting code into domain owners inside the same Apps Script project before considering a runtime migration.

Target conceptual modules:

```text
backend/google-apps-script/
├── app-entry.gs              web-app routing only
├── custom-order.gs           custom-order command/persistence workflow
├── rewards.gs                rewards domain orchestration
├── rewards-shopify.gs        rewards Shopify adapter
├── shopify-client.gs         shared privileged Shopify request client
├── storage.gs                shared Script Properties/Sheet helpers only when generic
├── responses.gs              HTTP response utilities
└── validation.gs             backend boundary validation utilities
```

Physical filenames are introduced only as their code is actually extracted. No empty placeholders.

If shared code is only used by one domain, it stays with that domain rather than being prematurely generalized.

## Backend migration boundary

Google Apps Script is the current implementation, not a permanent architectural dependency.

Browser/extension callers should depend on stable contracts:

```text
command endpoint + request schema + response schema
query endpoint + response schema
event handler semantics
```

If JILL later outgrows Apps Script, the adapter endpoint/runtime can move to a Shopify app server, serverless runtime, worker, or other service without changing product/customization engines.

Migration to a larger runtime should be triggered by measurable operational need such as concurrency, latency, storage, observability, workload limits, or multi-merchant commercialization—not architecture fashion.

## Idempotency policy

Every durable command/event that could be retried must be idempotent.

Use an operation identity appropriate to the domain:

- Custom Order: submission ID
- reward redemption: request nonce/idempotency key
- Shopify event: webhook/event/order identity + owned credited/reconciled state
- uploads: upload operation/reference identity when introduced

Re-running the same operation must not create duplicate emails, submissions, credits, coupons, or side effects.

## Transaction/rollback policy

When an operation spans multiple systems, define ordering and compensation before implementation.

Example reward redemption:

1. validate/reconcile
2. claim operation
3. create Shopify discount
4. persist final wallet state
5. if #4 fails, compensate by deleting #3

Example Custom Order:

1. validate
2. persist submission
3. send confirmation
4. sync Shopify customer
5. record secondary-sync status separately

The first durable write should protect the customer's primary request. Secondary integration failure must not silently discard the primary operation.

## Retry policy

Classify failure as:

- validation/permanent → return actionable error, do not retry automatically
- authorization/configuration → fail closed and surface operational alert
- remote transient → retry safely using idempotency
- unknown → fail safely, log/record enough context for reconciliation

Webhooks should return/rethrow appropriately so the source can retry transient processing failures.

Scheduled reconciliation handles missed events and long-lived incomplete states.

## Security boundary

Theme/browser code is public and untrusted.

Never place in theme assets:

- Shopify Admin tokens
- webhook secrets
- service credentials
- private storage credentials
- discount-creation authority
- backend signing secrets

Backend validates all externally supplied identifiers and business data. Browser validation never replaces authorization.

Customer-specific queries/actions must use authenticated identity rather than trusting an arbitrary customer ID/email supplied by the browser.

## Observability and operational health

Every privileged domain should eventually expose enough operational truth to answer:

- is the service reachable?
- what version is executing?
- are required webhooks/subscriptions installed?
- is scheduled reconciliation healthy?
- are commands failing/retrying?
- is there stuck/pending state?

Rewards already implements a watchdog pattern. Other backend domains should reuse the operational principle without copying the Rewards-specific implementation.

No secrets or customer private data are returned from public health endpoints.

## Functional test strategy

### Pure logic tests

Prefer extracting deterministic calculations/state transitions into testable functions:

- capability resolution
- validation
- progression
- Product Options reconciliation
- personalization allocation
- rewards math/state derivation
- request normalization

### Contract tests

Verify request/response payload shapes for:

- Custom Order
- rewards queries/redemption
- upload adapter
- future customer preference commands

### Integration tests

Verify real platform interactions in safe test/dev environments:

- Shopify cart line properties
- order/customization persistence
- customer sync
- webhook processing
- real discount creation/revocation
- refunds/order edits

### Failure tests

Every multi-system command requires explicit failure simulation:

- duplicate command
- remote API timeout
- persistence failure
- partial completion
- stale state
- deleted/modified external resource

Correct failure behavior is a feature.

## Execution order for building Theme Core functionality

### Stage 1 — standard Shopify commerce

- product rendering
- variants
- quantity
- Add to Cart
- cart
- checkout handoff

### Stage 2 — browser infrastructure

- Product Capability adapter/resolver
- validation engine
- progression engine
- canonical form controls

### Stage 3 — configurable commerce

- Product Options
- personalization
- upload adapter
- line-item customization persistence

### Stage 4 — Custom Order

- compose existing browser engines
- normalized request contract
- backend command adapter
- persistence/sync/confirmation

### Stage 5 — account/backend integrations

- dashboard state queries
- rewards
- coupons
- customer settings/preferences
- custom-order status

### Stage 6 — backend decomposition and hardening

While keeping production behavior online:

- split Apps Script domain ownership
- centralize Shopify privileged adapter
- formalize command/query/event schemas
- expand idempotency/reconciliation tests
- operational health per backend domain

### Stage 7 — scale/runtime decision

Measure the production system. Migrate backend runtime only if constraints justify it. Preserve contracts so migration is internal.

## Definition of functional done

A feature is functionally done only when:

1. one canonical owner exists for each state/business rule
2. browser and backend authority boundaries are explicit
3. request/event identity makes retries safe
4. durable data has one canonical persistence owner
5. failure and rollback behavior are defined
6. relevant automated tests pass
7. Shopify platform behavior remains authoritative where appropriate
8. no privileged secret/business truth is duplicated into the theme
9. reconciliation exists for domains where missed events can corrupt durable truth
10. UI presents authoritative final state after durable operations
