from pathlib import Path

path = Path('theme/sections/main-custom-order.liquid')
source = path.read_text()
old_assign = "  assign date_needed_label = 'custom_order.planning.date_needed' | t\n"
new_assign = old_assign + "  assign date_needed_help = 'custom_order.planning.date_needed_help' | t\n"
if source.count(old_assign) != 1:
    raise SystemExit(f'expected one Date Needed label assignment, found {source.count(old_assign)}')
source = source.replace(old_assign, new_assign, 1)
old_render = "{% render 'ui-field', id: 'JillCustomOrderNeededDate', name: 'date_needed', label: date_needed_label, type: 'date', required: true, help: 'custom_order.planning.date_needed_help' | t %}"
new_render = "{% render 'ui-field', id: 'JillCustomOrderNeededDate', name: 'date_needed', label: date_needed_label, type: 'date', required: true, help: date_needed_help %}"
if source.count(old_render) != 1:
    raise SystemExit(f'expected one invalid Date Needed render, found {source.count(old_render)}')
path.write_text(source.replace(old_render, new_render, 1))
