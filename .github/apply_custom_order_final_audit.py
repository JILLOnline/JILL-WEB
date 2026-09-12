from pathlib import Path
import json
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


section_path = "theme/sections/main-custom-order.liquid"
section = read(section_path)
section = section.replace(
    "https://script.google.com/macros/s/AKfycbwjFDQxhjc4RDu8T0gSweQf70Y5TheTyWZ6KoVDux6Hx-Ue9jdE7E5Enl5nyxjJpo2W/exec",
    "https://script.google.com/macros/s/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/exec",
)
section = replace_once(
    section,
    "  data-personalization-finished-label=\"{{ 'custom_order.actions.personalization_finished' | t | escape }}\"\n  data-request-label=",
    "  data-personalization-finished-label=\"{{ 'custom_order.actions.personalization_finished' | t | escape }}\"\n  data-personalization-required-message=\"{{ 'custom_order.personalization.required_selected' | t | escape }}\"\n  data-reference-required-message=\"{{ 'custom_order.references.required_by_selection' | t | escape }}\"\n  data-needed-date-error=\"{{ 'custom_order.planning.date_needed_error' | t | escape }}\"\n  data-request-label=",
    "root runtime messages",
)
section = replace_once(
    section,
    "<p class=\"jill-custom-order__help\" data-jill-collection-help>{{ 'custom_order.order.collection_one_help' | t }}</p>",
    "<p\n          class=\"jill-custom-order__help\"\n          data-jill-collection-help\n          data-one-help=\"{{ 'custom_order.order.collection_one_help' | t | escape }}\"\n          data-multiple-help=\"{{ 'custom_order.order.collection_multiple_help' | t | escape }}\"\n        >{{ 'custom_order.order.collection_one_help' | t }}</p>",
    "collection help",
)
section = replace_once(
    section,
    "<script type=\"application/json\" data-jill-product-capability-profile>{% render 'custom-order-capability-profile', capability_profile: capability_profile, product: catalog_product %}</script>",
    "<script type=\"application/json\" data-jill-product-capability-profile>{% render 'custom-order-capability-profile', capability_profile: capability_profile, product: catalog_product %}</script>\n                        <script type=\"application/json\" data-jill-custom-order-full-profile>{{ capability_profile | json }}</script>",
    "full capability profile payload",
)
section = replace_once(
    section,
    "            </div>\n          </fieldset>\n          <div class=\"jill-custom-order__reference-fields\"",
    "            </div>\n            <p class=\"jill-custom-order__help\" data-jill-reference-requirement hidden>{{ 'custom_order.references.required_by_selection' | t }}</p>\n          </fieldset>\n          <div class=\"jill-custom-order__reference-fields\"",
    "reference requirement hint",
)
section = replace_once(
    section,
    "{% render 'ui-field', id: 'JillCustomOrderNeededDate', name: 'date_needed', label: date_needed_label, type: 'date', required: true %}",
    "{% render 'ui-field', id: 'JillCustomOrderNeededDate', name: 'date_needed', label: date_needed_label, type: 'date', required: true, help: 'custom_order.planning.date_needed_help' | t %}",
    "date needed field",
)
write(section_path, section)

profile_path = "theme/snippets/custom-order-capability-profile.liquid"
profile = read(profile_path)
profile = replace_once(
    profile,
    '"unitsPerQuantity": 1,',
    '"unitsPerQuantity": {{ capability_profile.features.customizationUnits.unitsPerQuantity | default: 1 | json }},',
    "customization unit multiplier",
)
write(profile_path, profile)

