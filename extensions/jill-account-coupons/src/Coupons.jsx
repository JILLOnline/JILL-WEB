import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import Coupons from '../../jill-account-dashboard/src/pages/Coupons.jsx';

// Compatibility page only: retain existing Shopify page UID and bookmarked URLs.
// The merchant removes this link from the WORK customer-account menu, while
// the canonical My JILL Coupons screen owns all rendering and all data reads.
function LegacyCoupons() {
  const returnToHub=()=>{
    if (typeof navigation !== 'undefined' && typeof navigation.navigate==='function') {
      try { navigation.navigate('extension:jill-account-dashboard/'); }
      catch { /* The explicit Shopify link remains available. */ }
    }
  };
  return (
    <s-page heading="Coupons" subheading="Your coupons now live inside My JILL.">
      <s-section>
        <s-stack direction="block" gap="small">
          <s-text>Find Rewards, coupons and upcoming offers in one place.</s-text>
          <s-button variant="secondary" href="extension:jill-account-dashboard/">
            Open My JILL
          </s-button>
        </s-stack>
      </s-section>
      <Coupons onNavigate={returnToHub} />
    </s-page>
  );
}
export default async () => {
  render(<LegacyCoupons />, document.body);
};
