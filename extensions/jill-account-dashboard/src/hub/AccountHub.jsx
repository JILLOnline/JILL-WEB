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
export default function AccountHub({accountState = null}) {
  const [route, setRoute] = useState(() => {
    if (typeof navigation === 'undefined') return 'overview';
    return routeFromEntry(navigation.currentEntry);
  });

  // Shared in-memory reply ledger: uncertain delivery op IDs survive screen
  // navigation, but are never stored in a URL, cookie or second database.
  const [conversationDrafts,setConversationDrafts]=useState({});
  const [messageRequestTarget,setMessageRequestTarget]=useState(null);

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
      drafts={conversationDrafts} onDraftsChange={setConversationDrafts} />,
    'contact-requests': <ContactRequests enabled={false} onNavigate={onNavigate} />,
    messages: <Messages requestedSubmissionId={messageRequestTarget}
      onNavigate={onNavigate} drafts={conversationDrafts} onDraftsChange={setConversationDrafts} />,
    celebrations: <Celebrations />,
    saved: <SavedPreferences />,
    settings: <Settings onNavigate={onNavigate} />,
  }[canonicalRoute(route)];

  // Navigation grouping cannot alter route IDs or the security boundary.
  const groupedRoutes=HUB_ROUTES.map(item=>({
    ...item,group:NAV_GROUP[item.id]||'activity',
  }));
  return (
    <s-page heading="My JILL" subheading="Your little corner of JILL — made for every celebration">
      <s-section heading="Explore My JILL">
        <s-stack direction="block" gap="base">
          <s-text color="subdued">
            Your account, conversations and rewards—easy to find.
          </s-text>
          <s-box padding="base" background="subdued" borderRadius="large">
            <s-stack direction="block" gap="base">
              {GROUPS.map(group=>(
                <s-stack key={group.id} direction="block" gap="small-200">
                  <s-text color="subdued">{group.name}</s-text>
                  <s-stack direction="inline" gap="small-200">
                    {groupedRoutes.filter(item=>item.group===group.id)
                      .map(item=>(
                      <s-button key={item.id}
                        variant={canonicalRoute(route)===item.id?'primary':'secondary'}
                        onClick={()=>onNavigate(item.id)}>
                        {item.label}
                      </s-button>
                    ))}
                  </s-stack>
                </s-stack>
              ))}
            </s-stack>
          </s-box>
        </s-stack>
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
          <s-banner tone="critical">
            We couldn't load your account details. My JILL is still available.
            Refresh this page to retry. No points or coupons were changed.
          </s-banner>
        </s-section>
      )}
      {screen}
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
