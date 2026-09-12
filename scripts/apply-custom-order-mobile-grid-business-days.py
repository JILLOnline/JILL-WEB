from pathlib import Path
import re

FORMS = Path('theme/assets/jill-forms.css')
RUNTIME = Path('theme/assets/jill-custom-order.js')
TEST = Path('scripts/test-custom-order-integration.mjs')


def sub_once(path, label, pattern, replacement, flags=0):
    text = path.read_text()
    next_text, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=flags)
    print(f'{label}: {count}')
    if count != 1:
        raise SystemExit(f'{path}: {label} expected 1 match, found {count}')
    path.write_text(next_text)


def replace_once(path, label, old, new):
    text = path.read_text()
    count = text.count(old)
    print(f'{label}: {count}')
    if count != 1:
        raise SystemExit(f'{path}: {label} expected 1 match, found {count}')
    path.write_text(text.replace(old, new, 1))


sub_once(
    FORMS,
    'consolidate hidden controls',
    r'''  \.jill-custom-order__choice input,\n  \.jill-custom-order__collection-choice input,\n  \.jill-custom-order-product__pick input \{\n(?:    .*\n)+?  \}''',
    '''  .jill-custom-order__choice input,
  .jill-custom-order__collection-choice input,
  .jill-custom-order-product__pick input,
  .jill-media__input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    border: 0;
    opacity: 0;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }''',
)

sub_once(
    FORMS,
    'remove duplicate media hidden rule',
    r'''\n  \.jill-media__input \{\n(?:    .*\n)+?  \}\n''',
    '\n',
)

sub_once(
    FORMS,
    'replace selector indicator primitive',
    r'''  \.jill-custom-order__choice span::before,\n  \.jill-custom-order__collection-choice span::before,\n  \.jill-custom-order-product__pick span::before \{\n(?:    .*\n)+?  \}''',
    '''  .jill-custom-order__choice span::before,
  .jill-custom-order__collection-choice span::before,
  .jill-custom-order-product__pick span::before {
    content: '';
    box-sizing: border-box;
    width: 0.9rem;
    height: 0.9rem;
    flex: 0 0 0.9rem;
    border: calc(var(--jill-border-width) * 1.5) solid currentColor;
    border-radius: 999px;
    background-color: transparent;
    background-image: none;
  }''',
)

sub_once(
    FORMS,
    'replace checked selector paint',
    r'''  \.jill-custom-order__choice input:checked \+ span::before,\n  \.jill-custom-order__collection-choice input:checked \+ span::before,\n  \.jill-custom-order-product__pick input:checked \+ span::before \{\n(?:    .*\n)+?  \}''',
    '''  .jill-custom-order__choice input:checked + span::before,
  .jill-custom-order__collection-choice input:checked + span::before,
  .jill-custom-order-product__pick input:checked + span::before {
    background-image: radial-gradient(circle, currentColor 0 0.2rem, transparent 0.21rem);
  }''',
)

sub_once(
    FORMS,
    'bound Section 5 planning grid',
    r'''  \.jill-custom-order__planning \{\n    display: grid;\n    grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);\n    gap: calc\(var\(--jill-space-unit\) \* 2\.5\);\n  \}''',
    '''  .jill-custom-order__planning {
    display: grid;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(var(--jill-space-unit) * 2.5);
  }''',
)

sub_once(
    FORMS,
    'remove planning from generic mobile collapse',
    r'''    \.jill-custom-order\[data-jill-custom-order\] \.jill-custom-order__planning,\n''',
    '',
)

sub_once(
    FORMS,
    'add zero-minimum mobile planning track',
    r'''  @media \(max-width: 749px\) \{\n''',
    '''  @media (max-width: 749px) {
    .jill-custom-order[data-jill-custom-order] .jill-custom-order__planning {
      grid-template-columns: minmax(0, 1fr);
    }

''',
)

