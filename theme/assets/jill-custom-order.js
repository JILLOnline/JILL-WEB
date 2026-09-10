(() => {
  'use strict';

  const variantStates = new WeakMap();

  function fail(message) {
    throw new Error(`JILL custom order: ${message}`);
  }

  function productChoices(root) {
    return Array.from(root.querySelectorAll('[data-jill-product-choice]'));
  }

  function selectedChoices(root) {
    return productChoices(root).filter((choice) => choice.querySelector('[data-jill-custom-order-select]')?.checked);
  }

  function itemForProduct(root, productId) {
    return Array.from(root.querySelectorAll('[data-jill-custom-order-item]'))
      .find((item) => String(item.dataset.jillProductId) === String(productId)) || null;
  }

  function selectedItems(root) {
    return selectedChoices(root)
      .map((choice) => itemForProduct(root, choice.dataset.productId))
      .filter(Boolean);
  }

  function setItemSelected(item, selected) {
    if (!item) return;
    item.hidden = !selected;
    item.setAttribute('aria-hidden', selected ? 'false' : 'true');
  }

  function syncSelectedItems(root) {
    const selectedIds = new Set(selectedChoices(root).map((choice) => String(choice.dataset.productId)));
    for (const item of root.querySelectorAll('[data-jill-custom-order-item]')) {
      setItemSelected(item, selectedIds.has(String(item.dataset.jillProductId)));
    }
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
    const choice = productChoices(root).find((candidate) => candidate.dataset.productHandle === handle);
    const select = choice?.querySelector('[data-jill-custom-order-select]');
    if (!choice || !select) return false;
    select.checked = true;
    syncSelectedItems(root);
    root.dataset.jillCustomOrderPrefilled = 'true';
    return true;
  }

  function controlKind(control) {
    if (control.tagName === 'SELECT') return 'select';
    if (control.type === 'checkbox') return 'checkbox';
    if (control.type === 'radio') return 'radio';
    if (control.type === 'number') return 'number';
    if (control.type === 'date') return 'date';
    if (control.type === 'file') return 'file';
    if (control.tagName === 'TEXTAREA') return 'textarea';
    return 'text';
  }

  function safeFieldId(source, index) {
    const normalized = String(source || `field_${index + 1}`)
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/^([^A-Za-z])/, 'f_$1');
    return normalized || `field_${index + 1}`;
  }

  function controlDefinition(control, index, container) {
    const kind = controlKind(control);
    const field = {
      id: safeFieldId(control.name || control.id, index),
      kind,
      required: Boolean(control.required),
    };
    if (kind === 'select') {
      field.options = Array.from(control.options)
        .map((option) => ({value: option.value}))
        .filter((option) => option.value !== '');
    }
    if (kind === 'radio') {
      field.options = Array.from(container.querySelectorAll('input[type="radio"]'))
        .filter((candidate) => candidate.name === control.name)
        .map((option) => ({value: option.value}))
        .filter((option) => option.value !== '');
    }
    if (kind === 'number') {
      if (control.min !== '') field.min = Number(control.min);
      if (control.max !== '') field.max = Number(control.max);
      if (control.step !== '' && control.step !== 'any') field.step = Number(control.step);
    }
    if (kind === 'text' || kind === 'textarea') {
      if (control.minLength >= 0) field.minLength = control.minLength;
      if (control.maxLength >= 0) field.maxLength = control.maxLength;
    }
    return field;
  }

  function controlValue(control, container) {
    if (control.type === 'checkbox') return control.checked;
    if (control.type === 'radio') {
      return Array.from(container.querySelectorAll('input[type="radio"]'))
        .find((candidate) => candidate.name === control.name && candidate.checked)?.value || '';
    }
    if (control.type === 'file') return Array.from(control.files || []);
    return control.value;
  }

  function validateControlGroup(container, showErrors = false) {
    if (!container || !globalThis.JILLFormEngine) return {valid: false, firstInvalid: null};
    const rawControls = Array.from(container.querySelectorAll('input, select, textarea'))
      .filter((control) => !control.disabled && control.type !== 'hidden');
    const controls = [];
    const seenRadioNames = new Set();
    for (const control of rawControls) {
      if (control.type === 'radio') {
        if (seenRadioNames.has(control.name)) continue;
        seenRadioNames.add(control.name);
      }
      controls.push(control);
    }

    const fields = controls.map((control, index) => controlDefinition(control, index, container));
    const values = Object.create(null);
    fields.forEach((field, index) => {
      values[field.id] = controlValue(controls[index], container);
    });
    const validation = globalThis.JILLFormEngine.validateFields(fields, values);
    let firstInvalid = null;

    fields.forEach((field, index) => {
      const control = controls[index];
      const result = validation.byId[field.id];
      const valid = result.valid && control.checkValidity();
      if (!valid && !firstInvalid) firstInvalid = control;
      if (showErrors && !valid) control.setAttribute('aria-invalid', 'true');
      else if (valid) control.removeAttribute('aria-invalid');
    });

    return {valid: validation.valid && !firstInvalid, firstInvalid};
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

    function notify() {
      item.dispatchEvent(new CustomEvent('jill:custom-order-item-state', {bubbles: true}));
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
      notify();
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
        notify();
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

  function labeledProductOptionAllocations(profile, allocations) {
    return (allocations || []).map((group) => ({
      id: group.id,
      unit_ids: [...(group.unitIds || [])],
      attributes: Object.entries(group.values || {}).map(([fieldId, value]) => {
        const field = globalThis.JILLProductCapabilities.getField(profile, fieldId);
        return {id: fieldId, label: field?.label || fieldId, value};
      }),
    }));
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
          if (field && value !== '' && value !== false) attributes.push(attribute(field, value));
        }
        if ((productOptions.allocations || []).length) {
          attributes.push({
            id: 'product_options',
            label: 'Product Options',
            value: JSON.stringify(labeledProductOptionAllocations(profile, productOptions.allocations)),
          });
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

    const collectionIds = String(item.dataset.collectionHandles || '')
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);

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
      collection_ids: [...new Set(collectionIds)],
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
    if (readNamed(planning, 'fulfillment') !== 'shipping') {
      delete address.city;
      delete address.state;
      delete address.postal_code;
    } else {
      for (const key of Object.keys(address)) if (!address[key]) delete address[key];
    }

    const granted = Boolean(root.querySelector('[data-jill-marketing-consent]')?.checked);
    const submittedAt = new Date().toISOString();

    return {
      version: 1,
      operation: 'custom_order.submit',
      submission_id: submissionId,
      submitted_at: submittedAt,
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
      marketing_consent: {
        granted,
        recorded_at: granted ? submittedAt : undefined,
        source: granted ? 'custom_order_form' : undefined,
      },
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

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function reviewRow(label, value) {
    if (value === '' || value === undefined || value === null || value === false) return null;
    const row = node('div', 'jill-custom-order-review__row');
    row.append(node('dt', 'jill-custom-order-review__key', label), node('dd', 'jill-custom-order-review__value', value));
    return row;
  }

  function appendRows(host, rows) {
    rows.filter(Boolean).forEach((row) => host.append(row));
  }

  function displayValue(value) {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value ?? '');
  }

  function productOptionReview(item, host) {
    const encoded = item.attributes.find((entry) => entry.id === 'product_options')?.value;
    if (!encoded) return;
    let groups = [];
    try { groups = JSON.parse(encoded); } catch (error) { return; }
    groups.forEach((group, index) => {
      const block = node('div', 'jill-custom-order-review__subgroup');
      const count = group.unit_ids?.length || 0;
      block.append(node('h5', '', `Option ${index + 1}${count ? ` — ${count} item${count === 1 ? '' : 's'}` : ''}`));
      const details = node('dl', 'jill-custom-order-review__details');
      appendRows(details, (group.attributes || []).map((entry) => reviewRow(entry.label || entry.id, displayValue(entry.value))));
      block.append(details);
      host.append(block);
    });
  }

  function renderReview(root, request) {
    const review = root.querySelector('[data-jill-custom-order-review]');
    const content = root.querySelector('[data-jill-custom-order-review-content]');
    if (!review || !content) return;
    const sheet = node('div', 'jill-custom-order-review');

    const customerSection = node('section', 'jill-custom-order-review__section');
    customerSection.append(node('h3', '', 'Customer info'));
    const customerDetails = node('dl', 'jill-custom-order-review__details');
    appendRows(customerDetails, [
      reviewRow('Name', request.customer.name),
      reviewRow('Email', request.customer.email),
      reviewRow('Phone', request.customer.phone),
      reviewRow('Preferred contact', request.customer.preferred_contact),
    ]);
    customerSection.append(customerDetails);
    sheet.append(customerSection);

    const itemsSection = node('section', 'jill-custom-order-review__section');
    itemsSection.append(node('h3', '', 'Items'));
    request.items.forEach((item) => {
      const article = node('article', 'jill-custom-order-review__item');
      article.append(node('h4', '', `${item.quantity} × ${item.title}`));
      if (item.variant_allocations?.length) {
        const variants = node('dl', 'jill-custom-order-review__details');
        item.variant_allocations.forEach((allocation) => variants.append(reviewRow('Variation', `${allocation.quantity} × ${allocation.title}`)));
        article.append(variants);
      }
      const singleton = item.attributes.filter((entry) => entry.id !== 'product_options');
      if (singleton.length) {
        const options = node('dl', 'jill-custom-order-review__details');
        appendRows(options, singleton.map((entry) => reviewRow(entry.label || entry.id, displayValue(entry.value))));
        article.append(options);
      }
      productOptionReview(item, article);
      item.personalization_groups.forEach((group, index) => {
        if (!group.attributes.length) return;
        const block = node('div', 'jill-custom-order-review__subgroup');
        const count = group.allocations?.length || 0;
        const sequence = item.personalization_groups.length > 1 ? ` ${index + 1}` : '';
        block.append(node('h5', '', `Personalization${sequence}${count ? ` — ${count} item${count === 1 ? '' : 's'}` : ''}`));
        const details = node('dl', 'jill-custom-order-review__details');
        appendRows(details, group.attributes.map((entry) => reviewRow(entry.label || entry.id, displayValue(entry.value))));
        block.append(details);
        article.append(block);
      });
      itemsSection.append(article);
    });
    sheet.append(itemsSection);

    const planningSection = node('section', 'jill-custom-order-review__section');
    planningSection.append(node('h3', '', 'Event & fulfillment'));
    const planningDetails = node('dl', 'jill-custom-order-review__details');
    const address = request.planning.address;
    appendRows(planningDetails, [
      reviewRow('Event date', request.planning.event_date),
      reviewRow('Date needed', request.planning.date_needed),
      reviewRow('Fulfillment', request.planning.fulfillment),
      reviewRow('Location', address ? [address.city, address.state, address.postal_code].filter(Boolean).join(', ') : ''),
    ]);
    planningSection.append(planningDetails);
    sheet.append(planningSection);

    content.replaceChildren(sheet);
    review.hidden = false;
    review.setAttribute('aria-hidden', 'false');
  }

  function addBusinessDays(date, days) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let remaining = days;
    while (remaining > 0) {
      result.setDate(result.getDate() + 1);
      const weekday = result.getDay();
      if (weekday !== 0 && weekday !== 6) remaining -= 1;
    }
    const year = result.getFullYear();
    const month = String(result.getMonth() + 1).padStart(2, '0');
    const day = String(result.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setStageVisible(stage, visible) {
    if (!stage) return;
    stage.hidden = !visible;
    stage.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function itemCompletionIssue(item) {
    const variant = validateVariantAllocation(item);
    if (!variant.accepted) return {item, target: variant.focusControl};
    const form = item.querySelector('[data-jill-custom-order-item-form]');
    const native = validateControlGroup(form, false);
    const optionPayload = form.querySelector('[data-jill-product-options-payload]');
    if (optionPayload?.value) {
      try {
        if (!JSON.parse(optionPayload.value).complete) {
          return {item, target: form.querySelector('[data-jill-product-options-allocation], [data-jill-capability-group="product_options"]')};
        }
      } catch (error) {
        return {item, target: optionPayload};
      }
    }
    const personalization = form.querySelector('[data-jill-personalization-allocation]');
    if (personalization && !personalization.hidden && personalization.dataset.jillPersonalizationComplete !== 'true') {
      return {item, target: personalization};
    }
    if (!native.valid) return {item, target: native.firstInvalid};
    return null;
  }

  function firstIncompleteItem(root) {
    for (const item of selectedItems(root)) {
      const issue = itemCompletionIssue(item);
      if (issue) return issue;
    }
    return null;
  }

  function updateItemStatuses(root) {
    for (const item of selectedItems(root)) {
      const status = item.querySelector('[data-jill-item-status]');
      if (!status) continue;
      const complete = !itemCompletionIssue(item);
      status.textContent = complete ? 'Complete ✓' : 'Incomplete';
      status.dataset.tone = complete ? 'success' : 'error';
    }
  }

  function stageFocus(stage) {
    stage?.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus();
  }

  function scrollToTarget(target) {
    if (!target) return;
    const element = target.closest?.('.jill-field, .jill-product-customization__group, .jill-custom-order-item') || target;
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    setTimeout(() => target.focus?.({preventScroll: true}), 250);
  }

  function endpointPayload(request) {
    const collections = [...new Set(request.items.flatMap((item) => item.collection_ids || []))];
    return {
      source: 'JILL custom order',
      submission_id: request.submission_id,
      submitted_at: request.submitted_at,
      name: request.customer.name,
      email: request.customer.email,
      phone: request.customer.phone || '',
      preferred_contact: request.customer.preferred_contact || '',
      event_date: request.planning.event_date || '',
      date_needed: request.planning.date_needed || '',
      fulfillment: request.planning.fulfillment || '',
      city: request.planning.address?.city || '',
      state: request.planning.address?.state || '',
      zip: request.planning.address?.postal_code || '',
      theme: '',
      colors: '',
      collections: collections.join(', '),
      products: request.items.map((item) => `${item.quantity} × ${item.title}`).join('\n'),
      reference_images: request.reference_ids.length ? 'Yes' : 'No',
      marketing_consent: request.marketing_consent.granted ? 'Yes' : 'No',
      marketing_consent_at: request.marketing_consent.recorded_at || '',
      marketing_consent_source: request.marketing_consent.source || '',
      raw_payload: JSON.stringify(request),
    };
  }

  async function submitRequest(root, request) {
    const endpoint = String(root.dataset.submitEndpoint || '').trim();
    if (!endpoint) fail('submission is temporarily unavailable');
    const selectedFiles = selectedItems(root)
      .flatMap((item) => Array.from(item.querySelectorAll('input[type="file"]')))
      .flatMap((input) => Array.from(input.files || []));
    if (selectedFiles.length) {
      fail('reference image delivery is not available in Theme Core yet; remove the files and include the reference when JILL follows up');
    }
    const body = new URLSearchParams();
    Object.entries(endpointPayload(request)).forEach(([key, value]) => body.set(key, String(value ?? '')));
    await fetch(endpoint, {method: 'POST', mode: 'no-cors', keepalive: true, body});
  }

  function initialize(root) {
    if (!root || root.dataset.jillCustomOrderInitialized === 'true') return;
    root.dataset.jillCustomOrderInitialized = 'true';

    const customerStage = root.querySelector('[data-jill-stage="customer"]');
    const productsStage = root.querySelector('[data-jill-stage="products"]');
    const configurationStage = root.querySelector('[data-jill-stage="configuration"]');
    const planningStage = root.querySelector('[data-jill-stage="planning"]');
    const finalStage = root.querySelector('[data-jill-stage="final"]');
    const customer = root.querySelector('[data-jill-custom-order-customer]');
    const planning = root.querySelector('[data-jill-custom-order-planning]');
    const shippingFields = root.querySelector('[data-jill-shipping-fields]');
    const fulfillment = planning?.querySelector('[name="fulfillment"]');
    const eventDate = planning?.querySelector('[name="event_date"]');
    const edit = root.querySelector('[data-jill-custom-order-edit]');
    const review = root.querySelector('[data-jill-custom-order-review]');
    const success = root.querySelector('[data-jill-custom-order-success]');
    const header = root.querySelector('[data-jill-edit-only]');
    const finishConfiguration = root.querySelector('[data-jill-finish-configuration]');
    const reviewOpen = root.querySelector('[data-jill-review-open]');
    const reviewBack = root.querySelector('[data-jill-review-back]');
    const reviewConfirm = root.querySelector('[data-jill-review-confirm]');
    const requestSubmit = root.querySelector('[data-jill-request-submit]');
    const acknowledgment = root.querySelector('[data-jill-request-acknowledgment]');
    const status = root.querySelector('[data-jill-custom-order-status]');
    let configurationFinished = false;
    let request = null;

    for (const item of root.querySelectorAll('[data-jill-custom-order-item]')) initializeVariantAllocation(item);

    function setStatus(message) {
      status.textContent = message || '';
    }

    function syncShipping() {
      const shipping = fulfillment?.value === 'shipping';
      shippingFields.hidden = !shipping;
      shippingFields.setAttribute('aria-hidden', shipping ? 'false' : 'true');
      shippingFields.querySelectorAll('input, select, textarea').forEach((control) => { control.disabled = !shipping; });
      if (eventDate) {
        if (shipping) eventDate.min = addBusinessDays(new Date(), 12);
        else eventDate.removeAttribute('min');
      }
    }

    function syncProgression() {
      syncSelectedItems(root);
      syncShipping();
      updateItemStatuses(root);

      const customerValid = validateControlGroup(customer, false).valid;
      const hasProducts = selectedChoices(root).length > 0;
      const configAvailable = customerValid && hasProducts;
      const planningAvailable = configAvailable && configurationFinished;
      const planningValid = planningAvailable && validateControlGroup(planning, false).valid;
      const finalAvailable = planningValid;

      setStageVisible(productsStage, customerValid);
      setStageVisible(configurationStage, configAvailable);
      setStageVisible(planningStage, planningAvailable);
      setStageVisible(finalStage, finalAvailable);

      const states = [
        [customerStage, customerValid, true],
        [productsStage, hasProducts, customerValid],
        [configurationStage, configurationFinished, configAvailable],
        [planningStage, planningValid, planningAvailable],
        [finalStage, Boolean(acknowledgment?.checked), finalAvailable],
      ];
      const firstPending = states.find(([, complete, available]) => available && !complete)?.[0];
      states.forEach(([stage, complete, available]) => {
        stage.dataset.stageState = !available ? 'locked' : complete ? 'complete' : stage === firstPending ? 'active' : 'available';
      });
    }

    function resetConfiguration() {
      if (!configurationFinished) {
        updateItemStatuses(root);
        return;
      }
      configurationFinished = false;
      finishConfiguration.textContent = 'Finish product configuration';
      finishConfiguration.disabled = false;
      finishConfiguration.setAttribute('aria-disabled', 'false');
      syncProgression();
    }

    function validateConfiguration() {
      const items = selectedItems(root);
      if (!items.length) {
        setStatus('Choose at least one product.');
        stageFocus(productsStage);
        return false;
      }
      for (const item of items) {
        const result = validateProductForm(item);
        if (!result.accepted) {
          const mount = variantMount(item);
          setStatus(mount && mount.dataset.state !== 'complete'
            ? mount.dataset.incompleteLabel
            : `Complete the required options for ${item.dataset.productTitle}.`);
          scrollToTarget(result.focusControl || result.form.querySelector('[aria-invalid="true"], input, select, textarea'));
          updateItemStatuses(root);
          return false;
        }
      }
      const issue = firstIncompleteItem(root);
      if (issue) {
        setStatus(`Complete the required options for ${issue.item.dataset.productTitle}.`);
        scrollToTarget(issue.target || issue.item);
        updateItemStatuses(root);
        return false;
      }
      configurationFinished = true;
      finishConfiguration.textContent = 'Product configuration finished ✓';
      finishConfiguration.disabled = true;
      finishConfiguration.setAttribute('aria-disabled', 'true');
      setStatus('');
      syncProgression();
      planningStage.scrollIntoView({behavior: 'smooth', block: 'start'});
      return true;
    }

    function openReview() {
      setStatus('');
      if (!configurationFinished && !validateConfiguration()) return;
      const customerResult = validateControlGroup(customer, true);
      if (!customerResult.valid) {
        setStatus('Complete your contact details before reviewing.');
        scrollToTarget(customerResult.firstInvalid);
        return;
      }
      const planningResult = validateControlGroup(planning, true);
      if (!planningResult.valid) {
        setStatus('Complete the required event and fulfillment details before reviewing.');
        scrollToTarget(planningResult.firstInvalid);
        return;
      }
      if (!acknowledgment?.checked) {
        setStatus('Confirm that this is a request, not a confirmed order.');
        acknowledgment?.focus();
        return;
      }
      try {
        request = cleanUndefined(buildRequest(root));
        renderReview(root, request);
        root.dataset.jillCustomOrderRequest = JSON.stringify(request);
        edit.hidden = true;
        header.hidden = true;
        reviewConfirm.checked = false;
        requestSubmit.disabled = true;
        requestSubmit.setAttribute('aria-disabled', 'true');
        review.scrollIntoView({behavior: 'smooth', block: 'start'});
      } catch (error) {
        setStatus(error.message.replace(/^JILL custom order:\s*/, ''));
      }
    }

    function backToEdit() {
      review.hidden = true;
      review.setAttribute('aria-hidden', 'true');
      edit.hidden = false;
      header.hidden = false;
      reviewConfirm.checked = false;
      requestSubmit.disabled = true;
      requestSubmit.setAttribute('aria-disabled', 'true');
      request = null;
      delete root.dataset.jillCustomOrderRequest;
      root.scrollIntoView({behavior: 'smooth', block: 'start'});
      syncProgression();
    }

    async function submit() {
      if (!request || !reviewConfirm.checked || requestSubmit.disabled) return;
      requestSubmit.disabled = true;
      requestSubmit.setAttribute('aria-disabled', 'true');
      requestSubmit.textContent = 'Sending request…';
      setStatus('');
      try {
        await submitRequest(root, request);
        review.hidden = true;
        review.setAttribute('aria-hidden', 'true');
        success.hidden = false;
        success.setAttribute('aria-hidden', 'false');
        setStatus('');
        success.scrollIntoView({behavior: 'smooth', block: 'start'});
        success.querySelector('[data-jill-success-title]')?.focus({preventScroll: true});
      } catch (error) {
        setStatus(error.message.replace(/^JILL custom order:\s*/, ''));
        requestSubmit.disabled = false;
        requestSubmit.setAttribute('aria-disabled', 'false');
        requestSubmit.textContent = 'Request Custom Order';
      }
    }

    productChoices(root).forEach((choice) => {
      const checkbox = choice.querySelector('[data-jill-custom-order-select]');
      checkbox?.addEventListener('change', () => {
        configurationFinished = false;
        finishConfiguration.textContent = 'Finish product configuration';
        finishConfiguration.disabled = false;
        finishConfiguration.setAttribute('aria-disabled', 'false');
        syncProgression();
      });
    });

    root.querySelectorAll('[data-jill-collection-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.jillCollectionFilter;
        root.querySelectorAll('[data-jill-collection-filter]').forEach((candidate) => candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false'));
        productChoices(root).forEach((choice) => {
          const handles = String(choice.dataset.collectionHandles || '').split('|');
          choice.hidden = filter !== 'all' && !handles.includes(filter);
        });
      });
    });

    customer?.addEventListener('input', syncProgression);
    customer?.addEventListener('change', syncProgression);
    planning?.addEventListener('input', syncProgression);
    planning?.addEventListener('change', syncProgression);
    configurationStage?.addEventListener('input', (event) => {
      if (event.target.closest('[data-jill-custom-order-item]')) resetConfiguration();
    });
    configurationStage?.addEventListener('change', (event) => {
      if (event.target.closest('[data-jill-custom-order-item]')) resetConfiguration();
    });
    configurationStage?.addEventListener('jill:personalization-change', resetConfiguration);
    configurationStage?.addEventListener('jill:custom-order-item-state', () => updateItemStatuses(root));
    finishConfiguration?.addEventListener('click', validateConfiguration);
    acknowledgment?.addEventListener('change', syncProgression);
    reviewOpen?.addEventListener('click', openReview);
    reviewBack?.addEventListener('click', backToEdit);
    reviewConfirm?.addEventListener('change', () => {
      const enabled = reviewConfirm.checked && Boolean(request);
      requestSubmit.disabled = !enabled;
      requestSubmit.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    });
    requestSubmit?.addEventListener('click', submit);

    applyCatalogPrefill(root);
    syncProgression();
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
      submitRequest,
    }),
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
