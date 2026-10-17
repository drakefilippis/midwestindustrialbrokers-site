// Shared site behavior: lead form (Netlify Forms) and analytics events.
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

  // Lead form: submit to Netlify Forms in the background and show a thank you state.
  var form = document.getElementById('leadForm');
  if (!form) return;
  var thanks = document.getElementById('formThanks');
  var err = document.getElementById('formError');
  form.addEventListener('submit', function (e) {
    if (!window.fetch || !window.URLSearchParams) return; // fall back to normal POST and /thank-you.html
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    if (err) err.hidden = true;
    var body = new URLSearchParams(new FormData(form)).toString();
    fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var need = (form.elements.need && form.elements.need.value) || '';
        track('generate_lead', { form_name: 'contact', need: need });
        form.hidden = true;
        if (thanks) { thanks.hidden = false; thanks.focus(); }
      })
      .catch(function () {
        if (btn) btn.disabled = false;
        if (err) err.hidden = false;
      });
  });
})();
