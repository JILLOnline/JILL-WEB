from pathlib import Path


def replace_between(text, start, end, replacement):
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    return text[:start_index] + replacement + text[end_index:]


js_path = Path('theme/assets/jill-custom-order.js')
js = js_path.read_text()

personalization_model = r'''  function customizationUnitIds(itemId, quantity, profile) {
    const multiplier = profile ? globalThis.JILLProductCapabilities.getCustomizationUnitsPerQuantity(profile) : 1;
    return Array.from({length: quantity * multiplier}, (_, index) => `${itemId}::${index + 1}`);
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

  function personalizationChoiceLabel(choice) {
    return choice?.querySelector('[data-jill-custom-order-select]')?.closest('label')?.textContent?.trim()
      || choice?.dataset.productHandle
      || 'Item';
  }

  function selectedPersonalizationItems(root) {
    return selectedChoices(root).map((choice) => {
      const rawQuantity = Number(projectionQuantity(choice)?.value || 1);
      const quantity = Number.isSafeInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
      return {
        productId: String(choice.dataset.productId),
        label: personalizationChoiceLabel(choice),
        quantity,
      };
    });
  }

  function totalPersonalizationUnits(root) {
    return selectedPersonalizationItems(root).reduce((sum, item) => sum + item.quantity, 0);
  }

  function newPersonalizationGroup(state, allocations = {}) {
    const id = `group_${state.nextGroupNumber++}`;
    state.open.add(id);
    return {id, allocations: {...allocations}, wording: '', age: '', notes: ''};
  }

  function personalizationGroupUnits(group) {
    return Object.values(group?.allocations || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  }

  function personalizationAssignedForProduct(state, productId, excludedGroupId = '') {
    return state.groups.reduce((sum, group) => {
      if (group.id === excludedGroupId) return sum;
      return sum + Math.max(0, Number(group.allocations?.[productId]) || 0);
    }, 0);
  }

  function personalizationGroupsReady(state) {
    return state.groups.length > 0
      && state.groups.every((group) => personalizationGroupUnits(group) > 0 && Boolean(group.wording.trim()));
  }

  function seedDifferentPersonalization(root, state) {
    const items = selectedPersonalizationItems(root);
    if (!items.length) return;
    const first = newPersonalizationGroup(state);
    const second = newPersonalizationGroup(state);
    first.allocations[items[0].productId] = 1;
    if (items.length > 1) second.allocations[items[1].productId] = 1;
    else second.allocations[items[0].productId] = 1;
    state.groups = [first, second];
  }

  function reconcilePersonalization(root) {
    const state = personalizationState(root);
    const items = selectedPersonalizationItems(root);
    const targets = new Map(items.map((item) => [item.productId, item.quantity]));

    for (const group of state.groups) {
      if (!group.allocations || typeof group.allocations !== 'object') group.allocations = {};
      for (const productId of Object.keys(group.allocations)) {
        if (!targets.has(productId)) delete group.allocations[productId];
      }
    }

    for (const item of items) {
      let remaining = item.quantity;
      for (const group of state.groups) {
        const requested = Math.max(0, Math.trunc(Number(group.allocations[item.productId]) || 0));
        const keep = Math.min(requested, remaining);
        if (keep > 0) group.allocations[item.productId] = keep;
        else delete group.allocations[item.productId];
        remaining -= keep;
      }
    }

    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    if (state.mode === 'different' && total < 2) {
      const source = state.groups.find((group) => group.wording.trim()) || state.groups[0];
      if (source && !state.same.wording) state.same = {wording: source.wording, age: source.age, notes: source.notes};
      state.mode = total ? 'same' : '';
      state.groups = [];
      state.open.clear();
      state.finished = false;
    }
    if (state.mode === 'different' && total >= 2 && !state.groups.length) seedDifferentPersonalization(root, state);
    return state;
  }

  function remainingPersonalizationUnits(root, state = reconcilePersonalization(root)) {
    return selectedPersonalizationItems(root).reduce((sum, item) => {
      const assigned = personalizationAssignedForProduct(state, item.productId);
      return sum + Math.max(0, item.quantity - assigned);
    }, 0);
  }

  function personalizationCompletion(root) {
    const state = reconcilePersonalization(root);
    const total = totalPersonalizationUnits(root);
    if (!state.mode) return {complete: false, message: 'Choose a personalization setup.'};
    if (state.mode === 'none') return {complete: true, message: 'No personalization selected.'};
    if (state.mode === 'same') {
      return total > 0 && state.same.wording.trim()
        ? {complete: true, message: 'Ready to finish personalization.'}
        : {complete: false, message: 'Enter the name or wording.'};
    }
    if (total < 2) return {complete: false, message: 'Different personalization requires at least two items.'};
    if (state.groups.length < 2) return {complete: false, message: 'Two personalization cards are required.'};
    if (state.groups.some((group) => personalizationGroupUnits(group) === 0)) {
      return {complete: false, message: 'Assign at least one item to every personalization.'};
    }
    if (state.groups.some((group) => !group.wording.trim())) {
      return {complete: false, message: 'Add wording to every personalization.'};
    }
    const remaining = remainingPersonalizationUnits(root, state);
    if (remaining > 0) {
      return {complete: false, message: `${remaining} item${remaining === 1 ? '' : 's'} still need a personalization.`};
    }
    return {complete: true, message: 'Ready to finish personalization.'};
  }

  function personalizationAttributes(values) {
    return [
      {id: 'name_text', label: 'Name / wording', value: values.wording.trim()},
      {id: 'number_age', label: 'Age / number', value: values.age.trim()},
      {id: 'personalization_notes', label: 'Notes', value: values.notes.trim()},
    ].filter((entry) => entry.value !== '');
  }

  function applyOrderPersonalization(root, itemNodes, requests) {
    const state = reconcilePersonalization(root);
    if (!state.mode || state.mode === 'none') return;

    itemNodes.forEach((item, index) => {
      const request = requests[index];
      const form = item.querySelector('[data-jill-custom-order-item-form]');
      const profile = readProfile(form);
      const unitIds = customizationUnitIds(request.item_id, request.quantity, profile);

      if (state.mode === 'same') {
        request.personalization_groups = [{
          id: 'same',
          allocations: unitIds.map((unitId) => ({unit_id: unitId})),
          attributes: personalizationAttributes(state.same),
        }];
        return;
      }

      let cursor = 0;
      request.personalization_groups = [];
      for (const group of state.groups) {
        const count = Math.max(0, Number(group.allocations?.[String(item.dataset.jillProductId)]) || 0);
        if (!count) continue;
        const allocated = unitIds.slice(cursor, cursor + count);
        cursor += allocated.length;
        request.personalization_groups.push({
          id: group.id,
          allocations: allocated.map((unitId) => ({unit_id: unitId})),
          attributes: personalizationAttributes(group),
        });
      }
      if (cursor !== unitIds.length) fail('personalization quantities do not match the selected item quantity');
    });
  }

'''
js = replace_between(js, '  function customizationUnitIds', '  function readNamed', personalization_model)

