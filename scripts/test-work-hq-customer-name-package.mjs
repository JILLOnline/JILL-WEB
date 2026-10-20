// Offline CI: only two UI blobs changed, previous one-use receipts stay spent.
import assert from 'node:assert/strict';
import {CUSTOMER_NAME_PACKAGE_FILES,CUSTOMER_NAME_PACKAGE_BLOBS,
  checkWorkHqCustomerNamePackage,customerNamePackageManifest}
  from './work-hq-customer-name-package.mjs';
import {WORKSPACE_LAYOUT_DRAFT_BLOBS}
  from './work-hq-workspace-layout-draft.mjs';
import {DENSITY_RUNTIME_BASE} from './work-hq-density-package.mjs';
import {WORKSPACE_LAYOUT_PROFILE} from './release-work-hq-workspace-layout-owner.mjs';
const approved=checkWorkHqCustomerNamePackage();
assert.equal(approved.reviewed_files,13);
assert.equal(approved.owner_verified_customer_name,true);
assert.equal(approved.no_provider_changes,true);
const m=customerNamePackageManifest();
assert.equal(m.runtime_baseline,DENSITY_RUNTIME_BASE);
assert.deepEqual([...CUSTOMER_NAME_PACKAGE_FILES].sort(),Object.keys(m.files).sort());
for(const digest of Object.values(m.files))assert.match(digest,/^[a-f0-9]{64}$/);
for(const [file,prior] of Object.entries(WORKSPACE_LAYOUT_DRAFT_BLOBS)){
  const current=CUSTOMER_NAME_PACKAGE_BLOBS[file];
  if(['services/jill-order-desk/app-home/app/routes/app.requests.tsx',
      'services/jill-order-desk/app-home/app/styles/inbox.css'].includes(file))
    assert.notEqual(current,prior,'Customer identity visual blob must be new');
  else assert.equal(current,prior,'Unreviewed file changed: '+file);
}
assert.equal(WORKSPACE_LAYOUT_PROFILE.receiptStem,'work-hq-workspace-layout-v1');
assert.equal(WORKSPACE_LAYOUT_PROFILE.testCommand,'test:work-hq-workspace-layout-release');
console.log('PASS HQ WORK: 13-file frozen UI package; only inbox card TSX/CSS differ; prior one-use release untouched. Source only.');
