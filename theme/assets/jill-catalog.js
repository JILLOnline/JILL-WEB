(() => {
  'use strict';

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function initialize(root) {
    if (!root || root.dataset.jillCatalogInitialized === 'true') return;
    root.dataset.jillCatalogInitialized = 'true';

    const grid = root.querySelector('[data-jill-catalog-product-grid]');
    const cards = Array.from(grid?.querySelectorAll('[data-jill-catalog-product]') || []);
    const filters = Array.from(root.querySelectorAll('[data-jill-catalog-filter]'));
    const categoryLinks = Array.from(root.querySelectorAll('[data-jill-catalog-category-link]'));
    const search = root.querySelector('[id^="JillCatalogSearch-"]');
    const count = root.querySelector('[data-jill-catalog-results-count]');
    const empty = root.querySelector('[data-jill-catalog-empty]');
    const productsSection = root.querySelector('[data-jill-catalog-products-section]');
    let activeFilter = 'all';

    function collectionMatch(card) {
      if (activeFilter === 'all') return true;
      const handles = String(card.dataset.collections || '')
        .split('|')
        .filter(Boolean);
      return handles.includes(activeFilter);
    }

    function searchMatch(card) {
      const query = normalize(search?.value);
      if (!query) return true;
      return normalize(card.dataset.search).includes(query);
    }

    function render() {
      let visible = 0;
      for (const card of cards) {
        const matches = collectionMatch(card) && searchMatch(card);
        card.hidden = !matches;
        if (matches) visible += 1;
      }

      for (const filter of filters) {
        const pressed = filter.dataset.jillCatalogFilter === activeFilter;
        filter.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      }

      if (count) {
        const noun = visible === 1 ? root.dataset.resultSingular : root.dataset.resultPlural;
        count.textContent = `${visible} ${noun}`;
      }
      if (empty) empty.hidden = visible !== 0;
    }

    for (const filter of filters) {
      filter.addEventListener('click', () => {
        activeFilter = filter.dataset.jillCatalogFilter || 'all';
        render();
      });
    }

    for (const link of categoryLinks) {
      link.addEventListener('click', (event) => {
        const handle = link.dataset.jillCatalogCategoryLink;
        if (!handle) return;
        event.preventDefault();
        activeFilter = handle;
        render();
        productsSection?.focus({preventScroll: true});
        productsSection?.scrollIntoView({block: 'start'});
      });
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
