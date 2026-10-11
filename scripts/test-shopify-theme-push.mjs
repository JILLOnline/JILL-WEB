import assert from 'node:assert/strict';
import {verifyThemePush} from './verify-shopify-theme-push.mjs';

const expected={id:'165562941683',name:'JILL WORK',role:'unpublished'};
const progress=JSON.stringify({type:'progress',status:'completed'});
const final=(theme)=>[progress,JSON.stringify({theme})].join('\n');
const good={id:165562941683,name:'JILL WORK',role:'unpublished'};
assert.deepEqual(verifyThemePush(final(good),expected),{
  id:'165562941683',name:'JILL WORK',role:'unpublished',
});
assert.throws(()=>verifyThemePush('',expected),/no JSON/);
assert.throws(()=>verifyThemePush(progress,expected),/final theme result/);
assert.throws(()=>verifyThemePush('not-json',expected),/malformed JSON/);
assert.throws(()=>verifyThemePush(final(good)+'\n'+JSON.stringify({theme:good}),expected),/exactly one/);
assert.throws(()=>verifyThemePush(final({...good,role:'live'}),expected),/mismatch/);
assert.throws(()=>verifyThemePush(final({...good,id:111}),expected),/mismatch/);
assert.throws(()=>verifyThemePush(final({...good,name:'JILL'}),expected),/mismatch/);
assert.throws(()=>verifyThemePush(final({...good,warning:'pushed with errors',
  errors:{'templates/gift_card.liquid':['could not be deleted']}}),expected),/file errors/);
assert.throws(()=>verifyThemePush(final({...good,errors:{'AGENTS.md':['does not exist']}}),expected),/file errors/);
assert.throws(()=>verifyThemePush(final(good),{...expected,role:'live'}),/Refusing/);
console.log('Shopify structured theme push clean-result guard passed.');
