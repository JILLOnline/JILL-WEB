import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';
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

const API = 'shopify://customer-account/api/2026-07/graphql.json';
// Shopify's Customer Account metafield-write route, distinct from the read protocol.
const WRITE_API = 'shopify:customer-account/api/2026-07/graphql.json';

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
        compareDigest
      }
    }
  }
`;

const REQUEST_REWARD_MUTATION = `
  mutation RequestJillReward($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { namespace key value compareDigest }
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

function rewardRequestMetafield(customer, key) {
  return (customer?.metafields || []).find(
    (field) => field?.namespace === 'jill_rewards' && field.key === key,
  ) || null;
}

function rewardRequestError(payload, fallback) {
  const userError = payload?.data?.metafieldsSet?.userErrors?.[0];
  const graphQLError = payload?.errors?.[0];
  const error = userError || graphQLError;
  const code = error?.code || error?.extensions?.code || '';
  const message = error?.message || fallback;
  return new Error(code ? `${message} (${code})` : message);
}

function rewardRequestHasDigestConflict(payload) {
  const errors = [
    ...(payload?.data?.metafieldsSet?.userErrors || []),
    ...(payload?.errors || []),
  ];
  return errors.some((error) =>
    /compare.?digest|digest.*match|stale/i.test(
      `${error?.code || error?.extensions?.code || ''} ${error?.message || ''}`,
    ),
  );
}

async function writeRewardRequest(customer, points, nonce) {
  const pointsField = rewardRequestMetafield(customer, 'redeem_request_points');
  const nonceField = rewardRequestMetafield(customer, 'redeem_request_nonce');

  if (!customer?.id || !pointsField?.compareDigest || !nonceField?.compareDigest) {
    throw new Error('Your reward request state could not be verified. Refresh the page and try again.');
  }

  const response = await fetch(WRITE_API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      query: REQUEST_REWARD_MUTATION,
      variables: {
        metafields: [
          {
            ownerId: customer.id,
            namespace: 'jill_rewards',
            key: 'redeem_request_points',
            value: String(points),
            compareDigest: pointsField.compareDigest,
          },
          {
            ownerId: customer.id,
            namespace: 'jill_rewards',
            key: 'redeem_request_nonce',
            value: nonce,
            compareDigest: nonceField.compareDigest,
          },
        ],
      },
    }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Shopify returned an invalid response while creating your reward.');
  }

  const userErrors = payload?.data?.metafieldsSet?.userErrors || [];
  if (!response.ok || payload?.errors?.length || userErrors.length) {
    return {ok: false, payload};
  }

  const written = payload?.data?.metafieldsSet?.metafields;
  const acknowledged = Array.isArray(written) && [
    ['redeem_request_points', String(points)],
    ['redeem_request_nonce', nonce],
  ].every(([key, value]) => written.some((field) =>
    field?.namespace === 'jill_rewards' && field.key === key && field.value === value,
  ));

  if (!acknowledged) {
    throw new Error('Shopify did not confirm your reward request. Refresh your rewards before trying again.');
  }

  return {ok: true};
}

