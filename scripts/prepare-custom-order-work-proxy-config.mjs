import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertRewardsWorkConfig,WORK_CONFIG_FILE} from './verify-rewards-work-target.mjs';

// Only the ignored WORK Shopify app TOML is eligible for modification.
// Requires an existing HTTPS gateway; does not publish/deploy Shopify.
export function prepareCustomOrderWorkProxyConfig(content,endpoint) {
  assertRewardsWorkConfig(content);
  let url;
  try {url=new URL(String(endpoint||''));}
  catch {throw new Error('A hosted WORK Custom Order HTTPS gateway URL is required.');}
  if(url.protocol!=='https:' || url.username || url.password ||
      url.port || url.search || url.hash ||
      url.pathname!=='/jill-custom-order-proxy' ||
      !url.hostname.includes('.') ||
      /(?:^localhost$|\.localhost$|\.local$|\.test$|\.example$|\.invalid$|\.myshopify\.com$)/i.test(url.hostname) ||
      url.hostname==='script.google.com' ||
      url.hostname==='jillonlinestore.com' ||
      url.hostname==='jqtdgr-1y.myshopify.com') {
    throw new Error('Invalid WORK Custom Order proxy host/route.');
  }
  const scopes=content.match(/(^\s*scopes\s*=\s*["'])([^"'\r\n]*)(["'])/m);
  if(!scopes)throw new Error('Missing WORK app access scopes.');
  const list=scopes[2].split(',').map(s=>s.trim()).filter(Boolean);
  if(!list.includes('write_app_proxy')) {
    list.push('write_app_proxy');
    content=content.replace(scopes[0],scopes[1]+list.join(',')+scopes[3]);
  }
  // Shopify allows ONE root proxy per app. Preserve any existing proxy
  // without silently repointing its destination to our new route.
  const lines=content.split(/\r?\n/);
  const start=lines.findIndex(line=>line.trim()==='[app_proxy]');
  if(start!==-1) {
    const next=lines.findIndex((line,i)=>i>start&&line.trim().startsWith('['));
    const section=lines.slice(start+1,next===-1?undefined:next).join('\n');
    if(!/^\s*prefix\s*=\s*["']apps["']\s*$/m.test(section) ||
       !/^\s*subpath\s*=\s*["']jill-custom-order["']\s*$/m.test(section)) {
      throw new Error('Existing WORK proxy belongs to another route; refusing takeover.');
    }
    const configured=section.match(/^\s*url\s*=\s*["']([^"']+)["']\s*$/m)?.[1];
    if(configured!==url.href) {
      throw new Error('Existing WORK proxy destination differs; refusing silent overwrite.');
    }
    return content;
  }
  return content.trimEnd()+
    '\n\n[app_proxy]\nurl = "'+url.href+
    '"\nprefix = "apps"\nsubpath = "jill-custom-order"\n';
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const source=fs.readFileSync(WORK_CONFIG_FILE,'utf8');
  const prepared=prepareCustomOrderWorkProxyConfig(
    source,process.env.JILL_WORK_CUSTOM_ORDER_PROXY_URL);
  if(prepared!==source)fs.writeFileSync(WORK_CONFIG_FILE,prepared);
  console.log('Prepared WORK-only Shopify app proxy configuration in ignored TOML.');
  console.log('No app deploy, no LIVE change and no storefront form switch occurred.');
}
