#!/usr/bin/env node
// Test ACTUAL ACCOUNT theme media renderer against mocked Cloudinary completion.
// No image uploads, external requests, customer data or Shopify writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('assets/jill-custom-order.js','utf8');
const css=fs.readFileSync('assets/jill-forms.css','utf8');
const start=code.indexOf('  function renderMedia(root) {');
const end=code.indexOf('  function initializeMedia(root) {',start);
assert.ok(start>=0 && end>start,'Missing canonical Custom Order media renderer');
const actualMediaCode=code.slice(start,end);

class FakeElement {
  constructor(tag,className='',content=''){
    this.tag=tag; this.className=className; this.textContent=content;
    this.children=[]; this.attributes=new Map(); this.listeners={};
    this.hidden=false; this.disabled=false; this.dataset={};
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(k,v){this.attributes.set(k,v);}
  addEventListener(k,callback){this.listeners[k]=callback;}
}
const element=(tag,cls='',content='')=>new FakeElement(tag,cls,content);
const grid=element('div','jill-media__grid');
const count=element('p','jill-media__count');
const error=element('p','jill-media__error');
const input=element('input');
const drop=element('label','jill-media__drop');
const shell=element('div','jill-media');
const nodes=new Map([
  ['[data-jill-media-grid]',grid],
  ['[data-jill-media-count]',count],
  ['[data-jill-media-error]',error],
  ['[data-jill-media-input]',input],
  ['.jill-media__drop',drop],
  ['[data-jill-media]',shell],
]);
const root={
  dataset:{cloudName:'jill-qa',uploadPreset:'test-preset'},
  querySelector(key){return nodes.get(key)||null;},
};
const state={items:[],uploading:0,error:''};
const requests=[];
const objectUrls=[];
const revoked=[];
let progressCalls=0, imageElements=0;
class FakeFormData {
  constructor(){this.fields=[];}
  append(key,value){this.fields.push([key,value]);}
}
const context={
  mediaState:()=>state,
  uploadedMedia:()=>state.items.filter(item=>item.url),
  node:element,
  validImage:async()=>true,
  readChecked:()=> 'yes',
  syncProgression:()=>{progressCalls++;},
  FormData:FakeFormData,
  URL:{
    createObjectURL(file){const url='blob:complete-'+file.name;objectUrls.push(url);return url;},
    revokeObjectURL(url){revoked.push(url);},
  },
  document:{
    createElement(tag){if(tag==='img')imageElements++;return element(tag);}
  },
  fetch:async(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),
};
const {uploadMedia}=vm.runInNewContext(actualMediaCode+'\n({uploadMedia})',context);
const descendants=node=>[node,...node.children.flatMap(descendants)];
const hasClass=(name)=>descendants(grid).some(n=>n.className===name);
const imageCount=()=>descendants(grid).filter(n=>n.tag==='img').length;
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};

const upload=uploadMedia(root,[{name:'photo.png',size:1024}]);
await flush();
assert.equal(requests.length,1,'Expected one pending Cloudinary request');
assert.equal(state.uploading,1,'Upload must remain pending');
assert.equal(state.items.length,1);
assert.equal(count.textContent,'0 / 3 uploaded');
assert.equal(state.items[0].preview,'','Local thumbnail must not be initialized yet');
assert.equal(objectUrls.length,0,'Object URL must be deferred until remote receipt');
assert.equal(imageElements,0,'No image should be rendered before upload confirmation');
assert.equal(imageCount(),0);
assert.ok(hasClass('jill-media__spinner'),'Spinner must render inside pending photo tile');
assert.ok(hasClass('jill-media__loading-label'),'Loading label must be visible');
assert.equal(grid.children[0].dataset.state,'uploading');
assert.equal(descendants(grid).find(n=>n.className==='jill-media__loading')?.attributes.get('role'),'status');
assert.equal(input.disabled,true,'Do not stack new file selections while uploading');

requests.shift().resolve({ok:true,json:async()=>({secure_url:'https://res.cloudinary.com/jill/image/upload/photo.png',public_id:'qa/photo'})});
await upload;
assert.equal(state.uploading,0,'Successful upload must complete');
assert.equal(state.items[0].status,'Uploaded');
assert.equal(state.items[0].url,'https://res.cloudinary.com/jill/image/upload/photo.png');
assert.equal(objectUrls.length,1,'Only confirmed media is previewed');
assert.equal(imageCount(),1,'Confirmed upload reveals a thumbnail');
assert.equal(descendants(grid).find(n=>n.tag==='img').src,objectUrls[0]);
assert.ok(!hasClass('jill-media__spinner'),'No spinner after successful upload');
assert.equal(count.textContent,'1 / 3 uploaded');
assert.equal(grid.children[0].dataset.state,'uploaded');
assert.ok(progressCalls>0,'Completing upload must reevaluate form progression');

// A failed second upload must never leak its unconfirmed thumbnail.
const failed=uploadMedia(root,[{name:'failed.png',size:1024}]);
await flush();
assert.equal(requests.length,1);
assert.equal(grid.children[1].dataset.state,'uploading');
assert.equal(imageCount(),1,'First confirmed photo stays visible while another loads');
assert.equal(objectUrls.length,1,'Pending second photo is not previewable');
requests.shift().resolve({ok:false,json:async()=>({})});
await failed;
assert.equal(state.items[1].status,'Upload failed');
assert.equal(grid.children[1].dataset.state,'error');
assert.equal(imageCount(),1,'Failed media must not gain a thumbnail');
assert.equal(objectUrls.length,1,'Failed media creates no object URL');
assert.equal(count.textContent,'1 / 3 uploaded');
assert.ok(!hasClass('jill-media__spinner'),'Failed uploads must stop spinning');
assert.ok(state.error.includes('Could not upload failed.png'));

// Removing a confirmed thumbnail reclaims its local URL and refreshes validation.
const firstCard=grid.children[0];
const remove=descendants(firstCard).find(n=>n.className==='jill-media__remove');
assert.equal(typeof remove.listeners.click,'function');
const callsBeforeRemove=progressCalls;
remove.listeners.click();
assert.deepEqual(revoked,[objectUrls[0]]);
assert.equal(progressCalls,callsBeforeRemove+1);
assert.equal(count.textContent,'0 / 3 uploaded');
assert.equal(imageCount(),0);

assert.match(css,/\.jill-media__item\s*\{[\s\S]*?flex:\s*0\s+1\s+8rem;/,
  'Gallery must use compact 8rem tiles, not full-width columns');
assert.match(css,/\.jill-media__spinner\s*\{[\s\S]*?animation:\s*jill-media-spin/);
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
assert.ok(code.includes("reviewNote.textContent === 'Step 4 — Wait for your reference image to finish uploading.'"),
  'Expired uploading warning must be cleared by progression');
console.log('WORK media pending spinner, deferred thumbnail, confirmed/failed upload, compact layout, removal, and review-warning guards PASS.');
