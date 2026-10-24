import RecentRequests from './RecentRequests.jsx';

// Customer home is a read-only composition of independently verified sources.
// Rewards value comes only from the Shopify Customer Account summary;
// recent requests have their own signed Customer Account JWT read.
export default function Overview({accountState,onNavigate}){
 const summary=accountState?.status==='ready'?accountState.summary:null;
 const name=typeof summary?.displayName==='string'&&summary.displayName.trim()
  ? ', '+summary.displayName.trim().slice(0,60):'';
 const points=Number.isSafeInteger(summary?.pointsBalance)&&
  summary.pointsBalance>=0?summary.pointsBalance:null;
 const balance=accountState?.status==='loading'?'Checking…':
  accountState?.status==='error'?'Unavailable':
  points===null?'Not available':points.toLocaleString()+' points';
 return <s-stack direction="block" gap="large">
  <s-section>
   <s-box padding="base" background="subdued" borderRadius="large">
    <s-stack direction="block" gap="base">
     <s-text color="subdued">YOUR SPACE AT JILL</s-text>
     <s-heading>Welcome back{name} ✨</s-heading>
     <s-text>Every celebration starts somewhere. Find your requests,
      messages, rewards and favorite ideas together.</s-text>
     <s-stack direction="inline" gap="small-200">
      <s-button variant="primary"
       onClick={()=>onNavigate('custom-orders')}>My Custom Orders</s-button>
      <s-button variant="secondary"
       onClick={()=>onNavigate('messages')}>My Messages</s-button>
     </s-stack>
     <s-text color="subdued">
      Your regular purchases and addresses stay securely managed by Shopify.
     </s-text>
    </s-stack>
   </s-box>
  </s-section>

  <s-section heading="Your JILL activity">
   <RecentRequests onNavigate={onNavigate}/>
  </s-section>

  <s-section heading="Your Rewards & offers">
   <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="base">
    <s-box padding="base" background="base" borderRadius="large"
     border="base base solid">
     <s-stack direction="block" gap="small-300">
      <s-text color="subdued">SHOPIFY ACCOUNT POINTS</s-text>
      <s-heading>{balance}</s-heading>
      <s-text color="subdued">
       This is the account summary, not a redemption confirmation.
       Rewards verifies the wallet before any points are spent.
      </s-text>
      <s-button variant="primary" onClick={()=>onNavigate('rewards')}>
       Explore Rewards
      </s-button>
     </s-stack>
    </s-box>
    <s-box padding="base" background="base" borderRadius="large"
     border="base base solid">
     <s-stack direction="block" gap="small-300">
      <s-text color="subdued">YOUR JILL OFFERS</s-text>
      <s-heading>Coupons & promotions</s-heading>
      <s-text color="subdued">
       View verified personal rewards, storewide offers and upcoming
       promotions. Availability is checked in Coupons.
      </s-text>
      <s-button variant="secondary" onClick={()=>onNavigate('coupons')}>
       Open Coupons
      </s-button>
     </s-stack>
    </s-box>
   </s-grid>
  </s-section>

  <s-section heading="Explore more at JILL">
   <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="base">
    <s-box padding="base" background="subdued" borderRadius="large">
     <s-stack direction="block" gap="small-300">
      <s-heading>Contact Requests</s-heading>
      <s-badge>Not connected yet</s-badge>
      <s-text color="subdued">
       Your website inquiries will appear only after we securely verify
       account ownership. We never attach guest tickets by email alone.
      </s-text>
      <s-button variant="secondary"
       onClick={()=>onNavigate('contact-requests')}>View connection status</s-button>
     </s-stack>
    </s-box>
    <s-box padding="base" background="subdued" borderRadius="large">
     <s-stack direction="block" gap="small-300">
      <s-heading>Celebrations & favorites</s-heading>
      <s-badge>Coming later</s-badge>
      <s-text color="subdued">
       A place for your important dates, favorite themes and personal
       touches—without saving anything until you choose to.
      </s-text>
      <s-stack direction="inline" gap="small-200">
       <s-button variant="secondary"
        onClick={()=>onNavigate('celebrations')}>Celebrations</s-button>
       <s-button variant="secondary"
        onClick={()=>onNavigate('saved')}>Saved for You</s-button>
      </s-stack>
     </s-stack>
    </s-box>
   </s-grid>
  </s-section>

  <s-section>
   <s-box padding="base" background="base" border="base base solid"
    borderRadius="large">
    <s-stack direction="block" gap="small-300">
     <s-heading>Looking for a regular purchase?</s-heading>
     <s-text color="subdued">Shopify keeps your completed purchases,
      delivery information, profile and addresses in your secure account.
      Custom requests are tracked separately above.</s-text>
     <s-stack direction="inline" gap="base">
      <s-link href="shopify:customer-account/orders">Shopify Orders</s-link>
      <s-link href="shopify:customer-account/profile">Profile & addresses</s-link>
     </s-stack>
    </s-stack>
   </s-box>
  </s-section>
 </s-stack>;
}
