from pathlib import Path

SECTION = Path('theme/sections/main-custom-order.liquid')
RUNTIME = Path('theme/assets/jill-custom-order.js')
FORMS = Path('theme/assets/jill-forms.css')
LAYOUT = Path('theme/layout/theme.liquid')
TESTS = Path('scripts/test-custom-order-integration.mjs')
PHONE = Path('theme/assets/jill-email-validation.js')

CANONICAL_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwjFDQxhjc4RDu8T0gSweQf70Y5TheTyWZ6KoVDux6Hx-Ue9jdE7E5Enl5nyxjJpo2W/exec'
DEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/exec'

section = SECTION.read_text()
if CANONICAL_ENDPOINT not in section:
    raise SystemExit('Canonical Custom Order endpoint is not present in the section')
if DEAD_ENDPOINT in section:
    raise SystemExit('Dead Apps Script deployment leaked into Custom Order')

root_anchor = '''  data-upload-preset="{{ section.settings.upload_preset | escape }}"
  data-optional-label="{{ optional_label | escape }}"'''
root_replacement = '''  data-upload-preset="{{ section.settings.upload_preset | escape }}"
  data-optional-label="{{ optional_label | escape }}"
  data-customer-logged-in="{% if customer %}true{% else %}false{% endif %}"
  data-customer-name="{% if customer %}{{ customer.name | escape }}{% endif %}"
  data-customer-email="{% if customer %}{{ customer.email | escape }}{% endif %}"
  data-customer-phone="{% if customer %}{{ customer.phone | default: customer.default_address.phone | escape }}{% endif %}"'''
if root_anchor not in section:
    raise SystemExit('Custom Order root data anchor not found')
section = section.replace(root_anchor, root_replacement, 1)

old_phone = "        {% render 'ui-field', id: 'JillCustomOrderPhone', name: 'phone', label: customer_phone_label, type: 'tel', optional_label: optional_label, dynamic_required: true, autocomplete: 'tel' %}"
new_phone = '''        <div class="jill-field jill-phone-field" data-jill-phone-field data-default-country="{{ localization.country.iso_code | default: 'US' | escape }}">
          <label class="jill-field__label" for="JillCustomOrderPhone">
            {{ customer_phone_label }}
            <span class="jill-field__required" data-dynamic-required="true" aria-hidden="true">*</span>
            <small class="jill-field__optional">{{ optional_label }}</small>
          </label>
          <div class="jill-phone-field__control">
            <select class="jill-field__control jill-phone-field__country" data-jill-phone-country aria-label="Phone country code"></select>
            <input
              class="jill-field__control jill-phone-field__number"
              id="JillCustomOrderPhone"
              name="phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel-national"
              data-jill-phone-number
            >
          </div>
          <p class="jill-field__message" data-jill-phone-help aria-live="polite"></p>
        </div>'''
if old_phone not in section:
    raise SystemExit('Custom Order phone field anchor not found')
section = section.replace(old_phone, new_phone, 1)

old_review_gate = '''      <div class="jill-custom-order__stage-actions">
        <button class="jill-button" type="button" data-jill-review-open>{{ 'custom_order.actions.review' | t }}</button>
        <p class="jill-custom-order__help" data-jill-review-validation-note hidden></p>
      </div>
    </section>
  </div>'''
new_review_gate = '''    </section>

    <div class="jill-custom-order__stage-actions" data-jill-review-gate>
      <button class="jill-button" type="button" data-jill-review-open>{{ 'custom_order.actions.review' | t }}</button>
      <p class="jill-custom-order__help" data-jill-review-validation-note hidden></p>
    </div>
  </div>'''
if old_review_gate not in section:
    raise SystemExit('Custom Order Review gate anchor not found')
section = section.replace(old_review_gate, new_review_gate, 1)

success_anchor = '  <section class="jill-custom-order__success jill-card" data-jill-custom-order-success hidden aria-hidden="true" role="status">'
notification_markup = '''  <div data-jill-owner-notification hidden aria-hidden="true">
    {% form 'contact', id: 'JillCustomOrderOwnerNotification' %}
      <input type="hidden" name="contact[name]" value="">
      <input type="hidden" name="contact[email]" value="">
      <input type="hidden" name="contact[body]" value="">
    {% endform %}
  </div>

'''
if notification_markup not in section:
    if success_anchor not in section:
        raise SystemExit('Custom Order success anchor not found')
    section = section.replace(success_anchor, notification_markup + success_anchor, 1)
