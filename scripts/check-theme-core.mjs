import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const THEME_ROOT = 'theme';
const FOUNDATION_CSS = path.join(THEME_ROOT, 'assets', 'jill-foundation.css.liquid');
const PRODUCT_CAPABILITY_SCHEMA = path.join('contracts', 'product-capability-profile.schema.json');

function fail(message) {
  throw new Error(`JILL Theme Core guard failed: ${message}`);
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function stripLiquidForCss(source) {
  return source
    .replace(/^\s*\{\{[\s\S]*?\}\}\s*$/gm, '')
    .replace(/\{\{[\s\S]*?\}\}/g, '0')
    .replace(/\{%[\s\S]*?%\}/g, '');
}

function stripAllowedScriptTags(source) {
  return source
    .replace(
      /<script\b[^>]*\btype\s*=\s*["']application\/(?:ld\+json|json)["'][^>]*>[\s\S]*?<\/script>/gi,
      '',
    )
    .replace(/<script\b(?=[^>]*\bsrc\s*=)[^>]*>\s*<\/script>/gi, '');
}

function assertUniqueSettingIds(settings, owner) {
  const ids = new Set();
  for (const setting of settings || []) {
    if (!setting.id) continue;
    if (ids.has(setting.id)) fail(`duplicate setting id ${setting.id} in ${owner}`);
    ids.add(setting.id);
  }
}

function validateLiquidSchema(filePath, source) {
  const matches = [...source.matchAll(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/gi)];
  if (!matches.length) return;
  if (matches.length > 1) fail(`multiple schema blocks are forbidden: ${filePath}`);

  let schema;
  try {
    schema = JSON.parse(matches[0][1]);
  } catch (error) {
    fail(`invalid JSON in schema block ${filePath}: ${error.message}`);
  }

  assertUniqueSettingIds(schema.settings, `${filePath} section settings`);

  const blockTypes = new Set();
  for (const block of schema.blocks || []) {
    if (block.type) {
      if (blockTypes.has(block.type)) fail(`duplicate block type ${block.type} in ${filePath}`);
      blockTypes.add(block.type);
    }
    assertUniqueSettingIds(block.settings, `${filePath} block ${block.type || block.name || 'unknown'}`);
  }
}

function assertUniqueEnumValues(node, location = '$') {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node.enum)) {
    const serialized = node.enum.map((value) => JSON.stringify(value));
    if (new Set(serialized).size !== serialized.length) fail(`duplicate enum value in ${PRODUCT_CAPABILITY_SCHEMA} at ${location}`);
  }

  if (Array.isArray(node)) {
    node.forEach((value, index) => assertUniqueEnumValues(value, `${location}[${index}]`));
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    assertUniqueEnumValues(value, `${location}.${key}`);
  }
}

function validateProductCapabilityContract() {
  if (!fs.existsSync(PRODUCT_CAPABILITY_SCHEMA)) fail(`${PRODUCT_CAPABILITY_SCHEMA} is missing`);

  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(PRODUCT_CAPABILITY_SCHEMA, 'utf8'));
  } catch (error) {
    fail(`invalid JSON in ${PRODUCT_CAPABILITY_SCHEMA}: ${error.message}`);
  }

  if (schema.type !== 'object' || schema.additionalProperties !== false) {
    fail(`${PRODUCT_CAPABILITY_SCHEMA} root must be a closed object schema`);
  }
  if (schema.properties?.version?.const !== 1) {
    fail(`${PRODUCT_CAPABILITY_SCHEMA} must own contract version 1`);
  }
  if (schema.$defs?.field?.additionalProperties !== false) {
    fail(`${PRODUCT_CAPABILITY_SCHEMA} field definition must reject unknown properties`);
  }
  if (schema.$defs?.features?.additionalProperties !== false) {
    fail(`${PRODUCT_CAPABILITY_SCHEMA} features definition must reject unknown properties`);
  }

  const fieldKinds = schema.$defs?.field?.properties?.kind?.enum;
  const fieldGroups = schema.$defs?.field?.properties?.group?.enum;
  if (!Array.isArray(fieldKinds) || !fieldKinds.length) fail(`${PRODUCT_CAPABILITY_SCHEMA} must define field kinds`);
  if (!Array.isArray(fieldGroups) || !fieldGroups.length) fail(`${PRODUCT_CAPABILITY_SCHEMA} must define field groups`);

  assertUniqueEnumValues(schema);
}

if (!fs.existsSync(THEME_ROOT) || !fs.statSync(THEME_ROOT).isDirectory()) {
  fail('theme/ is missing');
}

validateProductCapabilityContract();

const files = walk(THEME_ROOT);
const forbiddenName = /(?:^|[-_.])(final|fix|fixes|cleanup|polish|override|patch|temp|temporary|backup|copy|old|legacy|v\d+)(?:[-_.]|$)/i;
const cssFiles = [];

