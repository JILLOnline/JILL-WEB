export default function Coupons({onNavigate}) {
  return (
    <s-stack direction="block" gap="base">
      <s-section heading="For you">
        <s-stack direction="block" gap="base">
          <s-heading>Your personal coupon wallet</s-heading>
          <s-text>We're connecting your verified Rewards coupons to this account. No wallet data has been loaded into this preview yet.</s-text>
          <s-banner tone="info">Use Now will appear only for a verified active coupon. Nothing is added to your cart during this preview.</s-banner>
          <s-button onClick={()=>onNavigate('rewards')}>View Rewards</s-button>
        </s-stack>
      </s-section>
      <s-section heading="Storewide offers">
        <s-text>Public promotions will appear here once the Shopify promotions adapter is connected and verified. A missing feed does not mean there are no offers.</s-text>
      </s-section>
    </s-stack>
  );
}
