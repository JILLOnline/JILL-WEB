// Local-only authenticated archive command test; never touches real D1.
import assert from 'node:assert/strict';
import {readWorkRemovedRequestIds,handleWorkArchiveWrite}
  from '../services/jill-order-desk/work-request-archive-store.mjs';
const shop='jill-work.myshopify.com';
const id='jill:12345678-aaaa-bbbb-cccc-123456789012';
const authority={shop,environment:'WORK',
  app_client_id:'f8e1ebdbae84490dc8ea5b133637e6c0',
  owner_staff_id:'123',policy_version:1};
const session=(id=123,owner=true)=>({shop,isOnline:true,
  expires:new Date(Date.now()+600000),onlineAccessInfo:{
    associated_user:{id,account_owner:owner},
    associated_user_scope:'read_orders,write_orders'}});
const auth=(id=123,owner=true)=>({admin:async()=>({session:session(id,owner)})});
const source={version:1,operation:'custom_order.merchant.list.result',ok:true,
  shop,complete:true,records:[{submission_id:id,revision:5,
  customer_status:'received',internal_status:'new',
  submitted_at:'2026-10-20T00:00:00Z',
  updated_at:'2026-10-20T00:00:00Z',
  date_needed:'',fulfillment:'pickup',item_count:1}]};
const rows=new Map(),ops=new Map(),sqls=[];
const db={
  prepare(sql){return {bind(...args){return {
    first:async()=>{
      sqls.push(sql);
      if(sql.includes('jill_merchant_authority'))return authority;
      if(sql.includes('jill_merchant_grants'))return null;
      if(sql.includes('archive_operations'))return ops.get(args[1])??null;
      if(sql.includes('jill_work_request_archive'))return rows.get(args[1])??null;
      throw Error('Unexpected SQL');
    },
    all:async()=>{
      sqls.push(sql);
      return {success:true,results:[...rows.entries()]
        .filter(([,r])=>r.is_removed===1)
        .map(([submission_id])=>({submission_id}))};
    },
  };}};},
  batch:async statements=>{
    assert.equal(statements.length,2);
    const [a,b]=statements;
    assert.match(a.sql,/INSERT INTO jill_work_request_archive/);
    assert.match(b.sql,/INSERT INTO jill_work_request_archive_operations/);
    rows.set(a.params[1],{is_removed:a.params[2],last_operation_id:a.params[4]});
    ops.set(b.params[1],{submission_id:b.params[2],
      action:b.params[3],source_revision:b.params[4]});
    sqls.push(a.sql,b.sql);
    return [{success:true},{success:true}];
  },
};
const u='https://work.example/app/requests/archive';
const op=(action,suffix)=>'jill:work:archive:'+action+':'+suffix;
const uuid1='12345678-aaaa-4bbb-8ccc-123456789012';
const uuid2='12345678-aaaa-4bbb-8ccc-123456789013';
const makeRequest=(action,operation,revision='5',origin='https://work.example')=>
  new Request(u,{method:'POST',headers:{origin,
    'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({submission_id:id,source_revision:revision,
      operation_id:operation,action})});
let calls=0;
const invoke=(request,options={})=>handleWorkArchiveWrite({
  request,enabled:true,authenticate:auth(),db,
  readFreshList:async()=>{calls++;return source;},
  now:()=>1792480000000,...options,
});
let r=await invoke(makeRequest('remove',op('remove',uuid1)),{enabled:false});
assert.equal(r.status,503);assert.equal(calls,0);
r=await invoke(makeRequest('remove',op('remove',uuid1)),
  {authenticate:auth(456,false)});
assert.equal(r.status,403);assert.equal(calls,0);
r=await invoke(makeRequest('remove',op('remove',uuid1),'5','https://evil.example'));
assert.equal(r.status,403);assert.equal(calls,0);
r=await invoke(makeRequest('remove',op('remove',uuid1),'4'));
assert.equal(r.status,409);assert.equal(rows.size,0);
r=await invoke(makeRequest('remove',op('remove',uuid1)));
assert.equal(r.status,200);
assert.equal((await r.json()).duplicate,false);
assert.deepEqual(await readWorkRemovedRequestIds({db}),[id]);
r=await invoke(makeRequest('remove',op('remove',uuid1)));
assert.equal(r.status,200);
assert.equal((await r.json()).duplicate,true);
r=await invoke(makeRequest('restore',op('restore',uuid2)));
assert.equal(r.status,200);
assert.deepEqual(await readWorkRemovedRequestIds({db}),[]);
assert.equal(rows.get(id).is_removed,0);
assert.equal(ops.size,2);
for(const sql of sqls)assert.doesNotMatch(sql,/\bDELETE\b|\bDROP\b/i);
console.log('PASS HQ WORK: owner-only audited soft remove/restore, duplicate receipt, origin checks, source revision, zero destructive SQL.');