personalization_ui = r'''  function syncPersonalizationCardStatuses(root) {
    const state = personalizationState(root);
    const selectedUnits = totalPersonalizationUnits(root);
    for (const card of root.querySelectorAll('[data-jill-personalization-card]')) {
      const id = card.dataset.jillPersonalizationCard;
      const record = id === 'same' ? state.same : state.groups.find((group) => group.id === id);
      const units = id === 'same' ? selectedUnits : personalizationGroupUnits(record);
      const complete = units > 0 && Boolean(record?.wording?.trim());
      const status = card.querySelector('[data-jill-personalization-card-status]');
      if (status) {
        status.textContent = complete ? (root.dataset.completeLabel || 'Complete ✓') : units ? 'Add wording' : 'Assign items';
        status.dataset.tone = complete ? 'success' : 'error';
      }
      card.dataset.state = complete ? 'complete' : 'incomplete';
    }
  }

  function syncPersonalizationActions(root) {
    const state = reconcilePersonalization(root);
    const actions = root.querySelector('[data-jill-personalization-actions]');
    const add = root.querySelector('[data-jill-personalization-add]');
    const finish = root.querySelector('[data-jill-personalization-finish]');
    const help = root.querySelector('[data-jill-personalization-help]');
    if (!actions || !add || !finish || !help) return;

    const actionable = state.mode === 'same' || state.mode === 'different';
    setVisible(actions, actionable);
    if (!actionable) return;

    const completion = personalizationCompletion(root);
    const remaining = state.mode === 'different' ? remainingPersonalizationUnits(root, state) : 0;
    add.hidden = state.mode !== 'different' || state.finished || remaining === 0;
    add.disabled = state.mode !== 'different' || remaining === 0 || !personalizationGroupsReady(state);
    add.setAttribute('aria-disabled', add.disabled ? 'true' : 'false');
    finish.hidden = false;
    finish.disabled = state.finished || !completion.complete;
    finish.setAttribute('aria-disabled', finish.disabled ? 'true' : 'false');
    finish.textContent = state.finished
      ? (root.dataset.personalizationFinishedLabel || 'Personalization finished ✓')
      : (root.dataset.finishPersonalizationLabel || 'Finish personalization');
    help.textContent = state.finished
      ? 'Personalization is finished. Continue with reference images below.'
      : completion.message;
    syncPersonalizationCardStatuses(root);
  }

  function createPersonalizationQuantityShell(root, state, group, item, groupIndex) {
    const row = node('div', 'jill-custom-order-personalization-card__allocation');
    row.dataset.jillPersonalizationAllocation = `${group.id}:${item.productId}`;

    const meta = node('div', 'jill-custom-order-personalization-card__allocation-meta');
    meta.append(
      node('strong', '', item.label),
      node('span', '', `${Math.max(0, Number(group.allocations[item.productId]) || 0)} / ${item.quantity} assigned`),
    );

    const shell = node('div', 'jill-quantity');
    shell.dataset.jillQuantity = '';
    shell.dataset.jillQuantityDecreaseText = 'Decrease';
    shell.dataset.jillQuantityIncreaseText = 'Increase';

    const quantityLabel = node('label', 'jill-field__label');
    const quantityLabelText = node('span', '', 'Quantity');
    quantityLabelText.dataset.jillQuantityLabelText = '';
    const requiredMark = node('span', 'jill-field__required', '*');
    requiredMark.hidden = true;
    quantityLabel.append(quantityLabelText, requiredMark);

    const stepper = node('div', 'jill-quantity__stepper');
    const decrement = node('button', 'jill-quantity__button');
    decrement.type = 'button';
    decrement.tabIndex = -1;
    decrement.dataset.jillQuantityAction = 'decrement';
    decrement.append(node('span', '', '−'));
    decrement.firstElementChild.setAttribute('aria-hidden', 'true');

    const input = document.createElement('input');
    input.className = 'jill-field__control jill-quantity__control';
    input.type = 'number';
    input.inputMode = 'numeric';
    input.dataset.jillQuantityInput = '';

    const increment = node('button', 'jill-quantity__button');
    increment.type = 'button';
    increment.tabIndex = -1;
    increment.dataset.jillQuantityAction = 'increment';
    increment.append(node('span', '', '+'));
    increment.firstElementChild.setAttribute('aria-hidden', 'true');
    stepper.append(decrement, input, increment);
    shell.append(quantityLabel, stepper);

    const current = Math.max(0, Number(group.allocations[item.productId]) || 0);
    const assignedElsewhere = personalizationAssignedForProduct(state, item.productId, group.id);
    const max = Math.max(0, item.quantity - assignedElsewhere);
    globalThis.JILLQuantity.configure(shell, {
      id: `JillPersonalizationQuantity-${group.id}-${item.productId}`,
      label: 'Quantity',
      accessibleLabel: `${item.label}, Personalization ${groupIndex + 1}`,
      value: Math.min(current, max),
      min: 0,
      max,
      step: 1,
      required: false,
    });

    input.addEventListener('input', () => {
      const next = Math.max(0, Math.trunc(Number(input.value) || 0));
      if (next > 0) group.allocations[item.productId] = next;
      else delete group.allocations[item.productId];
      state.finished = false;
      syncPersonalizationActions(root);
      syncProgression(root);
    });
    input.addEventListener('change', () => {
      queueMicrotask(() => {
        renderPersonalization(root);
        syncProgression(root);
      });
    });

    row.append(meta, shell);
    return row;
  }

  function renderPersonalization(root) {
    const state = reconcilePersonalization(root);
    const cards = root.querySelector('[data-jill-personalization-cards]');
    const mode = root.querySelector('[data-jill-personalization-mode]');
    if (!cards || !mode) return;

    const differentOption = mode.querySelector('option[value="different"]');
    if (differentOption) differentOption.disabled = totalPersonalizationUnits(root) < 2;
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
          syncPersonalizationActions(root);
          syncProgression(root);
        }),
        createPersonalizationInput('Age / number', record.age, false, (value) => {
          record.age = value;
          state.finished = false;
          syncPersonalizationActions(root);
          syncProgression(root);
        }),
        createPersonalizationInput('Notes', record.notes, false, (value) => {
          record.notes = value;
          state.finished = false;
          syncPersonalizationActions(root);
          syncProgression(root);
        }, true),
      );
      host.append(fields);
    }

    if (state.mode === 'same') {
      const shell = cardShell('same', 'Same personalization for all selected items');
      const summary = selectedPersonalizationItems(root)
        .map((item) => `${item.label} ×${item.quantity}`)
        .join(' · ');
      shell.body.append(node('p', 'jill-custom-order-personalization-card__shared', summary));
      appendFields(shell.body, state.same);
      cards.append(shell.card);
    }

    if (state.mode === 'different') {
      const items = selectedPersonalizationItems(root);
      state.groups.forEach((group, index) => {
        const shell = cardShell(group.id, `Personalization ${index + 1}`);
        const allocations = node('div', 'jill-custom-order-personalization-card__allocations');
        allocations.append(node('p', 'jill-field__label', 'Assign item quantities'));
        items.forEach((item) => allocations.append(createPersonalizationQuantityShell(root, state, group, item, index)));
        shell.body.append(allocations);
        if (personalizationGroupUnits(group) > 0) appendFields(shell.body, group);
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

    syncPersonalizationActions(root);
  }

'''
js = replace_between(js, '  function syncPersonalizationCardStatuses', '  function referenceReady', personalization_ui)

