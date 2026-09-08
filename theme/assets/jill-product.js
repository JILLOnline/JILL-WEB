(() => {
  'use strict';

  function controlsFor(wrapper) {
    return Array.from(wrapper.querySelectorAll('input, select, textarea'));
  }

  function readFieldValue(field, wrapper) {
    const controls = controlsFor(wrapper);

    if (field.kind === 'radio') {
      const checked = controls.find((control) => control.type === 'radio' && control.checked);
      return checked ? checked.value : '';
    }

    if (field.kind === 'checkbox') {
      const checkbox = controls.find((control) => control.type === 'checkbox');
      return Boolean(checkbox?.checked);
    }

    if (field.kind === 'file') {
      return controls
        .filter((control) => control.type === 'file')
        .flatMap((control) => Array.from(control.files || []));
    }

    return controls[0]?.value ?? '';
  }

  function clearFieldValue(field, wrapper) {
    for (const control of controlsFor(wrapper)) {
      if (field.kind === 'radio' || field.kind === 'checkbox') control.checked = false;
      else control.value = '';
    }
  }

  function setFieldAvailability(wrapper, available) {
    wrapper.hidden = !available;
    wrapper.setAttribute('aria-hidden', available ? 'false' : 'true');
    for (const control of controlsFor(wrapper)) {
      control.disabled = !available;
    }

    if (!available) clearFieldError(wrapper);
  }

  function errorShell(container) {
    if (container?.matches?.('.jill-field, .jill-choice')) return container;
    return container?.querySelector?.('.jill-field, .jill-choice') || null;
  }

  function clearFieldError(container) {
    const shell = errorShell(container);
    if (shell?.dataset.state === 'error') delete shell.dataset.state;
    for (const control of controlsFor(container)) control.removeAttribute('aria-invalid');
  }

  function markFieldError(container) {
    const shell = errorShell(container);
    if (shell) shell.dataset.state = 'error';
    for (const control of controlsFor(container)) {
      if (!control.disabled) control.setAttribute('aria-invalid', 'true');
    }
  }

  function firstFocusableControl(container) {
    return controlsFor(container).find((control) => !control.disabled && control.type !== 'hidden');
  }

  function initializeProduct(root) {
    if (!root || root.dataset.jillProductInitialized === 'true') return;

    const form = root.querySelector('.jill-product-form');
    if (!form) return;

    root.dataset.jillProductInitialized = 'true';

    const status = root.querySelector('[data-jill-product-status]');
    const submitButton = form.querySelector('.jill-button[type="submit"]');
    const variantSelect = form.querySelector('[data-jill-variant-select]');
    const quantityControl = form.querySelector('[name="quantity"]');
    const price = root.querySelector('[data-jill-product-price]');
    const profileNode = form.querySelector('[data-jill-product-capability-profile]');
    let profile = null;
    let productOptionsState = null;
    let attemptedSubmit = false;

    function setStatus(message) {
      if (status) status.textContent = message || '';
    }

    function failConfiguration() {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute('aria-disabled', 'true');
      }
      setStatus(status?.dataset.configError || 'This product is temporarily unavailable.');
    }

    function syncVariant() {
      if (!variantSelect) return;
      const option = variantSelect.options[variantSelect.selectedIndex];
      if (!option) {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.setAttribute('aria-disabled', 'true');
        }
        return;
      }

      if (price && option.dataset.priceLabel) price.textContent = option.dataset.priceLabel;

      const available = option.dataset.available === 'true';
      if (submitButton) {
        submitButton.disabled = !available;
        submitButton.setAttribute('aria-disabled', available ? 'false' : 'true');
      }
    }

    if (profileNode) {
      try {
        const source = profileNode.textContent.trim();
        profile = globalThis.JILLProductCapabilities.resolve(source);
      } catch (error) {
        failConfiguration();
        return;
      }
    }

    const wrappers = new Map();
    if (profile) {
      for (const field of profile.fields) {
        const wrapper = form.querySelector(`[data-jill-capability-field="${field.id}"]`);
        if (!wrapper) {
          failConfiguration();
          return;
        }
        wrappers.set(field.id, wrapper);
      }
    }

    function readValues() {
      const values = Object.create(null);
      if (!profile) return values;
      for (const field of profile.fields) values[field.id] = readFieldValue(field, wrappers.get(field.id));
      return values;
    }

    function readMerchandiseQuantity() {
      if (!quantityControl) return 1;
      const quantity = Number(quantityControl.value);
      if (!quantityControl.validity.valid || !Number.isSafeInteger(quantity) || quantity < 1) return null;
      return quantity;
    }

    function quantityContainer() {
      return quantityControl?.closest('.jill-field') || null;
    }

    function allocationGroupsForRebuild() {
      if (!productOptionsState) return [];
      return productOptionsState.allocation.groups.map((group) => ({
        id: group.id,
        unitIds: [...group.unitIds],
        values: {...group.values},
      }));
    }

    function validateAndSyncFields() {
      let values = readValues();
      let validation = globalThis.JILLFormEngine.validateFields(profile.fields, values);
      let clearedUnavailableValue = false;

      for (const result of validation.results) {
        const field = globalThis.JILLProductCapabilities.getField(profile, result.id);
        const wrapper = wrappers.get(result.id);
        setFieldAvailability(wrapper, result.available);
        if (!result.available) {
          clearFieldValue(field, wrapper);
          clearedUnavailableValue = true;
        }
        if (result.valid) clearFieldError(wrapper);
      }

      if (clearedUnavailableValue) {
        values = readValues();
        validation = globalThis.JILLFormEngine.validateFields(profile.fields, values);
      }

      return {values, validation};
    }

    function buildProductOptions(values, merchandiseQuantity) {
      if (!profile || merchandiseQuantity === null) return null;
      const productId = root.dataset.jillProductId;
      if (!productId || !globalThis.JILLProductOptions) return null;

      try {
        return globalThis.JILLProductOptions.createState({
          itemId: `shopify-product:${productId}`,
          merchandiseQuantity,
          profile,
          values,
          allocationGroups: allocationGroupsForRebuild(),
          nextGroupNumber: productOptionsState?.nextGroupNumber || 1,
        });
      } catch (error) {
        return null;
      }
    }

    function firstOtherBlockingResult(validation) {
      return validation.results.find((result) => {
        const field = globalThis.JILLProductCapabilities.getField(profile, result.id);
        return field.group !== 'product_options' && result.available && !result.valid;
      }) || null;
    }

    function optionIssueField() {
      const fieldId = productOptionsState?.firstIssue?.fieldId
        || productOptionsState?.allocation?.fieldIds?.[0]
        || productOptionsState?.singleton?.firstInvalidFieldId;
      return fieldId ? globalThis.JILLProductCapabilities.getField(profile, fieldId) : null;
    }

    function clearAllErrors() {
      for (const wrapper of wrappers.values()) clearFieldError(wrapper);
      const quantity = quantityContainer();
      if (quantity) clearFieldError(quantity);
    }

    function showBlockingError(quantity, otherBlocking) {
      clearAllErrors();
      const prefix = status?.dataset.errorPrefix || 'Please complete:';

      if (quantity === null) {
        const container = quantityContainer();
        if (container) markFieldError(container);
        setStatus(`${prefix} ${status?.dataset.quantityLabel || 'Quantity'}`);
        return firstFocusableControl(container);
      }

      if (productOptionsState && !productOptionsState.complete) {
        const field = optionIssueField();
        const wrapper = field ? wrappers.get(field.id) : null;
        if (wrapper && !wrapper.hidden) markFieldError(wrapper);
        setStatus(`${prefix} ${field?.label || 'Product options'}`);
        return wrapper && !wrapper.hidden ? firstFocusableControl(wrapper) : null;
      }

      if (otherBlocking) {
        const field = globalThis.JILLProductCapabilities.getField(profile, otherBlocking.id);
        const wrapper = wrappers.get(otherBlocking.id);
        markFieldError(wrapper);
        setStatus(`${prefix} ${field.label}`);
        return firstFocusableControl(wrapper);
      }

      setStatus('');
      return null;
    }

    function evaluateCustomization(showError) {
      if (!profile) return {valid: true, focusControl: null};

      let synced;
      try {
        synced = validateAndSyncFields();
      } catch (error) {
        setStatus(status?.dataset.configError || 'This product is temporarily unavailable.');
        return {valid: false, focusControl: null};
      }

      const merchandiseQuantity = readMerchandiseQuantity();
      const nextProductOptionsState = buildProductOptions(synced.values, merchandiseQuantity);
      if (merchandiseQuantity !== null && !nextProductOptionsState) {
        setStatus(status?.dataset.configError || 'This product is temporarily unavailable.');
        return {valid: false, focusControl: null};
      }
      productOptionsState = nextProductOptionsState;

      const otherBlocking = firstOtherBlockingResult(synced.validation);
      const valid = merchandiseQuantity !== null
        && Boolean(productOptionsState?.complete)
        && !otherBlocking;

      let focusControl = null;
      if (showError) focusControl = showBlockingError(merchandiseQuantity, otherBlocking);
      else if (valid) {
        clearAllErrors();
        setStatus('');
      }

      return {valid, focusControl};
    }

    if (variantSelect) {
      variantSelect.addEventListener('change', syncVariant);
      syncVariant();
    }

    if (profile) {
      form.addEventListener('input', (event) => {
        if (event.target !== quantityControl && !event.target.closest('[data-jill-capability-field]')) return;
        evaluateCustomization(attemptedSubmit);
      });

      form.addEventListener('change', (event) => {
        if (event.target !== quantityControl && !event.target.closest('[data-jill-capability-field]')) return;
        evaluateCustomization(attemptedSubmit);
      });

      evaluateCustomization(false);
    }

    form.addEventListener('submit', (event) => {
      syncVariant();
      if (submitButton?.disabled) {
        event.preventDefault();
        return;
      }

      if (!profile) return;

      attemptedSubmit = true;
      const result = evaluateCustomization(true);
      if (result.valid) return;

      event.preventDefault();
      result.focusControl?.focus();
    });
  }

  function initializeWithin(scope) {
    for (const root of scope.querySelectorAll('[data-jill-product]')) initializeProduct(root);
  }

  initializeWithin(document);

  document.addEventListener('shopify:section:load', (event) => {
    initializeWithin(event.target);
    if (event.target.matches?.('[data-jill-product]')) initializeProduct(event.target);
  });
})();
