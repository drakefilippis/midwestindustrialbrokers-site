// Shared renderers: used in the browser (index.html) and by build.js at deploy
// time to pre-render content into static HTML for search engines and AI tools.
(function (root) {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
  // Placeholder text like "[Client Name]" or "[Add case study narrative ...]" stays hidden until filled in.
  const isPlaceholder = (s) => { const t = String(s == null ? '' : s).trim(); return !t || /^\[.*\]$/s.test(t) || t.startsWith('[Add'); };
  const photoSrc = (p) => (p && typeof p === 'object') ? (p.url || p.image || '') : String(p || '');
  const dealUrl = (d) => '/deal.html?slug=' + encodeURIComponent(d.slug);

  const R = {
    esc, telHref, isPlaceholder,
    stats: (stats) => (stats || []).map(s => `
      <div class="stat">
        <div class="stat-num">${esc(s.value)}<span class="unit">${esc(s.unit)}</span></div>
        <div class="stat-label">${esc(s.label)}</div>
      </div>`).join(''),
    coverage: (cities) => (cities || []).map(c => `<span>${esc(c)}</span>`).join(''),
    team: (team) => (team || []).map(b => `
      <div class="broker-card">
        <div class="broker-avatar" aria-hidden="true">${esc(b.initials)}</div>
        <h3 class="broker-name">${esc(b.name)}</h3>
        <div class="broker-role">${esc(b.title)} · Signature Associates</div>
        <div class="broker-bio">${b.bio_html || ''}</div>
        <div class="broker-contact">
          ${b.email ? `<div><span class="lbl">Email</span><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></div>` : ''}
          ${b.office_phone ? `<div><span class="lbl">Office</span><a href="${telHref(b.office_phone)}">${esc(b.office_phone)}</a></div>` : ''}
          ${b.mobile_phone ? `<div><span class="lbl">Mobile</span><a href="${telHref(b.mobile_phone)}">${esc(b.mobile_phone)}</a></div>` : ''}
          ${b.linkedin_url ? `<div><span class="lbl">LinkedIn</span><a href="${esc(b.linkedin_url)}" target="_blank" rel="noopener">View profile ↗</a></div>` : ''}
        </div>
      </div>`).join(''),
    deals: (deals) => (deals || []).map(d => {
      const sideClass = String(d.side || '').toLowerCase().replace(/\s+/g, '');
      const has = !!d.slug;
      const prop = has ? `<a href="${dealUrl(d)}">${esc(d.property)}</a>` : esc(d.property);
      return `
      <tr data-year="${esc(d.year)}" ${has ? `class="clickable" data-slug="${esc(d.slug)}"` : ''}>
        <td><span class="deal-year">${esc(d.year)}</span></td>
        <td class="deal-property">${prop}<span class="sub">${esc(d.subtitle)}</span></td>
        <td>${isPlaceholder(d.client) ? '' : esc(d.client)}</td>
        <td><span class="badge ${esc(sideClass)}">${esc(d.side)}</span></td>
        <td class="deal-type">${esc(d.deal_type)}</td>
        <td class="deal-size">${esc(d.size)}${has ? '<span class="case-arrow" aria-hidden="true">→</span>' : ''}</td>
      </tr>`;
    }).join(''),
    dealPhotos: (deals) => (deals || []).filter(d => d.slug && (d.photos || []).some(p => photoSrc(p))).slice(0, 4).map(d => `
      <a class="deal-photo" href="${dealUrl(d)}">
        <img src="${esc(photoSrc(d.photos.find(p => photoSrc(p))))}" alt="${esc(d.property + (d.subtitle ? ', ' + d.subtitle : ''))}" loading="lazy" decoding="async" width="1200" height="720" />
        <span class="cap"><span class="k">${esc(d.year)} · ${esc(d.deal_type)}</span><span class="t">${esc(d.property)}</span><span class="m">${esc([isPlaceholder(d.client) ? '' : d.client, d.size].filter(Boolean).join(' · '))}</span></span>
      </a>`).join(''),
    logos: (logos) => { const real = (logos || []).filter(l => !isPlaceholder(l)); if (real.length < 3) return ''; const items = real.map(l => `<div class="client-logo">${esc(l)}</div>`).join(''); return items + items.replace(/class="client-logo"/g, 'class="client-logo" aria-hidden="true"'); },
    // Market report shows only when real data is in (data_note no longer says sample or placeholder).
    marketReady: (mr) => !!mr && !/placeholder|sample/i.test(mr.data_note || ''),
    services: (services) => (services || []).map(cat => {
      const contacts = (cat.contacts || []).filter(c => !isPlaceholder(c.name) && !isPlaceholder(c.firm));
      if (!contacts.length) return '';
      return `
        <div class="service-cat">
          <div class="service-cat-title">${esc(cat.category)}</div>
          <div class="service-cat-sub">${esc(cat.subtitle)}</div>
          ${contacts.map(c => `
          <div class="service-contact">
            <div class="service-contact-name">${esc(c.name)}</div>
            <div class="service-contact-firm">${esc(c.firm)}</div>
            <div class="service-contact-info">
              ${c.phone ? `<a href="${telHref(c.phone)}">${esc(c.phone)}</a>` : ''}
              ${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
            </div>
          </div>`).join('')}
        </div>`;
    }).join('')
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.MIBRender = R;
})(this);
