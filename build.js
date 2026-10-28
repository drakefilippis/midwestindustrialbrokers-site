// Pre-renders data.json content into static HTML so the site is readable without
// JavaScript (search engines and AI tools). Runs on every Netlify deploy (netlify.toml),
// so CMS edits to data.json flow into the static HTML automatically.
//   index.html            sections between <!--BUILD:x--> markers
//   deal.html             analytics marker
//   markets/<slug>/       one page per city market in data.json "markets" AND county hub in "counties"
//   services/<slug>/      one page per core & specialty service in data.json "services"
//   deals/<slug>/         one static case study page per closed deal in data.json "closed_deals"
//   thank-you.html        form fallback page (noindex)
//   sitemap.xml, llms.txt regenerated from data.json
const fs = require('fs');
const path = require('path');
const R = require('./render.js');
const SITE = 'https://midwestindustrialbrokers.com';
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const esc = R.esc;
const markets = data.markets || [];
const counties = data.counties || [];
const services = (data.services || []).filter(sv => sv.slug && !R.isPlaceholder(sv.title));
const coreServices = services.filter(sv => sv.category !== 'specialty');
const specialtyServices = services.filter(sv => sv.category === 'specialty');
const listingsCfg = data.listings_settings || {};
const CPIX = listingsCfg.cpix_url || 'https://cpix.resimplifi.com/cards?types=sale_lease&statuses=active&brokers=3440e031';

const SAME_AS_URLS = [
  'https://www.signatureassociates.com/?team=drake-filippis',
  'https://cpix.resimplifi.com/brokers/3440e031-drake-filippis',
  'https://cpix.resimplifi.com/cards?types=sale_lease&statuses=active&brokers=3440e031',
  'https://www.crexi.com/profile/drake-filippis-drakefili',
  'https://www.loopnet.com/company/signature-associates/southfield-mi/nklpdsnl/',
  'https://www.linkedin.com/in/drake-filippis-267a104a/',
  'https://x.com/detroitdrake',
  'https://rejournals.com/a-tale-of-resiliency-and-adaptability-at-detroit-industrial-real-estate-summit/',
  'https://www.signatureassociates.com/50m-cold-storage-facility-could-bring-up-to-225-jobs-to-metro-detroit/',
  'https://www.signatureassociates.com/private-equity-firm-plans-4-8m-square-feet-of-industrial-space-along-i-94-in-southeast-michigan/',
  'https://www.mlive.com/news/ann-arbor/2026/01/new-downtown-ann-arbor-fitness-studio-promises-fun-unique-and-challenging-workouts.html'
];

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

