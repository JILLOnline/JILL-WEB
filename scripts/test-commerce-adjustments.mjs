import assert from 'node:assert/strict';

await import('../theme/assets/jill-form-engine.js');
await import('../theme/assets/jill-product-capabilities.js');
await import('../theme/assets/jill-product-options.js');
await import('../theme/assets/jill-commerce-adjustments.js');

const capabilities = globalThis.JILLProductCapabilities;
const productOptions = globalThis.JILLProductOptions;
const commerce = globalThis.JILLCommerceAdjustments;

assert.ok(capabilities, 'JILLProductCapabilities must initialize');
assert.ok(productOptions, 'JILLProductOptions must initialize');
assert.ok(commerce, 'JILLCommerceAdjustments must initialize');

const snackProfile = capabilities.resolve({
  version: 1,
  id: 'snack_bag_paid_options',
  fields: [
    {
      id: 'fill_state',
      kind: 'radio',
      group: 'product_options',
      label: 'Filled or Empty',
      required: true,
      options: [
        {value: 'empty', label: 'Empty'},
        {value: 'filled', label: 'Filled'},
      ],
    },
    {
      id: 'snack_choice',
      kind: 'select',
      group: 'product_options',
      label: 'Snack choice',
      required: true,
      options: [
        {value: 'cheetos', label: 'Cheetos'},
        {value: 'mixed', label: 'Mixed'},
        {value: 'other', label: 'Other'},
      ],
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'fill_state', operator: 'equals', value: 'filled'}],
      },
    },
  ],
  features: {
    customizationUnits: {
      unitsPerQuantity: 12,
      singularLabel: 'bag',
      pluralLabel: 'bags',
    },
    productOptionsAllocation: {
      fieldIds: ['fill_state', 'snack_choice'],
    },
    commerceAdjustments: [
      {
        id: 'filled_handling',
        when: {field: 'fill_state', operator: 'equals', value: 'filled'},
        quantityBasis: 'matched_units',
        variantId: '111',
        label: 'Filled bags',
      },
      {
        id: 'other_sourcing',
        when: {field: 'snack_choice', operator: 'equals', value: 'other'},
        quantityBasis: 'matched_units',
        variantId: 'gid://shopify/ProductVariant/222',
        label: 'Other snack sourcing',
      },
      {
        id: 'filled_groups',
        when: {field: 'fill_state', operator: 'equals', value: 'filled'},
        quantityBasis: 'matched_groups',
        variantId: '333',
      },
      {
        id: 'filled_order_once',
        when: {field: 'fill_state', operator: 'equals', value: 'filled'},
        quantityBasis: 'once',
        variantId: '444',
      },
      {
        id: 'filled_merchandise',
        when: {field: 'fill_state', operator: 'equals', value: 'filled'},
        quantityBasis: 'merchandise_quantity',
        variantId: '555',
      },
      {
        id: 'filled_all_customization_units',
        when: {field: 'fill_state', operator: 'equals', value: 'filled'},
        quantityBasis: 'customization_units',
        variantId: '666',
      },
    ],
  },
});

let snack = productOptions.createState({
  itemId: 'product:snack-bags',
  merchandiseQuantity: 1,
  profile: snackProfile,
});

snack = productOptions.addAllocationGroup(snack, snackProfile);
snack = productOptions.setAllocationGroupCount(snack, snackProfile, 'group_1', 6);
snack = productOptions.setAllocationGroupValue(snack, snackProfile, 'group_1', 'fill_state', 'filled');
snack = productOptions.setAllocationGroupValue(snack, snackProfile, 'group_1', 'snack_choice', 'cheetos');

snack = productOptions.addAllocationGroup(snack, snackProfile);
snack = productOptions.setAllocationGroupCount(snack, snackProfile, 'group_2', 3);
snack = productOptions.setAllocationGroupValue(snack, snackProfile, 'group_2', 'fill_state', 'filled');
snack = productOptions.setAllocationGroupValue(snack, snackProfile, 'group_2', 'snack_choice', 'other');

snack = productOptions.addAllocationGroup(snack, snackProfile);
snack = productOptions.setAllocationGroupCount(snack, snackProfile, 'group_3', 3);
snack = productOptions.setAllocationGroupValue(snack, snackProfile, 'group_3', 'fill_state', 'empty');

assert.equal(snack.complete, true);
assert.equal(snack.allocation.groups[2].values.snack_choice, undefined, 'hidden snack choice must not survive on Empty');

