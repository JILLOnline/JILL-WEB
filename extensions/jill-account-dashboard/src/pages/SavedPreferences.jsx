export default function SavedPreferences() {
  return (
    <s-stack direction="block" gap="base">
      <s-section heading="Saved for you">
        <s-heading>Your favorites, ready when you are</s-heading>
        <s-text>This space will hold your preferred colors, favorite party themes and reusable personalization details—only the information you choose to save.</s-text>
        <s-banner tone="info">No saved preferences are available yet. The customer-specific storage and editing permissions must be verified first.</s-banner>
      </s-section>
      <s-section heading="Your privacy">
        <s-text>You'll be able to review, update or clear saved details without changing your Shopify account profile.</s-text>
      </s-section>
    </s-stack>
  );
}
