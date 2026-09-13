import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

const API = 'shopify://customer-account/api/2026-07/graphql.json';
const STORE = 'https://jillonlinestore.com';
const COUPONS_REFRESH_MS = 25000;

const QUERY = `
  query JillCoupons {
    customer {
      id
      metafields(identifiers: [{namespace:"jill_rewards",key:"coupons"}]) {
        namespace
        key
        value
        type
      }
    }
    shop {
      metafield(namespace:"jill_account", key:"public_offers") {
        namespace
        key
        value
        type
      }
    }
  }
`;

async function loadOffers() {
  const response = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query: QUERY}),
  });
  const payload = await response.json();

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.errors?.[0]?.message || 'Unable to load JILL offers right now.');
  }

  // Shopify can return useful partial Customer Account data alongside field-level errors.
  // Keep the public wallet usable even if one optional source is temporarily unavailable.
  if (payload?.errors?.length) {
    console.warn('JILL coupon query returned partial data', payload.errors);
  }

  const rewardMetafield = (payload?.data?.customer?.metafields || []).find(
    (item) => item?.namespace === 'jill_rewards' && item?.key === 'coupons',
  );
  const publicMetafield = payload?.data?.shop?.metafield;

  return {
    personal: parseRewardCoupons(rewardMetafield?.value),
    publicOffers: parsePublicOffers(publicMetafield?.value),
  };
}

function parseRewardCoupons(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    console.warn('JILL reward coupon wallet parse error', error);
    return [];
  }
}

function parsePublicOffers(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    const offers = Array.isArray(parsed) ? parsed : parsed?.offers;
    return Array.isArray(offers) ? offers.filter(Boolean) : [];
  } catch (error) {
    console.warn('JILL public offers parse error', error);
    return [];
  }
}

function rewardStatus(coupon) {
  const status = String(coupon?.status || 'active').toLowerCase();
  if (status === 'used' || status === 'expired' || status === 'revoked') return status;

  const expiresAt = Date.parse(coupon?.expires_at || '');
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return 'expired';

  return 'active';
}

function publicOfferIsActive(offer) {
  const startsAt = Date.parse(offer?.starts_at || '');
  const endsAt = Date.parse(offer?.ends_at || '');
  const now = Date.now();

  if (Number.isFinite(startsAt) && startsAt > now) return false;
  if (Number.isFinite(endsAt) && endsAt <= now) return false;
  return true;
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function rewardSort(a, b) {
  return Date.parse(b?.created_at || '') - Date.parse(a?.created_at || '');
}

function discountUrl(code, suppliedUrl) {
  if (suppliedUrl) return suppliedUrl;
  if (!code) return `${STORE}/collections/all`;
  return `${STORE}/discount/${encodeURIComponent(code)}?redirect=/collections/all`;
}

function OfferCard({eyebrow, title, summary, details, code, expiresAt, url, tone = 'success'}) {
  return (
    <s-box padding="base" background="base" borderRadius="large" border="base base solid">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">{eyebrow}</s-text>
            <s-heading>{title}</s-heading>
          </s-stack>
          <s-badge tone={tone}>Available</s-badge>
        </s-stack>

        {summary && <s-text>{summary}</s-text>}

        {code && (
          <s-box padding="small-300" background="subdued" borderRadius="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text color="subdued">Code</s-text>
              <s-text type="strong">{code}</s-text>
            </s-stack>
          </s-box>
        )}

        <s-stack direction="block" gap="small-100">
          {details && <s-text color="subdued">{details}</s-text>}
          <s-text color="subdued">
            {expiresAt ? `Expires ${formatDate(expiresAt)}` : 'No expiration date'}
          </s-text>
        </s-stack>

        <s-button variant="primary" href={discountUrl(code, url)}>
          Use now
        </s-button>
      </s-stack>
    </s-box>
  );
}

function PersonalOfferCard({coupon}) {
  const value = Number(coupon?.value || 0);
  const minimum = Number(coupon?.minimum || 0);
  const code = String(coupon?.code || '').trim();

  return (
    <OfferCard
      eyebrow="FOR YOU · JILL REWARDS"
      title={`$${value} OFF`}
      summary={minimum > 0 ? `Valid on orders of $${minimum} or more.` : 'Your personal JILL Rewards coupon.'}
      details="Personal reward coupon"
      code={code}
      expiresAt={coupon?.expires_at}
      url={discountUrl(code)}
    />
  );
}

function StorewideOfferCard({offer}) {
  const code = String(offer?.code || '').trim();
  const title = String(offer?.summary || offer?.title || 'JILL offer');
  const details = String(offer?.details || 'Available across JILL.');

  return (
    <OfferCard
      eyebrow="STOREWIDE"
      title={title}
      summary={code ? `Use code ${code} at checkout.` : 'Applied automatically when eligible.'}
      details={details}
      code={code}
      expiresAt={offer?.ends_at}
      url={discountUrl(code, offer?.url)}
      tone="info"
    />
  );
}

function HistoryCard({coupon, status}) {
  const value = Number(coupon?.value || 0);
  const code = String(coupon?.code || '').trim();
  const statusDate = status === 'used'
    ? formatDate(coupon?.used_at)
    : status === 'revoked'
      ? formatDate(coupon?.revoked_at)
      : formatDate(coupon?.expires_at);

  return (
    <s-box padding="base" background="subdued" borderRadius="large" border="base base solid">
      <s-stack direction="block" gap="small-300">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-heading>${value} OFF</s-heading>
          <s-badge tone={status === 'used' ? 'info' : 'neutral'}>
            {status === 'used' ? 'Used' : status === 'revoked' ? 'Revoked' : 'Expired'}
          </s-badge>
        </s-stack>
        {code && <s-text type="strong">{code}</s-text>}
        {statusDate && (
          <s-text color="subdued">
            {status === 'used' ? 'Used' : status === 'revoked' ? 'Revoked' : 'Expired'} {statusDate}
          </s-text>
        )}
      </s-stack>
    </s-box>
  );
}

function OffersSection({heading, description, children}) {
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-100">
          <s-heading>{heading}</s-heading>
          <s-text color="subdued">{description}</s-text>
        </s-stack>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
          {children}
        </s-grid>
      </s-stack>
    </s-section>
  );
}

