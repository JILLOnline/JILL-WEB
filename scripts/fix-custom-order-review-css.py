from pathlib import Path

path = Path('theme/assets/jill-forms.css')
css = path.read_text(encoding='utf-8')
old = """  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__hero,\n  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__card,\n  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__consent-card {\n"""
new = """  .jill-custom-order[data-jill-custom-order] :is(\n    .jill-custom-order-review__hero,\n    .jill-custom-order-review__card,\n    .jill-custom-order-review__consent-card\n  ) {\n"""
if css.count(old) != 1:
    raise RuntimeError(f'Expected one Review surface selector group, found {css.count(old)}')
path.write_text(css.replace(old, new, 1), encoding='utf-8')
print('Review surface selector ownership consolidated.')
