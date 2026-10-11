import {useEffect, useState} from 'preact/hooks';
import {loadPersonalCoupons, loadPublicPromotionCatalog} from '../../../../shared/customer-coupons.mjs';
import {discountCartUrl,loadCustomerAccountStorefront} from '../../../../shared/rewards.mjs';

// Distinct data boundaries: a public-promotion outage cannot erase the
// authenticated personal wallet, and wallet failure never means zero coupons.
const initial = {status:'loading',items:[]};
function CouponFeed({title,feed,emptyLabel,kind,store}) {
  return (
    <s-section heading={title}>
      <s-stack direction="block" gap="base">
        {feed.status==='loading' && <s-text>Loading {title.toLowerCase()}…</s-text>}
        {feed.status==='error' && (
          <s-banner tone="critical">
            {kind==='wallet'
              ? 'We couldn\'t verify your personal coupons. Refresh to try again.'
              : kind==='upcoming'
                ? 'Upcoming offers are temporarily unavailable. Refresh to try again.'
                : 'Current storewide offers are temporarily unavailable. Refresh to try again.'}
          </s-banner>
        )}
        {feed.status==='ready' && feed.items.length===0 && <s-text>{emptyLabel}</s-text>}
        {feed.status==='ready' && feed.items.map((item)=>(
          <s-stack direction="block" gap="small" key={kind+'-'+item.code}>
            <s-heading>{kind==='wallet'
              ? (item.value === null ? 'JILL Rewards coupon' : `${item.value} OFF`)
              : kind==='upcoming' ? item.title : item.summary}
            </s-heading>
            {kind!=='upcoming' && <s-text>Code: {item.code}</s-text>}
            {kind==='upcoming' && (
              <s-stack direction="block" gap="small">
                <s-text>{item.summary}</s-text>
                <s-text>Starts: {String(item.startsAt).slice(0,10)}</s-text>
                {item.endsAt && <s-text>Ends: {String(item.endsAt).slice(0,10)}</s-text>}
                <s-text>Coming soon — code not available until launch.</s-text>
              </s-stack>
            )}
            {kind==='wallet' && (
              <s-text>
                {item.points} points · {item.status} ·
                {item.minimum===null ? ' Minimum order unavailable' : ` Minimum order $${item.minimum}`}
              </s-text>
            )}
            {kind==='public' && item.details && <s-text>{item.details}</s-text>}
            {kind!=='upcoming' && (kind==='public' || item.status==='active') && (
              <s-button variant={kind==='wallet' ? 'primary' : 'secondary'}
                href={store ? discountCartUrl(store,item.code) : undefined}
                disabled={!store}>
                {kind==='wallet' ? 'Use Now' : 'Use Offer'}
              </s-button>
            )}
            {(kind==='wallet' ? item.expiresAt : item.endsAt) && (
              <s-text>
                {kind==='wallet' ? 'Expires' : 'Offer ends'}:
                {' '}{String(kind==='wallet' ? item.expiresAt : item.endsAt).slice(0,10)}
              </s-text>
            )}
          </s-stack>
        ))}
        {kind==='wallet' && (
          <s-text>
            Using a code opens your Shopify cart. Discounts remain controlled by
            Shopify's cart and checkout rules until removed, used or expired.
          </s-text>
        )}
      </s-stack>
    </s-section>
  );
}

export default function Coupons({onNavigate}) {
  const [wallet,setWallet] = useState(initial);
  const [publicOffers,setPublicOffers] = useState(initial);
  const [upcomingOffers,setUpcomingOffers] = useState(initial);
  const [store,setStore] = useState('');
  const [storeError,setStoreError] = useState(false);
  useEffect(()=>{
    let active=true;
    loadCustomerAccountStorefront()
      .then((origin)=>{if(active){setStore(origin);setStoreError(false);}})
      .catch(()=>{if(active)setStoreError(true);});
    loadPersonalCoupons()
      .then((items)=>{if(active)setWallet({status:'ready',items});})
      .catch(()=>{if(active)setWallet({status:'error',items:[]});});
    loadPublicPromotionCatalog()
      .then(({offers,upcoming,upcomingError})=>{
        if (!active) return;
        setPublicOffers({status:'ready',items:offers});
        setUpcomingOffers(upcomingError
          ? {status:'error',items:[]}
          : {status:'ready',items:upcoming});
      })
      .catch(()=>{
        if(active){
          setPublicOffers({status:'error',items:[]});
          setUpcomingOffers({status:'error',items:[]});
        }
      });
    return ()=>{active=false;};
  },[]);
  return (
    <s-stack direction="block" gap="base">
      {storeError && <s-banner tone="critical">Shopify storefront identity is unavailable. Coupon Use Now links are disabled.</s-banner>}
      <CouponFeed title="For you" kind="wallet" feed={wallet}
        emptyLabel="You do not have any personal Rewards coupons yet." store={store} />
      <CouponFeed title="Storewide offers" kind="public" feed={publicOffers}
        emptyLabel="No verified storewide promotions are available right now." store={store} />
      <CouponFeed title="Upcoming offers" kind="upcoming" feed={upcomingOffers}
        emptyLabel="No scheduled JILL offers have been announced yet." store={store} />
      <s-button onClick={()=>onNavigate('rewards')}>View Rewards</s-button>
    </s-stack>
  );
}
