import assert from 'node:assert/strict';

await import('../theme/assets/jill-product-capabilities.js');
const capabilities = globalThis.JILLProductCapabilities;

function baseProfile() {
  return {
    version: 1,
    id: 'commerce_rules',
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
        id: 'event_date',
        kind: 'date',
        group: 'planning',
        label: 'Event date',
        required: false,
      },
    ],
    features: {
      productOptionsAllocation: {fieldIds: ['fill_state']},
      commerceAdjustments: [
        {
          id: 'filled_fee',
          when: {field: 'fill_state', operator: 'equals', value: 'filled'},
          quantityBasis: 'matched_units',
          variantId: '123',
        },
      ],
    },
  };
}

const resolved = capabilities.resolve(baseProfile());
assert.equal(capabilities.getCommerceAdjustments(resolved).length, 1);
assert.equal(capabilities.getCommerceAdjustments(resolved)[0].variantId, '123');
assert.equal(Object.isFrozen(capabilities.getCommerceAdjustments(resolved)), true);

const duplicateRule = baseProfile();
duplicateRule.features.commerceAdjustments.push({
  ...duplicateRule.features.commerceAdjustments[0],
  variantId: '124',
});
assert.throws(
  () => capabilities.resolve(duplicateRule),
  /duplicate commerce adjustment id filled_fee/,
);

const unknownField = baseProfile();
unknownField.features.commerceAdjustments[0].when.field = 'missing';
assert.throws(
  () => capabilities.resolve(unknownField),
  /references unknown field missing/,
);

const planningField = baseProfile();
planningField.features.commerceAdjustments[0].when = {
  field: 'event_date',
  operator: 'equals',
  value: '2026-10-01',
};
planningField.features.commerceAdjustments[0].quantityBasis = 'once';
assert.throws(
  () => capabilities.resolve(planningField),
  /field event_date must belong to product_options or personalization/,
);

const invalidOption = baseProfile();
invalidOption.features.commerceAdjustments[0].when.value = 'stuffed';
assert.throws(
  () => capabilities.resolve(invalidOption),
  /references invalid option stuffed for field fill_state/,
);

const singletonMatchedUnits = baseProfile();
singletonMatchedUnits.features.productOptionsAllocation = undefined;
assert.throws(
  () => capabilities.resolve(singletonMatchedUnits),
  /quantity basis matched_units requires allocated field fill_state/,
);

const invalidVariant = baseProfile();
invalidVariant.features.commerceAdjustments[0].variantId = 'not-a-variant';
assert.throws(
  () => capabilities.resolve(invalidVariant),
  /must reference a Shopify ProductVariant id/,
);

const badOperator = baseProfile();
badOperator.features.commerceAdjustments[0].when.operator = 'contains';
assert.throws(
  () => capabilities.resolve(badOperator),
  /unsupported operator contains/,
);
