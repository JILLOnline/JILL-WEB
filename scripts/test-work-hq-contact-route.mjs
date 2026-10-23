import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.contacts.tsx','utf8');
const routes=readFileSync(
 'services/jill-order-desk/app-home/app/routes.ts','utf8');
const nav=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.tsx','utf8');
const intake=readFileSync('backend/work-contact-ticket-intake.mjs','utf8');
const inbox=readFileSync('services/jill-order-desk/work-contact-ticket-inbox.mjs','utf8');
assert.match(routes,/route\("contacts","routes\/app\.contacts\.tsx"\)/);
assert.match(nav,/<NavLink to="\/app\/contacts">Contact Us<\/NavLink>/);
assert.match(route,/JILL_WORK_CONTACT_INBOX_ENABLED==="true"/);
assert.match(route,/readWorkContactTicketInbox\(\{/);
assert.match(route,/authenticateWorkAdminOnce\(\{/);
assert.match(route,/workShopify\(env\)\.authenticate\.admin\(request\)/);
assert.match(route,/Contact Us ticket source is not connected or not authorized/);
assert.match(route,/Replies, unread indicators and customer account ownership/);
assert.doesNotMatch(route,/contact_json|customer_email|contact\[email\]|localStorage|draftOrderCreate|fetch\(/);
assert.match(intake,/if\(enabled!==true\)return respond\(503,'not_connected'\)/);
assert.match(inbox,/if\(enabled!==true\)return output\(503,'not_connected'\)/);
assert.doesNotMatch(route+inbox,/draftOrderCreate|draftOrderInvoiceSend|orderCreate|\.appendRow/);
const detail=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.contacts.$ticketId.tsx','utf8');
assert.match(routes,/route\("contacts\/:ticketId","routes\/app\.contacts\.\$ticketId\.tsx"\)/);
assert.match(route,/encodeURIComponent\(item.ticket_id\)/);
assert.match(detail,/JILL_WORK_CONTACT_INBOX_ENABLED==="true"/);
assert.match(detail,/readWorkContactTicketDetail\(\{/);
assert.match(detail,/authenticateWorkAdminOnce\(\{/);
assert.match(detail,/JILL_WORK_CONTACT_STATUS_ENABLED==="true"/);
assert.match(detail,/handleWorkContactStatusChange/);
assert.match(detail,/expected_revision:ticket.revision/);
assert.match(detail,/crypto.randomUUID\\(\\)/);
assert.match(detail,/encType:"application\\/json"/);
assert.match(detail,/No contact details are displayed/);
assert.match(detail,/Customer identity and reply availability are not yet verified/);
assert.doesNotMatch(detail,/draftOrderCreate|fetch\(|localStorage|orderCreate/);
console.log('PASS HQ WORK Contact Us route and navigation remain gated, authenticated and metadata-only.');