SECTION.write_text(section)

PHONE.write_text(r'''(() => {
  'use strict';

  const countries = Object.freeze([
    {iso: 'US', name: 'United States', dial: '1', min: 10, max: 10, placeholder: '(904) 555-0123', pattern: 'nanp'},
    {iso: 'CA', name: 'Canada', dial: '1', min: 10, max: 10, placeholder: '(416) 555-0123', pattern: 'nanp'},
    {iso: 'PR', name: 'Puerto Rico', dial: '1', min: 10, max: 10, placeholder: '(787) 555-0123', pattern: 'nanp'},
    {iso: 'DO', name: 'Dominican Republic', dial: '1', min: 10, max: 10, placeholder: '(809) 555-0123', pattern: 'nanp'},
    {iso: 'CO', name: 'Colombia', dial: '57', min: 10, max: 10, placeholder: '300 123 4567', pattern: '3-3-4'},
    {iso: 'MX', name: 'Mexico', dial: '52', min: 10, max: 10, placeholder: '55 1234 5678', pattern: '2-4-4'},
    {iso: 'FR', name: 'France', dial: '33', min: 9, max: 9, placeholder: '6 12 34 56 78', pattern: '1-2-2-2-2'},
    {iso: 'ES', name: 'Spain', dial: '34', min: 9, max: 9, placeholder: '612 345 678', pattern: '3-3-3'},
    {iso: 'GB', name: 'United Kingdom', dial: '44', min: 10, max: 11, placeholder: '07123 456789', pattern: 'uk'},
    {iso: 'IN', name: 'India', dial: '91', min: 10, max: 10, placeholder: '98765 43210', pattern: '5-5'},
    {iso: 'CN', name: 'China', dial: '86', min: 11, max: 11, placeholder: '138 0013 8000', pattern: '3-4-4'},
    {iso: 'BR', name: 'Brazil', dial: '55', min: 10, max: 11, placeholder: '11 91234-5678', pattern: 'br'},
    {iso: 'AR', name: 'Argentina', dial: '54', min: 10, max: 10, placeholder: '11 1234-5678', pattern: '2-4-4'},
    {iso: 'CL', name: 'Chile', dial: '56', min: 9, max: 9, placeholder: '9 1234 5678', pattern: '1-4-4'},
    {iso: 'PE', name: 'Peru', dial: '51', min: 9, max: 9, placeholder: '912 345 678', pattern: '3-3-3'},
    {iso: 'VE', name: 'Venezuela', dial: '58', min: 10, max: 10, placeholder: '412 123 4567', pattern: '3-3-4'},
    {iso: 'EC', name: 'Ecuador', dial: '593', min: 9, max: 9, placeholder: '99 123 4567', pattern: '2-3-4'},
    {iso: 'CR', name: 'Costa Rica', dial: '506', min: 8, max: 8, placeholder: '8888 8888', pattern: '4-4'},
    {iso: 'PA', name: 'Panama', dial: '507', min: 8, max: 8, placeholder: '6123-4567', pattern: '4-4'},
    {iso: 'DE', name: 'Germany', dial: '49', min: 7, max: 11, placeholder: '1512 3456789', pattern: 'variable'},
    {iso: 'IT', name: 'Italy', dial: '39', min: 9, max: 10, placeholder: '312 345 6789', pattern: 'variable'},
    {iso: 'AU', name: 'Australia', dial: '61', min: 9, max: 9, placeholder: '412 345 678', pattern: '3-3-3'},
    {iso: 'NZ', name: 'New Zealand', dial: '64', min: 8, max: 10, placeholder: '21 123 4567', pattern: 'variable'},
    {iso: 'OTHER', name: 'Other / International', dial: '', min: 6, max: 15, placeholder: 'International number', pattern: 'variable'},
  ]);

  const byIso = new Map(countries.map((country) => [country.iso, country]));

  function flag(iso) {
    if (!/^[A-Z]{2}$/.test(iso)) return '🌐';
    return String.fromCodePoint(...iso.split('').map((letter) => 127397 + letter.charCodeAt(0)));
  }

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function group(digits, sizes, separator = ' ') {
    const parts = [];
    let offset = 0;
    for (const size of sizes) {
      if (offset >= digits.length) break;
      parts.push(digits.slice(offset, offset + size));
      offset += size;
    }
    if (offset < digits.length) parts.push(digits.slice(offset));
    return parts.filter(Boolean).join(separator);
  }

  function formatNational(country, digits) {
    const value = digits.slice(0, country.max);
    switch (country.pattern) {
      case 'nanp':
        if (value.length <= 3) return value;
        if (value.length <= 6) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
        return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
      case '1-2-2-2-2': return group(value, [1, 2, 2, 2, 2]);
      case '1-4-4': return group(value, [1, 4, 4]);
      case '2-3-4': return group(value, [2, 3, 4]);
      case '2-4-4': return group(value, [2, 4, 4], value.length > 6 ? '-' : ' ');
      case '3-3-3': return group(value, [3, 3, 3]);
      case '3-3-4': return group(value, [3, 3, 4]);
      case '3-4-4': return group(value, [3, 4, 4]);
      case '4-4': return group(value, [4, 4], '-');
      case '5-5': return group(value, [5, 5]);
      case 'br':
        if (value.length <= 2) return value;
        if (value.length <= 6) return `${value.slice(0, 2)} ${value.slice(2)}`;
        if (value.length === 10) return `${value.slice(0, 2)} ${value.slice(2, 6)}-${value.slice(6)}`;
        return `${value.slice(0, 2)} ${value.slice(2, 7)}-${value.slice(7)}`;
      case 'uk':
        if (value.length <= 4) return value;
        return value.length > 10 ? group(value, [5, 6]) : group(value, [4, 3, 3]);
      default: return value;
    }
  }

  function currentCountry(field) {
    const select = field?.querySelector('[data-jill-phone-country]');
    return byIso.get(select?.value) || byIso.get('US');
  }

  function nationalDigits(field, country = currentCountry(field)) {
    const input = field?.querySelector('[data-jill-phone-number]');
    if (!input) return '';
    const raw = String(input.value || '').trim();
    let digits = digitsOnly(raw);
    if (raw.startsWith('+') && country.dial && digits.startsWith(country.dial)) digits = digits.slice(country.dial.length);
    return digits.slice(0, country.max);
  }

  function detectCountry(value, fallbackIso = 'US') {
    const raw = String(value || '').trim();
    if (!raw.startsWith('+')) return byIso.get(fallbackIso) || byIso.get('US');
    const digits = digitsOnly(raw);
    const matches = countries
      .filter((country) => country.dial && digits.startsWith(country.dial))
      .sort((a, b) => b.dial.length - a.dial.length);
    if (!matches.length) return byIso.get('OTHER');
    if (matches[0].dial !== '1') return matches[0];
    const fallback = byIso.get(fallbackIso);
    return fallback?.dial === '1' ? fallback : byIso.get('US');
  }

  function validate(field) {
    const input = field?.querySelector('[data-jill-phone-number]');
    if (!input) return false;
    const country = currentCountry(field);
    const digits = nationalDigits(field, country);
    let message = '';
    if (digits.length && (digits.length < country.min || digits.length > country.max)) message = `Enter a valid ${country.name} phone number.`;
    input.setCustomValidity(message);
    const help = field.querySelector('[data-jill-phone-help]');
    if (help) help.textContent = message || `${flag(country.iso)} ${country.dial ? `+${country.dial}` : ''} ${country.name}`.trim();
    return !message;
  }

  function sync(field) {
    const input = field?.querySelector('[data-jill-phone-number]');
    if (!input) return;
    const country = currentCountry(field);
    const digits = nationalDigits(field, country);
    input.value = formatNational(country, digits);
    input.placeholder = country.placeholder;
    input.maxLength = Math.max(country.placeholder.length + 3, formatNational(country, '9'.repeat(country.max)).length);
    input.setAttribute('aria-label', `${country.name} phone number`);
    validate(field);
  }

  function setPhoneValue(scope, value) {
    const field = phoneField(scope);
    if (!field || !value) return;
    const select = field.querySelector('[data-jill-phone-country]');
    const input = field.querySelector('[data-jill-phone-number]');
    if (!select || !input) return;
    const country = detectCountry(value, field.dataset.defaultCountry || 'US');
    select.value = country.iso;
    let digits = digitsOnly(value);
    if (String(value).trim().startsWith('+') && country.dial && digits.startsWith(country.dial)) digits = digits.slice(country.dial.length);
    input.value = digits;
    sync(field);
  }

  function configure(field) {
    if (!field || field.dataset.jillPhoneReady === 'true') return;
    const select = field.querySelector('[data-jill-phone-country]');
    const input = field.querySelector('[data-jill-phone-number]');
    if (!select || !input) return;
    field.dataset.jillPhoneReady = 'true';

    countries.forEach((country) => {
      const option = document.createElement('option');
      option.value = country.iso;
      option.textContent = `${flag(country.iso)} ${country.dial ? `+${country.dial}` : 'Intl'}`;
      option.title = `${country.name}${country.dial ? ` +${country.dial}` : ''}`;
      select.append(option);
    });

    const requested = String(field.dataset.defaultCountry || 'US').toUpperCase();
    select.value = byIso.has(requested) ? requested : 'US';
    input.addEventListener('input', () => sync(field));
    input.addEventListener('blur', () => validate(field));
    select.addEventListener('change', () => {
      sync(field);
      input.focus({preventScroll: true});
    });
    sync(field);
  }

  function phoneField(scope) {
    if (!scope) return null;
    if (scope.matches?.('[data-jill-phone-field]')) return scope;
    return scope.querySelector?.('[data-jill-phone-field]') || null;
  }

  function getPhoneValue(scope) {
    const field = phoneField(scope);
    if (!field) return '';
    const country = currentCountry(field);
    const digits = nationalDigits(field, country);
    if (!digits) return '';
    return country.dial ? `+${country.dial}${digits}` : `+${digits}`;
  }

  function initializeWithin(scope) {
    scope.querySelectorAll?.('[data-jill-phone-field]').forEach(configure);
    if (scope.matches?.('[data-jill-phone-field]')) configure(scope);
  }

  if (typeof document !== 'undefined') {
    initializeWithin(document);
    document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
  }

  Object.defineProperty(globalThis, 'JILLEmailValidation', {
    value: Object.freeze({countries, configure, getPhoneValue, setPhoneValue, validate}),
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
''')

