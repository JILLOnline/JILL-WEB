// Optional WORK-only shared D1 index of already verified NINE merchant
// metadata fields. Never a credential/auth shortcut. Call ONLY AFTER
// Shopify online Owner + WORK D1 authorization has already succeeded.
// Source authority remains the signed Google QA reader.
//
// Opt-in OFF by default. Requires migration 0003 on the exact WORK D1
// before enabling via a separately reviewed Worker manifest/release.
import {projectWorkMerchantInbox}
  from './merchant-inbox-read.mjs';

export const WORK_INBOX_D1_TTL_MS=60_000;
const SHOP='jill-work.myshopify.com';
const MAX_JSON_BYTES=64*1024;
const QUERY='SELECT generation,verified_payload_json,verified_at_ms,expires_at_ms '+
  'FROM jill_work_verified_inbox_index WHERE shop=?';
const STORE='UPDATE jill_work_verified_inbox_index SET '+
  'verified_payload_json=?,verified_at_ms=?,expires_at_ms=? '+
  'WHERE shop=? AND generation=? AND verified_at_ms<=?';
const INVALIDATE='UPDATE jill_work_verified_inbox_index SET '+
  'generation=generation+1,verified_payload_json=NULL,'+
  'verified_at_ms=0,expires_at_ms=0 WHERE shop=?';

function fail(){throw Error('invalid_work_inbox_index');}
function modelToSignedList(value){
  const projected=projectWorkMerchantInbox(value);
  return Object.freeze({
    version:1,operation:'custom_order.merchant.list.result',
    ok:true,complete:true,shop:SHOP,records:projected.records,
  });
}
function clockValue(now){
  const t=now();
  if(!Number.isSafeInteger(t)||t<0)fail();
  return t;
}
function validIndexRow(row){
  if(!row || !Number.isSafeInteger(row.generation)||
    row.generation<0||!Number.isSafeInteger(row.verified_at_ms)||
    row.verified_at_ms<0||!Number.isSafeInteger(row.expires_at_ms)||
    row.expires_at_ms<0 ||
    (row.verified_payload_json!==null &&
     typeof row.verified_payload_json!=='string'))fail();
  return row;
}
export async function invalidateWorkD1InboxIndex(db){
  if(typeof db?.prepare!=='function')fail();
  const done=await db.prepare(INVALIDATE).bind(SHOP).run();
  if(!done?.success || done.meta?.changes!==1)fail();
  return true;
}
export async function readWorkD1IndexedMerchantList({
  db,readCanonicalSource,now=Date.now,forceFresh=false,onCache=()=>{},
}={}){
  if(typeof db?.prepare!=='function'||
    typeof readCanonicalSource!=='function'||typeof now!=='function'||
    typeof onCache!=='function'||typeof forceFresh!=='boolean')fail();
  const begun=clockValue(now);
  const row=validIndexRow(await db.prepare(QUERY).bind(SHOP).first());
  if(!forceFresh && row.verified_payload_json &&
    row.verified_at_ms<=begun && row.expires_at_ms>begun) {
    if(Buffer.byteLength(row.verified_payload_json,'utf8')>MAX_JSON_BYTES)fail();
    let parsed;
    try {parsed=JSON.parse(row.verified_payload_json);}catch{fail();}
    const source=modelToSignedList(parsed);
    onCache('d1-hit');
    return source;
  }
  onCache(forceFresh?'d1-forced':'d1-miss');
  const fetched=await readCanonicalSource({shop:SHOP});
  // Reject and strip all upstream non-whitelisted fields BEFORE D1 writes.
  const verified=modelToSignedList(fetched);
  const json=JSON.stringify(verified);
  if(Buffer.byteLength(json,'utf8')>MAX_JSON_BYTES)fail();
  const at=clockValue(now);
  // A confirmed status write increments generation, so a pre-write read
  // cannot repopulate the D1 row. Later concurrent refresh wins.
  try {
    await db.prepare(STORE).bind(
      json,at,at+WORK_INBOX_D1_TTL_MS,SHOP,
      row.generation,begun,
    ).run();
  } catch {
    // Canonical Google read is still valid; index warming is best effort.
    // We never show cached unverified content to the Owner on this path.
    onCache('d1-warm-failed');
  }
  return verified;
}
