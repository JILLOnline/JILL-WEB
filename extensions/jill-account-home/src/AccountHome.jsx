import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default function extension() {
  render(<ProfileManagerHeader />, document.body);
}

function ProfileManagerHeader() {
  return (
    <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
      <s-stack direction="block" gap="small-200">
        <s-heading>Profile Manager</s-heading>
        <s-text color="subdued">
          Manage your email, addresses, marketing preferences, and account access here.
        </s-text>
      </s-stack>
      <s-button href="extension:jill-account-dashboard/">Open My JILL</s-button>
    </s-stack>
  );
}