runtime = RUNTIME.read_text()
old_phone_request = "        phone: readNamed(customer, 'phone') || undefined,"
new_phone_request = "        phone: globalThis.JILLEmailValidation?.getPhoneValue(customer) || readNamed(customer, 'phone') || undefined,"
if old_phone_request not in runtime:
    raise SystemExit('Normalized phone request anchor not found')
runtime = runtime.replace(old_phone_request, new_phone_request, 1)

old_phone_required = '''  function syncPhoneRequirement(root) {
    const customer = root.querySelector('[data-jill-custom-order-customer]');
    const pref = customer?.querySelector('[name="preferred_contact"]');
    const phone = customer?.querySelector('[name="phone"]');
    if (!pref || !phone) return;
    const required = pref.value === 'phone';
    phone.required = required;
    const mark = phone.closest('.jill-field')?.querySelector('.jill-field__required');
    if (mark) mark.hidden = !required;
  }
'''
new_phone_required = '''  function syncPhoneRequirement(root) {
    const customer = root.querySelector('[data-jill-custom-order-customer]');
    const pref = customer?.querySelector('[name="preferred_contact"]');
    const phoneField = customer?.querySelector('[data-jill-phone-field]');
    const phone = phoneField?.querySelector('[data-jill-phone-number]');
    if (!pref || !phone) return;
    phone.required = pref.value === 'phone';
    globalThis.JILLEmailValidation?.validate(phoneField);
  }
'''
if old_phone_required not in runtime:
    raise SystemExit('Phone requirement anchor not found')
