// SOURCE ONLY: regression guard for the October WORK HQ visual pass.
// Never deploy, fetch Shopify/Cloudflare, migrate D1 or read credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const ROOT=process.cwd();
const BASE='5c3ceb2e31cabb04ebf853e9968cf64fcc9d694d';
const APP='services/jill-order-desk/app-home/app/';
const layoutPath=APP+'routes/app.tsx';
const quotePath=APP+'components/WorkQuoteWorksheet.tsx';
const cssPath=APP+'styles/hq-visual-polish.css';
const run=(...args)=>execFileSync('git',args,{
 cwd:ROOT,encoding:'utf8',maxBuffer:4*1024*1024,
});
const current=path=>readFileSync(path,'utf8');
const baseline=path=>run('show',BASE+':'+path);
const allowed=new Set([
 layoutPath,quotePath,cssPath,
 'scripts/test-work-hq-visual-polish-guard.mjs',
 '.github/workflows/jill-hq-visual-polish-preview.yml',
 'docs/WORK_HQ_VISUAL_POLISH_20261024.md',
]);
const changed=run('diff','--name-only',BASE+'...HEAD').trim()
 .split(/\r?\n/).filter(Boolean);
assert.ok(changed.length>=3,'Expected actual isolated UI source diff');
assert.deepEqual(changed.filter(p=>!allowed.has(p)),[],
 'Changed path OUTSIDE reviewed UI-only allowlist; stop');
assert.ok(!changed.some(p=>/\.sql$|\.toml$|wrangler|backend|workers\//.test(p)),
 'No migrations, Worker, gateway or manifest changes');
const app=current(layoutPath);
const oldApp=baseline(layoutPath);
const add=
// React authenticated shell is the only place the new style is mounted.
'// Source-only, WORK-scoped visual layer; no behavior or security changes.\n'+
'import "../styles/hq-visual-polish.css";\n';
assert.equal(app.replace(add,''),oldApp,
 'Authenticated HQ app route must differ ONLY by CSS import');
assert.equal((app.match(/import "\.\.\/styles\/hq-visual-polish\.css"/g)||[]).length,1);
const quote=current(quotePath),prior=baseline(quotePath);
const baselinePrefix=prior.slice(0,prior.indexOf('  return <details className='));
const currentPrefix=quote.slice(0,quote.indexOf('  return <details className='));
assert.ok(baselinePrefix.length>4000 &&
  prior.includes('  return <details className='),
  'Baseline quote logic boundary missing');
assert.equal(currentPrefix,baselinePrefix,
 'Quote hooks, handlers, draft protocol, calculations and permissions changed');
assert.ok(quote.includes('<details className="jill-quote__advanced">'));
assert.ok(quote.includes('className="jill-quote__advanced-content"'));
assert.equal((quote.match(/<WorkQuoteCatalogComparison/g)||[]).length,1);
assert.equal((quote.match(/<WorkQuoteArtworkAudit/g)||[]).length,1);
assert.equal((quote.match(/className="jill-quote__preflight"/g)||[]).length,1);
assert.equal((quote.match(/className="jill-quote__unit-plan"/g)||[]).length,1);
assert.equal((quote.match(/className="jill-quote__draft-actions"/g)||[]).length,1);
assert.ok(quote.indexOf('className="jill-quote__draft-actions"')<
 quote.indexOf('<details className="jill-quote__advanced">'),
 'Save Draft and no-persistence warning must stay next to estimate');
assert.ok(quote.includes('Entries are lost on refresh'));
assert.ok(quote.includes('aria-label="Quote worksheet"'));
assert.ok(quote.includes('NOT SAVED · NOT SENT'));
// Ensure numerical input, source consistency, permissions and fail-closed
// quote actions have not been modified in the pre-UI logic.
for(const token of [
 'prepareWorkQuoteUiSavePayload',
 'evaluateWorkQuoteWorksheet',
 'hydrateVerifiedWorkQuoteWorksheet',
 'if(!canSaveDraft||!readyQuote)return;',
 'const canReloadDraft=saveDraftEnabled===true',
 'saveFetcher.submit(intent.payload',
 'readFetcher.load(workQuoteDraftReadPath',
]){
 assert.ok(currentPrefix.includes(token),token+' missing');
}
const css=current(cssPath);
assert.ok(css.startsWith('/*'));
for(const selector of [
 '.jill-workspace', '.jill-inbox__row-trigger',
 '.jill-actions__direct-buttons button',
 '.jill-quote__advanced', '.jill-catalog__row',
 '.jill-messages__thread',
]){
 assert.ok(css.includes(selector),'Missing reviewed CSS selector: '+selector);
}
assert.ok(!/\@import\b|https?:\/\/|url\(|position\s*:\s*fixed\b/i.test(css),
 'Visual layer must not fetch external resources or create fixed overlays');
assert.ok(!/\b(?:display|visibility)\s*:\s*none\b/i.test(css),
 'Visual layer must not hide existing business controls or disclosures');
assert.ok(!/\b!important\b/i.test(css),
 'Visual layer must not force override protected Shopify styling');
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
assert.ok(css.includes('@media(max-width:600px)'));
assert.ok(css.includes('outline:3px solid var(--jill-focus)'));
console.log('PASS WORK HQ visual scope: only approved UI files, exact unchanged quote handlers/auth, readable CSS, original interactions untouched. NO DEPLOY.');
