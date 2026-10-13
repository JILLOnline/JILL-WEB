(() => {
  'use strict';

  if (globalThis.JILLHeader) return;

  const LOCALIZATION_SELECTOR = '[data-jill-header-localization]';
  const SEARCH_SELECTOR = '[data-jill-header-search]';
  const SEARCH_TOGGLE_SELECTOR = '[data-jill-header-search-toggle]';
  const SEARCH_INPUT_SELECTOR = '[data-jill-header-search-input]';

  function setSearchOpen(root, open, restoreFocus = false) {
    if (!root) return;
    const toggle = root.querySelector(SEARCH_TOGGLE_SELECTOR);
    const input = root.querySelector(SEARCH_INPUT_SELECTOR);
    if (!toggle || !input) return;

    root.dataset.open = open ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    input.hidden = !open;

    if (open) input.focus();
    else if (restoreFocus) toggle.focus();
  }

  function closeOtherSearches(activeRoot = null) {
    document.querySelectorAll(`${SEARCH_SELECTOR}[data-open='true']`).forEach((root) => {
      if (root !== activeRoot) setSearchOpen(root, false);
    });
  }

  const onChange = (event) => {
    const select = event.target.closest?.(LOCALIZATION_SELECTOR);
    if (!select) return;
    select.form?.requestSubmit();
  };

  const onClick = (event) => {
    const toggle = event.target.closest?.(SEARCH_TOGGLE_SELECTOR);
    if (toggle) {
      const root = toggle.closest(SEARCH_SELECTOR);
      const input = root?.querySelector(SEARCH_INPUT_SELECTOR);
      if (!root || !input) return;

      const open = root.dataset.open === 'true';
      if (!open) {
        closeOtherSearches(root);
        setSearchOpen(root, true);
        return;
      }

      if (input.value.trim()) root.requestSubmit();
      else setSearchOpen(root, false, true);
      return;
    }

    if (!event.target.closest?.(SEARCH_SELECTOR)) closeOtherSearches();
  };

  const onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    const root = event.target.closest?.(SEARCH_SELECTOR);
    if (!root || root.dataset.open !== 'true') return;
    event.preventDefault();
    setSearchOpen(root, false, true);
  };

  const onSubmit = (event) => {
    const root = event.target.closest?.(SEARCH_SELECTOR);
    if (!root) return;
    const input = root.querySelector(SEARCH_INPUT_SELECTOR);
    if (!input) return;

    const query = input.value.trim();
    if (query) {
      input.value = query;
      return;
    }

    event.preventDefault();
    setSearchOpen(root, true);
  };

  document.addEventListener('change', onChange);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('submit', onSubmit);

  document.querySelectorAll(SEARCH_SELECTOR).forEach((root) => setSearchOpen(root, false));

  globalThis.JILLHeader = Object.freeze({
    localizationSelector: LOCALIZATION_SELECTOR,
    searchSelector: SEARCH_SELECTOR,
    setSearchOpen,
  });
})();
