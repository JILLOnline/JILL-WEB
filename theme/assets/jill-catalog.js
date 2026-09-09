(() => {
  'use strict';

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function initialize(root) {
    if (!root || root.dataset.jillCatalogInitialized === 'true') return;
    root.dataset.jillCatalogInitialized = 'true';

    // Collection grouping is server-rendered; this runtime owns search visibility only.
    const groups = Array.from(root.querySelectorAll('[data-jill-catalog-group]'));
    const search = root.querySelector('[id^="JillCatalogSearch-"]');
    const count = root.querySelector('[data-jill-catalog-results-count]');
    const empty = root.querySelector('[data-jill-catalog-empty]');

    function render() {
      const query = normalize(search?.value);
      let visibleTotal = 0;

      for (const group of groups) {
        const cards = Array.from(group.querySelectorAll('[data-jill-catalog-product]'));
        const groupCount = group.querySelector('[data-jill-catalog-group-count]');
        let visibleInGroup = 0;

        for (const card of cards) {
          const matches = !query || normalize(card.dataset.search).includes(query);
          card.hidden = !matches;
          if (matches) visibleInGroup += 1;
        }

        group.hidden = visibleInGroup === 0;
        visibleTotal += visibleInGroup;

        if (groupCount) {
          const noun = visibleInGroup === 1 ? root.dataset.resultSingular : root.dataset.resultPlural;
          groupCount.textContent = `${visibleInGroup} ${noun}`;
        }
      }

      if (count) {
        const noun = visibleTotal === 1 ? root.dataset.resultSingular : root.dataset.resultPlural;
        count.textContent = `${visibleTotal} ${noun}`;
      }
      if (empty) empty.hidden = visibleTotal !== 0;
    }

    search?.addEventListener('input', render);
    render();
  }

  function initializeWithin(scope) {
    for (const root of scope.querySelectorAll('[data-jill-catalog]')) initialize(root);
    if (scope.matches?.('[data-jill-catalog]')) initialize(scope);
  }

  if (typeof document !== 'undefined') {
    initializeWithin(document);
    document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
  }

  Object.defineProperty(globalThis, 'JILLCatalog', {
    value: Object.freeze({normalize}),
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();