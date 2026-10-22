import assert from 'node:assert/strict';
import {auditWorkQuoteArtworkReferences as audit}
 from '../services/jill-order-desk/work-quote-artwork-audit.mjs';
const id='jill:artwork-source-00001';
const secret='https://example.com/customer-personal-private-file.png?token=NOLEAK';
const detail={submission_id:id,revision:3,attachment_state:'unresolved',
 reference_ids:['request-ref-PRIVATE'],items:[
  {item_id:'item-one',reference_ids:[secret,'item-secret-ref']},
  {item_id:'item-two',reference_ids:[]},
 ]};
const view=audit({detail,submissionId:id,sourceRevision:3});
assert.equal(view.state,'owner_private_media_verification_required');
assert.equal(view.references,3);
assert.equal(view.request_references,1);
assert.deepEqual(view.items.map(x=>x.reference_count),[2,0]);
for(const forbidden of ['NOLEAK','PRIVATE','request-ref','item-one',
  'item-secret-ref','https://','token','file.png']){
 assert.equal(JSON.stringify(view).includes(forbidden),false);
}
assert.equal(view.private_storage_verified,false);
assert.equal(view.preview_enabled,false);
assert.equal(view.can_publish,false);
const clear=audit({detail:{...detail,reference_ids:[],
 items:detail.items.map(x=>({...x,reference_ids:[]}))},
 submissionId:id,sourceRevision:3});
assert.equal(clear.state,'no_submitted_references');
assert.equal(clear.references,0);
assert.equal(clear.private_storage_verified,false);
const bad=(replacement,sourceRevision=3)=>audit({
 detail:replacement,submissionId:id,sourceRevision});
assert.equal(bad(detail,4).state,'held');
assert.equal(bad({...detail,attachment_state:'verified'}).state,'held');
assert.equal(bad({...detail,reference_ids:['']}).state,'held');
assert.equal(bad({...detail,items:[{...detail.items[0],reference_ids:[null]}]}).state,'held');
assert.equal(bad({...detail,items:[]}).state,'held');
assert.equal(bad({...detail,items:[{item_id:'bad/name',reference_ids:[]}]}).state,'held');
console.log('PASS M2 signed source artwork audit, request/item counts, private link suppression, no preview/publication');
