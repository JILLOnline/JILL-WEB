import assert from 'node:assert/strict';

await import('../theme/assets/jill-form-engine.js');
await import('../theme/assets/jill-product-capabilities.js');
await import('../theme/assets/jill-commerce-adjustments.js');
await import('../theme/assets/jill-commerce-cart.js');
await import('../theme/assets/jill-product-commerce.js');

const capabilities = globalThis.JILLProductCapabilities;
const productCommerce = globalThis.JILLProductCommerce;

assert.ok(productCommerce, 'JILLProductCommerce must initialize');

const profile = capabilities.resolve({
  version: 1,
  id: 'paid_product',
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
    customizationUnits: {unitsPerQuantity: 2},
    productOptionsAllocation: {fieldIds: ['fill_state']},
    commerceAdjustments: [
      {
        id: 'filled_fee',
        when: {field: 'fill_state', operator: 'equals', value: 'filled'},
        quantityBasis: 'matched_units',
        variantId: '222',
      },
      {
        id: 'premium_finish',
        when: {field: 'finish', operator: 'equals', value: 'premium'},
        quantityBasis: 'once',
        variantId: '333',
      },
    ],
  },
});

const productOptionsPayload = {
  complete: true,
  values: {},
  allocations: [
    {
      id: 'group_1',
      unitIds: ['item::1', 'item::2'],
      values: {fill_state: 'filled'},
    },
  ],
};

const formData = new FormData();
formData.append('id', '111');
formData.append('quantity', '1');
formData.append('properties[_jill_profile]', 'paid_product@1');
formData.append('properties[_jill_product_options]', JSON.stringify(productOptionsPayload));
formData.append('properties[finish]', 'premium');

const fakeForm = {
  querySelector(selector) {
    if (selector === '[data-jill-product-options-payload]') {
      return {value: JSON.stringify(productOptionsPayload)};
    }
    return null;
  },
};

const plan = productCommerce.buildPlan({
  profile,
  form: fakeForm,
  formData,
  merchandiseQuantity: 1,
});
assert.deepEqual(plan.adjustments, [
  {
    id: 'filled_fee',
    variantId: 'gid://shopify/ProductVariant/222',
    quantity: 2,
    label: null,
  },
  {
    id: 'premium_finish',
    variantId: 'gid://shopify/ProductVariant/333',
    quantity: 1,
    label: null,
  },
]);

assert.deepEqual(productCommerce.collectLineProperties(formData), {
  _jill_profile: 'paid_product@1',
  _jill_product_options: JSON.stringify(productOptionsPayload),
  finish: 'premium',
});

const plainProfile = capabilities.resolve({version: 1, id: 'plain', fields: [], features: {}});
const plainPlan = productCommerce.buildPlan({
  profile: plainProfile,
  form: fakeForm,
  formData: new FormData(),
  merchandiseQuantity: 1,
});
assert.deepEqual(plainPlan, {version: 1, adjustments: []});

const missingProductOptionsForm = {querySelector() { return null; }};
assert.throws(
  () => productCommerce.buildPlan({
    profile,
    form: missingProductOptionsForm,
    formData,
    merchandiseQuantity: 1,
  }),
  /Product Options payload is unavailable/,
  'paid Product Options must fail closed when canonical payload is missing',
);
