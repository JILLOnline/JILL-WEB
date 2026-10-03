import fs from 'node:fs';

function fail(message) {
  throw new Error(`Public promotions test failed: ${message}`);
}

const source = fs.readFileSync(
  'backend/google-apps-script/JILL_Public_Promotions.gs',
  'utf8',
);

try {
  new Function(source);
} catch (error) {
  fail(`Apps Script syntax check failed: ${error.message}`);
}

for (const marker of [
  "HANDLER: 'syncJillPublicPromotions'",
  'PAGE_SIZE: 50',
  'MAX_PAGES: 100',
  'MAX_SNAPSHOT_AGE_MS: 10 * 60 * 1000',
  'function ensureJillPublicPromotionsInfrastructure_(force)',
  '.everyMinutes(1)',
  'after: $after',
  'pageInfo {',
  'hasNextPage',
  'endCursor',
  'function collectJillPublicOffers_(nodes)',
  'DiscountBuyerSelectionAll',
  'if (codes.length !== 1) return;',
  'function jillPublicPromotionsHealth_()',
  'function ensureJillPublicPromotionsHealthy_(force)',
]) {
  if (!source.includes(marker)) fail(`missing ${marker}`);
}

for (const forbidden of [
  'PARTY10',
  'PARTY5',
  'SUBSCRIBE10',
  'context:all',
  'SHOPIFY_ACCESS_TOKEN',
  'X-Shopify-Access-Token',
  'UrlFetchApp.fetch(',
]) {
  if (source.includes(forbidden)) fail(`backend must not contain ${forbidden}`);
}

const clean = (value) => String(value ?? '').trim();
const factory = new Function(
  'clean_',
  source + '\nreturn {collectJillPublicOffers_};',
);
const {collectJillPublicOffers_} = factory(clean);

const nodes = [
  {
    discount: {
      __typename: 'DiscountCodeBasic',
      title: 'PUBLIC5',
      status: 'ACTIVE',
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: null,
      summary: '5% off entire order • One use per customer',
      shortSummary: '5% off entire order',
      appliesOncePerCustomer: true,
      codes: {nodes: [{code: 'PUBLIC5'}]},
      context: {__typename: 'DiscountBuyerSelectionAll'},
    },
  },
  {
    discount: {
      __typename: 'DiscountCodeBasic',
      title: 'SEGMENT10',
      status: 'ACTIVE',
      summary: '10% off',
      shortSummary: '10% off',
      codes: {nodes: [{code: 'SEGMENT10'}]},
      context: {__typename: 'DiscountCustomerSegments'},
    },
  },
  {
    discount: {
      __typename: 'DiscountCodeBasic',
      title: 'MULTI',
      status: 'ACTIVE',
      summary: 'Multi-code campaign',
      shortSummary: 'Multi-code campaign',
      codes: {nodes: [{code: 'A'}, {code: 'B'}]},
      context: {__typename: 'DiscountBuyerSelectionAll'},
    },
  },
];

const offers = collectJillPublicOffers_(nodes);
if (offers.length !== 1) fail('only one all-customer deterministic code should publish');
if (offers[0].code !== 'PUBLIC5') fail('wrong public code published');
if (offers[0].summary !== '5% off entire order') fail('short summary should be preferred');
if (offers[0].kind !== 'basic') fail('basic discount kind changed');

console.log('JILL public promotions regression tests passed.');
