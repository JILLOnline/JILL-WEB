// Purely synthetic. No Cloudflare calls, schema writes, customer data or keys.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {
  assertMedia0004Source,assertMedia0004Post0003Baseline,
} from './inspect-work-hq-media-0004-readiness.mjs';
const dir='services/jill-order-desk/';
const files=readdirSync(dir+'migrations').sort();
const proposal=readFileSync(dir+
  'migration-plans/0004_work_private_media_registry.sql','utf8');
const config=JSON.parse(readFileSync(dir+
  'app-home/wrangler.canary.jsonc','utf8'));
const source=assertMedia0004Source({filenames:files,proposal,config});
assert.equal(source.proposal_inert,true);
assert.equal(source.registry_not_applied,true);
assert.equal(source.privacy_not_proven,true);
for(const changes of [
  {filenames:[...files,'0004_work_private_media_registry.sql']},
  {filenames:files.slice(0,2)},
  {proposal:proposal.replace('INERT PROPOSAL, NOT AN APPLIED D1 MIGRATION','ACTIVE')},
  {proposal:proposal.replace('pending_verification','verified')},
  {config:{...config,d1_databases:[{
    ...config.d1_databases[0],database_id:'LIVE',
  }]}},
]){
  assert.throws(()=>assertMedia0004Source({
    filenames:files,proposal,config,...changes,
  }));
}
const receipt=results=>[{
  success:true,results,meta:{changed_db:false,rows_written:0},
}];
const rows=[
  'jill_merchant_audit','jill_merchant_authority',
  'jill_merchant_grants','jill_shopify_sessions',
  'jill_work_verified_inbox_index',
].map(name=>({name,type:'table'}));
const ledger=[
  '0001_staff_authority.sql','0002_shopify_sessions.sql',
  '0003_work_verified_inbox_index.sql',
].map(name=>({name}));
const baseline={
  schema:receipt(rows),
  ledgerPresence:receipt([{name:'d1_migrations'}]),
  ledgerHistory:receipt(ledger),
  seed:receipt([{shop:'jill-work.myshopify.com',generation:0,
    verified_payload_json:null,verified_at_ms:0,expires_at_ms:0}]),
};
assert.deepEqual(assertMedia0004Post0003Baseline(baseline),{
  work_0003_verified:true,active_tables:5,active_migrations:3,
  registry_absent:true,proposed_0004_inert:true,
  secret_not_verified:true,private_storage_not_verified:true,
});
for(const changes of [
  {schema:receipt(rows.slice(0,4))},
  {schema:receipt([...rows,{name:'jill_work_private_media_registry',type:'table'}])},
  {schema:receipt(rows.map((x,i)=>i===1?{...x,type:'view'}:x))},
  {ledgerPresence:receipt([])},
  {ledgerHistory:receipt(ledger.slice(0,2))},
  {ledgerHistory:receipt([...ledger,{name:'0004_work_private_media_registry.sql'}])},
  {seed:receipt([])},
  {seed:receipt([{...baseline.seed[0].results[0],generation:2}])},
  {seed:[{...baseline.seed[0],meta:{changed_db:true,rows_written:1}}]},
]){
  assert.throws(()=>assertMedia0004Post0003Baseline({...baseline,...changes}));
}
const runtime=readFileSync('scripts/inspect-work-hq-media-0004-readiness.mjs','utf8');
assert.doesNotMatch(runtime,/['"]d1['"],['"]migrations['"],['"]apply['"]/);
assert.doesNotMatch(runtime,/['"]time-travel['"],['"]restore['"]/);
assert.doesNotMatch(runtime,/['"]secret['"],['"]put['"]/);
assert.match(runtime,/READ ONLY/);
console.log('PASS WORK MEDIA 0004 read-only safety: exact WORK post-0003 state, absent registry, inert 0004 plan; rejects missing ledger, unknown tables and nonempty index; NO keys, writes or files.');
