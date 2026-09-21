// The Scuba Doctor - https://www.scubadoctor.com.au/diveshop/
//
// Platform: Zen Cart (sitemap says "Zen-Cart SitemapXML 3.9.6") with a custom JSON search
// endpoint, POST /diveshop/ajax_search.php (form-encoded). With an empty keyword and no category
// it lists the whole catalogue ("showing_all_products"), 100 rows per page:
//
//   keyword=&page=N&max=100&offset=(N-1)*100&securityToken=<32 hex>
//
// Each row is a "family representative" (a product family = one model in several sizes/colours)
// and the response carries data.family_members[family_id] = every member with its own id, model,
// stock and price, so one page gives us products AND variants without touching product pages.
// data.filters.category_hierarchy is the full category tree (category_id -> names).
// 51 pages cover the entire sitemap (12,877 product ids vs 12,876 in the sitemap, verified).
//
// Gotchas found during reconnaissance (Sep 2026):
//   * securityToken must be present (any 32 hex chars; the value is not validated).
//   * max=100 and max=150 page cleanly; max>=200 silently truncates every page to 152 rows.
//   * total_results is capped at "100+", so we page until has_more is false.
//   * `price`/`products_price` are ex-GST; `sell` (current inc-GST price) and `rrp` are what
//     the site displays. product_is_call=1 means "call for price".
//   * Cloudflare: every HTML/JSON path on the host returns 403 "Attention Required" to Node's
//     fetch and node:https no matter the User-Agent / headers / TLS cipher list, because the
//     rule keys on the TLS/HTTP fingerprint (curl over HTTP/2 with a browser UA is blocked
//     too, curl --http1.1 with a browser-like UA - including this project's honest
//     USER_AGENT - passes; curl's default UA is blocked). We therefore try fetchJson first
//     and, on a 403, fall back to the system `curl --http1.1` binary (node:child_process),
//     keeping the same User-Agent, 2-in-flight / 350 ms politeness, 30 s timeout and retry
//     policy (5 attempts with exponential backoff) as lib/http.js.
//     Residual risk: verified on macOS curl (SecureTransport/LibreSSL); the GitHub Actions
//     runner's curl (OpenSSL) has a different fingerprint and is untested. If it is blocked
//     too, the run fails cleanly and index.js keeps the previously deployed data.
//   * Not available from the endpoint (and product pages cost 5k+ fetches): descriptions,
//     and the per-product option dropdowns of the ~30 has_attributes products (prescription
//     lenses etc.); those keep their base price and get a 'has-options' tag.
//
// Whole scrape: ~51 requests, ~3-6 minutes (the endpoint is slow, ~5-7 s per page).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { fetchJson, HttpError, BROWSER_HEADERS, USER_AGENT, sleep } from '../lib/http.js';
import { makeProduct } from '../lib/product.js';
import { decodeEntities } from '../lib/html.js';

const execFileP = promisify(execFile);

