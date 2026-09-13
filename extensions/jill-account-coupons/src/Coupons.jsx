import '@shopify/ui-extensions/preact';
import {render} from 'preact';

const STORE = 'https://jillonlinestore.com';
const PARTY10_URL = `${STORE}/discount/PARTY10?redirect=/collections/all`;

function Coupons() {
  return (
    <s-page
      heading="Coupons"
      subheading="Your JILL offers in one place."
    >
      <s-button slot="primary-action" variant="secondary" href={STORE}>
        Back to JILL
      </s-button>

      <s-stack direction="block" gap="base">
        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Storewide offers</s-heading>
              <s-text color="subdued">Current JILL promotions available to everyone.</s-text>
            </s-stack>

            <s-box padding="base" background="base" borderRadius="large" border="base base solid">
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-stack direction="block" gap="small-100">
                    <s-text color="subdued">STOREWIDE</s-text>
                    <s-heading>5% off entire order</s-heading>
                  </s-stack>
                  <s-badge tone="success">Available</s-badge>
                </s-stack>

                <s-box padding="small-300" background="subdued" borderRadius="base">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-text color="subdued">Code</s-text>
                    <s-text type="strong">PARTY10</s-text>
                  </s-stack>
                </s-box>

                <s-stack direction="block" gap="small-100">
                  <s-text color="subdued">One use per customer.</s-text>
                  <s-text color="subdued">No expiration date</s-text>
                </s-stack>

                <s-button variant="primary" href={PARTY10_URL}>
                  Use now
                </s-button>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>For you</s-heading>
              <s-text color="subdued">
                Personal JILL Rewards coupons you generate from your Dashboard will live here.
              </s-text>
            </s-stack>
            <s-button variant="secondary" href="extension:jill-account-dashboard/">
              View Rewards
            </s-button>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export default async () => {
  render(<Coupons />, document.body);
};
