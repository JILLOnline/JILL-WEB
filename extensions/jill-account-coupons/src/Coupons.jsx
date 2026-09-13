import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {
  rewardCouponStatus,
  rewardWallet,
} from '../../jill-account-dashboard/src/rewards.mjs';

const STORE = 'https://jillonlinestore.com';
const STOREFRONT_API = 'shopify://storefront/api/2026-07/graphql.json';
const CUSTOMER_API = 'shopify://customer-account/api/2026-07/graphql.json';
const PROMOTION_SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;

const PROMOTIONS_QUERY = `
  query JillPublicPromotions {
    shop {
      promotionSnapshot: metafield(
        namespace: "jill_promotions"
        key: "active_public_codes"
      ) {
        value
      }
    }
  }
`;

const REWARDS_QUERY = `
  query JillPersonalCoupons {
    customer {
      coupons: metafield(namespace: "jill_rewards", key: "coupons") {
        value
      }
    }
  }
`;

async function queryApi(url, query, fallbackMessage) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query}),
  });
  const payload = await response.json();

  if (!response.ok || payload?.errors?.length) {
    throw new Error(payload?.errors?.[0]?.message || fallbackMessage);
  }

  return payload?.data || {};
}

function parsePromotionSnapshot(value) {
  if (!value) {
    throw new Error('JILL promotions have not synchronized yet.');
  }

  let snapshot;
  try {
    snapshot = JSON.parse(value);
  } catch (error) {
    throw new Error('JILL promotions returned invalid data.');
  }

  if (snapshot?.version !== 1 || !Array.isArray(snapshot?.offers)) {
    throw new Error('JILL promotions returned an unsupported snapshot.');
  }

  const syncedAt = Date.parse(snapshot.synced_at || '');
  if (
    !Number.isFinite(syncedAt) ||
    Date.now() - syncedAt > PROMOTION_SNAPSHOT_MAX_AGE_MS
  ) {
    throw new Error('JILL promotions are waiting for a fresh Shopify sync.');
  }

  return snapshot.offers.filter((offer) => offer?.code && offer?.summary);
}

async function loadPromotions() {
  const data = await queryApi(
    STOREFRONT_API,
    PROMOTIONS_QUERY,
    'Unable to load current JILL promotions.',
  );
  return parsePromotionSnapshot(data?.shop?.promotionSnapshot?.value);
}

async function loadRewardCoupons() {
  const data = await queryApi(
    CUSTOMER_API,
    REWARDS_QUERY,
    'Unable to load your JILL Rewards coupons.',
  );

  return rewardWallet(data?.customer?.coupons?.value)
    .filter((coupon) => rewardCouponStatus(coupon) === 'active')
    .sort(
      (a, b) =>
        Date.parse(b?.created_at || '') - Date.parse(a?.created_at || ''),
    );
}

function formatDate(value) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return '';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(time));
}

function discountUrl(code) {
  return `${STORE}/discount/${encodeURIComponent(code)}?redirect=/collections/all`;
}

function StorewideOffer({offer}) {
  const expires = formatDate(offer.ends_at);

  return (
    <s-box
      padding="base"
      background="base"
      borderRadius="large"
      border="base base solid"
    >
      <s-stack direction="block" gap="base">
        <s-stack
          direction="inline"
          justifyContent="space-between"
          alignItems="center"
        >
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">STOREWIDE</s-text>
            <s-heading>{offer.summary}</s-heading>
          </s-stack>
          <s-badge tone="success">Available</s-badge>
        </s-stack>

        <s-box padding="small-300" background="subdued" borderRadius="base">
          <s-stack
            direction="inline"
            justifyContent="space-between"
            alignItems="center"
          >
            <s-text color="subdued">Code</s-text>
            <s-text type="strong">{offer.code}</s-text>
          </s-stack>
        </s-box>

        <s-stack direction="block" gap="small-100">
          {offer.applies_once_per_customer ? (
            <s-text color="subdued">One use per customer.</s-text>
          ) : null}
          <s-text color="subdued">
            {expires ? `Expires ${expires}` : 'No expiration date'}
          </s-text>
        </s-stack>

        <s-button variant="primary" href={discountUrl(offer.code)}>
          Use now
        </s-button>
      </s-stack>
    </s-box>
  );
}

