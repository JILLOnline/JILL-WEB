(() => {
  'use strict';

  const STATE_VERSION = 1;
  const MAX_ALLOCATABLE_UNITS = 10000;
  const EMPTY = Object.freeze([]);

  function fail(message) {
    throw new Error(`JILL Product Options: ${message}`);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
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

  function assertItemId(itemId) {
    if (typeof itemId !== 'string' || !itemId.trim() || itemId.length > 256) {
      fail('itemId must be a non-empty string up to 256 characters');
    }
  }

  function assertMerchandiseQuantity(quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      fail('merchandiseQuantity must be a non-negative safe integer');
    }
  }

  function assertGroupId(groupId) {
    if (typeof groupId !== 'string' || !groupId.trim() || groupId.length > 128) {
      fail('allocation group id must be a non-empty string up to 128 characters');
    }
  }

  function assertPlainObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  }

  function productOptionFields(profile, capabilities) {
    return capabilities.getFieldsForGroup(profile, 'product_options');
  }

  function partitionFields(profile, capabilities) {
    const fields = productOptionFields(profile, capabilities);
    const allocatedFieldIds = capabilities.getProductOptionsAllocationFieldIds(profile);
    const allocatedSet = new Set(allocatedFieldIds);
    const singletonFields = fields.filter((field) => !allocatedSet.has(field.id));
    const allocatedFields = allocatedFieldIds.map((fieldId) => capabilities.getField(profile, fieldId));
    return {fields, singletonFields, allocatedFields, allocatedFieldIds};
  }

  function copyKnownValues(source, fields) {
    const values = Object.create(null);
    if (!source) return values;
    assertPlainObject(source, 'values');
    for (const field of fields) {
      if (hasOwn(source, field.id)) values[field.id] = source[field.id];
    }
    return values;
  }

  function canonicalValues(fields, rawValues, validation) {
    const values = Object.create(null);
    for (const field of fields) {
      const result = validation.byId[field.id];
      if (result?.available && hasOwn(rawValues, field.id)) values[field.id] = rawValues[field.id];
    }
    return values;
  }

  function scopedResults(fields, validation) {
    return fields.map((field) => validation.byId[field.id]);
  }

  function scopeComplete(results) {
    return results.every((result) => !result.available || result.valid);
  }

  function firstBlockingFieldId(results) {
    const blocking = results.find((result) => result.available && !result.valid);
    return blocking ? blocking.id : null;
  }

  function customizationUnitCount(quantity, unitsPerQuantity) {
    const total = quantity * unitsPerQuantity;
    if (!Number.isSafeInteger(total)) fail('derived customization-unit count exceeds safe integer range');
    return total;
  }

  function buildUnitIds(itemId, count) {
    if (count > MAX_ALLOCATABLE_UNITS) {
      fail(`eligible customization-unit count may not exceed ${MAX_ALLOCATABLE_UNITS} for allocation`);
    }
    return Array.from({length: count}, (_, index) => `${itemId}::${index + 1}`);
  }

  function normalizeNextGroupNumber(groups, requested) {
    let next = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
    for (const group of groups) {
      const match = /^group_(\d+)$/.exec(group.id);
      if (match) next = Math.max(next, Number(match[1]) + 1);
    }
    return next;
  }

  function freezeValues(values) {
    return Object.freeze({...values});
  }

  function freezeIssue(issue) {
    return issue ? Object.freeze(issue) : null;
  }

  function freezeGroup(group) {
    return Object.freeze({
      id: group.id,
      unitIds: Object.freeze([...group.unitIds]),
      values: freezeValues(group.values),
      results: Object.freeze([...group.results]),
      complete: group.complete,
      firstInvalidFieldId: group.firstInvalidFieldId,
    });
  }

  function normalizeGroups({
    rawGroups,
    fields,
    allocatedFields,
    singletonValues,
    eligibleUnitIds,
    formEngine,
  }) {
    if (!Array.isArray(rawGroups)) fail('allocationGroups must be an array');

    const eligible = new Set(eligibleUnitIds);
    const claimed = new Set();
    const groupIds = new Set();
    const groups = [];

    for (const rawGroup of rawGroups) {
      assertPlainObject(rawGroup, 'allocation group');
      assertGroupId(rawGroup.id);
      if (groupIds.has(rawGroup.id)) fail(`duplicate allocation group id ${rawGroup.id}`);
      groupIds.add(rawGroup.id);

      if (!Array.isArray(rawGroup.unitIds)) fail(`allocation group ${rawGroup.id} unitIds must be an array`);
      const originalHadUnits = rawGroup.unitIds.length > 0;
      const localSeen = new Set();
      const unitIds = [];

      for (const unitId of rawGroup.unitIds) {
        if (typeof unitId !== 'string') fail(`allocation group ${rawGroup.id} contains an invalid unit id`);
        if (localSeen.has(unitId)) fail(`allocation group ${rawGroup.id} contains duplicate unit ${unitId}`);
        localSeen.add(unitId);
        if (!eligible.has(unitId) || claimed.has(unitId)) continue;
        unitIds.push(unitId);
      }

      if (originalHadUnits && unitIds.length === 0) continue;

      const rawValues = copyKnownValues(rawGroup.values || {}, allocatedFields);
      const combinedValues = {...singletonValues, ...rawValues};
      const validation = formEngine.validateFields(fields, combinedValues);
      const values = canonicalValues(allocatedFields, rawValues, validation);
      const canonicalValidation = formEngine.validateFields(fields, {...singletonValues, ...values});
      const results = scopedResults(allocatedFields, canonicalValidation);
      const firstInvalidFieldId = firstBlockingFieldId(results);
      const complete = unitIds.length > 0 && scopeComplete(results);

      for (const unitId of unitIds) claimed.add(unitId);
      groups.push(freezeGroup({
        id: rawGroup.id,
        unitIds,
        values,
        results,
        complete,
        firstInvalidFieldId,
      }));
    }

    const unallocatedUnitIds = eligibleUnitIds.filter((unitId) => !claimed.has(unitId));
    return {
      groups: Object.freeze(groups),
      unallocatedUnitIds: Object.freeze(unallocatedUnitIds),
    };
  }

  function firstIssue(singleton, allocation) {
    if (singleton.firstInvalidFieldId) {
      return freezeIssue({
        scope: 'singleton',
        reason: 'field',
        fieldId: singleton.firstInvalidFieldId,
      });
    }

    if (!allocation.available) return null;

    for (const group of allocation.groups) {
      if (group.unitIds.length === 0) {
        return freezeIssue({scope: 'allocation_group', reason: 'units', groupId: group.id});
      }
      if (group.firstInvalidFieldId) {
        return freezeIssue({
          scope: 'allocation_group',
          reason: 'field',
          groupId: group.id,
          fieldId: group.firstInvalidFieldId,
        });
      }
    }

    if (allocation.unallocatedUnitIds.length > 0) {
      return freezeIssue({scope: 'allocation', reason: 'unallocated'});
    }

    return null;
  }

  function buildState({
    itemId,
    merchandiseQuantity,
    profile,
    values = {},
    allocationGroups = [],
    nextGroupNumber = 1,
  }) {
    assertItemId(itemId);
    assertMerchandiseQuantity(merchandiseQuantity);
    assertResolvedProfile(profile);

    const {capabilities, formEngine} = dependencies();
    const {fields, singletonFields, allocatedFields, allocatedFieldIds} = partitionFields(profile, capabilities);
    const rawSingletonValues = copyKnownValues(values, singletonFields);
    const initialValidation = formEngine.validateFields(fields, rawSingletonValues);
    const singletonValues = canonicalValues(singletonFields, rawSingletonValues, initialValidation);
    const singletonValidation = formEngine.validateFields(fields, singletonValues);
    const singletonResults = scopedResults(singletonFields, singletonValidation);
    const singleton = Object.freeze({
      fieldIds: Object.freeze(singletonFields.map((field) => field.id)),
      values: freezeValues(singletonValues),
      results: Object.freeze(singletonResults),
      complete: scopeComplete(singletonResults),
      firstInvalidFieldId: firstBlockingFieldId(singletonResults),
    });

    const unitsPerQuantity = capabilities.getCustomizationUnitsPerQuantity(profile);
    const eligibleUnitCount = customizationUnitCount(merchandiseQuantity, unitsPerQuantity);
    const allocationEnabled = allocatedFields.length > 0;
    let allocationAvailable = false;
    let eligibleUnitIds = EMPTY;
    let groups = Object.freeze([]);
    let unallocatedUnitIds = EMPTY;

    if (allocationEnabled) {
      const baseValidation = formEngine.validateFields(fields, singletonValues);
      allocationAvailable = allocatedFields.some((field) => baseValidation.byId[field.id].available);

      if (allocationAvailable && eligibleUnitCount > 0) {
        eligibleUnitIds = Object.freeze(buildUnitIds(itemId, eligibleUnitCount));
        const normalized = normalizeGroups({
          rawGroups: allocationGroups,
          fields,
          allocatedFields,
          singletonValues,
          eligibleUnitIds,
          formEngine,
        });
        groups = normalized.groups;
        unallocatedUnitIds = normalized.unallocatedUnitIds;
      }
    }

    const allocationComplete = !allocationAvailable
      || eligibleUnitCount === 0
      || (unallocatedUnitIds.length === 0 && groups.length > 0 && groups.every((group) => group.complete));

    const allocation = Object.freeze({
      enabled: allocationEnabled,
      available: allocationAvailable,
      fieldIds: Object.freeze([...allocatedFieldIds]),
      eligibleUnitIds,
      groups,
      unallocatedUnitIds,
      complete: allocationComplete,
    });

    const complete = singleton.complete && allocation.complete;
    const state = {
      version: STATE_VERSION,
      itemId,
      merchandiseQuantity,
      unitsPerQuantity,
      eligibleUnitCount,
      singleton,
      allocation,
      complete,
      firstIssue: firstIssue(singleton, allocation),
      nextGroupNumber: normalizeNextGroupNumber(groups, nextGroupNumber),
    };

    return Object.freeze(state);
  }

  function assertState(state) {
    if (!state || state.version !== STATE_VERSION || typeof state.itemId !== 'string') {
      fail('a Product Options state object is required');
    }
  }

  function rawGroupsFromState(state) {
    return state.allocation.groups.map((group) => ({
      id: group.id,
      unitIds: [...group.unitIds],
      values: {...group.values},
    }));
  }

  function reconcile(state, profile, merchandiseQuantity = state?.merchandiseQuantity) {
    assertState(state);
    return buildState({
      itemId: state.itemId,
      merchandiseQuantity,
      profile,
      values: state.singleton.values,
      allocationGroups: rawGroupsFromState(state),
      nextGroupNumber: state.nextGroupNumber,
    });
  }

  function setSingletonValue(state, profile, fieldId, value) {
    assertState(state);
    if (!state.singleton.fieldIds.includes(fieldId)) fail(`field ${fieldId} is not a singleton Product Options field`);
    return buildState({
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      profile,
      values: {...state.singleton.values, [fieldId]: value},
      allocationGroups: rawGroupsFromState(state),
      nextGroupNumber: state.nextGroupNumber,
    });
  }

  function addAllocationGroup(state, profile) {
    assertState(state);
    if (!state.allocation.enabled || !state.allocation.available) fail('Product Options allocation is not available');
    if (state.allocation.unallocatedUnitIds.length === 0) fail('no unallocated customization units remain');

    const id = `group_${state.nextGroupNumber}`;
    const groups = rawGroupsFromState(state);
    groups.push({id, unitIds: [], values: {}});
    return buildState({
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      profile,
      values: state.singleton.values,
      allocationGroups: groups,
      nextGroupNumber: state.nextGroupNumber + 1,
    });
  }

  function findGroup(state, groupId) {
    assertGroupId(groupId);
    const group = state.allocation.groups.find((candidate) => candidate.id === groupId);
    if (!group) fail(`unknown allocation group ${groupId}`);
    return group;
  }

  function setAllocationGroupUnits(state, profile, groupId, unitIds) {
    assertState(state);
    const group = findGroup(state, groupId);
    if (!Array.isArray(unitIds)) fail('unitIds must be an array');

    const allowed = new Set([...state.allocation.unallocatedUnitIds, ...group.unitIds]);
    const seen = new Set();
    for (const unitId of unitIds) {
      if (typeof unitId !== 'string' || !allowed.has(unitId)) fail(`unit ${unitId} is not available to group ${groupId}`);
      if (seen.has(unitId)) fail(`group ${groupId} contains duplicate unit ${unitId}`);
      seen.add(unitId);
    }

    const groups = rawGroupsFromState(state).map((candidate) =>
      candidate.id === groupId ? {...candidate, unitIds: [...unitIds]} : candidate,
    );
    return buildState({
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      profile,
      values: state.singleton.values,
      allocationGroups: groups,
      nextGroupNumber: state.nextGroupNumber,
    });
  }

  function setAllocationGroupCount(state, profile, groupId, count) {
    assertState(state);
    const group = findGroup(state, groupId);
    if (!Number.isSafeInteger(count) || count < 1) {
      fail('allocation group count must be a positive safe integer');
    }

    const maximum = group.unitIds.length + state.allocation.unallocatedUnitIds.length;
    if (count > maximum) fail(`allocation group ${groupId} count may not exceed ${maximum}`);

    let unitIds = [...group.unitIds];
    if (count < unitIds.length) {
      unitIds = unitIds.slice(0, count);
    } else if (count > unitIds.length) {
      unitIds.push(...state.allocation.unallocatedUnitIds.slice(0, count - unitIds.length));
    }

    return setAllocationGroupUnits(state, profile, groupId, unitIds);
  }

  function setAllocationGroupValue(state, profile, groupId, fieldId, value) {
    assertState(state);
    findGroup(state, groupId);
    if (!state.allocation.fieldIds.includes(fieldId)) fail(`field ${fieldId} is not an allocated Product Options field`);

    const groups = rawGroupsFromState(state).map((candidate) =>
      candidate.id === groupId
        ? {...candidate, values: {...candidate.values, [fieldId]: value}}
        : candidate,
    );
    return buildState({
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      profile,
      values: state.singleton.values,
      allocationGroups: groups,
      nextGroupNumber: state.nextGroupNumber,
    });
  }

  function removeAllocationGroup(state, profile, groupId) {
    assertState(state);
    findGroup(state, groupId);
    const groups = rawGroupsFromState(state).filter((candidate) => candidate.id !== groupId);
    return buildState({
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      profile,
      values: state.singleton.values,
      allocationGroups: groups,
      nextGroupNumber: state.nextGroupNumber,
    });
  }

  function toPayload(state) {
    assertState(state);
    return Object.freeze({
      version: STATE_VERSION,
      itemId: state.itemId,
      merchandiseQuantity: state.merchandiseQuantity,
      unitsPerQuantity: state.unitsPerQuantity,
      complete: state.complete,
      values: freezeValues(state.singleton.values),
      allocations: Object.freeze(
        state.allocation.groups.map((group) => Object.freeze({
          id: group.id,
          unitIds: Object.freeze([...group.unitIds]),
          values: freezeValues(group.values),
        })),
      ),
    });
  }

  const api = Object.freeze({
    STATE_VERSION,
    MAX_ALLOCATABLE_UNITS,
    createState: buildState,
    reconcile,
    setSingletonValue,
    addAllocationGroup,
    setAllocationGroupUnits,
    setAllocationGroupCount,
    setAllocationGroupValue,
    removeAllocationGroup,
    toPayload,
  });

  Object.defineProperty(globalThis, 'JILLProductOptions', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
