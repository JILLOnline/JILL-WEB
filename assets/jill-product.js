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

  function setFieldAvailability(wrapper, available) {
    wrapper.hidden = !available;
    wrapper.setAttribute('aria-hidden', available ? 'false' : 'true');
    for (const control of controlsFor(wrapper)) {
      control.disabled = !available;
    }

    if (!available) clearFieldError(wrapper);
  }

  function fieldShell(wrapper) {
    return wrapper.querySelector('.jill-field') || wrapper.querySelector('.jill-choice');
  }

  function clearFieldError(wrapper) {
    const shell = fieldShell(wrapper);
    if (shell?.dataset.state === 'error') delete shell.dataset.state;
    for (const control of controlsFor(wrapper)) control.removeAttribute('aria-invalid');
  }

  function markFieldError(wrapper) {
    const shell = fieldShell(wrapper);
    if (shell) shell.dataset.state = 'error';
    for (const control of controlsFor(wrapper)) {
      if (!control.disabled) control.setAttribute('aria-invalid', 'true');
    }
  }

  function firstFocusableControl(wrapper) {
    return controlsFor(wrapper).find((control) => !control.disabled && control.type !== 'hidden');
  }

  function initializeProduct(root) {
    if (!root || root.dataset.jillProductInitialized === 'true') return;

    const form = root.querySelector('.jill-product-form');
    if (!form) return;

    root.dataset.jillProductInitialized = 'true';

    const status = root.querySelector('[data-jill-product-status]');
    const submitButton = form.querySelector('.jill-button[type="submit"]');
    const variantSelect = form.querySelector('[data-jill-variant-select]');
    const price = root.querySelector('[data-jill-product-price]');
    const profileNode = form.querySelector('[data-jill-product-capability-profile]');
    let profile = null;
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

    function evaluateCustomization(showError) {
      if (!profile) return null;

      const values = Object.create(null);
      for (const field of profile.fields) {
        values[field.id] = readFieldValue(field, wrappers.get(field.id));
      }

      let validation;
      try {
        validation = globalThis.JILLFormEngine.validateFields(profile.fields, values);
      } catch (error) {
        failConfiguration();
        return null;
      }

      for (const result of validation.results) {
        const wrapper = wrappers.get(result.id);
        setFieldAvailability(wrapper, result.available);
        if (result.valid) clearFieldError(wrapper);
      }

      if (showError) {
        for (const wrapper of wrappers.values()) clearFieldError(wrapper);

        if (!validation.valid && validation.firstInvalidId) {
          const field = globalThis.JILLProductCapabilities.getField(profile, validation.firstInvalidId);
          const wrapper = wrappers.get(validation.firstInvalidId);
          markFieldError(wrapper);
          const prefix = status?.dataset.errorPrefix || 'Please complete:';
          setStatus(`${prefix} ${field.label}`);
        }
      } else if (validation.valid) {
        setStatus('');
      }

      return validation;
    }

    if (variantSelect) {
      variantSelect.addEventListener('change', syncVariant);
      syncVariant();
    }

    if (profile) {
      form.addEventListener('input', (event) => {
        if (!event.target.closest('[data-jill-capability-field]')) return;
        evaluateCustomization(attemptedSubmit);
      });

      form.addEventListener('change', (event) => {
        if (!event.target.closest('[data-jill-capability-field]')) return;
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
      const validation = evaluateCustomization(true);
      if (!validation || validation.valid) return;

      event.preventDefault();
      const wrapper = wrappers.get(validation.firstInvalidId);
      const control = firstFocusableControl(wrapper);
      control?.focus();
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
