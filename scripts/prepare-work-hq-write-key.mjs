// Explicitly local-only. Generates/reconciles ONE dedicated WORK HQ write HMAC
// key in the user's existing JILL private text vault, never in source or logs.
// NO Cloudflare, Google, Shopify, LIVE or other network actions are performed.
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {localFilePath} from './initialize-jill-private-catalog.mjs';

const KEY='JILL_HQ_MERCHANT_WRITE_SECRET';
const QA='[WORK.GOOGLE_CUSTOM_ORDERS_QA]';
const WORKER='[WORK.CLOUDFLARE_ORDER_DESK]';
const VALID=/^[A-Za-z0-9_-]{48,96}$/;

export function reconcileWorkHqWriteKey(source,{makeKey=
  ()=>randomBytes(48).toString('base64url')}={}) {
  if(typeof source!=='string' || source.length>200000)
    throw Error('invalid_local_catalog');
  const newline=source.includes('\r\n')?'\r\n':'\n';
  const finalNewline=/\r?\n$/.test(source);
  const lines=source.split(/\r?\n/);
  if(finalNewline)lines.pop();
  const locate=title=>{
    const matches=lines.flatMap((line,i)=>line.trim()===title?[i]:[]);
    if(matches.length!==1)throw Error('missing_or_duplicate_work_section');
    const start=matches[0];
    let end=lines.length;
    for(let i=start+1;i<lines.length;i++){
      if(/^\[[A-Za-z0-9._-]+\]$/.test(lines[i].trim())){end=i;break;}
    }
    const fields=[];
    for(let i=start+1;i<end;i++){
      if(lines[i].startsWith(KEY+'='))fields.push(i);
    }
    if(fields.length>1)throw Error('duplicate_write_key');
    const index=fields[0];
    const existing=index===undefined?'':lines[index].slice(KEY.length+1).trim();
    if(existing && !VALID.test(existing))throw Error('invalid_existing_write_key');
    return {start,end,index,existing};
  };
  const qa=locate(QA),cloud=locate(WORKER);
  if(qa.existing && cloud.existing && qa.existing!==cloud.existing)
    throw Error('work_write_key_mismatch');
  const value=qa.existing||cloud.existing||makeKey();
  if(typeof value!=='string'||!VALID.test(value))
    throw Error('invalid_generated_write_key');
  // Refuse accidental reuse of any WORK read, Shopify session or app key.
  for(const section of [qa,cloud]){
    for(const name of ['JILL_HQ_MERCHANT_READ_SECRET','SHOPIFY_API_SECRET',
      'JILL_WORK_SESSION_KEY_B64']){
      const found=lines.slice(section.start+1,section.end)
        .find(line=>line.startsWith(name+'='));
      if(found && found.slice(name.length+1).trim()===value)
        throw Error('work_write_key_not_distinct');
    }
  }
  if(qa.existing===value&&cloud.existing===value)
    return {changed:false,content:source};
  // Apply edits from highest source index first to preserve section offsets.
  const changes=[qa,cloud].sort((a,b)=>b.start-a.start);
  for(const section of changes){
    if(section.index===undefined)lines.splice(section.start+1,0,KEY+'='+value);
    else lines[section.index]=KEY+'='+value;
  }
  return {changed:true,content:lines.join(newline)+(finalNewline?newline:'')};
}

const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try {
    const repo=fileURLToPath(new URL('../',import.meta.url));
    const {folder,full}=localFilePath({repo});
    if(!fs.existsSync(full)||fs.lstatSync(full).isSymbolicLink()||
       fs.lstatSync(folder).isSymbolicLink())
      throw Error('private_catalog_unavailable');
    const current=fs.readFileSync(full,'utf8');
    const {changed,content}=reconcileWorkHqWriteKey(current);
    if(changed){
      const backup=full+'.backup-'+Date.now()+'.txt';
      fs.copyFileSync(full,backup,fs.constants.COPYFILE_EXCL);
      const pending=full+'.pending-'+process.pid;
      try {
        fs.writeFileSync(pending,content,{flag:'wx',mode:0o600});
        fs.renameSync(pending,full);
      } finally {if(fs.existsSync(pending))fs.unlinkSync(pending);}
    }
    console.log('PASS dedicated WORK Google QA and Cloudflare write-key entries aligned.');
    console.log(changed?'Private catalog updated with local backup.':'Private catalog already aligned.');
    console.log('No key was printed, sent, committed or installed remotely.');
    console.log('LIVE and all other existing entries preserved.');
  } catch(err) {
    const safe=new Set(['invalid_local_catalog','missing_or_duplicate_work_section',
      'duplicate_write_key','invalid_existing_write_key','work_write_key_mismatch',
      'invalid_generated_write_key','work_write_key_not_distinct',
      'private_catalog_unavailable']);
    console.error('WORK HQ private key preparation STOPPED: '+
      (safe.has(err?.message)?err.message:'local_io_unavailable'));
    process.exitCode=1;
  }
}
