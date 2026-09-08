(() => {
  'use strict';

  const SUPPORTED_VERSION = 1;
  const GROUPS = Object.freeze([
    'product_options',
    'personalization',
    'planning',
    'reference',
  ]);
  const GROUP_SET = new Set(GROUPS);

  function fail(message) {
    throw new Error(`JILL product capabilities: ${message}`);
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function cloneJson(value, label) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      fail(`${label} must be JSON-compatible: ${error.message}`);
    }
  }

  function parseProfile(input) {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch (error) {
        fail(`profile JSON is invalid: ${error.message}`);
      }
    }
    return cloneJson(input, 'profile');
  }

  function assertIdentifier(value, label) {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9_]*$/.test(value)) {
      fail(`${label} must be a lowercase snake_case identifier`);
    }
  }

  function collectFields(profile) {
    if (!Array.isArray(profile.fields)) fail('fields must be an array');

    const byId = Object.create(null);
    const byGroup = Object.fromEntries(GROUPS.map((group) => [group, []]));

    for (const field of profile.fields) {
      if (!field || typeof field !== 'object') fail('every field must be an object');
      assertIdentifier(field.id, 'field id');
      if (byId[field.id]) fail(`duplicate field id ${field.id}`);
      if (!GROUP_SET.has(field.group)) fail(`field ${field.id} has unsupported group ${field.group}`);

      byId[field.id] = field;
      byGroup[field.group].push(field);
    }

    return {byId, byGroup};
  }

  function assertFieldReference(byId, fieldId, owner) {
    assertIdentifier(fieldId, `${owner} field reference`);
    const field = byId[fieldId];
    if (!field) fail(`${owner} references unknown field ${fieldId}`);
    return field;
  }

  function assertConditionReferences(fields, byId) {
    for (const field of fields) {
      const conditions = field.visibleWhen?.conditions || [];
      for (const condition of conditions) {
        assertFieldReference(byId, condition.field, `field ${field.id} visibility`);
      }
    }
  }

  function assertNoVisibilityCycles(fields, byId) {
    const dependencies = Object.create(null);
    for (const field of fields) {
      dependencies[field.id] = (field.visibleWhen?.conditions || []).map((condition) => condition.field);
    }

    const visiting = new Set();
    const visited = new Set();

    function visit(fieldId, path) {
      if (visited.has(fieldId)) return;
      if (visiting.has(fieldId)) fail(`visibility dependency cycle: ${[...path, fieldId].join(' -> ')}`);

      visiting.add(fieldId);
      for (const dependency of dependencies[fieldId] || []) {
        if (!byId[dependency]) fail(`field ${fieldId} visibility references unknown field ${dependency}`);
        visit(dependency, [...path, fieldId]);
      }
      visiting.delete(fieldId);
      visited.add(fieldId);
    }

    for (const field of fields) visit(field.id, []);
  }

  function validatePersonalizationFeature(feature, byId) {
    if (!feature) return;
    if (!Array.isArray(feature.fieldIds)) fail('personalizationAllocation.fieldIds must be an array');
    for (const fieldId of feature.fieldIds) {
      const field = assertFieldReference(byId, fieldId, 'personalizationAllocation');
      if (field.group !== 'personalization') {
        fail(`personalizationAllocation field ${fieldId} must belong to personalization group`);
      }
    }
  }

  function validateDatePlanningFeature(feature, byId) {
    if (!feature) return;
    const field = assertFieldReference(byId, feature.fieldId, 'datePlanning');
    if (field.kind !== 'date') fail(`datePlanning field ${feature.fieldId} must be a date field`);

    if (feature.fulfillmentFieldId) {
      assertFieldReference(byId, feature.fulfillmentFieldId, 'datePlanning fulfillment');
    }
  }

  function validateReferenceUploadFeature(feature, byId) {
    if (!feature) return;
    const field = assertFieldReference(byId, feature.fieldId, 'referenceUpload');
    if (field.kind !== 'file') fail(`referenceUpload field ${feature.fieldId} must be a file field`);
  }

  function validateFeatures(features, byId) {
    if (!features || typeof features !== 'object' || Array.isArray(features)) {
      fail('features must be an object');
    }

    validatePersonalizationFeature(features.personalizationAllocation, byId);
    validateDatePlanningFeature(features.datePlanning, byId);
    validateReferenceUploadFeature(features.referenceUpload, byId);
  }

  function resolve(input) {
    const profile = parseProfile(input);
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) fail('profile must be an object');
    if (profile.version !== SUPPORTED_VERSION) fail(`unsupported profile version ${profile.version}`);
    assertIdentifier(profile.id, 'profile id');

    const {byId, byGroup} = collectFields(profile);
    assertConditionReferences(profile.fields, byId);
    assertNoVisibilityCycles(profile.fields, byId);
    validateFeatures(profile.features, byId);

    const normalizedFields = profile.fields.map((field) => ({...field}));
    const normalizedById = Object.fromEntries(normalizedFields.map((field) => [field.id, field]));
    const normalized = {
      version: profile.version,
      id: profile.id,
      fields: normalizedFields,
      fieldsById: normalizedById,
      groups: Object.fromEntries(
        GROUPS.map((group) => [group, byGroup[group].map((field) => field.id)]),
      ),
      features: profile.features,
    };

    return deepFreeze(normalized);
  }

  function getField(resolvedProfile, fieldId) {
    return resolvedProfile?.fieldsById?.[fieldId] || null;
  }

  function getFieldsForGroup(resolvedProfile, group) {
    if (!GROUP_SET.has(group)) fail(`unsupported group ${group}`);
    return (resolvedProfile?.groups?.[group] || []).map((fieldId) => resolvedProfile.fieldsById[fieldId]);
  }

  const api = Object.freeze({
    SUPPORTED_VERSION,
    GROUPS,
    resolve,
    getField,
    getFieldsForGroup,
  });

  Object.defineProperty(globalThis, 'JILLProductCapabilities', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
