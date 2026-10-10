export default function Celebrations() {
  return (
    <s-stack direction="block" gap="base">
      <s-section heading="Your celebrations">
        <s-heading>Plan every happy moment</s-heading>
        <s-text>Your upcoming birthdays, parties and important dates will have a home here, with favorite themes and colors available when you choose to save them.</s-text>
        <s-banner tone="info">No event dates are stored or displayed by this template. Event storage and reminder consent still need to be connected.</s-banner>
      </s-section>
      <s-section heading="Reminder preferences">
        <s-text>Reminders will be optional and off until you explicitly opt in. They'll never be enabled just because you open this page.</s-text>
      </s-section>
    </s-stack>
  );
}
