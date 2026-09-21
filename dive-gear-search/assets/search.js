// Pure search logic for the dive gear price comparison. No DOM access so it can be
// unit-tested under Node (scraper/test/search.test.js) and imported by assets/app.js.
//
// Product records use the compact keys documented in scraper/build.js:
//   r retailer key, t title, b brand (display), bn brand (canonical), c category, rc raw
//   category, p price, cp compare-at price, s in stock, u url, i image, k sku, g group id,
//   pr [min,max] variant price range, dp discount percent. data/products.json stores them in a
//   smaller form that inflateIndex() below expands once after loading.

const DIACRITICS = /[̀-ͯ]/g;

/** Lowercase, ASCII-fold and collapse punctuation the same way for queries and haystacks. */
export function normalizeText(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/([a-z0-9])-(?=[a-z0-9])/g, '$1') // x-vision -> xvision, mk25-evo -> mk25evo
    .replace(/[^a-z0-9.]+/g, ' ')
    // keep dots only between digits (2.5mm) — written without lookbehind, which Safari < 16.4 can't parse
    .replace(/\.(?![0-9])/g, ' ')
    .replace(/(^|[^0-9])\./g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a query into unique lowercase tokens (max 12). */
export function tokenizeQuery(q) {
  const out = [];
  for (const t of normalizeText(q).split(' ')) {
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Expand data/products.json (written by packIndex() in scraper/lib/pack.js) into product records.
 * The file keeps products under their retailer key, stores each retailer's common URL and image
 * prefix once (retailers[key].u / .i), maps canonical brands to display names once (brands), and
 * leaves out fields at their default: b when it is the brand table's spelling, cp when there is
 * none, s when in stock, i when there is no image, k / rc / bn when empty, and g when the product
 * is in no group (g is then its own id). dp is recomputed from p and cp.
 */
export function inflateIndex(doc) {
  const out = [];
  const brands = (doc && doc.brands) || {};
  const retailers = (doc && doc.retailers) || {};
  const byRetailer = (doc && doc.products) || {};
  for (const r of Object.keys(byRetailer)) {
    const base = retailers[r] || {};
    const baseU = base.u || '';
    const baseI = base.i || '';
    for (const row of byRetailer[r] || []) {
      const id = `${r}:${row.id}`;
      const bn = row.bn || '';
      const p = {
        id,
        r,
        t: row.t || '',
        b: row.b !== undefined ? row.b : brands[bn] || '',
        bn,
        c: row.c || '',
        rc: row.rc || '',
        p: row.p === undefined ? null : row.p,
        cp: row.cp === undefined ? null : row.cp,
        s: row.s !== false,
        u: row.u === undefined ? '' : baseU + row.u,
        i: row.i === undefined ? '' : baseI + row.i,
        k: row.k || '',
        g: row.g === undefined ? id : row.g,
      };
      if (row.pr) p.pr = row.pr;
      if (p.cp && p.p && p.cp > p.p) p.dp = Math.round((1 - p.p / p.cp) * 100);
      out.push(p);
    }
  }
  return out;
}

/** Categories whose products are parts/add-ons: they rank below the gear they fit at equal relevance. */
const SPARE_CATEGORIES = new Set(['spare part', 'accessories']);
/** Title words that mark a part or add-on rather than the gear itself ("S600 Colour Kit", "Mask Strap"),
 *  since retailers file many of those under the gear's own category. */
const ACCESSORY_WORDS = new Set([
  'kit', 'protector', 'strap', 'cable', 'mouthpiece', 'cap', 'caps', 'plug', 'hanger', 'wash', 'shampoo', 'cleaner',
  'spare', 'replacement', 'adapter', 'adaptor', 'clip', 'holder', 'battery', 'charger', 'bungee', 'lanyard', 'buckle',
  'hose', 'valve', 'service', 'parts', 'retainer', 'interface', 'necklace', 'oring', 'transmitter',
]);
/** After these words a title lists what is included, not what the product is ("Regulator Set with Bag"). */
const INCLUDES_WORDS = new Set(['with', 'w', 'inc', 'incl', 'includes', 'including']);

/** True when a title reads as a part/add-on, or as a different kind of gear than it is filed under
 *  ("Ocean Pro BCD Knife" filed under bcd). `catWords` is every category word, `cw` the product's own. */
function looksLikeSpare(titleWords, catWords, cw) {
  const cut = titleWords.findIndex((w) => INCLUDES_WORDS.has(w));
  const head = cut > 0 ? titleWords.slice(0, cut) : titleWords;
  let ownAt = -1;
  for (let i = 0; i < head.length; i += 1) {
    if (ACCESSORY_WORDS.has(head[i])) return true;
    if (cw.includes(head[i])) ownAt = i;
  }
  // another category's noun after the product's own one: "BCD Knife" is a knife, "Mask Bag" a bag
  for (let i = ownAt + 1; i < head.length; i += 1) if (catWords.has(head[i]) && !cw.includes(head[i])) return true;
  return false;
}

/**
 * Precompute lowercase haystacks once. Returns
 *   { products, entries, brandNames: { bn: displayName }, groupSizes: Map<g, {listings, retailers}>,
 *     catWords: Set of every word used in a category name }
 * entries[i] = { p, t (title), ts (title squashed), o (brand+category+sku), os (squashed),
 *                cw (category words), spare, spec (title words that are not category words),
 *                retailers, gs (group score) }
 */
export function buildIndex(products) {
  const groupSizes = new Map();
  const catWords = new Set();
  const catWordsOf = new Map();
  for (const p of products) {
    if (p.c && !catWordsOf.has(p.c)) {
      const cw = normalizeText(p.c).split(' ').filter(Boolean);
      catWordsOf.set(p.c, cw);
      for (const w of cw) catWords.add(w);
    }
    let g = groupSizes.get(p.g);
    if (!g) {
      g = { listings: 0, retailers: new Set() };
      groupSizes.set(p.g, g);
    }
    g.listings += 1;
    g.retailers.add(p.r);
  }
  const brandNames = {};
  const entries = new Array(products.length);
  for (let i = 0; i < products.length; i += 1) {
    const p = products[i];
    const t = normalizeText(p.t);
    const brand = p.b || p.bn || '';
    if (p.bn && !brandNames[p.bn]) brandNames[p.bn] = p.b || p.bn;
    const other = normalizeText([brand, p.bn !== brand ? p.bn : '', p.c, p.rc, p.k].filter(Boolean).join(' '));
    const g = groupSizes.get(p.g);
    const titleWords = t ? t.split(' ') : [];
    const cw = catWordsOf.get(p.c) || [];
    entries[i] = {
      p,
      t,
      ts: t.replace(/ /g, ''),
      o: other,
      os: other.replace(/ /g, ''),
      cw,
      spare: SPARE_CATEGORIES.has(p.c) || looksLikeSpare(titleWords, catWords, cw),
      spec: Math.max(1, titleWords.filter((w) => !catWords.has(w)).length),
      retailers: g.retailers.size,
      gs: g.retailers.size * 1000 + g.listings,
    };
  }
  return { products, entries, brandNames, groupSizes, catWords };
}

export const SORTS = ['relevance', 'price_asc', 'price_desc', 'discount', 'name'];

/** null/undefined/empty = no restriction. Accepts a Set, an array or a comma-separated string. */
function toSet(v) {
  if (!v) return null;
  let s;
  if (v instanceof Set) s = v;
  else if (Array.isArray(v)) s = new Set(v);
  else s = new Set(String(v).split(',').filter(Boolean));
  return s.size ? s : null;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Whole-percent discount vs compare-at price (0 when there is none, or it rounds to 0). */
export function discountPct(p) {
  if ((p.dp || 0) > 0) return p.dp;
  if (p.cp === null || p.cp === undefined || p.p === null || p.p === undefined || !(p.cp > p.p)) return 0;
  return Math.round((1 - p.p / p.cp) * 100);
}

export function isOnSale(p) {
  return discountPct(p) >= 1;
}

/**
 * Compile a filters object into a predicate.
 * filters = { retailers: Set|Array|csv (null/undefined = all), categories, brand (canonical bn),
 *             inStock: bool, onSale: bool, min: number|null, max: number|null }
 */
export function compileFilters(filters = {}) {
  const rs = toSet(filters.retailers);
  const cs = toSet(filters.categories);
  const brand = filters.brand ? String(filters.brand) : '';
  const inStock = Boolean(filters.inStock);
  const onSale = Boolean(filters.onSale);
  const min = num(filters.min);
  const max = num(filters.max);
  const none = !rs && !cs && !brand && !inStock && !onSale && min === null && max === null;
  if (none) return null;
  return (p) =>
    (!rs || rs.has(p.r)) &&
    (!cs || cs.has(p.c)) &&
    (!brand || p.bn === brand) &&
    (!inStock || p.s) &&
    (!onSale || isOnSale(p)) &&
    (min === null || (p.p !== null && p.p >= min)) &&
    (max === null || (p.p !== null && p.p <= max));
}

/** The category word a query token names ("fin" -> "fins", "wetsuits" -> "wetsuit"), or null. */
function categoryWord(catWords, tok) {
  if (catWords.has(tok)) return tok;
  if (catWords.has(`${tok}s`)) return `${tok}s`;
  if (tok.length > 3 && tok.endsWith('es') && catWords.has(tok.slice(0, -2))) return tok.slice(0, -2);
  if (tok.length > 2 && tok.endsWith('s') && catWords.has(tok.slice(0, -1))) return tok.slice(0, -1);
  return null;
}

/**
 * Score one entry against the query context { tokens, tokCat, phrase, leadSpecific, requireAll }.
 * Returns 0 when it does not qualify. Ranking factors, highest weight first:
 *  - number of matched tokens;
 *  - every token in the title, or naming the product's own category ("scubapro regulator" fits
 *    a Scubapro MK25 whose category is regulator);
 *  - the product IS the category asked for ("wetsuit" -> wetsuits, not "Wetsuit Wash");
 *  - the whole phrase in the title, and at its start (unless it is all category words);
 *  - title starting with the first token when it is specific ("mk25 ..."), not a category word
 *    ("Mask Strap" vs real masks) or a size ("5mm Glove");
 *  - specific tokens at word starts / in the title rather than brand, category or sku;
 *  - not a spare part/accessory (by category, or by an accessory word / other category's noun in the title);
 *  - share of the title's specific (non-category) words the query covers: "suunto d5" is most
 *    of "Suunto D5 Wrist Dive Computer" but little of "Suunto D5 / Eon Core Magnetic USB Cable";
 *  - sold by several retailers (worth comparing); in stock.
 */
function scoreEntry(e, ctx) {
  const { tokens, tokCat, phrase, leadSpecific, requireAll } = ctx;
  let matched = 0;
  let core = 0; // tokens in the title, or category words matching the product's category
  let titleHits = 0;
  let startHits = 0;
  let catHits = 0;
  let specific = 0; // non-category tokens found in the title
  for (let k = 0; k < tokens.length; k += 1) {
    const tok = tokens[k];
    const cat = tokCat[k];
    const inCat = cat !== null && e.cw.includes(cat);
    if (inCat) catHits += 1;
    const i = e.t.indexOf(tok);
    if (i >= 0) {
      matched += 1;
      core += 1;
      if (!inCat) {
        titleHits += 2;
        if (i === 0 || e.t.charCodeAt(i - 1) === 32) startHits += 1;
        if (cat === null) specific += 1;
      }
    } else if (e.ts.indexOf(tok) >= 0) {
      matched += 1;
      core += 1;
      if (!inCat) {
        titleHits += 1;
        if (cat === null) specific += 1;
      }
    } else if (inCat || e.o.indexOf(tok) >= 0 || e.os.indexOf(tok) >= 0) {
      matched += 1;
      if (inCat) core += 1;
    } else if (requireAll) {
      return 0;
    }
  }
  if (!matched) return 0;
  let score = matched * 10000;
  if (core === tokens.length) score += 3000;
  score += catHits * 1000;
  if (phrase) {
    const pi = e.t.indexOf(phrase);
    if (pi >= 0) score += 600;
    if (pi === 0 && tokCat[0] === null) score += 400;
  }
  if (leadSpecific && e.t.startsWith(tokens[0])) score += 300;
  score += startHits * 100 + titleHits * 30;
  if (!e.spare) score += 500;
  score += Math.round(Math.min(specific / e.spec, 1) * 400);
  score += Math.min(e.retailers - 1, 4) * 60;
  if (e.p.s) score += 20;
  return score;
}

function cmpPriceAsc(a, b) {
  const pa = a.p === null ? Infinity : a.p;
  const pb = b.p === null ? Infinity : b.p;
  return pa - pb;
}

function comparator(sort) {
  switch (sort) {
    case 'price_asc':
      return (x, y) => cmpPriceAsc(x.e.p, y.e.p) || y.score - x.score || (x.e.t < y.e.t ? -1 : x.e.t > y.e.t ? 1 : 0);
    case 'price_desc':
      return (x, y) => cmpPriceAsc(y.e.p, x.e.p) || y.score - x.score || (x.e.t < y.e.t ? -1 : x.e.t > y.e.t ? 1 : 0);
    case 'discount':
      return (x, y) => (y.e.p.dp || 0) - (x.e.p.dp || 0) || y.score - x.score || cmpPriceAsc(x.e.p, y.e.p);
    case 'name':
      return (x, y) => (x.e.t < y.e.t ? -1 : x.e.t > y.e.t ? 1 : 0) || y.score - x.score || cmpPriceAsc(x.e.p, y.e.p);
    default:
      return (x, y) => y.score - x.score || cmpPriceAsc(x.e.p, y.e.p) || (x.e.t < y.e.t ? -1 : x.e.t > y.e.t ? 1 : 0);
  }
}

/**
 * Search the index. Returns an array of products (ranked) with two extra, non-enumerable
 * properties: `fallback` (true when no product matched ALL tokens and the results are
 * ANY-token matches instead) and `tokens` (the parsed query tokens).
 *
 * Empty query = browse everything: sorted by group size (retailers, then listings) desc,
 * then price, unless another sort is chosen.
 */
export function searchProducts(index, query, filters = {}, sort = 'relevance') {
  const tokens = tokenizeQuery(query);
  const pred = compileFilters(filters);
  const entries = index.entries;
  const hits = [];
  let fallback = false;
  const catWords = index.catWords || new Set();
  const tokCat = tokens.map((t) => categoryWord(catWords, t));
  const ctx = {
    tokens,
    tokCat,
    phrase: tokens.length > 1 ? tokens.join(' ') : '',
    leadSpecific: tokens.length > 0 && tokCat[0] === null && !/^[0-9]/.test(tokens[0]),
    requireAll: true,
  };

  const collect = (requireAll) => {
    ctx.requireAll = requireAll;
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i];
      if (pred && !pred(e.p)) continue;
      if (tokens.length === 0) {
        hits.push({ e, score: e.gs });
        continue;
      }
      const score = scoreEntry(e, ctx);
      if (score > 0) hits.push({ e, score });
    }
  };

  collect(true);
  if (tokens.length > 0 && hits.length === 0) {
    collect(false);
    fallback = hits.length > 0;
  }
  hits.sort(comparator(SORTS.includes(sort) ? sort : 'relevance'));

  const out = new Array(hits.length);
  for (let i = 0; i < hits.length; i += 1) out[i] = hits[i].e.p;
  Object.defineProperty(out, 'fallback', { value: fallback, enumerable: false });
  Object.defineProperty(out, 'tokens', { value: tokens, enumerable: false });
  return out;
}

function cmpOffer(a, b) {
  return cmpPriceAsc(a, b) || Number(b.s) - Number(a.s) || (a.r < b.r ? -1 : a.r > b.r ? 1 : 0);
}

/**
 * Collapse ranked products into one group per product family (shared `g`), in ranking
 * order. Offers for each group are taken from `allProducts` (defaults to `products`) so
 * that listings from other retailers appear even when their title did not match the query.
 *
 * Group: { g, rep, title, brand, brandKey, category, image, offers (price asc), cheapest (lowest
 *          price, in or out of stock — the top of the ladder), cheapestInStock (lowest in-stock
 *          price, or null), dearest, retailers (distinct count), listings, spread ($ between
 *          cheapest and dearest), spreadPct }
 */
export function groupResults(products, allProducts = products) {
  const byG = new Map();
  for (const p of allProducts) {
    const arr = byG.get(p.g);
    if (arr) arr.push(p);
    else byG.set(p.g, [p]);
  }
  const seen = new Set();
  const groups = [];
  for (const p of products) {
    if (seen.has(p.g)) continue;
    seen.add(p.g);
    let members = byG.get(p.g) || [];
    if (!members.includes(p)) members = [p, ...members];
    const offers = members.slice().sort(cmpOffer);
    const priced = offers.filter((o) => o.p !== null && o.p !== undefined);
    const cheapest = priced[0] || offers[0];
    const cheapestInStock = priced.find((o) => o.s) || null;
    const dearest = priced.length ? priced[priced.length - 1] : null;
    const retailers = new Set(members.map((m) => m.r)).size;
    let spread = 0;
    let spreadPct = 0;
    if (dearest && cheapest && dearest.p > cheapest.p) {
      spread = Math.round((dearest.p - cheapest.p) * 100) / 100;
      spreadPct = Math.round((spread / dearest.p) * 100);
    }
    const withImage = p.i ? p : members.find((m) => m.i);
    groups.push({
      g: p.g,
      rep: p,
      title: p.t,
      brand: p.b || '',
      brandKey: p.bn || '',
      category: p.c || '',
      image: withImage ? withImage.i : '',
      offers,
      cheapest,
      cheapestInStock,
      dearest,
      retailers,
      listings: members.length,
      spread,
      spreadPct,
    });
  }
  return groups;
}

/**
 * Re-order compare groups (in place) so a price sort follows the ladder's cheapest offer and a
 * discount sort the best discount on offer, rather than the listing that happened to match
 * the query. Unpriced groups go last; ties keep their ranking order (sort is stable).
 */
export function sortGroups(groups, sort) {
  const price = (g) => (g.cheapest && g.cheapest.p !== null && g.cheapest.p !== undefined ? g.cheapest.p : null);
  if (sort === 'price_asc' || sort === 'price_desc') {
    const dir = sort === 'price_asc' ? 1 : -1;
    return groups.sort((a, b) => {
      const pa = price(a);
      const pb = price(b);
      if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1;
      return (pa - pb) * dir;
    });
  }
  if (sort === 'discount') {
    const best = (g) => g.offers.reduce((m, o) => Math.max(m, discountPct(o)), 0);
    return groups.sort((a, b) => best(b) - best(a));
  }
  return groups;
}

/** Counts by retailer key, canonical brand and category: { retailer: {}, brand: {}, category: {} } */
export function facetCounts(products) {
  const retailer = {};
  const brand = {};
  const category = {};
  for (const p of products) {
    retailer[p.r] = (retailer[p.r] || 0) + 1;
    if (p.bn) brand[p.bn] = (brand[p.bn] || 0) + 1;
    if (p.c) category[p.c] = (category[p.c] || 0) + 1;
  }
  return { retailer, brand, category };
}
