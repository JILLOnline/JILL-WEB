// Current joined-tree assertions; the isolated historical certificates remain intact.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {HUB_ROUTES} from '../extensions/jill-account-dashboard/src/hub/routes.mjs';
const read=p=>readFileSync(p,'utf8');
const app='services/jill-order-desk/app-home/app/';
const nav=read(app+'routes/app.tsx');
assert.deepEqual([...nav.matchAll(/<NavLink[^>]*>([^<]+)<\/NavLink>/g)].map(x=>x[1]),['Home','Requests','Messages','Contact Us','Catalog','Settings']);
assert.equal(HUB_ROUTES.length,9);
assert.deepEqual(new Set(HUB_ROUTES.map(x=>x.id)),new Set(['overview','custom-orders','messages','contact-requests','rewards','coupons','celebrations','saved','settings']));
const quote=read(app+'components/WorkQuoteWorksheet.tsx');
for(const token of ['<details className="jill-quote__advanced">','className="jill-quote__advanced-content"','<WorkQuoteCatalogComparison','<WorkQuoteArtworkAudit','className="jill-quote__preflight"','className="jill-quote__unit-plan"','className="jill-quote__draft-actions"','Entries are lost on refresh','aria-label="Quote worksheet"','NOT SAVED · NOT SENT'])assert.ok(quote.includes(token),token);
assert.ok(quote.indexOf('className="jill-quote__draft-actions"')<quote.indexOf('<details className="jill-quote__advanced">'));
const css=read(app+'styles/hq-visual-polish.css');
assert.ok(!/@import\b|https?:\/\/|url\(|position\s*:\s*fixed\b/i.test(css));
assert.ok(!/\b(?:display|visibility)\s*:\s*none\b/i.test(css.replace('.jill-workspace .jill-quote__advanced>summary::-webkit-details-marker{display:none}','')));
for(const token of ['@media(prefers-reduced-motion:reduce)','@media(max-width:600px)','outline:3px solid var(--jill-focus)'])assert.ok(css.includes(token),token);
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.deepEqual(readdirSync('services/jill-order-desk/migrations').filter(p=>p.endsWith('.sql')).sort(),[
 '0001_staff_authority.sql','0002_shopify_sessions.sql','0003_work_verified_inbox_index.sql',
 '0004_work_contact_tickets_source_only.sql','0005_work_contact_customer_replies_source_only.sql',
]);
assert.ok(read('services/jill-order-desk/quote-proposals/0008_work_quote_drafts.sql').includes('jill_work_quote_draft_operations'));
for(const p of ['scripts/work-hq-row-disclosure-edition.mjs','scripts/work-hq-row-disclosure-runtime-build.mjs','scripts/release-work-hq-row-disclosure-owner.mjs'])assert.equal(git('rev-parse','b53b9f7f1146a0bad4b734a8e7f48c3ee66309f8:'+p),git('rev-parse','HEAD:'+p));
console.log('PASS joined source: six HQ areas, nine My JILL routes, quote control/CSS invariants, unchanged historical release files. No browser acceptance claimed.');
