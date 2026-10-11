// Canonical Rewards redemption UI. Shared by the legacy account view and
// the new My JILL hub; never fork the request/poll/confirmation state machine.
import {useEffect,useRef,useState} from 'preact/hooks';
import {
  REWARD_COUPON_POLICY,REWARD_SPEND_CENTS_PER_POINT,REWARD_STATES,
  buildRewardJourney,rewardCouponStatus,rewardRequestIsPending,
  rewardRequestIsComplete,rewardRequestOutcome,rewardWallet,
  discountCartUrl,toRewardInteger,
} from '../../../../shared/rewards.mjs';
import {loadData,requestReward,wait,metaMap} from './account-transport.mjs';

export default function RewardsCard({customer, meta, loading, stale, onCustomerUpdate, store, onCoupons}) {
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
          <s-button variant="secondary" href={onCoupons ? undefined : "extension:jill-account-coupons/"} onClick={onCoupons}>
            My Coupons
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
