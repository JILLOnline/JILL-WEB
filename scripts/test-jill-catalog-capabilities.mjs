import assert from 'node:assert/strict';

await import('../theme/assets/jill-product-capabilities.js');
const capabilities = globalThis.JILLProductCapabilities;
assert.ok(capabilities, 'JILLProductCapabilities must initialize');

const {JILL_CATALOG_CAPABILITIES} = await import('../merchant/jill-catalog-capabilities.mjs');

assert.equal(JILL_CATALOG_CAPABILITIES.length, 15, 'JILL merchant capability manifest must cover the full active catalog');

const productIds = new Set();
const handles = new Set();
const profileIds = new Set();

for (const entry of JILL_CATALOG_CAPABILITIES) {
  assert.match(entry.productId, /^gid:\/\/shopify\/Product\/[1-9][0-9]*$/, `${entry.handle} must reference a Shopify Product GID`);
  assert.ok(entry.handle, 'every merchant capability entry needs a product handle');
  assert.ok(entry.title, 'every merchant capability entry needs an audit title');
  assert.equal(productIds.has(entry.productId), false, `duplicate product id ${entry.productId}`);
  assert.equal(handles.has(entry.handle), false, `duplicate product handle ${entry.handle}`);
  productIds.add(entry.productId);
  handles.add(entry.handle);

  const resolved = capabilities.resolve(entry.profile);
  assert.equal(profileIds.has(resolved.id), false, `duplicate profile id ${resolved.id}`);
  profileIds.add(resolved.id);

  const age = resolved.fieldsById.age_number;
  if (age) {
    assert.equal(age.kind, 'select', `${entry.handle} Number or age must stay a dropdown`);
    assert.deepEqual(age.options.map((option) => option.value), ['1','2','3','4','5','6','7','8','9']);
  }

  const pinataNumber = resolved.fieldsById.pinata_number;
  if (pinataNumber) {
    assert.equal(pinataNumber.kind, 'select', `${entry.handle} piñata number must stay a dropdown`);
    assert.deepEqual(pinataNumber.options.map((option) => option.value), ['1','2','3','4','5','6','7','8','9']);
  }

  const reference = resolved.fieldsById.reference_images;
  assert.ok(reference, `${entry.handle} must declare its reference-image policy explicitly`);
  assert.equal(reference.kind, 'file');
  assert.equal(reference.maxFiles, 3);
  assert.deepEqual(reference.accept, ['image/*']);
  assert.equal(resolved.features.referenceUpload?.fieldId, 'reference_images');
}

for (const handle of [
  'custom-dtf-crewneck-fleece-for-your-crew-48791',
  'custom-dtf-hoodie-for-your-crew-21083',
  'custom-dtf-t-shirts-for-your-crew-67138',
]) {
  const entry = JILL_CATALOG_CAPABILITIES.find((candidate) => candidate.handle === handle);
  const resolved = capabilities.resolve(entry.profile);
  assert.deepEqual(
    resolved.fieldsById.print_method.options.map((option) => option.value),
    ['dtf', 'sublimation', 'vinyl'],
    `${handle} must expose the configured apparel print methods without duplicating Shopify size/color`,
  );
}

for (const handle of [
  'custom-coffee-mug-photo-sublimation-74734',
  'tote-bag-vinyl-transfer-custom',
]) {
  const entry = JILL_CATALOG_CAPABILITIES.find((candidate) => candidate.handle === handle);
  const resolved = capabilities.resolve(entry.profile);
  assert.equal(resolved.fieldsById.print_method, undefined, `${handle} must not duplicate a Shopify-owned or fixed print method`);
}

const snack = capabilities.resolve(
  JILL_CATALOG_CAPABILITIES.find((entry) => entry.handle === 'party-favors-snack-bags-custom-theme-99329').profile,
);
assert.deepEqual(
  capabilities.getProductOptionsAllocationChoiceFieldIds(snack),
  ['fill_state', 'snack_choice'],
  'Snack Bag free-text Other detail must not own combination identity',
);
assert.deepEqual(
  capabilities.getProductOptionsAllocationFieldIds(snack),
  ['fill_state', 'snack_choice', 'other_snack_detail'],
);

const round = capabilities.resolve(
  JILL_CATALOG_CAPABILITIES.find((entry) => entry.handle === 'pinata-custom-theme-13-inches-round-96685').profile,
);
assert.equal(round.fieldsById.pinata_style, undefined, '13-inch round product identity must not ask for a second shape/style identity');
assert.ok(round.fieldsById.opening_style);
assert.ok(round.fieldsById.age_number);

for (const handle of [
  'pinata-custom-theme-all-ages-18-71638',
  'pinata-with-stick-custom-theme-all-87524',
  'pinata-custom-theme-includes-stick-76338',
]) {
  const entry = JILL_CATALOG_CAPABILITIES.find((candidate) => candidate.handle === handle);
  const resolved = capabilities.resolve(entry.profile);
  assert.ok(resolved.fieldsById.pinata_style, `${handle} must use the generalized Piñata style workflow`);
  assert.ok(resolved.fieldsById.opening_style);
}

console.log('JILL catalog capability manifest tests passed.');
