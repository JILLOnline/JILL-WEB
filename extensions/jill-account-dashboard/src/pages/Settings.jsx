export default function Settings({onNavigate}) {
  return (
    <s-stack direction="block" gap="large">
      <s-section>
        <s-box padding="base" background="subdued" borderRadius="large">
          <s-stack direction="block" gap="small-300">
            <s-heading>Your JILL, your way</s-heading>
            <s-text>Keep your account details up to date and find your JILL preferences in one place.</s-text>
            <s-link href="shopify:customer-account/profile">Open Shopify Profile & addresses</s-link>
          </s-stack>
        </s-box>
      </s-section>
      <s-section heading="Personal touches">
        <s-stack direction="block" gap="base">
          <s-text color="subdued">Saved details and event reminders are coming after their private storage and consent controls are verified.</s-text>
          <s-stack direction="inline" gap="small-200">
            <s-button variant="secondary" onClick={()=>onNavigate('saved')}>Saved Preferences</s-button>
            <s-button variant="secondary" onClick={()=>onNavigate('celebrations')}>Celebration preferences</s-button>
          </s-stack>
          <s-banner tone="info">No reminders are currently activated by this screen.</s-banner>
        </s-stack>
      </s-section>
    </s-stack>
  );
}
