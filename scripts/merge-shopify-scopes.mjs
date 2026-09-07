import fs from 'node:fs';

const path = process.argv[2] || 'shopify.app.production.toml';
const requiredScopes = [
  'read_customers',
  'write_customers',
  'customer_read_customers',
  'customer_write_customers',
  'customer_read_orders',
];

const requiredRedirectUrls = [
  'https://script.google.com/macros/s/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/exec',
];

if (!fs.existsSync(path)) {
  throw new Error(`Shopify app config not found: ${path}`);
}

let source = fs.readFileSync(path, 'utf8');

const scopePattern = /(\[access_scopes\][\s\S]*?^\s*scopes\s*=\s*")([^"]*)(")/m;
const scopeMatch = source.match(scopePattern);

if (!scopeMatch) {
  throw new Error('Could not find [access_scopes] scopes = "..." in linked Shopify app config.');
}

const currentScopes = scopeMatch[2]
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);

const mergedScopes = [...new Set([...currentScopes, ...requiredScopes])];
source = source.replace(scopePattern, `$1${mergedScopes.join(',')}$3`);

const authSectionPattern = /(^\[auth\]\s*$)([\s\S]*?)(?=^\[[^\]]+\]\s*$|\Z)/m;
const authMatch = source.match(authSectionPattern);

if (authMatch) {
  const authBody = authMatch[2];
  const redirectPattern = /^\s*redirect_urls\s*=\s*\[([\s\S]*?)\]\s*$/m;
  const redirectMatch = authBody.match(redirectPattern);

  if (redirectMatch) {
    const currentUrls = [...redirectMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    const mergedUrls = [...new Set([...currentUrls, ...requiredRedirectUrls])];
    const replacement = `redirect_urls = [\n${mergedUrls.map((url) => `  "${url}"`).join(',\n')}\n]`;
    const newAuthBody = authBody.replace(redirectPattern, replacement);
    source = source.replace(authSectionPattern, `${authMatch[1]}${newAuthBody}`);
  } else {
    const replacement = `\nredirect_urls = [\n${requiredRedirectUrls.map((url) => `  "${url}"`).join(',\n')}\n]\n`;
    source = source.replace(authSectionPattern, `${authMatch[1]}${replacement}${authBody}`);
  }
} else {
  source = `${source.trimEnd()}\n\n[auth]\nredirect_urls = [\n${requiredRedirectUrls.map((url) => `  "${url}"`).join(',\n')}\n]\n`;
}

fs.writeFileSync(path, source);

console.log(`Preserved ${currentScopes.length} existing scopes and ensured ${requiredScopes.length} JILL dashboard scopes.`);
console.log(`Ensured ${requiredRedirectUrls.length} JILL OAuth redirect URL.`);
