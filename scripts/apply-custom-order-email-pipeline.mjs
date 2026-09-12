import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const backendPath = path.join(
  root,
  'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs',
);
const doPostPath = path.join(root, 'scripts/custom-order-do-post.fragment');
const deliveryPath = path.join(root, 'scripts/custom-order-email-shopify.fragment');

const rewardsMarker = `\n\n/* ---------------------------\n   JILL REWARDS\n---------------------------- */`;
const customerMarker = `/* ---------------------------\n   CUSTOMER CONFIRMATION\n---------------------------- */`;
const graphQlMarker = `/* ---------------------------\n   SHOPIFY GRAPHQL\n---------------------------- */`;

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Unable to locate patch boundary: ${startMarker}`);
  }

  return source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
}

let backend = fs.readFileSync(backendPath, 'utf8');
const doPost = fs.readFileSync(doPostPath, 'utf8');
const delivery = fs.readFileSync(deliveryPath, 'utf8');

backend = replaceBetween(backend, 'function doPost(e) {', rewardsMarker, doPost);
backend = replaceBetween(backend, customerMarker, graphQlMarker, delivery);

const forbidden = [
  'function sendConfirmation_(',
  'function findShopifyCustomerByEmail_(',
  'function createShopifyCustomer_(',
];

for (const token of forbidden) {
  if (backend.includes(token)) {
    throw new Error(`Obsolete backend function survived patch: ${token}`);
  }
}

const required = [
  'function sendCustomerConfirmation_(',
  'function sendMerchantNotification_(',
  'customerEmailMarketingConsentUpdate',
  "marketingOptInLevel: 'SINGLE_OPT_IN'",
  "merchantEmail: 'PENDING'",
  "customerEmail: 'PENDING'",
];

for (const token of required) {
  if (!backend.includes(token)) {
    throw new Error(`Required backend behavior missing after patch: ${token}`);
  }
}

fs.writeFileSync(backendPath, backend, 'utf8');
console.log('Custom Order backend email pipeline patch applied.');
