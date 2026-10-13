(() => {
  'use strict';

  const RESERVED_PARENT_PROPERTIES = new Set(['_jill_operation', '_jill_adjustment_plan']);

  function fail(message) {
    throw new Error(`JILL commerce cart: ${message}`);
  }

  function numericVariantId(value, label) {
    const normalized = String(value || '').replace(/^gid:\/\/shopify\/ProductVariant\//, '');
    if (!/^[1-9][0-9]*$/.test(normalized)) fail(`${label} must be a Shopify ProductVariant id`);
    return normalized;
  }

  function assertPositiveQuantity(quantity, label) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) fail(`${label} must be a positive safe integer`);
  }

  function assertProperties(properties) {
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) fail('properties must be an object');
    for (const key of RESERVED_PARENT_PROPERTIES) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) fail(`property ${key} is reserved`);
    }
    for (const [key, value] of Object.entries(properties)) {
      if (typeof key !== 'string' || !key) fail('property keys must be non-empty strings');
      if (typeof value !== 'string') fail(`property ${key} must be a string`);
    }
  }

  function createOperationId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (!globalThis.crypto?.getRandomValues) fail('secure browser randomness is required');
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function buildItems({variantId, quantity, properties = {}, plan, operationId = createOperationId()}) {
    const parentVariantId = numericVariantId(variantId, 'parent variantId');
    assertPositiveQuantity(quantity, 'parent quantity');
    assertProperties(properties);
    if (!plan || plan.version !== 1 || !Array.isArray(plan.adjustments)) fail('a commerce adjustment plan v1 is required');
    if (typeof operationId !== 'string' || !operationId.trim() || operationId.length > 128) {
      fail('operationId must be a non-empty string up to 128 characters');
    }

    const adjustmentIds = new Set();
    const planSummary = [];
    const children = [];

    for (const adjustment of plan.adjustments) {
      if (!adjustment || typeof adjustment !== 'object' || Array.isArray(adjustment)) fail('every adjustment must be an object');
      if (typeof adjustment.id !== 'string' || !adjustment.id) fail('adjustment id is required');
      if (adjustmentIds.has(adjustment.id)) fail(`duplicate adjustment id ${adjustment.id}`);
      adjustmentIds.add(adjustment.id);
      assertPositiveQuantity(adjustment.quantity, `adjustment ${adjustment.id} quantity`);
      const childVariantId = numericVariantId(adjustment.variantId, `adjustment ${adjustment.id} variantId`);
      if (childVariantId === parentVariantId) fail(`adjustment ${adjustment.id} may not use the parent variant`);

      planSummary.push({id: adjustment.id, variantId: childVariantId, quantity: adjustment.quantity});
      children.push({
        id: childVariantId,
        quantity: adjustment.quantity,
        parent_id: parentVariantId,
        properties: {
          _jill_adjustment_id: adjustment.id,
          _jill_parent_operation: operationId,
        },
      });
    }

    const parent = {
      id: parentVariantId,
      quantity,
      properties: {
        ...properties,
        _jill_operation: operationId,
        _jill_adjustment_plan: JSON.stringify({version: 1, adjustments: planSummary}),
      },
    };

    return Object.freeze([parent, ...children].map((item) => Object.freeze({
      ...item,
      properties: Object.freeze({...item.properties}),
    })));
  }

  async function add({variantId, quantity, properties = {}, plan, operationId}) {
    const items = buildItems({variantId, quantity, properties, plan, operationId});
    if (typeof globalThis.fetch !== 'function') fail('fetch is required');
    const root = globalThis.Shopify?.routes?.root || '/';
    const response = await globalThis.fetch(`${root}cart/add.js`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({items}),
    });

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      fail('Shopify returned an invalid cart response');
    }

    if (!response.ok) {
      const message = body?.description || body?.message || `Shopify cart request failed with status ${response.status}`;
      fail(message);
    }
    if (!body || !Array.isArray(body.items)) fail('Shopify cart response is missing added items');
    return body;
  }

  const api = Object.freeze({buildItems, add});

  Object.defineProperty(globalThis, 'JILLCommerceCart', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
