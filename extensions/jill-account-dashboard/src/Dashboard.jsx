import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import ConnectedHub from './hub/ConnectedHub.jsx';

// One full-page Shopify customer-account entrypoint. The My JILL hub owns
// navigation; RewardsCard owns the only redemption UI/state machine.
// App release is gated on authenticated WORK browser and checkout QA.
export default async () => {
  render(<ConnectedHub />, document.body);
};
