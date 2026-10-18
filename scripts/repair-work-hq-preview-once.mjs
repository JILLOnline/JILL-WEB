// JILL HQ WORK: single-use LOCAL preview-config repair only.
// Does not call Shopify, Wrangler, Google, network APIs or a deployment.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assertRewardsWorkConfig} from './verify-rewards-work-target.mjs';
import {verifyWorkHqDevPreviewConfig,WORK_HQ_HOME} from './verify-work-hq-dev-preview-config.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const WORK_FILE=path.join(ROOT,'shopify.app.work.toml');
const TARGET_PROXY='https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev/jill-custom-order-proxy';
const AUTH_URL=WORK_HQ_HOME+'/auth/callback';
const EXTENSIONS=Object.freeze([
  ['jill-account-home','923e30e6-dbf9-f48a-57a6-0dbd1ab57763f55ebbde'],
  ['jill-account-dashboard','2f093e56-265e-4263-57fc-eb7b7a8a3f49ccd3b19a'],
  ['jill-account-coupons','dfb3e6f0-162d-b114-19a1-d854706d0d45166f43aa'],
]);
const FILE='work-hq-preview-repair-once-20261018';
const abort=code=>{throw Error('work_hq_preview_repair_'+code);};
const ensure=(v,code)=>{if(!v)abort(code);};
const sha=value=>createHash('sha256').update(value).digest('hex');

