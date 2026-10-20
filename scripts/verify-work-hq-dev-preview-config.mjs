// WORK-only read guard. Shopify app dev applies LOCAL TOML configuration
// as an active dev preview; it can override a correctly released HQ App Home.
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {
  WORK_CONFIG_FILE,assertRewardsWorkConfig,
} from './verify-rewards-work-target.mjs';

export const WORK_HQ_HOME =
  'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const CALLBACK=WORK_HQ_HOME+'/auth/callback';

function stop() {
  throw Error('local_work_hq_preview_config_unverified');
}
function oneAssignment(source,name) {
  // Names below are fixed trusted strings, not user-controlled regex inputs.
  if(!/^[a-z_]+$/.test(name))stop();
  const matches=[...source.matchAll(
    new RegExp('^[ \t]*'+name+'[ \t]*=[ \t]*([^\r\n#]+)','gm')
  )];
  if(matches.length!==1)stop();
  return matches[0][1].trim();
}
function section(source,name) {
  const lines=source.split(/\r?\n/);
  const positions=lines.map((line,index)=>line.trim()==='['+name+']'?index:-1)
    .filter(index=>index>=0);
  if(positions.length!==1)stop();
  const from=positions[0]+1;
  let end=lines.length;
  for(let i=from;i<lines.length;i++) {
    if(/^\s*\[/.test(lines[i])){end=i;break;}
  }
  return lines.slice(from,end).join('\n');
}
function topLevel(source) {
  const lines=source.split(/\r?\n/);
  const end=lines.findIndex(line=>/^\s*\[/.test(line));
  return lines.slice(0,end<0?lines.length:end).join('\n');
}
export function verifyWorkHqDevPreviewConfig(source) {
  assertRewardsWorkConfig(source,{requireHqName:true});
  // The released WORK version is embedded and points to the active canary.
  // A storefront extension preview must not replace its Admin homepage.
  const root=topLevel(source);
  if(oneAssignment(root,'application_url')!==JSON.stringify(WORK_HQ_HOME)||
     oneAssignment(root,'embedded')!=='true')stop();
  const auth=section(source,'auth');
  const blocks=[...auth.matchAll(
    /^[ \t]*redirect_urls[ \t]*=[ \t]*\[([\s\S]*?)\]/gm
  )];
  if(blocks.length!==1)stop();
  const urls=[...blocks[0][1].matchAll(/"([^"\r\n]+)"/g)].map(m=>m[1]);
  if(!urls.includes(CALLBACK))stop();
  // Never let a CLI tunnel silently overwrite the pinned WORK HQ URL.
  const build=section(source,'build');
  if(oneAssignment(build,'automatically_update_urls_on_dev')!=='false')stop();
  return true;
}
if(process.argv[1] &&
   pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    if(process.argv.length!==2)stop();
    const file=resolve(process.cwd(),WORK_CONFIG_FILE);
    verifyWorkHqDevPreviewConfig(readFileSync(file,'utf8'));
    console.log('PASS: WORK dev preview preserves embedded HQ App Home, '+
      'OAuth callback, and fixed URL policy.');
    console.log('READ ONLY: Shopify preview not started and settings unchanged.');
  } catch {
    console.error('STOP: Local WORK dev config could replace JILL HQ with '+
      'Shopify default app home. No preview launched; no settings modified.');
    process.exitCode=1;
  }
}
