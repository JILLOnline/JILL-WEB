(() => {
  'use strict';

  function fail(message) {
    throw new Error(`JILL product commerce: ${message}`);
  }

  function dependencies() {
    const capabilities = globalThis.JILLProductCapabilities;
    const planner = globalThis.JILLCommerceAdjustments;
    const cart = globalThis.JILLCommerceCart;
    if (!capabilities) fail('JILLProductCapabilities is required');
    if (!planner) fail('JILLCommerceAdjustments is required');
    if (!cart) fail('JILLCommerceCart is required');
    return {capabilities, planner, cart};
  }

  function propertyKey(fieldId) {
    return `properties[${fieldId}]`;
  }

  function readScalarField(formData, field) {
    const key = propertyKey(field.id);
    if (field.kind === 'checkbox') return formData.has(key);

    const value = formData.get(key);
    if (value === null) return '';
    if (typeof File !== 'undefined' && value instanceof File) {
      fail(`field ${field.id} requires the durable upload adapter before paid submission`);
    }
    if (typeof value !== 'string') fail(`field ${field.id} has an unsupported form value`);
    if (field.kind === 'number') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : value;
    }
    return value;
  }

  function parsePayload(node, label) {
    if (!node || typeof node.value !== 'string' || !node.value.trim()) fail(`${label} payload is unavailable`);
    try {
      return JSON.parse(node.value);
    } catch (error) {
      fail(`${label} payload is invalid`);
    }
  }

  function collectLineProperties(formData) {
    const properties = Object.create(null);
    for (const [name, value] of formData.entries()) {
      const match = /^properties\[(.+)]$/.exec(name);
      if (!match) continue;
      if (typeof File !== 'undefined' && value instanceof File) {
        if (!value.name && value.size === 0) continue;
        fail('paid submission requires durable upload references instead of raw files');
      }
      if (typeof value !== 'string') fail(`line property ${match[1]} must be a string`);
      properties[match[1]] = value;
    }
    return properties;
  }

  function adjustmentGroups(profile, rules, capabilities) {
    const groups = new Set();
    for (const rule of rules) {
      const field = capabilities.getField(profile, rule.when.field);
      if (!field) fail(`commerce adjustment ${rule.id} references an unknown field`);
      groups.add(field.group);
    }
    return groups;
  }

  function personalizationPayload(profile, form, formData, rules, capabilities) {
    const personalizationRules = rules.filter((rule) => {
      const field = capabilities.getField(profile, rule.when.field);
      return field?.group === 'personalization';
    });
    if (!personalizationRules.length) return null;

    const allocatedIds = new Set(capabilities.getPersonalizationAllocationFieldIds(profile));
    const targetsAllocatedField = personalizationRules.some((rule) => allocatedIds.has(rule.when.field));
    if (targetsAllocatedField) {
      return parsePayload(
        form.querySelector('[data-jill-personalization-payload]'),
        'personalization allocation',
      );
    }

    const values = Object.create(null);
    for (const fieldId of profile.groups.personalization || []) {
      if (allocatedIds.has(fieldId)) continue;
      const field = capabilities.getField(profile, fieldId);
      values[fieldId] = readScalarField(formData, field);
    }

    return {
      complete: true,
      values,
      allocations: [],
    };
  }

  function buildPlan({profile, form, formData, merchandiseQuantity}) {
    const {capabilities, planner} = dependencies();
    const rules = capabilities.getCommerceAdjustments(profile);
    if (!rules.length) return {version: 1, adjustments: []};

    const groups = adjustmentGroups(profile, rules, capabilities);
    const input = {profile, merchandiseQuantity};

    if (groups.has('product_options')) {
      input.productOptions = parsePayload(
        form.querySelector('[data-jill-product-options-payload]'),
        'Product Options',
      );
    }
    if (groups.has('personalization')) {
      input.personalization = personalizationPayload(profile, form, formData, rules, capabilities);
    }

    return planner.plan(input);
  }

  function initializeProduct(root) {
    if (!root || root.dataset.jillProductCommerceInitialized === 'true') return;
    const form = root.querySelector('.jill-product-form');
    const profileNode = form?.querySelector('[data-jill-product-capability-profile]');
    if (!form || !profileNode) return;

    let profile;
    let rules;
    try {
      const {capabilities} = dependencies();
      profile = capabilities.resolve(profileNode.textContent.trim());
      rules = capabilities.getCommerceAdjustments(profile);
    } catch (error) {
      return;
    }
    if (!rules.length) return;

    root.dataset.jillProductCommerceInitialized = 'true';
    const status = root.querySelector('[data-jill-product-status]');
    const submitButton = form.querySelector('.jill-button[type="submit"]');
    let submitting = false;

    function setStatus(message) {
      if (status) status.textContent = message || '';
    }

    function setSubmitting(pending, wasDisabled = false) {
      submitting = pending;
      if (!submitButton) return;
      submitButton.disabled = pending || wasDisabled;
      submitButton.setAttribute('aria-disabled', submitButton.disabled ? 'true' : 'false');
    }

    form.addEventListener('submit', (event) => {
      if (event.defaultPrevented) return;
      if (submitting) {
        event.preventDefault();
        return;
      }

      let formData;
      let quantity;
      let variantId;
      let plan;
      let properties;

      try {
        formData = new FormData(form);
        quantity = Number(formData.get('quantity') || 1);
        if (!Number.isSafeInteger(quantity) || quantity < 1) fail('quantity is invalid');
        variantId = formData.get('id');
        if (typeof variantId !== 'string' || !variantId) fail('variant is unavailable');
        plan = buildPlan({profile, form, formData, merchandiseQuantity: quantity});
        if (!plan.adjustments.length) return;
        properties = collectLineProperties(formData);
      } catch (error) {
        event.preventDefault();
        setStatus(status?.dataset.cartError || status?.dataset.configError || 'This product is temporarily unavailable.');
        return;
      }

      event.preventDefault();
      const wasDisabled = Boolean(submitButton?.disabled);
      setSubmitting(true, wasDisabled);
      setStatus(status?.dataset.cartAdding || 'Adding to cart…');

      dependencies().cart.add({
        variantId,
        quantity,
        properties,
        plan,
      }).then(() => {
        const rootPath = globalThis.Shopify?.routes?.root || '/';
        globalThis.location.assign(`${rootPath}cart`);
      }).catch(() => {
        setSubmitting(false, wasDisabled);
        setStatus(status?.dataset.cartError || 'We could not add this configured item to your cart. Please try again.');
      });
    });
  }

  function initializeWithin(scope) {
    for (const root of scope.querySelectorAll('[data-jill-product]')) initializeProduct(root);
  }

  if (typeof document !== 'undefined') {
    initializeWithin(document);
    document.addEventListener('shopify:section:load', (event) => {
      initializeWithin(event.target);
      if (event.target.matches?.('[data-jill-product]')) initializeProduct(event.target);
    });
  }

  const api = Object.freeze({collectLineProperties, buildPlan});
  Object.defineProperty(globalThis, 'JILLProductCommerce', {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