sub_once(
    RUNTIME,
    'add business-day calculator',
    r'''  function todayLocal\(\) \{\n    const now = new Date\(\);\n    const offset = now\.getTimezoneOffset\(\);\n    return new Date\(now\.getTime\(\) - offset \* 60000\)\.toISOString\(\)\.slice\(0, 10\);\n  \}\n''',
    '''  function todayLocal() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function addBusinessDays(value, count) {
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    let remaining = Math.max(0, Math.trunc(Number(count) || 0));
    while (remaining > 0) {
      date.setDate(date.getDate() + 1);
      const weekday = date.getDay();
      if (weekday !== 0 && weekday !== 6) remaining -= 1;
    }
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
''',
)

sub_once(
    RUNTIME,
    'replace date synchronization contract',
    r'''  function syncDates\(root\) \{[\s\S]*?\n  \}\n\n  function syncShipping\(root\) \{''',
    '''  function syncDates(root) {
    const planning = root.querySelector('[data-jill-custom-order-planning]');
    const eventDate = planning?.querySelector('[name="event_date"]');
    const needDate = planning?.querySelector('[name="date_needed"]');
    if (!eventDate || !needDate) return;
    const today = todayLocal();
    const earliestNeedDate = addBusinessDays(today, 12);
    eventDate.min = today;
    needDate.min = earliestNeedDate;
    needDate.max = eventDate.value || '';
    const tooSoon = Boolean(needDate.value && needDate.value < earliestNeedDate);
    const afterEvent = Boolean(eventDate.value && needDate.value && needDate.value > eventDate.value);
    needDate.setCustomValidity(
      tooSoon
        ? 'The date you need it must be at least 12 business days from today.'
        : afterEvent
          ? 'The date you need it cannot be after the event date.'
          : '',
    );
  }

  function syncShipping(root) {''',
)

replace_once(
    TEST,
    'replace selector circle assertion',
    r'''assert.match(formsCss, /input:checked \+ span::before[\s\S]*background-color: currentColor/, 'selector circles must visibly fill without resetting the content-box clip');''',
    r'''assert.match(formsCss, /input:checked \+ span::before[\s\S]*radial-gradient\(circle, currentColor/, 'selector circles must render an explicit checked inner dot');
assert.match(formsCss, /jill-custom-order__choice input,[\s\S]*jill-media__input[\s\S]*opacity: 0;[\s\S]*clip-path: inset\(50%\)/, 'button-style native choices must stay visually suppressed beneath the custom indicator');
assert.doesNotMatch(formsCss, /background-clip: content-box/, 'selector circles must not depend on content-box background clipping');''',
)

replace_once(
    TEST,
    'extend mobile field assertions',
    r'''assert.match(formsCss, /\.jill-custom-order \.jill-field,[\s\S]*\.jill-custom-order \.jill-field__control[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/, 'Custom Order fields must shrink within mobile containers');''',
    r'''assert.match(formsCss, /\.jill-custom-order \.jill-field,[\s\S]*\.jill-custom-order \.jill-field__control[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/, 'Custom Order fields must shrink within mobile containers');
assert.match(formsCss, /\.jill-custom-order__planning \{[\s\S]*min-width: 0;[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'Section 5 planning grid must own a zero intrinsic minimum');
assert.match(formsCss, /@media \(max-width: 749px\)[\s\S]*\.jill-custom-order__planning \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, 'Section 5 mobile planning must preserve a zero-minimum track so native date controls cannot widen the card');''',
)

replace_once(
    TEST,
    'replace rejected date guard',
    r'''assert.match(runtime, /needDate\.setCustomValidity/, 'date needed must be constrained against the event date');
assert.doesNotMatch(runtime, /addBusinessDays|12 business/i, 'LIVE parity must not reintroduce the rejected 12-business-day rule');''',
    r'''assert.match(runtime, /function addBusinessDays/, 'date needed must use one canonical business-day calculator');
assert.match(runtime, /addBusinessDays\(today, 12\)/, 'date needed must enforce a 12-business-day lead time from the local current date');
assert.match(runtime, /needDate\.min = earliestNeedDate/, 'date needed must expose the 12-business-day minimum to the native date picker');
assert.match(runtime, /12 business days from today/, 'date needed must explain the lead-time validation when an early value is injected');
assert.match(runtime, /needDate\.setCustomValidity/, 'date needed must enforce both lead time and event-date ordering');''',
)

print('Custom Order mobile/grid/date transformation complete.')
