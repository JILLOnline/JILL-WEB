import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../theme/assets/jill-quantity.js');

const quantity = globalThis.JILLQuantity;
assert.ok(quantity, 'JILLQuantity must initialize');

assert.equal(
  quantity.stepValue({value: 1, min: 1, max: 12, step: 1, direction: -1}),
  1,
  'decrement must clamp at min',
);
assert.equal(
  quantity.stepValue({value: 11, min: 1, max: 12, step: 1, direction: 1}),
  12,
  'increment must reach max',
);
assert.equal(
  quantity.stepValue({value: 12, min: 1, max: 12, step: 1, direction: 1}),
  12,
  'increment must clamp at max',
);
assert.equal(
  quantity.stepValue({value: '', min: 1, max: 12, step: 1, direction: 1}),
  1,
  'an empty value must recover to min instead of skipping it',
);
assert.equal(
  quantity.stepValue({value: 2, min: 0, max: 10, step: 2, direction: 1}),
  4,
  'integer step sizes must be respected',
);
assert.throws(
  () => quantity.stepValue({value: 1, min: 1, max: 12, step: 0, direction: 1}),
  /positive integer/,
);
assert.throws(
  () => quantity.stepValue({value: 1, min: 12, max: 1, step: 1, direction: 1}),
  /max must be greater/,
);

const quantityMarkup = fs.readFileSync('theme/snippets/ui-quantity.liquid', 'utf8');
assert.match(quantityMarkup, /data-jill-quantity-action="decrement"/);
assert.match(quantityMarkup, /data-jill-quantity-action="increment"/);
assert.match(quantityMarkup, /data-jill-quantity-input/);
assert.match(quantityMarkup, /tabindex="-1"/);

const productSource = fs.readFileSync('theme/assets/jill-product.js', 'utf8');
assert.match(
  productSource,
  /globalThis\.JILLQuantity\.configure/,
  'allocated Product Options counts must consume the canonical quantity behavior owner',
);
const allocationFactory = productSource.match(
  /function createAllocationCountField\([\s\S]*?\n    function createAllocationSelect/,
)?.[0] || '';
assert.ok(allocationFactory, 'allocation count renderer must exist');
assert.doesNotMatch(
  allocationFactory,
  /document\.createElement\(['"]input['"]\)/,
  'allocation counts must not hand-build a second numeric input primitive',
);

console.log('JILL quantity stepper tests passed.');
