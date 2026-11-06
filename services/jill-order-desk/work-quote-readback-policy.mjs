// WORK HQ: quote reload guard, pure and source-only.
// This is NOT a permission check or proof that the remote D1 draft exists.
// The authenticated read handler verifies the saved row and original source.
// Acknowledged Save revision is a minimum readback fence: an older response
// must never unlock the next write or replace unsaved prices.
import {validWorkQuotePendingSave} from './work-quote-save-flight.mjs';
/** @param {{
  readCode?:string|null,
  restored?:{state:string,draftRevision:number}|null,
  acknowledgedRevision?:number|null,
  merchantEdited?:boolean,
  explicitReload?:boolean,
  pendingSave?:any,reconciliation?:any
}} [options] */
export function inspectWorkQuoteReload({
  readCode,
  restored,
  acknowledgedRevision=null,
  merchantEdited=false,
  explicitReload=false,
  pendingSave=null,reconciliation=null,
}={}){
  const hold=code=>Object.freeze({state:'hold',code});
  // A revision alone cannot settle an uncertain operation, even when the
  // Owner explicitly asks to replace local inputs with an older draft.
  if(pendingSave!==null){
    if(!validWorkQuotePendingSave(pendingSave))return hold('invalid_pending_operation');
    if(reconciliation?.operation_id!==pendingSave.operationId||
       reconciliation.expected_draft_revision!==pendingSave.expectedDraftRevision||
       !['committed','not_applied'].includes(reconciliation.state)||
       restored?.draftRevision<pendingSave.expectedDraftRevision+1||
       !Number.isSafeInteger(restored?.draftRevision))
      return hold('pending_operation_unresolved');
  }
  if(acknowledgedRevision!==null&&(
    !Number.isSafeInteger(acknowledgedRevision)||
    acknowledgedRevision<1||acknowledgedRevision>100))
    return hold('invalid_acknowledged_revision');
  if(typeof merchantEdited!=='boolean'||typeof explicitReload!=='boolean')
    return hold('invalid_editor_state');
  if(readCode==='no_saved_draft')
    return acknowledgedRevision===null
      ?Object.freeze({state:'none',code:'no_saved_draft'})
      :hold('acknowledged_draft_not_visible');
  if(readCode!=='draft_ready'||!restored||
    restored.state!=='verified_draft_restore'||
    !Number.isSafeInteger(restored.draftRevision)||
    restored.draftRevision<1||restored.draftRevision>100)
    return hold('unverified_readback');
  if(acknowledgedRevision!==null&&
    restored.draftRevision<acknowledgedRevision)
    return hold('stale_draft_readback');
  if(merchantEdited&&!explicitReload)
    return hold('unsaved_editor_changes');
  if(acknowledgedRevision!==null&&
    restored.draftRevision!==acknowledgedRevision&&!explicitReload)
    return hold('different_draft_revision');
  return Object.freeze({state:'apply',code:'verified_draft_readback',
    draftRevision:restored.draftRevision});
}
