import fs from 'node:fs';
import {
  WORK_CLIENT_ID,
  WORK_CONFIG_FILE,
  assertRewardsWorkConfig,
} from './verify-rewards-work-target.mjs';

if (!fs.existsSync(WORK_CONFIG_FILE)) {
  throw new Error('Link JILL WORK Rewards with npm run rewards:work:link before preview.');
}

let content = fs.readFileSync(WORK_CONFIG_FILE,'utf8');
const appId = content.match(/^\s*client_id\s*=\s*["']([^"']+)["']/m)?.[1];
const appName = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1];
if (appId !== WORK_CLIENT_ID || appName !== 'JILL WORK Rewards') {
  throw new Error('Refusing changes to a non-WORK Shopify app configuration.');
}
const section = content.match(/\[access_scopes\]([\s\S]*?)(?=\n\[|$)/);
const line = section?.[1]?.match(/^\s*scopes\s*=\s*["']([^"']*)["']/m);
if (!section || !line) throw new Error('Missing WORK app access_scopes/scopes configuration.');
const current = line[1].split(',').map(x=>x.trim()).filter(Boolean);
if (!current.includes('write_orders')) {
  const next = [...current,'write_orders'].join(',');
  const modifiedSection = section[0].replace(line[0],line[0].replace(line[1],next));
  content = content.replace(section[0],modifiedSection);
  fs.writeFileSync(WORK_CONFIG_FILE,content);
  console.log('Added write_orders to isolated WORK app scope configuration for order credit metafields.');
}
assertRewardsWorkConfig(content);
console.log('WORK scope configuration verified. No LIVE app configuration was changed.');
