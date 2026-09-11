(() => {
  'use strict';

  const variantStates = new WeakMap();
  const personalizationStates = new WeakMap();
  const mediaStates = new WeakMap();

  function fail(message) {
    throw new Error(`JILL custom order: ${message}`);
  }

  function setVisible(element, visible) {
    if (!element) return;
    element.hidden = !visible;
    element.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function productChoices(root) {
    return Array.from(root.querySelectorAll('[data-jill-product-choice]'));
  }

  function selectedChoices(root) {
    return productChoices(root).filter((choice) => choice.querySelector('[data-jill-custom-order-select]')?.checked);
  }

  function collectionChoices(root) {
    return Array.from(root.querySelectorAll('[data-jill-collection-choice]'));
  }

  function selectedCollectionChoices(root) {
    return collectionChoices(root).filter((choice) => choice.checked);
  }

  function itemForProduct(root, productId) {
    return Array.from(root.querySelectorAll('[data-jill-custom-order-item]'))
      .find((item) => String(item.dataset.jillProductId) === String(productId)) || null;
  }

  function selectedItems(root) {
    return selectedChoices(root).map((choice) => itemForProduct(root, choice.dataset.productId)).filter(Boolean);
  }

  function itemHasConfiguration(item) {
    if (!item) return false;
    return Boolean(item.querySelector(
      '[data-jill-variant-allocation], [data-jill-capability-group="product_options"] [data-jill-capability-field]',
    ));
  }

  function eventItem(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path.find((node) => node?.matches?.('[data-jill-custom-order-item]'))
      || event.target?.closest?.('[data-jill-custom-order-item]')
      || null;
  }

  function setItemSelected(item, selected) {
    if (!item) return;
    setVisible(item, selected && itemHasConfiguration(item));
  }

  function projectionDetails(choice) {
    return choice?.querySelector('[data-jill-product-projection-details]') || null;
  }

  function projectionQuantity(choice) {
    return choice?.querySelector('[data-jill-order-quantity] [data-jill-quantity-input]') || null;
  }

  function canonicalQuantity(item) {
    return item?.querySelector('[data-jill-custom-order-item-form] [name="quantity"]') || null;
  }

  function syncCanonicalQuantity(root, choice) {
    const item = itemForProduct(root, choice.dataset.productId);
    const source = projectionQuantity(choice);
    const target = canonicalQuantity(item);
    if (!source || !target) return;
    const next = String(source.value || '1');
    if (target.value === next) return;
    target.value = next;
    target.dispatchEvent(new Event('input', {bubbles: true}));
    target.dispatchEvent(new Event('change', {bubbles: true}));
  }

  function syncSelectedItems(root) {
    const selectedIds = new Set(selectedChoices(root).map((choice) => String(choice.dataset.productId)));
    for (const choice of productChoices(root)) {
      const selected = selectedIds.has(String(choice.dataset.productId));
      setVisible(projectionDetails(choice), selected);
      if (selected) syncCanonicalQuantity(root, choice);
    }
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

    const orderType = root.querySelector('[name="order_type"][value="one"]');
    if (orderType) orderType.checked = true;
    const handles = String(choice.dataset.collectionHandles || '').split('|').filter(Boolean);
    const matchingCollection = collectionChoices(root).find((candidate) => handles.includes(candidate.value));
    if (matchingCollection) matchingCollection.checked = true;

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
    const field = {id: safeFieldId(control.name || control.id, index), kind, required: Boolean(control.required)};
    if (kind === 'select') {
      field.options = Array.from(control.options).map((option) => ({value: option.value})).filter((option) => option.value !== '');
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
      .filter((control) => !control.disabled && control.type !== 'hidden' && !control.closest('[hidden]'));
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
    fields.forEach((field, index) => { values[field.id] = controlValue(controls[index], container); });
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
    const source = form.querySelector('[data-jill-variant-catalog]');
    if (!source) return null;
    try {
      const variants = JSON.parse(source.textContent.trim());
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
      allocations: (payload.allocations || []).map((allocation) => ({id: allocation.id, variantId: allocation.variantId, unitIds: allocation.unitIds})),
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
    try { catalog = readVariantCatalog(form); } catch (error) { mount.dataset.state = 'error'; return; }
    if (!catalog) return;

    let state;
    try {
      state = allocator.createState({itemId: itemRuntimeId(item), merchandiseQuantity: Number(quantityControl.value), variants: catalog});
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
        } catch (error) { render(); }
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
        } catch (error) { render(); }
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
          } catch (error) { render(); }
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
      setVisible(mount, true);
      notify();
    }

    addButton.addEventListener('click', () => {
      try {
        state = allocator.addGroup(state);
        variantStates.set(item, state);
        render();
      } catch (error) { render(); }
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
    const source = form.querySelector('[data-jill-product-capability-profile]');
    if (!source) return null;
    return globalThis.JILLProductCapabilities.resolve(source.textContent.trim());
  }

  function readProductOptions(form) {
    const source = form.querySelector('[data-jill-product-options-payload]');
    if (!source?.value) return null;
    try { return JSON.parse(source.value); } catch (error) { fail('Product Options payload is invalid'); }
  }

  function attribute(field, value) {
    return {id: field.id, label: field.label, value};
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
    }

    const collectionIds = String(item.dataset.collectionHandles || '').split('|').map((value) => value.trim()).filter(Boolean);
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
      personalization_groups: [],
      reference_ids: [],
    };
  }

  function customizationUnitIds(itemId, quantity, profile) {
    const multiplier = profile ? globalThis.JILLProductCapabilities.getCustomizationUnitsPerQuantity(profile) : 1;
    return Array.from({length: quantity * multiplier}, (_, index) => `${itemId}::${index + 1}`);
  }

  function semanticPersonalizationValue(field, values) {
    const key = `${field?.id || ''} ${field?.label || ''}`.toLowerCase();
    if (/age|number/.test(key)) return values.age;
    if (/note|detail|instruction/.test(key)) return values.notes;
    return values.wording;
  }

  function validateCanonicalPersonalization(profile, itemId, quantity, values) {
    const fieldIds = globalThis.JILLProductCapabilities.getPersonalizationAllocationFieldIds(profile);
    if (!fieldIds.length || !globalThis.JILLPersonalization) return;
    let state = globalThis.JILLPersonalization.createState({itemId, merchandiseQuantity: quantity, profile, mode: 'same'});
    if (!state.available || state.mode !== 'same') return;
    const group = state.groups[0];
    if (!group) return;
    for (const fieldId of fieldIds) {
      const field = globalThis.JILLProductCapabilities.getField(profile, fieldId);
      state = globalThis.JILLPersonalization.setGroupValue(state, profile, group.id, fieldId, semanticPersonalizationValue(field, values));
    }
    if (!state.complete) fail('required personalization is incomplete');
  }

  function personalizationState(root) {
    if (!personalizationStates.has(root)) {
      personalizationStates.set(root, {
        mode: '',
        same: {wording: '', age: '', notes: ''},
        groups: [],
        nextGroupNumber: 1,
        finished: false,
        open: new Set(),
      });
    }
    return personalizationStates.get(root);
  }

  function personalizationOwner(state, productId) {
    return state.groups.find((group) => group.productIds.includes(String(productId))) || null;
  }

  function newPersonalizationGroup(state, productIds = []) {
    const id = `group_${state.nextGroupNumber++}`;
    state.open.add(id);
    return {id, productIds: productIds.map(String), wording: '', age: '', notes: ''};
  }

  function selectedProductIds(root) {
    return selectedChoices(root).map((choice) => String(choice.dataset.productId));
  }

  function reconcilePersonalization(root) {
    const state = personalizationState(root);
    const ids = selectedProductIds(root);
    const allowed = new Set(ids);
    const claimed = new Set();
    for (const group of state.groups) {
      group.productIds = group.productIds.filter((productId) => allowed.has(productId) && !claimed.has(productId));
      group.productIds.forEach((productId) => claimed.add(productId));
    }
    state.groups = state.groups.filter((group, index) => group.productIds.length || index < 2);
    if (state.mode === 'different' && ids.length < 2) {
      const source = state.groups.find((group) => group.wording) || state.groups[0];
      if (source && !state.same.wording) state.same = {wording: source.wording, age: source.age, notes: source.notes};
      state.mode = ids.length ? 'same' : '';
      state.groups = [];
      state.open.clear();
      state.finished = false;
    }
    if (state.mode === 'different' && ids.length >= 2 && !state.groups.length) {
      state.groups = [newPersonalizationGroup(state, [ids[0]]), newPersonalizationGroup(state, [ids[1]])];
    }
    return state;
  }

  function personalizationCompletion(root) {
    const state = personalizationState(root);
    const ids = selectedProductIds(root);
    if (!state.mode) return {complete: false, message: 'Choose a personalization setup.'};
    if (state.mode === 'none') return {complete: true, message: 'No personalization selected.'};
    if (state.mode === 'same') {
      return state.same.wording.trim()
        ? {complete: true, message: 'Ready to finish personalization.'}
        : {complete: false, message: 'Enter the name or wording.'};
    }
    if (ids.length < 2) return {complete: false, message: 'Different personalization requires at least two selected items.'};
    if (state.groups.length < 2) return {complete: false, message: 'Two personalization cards are required.'};
    if (state.groups.some((group) => !group.productIds.length)) return {complete: false, message: 'Select at least one item in every personalization card.'};
    if (state.groups.some((group) => !group.wording.trim())) return {complete: false, message: 'Add wording to every personalization card.'};
    const assigned = state.groups.flatMap((group) => group.productIds);
    if (new Set(assigned).size !== assigned.length) return {complete: false, message: 'Each item can belong to only one personalization.'};
    if (ids.some((id) => !assigned.includes(id))) return {complete: false, message: 'Assign every selected item to a personalization.'};
    return {complete: true, message: 'Ready to finish personalization.'};
  }

  function valuesForProduct(root, productId) {
    const state = personalizationState(root);
    if (state.mode === 'none' || !state.mode) return null;
    if (state.mode === 'same') return state.same;
    return personalizationOwner(state, productId) || null;
  }

  function applyOrderPersonalization(root, itemNodes, requests) {
    const state = personalizationState(root);
    if (!state.mode || state.mode === 'none') return;
    itemNodes.forEach((item, index) => {
      const request = requests[index];
      const values = valuesForProduct(root, item.dataset.jillProductId);
      if (!values) return;
      const form = item.querySelector('[data-jill-custom-order-item-form]');
      const profile = readProfile(form);
      if (profile) validateCanonicalPersonalization(profile, request.item_id, request.quantity, values);
      let fields = profile?.groups?.personalization?.map((fieldId) => globalThis.JILLProductCapabilities.getField(profile, fieldId)).filter(Boolean) || [];
      if (!fields.length) {
        fields = [
          {id: 'name_text', label: 'Name / wording'},
          {id: 'number_age', label: 'Age / number'},
          {id: 'theme_notes', label: 'Notes'},
        ];
      }
      const attributes = fields.map((field) => ({id: field.id, label: field.label, value: semanticPersonalizationValue(field, values)}))
        .filter((entry) => String(entry.value || '').trim() !== '');
      request.personalization_groups = [{
        id: state.mode === 'same' ? 'same' : personalizationOwner(state, item.dataset.jillProductId)?.id || 'personalization',
        allocations: customizationUnitIds(request.item_id, request.quantity, profile).map((unitId) => ({unit_id: unitId})),
        attributes,
      }];
    });
  }

  function readNamed(container, name) {
    return container?.querySelector(`[name="${name}"]`)?.value?.trim() || '';
  }

  function readChecked(root, name) {
    return root.querySelector(`[name="${name}"]:checked`)?.value || '';
  }

  function requestAttribute(id, label, value) {
    return value === '' || value === undefined || value === null ? null : {id, label, value};
  }

  function mediaState(root) {
    if (!mediaStates.has(root)) mediaStates.set(root, {items: [], uploading: 0, error: ''});
    return mediaStates.get(root);
  }

  function uploadedMedia(root) {
    return mediaState(root).items.filter((item) => item.url);
  }

  function buildRequest(root) {
    const customer = root.querySelector('[data-jill-custom-order-customer]');
    const planning = root.querySelector('[data-jill-custom-order-planning]');
    const itemNodes = selectedItems(root);
    const items = itemNodes.map(itemRequest);
    if (!items.length) fail('at least one product is required');
    applyOrderPersonalization(root, itemNodes, items);

    const submissionId = globalThis.crypto?.randomUUID
      ? `jill:${globalThis.crypto.randomUUID()}`
      : `jill:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const address = {
      city: readNamed(planning, 'city'),
      state: readNamed(planning, 'state'),
      postal_code: readNamed(planning, 'postal_code'),
    };
    if (readChecked(planning, 'fulfillment') !== 'shipping') {
      delete address.city;
      delete address.state;
      delete address.postal_code;
    } else {
      for (const key of Object.keys(address)) if (!address[key]) delete address[key];
    }

    const submittedAt = new Date().toISOString();
    const granted = Boolean(root.querySelector('[data-jill-marketing-consent]')?.checked);
    const personalization = personalizationState(root);
    const attributes = [
      requestAttribute('order_type', 'Order type', readChecked(root, 'order_type')),
      requestAttribute('collections_selected', 'Collections selected', selectedCollectionChoices(root).map((choice) => choice.dataset.collectionTitle).join(', ')),
      requestAttribute('theme', 'Theme / character / style', readNamed(root, 'theme')),
      requestAttribute('colors', 'Colors', readNamed(root, 'colors')),
      requestAttribute('personalization_mode', 'Personalization', personalization.mode),
      requestAttribute('reference_instructions', 'Reference instructions', readNamed(root, 'reference_instructions')),
      requestAttribute('budget', 'Approximate budget', readNamed(root, 'budget')),
      requestAttribute('priority', 'What matters most', readNamed(root, 'priority')),
      requestAttribute('recommend_matching', 'Recommend matching items', readChecked(root, 'recommend_matching')),
      requestAttribute('notes', 'Anything else', readNamed(root, 'notes')),
    ].filter(Boolean);

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
        fulfillment: readChecked(planning, 'fulfillment') || undefined,
        address: Object.keys(address).length ? address : undefined,
      },
      items,
      request_attributes: attributes,
      reference_ids: uploadedMedia(root).map((item) => item.url),
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
    return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).map(([key, child]) => [key, cleanUndefined(child)]));
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function reviewRow(label, value, className = 'jill-custom-order-review__row') {
    if (value === '' || value === undefined || value === null || value === false) return null;
    const row = node('div', className);
    row.append(node('div', 'jill-custom-order-review__key', label), node('div', 'jill-custom-order-review__value', value));
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

  function requestValue(request, id) {
    return request.request_attributes.find((entry) => entry.id === id)?.value ?? '';
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
      const details = node('div', 'jill-custom-order-review__details');
      appendRows(details, (group.attributes || []).map((entry) => reviewRow(entry.label || entry.id, displayValue(entry.value))));
      block.append(details);
      host.append(block);
    });
  }

  function collectionTitleMap(root) {
    return new Map(collectionChoices(root).map((choice) => [choice.value, choice.dataset.collectionTitle || choice.value]));
  }

  function renderReview(root, request) {
    const review = root.querySelector('[data-jill-custom-order-review]');
    const content = root.querySelector('[data-jill-custom-order-review-content]');
    if (!review || !content) return;
    const sheet = node('div', 'jill-custom-order-review');

    const customer = node('section', 'jill-custom-order-review__section');
    customer.append(node('h3', 'jill-custom-order-review__heading', 'Customer info'));
    const customerDetails = node('div', 'jill-custom-order-review__details');
    appendRows(customerDetails, [
      reviewRow('Name', request.customer.name),
      reviewRow('Email', request.customer.email),
      reviewRow('Phone', request.customer.phone),
      reviewRow('Preferred contact', request.customer.preferred_contact === 'phone' ? 'Text / phone' : 'Email'),
    ]);
    customer.append(customerDetails);
    sheet.append(customer);

    const itemsSection = node('section', 'jill-custom-order-review__section');
    itemsSection.append(node('h3', 'jill-custom-order-review__heading', 'Items'));
    const titles = collectionTitleMap(root);
    const selectedCollections = new Set(selectedCollectionChoices(root).map((choice) => choice.value));
    const groups = new Map();
    let total = 0;
    request.items.forEach((item) => {
      total += item.quantity;
      const handle = item.collection_ids.find((candidate) => selectedCollections.has(candidate)) || item.collection_ids[0] || 'items';
      const title = titles.get(handle) || 'Items';
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(item);
    });

    groups.forEach((items, title) => {
      const collection = node('section', 'jill-custom-order-review__collection');
      collection.append(node('h4', 'jill-custom-order-review__collection-title', title));
      items.forEach((item) => {
        const article = node('article', 'jill-custom-order-review__item');
        const head = node('div', 'jill-custom-order-review__item-head');
        head.append(
          node('h4', '', `${item.quantity}x ${item.title}`),
          node('span', 'jill-custom-order-review__item-status', item.personalization_groups.length ? 'Personalized' : 'Not personalized'),
        );
        article.append(head);
        if (item.variant_allocations?.length) {
          const variants = node('div', 'jill-custom-order-review__details');
          item.variant_allocations.forEach((allocation) => variants.append(reviewRow('Variation', `${allocation.quantity}x ${allocation.title}`)));
          article.append(variants);
        }
        const singleton = item.attributes.filter((entry) => entry.id !== 'product_options');
        if (singleton.length) {
          const details = node('div', 'jill-custom-order-review__details');
          appendRows(details, singleton.map((entry) => reviewRow(entry.label || entry.id, displayValue(entry.value))));
          article.append(details);
        }
        productOptionReview(item, article);
        item.personalization_groups.forEach((group) => {
          if (!group.attributes.length) return;
          const block = node('div', 'jill-custom-order-review__personalization');
          block.append(node('h5', '', 'Personalization'));
          const details = node('div', 'jill-custom-order-review__details');
          appendRows(details, group.attributes.map((entry) => reviewRow(entry.label || entry.id, displayValue(entry.value))));
          block.append(details);
          article.append(block);
        });
        collection.append(article);
      });
      itemsSection.append(collection);
    });
    sheet.append(itemsSection);

    const totalSection = node('section', 'jill-custom-order-review__total');
    totalSection.append(node('span', '', 'Total items'), node('span', 'jill-custom-order-review__total-line'), node('strong', '', total));
    sheet.append(totalSection);

    const design = node('section', 'jill-custom-order-review__section');
    design.append(node('h3', 'jill-custom-order-review__heading', 'Design'));
    const designDetails = node('div', 'jill-custom-order-review__details');
    appendRows(designDetails, [
      reviewRow('Theme', requestValue(request, 'theme')),
      reviewRow('Colors', requestValue(request, 'colors')),
      reviewRow('Reference images', request.reference_ids.length ? 'Yes' : 'No'),
    ]);
    design.append(designDetails);
    sheet.append(design);

    const event = node('section', 'jill-custom-order-review__event');
    const location = request.planning.address
      ? [request.planning.address.city, request.planning.address.state, request.planning.address.postal_code].filter(Boolean).join(', ')
      : '';
    appendRows(event, [
      reviewRow('Date needed', request.planning.date_needed, 'jill-custom-order-review__event-item'),
      reviewRow('Fulfillment', request.planning.fulfillment === 'pickup' ? 'Jacksonville pickup' : 'Shipping', 'jill-custom-order-review__event-item'),
      reviewRow('Location', location, 'jill-custom-order-review__event-item'),
    ]);
    sheet.append(event);

    content.replaceChildren(sheet);
    setVisible(review, true);
  }

  function todayLocal() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function scrollToTarget(target) {
    if (!target) return;
    const element = target.closest?.('.jill-field, .jill-product-customization__group, .jill-custom-order-item, .jill-custom-order__step') || target;
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    setTimeout(() => target.focus?.({preventScroll: true}), 250);
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
      } catch (error) { return {item, target: optionPayload}; }
    }
    if (!native.valid) return {item, target: native.firstInvalid};
    return null;
  }

  function updateItemStatuses(root) {
    const completeLabel = root.dataset.completeLabel || 'Complete ✓';
    const incompleteLabel = root.dataset.incompleteLabel || 'Incomplete';
    for (const item of selectedItems(root)) {
      const status = item.querySelector('[data-jill-item-status]');
      if (!status) continue;
      const complete = !itemCompletionIssue(item);
      status.textContent = complete ? completeLabel : incompleteLabel;
      status.dataset.tone = complete ? 'success' : 'error';
      item.dataset.state = complete ? 'complete' : 'incomplete';
    }
  }

  function firstIncompleteItem(root) {
    for (const item of selectedItems(root)) {
      const issue = itemCompletionIssue(item);
      if (issue) return issue;
    }
    return null;
  }

  function endpointPayload(request) {
    const collections = requestValue(request, 'collections_selected');
    const theme = requestValue(request, 'theme');
    const colors = requestValue(request, 'colors');
    const personalization = requestValue(request, 'personalization_mode');
    const referenceInstructions = requestValue(request, 'reference_instructions');
    const budget = requestValue(request, 'budget');
    const priority = requestValue(request, 'priority');
    const recommendMatching = requestValue(request, 'recommend_matching');
    const notes = requestValue(request, 'notes');
    return {
      source: 'JILL custom order',
      submission_id: request.submission_id,
      submitted_at: request.submitted_at,
      name: request.customer.name,
      email: request.customer.email,
      phone: request.customer.phone || '',
      preferred_contact: request.customer.preferred_contact || '',
      order_type: requestValue(request, 'order_type'),
      event_date: request.planning.event_date || '',
      date_needed: request.planning.date_needed || '',
      fulfillment: request.planning.fulfillment === 'pickup' ? 'Jacksonville pickup' : 'Shipping',
      city: request.planning.address?.city || '',
      state: request.planning.address?.state || '',
      zip: request.planning.address?.postal_code || '',
      theme,
      colors,
      collections,
      products: request.items.map((item) => `${item.quantity} × ${item.title}`).join('\n'),
      personalization,
      reference_images: request.reference_ids.length ? 'Yes' : 'No',
      reference_image_links: request.reference_ids.join('\n'),
      reference_instructions: referenceInstructions,
      budget,
      priority,
      recommend_matching: recommendMatching,
      notes,
      marketing_consent: request.marketing_consent.granted ? 'Yes' : 'No',
      marketing_consent_at: request.marketing_consent.recorded_at || '',
      marketing_consent_source: request.marketing_consent.source || '',
      raw_payload: JSON.stringify(request),
    };
  }

  async function submitRequest(root, request) {
    const endpoint = String(root.dataset.submitEndpoint || '').trim();
    if (!endpoint) fail('submission is temporarily unavailable');
    const body = new URLSearchParams();
    Object.entries(endpointPayload(request)).forEach(([key, value]) => body.set(key, String(value ?? '')));
    await fetch(endpoint, {method: 'POST', mode: 'no-cors', keepalive: true, body});
  }

  function text(bytes, start, end) {
    return String.fromCharCode.apply(null, Array.from(bytes.slice(start, end)));
  }

  async function validImage(file) {
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
    if (bytes.length >= 8 && bytes[0] === 0x89 && text(bytes, 1, 4) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return true;
    if (bytes.length >= 12 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 12) === 'WEBP') return true;
    if (bytes.length >= 12 && text(bytes, 4, 8) === 'ftyp') {
      const brand = text(bytes, 8, 12).toLowerCase();
      if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'].includes(brand)) return true;
    }
    return false;
  }

  function renderMedia(root) {
    const state = mediaState(root);
    const grid = root.querySelector('[data-jill-media-grid]');
    const count = root.querySelector('[data-jill-media-count]');
    const error = root.querySelector('[data-jill-media-error]');
    const input = root.querySelector('[data-jill-media-input]');
    const drop = root.querySelector('.jill-media__drop');
    if (!grid || !count || !error || !input || !drop) return;
    grid.replaceChildren();
    state.items.forEach((item, index) => {
      const card = node('div', 'jill-media__item');
      const thumb = node('div', 'jill-media__thumb');
      if (item.previewable && item.preview) {
        const image = document.createElement('img');
        image.src = item.preview;
        image.alt = `Reference image ${index + 1}`;
        thumb.append(image);
      } else {
        thumb.append(node('span', 'jill-media__fallback', item.name));
      }
      const meta = node('div', 'jill-media__meta');
      meta.append(node('span', 'jill-media__name', item.name), node('span', 'jill-media__status', item.status));
      const remove = node('button', 'jill-media__remove', 'Remove');
      remove.type = 'button';
      remove.disabled = item.status === 'Uploading…';
      remove.addEventListener('click', () => {
        if (item.preview) URL.revokeObjectURL(item.preview);
        state.items.splice(index, 1);
        state.error = '';
        renderMedia(root);
        root.dispatchEvent(new Event('change', {bubbles: true}));
      });
      card.append(thumb, meta, remove);
      grid.append(card);
    });
    count.textContent = `${uploadedMedia(root).length} / 3 uploaded`;
    error.textContent = state.error;
    error.hidden = !state.error;
    drop.hidden = state.items.length >= 3;
    input.disabled = state.uploading > 0 || state.items.length >= 3 || readChecked(root, 'has_references') !== 'yes';
    root.querySelector('[data-jill-media]')?.setAttribute('data-uploading', state.uploading > 0 ? 'true' : 'false');
  }

  async function uploadMedia(root, files) {
    const state = mediaState(root);
    const cloud = String(root.dataset.cloudName || '').trim();
    const preset = String(root.dataset.uploadPreset || '').trim();
    if (!cloud || !preset) {
      state.error = 'Reference image upload is not connected yet.';
      renderMedia(root);
      return;
    }
    let incoming = Array.from(files || []);
    const room = 3 - state.items.length;
    if (incoming.length > room) {
      incoming = incoming.slice(0, room);
      state.error = 'Maximum 3 reference images.';
    } else state.error = '';

    const valid = [];
    for (const file of incoming) {
      if (file.size > 10 * 1024 * 1024) {
        state.error = `${file.name} is larger than 10 MB.`;
        continue;
      }
      if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
        state.error = `${file.name} is not an accepted image type.`;
        continue;
      }
      let imageValid = false;
      try { imageValid = await validImage(file); } catch (error) { imageValid = false; }
      if (!imageValid) {
        state.error = `${file.name} does not appear to be a valid image.`;
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) { renderMedia(root); return; }

    state.uploading += valid.length;
    renderMedia(root);
    await Promise.all(valid.map(async (file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const item = {
        name: file.name,
        status: 'Uploading…',
        preview: URL.createObjectURL(file),
        previewable: !['heic', 'heif'].includes(ext),
        url: '',
        publicId: '',
      };
      state.items.push(item);
      renderMedia(root);
      const data = new FormData();
      data.append('file', file);
      data.append('upload_preset', preset);
      try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {method: 'POST', body: data});
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.secure_url) throw new Error('upload failed');
        item.url = result.secure_url;
        item.publicId = result.public_id || '';
        item.status = 'Uploaded';
      } catch (error) {
        item.status = 'Upload failed';
        state.error = `Could not upload ${file.name}. Try again.`;
      } finally {
        state.uploading = Math.max(0, state.uploading - 1);
        renderMedia(root);
        root.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }));
  }

  function initializeMedia(root) {
    const input = root.querySelector('[data-jill-media-input]');
    const drop = root.querySelector('.jill-media__drop');
    if (!input || !drop || input.dataset.jillMediaReady === 'true') return;
    input.dataset.jillMediaReady = 'true';
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      input.value = '';
      uploadMedia(root, files);
    });
    ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (event) => event.preventDefault()));
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      if (!input.disabled) uploadMedia(root, event.dataTransfer?.files);
    });
    renderMedia(root);
  }

  function createPersonalizationInput(labelText, value, required, onInput, multiline = false) {
    const wrapper = node('div', 'jill-field');
    const label = node('label', 'jill-field__label');
    if (required) label.append(node('span', 'jill-field__required', '*'));
    label.append(document.createTextNode(labelText));
    const control = document.createElement(multiline ? 'textarea' : 'input');
    control.className = multiline ? 'jill-field__control jill-field__control--textarea' : 'jill-field__control';
    if (!multiline) control.type = 'text';
    control.value = value || '';
    control.required = required;
    control.addEventListener('input', () => onInput(control.value));
    wrapper.append(label, control);
    return wrapper;
  }

  function syncPersonalizationCardStatuses(root) {
    const state = personalizationState(root);
    for (const card of root.querySelectorAll('[data-jill-personalization-card]')) {
      const id = card.dataset.jillPersonalizationCard;
      const record = id === 'same' ? state.same : state.groups.find((group) => group.id === id);
      const count = id === 'same' ? selectedChoices(root).length : record?.productIds.length || 0;
      const complete = count > 0 && Boolean(record?.wording?.trim());
      const status = card.querySelector('[data-jill-personalization-card-status]');
      if (status) {
        status.textContent = complete ? (root.dataset.completeLabel || 'Complete ✓') : count ? 'Add wording' : 'Select items';
        status.dataset.tone = complete ? 'success' : 'error';
      }
      card.dataset.state = complete ? 'complete' : 'incomplete';
    }
  }

  function renderPersonalization(root) {
    const state = reconcilePersonalization(root);
    const cards = root.querySelector('[data-jill-personalization-cards]');
    const actions = root.querySelector('[data-jill-personalization-actions]');
    const add = root.querySelector('[data-jill-personalization-add]');
    const finish = root.querySelector('[data-jill-personalization-finish]');
    const help = root.querySelector('[data-jill-personalization-help]');
    const mode = root.querySelector('[data-jill-personalization-mode]');
    if (!cards || !actions || !add || !finish || !help || !mode) return;

    const differentOption = mode.querySelector('option[value="different"]');
    if (differentOption) differentOption.disabled = selectedChoices(root).length < 2;
    mode.value = state.mode;
    cards.replaceChildren();

    function cardShell(id, title) {
      const card = node('section', 'jill-custom-order-personalization-card');
      card.dataset.jillPersonalizationCard = id;
      const toggle = node('button', 'jill-custom-order-personalization-card__toggle');
      toggle.type = 'button';
      const open = state.open.has(id);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      const name = node('span', 'jill-custom-order-personalization-card__name');
      name.append(node('span', 'jill-field__required', '*'), document.createTextNode(title));
      const status = node('span', 'jill-pill');
      status.dataset.jillPersonalizationCardStatus = '';
      toggle.append(name, status);
      const body = node('div', 'jill-custom-order-personalization-card__body');
      body.hidden = !open;
      toggle.addEventListener('click', () => {
        const next = !state.open.has(id);
        if (next) state.open.add(id); else state.open.delete(id);
        body.hidden = !next;
        toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
      });
      card.append(toggle, body);
      return {card, body};
    }

    function appendFields(host, record) {
      const fields = node('div', 'jill-custom-order-personalization-card__fields');
      fields.append(
        createPersonalizationInput('Name / wording', record.wording, true, (value) => {
          record.wording = value;
          state.finished = false;
          syncPersonalizationCardStatuses(root);
          syncProgression(root);
        }),
        createPersonalizationInput('Age / number', record.age, false, (value) => {
          record.age = value;
          state.finished = false;
          syncProgression(root);
        }),
        createPersonalizationInput('Notes', record.notes, false, (value) => {
          record.notes = value;
          state.finished = false;
          syncProgression(root);
        }, true),
      );
      host.append(fields);
    }

    if (state.mode === 'same') {
      const shell = cardShell('same', 'Same personalization for all selected items');
      shell.body.append(node('p', 'jill-custom-order-personalization-card__shared', selectedChoices(root).map((choice) => choice.querySelector('[data-jill-custom-order-select]')?.closest('label')?.textContent?.trim() || choice.dataset.productHandle).join(' · ')));
      appendFields(shell.body, state.same);
      cards.append(shell.card);
    }

    if (state.mode === 'different') {
      state.groups.forEach((group, index) => {
        const shell = cardShell(group.id, `Personalization ${index + 1}`);
        const fieldset = node('fieldset', 'jill-custom-order-personalization-card__items');
        fieldset.append(node('legend', 'jill-field__label', 'Which items use this personalization?'));
        selectedChoices(root).forEach((choice) => {
          const productId = String(choice.dataset.productId);
          const owner = personalizationOwner(state, productId);
          const label = node('label', 'jill-custom-order-personalization-card__item');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = productId;
          input.checked = owner === group;
          input.disabled = Boolean(owner && owner !== group);
          const textNode = node('span', '', choice.querySelector('[data-jill-custom-order-select]')?.closest('label')?.textContent?.trim() || choice.dataset.productHandle);
          input.addEventListener('change', () => {
            if (input.checked && !group.productIds.includes(productId)) group.productIds.push(productId);
            if (!input.checked) group.productIds = group.productIds.filter((id) => id !== productId);
            state.finished = false;
            renderPersonalization(root);
            syncProgression(root);
          });
          label.append(input, textNode);
          fieldset.append(label);
        });
        shell.body.append(fieldset);
        if (group.productIds.length) appendFields(shell.body, group);
        if (state.groups.length > 2) {
          const remove = node('button', 'jill-button', 'Remove personalization');
          remove.type = 'button';
          remove.dataset.variant = 'secondary';
          remove.addEventListener('click', () => {
            state.groups = state.groups.filter((candidate) => candidate !== group);
            state.open.delete(group.id);
            state.finished = false;
            renderPersonalization(root);
            syncProgression(root);
          });
          shell.body.append(remove);
        }
        cards.append(shell.card);
      });
    }

    const completion = personalizationCompletion(root);
    const assigned = new Set(state.groups.flatMap((group) => group.productIds));
    const remaining = selectedProductIds(root).filter((id) => !assigned.has(id));
    setVisible(actions, state.mode === 'same' || state.mode === 'different');
    add.hidden = state.mode !== 'different' || !remaining.length;
    add.disabled = state.groups.some((group) => !group.productIds.length || !group.wording.trim());
    finish.disabled = !completion.complete || state.finished;
    finish.textContent = state.finished ? (root.dataset.personalizationFinishedLabel || 'Personalization finished ✓') : (root.dataset.finishPersonalizationLabel || 'Finish personalization');
    help.textContent = state.finished ? 'Personalization is finished. Continue with reference images below.' : completion.message;
    syncPersonalizationCardStatuses(root);
  }

  function referenceReady(root) {
    const choice = readChecked(root, 'has_references');
    if (!choice) return false;
    if (choice === 'no') return true;
    const state = mediaState(root);
    return state.uploading === 0 && uploadedMedia(root).length > 0;
  }

  function syncProductVisibility(root) {
    const selected = new Set(selectedCollectionChoices(root).map((choice) => choice.value));
    for (const choice of productChoices(root)) {
      const handles = String(choice.dataset.collectionHandles || '').split('|').filter(Boolean);
      const visible = handles.some((handle) => selected.has(handle));
      choice.hidden = !visible;
      if (!visible) {
        const input = choice.querySelector('[data-jill-custom-order-select]');
        if (input) input.checked = false;
      }
    }
    syncSelectedItems(root);
  }

  function syncPhoneRequirement(root) {
    const customer = root.querySelector('[data-jill-custom-order-customer]');
    const pref = customer?.querySelector('[name="preferred_contact"]');
    const phone = customer?.querySelector('[name="phone"]');
    if (!pref || !phone) return;
    const required = pref.value === 'phone';
    phone.required = required;
    const mark = phone.closest('.jill-field')?.querySelector('.jill-field__required');
    if (mark) mark.hidden = !required;
  }

  function syncDates(root) {
    const planning = root.querySelector('[data-jill-custom-order-planning]');
    const eventDate = planning?.querySelector('[name="event_date"]');
    const needDate = planning?.querySelector('[name="date_needed"]');
    if (!eventDate || !needDate) return;
    const today = todayLocal();
    eventDate.min = today;
    needDate.min = today;
    needDate.max = eventDate.value || '';
    const invalid = Boolean(eventDate.value && needDate.value && needDate.value > eventDate.value);
    needDate.setCustomValidity(invalid ? 'The date you need it cannot be after the event date.' : '');
  }

  function syncShipping(root) {
    const planning = root.querySelector('[data-jill-custom-order-planning]');
    const shippingFields = root.querySelector('[data-jill-shipping-fields]');
    const shipping = readChecked(planning, 'fulfillment') === 'shipping';
    setVisible(shippingFields, shipping);
    shippingFields?.querySelectorAll('input, select, textarea').forEach((control) => { control.disabled = !shipping; });
  }

  function collapseOptionCards(root) {
    for (const item of selectedItems(root)) {
      const toggle = item.querySelector('[data-jill-option-card-toggle]');
      const body = item.querySelector('[data-jill-option-card-body]');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      if (body) body.hidden = true;
    }
  }

  function resetOptions(root) {
    root.dataset.jillOptionsFinished = 'false';
    const button = root.querySelector('[data-jill-finish-configuration]');
    if (button) {
      button.disabled = false;
      button.setAttribute('aria-disabled', 'false');
      button.textContent = root.dataset.finishOptionsLabel || 'Finish Product Options';
    }
  }

  function validateConfiguration(root) {
    for (const choice of selectedChoices(root)) syncCanonicalQuantity(root, choice);
    for (const item of selectedItems(root)) {
      const result = validateProductForm(item);
      if (!result.accepted) {
        const target = result.focusControl || item.querySelector('[aria-invalid="true"], select, input, textarea, button');
        scrollToTarget(target || item);
        updateItemStatuses(root);
        return false;
      }
    }
    const issue = firstIncompleteItem(root);
    if (issue) {
      scrollToTarget(issue.target || issue.item);
      updateItemStatuses(root);
      return false;
    }
    root.dataset.jillOptionsFinished = 'true';
    const button = root.querySelector('[data-jill-finish-configuration]');
    if (button) {
      button.textContent = root.dataset.optionsFinishedLabel || 'Product Options finished ✓';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    }
    collapseOptionCards(root);
    syncProgression(root);
    root.querySelector('[data-jill-design-core]')?.scrollIntoView({behavior: 'smooth', block: 'center'});
    return true;
  }

  function syncStageStates(root, states) {
    const firstPending = states.find((entry) => entry.available && !entry.complete)?.stage;
    states.forEach(({stage, available, complete}) => {
      if (!stage) return;
      stage.dataset.stageState = !available ? 'locked' : complete ? 'complete' : stage === firstPending ? 'active' : 'available';
    });
  }

  function syncProgression(root) {
    syncPhoneRequirement(root);
    syncDates(root);
    syncShipping(root);
    syncSelectedItems(root);
    updateItemStatuses(root);

    const customerStage = root.querySelector('[data-jill-stage="customer"]');
    const orderStage = root.querySelector('[data-jill-stage="order"]');
    const productsStage = root.querySelector('[data-jill-stage="products"]');
    const configurationStage = root.querySelector('[data-jill-stage="configuration"]');
    const planningStage = root.querySelector('[data-jill-stage="planning"]');
    const finalStage = root.querySelector('[data-jill-stage="final"]');
    const customer = root.querySelector('[data-jill-custom-order-customer]');
    const collectionStage = root.querySelector('[data-jill-collection-stage]');
    const designCore = root.querySelector('[data-jill-design-core]');
    const personalization = root.querySelector('[data-jill-order-personalization]');
    const referenceStage = root.querySelector('[data-jill-reference-stage]');
    const referenceFields = root.querySelector('[data-jill-reference-fields]');
    const planning = root.querySelector('[data-jill-custom-order-planning]');

    const customerReady = validateControlGroup(customer, false).valid;
    setVisible(orderStage, customerReady);

    const orderType = readChecked(root, 'order_type');
    setVisible(collectionStage, customerReady && Boolean(orderType));
    const collectionCount = selectedCollectionChoices(root).length;
    const collectionsReady = customerReady && Boolean(orderType) && (orderType === 'one' ? collectionCount === 1 : collectionCount > 0);
    setVisible(productsStage, collectionsReady);
    if (collectionsReady) syncProductVisibility(root);

    const selectedCount = selectedChoices(root).length;
    const productsReady = collectionsReady && (orderType === 'one' ? selectedCount === 1 : selectedCount > 0);
    setVisible(configurationStage, productsReady);

    const optionsFinished = productsReady && root.dataset.jillOptionsFinished === 'true';
    setVisible(designCore, optionsFinished);
    const designReady = optionsFinished && validateControlGroup(designCore, false).valid;
    setVisible(personalization, designReady);

    const state = reconcilePersonalization(root);
    const completion = personalizationCompletion(root);
    const personalizationReady = designReady && completion.complete && (state.mode === 'none' || state.finished);
    setVisible(referenceStage, personalizationReady);
    const referenceChoice = readChecked(root, 'has_references');
    setVisible(referenceFields, personalizationReady && referenceChoice === 'yes');
    if (referenceChoice !== 'yes') root.querySelector('[data-jill-media-input]')?.setAttribute('disabled', '');
    renderMedia(root);
    const configurationReady = personalizationReady && referenceReady(root);

    setVisible(planningStage, configurationReady);
    const planningReady = configurationReady && validateControlGroup(planning, false).valid;
    setVisible(finalStage, planningReady);

    const finalComplete = planningReady && Boolean(root.querySelector('[data-jill-request-acknowledgment]')?.checked);
    syncStageStates(root, [
      {stage: customerStage, available: true, complete: customerReady},
      {stage: orderStage, available: customerReady, complete: collectionsReady},
      {stage: productsStage, available: collectionsReady, complete: productsReady},
      {stage: configurationStage, available: productsReady, complete: configurationReady},
      {stage: planningStage, available: configurationReady, complete: planningReady},
      {stage: finalStage, available: planningReady, complete: finalComplete},
    ]);
  }

  function initialize(root) {
    if (!root || root.dataset.jillCustomOrderInitialized === 'true') return;
    root.dataset.jillCustomOrderInitialized = 'true';
    root.dataset.jillOptionsFinished = 'false';
    let request = null;
    let editScroll = 0;

    for (const item of root.querySelectorAll('[data-jill-custom-order-item]')) initializeVariantAllocation(item);
    initializeMedia(root);

    const orderTypeInputs = Array.from(root.querySelectorAll('[name="order_type"]'));
    const personalizationMode = root.querySelector('[data-jill-personalization-mode]');
    const personalizationAdd = root.querySelector('[data-jill-personalization-add]');
    const personalizationFinish = root.querySelector('[data-jill-personalization-finish]');
    const finishConfiguration = root.querySelector('[data-jill-finish-configuration]');
    const reviewOpen = root.querySelector('[data-jill-review-open]');
    const reviewBack = root.querySelector('[data-jill-review-back]');
    const reviewConfirm = root.querySelector('[data-jill-review-confirm]');
    const requestSubmit = root.querySelector('[data-jill-request-submit]');
    const review = root.querySelector('[data-jill-custom-order-review]');
    const edit = root.querySelector('[data-jill-custom-order-edit]');
    const header = root.querySelector('[data-jill-edit-only]');
    const success = root.querySelector('[data-jill-custom-order-success]');
    const status = root.querySelector('[data-jill-custom-order-status]');

    const setStatus = (message) => { if (status) status.textContent = message || ''; };

    orderTypeInputs.forEach((input) => input.addEventListener('change', () => {
      if (input.checked && input.value === 'one') {
        selectedCollectionChoices(root).slice(1).forEach((choice) => { choice.checked = false; });
        selectedChoices(root).slice(1).forEach((choice) => {
          const checkbox = choice.querySelector('[data-jill-custom-order-select]');
          if (checkbox) checkbox.checked = false;
        });
      }
      resetOptions(root);
      personalizationState(root).finished = false;
      renderPersonalization(root);
      syncProgression(root);
    }));

    collectionChoices(root).forEach((input) => input.addEventListener('change', () => {
      if (input.checked && readChecked(root, 'order_type') === 'one') {
        collectionChoices(root).forEach((candidate) => { if (candidate !== input) candidate.checked = false; });
      }
      syncProductVisibility(root);
      resetOptions(root);
      personalizationState(root).finished = false;
      renderPersonalization(root);
      syncProgression(root);
    }));

    productChoices(root).forEach((choice) => {
      const input = choice.querySelector('[data-jill-custom-order-select]');
      input?.addEventListener('change', () => {
        if (input.checked && readChecked(root, 'order_type') === 'one') {
          productChoices(root).forEach((candidate) => {
            if (candidate === choice) return;
            const checkbox = candidate.querySelector('[data-jill-custom-order-select]');
            if (checkbox) checkbox.checked = false;
          });
        }
        syncSelectedItems(root);
        resetOptions(root);
        personalizationState(root).finished = false;
        renderPersonalization(root);
        syncProgression(root);
      });
      const quantity = projectionQuantity(choice);
      quantity?.addEventListener('input', () => {
        syncCanonicalQuantity(root, choice);
        resetOptions(root);
        personalizationState(root).finished = false;
        syncProgression(root);
      });
      quantity?.addEventListener('change', () => {
        syncCanonicalQuantity(root, choice);
        resetOptions(root);
        personalizationState(root).finished = false;
        syncProgression(root);
      });
    });

    root.querySelectorAll('[data-jill-option-card-toggle]').forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const item = toggle.closest('[data-jill-custom-order-item]');
        const body = item?.querySelector('[data-jill-option-card-body]');
        if (!body) return;
        if (root.dataset.jillOptionsFinished === 'true') resetOptions(root);
        const open = body.hidden;
        body.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        syncProgression(root);
      });
    });

    root.querySelector('[data-jill-stage="configuration"]')?.addEventListener('input', (event) => {
      if (eventItem(event)) {
        resetOptions(root);
        updateItemStatuses(root);
        syncProgression(root);
      }
    });
    root.querySelector('[data-jill-stage="configuration"]')?.addEventListener('change', (event) => {
      if (eventItem(event)) {
        resetOptions(root);
        updateItemStatuses(root);
        syncProgression(root);
      }
    });

    finishConfiguration?.addEventListener('click', () => validateConfiguration(root));

    personalizationMode?.addEventListener('change', () => {
      const state = personalizationState(root);
      state.mode = personalizationMode.value;
      state.finished = state.mode === 'none';
      if (state.mode === 'different') {
        state.groups = [];
        state.open.clear();
      }
      renderPersonalization(root);
      syncProgression(root);
    });

    personalizationAdd?.addEventListener('click', () => {
      const state = personalizationState(root);
      const assigned = new Set(state.groups.flatMap((group) => group.productIds));
      const remaining = selectedProductIds(root).filter((id) => !assigned.has(id));
      if (!remaining.length || state.groups.some((group) => !group.productIds.length || !group.wording.trim())) return;
      state.groups.push(newPersonalizationGroup(state));
      state.finished = false;
      renderPersonalization(root);
      syncProgression(root);
    });

    personalizationFinish?.addEventListener('click', () => {
      const state = personalizationState(root);
      const completion = personalizationCompletion(root);
      if (!completion.complete) return;
      state.finished = true;
      state.open.clear();
      renderPersonalization(root);
      syncProgression(root);
      root.querySelector('[data-jill-reference-stage]')?.scrollIntoView({behavior: 'smooth', block: 'center'});
    });

    root.querySelectorAll('[data-jill-reference-choice]').forEach((input) => input.addEventListener('change', () => {
      if (input.checked && input.value === 'no') mediaState(root).error = '';
      renderMedia(root);
      syncProgression(root);
    }));

    root.addEventListener('input', (event) => {
      if (event.target.closest('[data-jill-custom-order-customer], [data-jill-design-core], [data-jill-custom-order-planning], [data-jill-stage="final"]')) syncProgression(root);
    });
    root.addEventListener('change', (event) => {
      if (event.target.closest('[data-jill-custom-order-customer], [data-jill-design-core], [data-jill-custom-order-planning], [data-jill-stage="final"]')) syncProgression(root);
    });

    function firstReviewIssue() {
      const customer = validateControlGroup(root.querySelector('[data-jill-custom-order-customer]'), true);
      if (!customer.valid) return customer.firstInvalid;
      if (!readChecked(root, 'order_type')) return root.querySelector('[name="order_type"]');
      if (!selectedCollectionChoices(root).length) return root.querySelector('[data-jill-collection-choice]');
      if (!selectedChoices(root).length) return root.querySelector('[data-jill-custom-order-select]');
      if (root.dataset.jillOptionsFinished !== 'true') {
        validateConfiguration(root);
        return firstIncompleteItem(root)?.target || finishConfiguration;
      }
      const design = validateControlGroup(root.querySelector('[data-jill-design-core]'), true);
      if (!design.valid) return design.firstInvalid;
      const completion = personalizationCompletion(root);
      const state = personalizationState(root);
      if (!completion.complete || (state.mode !== 'none' && !state.finished)) return personalizationMode;
      if (!referenceReady(root)) return root.querySelector('[data-jill-reference-choice]') || root.querySelector('[data-jill-media-input]');
      const planning = validateControlGroup(root.querySelector('[data-jill-custom-order-planning]'), true);
      if (!planning.valid) return planning.firstInvalid;
      const acknowledgment = root.querySelector('[data-jill-request-acknowledgment]');
      if (!acknowledgment?.checked) return acknowledgment;
      return null;
    }

    function openReview() {
      setStatus('');
      const issue = firstReviewIssue();
      if (issue) {
        const note = root.querySelector('[data-jill-review-validation-note]');
        if (note) {
          note.textContent = 'Please complete the highlighted required fields before reviewing your request.';
          note.hidden = false;
        }
        scrollToTarget(issue);
        return;
      }
      const note = root.querySelector('[data-jill-review-validation-note]');
      if (note) note.hidden = true;
      try {
        request = cleanUndefined(buildRequest(root));
        editScroll = globalThis.scrollY || 0;
        renderReview(root, request);
        root.dataset.jillCustomOrderRequest = JSON.stringify(request);
        if (edit) edit.hidden = true;
        if (header) header.hidden = true;
        reviewConfirm.checked = false;
        requestSubmit.disabled = true;
        requestSubmit.setAttribute('aria-disabled', 'true');
        review.scrollIntoView({behavior: 'smooth', block: 'start'});
      } catch (error) {
        setStatus(error.message.replace(/^JILL custom order:\s*/, ''));
      }
    }

    function backToEdit() {
      setVisible(review, false);
      if (edit) edit.hidden = false;
      if (header) header.hidden = false;
      reviewConfirm.checked = false;
      requestSubmit.disabled = true;
      requestSubmit.setAttribute('aria-disabled', 'true');
      request = null;
      delete root.dataset.jillCustomOrderRequest;
      syncProgression(root);
      setTimeout(() => globalThis.scrollTo?.({top: editScroll, behavior: 'smooth'}), 0);
    }

    async function submit() {
      if (!request || !reviewConfirm.checked || requestSubmit.disabled) return;
      requestSubmit.disabled = true;
      requestSubmit.setAttribute('aria-disabled', 'true');
      requestSubmit.textContent = root.dataset.sendingLabel || 'Sending request…';
      setStatus('');
      try {
        request = cleanUndefined(buildRequest(root));
        await submitRequest(root, request);
        setVisible(review, false);
        setVisible(success, true);
        success.scrollIntoView({behavior: 'smooth', block: 'start'});
        success.querySelector('[data-jill-success-title]')?.focus({preventScroll: true});
      } catch (error) {
        setStatus(error.message.replace(/^JILL custom order:\s*/, ''));
        requestSubmit.disabled = false;
        requestSubmit.setAttribute('aria-disabled', 'false');
        requestSubmit.textContent = root.dataset.requestLabel || 'Request Custom Order';
      }
    }

    reviewOpen?.addEventListener('click', openReview);
    reviewBack?.addEventListener('click', backToEdit);
    reviewConfirm?.addEventListener('change', () => {
      const enabled = reviewConfirm.checked && Boolean(request);
      requestSubmit.disabled = !enabled;
      requestSubmit.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    });
    requestSubmit?.addEventListener('click', submit);

    applyCatalogPrefill(root);
    if (root.dataset.jillCustomOrderPrefilled === 'true') syncProductVisibility(root);
    renderPersonalization(root);
    syncProgression(root);
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