const JILL = {
  SOURCE: 'JILL custom order',
  STORE_URL: 'https://jillonlinestore.com',
  STORE_EMAIL: 'info@jillonlinestore.com',
  SHEET_NAME: 'Submissions',
  SHEET_ID: '1xVG4Jvh-vLB6BH5QitNcLQuaLj6DkXeSlFHg_LkECT8',
  SHOPIFY_API_VERSION: '2026-07'
};

// False in canonical production and WORK Rewards builds. Only the dedicated
// isolated Custom Orders QA bundle may change this to true.
const JILL_CUSTOM_ORDER_SANDBOX = false;

const HEADERS = [
  'submission_id',
  'status',
  'submitted_at',
  'name',
  'email',
  'phone',
  'preferred_contact',
  'event_date',
  'date_needed',
  'fulfillment',
  'city',
  'state',
  'zip',
  'theme',
  'colors',
  'collections',
  'products',
  'reference_images',
  'marketing_consent',
  'marketing_consent_at',
  'marketing_consent_source',
  'raw_payload'
];


/* ---------------------------
   RUN THIS ONCE MANUALLY
---------------------------- */

function setupJill() {
  if (JILL_REWARDS_RUNTIME === 'WORK' && !JILL_CUSTOM_ORDER_SANDBOX) {
    throw new Error('WORK Rewards worker cannot access the Custom Order sheet.');
  }
  const ss = SpreadsheetApp.openById(JILL.SHEET_ID);
  let sheet = ss.getSheetByName(JILL.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(JILL.SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  ensureHeaders_(sheet);

  const url = 'https://docs.google.com/spreadsheets/d/' + JILL.SHEET_ID;
  Logger.log('JILL lead sheet: ' + url);
  return url;
}


/* ---------------------------
   WEB APP
---------------------------- */

function doGet(e) {
  if (JILL_CUSTOM_ORDER_SANDBOX) {
    return ContentService.createTextOutput('JILL WORK Custom Orders QA online.')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  if (e && e.parameter && e.parameter.code) {
    return handleShopifyOAuthCallback_(e);
  }

  // Permanent read-only rewards watchdog. This endpoint is intentionally safe
  // to call without a shared secret: it reports operational health only.
  // All repair, synchronization and reconciliation are owned by internal
  // scheduled maintenance, never by an external health request.
  if (
    e &&
    e.parameter &&
    clean_(e.parameter.jill_rewards_watchdog) === '1'
  ) {
    try {
      return json_(runJillRewardsWatchdog_());
    } catch (err) {
      console.error(
        'JILL Rewards watchdog failed: ' +
        (err && err.stack ? err.stack : err)
      );
      return json_({
        ok: false,
        watchdog: true,
        engine_version: JILL_REWARDS_ENGINE_VERSION,
        build_sha: JILL_REWARDS_BUILD_SHA,
        error: String(err)
      });
    }
  }

  return ContentService
    .createTextOutput('JILL Custom Order Automation is online.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  // Private WORK QA account-list operation. Never a public guest lookup.
  if (clean_(e && e.parameter && e.parameter.jill_order_customer_list) === '1') {
    return jillCustomOrderGatewayCustomerList_(e);
  }
  // Restricted server-to-server proof of an already-persisted request.
  // NOT a public customer lookup and NOT a status mutation.
  if (clean_(e && e.parameter && e.parameter.jill_order_receipt) === '1') {
    return jillCustomOrderGatewayReceipt_(e);
  }
  const lock = LockService.getScriptLock();
  const suppliedRewardSecret = clean_(
    e && e.parameter ? e.parameter.jill_rewards_hook : ''
  );
  const suppliedRewardTopic = clean_(
    e && e.parameter ? e.parameter.jill_rewards_topic : ''
  );
  // Mark only successfully authenticated Rewards deliveries for retryable
  // failure handling. An unauthenticated POST must not enter that path.
  let verifiedRewardHook = false;

  // An isolated WORK Rewards deployment does not accept Custom Order writes.
  if (JILL_REWARDS_RUNTIME === 'WORK') {
    if (JILL_CUSTOM_ORDER_SANDBOX && (suppliedRewardSecret || suppliedRewardTopic)) {
      return json_({ok:false,error:'Custom Order QA project does not accept Rewards webhooks.'});
    }
    if (!JILL_CUSTOM_ORDER_SANDBOX && !(suppliedRewardSecret && suppliedRewardTopic)) {
      return json_({ok:false,error:'WORK Rewards backend accepts Rewards webhooks only.'});
    }
  }

  try {
    lock.waitLock(10000);

    if (suppliedRewardSecret || suppliedRewardTopic) {
      const subscription = rewardWebhookSubscriptionForKey_(
        suppliedRewardTopic
      );

      if (
        !subscription ||
        !constantTimeEqual_(
          suppliedRewardSecret,
          rewardWebhookSecret_(subscription.key)
        )
      ) {
        return json_({ ok: false, error: 'Invalid rewards webhook' });
      }

      verifiedRewardHook = true;
      return handleJillRewardsWebhook_(e);
    }

    // During migration, legacy direct submissions continue to work only
    // until JILL_CUSTOM_ORDER_REQUIRE_GATEWAY is explicitly enabled.
    // Once enabled, any direct browser POST without a valid gateway HMAC
    // is refused. This toggle must be set only after gateway E2E QA.
    if (!jillCustomOrderGatewaySubmissionAllowed_(e)) {
      return customOrderFailure_(
        'gateway_required',
        'The Custom Order submission could not be authenticated.', false
      );
    }
    const data = parsePayload_(e);

    if (clean_(data.source) !== JILL.SOURCE) {
      return customOrderFailure_(
        'invalid_source',
        'Invalid Custom Order source.',
        false
      );
    }

    const email = clean_(data.email).toLowerCase();

    if (!isValidEmail_(email)) {
      return customOrderFailure_(
        'invalid_email',
        'A valid email address is required.',
        false
      );
    }

    data.email = email;

    const submissionId =
      clean_(data.submission_id) ||
      fingerprint_([
        email,
        data.name,
        data.date_needed,
        data.submitted_at
      ].join('|'));

    data.submission_id = submissionId;

    const sheet = getSheet_();
    const existingRow = findSubmissionRow_(sheet, submissionId);
    const statusColumn = HEADERS.indexOf('status') + 1;
    const duplicate = Boolean(existingRow);
    let currentStatus = '';

    if (existingRow) {
      currentStatus = clean_(
        sheet.getRange(existingRow, statusColumn).getValue()
      );
      // Once a submission ID is accepted, its persisted request payload is
      // immutable. Retrying with different content must never masquerade as
      // a previously received order. Compare the canonical transported
      // payload, not mutable Shopify/email integration status fields.
      const payloadColumn=HEADERS.indexOf('raw_payload')+1;
      const storedRaw=String(sheet.getRange(existingRow,payloadColumn).getValue()||'');
      const suppliedRaw=String(data.raw_payload||'');
      if (!storedRaw || !suppliedRaw || storedRaw!==suppliedRaw) {
        return customOrderFailure_(
          'submission_conflict',
          'This request ID already belongs to a different submitted request.',
          false
        );
      }
    }

    // Verified signed Shopify identity is bound before inserting the source
    // row; an interrupted write leaves only an unusable orphan owner record
    // which the EXACT same owner/payload may reconcile on retry. Replaying
    // a previously guest-owned submission while signed-in cannot claim it.
    if(JILL_CUSTOM_ORDER_SANDBOX) {
      try {
        jillCustomOrderOwnerBind_(submissionId,
          String(e.parameter.jill_order_owner_gid||''),
          String(data.raw_payload||''),duplicate);
      } catch(ownerErr) {
        return customOrderFailure_('owner_conflict',
          'This Custom Order cannot be assigned to that account.',false);
      }
    } else if(e.parameter.jill_order_owner_gid) {
      return customOrderFailure_('owner_not_enabled',
        'Authenticated Custom Order ownership is not enabled.',false);
    }
    const row = existingRow || saveSubmission_(sheet, data);
    // A receipt event is written while the existing POST lock is held.
    // If it fails, retries reconcile by submission_id rather than inventing
    // a successful delivery or duplicating an event.
    jillCustomOrderEnsureReceived_(submissionId, data.submitted_at);
    const state = submissionState_(currentStatus);

    // The dedicated QA project proves receipt, deduplication and workflow
    // history only. It NEVER syncs Shopify customers or sends merchant/
    // customer emails. The Rewards WORK project keeps this flag false.
    if (JILL_CUSTOM_ORDER_SANDBOX) {
      return customOrderSuccess_(submissionId, duplicate);
    }

    if (!existingRow) {
      writeSubmissionStatus_(sheet, row, statusColumn, state);
    }

    if (submissionComplete_(state)) {
      return customOrderSuccess_(submissionId, true);
    }

    // Shopify synchronization is designed to be safely repeatable. If an
    // execution ended while this stage was ATTEMPTING, a retry may run it
    // again because customerSet, metafieldsSet, and the consent mutation all
    // converge on the same submitted state/timestamp.
    if (state.shopify !== 'SYNCED') {
      state.shopify = 'ATTEMPTING';
      writeSubmissionStatus_(sheet, row, statusColumn, state);

      try {
        syncShopifyCustomer_(data);
        state.shopify = 'SYNCED';
      } catch (shopifyErr) {
        state.shopify = 'ERROR';
        logSubmissionStageError_(
          submissionId,
          'Shopify sync',
          shopifyErr
        );
      }

      writeSubmissionStatus_(sheet, row, statusColumn, state);
    }

    // Email is intentionally at-most-once across ambiguous retries. The
    // ATTEMPTING state is persisted before calling MailApp. If the process is
    // interrupted after Google accepted the message but before ACCEPTED can be
    // persisted, a retry will not send a duplicate message automatically.
    if (emailStageShouldAttempt_(state.customerEmail)) {
      state.customerEmail = 'ATTEMPTING';
      writeSubmissionStatus_(sheet, row, statusColumn, state);

      try {
        sendCustomerConfirmation_(data);
        state.customerEmail = 'ACCEPTED';
      } catch (customerEmailErr) {
        state.customerEmail = 'ERROR';
        logSubmissionStageError_(
          submissionId,
          'Customer confirmation email',
          customerEmailErr
        );
      }

      writeSubmissionStatus_(sheet, row, statusColumn, state);
    }

    if (emailStageShouldAttempt_(state.merchantEmail)) {
      state.merchantEmail = 'ATTEMPTING';
      writeSubmissionStatus_(sheet, row, statusColumn, state);

      try {
        sendMerchantNotification_(data);
        state.merchantEmail = 'ACCEPTED';
      } catch (merchantEmailErr) {
        state.merchantEmail = 'ERROR';
        logSubmissionStageError_(
          submissionId,
          'Merchant notification email',
          merchantEmailErr
        );
      }

      writeSubmissionStatus_(sheet, row, statusColumn, state);
    }

    if (!submissionComplete_(state)) {
      console.error(
        'Custom Order downstream incomplete ' + submissionId + ': ' +
        submissionStatusValue_(state)
      );
    }

    // The request itself is accepted once it is persisted. Downstream stage
    // truth is kept in the canonical Sheet status and execution logs rather
    // than falsely claiming inbox delivery in the HTTP response.
    return customOrderSuccess_(submissionId, duplicate);

  } catch (err) {
    console.error(
      'Custom Order backend failure: ' +
      (err && err.stack ? err.stack : err)
    );

    // Let Shopify retry a verified rewards webhook when processing fails.
    if (verifiedRewardHook) {
      throw err;
    }

    return customOrderFailure_(
      'backend_error',
      'The Custom Order request could not be processed.',
      true
    );

  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}



/* ---------------------------
   CUSTOM ORDER WORKFLOW V1 — MERCHANT-AUTHORIZED EVENT LOG
   Does not accept commands through public doGet/doPost.
   WORK Rewards deployments reject all workflow writes.
   The existing Submissions sheet remains the intake source.
---------------------------- */

const JILL_CUSTOM_WORKFLOW = Object.freeze({
  EVENTS_SHEET: 'CustomOrderEvents',
  ADMIN_PROPERTY: 'JILL_CUSTOM_ORDER_ADMINS',
  HEADERS: [
    'event_id','submission_id','revision','customer_status','internal_status',
    'public_note','internal_note','evidence_ref','actor','occurred_at','source'
  ],
  STATUSES: [
    'received','reviewing','awaiting_approval','in_production',
    'ready_pickup','on_hold','cancelled','completed'
  ],
  INTERNAL: [
    'new','needs_quote','waiting_customer','materials_ordered',
    'proof_revision','printing','assembly','quality_check','ready','none'
  ],
  TRANSITIONS: {
    received: ['reviewing','on_hold','cancelled'],
    reviewing: ['awaiting_approval','in_production','on_hold','cancelled'],
    awaiting_approval: ['reviewing','on_hold','cancelled'],
    in_production: ['ready_pickup','on_hold','cancelled'],
    ready_pickup: ['completed','on_hold'],
    on_hold: ['reviewing','in_production','cancelled'],
    cancelled: [],
    completed: []
  }
});

function jillCustomOrderAssertLive_() {
  if (JILL_REWARDS_RUNTIME !== 'LIVE' &&
      !(JILL_REWARDS_RUNTIME === 'WORK' && JILL_CUSTOM_ORDER_SANDBOX)) {
    throw new Error('Custom Order workflow is disabled in the isolated WORK Rewards backend.');
  }
  if (!JILL.SHEET_ID || !JILL.SHEET_NAME) {
    throw new Error('Canonical Custom Order spreadsheet is not configured.');
  }
}

function jillCustomOrderActor_() {
  jillCustomOrderAssertLive_();
  // No caller-provided identity, access by email, or web-app query argument.
  // Missing Google identity or allowlist fails closed.
  const props = PropertiesService.getScriptProperties();
  const allowed = String(props.getProperty(JILL_CUSTOM_WORKFLOW.ADMIN_PROPERTY) || '')
    .toLowerCase().split(',').map(function(x) { return x.trim(); }).filter(Boolean);
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  if (!email || allowed.indexOf(email) === -1) {
    throw new Error('Custom Order operator is not authorized.');
  }
  return email;
}

function jillCustomOrderEventsSheet_() {
  jillCustomOrderAssertLive_();
  const spreadsheet = SpreadsheetApp.openById(JILL.SHEET_ID);
  let sheet = spreadsheet.getSheetByName(JILL_CUSTOM_WORKFLOW.EVENTS_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(JILL_CUSTOM_WORKFLOW.EVENTS_SHEET);
    sheet.getRange(1,1,1,JILL_CUSTOM_WORKFLOW.HEADERS.length)
      .setValues([JILL_CUSTOM_WORKFLOW.HEADERS]);
    sheet.setFrozenRows(1);
  }
  const headers = sheet.getRange(1,1,1,JILL_CUSTOM_WORKFLOW.HEADERS.length)
    .getValues()[0];
  if (JSON.stringify(headers) !== JSON.stringify(JILL_CUSTOM_WORKFLOW.HEADERS)) {
    throw new Error('Custom Order event ledger headers drifted; refusing writes.');
  }
  return sheet;
}

function jillCustomOrderEventsFor_(sheet, submissionId) {
  const count = sheet.getLastRow() - 1;
  if (count <= 0) return [];
  const values = sheet.getRange(2,1,count,JILL_CUSTOM_WORKFLOW.HEADERS.length)
    .getValues();
  const out = [];
  values.forEach(function(row) {
    if (String(row[1]) !== submissionId) return;
    const result = {};
    JILL_CUSTOM_WORKFLOW.HEADERS.forEach(function(key,index) {
      result[key] = String(row[index] == null ? '' : row[index]);
    });
    const revision = Number(result.revision);
    if (!Number.isSafeInteger(revision) || revision !== out.length + 1 ||
        JILL_CUSTOM_WORKFLOW.STATUSES.indexOf(result.customer_status) === -1 ||
        !result.event_id) {
      throw new Error('Custom Order event history is inconsistent; refusing updates.');
    }
    result.revision = revision;
    out.push(result);
  });
  return out;
}

function jillCustomOrderAppendEvent_(sheet, event) {
  const row = JILL_CUSTOM_WORKFLOW.HEADERS.map(function(field) {
    return String(event[field] == null ? '' : event[field]);
  });
  sheet.appendRow(row);
  SpreadsheetApp.flush();
}

function jillCustomOrderEnsureReceived_(submissionId, submittedAt) {
  jillCustomOrderAssertLive_();
  if (!/^jill:[A-Za-z0-9._:-]{4,125}$/.test(String(submissionId))) {
    // Historical submissions may use older IDs; still require a strict
    // opaque identifier and do not attempt to derive customer identity.
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(String(submissionId))) {
      throw new Error('Invalid Custom Order submission identifier.');
    }
  }
  const sheet = jillCustomOrderEventsSheet_();
  const existing = jillCustomOrderEventsFor_(sheet,String(submissionId));
  if (existing.length) return existing[existing.length-1];
  const received = {
    event_id:'received:'+submissionId,
    submission_id:submissionId,revision:1,customer_status:'received',
    internal_status:'new',public_note:'',internal_note:'',evidence_ref:'',
    actor:'system:intake',
    occurred_at:!isNaN(Date.parse(submittedAt)) ?
      new Date(submittedAt).toISOString() : new Date().toISOString(),
    source:'intake'
  };
  jillCustomOrderAppendEvent_(sheet,received);
  return received;
}

function jillCustomOrderCustomerProjection_(submissionId,events) {
  // Internal-only projection; NEVER expose through public doGet/doPost.
  // A future authenticated endpoint must first verify the session-token
  // customer ID and explicit request ownership before calling this.
  const history=Array.isArray(events)?events:[];
  if (!history.length)return null;
  const latest=history[history.length-1];
  return {
    submission_id:submissionId,
    revision:Number(latest.revision),
    status:latest.customer_status,
    updated_at:latest.occurred_at,
    timeline:history.map(function(event) {
      return {
        status:event.customer_status,
        note:event.public_note||'',
        occurred_at:event.occurred_at
      };
    })
  };
}

function jillCustomOrderMerchantRead(submissionId) {
  jillCustomOrderActor_();
  const id=String(submissionId || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(id)) throw new Error('Invalid submission ID.');
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const source=getSheet_();
    const row=findSubmissionRow_(source,id);
    if (!row) return null;
    const sheet=jillCustomOrderEventsSheet_();
    const events=jillCustomOrderEventsFor_(sheet,id);
    if (!events.length) return {submission_id:id,needs_backfill:true};
    const current=events[events.length-1];
    return {
      submission_id:id,revision:events.length,
      customer_status:current.customer_status,
      internal_status:current.internal_status,
      public_note:current.public_note,
      last_updated_at:current.occurred_at,
      history:events.map(function(event) {
        return {
          revision:Number(event.revision),customer_status:event.customer_status,
          internal_status:event.internal_status,public_note:event.public_note,
          internal_note:event.internal_note,evidence_ref:event.evidence_ref,
          actor:event.actor,occurred_at:event.occurred_at,source:event.source
        };
      })
    };
  } finally {lock.releaseLock();}
}

function jillCustomOrderMerchantUpdate(command) {
  const actor=jillCustomOrderActor_();
  const data=command || {};
  const id=String(data.submission_id || '').trim();
  const op=String(data.operation_id || '').trim();
  const status=String(data.customer_status || '').trim();
  const internal=String(data.internal_status || '').trim();
  const note=String(data.public_note || '').trim();
  const privateNote=String(data.internal_note || '').trim();
  const evidence=String(data.handoff_reference || '').trim();
  const expected=Number(data.expected_revision);
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(id) ||
      !/^[A-Za-z0-9._:-]{8,128}$/.test(op) ||
      !Number.isSafeInteger(expected) || expected < 1 ||
      JILL_CUSTOM_WORKFLOW.STATUSES.indexOf(status) === -1 ||
      (internal && JILL_CUSTOM_WORKFLOW.INTERNAL.indexOf(internal) === -1) ||
      note.length > 500 || privateNote.length > 2000 || evidence.length > 256) {
    throw new Error('Invalid Custom Order update command.');
  }
  if (status==='completed' && !evidence) {
    throw new Error('Completion requires a recorded merchant handoff reference.');
  }
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const source=getSheet_();
    const row=findSubmissionRow_(source,id);
    if (!row) throw new Error('Custom Order request does not exist.');
    const sheet=jillCustomOrderEventsSheet_();
    let events=jillCustomOrderEventsFor_(sheet,id);
    if (!events.length) {
      const at=source.getRange(row,HEADERS.indexOf('submitted_at')+1).getValue();
      jillCustomOrderEnsureReceived_(id,String(at||''));
      events=jillCustomOrderEventsFor_(sheet,id);
    }
    const duplicate=events.find(function(item){return item.event_id===op;});
    if (duplicate) {
      if (duplicate.customer_status!==status ||
          (internal && duplicate.internal_status!==internal) ||
          duplicate.public_note!==note || duplicate.internal_note!==privateNote ||
          duplicate.evidence_ref!==evidence) {
        throw new Error('Idempotency key was reused for different content.');
      }
      return {ok:true,duplicate:true,revision:Number(duplicate.revision),
        customer_status:duplicate.customer_status};
    }
    const current=events[events.length-1];
    if (events.length!==expected) {
      throw new Error('Custom Order was updated elsewhere; reload current revision.');
    }
    if (status!==current.customer_status &&
        (JILL_CUSTOM_WORKFLOW.TRANSITIONS[current.customer_status]||[])
          .indexOf(status)===-1) {
      throw new Error('Invalid Custom Order status transition.');
    }
    if (status===current.customer_status && !internal && !note && !privateNote) {
      throw new Error('Empty Custom Order update.');
    }
    const event={
      event_id:op,submission_id:id,revision:expected+1,
      customer_status:status,internal_status:internal||current.internal_status,
      public_note:note,internal_note:privateNote,evidence_ref:evidence,
      actor:actor,occurred_at:new Date().toISOString(),
      source:'merchant'
    };
    // One canonical append-only event is the commit. No mirrored mutable
    // status cell exists to get out of sync with this revision.
    jillCustomOrderAppendEvent_(sheet,event);
    return {ok:true,duplicate:false,revision:event.revision,
      customer_status:status};
  } finally {lock.releaseLock();}
}

function jillCustomOrderMerchantBackfill(offset,limit) {
  jillCustomOrderActor_();
  const start=Number(offset);
  if (!Number.isSafeInteger(start) || start < 0) {
    throw new Error('Custom Order backfill requires a nonnegative row offset.');
  }
  const maximum=Math.max(1,Math.min(100,Math.floor(Number(limit)||20)));
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet=getSheet_();
    const count=Math.max(0,sheet.getLastRow()-1);
    if (start>=count)return {scanned:0,created:0,next_offset:null};
    const rows=sheet.getRange(start+2,1,Math.min(count-start,maximum),HEADERS.length)
      .getValues();
    let created=0;
    rows.forEach(function(row) {
      const id=String(row[HEADERS.indexOf('submission_id')]||'').trim();
      if (!id)return;
      const eventSheet=jillCustomOrderEventsSheet_();
      const existing=jillCustomOrderEventsFor_(eventSheet,id);
      if (!existing.length) {
        jillCustomOrderEnsureReceived_(
          id,String(row[HEADERS.indexOf('submitted_at')]||'')
        );
        created++;
      }
    });
    return {scanned:rows.length,created:created,
      next_offset:start+rows.length<count ? start+rows.length : null};
  } finally {lock.releaseLock();}
}


