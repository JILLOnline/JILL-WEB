// Offline verification of Cloudflare R2 usage response parser.
// Synthetic provider JSON ONLY; absolutely no Cloudflare calls/tokens.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  summarizeWorkR2AccountUsage as summarize,
  WORK_R2_OPERATIONS_QUERY as query,
  WORK_R2_USAGE_ACCOUNT_ID as account,
} from './inspect-work-hq-r2-account-usage.mjs';

const nowMs=Date.parse('2026-10-16T12:34:56.000Z');
const storageResponse={success:true,result:{
  standard:{
    uploaded:{objects:1,payloadSize:100,metadataSize:2},
    published:{objects:2,payloadSize:300,metadataSize:3},
  },
  infrequentAccess:{
    uploaded:{objects:0,payloadSize:0,metadataSize:0},
  },
}};
const operationsResponse={data:{viewer:{accounts:[{
  r2OperationsAdaptiveGroups:[
    {dimensions:{actionType:'PutObject'},sum:{requests:2}},
    {dimensions:{actionType:'HeadObject'},sum:{requests:3}},
    {dimensions:{actionType:'HeadObject'},sum:{requests:4}},
  ],
}]}}};
const valid={storageResponse,operationsResponse,nowMs};
const r=summarize(valid);
assert.deepEqual(r,{
  state:'read_only_analytics_observed',
  month_utc:'2026-10',
  standard_storage_bytes_observed:405,
  standard_objects_observed:3,
  other_storage_class_bytes_observed:0,
  other_storage_class_objects_observed:0,
  requests_observed:9,
  action_counts:[
    {action:'HeadObject',requests:7},
    {action:'PutObject',requests:2},
  ],
  account_scope_requested:true,
  complete_billing_evidence:false,
  safe_spend_guaranteed:false,
  can_authorize_r2_upload:false,
  account_metrics_may_be_delayed_or_sampled:true,
});
assert.ok(Object.isFrozen(r));
assert.ok(Object.isFrozen(r.action_counts));
assert.ok(query.includes('r2OperationsAdaptiveGroups'));
assert.ok(query.includes('accountTag'));
assert.equal(query.includes('bucketName'),false,
  'Do not accidentally narrow account scope to WORK bucket');
assert.equal(account,'1cae999d55b9df68a81ad876fb040e60');

const malformed=[
  {storageResponse:{success:false,result:storageResponse.result}},
  {storageResponse:{success:true,result:{}}},
  {storageResponse:{success:true,result:{standard:{uploaded:{objects:-1,payloadSize:1,metadataSize:0}}}}},
  {storageResponse:{success:true,result:{standard:{uploaded:{objects:1,payloadSize:NaN,metadataSize:0}}}}},
  {storageResponse:{success:true,result:{standard:{uploaded:{objects:1,payloadSize:2}}}}},
  {operationsResponse:{errors:[{message:'denied'}],data:operationsResponse.data}},
  {operationsResponse:{data:{viewer:{accounts:[]}}}},
  {operationsResponse:{data:{viewer:{accounts:[{},{}]}}}},
  {operationsResponse:{data:{viewer:{accounts:[{}]}}}},
  {operationsResponse:{data:{viewer:{accounts:[{
    r2OperationsAdaptiveGroups:[{sum:{requests:1}}]
  }]}}}},
  {operationsResponse:{data:{viewer:{accounts:[{
    r2OperationsAdaptiveGroups:[{dimensions:{actionType:'PUT'},
      sum:{requests:1.5}}]
  }]}}}},
  {operationsResponse:{data:{viewer:{accounts:[{
    r2OperationsAdaptiveGroups:[{dimensions:{actionType:'bad\nlabel'},
      sum:{requests:1}}]
  }]}}}},
  {operationsResponse:{data:{viewer:{accounts:[{
    r2OperationsAdaptiveGroups:Array(10000).fill({
      dimensions:{actionType:'HeadObject'},sum:{requests:1},
    })
  }]}}}},
  {nowMs:0},
];
for(const variation of malformed){
  assert.throws(()=>summarize({...valid,...variation}),/^Error: work_r2_/);
}
const empty=summarize({
  ...valid,
  storageResponse:{success:true,result:{standard:{}}},
  operationsResponse:{data:{viewer:{accounts:[{
    r2OperationsAdaptiveGroups:[],
  }]}}},
});
assert.equal(empty.requests_observed,0);
assert.equal(empty.safe_spend_guaranteed,false);
assert.equal(empty.can_authorize_r2_upload,false);

// The script may only connect to Cloudflare's exact two read endpoints,
// and must NEVER log Wrangler auth token output to a terminal.
const source=readFileSync('scripts/inspect-work-hq-r2-account-usage.mjs','utf8');
assert.match(source,/api\.cloudflare\.com\/client\/v4\/graphql/);
assert.match(source,/r2\/metrics/);
assert.match(source,/WRANGLER,'auth','token','--json'/);
assert.match(source,/method:'GET'/);
assert.match(source,/method:'POST'/);
assert.doesNotMatch(source,/\.put\(|\.delete\(|migrations apply|wrangler deploy|r2 object put/);
assert.doesNotMatch(source,/console\.log\(.*token|console\.error\(.*token/);
console.log('PASS WORK R2 account analytics parser: account-scope storage/operations, incomplete/denied/truncated provider data refused, no billing or upload authority; no network.');
