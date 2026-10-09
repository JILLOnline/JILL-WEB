import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const WORK_CLIENT_ID = 'f8e1ebdbae84490dc8ea5b133637e6c0';
export const LIVE_CLIENT_ID = 'ebf1a69d82f46619d2f2945faab78afa';
export const WORK_STORE = 'jill-work.myshopify.com';
export const WORK_CONFIG_FILE = 'shopify.app.work.toml';

function stringSetting(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"'\\r\\n]*)["']\\s*$`, 'm'));
  return match?.[1] || '';
}

// The file is pulled from Shopify, not synthesized or shared with LIVE.
// Refuse a misleading preview before Shopify CLI receives any arguments.
export function assertRewardsWorkConfig(source) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('Missing WORK app configuration. Run npm run rewards:work:link first.');
  }

  const clientId = stringSetting(source, 'client_id');
  const appName = stringSetting(source, 'name');
  if (clientId !== WORK_CLIENT_ID || clientId === LIVE_CLIENT_ID) {
    throw new Error('Refusing Rewards WORK preview: linked Shopify app Client ID is not JILL WORK Rewards.');
  }
  if (appName !== 'JILL WORK Rewards') {
    throw new Error('Refusing Rewards WORK preview: linked app name does not match JILL WORK Rewards.');
  }
  if (/jqtdgr-1y\\.myshopify\\.com|jillonlinestore\\.com|AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/i.test(source)) {
    throw new Error('Refusing Rewards WORK preview: LIVE store/backend URL found in WORK config.');
  }

  const scopes = source.match(/^\\s*scopes\\s*=\\s*["']([^"'\\r\\n]+)["']/m)?.[1]
    ?.split(',').map((scope) => scope.trim()).filter(Boolean) || [];
  const required = [
    'customer_read_customers',
    'customer_write_customers',
    'customer_read_orders',
    'read_customers',
    'write_customers',
    'read_orders',
    'read_discounts',
    'write_discounts',
  ];
  const missing = required.filter((scope) => !scopes.includes(scope));
  if (missing.length) {
    throw new Error(`WORK app missing Rewards scopes: ${missing.join(', ')}`);
  }
  return {name: appName, clientId, store: WORK_STORE};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filename = path.resolve(process.cwd(), WORK_CONFIG_FILE);
  if (!fs.existsSync(filename)) {
    throw new Error(`Missing ${WORK_CONFIG_FILE}. Run npm run rewards:work:link first.`);
  }
  const verified = assertRewardsWorkConfig(fs.readFileSync(filename, 'utf8'));
  console.log(`Verified isolated ${verified.name} app on ${verified.store}. Starting Shopify WORK preview is allowed.`);
}
