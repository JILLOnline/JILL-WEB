export default function SavedPreferences() {
  return (
    <s-stack direction="block" gap="large">
      <s-section>
        <s-box padding="base" background="subdued" borderRadius="large">
          <s-stack direction="block" gap="small-300">
            <s-heading>Made a little more you ♡</s-heading>
            <s-text>Your favorite colors, party themes and personalization choices deserve a happy place of their own.</s-text>
            <s-banner tone="info">No saved preferences are available yet. Private customer storage and editing permissions are still being verified.</s-banner>
          </s-stack>
        </s-box>
      </s-section>
      <s-section heading="Your details, your choice">
        <s-stack direction="block" gap="small-300">
          <s-text>When saving becomes available, you'll be able to review, update and clear the information you choose to keep.</s-text>
          <s-text color="subdued">Your Shopify sign-in, email and addresses remain managed by Shopify.</s-text>
        </s-stack>
      </s-section>
    </s-stack>
  );
}
