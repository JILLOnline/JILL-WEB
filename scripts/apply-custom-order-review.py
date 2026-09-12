from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, value):
    Path(path).write_text(value, encoding='utf-8')


def replace_between(source, start, end, replacement, label):
    first = source.find(start)
    if first < 0:
        raise RuntimeError(f'{label}: start marker not found')
    last = source.find(end, first)
    if last < 0:
        raise RuntimeError(f'{label}: end marker not found')
    return source[:first] + replacement + source[last:]


# 1) Canonical semantic icons used by Review.
icon_path = 'theme/snippets/ui-icon.liquid'
icons = read(icon_path)
if "{% when 'check' %}" not in icons:
    anchor = "  {% when 'chevron-down' %}\n"
    addition = r'''  {% when 'check' %}
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="m5 12.5 4.2 4L19 7"/>
    </svg>
  {% when 'bag' %}
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 8.5h14l-1 11H6l-1-11Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>
    </svg>
  {% when 'package' %}
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="m4.5 7.5 7.5-4 7.5 4v9L12 20.5l-7.5-4v-9Z"/><path d="m4.8 7.7 7.2 4 7.2-4M12 11.7v8.5"/>
    </svg>
  {% when 'palette' %}
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 4a8 8 0 1 0 0 16h1.2c1.2 0 1.8-1.4 1-2.3-.8-.9-.2-2.3 1-2.3H17a3 3 0 0 0 3-3C20 7.8 16.4 4 12 4Z"/><circle cx="8" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="11" cy="7.5" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="8.5" r=".8" fill="currentColor" stroke="none"/>
    </svg>
  {% when 'calendar' %}
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>
    </svg>
  {% when 'location' %}
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>
    </svg>
  {% when 'mail' %}
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m5 7 7 5.5L19 7"/>
    </svg>
  {% when 'shield-check' %}
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3.5 19 6v5.2c0 4.3-2.8 7.6-7 9.3-4.2-1.7-7-5-7-9.3V6l7-2.5Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>
    </svg>
'''
    if anchor not in icons:
        raise RuntimeError('ui-icon: insertion anchor not found')
    icons = icons.replace(anchor, addition + anchor, 1)
    write(icon_path, icons)


# 2) Review shell stays in the canonical Custom Order section.
section_path = 'theme/sections/main-custom-order.liquid'
section = read(section_path)
review_shell = r'''  <section class="jill-custom-order__review" data-jill-custom-order-review hidden aria-hidden="true">
    <div class="jill-custom-order-review__hero jill-card">
      <span class="jill-custom-order-review__hero-icon" aria-hidden="true">{% render 'ui-icon', name: 'check' %}</span>
      <div class="jill-custom-order-review__hero-copy">
        <h2>{{ 'custom_order.review.title' | t }}</h2>
        <p>{{ 'custom_order.review.help' | t }}</p>
      </div>
    </div>

    <div class="jill-custom-order-review__icon-bank" hidden aria-hidden="true">
      <template data-jill-review-icon="customer">{% render 'ui-icon', name: 'account' %}</template>
      <template data-jill-review-icon="items">{% render 'ui-icon', name: 'bag' %}</template>
      <template data-jill-review-icon="total">{% render 'ui-icon', name: 'package' %}</template>
      <template data-jill-review-icon="design">{% render 'ui-icon', name: 'palette' %}</template>
      <template data-jill-review-icon="date">{% render 'ui-icon', name: 'calendar' %}</template>
      <template data-jill-review-icon="fulfillment">{% render 'ui-icon', name: 'location' %}</template>
    </div>

    <div class="jill-custom-order__review-content" data-jill-custom-order-review-content></div>

    <label class="jill-custom-order__consent jill-custom-order__marketing jill-custom-order-review__consent-card jill-card">
      <span class="jill-custom-order-review__consent-icon" aria-hidden="true">{% render 'ui-icon', name: 'mail' %}</span>
      <input type="checkbox" data-jill-marketing-consent>
      <span class="jill-custom-order-review__consent-copy">
        <span class="jill-custom-order-review__consent-line">
          <strong>{{ 'custom_order.review.marketing' | t }}</strong>
          <small class="jill-custom-order-review__optional">{{ optional_label }}</small>
        </span>
        <small class="jill-custom-order-review__disclosure">{{ 'custom_order.review.marketing_help' | t }}</small>
      </span>
    </label>

    <label class="jill-custom-order__consent jill-custom-order-review__consent-card jill-custom-order-review__consent-card--required jill-card">
      <span class="jill-custom-order-review__consent-icon" aria-hidden="true">{% render 'ui-icon', name: 'shield-check' %}</span>
      <input type="checkbox" data-jill-review-confirm required>
      <span class="jill-custom-order-review__consent-copy">
        <strong><span class="jill-field__required" aria-hidden="true">*</span>{{ 'custom_order.review.confirm' | t }}</strong>
      </span>
    </label>

    <div class="jill-custom-order__review-actions">
      <button class="jill-button" data-variant="secondary" type="button" data-jill-review-back>{{ 'custom_order.actions.back' | t }}</button>
      <button class="jill-button" type="button" data-jill-request-submit disabled aria-disabled="true">{{ 'custom_order.actions.submit' | t }}</button>
    </div>
  </section>

'''
section = replace_between(
    section,
    '  <section class="jill-custom-order__review jill-card" data-jill-custom-order-review hidden aria-hidden="true">',
    '  <section class="jill-custom-order__success jill-card"',
    review_shell,
    'review shell',
)
write(section_path, section)


