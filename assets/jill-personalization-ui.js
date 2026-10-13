(() => {
  'use strict';

  function fail(message) {
    throw new Error(`JILL personalization UI: ${message}`);
  }

  function dependencies() {
    const capabilities = globalThis.JILLProductCapabilities;
    const personalization = globalThis.JILLPersonalization;
    const quantity = globalThis.JILLQuantity;
    if (!capabilities) fail('JILLProductCapabilities is required');
    if (!personalization) fail('JILLPersonalization is required');
    if (!quantity) fail('JILLQuantity is required');
    return {capabilities, personalization, quantity};
  }

  function controlsFor(container) {
    return container ? Array.from(container.querySelectorAll('input, select, textarea')) : [];
  }

  function readMerchandiseQuantity(control) {
    if (!control) return 1;
    const value = Number(control.value);
    if (!control.validity.valid || !Number.isSafeInteger(value) || value < 1) return null;
    return value;
  }

  function readFieldValue(field, container) {
    const controls = controlsFor(container);
    if (field.kind === 'radio') return controls.find((control) => control.type === 'radio' && control.checked)?.value ?? '';
    if (field.kind === 'checkbox') return Boolean(controls.find((control) => control.type === 'checkbox')?.checked);
    if (field.kind === 'number') {
      const value = controls[0]?.value ?? '';
      return value === '' ? '' : Number(value);
    }
    if (field.kind === 'file') fail(`allocated file field ${field.id} requires the durable upload adapter`);
    return controls[0]?.value ?? '';
  }

  function applyFieldValue(field, container, value) {
    const controls = controlsFor(container);
    if (field.kind === 'radio') {
      for (const control of controls) control.checked = control.value === value;
      return;
    }
    if (field.kind === 'checkbox') {
      const control = controls.find((candidate) => candidate.type === 'checkbox');
      if (control) control.checked = value === true;
      return;
    }
    if (controls[0]) controls[0].value = value ?? '';
  }

  function rekeyControlTree(container, prefix) {
    const idMap = new Map();
    let sequence = 0;
    for (const node of container.querySelectorAll('[id]')) {
      const previous = node.id;
      const next = `${prefix}-${++sequence}`;
      idMap.set(previous, next);
      node.id = next;
    }
    for (const node of container.querySelectorAll('[for]')) {
      const next = idMap.get(node.getAttribute('for'));
      if (next) node.setAttribute('for', next);
    }
    for (const node of container.querySelectorAll('[aria-describedby]')) {
      const tokens = node.getAttribute('aria-describedby').split(/\s+/)
        .map((token) => idMap.get(token) || token);
      node.setAttribute('aria-describedby', tokens.join(' '));
    }
    for (const control of controlsFor(container)) control.removeAttribute('name');
  }

  function initializeProduct(root) {
    if (!root || root.dataset.jillPersonalizationUiInitialized === 'true') return;
    const form = root.querySelector('.jill-product-form');
    const mount = form?.querySelector('[data-jill-personalization-allocation]');
    const profileNode = form?.querySelector('[data-jill-product-capability-profile]');
    if (!form || !mount || !profileNode) return;

    let profile;
    let fieldIds;
    try {
      const {capabilities} = dependencies();
      profile = capabilities.resolve(profileNode.textContent.trim());
      fieldIds = capabilities.getPersonalizationAllocationFieldIds(profile);
    } catch (error) {
      mount.dataset.jillPersonalizationComplete = 'false';
      return;
    }
    if (!fieldIds.length) return;

    const quantityControl = form.querySelector('[name="quantity"]');
    const payload = form.querySelector('[data-jill-personalization-payload]');
    const modesNode = mount.querySelector('[data-jill-personalization-modes]');
    const groupsNode = mount.querySelector('[data-jill-personalization-groups]');
    const summary = mount.querySelector('[data-jill-personalization-summary]');
    const addButton = mount.querySelector('[data-jill-personalization-add]');
    const quantityTemplate = mount.querySelector('[data-jill-personalization-quantity-template]');
    const fieldTemplates = new Map(
      Array.from(mount.querySelectorAll('[data-jill-personalization-field-template]'))
        .map((template) => [template.dataset.jillPersonalizationFieldTemplate, template]),
    );

    if (!payload || !modesNode || !groupsNode || !summary || !addButton || !quantityTemplate) {
      mount.dataset.jillPersonalizationComplete = 'false';
      return;
    }
    if (fieldIds.some((fieldId) => !fieldTemplates.has(fieldId))) {
      mount.dataset.jillPersonalizationComplete = 'false';
      return;
    }

    root.dataset.jillPersonalizationUiInitialized = 'true';
    let state = null;
    const itemId = `shopify-product:${root.dataset.jillProductId}`;

    function unitLabel(count) {
      const configured = profile.features?.customizationUnits;
      if (count === 1) return configured?.singularLabel || mount.dataset.itemLabel || 'item';
      return configured?.pluralLabel || mount.dataset.itemsLabel || 'items';
    }

    function snapshotGroups() {
      return state?.groups.map((group) => ({
        id: group.id,
        unitIds: [...group.unitIds],
        values: {...group.values},
      })) || [];
    }

    function createCurrentState() {
      const merchandiseQuantity = readMerchandiseQuantity(quantityControl);
      if (merchandiseQuantity === null) return null;
      return dependencies().personalization.createState({
        itemId,
        merchandiseQuantity,
        profile,
        mode: state?.mode,
        groups: snapshotGroups(),
        nextGroupNumber: state?.nextGroupNumber,
      });
    }

    function announce() {
      payload.value = state
        ? JSON.stringify(dependencies().personalization.toPayload(state))
        : '';
      mount.dataset.jillPersonalizationComplete = state?.complete ? 'true' : 'false';
      root.dispatchEvent(new CustomEvent('jill:personalization-change', {
        bubbles: true,
        detail: {complete: Boolean(state?.complete)},
      }));
    }

    function commit(nextState, rerender = true) {
      state = nextState;
      if (rerender) render();
      else announce();
    }

    function modeLabel(mode) {
      if (mode === 'none') return mount.dataset.noneLabel;
      if (mode === 'different') return mount.dataset.differentLabel;
      return mount.dataset.sameLabel;
    }

    function createModeSelector() {
      if (!state?.available || state.allowedModes.length < 2) return null;
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'jill-field';
      const legend = document.createElement('legend');
      legend.className = 'jill-field__label';
      legend.textContent = mount.dataset.groupLabel || 'Personalization';
      const choices = document.createElement('div');
      choices.className = 'jill-choice-group';

      for (const mode of state.allowedModes) {
        const label = document.createElement('label');
        label.className = 'jill-choice';
        const input = document.createElement('input');
        input.className = 'jill-choice__control';
        input.type = 'radio';
        input.checked = state.mode === mode;
        const text = document.createElement('span');
        text.className = 'jill-choice__label';
        text.textContent = modeLabel(mode);
        input.addEventListener('change', () => {
          if (!input.checked) return;
          try {
            commit(dependencies().personalization.setMode(state, profile, mode));
          } catch (error) {
            render();
          }
        });
        label.append(input, text);
        choices.append(label);
      }
      fieldset.append(legend, choices);
      return fieldset;
    }

    function createCountField(group, groupIndex) {
      const shell = quantityTemplate.content.firstElementChild?.cloneNode(true);
      if (!shell) fail('personalization quantity template is unavailable');
      shell.dataset.jillPersonalizationCountField = group.id;
      const visibleLabel = `${mount.dataset.countLabel} ${unitLabel(2)}`;
      const accessibleLabel = `${mount.dataset.groupLabel} ${groupIndex + 1}: ${visibleLabel}`;
      const input = dependencies().quantity.configure(shell, {
        id: `JillPersonalizationCount-${root.dataset.jillProductId}-${group.id}`,
        label: visibleLabel,
        accessibleLabel,
        value: group.unitIds.length,
        min: 1,
        max: group.unitIds.length + state.unallocatedUnitIds.length,
        step: 1,
        required: true,
      });
      input.addEventListener('change', () => {
        try {
          commit(dependencies().personalization.setGroupCount(
            state,
            profile,
            group.id,
            Number(input.value),
          ));
        } catch (error) {
          render();
        }
      });
      return shell;
    }

    function createField(group, fieldId, groupIndex) {
      const {capabilities, personalization} = dependencies();
      const field = capabilities.getField(profile, fieldId);
      const result = group.results.find((candidate) => candidate.id === fieldId);
      if (!field || !result?.available) return null;
      if (field.kind === 'file') fail(`allocated file field ${field.id} requires the durable upload adapter`);

      const template = fieldTemplates.get(fieldId);
      const shell = template.content.firstElementChild?.cloneNode(true);
      if (!shell) fail(`personalization field template ${fieldId} is unavailable`);
      shell.dataset.jillPersonalizationField = fieldId;
      rekeyControlTree(
        shell,
        `JillPersonalization-${root.dataset.jillProductId}-${group.id}-${fieldId}-${groupIndex + 1}`,
      );
      applyFieldValue(field, shell, group.values[fieldId]);

      const controls = controlsFor(shell);
      for (const control of controls) {
        const update = (rerender) => {
          try {
            commit(
              personalization.setGroupValue(
                state,
                profile,
                group.id,
                fieldId,
                readFieldValue(field, shell),
              ),
              rerender,
            );
          } catch (error) {
            render();
          }
        };

        if (field.kind === 'text' || field.kind === 'textarea' || field.kind === 'number') {
          control.addEventListener('input', () => update(false));
          control.addEventListener('change', () => update(true));
        } else if (field.kind === 'radio') {
          control.addEventListener('change', () => {
            if (!control.checked) return;
            for (const sibling of controls) {
              if (sibling !== control && sibling.type === 'radio') sibling.checked = false;
            }
            update(true);
          });
        } else {
          control.addEventListener('change', () => update(true));
        }
      }
      return shell;
    }

    function createGroup(group, groupIndex) {
      const container = document.createElement('div');
      container.className = 'jill-product-customization__group';
      container.dataset.jillPersonalizationGroup = group.id;

      if (state.mode === 'different') {
        const heading = document.createElement('h5');
        heading.className = 'jill-product-customization__group-title';
        heading.textContent = `${mount.dataset.groupLabel} ${groupIndex + 1}`;
        container.append(heading, createCountField(group, groupIndex));
      }

      for (const fieldId of state.fieldIds) {
        const fieldNode = createField(group, fieldId, groupIndex);
        if (fieldNode) container.append(fieldNode);
      }

      if (state.mode === 'different' && state.groups.length > 1) {
        const remove = document.createElement('button');
        remove.className = 'jill-button';
        remove.dataset.variant = 'secondary';
        remove.type = 'button';
        remove.textContent = mount.dataset.removeLabel;
        remove.addEventListener('click', () => {
          try {
            commit(dependencies().personalization.removeGroup(state, profile, group.id));
          } catch (error) {
            render();
          }
        });
        container.append(remove);
      }
      return container;
    }

    function render() {
      announce();
      if (!state?.available) {
        mount.hidden = true;
        mount.setAttribute('aria-hidden', 'true');
        modesNode.replaceChildren();
        groupsNode.replaceChildren();
        summary.hidden = true;
        summary.textContent = '';
        addButton.hidden = true;
        return;
      }

      mount.hidden = false;
      mount.setAttribute('aria-hidden', 'false');
      const modeSelector = createModeSelector();
      modesNode.replaceChildren(...(modeSelector ? [modeSelector] : []));
      groupsNode.replaceChildren(...state.groups.map(createGroup));

      const unallocated = state.unallocatedUnitIds.length;
      const assigned = state.eligibleUnitCount - unallocated;
      const hasUnallocated = state.mode === 'different' && unallocated > 0;
      summary.hidden = !hasUnallocated;
      summary.textContent = hasUnallocated
        ? `${assigned} ${mount.dataset.ofLabel} ${state.eligibleUnitCount} ${unitLabel(state.eligibleUnitCount)} ${mount.dataset.assignedLabel} — ${unallocated} ${mount.dataset.unassignedLabel}`
        : '';
      addButton.hidden = !hasUnallocated;
    }

    addButton.addEventListener('click', () => {
      if (!state?.available || state.mode !== 'different' || !state.unallocatedUnitIds.length) return;
      try {
        let next = dependencies().personalization.addGroup(state, profile);
        const group = next.groups[next.groups.length - 1];
        const count = group.unitIds.length + next.unallocatedUnitIds.length;
        next = dependencies().personalization.setGroupCount(next, profile, group.id, count);
        commit(next);
      } catch (error) {
        render();
      }
    });

    const syncQuantity = () => {
      try {
        const next = createCurrentState();
        if (!next) {
          state = null;
          announce();
          return;
        }
        commit(next);
      } catch (error) {
        state = null;
        announce();
      }
    };
    quantityControl?.addEventListener('input', syncQuantity);
    quantityControl?.addEventListener('change', syncQuantity);

    try {
      state = createCurrentState();
      render();
    } catch (error) {
      state = null;
      announce();
    }
  }

  function initializeWithin(scope) {
    for (const root of scope.querySelectorAll('[data-jill-product]')) initializeProduct(root);
    if (scope.matches?.('[data-jill-product]')) initializeProduct(scope);
  }

  if (typeof document !== 'undefined') {
    initializeWithin(document);
    document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
  }
})();
