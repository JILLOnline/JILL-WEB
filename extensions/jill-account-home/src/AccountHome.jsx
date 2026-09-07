import '@shopify/ui-extensions/preact';
import {render} from 'preact';

const STORE = 'https://jillonlinestore.com';

export default function extension() {
  render(<JillSettingsHeader />, document.body);
}

function JillSettingsHeader() {
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
          <s-stack direction="block" gap="small-200">
            <s-heading>JILL Settings</s-heading>
            <s-text color="subdued">
              Keep your contact information, addresses, marketing preferences, and account access up to date.
            </s-text>
          </s-stack>
          <s-badge tone="info">JILL ★</s-badge>
        </s-stack>

        <s-stack direction="inline" gap="base">
          <s-button variant="primary" href="extension:jill-account-dashboard/">Dashboard</s-button>
          <s-button href={STORE}>Back to JILL</s-button>
          <s-button href={`${STORE}/pages/contact`}>Contact JILL</s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
