(() => {
  'use strict';

  function controls(region) {
    return Array.from(region.querySelectorAll('input, select, textarea, button'));
  }

  function setRegion(region, visible) {
    if (!region) return;
    region.hidden = !visible;
    region.setAttribute('aria-hidden', visible ? 'false' : 'true');
    for (const control of controls(region)) {
      control.disabled = !visible;
    }
  }

  function syncPhoneRequirement(root) {
    const preferred = root.querySelector('[data-contact-preferred]');
    const phone = root.querySelector('[data-contact-phone]');
    const optional = root.querySelector('[data-contact-phone-optional]');
    const required = root.querySelector('[data-contact-phone-required]');
    if (!preferred || !phone || !optional || !required) return;

    const phoneRequired = preferred.value === 'Phone';
    phone.required = phoneRequired;
    phone.setAttribute('aria-required', phoneRequired ? 'true' : 'false');
    optional.hidden = phoneRequired;
    required.hidden = !phoneRequired;
  }

  function syncEmailValidity(root) {
    const email = root.querySelector('input[type="email"][name="contact[email]"]');
    if (!email) return;
    const value = email.value.trim();
    const complete = value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    email.setCustomValidity(complete ? '' : 'Enter a complete email address, including the domain ending.');
  }

  function syncReason(root) {
    const reason = root.querySelector('[data-contact-reason]');
    const message = root.querySelector('[data-contact-message]');
    if (!reason || !message) return;

    const selected = reason.selectedOptions[0];
    const value = reason.value;
    const groups = {
      order: value === 'existing' || value === 'shipping',
      product: value === 'product',
      custom: value === 'custom',
      business: value === 'business',
      website: value === 'website',
    };

    for (const region of root.querySelectorAll('[data-contact-group]')) {
      setRegion(region, Boolean(groups[region.dataset.contactGroup]));
    }

    setRegion(message, value !== '');

    const title = message.querySelector('[data-contact-message-title]');
    const help = message.querySelector('[data-contact-message-help]');
    if (value && title && selected?.dataset.messageTitle) title.textContent = selected.dataset.messageTitle;
    if (value && help && selected?.dataset.messageHelp) help.textContent = selected.dataset.messageHelp;
  }

  function initialize(root) {
    if (!root || root.dataset.jillContactInitialized === 'true') return;
    root.dataset.jillContactInitialized = 'true';

    const form = root.querySelector('form');
    const reason = root.querySelector('[data-contact-reason]');
    const preferred = root.querySelector('[data-contact-preferred]');
    const email = root.querySelector('input[type="email"][name="contact[email]"]');

    reason?.addEventListener('change', () => syncReason(root));
    preferred?.addEventListener('change', () => syncPhoneRequirement(root));
    email?.addEventListener('input', () => syncEmailValidity(root));
    email?.addEventListener('change', () => syncEmailValidity(root));
    form?.addEventListener('submit', () => {
      syncPhoneRequirement(root);
      syncEmailValidity(root);
      syncReason(root);
    });

    syncPhoneRequirement(root);
    syncEmailValidity(root);
    syncReason(root);
  }

  function boot(scope = document) {
    if (scope.matches?.('[data-jill-contact]')) initialize(scope);
    scope.querySelectorAll?.('[data-jill-contact]').forEach(initialize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(), {once: true});
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', (event) => boot(event.target));
})();