# 3) Review renderer: presentation only; normalized request values remain untouched.
runtime_path = 'theme/assets/jill-custom-order.js'
runtime = read(runtime_path)
review_runtime = r'''  function reviewRow(label, value, className = 'jill-custom-order-review__row') {
    if (value === '' || value === undefined || value === null || value === false) return null;
    const row = node('div', className);
    row.append(node('div', 'jill-custom-order-review__key', label), node('div', 'jill-custom-order-review__value', value));
    return row;
  }

  function appendRows(host, rows) {
    rows.filter(Boolean).forEach((row) => host.append(row));
  }

  function displayValue(value) {
    if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value ?? '');
  }

  function requestValue(request, id) {
    return request.request_attributes.find((entry) => entry.id === id)?.value ?? '';
  }

  function reviewIcon(root, name, className = 'jill-custom-order-review__icon') {
    const holder = node('span', className);
    holder.setAttribute('aria-hidden', 'true');
    const template = root.querySelector(`template[data-jill-review-icon="${name}"]`);
    const icon = template?.content?.firstElementChild?.cloneNode(true);
    if (icon) holder.append(icon);
    return holder;
  }

  function reviewHeading(root, iconName, title, help = '') {
    const head = node('div', 'jill-custom-order-review__section-head');
    head.append(reviewIcon(root, iconName));
    const copy = node('div', 'jill-custom-order-review__section-copy');
    copy.append(node('h3', 'jill-custom-order-review__heading', title));
    if (help) copy.append(node('p', 'jill-custom-order-review__help', help));
    head.append(copy);
    return head;
  }

  function itemProfile(root, item) {
    const itemNode = itemForProduct(root, item.product_id);
    const form = itemNode?.querySelector('[data-jill-custom-order-item-form]');
    return form ? readProfile(form) : null;
  }

  function displayCapabilityValue(profile, fieldId, value) {
    if (Array.isArray(value)) {
      return value.map((entry) => displayCapabilityValue(profile, fieldId, entry)).filter(Boolean).join(', ');
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    const field = profile ? globalThis.JILLProductCapabilities?.getField(profile, fieldId) : null;
    const option = (field?.options || []).find((candidate) => String(candidate.value) === String(value));
    return option?.label || displayValue(value);
  }

  function productOptionReview(item, host, profile) {
    const encoded = item.attributes.find((entry) => entry.id === 'product_options')?.value;
    if (!encoded) return;
    let groups = [];
    try { groups = JSON.parse(encoded); } catch (error) { return; }
    groups.forEach((group, index) => {
      const block = node('section', 'jill-custom-order-review__subgroup');
      const count = group.unit_ids?.length || 0;
      block.append(node('h5', 'jill-custom-order-review__subgroup-title', `Option ${index + 1}${count ? ` — ${count} item${count === 1 ? '' : 's'}` : ''}`));
      const details = node('div', 'jill-custom-order-review__details');
      appendRows(details, (group.attributes || []).map((entry) =>
        reviewRow(entry.label || entry.id, displayCapabilityValue(profile, entry.id, entry.value)),
      ));
      block.append(details);
      host.append(block);
    });
  }

  function collectionTitleMap(root) {
    return new Map(collectionChoices(root).map((choice) => [choice.value, choice.dataset.collectionTitle || choice.value]));
  }

  function personalizationStatus(items) {
    const states = items.map((item) => Boolean(item.personalization_groups?.length));
    if (states.every(Boolean)) return 'Personalized';
    if (states.every((state) => !state)) return 'Not personalized';
    return '';
  }

  function statusPill(text) {
    if (!text) return null;
    const pill = node('span', 'jill-custom-order-review__status', text);
    pill.dataset.tone = text === 'Personalized' ? 'success' : 'neutral';
    return pill;
  }

  function renderReview(root, request) {
    const review = root.querySelector('[data-jill-custom-order-review]');
    const content = root.querySelector('[data-jill-custom-order-review-content]');
    if (!review || !content) return;
    const sheet = node('div', 'jill-custom-order-review');

    const customer = node('section', 'jill-custom-order-review__card jill-card');
    customer.append(reviewHeading(root, 'customer', 'Customer Information'));
    const customerDetails = node('div', 'jill-custom-order-review__summary-grid');
    const preferredContact = request.customer.preferred_contact === 'phone' ? 'Text / phone' : 'Email';
    const preferredValue = request.customer.phone && request.customer.preferred_contact === 'phone'
      ? `${preferredContact} · ${request.customer.phone}`
      : preferredContact;
    appendRows(customerDetails, [
      reviewRow('Name', request.customer.name, 'jill-custom-order-review__summary-item'),
      reviewRow('Email', request.customer.email, 'jill-custom-order-review__summary-item'),
      reviewRow('Preferred contact', preferredValue, 'jill-custom-order-review__summary-item'),
    ]);
    customer.append(customerDetails);
    sheet.append(customer);

    const itemsSection = node('section', 'jill-custom-order-review__card jill-custom-order-review__items-card jill-card');
    itemsSection.append(reviewHeading(root, 'items', 'Items', 'Here’s what you’re requesting.'));
    const titles = collectionTitleMap(root);
    const selectedCollections = new Set(selectedCollectionChoices(root).map((choice) => choice.value));
    const groups = new Map();
    let total = 0;
    request.items.forEach((item) => {
      total += item.quantity;
      const handle = item.collection_ids.find((candidate) => selectedCollections.has(candidate)) || item.collection_ids[0] || 'items';
      const title = titles.get(handle) || 'Items';
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(item);
    });

    groups.forEach((items, title) => {
      const collection = node('section', 'jill-custom-order-review__collection');
      const collectionHead = node('div', 'jill-custom-order-review__collection-head');
      collectionHead.append(node('h4', 'jill-custom-order-review__collection-title', title));
      const collectionStatus = statusPill(personalizationStatus(items));
      if (collectionStatus) collectionHead.append(collectionStatus);
      collection.append(collectionHead);

      items.forEach((item) => {
        const article = node('article', 'jill-custom-order-review__item');
        const head = node('div', 'jill-custom-order-review__item-head');
        head.append(node('h4', 'jill-custom-order-review__item-title', `${item.quantity}× ${item.title}`));
        if (!collectionStatus) {
          const itemStatus = statusPill(item.personalization_groups?.length ? 'Personalized' : 'Not personalized');
          if (itemStatus) head.append(itemStatus);
        }
        article.append(head);

        const profile = itemProfile(root, item);
        if (item.variant_allocations?.length) {
          const variants = node('div', 'jill-custom-order-review__details jill-custom-order-review__inner-panel');
          item.variant_allocations.forEach((allocation) =>
            variants.append(reviewRow('Variation', `${allocation.quantity}× ${allocation.title}`)),
          );
          article.append(variants);
        }

        const singleton = item.attributes.filter((entry) => entry.id !== 'product_options');
        if (singleton.length) {
          const details = node('div', 'jill-custom-order-review__details jill-custom-order-review__inner-panel');
          appendRows(details, singleton.map((entry) =>
            reviewRow(entry.label || entry.id, displayCapabilityValue(profile, entry.id, entry.value)),
          ));
          article.append(details);
        }

        productOptionReview(item, article, profile);
        item.personalization_groups.forEach((group, index) => {
          if (!group.attributes.length) return;
          const block = node('section', 'jill-custom-order-review__personalization');
          const personalizationCount = group.allocations?.length || 0;
          block.append(node('h5', 'jill-custom-order-review__subgroup-title', `Personalization ${index + 1} — ${personalizationCount} item${personalizationCount === 1 ? '' : 's'}`));
          const details = node('div', 'jill-custom-order-review__details');
          appendRows(details, group.attributes.map((entry) => reviewRow(entry.label || entry.id, displayValue(entry.value))));
          block.append(details);
          article.append(block);
        });
        collection.append(article);
      });
      itemsSection.append(collection);
    });

    const totalBar = node('div', 'jill-custom-order-review__total');
    const totalLabel = node('div', 'jill-custom-order-review__total-label');
    totalLabel.append(reviewIcon(root, 'total', 'jill-custom-order-review__total-icon'), node('strong', '', 'Total Items'));
    totalBar.append(totalLabel, node('strong', 'jill-custom-order-review__total-value', total));
    itemsSection.append(totalBar);
    sheet.append(itemsSection);

    const design = node('section', 'jill-custom-order-review__card jill-card');
    design.append(reviewHeading(root, 'design', 'Design Details', 'Your style preferences for this order.'));
    const designDetails = node('div', 'jill-custom-order-review__summary-grid');
    const references = uploadedMedia(root);
    const referenceValue = references.length
      ? `${references.length} uploaded: ${references.map((reference) => reference.name).filter(Boolean).join(', ')}`
      : 'No';
    appendRows(designDetails, [
      reviewRow('Theme', requestValue(request, 'theme'), 'jill-custom-order-review__summary-item'),
      reviewRow('Colors', requestValue(request, 'colors'), 'jill-custom-order-review__summary-item'),
      reviewRow('Reference Images', referenceValue, 'jill-custom-order-review__summary-item'),
    ]);
    design.append(designDetails);

    const planning = node('div', 'jill-custom-order-review__planning');
    const date = node('section', 'jill-custom-order-review__planning-card');
    date.append(reviewIcon(root, 'date'), node('div', 'jill-custom-order-review__planning-copy'));
    date.lastElementChild.append(node('span', 'jill-custom-order-review__planning-label', 'Date Needed'), node('strong', 'jill-custom-order-review__planning-value', request.planning.date_needed || '—'));

    const fulfillment = node('section', 'jill-custom-order-review__planning-card');
    fulfillment.append(reviewIcon(root, 'fulfillment'), node('div', 'jill-custom-order-review__planning-copy'));
    const fulfillmentValue = request.planning.fulfillment === 'pickup' ? 'Jacksonville pickup' : 'Shipping';
    fulfillment.lastElementChild.append(node('span', 'jill-custom-order-review__planning-label', 'Fulfillment'), node('strong', 'jill-custom-order-review__planning-value', fulfillmentValue));
    if (request.planning.address) {
      const location = [request.planning.address.city, request.planning.address.state, request.planning.address.postal_code].filter(Boolean).join(', ');
      if (location) fulfillment.lastElementChild.append(node('span', 'jill-custom-order-review__planning-meta', location));
    }
    planning.append(date, fulfillment);
    design.append(planning);
    sheet.append(design);

    content.replaceChildren(sheet);
    setVisible(review, true);
  }

'''
runtime = replace_between(runtime, '  function reviewRow(', '  function todayLocal()', review_runtime, 'review runtime')
write(runtime_path, runtime)


