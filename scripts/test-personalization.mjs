import assert from 'node:assert/strict';

await import('../theme/assets/jill-product-capabilities.js');
await import('../theme/assets/jill-form-engine.js');
await import('../theme/assets/jill-personalization.js');

const capabilities = globalThis.JILLProductCapabilities;
const personalization = globalThis.JILLPersonalization;
assert.ok(personalization, 'JILLPersonalization must initialize');

const profile = capabilities.resolve({
  version: 1,
  id: 'personalized_pack',
  fields: [
    {
      id: 'name',
      kind: 'text',
      group: 'personalization',
      label: 'Name',
      required: true,
      maxLength: 12,
    },
    {
      id: 'age',
      kind: 'number',
      group: 'personalization',
      label: 'Age',
      required: false,
      min: 1,
      max: 9,
      step: 1,
    },
  ],
  features: {
    customizationUnits: {
      unitsPerQuantity: 12,
      singularLabel: 'bag',
      pluralLabel: 'bags',
    },
    personalizationAllocation: {
      enabled: true,
      allowedModes: ['same', 'different'],
      fieldIds: ['name', 'age'],
    },
  },
});

let state = personalization.createState({
  itemId: 'snack-bags',
  merchandiseQuantity: 1,
  profile,
});
assert.equal(state.available, true);
assert.equal(state.mode, 'same');
assert.equal(state.eligibleUnitCount, 12);
assert.equal(state.groups.length, 1);
assert.equal(state.groups[0].unitIds.length, 12);
assert.equal(state.complete, false);

state = personalization.setGroupValue(state, profile, 'group_1', 'name', 'Mia');
assert.equal(state.complete, true);
assert.equal(personalization.toPayload(state).allocations[0].unitIds.length, 12);

state = personalization.setMode(state, profile, 'different');
assert.equal(state.mode, 'different');
assert.equal(state.groups[0].unitIds.length, 12);
assert.equal(state.unallocatedUnitIds.length, 0);
assert.equal(state.complete, false, 'different mode needs at least two personalization groups');
assert.equal(state.firstIssue.reason, 'different_requires_multiple');

state = personalization.setGroupCount(state, profile, 'group_1', 6);
assert.equal(state.groups[0].unitIds.length, 6);
assert.equal(state.unallocatedUnitIds.length, 6);

state = personalization.addGroup(state, profile);
const secondId = state.groups[1].id;
state = personalization.setGroupCount(state, profile, secondId, 6);
state = personalization.setGroupValue(state, profile, secondId, 'name', 'Liam');
assert.equal(state.unallocatedUnitIds.length, 0);
assert.equal(state.complete, true);

const firstUnits = [...state.groups[0].unitIds];
state = personalization.createState({
  itemId: 'snack-bags',
  merchandiseQuantity: 2,
  profile,
  mode: state.mode,
  groups: state.groups,
  nextGroupNumber: state.nextGroupNumber,
});
assert.equal(state.eligibleUnitCount, 24);
assert.deepEqual(state.groups[0].unitIds, firstUnits);
assert.equal(state.unallocatedUnitIds.length, 12);
assert.equal(state.complete, false);

state = personalization.createState({
  itemId: 'snack-bags',
  merchandiseQuantity: 1,
  profile,
  mode: state.mode,
  groups: state.groups,
  nextGroupNumber: state.nextGroupNumber,
});
assert.equal(state.eligibleUnitCount, 12);
assert.equal(state.groups.flatMap((group) => group.unitIds).length, 12);
assert.equal(new Set(state.groups.flatMap((group) => group.unitIds)).size, 12);

const oneUnitProfile = capabilities.resolve({
  version: 1,
  id: 'single_item',
  fields: [{
    id: 'name',
    kind: 'text',
    group: 'personalization',
    label: 'Name',
    required: true,
  }],
  features: {
    personalizationAllocation: {
      enabled: true,
      allowedModes: ['same', 'different'],
      fieldIds: ['name'],
    },
  },
});
const single = personalization.createState({itemId: 'one', merchandiseQuantity: 1, profile: oneUnitProfile});
assert.deepEqual(single.allowedModes, ['same']);
assert.equal(single.groups[0].unitIds.length, 1);

const differentOnlyProfile = capabilities.resolve({
  version: 1,
  id: 'different_only',
  fields: [{
    id: 'name',
    kind: 'text',
    group: 'personalization',
    label: 'Name',
    required: true,
  }],
  features: {
    personalizationAllocation: {
      enabled: true,
      allowedModes: ['different'],
      fieldIds: ['name'],
    },
  },
});
const differentOnlySingle = personalization.createState({itemId: 'one', merchandiseQuantity: 1, profile: differentOnlyProfile});
assert.equal(differentOnlySingle.available, false, 'different-only personalization is unavailable for one eligible unit');

const dependentProfile = capabilities.resolve({
  version: 1,
  id: 'dependent_personalization',
  fields: [
    {
      id: 'include_age',
      kind: 'radio',
      group: 'personalization',
      label: 'Add age?',
      required: true,
      options: [
        {value: 'yes', label: 'Yes'},
        {value: 'no', label: 'No'},
      ],
    },
    {
      id: 'age',
      kind: 'number',
      group: 'personalization',
      label: 'Age',
      required: true,
      min: 1,
      max: 9,
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'include_age', operator: 'equals', value: 'yes'}],
      },
    },
  ],
  features: {
    personalizationAllocation: {
      enabled: true,
      allowedModes: ['same'],
      fieldIds: ['include_age', 'age'],
    },
  },
});
let dependent = personalization.createState({itemId: 'dependent', merchandiseQuantity: 1, profile: dependentProfile});
dependent = personalization.setGroupValue(dependent, dependentProfile, 'group_1', 'include_age', 'yes');
dependent = personalization.setGroupValue(dependent, dependentProfile, 'group_1', 'age', 5);
assert.equal(dependent.complete, true);
dependent = personalization.setGroupValue(dependent, dependentProfile, 'group_1', 'include_age', 'no');
assert.equal(dependent.groups[0].values.age, '', 'hidden dependent personalization value must be pruned');
assert.equal(dependent.complete, true);

const unavailable = personalization.createState({
  itemId: 'plain',
  merchandiseQuantity: 3,
  profile: capabilities.resolve({version: 1, id: 'plain', fields: [], features: {}}),
});
assert.equal(unavailable.available, false);
assert.equal(unavailable.complete, true);

assert.throws(
  () => personalization.setGroupCount(state, profile, 'missing', 1),
  /unknown group missing/,
);
assert.throws(
  () => personalization.setGroupValue(state, profile, state.groups[0].id, 'missing', 'x'),
  /field missing is not allocated personalization/,
);

console.log('JILL personalization tests passed.');
