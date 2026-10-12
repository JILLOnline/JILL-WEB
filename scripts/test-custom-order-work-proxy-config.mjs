import assert from 'node:assert/strict';
import {prepareCustomOrderWorkProxyConfig} from './prepare-custom-order-work-proxy-config.mjs';
const base=[
  'client_id = "f8e1ebdbae84490dc8ea5b133637e6c0"',
  'name = "JILL WORK Rewards"',
  '[access_scopes]',
  'scopes = "customer_read_customers,customer_write_customers,customer_read_orders,read_customers,write_customers,read_orders,write_orders,read_discounts,write_discounts"',
].join('\n')+'\n';
const url='https://work-custom-order-gateway.example.org/jill-custom-order-proxy';
const a=prepareCustomOrderWorkProxyConfig(base,url);
assert.match(a,/write_app_proxy/);
assert.match(a,/\[app_proxy\]/);
assert.match(a,/prefix = "apps"/);
assert.match(a,/subpath = "jill-custom-order"/);
assert.match(a,/https:\/\/work-custom-order-gateway.example.org\/jill-custom-order-proxy/);
assert.equal(prepareCustomOrderWorkProxyConfig(a,url),a);
assert.throws(()=>prepareCustomOrderWorkProxyConfig(base,'http://work.example.org/jill-custom-order-proxy'),/Invalid WORK/);
assert.throws(()=>prepareCustomOrderWorkProxyConfig(base,'https://script.google.com/macros/s/AKfycbfoo/exec'),/Invalid WORK/);
assert.throws(()=>prepareCustomOrderWorkProxyConfig(base,'https://localhost/jill-custom-order-proxy'),/Invalid WORK/);
assert.throws(()=>prepareCustomOrderWorkProxyConfig(base,'https://work.example.org/not-jill'),/Invalid WORK/);
assert.throws(()=>prepareCustomOrderWorkProxyConfig(a,'https://different.example.org/jill-custom-order-proxy'),/destination differs/);
const other=base+'\n[app_proxy]\nurl = "https://example.org/other"\nprefix = "apps"\nsubpath = "other"\n';
assert.throws(()=>prepareCustomOrderWorkProxyConfig(other,url),/belongs to another route/);
assert.throws(()=>prepareCustomOrderWorkProxyConfig(base.replace('f8e1ebdbae84490dc8ea5b133637e6c0',
  'ebf1a69d82f46619d2f2945faab78afa'),url),/not JILL WORK Rewards/);
console.log('Isolated WORK app proxy config, scope, replays and existing proxy ownership checks passed.');
