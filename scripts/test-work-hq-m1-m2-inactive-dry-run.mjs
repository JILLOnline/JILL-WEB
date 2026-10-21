import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {planWorkM1M2LocalDryRun as plan}
 from '../scripts/plan-work-hq-m1-m2-inactive-dry-run.mjs';
const ACTIVE='cf8f5b5c-38fb-469d-b10d-89ab3984c44c',
 QUOTE='dbc6341f-de7f-41de-8e97-6bf971201eeb';
const plain=(name,text)=>({name,type:'plain_text',text});
const secrets=['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET']
 .map(name=>({name,type:'secret_text'}));
const bindings=[
 plain('JILL_WORK_HOST_STAGE','canary'),
 plain('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','false'),
 plain('JILL_WORK_OAUTH_ENABLED','true'),
 plain('JILL_WORK_MERCHANT_WRITES_ENABLED','true'),
 plain('JILL_WORK_HQ_DETAIL_ENABLED','true'),
 plain('JILL_WORK_CATALOG_ENABLED','true'),
 plain('JILL_WORK_CONVERSATION_ENABLED','false'),
 plain('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED','false'),
 ...secrets,
 {name:'JILL_ORDER_DESK_WORK_DB',type:'d1',
  id:'3f17c186-c794-4e00-8f20-017191373a19'},
 {name:'CF_VERSION_METADATA',type:'version_metadata'},
];
const active={id:ACTIVE,resources:{bindings,script:{handlers:['fetch']}}};
const quote={id:QUOTE,resources:{bindings:bindings.map(x=>x.name===
 'JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'?plain(x.name,'true'):x),
 script:{handlers:['fetch']}}};
const allocation={deployment:'750af09e-720f-4e17-bae5-57eb190d252d',
 versions:[{id:ACTIVE,percentage:100},{id:QUOTE,percentage:0}]};
const compiled={name:'jill-order-desk-canary-work',workers_dev:true,
 compatibility_date:'2026-10-14',compatibility_flags:['nodejs_compat'],
 assets:{directory:'../client'},main:'index.js',
 vars:{JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',JILL_WORK_OAUTH_ENABLED:'false'},
 d1_databases:[{binding:'JILL_ORDER_DESK_WORK_DB',
 database_name:'jill-order-desk-work',
 database_id:'3f17c186-c794-4e00-8f20-017191373a19'}]};
const data={active,quote,allocation,compiled};
const x=plan(data);
assert.equal(x.state,'LOCAL_DRY_RUN_MANIFEST_PREPARED',x.reason);
assert.equal(x.baseline_active,ACTIVE);
assert.equal(x.manifest.keep_vars,true);
assert.equal(x.manifest.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(x.manifest.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED,'false');
assert.equal(x.preserved_secret_binding_names.length,4);
assert.equal(x.upload_authorized,false);
assert.equal(x.deploy_authorized,false);
assert.equal(x.new_paid_resources_authorized,false);
assert.equal(JSON.stringify(x.manifest).includes('secret values'),false);
const deny=(field,next,reason)=>{
 const z=structuredClone(data);z[field]=next;
 const observed=plan(z);
 assert.equal(observed.state,'held',JSON.stringify(observed));
 assert.equal(observed.reason,reason);
 assert.equal(observed.manifest,null);
};
deny('allocation',{...allocation,deployment:'00000000-0000-4000-8000-000000000000'},'live_allocation_changed');
deny('active',{...active,id:'00000000-0000-4000-8000-000000000000'},'version_source_unverified');
deny('active',{...active,resources:{...active.resources,
 bindings:[...bindings,{name:'R2_MEDIA',type:'r2_bucket',bucket_name:'private'}]}},'unreviewed_active_resource_type');
deny('quote',{...quote,resources:{...quote.resources,
 bindings:quote.resources.bindings.map(x=>x.name==='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED'?
 plain(x.name,'false'):x)}},'quote_canary_identity_changed');
deny('compiled',{...compiled,name:'jill-order-desk-work'},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,r2_buckets:[{binding:'NEW',bucket_name:'new-bucket'}]},'unapproved_compiled_resource');
const emptyResource=plan({...data,compiled:{...compiled,r2_buckets:[],queues:{producers:[],consumers:[]},triggers:{crons:[]},migrations:[]}});
assert.equal(emptyResource.state,'LOCAL_DRY_RUN_MANIFEST_PREPARED',emptyResource.reason);
for(const key of ['r2_buckets','queues','triggers','migrations'])
 assert.equal(Object.hasOwn(emptyResource.manifest,key),false);
const inertPython=plan({...data,compiled:{...compiled,
 python_modules:{exclude:['**/*.py']}}});
assert.equal(inertPython.state,'LOCAL_DRY_RUN_MANIFEST_PREPARED',inertPython.reason);
assert.equal(Object.hasOwn(inertPython.manifest,'python_modules'),false);
deny('compiled',{...compiled,python_modules:{include:['generated.py']}},'unapproved_compiled_resource');
deny('compiled',{...compiled,r2_buckets:[{binding:'NEW'}]},'unapproved_compiled_resource');
deny('compiled',{...compiled,triggers:{crons:['* * * * *']}},'unapproved_compiled_resource');
deny('compiled',{...compiled,migrations:[{tag:'unapproved'}]},'unapproved_compiled_resource');
deny('compiled',{...compiled,routes:[]},'unapproved_compiled_resource');
deny('compiled',{...compiled,observability:{enabled:true}},'unapproved_compiled_resource');
deny('compiled',{...compiled,main:'../unreviewed.js'},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,assets:{directory:'../../outside'}},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,assets:{directory:'../client',run_worker_first:true}},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,compatibility_flags:['nodejs_compat','unreviewed_feature']},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,compatibility_date:'2027-01-01'},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,d1_databases:[{...compiled.d1_databases[0],remote:true}]},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,vars:{...compiled.vars,JILL_WORK_HOST_STAGE:'live'}},'correct_canary_compiled_manifest_required');
deny('compiled',{...compiled,vars:{...compiled.vars,JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'true'}},'correct_canary_compiled_manifest_required');
deny('active',{...active,resources:{...active.resources,
 bindings:bindings.filter(x=>x.name!=='SHOPIFY_API_SECRET')}},'live_secret_presence_unverified');
