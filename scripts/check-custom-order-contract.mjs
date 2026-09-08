import fs from 'node:fs';
import path from 'node:path';

const CONTRACT_PATH = path.join('contracts', 'custom-order-api.schema.json');
const EXPECTED_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

function fail(message) {
  throw new Error(`JILL Custom Order contract guard failed: ${message}`);
}

function readSchema() {
  if (!fs.existsSync(CONTRACT_PATH)) fail(`${CONTRACT_PATH} is missing`);

  try {
    return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (error) {
    fail(`invalid JSON in ${CONTRACT_PATH}: ${error.message}`);
  }
}

function assertUniqueValues(values, owner) {
  const serialized = values.map((value) => JSON.stringify(value));
  if (new Set(serialized).size !== serialized.length) fail(`duplicate values in ${owner}`);
}

function inspectNode(node, location = '$') {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    node.forEach((value, index) => inspectNode(value, `${location}[${index}]`));
    return;
  }

  if (node.type === 'object' && node.additionalProperties !== false) {
    fail(`object schema must be closed at ${location}`);
  }

  if (Array.isArray(node.required)) {
    assertUniqueValues(node.required, `${location}.required`);
    for (const key of node.required) {
      if (!node.properties || !Object.hasOwn(node.properties, key)) {
        fail(`required key ${key} has no property definition at ${location}`);
      }
    }
  }

  if (Array.isArray(node.enum)) assertUniqueValues(node.enum, `${location}.enum`);

  for (const [key, value] of Object.entries(node)) {
    inspectNode(value, `${location}.${key}`);
  }
}

const schema = readSchema();

if (schema.$schema !== EXPECTED_DRAFT) fail('must use JSON Schema draft 2020-12');
if (schema.$id !== 'https://jill.local/contracts/custom-order-api.schema.json') fail('unexpected $id');
if (schema.title !== 'JILL Custom Order API') fail('unexpected title');
if (!Array.isArray(schema.oneOf) || schema.oneOf.length !== 3) fail('root must expose submit request, success, and failure variants');

const defs = schema.$defs || {};
const request = defs.submitRequest;
const success = defs.submitSuccess;
const failure = defs.submitFailure;
const item = defs.item;

if (!request || !success || !failure || !item) fail('required API definitions are missing');
if (request.properties?.version?.const !== 1) fail('submit request must own contract version 1');
if (request.properties?.operation?.const !== 'custom_order.submit') fail('submit request operation must be custom_order.submit');
if (success.properties?.operation?.const !== 'custom_order.submit.result') fail('success operation must be custom_order.submit.result');
if (failure.properties?.operation?.const !== 'custom_order.submit.result') fail('failure operation must be custom_order.submit.result');
if (success.properties?.ok?.const !== true) fail('success response must declare ok=true');
if (failure.properties?.ok?.const !== false) fail('failure response must declare ok=false');
if (!request.required?.includes('submission_id')) fail('submit request must require submission_id for idempotency');
if (!success.required?.includes('submission_id')) fail('success response must return submission_id');
if (!item.required?.includes('quantity')) fail('item contract must require canonical quantity');
if (item.properties?.quantity?.minimum !== 1) fail('item quantity must be positive');
if (!item.required?.includes('personalization_groups')) fail('item contract must explicitly carry personalization_groups');
if (!item.required?.includes('reference_ids')) fail('item contract must explicitly carry reference_ids');

inspectNode(schema);

console.log('JILL Custom Order contract guard passed: API v1, idempotent submit request, closed request/response schemas.');
