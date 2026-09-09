import assert from 'node:assert/strict';

await import('../theme/assets/jill-form-engine.js');
await import('../theme/assets/jill-product-capabilities.js');
await import('../theme/assets/jill-product-options.js');

const formEngine = globalThis.JILLFormEngine;
const capabilities = globalThis.JILLProductCapabilities;
const productOptions = globalThis.JILLProductOptions;

assert.ok(formEngine, 'JILLFormEngine must initialize');
assert.ok(capabilities, 'JILLProductCapabilities must initialize');
assert.ok(productOptions, 'JILLProductOptions must initialize');

const profile = capabilities.resolve({
  version: 1,
  id: 'conditional_product_option_detail',
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
        {value: 'lays', label: 'Lay’s Classic'},
        {value: 'other', label: 'Other'},
      ],
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'fill_state', operator: 'equals', value: 'filled'}],
      },
    },
    {
      id: 'other_snack_detail',
      kind: 'text',
      group: 'product_options',
      label: 'Which snack would you like?',
      required: true,
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'snack_choice', operator: 'equals', value: 'other'}],
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
      fieldIds: ['fill_state', 'snack_choice', 'other_snack_detail'],
    },
  },
});

assert.deepEqual(
  capabilities.getProductOptionsAllocationFieldIds(profile),
  ['fill_state', 'snack_choice', 'other_snack_detail'],
);
assert.deepEqual(
  capabilities.getProductOptionsAllocationChoiceFieldIds(profile),
  ['fill_state', 'snack_choice'],
  'conditional free-text detail must not become allocation combination identity',
);
assert.equal(Object.isFrozen(capabilities.getProductOptionsAllocationChoiceFieldIds(profile)), true);

let state = productOptions.createState({
  itemId: 'product:conditional-detail',
  merchandiseQuantity: 1,
  profile,
});
state = productOptions.addAllocationGroup(state, profile);
state = productOptions.setAllocationGroupCount(state, profile, 'group_1', 12);
state = productOptions.setAllocationGroupValue(state, profile, 'group_1', 'fill_state', 'filled');

let group = state.allocation.groups[0];
let detailResult = group.results.find((result) => result.id === 'other_snack_detail');
assert.equal(detailResult.available, false, 'detail is unavailable until its selector chooses Other');
assert.equal(group.values.other_snack_detail, undefined);

state = productOptions.setAllocationGroupValue(state, profile, 'group_1', 'snack_choice', 'other');
group = state.allocation.groups[0];
detailResult = group.results.find((result) => result.id === 'other_snack_detail');
assert.equal(detailResult.available, true);
assert.equal(detailResult.required, true);
assert.equal(detailResult.valid, false);
assert.equal(detailResult.reason, 'required');
assert.equal(state.complete, false, 'blank active Other detail must block Product Options completion');
assert.deepEqual(state.firstIssue, {
  scope: 'allocation_group',
  reason: 'field',
  groupId: 'group_1',
  fieldId: 'other_snack_detail',
});
assert.equal(group.values.other_snack_detail, undefined, 'blank detail must not enter canonical group values');

let payload = productOptions.toPayload(state);
assert.equal(payload.complete, false);
assert.deepEqual(payload.allocations[0].values, {
  fill_state: 'filled',
  snack_choice: 'other',
});
const otherSignature = group.signature;
assert.ok(otherSignature, 'completed selector identity must reserve the Other combination while detail is blank');

state = productOptions.setAllocationGroupValue(
  state,
  profile,
  'group_1',
  'other_snack_detail',
  'Pretzels',
);
group = state.allocation.groups[0];
assert.equal(state.complete, true, 'valid active detail must complete Product Options');
assert.equal(group.signature, otherSignature, 'free-text detail must never change option-combination identity');
payload = productOptions.toPayload(state);
assert.equal(payload.allocations[0].values.other_snack_detail, 'Pretzels');

