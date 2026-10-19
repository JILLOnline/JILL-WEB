import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {projectNavigationTail,navigationTailParser,verifyNavigationTailBaseline,
 EXPECTED_HQ_VERSION,EXPECTED_HQ_DEPLOYMENT,TAIL_STOP_PRELOAD,
 readNavigationTailProbe,observeNavigationTail} from './work-hq-navigation-tail.mjs';
const privateValue='PRIVATE_CUSTOMER_TOKEN_NOT_FOR_OUTPUT';
const trace='12345678-1234-1234-1234-123456789abc';
const raw={scriptName:'jill-order-desk-canary-work',scriptVersion:{id:EXPECTED_HQ_VERSION,tag:privateValue},
 event:{request:{url:'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/app/requests/'+privateValue+'?id_token='+privateValue,headers:{authorization:privateValue}},response:{status:200}},
 outcome:'ok',logs:[{message:['unrelated',privateValue]},{message:['JILL_WORK_INBOX_PHASE',JSON.stringify({trace,phase:'google_feed',event:'begin',secret:privateValue})]}],
 exceptions:[{message:'Cannot perform I/O on behalf of a different request '+privateValue,stack:privateValue}]};
const expected={route:'detail',runtime_version:EXPECTED_HQ_VERSION,exact_version_verified:true,outcome:'ok',status:200,
 phases:[{trace,phase:'google_feed',event:'begin'}],exceptions:['cross_request_io']};
assert.deepEqual(projectNavigationTail(raw),expected);
// Cloudflare's documented wrangler tail envelope permits scriptName:null.
// This valid shape was incorrectly discarded by the first collector.
assert.deepEqual(projectNavigationTail({...raw,scriptName:null}),expected);
const unnamed={...raw};delete unnamed.scriptName;
assert.deepEqual(projectNavigationTail(unnamed),expected);
assert.equal(projectNavigationTail({...raw,scriptName:null,event:{request:{url:'https://foreign.invalid/app/requests'}}}),null);
assert.ok(!JSON.stringify(projectNavigationTail(raw)).includes(privateValue));
assert.equal(projectNavigationTail({...raw,scriptName:'foreign-worker'}),null);
assert.equal(projectNavigationTail({...raw,scriptVersion:undefined}).exact_version_verified,false);
assert.deepEqual(projectNavigationTail({...raw,logs:[{message:['JILL_WORK_INBOX_PHASE',JSON.stringify({trace:privateValue,phase:'google_feed',event:'begin'})]}]}).phases,[]);
const end=structuredClone(raw);end.logs[1].message[1]=JSON.stringify({trace,phase:'google_feed',event:'end',duration_ms:123.7});
assert.equal(projectNavigationTail(end).phases[0].duration_ms,124);
const records=[],parse=navigationTailParser(x=>records.push(x));
const input='Wrangler banner\n'+JSON.stringify(raw,null,2)+'\n'+JSON.stringify(end)+'\n';
for(let i=0;i<input.length;i+=7)parse(input.slice(i,i+7));
assert.deepEqual(records,[expected,projectNavigationTail(end)]);
parse(JSON.stringify({...raw,garbage:'x'.repeat(2*1024*1024)}));
parse(JSON.stringify(raw));assert.equal(records.length,3,'oversize object discarded; next event still parses');
assert.ok(!JSON.stringify(records).includes(privateValue));
const metricCounts={};const unnamedRecords=[];
const parseUnnamed=navigationTailParser(x=>unnamedRecords.push(x),{onMetric:key=>metricCounts[key]=(metricCounts[key]||0)+1});
parseUnnamed(JSON.stringify({...raw,scriptName:null}));
assert.equal(metricCounts.worker_name_missing,1);assert.equal(metricCounts.projected,1);
assert.deepEqual(unnamedRecords,[expected]);
const baseline={deployment:EXPECTED_HQ_DEPLOYMENT,versions:[{id:EXPECTED_HQ_VERSION,percentage:100},{id:'dbc6341f-de7f-41de-8e97-6bf971201eeb',percentage:0}]};
verifyNavigationTailBaseline(baseline);
assert.throws(()=>verifyNavigationTailBaseline({...baseline,deployment:'changed'}));
assert.throws(()=>verifyNavigationTailBaseline({...baseline,versions:baseline.versions.slice(0,1)}));
const runner=readFileSync(new URL('./collect-work-hq-navigation-tail-owner.mjs',import.meta.url),'utf8');
assert.doesNotMatch(runner,/writeFile|appendFile|activate-once|release-once|reset|versions.*upload|deployments.*create/);
assert.match(runner,/stdio:\['ignore','pipe','pipe','ipc'\]/);
// Exercise the same IPC preload used with the installed CLI. Unlike OS signal
// delivery to a Windows child, emitting the event calls its JS cleanup handler.
const child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(TAIL_STOP_PRELOAD),'-e',
 'process.on("SIGINT",()=>{process.stdout.write("cleanup-called");setTimeout(()=>process.exit(0),20);});process.send("ready");'],
 {stdio:['ignore','pipe','pipe','ipc']});
