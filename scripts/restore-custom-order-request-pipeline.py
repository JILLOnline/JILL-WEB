from pathlib import Path

SECTION = Path('theme/sections/main-custom-order.liquid')
RUNTIME = Path('theme/assets/jill-custom-order.js')
TESTS = Path('scripts/test-custom-order-integration.mjs')

CANONICAL_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwjFDQxhjc4RDu8T0gSweQf70Y5TheTyWZ6KoVDux6Hx-Ue9jdE7E5Enl5nyxjJpo2W/exec'
DEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/exec'

section = SECTION.read_text()
if CANONICAL_ENDPOINT not in section:
    raise SystemExit('Canonical Custom Order endpoint is not present in the section')
if DEAD_ENDPOINT in section:
    raise SystemExit('Dead Apps Script deployment leaked into Custom Order')

success_anchor = '  <section class="jill-custom-order__success jill-card" data-jill-custom-order-success hidden aria-hidden="true" role="status">'
notification_markup = '''  <div data-jill-owner-notification hidden aria-hidden="true">
    {% form 'contact', id: 'JillCustomOrderOwnerNotification' %}
      <input type="hidden" name="contact[name]" value="">
      <input type="hidden" name="contact[email]" value="">
      <input type="hidden" name="contact[body]" value="">
    {% endform %}
  </div>

'''
if notification_markup not in section:
    if success_anchor not in section:
        raise SystemExit('Custom Order success anchor not found')
    section = section.replace(success_anchor, notification_markup + success_anchor, 1)
SECTION.write_text(section)

runtime = RUNTIME.read_text()
old_submit = '''  async function submitRequest(root, request) {
    const endpoint = String(root.dataset.submitEndpoint || '').trim();
    if (!endpoint) fail('submission is temporarily unavailable');
    const body = new URLSearchParams();
    Object.entries(endpointPayload(request)).forEach(([key, value]) => body.set(key, String(value ?? '')));
    await fetch(endpoint, {method: 'POST', mode: 'no-cors', keepalive: true, body});
  }
'''
new_submit = '''  function ownerNotificationBody(request) {
    const payload = endpointPayload(request);
    const location = [payload.city, payload.state, payload.zip].filter(Boolean).join(', ');
    return [
      'New JILL Custom Order Request',
      '',
      `Submission ID: ${payload.submission_id}`,
      `Submitted: ${payload.submitted_at}`,
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      `Phone: ${payload.phone || '—'}`,
      `Preferred contact: ${payload.preferred_contact || '—'}`,
      `Order type: ${payload.order_type || '—'}`,
      `Date needed: ${payload.date_needed || '—'}`,
      `Fulfillment: ${payload.fulfillment || '—'}`,
      `Location: ${location || '—'}`,
      `Collections: ${payload.collections || '—'}`,
      '',
      'Products:',
      payload.products || '—',
      '',
      `Theme: ${payload.theme || '—'}`,
      `Colors: ${payload.colors || '—'}`,
      `Personalization: ${payload.personalization || '—'}`,
      `Reference images: ${payload.reference_images || 'No'}`,
      'Reference links:',
      payload.reference_image_links || 'None',
      `Reference instructions: ${payload.reference_instructions || '—'}`,
      `Budget: ${payload.budget || '—'}`,
      `Priority: ${payload.priority || '—'}`,
      `Recommend matching items: ${payload.recommend_matching || '—'}`,
      `Notes: ${payload.notes || '—'}`,
      `Marketing consent: ${payload.marketing_consent || 'No'}`,
    ].join('\\n');
  }

  async function submitOwnerNotification(root, request) {
    const ownerNotification = root.querySelector('[data-jill-owner-notification]');
    const form = ownerNotification?.querySelector('form');
    const name = form?.querySelector('[name="contact[name]"]');
    const email = form?.querySelector('[name="contact[email]"]');
    const body = form?.querySelector('[name="contact[body]"]');
    if (!form || !name || !email || !body) fail('store notification is temporarily unavailable');

    name.value = request.customer.name || 'Custom Order Request';
    email.value = request.customer.email || '';
    body.value = ownerNotificationBody(request);

    const response = await fetch(form.action, {
      method: 'POST',
      credentials: 'same-origin',
      body: new FormData(form),
    });
    if (!response.ok) fail('store notification could not be delivered');
  }

  async function submitRequest(root, request) {
    const endpoint = String(root.dataset.submitEndpoint || '').trim();
    if (!endpoint) fail('submission is temporarily unavailable');
    const body = new URLSearchParams();
    Object.entries(endpointPayload(request)).forEach(([key, value]) => body.set(key, String(value ?? '')));
    await fetch(endpoint, {method: 'POST', mode: 'no-cors', keepalive: true, body});
    await submitOwnerNotification(root, request);
  }
'''
if old_submit not in runtime:
    raise SystemExit('Custom Order submitRequest anchor not found')
runtime = runtime.replace(old_submit, new_submit, 1)
RUNTIME.write_text(runtime)

tests = TESTS.read_text()
assertions = r'''
assert.match(section, /https:\/\/script\.google\.com\/macros\/s\/AKfycbwjFDQxhjc4RDu8T0gSweQf70Y5TheTyWZ6KoVDux6Hx-Ue9jdE7E5Enl5nyxjJpo2W\/exec/, 'Custom Order must retain the canonical Apps Script deployment');
assert.doesNotMatch(section, /AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/, 'Custom Order must not use the dead Apps Script deployment');
assert.match(section, /data-jill-owner-notification/, 'Custom Order must retain the native Shopify owner-notification lane');
assert.match(runtime, /function ownerNotificationBody[\s\S]*endpointPayload\(request\)/, 'merchant notification must derive from the normalized request payload');
assert.match(runtime, /function submitOwnerNotification/, 'Custom Order must own one merchant-notification submit path');
assert.match(runtime, /await submitOwnerNotification\(root, request\)/, 'Custom Order success must wait for the merchant notification submission');
'''
marker = "console.log('JILL Custom Order LIVE-parity integration tests passed.');"
if assertions.strip() not in tests:
    if marker not in tests:
        raise SystemExit('Custom Order test completion marker not found')
    tests = tests.replace(marker, assertions + '\n' + marker, 1)
TESTS.write_text(tests)
