import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditWorkContactReleaseSources,loadAndAudit}
 from './audit-work-contact-paired-release.mjs';
const read=p=>readFileSync(p,'utf8');
const sources={
 hqCanary:JSON.parse(read('services/jill-order-desk/app-home/wrangler.canary.jsonc')),
 publicGateway:read('services/custom-order-cloudflare/wrangler.toml'),
 privateCandidate:read('services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml'),
 hqWorker:read('services/jill-order-desk/app-home/workers/app.ts'),
 gatewayHandler:read('services/custom-order-cloudflare/handler.mjs'),
 storefront:read('theme/sections/main-contact.liquid'),
};
const good=auditWorkContactReleaseSources(sources);
assert.deepEqual(good,loadAndAudit());
assert.equal(good.status,'HOLD');
assert.equal(good.deployment_performed,false);
assert.equal(good.default_hq_manifest_deploy_safe,false);
assert.equal(good.must_preserve_active_hq_bindings_and_secrets,true);
assert.equal(good.commissioned_service_binding,false);
assert.equal(good.contact_customer_flags_authorized,false);
const shouldFail=(patch,reason)=>{
 assert.throws(()=>auditWorkContactReleaseSources({...sources,...patch}),
  new RegExp('work_contact_paired_release_'+reason));
};
shouldFail({hqCanary:{...sources.hqCanary,name:'jill-order-desk-live'}},
 'hq_default_manifest_not_safe_to_stage');
shouldFail({hqCanary:{...sources.hqCanary,vars:{
 ...sources.hqCanary.vars,JILL_WORK_OAUTH_ENABLED:'true',
}}},'hq_default_manifest_not_safe_to_stage');
shouldFail({hqCanary:{...sources.hqCanary,d1_databases:[{
 ...sources.hqCanary.d1_databases[0],database_id:
 '00000000-0000-0000-0000-000000000000',
}]}},'hq_d1_mismatch');
shouldFail({publicGateway:sources.publicGateway+
 '\n[[services]]\nbinding = "EXTRA"\nservice = "other"\n'},
 'public_gateway_scope_changed');
shouldFail({publicGateway:sources.publicGateway+
 '\n[[d1_databases]]\nbinding = "JILL_ORDER_DESK_WORK_DB"\n'},
 'public_gateway_scope_changed');
shouldFail({privateCandidate:sources.privateCandidate.replace(
 'entrypoint = "JillContactPrivate"',
 'entrypoint = "default"')},'private_candidate_scope_changed');
shouldFail({privateCandidate:sources.privateCandidate.replace(
 'service = "jill-order-desk-canary-work"',
 'service = "jill-order-desk-live"')},'private_candidate_scope_changed');
shouldFail({privateCandidate:sources.privateCandidate+
 '\n[[d1_databases]]\nbinding = "DB"\n'},
 'private_candidate_scope_changed');
shouldFail({privateCandidate:sources.privateCandidate+
 '\nJILL_WORK_CONTACT_INTAKE_ENABLED = "true"\n'},
 'contact_flag_enabled_in_source_manifest');
shouldFail({hqCanary:{...sources.hqCanary,vars:{
 ...sources.hqCanary.vars,JILL_WORK_CONTACT_PRIVATE_BRIDGE_ENABLED:'true',
}}},'contact_flag_enabled_in_source_manifest');
shouldFail({gatewayHandler:sources.gatewayHandler.replace(
 "await service.fetch(forwarded)",'await fetch(forwarded)')},
 'gateway_not_isolated_from_d1');
shouldFail({gatewayHandler:sources.gatewayHandler+
 '\nconsole.log(env.JILL_ORDER_DESK_WORK_DB)\n'},
 'gateway_not_isolated_from_d1');
shouldFail({hqWorker:sources.hqWorker.replace(
 'export class JillContactPrivate extends WorkerEntrypoint',
 'class JillContactPrivate extends WorkerEntrypoint')},
 'hq_private_entrypoint_missing');
shouldFail({storefront:sources.storefront.replace(
 'data-jill-work-contact-mode="off"',
 'data-jill-work-contact-mode="qa-enabled"')},
 'storefront_fallback_not_preserved');
console.log('PASS paired WORK Contact release preflight: OAuth live configuration preserved, exact private RPC target, gateway D1 absent, flags OFF, native form safe; rollout HOLD.');
