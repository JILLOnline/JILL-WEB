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
  }
`;

async function loadCoupons() {
  const response = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query: QUERY}),
  });
  const payload = await response.json();

  if (!response.ok || payload?.errors?.length) {
    throw new Error(payload?.errors?.[0]?.message || 'Unable to load your JILL coupons.');
  }

  const metafield = (payload?.data?.customer?.metafields || []).find(
    (item) => item?.namespace === 'jill_rewards' && item?.key === 'coupons',
  );

  return parseCoupons(metafield?.value);
}

function parseCoupons(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    console.warn('JILL coupon wallet parse error', error);
    return [];
  }
}

function effectiveStatus(coupon) {
  const status = String(coupon?.status || 'active').toLowerCase();
  if (status === 'used' || status === 'expired' || status === 'revoked') return status;

  const expiresAt = Date.parse(coupon?.expires_at || '');
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return 'expired';

  return 'active';
}

function formatDateTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function couponSort(a, b) {
  return Date.parse(b?.created_at || '') - Date.parse(a?.created_at || '');
}

function CouponCard({coupon, status}) {
  const value = Number(coupon?.value || 0);
  const minimum = Number(coupon?.minimum || 0);
  const code = String(coupon?.code || '').trim();
  const expires = formatDateTime(coupon?.expires_at);
  const usedAt = formatDateTime(coupon?.used_at);
  const revokedAt = formatDateTime(coupon?.revoked_at);

  return (
    <s-box
      padding="base"
      background={status === 'active' ? 'base' : 'subdued'}
      borderRadius="large"
      border="base base solid"
    >
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-heading>${value} OFF</s-heading>
            <s-text color="subdued">${minimum} minimum order</s-text>
          </s-stack>
          <s-badge tone={status === 'active' ? 'success' : status === 'used' ? 'info' : 'neutral'}>
            {status === 'active'
              ? 'Active'
              : status === 'used'
                ? 'Used'
                : status === 'revoked'
                  ? 'Revoked'
                  : 'Expired'}
          </s-badge>
        </s-stack>

        <s-box padding="small-300" background="subdued" borderRadius="base">
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">Coupon code</s-text>
            <s-text type="strong">{code || 'Unavailable'}</s-text>
          </s-stack>
        </s-box>

        {status === 'active' && expires && (
          <s-text color="subdued">Expires {expires}</s-text>
        )}
        {status === 'used' && usedAt && (
          <s-text color="subdued">Used {usedAt}</s-text>
        )}
        {status === 'expired' && expires && (
          <s-text color="subdued">Expired {expires}</s-text>
        )}
        {status === 'revoked' && (
          <s-text color="subdued">
            {revokedAt ? `Revoked ${revokedAt}` : 'Revoked'} · No longer usable.
          </s-text>
        )}

        {status === 'active' && code && (
          <s-button
            variant="primary"
            href={`${STORE}/discount/${encodeURIComponent(code)}?redirect=/cart`}
          >
            Use now
          </s-button>
        )}
      </s-stack>
    </s-box>
  );
}

function CouponGroup({heading, description, coupons, status}) {
  if (!coupons.length) return null;

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-100">
          <s-stack direction="inline" gap="small-300" alignItems="center">
            <s-heading>{heading}</s-heading>
            <s-badge tone={status === 'active' ? 'success' : 'neutral'}>{coupons.length}</s-badge>
          </s-stack>
          <s-text color="subdued">{description}</s-text>
        </s-stack>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
          {coupons.map((coupon, index) => (
            <CouponCard
              key={`${coupon?.discount_id || coupon?.code || status}-${index}`}
              coupon={coupon}
              status={status}
            />
          ))}
        </s-grid>
      </s-stack>
    </s-section>
  );
}

function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const refreshCoupons = (initial = false) => {
      loadCoupons()
        .then((nextCoupons) => {
          if (!active) return;
          setCoupons(nextCoupons);
          setError('');
        })
        .catch((loadError) => {
          console.warn('JILL coupons load error', loadError);
          if (active && initial) {
            setError(loadError?.message || 'Unable to load your coupons right now.');
          }
        })
        .finally(() => {
          if (active && initial) setLoading(false);
        });
    };

    refreshCoupons(true);

    // Keep an already-open wallet synchronized with backend reconciliation.
    const refreshTimer = setInterval(() => refreshCoupons(false), COUPONS_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, []);

  const normalized = coupons
    .map((coupon) => ({...coupon, effective_status: effectiveStatus(coupon)}))
    .sort(couponSort);
  const activeCoupons = normalized.filter((coupon) => coupon.effective_status === 'active');
  const usedCoupons = normalized.filter((coupon) => coupon.effective_status === 'used');
  const expiredCoupons = normalized.filter((coupon) => coupon.effective_status === 'expired');
  const revokedCoupons = normalized.filter((coupon) => coupon.effective_status === 'revoked');

  return (
    <s-page
      heading="My Coupons"
      subheading="Your JILL Rewards coupon wallet — ready when you are."
    >
      <s-stack direction="block" gap="base">
        {error && <s-banner tone="critical">{error}</s-banner>}

        {loading ? (
          <s-section>
            <s-text color="subdued">Loading your coupons…</s-text>
          </s-section>
        ) : normalized.length === 0 ? (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="block" gap="small-100">
                <s-heading>No coupons yet ✨</s-heading>
                <s-text color="subdued">
                  Keep earning JILL Rewards points. When you generate a reward coupon, it will live here for you until it is used or expires.
                </s-text>
              </s-stack>
              <s-button variant="primary" href="extension:jill-account-dashboard/">
                View Rewards
              </s-button>
            </s-stack>
          </s-section>
        ) : (
          <>
            <CouponGroup
              heading="Available"
              description="Use an active coupon now or save it for later. Each reward coupon expires 30 days after it is generated."
              coupons={activeCoupons}
              status="active"
            />
            <CouponGroup
              heading="Used"
              description="Rewards you already enjoyed."
              coupons={usedCoupons}
              status="used"
            />
            <CouponGroup
              heading="Expired"
              description="Expired reward coupons stay here for your history."
              coupons={expiredCoupons}
              status="expired"
            />
            <CouponGroup
              heading="Revoked"
              description="Rewards that were reconciled after a refund, cancellation, admin deletion, or coupon integrity repair."
              coupons={revokedCoupons}
              status="revoked"
            />
          </>
        )}
      </s-stack>
    </s-page>
  );
}

export default async () => {
  render(<Coupons />, document.body);
};