function RewardCoupon({coupon}) {
  const expires = formatDate(coupon.expires_at);
  const value = Number(coupon.value || 0);
  const minimum = Number(coupon.minimum || 0);

  return (
    <s-box
      padding="base"
      background="base"
      borderRadius="large"
      border="base base solid"
    >
      <s-stack direction="block" gap="base">
        <s-stack
          direction="inline"
          justifyContent="space-between"
          alignItems="center"
        >
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">YOUR REWARD</s-text>
            <s-heading>{value > 0 ? `$${value} OFF` : 'JILL Reward'}</s-heading>
          </s-stack>
          <s-badge tone="success">Ready</s-badge>
        </s-stack>

        <s-box padding="small-300" background="subdued" borderRadius="base">
          <s-stack
            direction="inline"
            justifyContent="space-between"
            alignItems="center"
          >
            <s-text color="subdued">Code</s-text>
            <s-text type="strong">{coupon.code}</s-text>
          </s-stack>
        </s-box>

        <s-stack direction="block" gap="small-100">
          {minimum > 0 ? (
            <s-text color="subdued">${minimum} minimum order.</s-text>
          ) : null}
          {expires ? (
            <s-text color="subdued">Expires {expires}</s-text>
          ) : null}
        </s-stack>

        <s-button variant="primary" href={discountUrl(coupon.code)}>
          Use now
        </s-button>
      </s-stack>
    </s-box>
  );
}

function Coupons() {
  const [promotions, setPromotions] = useState([]);
  const [rewardCoupons, setRewardCoupons] = useState([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [promotionsError, setPromotionsError] = useState('');
  const [rewardsError, setRewardsError] = useState('');

  useEffect(() => {
    let active = true;

    loadPromotions()
      .then((offers) => {
        if (!active) return;
        setPromotions(offers);
        setPromotionsError('');
      })
      .catch((error) => {
        console.warn('JILL storewide promotions load error', error);
        if (active) {
          setPromotions([]);
          setPromotionsError(
            'Storewide offers are temporarily unavailable. Please refresh shortly.',
          );
        }
      })
      .finally(() => {
        if (active) setPromotionsLoading(false);
      });

    loadRewardCoupons()
      .then((coupons) => {
        if (!active) return;
        setRewardCoupons(coupons);
        setRewardsError('');
      })
      .catch((error) => {
        console.warn('JILL Rewards coupons load error', error);
        if (active) {
          setRewardCoupons([]);
          setRewardsError(
            'Your Rewards coupons are temporarily unavailable. Please refresh shortly.',
          );
        }
      })
      .finally(() => {
        if (active) setRewardsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <s-page heading="Coupons" subheading="Your JILL offers in one place.">
      <s-button slot="primary-action" variant="secondary" href={STORE}>
        Back to JILL
      </s-button>

      <s-stack direction="block" gap="base">
        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Storewide offers</s-heading>
              <s-text color="subdued">
                Current Shopify promotions available to everyone.
              </s-text>
            </s-stack>

            {promotionsLoading ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-spinner size="small" />
                <s-text color="subdued">Loading current offers…</s-text>
              </s-stack>
            ) : null}

            {!promotionsLoading && promotionsError ? (
              <s-banner tone="critical">{promotionsError}</s-banner>
            ) : null}

            {!promotionsLoading && !promotionsError && !promotions.length ? (
              <s-text color="subdued">No storewide promotions right now.</s-text>
            ) : null}

            {!promotionsLoading && !promotionsError
              ? promotions.map((offer) => (
                  <StorewideOffer
                    key={`storewide-${offer.code}`}
                    offer={offer}
                  />
                ))
              : null}
          </s-stack>
        </s-section>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>For you</s-heading>
              <s-text color="subdued">
                Personal JILL Rewards coupons generated from your Dashboard.
              </s-text>
            </s-stack>

            {rewardsLoading ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-spinner size="small" />
                <s-text color="subdued">Loading your Rewards coupons…</s-text>
              </s-stack>
            ) : null}

            {!rewardsLoading && rewardsError ? (
              <s-banner tone="critical">{rewardsError}</s-banner>
            ) : null}

            {!rewardsLoading && !rewardsError && rewardCoupons.length
              ? rewardCoupons.map((coupon) => (
                  <RewardCoupon key={`reward-${coupon.code}`} coupon={coupon} />
                ))
              : null}

            {!rewardsLoading && !rewardsError && !rewardCoupons.length ? (
              <>
                <s-text color="subdued">
                  You do not have an active Rewards coupon yet.
                </s-text>
                <s-button
                  variant="secondary"
                  href="extension:jill-account-dashboard/"
                >
                  View Rewards
                </s-button>
              </>
            ) : null}
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export default async () => {
  render(<Coupons />, document.body);
};