deny('active',{...active,resources:{...active.resources,bindings:bindings.map(x=>
 x.name==='JILL_WORK_CONVERSATION_ENABLED'?plain(x.name,'true'):x)}},'required_live_stage_flag_changed');
console.log('PASS M1/M2 inactive LOCAL-only manifest: exact active allocation/binding parity, D1/secrets/OFF flags, R2/unknown rejection; no upload/deploy.');
if(process.argv.includes('--compiled-canary')){
  assert.equal(process.argv.length,3,'Unknown test arguments');
  const file=new URL('../services/jill-order-desk/app-home/dist/server/wrangler.json',import.meta.url);
  const fromBuild=JSON.parse(readFileSync(file,'utf8'));
  const observed=plan({...data,compiled:fromBuild});
  if(observed.state!=='LOCAL_DRY_RUN_MANIFEST_PREPARED'){
    // Diagnostic is limited to public *schema* and three non-secret build
    // stage flags. Never print full Worker bindings, tokens or config.
    console.error('CANARY_BUILD_SCHEMA_REVIEW',JSON.stringify({
      reason:observed.reason,
      // Generated fields ONLY. List material resource keys without values,
      // secrets, customer data, or serialized connection objects.
      possibly_material_resource_keys:Object.entries(fromBuild)
        .filter(([key])=>[
          'agent_memory','ai_search','ai_search_namespaces','analytics_engine_datasets',
          'artifacts','cloudchamber','connect','dispatch_namespaces','durable_objects',
          'exports','flagship','hyperdrive','k2','kv_namespaces','logfwdr',
          'migrations','mtls_certificates','pipelines','python_modules','queues',
          'r2_buckets','ratelimits','secrets_store_secrets','send_email','services',
          'triggers','unsafe_hello_world','vectorize','vpc_networks','vpc_services',
          'worker_loaders','workflows'
        ].includes(key))
        .filter(([,value])=>{
          const empty=x=>x===undefined||x===null||x===false||
            Array.isArray(x)&&x.every(empty)||
            x&&typeof x==='object'&&!Array.isArray(x)&&
              Object.values(x).every(empty);
          return !empty(value);
        }).map(([key,value])=>({key,kind:Array.isArray(value)?'array':typeof value,
          keys:value&&typeof value==='object'&&!Array.isArray(value)?
            Object.keys(value).sort():[],
          item_count:Array.isArray(value)?value.length:undefined})),
      top_level_keys:Object.keys(fromBuild).sort(),
      main:fromBuild.main,
      compatibility_date:fromBuild.compatibility_date,
      compatibility_flags:fromBuild.compatibility_flags,
      workers_dev:fromBuild.workers_dev,
      assets:{keys:Object.keys(fromBuild.assets||{}).sort(),
        directory:fromBuild.assets?.directory,
        binding:fromBuild.assets?.binding,
        run_worker_first:fromBuild.assets?.run_worker_first},
      d1:(fromBuild.d1_databases||[]).map(db=>({
        keys:Object.keys(db).sort(),
        binding:db.binding,
        name_matches:db.database_name==='jill-order-desk-work',
        id_matches:db.database_id==='3f17c186-c794-4e00-8f20-017191373a19',
        migrations_dir:db.migrations_dir})),
      stage_flags:{
        JILL_WORK_HOST_STAGE:fromBuild.vars?.JILL_WORK_HOST_STAGE,
        JILL_WORK_OWNER_BOOTSTRAP_ENABLED:fromBuild.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,
        JILL_WORK_OAUTH_ENABLED:fromBuild.vars?.JILL_WORK_OAUTH_ENABLED
      }
    }));
  }
  assert.equal(observed.state,'LOCAL_DRY_RUN_MANIFEST_PREPARED',
    'Actual compiled WORK canary manifest held: '+observed.reason);
  assert.equal(observed.manifest.name,'jill-order-desk-canary-work');
  assert.equal(observed.manifest.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED,'false');
  assert.equal(observed.manifest.vars.JILL_WORK_CONVERSATION_ENABLED,'false');
  assert.equal(observed.manifest.keep_vars,true);
  assert.equal(observed.deploy_authorized,false);
  assert.equal(observed.upload_authorized,false);
  console.log('PASS ACTUAL canary compiled manifest against synthetic verified WORK bindings; manifest-only, no remote Cloudflare operation.');
}
