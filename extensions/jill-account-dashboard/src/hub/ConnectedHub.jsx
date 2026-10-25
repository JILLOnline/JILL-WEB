import {useEffect,useRef,useState} from 'preact/hooks';
import {loadAccountHubScopedSummary}
 from '../../../../shared/customer-account-api.mjs';
import AccountHub from './AccountHub.jsx';

// A verified Shopify Customer Account GID only partitions ephemeral hub
// state. It is NEVER displayed, used as endpoint ownership or persisted.
// The signed Custom Order/Contact readers remain independent authorities.
export default function ConnectedHub(){
  const [accountState,setAccountState]=useState({
    status:'loading',summary:null,scope:null,
  });
  const currentRead=useRef(0);
  useEffect(()=>{
    let active=true;
    const refreshAccount=()=>{
      const generation=++currentRead.current;
      // Hide account-owned screens while a new Shopify principal is checked.
      // Preserve drafts only provisionally; the verified scope decides
      // whether the existing AccountHub may survive the next response.
      setAccountState(previous=>({
        status:'loading',summary:null,scope:previous.scope,
      }));
      loadAccountHubScopedSummary()
        .then(({principal,summary})=>{
          if(!active||generation!==currentRead.current)return;
          setAccountState({status:'ready',scope:principal,summary});
        })
        .catch(()=>{
          if(!active||generation!==currentRead.current)return;
          // A missing/changed session invalidates all in-memory drafts:
          // "unverified" AccountHub gets a fresh key, never an old owner.
          setAccountState({status:'error',scope:null,summary:null});
        });
    };
    refreshAccount();
    const nav=typeof navigation!=='undefined'?navigation:null;
    nav?.addEventListener?.('currententrychange',refreshAccount);
    const onVisibility=()=>{
      if(typeof document!=='undefined'&&document.visibilityState==='visible')
        refreshAccount();
    };
    if(typeof document!=='undefined')
      document.addEventListener('visibilitychange',onVisibility);
    return ()=>{
      active=false;
      currentRead.current++;
      nav?.removeEventListener?.('currententrychange',refreshAccount);
      if(typeof document!=='undefined')
        document.removeEventListener('visibilitychange',onVisibility);
    };
  },[]);
  return <AccountHub key={accountState.scope??'unverified'}
    accountState={accountState}/>;
}
