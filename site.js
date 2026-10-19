// Shared site behavior: lead forms (Netlify Forms) and analytics events.
// Events go to GA4 only when the gtag script was loaded (measurement ID set in data.json).
(function () {
  function track(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  window.mibTrack = track;

  // Click tracking for calls, email and CPIX links
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var tag = a.getAttribute('data-track');
    if (href.indexOf('tel:') === 0) track('click_to_call', { phone: href.slice(4), link_id: tag || '' });
    else if (href.indexOf('mailto:') === 0) track('click_email', { link_id: tag || '' });
    else if (/cpix\.resimplifi\.com/.test(href)) track('view_listing_cpix', { link_url: href, link_id: tag || '' });
  });

  // Lead forms: submit to Netlify Forms in the background and show a thank you state.
  // Without fetch support the form posts normally and lands on /thank-you.html.
  var forms = document.querySelectorAll('form.lead-form');
  Array.prototype.forEach.call(forms, function (form) {
    var wrap = form.parentNode;
    var thanks = wrap.querySelector('.form-thanks');
    var err = form.querySelector('.form-error');
    form.addEventListener('submit', function (e) {
      if (!window.fetch || !window.URLSearchParams) return;
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      if (err) err.hidden = true;
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          var el = form.elements;
          track('generate_lead', { form_name: form.getAttribute('name') || '', need: (el.need && el.need.value) || '', service: (el.service && el.service.value) || '', use_type: (el.use_type && el.use_type.value) || '', own_or_lease: (el.own_or_lease && el.own_or_lease.value) || '' });
          form.hidden = true;
          if (thanks) { thanks.hidden = false; thanks.focus(); }
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          if (err) err.hidden = false;
        });
    });
  });
})();