old_add = r'''    personalizationAdd?.addEventListener('click', () => {
      const state = personalizationState(root);
      const assigned = new Set(state.groups.flatMap((group) => group.productIds));
      const remaining = selectedProductIds(root).filter((id) => !assigned.has(id));
      if (!remaining.length || state.groups.some((group) => !group.productIds.length || !group.wording.trim())) return;
      state.groups.push(newPersonalizationGroup(state));
      state.finished = false;
      renderPersonalization(root);
      syncProgression(root);
    });
'''
new_add = r'''    personalizationAdd?.addEventListener('click', () => {
      const state = reconcilePersonalization(root);
      if (state.mode !== 'different') return;
      if (remainingPersonalizationUnits(root, state) === 0 || !personalizationGroupsReady(state)) return;
      state.groups.push(newPersonalizationGroup(state));
      state.finished = false;
      renderPersonalization(root);
      syncProgression(root);
    });
'''
if old_add not in js:
    raise RuntimeError('personalization add handler marker not found')
js = js.replace(old_add, new_add)

old_quantity_change = r'''      quantity?.addEventListener('change', () => {
        syncCanonicalQuantity(root, choice);
        resetOptions(root);
        personalizationState(root).finished = false;
        syncProgression(root);
      });
'''
new_quantity_change = r'''      quantity?.addEventListener('change', () => {
        syncCanonicalQuantity(root, choice);
        resetOptions(root);
        personalizationState(root).finished = false;
        renderPersonalization(root);
        syncProgression(root);
      });
'''
if old_quantity_change not in js:
    raise RuntimeError('quantity change marker not found')
