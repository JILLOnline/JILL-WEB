import fs from 'node:fs';

const path = process.argv[2] || 'shopify.app.production.toml';
const requiredScopes = [
  'read_customers',
  'write_customers',
  'customer_read_customers',
  'customer_read_orders',
];

if (!fs.existsSync(path)) {
  throw new Error(`Shopify app config not found: ${path}`);
}

let source = fs.readFileSync(path, 'utf8');
const scopePattern = /(\[access_scopes\][\s\S]*?^\s*scopes\s*=\s*")([^"]*)(")/m;
const match = source.match(scopePattern);

if (!match) {
  throw new Error('Could not find [access_scopes] scopes = "..." in linked Shopify app config.');
}

const currentScopes = match[2]
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);

const mergedScopes = [...new Set([...currentScopes, ...requiredScopes])];
source = source.replace(scopePattern, `$1${mergedScopes.join(',')}$3`);
fs.writeFileSync(path, source);

console.log(`Preserved ${currentScopes.length} existing scopes and ensured ${requiredScopes.length} JILL dashboard scopes.`);
