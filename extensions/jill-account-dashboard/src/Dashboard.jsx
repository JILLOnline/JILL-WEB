import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  return (
    <s-page heading="My JILL" subheading="Your JILL account hub">
      <s-button
        slot="primary-action"
        onClick={() => navigation.navigate('shopify:customer-account/')}
      >
        Back to account
      </s-button>
      <s-stack direction="block" gap="base">
        <s-banner tone="info">
          My JILL is connected and ready.
        </s-banner>
        <s-stack direction="block" gap="base">
          <s-heading>Welcome to My JILL</s-heading>
          <s-text color="subdued">
            Custom requests, saved celebration details, and recent orders will live here.
          </s-text>
        </s-stack>
      </s-stack>
    </s-page>
  );
}
