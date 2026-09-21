#!/usr/bin/env node
// Build step: merges data/retailers/*.json into the compact search index the web app loads.
//
//   data/products.json  { generatedAt, retailers:{key:{name,homepage,platform,live,u,i}}, brands, products:{key:[...]} }
//                       written by packIndex() in lib/pack.js (one product per line, sorted, with each
//                       retailer's URL/image prefix and every default value factored out) and expanded
//                       back into the records below by inflateIndex() in assets/search.js.
//                       (`live` = the front end may offer its Check-live button; true for Shopify stores only)
//   data/meta.json      per-retailer status/counts/errors for the UI footer
//
// A product record (enrich() output, and what search.js / app.js work with) uses short keys:
//   id  "retailer:sourceId"     r   retailer key          t  title
//   b   brand (display)         bn  brand (canonical)     c  category class (see normalize.js)
//   rc  raw retailer category   p   price (AUD) or null   cp compare-at / RRP or null
//   s   in stock (bool)         u   product url           i  image url
//   k   sku                     g   group id: the same product across retailers shares a g, which is
//                                   the smallest member id (a product on its own has g === id)
//   nv  number of variants      pr  [min,max] price across variants when they differ
//   dp  discount percent (int) when cp > p

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBrand, brandFromTitle, displayBrand, classifyCategory, modelTokens, tokenSimilarity, normalizeSku, genderOf } from './lib/normalize.js';
import { compactImage, packIndex, formatIndexJson, unpackRetailerFile } from './lib/pack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const RETAILER_DIR = path.join(DATA_DIR, 'retailers');

