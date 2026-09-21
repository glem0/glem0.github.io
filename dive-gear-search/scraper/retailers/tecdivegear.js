// Tec Dive Gear (https://www.tecdivegear.com.au/) - technical diving specialist (Dive Rite,
// Shearwater, Fourth Element, Omniswivel, Light Monkey, Bauer). ~500 products.
//
// Platform: custom legacy PHP 5.6 catalogue (Apache origin, no CDN/WAF). There is no JSON API,
// sitemap, search, feed, JSON-LD or microdata, so this module scrapes HTML with tolerant regexes:
//
//   1. GET /catalogue/index.php                       -> 29 category links (#leftmenu a.lv12)
//   2. GET /catalogue/category_intro.php/1/{catId}    -> ALL products of the category on one page
//                                                        (no pagination): id, title, price, thumbnail
//   3. GET /catalogue/product.php/1/{id}   (one per product, mapLimit 3)
//                                                     -> brand ("Manufacturer"), "Product Code" sku,
//                                                        description, availability text, variants
//                                                        (<select name="siz">, option value "price|rrp"),
//                                                        colour options, large image
//
// ~530 requests per run; with the http helper's per-host rate limit that is ~2 minutes. Product pages
// are fetched with a single retry and the run aborts (-> index.js keeps the previous data as "stale")
// after MAX_CONSECUTIVE_DETAIL_FAILURES failures in a row, so a mid-run outage cannot eat the whole
// GitHub Actions budget or publish a catalogue of brand-less listing-only records.
//
// Gotchas handled here (all verified with curl on 2026-09-20):
//   - Listing shows "$0.00" for price-on-application items; the detail page shows "$POA" and has no
//     #price. Both become price null.
//   - A non-existent id returns HTTP 200 with an empty <h1></h1> (and a misleading breadcrumb) -> skipped.
//   - #price / listing price is the FIRST size option's price, which is not always the cheapest; the
//     product price is derived from the variants by makeProduct() (cheapest available option).
//   - Availability is free text: "Today", "Out of Stock", "On order", "Made to Order", "1 XXL in stock",
//     "no longer avaiable" (sic)... Only "out of stock / sold out / no longer / discontinued" style
//     texts are treated as not purchasable; made-to-order / on-order items stay purchasable.
//   - Option labels (size AND colour selects) may carry a stock suffix in many spellings: "9 Inch -
//     out of stock", "11 Inch - On order", "XXL - 2 left in stock", "3-5 1set in stock", "8-10 out of
//     stock", "114 ml Out of stock". The suffix decides the variant's availability and is stripped.
//   - Copy uses named entities beyond the basic set (&rsquo; &bull; &acute; &plusmn; ...) and some
//     cp1252-mangled UTF-8 ("&acirc;&ndash;" for a bullet); unknown entities are dropped, not leaked.
//   - Image paths contain spaces (percent-encoded via URL) and sometimes "//" (collapsed).
//   - Markup is invalid XHTML (nested <p>, unescaped '&' in titles, trailing whitespace) - hence
//     regex parsing rather than anything that expects well-formed HTML. Attribute runs are matched
//     with [^<>]* (never [^>]*) so a page full of unclosed '<' stays linear instead of quadratic.
//
// Residual risk: ~60 products exist that are not linked from any category (mostly discontinued;
// only 3 purchasable) - they are deliberately not enumerated. GST inclusion is not stated on the
// site; prices are assumed to be AUD retail incl. GST like the other retailers. No compare-at/RRP
// prices exist on the site today (the "rrp" half of every option value is 0.00), so compareAtPrice is
// null unless the shop starts populating it.

import { fetchText, mapLimit } from '../lib/http.js';
import { makeProduct, parsePrice } from '../lib/product.js';
import { stripTags, matchAll, match1, absUrl } from '../lib/html.js';

export const BASE = 'https://www.tecdivegear.com.au';
const INDEX_URL = `${BASE}/catalogue/index.php`;
export const categoryUrl = (catId) => `${BASE}/catalogue/category_intro.php/1/${catId}`;
export const productUrl = (id) => `${BASE}/catalogue/product.php/1/${id}`;

const HTML_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

// Abort the detail stage after this many product pages fail in a row (site down / blocking us).
export const MAX_CONSECUTIVE_DETAIL_FAILURES = 10;

// Categories that are not gear (the build step would exclude them anyway; skipping saves fetches).
const SKIP_CATEGORY = /\b(diving trips?|courses?|training)\b/i;