runtime_path = "theme/assets/jill-custom-order.js"
runtime = read(runtime_path)
runtime = replace_once(
    runtime,
    "  function readProfile(form) {\n    const source = form.querySelector('[data-jill-product-capability-profile]');\n    if (!source) return null;\n    return globalThis.JILLProductCapabilities.resolve(source.textContent.trim());\n  }\n",
    "  function readProfile(form) {\n    const source = form.querySelector('[data-jill-product-capability-profile]');\n    if (!source) return null;\n    return globalThis.JILLProductCapabilities.resolve(source.textContent.trim());\n  }\n\n  function readFullCapabilityProfile(item) {\n    const source = item?.querySelector('[data-jill-custom-order-full-profile]');\n    if (!source) return null;\n    return globalThis.JILLProductCapabilities.resolve(source.textContent.trim());\n  }\n\n  function personalizationProjection(item, merchandiseQuantity) {\n    const profile = readFullCapabilityProfile(item);\n    if (!profile) return null;\n    if (!globalThis.JILLPersonalization) fail('personalization engine is unavailable');\n    const state = globalThis.JILLPersonalization.createState({itemId: itemRuntimeId(item), merchandiseQuantity, profile});\n    return state.available ? {profile, state} : null;\n  }\n\n  function fieldAllowsPersonalizationOptOut(field) {\n    return ['radio', 'select'].includes(field?.kind)\n      && (field.options || []).some((option) => ['no', 'none'].includes(String(option.value || '').toLowerCase()));\n  }\n\n  function profileRequiresPersonalization(profile) {\n    if (!profile) return false;\n    return globalThis.JILLProductCapabilities.getFieldsForGroup(profile, 'personalization').some((field) => {\n      if (!field.required || field.visibleWhen || ['theme', 'colors'].includes(field.id)) return false;\n      return !fieldAllowsPersonalizationOptOut(field);\n    });\n  }\n",
    "full profile helpers",
)
old_selected = """  function selectedPersonalizationItems(root) {
    return selectedChoices(root).map((choice) => {
      const rawQuantity = Number(projectionQuantity(choice)?.value || 1);
      const quantity = Number.isSafeInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
      return {
        productId: String(choice.dataset.productId),
        label: personalizationChoiceLabel(choice),
        quantity,
      };
    });
  }
"""
new_selected = """  function selectedPersonalizationItems(root) {
    return selectedChoices(root).map((choice) => {
      const rawQuantity = Number(projectionQuantity(choice)?.value || 1);
      const merchandiseQuantity = Number.isSafeInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
      const item = itemForProduct(root, choice.dataset.productId);
      const projection = personalizationProjection(item, merchandiseQuantity);
      const quantity = projection?.state.eligibleUnitCount || merchandiseQuantity;
      return {
        productId: String(choice.dataset.productId),
        label: personalizationChoiceLabel(choice),
        merchandiseQuantity,
        quantity,
        unitIds: projection?.state.eligibleUnitIds || Array.from({length: merchandiseQuantity}, (_, index) => `${itemRuntimeId(item)}::${index + 1}`),
        required: profileRequiresPersonalization(projection?.profile),
      };
    });
  }

  function personalizationRequired(root) {
    return selectedPersonalizationItems(root).some((entry) => entry.required);
  }
"""
runtime = replace_once(runtime, old_selected, new_selected, "personalization physical-unit projection")
runtime, count = re.subn(r"\n  function customizationUnitIds\(itemId, quantity, profile\) \{[\s\S]*?\n  \}\n", "\n", runtime, count=1)
if count != 1:
    raise SystemExit(f"customization unit helper removal: expected 1, found {count}")
