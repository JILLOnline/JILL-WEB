import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root = process.cwd();
const output = path.join(root, '.work-backend');
const canonicalPath = path.join(root,'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs');
const promotionsPath = path.join(root,'backend/google-apps-script/JILL_Public_Promotions.gs');
const sha = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid Git revision');
let source = fs.readFileSync(canonicalPath,'utf8');
const replaceExact = (before,after,expected=1) => {
  const n=source.split(before).length-1;
  if(n!==expected) throw new Error(`WORK bundle source marker changed: ${before} (count ${n})`);
  source=source.replaceAll(before,after);
};
replaceExact("const JILL_REWARDS_RUNTIME = 'LIVE';","const JILL_REWARDS_RUNTIME = 'WORK';");
replaceExact('__JILL_REWARDS_BUILD_SHA__',sha);
replaceExact("STORE_URL: 'https://jillonlinestore.com'","STORE_URL: 'https://jill-work.myshopify.com'");
replaceExact("STORE_EMAIL: 'info@jillonlinestore.com'","STORE_EMAIL: 'qa@example.invalid'");
replaceExact("SHEET_ID: '1xVG4Jvh-vLB6BH5QitNcLQuaLj6DkXeSlFHg_LkECT8'","SHEET_ID: ''");
replaceExact("'jill-online-store.myshopify.com'","'jill-work.myshopify.com'",2);
// Retired Custom Order email templates are never executed in WORK, but also
// sanitize their legacy customer-facing production hostname defensively.
source = source.replaceAll('jillonlinestore.com','jill-work.myshopify.com');
const productionPatterns=[
  'jillonlinestore.com',
  'jqtdgr-1y.myshopify.com',
  '1xVG4Jvh-vLB6BH5QitNcLQuaLj6DkXeSlFHg_LkECT8',
  'AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA',
];
for(const ref of productionPatterns) if(source.includes(ref)) throw new Error('Production reference leaked into WORK backend source');
const promotionSource = fs.readFileSync(promotionsPath,'utf8');
for(const ref of productionPatterns) if(promotionSource.includes(ref)) throw new Error('Production reference leaked into WORK promotions source');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'JILL_Custom_Order_Automation_REWARDS.gs'),source);
fs.writeFileSync(path.join(output,'JILL_Public_Promotions.gs'),promotionSource);
fs.writeFileSync(path.join(output,'appsscript.json'),JSON.stringify({
 timeZone:'America/New_York',
 exceptionLogging:'STACKDRIVER',
 runtimeVersion:'V8',
 // Shopify webhook deliveries must reach a non-logged-in Apps Script endpoint.
 // POST still requires the topic-scoped webhook secret; WORK custom order ingress is disabled.
 webapp:{access:'ANYONE_ANONYMOUS',executeAs:'USER_DEPLOYING'}
},null,2)+'\n');
console.log(`WORK-only Apps Script bundle ready at .work-backend/ from ${sha}.`);
console.log('Not deployed. Set up a distinct WORK Apps Script project and WORK-only Script Properties before starting the minute worker.');
