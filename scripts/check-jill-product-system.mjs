import fs from 'node:fs';
import path from 'node:path';

const configPath = 'storefront.config.json';
const constitutionPath = 'docs/JILL_PRODUCT_SYSTEM.md';
const syncWorkflowPath = '.github/workflows/sync-storefront-theme.yml';

function fail(message) {
  throw new Error(`JILL Product System guard failed: ${message}`);
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`missing required file ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    fail(`missing required directory ${directoryPath}/`);
  }
}

const config = JSON.parse(requireFile(configPath));
const constitution = requireFile(constitutionPath);
const syncWorkflow = requireFile(syncWorkflowPath);

if (config.version !== 1) fail(`unsupported storefront config version ${config.version}`);
if (config.store !== 'jqtdgr-1y.myshopify.com') fail('canonical Shopify store domain drifted');
if (config.themePath !== 'theme') fail('canonical theme path must remain theme/');

const {source, development, backup} = config.themes || {};
if (!source || !development || !backup) fail('source, development, and backup theme roles are required');

if (source.role !== 'MAIN' || source.access !== 'read_only') {
  fail('live JILL theme must remain a read-only source');
}
if (development.role !== 'UNPUBLISHED' || development.access !== 'read_write') {
  fail('development theme must remain unpublished and writable');
}
if (backup.role !== 'UNPUBLISHED' || backup.access !== 'do_not_modify') {
  fail('JILL - KEEP must remain an untouched unpublished recovery theme');
}

const ids = [source.id, development.id, backup.id];
if (new Set(ids).size !== ids.length || ids.some((id) => !/^\d+$/.test(String(id)))) {
  fail('theme IDs must be unique numeric Shopify theme IDs');
}

for (const principle of [
  'system_over_one_offs',
  'single_owner_per_behavior',
  'semantic_primitives',
  'centralized_state',
  'platform_contracts_are_boundaries',
  'deterministic_rendering_no_ghost_ui',
  'housekeeping_is_part_of_every_change',
]) {
  if (!config.productSystem?.principles?.includes(principle)) {
    fail(`missing product-system principle ${principle}`);
  }
}

for (const statement of [
  'System over one-offs.',
  'One owner per behavior.',
  'No ghost UI.',
  'Housekeeping is part of every change.',
  'JILL - KEEP',
  'Copy of JILL',
]) {
  if (!constitution.includes(statement)) fail(`constitution drifted: ${statement}`);
}

if (!syncWorkflow.includes('SHOPIFY_THEME_TOKEN')) {
  fail('storefront sync must require the dedicated Shopify theme credential');
}
if (syncWorkflow.includes('SHOPIFY_APP_AUTOMATION_TOKEN')) {
  fail('app deployment credentials must never be used as a theme-access fallback');
}
if (!syncWorkflow.includes("ref: jill/storefront-system")) {
  fail('storefront snapshot workflow must stay isolated to jill/storefront-system');
}
if (!syncWorkflow.includes("git push origin HEAD:jill/storefront-system")) {
  fail('storefront snapshot workflow must never push directly to main');
}

const themePath = config.themePath;
const themeExists = fs.existsSync(themePath);

if (themeExists) {
  requireDirectory(themePath);
  for (const directory of config.productSystem.storefront.requiredDirectories || []) {
    requireDirectory(path.join(themePath, directory));
  }

  for (const filePath of [
    'layout/theme.liquid',
    'config/settings_schema.json',
    'config/settings_data.json',
    'templates/index.json',
  ]) {
    requireFile(path.join(themePath, filePath));
  }

  const forbiddenNames = new Set(['.env', '.shopify']);
  const stack = [themePath];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const fullPath = path.join(current, entry.name);
      if (forbiddenNames.has(entry.name)) fail(`forbidden theme artifact ${fullPath}`);
      if (/\.(?:pem|key)$/i.test(entry.name)) fail(`possible credential file ${fullPath}`);
      if (entry.isDirectory()) stack.push(fullPath);
    }
  }
}

console.log('JILL Product System guard passed:', JSON.stringify({
  configVersion: config.version,
  sourceTheme: source.id,
  developmentTheme: development.id,
  backupTheme: backup.id,
  migrationState: config.productSystem.storefront.migrationState,
  themeSnapshotPresent: themeExists,
}));
