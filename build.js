// Pre-renders data.json content into static HTML so the site is readable without
// JavaScript (search engines and AI tools). Runs on every Netlify deploy (netlify.toml),
// so CMS edits to data.json flow into the static HTML automatically.
//   index.html            sections between <!--BUILD:x--> markers
//   deal.html             analytics marker
//   markets/<slug>/       one page per market in data.json "markets"
//   thank-you.html        form fallback page (noindex)
//   sitemap.xml, llms.txt regenerated from data.json
const fs = require('fs');
const path = require('path');
const R = require('./render.js');
const SITE = 'https://midwestindustrialbrokers.com';
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const esc = R.esc;
const markets = data.markets || [];
const listingsCfg = data.listings_settings || {};
const CPIX = listingsCfg.cpix_url || 'https://cpix.resimplifi.com/cards?types=sale_lease&statuses=active&brokers=3440e031';

function fill(html, parts, file) {
  for (const [k, v] of Object.entries(parts)) {
    const re = new RegExp(`<!--BUILD:${k}-->[\\s\\S]*?<!--/BUILD:${k}-->`);
    if (!re.test(html)) throw new Error(`missing marker ${k} in ${file}`);
    html = html.replace(re, () => `<!--BUILD:${k}-->${v}<!--/BUILD:${k}-->`);
  }
  return html;
}
const toggleHidden = (html, re, hide) => html.replace(re, (m, open, cls, rest) => {
  const classes = cls.split(/\s+/).filter(c => c && c !== 'hidden');
  if (hide) classes.push('hidden');
  return `${open}class="${classes.join(' ')}"${rest}`;
});

// ---------- analytics (GA4 loads only when a measurement ID is set) ----------
const gaId = String((data.analytics || {}).ga4_measurement_id || '').trim();
const analytics = /^G-[A-Z0-9]{4,}$/.test(gaId)
  ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>`
  : '';
if (gaId && !analytics) console.warn('analytics.ga4_measurement_id does not look like a GA4 ID (G-XXXXXXX); skipping');

// ---------- index.html ----------
const footerMarkets = markets.map(m => `<li><a href="${R.marketUrl(m)}">${esc(m.name)}</a></li>`).join('');
const homeListings = R.listings(data.listings, { home: true, limit: listingsCfg.home_limit });
const logosHtml = R.logos(data.client_logos);
let html = fs.readFileSync('index.html', 'utf8');
html = fill(html, {
  coverage: R.coverage(data.coverage_cities, markets),
  stats: R.stats(data.stats),
  team: R.team(data.team),
  services: R.serviceList(data.services),
  dealphotos: R.dealPhotos(data.closed_deals),
  deals: R.deals(data.closed_deals),
  logos: logosHtml,
  listings: homeListings,
  markets: R.marketCards(markets, data.closed_deals, data.listings),
  faq: R.faq(data.faqs),
  faqld: (data.faqs || []).length ? `<script type="application/ld+json">${R.faqJsonLd(data.faqs)}</script>` : '',
  analytics,
  footermarkets: footerMarkets,
}, 'index.html');
html = toggleHidden(html, /(<div )class="([^"]*listings-empty[^"]*)"( id="listingsEmpty")/, !!homeListings);
html = toggleHidden(html, /(<section )class="([^"]*logo-band[^"]*)"( id="clients")/, !logosHtml);
fs.writeFileSync('index.html', html);

// ---------- deal.html ----------
let deal = fs.readFileSync('deal.html', 'utf8');
deal = fill(deal, { analytics }, 'deal.html');
fs.writeFileSync('deal.html', deal);

// ---------- shared shell for generated pages ----------
const pick = (re) => { const m = html.match(re); if (!m) throw new Error('template piece not found: ' + re); return m[0]; };
const style = pick(/<style>[\s\S]*?<\/style>/);
const rootLinks = (s) => s.replace(/href="#top"/g, 'href="/"').replace(/href="#([a-z][\w-]*)"/g, 'href="/#$1"');
const nav = rootLinks(pick(/<nav class="top">[\s\S]*?<\/nav>/)).replace(/<li class="hidden" data-nav="[^"]+">[\s\S]*?<\/li>\s*/g, '');
const footer = rootLinks(pick(/<footer>[\s\S]*?<\/footer>/)).replace(/<li class="hidden" data-nav="[^"]+">[\s\S]*?<\/li>\s*/g, '');
const mobileBar = rootLinks(pick(/<nav class="mobile-bar"[\s\S]*?<\/nav>/));
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,500;0,700;0,800;0,900;1,500&family=Inter:wght@400;600&display=swap" rel="stylesheet" />`;
const page = ({ title, description, canonical, robots, image, jsonld, body, pageType }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
${canonical ? `<link rel="canonical" href="${canonical}" />` : ''}
<meta name="robots" content="${robots || 'index, follow'}" />
<meta name="theme-color" content="#0b0b0b" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Midwest Industrial Brokers" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
${canonical ? `<meta property="og:url" content="${canonical}" />` : ''}
<meta property="og:image" content="${SITE}${image || '/uploads/cross-and-black.webp'}" />
<meta name="twitter:card" content="summary_large_image" />
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld, null, 1).replace(/</g, '\\u003c')}</script>` : ''}
${analytics}
${fonts}
${style}
</head>
<body data-page="${pageType || 'page'}">
<a class="skip-link" href="#main">Skip to content</a>
${nav}
<main id="main">
${body}
</main>
${footer}
${mobileBar}
<script src="/site.js" defer></script>
</body>
</html>
`;

