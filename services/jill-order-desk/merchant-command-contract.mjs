// Public UI-safe vocabulary only: NO secrets, Google URLs or Node imports.
// The canonical QA writer independently re-validates every status transition.
export const WORK_STATUS_TRANSITIONS=Object.freeze({
  received:['reviewing','on_hold','cancelled'],
  reviewing:['awaiting_approval','in_production','on_hold','cancelled'],
  awaiting_approval:['reviewing','on_hold','cancelled'],
  in_production:['ready_pickup','on_hold','cancelled'],
  ready_pickup:['completed','on_hold'],
  on_hold:['reviewing','in_production','cancelled'],
  cancelled:[],completed:[],
});
export const WORK_INTERNAL_STAGES=Object.freeze([
  'new','needs_quote','waiting_customer','materials_ordered',
  'proof_revision','printing','assembly','quality_check','ready','none',
]);
