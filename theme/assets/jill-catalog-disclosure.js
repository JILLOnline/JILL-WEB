(() => {
  const disclosureSelector = 'details[data-jill-catalog-disclosure]';
  const collectionHashPrefix = '#JillCatalogCollection-';

  const disclosureFromHash = (hash) => {
    if (!hash || !hash.startsWith(collectionHashPrefix)) return null;

    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      return null;
    }

    const target = document.getElementById(id);
    return target?.matches(disclosureSelector) ? target : null;
  };

  const openHashTarget = (hash, shouldScroll = false) => {
    const target = disclosureFromHash(hash);
    if (!target) return false;

    target.open = true;
    if (shouldScroll) {
      requestAnimationFrame(() => target.scrollIntoView({block: 'start'}));
    }
    return true;
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest(`a[href^="${collectionHashPrefix}"]`);
    if (!link) return;

    openHashTarget(link.hash);
  });

  window.addEventListener('hashchange', () => {
    openHashTarget(window.location.hash, true);
  });

  openHashTarget(window.location.hash, true);
})();
