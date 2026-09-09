import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync('theme/sections/main-custom-order.liquid', 'utf8');
const productSection = fs.readFileSync('theme/sections/main-product.liquid', 'utf8');
const runtime = fs.readFileSync('theme/assets/jill-custom-order.js', 'utf8');
const productRuntime = fs.readFileSync('theme/assets/jill-product.js', 'utf8');
const layout = fs.readFileSync('theme/layout/theme.liquid', 'utf8');

assert.match(section, /collections\['all'\]/, 'Custom Order catalog must be sourced from Shopify catalog data');
assert.match(section, /metafields\.custom\.jill_product_capabilities/, 'Custom Order must use the canonical product capability metafield');
assert.match(section, /render 'product-capability-fields'/, 'Custom Order must reuse the canonical product capability renderer');
assert.match(section, /data-jill-product\b/, 'Custom Order items must enter the shared product runtime');
assert.match(section, /class="jill-product-form"/, 'Custom Order items must use the shared product form controller boundary');
assert.match(section, /render 'ui-quantity'/, 'Custom Order quantity must use the canonical quantity primitive');
assert.doesNotMatch(section, /Snack|Pinata|Piñata|Apparel|Favor/i, 'Custom Order must not branch on product families');

assert.match(productSection, /metafields\.custom\.jill_product_capabilities/, 'Product Page must use the canonical product capability metafield');
assert.match(productSection, /render 'product-capability-fields'/, 'Product Page must reuse the canonical product capability renderer');
assert.match(productSection, /data-jill-product\b/, 'Product Page must enter the shared product runtime');
assert.match(productSection, /class: 'jill-product-form'/, 'Product Page must use the shared product form controller boundary');

assert.match(runtime, /dispatchEvent\(event\)/, 'Custom Order must delegate item validation to the shared product runtime');
assert.match(runtime, /data-jill-product-options-payload/, 'Custom Order must consume the canonical Product Options payload');
assert.match(runtime, /getPersonalizationAllocationFieldIds/, 'Custom Order must consume canonical personalization capability scope');
assert.match(runtime, /JILLPersonalization/, 'Custom Order must consume the canonical personalization engine');
assert.doesNotMatch(runtime, /unitsPerQuantity\s*\*/, 'Custom Order must not own customization-unit multiplication');

assert.match(productRuntime, /createAllocationDetailField/, 'shared product runtime must render capability-driven allocated detail fields');
assert.match(productRuntime, /field\.kind === 'text' \|\| field\.kind === 'textarea'/, 'allocated detail rendering must be generic by field kind');
assert.doesNotMatch(productRuntime, /Snack Bags|SnackBag|snackbags|jill_snack_bags/i, 'shared product runtime must never branch on Snack Bags identity');

assert.match(layout, /template\.suffix == 'custom-order'/, 'Custom Order template must load shared customization engines');
assert.match(layout, /jill-custom-order\.js/, 'Custom Order runtime must load only on the Custom Order template');

console.log('JILL Custom Order integration tests passed.');
