// Dive Gear Australia (https://divegearaustralia.com.au/) - WooCommerce (Flatsome theme).
//
// HOW IT WORKS
//   The public WooCommerce Store API
//     GET /wp-json/wc/store/v1/products?per_page=100&page=N&orderby=id&order=asc
//   lists the whole catalogue (x-wp-total 2595 => 26 pages of ~1.4 MB) with prices, stock,
//   brand, categories, images and variation ids. It is the ONLY path that is not behind the
//   site's Cloudflare managed challenge: HTML pages, XML sitemaps and /wp-json/wp/v2/* answer
//   403 "Just a moment..." (cf-mitigated: challenge) to Node's fetch with every header set
//   tried, while the Store API answers 200 for curl (HTTP/1.1 and HTTP/2), for a bare `node`
//   User-Agent and for Node's fetch with the lib/http.js defaults (confirmed 2026-09-20).
//   per_page=100 is the server maximum (250 => HTTP 400). The `link` header is entity-mangled,
//   so page URLs are built by hand and the crawl stops on an empty / short page.
//
// PRICES are strings in CENTS (currency_minor_unit 2), AUD, GST inclusive. By product type:
//   simple     prices.price (current) / prices.regular_price (RRP when higher)
//   variable   prices.price is the cheapest variant; prices.price_range is non-null only when
//              variants differ in price (~140 of ~1070 variable products). For those we fetch
//              the per-variation prices (one extra request each, capped); for the rest the
//              listing's variations[] + attributes[] give the variant titles and every variant
//              shares the product price, so no extra request is needed.
//   bundle     prices.price is "0"; the real price is extensions.bundles.bundle_price.price.min.incl_tax
//   composite / external / gift-card   no usable price in the API => dropped. The ~65 composites are
//              the shop's build-your-own scuba / snorkelling packages, sold at a real discounted price
//              that only the (Cloudflare-challenged) HTML page shows and that cannot be derived from
//              the component list, so those packages are not indexed (see README).
//   Anything left with a zero / missing price (POA, placeholders) is dropped as well, because the
//   build step would exclude it anyway. Set DGA_SKIP_VARIATIONS=1 to skip the per-variation
//   requests entirely (variants then all carry the from-price; the product price is unaffected).
//
// CATEGORY: products sit in many categories at once (merchandising ones like "Christmas Sale",
//   "travel scuba gear", "Dive Travel Accessories" and brand ones like "Cressi Spearfishing"
//   alongside the real tree). pickCategory() takes the deepest real category and never a
//   merchandising one, because the build step treats "travel" in a category as an exclusion.
//
// RESIDUAL RISK: if Cloudflare ever extends the challenge to /wp-json/wc/store/* this module
// fails outright (index.js then keeps the previous data). There is no HTML fallback because the
// HTML pages are already challenged for non-browser clients. To stay clear of whatever triggers
// that, this host is fetched one request at a time, >= 1.5 s apart (HTTP_OPTS; robots.txt asks
// Crawl-delay 10 for HTML paths): ~170 JSON requests, 4-5 minutes. The optional per-variation
// requests get a single retry and are abandoned after a few consecutive failures, so an outage of
// that endpoint cannot eat the workflow's 30-minute budget for data the product price does not need.

import { fetchResponse, mapLimit } from '../lib/http.js';
import { makeProduct, parsePrice } from '../lib/product.js';
import { stripTags, decodeEntities } from '../lib/html.js';

const KEY = 'divegearaustralia';
const HOMEPAGE = 'https://divegearaustralia.com.au/';
const API = 'https://divegearaustralia.com.au/wp-json/wc/store/v1/products';
const PER_PAGE = 100;
const MAX_PAGES = 60; // safety cap: 6,000 products (catalogue is ~2,600)
const MAX_VARIATION_FETCHES = 300; // only variable products whose variants differ in price need one
const MAX_CONSECUTIVE_VARIATION_FAILURES = 5; // then stop asking: the product price does not depend on them
// Politeness for this host: one request in flight, >= 1.5 s between request starts. lib/http.js keys
// its limiter on the host and reads these on the first request, and every request here goes
// through storeApi(), so the settings always apply.
const HTTP_OPTS = { accept: 'application/json', perHostConcurrency: 1, perHostMinDelayMs: 1500 };

