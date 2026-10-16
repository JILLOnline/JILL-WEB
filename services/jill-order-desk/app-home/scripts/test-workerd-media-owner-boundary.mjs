// WORK Phase 21 — real local D1 Owner policy + disabled media HTTP handler.
// Synthetic Shopify SDK session objects ONLY inside a unit harness; the
// production route statically wires real Shopify.authenticate.admin().
// No deployed Worker, real Shopify tokens, Google/R2 writes, customer files.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestHarness} from 'wrangler';
import {JILL_WORK_MERCHANT_CLIENT_ID}
  from '../../../../backend/jill-merchant-auth.mjs';
import {workAppHomeOrigin}
  from '../../shopify-host/sdk-config.mjs';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../../merchant-request-detail.mjs';
import {handleWorkPrivateMediaOwnerInspect as inspect,
  WORK_PRIVATE_MEDIA_INSPECT_PATH as PATH}
  from '../../work-private-media-owner-boundary.mjs';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const APP=resolve(ROOT,'services/jill-order-desk/app-home');
const SRC=resolve(ROOT,'services/jill-order-desk');
const CONF=resolve(APP,'workerd-phase19/wrangler.jsonc');
const cf=JSON.parse(readFileSync(CONF,'utf8'));
const SHOP='jill-work.myshopify.com';
const FAKE_DB='00000000-0000-4000-8000-000000000019';
const REAL_DB='3f17c186-c794-4e00-8f20-017191373a19';
const origin=workAppHomeOrigin('canary');
const submission='jill:11111111-2222-4333-8444-555555555555';
const itemId='shopify-product:101';
const active=['0001_staff_authority.sql',
  '0002_shopify_sessions.sql','0003_work_verified_inbox_index.sql'];
assert.equal(cf.name,'jill-work-phase19-local-media-only');
assert.equal(cf.workers_dev,false);
assert.equal(cf.d1_databases.length,1);
assert.equal(cf.d1_databases[0].database_id,FAKE_DB);
assert.equal(cf.d1_databases[0].remote,false);
assert.equal(cf.r2_buckets.length,1);
assert.equal(cf.r2_buckets[0].remote,false);
assert.notEqual(FAKE_DB,REAL_DB);
assert.deepEqual(readdirSync(resolve(SRC,'migrations')).sort(),active);
for(const confName of ['wrangler.jsonc','wrangler.canary.jsonc']){
  const config=JSON.parse(readFileSync(resolve(APP,confName),'utf8'));
  assert.equal(config.r2_buckets,undefined);
  assert.equal(config.images,undefined);
  assert.equal(config.d1_databases[0].database_id,REAL_DB);
  assert.equal(config.vars.JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED,undefined);
}
const route=readFileSync(resolve(APP,
  'app/routes/app.requests.media.inspect.tsx'),'utf8');
const routes=readFileSync(resolve(APP,'app/routes.ts'),'utf8');
const ingress=readFileSync(resolve(APP,'workers/app.ts'),'utf8');
assert.match(route,/handleWorkPrivateMediaOwnerInspect/);
assert.match(route,/workShopify\(env\)\.authenticate\.admin\(incoming\)/);
assert.match(route,/authenticateWorkAdminOnce/);
assert.match(route,/readWorkGoogleQaMerchantDetail/);
assert.match(route,/JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED==="true"/);
assert.match(route,/JILL_WORK_HQ_DETAIL_ENABLED==="true"/);
assert.match(routes,/requests\/media\/inspect/);
assert.match(ingress,/url\.pathname==="/app\/requests\/media\/inspect"/);
const boundary=readFileSync(resolve(SRC,
  'work-private-media-owner-boundary.mjs'),'utf8');
