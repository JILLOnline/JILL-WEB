import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs','utf8');
const start=source.indexOf('function parsePayload_(e) {');
const end=source.indexOf('function firstName_(name) {',start);
assert.ok(start>=0&&end>start);
const {parsePayload_,isValidEmail_}=vm.runInNewContext(source.slice(start,end)+'\n({parsePayload_,isValidEmail_})');
const customer='shopper+tag@example.com';
const raw=JSON.stringify({email:customer,theme:'Blue + pink & gold'});
const values={source:'JILL custom order',name:'QA Test Customer',email:customer,raw_payload:raw,notes:'A + B & C=4'};
const encoded=new URLSearchParams(values).toString();
const parsed=parsePayload_({postData:{type:'application/x-www-form-urlencoded;charset=UTF-8',contents:encoded}});
for(const key of Object.keys(values))assert.equal(parsed[key],values[key],key+' changed');
assert.equal(isValidEmail_(parsed.email),true);
assert.equal(JSON.parse(parsed.raw_payload).email,customer);
assert.equal(parsePayload_({postData:{type:'application/json',contents:raw}}).email,customer);
console.log('Apps Script form parser round-trips literal plus, spaces, percent encoding and JSON.');