// Product types the Store API cannot price (composites/externals report price "0").
const DROP_TYPES = new Set(['composite', 'external', 'gift-card']);
// Placeholder records seen in the catalogue (checkout tests, "Gift this product" stubs, ...).
const JUNK_TITLE = /^(test product|sspa checkout test|discount|gift this product|gift card)\b/i;

// Category path segments that are merchandising rather than a product type ("Christmas Sale",
// "travel scuba gear", "Dive Travel Accessories" - the last one holds torches and wetsuits).
// A product whose only categories are of this kind gets category '' and is classified from its
// title, because the build step treats words like "travel" in a category as decisive.
const MARKETING_SEGMENT = /(^|-)(gift|gifts|sale|clearance|special|specials|deal|deals|featured|new|new-arrivals?|best-sellers?|black-friday|boxing-day|cyber-monday|essentials|travel|uncategori[sz]ed|all-products?)($|-)|^(womens-dive-gear|shop)$/;
// Audience qualifiers: a parent category ("Diving Masks") is preferred over a qualified leaf
// ("Women's Dive Masks") because the title already carries the audience.
const QUALIFIER_SEGMENT = /(^|-)(womens|mens|men|women|ladies|lady|kids|youth|junior|juniors|adult|adults|small-face|large-face)(-|$)/;
// Root segment that adds nothing ("Dive Gear - Regulators" => "Regulators").
const ROOT_SEGMENT = 'dive-gear';

const cents = (v) => {
  const n = parsePrice(v, { cents: true });
  return n === null || n === 0 ? null : n;
};
const clean = (s) => decodeEntities(String(s ?? '')).replace(/\s+/g, ' ').trim();
const humanize = (slug) => {
  const s = String(slug || '');
  return s.length <= 3 ? s.toUpperCase() : s.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
};
/** Display name of a category; SEO-stuffed names ("BCD Rear Inflation, Jacket Style and Travel BCD's") fall back to the slug. */
const categoryName = (cat) => {
  const name = clean(cat?.name);
  return name && name.length <= 40 && !name.includes(',') ? name : humanize(cat?.slug) || name;
};

