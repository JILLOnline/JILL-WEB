import {useEffect,useState} from 'preact/hooks';
import {loadCustomerAccountStorefront,REWARDS_REFRESH_MS} from '../../../../shared/rewards.mjs';
import {loadData,metaMap,rewardsAccountReady} from '../rewards/account-transport.mjs';
import RewardsCard from '../rewards/RewardsCard.jsx';

// The new My JILL hub reuses the canonical Dashboard Rewards transaction UI.
// There is no second redemption handler, coupon issuer, or points calculator.
export default function Rewards({onNavigate}) {
  const [customer,setCustomer] = useState(null);
  const [store,setStore] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [stale,setStale] = useState(false);
  const [storeError,setStoreError] = useState(false);

  useEffect(()=>{
    let active=true;
    let verifiedCustomerId=null;
    const refresh=async(initial=false)=>{
      try {
        const next=await loadData();
        if (!active) return;
        if (verifiedCustomerId && next.id !== verifiedCustomerId) {
          setCustomer(null);
          setError('Your Shopify account changed. Reload My JILL to verify your rewards.');
          return;
        }
        verifiedCustomerId=next.id;
        setCustomer(next);
        setError('');
        setStale(false);
      } catch {
        if (!active) return;
        if (initial || !verifiedCustomerId) setError('Unable to verify your Rewards account. Refresh and try again.');
        else setStale(true);
      } finally {
        if (active && initial) setLoading(false);
      }
    };
    refresh(true);
    loadCustomerAccountStorefront()
      .then((origin)=>{if(active){setStore(origin);setStoreError(false);}})
      .catch(()=>{if(active)setStoreError(true);});
    const timer=setInterval(()=>refresh(false),REWARDS_REFRESH_MS);
    return ()=>{active=false;clearInterval(timer);};
  },[]);

  const meta=metaMap(customer);
  const hasVerifiedLedger=rewardsAccountReady(customer);
  return (
    <s-stack direction="block" gap="large">
      <s-section>
        <s-box padding="base" background="subdued" borderRadius="large">
          <s-stack direction="block" gap="base">
            <s-heading>Your JILL Rewards</s-heading>
            <s-text color="subdued">
              See your verified points, explore available rewards and
              return to your personal coupon wallet whenever you need.
            </s-text>
            <s-stack direction="inline" gap="small-200">
              <s-button variant="secondary"
                onClick={()=>onNavigate('coupons')}>My Coupons</s-button>
              <s-button variant="secondary"
                onClick={()=>onNavigate('custom-orders')}>Custom Orders</s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>
      {error && <s-banner tone="critical">{error}</s-banner>}
      {storeError && <s-banner tone="critical">Shopify storefront identity is unavailable. Use Now links are disabled.</s-banner>}
      {loading && <s-section><s-text>Loading your verified Rewards account…</s-text></s-section>}
      {!loading && !hasVerifiedLedger && (
        <s-section>
          <s-banner tone="critical">
            We cannot verify your points, wallet, and redemption request together.
            No points have been spent. Reload My JILL to try again.
          </s-banner>
        </s-section>
      )}
      {!loading && hasVerifiedLedger && !error && (
        <RewardsCard customer={customer} meta={meta} loading={false}
          stale={stale} onCustomerUpdate={(next)=>{
            if (next?.id===customer.id) setCustomer(next);
            else {
              setCustomer(null);
              setError('Your Shopify account changed. Reload My JILL before using Rewards.');
            }
          }} store={store} onCoupons={()=>onNavigate('coupons')} />
      )}
      <s-section>
        <s-box padding="base" border="base base solid" borderRadius="large"
          background="base">
          <s-stack direction="block" gap="small-300">
            <s-heading>How your rewards work</s-heading>
            <s-text>
              1. Your points and eligible rewards are checked against
              your signed-in Shopify account.
            </s-text>
            <s-text>
              2. Select an available reward and review the confirmation
              before redeeming any points.
            </s-text>
            <s-text>
              3. After a reward is confirmed in your wallet, open
              My Coupons to review its status and any usage conditions.
            </s-text>
            <s-text color="subdued">
              A pending request is not a usable coupon. Any expiration,
              minimum purchase and discount restrictions are shown in
              the reward or coupon details.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>
    </s-stack>
  );
}
