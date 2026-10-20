// Master HQ V4 WORK source certification + offline quote/messaging invariants.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {certifyJillMasterHqV4} from './work-hq-master-v4-edition.mjs';
const result=certifyJillMasterHqV4();
assert.equal(result.changed_source_files,21);
assert.equal(result.historical_release_guards_untouched,true);
const actions=fs.readFileSync('services/jill-order-desk/app-home/app/components/WorkRequestQuickActions.tsx','utf8');
const inbox=fs.readFileSync('services/jill-order-desk/app-home/app/routes/app.requests.tsx','utf8');
const messages=fs.readFileSync('services/jill-order-desk/app-home/app/routes/app.messages.tsx','utf8');
const owned=fs.readFileSync('extensions/jill-account-dashboard/src/pages/Messages.jsx','utf8');
const css=fs.readFileSync('services/jill-order-desk/app-home/app/styles/inbox.css','utf8');
for(const [source,regexp,reason] of [
  [actions,/jill-actions__direct-buttons/,'Original actions not preserved'],
  [actions,/createPortal\(/,'V4 portal missing'],
  [actions,/operation\.current="jill:hq:"\+kind/,'Operation ID writer changed'],
  [actions,/action:"\/app\/requests\/command"/,'Canonical command endpoint removed'],
  [actions,/verifiedMerchantMessageAcknowledgment/,'Merchant receipt validation removed'],
  [inbox,/jill-inbox__editor-slot/,'Request editor slot missing'],
  [inbox,/editorHost=\{editorHost\}/,'Editor host missing'],
  [inbox,/aria-expanded=\{detailsOpen\}/,'Accessible order details removed'],
  [css,/\.jill-inbox__editor-slot:empty/,'Empty editor row not collapsed'],
  [messages,/WorkRequestQuickActions/,'HQ reply composer missing'],
  [owned,/RequestConversation/,'My JILL reply component missing'],
 ])assert.match(source,regexp,reason);
for(const script of [
 'scripts/test-work-hq-quote-messaging-hold.mjs',
 'scripts/test-work-hq-inbox-quote-next-hold.mjs',
 'scripts/test-work-hq-quote-worksheet.mjs',
 'scripts/test-work-quote-commerce-handoff.mjs',
 'scripts/test-work-message-inboxes.mjs',
]){
  execFileSync(process.execPath,[script],{stdio:'inherit',timeout:90000});
}
console.log('PASS NEW Master HQ V4 edition: exactly 21 SHA-verified source files, scoped UI, quote guards and shared HQ/My JILL message contracts; no mutation.');
