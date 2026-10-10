// First real My JILL hub component. This is intentionally data-free:
// phase-zero WORK preview proves Shopify's page runtime before Rewards,
// orders, coupons, preferences or privileged operations are mounted.
export default function AccountHub({accountState = null}) {
  return (
    <s-page heading="My JILL" subheading="Your JILL account, all in one place">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-heading>Welcome to My JILL</s-heading>
          <s-text>
            Your rewards, coupons, custom orders and celebrations belong together.
          </s-text>
          <s-banner tone="info">
            The account hub is loading its foundation. Customer information and
            reward actions will be connected after this page passes WORK preview.
          </s-banner>
        </s-stack>
      </s-section>
      {accountState?.status === 'loading' && (
        <s-section>
          <s-heading>Your account</s-heading>
          <s-text>Loading your Shopify account and Rewards summary…</s-text>
        </s-section>
      )}
      {accountState?.status === 'error' && (
        <s-section>
          <s-banner tone="critical">
            We couldn't load your account information. The Hub is still
            available; reload the page to try again. No points were changed.
          </s-banner>
        </s-section>
      )}
      {accountState?.status === 'ready' && (
        <s-section>
          <s-stack direction="block" gap="base">
            <s-heading>
              {accountState.summary.displayName
                ? `Welcome, ${accountState.summary.displayName}`
                : 'Your account'}
            </s-heading>
            <s-text>
              Available Rewards points: {accountState.summary.pointsBalance === null
                ? 'Unavailable'
                : accountState.summary.pointsBalance}
            </s-text>
            <s-text>
              Lifetime earned: {accountState.summary.pointsEarned === null
                ? 'Unavailable'
                : accountState.summary.pointsEarned}
            </s-text>
            <s-text>
              Lifetime redeemed: {accountState.summary.pointsRedeemed === null
                ? 'Unavailable'
                : accountState.summary.pointsRedeemed}
            </s-text>
            <s-banner tone="info">
              Read-only WORK account preview. Redemption is disabled while
              we certify the new customer-data layer.
            </s-banner>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
