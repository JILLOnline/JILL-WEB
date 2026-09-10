(() => {
  const accordionSelector = '[data-jill-catalog-accordion]';
  const triggerSelector = '[data-jill-catalog-trigger]';
  const panelSelector = '[data-jill-catalog-panel]';
  const collectionHashPrefix = '#JillCatalogCollection-';

  const panelForTrigger = (trigger) => {
    const panelId = trigger?.getAttribute('aria-controls');
    return panelId ? document.getElementById(panelId) : null;
  };

  const setActiveTrigger = (trigger, shouldOpen = true) => {
    const accordion = trigger?.closest(accordionSelector);
    if (!accordion) return false;

    accordion.querySelectorAll(triggerSelector).forEach((candidate) => {
      const active = shouldOpen && candidate === trigger;
      candidate.setAttribute('aria-expanded', active ? 'true' : 'false');

      const panel = panelForTrigger(candidate);
      if (panel?.matches(panelSelector)) panel.hidden = !active;
    });

    return true;
  };

  const triggerFromHash = (hash) => {
    if (!hash || !hash.startsWith(collectionHashPrefix)) return null;

    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      return null;
    }

    const target = document.getElementById(id);
    return target?.matches(triggerSelector) ? target : null;
  };

  const openHashTarget = (hash, shouldScroll = false) => {
    const target = triggerFromHash(hash);
    if (!target || !setActiveTrigger(target, true)) return false;

    if (shouldScroll) {
      requestAnimationFrame(() => target.scrollIntoView({block: 'nearest', inline: 'center'}));
    }

    return true;
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest(triggerSelector);
    if (trigger) {
      const shouldOpen = trigger.getAttribute('aria-expanded') !== 'true';
      setActiveTrigger(trigger, shouldOpen);
      return;
    }

    const link = event.target.closest(`a[href^="${collectionHashPrefix}"]`);
    if (!link) return;

    openHashTarget(link.hash);
  });

  window.addEventListener('hashchange', () => {
    openHashTarget(window.location.hash, true);
  });

  openHashTarget(window.location.hash, true);
})();
