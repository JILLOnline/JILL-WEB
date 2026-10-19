import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {projectNavigationTail,navigationTailParser,verifyNavigationTailBaseline,
 EXPECTED_HQ_VERSION,EXPECTED_HQ_DEPLOYMENT,TAIL_STOP_PRELOAD} from './work-hq-navigation-tail.mjs';
const privateValue='PRIVATE_CUSTOMER_TOKEN_NOT_FOR_OUTPUT';
const trace='12345678-1234-1234-1234-123456789abc';
const raw={scriptName:'jill-order-desk-canary-work',scriptVersion:{id:EXPECTED_HQ_VERSION,tag:privateValue},
 event:{request:{url:'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/app/requests/'+privateValue+'?id_token='+privateValue,headers:{authorization:privateValue}},response:{status:200}},
 outcome:'ok',logs:[{message:['unrelated',privateValue]},{message:['JILL_WORK_INBOX_PHASE',JSON.stringify({trace,phase:'google_feed',event:'begin',secret:privateValue})]}],
 exceptions:[{message:'Cannot perform I/O on behalf of a different request '+privateValue,stack:privateValue}]};
const expected={route:'detail',runtime_version:EXPECTED_HQ_VERSION,exact_version_verified:true,outcome:'ok',status:200,
 phases:[{trace,phase:'google_feed',event:'begin'}],exceptions:['cross_request_io']};
assert.deepEqual(projectNavigationTail(raw),expected);
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
console.log('PASS WORK tail projection: private URLs/headers/customer IDs/tokens/stack excluded, exact version attribution, fragmented JSON, bounded input, baseline drift denied, no app mutation.');
