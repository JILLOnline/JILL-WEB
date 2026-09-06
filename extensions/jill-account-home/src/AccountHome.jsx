import '@shopify/ui-extensions/preact';
import {render} from 'preact';

const API = 'shopify://customer-account/api/2026-07/graphql.json';
const STORE = 'https://jillonlinestore.com';

const METAFIELDS = [
  'last_custom_request_at',
  'preferred_contact',
  'event_date',
  'date_needed',
  'fulfillment_preference',
  'theme_interest',
  'color_preferences',
  'product_interests',
  'collection_interests',
  'annual_reminder_enabled',
  'next_event_reminder_date',
  'last_custom_request_id',
  'custom_request_status',
].map((key) => `{namespace:"jill",key:"${key}"}`).join(',');

const QUERY = `
  query JillAccountHome {
    customer {
      id
      displayName
      firstName
      emailAddress { marketingState }
      orders(first: 1, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          statusPageUrl
          totalPrice { amount currencyCode }
        }
      }
      metafields(identifiers: [${METAFIELDS}]) {
        namespace
        key
        value
        type
      }
    }
  }
`;

async function loadData() {
  const response = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query: QUERY}),
  });
  const payload = await response.json();
  if (!response.ok || (!payload?.data?.customer && payload?.errors?.length)) {
    throw new Error(payload?.errors?.[0]?.message || 'Unable to load JILL account data');
  }
  return payload?.data?.customer || null;
}

function metaMap(customer) {
  return Object.fromEntries(
    (customer?.metafields || []).filter(Boolean).map((item) => [item.key, item.value]),
  );
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(`${value}`.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatMoney(money) {
  if (!money?.amount || !money?.currencyCode) return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: money.currencyCode,
  }).format(Number(money.amount));
}

function cleanStatus(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function extension() {
  let customer = null;
  try {
    customer = await loadData();
  } catch (error) {
    console.warn('JILL account home data error', error);
  }

  render(<AccountHome customer={customer} />, document.body);
}

function AccountHome({customer}) {
  const meta = metaMap(customer);
  const firstName = customer?.firstName || customer?.displayName?.split(' ')?.[0] || '';
  const subscribed = customer?.emailAddress?.marketingState === 'SUBSCRIBED';
  const latestOrder = customer?.orders?.nodes?.[0];
  const requestExists = Boolean(
    meta.last_custom_request_at || meta.last_custom_request_id || meta.custom_request_status,
  );
  const requestStatus = meta.custom_request_status || (requestExists ? 'Request received' : '');

  return (
    <s-stack direction="block" gap="base">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-stack direction="block" gap="small-200">
              <s-heading>{firstName ? `Hi, ${firstName} 👋` : 'Welcome back 👋'}</s-heading>
              <s-text color="subdued">
                Your JILL space for celebrations, custom requests, and orders.
              </s-text>
            </s-stack>
            <s-badge tone={subscribed ? 'info' : 'neutral'}>
              {subscribed ? 'Subscribed ★' : 'JILL account'}
            </s-badge>
          </s-stack>

          <s-stack direction="inline" gap="base">
            <s-button variant="primary" href={`${STORE}/pages/quote`}>
              Start a Custom Order
            </s-button>
            <s-button href="extension:jill-account-dashboard/">My JILL Dashboard</s-button>
          </s-stack>
        </s-stack>
      </s-section>

      {requestExists ? (
        <s-section>
          <s-stack direction="block" gap="small-400">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-heading>Your custom request</s-heading>
              <s-badge tone="info">{requestStatus}</s-badge>
            </s-stack>
            {meta.last_custom_request_at && (
              <s-text color="subdued">Submitted {formatDate(meta.last_custom_request_at)}</s-text>
            )}
            {meta.date_needed && (
              <s-text><s-text type="strong">Needed:</s-text> {formatDate(meta.date_needed)}</s-text>
            )}
            {meta.fulfillment_preference && (
              <s-text><s-text type="strong">Fulfillment:</s-text> {meta.fulfillment_preference}</s-text>
            )}
            <s-link href="extension:jill-account-dashboard/">View saved request details</s-link>
          </s-stack>
        </s-section>
      ) : (
        <s-banner tone="info">
          Dreaming up something custom? Your saved JILL details will appear here after your first request.{' '}
          <s-link href={`${STORE}/pages/quote`}>Start a custom request</s-link>
        </s-banner>
      )}

      {meta.event_date && (
        <s-section>
          <s-stack direction="block" gap="small-400">
            <s-heading>Next celebration ✨</s-heading>
            <s-text type="strong">{formatDate(meta.event_date)}</s-text>
            {meta.theme_interest && <s-text color="subdued">Theme: {meta.theme_interest}</s-text>}
            {meta.color_preferences && <s-text color="subdued">Colors: {meta.color_preferences}</s-text>}
          </s-stack>
        </s-section>
      )}

      {latestOrder && (
        <s-section>
          <s-stack direction="block" gap="small-400">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-heading>Latest order</s-heading>
              <s-text type="strong">{latestOrder.name}</s-text>
            </s-stack>
            <s-text color="subdued">
              {formatDate(latestOrder.processedAt)} · {formatMoney(latestOrder.totalPrice)}
            </s-text>
            <s-stack direction="inline" gap="small-400">
              {latestOrder.financialStatus && (
                <s-badge tone="neutral">{cleanStatus(latestOrder.financialStatus)}</s-badge>
              )}
              {latestOrder.fulfillmentStatus && (
                <s-badge tone="info">{cleanStatus(latestOrder.fulfillmentStatus)}</s-badge>
              )}
            </s-stack>
            {latestOrder.statusPageUrl && (
              <s-link href={latestOrder.statusPageUrl}>View order details</s-link>
            )}
          </s-stack>
        </s-section>
      )}
    </s-stack>
  );
}
