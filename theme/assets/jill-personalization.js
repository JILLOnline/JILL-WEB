(() => {
  'use strict';

  function fail(message) {
    throw new Error(`JILL personalization: ${message}`);
  }

  function dependencies() {
    const capabilities = globalThis.JILLProductCapabilities;
    const formEngine = globalThis.JILLFormEngine;
    if (!capabilities) fail('JILLProductCapabilities is required');
    if (!formEngine) fail('JILLFormEngine is required');
    return {capabilities, formEngine};
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function assertQuantity(quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) fail('merchandiseQuantity must be a positive integer');
  }

  function unitIds(itemId, count) {
    return Array.from({length: count}, (_, index) => `${itemId}::${index + 1}`);
  }

  function allowedModes(profile, eligibleUnitCount) {
    const configured = profile?.features?.personalizationAllocation;
    if (!configured || configured.enabled === false) return [];
    const modes = Array.isArray(configured.allowedModes) ? configured.allowedModes : [];
    if (eligibleUnitCount < 2) return modes.includes('same') ? ['same'] : modes.slice(0, 1);
    return modes;
  }

  function allocatedFields(profile) {
    const {capabilities} = dependencies();
    return capabilities.getPersonalizationAllocationFieldIds(profile)
      .map((fieldId) => capabilities.getField(profile, fieldId));
  }

  function sanitizeValues(fields, values) {
    const source = values && typeof values === 'object' ? values : {};
    return Object.fromEntries(fields.map((field) => [field.id, source[field.id] ?? '']));
  }

  function evaluateGroup(fields, values) {
    const {formEngine} = dependencies();
    const validation = formEngine.validateFields(fields, values);
    const blocking = validation.results.find((result) => result.available && !result.valid) || null;
    return {
      values,
      results: validation.results,
      complete: !blocking,
      firstInvalidFieldId: blocking?.id || null,
    };
  }

  function normalizeGroups({groups, eligibleIds, fields, mode, nextGroupNumber}) {
    const eligible = new Set(eligibleIds);
    const claimed = new Set();
    const normalized = [];
    let maxNumber = nextGroupNumber || 1;

    for (const source of Array.isArray(groups) ? groups : []) {
      if (!source || typeof source !== 'object') continue;
      const id = typeof source.id === 'string' && source.id ? source.id : `group_${maxNumber++}`;
      const match = /^group_(\d+)$/.exec(id);
      if (match) maxNumber = Math.max(maxNumber, Number(match[1]) + 1);

      const owned = [];
      for (const unitId of Array.isArray(source.unitIds) ? source.unitIds : []) {
        if (!eligible.has(unitId) || claimed.has(unitId)) continue;
        claimed.add(unitId);
        owned.push(unitId);
      }
      if (!owned.length) continue;

      const values = sanitizeValues(fields, source.values);
      const evaluated = evaluateGroup(fields, values);
      normalized.push({
        id,
        unitIds: owned,
        values: evaluated.values,
        results: evaluated.results,
        complete: evaluated.complete,
        firstInvalidFieldId: evaluated.firstInvalidFieldId,
      });
    }

    if (mode === 'same' && eligibleIds.length) {
      const first = normalized[0];
      const values = sanitizeValues(fields, first?.values || {});
      const evaluated = evaluateGroup(fields, values);
      return {
        groups: [{
          id: first?.id || 'group_1',
          unitIds: [...eligibleIds],
          values: evaluated.values,
          results: evaluated.results,
          complete: evaluated.complete,
          firstInvalidFieldId: evaluated.firstInvalidFieldId,
        }],
        nextGroupNumber: Math.max(maxNumber, 2),
      };
    }

    return {groups: normalized, nextGroupNumber: maxNumber};
  }

  function deriveState({itemId, merchandiseQuantity, profile, mode, groups, nextGroupNumber}) {
    if (typeof itemId !== 'string' || !itemId) fail('itemId is required');
    assertQuantity(merchandiseQuantity);
    const {capabilities} = dependencies();
    const fields = allocatedFields(profile);
    const unitsPerQuantity = capabilities.getCustomizationUnitsPerQuantity(profile);
    const eligibleUnitCount = merchandiseQuantity * unitsPerQuantity;
    const eligibleUnitIds = unitIds(itemId, eligibleUnitCount);
    const modes = allowedModes(profile, eligibleUnitCount);

    if (!fields.length || !modes.length) {
      return deepFreeze({
        itemId,
        merchandiseQuantity,
        eligibleUnitCount,
        eligibleUnitIds,
        available: false,
        allowedModes: [],
        mode: null,
        fieldIds: [],
        groups: [],
        unallocatedUnitIds: [],
        nextGroupNumber: 1,
        complete: true,
        firstIssue: null,
      });
    }

    const normalizedMode = modes.includes(mode) ? mode : modes[0];
    const normalized = normalizeGroups({
      groups,
      eligibleIds: eligibleUnitIds,
      fields,
      mode: normalizedMode,
      nextGroupNumber,
    });
    const allocated = new Set(normalized.groups.flatMap((group) => group.unitIds));
    const unallocatedUnitIds = eligibleUnitIds.filter((unitId) => !allocated.has(unitId));

    let firstIssue = null;
    const invalidGroup = normalized.groups.find((group) => !group.complete);
    if (invalidGroup) {
      firstIssue = {
        scope: 'group',
        groupId: invalidGroup.id,
        reason: 'field',
        fieldId: invalidGroup.firstInvalidFieldId,
      };
    } else if (unallocatedUnitIds.length) {
      firstIssue = {scope: 'allocation', reason: 'unallocated'};
    }

    return deepFreeze({
      itemId,
      merchandiseQuantity,
      eligibleUnitCount,
      eligibleUnitIds,
      available: true,
      allowedModes: [...modes],
      mode: normalizedMode,
      fieldIds: fields.map((field) => field.id),
      groups: normalized.groups,
      unallocatedUnitIds,
      nextGroupNumber: normalized.nextGroupNumber,
      complete: !firstIssue,
      firstIssue,
    });
  }

  function createState(input) {
    return deriveState(input);
  }

  function rebuild(state, profile, changes = {}) {
    if (!state || typeof state !== 'object') fail('state is required');
    return deriveState({
      itemId: state.itemId,
      merchandiseQuantity: changes.merchandiseQuantity ?? state.merchandiseQuantity,
      profile,
      mode: changes.mode ?? state.mode,
      groups: changes.groups ?? state.groups,
      nextGroupNumber: changes.nextGroupNumber ?? state.nextGroupNumber,
    });
  }

  function setMode(state, profile, mode) {
    if (!state.allowedModes.includes(mode)) fail(`mode ${mode} is unavailable`);
    let groups = state.groups;
    if (mode === 'different' && state.mode !== 'different') {
      const first = state.groups[0];
      groups = first ? [{...first, unitIds: [state.eligibleUnitIds[0]]}] : [];
    }
    return rebuild(state, profile, {mode, groups});
  }

  function addGroup(state, profile) {
    if (!state.available || state.mode !== 'different') fail('another personalization group is unavailable');
    if (!state.unallocatedUnitIds.length) fail('all personalization units are already allocated');
    const id = `group_${state.nextGroupNumber}`;
    const groups = [
      ...state.groups.map((group) => ({id: group.id, unitIds: [...group.unitIds], values: {...group.values}})),
      {id, unitIds: [state.unallocatedUnitIds[0]], values: {}},
    ];
    return rebuild(state, profile, {groups, nextGroupNumber: state.nextGroupNumber + 1});
  }

  function removeGroup(state, profile, groupId) {
    if (state.mode !== 'different') fail('same-mode personalization group cannot be removed');
    const groups = state.groups
      .filter((group) => group.id !== groupId)
      .map((group) => ({id: group.id, unitIds: [...group.unitIds], values: {...group.values}}));
    if (groups.length === state.groups.length) fail(`unknown group ${groupId}`);
    return rebuild(state, profile, {groups});
  }

  function setGroupCount(state, profile, groupId, count) {
    if (state.mode !== 'different') fail('same-mode personalization count is fixed');
    if (!Number.isSafeInteger(count) || count < 1) fail('group count must be a positive integer');
    const target = state.groups.find((group) => group.id === groupId);
    if (!target) fail(`unknown group ${groupId}`);

    const otherOwned = new Set(
      state.groups.filter((group) => group.id !== groupId).flatMap((group) => group.unitIds),
    );
    const available = state.eligibleUnitIds.filter((unitId) => !otherOwned.has(unitId));
    if (count > available.length) fail('group count exceeds available personalization units');

    const targetOwned = new Set(target.unitIds);
    const ordered = [
      ...available.filter((unitId) => targetOwned.has(unitId)),
      ...available.filter((unitId) => !targetOwned.has(unitId)),
    ];
    const groups = state.groups.map((group) => ({
      id: group.id,
      unitIds: group.id === groupId ? ordered.slice(0, count) : [...group.unitIds],
      values: {...group.values},
    }));
    return rebuild(state, profile, {groups});
  }

  function setGroupValue(state, profile, groupId, fieldId, value) {
    if (!state.fieldIds.includes(fieldId)) fail(`field ${fieldId} is not allocated personalization`);
    const groups = state.groups.map((group) => {
      if (group.id !== groupId) return {id: group.id, unitIds: [...group.unitIds], values: {...group.values}};
      return {
        id: group.id,
        unitIds: [...group.unitIds],
        values: {...group.values, [fieldId]: value},
      };
    });
    if (!groups.some((group) => group.id === groupId)) fail(`unknown group ${groupId}`);
    return rebuild(state, profile, {groups});
  }

  function toPayload(state) {
    if (!state?.available) return {complete: true, mode: null, allocations: []};
    return {
      complete: state.complete,
      mode: state.mode,
      allocations: state.groups.map((group) => ({
        id: group.id,
        unitIds: [...group.unitIds],
        values: {...group.values},
      })),
    };
  }

  const api = Object.freeze({
    createState,
    setMode,
    addGroup,
    removeGroup,
    setGroupCount,
    setGroupValue,
    toPayload,
  });

  Object.defineProperty(globalThis, 'JILLPersonalization', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
