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

const pinataProfile = capabilities.resolve({
  version: 1,
  id: 'pinata_options',
  fields: [
    {
      id: 'style',
      kind: 'select',
      group: 'product_options',
      label: 'Piñata style',
      required: true,
      options: [
        {value: 'number', label: 'Number'},
        {value: 'shape', label: 'Shape'},
      ],
    },
    {
      id: 'pinata_number',
      kind: 'number',
      group: 'product_options',
      label: 'Number',
      required: true,
      min: 1,
      max: 9,
      step: 1,
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'style', operator: 'equals', value: 'number'}],
      },
    },
    {
      id: 'shape_details',
      kind: 'text',
      group: 'product_options',
      label: 'Shape details',
      required: true,
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'style', operator: 'equals', value: 'shape'}],
      },
    },
    {
      id: 'opening',
      kind: 'select',
      group: 'product_options',
      label: 'Opening',
      required: true,
      options: [
        {value: 'break', label: 'Traditional break'},
        {value: 'pull_string', label: 'Pull-string'},
      ],
    },
  ],
  features: {},
});

let pinata = productOptions.createState({
  itemId: 'product:pinata',
  merchandiseQuantity: 1,
  profile: pinataProfile,
});
assert.equal(pinata.complete, false);
assert.equal(pinata.eligibleUnitCount, 1);
assert.deepEqual(pinata.allocation.eligibleUnitIds, []);
assert.deepEqual(pinata.firstIssue, {scope: 'singleton', reason: 'field', fieldId: 'style'});

pinata = productOptions.setSingletonValue(pinata, pinataProfile, 'opening', 'pull_string');
pinata = productOptions.setSingletonValue(pinata, pinataProfile, 'style', 'number');
assert.equal(pinata.singleton.values.opening, 'pull_string', 'unrelated completed option must remain stable');
assert.equal(pinata.firstIssue.fieldId, 'pinata_number');

pinata = productOptions.setSingletonValue(pinata, pinataProfile, 'pinata_number', '3');
assert.equal(pinata.complete, true);

pinata = productOptions.setSingletonValue(pinata, pinataProfile, 'style', 'shape');
assert.equal(pinata.complete, false);
assert.equal(pinata.singleton.values.pinata_number, undefined, 'unavailable dependent value must be pruned');
assert.equal(pinata.singleton.values.opening, 'pull_string', 'unrelated option must survive dependency regression');
assert.equal(pinata.firstIssue.fieldId, 'shape_details');

pinata = productOptions.setSingletonValue(pinata, pinataProfile, 'shape_details', 'star');
assert.equal(pinata.complete, true);
assert.equal(productOptions.toPayload(pinata).values.shape_details, 'star');

pinata = productOptions.setSingletonValue(pinata, pinataProfile, 'style', 'number');
assert.equal(pinata.singleton.values.shape_details, undefined, 'stale hidden values may not return as completion state');
assert.equal(pinata.singleton.values.pinata_number, undefined, 'previous number must not reappear after scope changed away');
assert.equal(pinata.firstIssue.fieldId, 'pinata_number');

const packProfile = capabilities.resolve({
  version: 1,
  id: 'snack_options',
  fields: [
    {
      id: 'package_style',
      kind: 'select',
      group: 'product_options',
      label: 'Package style',
      required: true,
      options: [
        {value: 'standard', label: 'Standard'},
        {value: 'premium', label: 'Premium'},
      ],
    },
    {
      id: 'flavor',
      kind: 'select',
      group: 'product_options',
      label: 'Flavor',
      required: true,
      options: [
        {value: 'chips', label: 'Chips'},
        {value: 'gummies', label: 'Gummies'},
      ],
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'package_style', operator: 'equals', value: 'standard'}],
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
      fieldIds: ['flavor'],
    },
  },
});

