import {useEffect, useState} from 'preact/hooks';
import {loadPersonalCoupons,loadPublicPromotionCatalog} from '../../../../shared/customer-coupons.mjs';
import {
  discountCartUrl,loadCustomerAccountStorefront,REWARDS_REFRESH_MS,
} from '../../../../shared/rewards.mjs';

// Canonical My JILL Coupons screen: one authenticated wallet, one public
// promotion feed, and one optional no-code upcoming view.
// A failed refresh retains confirmed data but never retains an actionable link.
const loading = {status:'loading',items:[],stale:false};
function dateLabel(value) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(time))
    : '';
}
function formatUSD(value) {
  return Number(value).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2});
}
function CouponCard({item,kind,store,canUse}) {
  const upcoming=kind==='upcoming';
  const personal=kind==='wallet';
  const usable=canUse && !upcoming && (!personal || item.status==='active') &&
    (!personal || Date.parse(item.expiresAt)>Date.now());
  const expires=personal ? item.expiresAt : item.endsAt;
  const label=upcoming ? 'COMING SOON' : personal ? 'YOUR REWARD' : 'STOREWIDE';
  const title=upcoming ? item.title : personal
    ? (item.value===null ? 'JILL Rewards coupon' : `$${item.value} OFF`)
    : item.summary;
  return (
    <s-box padding="base" background="base" borderRadius="large" border="base base solid">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">{label}</s-text>
            <s-heading>{title}</s-heading>
          </s-stack>
          {upcoming ? <s-badge>Upcoming</s-badge> :
            personal ? <s-badge tone={item.status==='active'?'success':'neutral'}>
              {item.status==='active'?'Ready':item.status}
            </s-badge> : <s-badge tone="success">Available</s-badge>}
        </s-stack>
        {!upcoming && (
          <s-box padding="small-300" background="subdued" borderRadius="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text color="subdued">Code</s-text>
              <s-text type="strong">{item.code}</s-text>
            </s-stack>
          </s-box>
        )}
        <s-stack direction="block" gap="small-100">
          {upcoming && <s-text>{item.summary}</s-text>}
          {personal && <s-text color="subdued">{item.points} points redeemed</s-text>}
          {personal && item.minimum!==null &&
            <s-text color="subdued">{formatUSD(item.minimum)} minimum order</s-text>}
          {!personal && !upcoming && item.details && item.details!==item.summary &&
            <s-text color="subdued">{item.details}</s-text>}
          {upcoming && <s-text color="subdued">Starts {dateLabel(item.startsAt)}</s-text>}
          {expires && <s-text color="subdued">Expires {dateLabel(expires)}</s-text>}
          {upcoming && <s-text color="subdued">The code will become available when this offer launches.</s-text>}
        </s-stack>
        {!upcoming && (personal ? item.status==='active' : true) && (
          <s-button variant="primary"
            href={usable ? discountCartUrl(store,item.code) : undefined}
            disabled={!usable}>{personal?'Use Now':'Use Offer'}</s-button>
        )}
      </s-stack>
    </s-box>
  );
}
function CouponFeed({title,subtitle,feed,kind,store,emptyLabel}) {
  const publicError=kind==='upcoming' ? 'Upcoming offers are temporarily unavailable.' :
    'Current storewide offers are temporarily unavailable.';
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-100">
          <s-heading>{title}</s-heading>
          <s-text color="subdued">{subtitle}</s-text>
        </s-stack>
        {feed.status==='loading' && (
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-spinner size="small"/>
            <s-text color="subdued">Loading {title.toLowerCase()}…</s-text>
          </s-stack>
        )}
        {feed.status==='error' && <s-banner tone="critical">
          {kind==='wallet' ? "We couldn't verify your personal coupons. Refresh to try again." : publicError}
        </s-banner>}
        {feed.status==='ready' && feed.stale && (
          <s-banner tone="warning">
            Your last confirmed {title.toLowerCase()} are shown, but couldn't be refreshed.
            Use Now is disabled until Shopify verifies them again.
          </s-banner>
        )}
        {feed.status==='ready' && !feed.items.length && !feed.stale &&
          <s-text color="subdued">{emptyLabel}</s-text>}
        {feed.status==='ready' && feed.items.map((item)=>(
          <CouponCard key={kind==='upcoming' ? item.title+'-'+item.startsAt : item.code}
            item={item} kind={kind} store={store}
            canUse={Boolean(store)&&!feed.stale}/>
        ))}
      </s-stack>
    </s-section>
  );
}
export default function Coupons({onNavigate}) {
  const [wallet,setWallet]=useState(loading);
  const [publicOffers,setPublicOffers]=useState(loading);
  const [upcomingOffers,setUpcomingOffers]=useState(loading);
  const [store,setStore]=useState('');
  const [storeError,setStoreError]=useState(false);
  useEffect(()=>{
    let active=true;
    let walletBusy=false;
    let publicBusy=false;
    loadCustomerAccountStorefront()
      .then((origin)=>{if(active){setStore(origin);setStoreError(false);}})
      .catch(()=>{if(active){setStore('');setStoreError(true);}});
    const refreshWallet=async()=>{
      if(walletBusy)return;
      walletBusy=true;
      try {
        const items=await loadPersonalCoupons();
        if(active)setWallet({status:'ready',items,stale:false});
      } catch {
        if(active)setWallet((previous)=>previous.status==='ready'
          ? {...previous,stale:true} : {status:'error',items:[],stale:false});
      } finally {walletBusy=false;}
    };
    const refreshPublic=async()=>{
      if(publicBusy)return;
      publicBusy=true;
      try {
        const {offers,upcoming,upcomingError}=await loadPublicPromotionCatalog();
        if(!active)return;
        setPublicOffers({status:'ready',items:offers,stale:false});
        setUpcomingOffers(upcomingError
          ? {status:'error',items:[],stale:false}
          : {status:'ready',items:upcoming,stale:false});
      } catch {
        if(!active)return;
        const staleOrError=(previous)=>previous.status==='ready'
          ? {...previous,stale:true} : {status:'error',items:[],stale:false};
        setPublicOffers(staleOrError);
        setUpcomingOffers(staleOrError);
      } finally {publicBusy=false;}
    };
    refreshWallet();
    refreshPublic();
    const timer=setInterval(()=>{
      refreshWallet();
      refreshPublic();
    },REWARDS_REFRESH_MS);
    return ()=>{active=false;clearInterval(timer);};
  },[]);
  return (
    <s-stack direction="block" gap="base">
      {storeError && <s-banner tone="critical">
        Shopify storefront identity is unavailable. Coupon Use Now links are disabled.
      </s-banner>}
      <CouponFeed title="For you" subtitle="Your personal JILL Rewards coupons."
        kind="wallet" feed={wallet} store={store}
        emptyLabel="You do not have any personal Rewards coupons yet."/>
      <CouponFeed title="Storewide offers" subtitle="Current Shopify promotions available to everyone."
        kind="public" feed={publicOffers} store={store}
        emptyLabel="No verified storewide promotions are available right now."/>
      <CouponFeed title="Upcoming offers" subtitle="A preview of announced JILL offers."
        kind="upcoming" feed={upcomingOffers} store={store}
        emptyLabel="No scheduled JILL offers have been announced yet."/>
      <s-button variant="secondary" onClick={()=>onNavigate('rewards')}>View Rewards</s-button>
    </s-stack>
  );
}
