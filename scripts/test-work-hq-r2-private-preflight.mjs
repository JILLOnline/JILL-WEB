// Offline, synthetic R2 metadata receipt checks. NO real Wrangler call.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  verifyWorkR2ReadOnlySnapshot as verify,workR2ReadCommand as command,
  WORK_R2_BUCKET as bucket,WORK_R2_D1_ID as database,
  WORK_CLOUDFLARE_ACCOUNT as account,WORK_R2_BINDING as binding,
} from './inspect-work-hq-r2-private-preflight.mjs';
const app='services/jill-order-desk/app-home/';
const workConfig=JSON.parse(readFileSync(app+'wrangler.jsonc','utf8'));
const canaryConfig=JSON.parse(readFileSync(app+'wrangler.canary.jsonc','utf8'));
const localConfig={...workConfig,r2_buckets:[{
  bucket_name:bucket,binding,remote:false,
}]};
const fixture={
  whoami:'You are logged in with an OAuth Token, associated with the email info@jillonlinestore.com.\n'+
    'Account ID: '+account,
  d1:{name:'jill-order-desk-work',uuid:database},
  bucket:{name:bucket,default_storage_class:'Standard',
    object_count:'0',bucket_size:'0 B',
    created:'2026-10-16T18:40:54.413Z'},
  devUrl:'Public access via the r2.dev URL is disabled.',
  domains:'There are no custom domains connected to this bucket.',
  workConfig,canaryConfig,localConfig,
};
const okay=verify(fixture);
assert.deepEqual(okay,{
  state:'read_only_pass',shop:'jill-work.myshopify.com',bucket,
  objects:0,bytes:0,storage_class:'Standard',
  public_delivery:false,bindings_deployed:false,
  real_r2_budget_enforced:false,uploads_enabled:false,
});
assert.ok(Object.isFrozen(okay));
for(const change of [
  {whoami:fixture.whoami.replace(account,'wrong')},
  {whoami:fixture.whoami.replace('info@jillonlinestore.com','other@example.invalid')},
  {d1:{...fixture.d1,uuid:'LIVE'}},
  {bucket:{...fixture.bucket,name:'jill-live-private-artwork'}},
  {bucket:{...fixture.bucket,default_storage_class:'InfrequentAccess'}},
  {bucket:{...fixture.bucket,object_count:'1'}},
  {bucket:{...fixture.bucket,bucket_size:'1 B'}},
  {bucket:{...fixture.bucket,created:''}},
  {devUrl:'Public access via the r2.dev URL is enabled.'},
  {domains:'Listing custom domains connected: customer-files.example'},
  {workConfig:{...workConfig,r2_buckets:localConfig.r2_buckets}},
  {canaryConfig:{...canaryConfig,r2_buckets:localConfig.r2_buckets}},
  {localConfig:{...localConfig,r2_buckets:[{
    bucket_name:bucket,binding,remote:true,
  }]}},
  {localConfig:{...localConfig,r2_buckets:[{
    bucket_name:bucket,binding:'jill_work_private_artwork',remote:false,
  }]}},
]){
  assert.throws(()=>verify({...fixture,...change}),/work_r2_/);
}
assert.deepEqual(command('bucket'),['r2','bucket','info',bucket,'--json']);
assert.deepEqual(command('public_url'),['r2','bucket','dev-url','get',bucket]);
assert.deepEqual(command('domains'),['r2','bucket','domain','list',bucket]);
assert.deepEqual(command('d1'),['d1','info','jill-order-desk-work',
  '--config','./wrangler.canary.jsonc','--json']);
assert.deepEqual(command('identity'),['whoami']);
for(const op of ['create','delete','put','get','list_objects','deploy','migrate'])
  assert.throws(()=>command(op),/work_r2_unapproved_command/);
const source=readFileSync('scripts/inspect-work-hq-r2-private-preflight.mjs','utf8');
assert.doesNotMatch(source,/\bINSERT INTO\b|\bUPDATE\b|\.put\(|\.delete\(|\br2 object\b|\bdeploy\s+--/);
console.log('PASS WORK R2 read-only offline: exact account/D1, empty Standard bucket, private domains, isolated local binding and strict metadata command allowlist; no network calls.');