runtime = runtime.replace(old_phone_required, new_phone_required, 1)

old_date = '''  function syncNeededDate(root) {
    const planning = root.querySelector('[data-jill-custom-order-planning]');
    const needDate = planning?.querySelector('[name="date_needed"]');
    if (!needDate) return;
    const today = todayLocal();
    const earliestNeedDate = addBusinessDays(today, 12);
    needDate.min = earliestNeedDate;
    const tooSoon = Boolean(needDate.value && needDate.value < earliestNeedDate);
    needDate.setCustomValidity(
      tooSoon ? 'The date you need it must be at least 12 business days from today.' : '',
    );
  }
'''
new_date = '''  function syncNeededDate(root) {
    const planning = root.querySelector('[data-jill-custom-order-planning]');
    const needDate = planning?.querySelector('[name="date_needed"]');
    if (!needDate) return;
    const today = todayLocal();
    const earliestNeedDate = addBusinessDays(today, 12);
    needDate.min = earliestNeedDate;
    if (!needDate.value || needDate.value < earliestNeedDate) needDate.value = earliestNeedDate;
    needDate.setCustomValidity('');
  }
'''
if old_date not in runtime:
    raise SystemExit('Date-needed anchor not found')
runtime = runtime.replace(old_date, new_date, 1)