runtime = replace_once(
    runtime,
    "      const form = item.querySelector('[data-jill-custom-order-item-form]');\n      const profile = readProfile(form);\n      const unitIds = customizationUnitIds(request.item_id, request.quantity, profile);",
    "      const source = selectedPersonalizationItems(root).find((entry) => entry.productId === String(item.dataset.jillProductId));\n      const unitIds = source?.unitIds || [];\n      if (!unitIds.length) fail('personalization units are unavailable for the selected item');",
    "apply order personalization units",
)
runtime = replace_once(
    runtime,
    "    if (state.mode === 'none') return {complete: true, message: 'No personalization selected.'};",
    "    if (state.mode === 'none') {\n      return personalizationRequired(root)\n        ? {complete: false, message: root.dataset.personalizationRequiredMessage || 'At least one selected item requires personalization.'}\n        : {complete: true, message: 'No personalization selected.'};\n    }",
    "required personalization completion",
)
runtime = replace_once(
    runtime,
    "    const differentOption = mode.querySelector('option[value=\"different\"]');\n    if (differentOption) differentOption.disabled = totalPersonalizationUnits(root) < 2;\n    mode.value = state.mode;",
    "    const required = personalizationRequired(root);\n    const noneOption = mode.querySelector('option[value=\"none\"]');\n    if (noneOption) noneOption.disabled = required;\n    if (required && state.mode === 'none') {\n      state.mode = '';\n      state.finished = false;\n    }\n    const differentOption = mode.querySelector('option[value=\"different\"]');\n    if (differentOption) differentOption.disabled = totalPersonalizationUnits(root) < 2;\n    mode.value = state.mode;",
    "personalization mode requirement",
)
old_reference = """  function referenceReady(root) {
    const choice = readChecked(root, 'has_references');
    if (!choice) return false;
    if (choice === 'no') return true;
    const state = mediaState(root);
    return state.uploading === 0 && uploadedMedia(root).length > 0;
  }
"""
new_reference = """  function referenceRequired(root) {
    return selectedItems(root).some((item) => {
      const profile = readFullCapabilityProfile(item);
      const fieldId = profile?.features?.referenceUpload?.fieldId;
      const field = fieldId ? globalThis.JILLProductCapabilities.getField(profile, fieldId) : null;
      return Boolean(field?.required);
    });
  }

  function syncReferenceRequirement(root) {
    const required = referenceRequired(root);
    const no = root.querySelector('[data-jill-reference-choice][value="no"]');
    const note = root.querySelector('[data-jill-reference-requirement]');
    if (no) {
      no.disabled = required;
      no.setAttribute('aria-disabled', required ? 'true' : 'false');
      if (required && no.checked) no.checked = false;
    }
    setVisible(note, required);
  }

  function referenceReady(root) {
    const choice = readChecked(root, 'has_references');
    if (!choice) return false;
    if (choice === 'no') return !referenceRequired(root);
    const state = mediaState(root);
    return state.uploading === 0 && uploadedMedia(root).length > 0;
  }
"""
runtime = replace_once(runtime, old_reference, new_reference, "reference requirement")
runtime = replace_once(
    runtime,
    "    needDate.min = earliestNeedDate;\n    if (!needDate.value || needDate.value < earliestNeedDate) needDate.value = earliestNeedDate;\n    needDate.setCustomValidity('');",
    "    needDate.min = earliestNeedDate;\n    needDate.setCustomValidity(\n      needDate.value && needDate.value < earliestNeedDate\n        ? (root.dataset.neededDateError || 'Choose a date at least 12 business days from today.')\n        : '',\n    );",
    "date minimum without auto fill",
)
runtime = replace_once(
    runtime,
    "    const orderType = readChecked(root, 'order_type');\n    setVisible(collectionStage, customerReady && Boolean(orderType));",
    "    const orderType = readChecked(root, 'order_type');\n    const collectionHelp = root.querySelector('[data-jill-collection-help]');\n    if (collectionHelp) {\n      collectionHelp.textContent = orderType === 'multiple' ? collectionHelp.dataset.multipleHelp : collectionHelp.dataset.oneHelp;\n    }\n    setVisible(collectionStage, customerReady && Boolean(orderType));",
    "dynamic collection help runtime",
)
runtime = replace_once(
    runtime,
    "    const personalizationReady = designReady && completion.complete && (state.mode === 'none' || state.finished);\n    setVisible(referenceStage, personalizationReady);\n    const referenceChoice = readChecked(root, 'has_references');",
    "    const personalizationReady = designReady && completion.complete && (state.mode === 'none' || state.finished);\n    setVisible(referenceStage, personalizationReady);\n    syncReferenceRequirement(root);\n    const referenceChoice = readChecked(root, 'has_references');",
    "sync reference requirement progression",
)
runtime = replace_once(
    runtime,
    "      if (root.dataset.jillOptionsFinished !== 'true') {\n        validateConfiguration(root);\n        return firstIncompleteItem(root)?.target || finishConfiguration;\n      }",
    "      if (root.dataset.jillOptionsFinished !== 'true') {\n        return firstIncompleteItem(root)?.target || finishConfiguration;\n      }",
    "review non-mutating validation",
)
write(runtime_path, runtime)

