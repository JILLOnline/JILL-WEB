const PILL_TONES = Object.freeze({
  neutral: 'neutral',
  info: 'info',
  success: 'success',
  critical: 'critical',
});

function normalizedTone(tone) {
  return PILL_TONES[tone] || PILL_TONES.neutral;
}

export function JillAction({
  role = 'secondary',
  href,
  onClick,
  disabled = false,
  accessibilityLabel,
  children,
}) {
  const variant = role === 'primary' ? 'primary' : 'secondary';

  return (
    <s-button
      variant={variant}
      href={href}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onClick={onClick}
    >
      {children}
    </s-button>
  );
}

export function JillPillAction({
  tone = 'neutral',
  href,
  onClick,
  disabled = false,
  accessibilityLabel,
  children,
}) {
  return (
    <s-clickable
      href={href}
      onClick={onClick}
      disabled={disabled}
      background="subdued"
      padding="small-200"
      borderRadius="max"
      accessibilityLabel={accessibilityLabel}
    >
      <s-text tone={normalizedTone(tone)}>{children}</s-text>
    </s-clickable>
  );
}

export function JillStatusPill({tone = 'neutral', strong = false, children}) {
  return (
    <s-box background="subdued" padding="small-200" borderRadius="max">
      <s-text tone={normalizedTone(tone)} type={strong ? 'strong' : undefined}>
        {children}
      </s-text>
    </s-box>
  );
}

export function JillPendingPill({children = 'Working…'}) {
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-spinner size="small" />
      <s-text tone="info">{children}</s-text>
    </s-stack>
  );
}
