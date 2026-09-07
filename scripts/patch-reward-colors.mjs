import fs from 'node:fs';

const path = 'extensions/jill-account-dashboard/src/Dashboard.jsx';
let source = fs.readFileSync(path, 'utf8');

const startMarker = '  function rewardStatusControl(tier, coupon, isAvailable, isNext, isThisPending) {';
const endMarker = '\n\n  function rewardMilestone(tier, showTopRail = false, showBottomRail = false) {';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error('Could not locate rewardStatusControl block in Dashboard.jsx');
}

const replacement = `  function rewardStatusControl(tier, coupon, isAvailable, isNext, isThisPending) {
    if (isThisPending) {
      return (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-spinner size="small" />
          <s-text type="strong" tone="info">
            {slowRequest ? 'Still creating…' : 'Creating…'}
          </s-text>
        </s-stack>
      );
    }

    if (coupon) {
      return (
        <s-clickable
          href="extension:jill-account-coupons/"
          background="transparent"
          padding="none"
          borderRadius="max"
          accessibilityLabel={\`Open your $\${tier.value} OFF coupon\`}
        >
          <s-stack direction="inline" gap="small-100" alignItems="center">
            <s-icon type="discount" tone="info" size="small-200" />
            <s-badge tone="info">Redeemed</s-badge>
          </s-stack>
        </s-clickable>
      );
    }

    if (isAvailable) {
      return (
        <s-clickable
          disabled={Boolean(pendingPoints)}
          background="transparent"
          padding="none"
          borderRadius="max"
          accessibilityLabel={\`Redeem $\${tier.points} points for $\${tier.value} OFF\`}
          onClick={() => {
            setRedeemError('');
            setConfirmTier(tier);
          }}
        >
          <s-stack direction="inline" gap="small-100" alignItems="center">
            <s-icon type="savings" tone="success" size="small-200" />
            <s-badge tone="success">Redeem</s-badge>
          </s-stack>
        </s-clickable>
      );
    }

    if (isNext) {
      return (
        <s-button
          variant="primary"
          inlineSize="fit-content"
          accessibilityLabel={\`Next reward: $\${tier.points} points for $\${tier.value} OFF\`}
          onClick={() => setShowAllRewards(true)}
        >
          Next Reward ★
        </s-button>
      );
    }

    return (
      <s-box background="subdued" padding="small-200" borderRadius="max">
        <s-stack direction="inline" gap="small-100" alignItems="center">
          <s-icon type="lock" tone="neutral" size="small-200" />
          <s-text type="strong" tone="neutral">Locked</s-text>
        </s-stack>
      </s-box>
    );
  }`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
console.log('Reward status color patch applied.');
