// Pre-renders data.json content into index.html (between BUILD markers) so the
// page is readable without JavaScript. Runs on every Netlify deploy (netlify.toml),
// so CMS edits to data.json flow into the static HTML automatically.
const fs = require('fs');
const R = require('./render.js');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
let html = fs.readFileSync('index.html', 'utf8');
const parts = {
  coverage: R.coverage(data.coverage_cities),
  stats: R.stats(data.stats),
  team: R.team(data.team),
  services: R.serviceList(data.services),
  dealphotos: R.dealPhotos(data.closed_deals),
  deals: R.deals(data.closed_deals),
  logos: R.logos(data.client_logos),
};
for (const [k, v] of Object.entries(parts)) {
  const re = new RegExp(`<!--BUILD:${k}-->[\\s\\S]*?<!--/BUILD:${k}-->`);
  if (!re.test(html)) throw new Error('missing marker ' + k);
  html = html.replace(re, () => `<!--BUILD:${k}-->${v}<!--/BUILD:${k}-->`);
}
fs.writeFileSync('index.html', html);
console.log('Pre-rendered:', Object.keys(parts).join(', '));
