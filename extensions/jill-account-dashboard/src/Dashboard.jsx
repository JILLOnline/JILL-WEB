import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

const API = 'shopify://customer-account/api/2026-07/graphql.json';
const STORE = 'https://jillonlinestore.com';

const JILL_KEYS = [
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
];

const REWARD_KEYS = [
  'points_balance',
  'eligible_spend_cents',
  'points_earned_lifetime',
  'points_redeemed_lifetime',
  'active_coupon_code',
  'active_coupon_value_cents',
  'active_coupon_points',
  'redeem_request_points',
];

const IDENTIFIERS = [
  ...JILL_KEYS.map((key) => `{namespace:"jill",key:"${key}"}`),
  ...REWARD_KEYS.map((key) => `{namespace:"jill_rewards",key:"${key}"}`),
].join(',');

const QUERY = `
  query JillDashboard {
    customer {
      id
      displayName
      firstName
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

const REQUEST_REWARD_MUTATION = `
  mutation RequestJillReward($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const COLLECTIONS = [
  ['🎉', 'Piñatas', '/collections/pinatas'],
  ['🎁', 'Party Favors', '/collections/catalog'],
  ['🎨', 'Kid Activities', '/collections/kid-activities'],
  ['🎈', 'Party Supplies', '/collections/party-supplies'],
  ['👕', 'Apparel & Gifts', '/collections/apparel-gifts-dtf-sublimation'],
];

const REWARD_TIERS = [
  {points: 10, value: 5, minimum: 25},
  {points: 20, value: 12, minimum: 50},
  {points: 35, value: 25, minimum: 100},
  {points: 50, value: 40, minimum: 150},
];

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

async function requestReward(customerId, points) {
  const response = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      query: REQUEST_REWARD_MUTATION,
      variables: {
        metafields: [
          {
            ownerId: customerId,
            namespace: 'jill_rewards',
            key: 'redeem_request_points',
            type: 'number_integer',
            value: String(points),
          },
        ],
      },
    }),
  });

  const payload = await response.json();
  const userErrors = payload?.data?.metafieldsSet?.userErrors || [];

  if (!response.ok || payload?.errors?.length || userErrors.length) {
    throw new Error(
      userErrors?.[0]?.message ||
        payload?.errors?.[0]?.message ||
        'Unable to request your JILL reward right now.',
    );
  }

  return payload?.data?.metafieldsSet?.metafields || [];
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function metaMap(customer) {
  return Object.fromEntries(
    (customer?.metafields || []).filter(Boolean).map((item) => [item.key, item.value]),
  );
}