let pack = productOptions.createState({
  itemId: 'product:snacks',
  merchandiseQuantity: 1,
  profile: packProfile,
});
assert.equal(pack.eligibleUnitCount, 12);
assert.equal(pack.allocation.enabled, true);
assert.equal(pack.allocation.available, false, 'allocation must wait for its valid dependency');
assert.equal(pack.complete, false);

pack = productOptions.setSingletonValue(pack, packProfile, 'package_style', 'premium');
assert.equal(pack.complete, true, 'irrelevant allocated option must not block completion');
assert.equal(pack.allocation.available, false);
assert.deepEqual(pack.allocation.groups, []);

pack = productOptions.setSingletonValue(pack, packProfile, 'package_style', 'standard');
assert.equal(pack.complete, false);
assert.equal(pack.allocation.available, true);
assert.equal(pack.allocation.eligibleUnitIds.length, 12);
assert.equal(pack.allocation.unallocatedUnitIds.length, 12);
assert.deepEqual(pack.firstIssue, {scope: 'allocation', reason: 'unallocated'});
assert.equal(pack.allocation.eligibleUnitIds[0], 'product:snacks::1');
assert.equal(pack.allocation.eligibleUnitIds[11], 'product:snacks::12');

pack = productOptions.addAllocationGroup(pack, packProfile);
assert.equal(pack.allocation.groups[0].id, 'group_1');
assert.deepEqual(pack.firstIssue, {scope: 'allocation_group', reason: 'units', groupId: 'group_1'});

pack = productOptions.setAllocationGroupCount(pack, packProfile, 'group_1', 12);
assert.equal(pack.allocation.groups[0].unitIds.length, 12);
assert.equal(pack.allocation.unallocatedUnitIds.length, 0);
assert.deepEqual(pack.firstIssue, {
  scope: 'allocation_group',
  reason: 'field',
  groupId: 'group_1',
  fieldId: 'flavor',
});

pack = productOptions.setAllocationGroupCount(pack, packProfile, 'group_1', 6);
const firstSix = [...pack.allocation.groups[0].unitIds];
assert.deepEqual(firstSix, [
  'product:snacks::1',
  'product:snacks::2',
  'product:snacks::3',
  'product:snacks::4',
  'product:snacks::5',
  'product:snacks::6',
]);
assert.equal(pack.allocation.unallocatedUnitIds.length, 6);

pack = productOptions.setAllocationGroupValue(pack, packProfile, 'group_1', 'flavor', 'chips');
assert.equal(pack.allocation.groups[0].complete, true);
assert.deepEqual(pack.firstIssue, {scope: 'allocation', reason: 'unallocated'});

pack = productOptions.addAllocationGroup(pack, packProfile);
pack = productOptions.setAllocationGroupCount(pack, packProfile, 'group_2', 6);
pack = productOptions.setAllocationGroupValue(pack, packProfile, 'group_2', 'flavor', 'gummies');
assert.equal(pack.complete, true);
assert.equal(pack.allocation.unallocatedUnitIds.length, 0);
assert.deepEqual(pack.allocation.groups.map((group) => group.id), ['group_1', 'group_2']);
assert.deepEqual(pack.allocation.groups[1].unitIds, [
  'product:snacks::7',
  'product:snacks::8',
  'product:snacks::9',
  'product:snacks::10',
  'product:snacks::11',
  'product:snacks::12',
]);

assert.throws(
  () => productOptions.setAllocationGroupUnits(pack, packProfile, 'group_2', ['product:snacks::1']),
  /unit product:snacks::1 is not available to group group_2/,
  'one customization unit may not be stolen from another group',
);

assert.throws(
  () => productOptions.setAllocationGroupCount(pack, packProfile, 'group_1', 0),
  /allocation group count must be a positive safe integer/,
);
assert.throws(
  () => productOptions.setAllocationGroupCount(pack, packProfile, 'group_1', 7),
  /allocation group group_1 count may not exceed 6/,
  'a group count cannot claim units already owned by another group',
);

