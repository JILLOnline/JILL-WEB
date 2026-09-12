(() => {
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
