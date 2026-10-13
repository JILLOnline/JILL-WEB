#!/usr/bin/env node
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const script='scripts/export-jill-safe-catalog.mjs';
for(const [scope,tokenName] of [['live','JILL_LIVE_ADMIN_TOKEN'],['work','JILL_WORK_ADMIN_TOKEN']]){
 const env={...process.env,[tokenName]:''};
 const r=spawnSync(process.execPath,[script,scope],{encoding:'utf8',env});
 assert.equal(r.status,2,'Read-only exporter must fail closed without '+tokenName);
 assert.ok(r.stderr.includes('Missing '+tokenName));
 assert.ok(!r.stdout.includes('Saved privately'));
}
const x=spawnSync(process.execPath,[script,'other'],{encoding:'utf8'});
assert.equal(x.status,2);
assert.match(x.stderr,/Usage:/);
console.log('Read-only catalog exporter wrong-shop/missing-token guards PASS');