function Coupons() {
  const [wallet, setWallet] = useState({personal: [], publicOffers: []});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const refreshOffers = (initial = false) => {
      loadOffers()
        .then((nextWallet) => {
          if (!active) return;
          setWallet(nextWallet);
          setError('');
        })
        .catch((loadError) => {
          console.warn('JILL coupons load error', loadError);
          if (active && initial) {
            setError(loadError?.message || 'Unable to load your JILL offers right now.');
          }
        })
        .finally(() => {
          if (active && initial) setLoading(false);
        });
    };

    refreshOffers(true);
    const refreshTimer = setInterval(() => refreshOffers(false), COUPONS_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, []);

  const normalizedRewards = wallet.personal
    .map((coupon) => ({...coupon, effective_status: rewardStatus(coupon)}))
    .sort(rewardSort);
  const personalAvailable = normalizedRewards.filter((coupon) => coupon.effective_status === 'active');
  const history = normalizedRewards.filter((coupon) => coupon.effective_status !== 'active');
  const publicAvailable = wallet.publicOffers.filter(publicOfferIsActive);
  const hasCurrentOffers = personalAvailable.length > 0 || publicAvailable.length > 0;

  return (
    <s-page
      heading="Coupons"
      subheading="Your JILL offers in one place — personal rewards and current storewide promos."
    >
      <s-stack direction="block" gap="base">
        {error && <s-banner tone="critical">{error}</s-banner>}

        {loading ? (
          <s-section>
            <s-text color="subdued">Loading your offers…</s-text>
          </s-section>
        ) : (
          <>
            {personalAvailable.length > 0 && (
              <OffersSection
                heading="For you"
                description="Personal JILL Rewards coupons attached to your account."
              >
                {personalAvailable.map((coupon, index) => (
                  <PersonalOfferCard
                    key={`${coupon?.discount_id || coupon?.code || 'reward'}-${index}`}
                    coupon={coupon}
                  />
                ))}
              </OffersSection>
            )}

            {publicAvailable.length > 0 && (
              <OffersSection
                heading="Storewide offers"
                description="Current JILL promotions available to everyone."
              >
                {publicAvailable.map((offer, index) => (
                  <StorewideOfferCard
                    key={`${offer?.id || offer?.code || 'public'}-${index}`}
                    offer={offer}
                  />
                ))}
              </OffersSection>
            )}

            {!hasCurrentOffers && (
              <s-section>
                <s-stack direction="block" gap="base">
                  <s-heading>More JILL offers are on the way ✨</s-heading>
                  <s-text color="subdued">
                    Storewide promotions and personal reward coupons will appear here automatically when available.
                  </s-text>
                  <s-button variant="primary" href={`${STORE}/collections/all`}>
                    Shop JILL
                  </s-button>
                </s-stack>
              </s-section>
            )}

            {history.length > 0 && (
              <OffersSection
                heading="Coupon history"
                description="Used, expired, and reconciled reward coupons stay here for reference."
              >
                {history.map((coupon, index) => (
                  <HistoryCard
                    key={`${coupon?.discount_id || coupon?.code || 'history'}-${index}`}
                    coupon={coupon}
                    status={coupon.effective_status}
                  />
                ))}
              </OffersSection>
            )}
          </>
        )}
      </s-stack>
    </s-page>
  );
}

export default async () => {
  render(<Coupons />, document.body);
};
