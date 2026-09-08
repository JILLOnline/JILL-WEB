(() => {
  'use strict';

  const STATES = Object.freeze({
    UNAVAILABLE: 'UNAVAILABLE',
    EMPTY: 'EMPTY',
    VALID: 'VALID',
    INVALID: 'INVALID',
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR',
  });

  const FIELD_KINDS = new Set([
    'text',
    'textarea',
    'number',
    'select',
    'radio',
    'checkbox',
    'date',
    'file',
  ]);

  const CONDITION_OPERATORS = new Set(['equals', 'not_equals', 'in', 'not_in']);

  function fail(message) {
    throw new Error(`JILL form engine: ${message}`);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isBlank(value, kind) {
    if (kind === 'checkbox') return value !== true;
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object' && typeof value.length === 'number') return value.length === 0;
    return false;
  }

  function scalarEquals(left, right) {
    return left === right;
  }

  function evaluateCondition(condition, values) {
    if (!condition || typeof condition !== 'object') fail('condition must be an object');
    if (!CONDITION_OPERATORS.has(condition.operator)) fail(`unsupported condition operator ${condition.operator}`);

    const current = values ? values[condition.field] : undefined;
    const expected = condition.value;

    if (condition.operator === 'equals') return scalarEquals(current, expected);
    if (condition.operator === 'not_equals') return !scalarEquals(current, expected);

    const expectedValues = Array.isArray(expected) ? expected : [expected];
    const contains = expectedValues.some((candidate) => scalarEquals(candidate, current));
    return condition.operator === 'in' ? contains : !contains;
  }

  function evaluateVisibility(field, values, dependencyResults = null) {
    const visibility = field.visibleWhen;
    if (!visibility) return true;
    if (!Array.isArray(visibility.conditions) || visibility.conditions.length === 0) {
      fail(`field ${field.id} has an empty visibility condition set`);
    }

    const matches = visibility.conditions.map((condition) => {
      if (dependencyResults) {
        const dependency = dependencyResults[condition.field];
        if (!dependency) fail(`field ${field.id} references unknown visibility field ${condition.field}`);
        if (dependency.state !== STATES.VALID) return false;
      }
      return evaluateCondition(condition, values);
    });

    if (visibility.mode === 'all') return matches.every(Boolean);
    if (visibility.mode === 'any') return matches.some(Boolean);
    fail(`field ${field.id} has unsupported visibility mode ${visibility.mode}`);
  }

  function isFieldAvailable(field, values) {
    return evaluateVisibility(field, values);
  }

  function optionValues(field) {
    return Array.isArray(field.options) ? field.options.map((option) => option.value) : [];
  }

  function validateNumber(field, value) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return 'type';
    if (typeof field.min === 'number' && numeric < field.min) return 'min';
    if (typeof field.max === 'number' && numeric > field.max) return 'max';

    if (typeof field.step === 'number') {
      const base = typeof field.min === 'number' ? field.min : 0;
      const quotient = (numeric - base) / field.step;
      if (Math.abs(quotient - Math.round(quotient)) > 1e-9) return 'step';
    }

    return null;
  }

  function validateDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return 'date';
    }
    return null;
  }

  function fileArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && typeof value.length === 'number') return Array.from(value);
    return value ? [value] : [];
  }

  function acceptsFile(file, accepted) {
    if (!accepted || accepted.length === 0) return true;
    if (!file || typeof file !== 'object') return false;

    const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
    const type = typeof file.type === 'string' ? file.type.toLowerCase() : '';

    return accepted.some((rule) => {
      const normalized = String(rule).trim().toLowerCase();
      if (!normalized) return false;
      if (normalized.startsWith('.')) return name.endsWith(normalized);
      if (normalized.endsWith('/*')) return type.startsWith(normalized.slice(0, -1));
      return type === normalized;
    });
  }

  function validateFiles(field, value) {
    const files = fileArray(value);
    if (typeof field.maxFiles === 'number' && files.length > field.maxFiles) return 'file_count';
    if (Array.isArray(field.accept) && files.some((file) => !acceptsFile(file, field.accept))) return 'file_type';
    return null;
  }

  function validateValue(field, value) {
    if (field.kind === 'text' || field.kind === 'textarea') {
      if (typeof value !== 'string') return 'type';
      const length = value.trim().length;
      if (typeof field.minLength === 'number' && length < field.minLength) return 'min_length';
      if (typeof field.maxLength === 'number' && length > field.maxLength) return 'max_length';
      return null;
    }

    if (field.kind === 'number') return validateNumber(field, value);

    if (field.kind === 'select' || field.kind === 'radio') {
      if (typeof value !== 'string') return 'type';
      const allowed = optionValues(field);
      if (allowed.length && !allowed.includes(value)) return 'option';
      return null;
    }

    if (field.kind === 'checkbox') return typeof value === 'boolean' ? null : 'type';
    if (field.kind === 'date') return validateDate(value);
    if (field.kind === 'file') return validateFiles(field, value);

    fail(`field ${field.id} has unsupported kind ${field.kind}`);
  }

  function fieldResult(field, value, available) {
    if (!available) {
      return Object.freeze({
        id: field.id,
        state: STATES.UNAVAILABLE,
        available: false,
        required: Boolean(field.required),
        valid: false,
        reason: 'unavailable',
      });
    }

    const blank = isBlank(value, field.kind);
    if (blank) {
      if (field.required) {
        return Object.freeze({
          id: field.id,
          state: STATES.EMPTY,
          available: true,
          required: true,
          valid: false,
          reason: 'required',
        });
      }

      return Object.freeze({
        id: field.id,
        state: STATES.VALID,
        available: true,
        required: false,
        valid: true,
        reason: null,
      });
    }

    const reason = validateValue(field, value);
    return Object.freeze({
      id: field.id,
      state: reason ? STATES.INVALID : STATES.VALID,
      available: true,
      required: Boolean(field.required),
      valid: !reason,
      reason,
    });
  }

  function validateField(field, value, values = {}) {
    if (!field || typeof field !== 'object') fail('field must be an object');
    if (!field.id) fail('field id is required');
    if (!FIELD_KINDS.has(field.kind)) fail(`field ${field.id} has unsupported kind ${field.kind}`);

    return fieldResult(field, value, isFieldAvailable(field, values));
  }

  function validateFields(fields, values = {}) {
    if (!Array.isArray(fields)) fail('fields must be an array');

    const fieldsById = Object.create(null);
    for (const field of fields) {
      if (!field || typeof field !== 'object') fail('every field must be an object');
      if (!field.id) fail('field id is required');
      if (!FIELD_KINDS.has(field.kind)) fail(`field ${field.id} has unsupported kind ${field.kind}`);
      if (hasOwn(fieldsById, field.id)) fail(`duplicate field id ${field.id}`);
      fieldsById[field.id] = field;
    }

    const byId = Object.create(null);
    const visiting = new Set();

    function evaluateField(fieldId) {
      if (hasOwn(byId, fieldId)) return byId[fieldId];
      if (visiting.has(fieldId)) fail(`visibility dependency cycle includes ${fieldId}`);

      const field = fieldsById[fieldId];
      if (!field) fail(`unknown field ${fieldId}`);
      visiting.add(fieldId);

      const dependencyResults = Object.create(null);
      for (const condition of field.visibleWhen?.conditions || []) {
        if (!fieldsById[condition.field]) {
          fail(`field ${field.id} references unknown visibility field ${condition.field}`);
        }
        dependencyResults[condition.field] = evaluateField(condition.field);
      }

      const available = evaluateVisibility(field, values, dependencyResults);
      const result = fieldResult(field, values[field.id], available);
      visiting.delete(fieldId);
      byId[field.id] = result;
      return result;
    }

    const results = fields.map((field) => evaluateField(field.id));
    const blocking = results.filter((result) => result.available && !result.valid);

    return Object.freeze({
      results: Object.freeze(results),
      byId: Object.freeze(byId),
      valid: blocking.length === 0,
      firstInvalidId: blocking.length ? blocking[0].id : null,
    });
  }

  function stageDependencySatisfied(stage, fieldResults, stageResults) {
    for (const fieldId of stage.requiresFields || []) {
      const result = fieldResults[fieldId];
      if (!result) fail(`stage ${stage.id} references unknown prerequisite field ${fieldId}`);
      if (result.state !== STATES.VALID) return false;
    }

    for (const stageId of stage.requiresStages || []) {
      const result = stageResults[stageId];
      if (!result) fail(`stage ${stage.id} references a stage that has not been evaluated: ${stageId}`);
      if (result.state !== STATES.VALID) return false;
    }

    return true;
  }

  function evaluateProgression(stages, validation) {
    if (!Array.isArray(stages)) fail('stages must be an array');
    if (!validation || !validation.byId) fail('progression requires validateFields() output');

    const byId = Object.create(null);
    const results = [];

    for (const stage of stages) {
      if (!stage || !stage.id) fail('stage id is required');
      if (hasOwn(byId, stage.id)) fail(`duplicate stage id ${stage.id}`);

      const available = stageDependencySatisfied(stage, validation.byId, byId);
      if (!available) {
        const unavailable = Object.freeze({
          id: stage.id,
          state: STATES.UNAVAILABLE,
          available: false,
          complete: false,
          firstInvalidFieldId: null,
        });
        byId[stage.id] = unavailable;
        results.push(unavailable);
        continue;
      }

      const fieldIds = stage.fieldIds || [];
      const stageFields = fieldIds.map((fieldId) => {
        const result = validation.byId[fieldId];
        if (!result) fail(`stage ${stage.id} references unknown field ${fieldId}`);
        return result;
      });

      const blocking = stageFields.filter((result) => result.available && !result.valid);
      const firstBlocking = blocking[0] || null;
      const state = firstBlocking
        ? firstBlocking.state === STATES.INVALID
          ? STATES.INVALID
          : STATES.EMPTY
        : STATES.VALID;

      const evaluated = Object.freeze({
        id: stage.id,
        state,
        available: true,
        complete: state === STATES.VALID,
        firstInvalidFieldId: firstBlocking ? firstBlocking.id : null,
      });

      byId[stage.id] = evaluated;
      results.push(evaluated);
    }

    const firstIncomplete = results.find((stage) => stage.state !== STATES.VALID);

    return Object.freeze({
      results: Object.freeze(results),
      byId: Object.freeze(byId),
      complete: results.length === 0 || !firstIncomplete,
      firstIncompleteStageId: firstIncomplete ? firstIncomplete.id : null,
    });
  }

  const api = Object.freeze({
    STATES,
    evaluateCondition,
    isFieldAvailable,
    validateField,
    validateFields,
    evaluateProgression,
  });

  Object.defineProperty(globalThis, 'JILLFormEngine', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
