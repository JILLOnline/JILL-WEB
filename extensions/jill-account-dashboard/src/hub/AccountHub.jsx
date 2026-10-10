import {useEffect, useState} from 'preact/hooks';
import {HUB_ROUTES, canonicalRoute, routeFromEntry, extensionRoute} from './routes.mjs';
import Overview from '../pages/Overview.jsx';
import Rewards from '../pages/Rewards.jsx';
import Coupons from '../pages/Coupons.jsx';
import CustomOrders from '../pages/CustomOrders.jsx';
import Celebrations from '../pages/Celebrations.jsx';
import SavedPreferences from '../pages/SavedPreferences.jsx';
import Settings from '../pages/Settings.jsx';

// One page entrypoint; each feature has one internal screen owner.
// WORK preview never calls an Admin endpoint or performs a reward mutation.
export default function AccountHub({accountState = null}) {
  const [route, setRoute] = useState(() => {
    if (typeof navigation === 'undefined') return 'overview';
    return routeFromEntry(navigation.currentEntry);
  });

  useEffect(() => {
    if (typeof navigation === 'undefined' || !navigation.addEventListener) return;
    const onChange = () => setRoute(routeFromEntry(navigation.currentEntry));
    navigation.addEventListener('currententrychange', onChange);
    return () => navigation.removeEventListener('currententrychange', onChange);
  }, []);

  const onNavigate = (nextRoute) => {
    const id = canonicalRoute(nextRoute);
    setRoute(id); // Works in preview even when Shopify doesn't expose history.
    if (typeof navigation !== 'undefined' && navigation.navigate) {
      try {
        const result = navigation.navigate(extensionRoute(id));
        if (result && typeof result.catch === 'function') {
          result.catch(() => {}); // Keep local tab functional if route host rejects history.
        }
      } catch {
        // Navigation remains local to this already authenticated page.
      }
    }
  };

  const screen = {
    overview: <Overview accountState={accountState} onNavigate={onNavigate} />,
    rewards: <Rewards accountState={accountState} onNavigate={onNavigate} />,
    coupons: <Coupons onNavigate={onNavigate} />,
    'custom-orders': <CustomOrders />,
    celebrations: <Celebrations />,
    saved: <SavedPreferences />,
    settings: <Settings onNavigate={onNavigate} />,
  }[canonicalRoute(route)];

  return (
    <s-page heading="My JILL" subheading="Your JILL account, all in one place">
      <s-section heading="Explore My JILL">
        <s-stack direction="inline" gap="base">
          {HUB_ROUTES.map((item) => (
            <s-button key={item.id}
              variant={route === item.id ? 'primary' : 'secondary'}
              onClick={() => onNavigate(item.id)}>
              {item.label}
            </s-button>
          ))}
        </s-stack>
      </s-section>
      {accountState?.status === 'loading' && (
        <s-section>
          <s-text>Loading your authenticated Shopify account…</s-text>
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
      <s-section heading="Your Shopify account">
        <s-stack direction="block" gap="base">
          <s-text>Orders, addresses and sign-in remain securely managed by Shopify.</s-text>
          <s-stack direction="inline" gap="base">
            <s-link href="shopify:customer-account/orders">Orders</s-link>
            <s-link href="shopify:customer-account/profile">Profile & addresses</s-link>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}