# 4) Canonical Review presentation styles. No new stylesheet owner.
css_path = 'theme/assets/jill-forms.css'
css = read(css_path)
review_css = r'''  .jill-custom-order__consent {
    cursor: pointer;
  }

  .jill-custom-order__consent input {
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    accent-color: var(--jill-color-accent);
  }

  .jill-custom-order[data-jill-custom-order] .jill-custom-order__review {
    display: grid;
    width: 100%;
    max-width: 72rem;
    margin-inline: auto;
    padding-inline: clamp(1rem, 2.5vw, 1.5rem);
    gap: calc(var(--jill-space-unit) * 3);
  }

  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__hero,
  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__card,
  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__consent-card {
    border: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-accent) 18%, var(--jill-color-foreground) 8%);
    border-radius: var(--jill-card-radius);
    background: var(--jill-color-background);
    box-shadow: none;
  }

  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__hero {
    display: flex;
    align-items: center;
    gap: calc(var(--jill-space-unit) * 2);
    padding: clamp(1.5rem, 3vw, 1.75rem);
    background: color-mix(in srgb, var(--jill-color-accent) 4%, var(--jill-color-background));
  }

  .jill-custom-order-review__hero-icon {
    display: grid;
    flex: 0 0 auto;
    width: 3.5rem;
    height: 3.5rem;
    place-items: center;
    border-radius: 999px;
    background: var(--jill-color-accent);
    color: var(--jill-color-background);
    font-size: 1.55rem;
  }

  .jill-custom-order-review__hero-copy {
    min-width: 0;
  }

  .jill-custom-order-review__hero-copy h2 {
    margin: 0;
    font-size: clamp(1.75rem, 3vw, 2rem);
    line-height: 1.12;
  }

  .jill-custom-order-review__hero-copy p,
  .jill-custom-order-review__help {
    margin: calc(var(--jill-space-unit) * 0.65) 0 0;
    color: var(--jill-color-muted);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .jill-custom-order__review-content,
  .jill-custom-order-review {
    display: grid;
    gap: calc(var(--jill-space-unit) * 3);
  }

  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__card {
    display: grid;
    gap: calc(var(--jill-space-unit) * 2);
    padding: clamp(1.25rem, 3vw, 1.5rem);
  }

  .jill-custom-order-review__section-head {
    display: flex;
    align-items: center;
    gap: calc(var(--jill-space-unit) * 1.25);
  }

  .jill-custom-order-review__icon,
  .jill-custom-order-review__consent-icon,
  .jill-custom-order-review__total-icon {
    display: grid;
    flex: 0 0 auto;
    width: 2.625rem;
    height: 2.625rem;
    place-items: center;
    border-radius: 999px;
    background: color-mix(in srgb, var(--jill-color-accent) 10%, var(--jill-color-background));
    color: var(--jill-color-accent);
    font-size: 1.2rem;
  }

  .jill-custom-order-review__section-copy {
    min-width: 0;
  }

  .jill-custom-order-review__heading {
    margin: 0;
    font-size: clamp(1.125rem, 2vw, 1.375rem);
    font-weight: 800;
    line-height: 1.2;
  }

  .jill-custom-order-review__summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: calc(var(--jill-space-unit) * 2);
    border: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-accent) 14%, var(--jill-color-foreground) 7%);
    border-radius: var(--jill-field-radius);
    background: color-mix(in srgb, var(--jill-color-accent) 4%, var(--jill-color-background));
  }

  .jill-custom-order-review__summary-item {
    min-width: 0;
    padding-inline: calc(var(--jill-space-unit) * 2);
  }

  .jill-custom-order-review__summary-item:first-child {
    padding-inline-start: 0;
  }

  .jill-custom-order-review__summary-item:last-child {
    padding-inline-end: 0;
  }

  .jill-custom-order-review__summary-item + .jill-custom-order-review__summary-item {
    border-inline-start: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-foreground) 12%, transparent);
  }

  .jill-custom-order-review__key,
  .jill-custom-order-review__planning-label {
    color: var(--jill-color-muted);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.055em;
    text-transform: uppercase;
  }

  .jill-custom-order-review__value {
    min-width: 0;
    margin-block-start: calc(var(--jill-space-unit) * 0.5);
    overflow-wrap: anywhere;
    font-size: 0.98rem;
    font-weight: 650;
    line-height: 1.45;
  }

  .jill-custom-order-review__collection {
    display: grid;
    overflow: hidden;
    border: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-accent) 13%, var(--jill-color-foreground) 7%);
    border-radius: var(--jill-field-radius);
  }

  .jill-custom-order-review__collection-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--jill-space-unit);
    padding: calc(var(--jill-space-unit) * 1.25) calc(var(--jill-space-unit) * 1.5);
    background: color-mix(in srgb, var(--jill-color-accent) 9%, var(--jill-color-background));
  }

  .jill-custom-order-review__collection-title,
  .jill-custom-order-review__item-title,
  .jill-custom-order-review__subgroup-title {
    margin: 0;
  }

  .jill-custom-order-review__collection-title {
    font-size: 1.075rem;
    font-weight: 800;
  }

  .jill-custom-order-review__status {
    flex: 0 0 auto;
    max-width: 100%;
    padding: 0.35rem 0.65rem;
    border: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-foreground) 18%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--jill-color-accent) 5%, var(--jill-color-background));
    color: var(--jill-color-muted);
    font-size: 0.75rem;
    font-weight: 750;
    line-height: 1;
    letter-spacing: 0.025em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .jill-custom-order-review__status[data-tone='success'] {
    border-color: color-mix(in srgb, var(--jill-color-success) 38%, transparent);
    background: color-mix(in srgb, var(--jill-color-success) 10%, var(--jill-color-background));
    color: var(--jill-color-success);
  }

  .jill-custom-order-review__item {
    display: grid;
    gap: calc(var(--jill-space-unit) * 1.5);
    padding: calc(var(--jill-space-unit) * 1.75);
  }

  .jill-custom-order-review__item + .jill-custom-order-review__item {
    border-block-start: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-foreground) 10%, transparent);
  }

  .jill-custom-order-review__item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--jill-space-unit) * 1.25);
  }

  .jill-custom-order-review__item-title {
    min-width: 0;
    font-size: 1rem;
    font-weight: 750;
    line-height: 1.35;
  }

  .jill-custom-order-review__details {
    display: grid;
    gap: calc(var(--jill-space-unit) * 0.75);
  }

  .jill-custom-order-review__row {
    display: grid;
    grid-template-columns: minmax(8rem, 0.42fr) minmax(0, 1fr);
    gap: calc(var(--jill-space-unit) * 1.25);
  }

  .jill-custom-order-review__row .jill-custom-order-review__value {
    margin-block-start: 0;
  }

  .jill-custom-order-review__inner-panel,
  .jill-custom-order-review__subgroup,
  .jill-custom-order-review__personalization {
    display: grid;
    gap: var(--jill-space-unit);
    padding: calc(var(--jill-space-unit) * 1.5);
    border: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-accent) 12%, var(--jill-color-foreground) 6%);
    border-radius: var(--jill-field-radius);
    background: color-mix(in srgb, var(--jill-color-accent) 3.5%, var(--jill-color-background));
  }

  .jill-custom-order-review__subgroup-title {
    color: var(--jill-color-accent);
    font-size: 0.95rem;
    font-weight: 800;
  }

  .jill-custom-order-review__total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--jill-space-unit) * 1.5);
    padding: calc(var(--jill-space-unit) * 1.5);
    border-radius: var(--jill-field-radius);
    background: color-mix(in srgb, var(--jill-color-accent) 9%, var(--jill-color-background));
  }

  .jill-custom-order-review__total-label {
    display: flex;
    align-items: center;
    gap: var(--jill-space-unit);
    font-size: 1rem;
  }

  .jill-custom-order-review__total-value {
    color: var(--jill-color-accent);
    font-size: 1.65rem;
    line-height: 1;
  }

  .jill-custom-order-review__planning {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(var(--jill-space-unit) * 2);
  }

  .jill-custom-order-review__planning-card {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: calc(var(--jill-space-unit) * 1.25);
    padding: calc(var(--jill-space-unit) * 1.5);
    border: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-accent) 12%, var(--jill-color-foreground) 6%);
    border-radius: var(--jill-field-radius);
    background: color-mix(in srgb, var(--jill-color-accent) 3.5%, var(--jill-color-background));
  }

  .jill-custom-order-review__planning-copy {
    display: grid;
    min-width: 0;
    gap: calc(var(--jill-space-unit) * 0.45);
  }

  .jill-custom-order-review__planning-value {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 1rem;
  }

  .jill-custom-order-review__planning-meta {
    color: var(--jill-color-muted);
    font-size: 0.825rem;
    line-height: 1.4;
  }

  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__consent-card {
    display: grid;
    grid-template-columns: 2.625rem 1.25rem minmax(0, 1fr);
    align-items: start;
    gap: calc(var(--jill-space-unit) * 1.25);
    padding: calc(var(--jill-space-unit) * 1.5);
  }

  .jill-custom-order-review__consent-card input {
    margin-block-start: 0.65rem;
  }

  .jill-custom-order-review__consent-copy {
    display: grid;
    min-width: 0;
    gap: calc(var(--jill-space-unit) * 0.65);
    padding-block-start: 0.35rem;
    line-height: 1.45;
  }

  .jill-custom-order-review__consent-line {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--jill-space-unit);
  }

  .jill-custom-order-review__optional {
    flex: 0 0 auto;
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--jill-color-accent) 7%, var(--jill-color-background));
    color: var(--jill-color-muted);
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1;
  }

  .jill-custom-order-review__disclosure {
    color: var(--jill-color-muted);
    font-size: 0.8rem;
    font-weight: 400;
    line-height: 1.5;
  }

  .jill-custom-order-review__consent-card--required {
    border-color: color-mix(in srgb, var(--jill-color-accent) 26%, var(--jill-color-foreground) 8%);
  }

  .jill-custom-order__review-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(var(--jill-space-unit) * 1.5);
  }

  .jill-custom-order__review-actions .jill-button {
    width: 100%;
    min-height: 3rem;
  }

'''
css = replace_between(
    css,
    '  .jill-custom-order__consent {',
    '  .jill-custom-order[data-jill-custom-order] .jill-custom-order__success {',
    review_css,
    'review css',
)