// ---------- market pages ----------
const useRank = (l) => /industrial/i.test(l.use) ? 0 : /land/i.test(l.use) ? 1 : 2;
const business = { '@type': 'RealEstateAgent', '@id': SITE + '/#business', name: 'Midwest Industrial Brokers', url: SITE + '/', telephone: '+1-248-799-3161' };
fs.rmSync('markets', { recursive: true, force: true });
for (const m of markets) {
  const url = SITE + R.marketUrl(m);
  const deals = R.marketDeals(data.closed_deals, m);
  const listings = R.marketListings(data.listings, m).map((l, i) => [l, i]).sort((a, b) => useRank(a[0]) - useRank(b[0]) || a[1] - b[1]).map(x => x[0]);
  const shown = listings.slice(0, 12);
  const dealPhoto = deals.map(d => (d.photos || [])[0]).find(Boolean);
  const photo = dealPhoto || (shown[0] && shown[0].photo);
  const others = markets.filter(x => x.slug !== m.slug);
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': url, url, name: m.title, description: m.meta, isPartOf: { '@type': 'WebSite', name: 'Midwest Industrial Brokers', url: SITE + '/' }, about: { '@id': SITE + '/#business' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Markets', item: SITE + '/#markets' },
      { '@type': 'ListItem', position: 3, name: m.name, item: url } ] },
    { '@type': 'Service', name: `Industrial real estate brokerage in ${m.full_name}`, serviceType: 'Industrial real estate brokerage', provider: business, areaServed: { '@type': 'Place', name: m.full_name },
      hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Services', itemListElement: (data.services || []).map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.title, description: s.description } })) } },
  ] };
  const body = `<header class="page-hero${dealPhoto ? ' has-photo' : ''}" id="top">
  ${dealPhoto ? `<img class="hero-bg" src="${esc(dealPhoto)}" alt="" width="1200" height="720" fetchpriority="high" /><div class="hero-shade"></div>` : ''}
  <div class="wrap">
    <div class="crumbs"><a href="/">Home</a> / <a href="/#markets">Markets</a> / ${esc(m.name)}</div>
    <h1>Industrial Real Estate in ${esc(m.full_name)}</h1>
    <div class="lede">${(m.intro || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="hero-cta" style="margin-top:32px;">
      <a href="tel:+12489411125" class="btn btn-primary" data-track="call_mobile">Call Drake (248) 941-1125 <span class="arrow" aria-hidden="true">→</span></a>
      <a href="/#contact" class="btn btn-ghost">Tell Me What You Need <span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </div>
</header>
<section class="block">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">01</span><h2>Services</h2></div><span class="section-tag">${esc(m.name)}</span></div>
    <ul class="services-list">${R.serviceList(data.services)}</ul>
  </div>
</section>
<section class="block" id="deals">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">02</span><h2>Closed Deals</h2></div><span class="section-tag">${esc(m.name)}</span></div>
    ${deals.length ? `<table class="deals-table">
      <thead><tr><th style="width:90px;">Year</th><th>Property</th><th>Client</th><th>Represented</th><th>Type</th><th style="text-align:right;">Size / Value</th></tr></thead>
      <tbody>${R.deals(deals)}</tbody>
    </table>` : `<p class="empty-note">No closed deals are posted for this market yet. <a href="/#deals">See all closed deals</a>.</p>`}
  </div>
</section>
<section class="block dark" id="listings">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">03</span><h2>Active Listings</h2></div><span class="section-tag">From CPIX</span></div>
    ${shown.length ? `<ul class="listing-grid">${shown.map(R.listingCard).join('')}</ul>` : `<p class="empty-note">No active listings in this market right now.</p>`}
    <p class="listings-note">${listings.length > shown.length ? `Showing ${shown.length} of ${listings.length} listings here. ` : ''}<a class="btn btn-ghost" style="margin-top:16px;" href="${esc(CPIX)}" target="_blank" rel="noopener" data-track="cpix_all">View All Listings on CPIX <span class="arrow" aria-hidden="true">↗</span></a></p>
  </div>
</section>
<section class="block alt">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">04</span><h2>Other Markets</h2></div><span class="section-tag">Where We Work</span></div>
    <ul class="market-grid-cards">${R.marketCards(others, data.closed_deals, data.listings)}</ul>
  </div>
</section>`;
  const dir = path.join('markets', m.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({ title: m.title, description: m.meta, canonical: url, image: photo, jsonld, body, pageType: 'market' }));
}

