export default function Celebrations() {
  return (
    <s-stack direction="block" gap="large">
      <s-section>
        <s-box background="subdued" padding="base" borderRadius="large">
          <s-stack direction="block" gap="small-300">
            <s-heading>Every celebration starts with a little inspiration ✨</s-heading>
            <s-text>Birthdays, milestones and all the moments worth making special — one day your saved dates and themes will live right here.</s-text>
            <s-banner tone="info">Celebrations aren't connected to account storage yet. No dates are saved from this page.</s-banner>
          </s-stack>
        </s-box>
      </s-section>
      <s-section heading="Reminders, your way">
        <s-stack direction="block" gap="small-300">
          <s-text>Reminders will be optional and off until you explicitly opt in. They'll never be enabled just because you open this page.</s-text>
          <s-text color="subdued">We won't send event messages without your permission. Editing, deletion and consent controls are part of the next verified feature phase.</s-text>
        </s-stack>
      </s-section>
    </s-stack>
  );
}
