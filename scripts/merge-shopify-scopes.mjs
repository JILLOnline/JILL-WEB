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

function ensureAuthRedirectUrls(input, requiredUrls) {
  const lines = input.split('\n');
  let authStart = lines.findIndex((line) => /^\s*\[auth\]\s*$/.test(line));

  if (authStart === -1) {
    const block = [
      '',
      '[auth]',
      'redirect_urls = [',
      ...requiredUrls.map((url) => `  "${url}",`),
      ']',
    ];
    return `${lines.join('\n').trimEnd()}\n${block.join('\n')}\n`;
  }

  let authEnd = lines.length;
  for (let i = authStart + 1; i < lines.length; i += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[i])) {
      authEnd = i;
      break;
    }
  }

  const currentUrls = [];
  const removeRanges = [];

  for (let i = authStart + 1; i < authEnd; i += 1) {
    if (!/^\s*redirect_urls\s*=/.test(lines[i])) continue;

    let end = i;
    let joined = lines[i];
    let bracketDepth = (lines[i].match(/\[/g) || []).length - (lines[i].match(/\]/g) || []).length;

    while (bracketDepth > 0 && end + 1 < authEnd) {
      end += 1;
      joined += `\n${lines[end]}`;
      bracketDepth += (lines[end].match(/\[/g) || []).length - (lines[end].match(/\]/g) || []).length;
    }

    for (const match of joined.matchAll(/"([^"]+)"/g)) {
      currentUrls.push(match[1]);
    }

    removeRanges.push([i, end]);
    i = end;
  }

  for (let r = removeRanges.length - 1; r >= 0; r -= 1) {
    const [start, end] = removeRanges[r];
    lines.splice(start, end - start + 1);
    authEnd -= end - start + 1;
  }

  const mergedUrls = [...new Set([...currentUrls, ...requiredUrls])];
  const redirectBlock = [
    'redirect_urls = [',
    ...mergedUrls.map((url) => `  "${url}",`),
    ']',
  ];

  lines.splice(authStart + 1, 0, ...redirectBlock);
  return lines.join('\n');
}

source = ensureAuthRedirectUrls(source, requiredRedirectUrls);
fs.writeFileSync(path, source);

console.log(`Preserved ${currentScopes.length} existing scopes and ensured ${requiredScopes.length} JILL dashboard scopes.`);
console.log(`Ensured JILL OAuth redirect URL while preserving existing redirect URLs.`);