// ---------- thank-you.html (no-JS fallback for the lead form) ----------
fs.writeFileSync('thank-you.html', page({
  title: 'Thank You | Midwest Industrial Brokers', description: 'Thanks for contacting Midwest Industrial Brokers.', robots: 'noindex, follow',
  body: `<header class="page-hero" id="top"><div class="wrap"><h1>Thanks. Your note is on its way.</h1><div class="lede"><p>Drake will follow up soon. If it is urgent, call <a style="color:#FFD400" href="tel:+12489411125">(248) 941-1125</a>.</p></div><div class="hero-cta" style="margin-top:32px;"><a href="/" class="btn btn-primary">Back to Home <span class="arrow" aria-hidden="true">→</span></a></div></div></header>`,
}));

// ---------- sitemap.xml ----------
const urls = [SITE + '/', ...markets.map(m => SITE + R.marketUrl(m)), ...(data.closed_deals || []).filter(d => d.slug).map(d => SITE + '/deal.html?slug=' + encodeURIComponent(d.slug))];
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);

// ---------- llms.txt ----------
const t = (data.team || [])[0] || {};
const real = (s) => !R.isPlaceholder(s);
const llms = `# Midwest Industrial Brokers

> Industrial commercial real estate brokerage for Plymouth, Ann Arbor, the I-275 corridor and greater Metro Detroit, Michigan. Led by Drake Filippis, Associate Broker with Signature Associates.

## Contact
- Broker: ${t.name || 'Drake Filippis'}, ${t.title || 'Associate Broker'}, Signature Associates
- Mobile: ${t.mobile_phone || '(248) 941-1125'}
- Office: ${t.office_phone || '(248) 799-3161'}
- Email: ${t.email || 'dfilippis@signatureassociates.com'}
- Contact form: ${SITE}/#contact
- Office address: Signature Associates, One Towne Square, Suite 1200, Southfield, MI 48076
- LinkedIn: ${t.linkedin_url || ''}

## Services
${(data.services || []).filter(s => real(s.title)).map(s => `- ${s.title}: ${s.description}`).join('\n')}

## Markets served
${markets.map(m => `- [${m.name}](${SITE}${R.marketUrl(m)}): ${m.summary}`).join('\n')}
- Coverage: ${(data.coverage_cities || []).join(', ')}

## Active listings
- [All active sale and lease listings on CPIX](${CPIX})
${(data.listings || []).filter(l => l.show !== false).map(l => `- [${l.title}](${l.url}): ${l.deal_type}, ${[l.use, l.size, l.lot ? l.lot + ' lot' : ''].filter(Boolean).join(', ')}, ${l.address}`).join('\n')}

## Selected closed deals
${(data.closed_deals || []).filter(d => d.slug).map(d => `- [${d.property}, ${d.subtitle}](${SITE}/deal.html?slug=${encodeURIComponent(d.slug)}): ${d.year} ${d.deal_type}, ${d.size}${real(d.client) ? ', ' + d.client : ''}, represented ${String(d.side || '').toLowerCase()}`).join('\n')}

## Clients
${(data.client_logos || []).filter(l => l && l.name).map(l => `- ${l.name}${l.url ? ' (' + l.url + ')' : ''}`).join('\n')}

## FAQ
${(data.faqs || []).map(f => `### ${f.q}\n${f.a}`).join('\n\n')}

## Pages
- [Home](${SITE}/)
${markets.map(m => `- [Industrial real estate in ${m.full_name}](${SITE}${R.marketUrl(m)})`).join('\n')}
`;
fs.writeFileSync('llms.txt', llms);
console.log(`Built index.html, deal.html, ${markets.length} market pages, thank-you.html, sitemap.xml (${urls.length} urls), llms.txt`);