// Merchant controls: spreadsheet command desk only. No public HTTP handler,
// account-page mutation, onEdit trigger or polling job processes these rows.
// Authorized operator runs jillCustomOrderMerchantProcessDesk() explicitly.
const JILL_CUSTOM_ORDER_DESK = Object.freeze({
  SHEET: 'CustomOrderDesk',
  HEADERS:[
    'operation_id','submission_id','expected_revision','customer_status',
    'internal_status','public_note','internal_note','handoff_reference',
    'result','processed_at'
  ]
});

function jillCustomOrderMerchantDeskSheet_() {
  jillCustomOrderActor_();
  const spreadsheet=SpreadsheetApp.openById(JILL.SHEET_ID);
  let sheet=spreadsheet.getSheetByName(JILL_CUSTOM_ORDER_DESK.SHEET);
  if (!sheet) {
    sheet=spreadsheet.insertSheet(JILL_CUSTOM_ORDER_DESK.SHEET);
    sheet.getRange(1,1,1,JILL_CUSTOM_ORDER_DESK.HEADERS.length)
      .setValues([JILL_CUSTOM_ORDER_DESK.HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange('D2:D1000').setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(JILL_CUSTOM_WORKFLOW.STATUSES,true)
        .setAllowInvalid(false).build()
    );
    sheet.getRange('E2:E1000').setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(JILL_CUSTOM_WORKFLOW.INTERNAL,true)
        .setAllowInvalid(false).build()
    );
  }
  const headers=sheet.getRange(1,1,1,JILL_CUSTOM_ORDER_DESK.HEADERS.length)
    .getValues()[0];
  if (JSON.stringify(headers)!==JSON.stringify(JILL_CUSTOM_ORDER_DESK.HEADERS)) {
    throw new Error('Merchant command desk headers drifted; refusing edits.');
  }
  return sheet;
}

function jillCustomOrderMerchantSetupDesk() {
  const actor=jillCustomOrderActor_();
  const sheet=jillCustomOrderMerchantDeskSheet_();
  return {ok:true,operator:actor,sheet:sheet.getName(),
    command_columns:JILL_CUSTOM_ORDER_DESK.HEADERS.slice(0,8)};
}

function jillCustomOrderMerchantProcessDesk(limit) {
  jillCustomOrderActor_();
  const max=Math.max(1,Math.min(25,Math.floor(Number(limit)||10)));
  const sheet=jillCustomOrderMerchantDeskSheet_();
  const count=Math.max(0,sheet.getLastRow()-1);
  if (!count)return {processed:0,succeeded:0,rejected:0};
  const rows=sheet.getRange(2,1,count,JILL_CUSTOM_ORDER_DESK.HEADERS.length)
    .getValues();
  let processed=0,succeeded=0,rejected=0;
  rows.forEach(function(values,index) {
    if (processed>=max || !String(values[0]||'').trim() ||
        String(values[8]||'').trim())return;
    processed++;
    try {
      const result=jillCustomOrderMerchantUpdate({
        operation_id:String(values[0]||''),
        submission_id:String(values[1]||''),
        expected_revision:values[2],
        customer_status:String(values[3]||''),
        internal_status:String(values[4]||''),
        public_note:String(values[5]||''),
        internal_note:String(values[6]||''),
        handoff_reference:String(values[7]||'')
      });
      // Event append is authoritative. If writing this acknowledgement fails,
      // a retry with the same operation_id is handled as a duplicate.
      sheet.getRange(index+2,9,1,2)
        .setValues([['APPLIED revision '+result.revision,new Date().toISOString()]]);
      succeeded++;
    } catch(err) {
      // Keep the command as the operator entered it. The operator can
      // correct or retry a rejected row; no status is silently forced.
      const reason=String(err&&err.message||err).slice(0,240);
      sheet.getRange(index+2,9,1,2)
        .setValues([['REJECTED: '+reason,new Date().toISOString()]]);
      rejected++;
    }
  });
  return {processed:processed,succeeded:succeeded,rejected:rejected};
}


// Gateway authentication is deliberately separate from Rewards webhook
// authentication. The secret lives ONLY in Script Properties and the
// server-side Shopify app proxy; never expose it to Liquid or JS.
function jillCustomOrderGatewaySignature_(action,id,timestamp,rawPayload,secret,ownerGid) {
  // Backward-compatible guest envelope: four segments. Signed-in identity
  // uses a fifth mandatory HMAC segment; client-supplied fields cannot
  // rewrite the owner without the gateway's private signing secret.
  const parts=[action,id,timestamp,rawPayload||''];
  if(ownerGid)parts.push(ownerGid);
  const message=parts.join('\n');
  const bytes=Utilities.computeHmacSha256Signature(message,secret);
  return bytes.map(function(value) {
    return ('0'+((value+256)%256).toString(16)).slice(-2);
  }).join('');
}

function jillCustomOrderGatewayVerified_(e,action) {
  if (JILL_REWARDS_RUNTIME==='WORK' && !JILL_CUSTOM_ORDER_SANDBOX) return false;
  const values=e&&e.parameter||{};
  const id=clean_(values.submission_id);
  const timestamp=clean_(values.jill_order_gateway_ts);
  const signature=clean_(values.jill_order_gateway_sig).toLowerCase();
  const secret=PropertiesService.getScriptProperties()
    .getProperty('JILL_CUSTOM_ORDER_GATEWAY_SECRET')||'';
  if (String(secret).length<32 || !/^[A-Za-z0-9._:-]{8,128}$/.test(id) ||
      !/^[0-9]{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature) ||
      Math.abs(Date.now()-Number(timestamp))>120000) return false;
  const owner=String(values.jill_order_owner_gid||'');
  if(owner && !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(owner))
    return false;
  if(action==='customer_list' && (id!=='jill:account-orders' || !owner))
    return false;
  const payload=action==='submit' ? String(values.raw_payload||'') :
    action==='customer_list' ? owner : '';
  if (action==='submit' && !payload) return false;
  // Signed submit owner is the additional HMAC segment, not a mutable
  // customer field in the browser's raw Custom Order JSON.
  const expected=jillCustomOrderGatewaySignature_(
    action,id,timestamp,payload,secret,action==='submit'?owner:''
  );
  return constantTimeEqual_(signature,expected);
}

function jillCustomOrderGatewaySubmissionAllowed_(e) {
  const props=PropertiesService.getScriptProperties();
  const required=JILL_CUSTOM_ORDER_SANDBOX ||
    props.getProperty('JILL_CUSTOM_ORDER_REQUIRE_GATEWAY')==='1';
  const values=e&&e.parameter||{};
  const signed=Boolean(values.jill_order_gateway_sig ||
    values.jill_order_gateway_ts);
  if (signed || required) return jillCustomOrderGatewayVerified_(e,'submit');
  // Transition period only: retiring the unauthenticated ingress must be
  // a separate, verified rollout (never an accidental Git deployment).
  return true;
}

function jillCustomOrderGatewayReceipt_(e) {
  if (!jillCustomOrderGatewayVerified_(e,'receipt')) {
    return json_({version:1,operation:'custom_order.receipt.result',
      ok:false,error:{code:'unauthorized_receipt',retryable:false}});
  }
  const id=String(e.parameter.submission_id);
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // A verified receipt requires BOTH durable intake row and append-only
    // workflow receipt event, not an email or a "maybe" HTTP response.
    const spreadsheet=SpreadsheetApp.openById(JILL.SHEET_ID);
    const sheet=spreadsheet.getSheetByName(JILL.SHEET_NAME);
    const events=spreadsheet.getSheetByName(JILL_CUSTOM_WORKFLOW.EVENTS_SHEET);
    if (!sheet || !events || !findSubmissionRow_(sheet,id)) {
      return json_({version:1,operation:'custom_order.receipt.result',
        ok:false,error:{code:'receipt_not_found',retryable:true}});
    }
    const matches=jillCustomOrderEventsFor_(events,id);
    if (!matches.length || matches[0].customer_status!=='received') {
      return json_({version:1,operation:'custom_order.receipt.result',
        ok:false,error:{code:'receipt_not_ready',retryable:true}});
    }
    return json_({version:1,operation:'custom_order.receipt.result',
      ok:true,submission_id:id,status:'received',revision:1});
  } finally {lock.releaseLock();}
}



