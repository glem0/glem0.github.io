// Dive Gear Australia (https://divegearaustralia.com.au/) - WooCommerce (Flatsome theme), read through
// the generic Store API module in lib/woocommerce.js. Site-specific facts:
//
//   The Store API (/wp-json/wc/store/v1/products, x-wp-total ~2595 => 26 pages of ~1.4 MB) is the
//   ONLY path that is not behind the site's Cloudflare managed challenge: HTML pages, XML sitemaps
//   and /wp-json/wp/v2/* answer 403 "Just a moment..." (cf-mitigated: challenge) to Node's fetch
//   with every header set tried, while the Store API answers 200 for curl (HTTP/1.1 and HTTP/2),
//   for a bare `node` User-Agent and for Node's fetch with the lib/http.js defaults (confirmed
//   2026-09-20).
//
//   ~140 of ~1070 variable products have variants that differ in price and get one per-variation
//   request each. The ~65 "composite" products are the shop's build-your-own scuba / snorkelling
//   packages, sold at a real discounted price that only the (Cloudflare-challenged) HTML page shows
//   and that cannot be derived from the component list, so those packages are not indexed (README).
//   Set DGA_SKIP_VARIATIONS=1 to skip the per-variation requests entirely.
//
//   RESIDUAL RISK: if Cloudflare ever extends the challenge to /wp-json/wc/store/* this module fails
//   outright (index.js then keeps the previous data). There is no HTML fallback because the HTML
//   pages are already challenged for non-browser clients. To stay clear of whatever triggers that,
//   this host is fetched one request at a time, >= 1.5 s apart (the lib default; robots.txt asks
//   Crawl-delay 10 for HTML paths): ~170 JSON requests, 4-5 minutes.

import * as woo from '../lib/woocommerce.js';

const CFG = {
  key: 'divegearaustralia',
  name: 'Dive Gear Australia',
  homepage: 'https://divegearaustralia.com.au/',
  skipVariationsEnv: 'DGA_SKIP_VARIATIONS',
};

// The parsers, bound to this shop's configuration (scraper/test/divegearaustralia.test.js).
export const toProduct = (raw, variations = null) => woo.toProduct(raw, variations, CFG);
export const pickCategory = (raw) => woo.pickCategory(raw, CFG);
export { dropReason, rawPrices, needsVariationPrices, variationTitle } from '../lib/woocommerce.js';

export default woo.wooRetailer(CFG);