let childOutput='';child.stdout.on('data',chunk=>childOutput+=String(chunk));child.stderr.resume();
child.once('message',()=>child.send('JILL_WORK_TAIL_STOP'));
const watchdog=setTimeout(()=>child.kill(),5000);
try{const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
 assert.equal(code,0);assert.equal(childOutput,'cleanup-called');
}finally{clearTimeout(watchdog);}

const nonce='abcdefab-1234-1234-1234-123456789abc';
const healthBody={ok:true,environment:'JILL_ORDER_DESK_WORK',database_ready:true,admin_ready:false};
const healthReply=(version=EXPECTED_HQ_VERSION)=>Response.json(healthBody,{headers:{
 'cache-control':'no-store','x-jill-work-hq-version':version}});
const probe=await readNavigationTailProbe(nonce,{fetcher:async(url,options)=>{
 assert.equal(url.origin,'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev');
 assert.equal(url.pathname,'/healthz');assert.equal(url.searchParams.get('jill_work_hq_tail_probe'),nonce);
 assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');
 assert.ok(!JSON.stringify(options.headers).match(/authorization|cookie/i));return healthReply();
}});
assert.equal(probe.exact_version_verified,true);
await assert.rejects(()=>readNavigationTailProbe(privateValue));
await assert.rejects(()=>readNavigationTailProbe(nonce,{fetcher:async()=>healthReply('foreign-version')}));
await assert.rejects(()=>readNavigationTailProbe(nonce,{fetcher:async()=>new Response(privateValue.repeat(100))}));
const probeRecord={outcome:'ok',scriptName:null,logs:[],exceptions:[],event:{request:{
 url:'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/healthz?jill_work_hq_tail_probe='+nonce}}};
assert.equal(projectNavigationTail(probeRecord,{probeNonce:nonce}).route,'diagnostic_probe');
assert.equal(projectNavigationTail(probeRecord,{probeNonce:trace}),null,'unmatched health GET cannot acknowledge subscription');
assert.equal(projectNavigationTail(probeRecord),null,'ordinary health reads are not captured');
class SyntheticTail extends EventEmitter{
 stdout=new PassThrough();stderr=new PassThrough();connected=true;stopSent=false;
 send(message,callback){assert.equal(message,'JILL_WORK_TAIL_STOP');this.stopSent=true;this.connected=false;
  queueMicrotask(()=>{this.emit('close',0,null);callback?.();});}
 kill(){throw Error('unexpected forced stop');}
}
const tail=new SyntheticTail();let readyCalls=0;
const observed=await observeNavigationTail({child:tail,probeNonce:nonce,captureMs:1,connectWaitMs:1,stopWaitMs:100,
 probe:async value=>{assert.equal(value,nonce);tail.stdout.write(JSON.stringify(probeRecord));return probe;},
 onReady:()=>{readyCalls++;tail.stdout.write(JSON.stringify({...raw,scriptName:null}));}});
assert.equal(readyCalls,1);assert.equal(observed.ready,true);
assert.equal(observed.probe_event_seen,true);assert.equal(observed.records.length,2);
assert.equal(observed.records[1].route,'detail');assert.equal(observed.stopRequested,true);assert.equal(observed.forced,false);
assert.ok(!JSON.stringify(observed.records).includes(privateValue));
for(const scenario of ['no_tail_event','wrong_nonce','wrong_health_version','wrong_tail_version']){
 const quiet=new SyntheticTail();let askedToReproduce=false;
 const noReady=await observeNavigationTail({child:quiet,probeNonce:nonce,captureMs:1,connectAttempts:2,connectWaitMs:1,stopWaitMs:100,
  probe:async()=>{
   if(scenario==='wrong_nonce')quiet.stdout.write(JSON.stringify({...probeRecord,event:{request:{url:probeRecord.event.request.url.replace(nonce,trace)}}}));
   if(scenario==='wrong_health_version')quiet.stdout.write(JSON.stringify(probeRecord));
   if(scenario==='wrong_tail_version')quiet.stdout.write(JSON.stringify({...probeRecord,scriptVersion:{id:trace}}));
   return scenario==='wrong_health_version'?{...probe,exact_version_verified:false}:probe;
  },onReady:()=>{askedToReproduce=true;}});
 assert.equal(askedToReproduce,false,scenario);assert.equal(noReady.ready,false,scenario);
 assert.ok(noReady.probe_attempts>=1&&noReady.probe_attempts<=2,scenario);assert.equal(quiet.stopSent,true,scenario);
}
const callbackFailure=new SyntheticTail();
await assert.rejects(()=>observeNavigationTail({child:callbackFailure,probeNonce:nonce,connectWaitMs:1,stopWaitMs:100,
 probe:async()=>{callbackFailure.stdout.write(JSON.stringify(probeRecord));return probe;},
 onReady:()=>{throw Error('synthetic callback failure');}}));
assert.equal(callbackFailure.stopSent,true,'callback failure still requests CLI cleanup');
console.log('PASS WORK diagnostic: documented null/missing Worker names scoped to exact WORK origin, private data excluded, bounded parsing and drift guards, actual IPC cleanup, unsigned health adapter, matching stream handshake and fail-closed readiness.');
