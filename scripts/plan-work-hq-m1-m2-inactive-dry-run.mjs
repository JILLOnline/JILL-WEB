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
const ALLOWED_KEYS=new Set([
 'name','main','compatibility_date','compatibility_flags','workers_dev',
 'assets','d1_databases','vars','version_metadata','keep_vars',
 'secrets','send_metrics','observability','triggers','placement',
 'limits','tail_consumers','upload_source_maps','migrations',
 '$schema',
]);
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
    !Array.isArray(compiled.compatibility_flags)||
    !compiled.compatibility_flags.includes('nodejs_compat')||
    !Array.isArray(compiled.d1_databases)||
    compiled.d1_databases.length!==1||
    compiled.d1_databases[0].binding!=='JILL_ORDER_DESK_WORK_DB'||
    compiled.d1_databases[0].database_id!==D1||
    !valid(compiled.assets)||!compiled.assets.directory||
    !valid(compiled.vars))
  return stop('correct_canary_compiled_manifest_required');
 if(Object.keys(compiled).some(k=>!ALLOWED_KEYS.has(k))||
    compiled.kv_namespaces?.length||compiled.r2_buckets?.length||
    compiled.queues?.producers?.length||compiled.queues?.consumers?.length||
    compiled.durable_objects?.bindings?.length)
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
 const manifest=structuredClone(compiled);
 manifest.vars=vars;
 manifest.version_metadata={binding:'CF_VERSION_METADATA'};
 manifest.keep_vars=true;
 manifest.send_metrics=false;
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
