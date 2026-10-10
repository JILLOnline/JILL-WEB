import {useEffect, useState} from 'preact/hooks';
import {loadPersonalCoupons, loadPublicPromotions} from '../../../../shared/customer-coupons.mjs';

// Distinct data boundaries: a public-promotion outage cannot erase the
// authenticated personal wallet, and wallet failure never means zero coupons.
const initial = {status:'loading',items:[]};
function CouponFeed({title,feed,emptyLabel,kind}) {
  return (
    <s-section heading={title}>
      <s-stack direction="block" gap="base">
        {feed.status==='loading' && <s-text>Loading {title.toLowerCase()}…</s-text>}
        {feed.status==='error' && (
          <s-banner tone="critical">
            {kind==='wallet'
              ? 'We couldn\'t verify your personal coupons. Refresh to try again.'
              : 'Current storewide offers are temporarily unavailable. Refresh to try again.'}
          </s-banner>
        )}
        {feed.status==='ready' && feed.items.length===0 && <s-text>{emptyLabel}</s-text>}
        {feed.status==='ready' && feed.items.map((item)=>(
          <s-stack direction="block" gap="small" key={kind+'-'+item.code}>
            <s-heading>{kind==='wallet'
              ? (item.value === null ? 'JILL Rewards coupon' : `$${item.value} OFF`)
              : item.summary}
            </s-heading>
            <s-text>Code: {item.code}</s-text>
            {kind==='wallet' && (
              <s-text>
                {item.points} points · {item.status} ·
                {item.minimum===null ? ' Minimum order unavailable' : ` Minimum order $${item.minimum}`}
              </s-text>
            )}
            {kind==='public' && item.details && <s-text>{item.details}</s-text>}
            {(kind==='wallet' ? item.expiresAt : item.endsAt) && (
              <s-text>
                {kind==='wallet' ? 'Expires' : 'Offer ends'}:
                {' '}{String(kind==='wallet' ? item.expiresAt : item.endsAt).slice(0,10)}
              </s-text>
            )}
          </s-stack>
        ))}
        {kind==='wallet' && (
          <s-banner tone="info">
            Coupon activation and Use Now are disabled until the WORK redemption
            and checkout tests pass. Viewing codes does not spend points.
          </s-banner>
        )}
      </s-stack>
    </s-section>
  );
}

export default function Coupons({onNavigate}) {
  const [wallet,setWallet] = useState(initial);
  const [publicOffers,setPublicOffers] = useState(initial);
  useEffect(()=>{
    let active=true;
    loadPersonalCoupons()
      .then((items)=>{if(active)setWallet({status:'ready',items});})
      .catch(()=>{if(active)setWallet({status:'error',items:[]});});
    loadPublicPromotions()
      .then((items)=>{if(active)setPublicOffers({status:'ready',items});})
      .catch(()=>{if(active)setPublicOffers({status:'error',items:[]});});
    return ()=>{active=false;};
  },[]);
  return (
    <s-stack direction="block" gap="base">
      <CouponFeed title="For you" kind="wallet" feed={wallet}
        emptyLabel="You do not have any personal Rewards coupons yet." />
      <CouponFeed title="Storewide offers" kind="public" feed={publicOffers}
        emptyLabel="No verified storewide promotions are available right now." />
      <s-button onClick={()=>onNavigate('rewards')}>View Rewards</s-button>
    </s-stack>
  );
}
