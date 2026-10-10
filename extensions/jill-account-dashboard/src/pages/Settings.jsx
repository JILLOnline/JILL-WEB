export default function Settings({onNavigate}) {
  return (
    <s-stack direction="block" gap="base">
      <s-section heading="JILL Settings">
        <s-stack direction="block" gap="base">
          <s-heading>Account and preferences</s-heading>
          <s-text>Shopify securely manages your email, sign-in, addresses and standard account details.</s-text>
          <s-link href="shopify:customer-account/profile">Open Shopify Profile</s-link>
          <s-button onClick={()=>onNavigate('saved')}>Saved Preferences</s-button>
        </s-stack>
      </s-section>
      <s-section heading="Communication and reminders">
        <s-text>Celebration reminders and personalized account preferences will be editable once their consent and storage contracts are available.</s-text>
        <s-button onClick={()=>onNavigate('celebrations')}>Celebration preferences</s-button>
      </s-section>
    </s-stack>
  );
}