/* WORK CUSTOM ORDER OWNERSHIP V1 — QA ONLY, NO LIVE RETROCLAIM */
const JILL_CUSTOM_OWNER_SHEET='CustomOrderOwners';
const JILL_CUSTOM_OWNER_HEADERS=[
  'submission_id','owner_gid','payload_sha256','bound_at'
];
function jillCustomOrderOwnerHash_(payload) {
  const values=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,String(payload));
  return values.map(function(v){
    return ('0'+((v+256)%256).toString(16)).slice(-2);
  }).join('');
}
function jillCustomOrderOwnersSheet_(create) {
  const ss=SpreadsheetApp.openById(JILL.SHEET_ID);
  let sheet=ss.getSheetByName(JILL_CUSTOM_OWNER_SHEET);
  if(!sheet && !create)return null;
  if(!sheet) {
    sheet=ss.insertSheet(JILL_CUSTOM_OWNER_SHEET);
    sheet.getRange(1,1,1,4).setValues([JILL_CUSTOM_OWNER_HEADERS]);
    sheet.setFrozenRows(1);
  }
  const headers=sheet.getRange(1,1,1,4).getValues()[0];
  if(JSON.stringify(headers)!==JSON.stringify(JILL_CUSTOM_OWNER_HEADERS))
    throw new Error('Custom Order owner ledger headers drifted.');
  return sheet;
}
function jillCustomOrderOwnerRows_(sheet) {
  if(!sheet || sheet.getLastRow()<2)return [];
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues();
  return values.map(function(row){
    return {id:String(row[0]),gid:String(row[1]),hash:String(row[2])};
  });
}
function jillCustomOrderOwnerBind_(submissionId,ownerGid,rawPayload,duplicate) {
  if(JILL_REWARDS_RUNTIME!=='WORK'||JILL_CUSTOM_ORDER_SANDBOX!==true)
    throw new Error('Owner binding is isolated WORK QA only.');
  if(!/^[A-Za-z0-9._:-]{8,128}$/.test(submissionId)||!rawPayload)
    throw new Error('Invalid owner binding payload.');
  if(ownerGid && !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(ownerGid))
    throw new Error('Invalid owner identity.');
  const sheet=jillCustomOrderOwnersSheet_(Boolean(ownerGid));
  const rows=jillCustomOrderOwnerRows_(sheet)
    .filter(function(row){return row.id===submissionId;});
  if(rows.length>1)throw new Error('Duplicate owner records.');
  const previous=rows[0]||null;
  const hash=jillCustomOrderOwnerHash_(rawPayload);
  if(duplicate) {
    // Immutable previous GUEST intake must never be claimed by a new login.
    if((previous?.gid||'')!==ownerGid ||
       (previous && previous.hash!==hash))
      throw new Error('Existing intake ownership cannot change.');
    return Boolean(previous);
  }
  if(!ownerGid) {
    if(previous)throw new Error('Orphaned owner collision.');
    return false;
  }
  if(previous) {
    if(previous.gid!==ownerGid||previous.hash!==hash)
      throw new Error('Conflicting owner or original payload.');
    return true;
  }
  // Caller holds the same script lock as canonical Submissions intake.
  sheet.appendRow([submissionId,ownerGid,hash,new Date().toISOString()]);
  SpreadsheetApp.flush();
  return true;
}
function jillCustomOrderGatewayCustomerList_(e) {
  // Access requires internal HMAC; the signing gateway MUST first verify
  // Shopify's account-session JWT (aud,dest,sub,exp,signature).
  if(JILL_REWARDS_RUNTIME!=='WORK'||JILL_CUSTOM_ORDER_SANDBOX!==true ||
     !jillCustomOrderGatewayVerified_(e,'customer_list')) {
    return json_({version:1,operation:'custom_order.account.list.result',
      ok:false,error:{code:'unauthorized',retryable:false}});
  }
  const gid=String(e.parameter.jill_order_owner_gid);
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const owners=jillCustomOrderOwnersSheet_(false);
    const allOwners=jillCustomOrderOwnerRows_(owners);
    // A manually corrupted index must never allow two different customers
    // to see a single submission. Reject duplicate IDs GLOBALLY.
    if(allOwners.length>5000 ||
       new Set(allOwners.map(function(row){return row.id;})).size!==allOwners.length)
      throw new Error('Conflicting owner index.');
    const matches=allOwners.filter(function(row){return row.gid===gid;});
    // Fail closed on owner-ledger corruption or unbounded scan.
    if(matches.length>20 ||
       new Set(matches.map(function(row){return row.id;})).size!==matches.length)
      throw new Error('Invalid customer ownership index.');
    const source=getSheet_();
    const events=jillCustomOrderEventsSheet_();
    const result=matches.map(function(row){
      const index=findSubmissionRow_(source,row.id);
      if(!index)throw new Error('Owner refers to missing intake.');
      const stored=String(source.getRange(index,HEADERS.indexOf('raw_payload')+1)
        .getValue()||'');
      if(!stored||jillCustomOrderOwnerHash_(stored)!==row.hash)
        throw new Error('Owner refers to conflicting payload.');
      const history=jillCustomOrderEventsFor_(events,row.id);
      if(!history.length)throw new Error('Missing Custom Order status history.');
      return jillCustomOrderCustomerProjection_(row.id,history);
    });
    return json_({version:1,operation:'custom_order.account.list.result',
      ok:true,orders:result});
  } catch(err) {
    return json_({version:1,operation:'custom_order.account.list.result',
      ok:false,error:{code:'private_read_unavailable',retryable:true}});
  } finally {lock.releaseLock();}
}
/* END WORK CUSTOM ORDER OWNERSHIP V1 */

// Run this function in the isolated QA Apps Script editor BEFORE any
// web-app deployment. It is read-only and never emits secret values.
function jillCustomOrderQaPreflight() {
  if (JILL_REWARDS_RUNTIME !== 'WORK' || JILL_CUSTOM_ORDER_SANDBOX !== true) {
    throw new Error('QA preflight refused: this is not the isolated Custom Order WORK runtime.');
  }
  const props=PropertiesService.getScriptProperties();
  const secret=String(props.getProperty('JILL_CUSTOM_ORDER_GATEWAY_SECRET')||'');
  if (secret.length < 32) {
    throw new Error('QA gateway secret is missing or too short.');
  }
  const allowed=String(props.getProperty(JILL_CUSTOM_WORKFLOW.ADMIN_PROPERTY)||'')
    .toLowerCase().split(',').map(function(x){return x.trim();}).filter(Boolean);
  const operator=String(Session.getActiveUser().getEmail()||'').toLowerCase().trim();
  if (!operator || allowed.indexOf(operator)===-1) {
    throw new Error('QA operator identity does not match the authorized Google account.');
  }
  if (!JILL.SHEET_ID || !JILL.SHEET_NAME) {
    throw new Error('QA spreadsheet is not configured.');
  }
  const spreadsheet=SpreadsheetApp.openById(JILL.SHEET_ID);
  [
    {name:JILL.SHEET_NAME,headers:HEADERS},
    {name:JILL_CUSTOM_WORKFLOW.EVENTS_SHEET,headers:JILL_CUSTOM_WORKFLOW.HEADERS},
    {name:JILL_CUSTOM_ORDER_DESK.SHEET,headers:JILL_CUSTOM_ORDER_DESK.HEADERS},
  ].forEach(function(entry) {
    const sheet=spreadsheet.getSheetByName(entry.name);
    if (!sheet) throw new Error('Missing QA sheet: '+entry.name);
    const actual=sheet.getRange(1,1,1,entry.headers.length).getValues()[0];
    if (JSON.stringify(actual)!==JSON.stringify(entry.headers)) {
      throw new Error('QA spreadsheet header mismatch in '+entry.name);
    }
  });
  const result={
    ok:true,
    scope:'WORK_CUSTOM_ORDERS_QA',
    gateway_secret_configured:true,
    merchant_operator_authorized:true,
    qa_sheet_headers_verified:true,
  };
  Logger.log(JSON.stringify(result));
  return result;
}

/* END CUSTOM ORDER WORKFLOW V1 */

/* ---------------------------
   JILL REWARDS
---------------------------- */

const JILL_REWARD_TIERS = {
  10: { value: 5, minimum: 25 },
  20: { value: 12, minimum: 50 },
  35: { value: 25, minimum: 100 },
  50: { value: 40, minimum: 150 }
};

const JILL_REWARDS_ENGINE_VERSION = '13';
const JILL_REWARDS_RUNTIME = 'LIVE';

function assertJillRewardsRuntimeTarget_() {
  // The LIVE build remains unchanged. The WORK build replaces the literal
  // runtime constant during packaging and fails closed before any Shopify API.
  if (JILL_REWARDS_RUNTIME !== 'WORK') return;
  const props = PropertiesService.getScriptProperties();
  const shop = normalizeShopDomain_(clean_(props.getProperty('SHOPIFY_SHOP')));
  const app = clean_(props.getProperty('SHOPIFY_CLIENT_ID'));
  if (shop !== 'jill-work.myshopify.com' || app !== 'f8e1ebdbae84490dc8ea5b133637e6c0') {
    throw new Error('WORK Rewards target mismatch. Refusing all Shopify credentials and writes.');
  }
}

const JILL_REWARDS_BUILD_SHA = '__JILL_REWARDS_BUILD_SHA__';
const JILL_REWARD_SPEND_CENTS_PER_POINT = 1000;
const JILL_REWARD_COUPON_DAYS = 30;
const JILL_REWARD_USAGE_LIMIT = 1;
const JILL_REWARD_APPLIES_ONCE_PER_CUSTOMER = true;
const JILL_REWARD_ORDER_STACKING = false;
const JILL_REWARD_PRODUCT_STACKING = false;
const JILL_REWARD_SHIPPING_STACKING = false;
const JILL_REWARDS_SWEEP_HANDLER = 'processPendingJillRewardRequests';
const JILL_REWARDS_SWEEP_CURSOR_PROPERTY = 'JILL_REWARDS_SWEEP_CURSOR';
const JILL_REWARDS_SWEEP_PAGE_SIZE = 100;
const JILL_REWARDS_SWEEP_MAX_PAGES_PER_RUN = 5;
const JILL_REWARDS_DELETED_DISCOUNT_QUEUE_PROPERTY = 'JILL_REWARDS_DELETED_DISCOUNT_QUEUE';
const JILL_REWARDS_DELETED_DISCOUNT_PAGE_SIZE = 100;
const JILL_REWARDS_DELETED_DISCOUNT_MAX_PAGES_PER_RUN = 5;
const JILL_REWARDS_LAST_SWEEP_PROPERTY = 'JILL_REWARDS_LAST_SWEEP';
const JILL_REWARDS_SWEEP_HEALTH_MAX_AGE_MS = 5 * 60 * 1000;
const JILL_REWARDS_INFRA_CHECK_PROPERTY = 'JILL_REWARDS_INFRA_CHECK_AT';
const JILL_REWARDS_INFRA_CHECK_MS = 5 * 60 * 1000;
const JILL_REWARD_SUBSCRIPTIONS = [
  { topic: 'ORDERS_PAID', key: 'orders_paid' },
  { topic: 'REFUNDS_CREATE', key: 'refunds_create' },
  { topic: 'ORDERS_CANCELLED', key: 'orders_cancelled' },
  { topic: 'ORDERS_EDITED', key: 'orders_edited' },
  { topic: 'CUSTOMERS_UPDATE', key: 'customers_update' },
  { topic: 'DISCOUNTS_DELETE', key: 'discounts_delete' }
];

function setupJillRewards() {
  if (JILL_CUSTOM_ORDER_SANDBOX) {
    throw new Error('Rewards setup is forbidden in the Custom Order QA project.');
  }
  assertJillRewardsRuntimeTarget_();
  const infrastructure = ensureJillRewardsInfrastructure_(true);
  const reconciliation = processPendingJillRewardRequests();

  const result = {
    ok: true,
    engine_version: JILL_REWARDS_ENGINE_VERSION,
    build_sha: JILL_REWARDS_BUILD_SHA,
    created: infrastructure.created,
    updated: infrastructure.updated,
    existing: infrastructure.existing,
    webhook_url: rewardsBaseUrl_(),
    sweep_trigger: infrastructure.sweep_trigger,
    reconciliation: reconciliation
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function ensureJillRewardsInfrastructure_(force) {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  const lastCheck = Number(
    props.getProperty(JILL_REWARDS_INFRA_CHECK_PROPERTY) || 0
  );

  if (!force && lastCheck && now - lastCheck < JILL_REWARDS_INFRA_CHECK_MS) {
    return {
      ok: true,
      checked: false,
      throttled: true,
      created: [],
      updated: [],
      existing: [],
      sweep_trigger: 'recently verified'
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    // Re-check after obtaining the lock so concurrent watchdog calls cannot
    // create duplicate subscriptions.
    const lockedNow = Date.now();
    const lockedLastCheck = Number(
      props.getProperty(JILL_REWARDS_INFRA_CHECK_PROPERTY) || 0
    );

    if (
      !force &&
      lockedLastCheck &&
      lockedNow - lockedLastCheck < JILL_REWARDS_INFRA_CHECK_MS
    ) {
      return {
        ok: true,
        checked: false,
        throttled: true,
        created: [],
        updated: [],
        existing: [],
        sweep_trigger: 'recently verified'
      };
    }

    const created = [];
    const updated = [];
    const existing = [];

    JILL_REWARD_SUBSCRIPTIONS.forEach(function(item) {
      const uri = rewardsWebhookUri_(item.key);
      const found = findRewardsWebhook_(item.topic, uri);

      if (found) {
        if (clean_(found.uri) === uri) {
          existing.push(item.topic);
        } else {
          updateRewardsWebhook_(found.id, uri);
          updated.push(item.topic);
        }
        return;
      }

      createRewardsWebhook_(item.topic, uri);
      created.push(item.topic);
    });

    const sweepTrigger = ensureJillRewardsSweepTrigger_();
    props.setProperty(
      JILL_REWARDS_INFRA_CHECK_PROPERTY,
      String(lockedNow)
    );

    const result = {
      ok: true,
      checked: true,
      throttled: false,
      created: created,
      updated: updated,
      existing: existing,
      sweep_trigger: sweepTrigger
    };

    Logger.log(
      'JILL Rewards infrastructure check: ' + JSON.stringify(result)
    );
    return result;
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}

function ensureJillRewardsSweepTrigger_() {
  const matching = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === JILL_REWARDS_SWEEP_HANDLER;
  });

  matching.slice(1).forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  if (!matching.length) {
    ScriptApp.newTrigger(JILL_REWARDS_SWEEP_HANDLER)
      .timeBased()
      .everyMinutes(1)
      .create();
    return 'created (every minute)';
  }

  return 'already installed (every minute)';
}

// Safe manual test button in Apps Script. The installed time trigger calls the
// same worker every minute, so a metafield-only redemption request cannot get
// stranded even if Shopify does not emit CUSTOMERS_UPDATE for that write.
function runJillRewardsSweep() {
  if (JILL_CUSTOM_ORDER_SANDBOX) {
    throw new Error('Rewards sweeps are forbidden in the Custom Order QA project.');
  }
  return processPendingJillRewardRequests();
}

// External fail-safe used by GitHub Actions. If Shopify ever drops a
// shop-specific webhook, or the Google minute trigger is removed, this call
// reinstalls the missing infrastructure and reconciles customer wallets.
function jillRewardsInfrastructureHealth_() {
  const subscriptions = JILL_REWARD_SUBSCRIPTIONS.map(function(item) {
    const uri = rewardsWebhookUri_(item.key);
    const found = findRewardsWebhook_(item.topic, uri);
    return {
      topic: item.topic,
      ok: Boolean(found && clean_(found.uri) === uri)
    };
  });

  const triggerCount = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === JILL_REWARDS_SWEEP_HANDLER;
  }).length;
  const verified = subscriptions.filter(function(item) {
    return item.ok;
  }).length;

  return {
    ok:
      verified === JILL_REWARD_SUBSCRIPTIONS.length &&
      triggerCount === 1,
    webhook_subscriptions_expected: JILL_REWARD_SUBSCRIPTIONS.length,
    webhook_subscriptions_verified: verified,
    webhook_auth_mode: 'topic_scoped_query_secret_v2',
    standard_hmac_verified: false,
    sweep_trigger_count: triggerCount,
    sweep_trigger_ok: triggerCount === 1
  };
}