js = js.replace(old_quantity_change, new_quantity_change)

old_progression = r'''    const state = reconcilePersonalization(root);
    const completion = personalizationCompletion(root);
    const personalizationReady = designReady && completion.complete && (state.mode === 'none' || state.finished);
'''
new_progression = r'''    const state = reconcilePersonalization(root);
    const completion = personalizationCompletion(root);
    syncPersonalizationActions(root);
    const personalizationReady = designReady && completion.complete && (state.mode === 'none' || state.finished);
'''
if old_progression not in js:
    raise RuntimeError('personalization progression marker not found')
js = js.replace(old_progression, new_progression)

old_review = "          block.append(node('h5', '', 'Personalization'));"
new_review = "          const personalizationCount = group.allocations?.length || 0;\n          block.append(node('h5', '', `Personalization — ${personalizationCount} item${personalizationCount === 1 ? '' : 's'}`));"
if old_review not in js:
    raise RuntimeError('review personalization marker not found')
js = js.replace(old_review, new_review)

js_path.write_text(js)

css_path = Path('theme/assets/jill-forms.css')
css = css_path.read_text()
new_allocation_css = r'''  .jill-custom-order-personalization-card__allocations {
    display: grid;
    gap: calc(var(--jill-space-unit) * 1.25);
  }

  .jill-custom-order-personalization-card__allocations > .jill-field__label {
    margin: 0;
  }

  .jill-custom-order-personalization-card__allocation {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: calc(var(--jill-space-unit) * 1.5);
    padding: calc(var(--jill-space-unit) * 1.5);
    border: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-foreground) 16%, transparent);
    border-radius: var(--jill-field-radius);
    background: color-mix(in srgb, var(--jill-color-foreground) 2%, var(--jill-color-background));
  }

  .jill-custom-order-personalization-card__allocation-meta {
    display: grid;
    gap: calc(var(--jill-space-unit) * 0.5);
    min-width: 0;
  }

  .jill-custom-order-personalization-card__allocation-meta strong {
    overflow-wrap: anywhere;
  }

  .jill-custom-order-personalization-card__allocation-meta span {
    color: var(--jill-color-muted);
    font-size: 0.9rem;
  }

  .jill-custom-order-personalization-card__allocation .jill-quantity {
    width: min(100%, 12rem);
  }

'''
css = replace_between(css, '  .jill-custom-order-personalization-card__items {', '  .jill-custom-order__references {', new_allocation_css + '  .jill-custom-order__references {')

