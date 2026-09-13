import '@shopify/ui-extensions/preact';
import {render} from 'preact';

function CouponsRecovery() {
  return (
    <s-page
      heading="Coupons"
      subheading="JILL offers and rewards will live here."
    >
      <s-section>
        <s-stack direction="block" gap="base">
          <s-heading>Coupons page connected ✨</s-heading>
          <s-text color="subdued">
            This clean page confirms the JILL Coupons account extension is connected correctly.
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export default async () => {
  render(<CouponsRecovery />, document.body);
};
