(() => {
  'use strict';

  const STATE_VERSION = 1;
  const MAX_UNITS = 10000;

  function fail(message) {
    throw new Error(`JILL variant allocation: ${message}`);
  }

  function assertItemId(itemId) {
    if (typeof itemId !== 'string' || !itemId.trim() || itemId.length > 256) {
      fail('itemId must be a non-empty string up to 256 characters');
    }
  }

  function assertQuantity(quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_UNITS) {
      fail(`merchandiseQuantity must be an integer from 1 to ${MAX_UNITS}`);
    }
  }

  function normalizeVariants(variants) {
    if (!Array.isArray(variants) || variants.length === 0) fail('variants must be a non-empty array');
    const seen = new Set();
    const normalized = [];
    for (const variant of variants) {
      if (!variant || typeof variant !== 'object') fail('every variant must be an object');
      const id = String(variant.id || '').trim();
      if (!id || id.length > 128) fail('variant id must be a non-empty string up to 128 characters');
      if (seen.has(id)) fail(`duplicate variant id ${id}`);
      seen.add(id);
      const title = String(variant.title || id).trim();
      if (!title || title.length > 500) fail(`variant ${id} title must be a non-empty string up to 500 characters`);
      normalized.push(Object.freeze({
        id,
        title,
        available: variant.available !== false,
        priceLabel: variant.priceLabel ? String(variant.priceLabel) : '',
      }));
    }
    if (!normalized.some((variant) => variant.available)) fail('at least one variant must be available');
    return Object.freeze(normalized);
  }

  function buildUnitIds(itemId, quantity) {
    return Object.freeze(Array.from({length: quantity}, (_, index) => `${itemId}::${index + 1}`));
  }

  function assertGroupId(groupId) {
    if (typeof groupId !== 'string' || !/^group_[1-9][0-9]*$/.test(groupId)) {
      fail('allocation group id must use group_N format');
    }
  }

  function nextGroupNumber(groups, requested) {
    let next = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
    for (const group of groups) {
      const match = /^group_(\d+)$/.exec(group.id);
      if (match) next = Math.max(next, Number(match[1]) + 1);
    }
    return next;
  }

  function freezeGroup(group) {
    return Object.freeze({
      id: group.id,
      variantId: group.variantId,
      variantTitle: group.variantTitle,
      unitIds: Object.freeze([...group.unitIds]),
      quantity: group.unitIds.length,
      complete: group.complete,
    });
  }

  function normalizeGroups({rawGroups, variants, eligibleUnitIds}) {
    if (!Array.isArray(rawGroups)) fail('allocations must be an array');
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const eligible = new Set(eligibleUnitIds);
    const claimedUnits = new Set();
    const claimedVariants = new Set();
    const groupIds = new Set();
    const groups = [];

    for (const raw of rawGroups) {
      if (!raw || typeof raw !== 'object') fail('every allocation group must be an object');
      assertGroupId(raw.id);
      if (groupIds.has(raw.id)) fail(`duplicate allocation group id ${raw.id}`);
      groupIds.add(raw.id);

      const variantId = String(raw.variantId || '').trim();
      const variant = variantById.get(variantId) || null;
      const variantValid = Boolean(variant?.available) && !claimedVariants.has(variantId);
      const unitIds = [];
      for (const unitId of Array.isArray(raw.unitIds) ? raw.unitIds : []) {
        if (typeof unitId !== 'string') continue;
        if (!eligible.has(unitId) || claimedUnits.has(unitId)) continue;
        unitIds.push(unitId);
        claimedUnits.add(unitId);
      }
      if (unitIds.length === 0) continue;
      if (variantValid) claimedVariants.add(variantId);
      groups.push(freezeGroup({
        id: raw.id,
        variantId: variantValid ? variantId : '',
        variantTitle: variantValid ? variant.title : '',
        unitIds,
        complete: variantValid,
      }));
    }

    const unallocatedUnitIds = eligibleUnitIds.filter((unitId) => !claimedUnits.has(unitId));
    return {
      groups: Object.freeze(groups),
      unallocatedUnitIds: Object.freeze(unallocatedUnitIds),
    };
  }

  function seedDefaultGroup(variants, eligibleUnitIds) {
    const variant = variants.find((candidate) => candidate.available);
    return [freezeGroup({
      id: 'group_1',
      variantId: variant.id,
      variantTitle: variant.title,
      unitIds: eligibleUnitIds,
      complete: true,
    })];
  }

  function createState({
    itemId,
    merchandiseQuantity,
    variants,
    allocations,
    nextGroupNumber: requestedNextGroupNumber = 1,
  }) {
    assertItemId(itemId);
    assertQuantity(merchandiseQuantity);
    const normalizedVariants = normalizeVariants(variants);
    const eligibleUnitIds = buildUnitIds(itemId, merchandiseQuantity);
    const hasProvidedAllocations = Array.isArray(allocations);
    const normalized = normalizeGroups({
      rawGroups: hasProvidedAllocations ? allocations : [],
      variants: normalizedVariants,
      eligibleUnitIds,
    });
    const groups = !hasProvidedAllocations
      ? Object.freeze(seedDefaultGroup(normalizedVariants, eligibleUnitIds))
      : normalized.groups;
    const claimed = new Set(groups.flatMap((group) => group.unitIds));
    const unallocatedUnitIds = Object.freeze(eligibleUnitIds.filter((unitId) => !claimed.has(unitId)));
    const complete = unallocatedUnitIds.length === 0
      && groups.length > 0
      && groups.every((group) => group.complete && group.quantity > 0);

    return Object.freeze({
      version: STATE_VERSION,
      itemId,
      merchandiseQuantity,
      variants: normalizedVariants,
      eligibleUnitIds,
      groups,
      unallocatedUnitIds,
      complete,
      nextGroupNumber: nextGroupNumber(groups, requestedNextGroupNumber),
    });
  }

  function assertState(state) {
    if (!state || state.version !== STATE_VERSION) fail('a variant allocation state is required');
  }

  function rawGroups(state) {
    return state.groups.map((group) => ({
      id: group.id,
      variantId: group.variantId,
      unitIds: [...group.unitIds],
    }));
  }

  function rebuild(state, allocations) {
    return createState({
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      variants: state.variants,
      allocations,
      nextGroupNumber: state.nextGroupNumber,
    });
  }

  function getGroup(state, groupId) {
    const group = state.groups.find((candidate) => candidate.id === groupId);
    if (!group) fail(`unknown allocation group ${groupId}`);
    return group;
  }

  function getAvailableVariants(state, groupId) {
    assertState(state);
    const group = getGroup(state, groupId);
    const used = new Set(
      state.groups.filter((candidate) => candidate.id !== groupId).map((candidate) => candidate.variantId),
    );
    return Object.freeze(state.variants.filter(
      (variant) => variant.available && (variant.id === group.variantId || !used.has(variant.id)),
    ));
  }

  function canAddGroup(state) {
    assertState(state);
    if (state.unallocatedUnitIds.length === 0) return false;
    const used = new Set(state.groups.map((group) => group.variantId));
    return state.variants.some((variant) => variant.available && !used.has(variant.id));
  }

  function addGroup(state) {
    assertState(state);
    if (!canAddGroup(state)) fail('no unallocated quantity or unused available variant remains');
    const used = new Set(state.groups.map((group) => group.variantId));
    const variant = state.variants.find((candidate) => candidate.available && !used.has(candidate.id));
    const groups = rawGroups(state);
    groups.push({
      id: `group_${state.nextGroupNumber}`,
      variantId: variant.id,
      unitIds: [...state.unallocatedUnitIds],
    });
    return createState({
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      variants: state.variants,
      allocations: groups,
      nextGroupNumber: state.nextGroupNumber + 1,
    });
  }

  function removeGroup(state, groupId) {
    assertState(state);
    getGroup(state, groupId);
    const groups = rawGroups(state).filter((group) => group.id !== groupId);
    return rebuild(state, groups);
  }

  function setGroupVariant(state, groupId, variantId) {
    assertState(state);
    getGroup(state, groupId);
    const allowed = getAvailableVariants(state, groupId);
    if (!allowed.some((variant) => variant.id === variantId)) {
      fail(`variant ${variantId} is unavailable for allocation group ${groupId}`);
    }
    const groups = rawGroups(state);
    const target = groups.find((group) => group.id === groupId);
    target.variantId = variantId;
    return rebuild(state, groups);
  }

  function setGroupCount(state, groupId, count) {
    assertState(state);
    const current = getGroup(state, groupId);
    if (!Number.isSafeInteger(count) || count < 1) fail('allocation group quantity must be a positive integer');
    const max = current.quantity + state.unallocatedUnitIds.length;
    if (count > max) fail(`allocation group quantity may not exceed ${max}`);

    const groups = rawGroups(state);
    const target = groups.find((group) => group.id === groupId);
    if (count < target.unitIds.length) {
      target.unitIds = target.unitIds.slice(0, count);
    } else if (count > target.unitIds.length) {
      target.unitIds.push(...state.unallocatedUnitIds.slice(0, count - target.unitIds.length));
    }
    return rebuild(state, groups);
  }

  function reconcileQuantity(state, merchandiseQuantity) {
    assertState(state);
    assertQuantity(merchandiseQuantity);
    let next = createState({
      itemId: state.itemId,
      merchandiseQuantity,
      variants: state.variants,
      allocations: rawGroups(state),
      nextGroupNumber: state.nextGroupNumber,
    });

    if (
      merchandiseQuantity > state.merchandiseQuantity
      && state.complete
      && state.groups.length === 1
      && next.groups.length === 1
      && next.unallocatedUnitIds.length > 0
    ) {
      const groups = rawGroups(next);
      groups[0].unitIds.push(...next.unallocatedUnitIds);
      next = createState({
        itemId: state.itemId,
        merchandiseQuantity,
        variants: state.variants,
        allocations: groups,
        nextGroupNumber: state.nextGroupNumber,
      });
    }

    return next;
  }

  function toPayload(state) {
    assertState(state);
    return Object.freeze({
      version: STATE_VERSION,
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      complete: state.complete,
      allocations: Object.freeze(state.groups.map((group) => Object.freeze({
        id: group.id,
        variantId: group.variantId,
        variantTitle: group.variantTitle,
        quantity: group.quantity,
        unitIds: Object.freeze([...group.unitIds]),
      }))),
    });
  }

  const api = Object.freeze({
    createState,
    reconcileQuantity,
    getAvailableVariants,
    canAddGroup,
    addGroup,
    removeGroup,
    setGroupVariant,
    setGroupCount,
    toPayload,
  });

  Object.defineProperty(globalThis, 'JILLVariantAllocation', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
