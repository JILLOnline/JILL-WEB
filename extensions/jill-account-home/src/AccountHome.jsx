import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

import {loadCustomerAccountStorefront} from '../../../shared/rewards.mjs';


export default function extension() {
  render(<JillSettingsHeader />, document.body);
}

function JillSettingsHeader() {
  const [store, setStore] = useState('');
  useEffect(() => {
    let active = true;
    loadCustomerAccountStorefront()
      .then((origin) => { if (active) setStore(origin); })
      .catch((error) => console.warn('JILL Settings storefront unavailable', error));
    return () => { active = false; };
  }, []);
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
          <s-stack direction="block" gap="small-200">
            <s-heading>JILL Settings</s-heading>
            <s-text color="subdued">
              Keep your contact information, addresses, marketing preferences, and account access up to date.
            </s-text>
          </s-stack>
          <s-badge tone="info">JILL ★</s-badge>
        </s-stack>

        <s-stack direction="inline" gap="base">
          <s-button variant="primary" href="extension:jill-account-dashboard/">Dashboard</s-button>
          {store && <s-button href={store}>Back to JILL</s-button>}
          {store && <s-button href={`${store}/pages/contact`}>Contact JILL</s-button>}
        </s-stack>
      </s-stack>
    </s-section>
  );
}