assert.doesNotMatch(boundary,
  /\.put\(|\.get\(|\.delete\(|\.batch\(|createSignedUrl|\.upload\(|\bfetch\(/);
assert.ok(boundary.includes('private_media_storage_not_connected'));

const payload={
  version:1,operation:'custom_order.submit',submission_id:submission,
  submitted_at:'2026-10-16T12:00:00Z',
  customer:{name:'Synthetic Merchant',email:'owner@example.invalid'},
  planning:{fulfillment:'pickup'},
  items:[{item_id:itemId,product_id:itemId,quantity:1,
    attributes:[],personalization_groups:[],
    reference_ids:['jill:synthetic-reference-001']}],
  request_attributes:[],reference_ids:[],
};
const detail=project({rawPayload:JSON.stringify(payload),
  submissionId:submission,revision:1,ownerAuthorized:true});
const session=(id='101',accountOwner=true,shop=SHOP,online=true,expires)=>
  ({shop,isOnline:online,onlineAccessInfo:{
    associated_user:{id,account_owner:accountOwner},
    associated_user_scope:'',
  },...(expires===undefined?{}:{expires})});
const fields=()=>new URLSearchParams({
  submission_id:submission,scope:'item',item_id:itemId,index:'0',
});
const request=(overrides={})=>{
  const {path=PATH,method='POST',where=origin,
    form=fields(),requestOrigin=origin,...rest}=overrides;
  return new Request(where+path,{method,headers:{
    'origin':requestOrigin,
    'content-type':'application/x-www-form-urlencoded',
  },...(method==='POST'?{body:form}:{}) ,...rest});
};
const harness=createTestHarness({
  root:APP,workers:[{configPath:CONF}],
});
let running=false;
try{
  await harness.listen();running=true;
  const worker=harness.getWorker(cf.name);
  const env=await worker.getEnv();
  const db=env.JILL_PHASE19_SYNTHETIC_D1;
  assert.ok(db?.prepare);
  // The live D1 permission adapter is exercised against real local D1
  // schema and entries rather than a stubbed 'allowed: true' role flag.
  const raw=readFileSync(resolve(SRC,
    'migrations/0001_staff_authority.sql'),'utf8');
  const uncommented=raw.split(/\\r?\\n/)
    .filter(line=>!line.trim().startsWith('--')).join('\\n');
  for(const sql of uncommented.split(';').map(s=>s.trim())
    .filter(Boolean).map(s=>s+';')){
    // Leading SQL comments are removed before splitting because
    // D1 .exec() fails on isolated '--' lines.
    await db.prepare(sql).run();
  }

  let authCalls=0,readCalls=0;
  let activeSession=session();
  let signedDetail=detail;
  const authenticate=async ()=>{
    authCalls++;
    if(activeSession===null)throw Error('guest_has_no_shopify_session');
    return {session:activeSession};
  };
  const readExactDetail=async ({submissionId})=>{
    readCalls++;
    assert.equal(submissionId,submission);
    return signedDetail;
  };
  const run=async ({req=request(),stage='canary',enabled=true,
    dbOverride=db,authOverride=authenticate,readOverride=readExactDetail}={})=>{
    const response=await inspect({
      request:req,stage,enabled,db:dbOverride,
      authenticate:authOverride,readExactDetail:readOverride,
    });
    assert.equal(response.headers.get('cache-control'),
      'private, no-store, max-age=0');
    const data=await response.json();
    assert.equal(data.ok,false);
    assert.equal(Object.hasOwn(data,'url'),false);
    assert.equal(Object.hasOwn(data,'object_key'),false);
    assert.equal(Object.hasOwn(data,'customer'),false);
    assert.equal(Object.hasOwn(data,'reference_id'),false);
    return {status:response.status,code:data.code};
  };
  async function caseCheck(expected,options={}){
    const result=await run(options);
    assert.deepEqual(result,expected);
  }
  // Disabled mode does NO authentication, body processing or Google read.
  await caseCheck({status:503,code:'private_media_not_enabled'},
    {enabled:false});
  await caseCheck({status:503,code:'private_media_not_enabled'},
    {stage:'work'});
  assert.equal(authCalls,0);assert.equal(readCalls,0);
  await caseCheck({status:405,code:'method_not_allowed'},
    {req:request({method:'GET'})});
  await caseCheck({status:404,code:'not_found'},
    {req:request({where:'https://foreign.example'})});
  await caseCheck({status:404,code:'not_found'},
    {req:request({path:PATH+'?unexpected=1'})});
  await caseCheck({status:403,code:'invalid_origin'},
    {req:request({requestOrigin:'https://foreign.example'})});
  await caseCheck({status:415,code:'unsupported_media_type'},
    {req:new Request(origin+PATH,{method:'POST',
      headers:{origin,'content-type':'application/json'},
      body:JSON.stringify({})})});
  assert.equal(authCalls,0);assert.equal(readCalls,0);

  // No WORK D1 authority record => fail closed even if Shopify owner.
  await caseCheck({status:503,code:'owner_authority_unavailable'});
  assert.equal(authCalls,1);assert.equal(readCalls,0);

  await db.prepare(
    'INSERT INTO jill_merchant_authority '+
    '(shop,environment,app_client_id,owner_staff_id,owner_bound_at) '+
    'VALUES (?,?,?,?,?)'
  ).bind(SHOP,'WORK',JILL_WORK_MERCHANT_CLIENT_ID,
    '101','2026-10-16T11:00:00Z').run();
  await db.prepare(
    'INSERT INTO jill_merchant_grants '+
    '(shop,staff_id,role,active,capabilities_json,'+
    'issued_by_staff_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(SHOP,'202','administrator',1,'[]','101',
    '2026-10-16T11:00:00Z','2026-10-16T11:00:00Z').run();

  // Real owner is authorized to inspect canonical reference provenance,
  // but storage and previews are ALWAYS disconnected.
  await caseCheck({status:503,code:'private_media_storage_not_connected'});
  assert.equal(readCalls,1);
  // Staff with legitimate D1 administrator grant is still NOT the owner.
  activeSession=session('202',false);
  const readsBeforeStaff=readCalls;
  await caseCheck({status:403,code:'access_denied'});
  assert.equal(readCalls,readsBeforeStaff);
  // Fake owner flag on a different staff ID cannot bypass D1.
  activeSession=session('303',true);
  await caseCheck({status:403,code:'access_denied'});
  assert.equal(readCalls,readsBeforeStaff);
  activeSession=session('101',false);
  await caseCheck({status:403,code:'access_denied'});
  assert.equal(readCalls,readsBeforeStaff);
  activeSession=session('101',true,'jillonlinestore.myshopify.com');
  await caseCheck({status:403,code:'access_denied'});
  activeSession=session('101',true,SHOP,false);
  await caseCheck({status:403,code:'access_denied'});
  activeSession=session('101',true,SHOP,true,new Date(0));
  await caseCheck({status:403,code:'access_denied'});
  activeSession=null;
  await caseCheck({status:403,code:'access_denied'});
  assert.equal(readCalls,readsBeforeStaff);

  activeSession=session();
  // No request-supplied customer ID/email/phone/role/shop/token
  // can act as ownership proof. The caller cannot claim a foreign
  // request by posting a guessed contact value.
  const unexpected=[
    'email','phone','customer_id','role','shop','file_url','upload',
    'reference_id','session','customer_email',
  ];
  for(const name of unexpected){
    const form=fields();form.set(name,'forged@user.invalid');
    await caseCheck({status:400,code:'invalid_media_input'},
      {req:request({form})});
  }
  for(const form of [
    new URLSearchParams([
      ['submission_id',submission],['submission_id',submission],
      ['scope','item'],['item_id',itemId],['index','0'],
    ]),
    new URLSearchParams({
      submission_id:submission,scope:'item',item_id:itemId,index:'20',
    }),
    new URLSearchParams({
      submission_id:submission,scope:'item',item_id:itemId,index:'0',
      extra:'not-allowed',
    }),
    new URLSearchParams({
      submission_id:submission,scope:'request',item_id:itemId,index:'0',
    }),
    new URLSearchParams({
      submission_id:submission,scope:'item',item_id:itemId,index:'a',
    }),
    new URLSearchParams({
      submission_id:submission,scope:'item',item_id:itemId,index:'0',
      note:'x'.repeat(1200),
    }),
  ]){
    await caseCheck({status:400,code:'invalid_media_input'},
      {req:request({form})});
  }
  assert.equal(readCalls,readsBeforeStaff);

  // Canonical source must match the exact chosen request, item and slot.
  // In particular, even an Owner cannot attach artwork to a reference
  // falsely claimed to belong to a DIFFERENT customer/request.
  signedDetail={...detail,submission_id:'jill:foreign-customer-request'};
  await caseCheck({status:404,code:'not_found'});
  signedDetail=detail;
  const unknownItem=new URLSearchParams({
    submission_id:submission,scope:'item',
    item_id:'shopify-product:cross-customer',index:'0',
  });
  await caseCheck({status:404,code:'not_found'},
    {req:request({form:unknownItem})});
  const badIndex=new URLSearchParams({
    submission_id:submission,scope:'item',item_id:itemId,index:'1',
  });
  await caseCheck({status:404,code:'not_found'},
    {req:request({form:badIndex})});
  const unsupported={...detail,items:[{
    ...detail.items[0],
    reference_ids:['https://res.cloudinary.com/legacy/image/upload/a.png'],
  }]};
  signedDetail=unsupported;
  await caseCheck({status:404,code:'not_found'});
  signedDetail=detail;
  await caseCheck({status:503,code:'verified_request_unavailable'},
    {readOverride:async()=>{throw Error('signed_google_source_unavailable');}});
  await caseCheck({status:503,code:'owner_authority_unavailable'},
    {dbOverride:null});

  assert.equal((await worker.fetch(origin+'/__media_privacy')).status,404);
  console.log('PASS WORK Phase 21 local merchant media authorization: OFF default, exact canary origin/CSRF, real Shopify online-session shape + real synthetic D1 Owner policy, signed exact-reference gate, guest/staff/foreign-shop/customer-claim invalid inputs rejected, 0 uploads/previews.');
}catch(error){
  console.error('STOP WORK Phase 21 local Owner media authorization: '+
    String(error?.message||'unverified').slice(0,420));
  process.exitCode=1;
}finally{
  if(running)await harness.close();
}
