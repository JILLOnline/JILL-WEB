import assert from 'node:assert/strict';
import fs from 'node:fs';

const formatter = fs.readFileSync('theme/snippets/custom-order-item-title.liquid', 'utf8');
const spec = fs.readFileSync('docs/CUSTOM_ORDER_ITEM_NAMING.md', 'utf8');

assert.match(formatter, /contains 'print'/, 'Custom Order labels must remove production-method wording');
assert.match(formatter, /contains 'photo'/, 'Custom Order labels must remove customization marketing wording');
assert.match(formatter, /contains 'includes '/, 'Custom Order labels must remove included-accessory wording generically');
assert.match(formatter, /clean_segment_size <= 1/, 'Custom Order labels must discard one-character suffix noise');
assert.match(formatter, /contains ' Count'/, 'Custom Order labels must remove pack-count wording');
assert.match(formatter, /contains ' Pieces'/, 'Custom Order labels must remove piece-count wording');
assert.doesNotMatch(formatter, /product\.handle|product\.id|case\s+product/i, 'Custom Order item naming must never branch on product identity');
assert.doesNotMatch(formatter, /replace: ' Inch'/, 'Custom Order item naming must preserve meaningful physical size distinctions');

assert.match(spec, /11 oz Mug – Print.*11 oz Mug/s, 'naming contract must document production-method removal');
assert.match(spec, /Tote Bag – Photo, Text & Design.*Tote Bag/s, 'naming contract must document customization-marketing removal');
assert.match(spec, /Coloring Books – s.*Coloring Books/s, 'naming contract must document suffix-noise removal');
assert.match(spec, /Piñata – 18 Inch – Includes Stick.*Piñata – 18 Inch/s, 'naming contract must document included-extra removal');
assert.match(spec, /Piñata – 13 Inch Round.*Piñata – 13 Inch Round/s, 'naming contract must preserve meaningful physical identity');

console.log('JILL Custom Order item naming contract tests passed.');