function jillRewardsSweepHealth_() {
  const raw = clean_(
    PropertiesService.getScriptProperties().getProperty(
      JILL_REWARDS_LAST_SWEEP_PROPERTY
    )
  );

  if (!raw) {
    return {
      ok: false,
      last_sweep_at: null,
      age_ms: null,
      fresh: false
    };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      last_sweep_at: null,
      age_ms: null,
      fresh: false
    };
  }

  const completedAt = Date.parse(snapshot.completed_at || '');
  const ageMs = Number.isFinite(completedAt)
    ? Math.max(0, Date.now() - completedAt)
    : null;
  const fresh =
    ageMs !== null &&
    ageMs <= JILL_REWARDS_SWEEP_HEALTH_MAX_AGE_MS;

  return {
    ok: fresh && snapshot.ok === true,
    last_sweep_at: snapshot.completed_at || null,
    age_ms: ageMs,
    fresh: fresh,
    customers_scanned: Number(snapshot.customers_scanned) || 0,
    requests_processed: Number(snapshot.requests_processed) || 0,
    wallets_normalized: Number(snapshot.wallets_normalized) || 0,
    deletion_queue_depth: Number(snapshot.deletion_queue_depth) || 0
  };
}

// Public endpoint owner: health only. This must never create triggers, repair
// webhooks, synchronize promotions, process redemptions or mutate wallets.
function runJillRewardsWatchdog_() {
  const infrastructure = jillRewardsInfrastructureHealth_();
  const promotions = jillPublicPromotionsHealth_();
  const sweep = jillRewardsSweepHealth_();
  const deletionQueue = rewardDeletedDiscountQueue_();

  return {
    ok:
      infrastructure.ok === true &&
      promotions.ok === true &&
      sweep.ok === true,
    watchdog: true,
    engine_version: JILL_REWARDS_ENGINE_VERSION,
    build_sha: JILL_REWARDS_BUILD_SHA,
    infrastructure: infrastructure,
    sweep: sweep,
    promotions: promotions,
    deletion_queue_depth: deletionQueue.length
  };
}

