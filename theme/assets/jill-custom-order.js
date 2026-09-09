(() => {
  'use strict';

  const variantStates = new WeakMap();

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

  function requestedProductHandle(search = globalThis.location?.search || '') {
    try {
      return String(new URLSearchParams(search).get('product') || '').trim();
    } catch (error) {
      return '';
    }
  }

  function applyCatalogPrefill(root, search) {
    const handle = requestedProductHandle(search);
    if (!handle) return false;
    const item = Array.from(root.querySelectorAll('[data-jill-custom-order-item]'))
      .find((candidate) => candidate.dataset.productHandle === handle);
    const select = item?.querySelector('[data-jill-custom-order-select]');
    if (!item || !select) return false;
    select.checked = true;
    setItemSelected(item, true);
    root.dataset.jillCustomOrderPrefilled = 'true';
    return true;
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

  function variantMount(item) {
    return item.querySelector('[data-jill-variant-allocation]');
  }

  function readVariantCatalog(form) {
    const node = form.querySelector('[data-jill-variant-catalog]');
    if (!node) return null;
    try {
      const variants = JSON.parse(node.textContent.trim());
      if (!Array.isArray(variants) || variants.length < 2) fail('variant catalog is invalid');
      return variants;
    } catch (error) {
      if (String(error.message).startsWith('JILL custom order:')) throw error;
      fail('variant catalog is invalid');
    }
  }

  function readMerchandiseQuantity(form) {
    const control = form.querySelector('[name="quantity"]');
    const quantity = Number(control?.value);
    if (!control || !control.validity.valid || !Number.isSafeInteger(quantity) || quantity < 1) return null;
    return quantity;
  }

  function itemRuntimeId(item) {
    const productId = String(item.dataset.jillProductId || '').trim();
    if (!productId) fail('selected product id is unavailable');
    return `shopify-product:${productId}`;
  }

  function normalizeVariantPayload(form, item) {
    const catalog = readVariantCatalog(form);
    if (!catalog) return null;
    if (!globalThis.JILLVariantAllocation) fail('variant allocation engine is unavailable');
    const quantity = readMerchandiseQuantity(form);
    if (quantity === null) fail('selected product quantity is invalid');
    const payloadNode = form.querySelector('[data-jill-variant-allocation-payload]');
    if (!payloadNode?.value) fail('variation allocation is incomplete');

    let payload;
    try {
      payload = JSON.parse(payloadNode.value);
    } catch (error) {
      fail('variation allocation is invalid');
    }

    const state = globalThis.JILLVariantAllocation.createState({
      itemId: itemRuntimeId(item),
      merchandiseQuantity: quantity,
      variants: catalog,
      allocations: (payload.allocations || []).map((allocation) => ({
        id: allocation.id,
        variantId: allocation.variantId,
        unitIds: allocation.unitIds,
      })),
    });
    if (!state.complete) fail('variation allocation is incomplete');
    return globalThis.JILLVariantAllocation.toPayload(state);
  }

  function variantAllocationFocusTarget(item) {
    const mount = variantMount(item);
    if (!mount) return null;
    const state = variantStates.get(item);
    if (state?.unallocatedUnitIds.length) {
      const add = mount.querySelector('[data-jill-variant-allocation-add]');
      if (add && !add.hidden) return add;
    }
    return mount.querySelector('select, input, button');
  }

  function validateVariantAllocation(item) {
    const mount = variantMount(item);
    if (!mount) return {accepted: true, focusControl: null};
    const state = variantStates.get(item);
    const accepted = Boolean(state?.complete);
    mount.dataset.state = accepted ? 'complete' : 'incomplete';
    return {accepted, focusControl: accepted ? null : variantAllocationFocusTarget(item)};
  }

  function initializeVariantAllocation(item) {
    const mount = variantMount(item);
    if (!mount || mount.dataset.jillVariantAllocationInitialized === 'true') return;
    const form = item.querySelector('[data-jill-custom-order-item-form]');
    const quantityControl = form?.querySelector('[name="quantity"]');
    const payloadNode = form?.querySelector('[data-jill-variant-allocation-payload]');
    const groupsNode = mount.querySelector('[data-jill-variant-allocation-groups]');
    const addButton = mount.querySelector('[data-jill-variant-allocation-add]');
    const summary = mount.querySelector('[data-jill-variant-allocation-summary]');
    const quantityTemplate = mount.querySelector('[data-jill-variant-quantity-template]');
    const allocator = globalThis.JILLVariantAllocation;
    const quantity = globalThis.JILLQuantity;
    if (!form || !quantityControl || !payloadNode || !groupsNode || !addButton || !summary || !quantityTemplate || !allocator || !quantity) {
      mount.dataset.state = 'error';
      return;
    }

    let catalog;
    try {
      catalog = readVariantCatalog(form);
    } catch (error) {
      mount.dataset.state = 'error';
      return;
    }
    if (!catalog) return;

    let state;
    try {
      state = allocator.createState({
        itemId: itemRuntimeId(item),
        merchandiseQuantity: Number(quantityControl.value),
        variants: catalog,
      });
    } catch (error) {
      mount.dataset.state = 'error';
      return;
    }

    variantStates.set(item, state);
    mount.dataset.jillVariantAllocationInitialized = 'true';

    function syncPayload() {
      payloadNode.value = JSON.stringify(allocator.toPayload(state));
      mount.dataset.state = state.complete ? 'complete' : 'incomplete';
    }

    function createVariantSelect(group, groupIndex) {
      const shell = document.createElement('div');
      shell.className = 'jill-field';
      const id = `JillVariantAllocation-${item.dataset.jillProductId}-${group.id}`;
      const label = document.createElement('label');
      label.className = 'jill-field__label';
      label.htmlFor = id;
      label.textContent = `${mount.dataset.selectLabel} ${groupIndex + 1}`;
      const select = document.createElement('select');
      select.className = 'jill-field__control';
      select.id = id;
      select.required = true;

      for (const variant of allocator.getAvailableVariants(state, group.id)) {
        const option = document.createElement('option');
        option.value = variant.id;
        option.textContent = variant.priceLabel ? `${variant.title} — ${variant.priceLabel}` : variant.title;
        option.selected = variant.id === group.variantId;
        select.append(option);
      }

      select.addEventListener('change', () => {
        try {
          state = allocator.setGroupVariant(state, group.id, select.value);
          variantStates.set(item, state);
          render();
        } catch (error) {
          render();
        }
      });
      shell.append(label, select);
      return shell;
    }

    function createCountField(group, groupIndex) {
      const shell = quantityTemplate.content.firstElementChild?.cloneNode(true);
      if (!shell) fail('variation quantity template is unavailable');
      const input = quantity.configure(shell, {
        id: `JillVariantCount-${item.dataset.jillProductId}-${group.id}`,
        label: mount.dataset.countLabel,
        accessibleLabel: `${mount.dataset.groupLabel} ${groupIndex + 1}: ${mount.dataset.countLabel}`,
        value: group.quantity,
        min: 1,
        max: group.quantity + state.unallocatedUnitIds.length,
        step: 1,
        required: true,
      });
      input.addEventListener('change', () => {
        try {
          state = allocator.setGroupCount(state, group.id, Number(input.value));
          variantStates.set(item, state);
          render();
        } catch (error) {
          render();
        }
      });
      return shell;
    }

    function createGroup(group, groupIndex) {
      const container = document.createElement('div');
      container.className = 'jill-product-customization__group';
      container.dataset.jillVariantAllocationGroup = group.id;
      const heading = document.createElement('h4');
      heading.className = 'jill-product-customization__group-title';
      heading.textContent = `${mount.dataset.groupLabel} ${groupIndex + 1}`;
      container.append(heading, createVariantSelect(group, groupIndex), createCountField(group, groupIndex));

      if (state.groups.length > 1) {
        const remove = document.createElement('button');
        remove.className = 'jill-button';
        remove.dataset.variant = 'secondary';
        remove.type = 'button';
        remove.textContent = mount.dataset.removeLabel;
        remove.addEventListener('click', () => {
          try {
            state = allocator.removeGroup(state, group.id);
            variantStates.set(item, state);
            render();
          } catch (error) {
            render();
          }
        });
        container.append(remove);
      }
      return container;
    }

    function render() {
      syncPayload();
      groupsNode.replaceChildren(...state.groups.map(createGroup));
      const unallocated = state.unallocatedUnitIds.length;
      const assigned = state.merchandiseQuantity - unallocated;
      summary.hidden = unallocated === 0;
      summary.textContent = unallocated
        ? `${assigned} ${mount.dataset.ofLabel} ${state.merchandiseQuantity} ${mount.dataset.assignedLabel} — ${unallocated} ${mount.dataset.unassignedLabel}`
        : '';
      addButton.hidden = !allocator.canAddGroup(state);
      mount.hidden = false;
      mount.setAttribute('aria-hidden', 'false');
    }

    addButton.addEventListener('click', () => {
      try {
        state = allocator.addGroup(state);
        variantStates.set(item, state);
        render();
      } catch (error) {
        render();
      }
    });

    const reconcile = () => {
      const nextQuantity = readMerchandiseQuantity(form);
      if (nextQuantity === null) return;
      try {
        state = allocator.reconcileQuantity(state, nextQuantity);
        variantStates.set(item, state);
        render();
      } catch (error) {
        mount.dataset.state = 'error';
      }
    };
    quantityControl.addEventListener('change', reconcile);
    quantityControl.addEventListener('input', reconcile);
    render();
  }

  function validateProductForm(item) {
    const variantResult = validateVariantAllocation(item);
    if (!variantResult.accepted) {
      return {accepted: false, form: item.querySelector('[data-jill-custom-order-item-form]'), focusControl: variantResult.focusControl};
    }

    const form = item.querySelector('[data-jill-custom-order-item-form]');
    if (!form) fail('selected product is missing its customization form');
    const event = new Event('submit', {bubbles: true, cancelable: true});
    const accepted = form.dispatchEvent(event);
    return {accepted, form, focusControl: null};
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
    const multiplier = profile ? globalThis.JILLProductCapabilities.getCustomizationUnitsPerQuantity(profile) : 1;
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

    let state = globalThis.JILLPersonalization.createState({itemId, merchandiseQuantity: quantity, profile});
    if (!state.available) return null;
    if (state.mode !== 'same') fail('this product requires different-by-item personalization before review');

    const groupId = state.groups[0]?.id;
    if (!groupId) fail('personalization group is unavailable');
    for (const fieldId of allocatedIds) {
      const field = globalThis.JILLProductCapabilities.getField(profile, fieldId);
      state = globalThis.JILLPersonalization.setGroupValue(state, profile, groupId, fieldId, fieldValue(form, field));
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

    const productId = String(item.dataset.jillProductId || '');
    const title = item.dataset.productTitle || '';
    const itemId = itemRuntimeId(item);
    const profile = readProfile(form);
    const variantAllocation = normalizeVariantPayload(form, item);
    const variantId = variantAllocation ? '' : String(formData.get('id') || '');
    if (!variantAllocation && !variantId) fail('selected product variant is unavailable');
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
          attributes.push({id: 'product_options', label: 'Product Options', value: JSON.stringify(productOptions.allocations)});
        }
      }

      const allocatedPersonalization = new Set(globalThis.JILLProductCapabilities.getPersonalizationAllocationFieldIds(profile));
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

      appendPersonalizationGroups(personalizationGroups, readAllocatedPersonalization(form, profile, itemId, quantity), profile);
    }

    return {
      item_id: itemId,
      product_id: productId,
      variant_id: variantId || undefined,
      variant_allocations: variantAllocation?.allocations.map((allocation) => ({
        variant_id: allocation.variantId,
        title: allocation.variantTitle,
        quantity: allocation.quantity,
        unit_ids: [...allocation.unitIds],
      })),
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
      if (item.variant_allocations?.length) {
        const variants = document.createElement('ul');
        for (const allocation of item.variant_allocations) {
          const variant = document.createElement('li');
          variant.textContent = `${allocation.quantity} × ${allocation.title}`;
          variants.append(variant);
        }
        row.append(variants);
      }
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

    for (const item of root.querySelectorAll('[data-jill-custom-order-item]')) initializeVariantAllocation(item);

    for (const item of root.querySelectorAll('[data-jill-custom-order-item]')) {
      const select = item.querySelector('[data-jill-custom-order-select]');
      if (!select) continue;
      setItemSelected(item, select.checked);
      select.addEventListener('change', () => setItemSelected(item, select.checked));
    }

    applyCatalogPrefill(root);

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
          const mount = variantMount(item);
          status.textContent = mount && mount.dataset.state !== 'complete'
            ? mount.dataset.incompleteLabel
            : `Complete the required options for ${item.dataset.productTitle}.`;
          (result.focusControl || result.form.querySelector('[aria-invalid="true"], input, select, textarea'))?.focus();
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
    value: Object.freeze({
      itemRequest,
      buildRequest,
      cleanUndefined,
      normalizeVariantPayload,
      requestedProductHandle,
      applyCatalogPrefill,
    }),
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