function locations(lines){
  const headers=[];
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^[ \t]*\[([A-Za-z0-9_.-]+)\][ \t]*(?:#.*)?$/);
    if(m)headers.push({name:m[1],start:i});
    else if(/^[ \t]*\[\[([A-Za-z0-9_.-]+)\]\][ \t]*(?:#.*)?$/.test(lines[i]))
      headers.push({name:'__array_'+i,start:i,array:true});
    else if(/^[ \t]*\[/.test(lines[i]))abort('unrecognized_table_syntax');
  }
  const result={root:{start:0,end:headers[0]?.start??lines.length}};
  for(let i=0;i<headers.length;i++){
    const h=headers[i];
    if(h.array)continue;
    ensure(!Object.hasOwn(result,h.name),'duplicate_table');
    result[h.name]={start:h.start+1,end:headers[i+1]?.start??lines.length};
  }
  return result;
}
function scalar(lines,range,key,allowed){
  const matches=[];
  for(let i=range.start;i<range.end;i++){
    if(new RegExp('^[ \\t]*'+key+'[ \\t]*=').test(lines[i]))matches.push(i);
  }
  ensure(matches.length===1,'missing_or_duplicate_'+key);
  const i=matches[0];
  const m=lines[i].match(new RegExp('^([ \\t]*'+key+'[ \\t]*=[ \\t]*)("[^"\\r\\n]*"|true|false)([ \\t]*(?:#.*)?)$'));
  ensure(m&&allowed(m[2]),'unrecognized_'+key);
  return {index:i,prefix:m[1],value:m[2],suffix:m[3]};
}
function field(lines,range,key,value,allowed){
  const info=scalar(lines,range,key,allowed);
  lines[info.index]=info.prefix+value+info.suffix;
  return info.value;
}
function redirects(lines,range){
  const matches=[];
  for(let i=range.start;i<range.end;i++){
    if(/^[ \t]*redirect_urls[ \t]*=/.test(lines[i]))matches.push(i);
  }
  ensure(matches.length===1,'missing_or_duplicate_auth_redirects');
  const from=matches[0];
  const m=lines[from].match(/^([ \t]*redirect_urls[ \t]*=[ \t]*)(\[.*)$/);
  ensure(m,'unrecognized_auth_redirects');
  const parts=[];
  let stop=-1;
  for(let i=from;i<range.end;i++){
    const part=i===from?m[2]:lines[i];
    parts.push(part);
    if(part.includes(']')){stop=i;break;}
    ensure(i-from<16,'redirect_array_too_large');
  }
  ensure(stop>=0,'unterminated_redirect_array');
  const raw=parts.join('\n');
  const end=raw.indexOf(']');
  ensure(/^[ \t]*(?:#.*)?$/.test(raw.slice(end+1)) &&
    !raw.slice(0,end).includes('#'),'redirect_array_contains_comments');
  let array;
  try{array=JSON.parse(raw.slice(0,end+1).replace(/,\s*]$/,']'));}
  catch{abort('redirect_array_unparseable');}
  ensure(Array.isArray(array)&&array.length>0&&array.length<=8&&
    array.every(x=>typeof x==='string'&&/^https:\/\//.test(x)&&
      !/jillonlinestore\.com|jqtdgr-1y\.myshopify\.com/i.test(x)),
    'redirect_array_unexpected');
  lines.splice(from,stop-from+1,m[1]+'["'+AUTH_URL+'"]');
  return array.length;
}
function validateProxy(lines,ranges){
  const proxy=ranges.app_proxy;
  ensure(proxy,'app_proxy_missing');
  const same=(key,value)=>{
    const f=scalar(lines,proxy,key,v=>v.startsWith('"')&&v.endsWith('"'));
    ensure(f.value===JSON.stringify(value),'app_proxy_'+key+'_mismatch');
  };
  same('url',TARGET_PROXY);
  same('prefix','apps');
  same('subpath','jill-custom-order');
}

export function proposeWorkHqPreviewRepair(original){
  ensure(typeof original==='string'&&original.length>0&&original.length<=100000&&
    !original.includes('\0')&&!original.replace(/\r\n/g,'').includes('\r'),
    'source_unrecognized');
  assertRewardsWorkConfig(original,{requireHqName:true});
  const nl=original.includes('\r\n')?'\r\n':'\n';
  const lines=original.split(/\r?\n/);
  let ranges=locations(lines);
  validateProxy(lines,ranges);
  const home=field(lines,ranges.root,'application_url',JSON.stringify(WORK_HQ_HOME),v=>
    v==='"https://shopify.dev/apps/default-app-home"'||
    v==='"https://shopify.dev/docs/apps/default-app-home"'||
    v===JSON.stringify(WORK_HQ_HOME));
  const embedded=field(lines,ranges.root,'embedded','true',v=>v==='false'||v==='true');
  const auth=ranges.auth;
  ensure(auth,'auth_table_missing');
  const redirectCount=redirects(lines,auth);
  ranges=locations(lines);
  let oldUpdate='absent';
  if(ranges.build){
    const build=ranges.build;
    const candidates=[];
    for(let i=build.start;i<build.end;i++){
      if(/^[ \t]*automatically_update_urls_on_dev[ \t]*=/.test(lines[i]))candidates.push(i);
    }
    ensure(candidates.length<=1,'duplicate_build_policy');
    if(candidates.length===1){
      oldUpdate=field(lines,build,'automatically_update_urls_on_dev',
        'false',v=>v==='true'||v==='false');
    }else lines.splice(build.start,0,'automatically_update_urls_on_dev = false');
  }else{
    const tail=lines.at(-1)===''?lines.length-1:lines.length;
    lines.splice(tail,0,'','[build]','automatically_update_urls_on_dev = false');
  }
  const candidate=lines.join(nl);
  verifyWorkHqDevPreviewConfig(candidate);
  const summary={
    application_url:home===JSON.stringify(WORK_HQ_HOME)?'already_work_hq':'shopify_placeholder_to_work_hq',
    embedded:embedded==='true'?'already_true':'false_to_true',
    auth_redirect_urls:String(redirectCount)+'_url(s)_to_pinned_work_hq_callback',
    automatically_update_urls_on_dev:oldUpdate+'_to_false',
  };
  return Object.freeze({candidate,changed:candidate!==original,summary});
}

function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',timeout:15000,maxBuffer:6000,windowsHide:true}).trim();}
  catch{abort('git_unverified');}
}
function ownerGate(){
  ensure(process.platform==='win32','windows_owner_only');
  ensure(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'work_source_not_synced');
  ensure(!!process.env.LOCALAPPDATA,'private_backup_directory_missing');
  const info=fs.lstatSync(WORK_FILE);
  ensure(info.isFile()&&!info.isSymbolicLink()&&info.size>0&&info.size<=100000,
    'work_config_file_invalid');
  const privateFolder=path.resolve(process.env.LOCALAPPDATA,
    'JILL-WEB','private-release-receipts');
  ensure(privateFolder.startsWith(path.resolve(process.env.LOCALAPPDATA)+path.sep),
    'private_path_invalid');
  for(const part of [process.env.LOCALAPPDATA,
    path.join(process.env.LOCALAPPDATA,'JILL-WEB'),privateFolder]){
    if(fs.existsSync(part)){
      ensure(!fs.lstatSync(part).isSymbolicLink(),'private_path_symlink');
    }
  }
  fs.mkdirSync(privateFolder,{recursive:true,mode:0o700});
  return privateFolder;
}
function extensionSnapshot(){
  return EXTENSIONS.map(([handle,uid])=>{
    const file=path.join(ROOT,'extensions',handle,'shopify.extension.toml');
    const source=fs.readFileSync(file,'utf8');
    ensure(source.includes('handle = "'+handle+'"')&&
      source.includes('uid = "'+uid+'"'),'extension_identity_changed');
    return {handle,hash:sha(source)};
  });
}
function saveNew(filename,content){
  const fd=fs.openSync(filename,'wx',0o600);
  try{fs.writeFileSync(fd,content);fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
}
async function operator(){
  const privateFolder=ownerGate();
  const original=fs.readFileSync(WORK_FILE,'utf8');
  const proposal=proposeWorkHqPreviewRepair(original);
  const ext=extensionSnapshot();
  if(!proposal.changed){
    console.log('PASS: Local WORK config already matches certified HQ App Home.');
    console.log('No backup, mutation, Shopify preview or deployment was performed.');
    return;
  }
  const backup=path.join(privateFolder,FILE+'.toml.backup');
  const receipt=path.join(privateFolder,FILE+'.json');
  const spent=path.join(privateFolder,FILE+'.apply-once');
  ensure(!fs.existsSync(backup)&&!fs.existsSync(receipt)&&
    !fs.existsSync(spent),'one_time_repair_already_reserved');
  // Backup FIRST. Never print or export TOML contents.
  saveNew(backup,original);
  ensure(sha(fs.readFileSync(backup))===sha(original),'backup_failed');
  const metadata={
    purpose:'WORK Shopify local HQ dev preview repair',
    original_sha256:sha(original),
    proposed_sha256:sha(proposal.candidate),
    extensions:ext,
    changed_fields:Object.keys(proposal.summary),
    backup_file:path.basename(backup),
    work_branch:'jill/rewards-work',
  };
  saveNew(receipt,JSON.stringify(metadata,null,2)+'\n');
  console.log('PASS: Original ignored WORK Shopify TOML backed up privately.');
  console.log('PASS: WORK app ID, scopes, proxy and three extension identities verified.');
  console.log('Only these values may change (no other lines or files):');
  for(const [key,change] of Object.entries(proposal.summary))
    console.log('  '+key+': '+change);
  console.log('Backup: %LOCALAPPDATA%\\JILL-WEB\\private-release-receipts\\'+path.basename(backup));
  console.log('No Shopify changes yet.');
  const rl=createInterface({input:process.stdin,output:process.stdout});
  let answer='';
  try{answer=await rl.question('Type REPAIR WORK PREVIEW to apply this LOCAL diff: ');}
  finally{rl.close();}
  if(answer!=='REPAIR WORK PREVIEW'){
    console.log('HOLD: Owner declined. Backup preserved, WORK config unchanged.');
    return;
  }
  ownerGate();
  ensure(sha(fs.readFileSync(WORK_FILE))===metadata.original_sha256,
    'local_config_changed_after_review');
  ensure(extensionSnapshot().every((x,i)=>
    x.handle===ext[i].handle&&x.hash===ext[i].hash),'extension_changed_during_review');
  ensure(sha(proposeWorkHqPreviewRepair(fs.readFileSync(WORK_FILE,'utf8')).candidate)===
    metadata.proposed_sha256,'candidate_changed_during_review');
  // One-shot receipt BEFORE change. Never retry after a possible partial write.
  saveNew(spent,'One LOCAL WORK preview config repair attempt reserved. Do not retry.\n');
  const temporary=WORK_FILE+'.work-hq-preview-once.tmp';
  ensure(!fs.existsSync(temporary),'temporary_file_exists');
  saveNew(temporary,proposal.candidate);
  fs.renameSync(temporary,WORK_FILE);
  ensure(sha(fs.readFileSync(WORK_FILE))===metadata.proposed_sha256,
    'postwrite_hash_unverified');
  verifyWorkHqDevPreviewConfig(fs.readFileSync(WORK_FILE,'utf8'));
  ensure(extensionSnapshot().every((x,i)=>x.hash===ext[i].hash),
    'extension_changed_after_write');
  console.log('PASS: Only local WORK HQ preview config repaired and independently verified.');
  console.log('No Shopify preview or deployment was started.');
  console.log('ONE-TIME LOCAL REPAIR SPENT. Do not rerun this script.');
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    ensure(process.argv.length===2,'unexpected_arguments');
    await operator();
  }catch(err){
    const code=String(err?.message||'');
    console.error('HOLD: '+(/^work_hq_preview_repair_[a-z0-9_]+$/.test(code)?
      code:'work_hq_preview_repair_unverified'));
    console.error('Do not rerun after a backup or apply marker exists. Inspect local state.');
    process.exitCode=1;
  }
}
