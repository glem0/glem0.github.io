// Canonical product record produced by every retailer module.
//
// A retailer module exports:
//   export default {
//     key: 'adreno',                 // short id, matches file name
//     name: 'Adreno',                // display name
//     homepage: 'https://adreno.com.au/',
//     async fetch(ctx) { ... return Product[] }   // ctx = { log }
//   }
//
// Use makeProduct() for every record so field types are consistent.

/**
 * @typedef {Object} Variant
 * @property {string} title       e.g. "Medium / Black"
 * @property {number|null} price  AUD dollars
 * @property {number|null} compareAtPrice
 * @property {boolean} available
 * @property {string} sku
 */

/**
 * @typedef {Object} Product
 * @property {string} id             `${retailer}:${sourceId}`
 * @property {string} retailer       retailer key
 * @property {string} title
 * @property {string} brand          raw brand/vendor as the retailer states it ('' if unknown)
 * @property {string} category       raw retailer category / product type ('' if unknown)
 * @property {number|null} price     AUD; lowest available variant price, else lowest variant price
 * @property {number|null} compareAtPrice  RRP / was-price if higher than price, else null
 * @property {boolean} inStock
 * @property {string} url            canonical product page
 * @property {string} image          primary image URL ('' if none)
 * @property {string} sku
 * @property {Variant[]} variants
 * @property {string[]} tags
 * @property {string} description    short plain-text description (<= 300 chars); nothing downstream
 *                                    reads it, so lib/pack.js leaves it out of data/retailers/<key>.json
 */

/** Parse "59.00", "$1,299.95", 5900 (cents when opts.cents) → number|null */
export function parsePrice(value, { cents = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  let n;
  if (typeof value === 'number') n = value;
  else {
    const cleaned = String(value).replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
    n = parseFloat(cleaned);
  }
  if (!Number.isFinite(n)) return null;
  if (cents) n /= 100;
  n = Math.round(n * 100) / 100;
  return n >= 0 ? n : null;
}

function str(x) {
  return x === null || x === undefined ? '' : String(x).replace(/\s+/g, ' ').trim();
}

/**
 * Build a validated Product. Derives price / compareAtPrice / inStock from variants
 * when not supplied explicitly.
 */
export function makeProduct(p) {
  const retailer = str(p.retailer);
  const sourceId = str(p.sourceId ?? p.id);
  if (!retailer || !sourceId) throw new Error('makeProduct: retailer and sourceId are required');
  const title = str(p.title);
  if (!title) throw new Error(`makeProduct: title required (${retailer}:${sourceId})`);
  const url = str(p.url);
  if (!/^https?:\/\//.test(url)) throw new Error(`makeProduct: absolute url required (${retailer}:${sourceId})`);

  const variants = (p.variants || []).map((v) => ({
    title: str(v.title) || 'Default',
    price: parsePrice(v.price),
    compareAtPrice: parsePrice(v.compareAtPrice),
    available: Boolean(v.available),
    sku: str(v.sku),
  }));

  let price = parsePrice(p.price);
  let compareAtPrice = parsePrice(p.compareAtPrice);
  let inStock = p.inStock;

  if (variants.length) {
    const priced = variants.filter((v) => v.price !== null);
    const avail = priced.filter((v) => v.available);
    const pool = avail.length ? avail : priced;
    if (price === null && pool.length) {
      const cheapest = pool.reduce((a, b) => (b.price < a.price ? b : a));
      price = cheapest.price;
      if (compareAtPrice === null) compareAtPrice = cheapest.compareAtPrice;
    }
    if (inStock === undefined || inStock === null) inStock = variants.some((v) => v.available);
  }
  if (inStock === undefined || inStock === null) inStock = price !== null;
  if (compareAtPrice !== null && (price === null || compareAtPrice <= price)) compareAtPrice = null;

  return {
    id: `${retailer}:${sourceId}`,
    retailer,
    title,
    brand: str(p.brand),
    category: str(p.category),
    price,
    compareAtPrice,
    inStock: Boolean(inStock),
    url,
    image: str(p.image),
    sku: str(p.sku) || (variants.length === 1 ? variants[0].sku : ''),
    variants,
    tags: (p.tags || []).map(str).filter(Boolean),
    description: str(p.description).slice(0, 300),
  };
}
