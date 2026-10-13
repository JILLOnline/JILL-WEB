(() => {
  'use strict';

  const baseOrder = new WeakMap();

  function productChoices(root) {
    return Array.from(root.querySelectorAll('[data-jill-product-choice]'));
  }

  function selectedCollections(root) {
    return Array.from(root.querySelectorAll('[data-jill-collection-choice]:checked'));
  }

  function collectionHandles(choice) {
    return String(choice.dataset.collectionHandles || '').split('|').map((value) => value.trim()).filter(Boolean);
  }

  function displayCollectionTitle(choice) {
    return String(choice.dataset.collectionTitle || choice.value || 'Items').split(' - ')[0].trim();
  }

  function createGroup(collection, index) {
    const group = document.createElement('section');
    group.className = 'jill-custom-order__configuration';
    group.dataset.jillProductCollectionGroup = collection.value;

    const heading = document.createElement('div');
    heading.className = 'jill-custom-order__subhead';
    const title = document.createElement('h3');
    title.id = `JillCustomOrderCollection-${index + 1}`;
    title.textContent = displayCollectionTitle(collection);
    heading.append(title);

    const products = document.createElement('div');
    products.className = 'jill-custom-order__product-list';
    products.setAttribute('aria-labelledby', title.id);
    products.dataset.jillProductCollectionProducts = collection.value;

    group.append(heading, products);
    return {group, products};
  }

  function render(root) {
    const mount = root.querySelector('[data-jill-custom-order-catalog]');
    if (!mount) return;

    const choices = productChoices(root);
    choices.forEach((choice, index) => {
      if (!baseOrder.has(choice)) baseOrder.set(choice, index);
    });
    choices.sort((left, right) => (baseOrder.get(left) || 0) - (baseOrder.get(right) || 0));

    const collections = selectedCollections(root);
    const groups = collections.map(createGroup);
    const groupByHandle = new Map(groups.map((entry, index) => [collections[index].value, entry]));
    const parking = document.createElement('div');
    parking.hidden = true;
    parking.dataset.jillProductCatalogParking = '';

    for (const choice of choices) {
      const handles = new Set(collectionHandles(choice));
      const owner = collections.find((collection) => handles.has(collection.value));
      if (owner) groupByHandle.get(owner.value)?.products.append(choice);
      else parking.append(choice);
    }

    mount.classList.remove('jill-custom-order__product-list');
    mount.classList.add('jill-custom-order__configuration');
    mount.replaceChildren(parking, ...groups.filter((entry) => entry.products.childElementCount > 0).map((entry) => entry.group));
  }

  function initialize(root) {
    if (!root || root.dataset.jillCatalogGroupsInitialized === 'true') return;
    root.dataset.jillCatalogGroupsInitialized = 'true';
    render(root);

    const refresh = () => queueMicrotask(() => render(root));
    root.querySelectorAll('[data-jill-collection-choice], [name="order_type"]').forEach((control) => {
      control.addEventListener('change', refresh);
    });
  }

  function initializeWithin(scope) {
    for (const root of scope.querySelectorAll('[data-jill-custom-order]')) initialize(root);
    if (scope.matches?.('[data-jill-custom-order]')) initialize(scope);
  }

  if (typeof document !== 'undefined') {
    initializeWithin(document);
    document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
  }

  Object.defineProperty(globalThis, 'JILLCustomOrderCatalogGroups', {
    value: Object.freeze({render}),
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