function processPendingJillRewardRequests() {
  // Self-heal the webhook layer every few minutes from the same minute trigger.
  // This means manual admin coupon deletion does not depend on someone
  // remembering to rerun setupJillRewards().
  try {
    ensureJillRewardsInfrastructure_(false);
  } catch (infraErr) {
    console.error(
      'JILL Rewards infrastructure self-heal failed: ' +
      (infraErr && infraErr.stack ? infraErr.stack : infraErr)
    );
  }

  try {
    ensureJillPublicPromotionsHealthy_(false);
  } catch (promotionsErr) {
    console.error(
      'JILL public promotions maintenance failed: ' +
      (promotionsErr && promotionsErr.stack ? promotionsErr.stack : promotionsErr)
    );
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const props = PropertiesService.getScriptProperties();
    const cursorStart =
      clean_(props.getProperty(JILL_REWARDS_SWEEP_CURSOR_PROPERTY)) || null;
    let after = cursorStart;
    let scanned = 0;
    let processed = 0;
    let normalized = 0;
    let pagesScanned = 0;
    let cycleComplete = false;
    let cursorRecovered = false;

    const query = `
      query JillRewardsSweep($first: Int!, $after: String) {
        customers(first: $first, after: $after) {
          nodes {
            id
            pointsBalance: metafield(
              namespace: "jill_rewards",
              key: "points_balance"
            ) {
              value
              compareDigest
            }
            pointsEarned: metafield(
              namespace: "jill_rewards",
              key: "points_earned_lifetime"
            ) {
              value
              compareDigest
            }
            pointsRedeemed: metafield(
              namespace: "jill_rewards",
              key: "points_redeemed_lifetime"
            ) {
              value
              compareDigest
            }
            redeemRequestPoints: metafield(
              namespace: "jill_rewards",
              key: "redeem_request_points"
            ) {
              value
              compareDigest
            }
            redeemRequestNonce: metafield(
              namespace: "jill_rewards",
              key: "redeem_request_nonce"
            ) {
              value
              compareDigest
            }
            coupons: metafield(
              namespace: "jill_rewards",
              key: "coupons"
            ) {
              value
              compareDigest
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    while (pagesScanned < JILL_REWARDS_SWEEP_MAX_PAGES_PER_RUN) {
      let data;

      try {
        data = shopifyGraphQL_(query, {
          first: JILL_REWARDS_SWEEP_PAGE_SIZE,
          after: after
        });
      } catch (pageErr) {
        // Shopify cursors can become invalid after enough customer churn.
        // A stored cursor is only an optimization/progress marker, never
        // authoritative business state, so recover once from the beginning.
        if (after && pagesScanned === 0 && !cursorRecovered) {
          console.error(
            'JILL Rewards sweep cursor reset after Shopify rejected cursor: ' +
            (pageErr && pageErr.stack ? pageErr.stack : pageErr)
          );
          props.deleteProperty(JILL_REWARDS_SWEEP_CURSOR_PROPERTY);
          after = null;
          cursorRecovered = true;
          continue;
        }
        throw pageErr;
      }

      const connection = data.customers || {};
      const customers = connection.nodes || [];

      customers.forEach(function(customer) {
        scanned += 1;

        const requestedPoints = rewardInt_(customer.redeemRequestPoints);
        const nonce = clean_(
          customer.redeemRequestNonce && customer.redeemRequestNonce.value
        );
        const pendingNonce = nonce && nonce.indexOf('consumed:') !== 0;

        try {
          if (requestedPoints > 0 && pendingNonce) {
            const result = processRewardRequest_(customer.id, nonce);
            if (result && result.coupon) processed += 1;
            return;
          }

          // Housekeeping: legacy/malformed requests created without a nonce
          // must never strand the customer in a permanent pending state.
          if (requestedPoints > 0 && !pendingNonce) {
            clearRewardRequest_(customer);
            return;
          }

          if (normalizeRewardWalletForCustomer_(customer)) {
            normalized += 1;
          }
        } catch (err) {
          console.error(
            'JILL Rewards sweep customer ' + customer.id + ': ' +
            (err && err.stack ? err.stack : err)
          );

          // A deterministic backend failure must never leave the customer
          // trapped in a permanent pending state. processRewardRequest_
          // already rolls back a newly-created discount if the state write
          // fails, so clearing the request here is safe.
          try {
            clearRewardRequest_(customer);
          } catch (clearErr) {
            console.error(
              'JILL Rewards sweep clear failed ' + customer.id + ': ' +
              (clearErr && clearErr.stack ? clearErr.stack : clearErr)
            );
          }
        }
      });

      pagesScanned += 1;

      const pageInfo = connection.pageInfo || {};
      const hasNextPage = Boolean(pageInfo.hasNextPage);
      const nextCursor = clean_(pageInfo.endCursor) || null;

      if (!hasNextPage) {
        props.deleteProperty(JILL_REWARDS_SWEEP_CURSOR_PROPERTY);
        after = null;
        cycleComplete = true;
        break;
      }

      if (!nextCursor || nextCursor === after) {
        throw new Error(
          'JILL Rewards sweep pagination returned an invalid next cursor.'
        );
      }

      // Commit traversal progress only after the page has been handled. If
      // execution stops before this point, the same page is safely revisited.
      props.setProperty(JILL_REWARDS_SWEEP_CURSOR_PROPERTY, nextCursor);
      after = nextCursor;
    }

    const cursorEnd =
      clean_(props.getProperty(JILL_REWARDS_SWEEP_CURSOR_PROPERTY)) || null;

    const deletedDiscountQueue = processDeletedRewardDiscountQueue_();

    const result = {
      ok: true,
      scanned: scanned,
      processed: processed,
      normalized: normalized,
      pages_scanned: pagesScanned,
      page_size: JILL_REWARDS_SWEEP_PAGE_SIZE,
      max_pages_per_run: JILL_REWARDS_SWEEP_MAX_PAGES_PER_RUN,
      cursor_start: cursorStart,
      cursor_end: cursorEnd,
      cursor_recovered: cursorRecovered,
      cycle_complete: cycleComplete,
      deleted_discount_queue: deletedDiscountQueue
    };

    props.setProperty(
      JILL_REWARDS_LAST_SWEEP_PROPERTY,
      JSON.stringify({
        ok: true,
        completed_at: new Date().toISOString(),
        customers_scanned: scanned,
        requests_processed: processed,
        wallets_normalized: normalized,
        deletion_queue_depth:
          deletedDiscountQueue && Number(deletedDiscountQueue.queue_depth)
            ? Number(deletedDiscountQueue.queue_depth)
            : 0
      })
    );

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}

function rewardWebhookSubscriptionForKey_(topicKey) {
  const key = clean_(topicKey);

  return JILL_REWARD_SUBSCRIPTIONS.find(function(item) {
    return item && item.key === key;
  }) || null;
}

function rewardWebhookSecret_(topicKey) {
  const subscription = rewardWebhookSubscriptionForKey_(topicKey);

  if (!subscription) {
    throw new Error('Unsupported JILL Rewards webhook topic.');
  }

  const props = PropertiesService.getScriptProperties();
  const clientSecret = clean_(props.getProperty('SHOPIFY_CLIENT_SECRET'));

  if (!clientSecret) {
    throw new Error(
      'Missing SHOPIFY_CLIENT_SECRET Script Property for JILL Rewards.'
    );
  }

  return fingerprint_(
    'jill-rewards-webhook-v2|' + subscription.key + '|' + clientSecret
  ).slice(0, 48);
}

function rewardsBaseUrl_() {
  // Always use the public production /exec deployment. ScriptApp can return
  // /dev when setup is launched from the editor, which Shopify cannot use.
  return shopifyOAuthRedirectUri_();
}

function rewardsWebhookUri_(topicKey) {
  return (
    rewardsBaseUrl_() +
    '?jill_rewards_hook=' +
    encodeURIComponent(rewardWebhookSecret_(topicKey)) +
    '&jill_rewards_topic=' +
    encodeURIComponent(topicKey)
  );
}

function findRewardsWebhook_(topic, uri) {
  const query = `
    query FindJillRewardsWebhooks($topic: WebhookSubscriptionTopic!) {
      webhookSubscriptions(first: 50, topics: [$topic]) {
        nodes {
          id
          topic
          uri
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, { topic: topic });
  const nodes =
    data.webhookSubscriptions && data.webhookSubscriptions.nodes
      ? data.webhookSubscriptions.nodes
      : [];

  const exact = nodes.find(function(node) {
    return clean_(node.uri) === uri;
  });

  if (exact) return exact;

  return nodes.find(function(node) {
    const nodeUri = clean_(node.uri);
    return (
      nodeUri.indexOf('jill_rewards_hook=') !== -1 &&
      nodeUri.indexOf('jill_rewards_topic=') !== -1
    );
  }) || null;
}

function updateRewardsWebhook_(id, uri) {
  const mutation = `
    mutation UpdateJillRewardsWebhook($id: ID!, $uri: String!) {
      webhookSubscriptionUpdate(
        id: $id,
        webhookSubscription: { uri: $uri, format: JSON }
      ) {
        webhookSubscription { id topic uri }
        userErrors { field message }
      }
    }
  `;

  const data = shopifyGraphQL_(mutation, { id: id, uri: uri });
  const payload = data.webhookSubscriptionUpdate || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify webhookSubscriptionUpdate: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.webhookSubscription || null;
}

function createRewardsWebhook_(topic, uri) {
  const mutation = `
    mutation CreateJillRewardsWebhook(
      $topic: WebhookSubscriptionTopic!,
      $uri: String!
    ) {
      webhookSubscriptionCreate(
        topic: $topic,
        webhookSubscription: { uri: $uri, format: JSON }
      ) {
        webhookSubscription { id topic uri }
        userErrors { field message }
      }
    }
  `;

  const data = shopifyGraphQL_(mutation, { topic: topic, uri: uri });
  const payload = data.webhookSubscriptionCreate || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify webhookSubscriptionCreate: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.webhookSubscription || null;
}

function handleJillRewardsWebhook_(e) {
  const topic = clean_(
    e && e.parameter ? e.parameter.jill_rewards_topic : ''
  );
  const payload = parsePayload_(e);

  if (!topic) {
    throw new Error('Missing JILL Rewards webhook topic.');
  }

  if (!rewardWebhookSubscriptionForKey_(topic)) {
    throw new Error('Unsupported JILL Rewards webhook topic.');
  }

  if (topic === 'customers_update') {
    const customerId = clean_(payload.admin_graphql_api_id);

    if (!customerId) {
      throw new Error('Customer update webhook did not include a customer ID.');
    }

    processRewardRequest_(customerId);

    return json_({ ok: true, rewards: true, topic: topic });
  }

  if (topic === 'discounts_delete') {
    const discountId = clean_(payload.admin_graphql_api_id);

    if (!discountId) {
      throw new Error('Discount delete webhook did not include a discount ID.');
    }

    const queued = enqueueDeletedRewardDiscount_(discountId);

    return json_({
      ok: true,
      rewards: true,
      topic: topic,
      discount_id: discountId,
      queued: queued.queued,
      already_queued: queued.already_queued,
      queue_depth: queued.queue_depth
    });
  }

  let orderId = '';

  if (topic === 'refunds_create') {
    const numericOrderId = clean_(payload.order_id);
    if (numericOrderId) {
      orderId = 'gid://shopify/Order/' + numericOrderId;
    }
  } else {
    orderId = clean_(payload.admin_graphql_api_id);
  }

  if (!orderId) {
    throw new Error('Rewards webhook did not include an order ID.');
  }

  const allowInitialCredit = topic === 'orders_paid';
  reconcileRewardsOrder_(orderId, allowInitialCredit);

  return json_({
    ok: true,
    rewards: true,
    topic: topic,
    order_id: orderId
  });
}

function reconcileRewardsOrder_(orderId, allowInitialCredit) {
  const query = `
    query JillRewardsOrder($id: ID!) {
      order: node(id: $id) {
        ... on Order {
          id
          cancelledAt
          displayFinancialStatus
          customer {
            id
            pointsBalance: metafield(
              namespace: "jill_rewards",
              key: "points_balance"
            ) { value compareDigest }
            eligibleSpend: metafield(
              namespace: "jill_rewards",
              key: "eligible_spend_cents"
            ) { value compareDigest }
            pointsEarned: metafield(
              namespace: "jill_rewards",
              key: "points_earned_lifetime"
            ) { value compareDigest }
            pointsRedeemed: metafield(
              namespace: "jill_rewards",
              key: "points_redeemed_lifetime"
            ) { value compareDigest }
            coupons: metafield(
              namespace: "jill_rewards",
              key: "coupons"
            ) { value compareDigest }
          }
          creditedCents: metafield(
            namespace: "jill_rewards",
            key: "credited_cents"
          ) { value compareDigest }
          lineItems(first: 250) {
            nodes {
              isGiftCard
              currentQuantity
              discountedUnitPriceAfterAllDiscountsSet {
                shopMoney { amount currencyCode }
              }
            }
          }
          discountApplications(first: 20) {
            nodes {
              __typename
              ... on DiscountCodeApplication { code }
            }
          }
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, { id: orderId });
  const order = data.order;

  if (!order || !order.id || !order.customer || !order.customer.id) {
    return { ok: true, skipped: 'No customer-linked order' };
  }

  const previousCreditedCents = rewardInt_(order.creditedCents);

  // Only orders/paid can establish initial program credit. Refund/edit events
  // for historical pre-program orders must never pull those orders into Rewards.
  if (!allowInitialCredit && previousCreditedCents <= 0) {
    return { ok: true, skipped: 'Order was never credited' };
  }

  let eligibleCents = 0;

  if (!order.cancelledAt) {
    const lines =
      order.lineItems && order.lineItems.nodes
        ? order.lineItems.nodes
        : [];

    lines.forEach(function(line) {
      if (!line || line.isGiftCard) return;

      const money =
        line.discountedUnitPriceAfterAllDiscountsSet &&
        line.discountedUnitPriceAfterAllDiscountsSet.shopMoney;

      if (!money || money.currencyCode !== 'USD') return;

      // Shopify currentQuantity excludes refunded and removed units.
      // This per-unit amount accounts for product and order discounts;
      // multiplying by currentQuantity excludes refunded/removed units.
      // Shopify describes this per-unit price as approximate, so round
      // the surviving line total once to cents.
      const remaining = Math.max(0, Number(line.currentQuantity) || 0);
      const unitAmount = Number(money.amount);
      if (!Number.isFinite(unitAmount)) {
        throw new Error('Invalid discounted Shopify line-item unit amount.');
      }
      eligibleCents += Math.round(unitAmount * remaining * 100);
    });
  }

  eligibleCents = Math.max(0, Math.round(eligibleCents));

  const deltaCents = eligibleCents - previousCreditedCents;
  const customer = order.customer;
  const priorSpend = rewardInt_(customer.eligibleSpend);
  const newSpend = Math.max(0, priorSpend + deltaCents);
  const newEarned = Math.floor(
    newSpend / JILL_REWARD_SPEND_CENTS_PER_POINT
  );

  const now = new Date();
  const originalWallet = rewardWallet_(customer.coupons);
  const wallet = normalizeRewardCoupons_(originalWallet, now);
  let walletChanged =
    JSON.stringify(originalWallet) !== JSON.stringify(wallet);

  if (markRewardCouponsUsedInWallet_(wallet, order, now)) {
    walletChanged = true;
  }

  const solvency = revokeActiveRewardsForSolvency_(wallet, newEarned, now);
  if (solvency.revoked_points > 0) {
    walletChanged = true;
  }

  const newRedeemed = rewardCommittedPoints_(wallet, now);
  const newBalance = Math.max(0, newEarned - newRedeemed);

  const ledgerChanged =
    deltaCents !== 0 ||
    previousCreditedCents !== eligibleCents ||
    rewardInt_(customer.pointsEarned) !== newEarned ||
    rewardInt_(customer.pointsRedeemed) !== newRedeemed ||
    rewardInt_(customer.pointsBalance) !== newBalance ||
    walletChanged;

  if (ledgerChanged) {
    setRewardLedger_(
      customer,
      order,
      newSpend,
      newEarned,
      newRedeemed,
      newBalance,
      eligibleCents,
      wallet
    );
  }

  return {
    ok: true,
    engine_version: JILL_REWARDS_ENGINE_VERSION,
    order_id: order.id,
    eligible_cents: eligibleCents,
    delta_cents: deltaCents,
    points_earned: newEarned,
    points_committed: newRedeemed,
    points_balance: newBalance,
    revoked_points: solvency.revoked_points
  };
}

function setRewardLedger_(
  customer,
  order,
  newSpend,
  newEarned,
  newRedeemed,
  newBalance,
  eligibleCents,
  wallet
) {
  const metafields = [
    rewardMetafieldInput_(
      customer.id,
      'points_balance',
      'number_integer',
      newBalance,
      customer.pointsBalance
    ),
    rewardMetafieldInput_(
      customer.id,
      'eligible_spend_cents',
      'number_integer',
      newSpend,
      customer.eligibleSpend
    ),
    rewardMetafieldInput_(
      customer.id,
      'points_earned_lifetime',
      'number_integer',
      newEarned,
      customer.pointsEarned
    ),
    rewardMetafieldInput_(
      customer.id,
      'points_redeemed_lifetime',
      'number_integer',
      newRedeemed,
      customer.pointsRedeemed
    ),
    rewardMetafieldInput_(
      customer.id,
      'coupons',
      'json',
      JSON.stringify(wallet || []),
      customer.coupons
    ),
    rewardMetafieldInput_(
      order.id,
      'credited_cents',
      'number_integer',
      eligibleCents,
      order.creditedCents
    )
  ];

  setRewardMetafields_(metafields);
}

function processRewardRequest_(customerId, expectedNonce) {
  let customer = getRewardsCustomer_(customerId);

  if (!customer || !customer.id) return null;

  const requestedPoints = rewardInt_(customer.redeemRequestPoints);
  const nonce = clean_(
    customer.redeemRequestNonce && customer.redeemRequestNonce.value
  );

  if (requestedPoints <= 0) {
    return null;
  }

  if (!nonce || nonce.indexOf('consumed:') === 0) {
    clearRewardRequest_(customer);
    return { ok: true, skipped: 'Malformed or already-consumed reward request' };
  }

  if (expectedNonce && nonce !== expectedNonce) {
    return { ok: true, skipped: 'Stale redemption request' };
  }

  const tier = JILL_REWARD_TIERS[requestedPoints];
  if (!tier) {
    clearRewardRequest_(customer);
    return { ok: true, skipped: 'Unsupported reward tier' };
  }

  // Reconcile Shopify coupon truth before approving a new spend of points.
  normalizeRewardWalletForCustomer_(customer);
  customer = getRewardsCustomer_(customerId);

  const latestRequestedPoints = rewardInt_(customer.redeemRequestPoints);
  const latestNonce = clean_(
    customer.redeemRequestNonce && customer.redeemRequestNonce.value
  );

  if (latestRequestedPoints !== requestedPoints || latestNonce !== nonce) {
    return { ok: true, skipped: 'Reward request changed during reconciliation' };
  }

  const balance = rewardInt_(customer.pointsBalance);
  if (balance < requestedPoints) {
    clearRewardRequest_(customer);
    return { ok: true, skipped: 'Insufficient points' };
  }

  const now = new Date();
  const wallet = normalizeRewardCoupons_(
    rewardWallet_(customer.coupons),
    now
  );
  const existingTierCoupon = wallet.find(function(coupon) {
    return (
      rewardCouponIsActive_(coupon, now) &&
      Number(coupon.points) === requestedPoints
    );
  });

  if (existingTierCoupon) {
    clearRewardRequest_(customer);
    return {
      ok: true,
      skipped: 'Active reward already exists for this tier',
      coupon: existingTierCoupon
    };
  }

  // Claim the nonce first. The final transaction deliberately does NOT write
  // this metafield again, avoiding a stale compareDigest after the claim.
  consumeRewardRequest_(customer, nonce);

  let discount = null;

  try {
    discount = createRewardDiscount_(customer, requestedPoints, tier);

    const createdAt = new Date();
    const coupon = {
      engine_version: JILL_REWARDS_ENGINE_VERSION,
      points: requestedPoints,
      value: tier.value,
      minimum: tier.minimum,
      code: discount.code,
      discount_id: discount.id,
      created_at: createdAt.toISOString(),
      expires_at: new Date(
        createdAt.getTime() + JILL_REWARD_COUPON_DAYS * 24 * 60 * 60 * 1000
      ).toISOString(),
      status: 'active',
      request_nonce: nonce
    };

    const updatedWallet = wallet.concat([coupon]);
    const committed = rewardCommittedPoints_(updatedWallet, createdAt);
    const earned = rewardInt_(customer.pointsEarned);
    const expectedBalance = Math.max(0, earned - committed);

    setRewardMetafields_([
      rewardMetafieldInput_(
        customer.id,
        'points_balance',
        'number_integer',
        expectedBalance,
        customer.pointsBalance
      ),
      rewardMetafieldInput_(
        customer.id,
        'points_redeemed_lifetime',
        'number_integer',
        committed,
        customer.pointsRedeemed
      ),
      rewardMetafieldInput_(
        customer.id,
        'coupons',
        'json',
        JSON.stringify(updatedWallet),
        customer.coupons
      ),
      rewardMetafieldInput_(
        customer.id,
        'redeem_request_points',
        'number_integer',
        0,
        customer.redeemRequestPoints
      )
    ]);

    return {
      ok: true,
      engine_version: JILL_REWARDS_ENGINE_VERSION,
      coupon: coupon,
      points_balance: expectedBalance
    };
  } catch (err) {
    if (discount && discount.id) {
      try {
        deleteRewardDiscountIfPresent_(discount.id);
      } catch (rollbackErr) {
        console.error(
          'JILL Rewards discount rollback failed ' + discount.id + ': ' +
          (rollbackErr && rollbackErr.stack ? rollbackErr.stack : rollbackErr)
        );
      }
    }

    try {
      const latestCustomer = getRewardsCustomer_(customer.id);
      if (latestCustomer && latestCustomer.id) {
        clearRewardRequest_(latestCustomer);
      }
    } catch (clearErr) {
      console.error(
        'JILL Rewards request rollback failed ' + customer.id + ': ' +
        (clearErr && clearErr.stack ? clearErr.stack : clearErr)
      );
    }

    throw err;
  }
}

function getRewardsCustomer_(customerId) {
  const query = `
    query JillRewardsCustomer($id: ID!) {
      customer: node(id: $id) {
        ... on Customer {
          id
          pointsBalance: metafield(
            namespace: "jill_rewards",
            key: "points_balance"
          ) { value compareDigest }
          pointsEarned: metafield(
            namespace: "jill_rewards",
            key: "points_earned_lifetime"
          ) { value compareDigest }
          pointsRedeemed: metafield(
            namespace: "jill_rewards",
            key: "points_redeemed_lifetime"
          ) { value compareDigest }
          redeemRequestPoints: metafield(
            namespace: "jill_rewards",
            key: "redeem_request_points"
          ) { value compareDigest }
          redeemRequestNonce: metafield(
            namespace: "jill_rewards",
            key: "redeem_request_nonce"
          ) { value compareDigest }
          coupons: metafield(
            namespace: "jill_rewards",
            key: "coupons"
          ) { value compareDigest }
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, { id: customerId });
  return data.customer || null;
}

function consumeRewardRequest_(customer, nonce) {
  const mutation = `
    mutation ConsumeJillRewardRequest($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key value compareDigest }
        userErrors { field message code }
      }
    }
  `;

  const inputs = [
    rewardMetafieldInput_(
      customer.id,
      'redeem_request_nonce',
      'single_line_text_field',
      'consumed:' + nonce,
      customer.redeemRequestNonce
    )
  ];

  const data = shopifyGraphQL_(mutation, { metafields: inputs });
  const payload = data.metafieldsSet || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify reward request claim: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.metafields || [];
}

function clearRewardRequest_(customer) {
  if (!customer || !customer.id) return;

  const nonce = clean_(
    customer.redeemRequestNonce && customer.redeemRequestNonce.value
  );

  setRewardMetafields_([
    rewardMetafieldInput_(
      customer.id,
      'redeem_request_points',
      'number_integer',
      0,
      customer.redeemRequestPoints
    ),
    rewardMetafieldInput_(
      customer.id,
      'redeem_request_nonce',
      'single_line_text_field',
      nonce && nonce.indexOf('consumed:') === 0
        ? nonce
        : (nonce ? 'consumed:' + nonce : 'consumed:cleared'),
      customer.redeemRequestNonce
    )
  ]);
}

function createRewardDiscount_(customer, points, tier) {
  const code = rewardCode_(tier.value);
  const startsAt = new Date().toISOString();
  const endsAt = new Date(
    Date.now() + JILL_REWARD_COUPON_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const mutation = `
    mutation CreateJillRewardDiscount($input: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $input) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 1) { nodes { code } }
            }
          }
        }
        userErrors { field message code }
      }
    }
  `;

  const input = {
    title: 'JILL Rewards - $' + tier.value + ' OFF - ' + customer.id,
    code: code,
    startsAt: startsAt,
    endsAt: endsAt,
    context: {
      customers: { add: [customer.id] }
    },
    customerGets: {
      value: {
        discountAmount: {
          amount: String(tier.value),
          appliesOnEachItem: false
        }
      },
      items: { all: true }
    },
    minimumRequirement: {
      subtotal: { greaterThanOrEqualToSubtotal: String(tier.minimum) }
    },
    usageLimit: JILL_REWARD_USAGE_LIMIT,
    appliesOncePerCustomer: JILL_REWARD_APPLIES_ONCE_PER_CUSTOMER,
    combinesWith: {
      orderDiscounts: JILL_REWARD_ORDER_STACKING,
      productDiscounts: JILL_REWARD_PRODUCT_STACKING,
      shippingDiscounts: JILL_REWARD_SHIPPING_STACKING
    }
  };

  const data = shopifyGraphQL_(mutation, { input: input });
  const payload = data.discountCodeBasicCreate || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify discountCodeBasicCreate: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  const node = payload.codeDiscountNode;
  const codeDiscount = node && node.codeDiscount;
  const codeNode =
    codeDiscount && codeDiscount.codes && codeDiscount.codes.nodes
      ? codeDiscount.codes.nodes[0]
      : null;

  if (!node || !node.id || !codeNode || !codeNode.code) {
    throw new Error('Shopify did not return the created JILL reward coupon.');
  }

  return {
    id: node.id,
    code: codeNode.code
  };
}

function deleteRewardDiscount_(discountId) {
  const mutation = `
    mutation DeleteJillRewardDiscount($id: ID!) {
      discountCodeDelete(id: $id) {
        deletedCodeDiscountId
        userErrors { field message code }
      }
    }
  `;

  const data = shopifyGraphQL_(mutation, { id: discountId });
  const payload = data.discountCodeDelete || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify discountCodeDelete: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.deletedCodeDiscountId || discountId;
}

function rewardWallet_(metafield) {
  if (!metafield || !metafield.value) return [];

  try {
    const parsed = JSON.parse(metafield.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    throw new Error(
      'Invalid JILL Rewards coupon wallet JSON: ' + String(err)
    );
  }
}

function normalizeRewardCoupons_(wallet, now) {
  const currentTime = (now || new Date()).getTime();

  return (Array.isArray(wallet) ? wallet : []).map(function(raw) {
    const coupon = Object.assign({}, raw || {});
    const status = clean_(coupon.status).toLowerCase();

    if (!status) coupon.status = 'active';

    if (
      clean_(coupon.status).toLowerCase() === 'active' &&
      coupon.expires_at &&
      Date.parse(coupon.expires_at) <= currentTime
    ) {
      coupon.status = 'expired';
      coupon.expired_at = coupon.expired_at || new Date(currentTime).toISOString();
    }

    return coupon;
  });
}

function rewardCouponStatus_(coupon, now) {
  if (!coupon) return 'revoked';

  const raw = clean_(coupon.status).toLowerCase() || 'active';
  if (raw === 'used' || raw === 'expired' || raw === 'revoked') return raw;

  const expiresAt = Date.parse(coupon.expires_at || '');
  if (Number.isFinite(expiresAt) && expiresAt <= (now || new Date()).getTime()) {
    return 'expired';
  }

  return 'active';
}

function rewardCouponIsActive_(coupon, now) {
  return rewardCouponStatus_(coupon, now) === 'active';
}

function rewardCommittedPoints_(wallet, now) {
  return (Array.isArray(wallet) ? wallet : []).reduce(function(total, coupon) {
    const status = rewardCouponStatus_(coupon, now || new Date());
    if (status === 'revoked') return total;
    if (status !== 'active' && status !== 'used' && status !== 'expired') {
      return total;
    }
    return total + Math.max(0, Number(coupon && coupon.points) || 0);
  }, 0);
}

function rewardDiscountSnapshots_(discountIds) {
  const ids = (Array.isArray(discountIds) ? discountIds : [])
    .map(function(id) { return clean_(id); })
    .filter(Boolean);

  if (!ids.length) return {};

  const query = `
    query JillRewardDiscountIntegrity($ids: [ID!]!) {
      nodes(ids: $ids) {
        id
        ... on DiscountCodeNode {
          codeDiscount {
            __typename
            ... on DiscountCodeBasic {
              status
              endsAt
              usageLimit
              appliesOncePerCustomer
              asyncUsageCount
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
              context {
                __typename
                ... on DiscountCustomers {
                  customers { id }
                }
              }
              customerGets {
                items {
                  __typename
                  ... on AllDiscountItems { allItems }
                }
                value {
                  __typename
                  ... on DiscountAmount {
                    amount { amount currencyCode }
                    appliesOnEachItem
                  }
                }
              }
              minimumRequirement {
                __typename
                ... on DiscountMinimumSubtotal {
                  greaterThanOrEqualToSubtotal {
                    amount
                    currencyCode
                  }
                }
              }
              codes(first: 5) { nodes { code } }
            }
          }
        }
      }
    }
  `;

  const data = shopifyGraphQL_(query, { ids: ids });
  const snapshots = {};

  (data.nodes || []).forEach(function(node) {
    if (!node || !node.id || !node.codeDiscount) return;
    snapshots[node.id] = node.codeDiscount;
  });

  return snapshots;
}

function rewardDiscountIntegrity_(snapshot, coupon, customerId, now) {
  if (!snapshot) return { ok: false, reason: 'missing' };
  if (snapshot.__typename !== 'DiscountCodeBasic') {
    return { ok: false, reason: 'wrong_discount_type' };
  }

  if (Number(snapshot.asyncUsageCount || 0) > 0) {
    return { ok: true, used: true };
  }

  const currentTime = (now || new Date()).getTime();
  const endsAt = Date.parse(snapshot.endsAt || '');
  const expectedEndsAt = Date.parse(coupon.expires_at || '');
  const expirationGraceMs = 2 * 60 * 1000;
  const expirationAligned =
    Number.isFinite(endsAt) &&
    Number.isFinite(expectedEndsAt) &&
    Math.abs(endsAt - expectedEndsAt) <= expirationGraceMs;

  // A normal 30-day expiry consumes the points. If Shopify says the reward
  // expired materially earlier than the wallet's canonical expiry, treat it
  // as an altered unusable coupon so reconciliation revokes it and releases
  // the reserved points instead of making the customer pay for admin damage.
  if (
    snapshot.status === 'EXPIRED' ||
    (Number.isFinite(endsAt) && endsAt <= currentTime)
  ) {
    if (
      Number.isFinite(expectedEndsAt) &&
      expectedEndsAt > currentTime + expirationGraceMs
    ) {
      return { ok: false, reason: 'premature_expiration' };
    }

    if (!expirationAligned) {
      return { ok: false, reason: 'expiration_policy' };
    }

    return { ok: true, expired: true };
  }

  if (snapshot.status !== 'ACTIVE') {
    return { ok: false, reason: 'status_' + clean_(snapshot.status).toLowerCase() };
  }

  const tier = JILL_REWARD_TIERS[Math.max(0, Number(coupon && coupon.points) || 0)];
  if (!tier) return { ok: false, reason: 'unsupported_tier' };

  const codes = snapshot.codes && snapshot.codes.nodes ? snapshot.codes.nodes : [];
  if (!codes.some(function(item) { return clean_(item && item.code) === clean_(coupon.code); })) {
    return { ok: false, reason: 'code_mismatch' };
  }

  if (Number(snapshot.usageLimit) !== JILL_REWARD_USAGE_LIMIT || snapshot.appliesOncePerCustomer !== JILL_REWARD_APPLIES_ONCE_PER_CUSTOMER) {
    return { ok: false, reason: 'usage_policy' };
  }

  const combines = snapshot.combinesWith || {};
  if (combines.orderDiscounts !== JILL_REWARD_ORDER_STACKING || combines.productDiscounts !== JILL_REWARD_PRODUCT_STACKING || combines.shippingDiscounts !== JILL_REWARD_SHIPPING_STACKING) {
    return { ok: false, reason: 'stacking_policy' };
  }

  const context = snapshot.context || {};
  const customers = context.customers || [];
  if (
    context.__typename !== 'DiscountCustomers' ||
    !customers.some(function(item) { return item && item.id === customerId; })
  ) {
    return { ok: false, reason: 'customer_targeting' };
  }

  const gets = snapshot.customerGets || {};
  const value = gets.value || {};
  const amount = value.amount || {};
  const items = gets.items || {};
  if (
    value.__typename !== 'DiscountAmount' ||
    amount.currencyCode !== 'USD' ||
    Number(amount.amount) !== Number(tier.value) ||
    value.appliesOnEachItem !== false ||
    items.__typename !== 'AllDiscountItems' ||
    items.allItems !== true
  ) {
    return { ok: false, reason: 'discount_value' };
  }

  const minimum = snapshot.minimumRequirement || {};
  const subtotal = minimum.greaterThanOrEqualToSubtotal || {};
  if (
    minimum.__typename !== 'DiscountMinimumSubtotal' ||
    subtotal.currencyCode !== 'USD' ||
    Number(subtotal.amount) !== Number(tier.minimum)
  ) {
    return { ok: false, reason: 'minimum_order' };
  }

  if (!expirationAligned) {
    return { ok: false, reason: 'expiration_policy' };
  }

  return { ok: true };
}

function deleteRewardDiscountIfPresent_(discountId) {
  const targetId = clean_(discountId);
  if (!targetId) return null;
  const snapshots = rewardDiscountSnapshots_([targetId]);
  if (!snapshots[targetId]) return null;
  return deleteRewardDiscount_(targetId);
}

function markRewardCouponsUsedInWallet_(wallet, order, now) {
  const codes = orderDiscountCodes_(order);
  if (!codes.length) return false;

  const usedAt = (now || new Date()).toISOString();
  let changed = false;

  (wallet || []).forEach(function(coupon) {
    if (!rewardCouponIsActive_(coupon, now || new Date())) return;
    const code = clean_(coupon.code);
    if (!code || codes.indexOf(code) === -1) return;

    coupon.status = 'used';
    coupon.used_at = coupon.used_at || usedAt;
    coupon.order_id = order.id;
    changed = true;
  });

  return changed;
}

function revokeActiveRewardsForSolvency_(wallet, earnedPoints, now) {
  const currentTime = now || new Date();
  let committed = rewardCommittedPoints_(wallet, currentTime);
  const earned = Math.max(0, Number(earnedPoints) || 0);
  let revokedPoints = 0;

  if (committed <= earned) {
    return { revoked_points: 0, committed_points: committed };
  }

  const candidates = (wallet || [])
    .filter(function(coupon) { return rewardCouponIsActive_(coupon, currentTime); })
    .sort(function(a, b) {
      return Date.parse(b.created_at || '') - Date.parse(a.created_at || '');
    });

  for (let i = 0; i < candidates.length && committed > earned; i++) {
    const coupon = candidates[i];
    const points = Math.max(0, Number(coupon.points) || 0);

    if (coupon.discount_id) {
      deleteRewardDiscountIfPresent_(coupon.discount_id);
    }

    coupon.status = 'revoked';
    coupon.revoked_at = currentTime.toISOString();
    coupon.revoked_reason = 'refund_solvency';
    revokedPoints += points;
    committed = Math.max(0, committed - points);
  }

  return {
    revoked_points: revokedPoints,
    committed_points: committed
  };
}

function rewardDeletedDiscountQueue_() {
  const raw = clean_(
    PropertiesService.getScriptProperties().getProperty(
      JILL_REWARDS_DELETED_DISCOUNT_QUEUE_PROPERTY
    )
  );

  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('Invalid JILL Rewards deleted-discount queue JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid JILL Rewards deleted-discount queue shape.');
  }

  return parsed
    .filter(function(job) {
      return job && clean_(job.discount_id);
    })
    .map(function(job) {
      return {
        discount_id: clean_(job.discount_id),
        cursor: clean_(job.cursor) || null,
        enqueued_at: clean_(job.enqueued_at) || null
      };
    });
}

function saveRewardDeletedDiscountQueue_(queue) {
  const props = PropertiesService.getScriptProperties();
  const normalized = Array.isArray(queue) ? queue : [];

  if (!normalized.length) {
    props.deleteProperty(JILL_REWARDS_DELETED_DISCOUNT_QUEUE_PROPERTY);
    return;
  }

  props.setProperty(
    JILL_REWARDS_DELETED_DISCOUNT_QUEUE_PROPERTY,
    JSON.stringify(normalized)
  );
}

function enqueueDeletedRewardDiscount_(discountId) {
  const targetId = clean_(discountId);
  if (!targetId) {
    throw new Error('Deleted reward discount queue requires a discount ID.');
  }

  const queue = rewardDeletedDiscountQueue_();
  const existing = queue.some(function(job) {
    return clean_(job && job.discount_id) === targetId;
  });

  if (!existing) {
    queue.push({
      discount_id: targetId,
      cursor: null,
      enqueued_at: new Date().toISOString()
    });
    saveRewardDeletedDiscountQueue_(queue);
  }

  return {
    queued: !existing,
    already_queued: existing,
    queue_depth: queue.length
  };
}

function processDeletedRewardDiscountQueue_() {
  const queue = rewardDeletedDiscountQueue_();

  if (!queue.length) {
    return {
      ok: true,
      queue_depth: 0,
      processed_discount_id: null,
      pages_scanned: 0,
      customers_scanned: 0,
      reconciled_customers: 0,
      restored_points: 0,
      cycle_complete: false
    };
  }

  const job = queue[0];
  const targetId = clean_(job.discount_id);
  const stillExists = rewardDiscountSnapshots_([targetId]);

  if (stillExists[targetId]) {
    queue.shift();
    saveRewardDeletedDiscountQueue_(queue);

    return {
      ok: true,
      queue_depth: queue.length,
      processed_discount_id: targetId,
      pages_scanned: 0,
      customers_scanned: 0,
      reconciled_customers: 0,
      restored_points: 0,
      cycle_complete: true,
      skipped: 'Discount still exists in Shopify'
    };
  }

  let after = clean_(job.cursor) || null;
  let pagesScanned = 0;
  let customersScanned = 0;
  let reconciledCustomers = 0;
  let restoredPoints = 0;
  let cycleComplete = false;
  let cursorRecovered = false;

  const query = `
    query JillDeletedRewardDiscount($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        nodes {
          id
          pointsBalance: metafield(
            namespace: "jill_rewards",
            key: "points_balance"
          ) { value compareDigest }
          pointsEarned: metafield(
            namespace: "jill_rewards",
            key: "points_earned_lifetime"
          ) { value compareDigest }
          pointsRedeemed: metafield(
            namespace: "jill_rewards",
            key: "points_redeemed_lifetime"
          ) { value compareDigest }
          coupons: metafield(
            namespace: "jill_rewards",
            key: "coupons"
          ) { value compareDigest }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  while (pagesScanned < JILL_REWARDS_DELETED_DISCOUNT_MAX_PAGES_PER_RUN) {
    let data;

    try {
      data = shopifyGraphQL_(query, {
        first: JILL_REWARDS_DELETED_DISCOUNT_PAGE_SIZE,
        after: after
      });
    } catch (pageErr) {
      if (after && pagesScanned === 0 && !cursorRecovered) {
        console.error(
          'JILL Rewards deleted-discount cursor reset after Shopify rejected cursor: ' +
          (pageErr && pageErr.stack ? pageErr.stack : pageErr)
        );
        job.cursor = null;
        queue[0] = job;
        saveRewardDeletedDiscountQueue_(queue);
        after = null;
        cursorRecovered = true;
        continue;
      }
      throw pageErr;
    }

    const connection = data.customers || {};
    const customers = connection.nodes || [];

    customers.forEach(function(customer) {
      customersScanned += 1;
      if (!customer || !customer.id || !customer.coupons) return;

      try {
        const now = new Date();
        const original = rewardWallet_(customer.coupons);
        const wallet = normalizeRewardCoupons_(original, now);
        let changed = JSON.stringify(original) !== JSON.stringify(wallet);
        let released = 0;

        wallet.forEach(function(coupon) {
          if (
            clean_(coupon && coupon.discount_id) === targetId &&
            rewardCouponIsActive_(coupon, now)
          ) {
            released += Math.max(0, Number(coupon.points) || 0);
            coupon.status = 'revoked';
            coupon.revoked_at = now.toISOString();
            coupon.revoked_reason = 'admin_deleted';
            changed = true;
          }
        });

        if (!changed || released <= 0) return;

        const committed = rewardCommittedPoints_(wallet, now);
        const earned = rewardInt_(customer.pointsEarned);
        const balance = Math.max(0, earned - committed);

        setRewardMetafields_([
          rewardMetafieldInput_(
            customer.id,
            'coupons',
            'json',
            JSON.stringify(wallet),
            customer.coupons
          ),
          rewardMetafieldInput_(
            customer.id,
            'points_balance',
            'number_integer',
            balance,
            customer.pointsBalance
          ),
          rewardMetafieldInput_(
            customer.id,
            'points_redeemed_lifetime',
            'number_integer',
            committed,
            customer.pointsRedeemed
          )
        ]);

        reconciledCustomers += 1;
        restoredPoints += released;
      } catch (customerErr) {
        console.error(
          'JILL Rewards deleted-discount customer ' + customer.id + ': ' +
          (customerErr && customerErr.stack ? customerErr.stack : customerErr)
        );
      }
    });

    pagesScanned += 1;

    const pageInfo = connection.pageInfo || {};
    const hasNextPage = Boolean(pageInfo.hasNextPage);
    const nextCursor = clean_(pageInfo.endCursor) || null;

    if (!hasNextPage) {
      queue.shift();
      saveRewardDeletedDiscountQueue_(queue);
      after = null;
      cycleComplete = true;
      break;
    }

    if (!nextCursor || nextCursor === after) {
      throw new Error(
        'JILL Rewards deleted-discount pagination returned an invalid next cursor.'
      );
    }

    // Commit queue progress only after the page has been handled. If Apps
    // Script stops earlier, the same page is revisited and wallet writes
    // converge safely through coupon status + compareDigest semantics.
    job.cursor = nextCursor;
    queue[0] = job;
    saveRewardDeletedDiscountQueue_(queue);
    after = nextCursor;
  }

  const currentQueue = rewardDeletedDiscountQueue_();
  const result = {
    ok: true,
    queue_depth: currentQueue.length,
    processed_discount_id: targetId,
    pages_scanned: pagesScanned,
    customers_scanned: customersScanned,
    reconciled_customers: reconciledCustomers,
    restored_points: restoredPoints,
    cursor_recovered: cursorRecovered,
    cycle_complete: cycleComplete
  };

  Logger.log(
    'JILL Rewards deleted discount queue ' +
    targetId + ': ' + JSON.stringify(result)
  );

  return result;
}

function normalizeRewardWalletForCustomer_(customer) {
  if (!customer || !customer.id) return false;

  const now = new Date();
  const original = rewardWallet_(customer.coupons);
  const wallet = normalizeRewardCoupons_(original, now);
  let changed = JSON.stringify(original) !== JSON.stringify(wallet);

  const active = wallet.filter(function(coupon) {
    return rewardCouponIsActive_(coupon, now);
  });
  const ids = active
    .map(function(coupon) { return clean_(coupon.discount_id); })
    .filter(Boolean);
  const snapshots = rewardDiscountSnapshots_(ids);

  active.forEach(function(coupon) {
    const discountId = clean_(coupon.discount_id);
    const integrity = rewardDiscountIntegrity_(
      discountId ? snapshots[discountId] : null,
      coupon,
      customer.id,
      now
    );

    if (integrity.used) {
      coupon.status = 'used';
      coupon.used_at = coupon.used_at || now.toISOString();
      coupon.usage_verified_at = now.toISOString();
      changed = true;
      return;
    }

    if (integrity.expired) {
      coupon.status = 'expired';
      coupon.expired_at = coupon.expired_at || now.toISOString();
      changed = true;
      return;
    }

    if (integrity.ok) return;

    if (discountId && snapshots[discountId]) {
      deleteRewardDiscountIfPresent_(discountId);
    }

    coupon.status = 'revoked';
    coupon.revoked_at = now.toISOString();
    coupon.revoked_reason = 'integrity_' + integrity.reason;
    changed = true;
  });

  const committed = rewardCommittedPoints_(wallet, now);
  const earned = rewardInt_(customer.pointsEarned);
  const balance = Math.max(0, earned - committed);
  const metafields = [];

  if (changed) {
    metafields.push(
      rewardMetafieldInput_(
        customer.id,
        'coupons',
        'json',
        JSON.stringify(wallet),
        customer.coupons
      )
    );
  }

  if (rewardInt_(customer.pointsRedeemed) !== committed) {
    metafields.push(
      rewardMetafieldInput_(
        customer.id,
        'points_redeemed_lifetime',
        'number_integer',
        committed,
        customer.pointsRedeemed
      )
    );
  }

  if (rewardInt_(customer.pointsBalance) !== balance) {
    metafields.push(
      rewardMetafieldInput_(
        customer.id,
        'points_balance',
        'number_integer',
        balance,
        customer.pointsBalance
      )
    );
  }

  if (!metafields.length) return false;

  setRewardMetafields_(metafields);
  return true;
}

function orderDiscountCodes_(order) {
  const applications =
    order && order.discountApplications && order.discountApplications.nodes
      ? order.discountApplications.nodes
      : [];

  return applications
    .map(function(application) {
      return clean_(application && application.code);
    })
    .filter(Boolean);
}

function setRewardMetafields_(metafields) {
  const mutation = `
    mutation SetJillRewardMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
          compareDigest
        }
        userErrors { field message code }
      }
    }
  `;

  const data = shopifyGraphQL_(mutation, { metafields: metafields });
  const payload = data.metafieldsSet || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify metafieldsSet: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  return payload.metafields || [];
}

function rewardMetafieldInput_(ownerId, key, type, value, existing) {
  const input = {
    ownerId: ownerId,
    namespace: 'jill_rewards',
    key: key,
    type: type,
    value: String(value)
  };

  input.compareDigest = existing ? existing.compareDigest : null;
  return input;
}

function rewardInt_(metafield) {
  const value =
    metafield && metafield.value != null
      ? Number.parseInt(metafield.value, 10)
      : 0;

  return Number.isFinite(value) ? value : 0;
}

function rewardCode_(value) {
  const token = Utilities
    .getUuid()
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase();

  return 'JILL' + value + '-' + token;
}



/* ---------------------------
   CUSTOM ORDER DELIVERY STATE
---------------------------- */

function submissionState_(status) {
  const raw = clean_(status);
  const state = {
    shopify: 'PENDING',
    customerEmail: 'PENDING',
    merchantEmail: 'PENDING'
  };

  // Preserve the meaning of historical rows while migrating them to the
  // canonical stage status the next time that submission is retried.
  if (raw === 'SENT + SHOPIFY') {
    state.shopify = 'SYNCED';
    state.customerEmail = 'ACCEPTED';
    return state;
  }

  if (raw === 'SENT / SHOPIFY ERROR') {
    state.shopify = 'ERROR';
    state.customerEmail = 'ACCEPTED';
    return state;
  }

  if (raw === 'SENT') {
    state.customerEmail = 'ACCEPTED';
    return state;
  }

  const shopifyMatch = raw.match(/(?:^|\|\s*)SHOPIFY=(PENDING|ATTEMPTING|SYNCED|ERROR)(?:\s*\||$)/);
  const customerMatch = raw.match(/(?:^|\|\s*)CUSTOMER_EMAIL=(PENDING|ATTEMPTING|ACCEPTED|ERROR)(?:\s*\||$)/);
  const merchantMatch = raw.match(/(?:^|\|\s*)MERCHANT_EMAIL=(PENDING|ATTEMPTING|ACCEPTED|ERROR)(?:\s*\||$)/);

  if (shopifyMatch) state.shopify = shopifyMatch[1];
  if (customerMatch) state.customerEmail = customerMatch[1];
  if (merchantMatch) state.merchantEmail = merchantMatch[1];

  return state;
}

function submissionStatusValue_(state) {
  return [
    'RECEIVED',
    'SHOPIFY=' + state.shopify,
    'CUSTOMER_EMAIL=' + state.customerEmail,
    'MERCHANT_EMAIL=' + state.merchantEmail
  ].join(' | ');
}

function writeSubmissionStatus_(sheet, row, statusColumn, state) {
  sheet
    .getRange(row, statusColumn)
    .setValue(submissionStatusValue_(state));
  SpreadsheetApp.flush();
}

function submissionComplete_(state) {
  return (
    state.shopify === 'SYNCED' &&
    state.customerEmail === 'ACCEPTED' &&
    state.merchantEmail === 'ACCEPTED'
  );
}

function emailStageShouldAttempt_(stage) {
  // Only a never-attempted email may be sent automatically. ERROR and
  // ATTEMPTING are terminal for network retries so an ambiguous MailApp
  // outcome cannot create a duplicate customer or merchant message.
  return stage === 'PENDING';
}

function logSubmissionStageError_(submissionId, stage, err) {
  console.error(
    'Custom Order ' + submissionId + ' — ' + stage + ' failed: ' +
    (err && err.stack ? err.stack : err)
  );
}

function customOrderSuccess_(submissionId, duplicate) {
  return json_({
    version: 1,
    operation: 'custom_order.submit.result',
    ok: true,
    submission_id: submissionId,
    duplicate: Boolean(duplicate),
    status: 'received'
  });
}

function customOrderFailure_(code, message, retryable) {
  return json_({
    version: 1,
    operation: 'custom_order.submit.result',
    ok: false,
    error: {
      code: clean_(code) || 'backend_error',
      message: clean_(message) || 'Custom Order request failed.',
      retryable: Boolean(retryable)
    }
  });
}


/* ---------------------------
   CUSTOMER CONFIRMATION
---------------------------- */

function sendCustomerConfirmation_(data) {
  assertMailQuota_('customer confirmation');

  const nameText = clean_(data.name) || 'there';
  const dateNeededText = clean_(data.date_needed) || 'Not provided';
  const fulfillmentText = clean_(data.fulfillment) || 'Not provided';
  const name = escapeHtml_(nameText);
  const dateNeeded = escapeHtml_(dateNeededText);
  const fulfillment = escapeHtml_(fulfillmentText);
  const subject = 'We received your JILL custom order request 💜';

  const html = `
    <p>Hi ${name},</p>

    <p>
      JILL received your custom order request and it is now under review.
    </p>

    <p>
      This confirmation only means we received your request. It is
      <strong>not</strong> a confirmed order, <strong>not</strong> a confirmed
      price, <strong>not</strong> a confirmed production slot, and
      <strong>not</strong> a guaranteed delivery date.
    </p>

    <p>
      <strong>Date Needed:</strong> ${dateNeeded}<br>
      <strong>Fulfillment:</strong> ${fulfillment}
    </p>

    <p>
      We will review the details you submitted and contact you with next steps.
      If we need clarification, we will use your preferred contact method.
    </p>

    <p>Thank you for choosing JILL!</p>

    <p>
      <strong>JILL</strong><br>
      <a href="${JILL.STORE_URL}">jillonlinestore.com</a>
    </p>
  `;

  const plainText =
`Hi ${nameText},

JILL received your custom order request and it is now under review.

This confirmation only means we received your request. It is not a confirmed order, not a confirmed price, not a confirmed production slot, and not a guaranteed delivery date.

Date Needed: ${dateNeededText}
Fulfillment: ${fulfillmentText}

We will review the details you submitted and contact you with next steps. If we need clarification, we will use your preferred contact method.

Thank you for choosing JILL!

JILL
jillonlinestore.com`;

  MailApp.sendEmail(
    data.email,
    subject,
    plainText,
    {
      htmlBody: html,
      name: 'JILL',
      replyTo: JILL.STORE_EMAIL
    }
  );
}


/* ---------------------------
   MERCHANT NOTIFICATION
---------------------------- */

function sendMerchantNotification_(data) {
  assertMailQuota_('merchant notification');

  const summary = merchantRequestSummary_(data);
  const customerName = clean_(data.name) || 'Customer';
  const subject = 'New JILL Custom Order Request — ' + customerName;
  const shipping = merchantShippingSummary_(data);

  const plainText = [
    'New JILL Custom Order Request',
    '',
    'Submission ID: ' + clean_(data.submission_id),
    'Submitted: ' + (clean_(data.submitted_at) || 'Not provided'),
    '',
    'CUSTOMER',
    'Name: ' + customerName,
    'Email: ' + clean_(data.email),
    'Phone: ' + (clean_(data.phone) || 'Not provided'),
    'Preferred contact: ' + (clean_(data.preferred_contact) || 'Not provided'),
    '',
    'REQUEST',
    'Collections selected: ' + (clean_(data.collections) || 'Not provided'),
    'Requested products/items and quantities:',
    summary.items,
    '',
    'Product Options:',
    summary.productOptions,
    '',
    'Personalization:',
    summary.personalization,
    '',
    'Theme / style: ' + (clean_(data.theme) || 'Not provided'),
    'Colors: ' + (clean_(data.colors) || 'Not provided'),
    'Reference images: ' + summary.references,
    '',
    'PLANNING',
    'Date Needed: ' + (clean_(data.date_needed) || 'Not provided'),
    'Fulfillment: ' + (clean_(data.fulfillment) || 'Not provided'),
    'Shipping: ' + shipping,
    '',
    'Marketing consent: ' + (marketingConsentGranted_(data.marketing_consent) ? 'Yes' : 'No'),
    '',
    'JILL Custom Order backend'
  ].join('\n');

  const html = `
    <h2>New JILL Custom Order Request</h2>

    <p>
      <strong>Submission ID:</strong> ${escapeHtml_(clean_(data.submission_id))}<br>
      <strong>Submitted:</strong> ${escapeHtml_(clean_(data.submitted_at) || 'Not provided')}
    </p>

    <h3>Customer</h3>
    <p>
      <strong>Name:</strong> ${escapeHtml_(customerName)}<br>
      <strong>Email:</strong> ${escapeHtml_(clean_(data.email))}<br>
      <strong>Phone:</strong> ${escapeHtml_(clean_(data.phone) || 'Not provided')}<br>
      <strong>Preferred contact:</strong> ${escapeHtml_(clean_(data.preferred_contact) || 'Not provided')}
    </p>

    <h3>Request</h3>
    <p>
      <strong>Collections selected:</strong> ${escapeHtml_(clean_(data.collections) || 'Not provided')}
    </p>

    <p><strong>Requested products/items and quantities:</strong><br>${multilineHtml_(summary.items)}</p>
    <p><strong>Product Options:</strong><br>${multilineHtml_(summary.productOptions)}</p>
    <p><strong>Personalization:</strong><br>${multilineHtml_(summary.personalization)}</p>

    <p>
      <strong>Theme / style:</strong> ${escapeHtml_(clean_(data.theme) || 'Not provided')}<br>
      <strong>Colors:</strong> ${escapeHtml_(clean_(data.colors) || 'Not provided')}<br>
      <strong>Reference images:</strong> ${multilineHtml_(summary.references)}
    </p>

    <h3>Planning</h3>
    <p>
      <strong>Date Needed:</strong> ${escapeHtml_(clean_(data.date_needed) || 'Not provided')}<br>
      <strong>Fulfillment:</strong> ${escapeHtml_(clean_(data.fulfillment) || 'Not provided')}<br>
      <strong>Shipping:</strong> ${escapeHtml_(shipping)}
    </p>

    <p>
      <strong>Marketing consent:</strong>
      ${marketingConsentGranted_(data.marketing_consent) ? 'Yes' : 'No'}
    </p>

    <p><a href="${JILL.STORE_URL}">jillonlinestore.com</a></p>
  `;

  MailApp.sendEmail(
    JILL.STORE_EMAIL,
    subject,
    plainText,
    {
      htmlBody: html,
      name: 'JILL Custom Orders',
      replyTo: data.email
    }
  );
}

function assertMailQuota_(label) {
  const remaining = MailApp.getRemainingDailyQuota();

  if (remaining < 1) {
    throw new Error(
      'Google mail quota exhausted before ' + label +
      '. Remaining recipient quota: ' + remaining
    );
  }
}

function canonicalCustomOrderRequest_(data) {
  const raw = clean_(data.raw_payload);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
}

function merchantRequestSummary_(data) {
  const request = canonicalCustomOrderRequest_(data);
  const items = request && Array.isArray(request.items) ? request.items : [];
  const flatProducts = clean_(data.products);
  const itemLines = [];
  const optionBlocks = [];
  const personalizationBlocks = [];
  const referenceIds = [];

  if (flatProducts) {
    itemLines.push(flatProducts);
  } else {
    items.forEach(function(item) {
      const title = clean_(item && item.title) || clean_(item && item.product_id) || 'Item';
      const quantity = Math.max(1, Number(item && item.quantity) || 1);
      itemLines.push(title + ' — Qty ' + quantity);
    });
  }

  items.forEach(function(item) {
    const title = clean_(item && item.title) || clean_(item && item.product_id) || 'Item';
    const optionLines = [];
    const attributes = item && Array.isArray(item.attributes) ? item.attributes : [];
    const variants = item && Array.isArray(item.variant_allocations)
      ? item.variant_allocations
      : [];

    attributes.forEach(function(attribute) {
      optionLines.push(formatMerchantAttribute_(attribute));
    });

    variants.forEach(function(variant) {
      const variantTitle = clean_(variant && variant.title) || clean_(variant && variant.variant_id) || 'Variant';
      const quantity = Math.max(1, Number(variant && variant.quantity) || 1);
      optionLines.push('Variant: ' + variantTitle + ' — Qty ' + quantity);
    });

    if (optionLines.length) {
      optionBlocks.push(title + '\n  ' + optionLines.join('\n  '));
    }

    const groups = item && Array.isArray(item.personalization_groups)
      ? item.personalization_groups
      : [];

    groups.forEach(function(group, index) {
      const groupLines = [];
      const groupAttributes = group && Array.isArray(group.attributes)
        ? group.attributes
        : [];
      const allocations = group && Array.isArray(group.allocations)
        ? group.allocations
        : [];

      groupAttributes.forEach(function(attribute) {
        groupLines.push(formatMerchantAttribute_(attribute));
      });

      groupLines.push('Allocated units: ' + allocations.length);
      personalizationBlocks.push(
        title + ' — Personalization ' + (index + 1) + '\n  ' +
        groupLines.join('\n  ')
      );
    });

    const itemReferenceIds = item && Array.isArray(item.reference_ids)
      ? item.reference_ids
      : [];
    itemReferenceIds.forEach(function(referenceId) {
      const value = clean_(referenceId);
      if (value && referenceIds.indexOf(value) === -1) referenceIds.push(value);
    });
  });

  if (request && Array.isArray(request.reference_ids)) {
    request.reference_ids.forEach(function(referenceId) {
      const value = clean_(referenceId);
      if (value && referenceIds.indexOf(value) === -1) referenceIds.push(value);
    });
  }

  const referenceText = clean_(data.reference_images);
  const referenceParts = [];
  if (referenceText) referenceParts.push(referenceText);
  if (referenceIds.length) {
    referenceParts.push(
      referenceIds.length + ' reference file(s):\n' + referenceIds.join('\n')
    );
  }

  return {
    items: itemLines.length ? itemLines.join('\n') : 'Not provided',
    productOptions: optionBlocks.length ? optionBlocks.join('\n\n') : 'No additional product options provided',
    personalization: personalizationBlocks.length ? personalizationBlocks.join('\n\n') : 'No personalization provided',
    references: referenceParts.length ? referenceParts.join('\n') : 'No reference images provided'
  };
}

function formatMerchantAttribute_(attribute) {
  const label =
    clean_(attribute && attribute.label) ||
    clean_(attribute && attribute.id) ||
    'Option';
  const value = attribute ? attribute.value : '';
  let formatted = '';

  if (Array.isArray(value)) {
    formatted = value.map(function(item) { return clean_(item); }).filter(Boolean).join(', ');
  } else if (typeof value === 'boolean') {
    formatted = value ? 'Yes' : 'No';
  } else {
    formatted = clean_(value);
  }

  return label + ': ' + (formatted || 'Not provided');
}

function merchantShippingSummary_(data) {
  const fulfillment = clean_(data.fulfillment).toLowerCase();
  const address = [clean_(data.city), clean_(data.state), clean_(data.zip)]
    .filter(Boolean)
    .join(', ');

  if (fulfillment.indexOf('shipping') === -1) {
    return address || 'Not applicable';
  }

  return address || 'Shipping selected; address not provided';
}

function multilineHtml_(value) {
  return escapeHtml_(clean_(value) || 'Not provided').replace(/\n/g, '<br>');
}


/* ---------------------------
   SHOPIFY CUSTOMER SYNC
---------------------------- */

function syncShopifyCustomer_(data) {
  const email = clean_(data.email).toLowerCase();

  if (!isValidEmail_(email)) {
    throw new Error('Cannot sync Shopify customer without a valid email.');
  }

  const submittedPhone = normalizePhone_(data.phone);
  const mutation = `
    mutation UpsertCustomer(
      $identifier: CustomerSetIdentifiers,
      $input: CustomerSetInput!
    ) {
      customerSet(identifier: $identifier, input: $input) {
        customer { id email }
        userErrors { field message }
      }
    }
  `;

  const input = {
    email: email,
    firstName: firstName_(data.name),
    lastName: lastName_(data.name)
  };

  if (!input.lastName) delete input.lastName;
  if (submittedPhone) input.phone = submittedPhone;

  let result = shopifyGraphQL_(mutation, {
    identifier: { email: email },
    input: input
  });
  let payload = result.customerSet || {};
  let errors = payload.userErrors || [];

  // A malformed or already-owned phone number must not block the email-based
  // customer upsert. Retry without phone, preserving the canonical email ID.
  if (errors.length && submittedPhone) {
    delete input.phone;
    result = shopifyGraphQL_(mutation, {
      identifier: { email: email },
      input: input
    });
    payload = result.customerSet || {};
    errors = payload.userErrors || [];
  }

  if (errors.length) {
    throw new Error(
      'Shopify customerSet: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }

  const customer = payload.customer;

  if (!customer || !customer.id) {
    throw new Error('Shopify customerSet returned no customer ID.');
  }

  setShopifyCustomerMetafields_(customer.id, data);

  // Unchecked consent never changes an existing marketing state. A checked
  // submission converges to the production-proven SINGLE_OPT_IN state using
  // the original submission timestamp so retries do not invent new consent.
  if (marketingConsentGranted_(data.marketing_consent)) {
    subscribeEmailMarketing_(
      customer.id,
      data.marketing_consent_at || data.submitted_at
    );
  }

  return customer.id;
}

function setShopifyCustomerMetafields_(customerId, data) {
  const metafields = buildCustomerMetafields_(customerId, data);

  if (!metafields.length) return;

  const mutation = `
    mutation SetCustomerMetafields(
      $metafields: [MetafieldsSetInput!]!
    ) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          namespace
          key
          value
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const result = shopifyGraphQL_(mutation, {
    metafields: metafields
  });
  const payload = result.metafieldsSet || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify metafieldsSet: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }
}

function buildCustomerMetafields_(ownerId, data) {
  const metafields = [];

  function addText(key, value) {
    value = clean_(value);
    if (!value) return;

    metafields.push({
      ownerId: ownerId,
      namespace: 'jill',
      key: key,
      type: 'single_line_text_field',
      value: value.replace(/\s+/g, ' ').trim()
    });
  }

  function addLongText(key, value) {
    value = clean_(value);
    if (!value) return;

    metafields.push({
      ownerId: ownerId,
      namespace: 'jill',
      key: key,
      type: 'multi_line_text_field',
      value: value
    });
  }

  function addDate(key, value) {
    value = clean_(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;

    metafields.push({
      ownerId: ownerId,
      namespace: 'jill',
      key: key,
      type: 'date',
      value: value
    });
  }

  function addDateTime(key, value) {
    value = clean_(value);
    if (!value) return;

    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return;

    metafields.push({
      ownerId: ownerId,
      namespace: 'jill',
      key: key,
      type: 'date_time',
      value: parsed.toISOString()
    });
  }

  addDateTime(
    'last_custom_request_at',
    data.submitted_at || new Date().toISOString()
  );
  addText('last_custom_request_id', data.submission_id);
  addText('custom_request_status', 'Received');
  addText('preferred_contact', data.preferred_contact);
  addDate('date_needed', data.date_needed);
  addText('fulfillment_preference', data.fulfillment);
  addText('city', data.city);
  addText('state', data.state);
  addText('zip', data.zip);
  addText('submitted_phone', data.phone);
  addLongText('theme_interest', data.theme);
  addLongText('color_preferences', data.colors);
  addLongText('product_interests', data.products);
  addLongText('collection_interests', data.collections);
  addText('reference_images', data.reference_images);

  if (marketingConsentGranted_(data.marketing_consent)) {
    metafields.push({
      ownerId: ownerId,
      namespace: 'jill',
      key: 'annual_reminder_enabled',
      type: 'boolean',
      value: 'true'
    });

    addText(
      'marketing_consent_source',
      data.marketing_consent_source || 'Custom Order Form'
    );

    addDateTime(
      'marketing_consent_at',
      data.marketing_consent_at || data.submitted_at || new Date().toISOString()
    );
  }

  return metafields;
}

function subscribeEmailMarketing_(customerId, consentAt) {
  const mutation = `
    mutation EmailConsent(
      $input: CustomerEmailMarketingConsentUpdateInput!
    ) {
      customerEmailMarketingConsentUpdate(input: $input) {
        customer { id }
        userErrors { field message }
      }
    }
  `;

  const timestamp = isoDateTime_(consentAt) || new Date().toISOString();
  const result = shopifyGraphQL_(mutation, {
    input: {
      customerId: customerId,
      emailMarketingConsent: {
        marketingState: 'SUBSCRIBED',
        marketingOptInLevel: 'SINGLE_OPT_IN',
        consentUpdatedAt: timestamp
      }
    }
  });
  const payload = result.customerEmailMarketingConsentUpdate || {};
  const errors = payload.userErrors || [];

  if (errors.length) {
    throw new Error(
      'Shopify email consent: ' +
      errors.map(function(error) { return error.message; }).join(' | ')
    );
  }
}

function marketingConsentGranted_(value) {
  if (value === true || value === 1) return true;
  const normalized = clean_(value).toLowerCase();
  return (
    normalized === 'yes' ||
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'on'
  );
}

function normalizePhone_(value) {
  const raw = clean_(value);
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;

  if (
    raw.charAt(0) === '+' &&
    digits.length >= 8 &&
    digits.length <= 15
  ) {
    return '+' + digits;
  }

  return '';
}

/* ---------------------------
   SHOPIFY GRAPHQL
---------------------------- */

function shopifyGraphQL_(query, variables) {
  let attempt = 0;

  while (attempt < 2) {
    attempt++;

    const auth = getShopifyAuth_();
    const response = UrlFetchApp.fetch(
      'https://' + auth.shop +
      '/admin/api/' + JILL.SHOPIFY_API_VERSION + '/graphql.json',
      {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'X-Shopify-Access-Token': auth.accessToken
        },
        payload: JSON.stringify({
          query: query,
          variables: variables || {}
        }),
        muteHttpExceptions: true
      }
    );

    const status = response.getResponseCode();
    const text = response.getContentText();

    if ((status === 401 || status === 403) && attempt === 1) {
      getShopifyAuth_(true);
      continue;
    }

    if (status < 200 || status >= 300) {
      throw new Error(
        'Shopify GraphQL HTTP ' + status + ': ' + text
      );
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error('Invalid Shopify JSON: ' + text);
    }

    if (json.errors && json.errors.length) {
      throw new Error(
        'Shopify GraphQL: ' +
        json.errors.map(function(error) {
          return error.message;
        }).join(' | ')
      );
    }

    return json.data || {};
  }

  throw new Error('Shopify authorization failed.');
}


/* ---------------------------
   SHOPIFY AUTH
---------------------------- */

function getShopifyAuth_(forceRefresh) {
  assertJillRewardsRuntimeTarget_();
  const props = PropertiesService.getScriptProperties();
  const shop = normalizeShopDomain_(
    props.getProperty('SHOPIFY_SHOP') || 'jill-online-store.myshopify.com'
  );

  let accessToken = clean_(props.getProperty('SHOPIFY_ACCESS_TOKEN'));

  if (!forceRefresh && accessToken) {
    return {
      shop: shop,
      accessToken: accessToken
    };
  }

  const clientId = clean_(props.getProperty('SHOPIFY_CLIENT_ID'));
  const clientSecret = clean_(props.getProperty('SHOPIFY_CLIENT_SECRET'));

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET Script Property.'
    );
  }

  accessToken = exchangeShopifyClientCredentials_(
    shop,
    clientId,
    clientSecret
  );

  props.setProperty('SHOPIFY_ACCESS_TOKEN', accessToken);

  return {
    shop: shop,
    accessToken: accessToken
  };
}

