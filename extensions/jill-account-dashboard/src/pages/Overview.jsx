export default function Overview({accountState,onNavigate}) {
  const summary=accountState?.status==='ready' ? accountState.summary : null;
  return (
    <s-stack direction="block" gap="base">
      <s-section heading="Your JILL at a glance">
        <s-stack direction="block" gap="base">
          <s-text>Welcome{summary?.displayName ? `, ${summary.displayName}` : ''}! Everything for your next celebration, together in one place.</s-text>
          <s-text>
            Rewards balance: {summary?.pointsBalance === null || !summary ? 'Unavailable' : `${summary.pointsBalance} points`}
          </s-text>
          <s-stack direction="inline" gap="base">
            <s-button variant="primary" onClick={()=>onNavigate('rewards')}>View Rewards</s-button>
            <s-button onClick={()=>onNavigate('coupons')}>My Coupons</s-button>
          </s-stack>
        </s-stack>
      </s-section>
      <s-section heading="Your celebrations and orders">
        <s-stack direction="block" gap="base">
          <s-text>Track personalized requests, event details and the things you've saved.</s-text>
          <s-stack direction="inline" gap="base">
            <s-button onClick={()=>onNavigate('custom-orders')}>Custom Orders</s-button>
            <s-button onClick={()=>onNavigate('celebrations')}>Celebrations</s-button>
            <s-button onClick={()=>onNavigate('saved')}>Saved for You</s-button>
          </s-stack>
          <s-text>Your Shopify orders and addresses remain available in your native account.</s-text>
          <s-link href="shopify:customer-account/orders">View Shopify orders</s-link>
        </s-stack>
      </s-section>
      <s-section heading="What we are connecting next">
        <s-text>Coupons, custom-order status and event reminders will appear here as their verified data services become available.</s-text>
      </s-section>
    </s-stack>
  );
}
