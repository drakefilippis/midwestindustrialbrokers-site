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
    stats: (stats, markets) => (stats || []).map(s => (s.auto === 'markets' && Array.isArray(markets)) ? Object.assign({}, s, { value: String(markets.length) }) : s).map(s => `
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
    // Mobile / Office / Email contact buttons (same block on every page).
    callButtons: (cls) => `<div class="call-buttons${cls ? ' ' + cls : ''}">
          <a class="call-btn primary" href="tel:+12489411125" data-track="call_mobile"><span class="k">Mobile</span><span class="v">(248) 941-1125</span></a>
          <a class="call-btn" href="tel:+12487993161" data-track="call_office"><span class="k">Office</span><span class="v">(248) 799-3161</span></a>
          <a class="call-btn email" href="mailto:dfilippis@signatureassociates.com" data-track="email_button"><span class="k">Email</span><span class="v">dfilippis@<wbr>signatureassociates.com</span></a>
        </div>`,
    // Closed-deal card. Fields: sold/leased, side represented, size, city, industry.
    dealCard: (d, opts) => {
      opts = opts || {};
      const lease = /lease/i.test(d.deal_type || '');
      const side = String(d.side || '').toLowerCase();
      const roles = { buyer: 'Buyer Representation', seller: 'Seller Representation', tenant: 'Tenant Representation', landlord: 'Landlord Representation', both: 'Both Sides' };
      const c0 = String(d.city || d.subtitle || '').split(',')[0].trim();
      const city = c0 ? c0 + ', MI' : '';
      const m = String(d.size || '').match(/^([\d,.]+)\s*(SF|AC|acres?)?/i);
      const num = m ? m[1] : String(d.size || '');
      const unit = m && m[2] ? m[2].toUpperCase().replace(/ACRES?/, 'AC') : (m ? 'SF' : '');
      const photo = opts.noPhoto ? '' : photoSrc((d.photos || [])[0]);
      const industry = d.property_type || d.industry || opts.industry || '';
      const media = photo
        ? `<img src="${esc(photo)}" alt="${esc((lease ? 'Leased' : 'Sold') + ' property in ' + city)}" loading="lazy" decoding="async" width="800" height="500" />`
        : `<span class="dc-ph" role="img" aria-label="Photo coming soon"><span class="dc-ph-mark" aria-hidden="true">MIB</span></span>`;
      const link = d.slug && opts.link !== false;
      const tag = link ? 'a' : 'div';
      const href = link ? ` href="${esc(dealUrl(d))}"` : '';
      return `<${tag} class="deal-card${lease ? ' is-lease' : ' is-sale'}${link ? ' is-link' : ''}"${href}>
        <span class="dc-media">${media}<span class="dc-chip">${esc(roles[side] || d.side || '')}</span></span>
        <span class="dc-body">
          <span class="dc-kind">${lease ? 'Leased' : 'Sold'}</span>
          <span class="dc-size"><span class="dc-num">${esc(num)}</span>${unit ? `<span class="dc-unit">${unit}</span>` : ''}</span>
          <span class="dc-meta"><span class="dc-city">${esc(city)}</span>${industry ? `<span class="dc-ind">${esc(industry)}</span>` : ''}</span>
        </span>
      </${tag}>`;
    },
    // Deal card grid, newest year first, then largest first.
    dealGrid: (deals) => (deals || []).filter(d => d && d.size).map((d, i) => [d, i]).sort((a, b) => (Number(b[0].year) - Number(a[0].year)) || (parseFloat(String(b[0].size).replace(/,/g, '')) * (/AC/i.test(b[0].size) ? 43560 : 1) - parseFloat(String(a[0].size).replace(/,/g, '')) * (/AC/i.test(a[0].size) ? 43560 : 1)) || a[1] - b[1]).map(([d]) => `<li data-year="${esc(d.year)}">${R.dealCard(d)}</li>`).join(''),
    serviceUrl: (sv) => '/services/' + sv.slug + '/',
    serviceList: (svc) => (svc || []).filter(s => !isPlaceholder(s.title)).map(s => s.slug
      ? `<li><a class="service-card" href="/services/${esc(s.slug)}/"><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p><span class="sc-go">Learn more <span aria-hidden="true">→</span></span></a></li>`
      : `<li><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p></li>`).join(''),
    serviceDeals: (deals, slug) => (deals || []).filter(d => Array.isArray(d.services) && d.services.includes(slug)),
    // Lead form (Netlify Forms). opts: { name, service, need, id }
    leadForm: (opts) => {
      opts = opts || {};
      const needs = ['Lease space', 'Lease out my building', 'Buy a property', 'Sell a property', 'Build-to-suit', 'Something else'];
      const timing = ['As soon as possible', 'Within 3 months', '3 to 6 months', '6 to 12 months', 'More than 12 months', 'Just exploring'];
      const name = opts.name || 'contact';
      return `
        <form class="lead-form" name="${esc(name)}" method="POST" action="/thank-you.html" data-netlify="true" netlify-honeypot="bot-field">
          <input type="hidden" name="form-name" value="${esc(name)}" />
          ${opts.service ? `<input type="hidden" name="service" value="${esc(opts.service)}" />` : ''}
          <p class="hp" aria-hidden="true"><label>Leave this empty <input type="text" name="bot-field" tabindex="-1" autocomplete="off" /></label></p>
          <div class="f-row">
            <label class="f"><span>Name *</span><input type="text" name="name" autocomplete="name" required /></label>
            <label class="f"><span>Email *</span><input type="email" name="email" autocomplete="email" required /></label>
          </div>
          <div class="f-row">
            <label class="f"><span>Phone</span><input type="tel" name="phone" autocomplete="tel" /></label>
            <label class="f"><span>I want to *</span><select name="need" required>
              <option value="">Choose one</option>
              ${needs.map(n => `<option${n === opts.need ? ' selected' : ''}>${esc(n)}</option>`).join('')}
            </select></label>
          </div>
          <div class="f-row">
            <label class="f"><span>Size</span><input type="text" name="size" placeholder="Example: 10,000 SF" /></label>
            <label class="f"><span>Area</span><input type="text" name="area" placeholder="Example: Plymouth or I-275" /></label>
          </div>
          <label class="f"><span>Timing</span><select name="timing">
            <option value="">Choose one</option>
            ${timing.map(t => `<option>${esc(t)}</option>`).join('')}
          </select></label>
          <label class="f"><span>Message</span><textarea name="message" rows="4" placeholder="Anything else that matters: power, clear height, docks, yard, budget"></textarea></label>
          <button type="submit" class="btn btn-primary">Send to Drake <span class="arrow" aria-hidden="true">→</span></button>
          <p class="form-error" role="alert" hidden>Something went wrong. Please call (248) 941-1125 or email dfilippis@signatureassociates.com.</p>
        </form>
        <div class="form-thanks" hidden tabindex="-1">
          <h3>Thanks. Your note is on its way.</h3>
          <p>Drake will follow up soon. If it is urgent, call <a href="tel:+12489411125">(248) 941-1125</a>.</p>
        </div>`;
    },
    // Build-to-Suit requirements form (Netlify Forms, name "bts-requirements").
    btsForm: () => {
      const uses = ['Warehouse / distribution', 'Manufacturing', 'Flex', 'Other'];
      const tenure = ['Own', 'Lease', 'Open'];
      const opt = (list) => '<option value="">Choose one</option>' + list.map(x => `<option>${esc(x)}</option>`).join('');
      const txt = (name, label, ph, extra) => `<label class="f"><span>${label}</span><input type="text" name="${name}"${ph ? ` placeholder="${esc(ph)}"` : ''}${extra || ''} /></label>`;
      return `
        <form class="lead-form bts-form" name="bts-requirements" method="POST" action="/thank-you-bts.html" data-netlify="true" netlify-honeypot="bot-field">
          <input type="hidden" name="form-name" value="bts-requirements" />
          <input type="hidden" name="service" value="Build-to-Suit" />
          <p class="hp" aria-hidden="true"><label>Leave this empty <input type="text" name="bot-field" tabindex="-1" autocomplete="off" /></label></p>
          <fieldset class="f-group"><legend>Contact</legend>
            <div class="f-row">
              <label class="f"><span>Name *</span><input type="text" name="name" autocomplete="name" required /></label>
              <label class="f"><span>Company</span><input type="text" name="company" autocomplete="organization" /></label>
            </div>
            <div class="f-row">
              <label class="f"><span>Email *</span><input type="email" name="email" autocomplete="email" required /></label>
              <label class="f"><span>Phone</span><input type="tel" name="phone" autocomplete="tel" /></label>
            </div>
          </fieldset>
          <fieldset class="f-group"><legend>Building</legend>
            <div class="f-row">
              ${txt('building_size_sf', 'Building size (SF)', 'Example: 60,000', ' inputmode="numeric"')}
              ${txt('land_acres', 'Land (acres)', 'Example: 8', ' inputmode="decimal"')}
            </div>
            <div class="f-row">
              <label class="f"><span>Use type</span><select name="use_type">${opt(uses)}</select></label>
              ${txt('clear_height', 'Clear height', 'Example: 32 ft')}
            </div>
            <div class="f-row">
              ${txt('docks_drive_ins', 'Dock doors and drive-ins', 'Example: 8 docks, 2 drive-ins')}
              ${txt('power', 'Power needs', 'Example: 2,000 amps, 480V 3 phase')}
            </div>
          </fieldset>
          <fieldset class="f-group"><legend>Location and timing</legend>
            ${txt('preferred_markets', 'Preferred markets', 'Example: Plymouth, Canton, I-275 corridor')}
            <div class="f-row">
              ${txt('occupancy_timing', 'Target occupancy timing', 'Example: Q3 2028')}
              <label class="f"><span>Own or lease</span><select name="own_or_lease">${opt(tenure)}</select></label>
            </div>
            <label class="f"><span>Notes</span><textarea name="notes" rows="4" placeholder="Yard, trailer parking, office share, cranes, budget or anything else that matters"></textarea></label>
          </fieldset>
          <button type="submit" class="btn btn-primary">Submit Requirements <span class="arrow" aria-hidden="true">→</span></button>
          <p class="form-error" role="alert" hidden>Something went wrong. Please call (248) 941-1125 or email dfilippis@signatureassociates.com.</p>
        </form>
        <div class="form-thanks" hidden tabindex="-1">
          <h3>Thanks. Your requirements are in.</h3>
          <p>Drake will review them and follow up to talk through sites and next steps. If it is urgent, call <a href="tel:+12489411125">(248) 941-1125</a>.</p>
        </div>`;
    },
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
