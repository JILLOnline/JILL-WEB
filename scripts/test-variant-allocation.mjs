import assert from 'node:assert/strict';

await import('../theme/assets/jill-variant-allocation.js');
const allocator = globalThis.JILLVariantAllocation;
const variants = [
  {id: 'v1', title: 'White / S', available: true},
  {id: 'v2', title: 'Pink / M', available: true},
  {id: 'v3', title: 'Black / L', available: true},
  {id: 'v4', title: 'Sold out', available: false},
];

assert.ok(allocator, 'JILLVariantAllocation must initialize');
let state = allocator.createState({itemId: 'shopify-product:123', merchandiseQuantity: 5, variants});
assert.equal(state.complete, true);
assert.equal(state.groups.length, 1);
assert.equal(state.groups[0].variantId, 'v1');
assert.deepEqual(state.groups[0].unitIds, [
  'shopify-product:123::1',
  'shopify-product:123::2',
  'shopify-product:123::3',
  'shopify-product:123::4',
  'shopify-product:123::5',
]);
assert.equal(allocator.canAddGroup(state), false);

state = allocator.setGroupCount(state, 'group_1', 2);
assert.equal(state.complete, false);
assert.equal(state.unallocatedUnitIds.length, 3);
assert.equal(allocator.canAddGroup(state), true);
state = allocator.addGroup(state);
assert.equal(state.complete, true);
assert.equal(state.groups[1].variantId, 'v2');
assert.deepEqual(state.groups[1].unitIds, [
  'shopify-product:123::3',
  'shopify-product:123::4',
  'shopify-product:123::5',
]);
assert.deepEqual(
  allocator.getAvailableVariants(state, 'group_2').map((variant) => variant.id),
  ['v2', 'v3'],
);
assert.throws(() => allocator.setGroupVariant(state, 'group_2', 'v1'), /unavailable/);
assert.throws(() => allocator.setGroupVariant(state, 'group_2', 'v4'), /unavailable/);

state = allocator.setGroupCount(state, 'group_2', 1);
assert.equal(state.unallocatedUnitIds.length, 2);
state = allocator.addGroup(state);
assert.equal(state.groups[2].variantId, 'v3');
assert.equal(state.groups[2].quantity, 2);
assert.equal(state.complete, true);
const payload = allocator.toPayload(state);
assert.equal(payload.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0), 5);
assert.equal(new Set(payload.allocations.flatMap((allocation) => allocation.unitIds)).size, 5);

state = allocator.reconcileQuantity(state, 3);
assert.equal(state.complete, true);
assert.deepEqual(state.groups.map((group) => [group.variantId, group.quantity]), [['v1', 2], ['v2', 1]]);
state = allocator.reconcileQuantity(state, 6);
assert.equal(state.complete, false);
assert.equal(state.unallocatedUnitIds.length, 3);
assert.equal(allocator.canAddGroup(state), true);
state = allocator.addGroup(state);
assert.equal(state.complete, true);
assert.equal(state.groups[2].variantId, 'v3');
assert.equal(state.groups[2].quantity, 3);

let single = allocator.createState({itemId: 'shopify-product:solo', merchandiseQuantity: 1, variants});
single = allocator.reconcileQuantity(single, 4);
assert.equal(single.complete, true, 'a complete single-variation order should grow with the same variation');
assert.equal(single.groups[0].quantity, 4);

assert.throws(
  () => allocator.createState({itemId: 'x', merchandiseQuantity: 1, variants: [{id: 'z', title: 'Z', available: false}]}),
  /at least one variant/,
);

console.log('JILL variant allocation tests passed.');
