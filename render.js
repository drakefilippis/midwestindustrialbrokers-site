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
    coverage: (cities, markets) => (cities || []).map(c => { const m = (markets || []).find(x => String(x.name).toLowerCase() === String(c).toLowerCase()); return m ? `<a href="/markets/${esc(m.slug)}/">${esc(c)}</a>` : `<span>${esc(c)}</span>`; }).join(''),
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
    serviceList: (svc) => (svc || []).filter(s => !isPlaceholder(s.title)).map(s => `<li><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p></li>`).join(''),
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
    // Client logo strip: uniform white logos on a dark band, brand color on hover.
    // Only logos with a url get a link (opens in a new tab).
    logos: (logos) => (logos || []).filter(l => l && typeof l === 'object' && !isPlaceholder(l.name) && l.logo).map(l => {
      const inner = `<img class="mono" src="${esc(l.logo)}" alt="${esc(l.name)}" loading="lazy" decoding="async" /><img class="color" src="${esc(l.logo_color || l.logo)}" alt="" aria-hidden="true" loading="lazy" decoding="async" />`;
      const style = l.hover_bg ? ` style="--brand-bg:${esc(l.hover_bg)}"` : '';
      return l.url
        ? `<li class="logo-tile"${style}><a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.name)} (opens in a new tab)">${inner}</a></li>`
        : `<li class="logo-tile"${style}><span>${inner}</span></li>`;
    }).join(''),
    // Active listing cards (data pulled from CPIX, stored in data.json).
    listingCard: (l) => `
      <li><a class="listing-card" href="${esc(l.url)}" target="_blank" rel="noopener" data-track="cpix_listing">
        <span class="lc-photo">${l.photo ? `<img src="${esc(l.photo)}" alt="${esc(l.title + ', ' + l.address)}" loading="lazy" decoding="async" width="640" height="360" />` : ''}<span class="lc-type">${esc(l.deal_type)}</span></span>
        <span class="lc-body">
          <span class="lc-title">${esc(l.title)}</span>
          <span class="lc-addr">${esc(l.address)}</span>
          <span class="lc-specs">${[['Use', l.use], ['Size', l.size], ['Lot', l.lot]].filter(x => x[1]).map(x => `<span><span class="k">${x[0]}</span><span class="v">${esc(x[1])}</span></span>`).join('')}</span>
          <span class="lc-link">View on CPIX <span aria-hidden="true">↗</span></span>
        </span>
      </a></li>`,
    listings: (listings, opts) => {
      opts = opts || {};
      let list = (listings || []).filter(l => l && l.show !== false && l.url && l.title);
      if (opts.home) { const f = list.filter(l => l.featured); list = (f.length ? f : list).slice(0, opts.limit || 9); }
      return list.map(R.listingCard).join('');
    },
    cityOf: (address) => String(address || '').split(',').slice(1).join(','),
    matches: (text, cities) => (cities || []).some(c => new RegExp('\\b' + String(c).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(String(text || ''))),
    marketDeals: (deals, m) => (deals || []).filter(d => R.matches(d.subtitle, m.cities)),
    marketListings: (listings, m) => (listings || []).filter(l => l.show !== false && R.matches(R.cityOf(l.address), m.cities)),
    marketUrl: (m) => '/markets/' + m.slug + '/',
    marketCards: (markets, deals, listings) => (markets || []).map(m => {
      const nd = R.marketDeals(deals, m).length, nl = R.marketListings(listings, m).length;
      const meta = [nd ? nd + ' closed deal' + (nd > 1 ? 's' : '') : '', nl ? nl + ' active listing' + (nl > 1 ? 's' : '') : ''].filter(Boolean).join(' · ');
      return `<li><a class="market-card" href="${R.marketUrl(m)}"><span class="mc-name">${esc(m.name)}</span><span class="mc-sum">${esc(m.summary)}</span>${meta ? `<span class="mc-meta">${meta}</span>` : ''}<span class="mc-go" aria-hidden="true">→</span></a></li>`;
    }).join(''),
    faq: (faqs) => (faqs || []).filter(f => f && f.q && f.a).map((f, i) => `
      <details class="faq-item"${i === 0 ? ' open' : ''}><summary><h3>${esc(f.q)}</h3><span class="faq-plus" aria-hidden="true"></span></summary><div class="faq-a"><p>${esc(f.a)}</p></div></details>`).join(''),
    faqJsonLd: (faqs) => JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: (faqs || []).filter(f => f && f.q && f.a).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }, null, 1).replace(/</g, '\\u003c'),
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
