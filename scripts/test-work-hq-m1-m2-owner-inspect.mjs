// Synthetic contract tests for read-only M1/M2 Cloudflare release inspection.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectM1M2WorkRuntime as inspect}
 from './inspect-work-hq-m1-m2-owner.mjs';
const ACTIVE='e866e2f2-0746-44d0-8caa-b37a1c9bcf45';
const QUOTE='dbc6341f-de7f-41de-8e97-6bf971201eeb';
const DEPLOY='d5d1f522-fcc0-4fbb-9052-dc9d951e6029';
const database='3f17c186-c794-4e00-8f20-017191373a19';
const plain=(name,text)=>({name,type:'plain_text',text});
const secret=name=>({name,type:'secret_text'});
const bindings=[
 plain('JILL_WORK_HOST_STAGE','canary'),
 plain('JILL_WORK_OAUTH_ENABLED','true'),
 plain('JILL_WORK_CATALOG_ENABLED','true'),
 plain('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','false'),
 plain('JILL_WORK_CONVERSATION_ENABLED','false'),
 secret('JILL_HQ_MERCHANT_READ_SECRET'),
 secret('JILL_HQ_MERCHANT_WRITE_SECRET'),
 secret('JILL_WORK_SESSION_KEY_B64'),
 secret('SHOPIFY_API_SECRET'),
 {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',id:database},
 {name:'CF_VERSION_METADATA',type:'version_metadata'},
];
const config=(id,list)=>({id,resources:{bindings:list,script:{handlers:['fetch']}}});
const active=config(ACTIVE,bindings);
const quote=config(QUOTE,bindings.map(x=>x.name==='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'?
 plain(x.name,'true'):x));
const allocation={deployments:[{id:DEPLOY,created_on:'2026-10-19T14:08:00Z',
 versions:[{version_id:ACTIVE,percentage:100},{version_id:QUOTE,percentage:0}]}]};
const versions={versions:[{id:ACTIVE},{id:QUOTE}]};
const health={status:200,runtime_version:ACTIVE,database_ready:true};
function mock(overrides={}){
 const values={before:allocation,after:allocation,versions,active,quote,health,...overrides};
 const calls=[];
 return {calls,readMetadata:async args=>{
  calls.push(args.join(' '));
  if(args[0]==='deployments'&&args[1]==='list'){
   const nth=calls.filter(x=>x==='deployments list').length;
   if(nth===1)return values.before;
   return values.after;
  }
  if(args[0]==='versions'&&args[1]==='list')return values.versions;
  if(args[2]===ACTIVE)return values.active;
  if(args[2]===QUOTE)return values.quote;
  throw Error('unexpected_metadata_read');
 },readHealth:async id=>{calls.push('health '+id);return values.health;}};
}
let m=mock(),result=await inspect(m);
assert.equal(result.status,'READ_ONLY_RUNTIME_VERIFIED',result.reason);
assert.equal(result.active_version,ACTIVE);
assert.equal(result.quote_percentage,0);
assert.equal(result.read_count,5);
assert.equal(result.authorization_to_activate,false);
assert.deepEqual(m.calls.slice(0,5),[
 'deployments list','versions list','versions view '+ACTIVE,
 'versions view '+QUOTE,'deployments list',
]);
for(const key of ['deployment_requested','upload_requested','traffic_changed',
 'paid_upgrade_requested','migration_requested'])
 assert.equal(result[key],false);
const hold=async(changes,reason)=>{
 const x=await inspect(mock(changes));
 assert.equal(x.status,'HOLD');
 assert.equal(x.reason,reason,x.reason);
 assert.equal(x.authorization_to_activate,false);
};
await hold({before:{deployments:[]}},'metadata_read_incomplete');
await hold({after:{deployments:[{...allocation.deployments[0],
 id:'f6f6f6f6-3333-4333-8333-555555555555'}]}},'allocation_changed_during_read');
await hold({versions:{versions:[{id:ACTIVE}]}},'version_inventory_incomplete');
await hold({active:config(ACTIVE,bindings.map(x=>x.name==='JILL_WORK_CONVERSATION_ENABLED'?
 plain(x.name,'true'):x))},'sensitive_feature_flags_not_off');
await hold({active:config(ACTIVE,bindings.map(x=>x.name==='JILL_ORDER_DESK_WORK_DB'?
 {...x,id:'00000000-0000-4000-8000-000000000000'}:x))},'existing_d1_binding_changed');
await hold({active:config(ACTIVE,bindings.filter(x=>x.name!=='SHOPIFY_API_SECRET'))},'secret_binding_presence_unverified');
await hold({quote:config(QUOTE,bindings)},'quote_canary_identity_unverified');
await hold({health:{...health,database_ready:false}},'runtime_health_unverified');
await hold({active:{...active,id:QUOTE}},'version_metadata_unverified');
const errors=mock();errors.readMetadata=async()=>{throw Error('provider PRIVATE credentials');};
const failed=await inspect(errors);
assert.equal(failed.status,'HOLD');
assert.equal(failed.reason,'metadata_read_incomplete');
assert.equal(JSON.stringify(failed).includes('PRIVATE'),false);
const original=readFileSync('scripts/inspect-work-hq-m1-m2-owner.mjs','utf8');
for(const forbidden of [
 "['versions','upload'","['versions','deploy'","['secret','put'",
 'reserveConnectedAttempt','writeFileSync','git push',
 'migrations apply','d1 execute','r2 bucket create']){
 assert.equal(original.includes(forbidden),false,forbidden);
}
console.log('PASS M1/M2 5-read Cloudflare owner inspection, stable allocation, D1/secret/flag/health, 11 fail-closed cases and no mutations');
