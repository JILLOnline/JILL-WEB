import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 proposeHqPreviewDisabledManifest,reviewPairedPreviewLockdown,
} from './plan-work-contact-preview-lockdown.mjs';

const original=JSON.parse(readFileSync(
 'services/jill-order-desk/app-home/wrangler.canary.jsonc','utf8'));
original.vars={...original.vars,
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
original.secrets={required:[
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
]};
const gateway=readFileSync(
 'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml',
 'utf8');
const unchanged=JSON.stringify(original);
const proposal=proposeHqPreviewDisabledManifest(original);
assert.equal(proposal.status,'HOLD');
assert.equal(proposal.manifest.preview_urls,false);
assert.equal(proposal.manifest.workers_dev,true);
assert.equal(proposal.manifest.vars.JILL_WORK_OAUTH_ENABLED,'true');
assert.equal(proposal.manifest.vars.JILL_WORK_MERCHANT_WRITES_ENABLED,'true');
assert.equal(proposal.manifest.vars.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED,'false');
assert.deepEqual(proposal.changed_keys,['preview_urls']);
assert.equal(proposal.release_authorized,false);
assert.equal(JSON.stringify(original),unchanged);
assert.notEqual(proposal.original_digest,proposal.proposed_digest);
const settings={
 hq:{enabled:true,previews_enabled:true},
 gateway:{enabled:true,previews_enabled:true},
};
const exposed=reviewPairedPreviewLockdown({
 subdomains:settings,hqOriginal:original,
 hqProposed:proposal.manifest,gatewayCandidate:gateway,
});
assert.equal(exposed.status,'HOLD');
assert.deepEqual(exposed.version_urls_currently_enabled_on,['hq','gateway']);
assert.equal(exposed.current_preview_exposure_gate_cleared,false);
assert.equal(exposed.requires_explicit_setting_change_authorization,true);
assert.equal(exposed.configuration_changes_performed,false);
assert.equal(exposed.paid_services_enabled,false);
assert.equal(exposed.upload_or_deployment_authorized,false);
assert.equal(exposed.keep_both_workers_dev_routes,true);
assert.equal(exposed.requires_new_artifact_fingerprint,true);
const disabled=reviewPairedPreviewLockdown({
 subdomains:{hq:{enabled:true,previews_enabled:false},
  gateway:{enabled:true,previews_enabled:false}},
 hqOriginal:original,hqProposed:proposal.manifest,
 gatewayCandidate:gateway,
});
assert.equal(disabled.current_preview_exposure_gate_cleared,true);
assert.equal(disabled.upload_or_deployment_authorized,false);
assert.equal(disabled.requires_explicit_setting_change_authorization,false);
function fail(hq,reason){
 assert.throws(()=>proposeHqPreviewDisabledManifest(hq),
  new RegExp('work_contact_preview_lockdown_'+reason));
}
fail({...original,workers_dev:false},'hq_scope_or_preview_conflict');
fail({...original,preview_urls:true},'hq_scope_or_preview_conflict');
fail({...original,name:'jill-order-desk-live'},'hq_scope_or_preview_conflict');
fail({...original,d1_databases:[{
 ...original.d1_databases[0],database_id:'WRONG'}]},
 'hq_private_work_d1_changed');
fail({...original,vars:{...original.vars,JILL_WORK_OAUTH_ENABLED:'false'}},
 'hq_oauth_or_contact_scope_unsafe');
fail({...original,vars:{...original.vars,JILL_WORK_CONTACT_INTAKE_ENABLED:'true'}},
 'hq_oauth_or_contact_scope_unsafe');
fail({...original,secrets:{required:[
 'SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64']}},
 'hq_secret_names_changed');
fail({...original,services:[{service:'unsafe'}]},
 'hq_unexpected_service_binding');
function reviewFail(options,reason){
 assert.throws(()=>reviewPairedPreviewLockdown({
  subdomains:settings,hqOriginal:original,
  hqProposed:proposal.manifest,gatewayCandidate:gateway,...options,
 }),new RegExp('work_contact_preview_lockdown_'+reason));
}
reviewFail({hqProposed:{...proposal.manifest,
 vars:{...proposal.manifest.vars,JILL_WORK_MERCHANT_WRITES_ENABLED:'false'}}},
 'hq_lockdown_diff_unapproved');
reviewFail({subdomains:{...settings,
 hq:{enabled:false,previews_enabled:true}}},
 'workers_dev_or_preview_state_unknown');
reviewFail({gatewayCandidate:gateway.replace(
 'preview_urls = false','preview_urls = true')},
 'gateway_preview_candidate_unverified');
reviewFail({gatewayCandidate:gateway.replace(
 'workers_dev = true','workers_dev = false')},
 'gateway_preview_candidate_unverified');
reviewFail({gatewayCandidate:gateway.replace(
 'entrypoint = "JillContactPrivate"','entrypoint = "default"')},
 'gateway_preview_candidate_unverified');
reviewFail({subdomains:{hq:settings.hq}},
 'current_preview_observation_missing');
console.log('PASS WORK preview lockdown proposal: both public Version URL settings require separate approval, workers.dev stays ON, HQ candidate differs only preview_urls=false, gateway unshipped, traffic/upload HOLD.');
