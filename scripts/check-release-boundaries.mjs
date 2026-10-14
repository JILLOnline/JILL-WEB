#!/usr/bin/env node
// JILL governance lane boundary guard. Read-only; no deploy/network.
// Usage: node scripts/check-release-boundaries.mjs --lane website --base <ref> --head <ref>
//        node scripts/check-release-boundaries.mjs --lane accounts --base <ref> --head <ref>
//        node scripts/check-release-boundaries.mjs --lane governance --base <ref> --head <ref>
// Conservative: disallow cross-lane changes; exceptions require a separate reviewed PR.
import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2);
function arg(name){const i=args.indexOf('--'+name);return i<0?null:args[i+1];}
const lane=arg('lane'),base=arg('base'),head=arg('head');
if(!['website','accounts','governance'].includes(lane)||!base||!head||
   !/^[a-zA-Z0-9_./-]+$/.test(base)||!/^[a-zA-Z0-9_./-]+$/.test(head)) {
  console.error('Usage: --lane website|accounts|governance --base <git-ref> --head <git-ref>');
  process.exit(2);
}
const allowed={
  website:[/^theme\//],
  accounts:[/^extensions\/jill-account-/,/^shared\/customer-/,/^shared\/rewards\.mjs$/],
  governance:[/^docs\/architecture\//,/^docs\/releases\//,/^scripts\/check-release-boundaries\.mjs$/],
};
let paths;
try {
  paths=execFileSync('git',['diff','--name-only','--no-renames',base+'...'+head],{
    encoding:'utf8',maxBuffer:2*1024*1024,
  }).trim().split(/\r?\n/).filter(Boolean);
} catch {
  console.error('Unable to verify Git compare range. Fail closed.');
  process.exit(2);
}
const forbidden=paths.filter(p=>!allowed[lane].some(re=>re.test(p)));
if(!paths.length||forbidden.length) {
  console.error('JILL release boundary denied for '+lane+'.');
  if(!paths.length)console.error('No changed files; no release to certify.');
  for(const path of forbidden)console.error('BLOCKED: '+path);
  process.exit(1);
}
console.log('JILL '+lane+' boundary PASS ('+paths.length+' files).');
console.log('This only validates changed paths. It does not verify target IDs, runtime config, tests or authorize deployment.');
