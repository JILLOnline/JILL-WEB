(() => {
  'use strict';

  const ACTIONS = Object.freeze({
    DECREMENT: 'decrement',
    INCREMENT: 'increment',
  });

  function integerOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }

  function stepValue({value, min = null, max = null, step = 1, direction}) {
    if (direction !== -1 && direction !== 1) throw new TypeError('direction must be -1 or 1');

    const parsedStep = integerOrNull(step);
    if (parsedStep === null || parsedStep < 1) throw new TypeError('step must be a positive integer');

    const parsedMin = integerOrNull(min);
    const parsedMax = integerOrNull(max);
    if (min !== null && min !== undefined && min !== '' && parsedMin === null) {
      throw new TypeError('min must be an integer when provided');
    }
    if (max !== null && max !== undefined && max !== '' && parsedMax === null) {
      throw new TypeError('max must be an integer when provided');
    }
    if (parsedMin !== null && parsedMax !== null && parsedMax < parsedMin) {
      throw new RangeError('max must be greater than or equal to min');
    }

    const current = integerOrNull(value);
    let next;

    if (current === null) {
      next = parsedMin ?? 0;
    } else {
      next = current + (direction * parsedStep);
    }

    if (parsedMin !== null) next = Math.max(parsedMin, next);
    if (parsedMax !== null) next = Math.min(parsedMax, next);

    if (!Number.isSafeInteger(next)) throw new RangeError('quantity is outside the safe integer range');
    return next;
  }

  function inputFor(shell) {
    return shell?.querySelector?.('[data-jill-quantity-input]') || null;
  }

  function buttonFor(shell, action) {
    return shell?.querySelector?.(`[data-jill-quantity-action="${action}"]`) || null;
  }

  function accessibleLabelFor(shell) {
    return shell?.dataset?.jillQuantityAccessibleLabel
      || shell?.querySelector?.('[data-jill-quantity-label-text]')?.textContent?.trim()
      || 'Quantity';
  }

  function syncButtonLabels(shell, input) {
    const accessibleLabel = accessibleLabelFor(shell);
    const controls = input.id || '';

    for (const [action, textKey] of [
      [ACTIONS.DECREMENT, 'jillQuantityDecreaseText'],
      [ACTIONS.INCREMENT, 'jillQuantityIncreaseText'],
    ]) {
      const button = buttonFor(shell, action);
      if (!button) continue;
      const verb = shell.dataset[textKey] || (action === ACTIONS.DECREMENT ? 'Decrease' : 'Increase');
      const label = `${verb} ${accessibleLabel}`;
      button.setAttribute('aria-label', label);
      button.title = label;
      if (controls) button.setAttribute('aria-controls', controls);
      else button.removeAttribute('aria-controls');
    }
  }

  function sync(shell) {
    const input = inputFor(shell);
    if (!input) return null;

    const value = integerOrNull(input.value);
    const min = integerOrNull(input.min);
    const max = integerOrNull(input.max);
    const decrement = buttonFor(shell, ACTIONS.DECREMENT);
    const increment = buttonFor(shell, ACTIONS.INCREMENT);

    const invalidValue = value === null;
    const decrementDisabled = input.disabled || (!invalidValue && min !== null && value <= min);
    const incrementDisabled = input.disabled || (!invalidValue && max !== null && value >= max);

    if (decrement) {
      decrement.disabled = decrementDisabled;
      decrement.setAttribute('aria-disabled', decrementDisabled ? 'true' : 'false');
    }
    if (increment) {
      increment.disabled = incrementDisabled;
      increment.setAttribute('aria-disabled', incrementDisabled ? 'true' : 'false');
    }

    syncButtonLabels(shell, input);
    return input;
  }

  function configure(shell, {
    id,
    name = null,
    label,
    accessibleLabel = label,
    value,
    min = 1,
    max = null,
    step = 1,
    required = false,
    disabled = false,
  }) {
    const input = inputFor(shell);
    const labelNode = shell?.querySelector?.('.jill-field__label');
    const labelText = shell?.querySelector?.('[data-jill-quantity-label-text]');
    const requiredMark = shell?.querySelector?.('.jill-field__required');

    if (!input || !labelNode || !labelText || !id) throw new TypeError('quantity shell is incomplete');

    input.id = id;
    input.value = String(value);
    input.min = String(min);
    input.step = String(step);
    input.required = Boolean(required);
    input.disabled = Boolean(disabled);

    if (max === null || max === undefined || max === '') input.removeAttribute('max');
    else input.max = String(max);

    if (name === null || name === undefined || name === '') input.removeAttribute('name');
    else input.name = name;

    labelNode.htmlFor = id;
    labelText.textContent = label || 'Quantity';
    if (requiredMark) requiredMark.hidden = !required;

    shell.dataset.jillQuantityAccessibleLabel = accessibleLabel || label || 'Quantity';
    sync(shell);
    return input;
  }

  function handleClick(event) {
    const button = event.target.closest?.('[data-jill-quantity-action]');
    if (!button || button.disabled) return;

    const shell = button.closest('[data-jill-quantity]');
    const input = inputFor(shell);
    if (!input || input.disabled) return;

    const direction = button.dataset.jillQuantityAction === ACTIONS.DECREMENT ? -1 : 1;
    let next;

    try {
      next = stepValue({
        value: input.value,
        min: input.min,
        max: input.max,
        step: input.step,
        direction,
      });
    } catch (error) {
      return;
    }

    if (String(next) === input.value) {
      sync(shell);
      input.focus({preventScroll: true});
      return;
    }

    input.value = String(next);
    sync(shell);
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    input.focus({preventScroll: true});
  }

  function handleInput(event) {
    const input = event.target.closest?.('[data-jill-quantity-input]');
    if (!input) return;
    sync(input.closest('[data-jill-quantity]'));
  }

  function handleWheel(event) {
    const input = event.target.closest?.('[data-jill-quantity-input]');
    if (!input || document.activeElement !== input) return;
    event.preventDefault();
  }

  function initializeDocument() {
    for (const shell of document.querySelectorAll('[data-jill-quantity]')) sync(shell);
    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleInput);
    document.addEventListener('wheel', handleWheel, {passive: false});
  }

  globalThis.JILLQuantity = Object.freeze({
    ACTIONS,
    configure,
    stepValue,
    sync,
  });

  if (typeof document !== 'undefined') initializeDocument();
})();
