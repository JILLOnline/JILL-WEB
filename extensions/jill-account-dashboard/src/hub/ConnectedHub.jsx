import {useEffect, useState} from 'preact/hooks';
import {loadAccountHubSummary} from '../../../../shared/customer-account-api.mjs';
import AccountHub from './AccountHub.jsx';

// Optional read-only feature boundary: if Shopify rejects the query, the
// proven My JILL shell stays mounted instead of crashing the full page.
// No redemption, Admin API call or retry loop runs from this component.
export default function ConnectedHub() {
  const [accountState, setAccountState] = useState({status: 'loading'});

  useEffect(() => {
    let active = true;
    loadAccountHubSummary()
      .then((summary) => {
        if (active) setAccountState({status: 'ready', summary});
      })
      .catch(() => {
        if (active) setAccountState({status: 'error'});
      });
    return () => { active = false; };
  }, []);

  return <AccountHub accountState={accountState} />;
}