function exchangeShopifyClientCredentials_(shop, clientId, clientSecret) {
  const response = UrlFetchApp.fetch(
    'https://' + shop + '/admin/oauth/access_token',
    {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      },
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      'Shopify token exchange HTTP ' + status + ': ' + text
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error('Invalid Shopify token JSON: ' + text);
  }

  const accessToken = clean_(json.access_token);

  if (!accessToken) {
    throw new Error('Shopify token exchange returned no access_token.');
  }

  return accessToken;
}

function setupShopifyOAuth() {
  assertJillRewardsRuntimeTarget_();
  const props = PropertiesService.getScriptProperties();
  const shop = normalizeShopDomain_(
    props.getProperty('SHOPIFY_SHOP') || 'jill-online-store.myshopify.com'
  );
  const clientId = clean_(props.getProperty('SHOPIFY_CLIENT_ID'));

  if (!clientId) {
    throw new Error('Missing SHOPIFY_CLIENT_ID Script Property.');
  }

  const state = Utilities.getUuid();
  props.setProperty('SHOPIFY_OAUTH_STATE', state);

  const url =
    'https://' + shop + '/admin/oauth/authorize' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&scope=' + encodeURIComponent(shopifyRequiredScopes_()) +
    '&redirect_uri=' + encodeURIComponent(shopifyOAuthRedirectUri_()) +
    '&state=' + encodeURIComponent(state);

  Logger.log('Open this Shopify authorization URL: ' + url);
  return url;
}

