import assert from 'node:assert/strict';

await import('../theme/assets/jill-commerce-cart.js');

const cart = globalThis.JILLCommerceCart;
assert.ok(cart, 'JILLCommerceCart must initialize');

const plan = {
  version: 1,
  adjustments: [
    {
      id: 'filled_handling',
      variantId: 'gid://shopify/ProductVariant/222',
      quantity: 9,
      label: 'Filled bags',
    },
    {
      id: 'other_sourcing',
      variantId: '333',
      quantity: 3,
      label: 'Other snack sourcing',
    },
  ],
};

const items = cart.buildItems({
  variantId: '111',
  quantity: 1,
  properties: {
    _jill_profile: 'jill_snack_bags_12@1',
    _jill_product_options: '{"complete":true}',
    theme: 'Space',
  },
  plan,
  operationId: 'operation-123',
});

assert.equal(items.length, 3);
assert.deepEqual(items[0], {
  id: '111',
  quantity: 1,
  properties: {
    _jill_profile: 'jill_snack_bags_12@1',
    _jill_product_options: '{"complete":true}',
    theme: 'Space',
    _jill_operation: 'operation-123',
    _jill_adjustment_plan: JSON.stringify({
      version: 1,
      adjustments: [
        {id: 'filled_handling', variantId: '222', quantity: 9},
        {id: 'other_sourcing', variantId: '333', quantity: 3},
      ],
    }),
  },
});
assert.deepEqual(items[1], {
  id: '222',
  quantity: 9,
  parent_id: '111',
  properties: {
    _jill_adjustment_id: 'filled_handling',
    _jill_parent_operation: 'operation-123',
  },
});
assert.deepEqual(items[2], {
  id: '333',
  quantity: 3,
  parent_id: '111',
  properties: {
    _jill_adjustment_id: 'other_sourcing',
    _jill_parent_operation: 'operation-123',
  },
});
assert.equal(Object.isFrozen(items), true);
assert.equal(Object.isFrozen(items[0].properties), true);

assert.throws(
  () => cart.buildItems({
    variantId: '111',
    quantity: 1,
    properties: {_jill_operation: 'forged'},
    plan,
    operationId: 'operation-123',
  }),
  /property _jill_operation is reserved/,
);

assert.throws(
  () => cart.buildItems({
    variantId: '111',
    quantity: 1,
    properties: {},
    plan: {
      version: 1,
      adjustments: [
        plan.adjustments[0],
        {...plan.adjustments[0], variantId: '444'},
      ],
    },
    operationId: 'operation-123',
  }),
  /duplicate adjustment id filled_handling/,
);

assert.throws(
  () => cart.buildItems({
    variantId: '111',
    quantity: 1,
    properties: {},
    plan: {
      version: 1,
      adjustments: [{id: 'circular', variantId: '111', quantity: 1}],
    },
    operationId: 'operation-123',
  }),
  /may not use the parent variant/,
);

const originalFetch = globalThis.fetch;
const originalShopify = globalThis.Shopify;
let capturedUrl = null;
let capturedOptions = null;

globalThis.Shopify = {routes: {root: '/en-us/'}};
globalThis.fetch = async (url, options) => {
  capturedUrl = url;
  capturedOptions = options;
  return {
    ok: true,
    status: 200,
    async json() {
      return {items: [{id: 111}, {id: 222}, {id: 333}]};
    },
  };
};

const response = await cart.add({
  variantId: '111',
  quantity: 1,
  properties: {_jill_profile: 'jill_snack_bags_12@1'},
  plan,
  operationId: 'operation-456',
});
assert.equal(capturedUrl, '/en-us/cart/add.js', 'Ajax cart transport must use Shopify locale-aware route root');
assert.equal(capturedOptions.method, 'POST');
assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
const request = JSON.parse(capturedOptions.body);
assert.equal(request.items.length, 3);
assert.equal(request.items[1].parent_id, '111');
assert.equal(request.items[1].properties._jill_parent_operation, 'operation-456');
assert.equal(response.items.length, 3);

globalThis.fetch = async () => ({
  ok: false,
  status: 422,
  async json() {
    return {description: 'Add-on is unavailable'};
  },
});
await assert.rejects(
  () => cart.add({
    variantId: '111',
    quantity: 1,
    properties: {},
    plan,
    operationId: 'operation-789',
  }),
  /Add-on is unavailable/,
);

globalThis.fetch = originalFetch;
if (originalShopify === undefined) delete globalThis.Shopify;
else globalThis.Shopify = originalShopify;
