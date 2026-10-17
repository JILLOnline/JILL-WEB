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
  'function collectJillUpcomingOffers_(nodes)',
  'status:scheduled method:code',
  'query: $filter',
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
  source + '\nreturn {collectJillPublicOffers_,collectJillUpcomingOffers_};',
);
const {collectJillPublicOffers_,collectJillUpcomingOffers_} = factory(clean);

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

const now = Date.now();
nodes.push(
  {discount: {__typename: 'DiscountCodeBasic', status: 'ACTIVE',
    title:'FUTURE', shortSummary:'Future offer', startsAt:new Date(now+86400000).toISOString(),
    codes:{nodes:[{code:'FUTURE'}]}, context:{__typename:'DiscountBuyerSelectionAll'}}},
  {discount: {__typename: 'DiscountCodeBasic', status: 'ACTIVE',
    title:'ENDED', shortSummary:'Ended offer', endsAt:new Date(now-86400000).toISOString(),
    codes:{nodes:[{code:'ENDED'}]}, context:{__typename:'DiscountBuyerSelectionAll'}}},
  {discount: {__typename: 'DiscountCodeBasic', status: 'ACTIVE',
    title:'BROKEN', shortSummary:'Invalid dates', startsAt:'not-a-date',
    codes:{nodes:[{code:'BROKEN'}]}, context:{__typename:'DiscountBuyerSelectionAll'}}},
);
const offers = collectJillPublicOffers_(nodes);
if (offers.length !== 1) fail('only one all-customer deterministic code should publish');
if (offers[0].code !== 'PUBLIC5') fail('wrong public code published');
if (offers[0].summary !== '5% off entire order') fail('short summary should be preferred');
if (offers[0].kind !== 'basic') fail('basic discount kind changed');

const future=new Date(now+86400000).toISOString();
const later=new Date(now+2*86400000).toISOString();
const launchCandidates=[
  {discount:{
    __typename:'DiscountCodeBasic',title:'[JILL UPCOMING] QA Black Friday',
    status:'SCHEDULED',startsAt:future,endsAt:later,
    shortSummary:'QA sale starts tomorrow',
    codes:{nodes:[{code:'PRIVATE-UNTIL-LAUNCH'}]},
    context:{__typename:'DiscountBuyerSelectionAll'},
  }},
  {discount:{
    __typename:'DiscountCodeBxgy',title:'[JILL UPCOMING] QA Summer BOGO',
    status:'SCHEDULED',startsAt:later,
    summary:'QA buy one get one',
    codes:{nodes:[{code:'OTHER-PRIVATE-CODE'}]},
    context:{__typename:'DiscountBuyerSelectionAll'},
  }},
  {discount:{
    __typename:'DiscountCodeBasic',title:'Unannounced promotion',
    status:'SCHEDULED',startsAt:future,
    shortSummary:'TOP SECRET',codes:{nodes:[{code:'HIDDEN'}]},
    context:{__typename:'DiscountBuyerSelectionAll'},
  }},
  {discount:{
    __typename:'DiscountCodeBasic',title:'[JILL UPCOMING] Private customer',
    status:'SCHEDULED',startsAt:future,
    shortSummary:'PRIVATE',codes:{nodes:[{code:'PRIVATE'}]},
    context:{__typename:'DiscountCustomers'},
  }},
  {discount:{
    __typename:'DiscountCodeBasic',title:'[JILL UPCOMING] Too early',
    status:'SCHEDULED',startsAt:new Date(now-3600000).toISOString(),
    shortSummary:'ENDED',codes:{nodes:[{code:'PAST'}]},
    context:{__typename:'DiscountBuyerSelectionAll'},
  }},
  {discount:{
    __typename:'DiscountCodeBasic',title:'[JILL UPCOMING] Multiple codes',
    status:'SCHEDULED',startsAt:future,
    shortSummary:'MULTIPLE',codes:{nodes:[{code:'A'},{code:'B'}]},
    context:{__typename:'DiscountBuyerSelectionAll'},
  }},
];
const upcoming=collectJillUpcomingOffers_(launchCandidates);
if(upcoming.length!==2) fail('upcoming projection must be opt-in and all-customer only');
if(upcoming[0].title!=='QA Black Friday'||upcoming[1].title!=='QA Summer BOGO')
  fail('upcoming projection must keep valid scheduled sorting');
if(upcoming.some(o=>'code' in o||'discount_id' in o))
  fail('upcoming projection must never expose unpublished discount codes or IDs');
if(JSON.stringify(upcoming).includes('PRIVATE-UNTIL-LAUNCH'))
  fail('upcoming snapshot leaked a scheduled discount code');

console.log('JILL public promotions regression tests passed.');