function handleShopifyOAuthCallback_(e) {
  assertJillRewardsRuntimeTarget_();
  const props = PropertiesService.getScriptProperties();
  const error = clean_(e && e.parameter ? e.parameter.error : '');

  if (error) {
    throw new Error(
      'Shopify OAuth error: ' +
      error + ' ' + clean_(e.parameter.error_description)
    );
  }

  const state = clean_(e && e.parameter ? e.parameter.state : '');
  const expectedState = clean_(props.getProperty('SHOPIFY_OAUTH_STATE'));

  if (!state || !expectedState || state !== expectedState) {
    throw new Error('Invalid Shopify OAuth state.');
  }

  const code = clean_(e.parameter.code);
  const shop = normalizeShopDomain_(e.parameter.shop);
  const clientId = clean_(props.getProperty('SHOPIFY_CLIENT_ID'));
  const clientSecret = clean_(props.getProperty('SHOPIFY_CLIENT_SECRET'));

  if (!code || !shop || !clientId || !clientSecret) {
    throw new Error('Incomplete Shopify OAuth callback.');
  }
  if (JILL_REWARDS_RUNTIME === 'WORK' && shop !== 'jill-work.myshopify.com') {
    throw new Error('WORK Shopify OAuth callback did not target JILL WORK.');
  }

  const response = UrlFetchApp.fetch(
    'https://' + shop + '/admin/oauth/access_token',
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      }),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      'Shopify OAuth token exchange HTTP ' + status + ': ' + text
    );
  }

  const json = JSON.parse(text);
  const accessToken = clean_(json.access_token);

  if (!accessToken) {
    throw new Error('Shopify OAuth did not return an access token.');
  }

  props.setProperties({
    SHOPIFY_SHOP: shop,
    SHOPIFY_ACCESS_TOKEN: accessToken
  });
  props.deleteProperty('SHOPIFY_OAUTH_STATE');

  return ContentService
    .createTextOutput(
      'JILL Shopify authorization is complete. You can close this tab.'
    )
    .setMimeType(ContentService.MimeType.TEXT);
}