// Availability / option-label texts that mean "cannot be bought right now".
const NOT_PURCHASABLE = /\b(out of stock|sold out|no longer|discontinued|not available|unavailable)\b/i;

// Named entities that lib/html.js does not decode but that appear in this site's copy. Any other
// "&name;" left after decoding is replaced by a space so no raw entity reaches the UI.
const EXTRA_ENTITIES = {
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
  laquo: '«', raquo: '»', dagger: '†', trade: '™', reg: '®', copy: '©', deg: '°', plusmn: '±', times: '×',
  prime: '′', Prime: '″', acute: '´', pound: '£', euro: '€', cent: '¢', sect: '§', para: '¶', shy: '',
  frac12: '½', frac14: '¼', frac34: '¾', sup2: '²', sup3: '³', micro: 'µ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', aacute: 'á', acirc: 'â', aring: 'å', aelig: 'æ', ccedil: 'ç',
  iuml: 'ï', ouml: 'ö', ocirc: 'ô', uuml: 'ü', Uuml: 'Ü', ntilde: 'ñ', szlig: 'ß', Yuml: 'Ÿ', yuml: 'ÿ',
};
function decodeExtra(s) {
  return String(s || '')
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => (Object.hasOwn(EXTRA_ENTITIES, e) ? EXTRA_ENTITIES[e] : ' '))
    // "&acirc;&ndash;" is the site's cp1252-mangled UTF-8 for a bullet (e.g. the compressor spec list on id 408).
    .replace(/â–/g, '•');
}

function clean(s) {
  return decodeExtra(stripTags(s)).replace(/\s+/g, ' ').trim();
}

/** First capture group of `re` against `html` WITHOUT entity decoding (for HTML segments that are parsed further). */
function rawSegment(html, re) {
  const m = re.exec(html);
  return m ? m[1] : '';
}

/** "$1850.00" -> 1850; "$0.00", "$POA", "" -> null */
export function parseMoney(text) {
  const t = String(text || '').trim();
  if (!t || /poa/i.test(t)) return null;
  const n = parsePrice(t);
  return n === null || n <= 0 ? null : n;
}

/** Site image path -> absolute, percent-encoded URL ('' when empty). */
export function imageUrl(src) {
  const s = String(src || '').trim().replace(/\/{2,}/g, '/');
  if (!s || /\/$/.test(s)) return ''; // "/images/products_small/" = no image
  return absUrl(s, BASE);
}

/** true when the availability text says the item can be bought (in stock, on order, made to order...). */
export function isPurchasable(text) {
  return !NOT_PURCHASABLE.test(String(text || ''));
}

// Trailing stock annotation on an option label: "- out of stock", "- On order", "- 2 left in stock",
// "1set in stock", "2 sets in stock", "Out of stock" (with or without the dash).
const STOCK_SUFFIX = /\s*-?\s*(?:(?:\d+\s*)?(?:sets?\s*)?(?:left\s*)?in stock|out of stock|on order|sold out|limited stock|made to order)\s*$/i;

/** Option label without its stock annotation; the label is kept as-is when nothing else would be left. */
export function stripStockSuffix(label) {
  const t = String(label || '').replace(/\s+/g, ' ').trim();
  return t.replace(STOCK_SUFFIX, '').trim() || t;
}

