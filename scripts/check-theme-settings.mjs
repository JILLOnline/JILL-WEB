import fs from 'node:fs';
import path from 'node:path';

const SCHEMA_PATH = path.join('theme', 'config', 'settings_schema.json');
const DATA_PATH = path.join('theme', 'config', 'settings_data.json');

function fail(message) {
  throw new Error(`JILL Theme settings guard failed: ${message}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot parse ${filePath}: ${error.message}`);
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const schema = readJson(SCHEMA_PATH);
const data = readJson(DATA_PATH);
const current = data?.current;

if (!current || typeof current !== 'object' || Array.isArray(current)) {
  fail('settings_data.json current must be an object');
}

const expected = new Map();
for (const group of schema) {
  for (const setting of group.settings || []) {
    if (!setting.id || !Object.hasOwn(setting, 'default')) continue;
    if (expected.has(setting.id)) fail(`duplicate global setting id ${setting.id}`);
    expected.set(setting.id, setting.default);
  }
}

for (const [id, defaultValue] of expected) {
  if (!Object.hasOwn(current, id)) {
    fail(`active setting ${id} is missing; clean themes must seed every schema default`);
  }
  if (!sameValue(current[id], defaultValue)) {
    fail(`active setting ${id} does not match its schema default`);
  }
}

for (const id of Object.keys(current)) {
  if (!expected.has(id)) fail(`settings_data.json contains unknown active setting ${id}`);
}

console.log(`JILL Theme settings guard passed: ${expected.size} active design settings seeded and synchronized.`);
