import assert from 'node:assert/strict';

await import('../theme/assets/jill-product-capabilities.js');

const capabilities = globalThis.JILLProductCapabilities;
assert.ok(capabilities, 'JILLProductCapabilities must initialize');

const profile = {
  version: 1,
  id: 'pinata',
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
      id: 'name',
      kind: 'text',
      group: 'personalization',
      label: 'Name',
      required: false,
      maxLength: 12,
    },
    {
      id: 'event_date',
      kind: 'date',
      group: 'planning',
      label: 'Event date',
      required: true,
    },
    {
      id: 'fulfillment',
      kind: 'select',
      group: 'planning',
      label: 'Fulfillment',
      required: true,
      options: [
        {value: 'shipping', label: 'Shipping'},
        {value: 'pickup', label: 'Pickup'},
      ],
    },
    {
      id: 'references',
      kind: 'file',
      group: 'reference',
      label: 'Reference images',
      required: false,
      maxFiles: 3,
      accept: ['image/*'],
    },
  ],
  features: {
    personalizationAllocation: {
      enabled: true,
      allowedModes: ['same', 'different'],
      fieldIds: ['name'],
    },
    datePlanning: {
      enabled: true,
      fieldId: 'event_date',
      minimumLeadBusinessDays: 12,
      fulfillmentFieldId: 'fulfillment',
      appliesToFulfillmentValues: ['shipping'],
    },
    referenceUpload: {
      enabled: true,
      fieldId: 'references',
    },
  },
};

const resolved = capabilities.resolve(profile);
assert.equal(resolved.version, 1);
assert.equal(resolved.id, 'pinata');
assert.equal(resolved.fields.length, 6);
assert.equal(resolved.fieldsById.style.label, 'Piñata style');
assert.deepEqual(resolved.groups.product_options, ['style', 'pinata_number']);
assert.deepEqual(resolved.groups.personalization, ['name']);
assert.deepEqual(resolved.groups.planning, ['event_date', 'fulfillment']);
assert.deepEqual(resolved.groups.reference, ['references']);
assert.equal(capabilities.getField(resolved, 'event_date').kind, 'date');
assert.equal(capabilities.getField(resolved, 'missing'), null);
assert.deepEqual(
  capabilities.getFieldsForGroup(resolved, 'product_options').map((field) => field.id),
  ['style', 'pinata_number'],
);
assert.equal(capabilities.getCustomizationUnitsPerQuantity(resolved), 1);
assert.equal(Object.isFrozen(resolved), true);
assert.equal(Object.isFrozen(resolved.fields), true);
assert.equal(Object.isFrozen(resolved.fields[1].visibleWhen), true);
assert.equal(Object.isFrozen(profile), false, 'resolver must not freeze caller-owned profile');
assert.equal(Object.isFrozen(profile.fields[1].visibleWhen), false, 'resolver must not freeze nested caller data');

const packProfile = {
  version: 1,
  id: 'party_favor_pack',
  fields: [],
  features: {
    customizationUnits: {
      unitsPerQuantity: 12,
      singularLabel: 'bag',
      pluralLabel: 'bags',
    },
  },
};
const resolvedPack = capabilities.resolve(packProfile);
assert.equal(capabilities.getCustomizationUnitsPerQuantity(resolvedPack), 12);
assert.equal(resolvedPack.features.customizationUnits.singularLabel, 'bag');
assert.equal(Object.isFrozen(resolvedPack.features.customizationUnits), true);

const fromJson = capabilities.resolve(JSON.stringify(profile));
assert.equal(fromJson.id, 'pinata');
assert.deepEqual(fromJson.groups, resolved.groups);

assert.throws(
  () => capabilities.resolve({...profile, version: 2}),
  /unsupported profile version 2/,
);

assert.throws(
  () => capabilities.resolve({...profile, id: 'Piñata'}),
  /profile id must be a lowercase snake_case identifier/,
);

assert.throws(
  () => capabilities.resolve({...profile, fields: [...profile.fields, profile.fields[0]]}),
  /duplicate field id style/,
);

assert.throws(
  () =>
    capabilities.resolve({
      ...profile,
      fields: profile.fields.map((field) =>
        field.id === 'pinata_number'
          ? {
              ...field,
              visibleWhen: {
                mode: 'all',
                conditions: [{field: 'missing_field', operator: 'equals', value: 'x'}],
              },
            }
          : field,
      ),
    }),
  /references unknown field missing_field/,
);

assert.throws(
  () =>
    capabilities.resolve({
      version: 1,
      id: 'cycle',
      fields: [
        {
          id: 'alpha',
          kind: 'text',
          group: 'product_options',
          label: 'Alpha',
          required: true,
          visibleWhen: {
            mode: 'all',
            conditions: [{field: 'beta', operator: 'equals', value: 'yes'}],
          },
        },
        {
          id: 'beta',
          kind: 'text',
          group: 'product_options',
          label: 'Beta',
          required: true,
          visibleWhen: {
            mode: 'all',
            conditions: [{field: 'alpha', operator: 'equals', value: 'yes'}],
          },
        },
      ],
      features: {},
    }),
  /visibility dependency cycle/,
);

assert.throws(
  () =>
    capabilities.resolve({
      ...profile,
      features: {
        ...profile.features,
        personalizationAllocation: {
          ...profile.features.personalizationAllocation,
          fieldIds: ['style'],
        },
      },
    }),
  /must belong to personalization group/,
);

assert.throws(
  () =>
    capabilities.resolve({
      ...profile,
      features: {
        ...profile.features,
        datePlanning: {
          ...profile.features.datePlanning,
          fieldId: 'name',
        },
      },
    }),
  /must be a date field/,
);

assert.throws(
  () =>
    capabilities.resolve({
      ...profile,
      features: {
        ...profile.features,
        referenceUpload: {
          enabled: true,
          fieldId: 'name',
        },
      },
    }),
  /must be a file field/,
);

for (const unitsPerQuantity of [0, 1.5, 1001]) {
  assert.throws(
    () =>
      capabilities.resolve({
        ...packProfile,
        features: {
          customizationUnits: {
            unitsPerQuantity,
          },
        },
      }),
    /customizationUnits\.unitsPerQuantity must be an integer from 1 to 1000/,
  );
}

assert.throws(
  () =>
    capabilities.resolve({
      ...packProfile,
      features: {
        customizationUnits: {
          unitsPerQuantity: 12,
          singularLabel: '   ',
        },
      },
    }),
  /customizationUnits\.singularLabel must be a non-empty string up to 100 characters/,
);

assert.throws(
  () => capabilities.getFieldsForGroup(resolved, 'unknown'),
  /unsupported group unknown/,
);
