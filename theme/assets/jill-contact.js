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

  // Never create a second delivery path for the native Shopify form.
  // The isolated WORK adapter is hard OFF in the shipped Liquid markup;
  // QA can enable only after the Shopify proxy, Worker, D1 and spam gate
  // have independently passed and the exact WORK host has been confirmed.
  const pendingWorkTickets = new WeakMap();

  function contactWorkNotice(root, message, isError = false) {
    let status = root.querySelector('[data-jill-work-contact-notice]');
    if (!status) {
      status = document.createElement('p');
      status.setAttribute('data-jill-work-contact-notice', '');
      status.setAttribute('role', isError ? 'alert' : 'status');
      root.querySelector('.jill-contact__actions')?.prepend(status);
    }
    status.setAttribute('role', isError ? 'alert' : 'status');
    status.textContent = message;
  }

  async function submitWorkContact(root, form) {
    const submit = form.querySelector('[type="submit"]');
    const existing = pendingWorkTickets.get(form);
    if (existing?.sending || existing?.confirmed) return;
    if (!form.reportValidity()) return;
    const contract = globalThis.JILLContactWorkContract;
    const endpoint = root.dataset.jillWorkContactEndpoint;
    if (!contract?.mayUseWorkAdapter({
      mode: root.dataset.jillWorkContactMode,
      host: globalThis.location?.hostname,
      endpoint,
    })) {
      contactWorkNotice(root,
        'Secure Contact Us ticket delivery is unavailable. Your message was not sent.',
        true);
      return;
    }
    let record, snapshot;
    try {
      // Preserve the SAME ID on uncertain delivery when form values match.
      // A changed form is a separate ticket, never an overwritten receipt.
      const entries = [...new FormData(form).entries()];
      const next = contract.normalizedForm(entries,
        '00000000-0000-4000-8000-000000000000');
      snapshot = JSON.stringify({...next, ticket_id:''});
      const uuid = existing?.snapshot === snapshot
        ? existing.record.ticket_id.slice('jill:contact:'.length)
        : globalThis.crypto.randomUUID();
      record = contract.normalizedForm(entries, uuid);
    } catch {
      contactWorkNotice(root,
        'Please review the Contact Us fields before sending.', true);
      return;
    }
    const state = {record, snapshot, sending:true, confirmed:false};
    pendingWorkTickets.set(form, state);
    if (submit) submit.disabled = true;
    contactWorkNotice(root, 'Submitting your Contact Us ticket to JILL WORK…');
    try {
      const response = await fetch(endpoint, {
        method:'POST',
        headers:{'content-type':'application/json',accept:'application/json'},
        credentials:'same-origin',
        redirect:'error',
        body:JSON.stringify(record),
        signal:AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (![200,201].includes(response.status) ||
          data?.version !== 1 ||
          data?.operation !== 'jill.contact.intake.result' ||
          data?.ok !== true ||
          !['received','already_received'].includes(data.code) ||
          data.ticket_id !== record.ticket_id) throw Error('receipt_unverified');
      state.confirmed = true;
      contactWorkNotice(root,
        'Your Contact Us request was recorded as ' + record.ticket_id +
        '. JILL will review it.');
    } catch {
      contactWorkNotice(root,
        'We could not confirm your ticket. Use Send message again to retry ' +
        'the same request safely. Do not submit it through a second form.', true);
    } finally {
      state.sending = false;
      if (submit) submit.disabled = state.confirmed;
    }
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
    form?.addEventListener('submit', (event) => {
      syncPhoneRequirement(root);
      syncEmailValidity(root);
      syncReason(root);
      // Default OFF: leave Shopify's native submission and spam controls
      // completely untouched. Never dual-send or auto-fallback on errors.
      if (root.dataset.jillWorkContactMode !== 'qa-enabled') return;
      event.preventDefault();
      void submitWorkContact(root, form);
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
