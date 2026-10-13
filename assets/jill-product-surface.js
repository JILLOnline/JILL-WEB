(() => {
  'use strict';

  const FIELD_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
  const ALLOWED_KEYS = new Set(['excludeFieldIds', 'alwaysAvailableFieldIds']);

  function fail(message) {
    throw new Error(`JILL product surface: ${message}`);
  }

  function cloneJson(value, label) {
    try {
      return JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
    } catch (error) {
      fail(`${label} JSON is invalid: ${error.message}`);
    }
  }

  function readFieldIds(value, label) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) fail(`${label} must be an array`);

    const ids = [];
    const seen = new Set();
    for (const fieldId of value) {
      if (typeof fieldId !== 'string' || !FIELD_ID_PATTERN.test(fieldId)) {
        fail(`${label} contains an invalid field id`);
      }
      if (seen.has(fieldId)) fail(`${label} contains duplicate field ${fieldId}`);
      seen.add(fieldId);
      ids.push(fieldId);
    }
    return ids;
  }

  function project(profileInput, overrideInput) {
    const profile = cloneJson(profileInput, 'profile');
    const surfaceOverride = cloneJson(overrideInput, 'surface override');

    if (!profile || typeof profile !== 'object' || Array.isArray(profile) || !Array.isArray(profile.fields)) {
      fail('profile must contain a fields array');
    }
    if (!surfaceOverride || typeof surfaceOverride !== 'object' || Array.isArray(surfaceOverride)) {
      fail('surface override must be an object');
    }

    for (const key of Object.keys(surfaceOverride)) {
      if (!ALLOWED_KEYS.has(key)) fail(`surface override has unsupported property ${key}`);
    }

    const excludeFieldIds = readFieldIds(surfaceOverride.excludeFieldIds, 'excludeFieldIds');
    const alwaysAvailableFieldIds = readFieldIds(surfaceOverride.alwaysAvailableFieldIds, 'alwaysAvailableFieldIds');
    const excluded = new Set(excludeFieldIds);
    const alwaysAvailable = new Set(alwaysAvailableFieldIds);
    const profileFieldIds = new Set(profile.fields.map((field) => field?.id));

    for (const fieldId of excluded) {
      if (!profileFieldIds.has(fieldId)) fail(`excludeFieldIds references unknown field ${fieldId}`);
    }
    for (const fieldId of alwaysAvailable) {
      if (!profileFieldIds.has(fieldId)) fail(`alwaysAvailableFieldIds references unknown field ${fieldId}`);
      if (excluded.has(fieldId)) fail(`field ${fieldId} cannot be both excluded and always available`);
    }

    const fields = profile.fields
      .filter((field) => !excluded.has(field.id))
      .map((field) => {
        const next = {...field};
        if (alwaysAvailable.has(field.id)) delete next.visibleWhen;
        return next;
      });

    for (const field of fields) {
      for (const condition of field.visibleWhen?.conditions || []) {
        if (excluded.has(condition.field)) {
          fail(`retained field ${field.id} depends on excluded field ${condition.field}`);
        }
      }
    }

    return {...profile, fields};
  }

  function projectRoot(root) {
    if (!root || root.dataset.jillProductSurfaceProjected === 'true') return;
    const profileNode = root.querySelector('[data-jill-product-capability-profile]');
    const overrideNode = root.querySelector('[data-jill-product-capability-surface-override]');
    if (!profileNode || !overrideNode) return;

    root.dataset.jillProductSurfaceProjected = 'true';
    try {
      const projected = project(profileNode.textContent.trim(), overrideNode.textContent.trim());
      profileNode.textContent = JSON.stringify(projected);
    } catch (error) {
      profileNode.textContent = 'null';
    }
  }

  function initializeWithin(scope) {
    const selector = '[data-jill-product][data-jill-capability-surface="product_page"]';
    for (const root of scope.querySelectorAll(selector)) projectRoot(root);
    if (scope.matches?.(selector)) projectRoot(scope);
  }

  if (typeof document !== 'undefined') {
    initializeWithin(document);
    document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
  }

  Object.defineProperty(globalThis, 'JILLProductSurface', {
    value: Object.freeze({project}),
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
