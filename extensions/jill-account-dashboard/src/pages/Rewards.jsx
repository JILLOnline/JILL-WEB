import {REWARD_TIERS, REWARD_COUPON_POLICY} from '../../../../shared/rewards.mjs';

export default function Rewards({accountState,onNavigate}) {
  const summary=accountState?.status==='ready' ? accountState.summary : null;
  const points=summary?.pointsBalance;
  return (
    <s-stack direction="block" gap="base">
      <s-section heading="Your Rewards">
        <s-stack direction="block" gap="base">
          <s-heading>{typeof points==='number' ? `${points} available points` : 'Balance unavailable'}</s-heading>
          <s-text>Lifetime earned: {summary?.pointsEarned ?? 'Unavailable'} · Redeemed: {summary?.pointsRedeemed ?? 'Unavailable'}</s-text>
          <s-banner tone="info">Rewards are read-only in this WORK preview. Coupon redemption will be enabled only after end-to-end backend testing.</s-banner>
          <s-button onClick={()=>onNavigate('coupons')}>Go to Coupons</s-button>
        </s-stack>
      </s-section>
      <s-section heading="Reward options">
        <s-stack direction="block" gap="base">
          {REWARD_TIERS.map((tier)=>(
            <s-stack direction="block" gap="small" key={tier.points}>
              <s-heading>${tier.points} points · $${tier.value} OFF</s-heading>
              <s-text>Minimum order $${tier.minimum} · {typeof points === 'number' && points >= tier.points ? 'Points threshold reached' : 'Not yet available'}</s-text>
              <s-text>Redemption is not enabled in this preview.</s-text>
            </s-stack>
          ))}
        </s-stack>
      </s-section>
      <s-section heading="How reward coupons work">
        <s-text>Redeemed coupons expire after {REWARD_COUPON_POLICY.expirationDays} days. Each is for one use and cannot combine with other discounts.</s-text>
      </s-section>
    </s-stack>
  );
}
