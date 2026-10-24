/*
 * JILL WORK QA ONLY — isolated canonical Customer ownership proof.
 * SOURCE ONLY: not referenced by doPost, not published or enabled.
 * A separate QA release must register the operation after certification.
 * Depends on existing WORK script globals: JILL, HEADERS,
 * JILL_CUSTOM_OWNER_HEADERS, JILL_CUSTOM_WORKFLOW,
 * jillWorkHqReadOnlySheet_, jillCustomOrderOwnerHash_,
 * constantTimeEqual_, and json_.
 */
function jillWorkHqOwnerBindingProof_(e) {
  const deny = function() { return json_({version:1,
    operation:'custom_order.merchant.owner_binding.result',ok:false,
    error:{code:'unavailable',retryable:false}}); };
  if (JILL_REWARDS_RUNTIME!=='WORK' || JILL_CUSTOM_ORDER_SANDBOX!==true)
    return deny();
  const p=e&&e.parameter||{}, multi=e&&e.parameters||{};
  const keys=['jill_order_merchant_owner_binding','shop','submission_id',
    'source_revision','jill_hq_read_ts','jill_hq_read_nonce','jill_hq_read_sig'];
  if(Object.keys(p).length!==keys.length || Object.keys(multi).length!==keys.length ||
     keys.some(function(k){return !Object.prototype.hasOwnProperty.call(p,k) ||
       !Array.isArray(multi[k]) || multi[k].length!==1;}) ||
     String(p.jill_order_merchant_owner_binding)!=='1' ||
     p.shop!=='jill-work.myshopify.com' ||
     !/^[A-Za-z0-9._:-]{8,128}$/.test(p.submission_id||'') ||
     !/^(?:[1-9]|[1-9][0-9]|100)$/.test(p.source_revision||'') ||
     !/^[0-9]{13}$/.test(p.jill_hq_read_ts||'') ||
     !/^[A-Za-z0-9_-]{32}$/.test(p.jill_hq_read_nonce||'') ||
     !/^[a-f0-9]{64}$/.test(p.jill_hq_read_sig||''))
    return deny();
  const now=Date.now(), ts=Number(p.jill_hq_read_ts);
  if(Math.abs(now-ts)>120000)return deny();
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('JILL_WORK_OWNER_BINDING_QA_ENABLED')!=='true')
    return deny();
  const secret=String(props.getProperty('JILL_HQ_MERCHANT_READ_SECRET')||'');
  if(secret.length<32)return deny();
  const hmac=function(parts){
    return Utilities.computeHmacSha256Signature(parts.join('\n'),secret)
      .map(function(v){return ('0'+((v+256)%256).toString(16)).slice(-2);})
      .join('');
  };
  const expected=hmac(['merchant_owner_binding_request_v1',
    'jill-work.myshopify.com',p.submission_id,p.source_revision,
    p.jill_hq_read_ts,p.jill_hq_read_nonce]);
  if(!constantTimeEqual_(expected,p.jill_hq_read_sig))return deny();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return deny();
  try {
    const ss=SpreadsheetApp.openById(JILL.SHEET_ID);
    const owners=jillWorkHqReadOnlySheet_(ss,
      JILL_CUSTOM_OWNER_SHEET,JILL_CUSTOM_OWNER_HEADERS);
    const intake=jillWorkHqReadOnlySheet_(ss,JILL.SHEET_NAME,HEADERS);
    const events=jillWorkHqReadOnlySheet_(ss,
      JILL_CUSTOM_WORKFLOW.EVENTS_SHEET,JILL_CUSTOM_WORKFLOW.HEADERS);
    const ownerCount=owners.getLastRow()-1;
    const intakeCount=intake.getLastRow()-1;
    const eventCount=events.getLastRow()-1;
    if(ownerCount<1||ownerCount>5000||
       intakeCount<1||intakeCount>50||eventCount<1||eventCount>500)
      return deny();
    const ownerRows=owners.getRange(2,1,ownerCount,4).getValues();
    if(new Set(ownerRows.map(function(r){return String(r[0]);})).size!==ownerCount)
      return deny();
    const owned=ownerRows.filter(function(r){return String(r[0])===p.submission_id;});
    if(owned.length!==1 ||
      !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(String(owned[0][1])) ||
      !/^[a-f0-9]{64}$/.test(String(owned[0][2])))return deny();
    const rows=intake.getRange(2,1,intakeCount,HEADERS.length).getValues();
    const originals=rows.filter(function(r){
      return String(r[HEADERS.indexOf('submission_id')])===p.submission_id;
    });
    if(originals.length!==1)return deny();
    const raw=String(originals[0][HEADERS.indexOf('raw_payload')]||'');
    if(!raw||raw.length>262144 ||
       jillCustomOrderOwnerHash_(raw)!==String(owned[0][2]))return deny();
    const payload=JSON.parse(raw);
    if(!payload||payload.version!==1||
       payload.operation!=='custom_order.submit'||
       payload.submission_id!==p.submission_id||
       !Array.isArray(payload.items)||payload.items.length<1||
       payload.items.length>500)return deny();
    // Match the canonical merchant-detail intake timestamp invariant.
    // A valid owner hash alone cannot authorize a drifted intake row.
    const submitted=new Date(originals[0][HEADERS.indexOf('submitted_at')]);
    const payloadTime=new Date(payload.submitted_at);
    if(!Number.isFinite(submitted.getTime())||
       !Number.isFinite(payloadTime.getTime())||
       submitted.getTime()!==payloadTime.getTime())return deny();
    const evs=events.getRange(2,1,eventCount,
      JILL_CUSTOM_WORKFLOW.HEADERS.length).getValues();
    let revision=0;
    evs.forEach(function(r){
      if(String(r[1])!==p.submission_id)return;
      const next=Number(r[2]);
      if(!Number.isSafeInteger(next)||next!==revision+1||next>100||
        JILL_CUSTOM_WORKFLOW.STATUSES.indexOf(String(r[3]))<0||
        JILL_CUSTOM_WORKFLOW.INTERNAL.indexOf(String(r[4]))<0)
        throw Error('invalid_revision');
      revision=next;
    });
    if(revision!==Number(p.source_revision))return deny();
    // Consume each challenge once under the script lock. Script Properties
    // contain short-lived nonce hashes only, never customer data.
    const replayPrefix='JILL_WORK_OWNER_PROOF_NONCE_V1_';
    const replayKey=replayPrefix+hmac(['owner_binding_nonce_key_v1',
      p.shop,p.jill_hq_read_nonce]);
    const saved=props.getProperties();
    const stale=[],active=[];
    Object.keys(saved).forEach(function(key){
      if(key.indexOf(replayPrefix)!==0)return;
      const time=Number(saved[key]);
      if(!Number.isSafeInteger(time)||time<1||now-time>300000)
        stale.push(key);
      else active.push(key);
    });
    if(Object.prototype.hasOwnProperty.call(saved,replayKey)||
       active.length>=128)return deny();
    stale.forEach(function(key){props.deleteProperty(key);});
    // Reserve BEFORE signing. Interrupted requests stay consumed.
    props.setProperty(replayKey,String(now));
    const proofTime=Date.now();
    const proof={version:1,operation:'custom_order.merchant.owner_binding.result',
      ok:true,shop:'jill-work.myshopify.com',
      submission_id:p.submission_id,source_revision:revision,
      owner_status:'signed_shopify_customer',
      owner_customer_gid:String(owned[0][1]),
      raw_payload_sha256:String(owned[0][2]),
      verified_at_ms:proofTime,nonce:p.jill_hq_read_nonce};
    proof.signature=hmac(['work_quote_owner_binding_v1',proof.shop,
      proof.submission_id,String(proof.source_revision),
      proof.owner_customer_gid,proof.raw_payload_sha256,
      String(proofTime),proof.nonce]);
    return json_(proof);
  } catch(_error) { return deny(); }
  finally { lock.releaseLock(); }
}
