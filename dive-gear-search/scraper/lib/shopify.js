// Generic Shopify storefront catalogue fetcher.
//
// Every Shopify store exposes  GET /products.json?limit=250&page=N  (and per-collection
// /collections/<handle>/products.json). Prices there are dollar strings on each variant;
// there is no product-level price. Stop when a page returns an empty array.
//
// Shopify Markets: a store can answer in a different currency (and, with market price lists,
// different prices) depending on the country the request comes from, and the GitHub Actions runner
// is in the United States: Perth Scuba's catalogue came back in USD on the first scheduled run.
// Every storefront request therefore carries ?country=AU&currency=AUD, which Shopify honours on its
// JSON endpoints and pages, and before a catalogue is read the store's own `Shopify.currency` marker
// is checked under the same parameters. A store that still answers in another currency fails the
// run (its previous data is kept) rather than publishing prices in the wrong currency.

import { fetchJson, fetchText } from './http.js';
import { makeProduct } from './product.js';
import { stripTags } from './html.js';
import { normalizeBrand, brandFromTitle } from './normalize.js';

export const MARKET = { country: 'AU', currency: 'AUD' };

/** Append the market context to a storefront URL. */
export function withMarket(url) {
  return `${url}${url.includes('?') ? '&' : '?'}country=${MARKET.country}&currency=${MARKET.currency}`;
}

/** The `Shopify.currency = {"active":"AUD","rate":"1.0"}` marker Shopify themes embed, or null. */
export function parseStoreCurrency(html) {
  const m = /Shopify\.currency\s*=\s*(\{[^}]*\})/.exec(String(html || ''));
  if (!m) return null;
  try {
    const j = JSON.parse(m[1]);
    return j && typeof j.active === 'string' ? { active: j.active, rate: Number(j.rate) } : null;
  } catch {
    return null;
  }
}

/**
 * Check which market the store serves this runner under the pinned context. Throws when it is not
 * MARKET.currency; returns null (and logs) when the theme has no marker to check.
 */
export async function assertMarket(base, { log = () => {} } = {}) {
  const root = base.replace(/\/$/, '');
  const html = await fetchText(withMarket(`${root}/`), { accept: 'text/html' });
  const cur = parseStoreCurrency(html);
  if (!cur) {
    log(`${root}: no Shopify.currency marker on the storefront, cannot verify the market`);
    return null;
  }
  if (cur.active !== MARKET.currency) {
    throw new Error(`storefront answers in ${cur.active} (rate ${cur.rate}) despite ?country=${MARKET.country}&currency=${MARKET.currency}: Shopify Markets is serving another market to this runner`);
  }
  return cur;
}

/**
 * Fetch every product from a Shopify store.
 * @param {string} base      e.g. 'https://adreno.com.au'
 * @param {object} [opts]
 * @param {string} [opts.collection]  restrict to /collections/<handle>/products.json
 * @param {number} [opts.maxPages]    safety cap (default 60 => 15,000 products)
 * @param {function} [opts.log]
 * @returns {Promise<object[]>} raw Shopify product objects
 */
export async function fetchShopifyProducts(base, { collection = '', maxPages = 60, log = () => {} } = {}) {
  const root = base.replace(/\/$/, '');
  const path = collection ? `/collections/${collection}/products.json` : '/products.json';
  const seen = new Set();
  const out = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const url = withMarket(`${root}${path}?limit=250&page=${page}`);
    const data = await fetchJson(url);
    const products = Array.isArray(data.products) ? data.products : [];
    if (products.length === 0) break;
    for (const p of products) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    log(`${root}: page ${page} -> ${products.length} products (total ${out.length})`);
    if (products.length < 250) break;
  }
  return out;
}

/** Strip Shopify tracking params and force https + canonical /products/<handle>. */
export function productUrl(base, handle) {
  return `${base.replace(/\/$/, '')}/products/${handle}`;
}

/** Best image for a product: first product image, else first variant featured image. */
export function primaryImage(p) {
  const src = p.images?.[0]?.src || p.image?.src || p.variants?.find((v) => v.featured_image?.src)?.featured_image?.src || '';
  return src ? src.replace(/^http:/, 'https:') : '';
}

const ZERO = (s) => s === null || s === undefined || s === '' || Number(s) === 0;

/**
 * Convert one raw Shopify product to the canonical Product.
 * @param {object} raw           product from products.json
 * @param {object} cfg
 * @param {string} cfg.retailer  retailer key
 * @param {string} cfg.base      store base URL
 * @param {function} [cfg.category]   (raw) => category string; default product_type
 * @param {function} [cfg.brand]      (raw) => brand string; default: title prefix, else the vendor unless it
 *                                     is a known non-brand (the shop's own name, "Not specified", ...)
 */
export function shopifyToProduct(raw, cfg) {
  const variants = (raw.variants || []).map((v) => ({
    title: v.title === 'Default Title' ? 'Default' : v.title,
    price: ZERO(v.price) ? null : v.price,
    compareAtPrice: ZERO(v.compare_at_price) ? null : v.compare_at_price,
    available: Boolean(v.available),
    sku: v.sku || '',
  }));
  const brand = cfg.brand ? cfg.brand(raw) : brandFromTitle(raw.title) || (normalizeBrand(raw.vendor) ? raw.vendor : '');
  return makeProduct({
    retailer: cfg.retailer,
    sourceId: raw.id,
    title: raw.title,
    brand,
    category: cfg.category ? cfg.category(raw) : raw.product_type || '',
    url: productUrl(cfg.base, raw.handle),
    image: primaryImage(raw),
    variants,
    tags: (raw.tags || []).slice(0, 30),
    description: stripTags(raw.body_html || '').slice(0, 300),
  });
}

/**
 * Convenience: build a retailer module for a plain Shopify store.
 * @param {object} cfg  { key, name, homepage, base?, collection?, category?, brand?, keep?(raw)=>bool }
 */
export function shopifyRetailer(cfg) {
  const base = (cfg.base || cfg.homepage).replace(/\/$/, '');
  return {
    key: cfg.key,
    name: cfg.name,
    homepage: cfg.homepage,
    platform: 'shopify',
    base,
    async fetch({ log } = {}) {
      await assertMarket(base, { log: log || (() => {}) });
      const raws = await fetchShopifyProducts(base, { collection: cfg.collection, log: log || (() => {}) });
      const out = [];
      let dropped = 0;
      for (const raw of raws) {
        if (cfg.keep && !cfg.keep(raw)) {
          dropped += 1;
          continue;
        }
        try {
          out.push(shopifyToProduct(raw, { retailer: cfg.key, base, category: cfg.category, brand: cfg.brand }));
        } catch (err) {
          dropped += 1;
          if (log) log(`${cfg.key}: skipped ${raw.handle}: ${err.message}`);
        }
      }
      if (log) log(`${cfg.key}: ${out.length} products (${dropped} dropped by filter)`);
      return out;
    },
  };
}