// Simple markdown-to-HTML helper for static deal pages
function mdToHtml(md) {
  if (!md || R.isPlaceholder(md)) return '';
  return String(md).trim().split(/\n\n+/).map(block => {
    const lines = block.trim().split('\n');
    if (lines[0].startsWith('### ')) {
      return `<h3>${esc(lines[0].slice(4).trim())}</h3>` + (lines.length > 1 ? mdToHtml(lines.slice(1).join('\n')) : '');
    }
    if (lines.every(l => l.trim().startsWith('- '))) {
      return `<ul>${lines.map(l => {
        const item = esc(l.trim().slice(2)).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return `<li>${item}</li>`;
      }).join('')}</ul>`;
    }
    const p = esc(block.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return `<p>${p}</p>`;
  }).join('\n');
}

// ---------- analytics (GA4 loads only when a measurement ID is set) ----------
const gaId = String((data.analytics || {}).ga4_measurement_id || '').trim();
const analytics = /^G-[A-Z0-9]{4,}$/.test(gaId)
  ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>`
  : '';
if (gaId && !analytics) console.warn('analytics.ga4_measurement_id does not look like a GA4 ID (G-XXXXXXX); skipping');

// ---------- index.html ----------
const primaryMarketsList = markets.filter(m => m.primary);
const footerMarkets = [
  ...primaryMarketsList.map(m => `<li><a href="${R.marketUrl(m)}">${esc(m.name)}</a></li>`),
  ...counties.slice(0, 6).map(c => `<li><a href="/markets/${esc(c.slug)}/">${esc(c.name)} Hub</a></li>`)
].join('');
const homeListings = R.listings(data.listings, { home: true, limit: listingsCfg.home_limit });
const logosHtml = R.logos(data.client_logos);
let html = fs.readFileSync('index.html', 'utf8');
html = fill(html, {
  coverage: R.coverage(data.coverage_cities, markets),
  stats: R.stats(data.stats, markets),
  team: R.team(data.team),
  services: R.serviceList(data.services),
  specialties: R.specialtyList(data.services),
  deals: R.dealGrid(data.closed_deals),
  logos: logosHtml,
  listings: homeListings,
  markets: R.homeMarkets(markets, counties, data.closed_deals, data.listings, data.primary_market_groups),
  faq: R.faq(data.faqs),
  faqld: (data.faqs || []).length ? `<script type="application/ld+json">${R.faqJsonLd(data.faqs)}</script>` : '',
  analytics,
  footermarkets: footerMarkets,
  footerservices: services.map(sv => `<li><a href="${R.serviceUrl(sv)}">${esc(sv.short_title || sv.title)}</a></li>`).join(''),
  contactform: R.leadForm({ name: 'contact' }),
  callbuttons: R.callButtons(),
}, 'index.html');
html = toggleHidden(html, /(<div )class="([^"]*listings-empty[^"]*)"( id="listingsEmpty")/, !!homeListings);
html = toggleHidden(html, /(<section )class="([^"]*logo-band[^"]*)"( id="clients")/, !logosHtml);
fs.writeFileSync('index.html', html);

// ---------- deal.html ----------
let deal = fs.readFileSync('deal.html', 'utf8');
deal = fill(deal, { analytics, contactbuttons: R.callButtons() }, 'deal.html');
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
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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

// ---------- market & county pages ----------
const useRank = (l) => /industrial/i.test(l.use) ? 0 : /land/i.test(l.use) ? 1 : 2;
const business = {
  '@type': 'RealEstateAgent',
  '@id': SITE + '/#business',
  name: 'Midwest Industrial Brokers',
  url: SITE + '/',
  telephone: '+1-248-941-1125',
  email: 'dfilippis@signatureassociates.com',
  sameAs: SAME_AS_URLS,
  employee: {
    '@type': 'Person',
    '@id': SITE + '/#drake-filippis',
    name: 'Drake Filippis',
    jobTitle: 'Associate Broker',
    telephone: '+1-248-941-1125',
    sameAs: SAME_AS_URLS
  }
};

const mBySlug = {};
markets.forEach(m => { mBySlug[m.slug] = m; });
const cBySlug = {};
counties.forEach(c => { cBySlug[c.slug] = c; });

fs.rmSync('markets', { recursive: true, force: true });

// 1. Render City Submarket Pages (/markets/<city-slug>/index.html)
for (const m of markets) {
  const url = SITE + R.marketUrl(m);
  const parentCounty = m.county_slug ? cBySlug[m.county_slug] : null;
  const deals = R.marketDeals(data.closed_deals, m);
  const listings = R.marketListings(data.listings, m).map((l, i) => [l, i]).sort((a, b) => useRank(a[0]) - useRank(b[0]) || a[1] - b[1]).map(x => x[0]);
  const shown = listings.slice(0, 12);
  const dealPhoto = deals.map(d => (d.photos || [])[0]).find(Boolean);
  const photo = dealPhoto || (shown[0] && shown[0].photo);
  const siblingCities = parentCounty
    ? (parentCounty.city_slugs || []).map(s => mBySlug[s]).filter(x => x && x.slug !== m.slug)
    : [];
  const otherPrimary = primaryMarketsList.filter(x => x.slug !== m.slug && !siblingCities.some(s => s.slug === x.slug)).slice(0, 8);
  const relatedMarkets = [...siblingCities, ...otherPrimary].slice(0, 12);

  const crumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Markets', item: SITE + '/#markets' }
  ];
  if (parentCounty) {
    crumbItems.push({ '@type': 'ListItem', position: 3, name: parentCounty.name, item: `${SITE}/markets/${parentCounty.slug}/` });
    crumbItems.push({ '@type': 'ListItem', position: 4, name: m.name, item: url });
  } else {
    crumbItems.push({ '@type': 'ListItem', position: 3, name: m.name, item: url });
  }

  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': url, url, name: m.title, description: m.meta, isPartOf: { '@type': 'WebSite', name: 'Midwest Industrial Brokers', url: SITE + '/' }, about: { '@id': SITE + '/#business' } },
    { '@type': 'BreadcrumbList', itemListElement: crumbItems },
    { '@type': 'Service', name: `Industrial real estate brokerage in ${m.full_name}`, serviceType: 'Industrial real estate brokerage', provider: business, areaServed: { '@type': 'Place', name: m.full_name },
      hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Services', itemListElement: services.map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.title, description: s.description } })) } },
  ] };
  const crumbsHtml = parentCounty
    ? `<a href="/">Home</a> / <a href="/#markets">Markets</a> / <a href="/markets/${esc(parentCounty.slug)}/">${esc(parentCounty.name)}</a> / ${esc(m.name)}`
    : `<a href="/">Home</a> / <a href="/#markets">Markets</a> / ${esc(m.name)}`;

  const body = `<header class="page-hero${dealPhoto ? ' has-photo' : ''}" id="top">
  ${dealPhoto ? `<img class="hero-bg" src="${esc(dealPhoto)}" alt="" width="1200" height="720" fetchpriority="high" /><div class="hero-shade"></div>` : ''}
  <div class="wrap">
    <div class="crumbs">${crumbsHtml}</div>
    <h1>Industrial Real Estate in ${esc(m.full_name)}</h1>
    <div class="lede">${(m.intro || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="hero-cta" style="margin-top:32px;">
      <a href="tel:+12489411125" class="btn btn-primary" data-track="call_mobile">Call Drake (248) 941-1125 <span class="arrow" aria-hidden="true">→</span></a>
      <a href="/#contact" class="btn btn-ghost">Tell Me What You Need <span class="arrow" aria-hidden="true">→</span></a>
      ${parentCounty ? `<a href="/markets/${esc(parentCounty.slug)}/" class="btn btn-ghost">${esc(parentCounty.name)} Hub <span class="arrow" aria-hidden="true">→</span></a>` : ''}
    </div>
  </div>
</header>
<section class="contact-band" aria-label="Contact Drake">
  <div class="wrap">
    <div class="cb-head"><span class="cb-k">Talk to Drake</span><h2 class="cb-h">Industrial space in ${esc(m.name)}?</h2></div>
    ${R.callButtons('row')}
  </div>
</section>
<section class="block">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">01</span><h2>Services &amp; Specialties</h2></div><span class="section-tag">${esc(m.name)}</span></div>
    <ul class="services-list svc-grid">${R.serviceList(data.services)}</ul>
    <div class="specialty-block-head"><h3>Industrial Specialties in ${esc(m.name)}</h3><span>High-Intent Advisory</span></div>
    <ul class="services-list specialty-grid">${R.specialtyList(data.services)}</ul>
  </div>
</section>
<section class="block" id="deals">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">02</span><h2>Closed Deals</h2></div><span class="section-tag">${esc(m.name)}</span></div>
    ${deals.length ? `<ul class="deal-card-grid">${R.dealGrid(deals)}</ul>` : `<p class="empty-note">Looking for comparable sales or lease comps in ${esc(m.name)}? Call Drake at <a href="tel:+12489411125">(248) 941-1125</a> or <a href="/#deals">see all closed deals</a>.</p>`}
  </div>
</section>
<section class="block dark" id="listings">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">03</span><h2>Active Listings</h2></div><span class="section-tag">From CPIX</span></div>
    ${shown.length ? `<ul class="listing-grid">${shown.map(R.listingCard).join('')}</ul>` : `<p class="empty-note">Contact Drake at <a href="tel:+12489411125">(248) 941-1125</a> for off-market and upcoming industrial listings in ${esc(m.name)}.</p>`}
    <p class="listings-note">${listings.length > shown.length ? `Showing ${shown.length} of ${listings.length} listings here. ` : ''}<a class="btn btn-ghost" style="margin-top:16px;" href="${esc(CPIX)}" target="_blank" rel="noopener" data-track="cpix_all">View All Listings on CPIX <span class="arrow" aria-hidden="true"><svg class="ext-ico" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" focusable="false"><path d="M3.5 2.5h6v6M9.5 2.5 2.5 9.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></span></a></p>
  </div>
</section>
<section class="block alt">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">04</span><h2>${parentCounty ? `More in ${esc(parentCounty.name)} &amp; Nearby` : 'Other Markets'}</h2></div><span class="section-tag">Where We Work</span></div>
    <ul class="market-grid-cards">${R.marketCards(relatedMarkets, data.closed_deals, data.listings)}</ul>
  </div>
</section>`;
  const dir = path.join('markets', m.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({ title: m.title, description: m.meta, canonical: url, image: photo, jsonld, body, pageType: 'market' }));
}

// 2. Render County Hub Pages (/markets/<county-slug>/index.html)
for (const c of counties) {
  const url = `${SITE}/markets/${c.slug}/`;
  const subMarkets = (c.city_slugs || []).map(s => mBySlug[s]).filter(Boolean);
  const deals = R.marketDeals(data.closed_deals, c);
  const listings = R.marketListings(data.listings, c).map((l, i) => [l, i]).sort((a, b) => useRank(a[0]) - useRank(b[0]) || a[1] - b[1]).map(x => x[0]);
  const shown = listings.slice(0, 12);
  const dealPhoto = deals.map(d => (d.photos || [])[0]).find(Boolean);
  const photo = dealPhoto || (shown[0] && shown[0].photo);
  const otherCounties = counties.filter(x => x.slug !== c.slug);

  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': url, url, name: c.title, description: c.meta, isPartOf: { '@type': 'WebSite', name: 'Midwest Industrial Brokers', url: SITE + '/' }, about: { '@id': SITE + '/#business' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Markets', item: SITE + '/#markets' },
      { '@type': 'ListItem', position: 3, name: c.name, item: url } ] },
    { '@type': 'Service', name: `Industrial real estate brokerage in ${c.full_name}`, serviceType: 'Industrial real estate brokerage', provider: business,
      areaServed: [{ '@type': 'AdministrativeArea', name: c.full_name }, ...subMarkets.map(sm => ({ '@type': 'City', name: sm.full_name }))] }
  ] };

  const body = `<header class="page-hero${dealPhoto ? ' has-photo' : ''}" id="top">
  ${dealPhoto ? `<img class="hero-bg" src="${esc(dealPhoto)}" alt="" width="1200" height="720" fetchpriority="high" /><div class="hero-shade"></div>` : ''}
  <div class="wrap">
    <div class="crumbs"><a href="/">Home</a> / <a href="/#markets">Markets</a> / ${esc(c.name)} Hub</div>
    <h1>Industrial Real Estate in ${esc(c.full_name)}</h1>
    <div class="lede">${(c.intro || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="hero-cta" style="margin-top:32px;">
      <a href="tel:+12489411125" class="btn btn-primary" data-track="call_mobile">Call Drake (248) 941-1125 <span class="arrow" aria-hidden="true">→</span></a>
      <a href="/#contact" class="btn btn-ghost">Tell Me What You Need <span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </div>
</header>
<section class="contact-band" aria-label="Contact Drake">
  <div class="wrap">
    <div class="cb-head"><span class="cb-k">${esc(c.corridor_tag || 'County Hub')}</span><h2 class="cb-h">Need industrial space in ${esc(c.name)}?</h2></div>
    ${R.callButtons('row')}
  </div>
</section>
<section class="block alt" id="submarkets">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">01</span><h2>${esc(c.name)} Submarkets</h2></div><span class="section-tag">${subMarkets.length} Industrial Markets</span></div>
    <ul class="market-grid-cards">${R.marketCards(subMarkets, data.closed_deals, data.listings)}</ul>
  </div>
</section>
<section class="block" id="deals">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">02</span><h2>Closed Deals in ${esc(c.name)}</h2></div><span class="section-tag">Track Record</span></div>
    ${deals.length ? `<ul class="deal-card-grid">${R.dealGrid(deals)}</ul>` : `<p class="empty-note">Call Drake at <a href="tel:+12489411125">(248) 941-1125</a> for recent comparable sales and lease transactions in ${esc(c.name)}, or <a href="/#deals">view all closed deals</a>.</p>`}
  </div>
</section>
<section class="block dark" id="listings">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">03</span><h2>Active Listings in ${esc(c.name)}</h2></div><span class="section-tag">From CPIX</span></div>
    ${shown.length ? `<ul class="listing-grid">${shown.map(R.listingCard).join('')}</ul>` : `<p class="empty-note">Call Drake at <a href="tel:+12489411125">(248) 941-1125</a> for active and off-market opportunities in ${esc(c.name)}.</p>`}
    <p class="listings-note"><a class="btn btn-ghost" style="margin-top:16px;" href="${esc(CPIX)}" target="_blank" rel="noopener" data-track="cpix_all">View All 56 Active Listings on CPIX <span class="arrow" aria-hidden="true">→</span></a></p>
  </div>
</section>
<section class="block">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">04</span><h2>Services &amp; Specialties</h2></div><span class="section-tag">${esc(c.name)}</span></div>
    <ul class="services-list svc-grid">${R.serviceList(data.services)}</ul>
    <div class="specialty-block-head"><h3>High-Intent Industrial Specialties</h3><span>Michigan · Ohio · Midwest</span></div>
    <ul class="services-list specialty-grid">${R.specialtyList(data.services)}</ul>
  </div>
</section>
<section class="block alt">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">05</span><h2>Other Michigan Counties</h2></div><span class="section-tag">11 County Hubs</span></div>
    <ul class="market-grid-cards">${R.marketCards(otherCounties, data.closed_deals, data.listings)}</ul>
  </div>
</section>`;
  const dir = path.join('markets', c.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({ title: c.title, description: c.meta, canonical: url, image: photo, jsonld, body, pageType: 'county' }));
}

// ---------- service & specialty pages (/services/<slug>/index.html) ----------
fs.rmSync('services', { recursive: true, force: true });
for (const sv of services) {
  const url = SITE + R.serviceUrl(sv);
  const deals = R.serviceDeals(data.closed_deals, sv.slug);
  const kwListings = (sv.listings_keywords || []).length
    ? (data.listings || []).filter(l => l.show !== false && sv.listings_keywords.some(kw => new RegExp(kw, 'i').test(l.title + ' ' + l.address)))
    : [];
  const photos = deals.filter(d => (d.photos || []).length);
  const heroPhoto = photos.length ? photos[0].photos[0] : (kwListings[0] && kwListings[0].photo) || '/uploads/cross-and-black.webp';
  const title = `${sv.title} | Industrial Real Estate | Midwest Industrial Brokers`;
  const meta = sv.meta || `${sv.title} for industrial property in Plymouth, Wixom, Ann Arbor, the I-275 corridor, Metro Detroit and the Midwest. ${sv.description} Call Drake Filippis at (248) 941-1125.`;
  const graph = [
    { '@type': 'Service', '@id': url + '#service', name: sv.title, serviceType: sv.title + ' (industrial real estate)', description: (sv.overview || [sv.description]).join(' '), url, provider: business,
      areaServed: [...markets.map(m => ({ '@type': 'Place', name: m.full_name })), { '@type': 'State', name: 'Michigan' }, { '@type': 'State', name: 'Ohio' }],
      audience: (sv.who || []).length ? { '@type': 'Audience', audienceType: sv.who.join('; ') } : undefined },
    { '@type': 'WebPage', '@id': url, url, name: title, description: meta, isPartOf: { '@type': 'WebSite', name: 'Midwest Industrial Brokers', url: SITE + '/' }, about: { '@id': url + '#service' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: SITE + '/#services' },
      { '@type': 'ListItem', position: 3, name: sv.title, item: url } ] },
  ];
  if ((sv.faqs || []).length) {
    graph.push({ '@type': 'FAQPage', mainEntity: sv.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  const jsonld = { '@context': 'https://schema.org', '@graph': graph };
  const isBts = sv.slug === 'build-to-suit';
  let n = 2;
  const pad = (x) => String(x).padStart(2, '0');

  const specsHtml = (sv.specs || []).length
    ? `<ul class="specs-grid">${sv.specs.map(sp => `<li><span class="sp-k">${esc(sp.label)}</span><span class="sp-v">${esc(sp.value)}</span></li>`).join('')}</ul>`
    : '';

  const stepsSection = (sv.steps || []).length ? `<section class="block alt">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">${pad(n++)}</span><h2>How Drake Works</h2></div><span class="section-tag">Process</span></div>
    <ol class="steps">${sv.steps.map(st => `<li><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p></li>`).join('')}</ol>
  </div>
</section>` : '';

  const kwListingsSection = kwListings.length ? `<section class="block dark" id="featured-inventory">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">${pad(n++)}</span><h2>Featured ${esc(sv.short_title || sv.title)} Inventory</h2></div><span class="section-tag">Michigan &amp; Ohio</span></div>
    <ul class="listing-grid">${kwListings.map(R.listingCard).join('')}</ul>
  </div>
</section>` : '';

  const dealsSection = (isBts && !deals.length) ? '' : `<section class="block" id="deals">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">${pad(n++)}</span><h2>Deals Completed</h2></div><span class="section-tag">${esc(sv.short_title || sv.title)}</span></div>
    ${deals.length ? `<ul class="deal-card-grid">${R.dealGrid(deals)}</ul>`
      : `<div class="coming-soon"><div><h3>Talk to Drake about your ${esc(sv.short_title || sv.title)} requirement</h3><p>Share your specifications and timeline. Drake will walk you through active on-market, off-market and build-to-suit options across Michigan and Ohio.</p></div><a href="#inquiry" class="btn btn-primary">Tell Drake About Your Project <span class="arrow" aria-hidden="true">↓</span></a></div>`}
  </div>
</section>`;

  const faqSection = (sv.faqs || []).length ? `<section class="block" id="service-faq">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">${pad(n++)}</span><h2>Frequently Asked Questions</h2></div><span class="section-tag">${esc(sv.short_title || sv.title)}</span></div>
    <div class="faq-list">${R.faq(sv.faqs)}</div>
  </div>
</section>` : '';

  const callButtons = R.callButtons();
  const inquirySection = isBts ? `<section class="block alt bts-req" id="inquiry">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">${pad(n++)}</span><h2>Submit Your Build-to-Suit Requirements</h2></div><span class="section-tag">Build-to-Suit</span></div>
    <div class="contact-grid">
      <div class="contact-side">
        <h3 class="contact-h">Tell Drake what you need to build</h3>
        <p class="contact-intro">Share your size, site and timing needs. Drake will review them, look at land and developer options that fit, and call you to talk through next steps. Rough numbers are fine. Rather talk it through? Call now.</p>
        ${callButtons}
      </div>
      <div class="contact-form-wrap">${R.btsForm()}</div>
    </div>
  </div>
</section>` : `<section class="block alt" id="inquiry">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">${pad(n++)}</span><h2>Start Here</h2></div><span class="section-tag">${esc(sv.short_title || sv.title)}</span></div>
    <div class="contact-grid">
      <div class="contact-side">
        <h3 class="contact-h">Tell me about your project</h3>
        <p class="contact-intro">Share a few details and Drake will follow up. Prefer to talk now? Call Drake directly.</p>
        ${callButtons}
      </div>
      <div class="contact-form-wrap">${R.leadForm({ name: 'service-inquiry', service: sv.title, need: sv.need })}</div>
    </div>
  </div>
</section>`;

  const body = `<header class="page-hero has-photo" id="top">
  <img class="hero-bg" src="${esc(heroPhoto)}" alt="" width="1200" height="720" fetchpriority="high" /><div class="hero-shade"></div>
  <div class="wrap">
    <div class="crumbs"><a href="/">Home</a> / <a href="/#services">Services</a> / ${esc(sv.title)}</div>
    <h1>${esc(sv.title)}</h1>
    <div class="lede"><p>${esc(sv.headline || sv.description)}. ${esc(sv.description)}</p></div>
    <div class="hero-cta" style="margin-top:32px;">
      <a href="#inquiry" class="btn btn-primary">${isBts ? 'Submit Requirements' : 'Start a Conversation'} <span class="arrow" aria-hidden="true">↓</span></a>
      <a href="tel:+12489411125" class="btn btn-ghost" data-track="call_mobile">Call (248) 941-1125 <span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </div>
</header>
<section class="block">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">01</span><h2>Overview</h2></div><span class="section-tag">${esc(sv.tag || sv.title)}</span></div>
    <div class="svc-overview">
      <div>${(sv.overview || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
      ${(sv.who || []).length ? `<aside class="who-box"><h3>Who it is for</h3><ul class="who-list">${sv.who.map(w => `<li>${esc(w)}</li>`).join('')}</ul></aside>` : ''}
    </div>
    ${specsHtml}
  </div>
</section>
${stepsSection}
${kwListingsSection}
${dealsSection}
${faqSection}
${inquirySection}
<section class="block">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">${pad(n++)}</span><h2>All Services &amp; Specialties</h2></div><span class="section-tag">Industrial Brokerage</span></div>
    <ul class="other-services">${services.filter(x => x.slug !== sv.slug).map(x => `<li><a href="${R.serviceUrl(x)}">${esc(x.short_title || x.title)}</a></li>`).join('')}</ul>
  </div>
</section>`;
  const dir = path.join('services', sv.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({ title, description: meta, canonical: url, image: heroPhoto, jsonld, body, pageType: 'service' }));
}

// ---------- static case study pages (/deals/<slug>/index.html) ----------
fs.rmSync('deals', { recursive: true, force: true });
const closedDeals = (data.closed_deals || []).filter(d => d && d.slug);
for (const d of closedDeals) {
  const url = `${SITE}/deals/${encodeURIComponent(d.slug)}/`;
  const title = `${d.headline || d.property} | Closed Deal Case Study | Midwest Industrial Brokers`;
  const meta = d.summary || `${d.year} ${d.deal_type} of ${d.size} at ${d.address || d.property} in ${d.subtitle || 'Michigan'}. Represented ${d.side}. Call Drake Filippis at (248) 941-1125.`;
  const photo = (d.photos || [])[0] || '/uploads/cross-and-black.webp';
  const relatedServices = (d.services || []).map(s => services.find(sv => sv.slug === s)).filter(Boolean);
  const relatedMarkets = markets.filter(m => R.matches(d.subtitle, m.cities) && m.slug !== 'metro-detroit' && m.slug !== 'i-275-corridor');

  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', '@id': url + '#article', headline: d.headline || d.property, description: meta, datePublished: `${d.year}-01-01`, author: { '@id': SITE + '/#drake-filippis' }, publisher: business, image: SITE + photo, mainEntityOfPage: url },
    { '@type': 'WebPage', '@id': url, url, name: title, description: meta, isPartOf: { '@type': 'WebSite', name: 'Midwest Industrial Brokers', url: SITE + '/' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Closed Deals', item: SITE + '/#deals' },
      { '@type': 'ListItem', position: 3, name: d.property || d.headline, item: url } ] }
  ] };

  const facts = [
    ['Property', d.address || d.property],
    ['Market', d.subtitle || d.city],
    ['Transaction Type', d.deal_type],
    ['Size', d.size],
    d.price ? ['Price / Rate', d.price] : null,
    ['Represented', d.side],
    d.client && !R.isPlaceholder(d.client) ? ['Client', d.client] : null,
    d.property_type ? ['Property Use', d.property_type] : null,
    d.closed_date ? ['Closed Date', d.closed_date] : ['Year', d.year]
  ].filter(Boolean);

  const otherDeals = closedDeals.filter(x => x.slug !== d.slug).slice(0, 6);

  const body = `<header class="page-hero${(d.photos || []).length ? ' has-photo' : ''}" id="top">
  ${(d.photos || []).length ? `<img class="hero-bg" src="${esc(d.photos[0])}" alt="${esc(d.property)}" width="1200" height="720" fetchpriority="high" /><div class="hero-shade"></div>` : ''}
  <div class="wrap">
    <div class="crumbs"><a href="/">Home</a> / <a href="/#deals">Closed Deals</a> / ${esc(d.property)}</div>
    <h1>${esc(d.headline || d.property)}</h1>
    <div class="lede"><p>${esc(meta)}</p></div>
    <div class="hero-cta" style="margin-top:32px;">
      <a href="tel:+12489411125" class="btn btn-primary" data-track="call_mobile">Call Drake (248) 941-1125 <span class="arrow" aria-hidden="true">→</span></a>
      <a href="/#contact" class="btn btn-ghost">Have a Similar Requirement? <span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </div>
</header>
<section class="block">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">01</span><h2>Case Study &amp; Deal Facts</h2></div><span class="section-tag">${esc(d.year)} · ${esc(d.deal_type)}</span></div>
    <div class="svc-overview">
      <div>
        ${(d.photos || []).length ? `<div style="margin-bottom:28px;"><img src="${esc(d.photos[0])}" alt="${esc(d.property)}" style="width:100%;max-height:460px;object-fit:cover;border:1px solid var(--line-steel);" /></div>` : ''}
        ${mdToHtml(d.body_md)}
        ${relatedMarkets.length ? `<p style="margin-top:24px;"><strong>Market Coverage:</strong> ${relatedMarkets.map(m => `<a style="color:var(--yellow);" href="/markets/${esc(m.slug)}/">${esc(m.name)}</a>`).join(', ')}</p>` : ''}
        ${relatedServices.length ? `<p style="margin-top:12px;"><strong>Services Provided:</strong> ${relatedServices.map(s => `<a style="color:var(--yellow);" href="/services/${esc(s.slug)}/">${esc(s.title)}</a>`).join(', ')}</p>` : ''}
      </div>
      <aside class="who-box">
        <h3>Transaction Details</h3>
        <ul class="who-list">
          ${facts.map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${esc(v)}</li>`).join('')}
        </ul>
      </aside>
    </div>
  </div>
</section>
<section class="contact-band" aria-label="Contact Drake">
  <div class="wrap">
    <div class="cb-head"><span class="cb-k">Work With Drake</span><h2 class="cb-h">Buying, selling or leasing a similar property?</h2></div>
    ${R.callButtons('row')}
  </div>
</section>
<section class="block alt">
  <div class="wrap">
    <div class="section-head"><div class="section-head-left"><span class="section-num">02</span><h2>More Closed Deals</h2></div><span class="section-tag">Track Record</span></div>
    <ul class="deal-card-grid">${R.dealGrid(otherDeals)}</ul>
  </div>
</section>`;

  const dir = path.join('deals', d.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({ title, description: meta, canonical: url, image: photo, jsonld, body, pageType: 'deal' }));
}

// ---------- thank-you.html (no-JS fallback for the lead form) ----------
fs.writeFileSync('thank-you.html', page({
  title: 'Thank You | Midwest Industrial Brokers', description: 'Thanks for contacting Midwest Industrial Brokers.', robots: 'noindex, follow',
  body: `<header class="page-hero" id="top"><div class="wrap"><h1>Thanks. Your note is on its way.</h1><div class="lede"><p>Drake will follow up soon. If it is urgent, call <a style="color:#FFD400" href="tel:+12489411125">(248) 941-1125</a>.</p></div><div class="hero-cta" style="margin-top:32px;"><a href="/" class="btn btn-primary">Back to Home <span class="arrow" aria-hidden="true">→</span></a></div></div></header>`,
}));

// ---------- thank-you-bts.html (no-JS fallback for the BTS requirements form) ----------
fs.writeFileSync('thank-you-bts.html', page({
  title: 'Requirements Received | Midwest Industrial Brokers', description: 'Thanks for sending your build-to-suit requirements.', robots: 'noindex, follow',
  body: `<header class="page-hero" id="top"><div class="wrap"><h1>Thanks. Your requirements are in.</h1><div class="lede"><p>Drake will review them and follow up to talk through sites and next steps. If it is urgent, call <a style="color:#FFD400" href="tel:+12489411125">(248) 941-1125</a> or the office at <a style="color:#FFD400" href="tel:+12487993161">(248) 799-3161</a>.</p></div><div class="hero-cta" style="margin-top:32px;"><a href="/services/build-to-suit/" class="btn btn-primary">Back to Build-to-Suit <span class="arrow" aria-hidden="true">→</span></a></div></div></header>`,
}));

// ---------- deal-card-preview (prototype, noindex, not in nav or sitemap) ----------
{
  const by = (s) => (data.closed_deals || []).find(d => d.slug === s);
  const cards = [
    [by('michigan-fine-yarn'), {}, 'Sale with photo'],
    [by('bank-supplies-saline'), { noPhoto: true, industry: 'Manufacturing' }, 'Sale with photo placeholder'],
    [by('cross-and-black'), {}, 'Lease with photo'],
  ].filter(c => c[0]);
  const extra = [[by('synergy-dance-clipper-plymouth'), { noPhoto: true }, 'Lease, both sides, placeholder'], [by('4301-highland-rd-waterford'), { noPhoto: true }, 'Sale, placeholder']].filter(c => c[0]);
  const grid = (list) => `<ul class="deal-card-grid">${list.map(([d, o, label]) => `<li><span class="dcp-label">${esc(label)}</span>${R.dealCard(d, o)}</li>`).join('')}</ul>`;
  fs.mkdirSync('deal-card-preview', { recursive: true });
  fs.writeFileSync('deal-card-preview/index.html', page({
    title: 'Deal Card Preview | Midwest Industrial Brokers', description: 'Internal preview of the closed deal card design.', robots: 'noindex, nofollow',
    body: `<header class="page-hero" id="top"><div class="wrap"><div class="crumbs">Internal preview, not linked from the site</div><h1>Closed Deal Cards</h1><div class="lede"><p>Prototype of the card each closed deal will use. Each card shows sold or leased, who Drake represented, size, city and industry. Cards without a photo get the branded placeholder until a photo is added. Cards link only when a full deal page exists.</p></div></div></header>
<section class="block"><div class="wrap">
  <div class="section-head"><div class="section-head-left"><span class="section-num">01</span><h2>Sample Grid</h2></div><span class="section-tag">Prototype</span></div>
  ${grid(cards)}
</div></section>
<section class="block alt"><div class="wrap">
  <div class="section-head"><div class="section-head-left"><span class="section-num">02</span><h2>More Variants</h2></div><span class="section-tag">Placeholder and both sides</span></div>
  ${grid(extra)}
</div></section>`,
  }));
}

// ---------- sitemap.xml ----------
const urls = [
  SITE + '/',
  ...services.map(sv => SITE + R.serviceUrl(sv)),
  ...counties.map(c => `${SITE}/markets/${c.slug}/`),
  ...markets.map(m => SITE + R.marketUrl(m)),
  ...closedDeals.map(d => `${SITE}/deals/${encodeURIComponent(d.slug)}/`)
];
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);

// ---------- llms.txt ----------
const t = (data.team || [])[0] || {};
const real = (s) => !R.isPlaceholder(s);
const llms = `# Midwest Industrial Brokers

> Dedicated industrial commercial real estate brokerage platform of Drake Filippis, Associate Broker with Signature Associates. Specializing in manufacturing, cold storage (freezer/cooler & food logistics across Michigan, Ohio & the Midwest), heavy power manufacturing & reindustrialization/reshoring, robotics & automation, data center supply chain manufacturing, sale-leasebacks (with Signature Associates' exclusive national Sale-Leaseback team), defense & aerospace, R&D/lab/cleanroom facilities, Industrial Outdoor Storage (IOS), and brownfield/BEA economic development incentives.

## Canonical Entity & Broker Facts
- Broker: ${t.name || 'Drake Filippis'}, ${t.title || 'Associate Broker'}, Signature Associates
- Platform: Founder, Midwest Industrial Brokers (${SITE}/)
- Education: Purdue University (educated alongside industrial, mechanical, and robotics engineers; raised in a Midwest industrial town)
- Experience & Track Record: 14+ Years in Real Estate | $60M+ in Recent Commercial Real Estate Volume | 70+ Transactions Closed (2024-2026) | 56 Active Listings with 3,000,000+ SF Available Throughout the Midwest
- Mobile: ${t.mobile_phone || '(248) 941-1125'}
- Office: ${t.office_phone || '(248) 799-3161'}
- Email: ${t.email || 'dfilippis@signatureassociates.com'}
- Contact form: ${SITE}/#contact
- Office address: Signature Associates, One Towne Square, Suite 1200, Southfield, MI 48076
- Signature Associates Profile: https://www.signatureassociates.com/?team=drake-filippis
- CPIX Broker Profile: https://cpix.resimplifi.com/brokers/3440e031-drake-filippis
- CPIX Active Listings: ${CPIX}
- LinkedIn: ${t.linkedin_url || 'https://www.linkedin.com/in/drake-filippis-267a104a/'}
- X (Twitter): https://x.com/detroitdrake
- Crexi Profile: https://www.crexi.com/profile/drake-filippis-drakefili
- LoopNet Profile: https://www.loopnet.com/company/signature-associates/southfield-mi/nklpdsnl/

## Core Brokerage Services
${coreServices.map(sv => `- [${sv.title}](${SITE}${R.serviceUrl(sv)}): ${sv.description}`).join('\n')}

## High-Intent Industrial Specialties
${specialtyServices.map(sv => `- [${sv.title}](${SITE}${R.serviceUrl(sv)}): ${sv.description}`).join('\n')}

## County Industrial Hubs (Michigan & Ohio Border Corridors)
${counties.map(c => `- [${c.name} (${c.full_name})](${SITE}/markets/${c.slug}/): ${c.summary}`).join('\n')}

## Primary & Submarket City Pages
${markets.map(m => `- [${m.name} (${m.full_name})](${SITE}${R.marketUrl(m)}): ${m.summary}`).join('\n')}

## Active Listings (Sample from 56 Active Listings / 3,000,000+ SF)
- [All active sale and lease listings on CPIX](${CPIX})
${(data.listings || []).filter(l => l.show !== false).map(l => `- [${l.title}](${l.url}): ${l.deal_type}, ${[l.use, l.size, l.lot ? l.lot + ' lot' : ''].filter(Boolean).join(', ')}, ${l.address}`).join('\n')}

## Closed Deal Case Studies (Static Indexable Pages)
${closedDeals.map(d => `- [${d.headline || d.property} (${d.subtitle})](${SITE}/deals/${encodeURIComponent(d.slug)}/): ${d.year} ${d.deal_type}, ${d.size}${d.price ? ', ' + d.price : ''}${real(d.client) ? ', client: ' + d.client : ''}, represented ${String(d.side || '').toLowerCase()}`).join('\n')}

## Trade Press & Industry Citations
${(data.press_citations || []).map(p => `- [${p.title}](${p.url}) (${p.publication}, ${p.date}) - ${p.role}`).join('\n')}

## Clients Represented
${(data.client_logos || []).filter(l => l && l.name).map(l => `- ${l.name}${l.url ? ' (' + l.url + ')' : ''}`).join('\n')}

## FAQ
${(data.faqs || []).map(f => `### ${f.q}\n${f.a}`).join('\n\n')}
`;
fs.writeFileSync('llms.txt', llms);
console.log(`Built index.html, deal.html, ${services.length} service/specialty pages (${coreServices.length} core + ${specialtyServices.length} specialty), ${counties.length} county hub pages, ${markets.length} city market pages, ${closedDeals.length} static deal pages, thank-you.html, thank-you-bts.html, sitemap.xml (${urls.length} urls), llms.txt`);
