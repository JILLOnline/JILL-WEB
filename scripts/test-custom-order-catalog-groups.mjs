import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('theme/assets/jill-custom-order-catalog-groups.js', 'utf8');
const layout = fs.readFileSync('theme/layout/theme.liquid', 'utf8');
const titleSnippet = fs.readFileSync('theme/snippets/custom-order-item-title.liquid', 'utf8');

assert.match(runtime, /data-jill-collection-choice\]:checked/, 'Section 3 grouping must follow the collections selected in Step 2');
assert.match(runtime, /data-jill-product-choice/, 'Section 3 grouping must move the canonical product choice nodes');
assert.match(runtime, /collections\.find/, 'cross-listed products must resolve to one selected collection owner');
assert.match(runtime, /append\(choice\)/, 'grouping must move the existing product node rather than clone it');
assert.doesNotMatch(runtime, /cloneNode|innerHTML|MutationObserver/, 'grouping must not duplicate product cards or add observer/HTML patch architecture');
assert.doesNotMatch(runtime, /Piñata|Pinata|Snack|Apparel|Shirt|Hoodie|Mug|Tote/i, 'catalog grouping must remain product-family agnostic');

assert.match(layout, /jill-custom-order-catalog-groups\.js/, 'Custom Order must load the canonical Section 3 grouping owner');
assert.ok(
  layout.indexOf('jill-custom-order.js') < layout.indexOf('jill-custom-order-catalog-groups.js'),
  'catalog grouping must initialize after Custom Order selection/visibility state',
);

assert.match(titleSnippet, /contains ' Count'/, 'Custom Order labels must remove pack-count wording');
assert.match(titleSnippet, /contains ' Pieces'/, 'Custom Order labels must remove piece-count wording');
assert.match(titleSnippet, /replace: 'DTF '/, 'Custom Order labels must remove print-method wording');
assert.match(titleSnippet, /replace: 'Sublimation '/, 'Custom Order labels must remove sublimation method wording');
assert.match(titleSnippet, /replace: 'Vinyl '/, 'Custom Order labels must remove vinyl method wording');
assert.doesNotMatch(titleSnippet, /replace: ' Inch'/, 'physical size distinctions must not be stripped from product identity');

console.log('JILL Custom Order collection grouping tests passed.');
