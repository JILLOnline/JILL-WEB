(() => {
  const accordionSelector = '[data-jill-catalog-accordion]';
  const triggerSelector = '[data-jill-catalog-trigger]';
  const panelSelector = '[data-jill-catalog-panel]';
  const collectionHashPrefix = '#JillCatalogCollection-';
  const carouselTrackSelector = '[data-jill-catalog-disclosures] :is(.jill-catalog__featured-grid, .jill-catalog__product-grid)';
  const carouselState = new WeakMap();

  const carouselStep = (track) => {
    const card = track.querySelector('.jill-product-card');
    if (!card) return Math.max(track.clientWidth * 0.8, 1);

    const styles = getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const updateCarouselControls = (track) => {
    const state = carouselState.get(track);
    if (!state) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const scrollable = maxScroll > 2;
    state.controls.hidden = !scrollable;
    state.previous.disabled = !scrollable || track.scrollLeft <= 2;
    state.next.disabled = !scrollable || track.scrollLeft >= maxScroll - 2;
  };

  const createCarouselButton = (direction, label, symbol) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jill-catalog-carousel__button';
    button.dataset.jillCatalogCarouselDirection = direction;
    button.setAttribute('aria-label', label);

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = symbol;
    button.append(icon);

    return button;
  };

  const initCarousel = (track) => {
    if (carouselState.has(track)) return;

    const controls = document.createElement('div');
    controls.className = 'jill-catalog-carousel__controls';
    controls.hidden = true;
    controls.setAttribute('aria-label', 'Product carousel controls');

    const previous = createCarouselButton('previous', 'Previous products', '‹');
    const next = createCarouselButton('next', 'Next products', '›');
    controls.append(previous, next);
    track.insertAdjacentElement('afterend', controls);

    const scrollByCard = (direction) => {
      track.scrollBy({left: direction * carouselStep(track), behavior: 'smooth'});
    };

    previous.addEventListener('click', () => scrollByCard(-1));
    next.addEventListener('click', () => scrollByCard(1));
    track.addEventListener('scroll', () => updateCarouselControls(track), {passive: true});

    carouselState.set(track, {controls, previous, next});
    updateCarouselControls(track);
  };

  const syncAllCarousels = () => {
    document.querySelectorAll(carouselTrackSelector).forEach((track) => {
      initCarousel(track);
      updateCarouselControls(track);
    });
  };

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

    requestAnimationFrame(syncAllCarousels);
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

  const openInitialCollection = () => {
    if (openHashTarget(window.location.hash, true)) return;

    const firstTrigger = document.querySelector(`${accordionSelector} ${triggerSelector}`);
    if (firstTrigger) setActiveTrigger(firstTrigger, true);
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

  window.addEventListener('resize', () => requestAnimationFrame(syncAllCarousels));

  syncAllCarousels();
  openInitialCollection();
})();
