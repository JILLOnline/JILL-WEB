import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import fs from 'node:fs';
import {authenticateWorkAdminOnce as once} from '../services/jill-order-desk/work-admin-auth-once.mjs';
import {workAdminAppDestination} from '../services/jill-order-desk/shopify-host/sdk-config.mjs';
import {NAVIGATION_PROFILE as profile} from './release-work-hq-navigation-owner.mjs';
import {visualBaseline,ownedVisualAllocation} from './release-work-hq-visual-theme-owner.mjs';
import {HQ_QUOTE} from './stage-work-hq-connected-read-owner.mjs';
const require=createRequire(new URL('../services/jill-order-desk/app-home/package.json',import.meta.url));
const {createStaticHandler}=require('react-router');
const scope={};let calls=0;
const authenticate=async()=>{calls++;throw new Response('<script>SYNTHETIC_SDK_BOOTSTRAP</script>',{headers:{'content-type':'text/html'}})};
const router=createStaticHandler([{id:'app',path:'/app',hasErrorBoundary:true,loader:()=>once({scope,authenticate}),children:[{id:'requests',path:'requests',hasErrorBoundary:true,loader:()=>once({scope,authenticate})}]}]);
const result=await router.query(new Request('https://example.invalid/app/requests'));
assert.equal(calls,1);assert.equal(result.statusCode,200);
for(const error of Object.values(result.errors))assert.equal(error.data,'<script>SYNTHETIC_SDK_BOOTSTRAP</script>');
for(const p of ['/app','/app/requests','/app/requests/jill%3Asynthetic-request-id'])assert.equal(workAdminAppDestination(p),'https://admin.shopify.com/store/jill-work/apps/f8e1ebdbae84490dc8ea5b133637e6c0'+p);
for(const p of ['/auth/login','https://evil.example/app','//evil.example/app','/app/requests.data','/app/requests?id_token=secret','/app/requests#fragment'])assert.throws(()=>workAdminAppDestination(p));
const home=fs.readFileSync(new URL('../services/jill-order-desk/app-home/app/routes/app.index.tsx',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../services/jill-order-desk/app-home/app/routes/app.tsx',import.meta.url),'utf8');
assert.doesNotMatch(home,/to="\/app\/requests"/);assert.equal((shell.match(/to="\/app\/requests"/g)||[]).length,1);
assert.match(home,/loadVerifiedMerchantInbox\(args\)/);assert.match(home,/inboxStats\(model.records\)/);
assert.match(home,/home.state==="staff_verified"&&home.role==="owner"/);
assert.match(home,/<Suspense/);assert.match(home,/Request counts are temporarily unavailable/);
assert.doesNotMatch(home,/stats:\{total:|sessionStorage|localStorage|draftOrderCreate/);
const baseline={deployment:profile.deployment,versions:[{id:profile.base,percentage:100},{id:HQ_QUOTE,percentage:0}]};
visualBaseline(baseline,profile);assert.throws(()=>visualBaseline(baseline));
const attempt={candidate:'11111111-2222-4333-8444-555555555555',nonce:'22222222-3333-4444-8555-666666666666'};
const active={deployment:'33333333-4444-4555-8666-777777777777',message:profile.activate+attempt.nonce,versions:[{id:attempt.candidate,percentage:100},{id:HQ_QUOTE,percentage:0}]};
ownedVisualAllocation(active,attempt,profile);assert.throws(()=>ownedVisualAllocation(active,attempt));
assert.equal(profile.visualOnly,false);assert.notEqual(profile.receiptStem,'work-hq-visual-theme-v2');
console.log('PASS actual parallel React Router SDK response consumption, WORK-only deep links, one Requests entry, canonical streamed dashboard and isolated navigation release profile. No provider calls.');

// Execute the actual Home loader with synthetic boundary adapters. The live
// canonical feed/auth adapters are separately covered by their own contracts.
const {build}=require('esbuild');
const ts=require('typescript'),ast=ts.createSourceFile('home.tsx',home,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let loaderSource=home;
for(const node of [...ast.statements].reverse())if(ts.isFunctionDeclaration(node)&&node.name?.text!=='loader')loaderSource=loaderSource.slice(0,node.pos)+loaderSource.slice(node.end);
const appRoot=fileURLToPath(new URL('../services/jill-order-desk/app-home/',import.meta.url));
const bundle=await build({stdin:{contents:loaderSource,sourcefile:'home-loader-review.tsx',resolveDir:appRoot+'app/routes',loader:'tsx'},bundle:true,format:'esm',platform:'node',write:false,loader:{'.css':'empty'},plugins:[{name:'synthetic-home-boundaries',setup(b){
 b.onResolve({filter:/shopify\.server|shopify-host\/app-home-route|app\.requests-source\.server/},args=>({path:args.path,namespace:'synthetic-home'}));
 b.onLoad({filter:/.*/,namespace:'synthetic-home'},args=>({contents:args.path.includes('shopify.server')?
  'export function workShopify(env){return {authenticate:{admin:async()=>{env.sdkCalls++;return {session:{shop:"SYNTHETIC"}}}}}}':args.path.includes('app-home-route')?
  'export async function loadWorkShopifyAdminRoute({request,authenticate,env}){await authenticate.admin(request);return Response.json(env.home,{status:env.homeStatus||200,headers:{"cache-control":"private, no-store"}})}':
  'export async function loadVerifiedMerchantInbox({context}){const env=context.cloudflare.env;env.feedCalls++;if(env.feedGate)await env.feedGate;return Response.json(env.feed)}',loader:'js'}));
}}]});
const {loader}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function args(env){return {request:new Request('https://example.invalid/app'),context:{cloudflare:{env,ctx:{}}},params:{}}}
for(const home of [{state:'access_denied'},{state:'staff_verified',role:'staff'}]){
 const env={home,sdkCalls:0,feedCalls:0};const response=await loader(args(env));assert.equal(env.feedCalls,0);assert.equal(await response.data.requestSummary,null);
}
let releaseFeed;
const env={home:{state:'staff_verified',role:'owner'},sdkCalls:0,feedCalls:0,feedGate:new Promise(r=>releaseFeed=r),feed:{state:'ready',records:[{submission_id:'PRIVATE_SYNTHETIC_ID',customer_status:'reviewing',internal_status:'needs_quote'},{submission_id:'ANOTHER_PRIVATE_SYNTHETIC_ID',customer_status:'received',internal_status:'new'}]}};
const response=await loader(args(env));assert.equal(env.sdkCalls,1);assert.equal(env.feedCalls,1);assert.match(response.init.headers.get('cache-control'),/no-store/);
let settled=false;response.data.requestSummary.then(()=>settled=true);await Promise.resolve();assert.equal(settled,false,'Home shell must not wait for canonical counts');
releaseFeed();const summary=await response.data.requestSummary;
assert.deepEqual(summary,{state:'ready',stats:{total:2,reviewing:1,needsQuote:1}});assert.doesNotMatch(JSON.stringify(summary),/PRIVATE_SYNTHETIC/);
const outage=await loader(args({home:{state:'staff_verified',role:'owner'},sdkCalls:0,feedCalls:0,feed:{state:'source_unavailable',records:[]}}));
assert.deepEqual(await outage.data.requestSummary,{state:'source_unavailable'},'Failed source read must not become zero requests');
console.log('PASS actual Home loader: staff/denied never read feed; authorized counts stream after shell; only aggregate stats serialize; outage is not zero.');
