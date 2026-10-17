// WORK Phase 33: actual compiled canary Worker, synthetic LOCAL workerd.
// Exercise the newly added media ingress while its flag stays ABSENT.
// Never authenticate against a real Shopify shop or call Google, Cloudflare
// remote, D1 remote, R2, checkout, LIVE or KEEP. Not v34 byte parity.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestHarness} from 'wrangler';
import {prepareWorkHqV34LocalUi}
  from '../../../../scripts/prepare-work-hq-v34-ui-local.mjs';

const APP=fileURLToPath(new URL('../',import.meta.url));
const basePath=join(APP,'dist/server/wrangler.json');
const ORIGIN='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const MEDIA='/app/requests/media/inspect';
const STOP=code=>{throw Error('work_hq_v35_media_off_'+code);};
if(!existsSync(basePath))STOP('compiled_canary_missing');

let source,local;
try{
  source=JSON.parse(readFileSync(basePath,'utf8'));
  local=prepareWorkHqV34LocalUi(source);
}catch{STOP('compiled_manifest_unverified');}
if(local.deployment_authorized!==false||
   local.cloudflare_version_uploaded!==false||
   local.storage_activation_authorized!==false)
  STOP('permission_violation');
const candidate=structuredClone(local.candidate);
if(candidate.name!=='jill-order-desk-canary-work'||
   candidate.vars?.JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED!==undefined||
   candidate.vars?.JILL_WORK_OAUTH_ENABLED!=='true'||
   candidate.vars?.JILL_WORK_HQ_DETAIL_ENABLED!=='true'||
   candidate.vars?.JILL_WORK_MERCHANT_WRITES_ENABLED!=='true'||
   candidate.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED!=='false')
  STOP('media_or_security_flags_changed');
// Force emulated D1: no remote provider database is reachable.
if(candidate.d1_databases?.length!==1||
   candidate.d1_databases[0]?.remote===true)
  STOP('remote_d1_unsafe');
candidate.d1_databases[0].remote=false;
const temp=join(dirname(basePath),'wrangler.phase33-media-off-'+
  randomUUID()+'.json');
let harness,opened=false;
try{
  writeFileSync(temp,JSON.stringify(candidate),{
    flag:'wx',encoding:'utf8',mode:0o600,
  });
  harness=createTestHarness({
    root:APP,
    workers:[{configPath:temp,secrets:{
      SHOPIFY_API_SECRET:'SYNTHETIC_SHOPIFY_LOCAL_PHASE33_NEVER_REAL_123',
      JILL_WORK_SESSION_KEY_B64:Buffer.alloc(32,33).toString('base64'),
      JILL_HQ_MERCHANT_READ_SECRET:'SYNTHETIC_READ_LOCAL_PHASE33_NEVER_REAL_123',
      JILL_HQ_MERCHANT_WRITE_SECRET:'SYNTHETIC_WRITE_LOCAL_PHASE33_NEVER_REAL_123',
    }}],
  });
  await harness.listen();opened=true;
  const worker=harness.getWorker(candidate.name);
  const env=await worker.getEnv();
  assert.equal(env.JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED,undefined);
  assert.equal(env.JILL_WORK_HQ_DETAIL_ENABLED,'true');
  assert.equal(env.JILL_WORK_MERCHANT_WRITES_ENABLED,'true');
  assert.equal(env.JILL_WORK_OWNER_BOOTSTRAP_ENABLED,'false');
  assert.equal(env.JILL_WORK_OAUTH_ENABLED,'true');
  assert.equal(env.JILL_WORK_HOST_STAGE,'canary');
  assert.equal(env.JILL_WORK_INTAKE_LEDGER_ENABLED,undefined);
  assert.equal(env.JILL_WORK_PRIVATE_MEDIA_BUCKET,undefined);
  const db=env.JILL_ORDER_DESK_WORK_DB;
  assert.ok(db?.prepare,'emulated D1 missing');
  for(const table of [
    'jill_merchant_audit','jill_merchant_authority',
    'jill_merchant_grants','jill_shopify_sessions',
  ])await db.prepare('CREATE TABLE IF NOT EXISTS '+table+
    ' (id INTEGER PRIMARY KEY)').run();
  assert.equal((await worker.fetch(ORIGIN+'/healthz')).status,200);
  let cases=0;
  async function deny(path,init,status,code){
    const response=await worker.fetch(ORIGIN+path,{
      redirect:'manual',...init,
    });
    assert.equal(response.status,status,'unexpected status for '+path);
    assert.equal(response.headers.get('cache-control'),
      'private, no-store, max-age=0');
    assert.equal(response.headers.get('location'),null);
    const data=await response.json();
    assert.deepEqual(data,{ok:false,error:code});
    cases++;
  }
  await deny(MEDIA,{method:'GET'},503,'private_media_not_enabled');
  await deny(MEDIA,{method:'POST',headers:{
    Origin:ORIGIN,'Content-Type':'application/x-www-form-urlencoded',
  },body:'probe=1'},503,'private_media_not_enabled');
  await deny(MEDIA,{method:'POST',headers:{
    'Content-Type':'application/x-www-form-urlencoded',
  },body:'probe=1'},403,'invalid_origin');
  await deny(MEDIA,{method:'POST',headers:{
    Origin:'https://evil.example',
    'Content-Type':'application/x-www-form-urlencoded',
  },body:'probe=1'},403,'invalid_origin');
  await deny('/app/requests/command',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'probe=1'},403,'invalid_origin');
  const wrong=await worker.fetch('https://jillonlinestore.com'+MEDIA,{
    method:'POST',headers:{Origin:'https://jillonlinestore.com',
      'Content-Type':'application/x-www-form-urlencoded'},body:'probe=1',
    redirect:'manual',
  });
  assert.equal(wrong.status,421);
  assert.deepEqual(await wrong.json(),{ok:false,error:'wrong_host'});
  cases++;
  console.log('PASS WORK Phase33 LOCAL compiled Worker: '+cases+
    ' anonymous/media-OFF/Origin/foreign-host denials; exact v34 security flags; emulated D1 and synthetic keys only.');
  console.log('HOLD: deployed v34 Worker/asset byte provenance, signed-in Owner mutation and release approval NOT verified.');
}catch{
  console.error('STOP WORK Phase33 LOCAL compiled Worker boundary unverified.');
  process.exitCode=1;
}finally{
  if(opened)await harness.close().catch(()=>{process.exitCode=1;});
  if(existsSync(temp))unlinkSync(temp);
}
