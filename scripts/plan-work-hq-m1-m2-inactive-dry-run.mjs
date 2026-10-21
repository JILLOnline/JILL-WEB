// JILL WORK M1/M2 inactive-version manifest REVIEW ONLY.
// An offline comparison, not an upload/deployment runner. Preview branch
// source edition, existing Worker allocation and exact live bindings are
// checked before permitting a LOCAL --dry-run. Never authorizes upload,
// version activation, data writes, customer communications or any new service.
const ACTIVE='cf8f5b5c-38fb-469d-b10d-89ab3984c44c';
const QUOTE='dbc6341f-de7f-41de-8e97-6bf971201eeb';
const DEPLOY='750af09e-720f-4e17-bae5-57eb190d252d';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const REQUIRE={
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
};
const OFF=[
 'JILL_WORK_QUOTE_CATALOG_REVIEW_ENABLED','JILL_WORK_HQ_PRIVATE_MEDIA_ENABLED',
 'JILL_WORK_HQ_INVOICE_ENABLED','JILL_WORK_HQ_DRAFT_ORDER_CREATE_ENABLED',
 'JILL_WORK_HQ_QUOTE_PUBLICATION_ENABLED','JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED',
];
const SECRETS=new Set([
 'SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
]);
// The Vite/Cloudflare compiler EXPANDS configuration with many empty default
// fields and local build metadata. They must not be passed to Wrangler as
// implicit deployment capabilities. Pin this exact reviewed resolved schema,
// reject any material resources, then PROJECT only approved upload fields.
const GENERATED_KEYS=new Set([
 'agent_memory','ai_search','ai_search_namespaces','analytics_engine_datasets',
 'artifacts','assets','cloudchamber','compatibility_date',
 'compatibility_flags','configPath','connect','d1_databases',
 'definedEnvironments','dev','dispatch_namespaces','durable_objects',
 'exports','flagship','hyperdrive','jsx_factory','jsx_fragment','k2',
 'kv_namespaces','logfwdr','main','migrations','mtls_certificates','name',
 'no_bundle','pipelines','python_modules','queues','r2_buckets','ratelimits',
 'rules','secrets_store_secrets','send_email','services','topLevelName',
 'triggers','unsafe_hello_world','upload_source_maps','userConfigPath',
 'vars','vectorize','vpc_networks','vpc_services','worker_loaders',
 'workers_dev','workflows','version_metadata','keep_vars','send_metrics',
 '$schema',
]);
const RESOURCE_KEYS=new Set([
 'agent_memory','ai_search','ai_search_namespaces','analytics_engine_datasets',
 'artifacts','cloudchamber','connect','dispatch_namespaces','durable_objects',
 'exports','flagship','hyperdrive','k2','kv_namespaces','logfwdr',
 'migrations','mtls_certificates','pipelines','python_modules','queues',
 'r2_buckets','ratelimits','secrets_store_secrets','send_email','services',
 'triggers','unsafe_hello_world','vectorize','vpc_networks','vpc_services',
 'worker_loaders','workflows',
]);
function emptyDefault(value){
 if(value===undefined||value===null||value===false)return true;
 if(Array.isArray(value))return value.every(emptyDefault);
 if(value&&typeof value==='object')
   return Object.values(value).every(emptyDefault);
 return false;
}
// Wrangler's RESOLVED build configuration carries Python-module exclusion
// globs by default, even for a JavaScript-only Worker. Exclusion-only is
// packaging metadata, NOT a Python resource. Never forward it to upload.
function resourceUnused(key,value){
 if(key==='python_modules'&&!emptyDefault(value)){
  return valid(value)&&Object.keys(value).length===1&&
    Array.isArray(value.exclude)&&value.exclude.length<=32&&
    value.exclude.every(p=>typeof p==='string'&&p.length>0&&
      p.length<=256&&!/[\\r\\n\\0]/.test(p));
 }
 return emptyDefault(value);
}
const stop=reason=>Object.freeze({
 state:'held',reason,manifest:null,
 upload_authorized:false,deploy_authorized:false,
 rollback_authorized:false,customer_writes_authorized:false,
 new_paid_resources_authorized:false,
});
const valid=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const byName=arr=>new Map([...arr].map(x=>[x.name,x]));
function allocationVerified(value){
 const versions=value?.versions;
 return value?.deployment===DEPLOY&&Array.isArray(versions)&&versions.length===2&&
  versions.some(x=>x.id===ACTIVE&&x.percentage===100)&&
  versions.some(x=>x.id===QUOTE&&x.percentage===0);
}
/** @param {{compiled?:any,active?:any,quote?:any,allocation?:any}} [options] */
export function planWorkM1M2LocalDryRun({
 compiled,active,quote,allocation,
}={}){
 if(!allocationVerified(allocation))return stop('live_allocation_changed');
 if(active?.id!==ACTIVE||quote?.id!==QUOTE||
    !Array.isArray(active.resources?.bindings)||
    !Array.isArray(quote.resources?.bindings)||
    !Array.isArray(active.resources?.script?.handlers)||
    !Array.isArray(quote.resources?.script?.handlers))
  return stop('version_source_unverified');
 const b=byName(active.resources.bindings);
 if(b.size!==active.resources.bindings.length||
    b.size<10||b.size>35)
  return stop('ambiguous_live_bindings');
 const q=byName(quote.resources.bindings);
 if(q.size!==quote.resources.bindings.length)
  return stop('quote_canary_bindings_unverified');
 if(!Array.isArray(quote.resources.bindings)||!q.has('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED')||
    q.get('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED').type!=='plain_text'||
    q.get('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED').text!=='true')
  return stop('quote_canary_identity_changed');
 // The 0%-allocated historical quote canary is intentionally a DIFFERENT
 // edition and may have older bindings. Preserve its exact ID/allocation.
 // Never attempt to synchronize its secrets, resources or features.
 if(q.size<8||q.size>35)return stop('quote_canary_bindings_unverified');
 if(!valid(compiled)||compiled.name!=='jill-order-desk-canary-work'||
    compiled.workers_dev!==true||
    compiled.compatibility_date!=='2026-10-14'||
    !Array.isArray(compiled.compatibility_flags)||
    !equal(compiled.compatibility_flags,['nodejs_compat'])||
    !['index.js','./index.js'].includes(compiled.main)||
    !Array.isArray(compiled.d1_databases)||
    compiled.d1_databases.length!==1||
    !valid(compiled.d1_databases[0])||
    compiled.d1_databases[0].binding!=='JILL_ORDER_DESK_WORK_DB'||
    compiled.d1_databases[0].database_name!=='jill-order-desk-work'||
    compiled.d1_databases[0].database_id!==D1||
    Object.keys(compiled.d1_databases[0]).some(k=>
      !['binding','database_name','database_id','migrations_dir'].includes(k))||
    (compiled.d1_databases[0].migrations_dir!==undefined&&
      !['../migrations','../../../migrations'].includes(
        compiled.d1_databases[0].migrations_dir))||
    !valid(compiled.assets)||
    compiled.assets.directory!=='../client'||
    Object.keys(compiled.assets).some(k=>k!=='directory')||
    !valid(compiled.vars)||
    compiled.vars.JILL_WORK_HOST_STAGE!=='canary'||
    compiled.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED!=='false'||
    compiled.vars.JILL_WORK_OAUTH_ENABLED!=='false'||
    Object.entries(compiled.vars).some(([k,v])=>
      !/^[A-Z][A-Z0-9_]*$/.test(k)||typeof v!=='string'))
  return stop('correct_canary_compiled_manifest_required');
 if(Object.keys(compiled).some(k=>!GENERATED_KEYS.has(k))||
    [...RESOURCE_KEYS].some(k=>!resourceUnused(k,compiled[k]))||
    (compiled.topLevelName!==undefined&&compiled.topLevelName!==compiled.name))
  return stop('unapproved_compiled_resource');
 const db=b.get('JILL_ORDER_DESK_WORK_DB');
 if(db?.type!=='d1'||(db.id??db.database_id)!==D1)
  return stop('existing_d1_changed');
 if([...SECRETS].some(k=>b.get(k)?.type!=='secret_text'))
  return stop('live_secret_presence_unverified');
 if(b.get('CF_VERSION_METADATA')?.type!=='version_metadata')
  return stop('version_identity_binding_missing');
 const vars={};
 for(const [k,v] of b){
  if(!/^[A-Z][A-Z0-9_]*$/.test(k))
   return stop('unsafe_live_binding_name');
  if(v.type==='plain_text'){
   if(typeof v.text!=='string'||v.text.length>150||
      /[\x00-\x1f\x7f]/.test(v.text))return stop('unsafe_plaintext_binding');
   vars[k]=v.text;
  }else if(v.type==='secret_text'){
   if(!SECRETS.has(k))return stop('unreviewed_secret_binding');
  }else if(v.type==='d1'){
   if(k!=='JILL_ORDER_DESK_WORK_DB')return stop('unreviewed_d1_binding');
  }else if(v.type==='version_metadata'){
   if(k!=='CF_VERSION_METADATA')return stop('unreviewed_runtime_binding');
  }else return stop('unreviewed_active_resource_type');
 }
 for(const [k,v] of Object.entries(REQUIRE))
  if(vars[k]!==v)return stop('required_live_stage_flag_changed');
 for(const k of OFF)
  if(vars[k]!==undefined&&vars[k]!=='false')
   return stop('unsafe_optional_feature_enabled');
 if(Object.keys(compiled.vars).some(k=>k.includes('SECRET')||SECRETS.has(k)))
  return stop('secret_as_plaintext');
 // Preserve all *observed* active plaintext variables exactly. Unobserved
 // customer feature vars stay omitted; never silently switch them on.
 // Deliberately discard every compiler default/metadata field and migration
 // path. They are not approved upload resources. The only D1 is EXISTING.
 const manifest={
   name:compiled.name,main:compiled.main,
   compatibility_date:compiled.compatibility_date,
   compatibility_flags:[...compiled.compatibility_flags],
   workers_dev:true,
   assets:{directory:compiled.assets.directory},
   d1_databases:[{
     binding:'JILL_ORDER_DESK_WORK_DB',
     database_name:'jill-order-desk-work',database_id:D1,
   }],
   vars,version_metadata:{binding:'CF_VERSION_METADATA'},
   keep_vars:true,send_metrics:false,
 };
 // Source edition pins guarantee the CODE. This policy validates only
 // local packaging options; a future uploaded version must be separately
 // compared against exact active binding/runtime metadata before deploy.
 return Object.freeze({state:'LOCAL_DRY_RUN_MANIFEST_PREPARED',
  baseline_deployment:DEPLOY,baseline_active:ACTIVE,
  quote_canary:QUOTE,quote_percentage:0,
  preserved_plaintext_keys:Object.keys(vars).sort(),
  preserved_secret_binding_names:[...SECRETS].sort(),
  original_binding_count:b.size,
  manifest:Object.freeze(manifest),
  upload_authorized:false,deploy_authorized:false,
  rollback_authorized:false,customer_writes_authorized:false,
  new_paid_resources_authorized:false});
}
