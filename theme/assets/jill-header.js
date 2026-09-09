(() => {
  'use strict';

  if (globalThis.JILLHeader) return;

  const LOCALIZATION_SELECTOR = '[data-jill-header-localization]';

  const onChange = (event) => {
    const select = event.target.closest?.(LOCALIZATION_SELECTOR);
    if (!select) return;
    select.form?.requestSubmit();
  };

  document.addEventListener('change', onChange);

  globalThis.JILLHeader = Object.freeze({
    localizationSelector: LOCALIZATION_SELECTOR,
  });
})();
