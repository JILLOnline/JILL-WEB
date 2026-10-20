import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assertDensityPresentation,densityManifest,checkWorkHqDensity,prepareDensityBuild,DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {DENSITY_PROFILE as p} from './release-work-hq-density-owner.mjs';
import {visualBaseline,ownedVisualAllocation} from './release-work-hq-visual-theme-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';
const fixture='export async function loader(){return {allowed:false}}; export default function Page(){const [n,setN]=useState(0);return <main><p>Title</p><Link to="/app">Home</Link><button disabled={busy} onClick={()=>setN(n+1)}>Save</button></main>}';
assertDensityPresentation(fixture,fixture.replace('<p>Title</p>','').replace('<main>','<main className="compact">'));
assertDensityPresentation(fixture,fixture.replace(/\n/g,'\r\n'));
for(const edit of [s=>s.replace('allowed:false','allowed:true'),s=>s.replace('useState(0)','useState(1)'),s=>s.replace('disabled={busy}','disabled={false}'),s=>s.replace('n+1','n+2'),s=>s.replace('to="/app"','to="https://foreign.invalid"')])assert.throws(()=>assertDensityPresentation(fixture,edit(fixture)));
const manifest=densityManifest();assert.equal(Object.keys(manifest.files).length,7);
assert.equal(p.base,'6473444f-86f8-4a83-a47a-56d1a2e19f05');assert.equal(p.baseSource,DENSITY_RUNTIME_BASE);
const allocation={deployment:p.deployment,versions:[{id:p.base,percentage:100},{id:HQ_QUOTE,percentage:0}]};visualBaseline(allocation,p);
assert.throws(()=>visualBaseline({...allocation,deployment:'00000000-0000-4000-8000-000000000000'},p));
assert.throws(()=>visualBaseline({...allocation,versions:[{id:p.base,percentage:100}]},p));
const attempt={candidate:'11111111-2222-4333-8444-555555555555',nonce:'22222222-3333-4444-8555-666666666666'};
const after={deployment:'33333333-4444-4555-8666-777777777777',message:p.activate+attempt.nonce,versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}]};
ownedVisualAllocation(after,attempt,p);assert.throws(()=>ownedVisualAllocation({...after,message:'different operator'},attempt,p));
assert(!['work-hq-visual-theme-v1','work-hq-visual-theme-v2','work-hq-navigation-repair-v1'].includes(p.receiptStem));
// Full history is needed only for the explicitly requested local package proof.
// Standard CI tests the safety contracts without a provider or historical fetch.
if(process.argv.includes('--package-local')){
 checkWorkHqDensity();
 const runner=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const app=prepareDensityBuild({runner}),root=app.slice(0,-'services/jill-order-desk/app-home'.length);
 for(const file of ['backend/jill-merchant-policy.mjs','services/jill-order-desk/work-quote-agreement.mjs']){
  const expected=execFileSync('git',['show',DENSITY_RUNTIME_BASE+':'+file]);assert.deepEqual(fs.readFileSync(root+file),expected);
 }
 assert.equal(fs.existsSync(root+'services/jill-order-desk/work-quote-calculation.mjs'),false);
 assert(!fs.existsSync(app+'/.dev.vars'));assert(!fs.existsSync(root+'/.git'));
 fs.writeFileSync('services/jill-order-desk/app-home/.wrangler/density-review/isolated-app.txt',app);
 console.log('PASS isolated tracked-source package: current runtime business code retained, seven visual files overlaid, unreleased calculation/policy excluded; no credentials or provider calls.');
}
console.log('PASS compact edition auth/hooks/command/link denial, exact baseline, retained quote canary, owned transitions and fresh receipt namespace.');
