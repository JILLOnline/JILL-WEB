# JILL Feature Contracts

This document owns user-facing behavioral contracts. It describes what features must do, independent of how they are implemented.

If implementation changes but these contracts remain satisfied, the feature may be considered behaviorally compatible. If a contract needs to change, update this document first and record the decision.

## 1. Global form contract

All JILL form systems consume one validation model.

### Required-state rules

- A required field is valid only when its value satisfies the field's semantic rule.
- Placeholder/default values are never valid answers.
- Hidden dependent fields never satisfy validation.
- A stage that depends on unresolved required state is non-actionable and not presented as complete.
- If earlier required state regresses, downstream completion immediately regresses with it.
- Validation returns the user to the first unresolved requirement and presents a clear reason.
- Required-state logic must be deterministic from data/state; it must not be inferred from CSS classes alone.

### Progressive disclosure

A dependent stage appears only when its prerequisite state is valid. The correct initial state must exist at first render; JavaScript may enhance behavior but may not hide duplicate/legacy content after first paint.

### Submission

Submission is blocked until every required contract in scope is valid. One canonical submit boundary owns final validation for the flow.

## 2. Product capabilities contract

Product families are configuration over one shared system.

A product capability record may declare support/requirements such as:

- personalization
- name/text
- number/age
- event date
- date needed
- fulfillment
- opening style
- number/shape/character style
- size
- print method
- flavor/options allocation
- reference upload
- multi-item personalization

The capability record describes requirements and allowed options. It does not clone markup, validation or state engines.

One capability may be used by many products or collections. A new product should inherit behavior by configuration wherever possible.

## 3. Product page contract

### Commerce visibility

Price, quantity and Add to Cart remain visible where the merchant/platform experience requires them. Required customization is enforced when Add to Cart is attempted.

### Add to Cart validation

When required customization is incomplete:

1. the item is not added
2. the first unresolved requirement is identified
3. the user receives visible feedback
4. focus/scroll moves appropriately without trapping the user
5. no duplicate modal/notice is created by repeated attempts

When complete, customization data that belongs to the line item travels through supported Shopify line-item/order contracts.

### Quantity ownership

Shopify product/cart quantity is the singular commerce quantity owner and counts sellable merchandise units. Personalization and option allocation consume that quantity but cannot independently change the total ordered merchandise quantity.

A sellable merchandise unit may contain more than one physical item that can be customized independently. When that applies, the Product Capability Profile declares `features.customizationUnits.unitsPerQuantity`; absence means `1`. Eligible customization-unit count is derived as Shopify merchandise quantity multiplied by `unitsPerQuantity`.

This derived customization-unit count is an input to allocation only. It is not a second commerce quantity, may not rewrite Shopify quantity, and may not be inferred from product titles, handles, collections or other presentation strings.

## 4. Piñata capability contract

When enabled, Piñata Style begins with an unresolved choice and supports:

- Number
- Shape
- Character/custom descriptive equivalent

If Number is chosen, 1–9 is required. If Shape or Character/custom is chosen, descriptive input replaces the numeric requirement.

Opening style such as traditional break/pull-string is required only when the product configuration declares it.

Name/Text is optional unless configured as required. When the Yes/No question is used, Yes reveals the field and activates its validation. JILL's default limit is 12 characters.

Event-date planning may enforce a merchant-defined earliest date. JILL's shipping-oriented production baseline is 12 business days from the current date with explicit non-guarantee delivery messaging.

Theme/design idea and preferred colors are supported capability fields. Reference media supports up to three files by JILL default when enabled.

## 5. Party favor / supply / activity capability contract

Supported JILL defaults:

- Name/Text Yes/No with 12-character default limit
- Number/Age Yes/No with 1–9 default range when applicable
- product-specific option allocation where required
- multi-item personalization only when more than one eligible customization unit exists
- pack products declare their physical customization-unit count through capability configuration rather than title parsing

The feature must not render irrelevant questions for products that do not declare the capability.

## 6. Apparel / gift capability contract

Supported capabilities include:

- size selection
- Name/Text personalization when required
- reference file when required
- print method where relevant

Current JILL print methods include DTF, Sublimation and Vinyl. The list is configuration; the engine is not print-method-specific.

## 7. Product Options contract — protected reference

Product Options is a protected behavior until its Theme Core replacement is certified.

Required behavior:

- product-specific options are derived from selected products/capabilities
- every required option starts unresolved
- status communicates incomplete/complete clearly
- completion does not collapse/reopen unpredictably when unrelated selections change
- removing/changing a prerequisite reconciles affected option state only
- allocation totals reconcile to the eligible customization-unit count derived from Shopify quantity and capability configuration
- options never become an independent commerce quantity owner
- options do not create a second personalization engine
- a completed option remains stable unless one of its own dependencies changes

Future Theme Core implementation must reproduce the behavior through one option engine, not collection-specific scripts.

## 8. Personalization contract

### Modes

The canonical modes are:

- none
- same for all selected eligible items
- different by item/unit

`different` is disabled or absent when fewer than two eligible customization units exist.

### Same mode

One personalization data set applies to all eligible selected customization units.

### Different mode

