import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const helper=readFileSync('theme/assets/jill-contact-work-contract.js','utf8');
const dom=readFileSync('theme/assets/jill-contact.js','utf8');
const liquid=readFileSync('theme/sections/main-contact.liquid','utf8');
const layout=readFileSync('theme/layout/theme.liquid','utf8');
const context={globalThis:{}};
vm.runInNewContext(helper,context,{filename:'jill-contact-work-contract.js'});
const contract=context.globalThis.JILLContactWorkContract;
assert.ok(contract);
assert.equal(contract.mayUseWorkAdapter({mode:'off',host:'jill-work.myshopify.com',
 endpoint:'/apps/jill-custom-order/contact'}),false);
assert.equal(contract.mayUseWorkAdapter({mode:'qa-enabled',host:'jillonlinestore.com',
 endpoint:'/apps/jill-custom-order/contact'}),false);
assert.equal(contract.mayUseWorkAdapter({mode:'qa-enabled',host:'jill-work.myshopify.com',
 endpoint:'/apps/jill-custom-order/contact'}),true);
assert.equal(contract.mayUseWorkAdapter({mode:'qa-enabled',host:'jill-work.myshopify.com',
 endpoint:'https://unknown.example.invalid/contact'}),false);
const uuid='11111111-2222-4333-8444-555555555555';
const entries=[
 ['contact[name]','JILL QA'],['contact[email]','qa@example.invalid'],
 ['contact[Phone]',''],['contact[Reason]','shipping'],
 ['contact[body]','Question about the party order'],
 ['contact[Preferred contact]','Email'],
 ['contact[Reviewed details]','Yes'],
 ['contact[Order number]','JILL-123'],
 ['contact[Has reference images]','No'],
 ['contact[Form]','Contact Us'],
];
const payload=contract.normalizedForm(entries,uuid);
assert.equal(payload.ticket_id,'jill:contact:'+uuid);
assert.equal(payload.reason,'shipping');
assert.equal(payload.details.order_number,'JILL-123');
assert.equal(payload.details.reference_images,'No');
assert.equal(payload.reviewed,true);
assert.equal(payload.details.business_name,'');
assert.equal(payload.details.website_area,'');
assert.equal(payload.details.device,'');
assert.equal(payload.email,'qa@example.invalid');
assert.equal(Object.keys(payload.details).length,7);
assert.equal(contract.normalizedForm([...entries].reverse(),uuid).ticket_id,payload.ticket_id);
for(const invalid of [
 [...entries,['contact[email]','another@example.invalid']],
 entries.filter(([key])=>key!=='contact[Reviewed details]'),
 entries.filter(([key])=>key!=='contact[Order number]'),
 entries.map(([key,value])=>[key,key==='contact[Reason]'?'hack':value]),
 entries.map(([key,value])=>[key,key==='contact[body]'?'x'.repeat(3001):value]),
]){
 assert.throws(()=>contract.normalizedForm(invalid,uuid));
}
assert.throws(()=>contract.normalizedForm(entries,'not-a-uuid'));
assert.match(liquid,/data-jill-work-contact-mode="off"/);
assert.match(liquid,/data-jill-work-contact-endpoint="\/apps\/jill-custom-order\/contact"/);
assert.match(liquid,/{% form 'contact'/);
assert.match(layout,/jill-contact-work-contract\.js/);
assert.ok(layout.indexOf('jill-contact-work-contract.js')<
 layout.indexOf('jill-contact.js'));
assert.match(dom,/if \(root\.dataset\.jillWorkContactMode !== 'qa-enabled'\) return/);
assert.match(dom,/event\.preventDefault\(\)/);
assert.match(dom,/pendingWorkTickets\.get\(form\)/);
assert.match(dom,/existing\?\.snapshot === snapshot/);
assert.match(dom,/data\.ticket_id !== record\.ticket_id/);
assert.match(dom,/redirect:'error'/);
assert.doesNotMatch(dom,/localStorage|sessionStorage|logged_in_customer_id/);
console.log('PASS WORK Contact Us frontend: native Shopify default, WORK-only signed child route, reason-specific fields, stable retry ID, no dual send.');
