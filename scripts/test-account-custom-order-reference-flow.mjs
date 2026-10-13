#!/usr/bin/env node
// Exercise the actual WORK form reference handlers without real image uploads,
// Shopify page publication, customer information or external network requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('assets/jill-custom-order.js','utf8');
const section=fs.readFileSync('sections/main-custom-order.liquid','utf8');
const fragment=(from,to)=>{
  const start=code.indexOf('  function '+from+'(');
  const end=code.indexOf('  function '+to+'(',start);
  assert.ok(start>=0&&end>start,'Missing actual reference handler: '+from);
  return code.slice(start,end);
};
const handlers=fragment('syncReferenceRequirement','syncProductVisibility');
const no={
  checked:true,disabled:true,
  attrs:new Map(),
  setAttribute(name,value){this.attrs.set(name,value);},
  removeAttribute(name){this.attrs.delete(name);},
};
const note={hidden:true};
const root={querySelector(sel){
  if(sel==='[data-jill-reference-choice][value="no"]')return no;
  if(sel==='[data-jill-reference-requirement]')return note;
  return null;
}};
let required=true,choice='no',uploads=[],uploading=0;
const context={
  referenceRequired:()=>required,
  readChecked:()=>choice,
  mediaState:()=>({uploading,items:uploads}),
  uploadedMedia:()=>uploads.filter(x=>x.url),
  setVisible:(element,visible)=>{element.hidden=!visible;},
};
const {syncReferenceRequirement,referenceReady}=vm.runInNewContext(
  handlers+'\n({syncReferenceRequirement,referenceReady})',context);
syncReferenceRequirement(root);
assert.equal(no.disabled,false,'No must remain selectable, even when selected item requires an image');
assert.equal(no.checked,true,'No choice must never be silently cleared');
assert.equal(note.hidden,false,'Required reference notice must be visible');
assert.equal(no.attrs.get('aria-describedby'),'JillReferenceRequirement');
assert.equal(no.attrs.get('aria-invalid'),'true');
assert.equal(referenceReady(root),false,'No must not bypass genuinely required reference images');

// Selecting Yes and uploading an image makes the requirement complete.
choice='yes';no.checked=false;uploads=[{url:'https://res.cloudinary.com/jill/image/upload/sample.jpg'}];
syncReferenceRequirement(root);
assert.equal(referenceReady(root),true,'Successful upload must complete required references');
// In-flight uploads are not yet a valid receipt.
uploading=1;
assert.equal(referenceReady(root),false,'Pending upload must not count');
uploading=0;
uploads=[];
assert.equal(referenceReady(root),false,'Removing last uploaded image must re-lock progression');
// A product change can make references optional; No must then be valid.
required=false;choice='no';no.checked=true;
syncReferenceRequirement(root);
assert.equal(note.hidden,true);
assert.equal(no.disabled,false);
assert.equal(no.attrs.has('aria-invalid'),false);
assert.equal(referenceReady(root),true);

assert.ok(code.includes('state.items.splice(index, 1);\n        state.error = \'\';\n        renderMedia(root);\n        // Synthetic change is dispatched from the section'),
  'Removing media must refresh the form state');
assert.ok(code.includes('renderMedia(root);\n        // Upload callbacks are asynchronous;'), 'Async upload completion must explicitly refresh progression');
assert.match(code,/\/\/ Upload callbacks are asynchronous;[\s\S]{0,190}syncProgression\(root\);/);
assert.match(code,/\/\/ Recalculate stages directly so removing an image can relock Step 5\.[\s\S]{0,70}syncProgression\(root\);/);
assert.ok(!code.includes('no.disabled = required'),'Required flag must never disable No');
assert.ok(code.includes('note.textContent = issue.message;'),'Review must describe exact incomplete step');
assert.ok(code.includes('scrollToTarget(issue.target);'),'Review must scroll to offending control');
for(const step of ['Step 1','Step 2','Step 3','Step 4','Step 5','Step 6']){
  assert.ok(code.includes(step+' —'),'Review must identify '+step);
}
assert.ok(section.includes('id="JillReferenceRequirement"'),'Screen readers must find reference note');
assert.ok(section.includes('data-jill-review-validation-note role="status" aria-live="polite"'),
  'Review errors must announce new status');
console.log('WORK reference No/Yes required/optional, uploaded/pending/removed media, progression callbacks and actionable review diagnostics PASS.');
