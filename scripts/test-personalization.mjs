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
assert.equal(state.mode, null, 'multi-mode personalization must begin unresolved');
assert.equal(state.eligibleUnitCount, 12);
assert.equal(state.groups.length, 0);
assert.equal(state.unallocatedUnitIds.length, 12);
assert.equal(state.complete, false);
assert.equal(state.firstIssue.reason, 'required');

state = personalization.setMode(state, profile, 'same');
assert.equal(state.mode, 'same');
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
assert.equal(single.mode, 'same');
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

function resolvePartyPack(unitsPerQuantity, id) {
  return capabilities.resolve({
    version: 1,
    id,
    fields: [
      {
        id: 'add_name',
        kind: 'radio',
        group: 'personalization',
        label: 'Would you like to add a name or text?',
        required: true,
        options: [
          {value: 'yes', label: 'Yes'},
          {value: 'no', label: 'No'},
        ],
      },
      {
        id: 'name_text',
        kind: 'text',
        group: 'personalization',
        label: 'Name or text',
        required: true,
        maxLength: 12,
        visibleWhen: {
          mode: 'all',
          conditions: [{field: 'add_name', operator: 'equals', value: 'yes'}],
        },
      },
      {
        id: 'add_age',
        kind: 'radio',
        group: 'personalization',
        label: 'Would you like to add a number or age?',
        required: true,
        options: [
          {value: 'yes', label: 'Yes'},
          {value: 'no', label: 'No'},
        ],
      },
      {
        id: 'age_number',
        kind: 'number',
        group: 'personalization',
        label: 'Number or age',
        required: true,
        min: 1,
        max: 9,
        step: 1,
        visibleWhen: {
          mode: 'all',
          conditions: [{field: 'add_age', operator: 'equals', value: 'yes'}],
        },
      },
      {
        id: 'theme',
        kind: 'textarea',
        group: 'personalization',
        label: 'Tell us about your theme',
        required: true,
        maxLength: 500,
      },
      {
        id: 'colors',
        kind: 'text',
        group: 'personalization',
        label: 'Preferred colors',
        required: false,
        maxLength: 200,
      },
    ],
    features: {
      customizationUnits: {
        unitsPerQuantity,
        singularLabel: 'item',
        pluralLabel: 'items',
      },
      personalizationAllocation: {
        enabled: true,
        allowedModes: ['none', 'same', 'different'],
        fieldIds: ['add_name', 'name_text', 'add_age', 'age_number', 'theme', 'colors'],
      },
    },
  });
}

const partyPack12 = resolvePartyPack(12, 'party_pack_12');
let party = personalization.createState({itemId: 'party-pack', merchandiseQuantity: 1, profile: partyPack12});
assert.equal(party.mode, null, 'none/same/different must require an explicit mode choice');
assert.equal(party.eligibleUnitCount, 12);
assert.equal(party.groups.length, 0);
assert.equal(party.complete, false);

party = personalization.setMode(party, partyPack12, 'none');
assert.equal(party.complete, true);
assert.equal(party.groups.length, 0);
assert.deepEqual(personalization.toPayload(party), {complete: true, mode: 'none', allocations: []});

party = personalization.setMode(party, partyPack12, 'same');
assert.equal(party.groups[0].unitIds.length, 12);
assert.equal(party.complete, false);
party = personalization.setGroupValue(party, partyPack12, 'group_1', 'add_name', 'yes');
assert.equal(party.firstIssue.fieldId, 'name_text', 'Name/Text must become required only when Yes is active');
party = personalization.setGroupValue(party, partyPack12, 'group_1', 'name_text', 'Mia');
party = personalization.setGroupValue(party, partyPack12, 'group_1', 'add_age', 'yes');
assert.equal(party.firstIssue.fieldId, 'age_number', 'Number/Age must become required only when Yes is active');
party = personalization.setGroupValue(party, partyPack12, 'group_1', 'age_number', 5);
party = personalization.setGroupValue(party, partyPack12, 'group_1', 'theme', 'Princess');
party = personalization.setGroupValue(party, partyPack12, 'group_1', 'colors', 'Lavender and white');
assert.equal(party.complete, true);
assert.equal(personalization.toPayload(party).allocations[0].unitIds.length, 12);

party = personalization.setMode(party, partyPack12, 'different');
party = personalization.setGroupCount(party, partyPack12, 'group_1', 6);
party = personalization.addGroup(party, partyPack12);
const partySecondId = party.groups[1].id;
party = personalization.setGroupCount(party, partyPack12, partySecondId, 6);
party = personalization.setGroupValue(party, partyPack12, partySecondId, 'add_name', 'no');
party = personalization.setGroupValue(party, partyPack12, partySecondId, 'add_age', 'yes');
party = personalization.setGroupValue(party, partyPack12, partySecondId, 'age_number', 7);
party = personalization.setGroupValue(party, partyPack12, partySecondId, 'theme', 'Space');
party = personalization.setGroupValue(party, partyPack12, partySecondId, 'colors', 'Blue and silver');
assert.equal(party.complete, true);
assert.equal(party.unallocatedUnitIds.length, 0);
assert.equal(new Set(party.groups.flatMap((group) => group.unitIds)).size, 12);

party = personalization.setGroupValue(party, partyPack12, partySecondId, 'add_age', 'no');
assert.equal(
  party.groups.find((group) => group.id === partySecondId).values.age_number,
  '',
  'inactive party-pack Number/Age detail must be pruned from normalized personalization state',
);
assert.equal(party.complete, true);

const partyPayload = personalization.toPayload(party);
const secondPartyAllocation = partyPayload.allocations.find((allocation) => allocation.id === partySecondId);
assert.equal(secondPartyAllocation.values.age_number, '', 'inactive dependent detail must not contribute a stale value to payload');
assert.equal(secondPartyAllocation.values.name_text, '', 'inactive Name/Text detail must remain blank in payload');

party = personalization.setMode(party, partyPack12, 'none');
assert.equal(party.groups.length, 0, 'No personalization must clear inactive group state');
party = personalization.setMode(party, partyPack12, 'same');
assert.equal(party.groups[0].values.name_text, '', 'returning from No personalization must not restore stale hidden values');
assert.equal(party.complete, false);

const partyPack8 = resolvePartyPack(8, 'party_pack_8');
let activityKit = personalization.createState({itemId: 'activity-kit', merchandiseQuantity: 2, profile: partyPack8});
assert.equal(activityKit.mode, null);
activityKit = personalization.setMode(activityKit, partyPack8, 'same');
assert.equal(activityKit.eligibleUnitCount, 16, '8-count products must derive physical personalization units from capability data');
assert.equal(activityKit.groups[0].unitIds.length, 16);

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
