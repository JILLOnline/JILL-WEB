// HQ WORK source-only: a retained Router fetcher result is not a new
// Save/Reload receipt simply because unrelated Owner props re-render.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file='services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx';
const src=readFileSync(file,'utf8');
const save=src.slice(src.indexOf('useEffect(()=>{',src.indexOf('const verifiedSource=')));
const read=src.slice(src.indexOf('useEffect(()=>{',src.indexOf('processedSaveResponse.current=saveFetcher.data;')));
assert.match(src,/const processedSaveResponse=useRef<DraftResult\|null>\(null\)/);
assert.match(src,/const processedReadResponse=useRef<DraftResult\|null>\(null\)/);
assert.match(save,/saveFetcher\.state!=="idle"/);
assert.match(save,/processedSaveResponse\.current===saveFetcher\.data/);
assert.match(save,/processedSaveResponse\.current=saveFetcher\.data/);
assert.ok(save.indexOf('processedSaveResponse.current=saveFetcher.data')<
 save.indexOf('setDraftRevision(rev)'),
 'Save receipt consumption precedes acknowledged revision update');
assert.match(read,/processedReadResponse\.current===readFetcher\.data/);
assert.match(read,/processedReadResponse\.current=readFetcher\.data/);
assert.ok(read.indexOf('processedReadResponse.current=readFetcher.data')<
 read.indexOf('setPrices(projection.prices)'),
 'Readback consumption precedes restoring prices');
assert.match(read,/inspectWorkQuoteReload\(\{/);
assert.match(read,/acknowledgedRevision:acknowledgedRevision\.current/);
assert.match(read,/if\(check\.state==="apply"&&projection\)/);
assert.match(read,/setBlocked\(true\)/);
assert.match(save,/setBlocked\(true\)/);
assert.doesNotMatch(src,/localStorage|sessionStorage|draftOrderCreate|draftOrderInvoiceSend/);
const boundary=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.requests.quote-draft.tsx','utf8');
assert.match(boundary,/workQuoteDraftFeatureReady\(env\)/);
console.log('PASS HQ source: each retained Save/Reload response applied once, revision/Owner hold and no commerce writes preserved.');