mobile_marker = r'''  @media (max-width: 47.99rem) {
'''
if mobile_marker in css and '.jill-custom-order-personalization-card__allocation {' not in css[css.index(mobile_marker):]:
    mobile_insert = r'''  @media (max-width: 47.99rem) {
    .jill-custom-order-personalization-card__allocation {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .jill-custom-order-personalization-card__allocation .jill-quantity {
      width: 100%;
    }

'''
    css = css.replace(mobile_marker, mobile_insert, 1)
css_path.write_text(css)


test_path = Path('scripts/test-custom-order-integration.mjs')
test = test_path.read_text()
test = test.replace(
    "assert.match(uiCss, /jill-custom-order-personalization-card__items/, 'dynamic personalization assignment must visibly expose its required marker');",
    "assert.match(uiCss, /jill-custom-order-personalization-card__allocation/, 'quantity-aware personalization allocation must have one canonical row style');",
)
test = test.replace(
    "assert.match(runtime, /personalizationOwner/, 'different-by-item personalization must assign selected items deterministically');",
    "assert.match(runtime, /totalPersonalizationUnits/, 'Different personalization must be available from total ordered units, not product-count shortcuts');\nassert.match(runtime, /remainingPersonalizationUnits/, 'Add another personalization must be driven by unallocated ordered units');\nassert.match(runtime, /personalizationAssignedForProduct/, 'personalization quantity allocation must keep one canonical per-product assignment calculation');\nassert.match(runtime, /syncPersonalizationActions/, 'Finish and Add Another must share one live personalization action-state owner');\nassert.match(runtime, /group\.allocations/, 'different personalization must store quantities by selected product instead of whole-product ownership');\nassert.match(runtime, /personalizationCount/, 'Review must surface the number of units assigned to each personalization');\nassert.doesNotMatch(runtime, /group\.productIds|personalizationOwner/, 'obsolete whole-product personalization ownership must be removed');",
)
anchor = "assert.match(runtime, /personalizationState/, 'Custom Order must own one order-level personalization composition state');"
if anchor not in test:
    raise RuntimeError('personalization test anchor not found')
test = test.replace(anchor, anchor + "\nassert.match(runtime, /differentOption\.disabled = totalPersonalizationUnits\(root\) < 2/, 'one product with quantity two or more must support Different personalization');\nassert.match(runtime, /finish\.disabled = state\.finished \|\| !completion\.complete/, 'Finish personalization must enable from the same live completion state shown to the customer');")
test_path.write_text(test)

print('Section 4 quantity-aware personalization patch applied.')