- the eligible customization-unit count derived from Shopify quantity and capability configuration is the allocator input
- personalization may not increase or decrease total ordered merchandise quantity
- groups can target one or multiple eligible customization units
- one unit cannot belong to multiple groups
- allocations unavailable in one group are unavailable in other groups
- unallocated availability updates immediately
- all eligible required units must be allocated exactly once to finish
- Name/Text, Number/Age and Notes/Theme fields appear only when supported by the selected products
- adding another personalization is possible only while eligible unallocated units remain
- Finish Personalization is available only when allocation and required fields are complete
- deleting or reducing upstream Shopify quantity, or changing the configured customization-unit model, reconciles allocations deterministically without leaving impossible state

### Rendering

The allocator must render from canonical application state. It must not repeatedly reconstruct authoritative state from whichever DOM elements happen to be visible.

No compatibility bridge, delayed neutralization, hidden legacy control set or competing MutationObserver may serve as a second owner.

## 9. Cascading/progressive flow contract

Cascading progression is one reusable engine.

Each stage declares:

- prerequisites
- required fields
- completion rule
- dependent stages

The engine provides reveal/hide, regression, focus-to-error and completion state. Product pages and custom-order forms configure the engine; they do not clone its logic.

## 10. Custom Order contract

The Custom Order experience supports multiple selected products in one request.

### Conceptual stages

1. product selection and quantities
2. Product Options
3. event/date-needed/fulfillment where applicable
4. personalization and allocation
5. references/consent where applicable
6. review
7. request submission
8. success

The UI may visually group these stages differently as long as the contracts and data dependencies remain intact.

### Review

Review is available as the next destination but cannot advance while required state is incomplete. If blocked, the first missing requirement is surfaced.

The review summary groups information coherently by selected product/family and shows all meaningful options, personalization, dates and fulfillment choices before submission.

### Submit

The final action is `Request Custom Order`, not Add to Cart, when operating in request mode.

A successful request means the request was received for review. It does not itself confirm final price, production slot or delivery date.

### Backend payload

The canonical request can include:

- submission ID
- status
- submitted time
- name
- email
- phone
- preferred contact
- event date
- date needed
- fulfillment
- city/state/ZIP where relevant
- theme
- colors
- selected products/collections
- reference images
- marketing consent and consent timestamp/source
- structured/raw payload

The theme builds the request; the backend owns persistence, privileged synchronization and notifications.

## 11. Upload contract

Uploads are one capability/adapter.

- file count, size and accepted types are configured centrally
- selected file names are visible
- adding/removing files updates canonical state immediately
- mobile layout never overflows
- failed upload/submission produces a recoverable error
- upload state cannot be considered complete merely because a filename is painted in the DOM
- reference media is never duplicated into multiple independent upload engines

## 12. Cart contract

- Shopify remains authoritative for cart contents and commerce operations
- line-item customization stays attached to the correct line
- cart quantity changes must reconcile with any quantity-sensitive customization contract
- cart icon/count changes must not change the visual scale of the icon itself
- cart drawer/notification variants consume the same visual primitives as the rest of Theme Core

## 13. Rewards presentation contract

Rewards presentation consumes authoritative customer reward state.

Canonical stable states:

- `REDEEM`: available positive action; JILL presentation uses success/green semantics
- `USE_COUPON`: generated/redeemed coupon ready; JILL presentation uses info/blue semantics
- `NEXT_REWARD`: exactly one next target; JILL presentation uses purple/star emphasis
- `LOCKED`: unavailable future tier

Transient states include confirming, pending, success and error as needed.

The theme/account UI does not calculate point balances, create discounts, reconcile orders/refunds or decide coupon integrity.

A redemption action requires confirmation before the privileged request is submitted. Pending state replaces/locks the initiating action deterministically so repeated clicks cannot create parallel requests.

## 14. Customer Account contract

Desired JILL navigation:

`Dashboard → Orders → Coupons → Contact JILL → Settings → Log Out`

Account modules share platform-safe JILL action/status primitives. They should visually belong to JILL while respecting Shopify Customer Account UI-extension constraints.

The storefront and Customer Account may use different implementation primitives because of Shopify platform boundaries, but they must share semantic action/state definitions.

## 15. Header/navigation contract

- header state renders correctly at first paint
- mobile and desktop structures do not fight for visibility
- cart/account icon dimensions remain stable across state changes
- external social destinations open without discarding the customer's current storefront session
- language and country/currency controls share one visual/control language
- keyboard navigation and visible focus are supported

## 16. Motion / no-flicker contract

Motion exists to explain state change, not hide architecture problems.

Forbidden patterns:

- render wrong UI, then hide it after DOM ready
- fade out duplicate controls rather than removing the duplicate owner
- delayed cleanup timers used to reach the intended initial state
- repeated observer loops that fight over visibility/classes
- page-specific animation overrides for canonical primitives

Reduced-motion preference must be respected when motion is introduced.

## 17. Merchant configuration contract

Merchant settings configure behavior/capabilities through supported contracts. They do not inject arbitrary CSS/JavaScript or bypass canonical validation.

A merchant may change labels, media, content, supported layout variants and global design tokens. They may not create a second button/field/card system through a section setting.

## 18. Compatibility rule

When migrating old JILL behavior, preserve the user contract—not the implementation technique. Old code may be inspected as evidence. Compatibility layers are temporary only when an explicit migration decision requires one, and Theme Core's default rule is to avoid them entirely.