const KEY = 'scubadoctor';
export const BASE = 'https://www.scubadoctor.com.au/diveshop';
export const ENDPOINT = `${BASE}/ajax_search.php`;
const PAGE_SIZE = 100; // see header: 200+ truncates
const MAX_PAGES = 150; // safety cap (51 pages today)
const CONCURRENCY = 2; // matches the http.js per-host limit
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };
// Top-level category "Training and Guided Diving": courses, guided dives, experiences, club.
const EXCLUDE_TOP = /\b(training|guided diving|courses?)\b/i;
// Not gear at all: photographic prints (the classifier reads "octopus"/"regulator" into them) and
// gift certificates, plus the novelty part of "Gift Ideas / Novelties" (stubby holders, keyrings,
// cups); that leaf also holds real gear (a Mares video light, a Suunto compass, changing mats)
// which stays. Books, logbooks and t-shirts are kept: the index has 'book & media' and 'clothing'
// classes that every other retailer feeds too.
const EXCLUDE_LEAF = /\b(photographic prints?|gift (certificates?|vouchers?|cards?))\b/i;
const NOVELTY_LEAF = /\b(gift ideas|novelt)/i;
const NOVELTY_TITLE = /\b(stubby|keyrings?|key ?chains?|bottle openers?|tea infusers?|cups?|mugs?|coasters?)\b/i;
const SEP = /[\s\-|,/:(]/;
const TRAIL = /[\s\-|,/:(]+$/;
// Trailing words of a family title that only introduce the variant ("| Size", "Set of", "2 x").
// Not "One Size", not "in" (inches: "150cm/59 in"), and "N x" only with a space ("62X" is a model).
const QUALIFIER = /\s*(\|\s*)?\b(?:(?<!\bone\s)(?:us\s+)?sizes?|colou?rs?|set of|pack of|for|with|of|and|or|\d+\s+x)\s*$/i;
const stripQualifier = (s) => {
  let t = s;
  for (let prev = ''; prev !== t; ) {
    prev = t;
    t = t.replace(QUALIFIER, '').replace(TRAIL, '').trim();
  }
  return t;
};

const clean = (s) => decodeEntities(String(s ?? '')).replace(/\s+/g, ' ').trim();
const num = (x) => (x === null || x === undefined || x === '' ? 0 : Number(x) || 0);
const round2 = (n) => Math.round(n * 100) / 100;

export function productUrl(id) {
  return `${BASE}/index.php?main_page=product_info&products_id=${id}`;
}

export function imageUrl(rel) {
  const s = clean(rel);
  if (!s) return '';
  const url = /^https?:\/\//i.test(s) ? s : `${BASE}/images/${s.replace(/^\/+/, '').replace(/^images\//, '')}`;
  // ~700 image paths contain literal spaces ("aup/ROB ALLEN/Reels/x.jpg"); encodeURI keeps '/', '(' and ')'.
  return /%[0-9a-f]{2}/i.test(url) ? url : encodeURI(url);
}

/** Parse one ajax_search.php response into rows + family members + category map. */
export function parseSearchPage(json) {
  if (!json || json.success !== true || !json.data || !Array.isArray(json.data.products)) {
    throw new Error(`unexpected ajax_search response: ${JSON.stringify(json).slice(0, 160)}`);
  }
  const d = json.data;
  const categories = new Map();
  const walk = (node, parentId, depth) => {
    if (!node || node.id === undefined || node.id === null || depth > 12) return;
    categories.set(String(node.id), { name: clean(node.text), parentId });
    for (const c of node.children || []) walk(c, String(node.id), depth + 1);
  };
  for (const n of d.filters?.category_hierarchy || []) walk(n, null, 0);
  for (const c of d.filters?.categories || []) {
    if (c && c.id !== '' && c.id !== null && c.id !== undefined && c.text && !categories.has(String(c.id))) {
      categories.set(String(c.id), { name: clean(c.text), parentId: null });
    }
  }
  return {
    rows: d.products,
    families: d.family_members && typeof d.family_members === 'object' ? d.family_members : {},
    categories,
    hasMore: d.has_more === true,
  };
}

/** Category names from the top level down to `id` ([] when unknown). */
export function categoryPath(categories, id) {
  const out = [];
  let cur = id === null || id === undefined ? '' : String(id);
  const seen = new Set();
  while (cur && categories.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    const c = categories.get(cur);
    if (c.name) out.unshift(c.name);
    cur = c.parentId;
  }
  return out;
}

/**
 * Longest common prefix of the member names, cut back to a word/separator boundary, e.g.
 * ["Cressi Fast Wetsuit - 7mm Ladies | 4 / L", "... | 5 / XL"] -> "Cressi Fast Wetsuit - 7mm Ladies".
 * Returns '' when the members do not share a meaningful prefix (mixed-product "families").
 */
export function commonTitle(names) {
  const list = names.map(clean).filter(Boolean);
  if (list.length < 2) return '';
  let prefix = list[0];
  for (const n of list.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < n.length && prefix[i] === n[i]) i += 1;
    prefix = prefix.slice(0, i);
    if (!prefix) return '';
  }
  const atBoundary = list.every((n) => n.length === prefix.length || SEP.test(n[prefix.length]));
  let cut = prefix.length;
  if (!atBoundary) {
    cut = -1;
    for (let i = prefix.length - 1; i >= 0; i -= 1) {
      if (SEP.test(prefix[i])) {
        cut = i;
        break;
      }
    }
    if (cut < 0) return '';
  }
  // "Ocean Pro Boot | US Size" + "4", "... Pack, Set of" + "Two": the qualifier belongs to the variant.
  const title = stripQualifier(prefix.slice(0, cut).replace(TRAIL, '').trim());
  const shortest = Math.min(...list.map((n) => n.length));
  return title.length >= 12 && title.length >= shortest * 0.5 ? title : '';
}

function variantTitle(name, title, model) {
  const n = clean(name);
  if (title && n.startsWith(title)) {
    const rest = n.slice(title.length).replace(/^[\s\-|,/:]+/, '').replace(/[\s\-|,/:]+$/, '').trim();
    return rest || clean(model) || 'Default';
  }
  return n || clean(model) || 'Default';
}

// Rows and family members use different key names for the same fields.
const qtyOf = (x) => num(x.quantity ?? x.products_quantity);
const priceOf = (x) => {
  if (num(x.product_is_call)) return null; // "call for price"
  const s = num(x.sell);
  return s > 0 ? round2(s) : null;
};
const rrpOf = (x) => {
  const p = priceOf(x);
  const r = num(x.rrp);
  return p !== null && r > p ? round2(r) : null;
};
// availability_flag (text) is only on the listing row, but availability_id is on rows AND family
// members and maps 1:1 to that text across the whole catalogue (0 none, 1 Discontinued,
// 2 Superseded, 3 Unavailable, 4 Special Order). 428 members carry a different id from their
// row (e.g. a discontinued 250 ml size next to a stocked 5 l one), so each member gets its own
// flag; the row's text is only the fallback when the id is missing.
const FLAGS = { 1: 'Discontinued', 2: 'Superseded', 3: 'Unavailable', 4: 'Special Order' };
const flagOf = (x, rowFlag) => (x.availability_id === undefined || x.availability_id === null || x.availability_id === '' ? clean(rowFlag) : FLAGS[Number(x.availability_id)] || '');
const BLOCKING_FLAG = /^(unavailable|superseded|discontinued)$/i;
/**
 * "Available" = the product page shows an Add-to-Cart button (checked on product pages for every
 * state): stock on hand, or a pre-order (qty 0, ETA date) when nothing blocks it. This agrees with
 * the site's own family_stock_key: every 'out-of-stock' family is unavailable, 'pre-order' ones are.
 */
const availableOf = (x, flag) => {
  if (num(x.currentlyUnavailable) || num(x.product_is_call)) return false;
  if (qtyOf(x) > 0) return true;
  return !BLOCKING_FLAG.test(clean(flag));
};
const familyUrlId = (url) => (/products_id=(\d+)/.exec(String(url || '')) || [])[1] || '';
// Listing names sometimes end in a dangling separator ("... Manifold (300 bar) -").
const tidyTitle = (s) => clean(s).replace(/[\s\-|,/:(]+$/, '').trim();
// A family whose members share nothing but the brand ("Cressi" for ten sizes of gun rubber) is
// listed under the brand alone; name it by its category instead ("Cressi Spearfishing Rubber").
const titleOrCategory = (title, brand, category) => (brand && category && title.toLowerCase() === brand.toLowerCase() ? `${title} ${category}` : title);

function tagsFor(row, pool) {
  const tags = [clean(row.availability_flag), num(row.products_clearance) ? 'Clearance' : '', row.has_attributes ? 'has-options' : ''];
  const purchasable = pool.some((m) => availableOf(m, flagOf(m, row.availability_flag)));
  if (purchasable && !pool.some((m) => qtyOf(m) > 0)) tags.push('Pre-order');
  return tags.filter(Boolean);
}

/** Convert one listing row (+ its family members) into a canonical Product. */
export function rowToProduct(row, families, categories) {
  const path = categoryPath(categories, row.category_id);
  const category = path.length ? path[path.length - 1] : '';
  const brand = clean(row.manufacturer);
  const flag = row.availability_flag;
  const members = row.family_id !== null && row.family_id !== undefined ? families[String(row.family_id)] : null;

  if (Array.isArray(members) && members.length >= 2) {
    const canonicalId = familyUrlId(row.family_url);
    const canonical = members.find((m) => String(m.products_id) === canonicalId);
    const sourceId = canonical ? canonicalId : String(row.id);
    const prefix = commonTitle(members.map((m) => m.products_name));
    // The site's display_name can dangle too ("Fins NATEEVA Size"); never strip it to nothing.
    const fallback = tidyTitle(row.display_name || row.family_name || row.name);
    const title = titleOrCategory(prefix || stripQualifier(fallback) || fallback, brand, category);
    const variants = members.map((m) => ({
      title: variantTitle(m.products_name, prefix, m.products_model),
      price: priceOf(m),
      compareAtPrice: rrpOf(m),
      available: availableOf(m, flagOf(m, flag)),
      sku: clean(m.products_model),
    }));
    return makeProduct({
      retailer: KEY,
      sourceId,
      title,
      brand,
      category,
      url: productUrl(sourceId),
      image: imageUrl((canonical && canonical.products_image) || row.image || (row.family_images || [])[0]),
      variants,
      tags: tagsFor(row, members),
      description: '',
    });
  }

  return makeProduct({
    retailer: KEY,
    sourceId: String(row.id),
    title: titleOrCategory(tidyTitle(row.name), brand, category),
    brand,
    category,
    price: priceOf(row),
    compareAtPrice: rrpOf(row),
    inStock: availableOf(row, flagOf(row, flag)),
    url: productUrl(row.id),
    image: imageUrl(row.image),
    sku: clean(row.model),
    tags: tagsFor(row, [row]),
    description: '',
  });
}

/** Merge parsed pages into deduplicated Products (pure; no network). */
export function productsFromPages(pages, { log = () => {} } = {}) {
  const categories = new Map();
  for (const p of pages) for (const [k, v] of p.categories) if (!categories.has(k)) categories.set(k, v);
  const out = [];
  const seen = new Set();
  let excluded = 0;
  let skipped = 0;
  for (const page of pages) {
    for (const row of page.rows) {
      try {
        const path = categoryPath(categories, row?.category_id);
        const leaf = path[path.length - 1] || '';
        if ((path.length && EXCLUDE_TOP.test(path[0])) || EXCLUDE_LEAF.test(leaf) || (NOVELTY_LEAF.test(leaf) && NOVELTY_TITLE.test(clean(row?.name)))) {
          excluded += 1;
          continue;
        }
        const product = rowToProduct(row, page.families, categories);
        if (seen.has(product.id)) continue;
        seen.add(product.id);
        out.push(product);
      } catch (err) {
        skipped += 1;
        log(`${KEY}: skipped row ${row?.id} (${clean(row?.name).slice(0, 60)}): ${err.message}`);
      }
    }
  }
  log(`${KEY}: ${out.length} products from ${pages.reduce((n, p) => n + p.rows.length, 0)} rows (${excluded} training/gifts/novelties excluded, ${skipped} skipped)`);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Transport: Node fetch first, curl --http1.1 fallback (see header comment).

// Same policy as lib/http.js DEFAULTS: 30 s per request, 5 attempts, >= 350 ms between request starts.
const CURL_TIMEOUT_S = 30;
const CURL_RETRIES = 4;
const CURL_MIN_DELAY_MS = 350;

let lastCurlStart = 0;
async function curlJson(body) {
  const args = [
    '-sS', '--http1.1', '--max-time', String(CURL_TIMEOUT_S),
    '-A', USER_AGENT,
    ...Object.entries(BROWSER_HEADERS).filter(([k]) => k !== 'user-agent').flatMap(([k, v]) => ['-H', `${k}: ${v}`]),
    '-H', 'Accept: application/json',
    '-H', 'Content-Type: application/x-www-form-urlencoded',
    '--data', body,
    '-w', '\n%{http_code}',
    ENDPOINT,
  ];
  let lastErr;
  for (let attempt = 0; attempt <= CURL_RETRIES; attempt += 1) {
    // Reserve the start slot before sleeping so two concurrent callers cannot wake together.
    const start = Math.max(Date.now(), lastCurlStart + CURL_MIN_DELAY_MS);
    lastCurlStart = start;
    const wait = start - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const { stdout } = await execFileP('curl', args, { maxBuffer: 64 * 1024 * 1024 });
      const nl = stdout.lastIndexOf('\n');
      const status = Number(stdout.slice(nl + 1).trim());
      const text = stdout.slice(0, nl);
      if (status === 200) {
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`invalid JSON from curl: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
        }
      }
      lastErr = new HttpError(status, ENDPOINT, text.slice(0, 200).replace(/\s+/g, ' '));
      if (!(status === 429 || status >= 500)) throw lastErr;
    } catch (err) {
      if (err && err.code === 'ENOENT') throw new Error('curl binary not found and Node fetch is blocked by Cloudflare');
      if (err instanceof HttpError && !(err.status === 429 || err.status >= 500)) throw err;
      lastErr = err;
    }
    if (attempt < CURL_RETRIES) await sleep(1000 * 2 ** attempt + Math.random() * 250);
  }
  throw lastErr;
}

function makeTransport(log) {
  let useCurl = false;
  return async function postSearch(params) {
    const body = new URLSearchParams(params).toString();
    if (!useCurl) {
      try {
        return await fetchJson(ENDPOINT, { method: 'POST', body, headers: FORM });
      } catch (err) {
        if (!(err instanceof HttpError && err.status === 403)) throw err;
        if (!useCurl) log(`${KEY}: Node fetch got HTTP 403 (Cloudflare fingerprint rule); switching to curl --http1.1 for the rest of the run`);
        useCurl = true;
      }
    }
    return curlJson(body);
  };
}

/**
 * Walk every listing page with a couple of workers; stops at the first page with has_more=false.
 * A failure in one worker (Promise.all rejects at once) also stops the other from starting any
 * further page: it finishes its in-flight request and returns, instead of walking the rest of
 * the catalogue for a run that has already failed. Exported for the unit test only.
 */
export async function walkPages(postSearch, { log = () => {} } = {}) {
  const token = randomBytes(16).toString('hex');
  const pages = [];
  let next = 1;
  let stop = MAX_PAGES;
  let aborted = false;
  const worker = async () => {
    try {
      for (;;) {
        const page = next;
        if (aborted || page > stop) return;
        next += 1;
        const json = await postSearch({ keyword: '', page: String(page), max: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE), securityToken: token });
        const parsed = parseSearchPage(json);
        pages[page - 1] = parsed;
        log(`${KEY}: page ${page} -> ${parsed.rows.length} rows, ${Object.keys(parsed.families).length} families${parsed.hasMore ? '' : ' (last)'}`);
        if (!parsed.hasMore || parsed.rows.length === 0) stop = Math.min(stop, page);
      }
    } catch (err) {
      aborted = true;
      throw err;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return pages.filter(Boolean);
}

export default {
  key: KEY,
  name: 'The Scuba Doctor',
  homepage: 'https://www.scubadoctor.com.au/diveshop/',
  platform: 'zencart',
  async fetch({ log = () => {} } = {}) {
    const pages = await walkPages(makeTransport(log), { log });
    return productsFromPages(pages, { log });
  },
};
