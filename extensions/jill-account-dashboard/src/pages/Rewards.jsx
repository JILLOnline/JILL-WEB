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
    <s-stack direction="block" gap="base">
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
    </s-stack>
  );
}
