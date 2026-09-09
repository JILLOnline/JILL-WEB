import fs from 'node:fs';

const [inputPath] = process.argv.slice(2);
const expectedId = process.env.SHOPIFY_THEME_ID;
const expectedName = process.env.SHOPIFY_THEME_NAME;
const expectedRole = process.env.SHOPIFY_THEME_ROLE;

if (!inputPath) throw new Error('Theme target verification requires a Shopify theme-list JSON file.');
if (!expectedId || !expectedName || !expectedRole) {
  throw new Error('SHOPIFY_THEME_ID, SHOPIFY_THEME_NAME and SHOPIFY_THEME_ROLE are required.');
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function themeList(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.themes)) return value.themes;
  if (Array.isArray(value.themes?.nodes)) return value.themes.nodes;
  if (Array.isArray(value.nodes)) return value.nodes;
  if (Array.isArray(value.data?.themes)) return value.data.themes;
  if (Array.isArray(value.data?.themes?.nodes)) return value.data.themes.nodes;
  return [];
}

function idTail(value) {
  return String(value ?? '').split('/').pop();
}

function normalizeRole(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

const themes = themeList(payload);
const target = themes.find((theme) => idTail(theme.id) === idTail(expectedId));

if (!target) {
  const visible = themes.map((theme) => `${theme.name ?? 'unnamed'} (${idTail(theme.id) || 'no-id'})`).join(', ');
  throw new Error(`Canonical Shopify theme ${expectedId} was not found. Visible themes: ${visible || 'none'}`);
}

if (target.name !== expectedName) {
  throw new Error(`Canonical Shopify theme name mismatch: expected "${expectedName}", received "${target.name}".`);
}

const actualRole = normalizeRole(target.role);
const requiredRole = normalizeRole(expectedRole);
if (actualRole !== requiredRole) {
  throw new Error(`Refusing Shopify theme write: expected role ${requiredRole}, received ${actualRole || 'unknown'}.`);
}

console.log(`Verified Shopify target: ${target.name} (${idTail(target.id)}) [${actualRole}]`);
