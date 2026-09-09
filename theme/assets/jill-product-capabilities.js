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
  const ALLOCATED_OPTION_KINDS = new Set(['select', 'radio']);
  const COMMERCE_GROUPS = new Set(['product_options', 'personalization']);
  const COMMERCE_QUANTITY_BASES = new Set([
    'once',
    'merchandise_quantity',
    'customization_units',
    'matched_units',
    'matched_groups',
  ]);
  const CONDITION_OPERATORS = new Set(['equals', 'not_equals', 'in', 'not_in']);
  const EMPTY_FIELD_IDS = Object.freeze([]);
  const EMPTY_COMMERCE_ADJUSTMENTS = Object.freeze([]);

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

  function validateCustomizationUnitsFeature(feature) {
    if (!feature) return;
    if (!Number.isInteger(feature.unitsPerQuantity) || feature.unitsPerQuantity < 1 || feature.unitsPerQuantity > 1000) {
      fail('customizationUnits.unitsPerQuantity must be an integer from 1 to 1000');
    }

    for (const labelKey of ['singularLabel', 'pluralLabel']) {
      const label = feature[labelKey];
      if (label === undefined) continue;
      if (typeof label !== 'string' || !label.trim() || label.length > 100) {
        fail(`customizationUnits.${labelKey} must be a non-empty string up to 100 characters`);
      }
    }
  }

  function validateProductOptionsAllocationFeature(feature, byId) {
    if (!feature) return new Set();
    if (!Array.isArray(feature.fieldIds) || feature.fieldIds.length === 0) {
      fail('productOptionsAllocation.fieldIds must be a non-empty array');
    }

    const allocated = new Set();
    for (const fieldId of feature.fieldIds) {
      if (allocated.has(fieldId)) fail(`productOptionsAllocation contains duplicate field ${fieldId}`);
      const field = assertFieldReference(byId, fieldId, 'productOptionsAllocation');
      if (field.group !== 'product_options') {
        fail(`productOptionsAllocation field ${fieldId} must belong to product_options group`);
      }
      if (!ALLOCATED_OPTION_KINDS.has(field.kind)) {
        fail(`productOptionsAllocation field ${fieldId} must be a select or radio field`);
      }
      if (!Array.isArray(field.options) || field.options.length === 0) {
        fail(`productOptionsAllocation field ${fieldId} must define options`);
      }

      const optionValues = field.options.map((option) => option?.value);
      if (new Set(optionValues).size !== optionValues.length) {
        fail(`productOptionsAllocation field ${fieldId} has duplicate option values`);
      }
      allocated.add(fieldId);
    }

    return allocated;
  }

  function validateProductOptionsDependencies(fields, byId, allocatedFieldIds) {
    for (const field of fields) {
      if (field.group !== 'product_options') continue;

      for (const condition of field.visibleWhen?.conditions || []) {
        const dependency = byId[condition.field];
        if (dependency.group !== 'product_options') {
          fail(`product_options field ${field.id} may only depend on product_options fields`);
        }
        if (!allocatedFieldIds.has(field.id) && allocatedFieldIds.has(dependency.id)) {
          fail(`singleton Product Options field ${field.id} may not depend on allocated field ${dependency.id}`);
        }
      }
    }
  }

  function validatePersonalizationFeature(feature, byId) {
    if (!feature) return new Set();
    if (!Array.isArray(feature.fieldIds)) fail('personalizationAllocation.fieldIds must be an array');

    const allocated = new Set();
    for (const fieldId of feature.fieldIds) {
      if (allocated.has(fieldId)) fail(`personalizationAllocation contains duplicate field ${fieldId}`);
      const field = assertFieldReference(byId, fieldId, 'personalizationAllocation');
      if (field.group !== 'personalization') {
        fail(`personalizationAllocation field ${fieldId} must belong to personalization group`);
      }
      allocated.add(fieldId);
    }
    return allocated;
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

  function expectedConditionValues(condition) {
    return Array.isArray(condition.value) ? condition.value : [condition.value];
  }

  function validateCommerceCondition(rule, field) {
    const condition = rule.when;
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      fail(`commerce adjustment ${rule.id} when must be an object`);
    }
    if (!CONDITION_OPERATORS.has(condition.operator)) {
      fail(`commerce adjustment ${rule.id} has unsupported operator ${condition.operator}`);
    }

    const expectedValues = expectedConditionValues(condition);
    if (field.kind === 'select' || field.kind === 'radio') {
      const allowed = new Set((field.options || []).map((option) => option.value));
      for (const value of expectedValues) {
        if (typeof value !== 'string' || !allowed.has(value)) {
          fail(`commerce adjustment ${rule.id} references invalid option ${String(value)} for field ${field.id}`);
        }
      }
    }
    if (field.kind === 'number' && expectedValues.some((value) => typeof value !== 'number')) {
      fail(`commerce adjustment ${rule.id} must compare number field ${field.id} with numeric values`);
    }
    if (field.kind === 'checkbox' && expectedValues.some((value) => typeof value !== 'boolean')) {
      fail(`commerce adjustment ${rule.id} must compare checkbox field ${field.id} with boolean values`);
    }
  }

  function validateCommerceAdjustmentsFeature(feature, byId, allocatedFieldIds) {
    if (!feature) return;
    if (!Array.isArray(feature) || feature.length === 0) {
      fail('commerceAdjustments must be a non-empty array when configured');
    }

    const ruleIds = new Set();
    for (const rule of feature) {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) fail('every commerce adjustment must be an object');
      assertIdentifier(rule.id, 'commerce adjustment id');
      if (ruleIds.has(rule.id)) fail(`duplicate commerce adjustment id ${rule.id}`);
      ruleIds.add(rule.id);

      if (!rule.when?.field) fail(`commerce adjustment ${rule.id} must define when.field`);
      const field = assertFieldReference(byId, rule.when.field, `commerce adjustment ${rule.id}`);
      if (!COMMERCE_GROUPS.has(field.group)) {
        fail(`commerce adjustment ${rule.id} field ${field.id} must belong to product_options or personalization`);
      }
      validateCommerceCondition(rule, field);

      if (!COMMERCE_QUANTITY_BASES.has(rule.quantityBasis)) {
        fail(`commerce adjustment ${rule.id} has unsupported quantity basis ${rule.quantityBasis}`);
      }
      if ((rule.quantityBasis === 'matched_units' || rule.quantityBasis === 'matched_groups') && !allocatedFieldIds.has(field.id)) {
        fail(`commerce adjustment ${rule.id} quantity basis ${rule.quantityBasis} requires allocated field ${field.id}`);
      }

      if (typeof rule.variantId !== 'string' || !/^(?:gid:\/\/shopify\/ProductVariant\/)?[1-9][0-9]*$/.test(rule.variantId)) {
        fail(`commerce adjustment ${rule.id} must reference a Shopify ProductVariant id`);
      }
      if (rule.label !== undefined && (typeof rule.label !== 'string' || !rule.label.trim() || rule.label.length > 200)) {
        fail(`commerce adjustment ${rule.id} label must be a non-empty string up to 200 characters`);
      }
    }
  }

  function validateFeatures(features, fields, byId) {
    if (!features || typeof features !== 'object' || Array.isArray(features)) {
      fail('features must be an object');
    }

    validateCustomizationUnitsFeature(features.customizationUnits);
    const productOptionAllocatedFieldIds = validateProductOptionsAllocationFeature(features.productOptionsAllocation, byId);
    validateProductOptionsDependencies(fields, byId, productOptionAllocatedFieldIds);
    const personalizationAllocatedFieldIds = validatePersonalizationFeature(features.personalizationAllocation, byId);
    validateDatePlanningFeature(features.datePlanning, byId);
    validateReferenceUploadFeature(features.referenceUpload, byId);
    validateCommerceAdjustmentsFeature(
      features.commerceAdjustments,
      byId,
      new Set([...productOptionAllocatedFieldIds, ...personalizationAllocatedFieldIds]),
    );
  }

  function resolve(input) {
    const profile = parseProfile(input);
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) fail('profile must be an object');
    if (profile.version !== SUPPORTED_VERSION) fail(`unsupported profile version ${profile.version}`);
    assertIdentifier(profile.id, 'profile id');

    const {byId, byGroup} = collectFields(profile);
    assertConditionReferences(profile.fields, byId);
    validateFeatures(profile.features, profile.fields, byId);
    assertNoVisibilityCycles(profile.fields, byId);

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

  function getCustomizationUnitsPerQuantity(resolvedProfile) {
    return resolvedProfile?.features?.customizationUnits?.unitsPerQuantity ?? 1;
  }

  function getProductOptionsAllocationFieldIds(resolvedProfile) {
    return resolvedProfile?.features?.productOptionsAllocation?.fieldIds || EMPTY_FIELD_IDS;
  }

  function getPersonalizationAllocationFieldIds(resolvedProfile) {
    if (resolvedProfile?.features?.personalizationAllocation?.enabled === false) return EMPTY_FIELD_IDS;
    return resolvedProfile?.features?.personalizationAllocation?.fieldIds || EMPTY_FIELD_IDS;
  }

  function getCommerceAdjustments(resolvedProfile) {
    return resolvedProfile?.features?.commerceAdjustments || EMPTY_COMMERCE_ADJUSTMENTS;
  }

  const api = Object.freeze({
    SUPPORTED_VERSION,
    GROUPS,
    resolve,
    getField,
    getFieldsForGroup,
    getCustomizationUnitsPerQuantity,
    getProductOptionsAllocationFieldIds,
    getPersonalizationAllocationFieldIds,
    getCommerceAdjustments,
  });

  Object.defineProperty(globalThis, 'JILLProductCapabilities', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
