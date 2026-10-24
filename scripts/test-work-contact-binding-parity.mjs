import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareHqWorkContactCandidate,compareGatewayWorkContactCandidate,
 prepareWorkContactOauthOnly} from './plan-work-contact-binding-parity.mjs';

const base=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
const gateway=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml','utf8');
const bind=(name,type,extra={})=>({name,type,...extra});
const HQ_ACTIVE={resources:{bindings:[
 bind('JILL_ORDER_DESK_WORK_DB','d1',{
  id:'3f17c186-c794-4e00-8f20-017191373a19'}),
 bind('JILL_WORK_HOST_STAGE','plain_text',{text:'canary'}),
 bind('JILL_WORK_OAUTH_ENABLED','plain_text',{text:'true'}),
 bind('JILL_WORK_OWNER_BOOTSTRAP_ENABLED','plain_text',{text:'false'}),
 bind('SHOPIFY_API_SECRET','secret_text'),
 bind('JILL_WORK_SESSION_KEY_B64','secret_text'),
]}};
const GATEWAY_ACTIVE={resources:{bindings:[
 bind('RATE_LIMITER','durable_object_namespace'),
 bind('SHOPIFY_WORK_APP_SECRET','secret_text'),
 bind('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
 bind('JILL_CUSTOM_ORDER_QA_BACKEND_URL','secret_text'),
 bind('CF_VERSION_METADATA','version_metadata'),
]}};
const candidate=prepareWorkContactOauthOnly(base);
assert.equal(candidate.name,'jill-order-desk-canary-work');
assert.equal(candidate.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(base.vars.JILL_WORK_OAUTH_ENABLED,'false');
const good=compareHqWorkContactCandidate({
 activeView:HQ_ACTIVE,compiled:base,
});
assert.equal(good.status,'HOLD');
assert.equal(good.candidate_plaintext_parity,true);
assert.equal(good.secret_values_verified,false);
assert.equal(good.upload_or_deployment_authorized,false);
assert.equal(good.canary_config_ready_for_upload,
 'requires_separate_release_and_secret_continuity_approval');
const driftView={resources:{bindings:[
 ...HQ_ACTIVE.resources.bindings,
 bind('JILL_WORK_HQ_DETAIL_ENABLED','plain_text',{text:'true'}),
]}};
const drift=compareHqWorkContactCandidate({
 activeView:driftView,compiled:base,
});
assert.equal(drift.candidate_plaintext_parity,false);
assert.deepEqual(drift.missing_or_changed_plaintext_names,
 ['JILL_WORK_HQ_DETAIL_ENABLED']);
assert.equal(drift.canary_config_ready_for_upload,'NO');
const unsupported=compareHqWorkContactCandidate({
 activeView:{resources:{bindings:[
  ...HQ_ACTIVE.resources.bindings,
  bind('EXTERNAL_QUEUE','queue'),
 ]}},compiled:base,
});
assert.deepEqual(unsupported.unsupported_active_binding_names,
 ['EXTERNAL_QUEUE']);
assert.equal(unsupported.canary_config_ready_for_upload,'NO');
for(const [label,view] of [
 ['OAuth off',{resources:{bindings:HQ_ACTIVE.resources.bindings.map(x=>
  x.name==='JILL_WORK_OAUTH_ENABLED'?{...x,text:'false'}:x)}}],
 ['secret missing',{resources:{bindings:HQ_ACTIVE.resources.bindings.filter(x=>
  x.name!=='SHOPIFY_API_SECRET')}}],
 ['wrong DB',{resources:{bindings:HQ_ACTIVE.resources.bindings.map(x=>
  x.type==='d1'?{...x,id:'00000000-0000-0000-0000-000000000000'}:x)}}],
 ['contact ON',{resources:{bindings:[...HQ_ACTIVE.resources.bindings,
  bind('JILL_WORK_CONTACT_INBOX_ENABLED','plain_text',{text:'true'})]}}],
 ]){
 assert.throws(()=>compareHqWorkContactCandidate({
  activeView:view,compiled:base,
 }),/work_contact_binding_parity_/,label);
}
assert.throws(()=>prepareWorkContactOauthOnly({
 ...base,vars:{...base.vars,JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED:'true'},
}),/work_contact_binding_parity_contact_flag_in_candidate/);
const gatewayGood=compareGatewayWorkContactCandidate({
 activeView:GATEWAY_ACTIVE,candidateManifestText:gateway,
});
assert.equal(gatewayGood.status,'HOLD');
assert.equal(gatewayGood.named_service_binding_in_candidate,true);
assert.equal(gatewayGood.candidate_inherits_secrets_unverified,true);
assert.deepEqual(gatewayGood.active_other_binding_names_to_preserve,
 ['JILL_CUSTOM_ORDER_QA_BACKEND_URL']);
assert.equal(gatewayGood.private_d1_in_gateway,false);
for(const [label,view] of [
 ['missing limiter',{resources:{bindings:GATEWAY_ACTIVE.resources.bindings.filter(x=>
  x.name!=='RATE_LIMITER')}}],
 ['unexpected public D1',{resources:{bindings:[...GATEWAY_ACTIVE.resources.bindings,
  bind('JILL_ORDER_DESK_WORK_DB','d1')]}}],
 ['contact flag active',{resources:{bindings:[...GATEWAY_ACTIVE.resources.bindings,
  bind('JILL_WORK_CONTACT_CLAIM_ENABLED','plain_text',{text:'true'})]}}],
 ]){
 assert.throws(()=>compareGatewayWorkContactCandidate({
  activeView:view,candidateManifestText:gateway,
 }),/work_contact_binding_parity_/,label);
}
assert.throws(()=>compareGatewayWorkContactCandidate({
 activeView:GATEWAY_ACTIVE,
 candidateManifestText:gateway.replace(
  'entrypoint = "JillContactPrivate"','entrypoint = "default"'),
}),/work_contact_binding_parity_gateway_candidate_target_drift/);
console.log('PASS WORK Contact active-binding parity planner: exact HQ OAuth/D1/vars and gateway secret/limiter preservation; fail-closed on drift, always HOLD.');
