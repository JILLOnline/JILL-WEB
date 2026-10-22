// UX regression: single canonical Requests navigation; retain the legacy
// queue route for direct links only, while Settings retains Owner auth.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const root='services/jill-order-desk/app-home/app/';
const shell=read(root+'routes/app.tsx');
const home=read(root+'routes/app.index.tsx');
const access=read(root+'routes/app.access.tsx');
const registry=read(root+'routes.ts');
const nav=[...shell.matchAll(/<NavLink to="([^"]+)"(?: end)?>([^<]+)<\/NavLink>/g)]
 .map(m=>({path:m[1],label:m[2]}));
assert.deepEqual(nav,[
 {path:'/app',label:'Home'},
 {path:'/app/requests',label:'Requests'},
 {path:'/app/messages',label:'Messages'},
 {path:'/app/catalog',label:'Catalog'},
 {path:'/app/access',label:'Settings'}
]);
assert.doesNotMatch(shell,/<NavLink[^>]*\/app\/queue/);
assert.match(registry,/route\("queue","routes\/app\.queue\.tsx"\)/);
assert.match(home,/to="\/app\/requests" className="jill-hq__card-link">View requests/);
assert.doesNotMatch(home,/Open work queue|to="\/app\/queue"/);
assert.match(home,/<h3>Settings<\/h3>/);
assert.match(home,/to="\/app\/access" className="jill-hq__card-link">Open settings/);
assert.match(access,/heading="JILL HQ — Settings"/);
assert.match(access,/readWorkOwnerAccessEvidence/);
assert.match(access,/<h2>Access &amp; permissions<\/h2>/);
console.log('PASS 5-tab HQ navigation; duplicate Work Queue hidden, Requests unified, Settings preserves Owner-only access; no route or security removal.');