function shopifyRequiredScopes_() {
  return [
    'read_customers',
    'write_customers',
    'read_orders',
    'write_orders',
    'read_discounts',
    'write_discounts'
  ].join(',');
}

function shopifyOAuthRedirectUri_() {
  const props = PropertiesService.getScriptProperties();
  const configured = clean_(props.getProperty('SHOPIFY_REDIRECT_URI'));

  if (!configured) {
    throw new Error(
      'Missing SHOPIFY_REDIRECT_URI Script Property. Set it to the public Apps Script Web app /exec URL.'
    );
  }

  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/i.test(configured)) {
    throw new Error(
      'SHOPIFY_REDIRECT_URI must be the public Apps Script Web app URL ending in /exec, not /dev: ' + configured
    );
  }

  return configured;
}

function normalizeShopDomain_(value) {
  return clean_(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
    .toLowerCase();
}


/* ---------------------------
   SHEET STORAGE
---------------------------- */

function getSheet_() {
  const ss = SpreadsheetApp.openById(JILL.SHEET_ID);
  let sheet = ss.getSheetByName(JILL.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(JILL.SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function saveSubmission_(sheet, data) {
  const row = HEADERS.map(function(header) {
    return serializeValue_(data[header]);
  });

  sheet.appendRow(row);
  return sheet.getLastRow();
}

function findSubmissionRow_(sheet, submissionId) {
  if (!submissionId || sheet.getLastRow() < 2) return 0;

  const idColumn = HEADERS.indexOf('submission_id') + 1;
  const values = sheet
    .getRange(2, idColumn, sheet.getLastRow() - 1, 1)
    .getValues();

  for (let i = 0; i < values.length; i++) {
    if (clean_(values[i][0]) === submissionId) {
      return i + 2;
    }
  }

  return 0;
}

function ensureHeaders_(sheet) {
  const current = sheet
    .getRange(1, 1, 1, HEADERS.length)
    .getValues()[0];

  let needsUpdate = false;

  for (let i = 0; i < HEADERS.length; i++) {
    if (clean_(current[i]) !== HEADERS[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}


/* ---------------------------
   HELPERS
---------------------------- */

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body.');
  }

  const raw = e.postData.contents;
  const type = clean_(e.postData.type).toLowerCase();

  if (type.indexOf('application/json') !== -1) {
    return JSON.parse(raw);
  }

  // Fallback for form-encoded payloads.
  const data = {};
  raw.split('&').forEach(function(pair) {
    const parts = pair.split('=');
    const key = decodeURIComponent(parts.shift() || '');
    const value = decodeURIComponent(parts.join('=') || '').replace(/\+/g, ' ');
    data[key] = value;
  });
  return data;
}

function clean_(value) {
  return value == null ? '' : String(value).trim();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function firstName_(name) {
  const parts = clean_(name).split(/\s+/).filter(Boolean);
  return parts.length ? parts[0] : 'JILL';
}

function lastName_(name) {
  const parts = clean_(name).split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

function serializeValue_(value) {
  if (value == null) return '';
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function jsonArrayString_(value) {
  if (Array.isArray(value)) return JSON.stringify(value);

  const raw = clean_(value);
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed]);
  } catch (err) {
    return JSON.stringify([raw]);
  }
}

function isoDate_(value) {
  const raw = clean_(value);
  if (!raw) return '';

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : '';
}

function isoDateTime_(value) {
  const raw = clean_(value);
  if (!raw) return '';

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function constantTimeEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;

  for (let index = 0; index < length; index += 1) {
    difference |=
      (index < a.length ? a.charCodeAt(index) : 0) ^
      (index < b.length ? b.charCodeAt(index) : 0);
  }

  return difference === 0;
}

function fingerprint_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(function(byte) {
      const normalized = byte < 0 ? byte + 256 : byte;
      return ('0' + normalized.toString(16)).slice(-2);
    })
    .join('');
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
