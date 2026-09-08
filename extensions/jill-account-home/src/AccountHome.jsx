import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {JillAction, JillStatusPill} from '../../../shared/customer-account-ui.jsx';

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
          <JillStatusPill tone="info" strong>JILL ★</JillStatusPill>
        </s-stack>

        <s-stack direction="inline" gap="base">
          <JillAction role="primary" href="extension:jill-account-dashboard/">Dashboard</JillAction>
          <JillAction href={STORE}>Back to JILL</JillAction>
          <JillAction href={`${STORE}/pages/contact`}>Contact JILL</JillAction>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