async function requestReward(customerId, points) {
  const nonce = createRewardNonce();
  let customer = await loadData();

  if (!customer?.id || customer.id !== customerId) {
    throw new Error('Your signed-in account changed. Refresh the page before redeeming.');
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await writeRewardRequest(customer, points, nonce);
    if (result.ok) return nonce;

    if (attempt === 0 && rewardRequestHasDigestConflict(result.payload)) {
      customer = await loadData();
      if (!customer?.id || customer.id !== customerId) {
        throw new Error('Your signed-in account changed. Refresh the page before redeeming.');
      }
      continue;
    }

    throw rewardRequestError(
      result.payload,
      'Unable to request your JILL reward right now.',
    );
  }

  throw new Error('Unable to request your JILL reward right now.');
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

function RewardsCard({customer, meta, loading, stale, onCustomerUpdate, store}) {
  const STORE = store;
  const redemptionInFlight = useRef(false);
  const rewardModalRefs = useRef({});
  const [submittingPoints, setSubmittingPoints] = useState(0);
  const [localPendingPoints, setLocalPendingPoints] = useState(0);
  const [redeemError, setRedeemError] = useState('');
  const [showAllRewards, setShowAllRewards] = useState(false);
  const [redemptionStage, setRedemptionStage] = useState(null);
  const [freshCoupon, setFreshCoupon] = useState(null);
  const [lastRequest, setLastRequest] = useState(null);

  const points = toRewardInteger(meta.points_balance);
  const wallet = rewardWallet(meta.coupons);
  const persistedPending = rewardRequestIsPending(meta);
  const requestedPoints = persistedPending ? toRewardInteger(meta.redeem_request_points) : 0;
  const pendingPoints = requestedPoints || localPendingPoints || submittingPoints;
  const isGeneratingReward = Boolean(pendingPoints);
  const journey = buildRewardJourney(points, wallet, {pendingPoints});
  const activeCoupons = journey.activeCoupons;
  const availableTiers = journey.redeemable.map((item) => item.tier);
  // Keep the just-created coupon on screen: the balance change otherwise
  // selects the next locked tier and hides the promised Use Now action.
  const featuredPoints = redemptionStage?.points ||
    (freshCoupon && rewardCouponStatus(freshCoupon) === 'active' ? freshCoupon.points : 0);
  const featuredReward = journey.items.find((item) => item.tier.points === Number(featuredPoints));
  const collapsedReward = featuredReward || journey.collapsed;
  const collapsedTier = collapsedReward.tier;
  const visibleRewardItems = showAllRewards ? journey.expanded : [collapsedReward];

  useEffect(() => {
    if (!lastRequest?.nonce) return;

    const outcome = rewardRequestOutcome(meta, lastRequest.nonce);

    if (outcome.status === 'coupon') {
      setFreshCoupon(outcome.couponStatus === 'active' ? outcome.coupon : null);
      setRedeemError('');
      setLocalPendingPoints(0);
      setSubmittingPoints(0);
      setRedemptionStage(null);
      setLastRequest(null);
      return;
    }

    if (outcome.status === 'complete_without_coupon') {
      setLocalPendingPoints(0);
      setSubmittingPoints(0);
      setRedemptionStage(null);
      setRedeemError(
        'This request finished without a coupon in your wallet. Refresh your rewards before trying again.',
      );
      setLastRequest(null);
    }
  }, [
    meta.coupons,
    meta.redeem_request_nonce,
    meta.redeem_request_points,
    lastRequest,
  ]);

  function activeCouponForTier(tierPoints) {
    return journey.couponForTier(tierPoints);
  }

  async function handleRedeem(tier) {
    if (redemptionInFlight.current) return;
    if (!customer?.id || pendingPoints || points < tier.points || activeCouponForTier(tier.points)) {
      setRedeemError(!customer?.id
        ? 'Your account could not be loaded. Refresh the page before redeeming.'
        : pendingPoints
          ? 'A reward request is already being processed. Please wait for it to finish.'
          : 'Your rewards have changed. Review your balance and coupon wallet before redeeming.');
      return;
    }

    redemptionInFlight.current = true;
    setFreshCoupon(null);
    setLastRequest(null);
    setRedeemError('');
    setSubmittingPoints(tier.points);
    setLocalPendingPoints(tier.points);
    setRedemptionStage({points: tier.points, status: 'generating'});

    try {
      const requestNonce = await requestReward(customer.id, tier.points);
      setLastRequest({nonce: requestNonce, points: tier.points});
      setRedemptionStage({points: tier.points, status: 'setting_up'});
      let completed = false;

      for (let attempt = 0; attempt < 42; attempt += 1) {
        await wait(attempt === 0 ? 900 : 1500);

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
          setRedeemError('');
          setLocalPendingPoints(0);
          setLastRequest(null);
          setRedemptionStage({points: tier.points, status: 'redeemed'});
          completed = true;
          await wait(900);
          setRedemptionStage(null);
          break;
        }

        if (rewardRequestIsComplete(nextMeta, requestNonce)) {
          setLocalPendingPoints(0);
          completed = true;

          const completedCoupon = nextWallet.find(
            (coupon) =>
              coupon?.request_nonce === requestNonce && rewardCouponStatus(coupon) === 'active',
          );

          if (completedCoupon) {
            setFreshCoupon(completedCoupon);
            setRedeemError('');
            setRedemptionStage({points: tier.points, status: 'redeemed'});
            await wait(900);
            setRedemptionStage(null);
          } else if (!nextWallet.some((coupon) => coupon?.request_nonce === requestNonce)) {
            setRedemptionStage(null);
            setRedeemError(
              'This request finished without a coupon in your wallet. Refresh your rewards before trying again.',
            );
          } else {
            setRedemptionStage(null);
            setRedeemError('');
          }

          setLastRequest(null);
          break;
        }
      }

      if (!completed) {
        setLocalPendingPoints(0);
        setRedemptionStage(null);
        setRedeemError(
          'Your request is still awaiting confirmation. Rewards refresh automatically; check your coupon wallet before trying again.',
        );
      }
    } catch (error) {
      console.warn('JILL reward request error', error);
      setLocalPendingPoints(0);
      setRedemptionStage(null);
      setRedeemError(error?.message || 'Unable to request your reward right now.');
    } finally {
      redemptionInFlight.current = false;
      setSubmittingPoints(0);
    }
  }
  function rewardStatusControl(tier, coupon, isAvailable, isNext, isThisPending) {
    const stage =
      redemptionStage?.points === tier.points ? redemptionStage.status : null;

    if (stage === 'redeemed') {
      return (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type="check-circle-filled" tone="success" />
          <s-text tone="success">Code redeemed</s-text>
        </s-stack>
      );
    }

    // A confirmed wallet coupon takes precedence over a stale spinner.
    if (coupon) {
      return (
        <s-button
          variant="primary"
          href={STORE ? discountCartUrl(STORE, coupon.code) : undefined}
          disabled={!STORE}
          accessibilityLabel={`Use your $${tier.value} OFF coupon now`}
        >
          Use Now
        </s-button>
      );
    }

    if (stage || isThisPending) {
      const stageLabel = stage === 'setting_up' ? 'Setting up code' : 'Generating coupon';
      return (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-spinner size="small" />
          <s-text tone="info">{stageLabel}</s-text>
        </s-stack>
      );
    }

    if (isAvailable) {
      const modalId = `jill-reward-confirm-${tier.points}`;

      return (
        <>
          <s-button
            variant="primary"
            command="--show"
            commandFor={modalId}
            disabled={Boolean(pendingPoints)}
          >
            Redeem
          </s-button>

          <s-modal
            id={modalId}
            heading={`Redeem $${tier.value} OFF`}
            ref={(element) => {
              if (element) rewardModalRefs.current[tier.points] = element;
              else delete rewardModalRefs.current[tier.points];
            }}
          >
            <s-stack direction="block" gap="small-300">
              <s-text type="strong">Spend {tier.points} points for $${tier.value} OFF?</s-text>
              <s-text>Your coupon expires {REWARD_COUPON_POLICY.expirationDays} days after redemption.</s-text>
              <s-text color="subdued">
                $${tier.minimum} minimum order · One use per customer · Cannot be combined with other discounts.
              </s-text>
            </s-stack>
            <s-button
              slot="secondary-actions"
              variant="secondary"
              command="--hide"
              commandFor={modalId}
            >
              Keep my points
            </s-button>
            <s-button
              slot="primary-action"
              variant="primary"
              onClick={() => {
                rewardModalRefs.current[tier.points]?.hideOverlay();
                handleRedeem(tier);
              }}
            >
              Yes, redeem
            </s-button>
          </s-modal>
        </>
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
    const coupon =
      item.coupon ||
      (freshCoupon?.points === tier.points && rewardCouponStatus(freshCoupon) === 'active'
        ? freshCoupon
        : null);
    const isRedeemed = Boolean(coupon) || item.state === REWARD_STATES.USE_COUPON;
    const isAvailable = item.state === REWARD_STATES.REDEEM;
    const isNext = item.state === REWARD_STATES.NEXT_REWARD;
    const isThisPending =
      (redemptionStage?.points === tier.points && redemptionStage.status !== 'redeemed') ||
      (isGeneratingReward && pendingPoints === tier.points);
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
              <s-stack direction="block" gap="small-100">
                <s-heading>$${tier.value} OFF</s-heading>
                <s-text color="subdued">Redeem {tier.points} pts · $${tier.minimum} minimum order</s-text>
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
                  Your points stay safe until Shopify confirms the reward.
                </s-text>
              )}
            </s-stack>

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
    ? 'Tap Redeem on any unlocked reward. Confirm your points, then use the coupon when it is ready. ✨'
    : 'Keep stacking points — your first reward is getting closer. ✨';

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-heading>Rewards ★</s-heading>
            <s-text color="subdued">{`Earn 1 point for every ${REWARD_SPEND_CENTS_PER_POINT / 100} of eligible JILL merchandise spend.`}</s-text>
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

              {redeemError && <s-banner tone="critical">{redeemError}</s-banner>}

              <s-stack direction="inline" justifyContent="center">
                <s-button variant="secondary" onClick={() => setShowAllRewards((current) => !current)}>
                  {showAllRewards ? 'Collapse rewards' : 'View all rewards'}
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>
        )}

        {stale && (
          <s-banner tone="info">
            Rewards may be out of date. Your last confirmed balance and coupons are still shown while we refresh automatically.
          </s-banner>
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