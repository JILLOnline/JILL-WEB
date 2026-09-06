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
  'city',
  'state',
  'zip',
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
  query JillProfileDashboard {
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
    throw new Error(payload?.errors?.[0]?.message || 'Unable to load JILL profile data');
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
    <s-stack direction="block" gap="small-100">
      <s-text color="subdued">{label}</s-text>
      <s-text type="strong">{value}</s-text>
    </s-stack>
  );
}

function SummaryCard({label, value, helper, badge, tone = 'neutral'}) {
  return (
    <s-section>
      <s-stack direction="block" gap="small-300">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text color="subdued">{label}</s-text>
          {badge && <s-badge tone={tone}>{badge}</s-badge>}
        </s-stack>
        <s-heading>{value}</s-heading>
        {helper && <s-text color="subdued">{helper}</s-text>}
      </s-stack>
    </s-section>
  );
}

export default async function extension() {
  let customer = null;
  try {
    customer = await loadData();
  } catch (error) {
    console.warn('JILL profile dashboard data error', error);
  }

  render(<AccountHome customer={customer} />, document.body);
}

function AccountHome({customer}) {
  const meta = metaMap(customer);
  const firstName = customer?.firstName || customer?.displayName?.split(' ')?.[0] || '';
  const email = customer?.emailAddress?.emailAddress || '';
  const subscribed = customer?.emailAddress?.marketingState === 'SUBSCRIBED';
  const orders = customer?.orders?.nodes || [];
  const latestOrder = orders[0];
  const requestExists = Boolean(
    meta.last_custom_request_at || meta.last_custom_request_id || meta.custom_request_status,
  );
  const requestStatus = meta.custom_request_status || (requestExists ? 'Request received' : 'Ready to create');
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
  const nextCelebration = meta.event_date || meta.next_event_reminder_date;

  return (
    <s-stack direction="block" gap="base">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-stack direction="block" gap="small-200">
              <s-heading>{firstName ? `Hi, ${firstName} ✨` : 'Welcome to My JILL ✨'}</s-heading>
              <s-text color="subdued">
                Your celebration hub — custom requests, saved preferences, reminders, and recent orders in one place.
              </s-text>
            </s-stack>
            <s-stack direction="inline" gap="small-300">
              <s-badge tone="info">My JILL</s-badge>
              <s-badge tone={subscribed ? 'info' : 'neutral'}>
                {subscribed ? 'Subscribed ★' : 'Account active'}
              </s-badge>
            </s-stack>
          </s-stack>

          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
            <SummaryCard
              label="CUSTOM REQUEST"
              value={requestExists ? requestStatus : 'Ready when you are'}
              helper={requestExists && meta.last_custom_request_at ? `Submitted ${formatDate(meta.last_custom_request_at)}` : 'Tell us what you’re dreaming up.'}
              badge={requestExists ? 'Saved' : 'New'}
              tone={requestExists ? 'info' : 'neutral'}
            />
            <SummaryCard
              label="NEXT CELEBRATION"
              value={nextCelebration ? formatDate(nextCelebration) : 'Nothing scheduled yet'}
              helper={meta.theme_interest ? `Theme: ${meta.theme_interest}` : 'Add an event date with your next request.'}
              badge={meta.annual_reminder_enabled === 'true' ? 'Reminder on' : null}
              tone="info"
            />
            <SummaryCard
              label="LATEST ORDER"
              value={latestOrder ? latestOrder.name : 'No orders yet'}
              helper={latestOrder ? `${formatDate(latestOrder.processedAt)} · ${formatMoney(latestOrder.totalPrice)}` : 'Your signed-in orders will show here.'}
              badge={latestOrder?.fulfillmentStatus ? cleanStatus(latestOrder.fulfillmentStatus) : null}
              tone="neutral"
            />
          </s-grid>

          <s-stack direction="inline" gap="base">
            <s-button variant="primary" href={`${STORE}/pages/quote`}>
              Start a Custom Order
            </s-button>
            <s-button href="extension:jill-account-dashboard/">Open My JILL Dashboard</s-button>
            <s-button href={`${STORE}/collections/all`}>Shop JILL</s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="small-100">
            <s-heading>Your JILL shortcuts</s-heading>
            <s-text color="subdued">The stuff you’ll actually come back here for.</s-text>
          </s-stack>

          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="base">
            <s-section>
              <s-stack direction="block" gap="small-300">
                <s-heading>🎨 Custom Orders</s-heading>
                <s-text color="subdued">Start a request, reuse saved details, or check what JILL already knows about your event.</s-text>
                <s-link href={`${STORE}/pages/quote`}>Start a request</s-link>
              </s-stack>
            </s-section>
            <s-section>
              <s-stack direction="block" gap="small-300">
                <s-heading>🎉 Celebration details</s-heading>
                <s-text color="subdued">Keep event dates, themes, colors, and fulfillment preferences together for next time.</s-text>
                <s-link href="extension:jill-account-dashboard/">View saved details</s-link>
              </s-stack>
            </s-section>
            <s-section>
              <s-stack direction="block" gap="small-300">
                <s-heading>📦 Orders</s-heading>
                <s-text color="subdued">Jump to your Shopify order history or open the latest order directly.</s-text>
                <s-link href="shopify:customer-account/orders">View all orders</s-link>
              </s-stack>
            </s-section>
          </s-grid>
        </s-stack>
      </s-section>

      {requestExists && (
        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-stack direction="block" gap="small-100">
                <s-heading>Your latest custom request</s-heading>
                <s-text color="subdued">
                  {meta.last_custom_request_id ? `Request ${meta.last_custom_request_id}` : 'Saved to your JILL account'}
                </s-text>
              </s-stack>
              <s-badge tone="info">{requestStatus}</s-badge>
            </s-stack>

            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="base">
              <Detail label="Submitted" value={formatDate(meta.last_custom_request_at)} />
              <Detail label="Event date" value={formatDate(meta.event_date)} />
              <Detail label="Date needed" value={formatDate(meta.date_needed)} />
              <Detail label="Fulfillment" value={meta.fulfillment_preference} />
            </s-grid>

            <s-stack direction="inline" gap="base">
              <s-button href="extension:jill-account-dashboard/">View full request details</s-button>
              <s-button href={`${STORE}/pages/quote`}>Start another request</s-button>
            </s-stack>
          </s-stack>
        </s-section>
      )}

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-stack direction="block" gap="small-100">
              <s-heading>Saved for your next celebration</s-heading>
              <s-text color="subdued">We’ll reuse these details so you don’t have to start from zero every time.</s-text>
            </s-stack>
            {hasSavedDetails && <s-badge tone="info">Saved</s-badge>}
          </s-stack>

          {hasSavedDetails ? (
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="base">
              <Detail label="Theme" value={meta.theme_interest} />
              <Detail label="Colors" value={meta.color_preferences} />
              <Detail label="Products" value={meta.product_interests} />
              <Detail label="Collections" value={meta.collection_interests} />
              <Detail label="Preferred contact" value={meta.preferred_contact} />
              <Detail label="Fulfillment" value={meta.fulfillment_preference} />
              <Detail label="Location" value={location} />
            </s-grid>
          ) : (
            <s-text color="subdued">
              Nothing saved yet. Once you submit a custom request, your reusable JILL preferences will populate here automatically.
            </s-text>
          )}
        </s-stack>
      </s-section>

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-stack direction="block" gap="small-100">
              <s-heading>Recent orders</s-heading>
              <s-text color="subdued">Your latest purchases without hunting through emails.</s-text>
            </s-stack>
            <s-link href="shopify:customer-account/orders">View all</s-link>
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
                  {order.financialStatus && <s-badge tone="neutral">{cleanStatus(order.financialStatus)}</s-badge>}
                  {order.fulfillmentStatus && <s-badge tone="info">{cleanStatus(order.fulfillmentStatus)}</s-badge>}
                </s-stack>
                {order.lineItems?.nodes?.length > 0 && (
                  <s-text color="subdued">
                    {order.lineItems.nodes
                      .map((item) => `${item.title}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`)
                      .join(' · ')}
                  </s-text>
                )}
                {order.statusPageUrl && <s-link href={order.statusPageUrl}>View order</s-link>}
              </s-stack>
            ))
          ) : (
            <s-stack direction="block" gap="small-400">
              <s-text color="subdued">No signed-in orders yet.</s-text>
              <s-link href={`${STORE}/collections/all`}>Browse JILL</s-link>
            </s-stack>
          )}
        </s-stack>
      </s-section>

      <s-section>
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-heading>Need JILL?</s-heading>
            <s-text color="subdued">Questions, design ideas, order help — we’re one click away.</s-text>
          </s-stack>
          <s-stack direction="inline" gap="base">
            <s-button href={`${STORE}/pages/contact`}>Contact JILL</s-button>
            {email && <s-text color="subdued">Signed in as {email}</s-text>}
          </s-stack>
        </s-stack>
      </s-section>
    </s-stack>
  );
}