progress_anchor = '''  function syncProgression(root) {
    syncPhoneRequirement(root);'''
prefill_function = '''  function applyLoggedInCustomerPrefill(root) {
    if (root.dataset.customerLoggedIn !== 'true') return false;
    const customer = root.querySelector('[data-jill-custom-order-customer]');
    if (!customer) return false;
    const name = customer.querySelector('[name="name"]');
    const email = customer.querySelector('[name="email"]');
    const phone = customer.querySelector('[data-jill-phone-number]');
    if (name && !name.value.trim() && root.dataset.customerName) name.value = root.dataset.customerName;
    if (email && !email.value.trim() && root.dataset.customerEmail) email.value = root.dataset.customerEmail;
    if (phone && !phone.value.trim() && root.dataset.customerPhone) {
      globalThis.JILLEmailValidation?.setPhoneValue(customer, root.dataset.customerPhone);
    }
    return true;
  }

'''
if progress_anchor not in runtime:
    raise SystemExit('Progression anchor not found')
runtime = runtime.replace(progress_anchor, prefill_function + progress_anchor, 1)

init_anchor = '''    applyCatalogPrefill(root);
    if (root.dataset.jillCustomOrderPrefilled === 'true') syncProductVisibility(root);
    renderPersonalization(root);'''
init_replacement = '''    applyLoggedInCustomerPrefill(root);
    applyCatalogPrefill(root);
    if (root.dataset.jillCustomOrderPrefilled === 'true') syncProductVisibility(root);
    renderPersonalization(root);'''
if init_anchor not in runtime:
    raise SystemExit('Custom Order initialization anchor not found')
runtime = runtime.replace(init_anchor, init_replacement, 1)