css_path = "theme/assets/jill-forms.css"
css = read(css_path)
botanical = """

  .jill-custom-order__flow > .jill-custom-order__step {
    position: relative;
    isolation: isolate;
    overflow: hidden;
  }

  .jill-custom-order__flow > .jill-custom-order__step::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: var(--jill-botanical-field);
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
    opacity: 0.08;
  }

  .jill-custom-order__flow > .jill-custom-order__step:nth-of-type(3n + 2)::before {
    background-position: 54% 46%;
    background-size: 118% auto;
  }

  .jill-custom-order__flow > .jill-custom-order__step:nth-of-type(3n)::before {
    background-position: 46% 54%;
    background-size: 112% auto;
  }

  .jill-custom-order__flow > .jill-custom-order__step > * {
    position: relative;
    z-index: 1;
  }
"""
css = replace_once(css, "  .jill-custom-order__step[data-stage-state='active'] {", botanical + "\n  .jill-custom-order__step[data-stage-state='active'] {", "botanical step surface")
css = replace_once(
    css,
    "  @media (max-width: 749px) {\n",
    "  @media (max-width: 749px) {\n    .jill-custom-order[data-jill-custom-order] .jill-custom-order__flow > .jill-custom-order__step::before {\n      background-size: auto 100%;\n      opacity: 0.055;\n    }\n\n",
    "mobile botanical rule",
)
write(css_path, css)

locale_path = "theme/locales/en.default.json"
locale = json.loads(read(locale_path))
co = locale["custom_order"]
co["personalization"]["required_selected"] = "At least one selected item requires personalization."
co["references"]["required_by_selection"] = "At least one selected item requires a reference image."
co["planning"]["date_needed_help"] = "Earliest selectable date is 12 business days from today. This helps plan your order but does not guarantee delivery by that date. Pick-up orders are prioritized."
co["planning"]["date_needed_error"] = "Choose a date at least 12 business days from today."
write(locale_path, json.dumps(locale, indent=2, ensure_ascii=False) + "\n")

test_path = "scripts/test-custom-order-integration.mjs"
test = read(test_path)
test = replace_once(
    test,
    "assert.match(customOrderProfile, /\"unitsPerQuantity\": 1/, 'one Custom Order quantity must represent one customization unit');",
    "assert.match(customOrderProfile, /capability_profile\\.features\\.customizationUnits\\.unitsPerQuantity \\| default: 1/, 'Custom Order Product Options projection must preserve the canonical physical customization-unit multiplier');",
    "profile multiplier test",
)
test = replace_once(
    test,
    "assert.match(runtime, /needDate\\.value < earliestNeedDate\\) needDate\\.value = earliestNeedDate/, 'date needed must return an injected early value to the first available date');\nassert.match(runtime, /needDate\\.setCustomValidity\\(''\\)/, 'date needed must clear stale native validity after restoring the first available date');",
    "assert.doesNotMatch(runtime, /needDate\\.value\\s*=\\s*earliestNeedDate/, 'Date Needed must remain customer-chosen instead of auto-filling the earliest date');\nassert.match(runtime, /needDate\\.setCustomValidity/, 'date needed must validate early customer-entered dates without choosing a date for them');",
    "date test block",
)
test = replace_once(
    test,
    "assert.match(section, /https:\\/\\/script\\.google\\.com\\/macros\\/s\\/AKfycbwjFDQxhjc4RDu8T0gSweQf70Y5TheTyWZ6KoVDux6Hx-Ue9jdE7E5Enl5nyxjJpo2W\\/exec/, 'Custom Order must retain the canonical Apps Script deployment');\nassert.doesNotMatch(section, /AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA/, 'Custom Order must not use the dead Apps Script deployment');",
    "assert.match(section, /https:\\/\\/script\\.google\\.com\\/macros\\/s\\/AKfycbxXruH-shyIEGbxIpyJtd4KrAMaN0J3Ov7icdae_MkMvig8I_Y_fm2OJ9cRJiZ-IzU7jA\\/exec/, 'Custom Order must use the verified canonical Apps Script deployment');\nassert.doesNotMatch(section, /AKfycbwjFDQxhjc4RDu8T0gSweQf70Y5TheTyWZ6KoVDux6Hx-Ue9jdE7E5Enl5nyxjJpo2W/, 'Custom Order must not retain the superseded Apps Script deployment');",
    "endpoint tests",
)
test = replace_once(
    test,
    "assert.match(runtime, /if \\(!needDate\\.value \\|\\| needDate\\.value < earliestNeedDate\\) needDate\\.value = earliestNeedDate;/, 'Date Needed must display and restore the first available business-day date');",
    "assert.doesNotMatch(runtime, /if \\(!needDate\\.value \\|\\| needDate\\.value < earliestNeedDate\\) needDate\\.value = earliestNeedDate;/, 'Date Needed must never auto-select a date');",
    "duplicate date test",
)
marker = "assert.match(runtime, /function firstReviewIssue\\(\\)/, 'Review must keep one canonical first-missing-field resolver');\n"
additions = """assert.match(section, /data-jill-custom-order-full-profile/, 'Custom Order must expose the full canonical product capability profile for order-level requirements');
assert.match(runtime, /JILLPersonalization\.createState/, 'Custom Order physical personalization units must come from the shared personalization authority');
assert.match(runtime, /eligibleUnitIds/, 'Custom Order must allocate bundled products by physical customization units');
assert.match(runtime, /personalizationRequired\(root\)/, 'selected product capability truth must tighten generic personalization requirements');
assert.match(runtime, /referenceRequired\(root\)/, 'selected product capability truth must tighten reference-image requirements');
assert.match(runtime, /noneOption\.disabled = required/, 'No personalization must be unavailable when a selected product requires personalization');
assert.match(runtime, /no\.disabled = required/, 'No reference images must be unavailable when a selected product requires a file');
assert.match(runtime, /collectionHelp\.dataset\.multipleHelp/, 'collection guidance must switch for multiple-item orders');
assert.match(formsCss, /jill-custom-order__flow > \.jill-custom-order__step::before[\s\S]*var\(--jill-botanical-field\)/, 'large Custom Order step cards must reuse the canonical botanical field');
assert.doesNotMatch(runtime.match(/function firstReviewIssue\(\)[\s\S]*?\n    }\n\n    function openReview/)?.[0] || '', /validateConfiguration\(root\)/, 'Review validation must not mutate the Product Options finish gate');
"""
test = replace_once(test, marker, marker + additions, "final audit integration guards")
write(test_path, test)

