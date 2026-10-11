import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import RewardsCard from './rewards/RewardsCard.jsx';
import {loadData,metaMap} from './rewards/account-transport.mjs';
import {
  REWARD_COUPON_POLICY,
  REWARD_SPEND_CENTS_PER_POINT,
  REWARDS_REFRESH_MS,
  REWARD_STATES,
  buildRewardJourney,
  rewardCouponStatus,
  rewardRequestIsPending,
  rewardRequestIsComplete,
  rewardRequestOutcome,
  rewardWallet,
  discountCartUrl,
  loadCustomerAccountStorefront,
  toRewardInteger,
} from '../../../shared/rewards.mjs';

const COLLECTIONS = [
  ['🎉', 'Piñatas', '/collections/pinatas'],
  ['🎁', 'Party Favors', '/collections/catalog'],
  ['🎨', 'Kid Activities', '/collections/kid-activities'],
  ['🎈', 'Party Supplies', '/collections/party-supplies'],
  ['👕', 'Apparel & Gifts', '/collections/apparel-gifts-dtf-sublimation'],
];

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

function formatDollarCents(cents) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Math.max(0, cents) / 100);
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


export default async () => {
  render(<Dashboard />, document.body);
};

function Dashboard() {
  const [storefront, setStorefront] = useState('');
  const [storefrontError, setStorefrontError] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rewardsStale, setRewardsStale] = useState(false);

  useEffect(() => {
    let active = true;

    const refreshCustomer = (initial = false) => {
      loadData()
        .then((data) => {
          if (!active) return;
          setCustomer(data);
          setLoadError(false);
          setRewardsStale(false);
        })
        .catch((error) => {
          console.warn('JILL dashboard data error', error);
          if (!active) return;
          if (initial) setLoadError(true);
          else setRewardsStale(true);
        })
        .finally(() => {
          if (active && initial) setLoading(false);
        });
    };

    refreshCustomer(true);

    // General account pages have no shopify.shop target API. Resolve the
    // storefront through authenticated Customer Account GraphQL instead.
    loadCustomerAccountStorefront()
      .then((origin) => { if (active) { setStorefront(origin); setStorefrontError(false); } })
      .catch((error) => {
        console.warn('JILL storefront identity lookup failed', error);
        if (active) setStorefrontError(true);
      });

    // Live rewards heartbeat: if an admin deletes/repairs a reward coupon,
    // the open Dashboard self-refreshes instead of waiting for a page reload.
    const refreshTimer = setInterval(() => refreshCustomer(false), REWARDS_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, []);

  const STORE = storefront;
  const meta = metaMap(customer);
  const firstName = customer?.firstName || customer?.displayName?.split(' ')?.[0] || '';
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
      heading={firstName ? `Welcome back, ${firstName} ✨` : 'Welcome to JILL ✨'}
      subheading="Your celebrations, custom requests, saved details, and orders in one place."
    >
      {STORE && <s-button slot="primary-action" variant="primary" href={STORE}>Back to JILL</s-button>}

      <s-stack direction="block" gap="base">
        {loadError && (
          <s-banner tone="info">
            Some saved account details could not load right now. Your account pages still work normally.
          </s-banner>
        )}

        {storefrontError && (
          <s-banner tone="critical">Storefront links are unavailable. Rewards remain safe; refresh to restore checkout links.</s-banner>
        )}
        <RewardsCard customer={customer} meta={meta} loading={loading} stale={rewardsStale} onCustomerUpdate={setCustomer} store={STORE} />

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Shop JILL</s-heading>
              <s-text color="subdued">Jump straight into your favorite collections.</s-text>
            </s-stack>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="small-400">
              {STORE && COLLECTIONS.map(([emoji, label, path]) => (
                <s-button key={path} href={`${STORE}${path}`}>{emoji} {label}</s-button>
              ))}
            </s-grid>
          </s-stack>
        </s-section>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-stack direction="block" gap="small-100">
                <s-heading>Recent orders</s-heading>
                <s-text color="subdued">Your latest purchases and current status.</s-text>
              </s-stack>
              {orders.length > 0 && <s-link href="shopify:customer-account/orders">View all orders</s-link>}
            </s-stack>

            {loading ? (
              <s-text color="subdued">Loading recent orders…</s-text>
            ) : orders.length ? (
              orders.map((order, index) => (
                <s-stack key={order.id} direction="block" gap="small-400">
                  {index > 0 && <s-divider />}
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-text type="strong">{order.name}</s-text>
                    <s-text type="strong">{formatMoney(order.totalPrice)}</s-text>
                  </s-stack>
                  <s-text color="subdued">{formatDate(order.processedAt)}</s-text>
                  <s-stack direction="inline" gap="small-400">
                    {order.financialStatus && <s-badge>{cleanStatus(order.financialStatus)}</s-badge>}
                    {order.fulfillmentStatus && <s-badge>{cleanStatus(order.fulfillmentStatus)}</s-badge>}
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
              <s-text color="subdued">
                No account-linked orders yet. Orders placed while signed in will appear here automatically.
              </s-text>
            )}
          </s-stack>
        </s-section>

        {loading ? (
          <s-section><s-text color="subdued">Loading your saved JILL details…</s-text></s-section>
        ) : hasRequest ? (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-stack direction="block" gap="small-100">
                  <s-heading>Your custom request</s-heading>
                  {meta.last_custom_request_id && (
                    <s-text color="subdued">Request {meta.last_custom_request_id}</s-text>
                  )}
                </s-stack>
                <s-badge>{requestStatus}</s-badge>
              </s-stack>
              <Detail label="Submitted" value={formatDate(meta.last_custom_request_at)} />
              <Detail label="Event" value={formatDate(meta.event_date)} />
              <Detail label="Needed" value={formatDate(meta.date_needed)} />
              <Detail label="Fulfillment" value={meta.fulfillment_preference} />
              <s-button variant="primary" href={`${STORE}/pages/quote`}>Start another request</s-button>
            </s-stack>
          </s-section>
        ) : (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="block" gap="small-100">
                <s-heading>Your custom creations</s-heading>
                <s-text color="subdued">
                  Send a custom request and its event date, theme, colors, fulfillment details, and status can live here for your next visit.
                </s-text>
              </s-stack>
              <s-button variant="primary" href={`${STORE}/pages/quote`}>Start a Custom Order</s-button>
            </s-stack>
          </s-section>
        )}

        {(meta.event_date || meta.next_event_reminder_date) && (
          <s-section>
            <s-stack direction="block" gap="small-400">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-heading>Next celebration ✨</s-heading>
                {meta.annual_reminder_enabled === 'true' && <s-badge>Reminder on</s-badge>}
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
                <s-text color="subdued">Details from your latest JILL request, ready for next time.</s-text>
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
      </s-stack>
    </s-page>
  );
}