import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Compile the ONE canonical production source into an independently isolated
// Custom Order QA Apps Script project. Never share WORK Rewards' clasp ID.
const root=process.cwd();
if(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim()!=='jill/rewards-work')
  throw new Error('Custom Order QA build is allowed only from jill/rewards-work.');
const sheetId=String(process.env.JILL_CUSTOM_ORDER_WORK_SHEET_ID||'').trim();
const production='1xVG4Jvh-vLB6BH5QitNcLQuaLj6DkXeSlFHg_LkECT8';
if(!/^[a-zA-Z0-9_-]{30,100}$/.test(sheetId) || sheetId===production)
  throw new Error('Specify a distinct valid JILL_CUSTOM_ORDER_WORK_SHEET_ID; production sheet is prohibited.');
const output=path.join(root,'.work-custom-orders');
execFileSync(process.execPath,['scripts/build-rewards-work-backend.mjs'],{cwd:root,stdio:'inherit'});
const canonical=path.join(root,'.work-backend','JILL_Custom_Order_Automation_REWARDS.gs');
let source=fs.readFileSync(canonical,'utf8');
const replace=(old,value)=>{
  if(source.split(old).length-1!==1)throw new Error('Canonical WORK source marker drifted: '+old);
  source=source.replace(old,value);
};
replace('const JILL_CUSTOM_ORDER_SANDBOX = false;','const JILL_CUSTOM_ORDER_SANDBOX = true;');
replace("SHEET_ID: ''","SHEET_ID: '"+sheetId+"'");
if(!source.includes("const JILL_REWARDS_RUNTIME = 'WORK';") ||
   !source.includes("const JILL_CUSTOM_ORDER_SANDBOX = true;") ||
   !source.includes("SHEET_ID: '"+sheetId+"'") ||
   source.includes(production) ||
   source.includes('jillonlinestore.com') ||
   source.includes('jqtdgr-1y.myshopify.com')) {
  throw new Error('Custom Order QA source leaks LIVE scope or has invalid runtime flags.');
}
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'JILL_Custom_Order_Automation_REWARDS.gs'),source);
fs.writeFileSync(path.join(output,'appsscript.json'),JSON.stringify({
  timeZone:'America/New_York',exceptionLogging:'STACKDRIVER',runtimeVersion:'V8',
  // Never auto-detect broad MailApp/Shopify OAuth scope references from the
  // shared canonical file. QA is Sheets + Google operator identity only.
  oauthScopes:[
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  webapp:{access:'ANYONE_ANONYMOUS',executeAs:'USER_DEPLOYING'}
},null,2)+'\n');
const unexpected=fs.readdirSync(output).filter(name=>
  /\.(?:gs|js|html)$/.test(name)&&name!=='JILL_Custom_Order_Automation_REWARDS.gs');
if(unexpected.length)throw new Error('Unknown QA project code files: '+unexpected.join(','));
console.log('Isolated Custom Order QA Apps Script bundle prepared; no deploy was performed.');
console.log('Only the configured WORK QA spreadsheet can receive Custom Order intake.');
console.log('Rewards setup, Rewards webhooks, OAuth and sweep paths are blocked in QA.');