design_path = "docs/DESIGN_SYSTEM.md"
design = read(design_path)
design_note = """

## Custom Order botanical surface extension — 2026-09-12

The canonical `jill-botanical-field.svg` asset may also be used by `jill-forms.css` on **large Custom Order step cards only**. This is a low-opacity edge field, not a new decorative system. Inputs, selects, phone controls, quantity controls, pills, and ordinary buttons remain clean UI surfaces. Deterministic crop/position variations are allowed so large cards do not look mechanically repeated; random JS placement and duplicate botanical assets are not allowed.
"""
if design_note.strip() not in design:
    design += design_note
write(design_path, design)

domain_path = "docs/DOMAIN_OWNERSHIP.md"
domain = read(domain_path)
domain_note = """

## Custom Order final-pass ownership clarification — 2026-09-12

- `jill-custom-order.js` may orchestrate cross-product Custom Order personalization, but physical eligible-unit identity/count must come from `JILLPersonalization` and canonical product capability profiles. It must not own separate units-per-quantity arithmetic.
- Product-level required personalization/reference semantics come from the full canonical Shopify capability profile; the generic Custom Order choices may only become stricter from that truth, never weaker.
- `jill-forms.css` owns Custom Order large-card botanical presentation and consumes the same `--jill-botanical-field` foundation asset. It does not own a second botanical asset or decorate ordinary controls.
"""
if domain_note.strip() not in domain:
    domain += domain_note
write(domain_path, domain)

decisions_path = "docs/DECISIONS.md"
decisions = read(decisions_path)
decision = """

## 2026-09-12 — Custom Order final audit: capability truth, physical units, review purity, and botanical steps

**Decision:** The verified `AKfycbxX.../exec` Apps Script deployment is the canonical Custom Order submission endpoint. Custom Order reads the full product capability profile for required personalization/reference semantics while retaining the existing Product Options-only projection for option rendering. Bundled products use physical customization units from `JILLPersonalization`, including 8- and 12-count merchandise. Date Needed exposes a 12-business-day minimum but remains blank until the customer chooses a date. Review validates without mutating Product Options finish state. Large Custom Order step cards may reuse the canonical botanical field at low opacity with deterministic crop variations; controls remain undecorated.

**Consequence:** This scoped final pass supersedes the 2026-09-10 consequence that the Custom Order form owner was untouched. It does not authorize duplicate engines or a new visual authority. Deployment remains DEVELOPMENT-theme-only until explicitly promoted; LIVE is not modified by this decision.
"""
if decision.strip() not in decisions:
    decisions += decision
write(decisions_path, decisions)
