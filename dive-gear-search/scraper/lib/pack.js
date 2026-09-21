// On-disk form of the two JSON files the scraper writes, and the readers that undo it.
//
// data/ is committed after every weekly run, so both files are written one record per line in a
// fixed order (a diff then lists exactly the products that changed) and with everything that can
// be derived left out:
//   - each retailer's common URL and image prefix is stored once (`base` in a retailer file,
//     retailers[key].u / .i in the index) and every record keeps only what follows it;
//   - fields at their default value are omitted (in stock, no compare-at price, empty sku, ...);
//   - the retailer key is implied by the file (or by the products map key), so a record carries
//     the source id only;
//   - Shopify image URLs lose their ?v= cache-buster.
// The readers restore complete records, so nothing else in the code base sees this form.
//
//   data/retailers/<key>.json   packRetailerFile() + formatRetailerJson()  <->  unpackRetailerFile()
//   data/products.json          packIndex() + formatIndexJson()           <->  inflateIndex() in assets/search.js

export const RETAILER_FORMAT = 2;

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Shopify CDN image URLs carry a cache-busting ?v= that adds ~15% to the index for no benefit. */
export function compactImage(url) {
  const s = String(url || '');
  return /cdn\.shopify\.com\//.test(s) ? s.replace(/\?v=\d+$/, '') : s;
}

/**
 * Longest common prefix of the non-empty strings, cut back to the last `/`, `?`, `&` or `=` so it
 * ends at a path or query boundary: a new product whose slug happens to share a few more characters
 * with its neighbours must not move the boundary, or every record's suffix in the file would change.
 */
export function commonBase(strings) {
  let prefix = null;
  for (const s of strings) {
    if (typeof s !== 'string' || !s) continue;
    if (prefix === null) {
      prefix = s;
      continue;
    }
    let i = 0;
    const n = Math.min(prefix.length, s.length);
    while (i < n && prefix.charCodeAt(i) === s.charCodeAt(i)) i += 1;
    prefix = prefix.slice(0, i);
    if (!prefix) return '';
  }
  if (!prefix) return '';
  for (let i = prefix.length - 1; i >= 0; i -= 1) if ('/?&='.includes(prefix[i])) return prefix.slice(0, i + 1);
  return '';
}

const strip = (s, base) => (base && String(s).startsWith(base) ? String(s).slice(base.length) : String(s));
const sourceId = (id, key) => (String(id).startsWith(`${key}:`) ? String(id).slice(key.length + 1) : String(id));

// ---- data/retailers/<key>.json ------------------------------------------------------------------

function packVariant(v) {
  const out = {};
  if (v.title && v.title !== 'Default') out.title = v.title;
  if (v.price !== null && v.price !== undefined) out.price = v.price;
  if (v.compareAtPrice !== null && v.compareAtPrice !== undefined) out.compareAtPrice = v.compareAtPrice;
  if (!v.available) out.available = false;
  if (v.sku) out.sku = v.sku;
  return out;
}

function unpackVariant(v) {
  return {
    title: v.title || 'Default',
    price: v.price === undefined ? null : v.price,
    compareAtPrice: v.compareAtPrice === undefined ? null : v.compareAtPrice,
    available: v.available !== false,
    sku: v.sku || '',
  };
}

/** A Product (lib/product.js) -> its stored row. `description` is dropped: nothing reads it. */
function packRecord(p, key, base) {
  const out = { id: sourceId(p.id, key), title: p.title };
  if (p.brand) out.brand = p.brand;
  if (p.category) out.category = p.category;
  if (p.price !== null && p.price !== undefined) out.price = p.price;
  if (p.compareAtPrice !== null && p.compareAtPrice !== undefined) out.compareAtPrice = p.compareAtPrice;
  if (!p.inStock) out.inStock = false;
  if (p.url) out.url = strip(p.url, base.url);
  const image = compactImage(p.image);
  if (image) out.image = strip(image, base.image);
  if (p.sku) out.sku = p.sku;
  if (p.variants && p.variants.length) out.variants = p.variants.map(packVariant);
  if (p.tags && p.tags.length) out.tags = p.tags;
  return out;
}

function unpackRecord(row, key, base) {
  return {
    id: `${key}:${row.id}`,
    retailer: key,
    title: row.title || '',
    brand: row.brand || '',
    category: row.category || '',
    price: row.price === undefined ? null : row.price,
    compareAtPrice: row.compareAtPrice === undefined ? null : row.compareAtPrice,
    inStock: row.inStock !== false,
    url: row.url === undefined ? '' : (base.url || '') + row.url,
    image: row.image === undefined ? '' : (base.image || '') + row.image,
    sku: row.sku || '',
    variants: (row.variants || []).map(unpackVariant),
    tags: row.tags || [],
  };
}