const snackPayload = productOptions.toPayload(snack);
const snackPlan = commerce.plan({
  profile: snackProfile,
  merchandiseQuantity: 1,
  productOptions: snackPayload,
});

assert.equal(snackPlan.version, 1);
assert.deepEqual(snackPlan.adjustments, [
  {
    id: 'filled_handling',
    variantId: 'gid://shopify/ProductVariant/111',
    quantity: 9,
    label: 'Filled bags',
  },
  {
    id: 'other_sourcing',
    variantId: 'gid://shopify/ProductVariant/222',
    quantity: 3,
    label: 'Other snack sourcing',
  },
  {
    id: 'filled_groups',
    variantId: 'gid://shopify/ProductVariant/333',
    quantity: 2,
    label: null,
  },
  {
    id: 'filled_order_once',
    variantId: 'gid://shopify/ProductVariant/444',
    quantity: 1,
    label: null,
  },
  {
    id: 'filled_merchandise',
    variantId: 'gid://shopify/ProductVariant/555',
    quantity: 1,
    label: null,
  },
  {
    id: 'filled_all_customization_units',
    variantId: 'gid://shopify/ProductVariant/666',
    quantity: 12,
    label: null,
  },
]);
assert.equal(Object.isFrozen(snackPlan), true);
assert.equal(Object.isFrozen(snackPlan.adjustments), true);

const emptyState = productOptions.createState({
  itemId: 'product:empty-snacks',
  merchandiseQuantity: 1,
  profile: snackProfile,
  allocationGroups: [
    {
      id: 'group_1',
      unitIds: Array.from({length: 12}, (_, index) => `product:empty-snacks::${index + 1}`),
      values: {fill_state: 'empty'},
    },
  ],
});
assert.equal(emptyState.complete, true);
assert.deepEqual(
  commerce.plan({
    profile: snackProfile,
    merchandiseQuantity: 1,
    productOptions: productOptions.toPayload(emptyState),
  }).adjustments,
  [],
  'base-price Empty bags must not create paid adjustments',
);

const personalizationProfile = capabilities.resolve({
  version: 1,
  id: 'paid_personalization',
  fields: [
    {
      id: 'finish',
      kind: 'radio',
      group: 'personalization',
      label: 'Finish',
      required: true,
      options: [
        {value: 'standard', label: 'Standard'},
        {value: 'premium', label: 'Premium'},
      ],
    },
  ],
  features: {
    commerceAdjustments: [
      {
        id: 'premium_finish',
        when: {field: 'finish', operator: 'equals', value: 'premium'},
        quantityBasis: 'once',
        variantId: '777',
      },
    ],
  },
});

assert.deepEqual(
  commerce.plan({
    profile: personalizationProfile,
    merchandiseQuantity: 2,
    personalization: {
      complete: true,
      values: {finish: 'premium'},
      allocations: [],
    },
  }).adjustments,
  [
    {
      id: 'premium_finish',
      variantId: 'gid://shopify/ProductVariant/777',
      quantity: 1,
      label: null,
    },
  ],
  'singleton Personalization must use the same commerce adjustment planner',
);

assert.throws(
  () => commerce.plan({profile: snackProfile, merchandiseQuantity: 1}),
  /product_options payload is required/,
);

assert.throws(
  () => commerce.plan({
    profile: snackProfile,
    merchandiseQuantity: 1,
    productOptions: {...snackPayload, complete: false},
  }),
  /product_options payload must be complete/,
);

const duplicateUnitPayload = {
  ...snackPayload,
  allocations: [
    snackPayload.allocations[0],
    {
      ...snackPayload.allocations[1],
      unitIds: [snackPayload.allocations[0].unitIds[0]],
    },
  ],
};
assert.throws(
  () => commerce.plan({
    profile: snackProfile,
    merchandiseQuantity: 1,
    productOptions: duplicateUnitPayload,
  }),
  /customization unit .* is allocated more than once/,
  'pricing must fail closed when canonical allocation integrity is broken',
);

assert.throws(
  () => commerce.plan({
    profile: snackProfile,
    merchandiseQuantity: 0,
    productOptions: snackPayload,
  }),
  /merchandiseQuantity must be a positive safe integer/,
);

const noChargesProfile = capabilities.resolve({version: 1, id: 'plain', fields: [], features: {}});
assert.deepEqual(
  commerce.plan({profile: noChargesProfile, merchandiseQuantity: 1}),
  {version: 1, adjustments: []},
  'products with no commerce adjustments must require no customization payload',
);
