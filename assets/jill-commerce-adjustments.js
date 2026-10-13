(() => {
  'use strict';

  const PLAN_VERSION = 1;
  const SUPPORTED_GROUPS = new Set(['product_options', 'personalization']);
  const EMPTY = Object.freeze([]);

  function fail(message) {
    throw new Error(`JILL commerce adjustments: ${message}`);
  }

  function dependencies() {
    const capabilities = globalThis.JILLProductCapabilities;
    const formEngine = globalThis.JILLFormEngine;
    if (!capabilities) fail('JILLProductCapabilities is required');
    if (!formEngine) fail('JILLFormEngine is required');
    return {capabilities, formEngine};
  }

  function assertResolvedProfile(profile) {
    if (!profile || typeof profile !== 'object' || !profile.fieldsById || !profile.groups) {
      fail('a resolved Product Capability Profile is required');
    }
  }

  function assertMerchandiseQuantity(quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      fail('merchandiseQuantity must be a positive safe integer');
    }
  }

  function assertScopePayload(payload, group) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      fail(`${group} payload is required for a configured commerce adjustment`);
    }
    if (payload.complete !== true) fail(`${group} payload must be complete before commerce adjustments are planned`);
    if (!payload.values || typeof payload.values !== 'object' || Array.isArray(payload.values)) {
      fail(`${group} payload values must be an object`);
    }
    if (!Array.isArray(payload.allocations)) fail(`${group} payload allocations must be an array`);
  }

  function normalizeVariantId(variantId) {
    const value = String(variantId);
    if (value.startsWith('gid://shopify/ProductVariant/')) return value;
    return `gid://shopify/ProductVariant/${value}`;
  }

  function allocatedFieldIds(profile, group, capabilities) {
    if (group === 'product_options') return capabilities.getProductOptionsAllocationFieldIds(profile);
    if (group === 'personalization') return capabilities.getPersonalizationAllocationFieldIds(profile);
    return EMPTY;
  }

  function payloadForGroup(input, group) {
    if (group === 'product_options') return input.productOptions;
    if (group === 'personalization') return input.personalization;
    return null;
  }

  function inspectAllocations(payload, group) {
    const claimedUnits = new Set();
    const allocations = [];

    for (const raw of payload.allocations) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${group} allocation must be an object`);
      if (typeof raw.id !== 'string' || !raw.id.trim()) fail(`${group} allocation id is required`);
      if (!raw.values || typeof raw.values !== 'object' || Array.isArray(raw.values)) {
        fail(`${group} allocation ${raw.id} values must be an object`);
      }
      if (!Array.isArray(raw.unitIds) || raw.unitIds.length === 0) {
        fail(`${group} allocation ${raw.id} must own at least one customization unit`);
      }

      const local = new Set();
      for (const unitId of raw.unitIds) {
        if (typeof unitId !== 'string' || !unitId) fail(`${group} allocation ${raw.id} contains an invalid unit id`);
        if (local.has(unitId)) fail(`${group} allocation ${raw.id} contains duplicate unit ${unitId}`);
        if (claimedUnits.has(unitId)) fail(`${group} customization unit ${unitId} is allocated more than once`);
        local.add(unitId);
        claimedUnits.add(unitId);
      }

      allocations.push({id: raw.id, unitIds: raw.unitIds, values: raw.values});
    }

    return allocations;
  }

  function matchRule({rule, field, payload, allocated, formEngine, group}) {
    if (!allocated) {
      return {
        matched: formEngine.evaluateCondition(rule.when, payload.values),
        matchedUnits: 0,
        matchedGroups: 0,
      };
    }

    const allocations = inspectAllocations(payload, group);
    let matchedUnits = 0;
    let matchedGroups = 0;

    for (const allocation of allocations) {
      if (!formEngine.evaluateCondition(rule.when, allocation.values)) continue;
      matchedGroups += 1;
      matchedUnits += allocation.unitIds.length;
    }

    return {matched: matchedGroups > 0, matchedUnits, matchedGroups};
  }

  function adjustmentQuantity({rule, match, merchandiseQuantity, customizationUnitCount}) {
    if (!match.matched) return 0;
    if (rule.quantityBasis === 'once') return 1;
    if (rule.quantityBasis === 'merchandise_quantity') return merchandiseQuantity;
    if (rule.quantityBasis === 'customization_units') return customizationUnitCount;
    if (rule.quantityBasis === 'matched_units') return match.matchedUnits;
    if (rule.quantityBasis === 'matched_groups') return match.matchedGroups;
    fail(`unsupported quantity basis ${rule.quantityBasis}`);
  }

  function plan(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('plan input must be an object');
    const {profile, merchandiseQuantity} = input;
    assertResolvedProfile(profile);
    assertMerchandiseQuantity(merchandiseQuantity);

    const {capabilities, formEngine} = dependencies();
    const rules = capabilities.getCommerceAdjustments(profile);
    if (!rules.length) {
      return Object.freeze({version: PLAN_VERSION, adjustments: EMPTY});
    }

    const unitsPerQuantity = capabilities.getCustomizationUnitsPerQuantity(profile);
    const customizationUnitCount = merchandiseQuantity * unitsPerQuantity;
    if (!Number.isSafeInteger(customizationUnitCount)) fail('derived customization-unit count exceeds safe integer range');

    const inspectedGroups = new Set();
    const allocationIdsByGroup = new Map();
    const planned = [];

    for (const rule of rules) {
      const field = capabilities.getField(profile, rule.when.field);
      if (!field || !SUPPORTED_GROUPS.has(field.group)) fail(`commerce adjustment ${rule.id} references an unsupported field group`);

      const payload = payloadForGroup(input, field.group);
      assertScopePayload(payload, field.group);

      if (!inspectedGroups.has(field.group)) {
        const allocations = inspectAllocations(payload, field.group);
        allocationIdsByGroup.set(field.group, allocations);
        inspectedGroups.add(field.group);
      }

      const allocated = allocatedFieldIds(profile, field.group, capabilities).includes(field.id);
      const match = allocated
        ? (() => {
            let matchedUnits = 0;
            let matchedGroups = 0;
            for (const allocation of allocationIdsByGroup.get(field.group) || []) {
              if (!formEngine.evaluateCondition(rule.when, allocation.values)) continue;
              matchedGroups += 1;
              matchedUnits += allocation.unitIds.length;
            }
            return {matched: matchedGroups > 0, matchedUnits, matchedGroups};
          })()
        : matchRule({rule, field, payload, allocated: false, formEngine, group: field.group});

      const quantity = adjustmentQuantity({
        rule,
        match,
        merchandiseQuantity,
        customizationUnitCount,
      });
      if (quantity === 0) continue;
      if (!Number.isSafeInteger(quantity) || quantity < 1) fail(`commerce adjustment ${rule.id} produced an invalid quantity`);

      planned.push(Object.freeze({
        id: rule.id,
        variantId: normalizeVariantId(rule.variantId),
        quantity,
        label: rule.label || null,
      }));
    }

    return Object.freeze({
      version: PLAN_VERSION,
      adjustments: Object.freeze(planned),
    });
  }

  const api = Object.freeze({PLAN_VERSION, plan});

  Object.defineProperty(globalThis, 'JILLCommerceAdjustments', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
