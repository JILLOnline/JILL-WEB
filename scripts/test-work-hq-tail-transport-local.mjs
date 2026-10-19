// Installed Wrangler CLI -> loopback-only mock API/WebSocket -> canonical
// collector. Synthetic credentials/events only; no real Cloudflare connection.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const requireApp=createRequire(new URL('../services/jill-order-desk/app-home/package.json',import.meta.url));
const {WebSocketServer,WebSocket}=requireApp('ws');
const APP=fileURLToPath(new URL('../services/jill-order-desk/app-home/',import.meta.url));
import {observeNavigationTail,EXPECTED_HQ_VERSION,TAIL_STOP_PRELOAD} from './work-hq-navigation-tail.mjs';
const nonce='12345678-1234-1234-1234-123456789abc';
const privateValue='SYNTHETIC_PRIVATE_FIELD_MUST_NOT_ESCAPE';
const account='0'.repeat(32),tailId='aaaaaaaa-1234-1234-1234-123456789abc';
const tailPath=`/client/v4/accounts/${account}/workers/scripts/jill-order-desk-canary-work/tails`;
let created=0,deleted=0,unexpected=0,socket,child;
const sockets=new Set();
const server=createServer((req,res)=>{
 let result;
 if(req.url===tailPath&&req.method==='POST'){
  created++;result={id:tailId,url:`ws://127.0.0.1:${server.address().port}/stream`,expires_at:new Date(Date.now()+60000).toISOString()};
 }else if(req.url===tailPath+'/'+tailId&&req.method==='DELETE'){deleted++;result={id:tailId};}
 else {unexpected++;res.statusCode=404;result=null;}
 res.setHeader('content-type','application/json');res.end(JSON.stringify({success:res.statusCode===200,errors:[],messages:[],result}));
});
server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
const wss=new WebSocketServer({server,path:'/stream'});
wss.on('connection',ws=>{
 // Wrangler's trace-v1 client explicitly sends its debug control frame with
 // mask:false (see installed createTail). Model that provider protocol here;
 // the ordinary ws server would close it before any log could be delivered.
 assert.equal(typeof ws._receiver?._isServer,'boolean');
 ws._receiver._isServer=false;
 socket=ws;ws.on('error',()=>{});
});
const temp=mkdtempSync(join(tmpdir(),'jill-tail-local-'));
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const config=join(temp,'wrangler.json');
 writeFileSync(config,JSON.stringify({name:'jill-order-desk-canary-work',account_id:account,compatibility_date:'2026-10-14',send_metrics:false}));
 const env={...process.env,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:'SYNTHETIC_LOCAL_TAIL_TOKEN_NEVER_REAL',
  CLOUDFLARE_API_BASE_URL:`http://127.0.0.1:${server.address().port}/client/v4`,CI:'true',WRANGLER_SEND_METRICS:'false',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',HTTP_PROXY:'',HTTPS_PROXY:'',ALL_PROXY:'',http_proxy:'',https_proxy:'',all_proxy:''};
 child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(TAIL_STOP_PRELOAD),
  resolve(APP,'node_modules/wrangler/wrangler-dist/cli.js'),'tail','jill-order-desk-canary-work','--config',config,'--format','json'],
  {cwd:APP,env,stdio:['ignore','pipe','pipe','ipc'],shell:false});
 const record=url=>({outcome:'ok',scriptName:null,exceptions:[],logs:[],eventTimestamp:Date.now(),
  event:{request:{url,method:'GET',headers:{authorization:privateValue}}}});
 const observed=await observeNavigationTail({child,probeNonce:nonce,connectAttempts:30,connectWaitMs:100,captureMs:100,stopWaitMs:5000,
  probe:async()=>{
   // Provider TailRequest redacts UUID-shaped URL substrings by default.
   if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(record('https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/healthz?jill_work_hq_tail_probe=REDACTED')));
   return {exact_version_verified:true,runtime_version:EXPECTED_HQ_VERSION};
  },onReady:()=>socket.send(JSON.stringify({...record('https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev/app/requests.data?id_token='+privateValue),
   logs:[{message:['JILL_WORK_INBOX_PHASE',JSON.stringify({trace:nonce,phase:'shopify_auth',event:'begin'})]}]})),
 });
 assert.equal(observed.ready,true,'actual CLI null-name envelope must pass stream handshake');
 assert.equal(observed.probe_correlation,'redacted_marker','liveness must not claim unique nonce attribution');
 assert.equal(observed.forced,false,'actual CLI cleanup must complete');
 assert.equal(observed.result.status,0);assert.equal(created,1);assert.equal(deleted,1,'CLI must delete the local subscription on IPC stop');
 assert.equal(unexpected,0);assert.ok(observed.records.some(x=>x.route==='inbox'&&x.phases.length===1));
 assert.ok(observed.metrics.worker_name_missing>=2);
 assert.ok(!JSON.stringify(observed.records).includes(privateValue));
 console.log('PASS installed Wrangler JSON tail transport through loopback API/WebSocket: null Worker name retained, matching health handshake, phase projection privacy, IPC stop deletes subscription. No remote provider connection.');
}finally{
 if(child&&child.exitCode===null&&child.signalCode===null)child.kill();
 for(const ws of wss.clients)ws.terminate();
 await new Promise(resolve=>wss.close(resolve));
 for(const socket of sockets)socket.destroy();
 await new Promise(resolve=>server.close(resolve));
 rmSync(temp,{recursive:true,force:true});
}
