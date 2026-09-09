(() => {
  'use strict';

  function fail(message) {
    throw new Error(`JILL custom order: ${message}`);
  }

  function selectedItems(root) {
    return Array.from(root.querySelectorAll('[data-jill-custom-order-item]'))
      .filter((item) => item.querySelector('[data-jill-custom-order-select]')?.checked);
  }

  function setItemSelected(item, selected) {
    const details = item.querySelector('[data-jill-custom-order-details]');
    if (!details) return;
    details.hidden = !selected;
    details.setAttribute('aria-hidden', selected ? 'false' : 'true');
  }

  function validateSimpleControls(container) {
    const controls = Array.from(container.querySelectorAll('input, select, textarea'))
      .filter((control) => !control.disabled && control.type !== 'hidden');
    let firstInvalid = null;
    for (const control of controls) {
      const valid = control.checkValidity();
      if (!valid) {
        control.setAttribute('aria-invalid', 'true');
        firstInvalid ||= control;
      } else {
        control.removeAttribute('aria-invalid');
      }
    }
    return firstInvalid;
  }

  function validateProductForm(item) {
    const form = item.querySelector('[data-jill-custom-order-item-form]');
    if (!form) fail('selected product is missing its customization form');
    const event = new Event('submit', {bubbles: true, cancelable: true});
    const accepted = form.dispatchEvent(event);
    return {accepted, form};
  }

  function readProfile(form) {
    const node = form.querySelector('[data-jill-product-capability-profile]');
    if (!node) return null;
    return globalThis.JILLProductCapabilities.resolve(node.textContent.trim());
  }

  function readProductOptions(form) {
    const node = form.querySelector('[data-jill-product-options-payload]');
    if (!node?.value) return null;
    try {
      return JSON.parse(node.value);
    } catch (error) {
      fail('Product Options payload is invalid');
    }
  }

  function fieldValue(form, field) {
    const key = `properties[${field.id}]`;
    const controls = Array.from(form.elements).filter((control) => control.name === key);
    if (field.kind === 'radio') return controls.find((control) => control.checked)?.value ?? '';
    if (field.kind === 'checkbox') return Boolean(controls[0]?.checked);
    if (field.kind === 'file') return '';
    return controls[0]?.value ?? '';
  }

  function attribute(field, value) {
    return {id: field.id, label: field.label, value};
  }

  function customizationUnitIds(itemId, quantity, profile) {
    const multiplier = profile
      ? globalThis.JILLProductCapabilities.getCustomizationUnitsPerQuantity(profile)
      : 1;
    const count = quantity * multiplier;
    return Array.from({length: count}, (_, index) => `${itemId}::${index + 1}`);
  }

  function readAllocatedPersonalization(form, profile, itemId, quantity) {
    const node = form.querySelector('[data-jill-personalization-payload]');
    if (node?.value) {
      try {
        return JSON.parse(node.value);
      } catch (error) {
        fail('personalization payload is invalid');
      }
    }

    const allocatedIds = globalThis.JILLProductCapabilities.getPersonalizationAllocationFieldIds(profile);
    if (!allocatedIds.length) return null;
    if (!globalThis.JILLPersonalization) fail('personalization engine is unavailable');

    let state = globalThis.JILLPersonalization.createState({
      itemId,
      merchandiseQuantity: quantity,
      profile,
    });
    if (!state.available) return null;
    if (state.mode !== 'same') {
      fail('this product requires different-by-item personalization before review');
    }

    const groupId = state.groups[0]?.id;
    if (!groupId) fail('personalization group is unavailable');
    for (const fieldId of allocatedIds) {
      const field = globalThis.JILLProductCapabilities.getField(profile, fieldId);
      state = globalThis.JILLPersonalization.setGroupValue(
        state,
        profile,
        groupId,
        fieldId,
        fieldValue(form, field),
      );
    }
    if (!state.complete) fail('required personalization is incomplete');
    return globalThis.JILLPersonalization.toPayload(state);
  }

  function appendPersonalizationGroups(target, payload, profile) {
    if (!payload) return;
    for (const group of payload.allocations || []) {
      target.push({
        id: group.id,
        allocations: (group.unitIds || []).map((unitId) => ({unit_id: unitId})),
        attributes: Object.entries(group.values || {}).map(([fieldId, value]) => {
          const field = globalThis.JILLProductCapabilities.getField(profile, fieldId);
          return {id: fieldId, label: field?.label || fieldId, value};
        }),
      });
    }
  }

  function itemRequest(item) {
    const form = item.querySelector('[data-jill-custom-order-item-form]');
    const formData = new FormData(form);
    const quantity = Number(formData.get('quantity') || 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1) fail('selected product quantity is invalid');
    const variantId = String(formData.get('id') || '');
    if (!variantId) fail('selected product variant is unavailable');

    const productId = String(item.dataset.jillProductId || '');
    const title = item.dataset.productTitle || '';
    const itemId = `product:${productId}:variant:${variantId}`;
    const profile = readProfile(form);
    const attributes = [];
    const personalizationGroups = [];

    if (profile) {
      const productOptions = readProductOptions(form);
      if (productOptions) {
        for (const [fieldId, value] of Object.entries(productOptions.values || {})) {
          const field = globalThis.JILLProductCapabilities.getField(profile, fieldId);
          if (field) attributes.push(attribute(field, value));
        }
        if ((productOptions.allocations || []).length) {
          attributes.push({
            id: 'product_options',
            label: 'Product Options',
            value: JSON.stringify(productOptions.allocations),
          });
        }
      }

      const allocatedPersonalization = new Set(
        globalThis.JILLProductCapabilities.getPersonalizationAllocationFieldIds(profile),
      );
      const singletonPersonalization = (profile.groups.personalization || [])
        .filter((fieldId) => !allocatedPersonalization.has(fieldId))
        .map((fieldId) => globalThis.JILLProductCapabilities.getField(profile, fieldId))
        .map((field) => attribute(field, fieldValue(form, field)))
        .filter((entry) => entry.value !== '' && entry.value !== false);

      if (singletonPersonalization.length) {
        personalizationGroups.push({
          id: 'same',
          allocations: customizationUnitIds(itemId, quantity, profile).map((unitId) => ({unit_id: unitId})),
          attributes: singletonPersonalization,
        });
      }

      appendPersonalizationGroups(
        personalizationGroups,
        readAllocatedPersonalization(form, profile, itemId, quantity),
        profile,
      );
    }

    return {
      item_id: itemId,
      product_id: productId,
      variant_id: variantId,
      title,
      quantity,
      attributes,
      personalization_groups: personalizationGroups,
      reference_ids: [],
    };
  }

  function readNamed(container, name) {
    return container.querySelector(`[name="${name}"]`)?.value?.trim() || '';
  }

  function buildRequest(root) {
    const customer = root.querySelector('[data-jill-custom-order-customer]');
    const planning = root.querySelector('[data-jill-custom-order-planning]');
    const items = selectedItems(root).map(itemRequest);
    if (!items.length) fail('at least one product is required');

    const submissionId = globalThis.crypto?.randomUUID
      ? `jill:${globalThis.crypto.randomUUID()}`
      : `jill:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    const address = {
      city: readNamed(planning, 'city'),
      state: readNamed(planning, 'state'),
      postal_code: readNamed(planning, 'postal_code'),
    };
    for (const key of Object.keys(address)) if (!address[key]) delete address[key];

    return {
      version: 1,
      operation: 'custom_order.submit',
      submission_id: submissionId,
      submitted_at: new Date().toISOString(),
      customer: {
        name: readNamed(customer, 'name'),
        email: readNamed(customer, 'email').toLowerCase(),
        phone: readNamed(customer, 'phone') || undefined,
        preferred_contact: readNamed(customer, 'preferred_contact') || undefined,
      },
      planning: {
        event_date: readNamed(planning, 'event_date') || undefined,
        date_needed: readNamed(planning, 'date_needed') || undefined,
        fulfillment: readNamed(planning, 'fulfillment') || undefined,
        address: Object.keys(address).length ? address : undefined,
      },
      items,
      request_attributes: [],
      reference_ids: [],
      marketing_consent: {granted: false},
    };
  }

  function cleanUndefined(value) {
    if (Array.isArray(value)) return value.map(cleanUndefined);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, cleanUndefined(child)]),
    );
  }

  function renderReview(root, request) {
    const review = root.querySelector('[data-jill-custom-order-review]');
    const content = root.querySelector('[data-jill-custom-order-review-content]');
    if (!review || !content) return;

    const list = document.createElement('ul');
    for (const item of request.items) {
      const row = document.createElement('li');
      row.textContent = `${item.quantity} × ${item.title}`;
      list.append(row);
    }
    content.replaceChildren(list);
    review.hidden = false;
    review.setAttribute('aria-hidden', 'false');
    review.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  function initialize(root) {
    if (!root || root.dataset.jillCustomOrderInitialized === 'true') return;
    root.dataset.jillCustomOrderInitialized = 'true';

    for (const item of root.querySelectorAll('[data-jill-custom-order-item]')) {
      const select = item.querySelector('[data-jill-custom-order-select]');
      if (!select) continue;
      setItemSelected(item, select.checked);
      select.addEventListener('change', () => setItemSelected(item, select.checked));
    }

    const reviewButton = root.querySelector('.jill-custom-order__actions .jill-button');
    const status = root.querySelector('[data-jill-custom-order-status]');
    reviewButton?.addEventListener('click', () => {
      status.textContent = '';
      const customerInvalid = validateSimpleControls(root.querySelector('[data-jill-custom-order-customer]'));
      const planningInvalid = validateSimpleControls(root.querySelector('[data-jill-custom-order-planning]'));
      const items = selectedItems(root);
      if (!items.length) {
        status.textContent = 'Choose at least one product.';
        return;
      }

      for (const item of items) {
        const result = validateProductForm(item);
        if (!result.accepted) {
          status.textContent = `Complete the required options for ${item.dataset.productTitle}.`;
          result.form.querySelector('[aria-invalid="true"], input, select, textarea')?.focus();
          return;
        }
      }

      if (customerInvalid || planningInvalid) {
        status.textContent = 'Complete the required request details.';
        (customerInvalid || planningInvalid)?.focus();
        return;
      }

      try {
        const request = cleanUndefined(buildRequest(root));
        renderReview(root, request);
        root.dataset.jillCustomOrderRequest = JSON.stringify(request);
      } catch (error) {
        status.textContent = error.message.replace(/^JILL custom order:\s*/, '');
      }
    });
  }

  function initializeWithin(scope) {
    for (const root of scope.querySelectorAll('[data-jill-custom-order]')) initialize(root);
    if (scope.matches?.('[data-jill-custom-order]')) initialize(scope);
  }

  if (typeof document !== 'undefined') {
    initializeWithin(document);
    document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
  }

  Object.defineProperty(globalThis, 'JILLCustomOrder', {
    value: Object.freeze({itemRequest, buildRequest, cleanUndefined}),
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
