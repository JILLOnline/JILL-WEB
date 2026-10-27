import {useEffect, useState} from 'preact/hooks';
import {HUB_ROUTES, canonicalRoute, routeFromEntry, extensionRoute} from './routes.mjs';
import Overview from '../pages/Overview.jsx';
import Rewards from '../pages/Rewards.jsx';
import Coupons from '../pages/Coupons.jsx';
import CustomOrders from '../pages/CustomOrders.jsx';
import Messages from '../pages/Messages.jsx';
import ContactRequests from '../pages/ContactRequests.jsx';
import Celebrations from '../pages/Celebrations.jsx';
import SavedPreferences from '../pages/SavedPreferences.jsx';
import Settings from '../pages/Settings.jsx';

// A navigable customer home, not a flat nine-button toolbar. All nine
// registered routes still use the exact same Shopify account page and
// extension:// deep links; groups are presentation only.
const GROUPS=Object.freeze([
 {name:'Your activity',id:'activity'},
 {name:'Rewards & offers',id:'rewards'},
 {name:'Make it yours',id:'personal'},
]);
const NAV_GROUP=Object.freeze({
 overview:'activity','custom-orders':'activity',
 messages:'activity','contact-requests':'activity',
 rewards:'rewards',coupons:'rewards',
 celebrations:'personal',saved:'personal',settings:'personal',
});

// The hub is the one Shopify full-page entrypoint. Screen owners and native
// Shopify account navigation remain unchanged; styling uses platform components.
export default function AccountHub({accountState = null, onRetryVerification = null}) {
  const [route, setRoute] = useState(() => {
    if (typeof navigation === 'undefined') return 'overview';
    return routeFromEntry(navigation.currentEntry);
  });

  // Shared in-memory reply ledger: uncertain delivery op IDs survive screen
  // navigation, but are never stored in a URL, cookie or second database.
  const [conversationDrafts,setConversationDrafts]=useState({});
  // Contact replies have their own ticket-scoped ledger; a fresh signed
  // Contact list re-authorizes it whenever the screen is mounted.
  const [contactDrafts,setContactDrafts]=useState({});
  const [messageRequestTarget,setMessageRequestTarget]=useState(null);
  const [customOrderTarget,setCustomOrderTarget]=useState(null);

  useEffect(() => {
    if (typeof navigation === 'undefined' || !navigation.addEventListener) return;
    const onChange = () => setRoute(routeFromEntry(navigation.currentEntry));
    navigation.addEventListener('currententrychange', onChange);
    return () => navigation.removeEventListener('currententrychange', onChange);
  }, []);

  const onNavigate = (nextRoute,{submissionId}={}) => {
    const id = canonicalRoute(nextRoute);
    // Selection hint only; Messages independently verifies account ownership.
    setMessageRequestTarget(id==='messages'&&typeof submissionId==='string'
      ?submissionId:null);
    setCustomOrderTarget(id==='custom-orders'&&typeof submissionId==='string'
      ?submissionId:null);
    setRoute(id);
    if (typeof navigation !== 'undefined' && navigation.navigate) {
      try {
        const result = navigation.navigate(extensionRoute(id));
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch {
        // Never break in-page tabs if Shopify history is unavailable.
      }
    }
  };

  const screen = {
    overview: <Overview accountState={accountState} onNavigate={onNavigate} />,
    rewards: <Rewards accountState={accountState} onNavigate={onNavigate} />,
    coupons: <Coupons onNavigate={onNavigate} />,
    'custom-orders': <CustomOrders onNavigate={onNavigate}
      requestedSubmissionId={customOrderTarget}
      drafts={conversationDrafts} onDraftsChange={setConversationDrafts} />,
    'contact-requests': <ContactRequests enabled={false} onNavigate={onNavigate}
      drafts={contactDrafts} onDraftsChange={setContactDrafts} />,
    messages: <Messages requestedSubmissionId={messageRequestTarget}
      onNavigate={onNavigate} drafts={conversationDrafts} onDraftsChange={setConversationDrafts} />,
    celebrations: <Celebrations />,
    saved: <SavedPreferences />,
    settings: <Settings onNavigate={onNavigate} />,
  }[canonicalRoute(route)];

  // Navigation grouping cannot alter route IDs or the security boundary.
  // Loading/unverified Shopify principal must not mount account-owned
  // screens, even if the previous hub instance is still in memory.
  const guardedScreen=accountState?.status==='ready'?screen:null;
  const activeRoute=canonicalRoute(route);
  const activeGroup=GROUPS.find(group=>
    group.id===(NAV_GROUP[activeRoute]||'activity'));
  const activeLabel=HUB_ROUTES.find(item=>
    item.id===activeRoute)?.label||'Overview';
  return (
    <s-page heading="My JILL" subheading="Your little corner of JILL — made for every celebration">
      <s-section>
        <s-box padding="base" background="subdued" borderRadius="large">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="small-200"
              justifyContent="space-between" alignItems="center">
              <s-text color="subdued">MY JILL · EXPLORE</s-text>
              <s-badge>{activeGroup?.name||'Your activity'}</s-badge>
            </s-stack>
            <s-select label="Jump to a My JILL section" value={activeRoute}
              onChange={event=>onNavigate(event.currentTarget.value)}>
              {HUB_ROUTES.map(item=>(
                <s-option key={item.id} value={item.id}>
                  {item.label}
                </s-option>
              ))}
            </s-select>
            <s-stack direction="inline" gap="small-200">
              <s-button variant={activeRoute==='overview'?'primary':'secondary'}
                onClick={()=>onNavigate('overview')}>Home</s-button>
              <s-button variant={activeRoute==='custom-orders'?'primary':'secondary'}
                onClick={()=>onNavigate('custom-orders')}>Custom Orders</s-button>
              <s-button variant={activeRoute==='messages'?'primary':'secondary'}
                onClick={()=>onNavigate('messages')}>Messages</s-button>
            </s-stack>
            <s-text color="subdued">
              Viewing {activeLabel}. Find Rewards & offers and
              Make it yours in the section menu.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>
      {accountState?.status === 'loading' && (
        <s-section>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-spinner size="small"/>
            <s-text color="subdued">Checking your verified Shopify account…</s-text>
          </s-stack>
        </s-section>
      )}
      {accountState?.status === 'error' && (
        <s-section>
          <s-stack direction="block" gap="small-200">
            <s-banner tone="critical">
              We couldn't verify your Shopify account. For your privacy,
              your request history and messages are hidden until sign-in
              is verified. No points or coupons were changed.
            </s-banner>
            {typeof onRetryVerification==='function'&&
              <s-button variant="secondary" onClick={onRetryVerification}>
                Try verifying again
              </s-button>}
          </s-stack>
        </s-section>
      )}
      {guardedScreen}
      <s-section>
        <s-box padding="base" background="subdued" borderRadius="large">
          <s-stack direction="block" gap="small-300">
            <s-heading>More of your JILL account</s-heading>
            <s-text color="subdued">Shopify securely manages your regular orders, addresses and sign-in.</s-text>
            <s-stack direction="inline" gap="base">
              <s-link href="shopify:customer-account/orders">Orders</s-link>
              <s-link href="shopify:customer-account/profile">Profile & addresses</s-link>
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>
    </s-page>
  );
}
