import RecentRequests from './RecentRequests.jsx';

// Presentation only: status and Rewards counts come exclusively from the
// already verified signed-in Shopify account and request readers.
// Shopify-native elements preserve mobile sizing and account accessibility.
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
   <s-box padding="large" background="subdued" borderRadius="large">
    <s-stack direction="block" gap="base">
     <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-badge>MY JILL</s-badge>
      <s-text color="subdued">Your celebration corner</s-text>
     </s-stack>
     <s-heading>Welcome back{name} ✨</s-heading>
     <s-text>
      Your ideas, custom creations and happy little details—all
      together in one place.
     </s-text>
     <s-stack direction="inline" gap="small-200">
      <s-button variant="primary"
       onClick={()=>onNavigate('custom-orders')}>My Custom Orders</s-button>
      <s-button variant="secondary"
       onClick={()=>onNavigate('messages')}>Open Messages</s-button>
     </s-stack>
     <s-text color="subdued">
      Regular purchases and addresses stay securely managed by Shopify.
     </s-text>
    </s-stack>
   </s-box>
  </s-section>

  <s-section heading="Pick up where you left off">
   <RecentRequests onNavigate={onNavigate}/>
  </s-section>

  <s-section heading="A little extra for you">
   <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="base">
    <s-box padding="base" background="base"
     border="base base solid" borderRadius="large">
     <s-stack direction="block" gap="small-300">
      <s-stack direction="inline" justifyContent="space-between"
       alignItems="center" gap="small-200">
       <s-text color="subdued">YOUR REWARDS BALANCE</s-text>
       <s-badge>Rewards</s-badge>
      </s-stack>
      <s-heading>{balance}</s-heading>
      <s-text color="subdued">
       Your signed-in account summary. The Rewards wallet is checked
       separately before any redemption.
      </s-text>
      <s-button variant="primary" onClick={()=>onNavigate('rewards')}>
       See my Rewards
      </s-button>
     </s-stack>
    </s-box>
    <s-box padding="base" background="base"
     border="base base solid" borderRadius="large">
     <s-stack direction="block" gap="small-300">
      <s-text color="subdued">SOMETHING SPECIAL</s-text>
      <s-heading>Coupons & offers</s-heading>
      <s-text color="subdued">
       Your personal reward wallet and available JILL promotions,
       verified when you open Coupons.
      </s-text>
      <s-button variant="secondary" onClick={()=>onNavigate('coupons')}>
       Explore Coupons
      </s-button>
     </s-stack>
    </s-box>
   </s-grid>
  </s-section>

  <s-section heading="More ways to celebrate">
   <s-stack direction="block" gap="base">
    <s-box padding="base" background="subdued" borderRadius="large">
     <s-stack direction="block" gap="small-300">
      <s-stack direction="inline" alignItems="center"
       justifyContent="space-between" gap="small-200">
       <s-heading>Contact Requests</s-heading>
       <s-badge>Not connected yet</s-badge>
      </s-stack>
      <s-text color="subdued">
       Website inquiries will appear after account ownership is
       verified. Guest tickets are never linked by email alone.
      </s-text>
      <s-button variant="secondary"
       onClick={()=>onNavigate('contact-requests')}>Connection status</s-button>
     </s-stack>
    </s-box>
    <s-box padding="base" background="subdued" borderRadius="large">
     <s-stack direction="block" gap="small-300">
      <s-stack direction="inline" alignItems="center"
       justifyContent="space-between" gap="small-200">
       <s-heading>Your celebrations & favorites</s-heading>
       <s-badge>Coming later</s-badge>
      </s-stack>
      <s-text color="subdued">
       Your future place for favorite themes, special dates and
       creative ideas—nothing is saved without your choice.
      </s-text>
      <s-stack direction="inline" gap="small-200">
       <s-button variant="secondary"
        onClick={()=>onNavigate('celebrations')}>Celebrations</s-button>
       <s-button variant="secondary"
        onClick={()=>onNavigate('saved')}>Saved for You</s-button>
      </s-stack>
     </s-stack>
    </s-box>
   </s-stack>
  </s-section>

  <s-section>
   <s-box padding="base" background="base"
    border="base base solid" borderRadius="large">
    <s-stack direction="block" gap="small-300">
     <s-heading>Your everyday JILL orders</s-heading>
     <s-text color="subdued">
      Shopify purchases and addresses live in your secure
      customer account. Custom requests are tracked above.
     </s-text>
     <s-stack direction="inline" gap="base">
      <s-link href="shopify:customer-account/orders">Shopify Orders</s-link>
      <s-link href="shopify:customer-account/profile">Profile & addresses</s-link>
     </s-stack>
    </s-stack>
   </s-box>
  </s-section>
 </s-stack>;
}