old_mobile = r'''    .jill-custom-order[data-jill-custom-order] .jill-custom-order__customer,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__two-column,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__collection-grid,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__product-list,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order-personalization-card__fields,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__shipping,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__review-actions,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__row,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__event,
    .jill-contact[data-jill-contact] .jill-contact__grid,
    .jill-contact[data-jill-contact] .jill-contact__choice-group,
    .jill-contact[data-jill-contact] .jill-contact__callout {
      grid-template-columns: 1fr;
    }
'''
new_mobile = r'''    .jill-custom-order[data-jill-custom-order] .jill-custom-order__customer,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__two-column,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__collection-grid,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__product-list,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order-personalization-card__fields,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__shipping,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__review-actions,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__summary-grid,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__row,
    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__planning,
    .jill-contact[data-jill-contact] .jill-contact__grid,
    .jill-contact[data-jill-contact] .jill-contact__choice-group,
    .jill-contact[data-jill-contact] .jill-contact__callout {
      grid-template-columns: minmax(0, 1fr);
    }

    .jill-custom-order[data-jill-custom-order] .jill-custom-order__review {
      padding-inline: 1rem;
      gap: calc(var(--jill-space-unit) * 2);
    }

    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__hero {
      align-items: flex-start;
      gap: calc(var(--jill-space-unit) * 1.25);
      padding: calc(var(--jill-space-unit) * 2);
    }

    .jill-custom-order-review__hero-icon {
      width: 2.875rem;
      height: 2.875rem;
      font-size: 1.25rem;
    }

    .jill-custom-order-review__hero-copy h2 {
      font-size: clamp(1.45rem, 7vw, 1.625rem);
    }

    .jill-custom-order-review__summary-item,
    .jill-custom-order-review__summary-item:first-child,
    .jill-custom-order-review__summary-item:last-child {
      padding: calc(var(--jill-space-unit) * 1.15) 0;
    }

    .jill-custom-order-review__summary-item:first-child {
      padding-block-start: 0;
    }

    .jill-custom-order-review__summary-item:last-child {
      padding-block-end: 0;
    }

    .jill-custom-order-review__summary-item + .jill-custom-order-review__summary-item {
      border-inline-start: 0;
      border-block-start: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-foreground) 12%, transparent);
    }

    .jill-custom-order-review__collection-head,
    .jill-custom-order-review__item-head {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .jill-custom-order-review__status {
      white-space: normal;
    }

    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__consent-card {
      grid-template-columns: 2.625rem 1.25rem minmax(0, 1fr);
      padding: calc(var(--jill-space-unit) * 1.35);
    }

    .jill-custom-order-review__consent-line {
      display: grid;
      justify-content: stretch;
    }

    .jill-custom-order-review__optional {
      justify-self: start;
    }
'''
if old_mobile not in css:
    raise RuntimeError('review css: mobile selector anchor not found')
