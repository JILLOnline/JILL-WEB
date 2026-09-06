import '@shopify/ui-extensions/preact';
import {render} from 'preact';

const API = 'shopify://customer-account/api/2026-07/graphql.json';
const STORE = 'https://jillonlinestore.com';

const IDENTIFIERS = [
  'last_custom_request_at',
  'preferred_contact',
  'event_date',
  'date_needed',
  'fulfillment_preference',
  'city',
  'state',
  'zip',
  'theme_interest',
  'color_preferences',
  'product_interests',
  'collection_interests',
  'reference_images',
  'annual_reminder_enabled',
  'next_event_reminder_date',
  'last_custom_request_id',
  'custom_request_status',
].map((key) => `{namespace:"jill",key:"${key}"}`).join(',');

const QUERY = `
  query JillDashboard {
    customer {
      id
      displayName
      firstName
      emailAddress { emailAddress marketingState }
      orders(first: 3, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          statusPageUrl
          totalPrice { amount currencyCode }
          lineItems(first: 4) {
            nodes {
              id
              title
              quantity
            }
          }
        }
      }
      metafields(identifiers: [${IDENTIFIERS}]) {
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
    throw new Error(payload?.errors?.[0]?.message || 'Unable to load JILL dashboard data');
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

function Detail({label, value}) {
  if (!value) return null;
  return (
    <s-text>
      <s-text type="strong">{label}:</s-text> {value}
    </s-text>
  );
}

function SavedDetail({label, value}) {
  if (!value) return null;
  return (
    <s-stack direction="block" gap="small-100">
      <s-text color="subdued">{label}</s-text>
      <s-text type="strong">{value}</s-text>
    </s-stack>
  );
}

export default async function extension() {
  let customer = null;
  try {
    customer = await loadData();
  } catch (error) {
    console.warn('JILL dashboard data error', error);
  }

  render(<Dashboard customer={customer} />, document.body);
}

function Dashboard({customer}) {
  const meta = metaMap(customer);
  const firstName = customer?.firstName || customer?.displayName?.split(' ')?.[0] || '';
  const subscribed = customer?.emailAddress?.marketingState === 'SUBSCRIBED';
  const orders = customer?.orders?.nodes || [];
  const hasRequest = Boolean(
    meta.last_custom_request_at || meta.last_custom_request_id || meta.custom_request_status,
  );
  const requestStatus = meta.custom_request_status || (hasRequest ? 'Request received' : '');
  const location = [meta.city, meta.state, meta.zip].filter(Boolean).join(', ');
  const hasSavedDetails = Boolean(
    meta.theme_interest ||
      meta.color_preferences ||
      meta.product_interests ||
      meta.collection_interests ||
      meta.fulfillment_preference ||
      meta.preferred_contact ||
      location,
  );

  return (
    <s-page
      heading={firstName ? `Hi, ${firstName} 👋` : 'My JILL'}
      subheading="Everything JILL has saved for your celebrations, custom requests, and orders."
    >
      <s-button slot="primary-action" variant="primary" href={`${STORE}/pages/quote`}>
        Start a Custom Order
      </s-button>
      <s-button slot="secondary-actions" href={`${STORE}/collections/all`}>
        Shop JILL
      </s-button>
      <s-button slot="secondary-actions" href="shopify:customer-account/profile">
        Profile
      </s-button>

      <s-stack direction="block" gap="base">
        <s-section>
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-stack direction="block" gap="small-200">
              <s-heading>Welcome back</s-heading>
              <s-text color="subdued">
                We keep your JILL details together so returning feels easy.
              </s-text>
            </s-stack>
            <s-badge tone={subscribed ? 'info' : 'neutral'}>
              {subscribed ? 'Subscribed ★' : 'JILL account'}
            </s-badge>
          </s-stack>
        </s-section>

        {hasRequest ? (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-stack direction="block" gap="small-100">
                  <s-heading>Your custom request</s-heading>
                  {meta.last_custom_request_id && (
                    <s-text color="subdued">Request {meta.last_custom_request_id}</s-text>
                  )}
                </s-stack>
                <s-badge tone="info">{requestStatus}</s-badge>
              </s-stack>

              <Detail label="Submitted" value={formatDate(meta.last_custom_request_at)} />
              <Detail label="Event" value={formatDate(meta.event_date)} />
              <Detail label="Needed" value={formatDate(meta.date_needed)} />
              <Detail label="Fulfillment" value={meta.fulfillment_preference} />

              <s-stack direction="inline" gap="base">
                <s-button href={`${STORE}/pages/quote`}>Start another request</s-button>
                <s-button href={`${STORE}/pages/contact`}>Ask JILL a question</s-button>
              </s-stack>
            </s-stack>
          </s-section>
        ) : (
          <s-banner tone="info">
            Tell us what you’re dreaming up. After your first custom request, its dates, theme, colors,
            and fulfillment details will live right here.
          </s-banner>
        )}

        {(meta.event_date || meta.next_event_reminder_date) && (
          <s-section>
            <s-stack direction="block" gap="small-400">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-heading>Next celebration ✨</s-heading>
                {meta.annual_reminder_enabled === 'true' && (
                  <s-badge tone="info">Annual reminder on</s-badge>
                )}
              </s-stack>
              <Detail label="Event date" value={formatDate(meta.event_date)} />
              <Detail label="Next reminder" value={formatDate(meta.next_event_reminder_date)} />
              {meta.theme_interest && <s-text color="subdued">Theme: {meta.theme_interest}</s-text>}
            </s-stack>
          </s-section>
        )}

        {hasSavedDetails && (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="block" gap="small-100">
                <s-heading>Saved for you</s-heading>
                <s-text color="subdued">
                  Details from your latest JILL request, ready to make the next one faster.
                </s-text>
              </s-stack>

              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
                <SavedDetail label="Theme" value={meta.theme_interest} />
                <SavedDetail label="Colors" value={meta.color_preferences} />
                <SavedDetail label="Products" value={meta.product_interests} />
                <SavedDetail label="Collections" value={meta.collection_interests} />
                <SavedDetail label="Fulfillment" value={meta.fulfillment_preference} />
                <SavedDetail label="Preferred contact" value={meta.preferred_contact} />
                <SavedDetail label="Location" value={location} />
              </s-grid>
            </s-stack>
          </s-section>
        )}

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-stack direction="block" gap="small-100">
                <s-heading>Recent orders</s-heading>
                <s-text color="subdued">Your latest purchases, all in one place.</s-text>
              </s-stack>
              <s-link href="shopify:customer-account/orders">View all orders</s-link>
            </s-stack>

            {orders.length ? (
              orders.map((order, index) => (
                <s-stack key={order.id} direction="block" gap="small-400">
                  {index > 0 && <s-divider />}
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-text type="strong">{order.name}</s-text>
                    <s-text type="strong">{formatMoney(order.totalPrice)}</s-text>
                  </s-stack>
                  <s-text color="subdued">{formatDate(order.processedAt)}</s-text>
                  <s-stack direction="inline" gap="small-400">
                    {order.financialStatus && (
                      <s-badge tone="neutral">{cleanStatus(order.financialStatus)}</s-badge>
                    )}
                    {order.fulfillmentStatus && (
                      <s-badge tone="info">{cleanStatus(order.fulfillmentStatus)}</s-badge>
                    )}
                  </s-stack>
                  {order.lineItems?.nodes?.length > 0 && (
                    <s-text color="subdued">
                      {order.lineItems.nodes
                        .map((item) => `${item.title}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`)
                        .join(' · ')}
                    </s-text>
                  )}
                  {order.statusPageUrl && (
                    <s-link href={order.statusPageUrl}>View order</s-link>
                  )}
                </s-stack>
              ))
            ) : (
              <s-stack direction="block" gap="small-400">
                <s-text color="subdued">
                  No account-linked orders yet. When you order while signed in, they’ll appear here.
                </s-text>
                <s-link href={`${STORE}/collections/all`}>Browse JILL</s-link>
              </s-stack>
            )}
          </s-stack>
        </s-section>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>What would you like to do?</s-heading>
              <s-text color="subdued">Jump straight back into JILL.</s-text>
            </s-stack>
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" href={`${STORE}/pages/quote`}>Custom Order</s-button>
              <s-button href={`${STORE}/collections/all`}>Shop</s-button>
              <s-button href={`${STORE}/pages/contact`}>Contact JILL</s-button>
            </s-stack>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
