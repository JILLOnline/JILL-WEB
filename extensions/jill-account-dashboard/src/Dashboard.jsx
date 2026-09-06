import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default function extension() {
  render(<MyJillPage />, document.body);
}

function MyJillPage() {
  return (
    <s-page heading="My JILL" subheading="Your JILL account hub">
      <s-stack direction="block" gap="base">
        <s-banner tone="info">
          My JILL is connected. We are loading the full dashboard back in safely.
        </s-banner>
        <s-section>
          <s-stack direction="block" gap="base">
            <s-heading>Welcome to My JILL</s-heading>
            <s-text color="subdued">
              Custom requests, saved celebration details, and recent orders will live here.
            </s-text>
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" href="https://jillonlinestore.com/pages/quote">
                Start a Custom Order
              </s-button>
              <s-button href="shopify:customer-account/orders">Orders</s-button>
              <s-button href="shopify:customer-account/profile">Profile Manager</s-button>
            </s-stack>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
