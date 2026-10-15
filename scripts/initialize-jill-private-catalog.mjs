// Local-only JILL property catalog. The owner explicitly runs this command.
// Values are never printed, sent anywhere, remapped or inferred from screenshots.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const CATALOG_MARKER='# JILL CANONICAL LOCAL PROPERTY CATALOG v2';
export const CATALOG="# JILL CANONICAL LOCAL PROPERTY CATALOG v2\n# LOCAL PLAINTEXT ONLY. Never commit, sync, email or paste this file into chat.\n# Read ONLY when the owner explicitly runs a local operation.\n# Each project/environment maintains its OWN credential values.\n# Screenshots contain property NAMES but some may be from LIVE.\n\n# CONFIRMED WORK QA: signed merchant read returned 2 requests.\n# This SAME secret is separately staged on the WORK Cloudflare Worker.\n[WORK.GOOGLE_CUSTOM_ORDERS_QA]\nJILL_HQ_MERCHANT_READ_SECRET=\n\n# CONFIRMED WORK Cloudflare binding NAMES. Values are not copied from Google.\n[WORK.CLOUDFLARE_ORDER_DESK]\nSHOPIFY_API_SECRET=\nJILL_WORK_SESSION_KEY_B64=\n\n# UNVERIFIED GOOGLE ORIGIN. Could be LIVE, WORK Rewards, or another script.\n# Do NOT copy these values between WORK/KEEP/LIVE until you confirm the\n# originating Script Project and associated Shopify store.\n[UNASSIGNED.GOOGLE_SCRIPT_SECRETS]\nJILL_CUSTOM_ORDER_GATEWAY_SECRET=\nSHOPIFY_ACCESS_TOKEN=\nSHOPIFY_CLIENT_SECRET=\n\n# Place keys in KEEP or LIVE only once origin is verified.\n[KEEP.UNVERIFIED]\n\n[LIVE.UNVERIFIED]\n\n# OTHER SCREENSHOT PROPERTY NAMES -- NOT API SECRETS:\n# JILL_CUSTOM_ORDER_ADMINS (access control)\n# SHOPIFY_CLIENT_ID (app identifier)\n# SHOPIFY_REDIRECT_URI (redirect config)\n# SHOPIFY_SHOP (shop domain)\n# SHOPIFY_STORE (store reference)\n# JILL_SHEET_ID (spreadsheet ID)\n#\n# RUNTIME STATE -- NOT KEYS, NEVER COPY BETWEEN STORES:\n# JILL_PUBLIC_PROMOTIONS_INFRA_CHECK_AT\n# JILL_REWARDS_INFRA_CHECK_AT\n# JILL_REWARDS_LAST_SWEEP\n#\n# OLD SPECULATIVE LABELS -- NOT CONFIRMED SERVICE PROPERTY NAMES:\n# SHOPIFY_WORK_API_SECRET / SHOPIFY_KEEP_API_SECRET\n# SHOPIFY_LIVE_API_SECRET / CLOUDFLARE_WORK_API_TOKEN\n# GOOGLE_WORK_APPS_SCRIPT_KEY\n#\n# Google SHOPIFY_CLIENT_SECRET and Cloudflare SHOPIFY_API_SECRET are\n# distinct binding names; do not equate their values automatically.\n";
export function reconcileCatalog(existing) {
  if(typeof existing!=='string')throw Error('Existing file is not UTF-8 text.');
  if(existing.includes(CATALOG_MARKER))
    return {changed:false,content:existing,reason:'already_installed'};
  if(!existing.trim())
    return {changed:true,content:CATALOG,reason:'new_file'};
  // Do not interpret or migrate any historical values. Preserve them all.
  const separator=existing.endsWith('\n')?'':'\n';
  return {
    changed:true,
    content:existing+separator+
      '\n# LEGACY ENTRIES ABOVE PRESERVED; THEIR ENVIRONMENTS ARE UNVERIFIED.\n'+
      '# Prefer the exact names and environment scopes below.\n'+CATALOG,
    reason:'append_only',
  };
}
function isUnder(base,candidate) {
  const relative=path.relative(base,candidate);
  return relative===''||(!relative.startsWith('..')&&!path.isAbsolute(relative));
}
export function localFilePath({home=os.homedir(),repo}={}) {
  const folder=path.resolve(home,'JILL-PRIVATE');
  const full=path.join(folder,'JILL-SECRETS.txt');
  if(repo&&isUnder(path.resolve(repo),full))
    throw Error('Do not create secrets under the Git checkout.');
  if(/(^|[\\/])(OneDrive|Dropbox|Google Drive)([\\/]|$)/i.test(folder))
    throw Error('Do not create secrets under a cloud-synced folder.');
  return {folder,full};
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked) {
  try {
    const repo=fileURLToPath(new URL('../',import.meta.url));
    const {folder,full}=localFilePath({repo});
    if(fs.existsSync(folder)&&fs.lstatSync(folder).isSymbolicLink())
      throw Error('Refusing symlinked directory.');
    fs.mkdirSync(folder,{recursive:true,mode:0o700});
    if(fs.existsSync(full)&&fs.lstatSync(full).isSymbolicLink())
      throw Error('Refusing symlinked file.');
    const exists=fs.existsSync(full);
    const existing=exists?fs.readFileSync(full,'utf8'):'';
    const result=reconcileCatalog(existing);
    if(result.changed) {
      if(existing) {
        fs.copyFileSync(full,full+'.backup-'+Date.now()+'.txt',
          fs.constants.COPYFILE_EXCL);
        console.log('Existing local file backed up inside JILL-PRIVATE.');
      }
      fs.writeFileSync(full,result.content,{
        encoding:'utf8',flag:exists?'w':'wx',mode:0o600,
      });
    }
    console.log('JILL local catalog: '+full);
    console.log('Status: '+(result.changed?'catalog added':'already current'));
    console.log('Values were never displayed, uploaded, renamed, or transferred.');
    console.log('LIVE/WORK origin of other screenshots remains UNKNOWN.');
    console.log('Open locally using: notepad.exe "'+full+'"');
  }catch{
    console.error('Local catalog update stopped. Check local file permissions.');
    process.exitCode=1;
  }
}