state = productOptions.setAllocationGroupValue(state, profile, 'group_1', 'snack_choice', 'lays');
group = state.allocation.groups[0];
detailResult = group.results.find((result) => result.id === 'other_snack_detail');
assert.equal(detailResult.available, false, 'detail must become unavailable immediately when Other is deselected');
assert.equal(group.values.other_snack_detail, undefined, 'stale hidden detail must be pruned from canonical state');
assert.equal(state.complete, true);
payload = productOptions.toPayload(state);
assert.equal(payload.allocations[0].values.other_snack_detail, undefined, 'stale hidden detail must not enter normalized payload');

state = productOptions.setAllocationGroupValue(state, profile, 'group_1', 'snack_choice', 'other');
group = state.allocation.groups[0];
detailResult = group.results.find((result) => result.id === 'other_snack_detail');
assert.equal(detailResult.available, true);
assert.equal(detailResult.valid, false);
assert.equal(group.values.other_snack_detail, undefined, 'clear-on-deactivate is the canonical dependency policy');
assert.equal(state.complete, false, 'returning to Other requires fresh detail after the dependency was deactivated');

assert.throws(
  () => productOptions.getAvailableAllocationFieldOptions(state, profile, 'group_1', 'other_snack_detail'),
  /not an allocated Product Options choice field/,
  'detail fields may not be treated as enumerated combination choices',
);

let uniqueness = productOptions.createState({
  itemId: 'product:conditional-detail-uniqueness',
  merchandiseQuantity: 1,
  profile,
});
uniqueness = productOptions.addAllocationGroup(uniqueness, profile);
uniqueness = productOptions.setAllocationGroupCount(uniqueness, profile, 'group_1', 6);
uniqueness = productOptions.setAllocationGroupValue(uniqueness, profile, 'group_1', 'fill_state', 'filled');
uniqueness = productOptions.setAllocationGroupValue(uniqueness, profile, 'group_1', 'snack_choice', 'other');
assert.equal(uniqueness.allocation.groups[0].complete, false, 'first Other group remains incomplete until detail is supplied');
assert.equal(productOptions.canAddAllocationGroup(uniqueness, profile), true, 'unused selector combinations may still create another group');

uniqueness = productOptions.addAllocationGroup(uniqueness, profile);
uniqueness = productOptions.setAllocationGroupCount(uniqueness, profile, 'group_2', 6);
uniqueness = productOptions.setAllocationGroupValue(uniqueness, profile, 'group_2', 'fill_state', 'filled');
assert.deepEqual(
  productOptions.getAvailableAllocationFieldOptions(uniqueness, profile, 'group_2', 'snack_choice').map((option) => option.value),
  ['lays'],
  'an Other selector combination is reserved even while its required detail is still blank',
);

assert.throws(
  () => capabilities.resolve({
    version: 1,
    id: 'non_leaf_allocated_detail',
    fields: [
      {
        id: 'choice',
        kind: 'select',
        group: 'product_options',
        label: 'Choice',
        required: true,
        options: [{value: 'other', label: 'Other'}],
      },
      {
        id: 'detail',
        kind: 'text',
        group: 'product_options',
        label: 'Detail',
        required: true,
        visibleWhen: {
          mode: 'all',
          conditions: [{field: 'choice', operator: 'equals', value: 'other'}],
        },
      },
      {
        id: 'downstream',
        kind: 'text',
        group: 'product_options',
        label: 'Downstream',
        required: false,
        visibleWhen: {
          mode: 'all',
          conditions: [{field: 'detail', operator: 'equals', value: 'x'}],
        },
      },
    ],
    features: {
      productOptionsAllocation: {fieldIds: ['choice', 'detail']},
    },
  }),
  /detail field detail must be a leaf dependency/,
  'allocated free-text detail fields stay leaf-only so typing never owns downstream progression',
);

console.log('JILL conditional Product Options detail tests passed.');