/** Path segments of a category link: .../product-category/dive-gear/regulators/ => ['dive-gear','regulators'] */
function categoryPath(cat) {
  const m = /\/product-category\/([^?#]*)/.exec(String(cat?.link || ''));
  const segs = m ? m[1].split('/').filter(Boolean) : [];
  return segs.length ? segs : cat?.slug ? [String(cat.slug)] : [];
}

/**
 * Pick the most specific "what is it" category of a Store API product and return it as a
 * " - " joined path of names, e.g. "Regulators - Tech Diving Regulators". '' when none.
 */
export function pickCategory(raw) {
  const cats = Array.isArray(raw?.categories) ? raw.categories : [];
  const brandSlugs = new Set(
    (raw?.brands || [])
      .flatMap((b) => [String(b.slug || ''), String(b.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')])
      .map((s) => s.replace(/^-|-$/g, ''))
      .filter((s) => s.length >= 3),
  );
  const isBrandSeg = (s) => [...brandSlugs].some((b) => s === b || s.startsWith(`${b}-`));
  const nameBySlug = new Map();
  for (const c of cats) if (c?.slug) nameBySlug.set(String(c.slug), categoryName(c));
  let best = null;
  for (const c of cats) {
    const path = categoryPath(c);
    if (!path.length) continue;
    const marketing = path.some((s) => MARKETING_SEGMENT.test(s));
    const brand = !marketing && path.some(isBrandSeg); // "Cressi Spearfishing", "Aqualung Parts"
    const leaf = path[path.length - 1];
    // depth wins; audience-qualified leaves rank below their parent; the main "dive-gear" tree
    // wins ties; brand-named categories are a fallback and marketing ones are never used.
    const score = path.length - (QUALIFIER_SEGMENT.test(leaf) ? 1.5 : 0) + (path[0] === ROOT_SEGMENT ? 0.25 : 0) - (brand ? 100 : 0) - (marketing ? 1000 : 0);
    if (!best || score > best.score) best = { score, path, marketing };
  }
  if (!best || best.marketing) return '';
  const segs = best.path[0] === ROOT_SEGMENT && best.path.length > 1 ? best.path.slice(1) : best.path;
  return segs.map((s) => nameBySlug.get(s) || humanize(s)).join(' - ');
}

/** "Colour: Orange/White/Clear, Size: Large" => "Orange/White/Clear / Large" */
export function variationTitle(label) {
  const s = clean(label);
  if (!s) return '';
  const parts = s.split(/,\s*(?=[^,:]+:\s)/).map((p) => p.replace(/^[^:]+:\s*/, '').trim()).filter(Boolean);
  return parts.length ? parts.join(' / ') : s;
}

/** Variant titles from the listing record's variations[] (attribute slugs mapped to term names). */
function listingVariants(raw, price, compareAtPrice) {
  const termName = new Map();
  for (const a of raw.attributes || []) {
    for (const t of a?.terms || []) if (t?.slug) termName.set(`${a.name}|${String(t.slug).toLowerCase()}`, clean(t.name));
  }
  const out = [];
  for (const v of raw.variations || []) {
    if (!v || !Array.isArray(v.attributes)) continue;
    const title = v.attributes
      .map((a) => termName.get(`${a.name}|${String(a.value || '').toLowerCase()}`) || clean(a.value) || '')
      .filter(Boolean)
      .join(' / ');
    out.push({ title: title || `#${v.id}`, price, compareAtPrice, available: Boolean(raw.is_in_stock), sku: '' });
  }
  return out;
}

/** Variants from a /products?type=variation&parent=<id> response (real per-variant prices). */
function variationVariants(list) {
  const out = [];
  for (const v of list || []) {
    if (!v || typeof v !== 'object') continue;
    const price = cents(v.prices?.price);
    const regular = cents(v.prices?.regular_price);
    out.push({
      title: variationTitle(v.variation) || (v.attributes || []).map((a) => clean(a.value)).filter(Boolean).join(' / ') || `#${v.id}`,
      price,
      compareAtPrice: regular !== null && price !== null && regular > price ? regular : null,
      available: Boolean(v.is_in_stock),
      sku: clean(v.sku),
    });
  }
  return out;
}

/** Why a raw record should not become a product, or '' to keep it. */
export function dropReason(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return 'malformed';
  if (raw.type === 'variation') return 'variation'; // never expected in an unfiltered listing (a few *simple* products do carry a parent id)
  if (DROP_TYPES.has(String(raw.type))) return `type:${raw.type}`;
  if (JUNK_TITLE.test(clean(raw.name))) return 'placeholder';
  return '';
}

/** Current / RRP price in dollars for a listing record (bundles carry theirs in extensions). */
export function rawPrices(raw) {
  if (raw.type === 'bundle') {
    const bp = raw.extensions?.bundles?.bundle_price;
    const price = cents(bp?.price?.min?.incl_tax ?? bp?.price?.min?.excl_tax) ?? cents(raw.prices?.price);
    const regular = cents(bp?.regular_price?.min?.incl_tax);
    return { price, compareAtPrice: regular !== null && price !== null && regular > price ? regular : null };
  }
  const price = cents(raw.prices?.price);
  const regular = cents(raw.prices?.regular_price);
  return { price, compareAtPrice: regular !== null && price !== null && regular > price ? regular : null };
}

/** True when the listing record's variants differ in price, i.e. per-variation prices are worth a request. */
export function needsVariationPrices(raw) {
  const r = raw?.prices?.price_range;
  return raw?.type === 'variable' && Boolean(r) && (raw.variations || []).length > 0 && cents(r.min_amount) !== cents(r.max_amount);
}

/**
 * Convert one Store API listing record to the canonical Product.
 * @param {object} raw          record from /wp-json/wc/store/v1/products
 * @param {object[]} [variations]  optional /products?type=variation&parent=<id> records
 */
export function toProduct(raw, variations = null) {
  const { price, compareAtPrice } = rawPrices(raw);
  let variants = variations && variations.length ? variationVariants(variations) : listingVariants(raw, price, compareAtPrice);
  if (variants.length && variants.every((v) => v.price === null)) variants = listingVariants(raw, price, compareAtPrice);
  // Real per-variation prices: let makeProduct derive price/RRP from the cheapest available
  // variant (the Product contract). Otherwise every variant shares the listing price.
  const derive = variants.length > 0 && variants.some((v) => v.price !== null);
  const categoryNames = (raw.categories || []).map(categoryName).filter(Boolean);
  const tagNames = (raw.tags || []).map((t) => clean(t?.name)).filter(Boolean);
  const image = String(raw.images?.[0]?.src || '').replace(/^http:/, 'https:');
  const description = stripTags(raw.short_description || '') || stripTags(raw.description || '');
  return makeProduct({
    retailer: KEY,
    sourceId: raw.id,
    title: clean(raw.name),
    brand: clean(raw.brands?.[0]?.name),
    category: pickCategory(raw),
    price: derive ? null : price,
    compareAtPrice: derive ? null : compareAtPrice,
    inStock: Boolean(raw.is_in_stock),
    url: String(raw.permalink || ''),
    image,
    sku: clean(raw.sku),
    variants,
    tags: [...new Set([...tagNames, ...categoryNames])].slice(0, 30),
    description: description.slice(0, 300),
  });
}

async function storeApi(query, opts = {}) {
  const url = `${API}?${query}`;
  let res;
  try {
    res = await fetchResponse(url, { ...HTTP_OPTS, ...opts });
  } catch (err) {
    if (err && err.status === 403) err.message += ' (Cloudflare challenge on the Store API? see module header)';
    throw err;
  }
  const text = res.bodyText; // fetchResponse() has already read (and size-capped) the body
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
  if (!Array.isArray(data)) throw new Error(`Unexpected Store API payload from ${url}`);
  return { data, total: Number(res.headers.get('x-wp-total')) || null, totalPages: Number(res.headers.get('x-wp-totalpages')) || null };
}

/** Every listing record, paged by id ascending; stops on an empty or short page. */
export async function fetchListing({ log = () => {} } = {}) {
  const seen = new Set();
  const out = [];
  let totalPages = null;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, total, totalPages: tp } = await storeApi(`per_page=${PER_PAGE}&page=${page}&orderby=id&order=asc`);
    if (page === 1) totalPages = tp;
    for (const raw of data) {
      if (!raw || seen.has(raw.id)) continue;
      seen.add(raw.id);
      out.push(raw);
    }
    log(`${KEY}: page ${page}${tp ? `/${tp}` : ''} -> ${data.length} records (total ${out.length}${total ? ` of ${total}` : ''})`);
    if (data.length < PER_PAGE) break;
    if (totalPages && page >= totalPages) break;
  }
  return out;
}

export default {
  key: KEY,
  name: 'Dive Gear Australia',
  homepage: HOMEPAGE,
  platform: 'woocommerce',
  async fetch({ log = () => {} } = {}) {
    const raws = await fetchListing({ log });

    // Per-variation prices, only where the listing says variants differ in price.
    const wantVariations = process.env.DGA_SKIP_VARIATIONS ? [] : raws.filter((r) => !dropReason(r) && needsVariationPrices(r)).slice(0, MAX_VARIATION_FETCHES);
    const variationsById = new Map();
    if (wantVariations.length) {
      log(`${KEY}: fetching per-variation prices for ${wantVariations.length} variable products`);
      // Optional data: one retry each, and give up after a few consecutive failures so a broken
      // variation endpoint costs seconds, not 4 retries with backoff for each of ~142 products.
      let failures = 0;
      await mapLimit(wantVariations, 1, async (raw) => {
        if (failures >= MAX_CONSECUTIVE_VARIATION_FAILURES) return;
        try {
          const { data } = await storeApi(`type=variation&parent=${raw.id}&per_page=100`, { retries: 1 });
          variationsById.set(raw.id, data);
          failures = 0;
        } catch (err) {
          failures += 1;
          log(`${KEY}: variations for ${raw.id} failed (${err.message}); using listing price`);
          if (failures >= MAX_CONSECUTIVE_VARIATION_FAILURES) log(`${KEY}: ${failures} consecutive failures; skipping the remaining per-variation requests`);
        }
      });
    }

    const out = [];
    const dropped = {};
    const drop = (why) => (dropped[why] = (dropped[why] || 0) + 1);
    for (const raw of raws) {
      const why = dropReason(raw);
      if (why) {
        drop(why);
        continue;
      }
      try {
        const product = toProduct(raw, variationsById.get(raw.id) || null);
        if (product.price === null) {
          drop('no-price');
          continue;
        }
        out.push(product);
      } catch (err) {
        drop('error');
        log(`${KEY}: skipped ${raw.id} (${clean(raw.name).slice(0, 60)}): ${err.message}`);
      }
    }
    const summary = Object.entries(dropped).map(([k, v]) => `${k} ${v}`).join(', ');
    log(`${KEY}: ${out.length} products from ${raws.length} records${summary ? ` (dropped: ${summary})` : ''}`);
    return out;
  },
};