export const SIMILARITY_THRESHOLD = 0.55;
const SAME_RETAILER_THRESHOLD = 0.9;
export const PRICE_RATIO_MAX = 3; // the same item is never 3x dearer at another Australian shop; an accessory vs the product is

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i) {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/** Assign group ids to enriched products (mutates: sets p.g). Returns number of groups. */
export function groupProducts(items) {
  const uf = new UnionFind(items.length);
  const priceOk = (i, j) => { const a = items[i].p, c = items[j].p; return !(a > 0 && c > 0) || Math.max(a, c) / Math.min(a, c) <= PRICE_RATIO_MAX; };
  // 1. exact normalised SKU match across retailers (same brand or unknown brand). A shop now and
  //    then reuses one SKU for two sizes or a related part ("Steel 27" / "Steel 34", a torch and its
  //    spare body), so the union is refused when the titles disagree on a bare number or short code
  //    ("R195" / "R095") or the prices are PRICE_RATIO_MAX apart; unit sizes ("5mm", "80cf") don't count.
  const bySku = new Map();
  items.forEach((p, i) => {
    const sku = normalizeSku(p.k);
    if (!sku) return;
    const key = `${p.bn}|${sku}`;
    if (!bySku.has(key)) bySku.set(key, []);
    bySku.get(key).push(i);
  });
  const numbersOf = (i) => items[i]._tokens.filter((t) => /^[a-z]?\d+$/.test(t));
  const skuOk = (i, j) => {
    if (items[i].r === items[j].r || !priceOk(i, j)) return false;
    const na = numbersOf(i);
    const nb = numbersOf(j);
    return !na.length || !nb.length || na.some((t) => nb.includes(t));
  };
  for (const idxs of bySku.values()) {
    for (let a = 0; a < idxs.length; a += 1) {
      for (let b = a + 1; b < idxs.length; b += 1) if (skuOk(idxs[a], idxs[b])) uf.union(idxs[a], idxs[b]);
    }
  }
  // 2. title similarity within a brand bucket (or first-token bucket when brand unknown).
  //    Complete linkage: two clusters merge only if EVERY cross pair is similar enough, which
  //    stops "A~B, B~C, therefore A~C" chains from swallowing related-but-different products.
  //    The SKU-joined clusters take part as they are: a cross pair that fails on its own is
  //    tolerated when a SKU twin of either side (same SKU cluster, other shop) passes against the
  //    other, so a shop's terse title ("Alpha 8 Occy") rides on its SKU without letting title
  //    matches chain through the cluster to unrelated products.
  const buckets = new Map();
  items.forEach((p, i) => {
    const key = p.bn || `~${p._tokens[0] || ''}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  });
  const skuRoot = items.map((_, i) => uf.find(i));
  const skuMembers = new Map();
  skuRoot.forEach((r, i) => { if (!skuMembers.has(r)) skuMembers.set(r, []); skuMembers.get(r).push(i); });
  const twins = (i) => skuMembers.get(skuRoot[i]).filter((j) => j !== i);
  const jaccard = (a, b) => { const B = new Set(b); const shared = a.filter((t) => B.has(t)).length; return shared / (a.length + b.length - shared); };
  const simCache = new Map();
  const sim = (i, j) => {
    const key = i < j ? i * items.length + j : j * items.length + i;
    let v = simCache.get(key);
    if (v === undefined) {
      const pa = items[i];
      const pb = items[j];
      v = 0;
      if (!(pa.c !== pb.c && pa.c !== 'other' && pb.c !== 'other') && !(pa._gender && pb._gender && pa._gender !== pb._gender) && priceOk(i, j)) {
        v = tokenSimilarity(pa._tokens, pb._tokens);
        // "Muzzle Bungee w/Snap Clip" and "w/Pigtail Clip" share every model token: when both titles
        // list what they include, and those lists mostly differ, that is what tells them apart.
        const ta = pa._tokens.tail || [];
        const tb = pb._tokens.tail || [];
        if (v > 0 && ta.length && tb.length && jaccard(ta, tb) < 0.5) v = 0;
      }
      simCache.set(key, v);
    }
    return v;
  };
  const threshold = (i, j) => (items[i].r === items[j].r ? SAME_RETAILER_THRESHOLD : SIMILARITY_THRESHOLD);
  for (const idxs of buckets.values()) {
    if (idxs.length < 2 || idxs.length > 4000) continue;
    const pairs = [];
    for (let a = 0; a < idxs.length; a += 1) {
      if (items[idxs[a]]._tokens.length === 0) continue;
      for (let b = a + 1; b < idxs.length; b += 1) {
        if (items[idxs[b]]._tokens.length === 0) continue;
        const v = sim(idxs[a], idxs[b]);
        if (v >= threshold(idxs[a], idxs[b])) pairs.push([v, idxs[a], idxs[b]]);
      }
    }
    pairs.sort((x, y) => y[0] - x[0]);
    const members = new Map(); // root -> member indexes (only for this bucket), seeded with the SKU-joined clusters
    for (const i of idxs) { const r = uf.find(i); if (!members.has(r)) members.set(r, []); members.get(r).push(i); }
    const membersOf = (i) => {
      const r = uf.find(i);
      if (!members.has(r)) members.set(r, [i]);
      return members.get(r);
    };
    for (const [, i, j] of pairs) {
      const ri = uf.find(i);
      const rj = uf.find(j);
      if (ri === rj) continue;
      const mi = membersOf(i);
      const mj = membersOf(j);
      let ok = true;
      for (const x of mi) {
        for (const y of mj) {
          if (!priceOk(x, y) || sim(x, y) < threshold(x, y) && !twins(x).some((t) => sim(t, y) >= threshold(t, y)) && !twins(y).some((t) => sim(x, t) >= threshold(x, t))) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (!ok) continue;
      uf.union(i, j);
      const root = uf.find(i);
      members.set(root, mi.concat(mj));
      if (root !== ri) members.delete(ri);
      if (root !== rj) members.delete(rj);
    }
  }
  // 3. a group is named after its smallest member id. That only changes when that member goes,
  //    so a product added or removed elsewhere in the catalogue leaves every other group's g
  //    alone (products.json is committed after each run; a dense numbering would move thousands
  //    of lines every week). A product on its own keeps its own id as g.
  const members = new Map();
  items.forEach((_, i) => {
    const root = uf.find(i);
    if (!members.has(root)) members.set(root, []);
    members.get(root).push(i);
  });
  for (const idxs of members.values()) {
    const gid = idxs.map((i) => items[i].id).sort()[0];
    for (const i of idxs) items[i].g = gid;
  }
  return members.size;
}

export function enrich(product) {
  const bn = normalizeBrand(product.brand) || brandFromTitle(product.title);
  const c = classifyCategory(product.category, product.title, product.tags);
  const prices = (product.variants || []).map((v) => v.price).filter((x) => x !== null && x !== undefined);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const out = {
    id: product.id,
    r: product.retailer,
    t: product.title,
    b: displayBrand(bn, product.brand) || product.brand || '',
    bn,
    c,
    rc: product.category || '',
    p: product.price,
    cp: product.compareAtPrice,
    s: Boolean(product.inStock),
    u: product.url,
    i: compactImage(product.image),
    k: product.sku || '',
    g: product.id,
    nv: (product.variants || []).length,
  };
  if (min !== null && max !== null && max > min) out.pr = [min, max];
  if (out.cp && out.p && out.cp > out.p) out.dp = Math.round((1 - out.p / out.cp) * 100);
  Object.defineProperty(out, '_tokens', { value: modelTokens(product.title, bn), enumerable: false, writable: true });
  Object.defineProperty(out, '_gender', { value: genderOf(product.title), enumerable: false, writable: true });
  return out;
}

export async function build({ log = () => {} } = {}) {
  const files = (await readdir(RETAILER_DIR).catch(() => [])).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) throw new Error(`no retailer data in ${RETAILER_DIR}; run the scraper first`);
  const retailers = {};
  const metaRetailers = [];
  const items = [];
  let excluded = 0;
  for (const f of files) {
    const data = unpackRetailerFile(JSON.parse(await readFile(path.join(RETAILER_DIR, f), 'utf8')));
    const key = data.retailer.key;
    retailers[key] = { name: data.retailer.name, homepage: data.retailer.homepage, platform: data.retailer.platform || 'custom', live: data.retailer.platform === 'shopify' };
    let kept = 0;
    for (const p of data.products || []) {
      const e = enrich(p);
      if (e.c === 'exclude' || e.p === null) {
        excluded += 1; // not gear, or has no usable price (enquiry-only / placeholder)
        continue;
      }
      items.push(e);
      kept += 1;
    }
    metaRetailers.push({
      key,
      name: data.retailer.name,
      homepage: data.retailer.homepage,
      platform: data.retailer.platform || 'custom',
      status: data.status,
      fetchedAt: data.fetchedAt,
      staleSince: data.staleSince || null,
      durationMs: data.durationMs || null,
      count: kept,
      excluded: (data.products || []).length - kept,
      error: data.error || null,
    });
    log(`build: ${key}: ${kept} products (${(data.products || []).length - kept} excluded) [${data.status}]`);
  }
  // Fixed order (by id) so the same catalogue always builds byte-identical files.
  items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const groups = groupProducts(items);
  const retailersOf = new Map();
  for (const p of items) {
    if (!retailersOf.has(p.g)) retailersOf.set(p.g, new Set());
    retailersOf.get(p.g).add(p.r);
  }
  const multi = [...retailersOf.values()].filter((s) => s.size > 1).length;
  const generatedAt = new Date().toISOString();
  const categories = {};
  for (const p of items) categories[p.c] = (categories[p.c] || 0) + 1;
  const meta = {
    generatedAt,
    retailers: metaRetailers,
    totals: { products: items.length, excluded, groups, multiRetailerGroups: multi, categories },
  };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, 'products.json'), formatIndexJson(packIndex({ generatedAt, retailers, items })));
  await writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
  log(`build: ${items.length} products, ${groups} groups (${multi} span multiple retailers)`);
  return meta;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build({ log: console.log }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
