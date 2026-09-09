import assert from 'node:assert/strict';

await import('../theme/assets/jill-product-surface.js');

const surface = globalThis.JILLProductSurface;
assert.ok(surface, 'JILLProductSurface must initialize');

const profile = {
  version: 1,
  id: 'pinata_18',
  fields: [
    {
      id: 'pinata_style',
      kind: 'select',
      group: 'product_options',
      label: 'Piñata style',
      required: true,
      options: [
        {value: 'number', label: 'Number'},
        {value: 'shape', label: 'Shape'},
        {value: 'character', label: 'Character'},
      ],
    },
    {
      id: 'pinata_number',
      kind: 'select',
      group: 'product_options',
      label: 'Number',
      required: true,
      options: [{value: '1', label: '1'}],
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'pinata_style', operator: 'equals', value: 'number'}],
      },
    },
    {
      id: 'shape_details',
      kind: 'textarea',
      group: 'product_options',
      label: 'Describe the shape',
      required: true,
      visibleWhen: {
        mode: 'all',
        conditions: [{field: 'pinata_style', operator: 'equals', value: 'shape'}],
      },
    },
    {
      id: 'opening_style',
      kind: 'select',
      group: 'product_options',
      label: 'How should it open?',
      required: true,
      options: [{value: 'traditional', label: 'Traditional break'}],
    },
  ],
  features: {},
};

const productPageOverride = {
  excludeFieldIds: ['pinata_style', 'shape_details'],
  alwaysAvailableFieldIds: ['pinata_number'],
};

const projected = surface.project(profile, productPageOverride);
assert.deepEqual(projected.fields.map((field) => field.id), ['pinata_number', 'opening_style']);
assert.equal(projected.fields[0].visibleWhen, undefined);
assert.ok(profile.fields[1].visibleWhen, 'surface projection must not mutate the canonical profile');

const fromJson = surface.project(JSON.stringify(profile), JSON.stringify(productPageOverride));
assert.deepEqual(fromJson, projected);

assert.throws(
  () => surface.project(profile, {excludeFieldIds: ['missing']}),
  /references unknown field missing/,
);

assert.throws(
  () => surface.project(profile, {excludeFieldIds: ['pinata_style'], alwaysAvailableFieldIds: ['pinata_style']}),
  /cannot be both excluded and always available/,
);

assert.throws(
  () => surface.project(profile, {excludeFieldIds: ['pinata_style']}),
  /retained field pinata_number depends on excluded field pinata_style/,
);

assert.throws(
  () => surface.project(profile, {excludeFieldIds: ['pinata_style', 'pinata_style']}),
  /contains duplicate field pinata_style/,
);

assert.throws(
  () => surface.project(profile, {unexpected: true}),
  /unsupported property unexpected/,
);

console.log('JILL product surface tests passed.');