old_submit = '''  async function submitRequest(root, request) {
    const endpoint = String(root.dataset.submitEndpoint || '').trim();
    if (!endpoint) fail('submission is temporarily unavailable');
    const body = new URLSearchParams();
    Object.entries(endpointPayload(request)).forEach(([key, value]) => body.set(key, String(value ?? '')));
    await fetch(endpoint, {method: 'POST', mode: 'no-cors', keepalive: true, body});
  }
'''
new_submit = '''  function ownerNotificationBody(request) {
    const payload = endpointPayload(request);
    const location = [payload.city, payload.state, payload.zip].filter(Boolean).join(', ');
    return [
      'New JILL Custom Order Request',
      '',
      `Submission ID: ${payload.submission_id}`,
      `Submitted: ${payload.submitted_at}`,
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      `Phone: ${payload.phone || '—'}`,
      `Preferred contact: ${payload.preferred_contact || '—'}`,
      `Order type: ${payload.order_type || '—'}`,
      `Date needed: ${payload.date_needed || '—'}`,
      `Fulfillment: ${payload.fulfillment || '—'}`,
      `Location: ${location || '—'}`,
      `Collections: ${payload.collections || '—'}`,
      '',
      'Products:',
      payload.products || '—',
      '',
      `Theme: ${payload.theme || '—'}`,
      `Colors: ${payload.colors || '—'}`,
      `Personalization: ${payload.personalization || '—'}`,
      `Reference images: ${payload.reference_images || 'No'}`,
      'Reference links:',
      payload.reference_image_links || 'None',
      `Reference instructions: ${payload.reference_instructions || '—'}`,
      `Budget: ${payload.budget || '—'}`,
      `Priority: ${payload.priority || '—'}`,
      `Recommend matching items: ${payload.recommend_matching || '—'}`,
      `Notes: ${payload.notes || '—'}`,
      `Marketing consent: ${payload.marketing_consent || 'No'}`,
    ].join('\\n');
  }

  async function submitOwnerNotification(root, request) {
    const ownerNotification = root.querySelector('[data-jill-owner-notification]');
    const form = ownerNotification?.querySelector('form');
    const name = form?.querySelector('[name="contact[name]"]');
    const email = form?.querySelector('[name="contact[email]"]');
    const body = form?.querySelector('[name="contact[body]"]');
    if (!form || !name || !email || !body) fail('store notification is temporarily unavailable');
    name.value = request.customer.name || 'Custom Order Request';
    email.value = request.customer.email || '';
    body.value = ownerNotificationBody(request);
    const response = await fetch(form.action, {method: 'POST', credentials: 'same-origin', body: new FormData(form)});
    if (!response.ok) fail('store notification could not be delivered');
  }

  async function submitRequest(root, request) {
    const endpoint = String(root.dataset.submitEndpoint || '').trim();
    if (!endpoint) fail('submission is temporarily unavailable');
    const body = new URLSearchParams();
    Object.entries(endpointPayload(request)).forEach(([key, value]) => body.set(key, String(value ?? '')));
    await fetch(endpoint, {method: 'POST', mode: 'no-cors', keepalive: true, body});
    await submitOwnerNotification(root, request);
  }
'''
if old_submit not in runtime:
    raise SystemExit('Custom Order submitRequest anchor not found')
runtime = runtime.replace(old_submit, new_submit, 1)
RUNTIME.write_text(runtime)

forms = FORMS.read_text()
planning_anchor = '''  .jill-custom-order__planning {
    display: grid;'''
phone_date_css = '''  .jill-phone-field__control {
    display: grid;
    grid-template-columns: minmax(6.75rem, 7.75rem) minmax(0, 1fr);
    gap: var(--jill-space-unit);
    min-width: 0;
  }

  .jill-phone-field__country,
  .jill-phone-field__number {
    min-width: 0;
    max-width: 100%;
  }

  .jill-phone-field__country {
    padding-inline: calc(var(--jill-space-unit) * 1.25);
  }

  .jill-custom-order[data-jill-custom-order] .jill-custom-order__planning input[type='date'].jill-field__control {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    font-size: 1rem;
  }

'''
if phone_date_css not in forms:
    if planning_anchor not in forms:
        raise SystemExit('Forms planning CSS anchor not found')
    forms = forms.replace(planning_anchor, phone_date_css + planning_anchor, 1)
FORMS.write_text(forms)

layout = LAYOUT.read_text()
layout_anchor = '''    {% if is_custom_order_template %}
      <script src="{{ 'jill-variant-allocation.js' | asset_url }}" defer></script>
      <script src="{{ 'jill-custom-order.js' | asset_url }}" defer></script>'''
layout_replacement = '''    {% if is_custom_order_template %}
      <script src="{{ 'jill-variant-allocation.js' | asset_url }}" defer></script>
      <script src="{{ 'jill-email-validation.js' | asset_url }}" defer></script>
      <script src="{{ 'jill-custom-order.js' | asset_url }}" defer></script>'''
if layout_anchor not in layout:
    raise SystemExit('Custom Order script load anchor not found')
layout = layout.replace(layout_anchor, layout_replacement, 1)
LAYOUT.write_text(layout)

tests = TESTS.read_text()
read_anchor = "const runtime = fs.readFileSync('theme/assets/jill-custom-order.js', 'utf8');"
read_replacement = read_anchor + "\nconst emailValidation = fs.readFileSync('theme/assets/jill-email-validation.js', 'utf8');"
if read_anchor not in tests:
    raise SystemExit('Custom Order test runtime read anchor not found')
