from pathlib import Path

SECTION = Path('theme/sections/main-custom-order.liquid')
LOCALE = Path('theme/locales/en.default.json')
RUNTIME = Path('theme/assets/jill-custom-order.js')
SCHEMA = Path('contracts/custom-order-api.schema.json')
TEST = Path('scripts/test-custom-order-integration.mjs')


def replace_once(path, old, new, label):
    text = path.read_text()
    count = text.count(old)
    print(f'{label}: {count}')
    if count != 1:
        raise SystemExit(f'{path}: {label} expected 1 match, found {count}')
    path.write_text(text.replace(old, new, 1))


replace_once(
    SECTION,
    "  assign event_date_label = 'custom_order.planning.event_date' | t\n",
    "",
    'remove event date label assignment',
)
replace_once(
    SECTION,
    "        {% render 'ui-field', id: 'JillCustomOrderEventDate', name: 'event_date', label: event_date_label, type: 'date', optional_label: optional_label %}\n",
    "",
    'remove event date field',
)

replace_once(
    LOCALE,
    '      "help": "Tell us the event date, when you need it, and how you will get it.",\n      "event_date": "Event date",\n',
    '      "help": "Tell us when you need your order and how you’ll receive it.",\n',
    'replace planning help and remove event date locale',
)

replace_once(
    RUNTIME,
    "        event_date: readNamed(planning, 'event_date') || undefined,\n",
    "",
    'remove normalized event date',
)
replace_once(
    RUNTIME,
    "      event_date: request.planning.event_date || '',\n",
    "",
    'remove legacy transport event date',
)
replace_once(
    RUNTIME,
    '''  function syncDates(root) {\n    const planning = root.querySelector('[data-jill-custom-order-planning]');\n    const eventDate = planning?.querySelector('[name="event_date"]');\n    const needDate = planning?.querySelector('[name="date_needed"]');\n    if (!eventDate || !needDate) return;\n    const today = todayLocal();\n    const earliestNeedDate = addBusinessDays(today, 12);\n    eventDate.min = today;\n    needDate.min = earliestNeedDate;\n    needDate.max = eventDate.value || '';\n    const tooSoon = Boolean(needDate.value && needDate.value < earliestNeedDate);\n    const afterEvent = Boolean(eventDate.value && needDate.value && needDate.value > eventDate.value);\n    needDate.setCustomValidity(\n      tooSoon\n        ? 'The date you need it must be at least 12 business days from today.'\n        : afterEvent\n          ? 'The date you need it cannot be after the event date.'\n          : '',\n    );\n  }\n''',
    '''  function syncNeededDate(root) {\n    const planning = root.querySelector('[data-jill-custom-order-planning]');\n    const needDate = planning?.querySelector('[name="date_needed"]');\n    if (!needDate) return;\n    const earliestNeedDate = addBusinessDays(todayLocal(), 12);\n    needDate.min = earliestNeedDate;\n    const tooSoon = Boolean(needDate.value && needDate.value < earliestNeedDate);\n    needDate.setCustomValidity(\n      tooSoon ? 'The date you need it must be at least 12 business days from today.' : '',\n    );\n  }\n''',
    'replace date synchronization with needed-date owner',
)
replace_once(
    RUNTIME,
    '    syncDates(root);\n',
    '    syncNeededDate(root);\n',
    'rename progression date sync call',
)

replace_once(
    SCHEMA,
    '        "event_date": {"type": "string", "format": "date"},\n',
    '',
    'remove event date from API contract',
)

replace_once(
    TEST,
    "const layout = fs.readFileSync('theme/layout/theme.liquid', 'utf8');\n",
    "const layout = fs.readFileSync('theme/layout/theme.liquid', 'utf8');\nconst customOrderSchema = fs.readFileSync('contracts/custom-order-api.schema.json', 'utf8');\n",
    'load custom order API schema in integration guard',
)
replace_once(
    TEST,
    "assert.match(section, /data-jill-stage=\"planning\"/, 'LIVE parity must keep Event & fulfillment as Step 5');\n",
    "assert.match(section, /data-jill-stage=\"planning\"/, 'Custom Order must keep timing and fulfillment as Step 5');\nassert.doesNotMatch(section, /event_date|JillCustomOrderEventDate/, 'Custom Order must not ask for an event date');\n",
    'guard event date removal from Liquid',
)
replace_once(
    TEST,
    "assert.match(runtime, /needDate\\.setCustomValidity/, 'date needed must enforce both lead time and event-date ordering');\n",
    "assert.match(runtime, /needDate\\.setCustomValidity/, 'date needed must enforce the lead-time minimum');\nassert.doesNotMatch(runtime, /event_date|eventDate|after the event date/, 'Custom Order runtime must not retain event-date state or validation');\nassert.doesNotMatch(customOrderSchema, /event_date/, 'Custom Order API contract must not retain the removed event date');\n",
    'guard event date removal from runtime and contract',
)

for path in [SECTION, LOCALE, RUNTIME, SCHEMA]:
    if 'event_date' in path.read_text():
        raise SystemExit(f'{path}: event_date still present after removal')

print('Custom Order event date removed cleanly.')