/** Category links from /catalogue/index.php: [{ id, name }]. */
export function parseCategoryLinks(html) {
  const out = [];
  const seen = new Set();
  for (const [attrs, inner] of matchAll(html, /<a\b([^<>]*)>([^<]*)/gi)) {
    if (!/\bclass=["']lv12["']/i.test(attrs)) continue;
    const m = /category_intro\.php\/1\/(\d+)/i.exec(attrs);
    if (!m || seen.has(m[1])) continue;
    const name = clean(inner);
    if (!name) continue;
    seen.add(m[1]);
    out.push({ id: m[1], name });
  }
  return out;
}

/**
 * Products on a category page: [{ id, title, price, image }].
 *   <a href="../../product.php/1/670" class="name">Title<br/><img src="/images/products_small/x.jpg" alt="Title" /></a>
 *   <div class="special_price">$1210.00</div>
 */
export function parseCategoryPage(html) {
  const out = [];
  const re = /<a\b([^<>]*\bclass=["']name["'][^<>]*)>([\s\S]*?)<\/a>(?:\s*<div class="special_price">([^<]*)<\/div>)?/gi;
  let m;
  while ((m = re.exec(html))) {
    const id = (/product\.php\/1\/(\d+)/i.exec(m[1]) || [])[1];
    if (!id) continue;
    const inner = m[2];
    const title = clean(inner.split(/<br\s*\/?>/i)[0]) || clean(match1(inner, /<img\b[^<>]*\balt="([^"]*)"/i));
    const image = imageUrl(match1(inner, /<img\b[^<>]*\bsrc="([^"]*)"/i));
    out.push({ id, title, price: parseMoney(m[3]), image });
  }
  return out;
}

/** <option value="66.00|0.00">9 Inch - out of stock</option> -> { title, price, compareAtPrice, available } */
function parseSizeOptions(selectInner) {
  const out = [];
  for (const [attrs, inner] of matchAll(selectInner, /<option\b([^<>]*)>([\s\S]*?)<\/option>/gi)) {
    const title = clean(inner);
    if (!title) continue;
    const value = match1(attrs, /\bvalue="([^"]*)"/i);
    const [priceStr, rrpStr] = value.split('|');
    const price = parseMoney(priceStr);
    const rrp = parseMoney(rrpStr);
    out.push({
      title: stripStockSuffix(title),
      price,
      compareAtPrice: rrp !== null && price !== null && rrp > price ? rrp : null,
      available: isPurchasable(title),
    });
  }
  return out;
}

/**
 * Parse a product page. Returns null when the id does not exist (the site answers 200 with an empty <h1>).
 * { title, brand, sku, description, availability, inStock, price, variants, colours, image, category, categoryId }
 */
export function parseProductPage(html) {
  const left = rawSegment(html, /<div id="pageleft">([\s\S]*?)(?:<div id="pageright">|<div id="pageholderbottom">)/i);
  const title = clean(match1(left, /<h1(?:\s[^<>]*)?>([\s\S]*?)<\/h1>/i));
  if (!title) return null;

  const rawBrand = clean(match1(left, /<p>\s*Manufacturer\s*([^<]*)<\/p>/i));
  const brand = rawBrand === '*' ? '' : rawBrand;
  const sku = clean(match1(left, /Product Code\s*:?\s*([^<]*)/i)).replace(/^#\s*/, '');

  const formAt = left.search(/<form\b/i);
  const descHtml = (formAt >= 0 ? left.slice(0, formAt) : left)
    .replace(/<h1(?:\s[^<>]*)?>[\s\S]*?<\/h1>/i, ' ')
    .replace(/<p>\s*Manufacturer[^<]*<\/p>/i, ' ')
    .replace(/<p>\s*Product Code[^<]*<\/p>/i, ' ');
  const description = clean(descHtml).slice(0, 300);

  const form = formAt >= 0 ? left.slice(formAt) : left;
  const availability = clean(match1(form, /<span class="(?:available|highlight)">([^<]*)<\/span>/i));
  const inStock = isPurchasable(availability);
  const price = parseMoney(match1(form, /<div id="price">([^<]*)<\/div>/i) || match1(form, /<div class="special_price">([^<]*)<\/div>/i));

  const sizeSelect = rawSegment(form, /<select\b[^<>]*\bname=["']siz["'][^<>]*>([\s\S]*?)<\/select>/i);
  const variants = sizeSelect ? parseSizeOptions(sizeSelect) : [];
  const colourSelect = rawSegment(form, /<select\b[^<>]*\bname=["']col["'][^<>]*>([\s\S]*?)<\/select>/i);
  const colours = colourSelect ? matchAll(colourSelect, /<option\b[^<>]*>([\s\S]*?)<\/option>/gi).map(([t]) => clean(t)).filter(Boolean) : [];

  const right = rawSegment(html, /<div id="pageright">([\s\S]*?)<div id="pageholderbottom">/i);
  const image = imageUrl(match1(right, /<img\b[^<>]*\bsrc="([^"]*)"/i));

  const nav = rawSegment(html, /<div id="nav_path">([\s\S]*?)<\/div>/i);
  const crumbs = matchAll(nav, /category_intro\.php\/1\/(\d+)["'][^<>]*>([^<]*)</gi).filter(([, name]) => name.trim());
  const last = crumbs[crumbs.length - 1];

  return {
    title,
    brand,
    sku,
    description,
    availability,
    inStock,
    price,
    variants,
    colours,
    image,
    category: last ? clean(last[1]) : '',
    categoryId: last ? last[0] : '',
  };
}

/**
 * Combine a listing entry ({ id, title, price, image, category }) with its parsed detail page
 * (or null when the detail fetch failed) into a canonical Product.
 */
export function toProduct(listing, detail) {
  const basePrice = detail ? detail.price ?? listing.price ?? null : listing.price ?? null;
  let variants = [];
  if (detail && detail.variants.length) {
    // an option whose value carries no price ("" or "0.00|0.00") falls back to the displayed page price
    variants = detail.variants.map((v) => ({ title: v.title, price: v.price ?? basePrice, compareAtPrice: v.compareAtPrice, available: detail.inStock && v.available, sku: '' }));
  } else if (detail && detail.colours.length) {
    // colour labels carry the same "- Out of Stock" suffix as size options ("Blue - Out of Stock" on id 23)
    variants = detail.colours.map((c) => ({ title: stripStockSuffix(c), price: basePrice, compareAtPrice: null, available: detail.inStock && isPurchasable(c), sku: '' }));
  }
  const tags = [];
  if (detail && detail.availability && !/^today$/i.test(detail.availability)) tags.push(detail.availability);
  return makeProduct({
    retailer: 'tecdivegear',
    sourceId: listing.id,
    title: (detail && detail.title) || listing.title,
    brand: detail ? detail.brand : '',
    category: listing.category || (detail && detail.category) || '',
    // with variants, let makeProduct pick the cheapest purchasable option
    price: variants.length ? null : basePrice,
    inStock: detail ? detail.inStock : undefined,
    url: productUrl(listing.id),
    image: (detail && detail.image) || listing.image || '',
    sku: detail ? detail.sku : '',
    variants,
    tags,
    description: detail ? detail.description : '',
  });
}

export default {
  key: 'tecdivegear',
  name: 'Tec Dive Gear',
  homepage: 'https://www.tecdivegear.com.au/',
  platform: 'custom',
  async fetch({ log = () => {} } = {}) {
    const indexHtml = await fetchText(INDEX_URL, { accept: HTML_ACCEPT });
    const categories = parseCategoryLinks(indexHtml).filter((c) => !SKIP_CATEGORY.test(c.name));
    if (categories.length === 0) throw new Error('tecdivegear: no category links found on the catalogue index (markup changed?)');
    log(`tecdivegear: ${categories.length} categories`);

    // Listing stage is all-or-nothing: a missing category would silently drop its products.
    const listings = new Map();
    const catResults = await mapLimit(categories, 3, async (cat) => {
      const html = await fetchText(categoryUrl(cat.id), { accept: HTML_ACCEPT });
      const items = parseCategoryPage(html);
      let added = 0;
      for (const it of items) {
        if (listings.has(it.id)) continue;
        listings.set(it.id, { ...it, category: cat.name, categoryId: cat.id });
        added += 1;
      }
      log(`tecdivegear: category ${cat.id} "${cat.name}" -> ${items.length} products`);
      return added;
    });
    const list = [...listings.values()];
    if (list.length === 0) throw new Error(`tecdivegear: ${catResults.length} category pages fetched but no products parsed (markup changed?)`);
    log(`tecdivegear: ${list.length} products listed; fetching product pages`);

    // Detail stage is best-effort: a failed page still yields a listing-only record. A run of failures
    // means the site is down, though: stop fetching and throw so index.js keeps the previous data as
    // "stale" rather than publishing brand-less listing-only records or burning the Actions budget on
    // the http helper's full retry ladder for every remaining product.
    let detailFailed = 0;
    let consecutiveFailed = 0;
    let abort = null;
    let notFound = 0;
    let skipped = 0;
    const products = await mapLimit(list, 3, async (it) => {
      if (abort) return null;
      let detail = null;
      try {
        detail = parseProductPage(await fetchText(productUrl(it.id), { accept: HTML_ACCEPT, retries: 1 }));
        consecutiveFailed = 0;
        if (!detail) {
          notFound += 1;
          log(`tecdivegear: product ${it.id} "${it.title}" has an empty detail page; skipping`);
          return null;
        }
      } catch (err) {
        detailFailed += 1;
        consecutiveFailed += 1;
        if (consecutiveFailed >= MAX_CONSECUTIVE_DETAIL_FAILURES) {
          if (!abort) abort = new Error(`tecdivegear: ${consecutiveFailed} product pages failed in a row (last: ${err.message}); aborting so previous data is kept`);
          return null;
        }
        log(`tecdivegear: product ${it.id} detail failed (${err.message}); using listing data only`);
      }
      try {
        return toProduct(it, detail);
      } catch (err) {
        skipped += 1;
        log(`tecdivegear: skipped ${it.id}: ${err.message}`);
        return null;
      }
    });
    if (abort) throw abort;
    const out = products.filter(Boolean);
    log(`tecdivegear: ${out.length} products (${detailFailed} detail fetches failed, ${notFound} empty pages, ${skipped} unparseable)`);
    return out;
  },
};