if "const emailValidation =" not in tests:
    tests = tests.replace(read_anchor, read_replacement, 1)

assertions = r'''
assert.match(section, /https:\/\/script\.google\.com\/macros\/s\/AKfycbwjFDQxhjc4RDu8T0gSweQf70Y5TheTyWZ6KoVDux6Hx-Ue9jdE7E5Enl5nyxjJpo2W\/exec/, 'Custom Order must retain the canonical Apps Script deployment');
assert.doesNotMatch(section, /AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/, 'Custom Order must not use the dead Apps Script deployment');
assert.match(section, /data-jill-owner-notification/, 'Custom Order must retain the native Shopify owner-notification lane');
assert.match(runtime, /function ownerNotificationBody[\s\S]*endpointPayload\(request\)/, 'merchant notification must derive from the normalized request payload');
assert.match(runtime, /function submitOwnerNotification/, 'Custom Order must own one merchant-notification submit path');
assert.match(runtime, /await submitOwnerNotification\(root, request\)/, 'Custom Order success must wait for the merchant notification submission');
assert.match(section, /data-jill-review-gate/, 'Review action must remain visible outside progressively gated form stages');
assert.ok(section.indexOf('data-jill-review-gate') > section.indexOf('data-jill-stage="final"'), 'persistent Review action must follow the form stages');
assert.match(runtime, /function firstReviewIssue\(\)/, 'Review must keep one canonical first-missing-field resolver');
assert.match(runtime, /scrollToTarget\(issue\)/, 'Review validation must return the user to the first missing required field');
assert.match(runtime, /if \(!needDate\.value \|\| needDate\.value < earliestNeedDate\) needDate\.value = earliestNeedDate;/, 'Date Needed must display and restore the first available business-day date');
assert.match(formsCss, /input\[type='date'\]\.jill-field__control[\s\S]*min-inline-size: 0;[\s\S]*max-inline-size: 100%;/, 'mobile-safe date input must not overflow its field');
assert.match(section, /data-jill-phone-field[\s\S]*data-default-country="\{\{ localization\.country\.iso_code/, 'phone input must initialize from Shopify localization country');
assert.match(section, /data-jill-phone-country/, 'phone input must expose a country/flag dial-code selector');
assert.match(layout, /jill-email-validation\.js[\s\S]*jill-custom-order\.js/, 'shared phone validation must load before Custom Order runtime');
assert.match(emailValidation, /United States[\s\S]*Canada[\s\S]*Colombia[\s\S]*France[\s\S]*India[\s\S]*China/, 'shared phone owner must preserve country-aware rules');
assert.match(emailValidation, /function getPhoneValue/, 'shared phone owner must normalize the submitted phone value');
assert.match(runtime, /JILLEmailValidation\?\.getPhoneValue\(customer\)/, 'normalized request must use the shared international phone value');
assert.match(section, /data-customer-logged-in="\{% if customer %\}true/, 'Custom Order must expose a server-rendered logged-in customer snapshot');
assert.match(section, /data-customer-name="\{% if customer %\}\{\{ customer\.name/, 'logged-in customer name must come from Shopify customer truth');
assert.match(section, /data-customer-email="\{% if customer %\}\{\{ customer\.email/, 'logged-in customer email must come from Shopify customer truth');
assert.match(runtime, /function applyLoggedInCustomerPrefill/, 'Custom Order must own one logged-in customer prefill path');
assert.match(runtime, /applyLoggedInCustomerPrefill\(root\);[\s\S]*applyCatalogPrefill\(root\);/, 'customer prefill and Catalog prefill must coexist in initialization order');
assert.doesNotMatch(runtime, /preferred_contact[^\n]*=.*customer/, 'logged-in customer prefill must not silently choose a preferred contact method');
'''
marker = "console.log('JILL Custom Order LIVE-parity integration tests passed.');"
if assertions.strip() not in tests:
    if marker not in tests:
        raise SystemExit('Custom Order test completion marker not found')
    tests = tests.replace(marker, assertions + '\n' + marker, 1)
TESTS.write_text(tests)
