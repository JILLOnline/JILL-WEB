import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeWorkReference as describe}
  from '../services/jill-order-desk/work-reference-provenance.mjs';

const legacy='https://res.cloudinary.com/vtnu62sj/image/upload/v1791926029/sgxrklh1pty4lp4tf521.png';
const actual=describe(legacy);
assert.equal(actual.kind,'legacy_cloudinary_url');
assert.equal(actual.identifier,'sgxrklh1pty4lp4tf521.png');
assert.equal(actual.label,'Cloudinary image reference');
assert.ok(Object.isFrozen(actual));
assert.doesNotMatch(JSON.stringify(actual),/https:|res\.cloudinary\.com|vtnu62sj/);
assert.deepEqual(describe('jill:asset_01'),{
  kind:'opaque_id',label:'Opaque reference ID',identifier:'jill:asset_01',
});
assert.equal(describe('jill:asset_01').kind,'opaque_id');
for(const sample of [
  'http://res.cloudinary.com/vtnu62sj/image/upload/v1791926029/x.png',
  'https://res.cloudinary.com.evil.example/vtnu62sj/image/upload/v1791926029/x.png',
  'https://fake.example/res.cloudinary.com/vtnu62sj/image/upload/v1791926029/x.png',
  'https://user:pass@res.cloudinary.com/vtnu62sj/image/upload/v1791926029/x.png',
  'https://res.cloudinary.com:443/vtnu62sj/image/upload/v1791926029/x.png?token=evil',
  'https://res.cloudinary.com/vtnu62sj/image/upload/v1791926029/x.png#fragment',
  'https://res.cloudinary.com/vtnu62sj/image/authenticated/v1791926029/x.png',
  'https://res.cloudinary.com/vtnu62sj/video/upload/v1791926029/x.png',
  'https://res.cloudinary.com/vtnu62sj/image/upload/v1791926029/%2e%2e.png',
  'https://res.cloudinary.com/vtnu62sj/image/upload/v1791926029/x.svg',
  'https://res.cloudinary.com/vtnu62sj/image/upload/v1791926029/dir/x.png',
  'javascript:alert(1)','data:image/png;base64,evil',
  'https://evil.example/private?auth=secret',
]){
  const output=describe(sample);
  assert.notEqual(output.kind,'legacy_cloudinary_url',sample);
  assert.equal(output.identifier,'Not verified',sample);
  assert.doesNotMatch(JSON.stringify(output),/https:|http:|javascript:|data:|secret/);
}
for(const sample of ['', ' ', 'a'.repeat(513),'<script>alert(1)</script>',
  '../../secret', 'file id with spaces',null,undefined]){
  const output=describe(sample);
  assert.equal(output.kind,'unverified');
  assert.equal(output.identifier,'Not verified');
}
const component=readFileSync(
  'services/jill-order-desk/app-home/app/components/WorkOriginalRequestDetails.tsx',
  'utf8',
);
assert.match(component,/describeWorkReference\(id\)/);
assert.match(component,/ref\.label/);
assert.match(component,/ref\.identifier/);
assert.match(component,/File references do not verify ownership/);
assert.match(component,/Secure previews and downloads are unavailable/);
assert.doesNotMatch(component,/<a\s+href=|<img\s+src=|fetch\(|URL\.createObjectURL/);
console.log('PASS WORK HQ legacy Cloudinary reference classification: real test PNG detected without URL linking, unsigned/untrusted URLs never converted to previews, opaque IDs preserved, no LIVE/media mutations.');
