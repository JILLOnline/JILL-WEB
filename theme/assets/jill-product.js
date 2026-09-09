(() => {
  'use strict';

  function controlsFor(wrapper) {
    return wrapper ? Array.from(wrapper.querySelectorAll('input, select, textarea')) : [];
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
    if (!wrapper) return;
    wrapper.hidden = !available;
    wrapper.setAttribute('aria-hidden', available ? 'false' : 'true');
    for (const control of controlsFor(wrapper)) control.disabled = !available;
    if (!available) clearFieldError(wrapper);
  }

  function errorShell(container) {
    if (container?.matches?.('.jill-field, .jill-choice, .jill-quantity')) return container;
    return container?.querySelector?.('.jill-field, .jill-choice, .jill-quantity') || null;
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
    if (!container) return null;
    return Array.from(container.querySelectorAll('input, select, textarea, button, a[href]'))
      .find((control) => control.tabIndex >= 0 && !control.disabled && !control.hidden && control.type !== 'hidden') || null;
  }

  function appendRequiredMark(label) {
    const mark = document.createElement('span');
    mark.className = 'jill-field__required';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '*';
    label.append(' ', mark);
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
    const allocationMount = form.querySelector('[data-jill-product-options-allocation]');
    const allocationGroupsNode = allocationMount?.querySelector('[data-jill-product-options-groups]') || null;
    const allocationSummary = allocationMount?.querySelector('[data-jill-product-options-summary]') || null;
    const allocationAddButton = allocationMount?.querySelector('[data-jill-product-options-add]') || null;
    const allocationQuantityTemplate = allocationMount?.querySelector('[data-jill-allocation-quantity-template]') || null;
    const productOptionsPayload = form.querySelector('[data-jill-product-options-payload]');
    let profile = null;
    let allocatedOptionFieldIds = new Set();
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
        allocatedOptionFieldIds = new Set(
          globalThis.JILLProductCapabilities.getProductOptionsAllocationFieldIds(profile),
        );
      } catch (error) {
        failConfiguration();
        return;
      }
    }

    const wrappers = new Map();
    if (profile) {
      for (const field of profile.fields) {
        if (allocatedOptionFieldIds.has(field.id)) continue;
        const wrapper = form.querySelector(`[data-jill-capability-field="${field.id}"]`);
        if (!wrapper) {
          failConfiguration();
          return;
        }
        wrappers.set(field.id, wrapper);
      }

      if (profile.groups.product_options.length > 0 && !productOptionsPayload) {
        failConfiguration();
        return;
      }
      if (
        allocatedOptionFieldIds.size > 0
        && (!allocationMount || !allocationGroupsNode || !allocationAddButton || !allocationQuantityTemplate || !globalThis.JILLQuantity)
      ) {
        failConfiguration();
        return;
      }
    }

    function readValues() {
      const values = Object.create(null);
      if (!profile) return values;
      for (const field of profile.fields) {
        const wrapper = wrappers.get(field.id);
        if (wrapper) values[field.id] = readFieldValue(field, wrapper);
      }
      return values;
    }

    function readMerchandiseQuantity() {
      if (!quantityControl) return 1;
      const quantity = Number(quantityControl.value);
      if (!quantityControl.validity.valid || !Number.isSafeInteger(quantity) || quantity < 1) return null;
      return quantity;
    }

    function quantityContainer() {
      return quantityControl?.closest('.jill-quantity') || null;
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
        const wrapper = wrappers.get(result.id);
        if (!wrapper) continue;
        const field = globalThis.JILLProductCapabilities.getField(profile, result.id);
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

    function ensureDefaultAllocationGroup(state) {
      if (!state?.allocation.available || state.eligibleUnitCount < 1) return state;
      if (state.allocation.groups.length > 0 || state.allocation.unallocatedUnitIds.length === 0) return state;

      let next = globalThis.JILLProductOptions.addAllocationGroup(state, profile);
      const group = next.allocation.groups[next.allocation.groups.length - 1];
      return globalThis.JILLProductOptions.setAllocationGroupCount(
        next,
        profile,
        group.id,
        next.allocation.unallocatedUnitIds.length,
      );
    }

    function allocationUnitLabel(count) {
      const configured = profile?.features?.customizationUnits;
      if (count === 1) return configured?.singularLabel || allocationMount?.dataset.itemLabel || 'item';
      return configured?.pluralLabel || allocationMount?.dataset.itemsLabel || 'items';
    }

    function allocationGroupElement(groupId) {
      if (!allocationGroupsNode) return null;
      return Array.from(allocationGroupsNode.querySelectorAll('[data-jill-product-options-group]'))
        .find((node) => node.dataset.jillProductOptionsGroup === groupId) || null;
    }

    function allocationFieldElement(groupId, fieldId) {
      const group = allocationGroupElement(groupId);
      if (!group) return null;
      return Array.from(group.querySelectorAll('[data-jill-product-options-field]'))
        .find((node) => node.dataset.jillProductOptionsField === fieldId) || null;
    }

    function allocationCountElement(groupId) {
      return allocationGroupElement(groupId)?.querySelector('[data-jill-product-options-count]') || null;
    }

    function commitProductOptions(nextState) {
      productOptionsState = nextState;
      evaluateCustomization(attemptedSubmit);
    }

    function createAllocationCountField(group, groupIndex) {
      const shell = allocationQuantityTemplate.content.firstElementChild?.cloneNode(true);
      if (!shell) throw new Error('Quantity template is unavailable');

      shell.dataset.jillProductOptionsCountField = group.id;

      const id = `JillProductOptionCount-${root.dataset.jillProductId}-${group.id}`;
      const visibleLabel = `${allocationMount.dataset.countLabel} ${allocationUnitLabel(2)}`;
      const accessibleLabel = `${allocationMount.dataset.groupLabel} ${groupIndex + 1}: ${visibleLabel}`;
      const input = globalThis.JILLQuantity.configure(shell, {
        id,
        label: visibleLabel,
        accessibleLabel,
        value: group.unitIds.length,
        min: 1,
        max: group.unitIds.length + productOptionsState.allocation.unallocatedUnitIds.length,
        step: 1,
        required: true,
      });

      input.dataset.jillProductOptionsCount = group.id;
      input.addEventListener('change', () => {
        const count = Number(input.value);
        try {
          commitProductOptions(
            globalThis.JILLProductOptions.setAllocationGroupCount(
              productOptionsState,
              profile,
              group.id,
              count,
            ),
          );
        } catch (error) {
          renderProductOptions();
        }
      });

      return shell;
    }

    function availableAllocationOptions(group, field) {
      return globalThis.JILLProductOptions.getAvailableAllocationFieldOptions(
        productOptionsState,
        profile,
        group.id,
        field.id,
      );
    }

    function createAllocationSelect(field, group) {
      const shell = document.createElement('div');
      shell.className = 'jill-field';
      shell.dataset.jillProductOptionsField = field.id;

      const id = `JillProductOption-${root.dataset.jillProductId}-${group.id}-${field.id}`;
      const label = document.createElement('label');
      label.className = 'jill-field__label';
      label.htmlFor = id;
      label.textContent = field.label;
      if (field.required) appendRequiredMark(label);

      const select = document.createElement('select');
      select.className = 'jill-field__control';
      select.id = id;
      if (field.required) select.required = true;

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.textContent = status?.dataset.chooseOptionLabel || 'Choose an option';
      select.append(placeholder);

      for (const option of availableAllocationOptions(group, field)) {
        const optionNode = document.createElement('option');
        optionNode.value = option.value;
        optionNode.textContent = option.label;
        select.append(optionNode);
      }

      select.value = group.values[field.id] || '';
      if (!select.value) placeholder.selected = true;
      select.addEventListener('change', () => {
        try {
          commitProductOptions(
            globalThis.JILLProductOptions.setAllocationGroupValue(
              productOptionsState,
              profile,
              group.id,
              field.id,
              select.value,
            ),
          );
        } catch (error) {
          renderProductOptions();
        }
      });

      shell.append(label, select);
      return shell;
    }

    function createAllocationRadio(field, group) {
      const shell = document.createElement('fieldset');
      shell.className = 'jill-field';
      shell.dataset.jillProductOptionsField = field.id;

      const legend = document.createElement('legend');
      legend.className = 'jill-field__label';
      legend.textContent = field.label;
      if (field.required) appendRequiredMark(legend);
      shell.append(legend);

      const choices = document.createElement('div');
      choices.className = 'jill-choice-group';

      for (const [index, option] of availableAllocationOptions(group, field).entries()) {
        const id = `JillProductOption-${root.dataset.jillProductId}-${group.id}-${field.id}-${index + 1}`;
        const label = document.createElement('label');
        label.className = 'jill-choice';
        label.htmlFor = id;

        const input = document.createElement('input');
        input.className = 'jill-choice__control';
        input.id = id;
        input.type = 'radio';
        input.value = option.value;
        input.checked = group.values[field.id] === option.value;
        input.addEventListener('change', () => {
          if (!input.checked) return;
          try {
            commitProductOptions(
              globalThis.JILLProductOptions.setAllocationGroupValue(
                productOptionsState,
                profile,
                group.id,
                field.id,
                input.value,
              ),
            );
          } catch (error) {
            renderProductOptions();
          }
        });

        const text = document.createElement('span');
        text.className = 'jill-choice__label';
        text.textContent = option.label;
        label.append(input, text);
        choices.append(label);
      }

      shell.append(choices);
      return shell;
    }

    function renderAllocationGroup(group, groupIndex) {
      const container = document.createElement('div');
      container.className = 'jill-product-customization__group';
      container.dataset.jillProductOptionsGroup = group.id;

      const heading = document.createElement('h5');
      heading.className = 'jill-product-customization__group-title';
      heading.textContent = `${allocationMount.dataset.groupLabel} ${groupIndex + 1}`;
      container.append(heading, createAllocationCountField(group, groupIndex));

      const results = Object.fromEntries(group.results.map((result) => [result.id, result]));
      for (const fieldId of productOptionsState.allocation.fieldIds) {
        const result = results[fieldId];
        if (!result?.available) continue;
        const field = globalThis.JILLProductCapabilities.getField(profile, fieldId);
        const fieldNode = field.kind === 'radio'
          ? createAllocationRadio(field, group)
          : createAllocationSelect(field, group);
        container.append(fieldNode);
      }

      if (productOptionsState.allocation.groups.length > 1) {
        const remove = document.createElement('button');
        remove.className = 'jill-button';
        remove.dataset.variant = 'secondary';
        remove.type = 'button';
        remove.textContent = allocationMount.dataset.removeLabel;
        remove.addEventListener('click', () => {
          commitProductOptions(
            globalThis.JILLProductOptions.removeAllocationGroup(
              productOptionsState,
              profile,
              group.id,
            ),
          );
        });
        container.append(remove);
      }

      return container;
    }

    function syncProductOptionsPayload() {
      if (!productOptionsPayload) return;
      productOptionsPayload.value = productOptionsState
        ? JSON.stringify(globalThis.JILLProductOptions.toPayload(productOptionsState))
        : '';
    }

    function renderProductOptions() {
      syncProductOptionsPayload();
      if (!allocationMount || !allocationGroupsNode || !allocationAddButton) return;

      const available = Boolean(productOptionsState?.allocation.available);
      allocationMount.hidden = !available;
      allocationMount.setAttribute('aria-hidden', available ? 'false' : 'true');
      if (!available) {
        allocationGroupsNode.replaceChildren();
        if (allocationSummary) {
          allocationSummary.textContent = '';
          allocationSummary.hidden = true;
        }
        allocationAddButton.hidden = true;
        return;
      }

      allocationGroupsNode.replaceChildren(
        ...productOptionsState.allocation.groups.map(renderAllocationGroup),
      );

      const unallocated = productOptionsState.allocation.unallocatedUnitIds.length;
      const assigned = productOptionsState.eligibleUnitCount - unallocated;
      const unitLabel = allocationUnitLabel(productOptionsState.eligibleUnitCount);
      const hasUnallocated = unallocated > 0;
      const canAdd = hasUnallocated && globalThis.JILLProductOptions.canAddAllocationGroup(productOptionsState, profile);
      if (allocationSummary) {
        allocationSummary.hidden = !hasUnallocated;
        allocationSummary.textContent = hasUnallocated
          ? `${assigned} ${allocationMount.dataset.ofLabel} ${productOptionsState.eligibleUnitCount} ${unitLabel} ${allocationMount.dataset.assignedLabel} — ${unallocated} ${allocationMount.dataset.unassignedLabel}`
          : '';
      }
      allocationAddButton.hidden = !canAdd;
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
      for (const node of allocationGroupsNode?.querySelectorAll('[data-jill-product-options-field], [data-jill-product-options-count-field]') || []) {
        clearFieldError(node);
      }
      const quantity = quantityContainer();
      if (quantity) clearFieldError(quantity);
    }

    function optionIssueTarget() {
      const issue = productOptionsState?.firstIssue;
      if (!issue) return null;
      if (issue.scope === 'singleton' && issue.fieldId) return wrappers.get(issue.fieldId) || null;
      if (issue.scope === 'allocation_group' && issue.reason === 'field') {
        return allocationFieldElement(issue.groupId, issue.fieldId);
      }
      if (issue.scope === 'allocation_group' && issue.reason === 'units') {
        return allocationCountElement(issue.groupId)?.closest('.jill-quantity') || null;
      }
      if (issue.scope === 'allocation_group' && issue.reason === 'duplicate') {
        return allocationGroupElement(issue.groupId);
      }
      if (issue.scope === 'allocation' && issue.reason === 'unallocated') return allocationAddButton;
      return allocationMount;
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
        const target = optionIssueTarget();
        if (target?.matches?.('.jill-field, .jill-quantity') || target?.querySelector?.('.jill-field, .jill-quantity')) markFieldError(target);
        const allocationTitle = allocationMount?.querySelector('.jill-product-customization__group-title')?.textContent;
        setStatus(`${prefix} ${field?.label || allocationTitle || 'Product options'}`);
        return firstFocusableControl(target) || (target?.focus ? target : null);
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
      let nextProductOptionsState = buildProductOptions(synced.values, merchandiseQuantity);
      if (merchandiseQuantity !== null && !nextProductOptionsState) {
        setStatus(status?.dataset.configError || 'This product is temporarily unavailable.');
        return {valid: false, focusControl: null};
      }

      try {
        nextProductOptionsState = ensureDefaultAllocationGroup(nextProductOptionsState);
      } catch (error) {
        setStatus(status?.dataset.configError || 'This product is temporarily unavailable.');
        return {valid: false, focusControl: null};
      }
      productOptionsState = nextProductOptionsState;
      renderProductOptions();

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

      if (allocationAddButton) {
        allocationAddButton.addEventListener('click', () => {
          if (!productOptionsState?.allocation.available || !globalThis.JILLProductOptions.canAddAllocationGroup(productOptionsState, profile)) return;
          try {
            let next = globalThis.JILLProductOptions.addAllocationGroup(productOptionsState, profile);
            const group = next.allocation.groups[next.allocation.groups.length - 1];
            next = globalThis.JILLProductOptions.setAllocationGroupCount(
              next,
              profile,
              group.id,
              next.allocation.unallocatedUnitIds.length,
            );
            commitProductOptions(next);
          } catch (error) {
            failConfiguration();
          }
        });
      }

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
