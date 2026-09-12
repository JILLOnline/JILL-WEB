from pathlib import Path

css_path = Path('theme/assets/jill-forms.css')
section_path = Path('theme/sections/main-custom-order.liquid')
phone_path = Path('theme/assets/jill-email-validation.js')
test_path = Path('scripts/test-custom-order-integration.mjs')

css = css_path.read_text()
old = """  .jill-phone-field__country,
  .jill-phone-field__number {
    min-width: 0;
    max-width: 100%;
  }

  .jill-phone-field__country {
    padding-inline: calc(var(--jill-space-unit) * 1.25);
  }
"""
new = """  .jill-phone-field__control > .jill-field__control {
    min-width: 0;
    max-width: 100%;
  }

  .jill-phone-field__country-shell {
    position: relative;
    display: grid;
    grid-template-columns: 1.5rem minmax(2.75rem, auto) 1rem;
    align-items: center;
    gap: calc(var(--jill-space-unit) * 0.75);
    min-width: 0;
    max-width: 100%;
    min-height: var(--jill-field-height);
    padding-inline: calc(var(--jill-space-unit) * 1.25);
    border: var(--jill-border-width) solid var(--jill-color-border);
    border-radius: var(--jill-field-radius);
    background: var(--jill-color-background);
    color: var(--jill-color-foreground);
  }

  .jill-phone-field__flag {
    display: block;
    width: 1.5rem;
    height: 1rem;
    border-radius: 0.125rem;
    object-fit: cover;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--jill-color-foreground) 12%, transparent);
  }

  .jill-phone-field__dial {
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .jill-phone-field__chevron {
    width: 0.75rem;
    height: 0.75rem;
    border-inline-end: 0.125rem solid currentColor;
    border-block-end: 0.125rem solid currentColor;
    transform: rotate(45deg) translateY(-0.125rem);
    transform-origin: center;
  }

  .jill-phone-field__country {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
    opacity: 0;
  }
"""
if old not in css:
    raise SystemExit('phone CSS ownership anchor not found')
css_path.write_text(css.replace(old, new, 1))

section = section_path.read_text()
old = '<select class="jill-field__control jill-phone-field__country" data-jill-phone-country aria-label="Phone country code"></select>'
new = '''<div class="jill-phone-field__country-shell">
              <img class="jill-phone-field__flag" data-jill-phone-flag alt="" width="24" height="16">
              <span class="jill-phone-field__dial" data-jill-phone-dial aria-hidden="true"></span>
              <span class="jill-phone-field__chevron" aria-hidden="true"></span>
              <select class="jill-phone-field__country" data-jill-phone-country aria-label="Phone country code"></select>
            </div>'''
if old not in section:
    raise SystemExit('phone country select anchor not found')
section_path.write_text(section.replace(old, new, 1))

phone = phone_path.read_text()
old_flag = """  function flag(iso) {
    if (!/^[A-Z]{2}$/.test(iso)) return '🌐';
    return String.fromCodePoint(...iso.split('').map((letter) => 127397 + letter.charCodeAt(0)));
  }
"""
new_flag = """  function flagUrl(iso) {
    if (!/^[A-Z]{2}$/.test(iso)) return '';
    return `https://flagcdn.com/${iso.toLowerCase()}.svg`;
  }
"""
if old_flag not in phone:
    raise SystemExit('emoji flag helper anchor not found')
phone = phone.replace(old_flag, new_flag, 1)

old_validate = """    const help = field.querySelector('[data-jill-phone-help]');
    if (help) help.textContent = message || `${flag(country.iso)} ${country.dial ? `+${country.dial}` : ''} ${country.name}`.trim();
    return !message;
"""
new_validate = """    const help = field.querySelector('[data-jill-phone-help]');
    if (help) help.textContent = message || `${country.dial ? `+${country.dial} · ` : ''}${country.name}`;
    return !message;
"""
if old_validate not in phone:
    raise SystemExit('phone validation flag anchor not found')
phone = phone.replace(old_validate, new_validate, 1)

old_sync = """    input.value = formatNational(country, digits);
    input.placeholder = country.placeholder;
    input.maxLength = Math.max(country.placeholder.length + 3, formatNational(country, '9'.repeat(country.max)).length);
    input.setAttribute('aria-label', `${country.name} phone number`);
    validate(field);
"""
new_sync = """    input.value = formatNational(country, digits);
    input.placeholder = country.placeholder;
    input.maxLength = Math.max(country.placeholder.length + 3, formatNational(country, '9'.repeat(country.max)).length);
    input.setAttribute('aria-label', `${country.name} phone number`);
    const flag = field.querySelector('[data-jill-phone-flag]');
    const dial = field.querySelector('[data-jill-phone-dial]');
    if (flag) {
      const source = flagUrl(country.iso);
      flag.hidden = !source;
      if (source) flag.src = source;
    }
    if (dial) dial.textContent = country.dial ? `+${country.dial}` : 'Intl';
    validate(field);
"""
if old_sync not in phone:
    raise SystemExit('phone sync anchor not found')
phone = phone.replace(old_sync, new_sync, 1)

old_option = """      option.value = country.iso;
      option.textContent = `${flag(country.iso)} ${country.dial ? `+${country.dial}` : 'Intl'}`;
      option.title = `${country.name}${country.dial ? ` +${country.dial}` : ''}`;
"""
new_option = """      option.value = country.iso;
      option.textContent = `${country.name}${country.dial ? ` (+${country.dial})` : ''}`;
      option.title = option.textContent;
"""
if old_option not in phone:
    raise SystemExit('phone option flag anchor not found')
phone_path.write_text(phone.replace(old_option, new_option, 1))

tests = test_path.read_text()
marker = "assert.match(emailValidation, /function getPhoneValue/, 'shared phone owner must normalize the submitted phone value');"
additions = """assert.match(emailValidation, /flagcdn\\.com\\/\\$\\{iso\\.toLowerCase\\(\\)\\}\\.svg/, 'country selector must render full-color SVG flag assets');
assert.doesNotMatch(emailValidation, /String\\.fromCodePoint|127397/, 'country selector must not fall back to emoji flags');
assert.match(section, /data-jill-phone-flag/, 'phone country control must expose the visible SVG flag surface');
assert.match(formsCss, /jill-phone-field__country-shell/, 'phone country SVG surface must have one canonical layout owner');
"""
if marker not in tests:
    raise SystemExit('phone integration guard anchor not found')
if 'country selector must render full-color SVG flag assets' not in tests:
    tests = tests.replace(marker, marker + '\n' + additions, 1)
test_path.write_text(tests)
