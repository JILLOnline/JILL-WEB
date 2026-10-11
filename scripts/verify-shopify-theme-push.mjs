import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Shopify theme push --json can return exit code 0 even when its final
// payload reports file-level errors. The canonical staging release fails
// closed unless Shopify reports one clean upload to the exact non-LIVE theme.
export function verifyThemePush(raw, expected) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Shopify theme push returned no JSON evidence.');
  }
  if (!expected?.id || !expected?.name || !expected?.role) {
    throw new Error('Exact theme target identity is required.');
  }
  const role = String(expected.role).toLowerCase();
  if (!['unpublished', 'development'].includes(role)) {
    throw new Error('Refusing to certify a LIVE theme push.');
  }

  const records = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    try { return JSON.parse(line); }
    catch { throw new Error('Shopify theme push returned malformed JSON.'); }
  });
  const finals = records.filter((record) => record?.theme);
  if (finals.length !== 1) {
    throw new Error('Shopify theme push did not return exactly one final theme result.');
  }
  const result = finals[0].theme;
  const id = String(result.id ?? '').split('/').pop();
  const expectedId = String(expected.id).split('/').pop();
  const actualRole = String(result.role ?? '').toLowerCase();
  if (id !== expectedId || result.name !== expected.name || actualRole !== role) {
    throw new Error('Shopify theme push target identity/role mismatch.');
  }
  if (result.warning || (result.errors && (
    Array.isArray(result.errors) ? result.errors.length > 0 :
    typeof result.errors === 'object' ? Object.keys(result.errors).length > 0 :
    Boolean(result.errors)
  ))) {
    throw new Error('Shopify theme push reported file errors or warnings: ' +
      JSON.stringify({warning: result.warning ?? null, errors: result.errors ?? null}));
  }
  return {id, name: result.name, role: actualRole};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filename = process.argv[2];
  if (!filename) throw new Error('Provide the Shopify theme push --json output path.');
  const result = verifyThemePush(fs.readFileSync(filename, 'utf8'), {
    id: process.env.SHOPIFY_THEME_ID,
    name: process.env.SHOPIFY_THEME_NAME,
    role: process.env.SHOPIFY_THEME_ROLE,
  });
  console.log('Shopify clean theme push verified: ' + JSON.stringify(result));
}