for (const filePath of files) {
  const name = path.basename(filePath);
  if (forbiddenName.test(name)) fail(`patch-style filename is forbidden: ${filePath}`);
  if (/\.scss(?:\.liquid)?$/i.test(name)) fail(`Sass is forbidden: ${filePath}`);
  if (/\.min\.(?:css|js)$/i.test(name)) fail(`minified source is forbidden: ${filePath}`);

  const text = fs.readFileSync(filePath, 'utf8');
  if (/!important\b/i.test(text)) fail(`!important is forbidden: ${filePath}`);
  if (/\b(?:TODO|FIXME|HACK)\b/.test(text)) fail(`unfinished marker is forbidden: ${filePath}`);

  const isCss = /\.css(?:\.liquid)?$/i.test(name);
  const isJs = /\.m?js(?:\.liquid)?$/i.test(name);
  const isLiquid = /\.liquid$/i.test(name);

  if (!isCss) {
    if (/<style\b/i.test(text)) fail(`style blocks are forbidden outside CSS assets: ${filePath}`);
    if (/\sstyle\s*=\s*["']/i.test(text)) fail(`inline style attributes are forbidden: ${filePath}`);
    if (/\{%[-\s]*stylesheet\b/i.test(text)) fail(`Liquid stylesheet blocks are forbidden: ${filePath}`);
  }

  if (isLiquid) {
    if (/["'][^"']+\.css\.liquid["']\s*\|\s*asset_url\b/i.test(text)) {
      fail(`compiled Liquid CSS assets must be referenced without the .liquid suffix: ${filePath}`);
    }
    const withoutAllowedScripts = stripAllowedScriptTags(text);
    if (/<script\b/i.test(withoutAllowedScripts)) {
      fail(`inline executable script blocks are forbidden: ${filePath}`);
    }
    if (/\son[a-z]+\s*=\s*["']/i.test(text)) {
      fail(`inline event handlers are forbidden: ${filePath}`);
    }
    validateLiquidSchema(filePath, text);
  }

  if (isJs) {
    if (/\.style\b|\.cssText\b|\.setProperty\s*\(/.test(text)) {
      fail(`JavaScript may not inject or mutate presentation styles: ${filePath}`);
    }
    if (/\bconsole\.log\s*\(|\bdebugger\s*;/.test(text)) fail(`debug code is forbidden: ${filePath}`);
  }

  if (isCss) {
    if (filePath !== FOUNDATION_CSS && /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\s*\(/i.test(text)) {
      fail(`raw color values are forbidden outside the foundation token owner: ${filePath}`);
    }
    cssFiles.push(filePath);
  }
}

const selectorOwners = new Map();
const tokenOwners = new Map();
const keyframeOwners = new Map();

for (const filePath of cssFiles) {
  const source = stripLiquidForCss(fs.readFileSync(filePath, 'utf8'));
  const root = postcss.parse(source, {from: filePath});

  root.walkAtRules((rule) => {
    if (!/keyframes$/i.test(rule.name)) return;
    const name = rule.params.trim();
    const previous = keyframeOwners.get(name);
    if (previous) fail(`duplicate keyframes ${name}: ${previous} and ${filePath}`);
    keyframeOwners.set(name, filePath);
  });

  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;

    const properties = new Set();
    for (const node of rule.nodes || []) {
      if (node.type !== 'decl') continue;
      const property = node.prop.toLowerCase();
      if (properties.has(property)) fail(`duplicate property ${property} in selector ${rule.selector} (${filePath})`);
      properties.add(property);

      if (property.startsWith('--jill-')) {
        const previous = tokenOwners.get(property);
        if (previous) fail(`duplicate design token ${property}: ${previous} and ${filePath}`);
        tokenOwners.set(property, filePath);
      }
    }

    for (const selector of rule.selectors || []) {
      const normalized = selector.replace(/\s+/g, ' ').trim();
      if (/#[-_a-z0-9]+/i.test(normalized)) fail(`CSS id selectors are forbidden: ${normalized} (${filePath})`);
      const previous = selectorOwners.get(normalized);
      if (previous) fail(`duplicate CSS selector ${normalized}: ${previous} and ${filePath}`);
      selectorOwners.set(normalized, filePath);
    }
  });
}

const settingsSchemaPath = path.join(THEME_ROOT, 'config', 'settings_schema.json');
if (!fs.existsSync(settingsSchemaPath)) fail('config/settings_schema.json is missing');
const settingsSchema = JSON.parse(fs.readFileSync(settingsSchemaPath, 'utf8'));
const settingIds = new Set();

for (const group of settingsSchema) {
  for (const setting of group.settings || []) {
    if (!setting.id) continue;
    if (settingIds.has(setting.id)) fail(`duplicate global theme setting id: ${setting.id}`);
    settingIds.add(setting.id);
  }
}

const required = [
  'layout/theme.liquid',
  'assets/jill-foundation.css.liquid',
  'assets/jill-ui.css',
  'assets/jill-storefront.css',
  'assets/jill-form-engine.js',
  'assets/jill-product-capabilities.js',
  'assets/jill-product.js',
  'config/settings_schema.json',
  'config/settings_data.json',
  'sections/header-group.json',
  'sections/footer-group.json',
  'sections/header.liquid',
  'sections/footer.liquid',
  'sections/custom-liquid.liquid',
  'sections/main-product.liquid',
  'sections/main-cart.liquid',
  'sections/main-collection.liquid',
  'sections/main-search.liquid',
  'snippets/ui-button.liquid',
  'snippets/ui-field.liquid',
  'snippets/ui-textarea.liquid',
  'snippets/ui-select.liquid',
  'snippets/ui-choice.liquid',
  'snippets/ui-choice-group.liquid',
  'snippets/ui-quantity.liquid',
  'snippets/ui-file.liquid',
  'snippets/product-capability-fields.liquid',
  'snippets/product-card.liquid',
  'snippets/pagination.liquid',
  'snippets/meta-tags.liquid',
  'templates/product.json',
  'templates/cart.json',
  'templates/collection.json',
  'templates/search.json',
];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(THEME_ROOT, relativePath))) fail(`required canonical owner is missing: theme/${relativePath}`);
}

console.log(`JILL Theme Core guard passed: ${files.length} files, ${selectorOwners.size} selectors, ${tokenOwners.size} design tokens, ${keyframeOwners.size} keyframe sets, product capability contract v1, universal form engine, capability resolver, product commerce, native cart and discovery owners present.`);
