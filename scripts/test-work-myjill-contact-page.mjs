import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HUB_ROUTES,canonicalRoute,extensionRoute,routeFromEntry}
 from '../extensions/jill-account-dashboard/src/hub/routes.mjs';
import {loadWorkCustomerContactTickets}
 from '../shared/customer-contact-tickets.mjs';
const route=HUB_ROUTES.filter(x=>x.id==='contact-requests');
assert.equal(route.length,1);
assert.equal(canonicalRoute('contact-requests'),'contact-requests');
assert.equal(extensionRoute('contact-requests'),'extension://contact-requests');
assert.equal(routeFromEntry({url:'extension://contact-requests'}),'contact-requests');
const hub=readFileSync(
 'extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
const page=readFileSync(
 'extensions/jill-account-dashboard/src/pages/ContactRequests.jsx','utf8');
const overview=readFileSync(
 'extensions/jill-account-dashboard/src/pages/Overview.jsx','utf8');
assert.match(hub,/import ContactRequests from '\.\.\/pages\/ContactRequests\.jsx'/);
assert.match(hub,/'contact-requests': <ContactRequests enabled=\{false\}/);
assert.match(overview,/onNavigate\('contact-requests'\)/);
assert.match(page,/Contact Us history is not connected to My JILL yet/);
assert.match(page,/enabled:enabled===true,sessionToken,signal:controller\.signal/);
assert.match(page,/active=false;controller\.abort\(\)/);
assert.match(page,/No other account's/);
assert.match(page,/Filter verified Contact Requests/);
assert.match(page,/ticketFilter==='open'/);
assert.match(page,/ticket.status!=='resolved'/);
assert.match(page,/filteredTickets.map/);
assert.match(page,/Tracking revision \\{ticket.revision\\}/);
assert.match(page,/No verified tickets match this filter/);
assert.doesNotMatch(page+hub,/draftOrderCreate|fetch\(|customer\.email|localStorage|sessionStorage/);
let reads=0;
const state=await loadWorkCustomerContactTickets({
 sessionToken:{get:async()=>{reads++;return 'x'.repeat(50);}},
 request:async()=>{reads++;throw Error('should never fetch');},
});
assert.equal(state.state,'not_connected');
assert.equal(reads,0,'default OFF may not even acquire a Shopify JWT');
console.log('PASS My JILL Contact Requests: customer navigation, hard OFF, no fake history or private account reads.');