/** The record scrapeRetailer() builds ({retailer, status, fetchedAt, ..., products}) -> what is written. */
export function packRetailerFile(record) {
  const key = record.retailer.key;
  const products = (record.products || []).slice().sort(byId);
  const base = { url: commonBase(products.map((p) => p.url)), image: commonBase(products.map((p) => compactImage(p.image))) };
  const { products: _products, ...head } = record;
  return { format: RETAILER_FORMAT, ...head, base, products: products.map((p) => packRecord(p, key, base)) };
}

/** Inverse of packRetailerFile(). A file from before this format (no `format` field) is returned as it is. */
export function unpackRetailerFile(json) {
  if (!json || json.format !== RETAILER_FORMAT) return json;
  const { format: _format, base, products, ...head } = json;
  const key = head.retailer && head.retailer.key ? head.retailer.key : '';
  return { ...head, products: (products || []).map((row) => unpackRecord(row, key, base || {})) };
}

/** One product per line; everything else on the lines above it. */
export function formatRetailerJson(file) {
  const { products, ...head } = file;
  const lines = ['{'];
  for (const [k, v] of Object.entries(head)) if (v !== undefined) lines.push(`${JSON.stringify(k)}:${JSON.stringify(v)},`);
  lines.push('"products":[', products.map((r) => JSON.stringify(r)).join(',\n'), ']', '}', '');
  return lines.join('\n');
}

// ---- data/products.json --------------------------------------------------------------------------

/** Canonical brand -> the display spelling most of its products use. */
function brandTable(items) {
  const counts = new Map();
  for (const p of items) {
    if (!p.bn || !p.b) continue;
    if (!counts.has(p.bn)) counts.set(p.bn, new Map());
    const m = counts.get(p.bn);
    m.set(p.b, (m.get(p.b) || 0) + 1);
  }
  const brands = {};
  for (const bn of [...counts.keys()].sort()) {
    brands[bn] = [...counts.get(bn).entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0][0];
  }
  return brands;
}

/** An enrich()ed product -> its row. Not stored: r and the id prefix (the map key), nv (unused by
 *  the app), dp (recomputed from p and cp), and every field at its default value. */
function packRow(p, key, base, brands) {
  const row = { id: sourceId(p.id, key), t: p.t };
  if (p.b !== (brands[p.bn] || '')) row.b = p.b;
  if (p.bn) row.bn = p.bn;
  if (p.c) row.c = p.c;
  if (p.rc) row.rc = p.rc;
  row.p = p.p;
  if (p.cp !== null && p.cp !== undefined) row.cp = p.cp;
  if (p.pr) row.pr = p.pr;
  if (!p.s) row.s = false;
  row.u = strip(p.u, base.u);
  if (p.i) row.i = strip(p.i, base.i);
  if (p.k) row.k = p.k;
  if (p.g !== p.id) row.g = p.g;
  return row;
}

/**
 * { generatedAt, retailers: {key: {name, homepage, platform, live}}, items: enrich()ed products }
 * -> the products.json document: each retailer gains its URL and image prefix (u, i), `brands`
 * maps canonical brand -> display name, `products` holds the rows per retailer key, sorted by id.
 * inflateIndex() in assets/search.js is the inverse.
 */
export function packIndex({ generatedAt, retailers, items }) {
  const byRetailer = new Map();
  for (const p of items) {
    if (!byRetailer.has(p.r)) byRetailer.set(p.r, []);
    byRetailer.get(p.r).push(p);
  }
  const brands = brandTable(items);
  const outRetailers = {};
  const products = {};
  for (const key of [...new Set([...Object.keys(retailers), ...byRetailer.keys()])].sort()) {
    const list = (byRetailer.get(key) || []).slice().sort(byId);
    const base = { u: commonBase(list.map((p) => p.u)), i: commonBase(list.map((p) => p.i)) };
    outRetailers[key] = { ...(retailers[key] || {}), u: base.u, i: base.i };
    products[key] = list.map((p) => packRow(p, key, base, brands));
  }
  return { generatedAt, retailers: outRetailers, brands, products };
}

/** One retailer, one brand and one product per line. */
export function formatIndexJson(doc) {
  const entries = (o, fn) => Object.keys(o).map((k) => `${JSON.stringify(k)}:${fn(o[k])}`).join(',\n');
  return [
    '{',
    `"generatedAt":${JSON.stringify(doc.generatedAt)},`,
    '"retailers":{',
    entries(doc.retailers, (v) => JSON.stringify(v)),
    '},',
    '"brands":{',
    entries(doc.brands, (v) => JSON.stringify(v)),
    '},',
    '"products":{',
    entries(doc.products, (rows) => `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]`),
    '}',
    '}',
    '',
  ].join('\n');
}