const completePayload = productOptions.toPayload(pack);
assert.equal(completePayload.version, 1);
assert.equal(completePayload.itemId, 'product:snacks');
assert.equal(completePayload.merchandiseQuantity, 1);
assert.equal(completePayload.unitsPerQuantity, 12);
assert.equal(completePayload.complete, true);
assert.deepEqual(completePayload.values, {package_style: 'standard'});
assert.deepEqual(completePayload.allocations[0].values, {flavor: 'chips'});
assert.equal(Object.isFrozen(completePayload), true);
assert.equal(Object.isFrozen(completePayload.allocations), true);

pack = productOptions.reconcile(pack, packProfile, 2);
assert.equal(pack.eligibleUnitCount, 24);
assert.equal(pack.allocation.eligibleUnitIds.length, 24);
assert.equal(pack.allocation.unallocatedUnitIds.length, 12);
assert.deepEqual(pack.allocation.groups[0].unitIds, firstSix, 'existing stable units must survive quantity increase');
assert.equal(pack.allocation.groups[0].values.flavor, 'chips');
assert.equal(pack.allocation.groups[1].values.flavor, 'gummies');
assert.equal(pack.complete, false);

pack = productOptions.setAllocationGroupCount(pack, packProfile, 'group_2', 18);
assert.equal(pack.complete, true);
assert.equal(pack.allocation.groups[1].unitIds.length, 18);
assert.equal(pack.allocation.groups[1].unitIds[17], 'product:snacks::24');

pack = productOptions.reconcile(pack, packProfile, 1);
assert.equal(pack.eligibleUnitCount, 12);
assert.deepEqual(pack.allocation.groups[0].unitIds, firstSix);
assert.deepEqual(
  pack.allocation.groups[1].unitIds,
  ['product:snacks::7', 'product:snacks::8', 'product:snacks::9', 'product:snacks::10', 'product:snacks::11', 'product:snacks::12'],
  'quantity reduction must deterministically prune only removed units',
);
assert.equal(pack.allocation.groups[1].values.flavor, 'gummies');
assert.equal(pack.complete, true);

pack = productOptions.removeAllocationGroup(pack, packProfile, 'group_2');
assert.equal(pack.complete, false);
assert.equal(pack.allocation.unallocatedUnitIds.length, 6);
assert.deepEqual(pack.allocation.groups.map((group) => group.id), ['group_1']);

pack = productOptions.reconcile(pack, packProfile, 0);
assert.equal(pack.eligibleUnitCount, 0);
assert.deepEqual(pack.allocation.groups, []);
assert.deepEqual(pack.allocation.unallocatedUnitIds, []);
assert.equal(pack.complete, true, 'zero selected merchandise leaves no Product Options allocation work');

pack = productOptions.reconcile(pack, packProfile, 1);
assert.equal(pack.allocation.unallocatedUnitIds.length, 12);
assert.equal(pack.complete, false, 'restoring quantity creates fresh unallocated units rather than stale groups');

assert.throws(
  () => productOptions.reconcile(pack, packProfile, 834),
  /eligible customization-unit count may not exceed 10000 for allocation/,
);

assert.throws(
  () => productOptions.setSingletonValue(pack, packProfile, 'flavor', 'chips'),
  /field flavor is not a singleton Product Options field/,
);

assert.throws(
  () => productOptions.setAllocationGroupValue(pack, packProfile, 'missing', 'flavor', 'chips'),
  /unknown allocation group missing/,
);

const noOptionsProfile = capabilities.resolve({
  version: 1,
  id: 'plain_product',
  fields: [],
  features: {},
});
const plain = productOptions.createState({
  itemId: 'product:plain',
  merchandiseQuantity: 3,
  profile: noOptionsProfile,
});
assert.equal(plain.complete, true);
assert.equal(plain.eligibleUnitCount, 3);
assert.equal(plain.allocation.enabled, false);
assert.deepEqual(productOptions.toPayload(plain).allocations, []);
