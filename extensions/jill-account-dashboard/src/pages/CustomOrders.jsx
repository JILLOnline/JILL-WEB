export default function CustomOrders() {
  return (
    <s-stack direction="block" gap="base">
      <s-section heading="Your custom orders">
        <s-stack direction="block" gap="base">
          <s-heading>Made just for your celebration</s-heading>
          <s-text>Here you'll be able to follow request reviews, design approvals, production progress and pickup or shipping details.</s-text>
          <s-banner tone="info">Custom-order history is not connected yet. We won't display made-up requests or treat email matches as proof of ownership.</s-banner>
        </s-stack>
      </s-section>
      <s-section heading="How requests will appear">
        <s-text>Received → Reviewing → Design approval → In production → Ready or shipped → Completed</s-text>
        <s-text>Actual status values will follow the existing Custom Order backend contract.</s-text>
      </s-section>
    </s-stack>
  );
}
