// First real My JILL hub component. This is intentionally data-free:
// phase-zero WORK preview proves Shopify's page runtime before Rewards,
// orders, coupons, preferences or privileged operations are mounted.
export default function AccountHub() {
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
    </s-page>
  );
}
