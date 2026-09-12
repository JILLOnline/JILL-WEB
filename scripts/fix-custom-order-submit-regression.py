from pathlib import Path

runtime_path = Path('theme/assets/jill-custom-order.js')
section_path = Path('theme/sections/main-custom-order.liquid')
test_path = Path('scripts/test-custom-order-integration.mjs')

runtime = runtime_path.read_text()
start = runtime.find('  function ownerNotificationBody(request) {')
end = runtime.find('  async function submitRequest(root, request) {', start)
if start < 0 or end < 0:
    raise SystemExit('secondary owner-notification runtime block not found')
runtime = runtime[:start] + runtime[end:]

old_submit_request = """    await fetch(endpoint, {method: 'POST', mode: 'no-cors', keepalive: true, body});
    await submitOwnerNotification(root, request);
"""
new_submit_request = """    await fetch(endpoint, {method: 'POST', mode: 'no-cors', keepalive: true, body});
"""
if old_submit_request not in runtime:
    raise SystemExit('secondary owner-notification call not found')
runtime = runtime.replace(old_submit_request, new_submit_request, 1)

old_submit = """      try {
        request = cleanUndefined(buildRequest(root));
        await submitRequest(root, request);
"""
new_submit = """      try {
        const submissionId = request.submission_id;
        const nextRequest = cleanUndefined(buildRequest(root));
        nextRequest.submission_id = submissionId;
        request = nextRequest;
        await submitRequest(root, request);
"""
if old_submit not in runtime:
    raise SystemExit('submit retry identity anchor not found')
runtime = runtime.replace(old_submit, new_submit, 1)
runtime_path.write_text(runtime)

section = section_path.read_text()
owner_form = """  <div data-jill-owner-notification hidden aria-hidden=\"true\">
    {% form 'contact', id: 'JillCustomOrderOwnerNotification' %}
      <input type=\"hidden\" name=\"contact[name]\" value=\"\">
      <input type=\"hidden\" name=\"contact[email]\" value=\"\">
      <input type=\"hidden\" name=\"contact[body]\" value=\"\">
    {% endform %}
  </div>

"""
if owner_form not in section:
    raise SystemExit('secondary Shopify owner-notification form not found')
section = section.replace(owner_form, '', 1)
section_path.write_text(section)

tests = test_path.read_text()
marker = "assert.match(runtime, /submitRequest/, 'Custom Order must own one final request submission boundary');"
additions = (
    "\nassert.doesNotMatch(runtime, /submitOwnerNotification|store notification could not be delivered/, 'Custom Order submission must not depend on a second Shopify contact-form request');"
    "\nassert.doesNotMatch(section, /data-jill-owner-notification|JillCustomOrderOwnerNotification/, 'Custom Order must keep one canonical Apps Script submission owner');"
    "\nassert.match(runtime, /const submissionId = request\\.submission_id;[\\s\\S]*nextRequest\\.submission_id = submissionId;/, 'retrying from one Review session must preserve the canonical submission id');\n"
)
if marker not in tests:
    raise SystemExit('Custom Order submission integration assertion anchor not found')
if 'must not depend on a second Shopify contact-form request' not in tests:
    tests = tests.replace(marker, marker + additions, 1)
test_path.write_text(tests)
