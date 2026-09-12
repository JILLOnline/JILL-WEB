from pathlib import Path

path = Path('theme/assets/jill-forms.css')
css = path.read_text(encoding='utf-8')


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return source.replace(old, new, 1)


css = replace_once(
    css,
    """  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__hero,
  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__card,
  .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__consent-card {
""",
    """  .jill-custom-order[data-jill-custom-order] :is(
    .jill-custom-order-review__hero,
    .jill-custom-order-review__card,
    .jill-custom-order-review__consent-card
  ) {
""",
    'Review surface selector group',
)

css = replace_once(
    css,
    """  .jill-custom-order-review__collection-title,
  .jill-custom-order-review__item-title,
  .jill-custom-order-review__subgroup-title {
    margin: 0;
  }
""",
    """  .jill-custom-order-review :is(
    .jill-custom-order-review__collection-title,
    .jill-custom-order-review__item-title,
    .jill-custom-order-review__subgroup-title
  ) {
    margin: 0;
  }
""",
    'Review title reset selector group',
)

mobile_replacements = [
    (
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order__review {
      padding-inline: 1rem;
      gap: calc(var(--jill-space-unit) * 2);
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order__review[data-jill-custom-order-review] {
      padding-inline: 1rem;
      gap: calc(var(--jill-space-unit) * 2);
    }
""",
        'mobile Review shell',
    ),
    (
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__hero {
      align-items: flex-start;
      gap: calc(var(--jill-space-unit) * 1.25);
      padding: calc(var(--jill-space-unit) * 2);
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order__review .jill-custom-order-review__hero {
      align-items: flex-start;
      gap: calc(var(--jill-space-unit) * 1.25);
      padding: calc(var(--jill-space-unit) * 2);
    }
""",
        'mobile Review hero',
    ),
    (
        """    .jill-custom-order-review__hero-icon {
      width: 2.875rem;
      height: 2.875rem;
      font-size: 1.25rem;
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__hero-icon {
      width: 2.875rem;
      height: 2.875rem;
      font-size: 1.25rem;
    }
""",
        'mobile Review hero icon',
    ),
    (
        """    .jill-custom-order-review__hero-copy h2 {
      font-size: clamp(1.45rem, 7vw, 1.625rem);
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__hero-copy h2 {
      font-size: clamp(1.45rem, 7vw, 1.625rem);
    }
""",
        'mobile Review hero title',
    ),
    (
        """    .jill-custom-order-review__summary-item,
    .jill-custom-order-review__summary-item:first-child,
    .jill-custom-order-review__summary-item:last-child {
      padding: calc(var(--jill-space-unit) * 1.15) 0;
    }
""",
        """    .jill-custom-order[data-jill-custom-order] :is(
      .jill-custom-order-review__summary-item,
      .jill-custom-order-review__summary-item:first-child,
      .jill-custom-order-review__summary-item:last-child
    ) {
      padding: calc(var(--jill-space-unit) * 1.15) 0;
    }
""",
        'mobile Review summary item group',
    ),
    (
        """    .jill-custom-order-review__summary-item:first-child {
      padding-block-start: 0;
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__summary-item:first-child {
      padding-block-start: 0;
    }
""",
        'mobile Review first summary item',
    ),
    (
        """    .jill-custom-order-review__summary-item:last-child {
      padding-block-end: 0;
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__summary-item:last-child {
      padding-block-end: 0;
    }
""",
        'mobile Review last summary item',
    ),
    (
        """    .jill-custom-order-review__summary-item + .jill-custom-order-review__summary-item {
      border-inline-start: 0;
      border-block-start: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-foreground) 12%, transparent);
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__summary-item + .jill-custom-order-review__summary-item {
      border-inline-start: 0;
      border-block-start: var(--jill-border-width) solid color-mix(in srgb, var(--jill-color-foreground) 12%, transparent);
    }
""",
        'mobile Review summary divider',
    ),
    (
        """    .jill-custom-order-review__collection-head,
    .jill-custom-order-review__item-head {
      align-items: flex-start;
      flex-wrap: wrap;
    }
""",
        """    .jill-custom-order[data-jill-custom-order] :is(
      .jill-custom-order-review__collection-head,
      .jill-custom-order-review__item-head
    ) {
      align-items: flex-start;
      flex-wrap: wrap;
    }
""",
        'mobile Review collection/item heading group',
    ),
    (
        """    .jill-custom-order-review__status {
      white-space: normal;
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__status {
      white-space: normal;
    }
""",
        'mobile Review status pill',
    ),
    (
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__consent-card {
      grid-template-columns: 2.625rem 1.25rem minmax(0, 1fr);
      padding: calc(var(--jill-space-unit) * 1.35);
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order__review .jill-custom-order-review__consent-card {
      grid-template-columns: 2.625rem 1.25rem minmax(0, 1fr);
      padding: calc(var(--jill-space-unit) * 1.35);
    }
""",
        'mobile Review consent card',
    ),
    (
        """    .jill-custom-order-review__consent-line {
      display: grid;
      justify-content: stretch;
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__consent-line {
      display: grid;
      justify-content: stretch;
    }
""",
        'mobile Review consent line',
    ),
    (
        """    .jill-custom-order-review__optional {
      justify-self: start;
    }
""",
        """    .jill-custom-order[data-jill-custom-order] .jill-custom-order-review__optional {
      justify-self: start;
    }
""",
        'mobile Review optional pill',
    ),
]

for old, new, label in mobile_replacements:
    css = replace_once(css, old, new, label)

path.write_text(css, encoding='utf-8')
print('Custom Order Review selector ownership consolidated across desktop and mobile.')