function toInteger(value) {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
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

function RewardsCard({customer, meta, loading, onCustomerUpdate}) {
  const [submittingPoints, setSubmittingPoints] = useState(0);
  const [localPendingPoints, setLocalPendingPoints] = useState(0);
  const [redeemError, setRedeemError] = useState('');

  const points = toInteger(meta.points_balance);
  const eligibleSpendCents = toInteger(meta.eligible_spend_cents);
  const activeCouponCode = String(meta.active_coupon_code || '').trim();
  const activeCouponValueCents = toInteger(meta.active_coupon_value_cents);
  const requestedPoints = toInteger(meta.redeem_request_points);
  const pendingPoints = requestedPoints || localPendingPoints || submittingPoints;

  const unlocked = [...REWARD_TIERS].reverse().find((tier) => points >= tier.points) || null;
  const unlockedTiers = REWARD_TIERS.filter((tier) => points >= tier.points);
  const nextTier = REWARD_TIERS.find((tier) => points < tier.points) || null;
  const nextPointSpendCents = 1000 - (eligibleSpendCents % 1000 || 0);
  const pointsToNext = nextTier ? Math.max(0, nextTier.points - points) : 0;
  const progressTier = nextTier || REWARD_TIERS[REWARD_TIERS.length - 1];
  const progressValue = nextTier ? Math.min(points, progressTier.points) : progressTier.points;
  const progressLabel = nextTier
    ? `${points} of ${progressTier.points} points toward $${progressTier.value} OFF`
    : 'All JILL Rewards tiers unlocked';

  async function handleRedeem(tier) {
    if (!customer?.id || pendingPoints || activeCouponCode) return;

    setRedeemError('');
    setSubmittingPoints(tier.points);
    setLocalPendingPoints(tier.points);

    try {
      await requestReward(customer.id, tier.points);

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await wait(attempt === 0 ? 900 : 1600);
        const nextCustomer = await loadData();
        if (nextCustomer) onCustomerUpdate(nextCustomer);

        const nextMeta = metaMap(nextCustomer);
        if (String(nextMeta.active_coupon_code || '').trim()) {
          setLocalPendingPoints(0);
          break;
        }

        if (attempt > 0 && toInteger(nextMeta.redeem_request_points) === 0) {
          setLocalPendingPoints(0);
          break;
        }
      }
    } catch (error) {
      console.warn('JILL reward request error', error);
      setLocalPendingPoints(0);
      setRedeemError(error?.message || 'Unable to request your reward right now.');
    } finally {
      setSubmittingPoints(0);
    }
  }

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-heading>JILL Rewards ★</s-heading>
            <s-text color="subdued">Earn 1 point for every $10 of eligible JILL merchandise spend.</s-text>
          </s-stack>
          <s-badge tone="info">{loading ? 'Loading…' : `${points} pts`}</s-badge>
        </s-stack>

        {!loading && (
          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">
                {nextTier ? `Progress to $${nextTier.value} OFF` : 'Top reward unlocked 🎉'}
              </s-text>
              <s-text color="subdued">
                {nextTier ? `${points} / ${nextTier.points} pts` : `${points} pts`}
              </s-text>
            </s-stack>
            <s-progress
              value={progressValue}
              max={progressTier.points}
              accessibilityLabel={progressLabel}
            />
          </s-stack>
        )}

        {redeemError && (
          <s-banner tone="critical">
            {redeemError}
          </s-banner>
        )}

        {!loading && activeCouponCode ? (
          <s-stack direction="block" gap="small-400">
            <s-text type="strong">
              Your {formatDollarCents(activeCouponValueCents)} reward is ready 🎉
            </s-text>
            <s-text>
              Code: <s-text type="strong">{activeCouponCode}</s-text>
            </s-text>
            <s-text color="subdued">
              This coupon is unique to your account, can be used once, and does not combine with other discounts.
            </s-text>
            <s-button
              variant="primary"
              href={`${STORE}/discount/${encodeURIComponent(activeCouponCode)}?redirect=/`}
            >
              Use my reward
            </s-button>
          </s-stack>
        ) : !loading && pendingPoints ? (
          <s-stack direction="block" gap="small-400">
            <s-text type="strong">Creating your unique reward… ✨</s-text>
            <s-text color="subdued">
              Your {pendingPoints}-point redemption request was received. JILL is creating your coupon now.
            </s-text>
          </s-stack>
        ) : !loading && unlocked ? (
          <s-stack direction="block" gap="small-400">
            <s-text type="strong">You have rewards ready to redeem 🎉</s-text>
            <s-text color="subdued">
              Choose any reward you can afford. Redeeming converts those points into one unique JILL coupon.
            </s-text>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="small-400">
              {unlockedTiers.map((tier) => (
                <s-button
                  key={tier.points}
                  variant={tier.points === unlocked.points ? 'primary' : 'secondary'}
                  disabled={Boolean(pendingPoints)}
                  onClick={() => handleRedeem(tier)}
                >
                  Redeem ${tier.value} OFF · {tier.points} pts
                </s-button>
              ))}
            </s-grid>
          </s-stack>
        ) : !loading && nextTier ? (
          <s-stack direction="block" gap="small-400">
            <s-text type="strong">
              {pointsToNext} {pointsToNext === 1 ? 'point' : 'points'} until ${nextTier.value} OFF
            </s-text>
            <s-text color="subdued">
              {eligibleSpendCents > 0
                ? `${formatDollarCents(nextPointSpendCents)} more eligible spend earns your next point.`
                : 'Your points begin building with eligible paid orders.'}
            </s-text>
          </s-stack>
        ) : null}

        <s-divider />

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(120px, 1fr))" gap="small-400">
          {REWARD_TIERS.map((tier) => (
            <s-stack key={tier.points} direction="block" gap="small-100">
              <s-text type="strong">${tier.value} OFF</s-text>
              <s-text color="subdued">{tier.points} points · ${tier.minimum} minimum</s-text>
            </s-stack>
          ))}
        </s-grid>
      </s-stack>
    </s-section>
  );
}

export default async () => {
  render(<Dashboard />, document.body);
};

function Dashboard() {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    loadData()
      .then((data) => {
        if (!active) return;
        setCustomer(data);
        setLoadError(false);
      })
      .catch((error) => {
        console.warn('JILL dashboard data error', error);
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
      <s-button slot="primary-action" variant="primary" href={STORE}>
        Back to JILL
      </s-button>

      <s-stack direction="block" gap="base">
        {loadError && (
          <s-banner tone="info">
            Some saved account details could not load right now. Your account pages still work normally.
          </s-banner>
        )}

        <RewardsCard
          customer={customer}
          meta={meta}
          loading={loading}
          onCustomerUpdate={setCustomer}
        />

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Shop JILL</s-heading>
              <s-text color="subdued">Jump straight into your favorite collections.</s-text>
            </s-stack>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="small-400">
              {COLLECTIONS.map(([emoji, label, path]) => (
                <s-button key={path} href={`${STORE}${path}`}>
                  {emoji} {label}
                </s-button>
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
          <s-section>
            <s-text color="subdued">Loading your saved JILL details…</s-text>
          </s-section>
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
                <s-badge tone="info">{requestStatus}</s-badge>
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
                {meta.annual_reminder_enabled === 'true' && <s-badge tone="info">Reminder on</s-badge>}
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