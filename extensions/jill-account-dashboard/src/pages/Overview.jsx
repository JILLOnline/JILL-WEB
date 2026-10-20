export default function Overview({accountState,onNavigate}) {
  const summary=accountState?.status==='ready' ? accountState.summary : null;
  const name=summary?.displayName ? ', '+summary.displayName : '';
  const balance=summary?.pointsBalance === null || !summary
    ? 'Unavailable' : String(summary.pointsBalance)+' points';
  return (
    <s-stack direction="block" gap="large">
      <s-section>
        <s-box padding="base" background="subdued" borderRadius="large">
          <s-stack direction="block" gap="base">
            <s-heading>Welcome back{name}! ✨</s-heading>
            <s-text>Good things are worth celebrating. Your JILL favorites and updates start here.</s-text>
            <s-box padding="base" background="base" borderRadius="large" border="base base solid">
              <s-stack direction="block" gap="small-200">
                <s-text color="subdued">Your verified Rewards balance</s-text>
                <s-heading>{balance}</s-heading>
                <s-text color="subdued">Redeem available points for rewards, then find your codes in Coupons.</s-text>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary" onClick={()=>onNavigate('rewards')}>Explore Rewards</s-button>
                  <s-button variant="secondary" onClick={()=>onNavigate('coupons')}>View Coupons</s-button>
                </s-stack>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>
      <s-section heading="Your requests & celebrations">
        <s-stack direction="block" gap="base">
          <s-text color="subdued">Check the status of custom requests, or explore what you might save for your next big day.</s-text>
          <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
            <s-box padding="base" background="base" borderRadius="large" border="base base solid">
              <s-stack direction="block" gap="small-300">
                <s-heading>Custom Orders</s-heading>
                <s-text color="subdued">Your signed-in requests and real status updates.</s-text>
                <s-button variant="secondary" onClick={()=>onNavigate('custom-orders')}>Track requests</s-button>
              </s-stack>
            </s-box>
            <s-box padding="base" background="base" borderRadius="large" border="base base solid">
              <s-stack direction="block" gap="small-300">
                <s-heading>Celebrations</s-heading>
                <s-text color="subdued">A future home for important dates and themes.</s-text>
                <s-button variant="secondary" onClick={()=>onNavigate('celebrations')}>Explore dates</s-button>
              </s-stack>
            </s-box>
          </s-grid>
          <s-button variant="secondary" onClick={()=>onNavigate('messages')}>Your Messages</s-button>
          <s-button variant="secondary" onClick={()=>onNavigate('saved')}>Saved for You</s-button>
        </s-stack>
      </s-section>
      <s-section>
        <s-text color="subdued">Looking for a regular purchase? Shopify keeps your order history and account profile secure.</s-text>
        <s-link href="shopify:customer-account/orders">View Shopify orders</s-link>
      </s-section>
    </s-stack>
  );
}