css = css.replace(old_mobile, new_mobile, 1)
write(css_path, css)


# 5) Add Review-specific guard coverage without creating a second test owner.
test_path = 'scripts/test-custom-order-integration.mjs'
tests = read(test_path)
anchor = "assert.match(runtime, /renderReview/, 'Custom Order must build Review from normalized request state');\n"
addition = r'''assert.match(runtime, /function displayCapabilityValue/, 'Review must resolve human-facing Product Options labels without rewriting normalized payload values');
assert.match(runtime, /option\?\.label \|\| displayValue\(value\)/, 'Review must prefer capability option display labels over raw internal values');
assert.match(runtime, /Personalization \$\{index \+ 1\}/, 'Review must preserve quantity-aware personalization groups instead of flattening them');
assert.match(runtime, /\$\{item\.quantity\}× \$\{item\.title\}/, 'Review item quantity must use the polished multiplication sign');
assert.match(formsCss, /jill-custom-order-review__summary-grid[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/, 'Review summary cards must use three columns on desktop');
assert.match(formsCss, /jill-custom-order-review__planning[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/, 'Review Date Needed and Fulfillment must use two columns on desktop');
'''
if addition not in tests:
    if anchor not in tests:
        raise RuntimeError('custom order test: renderReview anchor not found')
    tests = tests.replace(anchor, anchor + addition, 1)
    write(test_path, tests)

print('Custom Order Review presentation patch applied.')
