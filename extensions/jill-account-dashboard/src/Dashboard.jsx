import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';
import {
  REWARD_STATES,
  buildRewardJourney,
  rewardCouponStatus,
  rewardRequestIsPending,
  rewardRequestIsComplete,
  rewardWallet,
  toRewardInteger,
} from './rewards.mjs';

const API = 'shopify://customer-account/api/2026-07/graphql.json';
const STORE = 'https://jillonlinestore.com';
const REWARDS_REFRESH_MS = 25000;

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
  'redeem_request_points',
  'redeem_request_nonce',
  'coupons',
];

const IDENTIFIERS = [
  ...JILL_KEYS.map((key) => `{namespace:\"jill\",key:\"${key}\"}`),
  ...REWARD_KEYS.map((key) => `{namespace:\"jill_rewards\",key:\"${key}\"}`),
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
            nodes { id title quantity }
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
      metafields { namespace key value }
      userErrors { field message code }
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

async function loadData() {
  const response = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query: QUERY}),
  });
  const payload = await response.json();
  if (!response.ok || payload?.errors?.length || !payload?.data?.customer) {
    throw new Error(payload?.errors?.[0]?.message || 'Unable to load JILL dashboard data');
  }
  return payload?.data?.customer || null;
}

function createRewardNonce() {
  return `jill:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
}

async function requestReward(customerId, points) {
  const nonce = createRewardNonce();
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
          {
            ownerId: customerId,
            namespace: 'jill_rewards',
            key: 'redeem_request_nonce',
            type: 'single_line_text_field',
            value: nonce,
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
  const written = payload?.data?.metafieldsSet?.metafields;
  if (!Array.isArray(written) || ![
    ['redeem_request_points', String(points)],
    ['redeem_request_nonce', nonce],
  ].every(([key, value]) => written.some((field) =>
    field?.namespace === 'jill_rewards' && field.key === key && field.value === value,
  ))) {
    throw new Error('Shopify did not confirm your reward request. Refresh your rewards before trying again.');
  }
  return nonce;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
  const redemptionInFlight = useRef(false);
  const [submittingPoints, setSubmittingPoints] = useState(0);
  const [localPendingPoints, setLocalPendingPoints] = useState(0);
  const [redeemError, setRedeemError] = useState('');
  const [showAllRewards, setShowAllRewards] = useState(false);
  const [slowRequest, setSlowRequest] = useState(false);
  const [confirmTier, setConfirmTier] = useState(null);
  const [freshCoupon, setFreshCoupon] = useState(null);

  const points = toRewardInteger(meta.points_balance);
  const wallet = rewardWallet(meta.coupons);
  const persistedPending = rewardRequestIsPending(meta);
  const requestedPoints = persistedPending ? toRewardInteger(meta.redeem_request_points) : 0;
  const pendingPoints = requestedPoints || localPendingPoints || submittingPoints;
  const isGeneratingReward = Boolean(pendingPoints) && !redeemError;
  const journey = buildRewardJourney(points, wallet, {pendingPoints, confirmingPoints: confirmTier?.points});
  const activeCoupons = journey.activeCoupons;
  const availableTiers = journey.redeemable.map((item) => item.tier);
  const collapsedTier = journey.collapsed.tier;
  const visibleRewardItems = showAllRewards ? journey.expanded : [journey.collapsed];

  function activeCouponForTier(tierPoints) {
    return journey.couponForTier(tierPoints);
  }

  async function handleRedeem(tier) {
    if (redemptionInFlight.current) return;
    if (!customer?.id || pendingPoints || points < tier.points || activeCouponForTier(tier.points)) {
      setConfirmTier(null);
      setRedeemError(!customer?.id
        ? 'Your account could not be loaded. Refresh the page before redeeming.'
        : pendingPoints
          ? 'A reward request is already being processed. Please wait for it to finish.'
          : 'Your rewards have changed. Review your balance and coupon wallet before redeeming.');
      return;
    }
    redemptionInFlight.current = true;

    setConfirmTier(null);
    setFreshCoupon(null);
    setRedeemError('');
    setSlowRequest(false);
    setSubmittingPoints(tier.points);
    setLocalPendingPoints(tier.points);

    try {
      const requestNonce = await requestReward(customer.id, tier.points);
      let completed = false;

      for (let attempt = 0; attempt < 42; attempt += 1) {
        await wait(attempt === 0 ? 900 : 1500);
        if (attempt === 8) setSlowRequest(true);

        const nextCustomer = await loadData();
        if (nextCustomer) onCustomerUpdate(nextCustomer);

        const nextMeta = metaMap(nextCustomer);
        const nextWallet = rewardWallet(nextMeta.coupons);
        const createdCoupon = nextWallet.find(
          (coupon) =>
            coupon?.request_nonce === requestNonce && rewardCouponStatus(coupon) === 'active',
        );

        if (createdCoupon) {
          setFreshCoupon(createdCoupon);
          setLocalPendingPoints(0);
          setSlowRequest(false);
          completed = true;
          break;
        }

        if (rewardRequestIsComplete(nextMeta, requestNonce)) {
          setLocalPendingPoints(0);
          setSlowRequest(false);
          completed = true;

          if (!nextWallet.some((coupon) => coupon?.request_nonce === requestNonce)) {
            setRedeemError(
              'This request finished without a coupon in your wallet. Refresh your rewards before trying again.',
            );
          }
          break;
        }
      }

      if (!completed) {
        setLocalPendingPoints(0);
        setSlowRequest(false);
        setRedeemError(
          'Your request is still awaiting confirmation. Rewards refresh automatically; check your coupon wallet before trying again.',
        );
      }
    } catch (error) {
      console.warn('JILL reward request error', error);
      setLocalPendingPoints(0);
      setSlowRequest(false);
      setRedeemError(error?.message || 'Unable to request your reward right now.');
    } finally {
      redemptionInFlight.current = false;
      setSubmittingPoints(0);
    }
  }

  function rewardStatusControl(tier, coupon, isAvailable, isNext, isThisPending) {
    if (isThisPending) {
      return (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-spinner size="small" />
          <s-text tone="info">
            {slowRequest ? 'Still creating…' : 'Creating…'}
          </s-text>
        </s-stack>
      );
    }

    if (coupon) {
      return (
        <s-clickable
          href="extension:jill-account-coupons/"
          background="subdued"
          padding="small-200"
          borderRadius="max"
          accessibilityLabel={`Use your $${tier.value} OFF coupon`}
        >
          <s-text tone="info">Use Coupon</s-text>
        </s-clickable>
      );
    }

    if (isAvailable) {
      return (
        <s-clickable
          disabled={Boolean(pendingPoints)}
          background="subdued"
          padding="small-200"
          borderRadius="max"
          accessibilityLabel={`Redeem ${tier.points} points for $${tier.value} OFF`}
          onClick={() => {
            setRedeemError('');
            setConfirmTier(tier);
          }}
        >
          <s-text tone="success">Redeem</s-text>
        </s-clickable>
      );
    }

    if (isNext) {
      return (
        <s-box background="subdued" padding="small-200" borderRadius="max">
          <s-link onClick={() => setShowAllRewards((current) => !current)}>Next Reward ★</s-link>
        </s-box>
      );
    }

    return (
      <s-box background="subdued" padding="small-200" borderRadius="max">
        <s-text type="strong" tone="neutral">Locked</s-text>
      </s-box>
    );
  }

  function rewardMilestone(item, showTopRail = false, showBottomRail = false) {
    const tier = item.tier;
    const coupon = item.coupon;
    const isRedeemed = item.state === REWARD_STATES.USE_COUPON;
    const isAvailable = item.state === REWARD_STATES.REDEEM;
    const isNext = item.state === REWARD_STATES.NEXT_REWARD;
    const isThisPending = isGeneratingReward && pendingPoints === tier.points;
    const isThisConfirming = confirmTier?.points === tier.points && !pendingPoints;
    const tierProgress = isRedeemed ? tier.points : Math.max(0, Math.min(points, tier.points));
    const progressValue = tierProgress === 0 ? 0.001 : tierProgress;
    const pointsRemaining = Math.max(0, tier.points - points);
    const isAchieved = isRedeemed || isAvailable;

    return (
      <s-grid
        key={`journey-${tier.points}`}
        gridTemplateColumns="32px minmax(0, 1fr)"
        gap="small-300"
        blockAlignment="stretch"
      >
        <s-grid
          gridTemplateRows="1fr auto 1fr"
          blockSize="100%"
          justifyItems="center"
          alignItems="stretch"
        >
          {showTopRail ? (
            <s-stack direction="inline" justifyContent="center">
              <s-box inlineSize={1} blockSize="100%" border="large base solid" />
            </s-stack>
          ) : <s-box />}

          <s-stack direction="inline" justifyContent="center" alignItems="center">
            <s-icon
              type={isAchieved ? 'check-circle-filled' : 'circle'}
              tone={isAchieved ? 'success' : isNext ? 'info' : 'neutral'}
              size="small-200"
            />
          </s-stack>

          {showBottomRail ? (
            <s-stack direction="inline" justifyContent="center">
              <s-box inlineSize={1} blockSize="100%" border="large base solid" />
            </s-stack>
          ) : <s-box />}
        </s-grid>

        <s-box
          padding="base"
          background={isAchieved || isNext ? 'base' : 'subdued'}
          borderRadius="large"
          border="base base solid"
        >
          <s-stack direction="block" gap="small-300">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading>${tier.value} OFF</s-heading>
                <s-text color="subdued">${tier.minimum} minimum order</s-text>
              </s-stack>
              {rewardStatusControl(tier, coupon, isAvailable, isNext, isThisPending)}
            </s-stack>

            <s-stack direction="block" gap="small-200">
              <s-progress
                value={progressValue}
                max={tier.points}
                accessibilityLabel={`${tierProgress} of ${tier.points} points toward $${tier.value} OFF`}
              />
              {!isRedeemed && (
                <s-text type="strong">
                  {tierProgress} / {tier.points} pts
                  {isThisPending
                    ? ' · Creating coupon…'
                    : isNext
                      ? ` · ${pointsRemaining} ${pointsRemaining === 1 ? 'pt' : 'pts'} left`
                      : ''}
                </s-text>
              )}
              {isThisPending && (
                <s-text color="subdued">
                  {slowRequest
                    ? 'Shopify is taking a little longer than usual. Your points stay safe while we finish.'
                    : 'Your request is being processed. This can take a minute or longer.'}
                </s-text>
              )}
            </s-stack>

            {isThisConfirming && (
              <s-box padding="base" background="subdued" borderRadius="large" border="base base solid">
                <s-stack direction="block" gap="small-300">
                  <s-text type="strong">
                    Redeem {tier.points} points for ${tier.value} OFF?
                  </s-text>
                  <s-text color="subdued">
                    ${tier.minimum} minimum order · Expires 30 days after creation · Cannot be combined with other discounts.
                  </s-text>
                  <s-stack direction="inline" gap="small-300">
                    <s-button variant="secondary" onClick={() => setConfirmTier(null)}>
                      Cancel
                    </s-button>
                    <s-clickable
                      background="base"
                      padding="small-200"
                      borderRadius="max"
                      disabled={Boolean(pendingPoints)}
                      accessibilityLabel={`Generate $${tier.value} OFF coupon for ${tier.points} points`}
                      onClick={() => handleRedeem(tier)}
                    >
                      <s-text tone="success" type="strong">Generate coupon</s-text>
                    </s-clickable>
                  </s-stack>
                </s-stack>
              </s-box>
            )}
          </s-stack>
        </s-box>
      </s-grid>
    );
  }

  function rewardConnector() {
    return (
      <s-grid gridTemplateColumns="32px minmax(0, 1fr)" gap="small-300">
        <s-stack direction="inline" justifyContent="center">
          <s-box inlineSize={1} blockSize={26} border="large base solid" />
        </s-stack>
        <s-box blockSize={26} />
      </s-grid>
    );
  }

  const rewardMessage = activeCoupons.length || availableTiers.length
    ? 'Tap Redeem on any unlocked reward. Tap Use Coupon on a ready reward to open your coupon wallet. ✨'
    : 'Keep stacking points — your first reward is getting closer. ✨';

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-heading>Rewards ★</s-heading>
            <s-text color="subdued">Earn 1 point for every $10 of eligible JILL merchandise spend.</s-text>
          </s-stack>
          <s-badge>{loading ? 'Loading…' : `${points} pts`}</s-badge>
        </s-stack>

        {!loading && (
          <s-box padding="base" background="subdued" borderRadius="large" border="base base solid">
            <s-stack direction="block" gap="base">
              <s-text color="subdued">{rewardMessage}</s-text>

              <s-grid
                key={`reward-journey-${showAllRewards ? 'expanded' : collapsedTier.points}-${points}`}
                gridTemplateColumns="1fr"
                gap="none"
              >
                {visibleRewardItems.map((item, index) => (
                  <s-grid key={`reward-group-${item.tier.points}`} gridTemplateColumns="1fr" gap="none">
                    {rewardMilestone(
                      item,
                      showAllRewards && index > 0,
                      showAllRewards && index < visibleRewardItems.length - 1,
                    )}
                    {index < visibleRewardItems.length - 1 && rewardConnector()}
                  </s-grid>
                ))}
              </s-grid>

              <s-stack direction="inline" justifyContent="center">
                <s-button variant="secondary" onClick={() => setShowAllRewards((current) => !current)}>
                  {showAllRewards ? 'Collapse rewards' : 'View all rewards'}
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>
        )}

        {redeemError && <s-banner tone="critical">{redeemError}</s-banner>}

        {!loading && freshCoupon && (
          <s-box padding="base" background="subdued" borderRadius="large" border="base base solid">
            <s-stack direction="block" gap="small-300">
              <s-text type="strong">
                Your ${Number(freshCoupon.value || 0)} OFF reward is ready 🎉
              </s-text>
              <s-text>
                Code: <s-text type="strong">{freshCoupon.code}</s-text>
              </s-text>
              <s-text color="subdued">
                Expires {formatDate(freshCoupon.expires_at)} · Cannot be combined with other discounts.
              </s-text>
              <s-stack direction="inline" gap="small-300">
                <s-button variant="secondary" href="extension:jill-account-coupons/">
                  View coupon
                </s-button>
                <s-button
                  variant="primary"
                  href={`${STORE}/discount/${encodeURIComponent(freshCoupon.code)}?redirect=/cart`}
                >
                  Use now
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>
        )}

        <s-divider />
        <s-stack direction="inline" justifyContent="center">
          <s-button variant="secondary" href="extension:jill-account-coupons/">
            My Coupons
          </s-button>
        </s-stack>
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

    const refreshCustomer = (initial = false) => {
      loadData()
        .then((data) => {
          if (!active) return;
          setCustomer(data);
          setLoadError(false);
        })
        .catch((error) => {
          console.warn('JILL dashboard data error', error);
          if (active && initial) setLoadError(true);
        })
        .finally(() => {
          if (active && initial) setLoading(false);
        });
    };

    refreshCustomer(true);

    // Live rewards heartbeat: if an admin deletes/repairs a reward coupon,
    // the open Dashboard self-refreshes instead of waiting for a page reload.
    const refreshTimer = setInterval(() => refreshCustomer(false), REWARDS_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(refreshTimer);
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
      <s-button slot="primary-action" variant="primary" href={STORE}>Back to JILL</s-button>

      <s-stack direction="block" gap="base">
        {loadError && (
          <s-banner tone="info">
            Some saved account details could not load right now. Your account pages still work normally.
          </s-banner>
        )}

        <RewardsCard customer={customer} meta={meta} loading={loading} onCustomerUpdate={setCustomer} />

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Shop JILL</s-heading>
              <s-text color="subdued">Jump straight into your favorite collections.</s-text>
            </s-stack>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="small-400">
              {COLLECTIONS.map(([emoji, label, path]) => (
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
