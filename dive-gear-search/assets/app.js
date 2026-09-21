// Dive Gear Search — DOM, state and rendering. Search logic lives in ./search.js.
import { inflateIndex, buildIndex, searchProducts, groupResults, sortGroups, facetCounts, compileFilters, discountPct, SORTS } from './search.js';

const PAGE = 40; // items rendered per "Show more"
const MAX_OFFERS = 5; // offers shown per compare card before "Show N more offers"
const AUTO_PAGES = 8; // pages loaded automatically by scrolling before a click is required
const SEARCH_DEBOUNCE_MS = 120;
const PRICE_DEBOUNCE_MS = 250;
const LIVE_TIMEOUT_MS = 8000;

const $ = (id) => document.getElementById(id);
const els = {
  q: $('q'),
  clear: $('clear'),
  count: $('count'),
  updated: $('updated'),
  filtersToggle: $('filters-toggle'),
  filtersBadge: $('filters-badge'),
  filters: $('filters'),
  reset: $('reset'),
  fRetailers: $('f-retailers'),
  fCategories: $('f-categories'),
  fBrand: $('f-brand'),
  fStock: $('f-stock'),
  fSale: $('f-sale'),
  fMin: $('f-min'),
  fMax: $('f-max'),
  sort: $('sort'),
  list: $('list'),
  notice: $('notice'),
  empty: $('empty'),
  error: $('error'),
  more: $('more'),
  retailersTable: $('retailers'),
  viewButtons: [...document.querySelectorAll('.view-toggle [data-view]')],
};

// ---------- state ----------

const state = {
  q: '',
  retailers: null, // Set of selected keys, or null = all
  categories: new Set(),
  brand: '', // canonical brand (bn)
  stock: false,
  sale: false,
  min: null,
  max: null,
  sort: 'relevance',
  view: 'compare',
};

let data = null; // products.json
let meta = null; // meta.json
let index = null; // buildIndex()
let current = { key: '', items: [], results: [], rendered: 0, autoPages: 0 };
let lastBrandSig = '';

// ---------- small utils ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
const fmtInt = (n) => Number(n || 0).toLocaleString('en-AU');
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

function money(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function relTime(iso) {
  const t = Date.parse(iso || '');
  if (!t) return 'unknown';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${plural(h, 'hour')} ago`;
  const d = Math.round(h / 24);
  if (d < 45) return `${d} ${plural(d, 'day')} ago`;
  return new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Shopify's CDN resizes on demand. Instead of the original, ask for card-sized renditions and let
 * the browser pick by its own pixel density: a card ~360 CSS px wide is ~720 device px on a 2x
 * screen and ~1080 on a 3x phone, where a single 400 px image is upscaled and looks blurry.
 * `sizes` is the slot's CSS width. Other hosts get their original image untouched.
 */
const SHOPIFY_WIDTHS = [400, 800, 1200];
const shopifyResized = (u, width) => `${u}${u.includes('?') ? '&' : '?'}width=${width}`;
function imgSrcAttrs(u, sizes) {
  if (!/^https:\/\/cdn\.shopify\.com\//i.test(u) || /[?&]width=/.test(u)) return `src="${esc(u)}"`;
  const srcset = SHOPIFY_WIDTHS.map((w) => `${esc(shopifyResized(u, w))} ${w}w`).join(', ');
  return `src="${esc(shopifyResized(u, SHOPIFY_WIDTHS[0]))}" srcset="${srcset}" sizes="${sizes}"`;
}
/** CSS width of the image slot: list thumbs are 64-80 px; a compare card spans the phone width and is at most ~420 px on wider layouts. */
const IMG_SIZES = { 'card-media': '(min-width: 900px) 420px, calc(100vw - 32px)', thumb: '80px' };

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const retailerName = (key) => data?.retailers?.[key]?.name || key;

/** Category key -> label: 'bcd' -> 'BCD', 'reel & smb' -> 'Reel & SMB', 'dive computer' -> 'Dive computer'. */
const CAT_ACRONYMS = { bcd: 'BCD', smb: 'SMB' };
const catLabel = (c) => String(c || '').replace(/[a-z0-9]+/g, (w, i) => CAT_ACRONYMS[w] || (i === 0 ? w[0].toUpperCase() + w.slice(1) : w));
const isLive = (key) => {
  const r = data?.retailers?.[key];
  return Boolean(r && (r.live === true || r.platform === 'shopify'));
};

/**
 * The URL the Check-live button may fetch (`<this>.js`), or '' when there is no safe one: the
 * retailer must be a live (Shopify) store, the product URL must be https on the retailer's own
 * homepage host, and the path must be a canonical /products/<handle>. Anything else (a poisoned
 * catalogue entry pointing at a third-party origin, a non-product path) gets no button, so the data
 * file can never make a viewer's browser call an arbitrary host.
 */
function liveUrl(p) {
  if (!isLive(p.r)) return '';
  try {
    const u = new URL(safeUrl(p.u));
    const home = new URL(safeUrl(data?.retailers?.[p.r]?.homepage));
    return u.protocol === 'https:' && u.host === home.host && /^\/products\/[^/]+$/.test(u.pathname) ? `${u.origin}${u.pathname}` : '';
  } catch {
    return '';
  }
}

// ---------- URL state ----------

function readUrl() {
  const sp = new URLSearchParams(location.search);
  state.q = sp.get('q') || '';
  const r = (sp.get('r') || '').split(',').filter(Boolean);
  state.retailers = sp.has('r') ? new Set(r) : null;
  state.categories = new Set((sp.get('c') || '').split(',').filter(Boolean));
  state.brand = sp.get('b') || '';
  state.stock = sp.get('stock') === '1';
  state.sale = sp.get('sale') === '1';
  state.min = numOrNull(sp.get('min'));
  state.max = numOrNull(sp.get('max'));
  state.sort = SORTS.includes(sp.get('sort')) ? sp.get('sort') : 'relevance';
  state.view = sp.get('view') === 'list' ? 'list' : 'compare';
}

function writeUrl() {
  const sp = new URLSearchParams();
  if (state.q.trim()) sp.set('q', state.q.trim());
  if (state.retailers) sp.set('r', [...state.retailers].join(','));
  if (state.categories.size) sp.set('c', [...state.categories].join(','));
  if (state.brand) sp.set('b', state.brand);
  if (state.stock) sp.set('stock', '1');
  if (state.sale) sp.set('sale', '1');
  if (state.min !== null) sp.set('min', String(state.min));
  if (state.max !== null) sp.set('max', String(state.max));
  if (state.sort !== 'relevance') sp.set('sort', state.sort);
  if (state.view !== 'compare') sp.set('view', state.view);
  const qs = sp.toString();
  const next = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  if (next !== `${location.pathname}${location.search}${location.hash}`) {
    try {
      history.replaceState(null, '', next);
    } catch {
      /* file:// or sandboxed */
    }
  }
}

/** Drop unknown keys that came in from the URL once the data is known. */
function validateState() {
  const known = Object.keys(data.retailers || {});
  if (state.retailers) {
    const asked = state.retailers.size;
    state.retailers = new Set([...state.retailers].filter((k) => known.includes(k)));
    // every key selected, or only unknown keys (a typo, or a retailer since removed): all retailers.
    // A literally empty r= is the "None" state and stays an empty Set.
    if (state.retailers.size === known.length || (asked > 0 && state.retailers.size === 0)) state.retailers = null;
  }
  const cats = new Set(index.products.map((p) => p.c));
  state.categories = new Set([...state.categories].filter((c) => cats.has(c)));
  if (state.brand && !index.brandNames[state.brand]) state.brand = '';
}

// ---------- filter controls ----------

function activeFilterCount() {
  return (
    (state.retailers ? 1 : 0) +
    (state.categories.size ? 1 : 0) +
    (state.brand ? 1 : 0) +
    (state.stock ? 1 : 0) +
    (state.sale ? 1 : 0) +
    (state.min !== null ? 1 : 0) +
    (state.max !== null ? 1 : 0)
  );
}

// The facet count is aria-hidden so the control's accessible name stays "Adreno" / "Regulator"
// (not "Adreno 2,455", which changes with every query); aria-describedby still reads it out.
const cntId = (kind, key) => `cnt-${kind}-${String(key).replace(/[^a-z0-9]+/gi, '-')}`;

function buildFilterControls() {
  const retailers = Object.entries(data.retailers || {}).sort((a, b) => a[1].name.localeCompare(b[1].name));
  els.fRetailers.innerHTML = retailers
    .map(
      ([key, r]) =>
        `<label class="check"><input type="checkbox" value="${esc(key)}" aria-describedby="${cntId('r', key)}"><span class="name">${esc(r.name)}</span><span class="cnt" id="${cntId('r', key)}" data-cnt="r:${esc(key)}" aria-hidden="true">0</span></label>`,
    )
    .join('');

  const totals = {};
  for (const p of index.products) totals[p.c] = (totals[p.c] || 0) + 1;
  const cats = Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
  els.fCategories.innerHTML = cats
    .map(
      (c) =>
        `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="false" aria-describedby="${cntId('c', c)}"><span class="name">${esc(catLabel(c))}</span><span class="cnt" id="${cntId('c', c)}" data-cnt="c:${esc(c)}" aria-hidden="true">0</span></button>`,
    )
    .join('');
}

function syncControls() {
  els.q.value = state.q;
  els.clear.hidden = !state.q;
  for (const box of els.fRetailers.querySelectorAll('input')) box.checked = state.retailers ? state.retailers.has(box.value) : true;
  for (const chip of els.fCategories.querySelectorAll('.chip')) chip.setAttribute('aria-pressed', String(state.categories.has(chip.dataset.cat)));
  els.fStock.checked = state.stock;
  els.fSale.checked = state.sale;
  els.fMin.value = state.min === null ? '' : String(state.min);
  els.fMax.value = state.max === null ? '' : String(state.max);
  els.sort.value = state.sort;
  for (const b of els.viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
  const n = activeFilterCount();
  els.filtersBadge.hidden = n === 0;
  els.filtersBadge.textContent = String(n);
}

function updateFacets(facets) {
  for (const el of els.fRetailers.querySelectorAll('[data-cnt]')) {
    const key = el.dataset.cnt.slice(2);
    const n = facets.retailer[key] || 0;
    el.textContent = fmtInt(n);
    el.setAttribute('aria-label', `${fmtInt(n)} ${plural(n, 'result')}`); // read via aria-describedby
    el.closest('.check').classList.toggle('is-empty', n === 0);
  }
  for (const el of els.fCategories.querySelectorAll('[data-cnt]')) {
    const key = el.dataset.cnt.slice(2);
    const n = facets.category[key] || 0;
    el.textContent = fmtInt(n);
    el.setAttribute('aria-label', `${fmtInt(n)} ${plural(n, 'result')}`);
    el.closest('.chip').classList.toggle('is-empty', n === 0);
  }
  const brands = Object.entries(facets.brand);
  if (state.brand && !facets.brand[state.brand]) brands.push([state.brand, 0]);
  brands.sort((a, b) => index.brandNames[a[0]].localeCompare(index.brandNames[b[0]]));
  const sig = `${state.brand}|${brands.map(([k, n]) => `${k}:${n}`).join(',')}`;
  if (sig !== lastBrandSig) {
    lastBrandSig = sig;
    // no count on "All brands": unbranded products are not in any brand bucket, so a sum would
    // never equal the listing count in the header
    els.fBrand.innerHTML =
      '<option value="">All brands</option>' +
      brands.map(([k, n]) => `<option value="${esc(k)}">${esc(index.brandNames[k])} (${fmtInt(n)})</option>`).join('');
    els.fBrand.value = state.brand;
  }
}

// ---------- rendering ----------

function mediaHtml(image, cls) {
  const img = safeUrl(image);
  if (!img) return `<div class="${cls} no-image"><span class="ph" aria-hidden="true">🤿</span></div>`;
  return `<div class="${cls}"><img ${imgSrcAttrs(img, IMG_SIZES[cls] || '100vw')} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="400" height="300"></div>`;
}

function priceHtml(p) {
  const from = p.pr && p.pr[0] < p.pr[1] ? '<span class="from">from </span>' : '';
  let out = `<span class="price">${from}${money(p.p)}</span>`;
  const pct = discountPct(p);
  if (pct >= 1) out += ` <s class="rrp" title="RRP">${money(p.cp)}</s> <span class="disc">-${pct}%</span>`;
  return out;
}

const stockHtml = (p) => `<span class="badge ${p.s ? 'in' : 'out'}">${p.s ? 'In stock' : 'Out of stock'}</span>`;

function actionsHtml(p) {
  const url = safeUrl(p.u);
  const liveTarget = liveUrl(p);
  const live = liveTarget ? `<button type="button" class="live" data-url="${esc(liveTarget)}">Check live</button><span class="live-result" aria-live="polite"></span>` : '';
  const view = url
    ? `<a class="view" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="View at ${esc(retailerName(p.r))} (opens in new tab)">View</a>`
    : '';
  return `${live}<span class="spacer"></span>${view}`;
}

function offerHtml(o, group, cheapest, cheapestInStock) {
  const differs = o.t !== group.title;
  const badge = cheapest ? '<span class="badge cheapest">Cheapest</span>' : cheapestInStock ? '<span class="badge cheapest-stock">Cheapest in stock</span>' : '';
  return `<li class="offer${cheapest ? ' is-cheapest' : ''}">
    <div class="offer-main"><span class="retailer" title="${esc(o.t)}">${esc(retailerName(o.r))}</span>${priceHtml(o)}</div>
    ${differs ? `<div class="offer-title muted">${esc(o.t)}</div>` : ''}
    <div class="offer-foot">${badge}${stockHtml(o)}${actionsHtml(o)}</div>
  </li>`;
}

function cardHtml(g) {
  let save = '';
  if (g.retailers >= 2) {
    save =
      g.spread > 0
        ? `<p class="save">Save ${money(g.spread)}${g.spreadPct >= 1 ? ` (${g.spreadPct}%)` : ''} vs dearest · ${g.retailers} retailers</p>`
        : `<p class="save none">Same price at ${g.retailers} retailers</p>`;
  } else if (g.listings >= 2) {
    save = `<p class="save none">${g.listings} listings at ${esc(retailerName(g.rep.r))}</p>`;
  }
  const showCheapest = g.offers.length > 1;
  // the ladder top is "Cheapest"; when it is out of stock, also flag the cheapest buyable offer
  const inStockDiffers = showCheapest && g.cheapestInStock && g.cheapestInStock !== g.cheapest;
  const offers = g.offers
    .map((o, i) =>
      offerHtml(o, g, showCheapest && o === g.cheapest, inStockDiffers && o === g.cheapestInStock).replace('<li class="offer', i >= MAX_OFFERS ? '<li class="offer is-extra' : '<li class="offer'),
    )
    .join('');
  const extra = g.offers.length - MAX_OFFERS;
  const moreOffers = extra > 0 ? `<button type="button" class="link-btn more-offers" data-more-offers>Show ${extra} more ${plural(extra, 'offer')}</button>` : '';
  return `<article class="card">
    ${mediaHtml(g.image, 'card-media')}
    <div class="card-body">
      <div class="card-meta">${g.brand ? `<span class="brand">${esc(g.brand)}</span>` : ''}${g.category ? `<span class="cat">${esc(catLabel(g.category))}</span>` : ''}</div>
      <h3 class="title">${esc(g.title)}</h3>
      ${save}
      <ol class="offers">${offers}</ol>${moreOffers}
    </div>
  </article>`;
}

function rowHtml(p) {
  return `<article class="row">
    ${mediaHtml(p.i, 'thumb')}
    <div class="row-body">
      <div class="card-meta">${p.b ? `<span class="brand">${esc(p.b)}</span>` : ''}${p.c ? `<span class="cat">${esc(catLabel(p.c))}</span>` : ''}<span class="retailer">${esc(retailerName(p.r))}</span></div>
      <h3 class="title">${esc(p.t)}</h3>
      <div class="row-price">${priceHtml(p)}${stockHtml(p)}</div>
    </div>
    <div class="row-actions">${actionsHtml(p)}</div>
  </article>`;
}

function renderMore() {
  const { items } = current;
  const start = current.rendered;
  const end = Math.min(items.length, start + PAGE);
  const html = new Array(end - start);
  for (let i = start; i < end; i += 1) html[i - start] = state.view === 'compare' ? cardHtml(items[i]) : rowHtml(items[i]);
  els.list.insertAdjacentHTML('beforeend', html.join(''));
  current.rendered = end;
  const remaining = items.length - end;
  els.more.hidden = remaining <= 0;
  if (remaining > 0) els.more.textContent = `Show ${Math.min(PAGE, remaining)} more (${fmtInt(remaining)} remaining)`;
}

function updateCount(results, items) {
  const q = state.q.trim();
  const n = results.length;
  let html;
  // the listing total and the partial-match note are hidden on phones (styles.css), where the
  // status row is a single line; the notice box repeats the partial-match explanation
  if (state.view === 'compare') html = `<strong>${fmtInt(items.length)}</strong> ${plural(items.length, 'product')}<span class="count-listings"> · ${fmtInt(n)} ${plural(n, 'listing')}</span>`;
  else html = `<strong>${fmtInt(n)}</strong> ${plural(n, 'listing')}`;
  if (q) html += ` <span class="for-q">for “${esc(q)}”</span>`;
  if (results.fallback) html += '<span class="count-partial"> (partial matches)</span>';
  els.count.innerHTML = html;
}

function updateNotice(results) {
  const tokens = results.tokens || [];
  if (results.fallback && tokens.length > 1) {
    els.notice.hidden = false;
    els.notice.innerHTML = `Nothing matches all of <strong>${esc(tokens.join(' '))}</strong> — showing products that match any of those words instead.`;
  } else {
    els.notice.hidden = true;
    els.notice.textContent = '';
  }
}

function renderEmpty(noRetailers) {
  const q = state.q.trim();
  let html = noRetailers
    ? '<p><strong>No retailers selected.</strong> Tick at least one retailer in the filters.</p>'
    : `<p><strong>No results${q ? ` for “${esc(q)}”` : ''}.</strong></p><p>Try fewer or shorter words (e.g. a model number), or loosen the filters.</p>`;
  html += '<p>';
  if (q) html += '<button type="button" class="btn secondary" data-action="clear-query">Clear search</button> ';
  if (activeFilterCount()) html += '<button type="button" class="btn secondary" data-action="reset-filters">Reset filters</button>';
  html += '</p>';
  els.empty.innerHTML = html;
  els.empty.hidden = false;
}

function runSearch() {
  if (!index) return;
  const key = JSON.stringify([
    state.q.trim(),
    state.retailers ? [...state.retailers].sort() : null,
    [...state.categories].sort(),
    state.brand,
    state.stock,
    state.sale,
    state.min,
    state.max,
    state.sort,
    state.view,
  ]);
  if (key === current.key) return;

  const t0 = performance.now();
  const noRetailers = Boolean(state.retailers && state.retailers.size === 0);
  const filters = {
    retailers: state.retailers,
    categories: state.categories.size ? state.categories : null,
    brand: state.brand,
    inStock: state.stock,
    onSale: state.sale,
    min: state.min,
    max: state.max,
  };
  const nonFacet = { inStock: state.stock, onSale: state.sale, min: state.min, max: state.max };
  const facetFiltersActive = Boolean(state.retailers || state.categories.size || state.brand);

  let results;
  if (noRetailers) {
    results = [];
    Object.defineProperty(results, 'fallback', { value: false });
    Object.defineProperty(results, 'tokens', { value: [] });
  } else {
    results = searchProducts(index, state.q, filters, state.sort);
  }
  // Facet counts reflect the query + stock/sale/price filters, but not the facet selections
  // themselves, so a retailer's count still shows how many hits it has when it is unticked.
  const facets = facetCounts(facetFiltersActive || noRetailers ? searchProducts(index, state.q, nonFacet, 'relevance') : results);

  let items;
  if (state.view === 'compare') {
    // The ladder shows every offer for a product from the selected retailers (in stock only when
    // asked). Sale/price/category/brand filters choose which products appear, not which offers —
    // otherwise "On sale only" would hide a cheaper non-sale offer and mislabel the cheapest shop.
    const poolPred = compileFilters({ retailers: state.retailers, inStock: state.stock });
    const pool = poolPred ? index.products.filter(poolPred) : index.products;
    items = sortGroups(groupResults(results, pool), state.sort);
  } else {
    items = results;
  }
  current = { key, items, results, rendered: 0, autoPages: 0 };
  const ms = performance.now() - t0;
  console.debug(`search "${state.q}" → ${results.length} listings / ${items.length} items in ${ms.toFixed(1)}ms`);

  updateFacets(facets);
  updateCount(results, items);
  updateNotice(results);
  els.list.className = `cards${state.view === 'list' ? ' is-list' : ''}`;
  els.list.innerHTML = '';
  els.list.setAttribute('aria-busy', 'false');
  els.error.hidden = true;
  if (items.length === 0) {
    renderEmpty(noRetailers);
    els.more.hidden = true;
  } else {
    els.empty.hidden = true;
    renderMore();
  }
  const n = activeFilterCount();
  els.filtersBadge.hidden = n === 0;
  els.filtersBadge.textContent = String(n);
  writeUrl();
}

// ---------- live price check (Shopify product JSON, CORS-enabled stores) ----------

async function liveCheck(btn) {
  const url = btn.dataset.url;
  const out = btn.nextElementSibling;
  if (!url || !out) return;
  btn.disabled = true;
  btn.textContent = 'Checking…';
  out.className = 'live-result';
  out.textContent = '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException(`Timed out after ${LIVE_TIMEOUT_MS / 1000} s`, 'TimeoutError')), LIVE_TIMEOUT_MS);
  try {
    const target = `${url}.js`; // data-url is already the canonical origin + /products/<handle> from liveUrl()
    const res = await fetch(target, { mode: 'cors', credentials: 'omit', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const variants = Array.isArray(j.variants) ? j.variants : [];
    const priced = variants.filter((v) => Number.isFinite(Number(v.price)));
    const avail = priced.filter((v) => v.available);
    const pool = avail.length ? avail : priced;
    const cents = pool.length ? Math.min(...pool.map((v) => Number(v.price))) : Number(j.price);
    if (!Number.isFinite(cents)) throw new Error('no price in response');
    const available = typeof j.available === 'boolean' ? j.available : avail.length > 0;
    out.textContent = `Live: ${money(cents / 100)} · ${available ? 'in stock' : 'out of stock'} · just now`;
    out.className = 'live-result ok';
    btn.textContent = 'Re-check';
  } catch (err) {
    out.textContent = 'couldn’t check';
    // browsers without abort reasons report a bare AbortError ("signal is aborted without reason")
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    out.title = timedOut ? `timed out after ${LIVE_TIMEOUT_MS / 1000} s — try again` : err && err.message ? String(err.message) : '';
    out.className = 'live-result err';
    btn.textContent = 'Check live';
  } finally {
    clearTimeout(timer);
    btn.disabled = false;
  }
}

// ---------- footer ----------

function renderFooter() {
  const tbody = els.retailersTable.querySelector('tbody');
  if (!meta || !Array.isArray(meta.retailers)) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted">Retailer status unavailable (meta.json did not load).</td></tr>';
    return;
  }
  tbody.innerHTML = meta.retailers
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((r) => {
      const status = ['ok', 'stale', 'failed'].includes(r.status) ? r.status : 'failed';
      const home = safeUrl(r.homepage);
      const name = home ? `<a href="${esc(home)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>` : esc(r.name);
      const when = r.fetchedAt ? `<time datetime="${esc(r.fetchedAt)}" title="${esc(new Date(r.fetchedAt).toLocaleString('en-AU'))}">${relTime(r.fetchedAt)}</time>` : '—';
      let extra = '';
      if (status !== 'ok' && r.staleSince) extra += `<span class="err">data from ${relTime(r.staleSince)}</span>`;
      if (status !== 'ok' && r.error) extra += `<span class="err">${esc(r.error)}</span>`;
      return `<tr class="${status}"><td>${name}</td><td class="num">${fmtInt(r.count)}</td><td>${when}</td><td><span class="badge ${status}">${status}</span>${extra}</td></tr>`;
    })
    .join('');
}

function renderUpdated() {
  if (!data) return;
  const iso = data.generatedAt;
  const age = Date.now() - Date.parse(iso || '');
  els.updated.innerHTML = iso
    ? `data updated <time datetime="${esc(iso)}" title="${esc(new Date(iso).toLocaleString('en-AU'))}">${relTime(iso)}</time>`
    : '';
  els.updated.classList.toggle('is-old', Number.isFinite(age) && age > 3 * 86400e3);
}

// ---------- events ----------

function readRetailerBoxes() {
  const boxes = [...els.fRetailers.querySelectorAll('input')];
  const on = boxes.filter((b) => b.checked).map((b) => b.value);
  state.retailers = on.length === boxes.length ? null : new Set(on);
}

function resetFilters() {
  state.retailers = null;
  state.categories = new Set();
  state.brand = '';
  state.stock = false;
  state.sale = false;
  state.min = null;
  state.max = null;
  syncControls();
  runSearch();
}

function bindEvents() {
  const onQuery = debounce(() => {
    state.q = els.q.value;
    runSearch();
  }, SEARCH_DEBOUNCE_MS);
  els.q.addEventListener('input', () => {
    els.clear.hidden = !els.q.value;
    onQuery();
  });
  els.q.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.q.value) {
      els.q.value = '';
      els.clear.hidden = true;
      state.q = '';
      runSearch();
    }
  });
  els.q.closest('form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = els.q.value;
    runSearch();
  });
  els.clear.addEventListener('click', () => {
    els.q.value = '';
    els.clear.hidden = true;
    state.q = '';
    runSearch();
    els.q.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      els.q.focus();
      els.q.select();
    }
  });

  els.filtersToggle.addEventListener('click', () => {
    const open = els.filters.dataset.collapsed === 'true';
    els.filters.dataset.collapsed = String(!open);
    els.filtersToggle.setAttribute('aria-expanded', String(open));
  });
  els.reset.addEventListener('click', resetFilters);

  els.fRetailers.addEventListener('change', () => {
    readRetailerBoxes();
    runSearch();
  });
  els.filters.addEventListener('click', (e) => {
    const all = e.target.closest('[data-retailers]');
    if (all) {
      const on = all.dataset.retailers === 'all';
      for (const b of els.fRetailers.querySelectorAll('input')) b.checked = on;
      readRetailerBoxes();
      runSearch();
      return;
    }
    const chip = e.target.closest('.chip[data-cat]');
    if (chip) {
      const c = chip.dataset.cat;
      if (state.categories.has(c)) state.categories.delete(c);
      else state.categories.add(c);
      chip.setAttribute('aria-pressed', String(state.categories.has(c)));
      runSearch();
    }
  });
  els.fBrand.addEventListener('change', () => {
    state.brand = els.fBrand.value;
    runSearch();
  });
  els.fStock.addEventListener('change', () => {
    state.stock = els.fStock.checked;
    runSearch();
  });
  els.fSale.addEventListener('change', () => {
    state.sale = els.fSale.checked;
    runSearch();
  });
  const onPrice = debounce(() => {
    state.min = numOrNull(els.fMin.value);
    state.max = numOrNull(els.fMax.value);
    runSearch();
  }, PRICE_DEBOUNCE_MS);
  els.fMin.addEventListener('input', onPrice);
  els.fMax.addEventListener('input', onPrice);

  els.sort.addEventListener('change', () => {
    state.sort = SORTS.includes(els.sort.value) ? els.sort.value : 'relevance';
    runSearch();
  });
  for (const b of els.viewButtons) {
    b.addEventListener('click', () => {
      if (state.view === b.dataset.view) return;
      state.view = b.dataset.view;
      for (const x of els.viewButtons) x.setAttribute('aria-pressed', String(x === b));
      runSearch();
    });
  }

  els.more.addEventListener('click', () => {
    current.autoPages = 0;
    renderMore();
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((en) => en.isIntersecting) || els.more.hidden) return;
        if (current.autoPages >= AUTO_PAGES) return;
        current.autoPages += 1;
        renderMore();
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(els.more);
  }

  els.list.addEventListener('click', (e) => {
    const btn = e.target.closest('button.live');
    if (btn) {
      liveCheck(btn);
      return;
    }
    const more = e.target.closest('[data-more-offers]');
    if (more) {
      const ol = more.previousElementSibling;
      if (ol) ol.classList.add('is-open');
      const first = ol && ol.querySelector('.offer.is-extra .view, .offer.is-extra button');
      more.remove();
      if (first) first.focus();
    }
  });

  // keep the sticky sidebar clear of the (variable-height) sticky header
  const header = document.querySelector('.site-header');
  const setHeaderH = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  setHeaderH();
  if ('ResizeObserver' in window) new ResizeObserver(setHeaderH).observe(header);
  else window.addEventListener('resize', setHeaderH);
  // image load failures: swap in the placeholder (capture phase, error doesn't bubble)
  els.list.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img && img.tagName === 'IMG' && img.parentElement) img.parentElement.classList.add('is-broken');
    },
    true,
  );
  els.empty.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'clear-query') {
      els.q.value = '';
      els.clear.hidden = true;
      state.q = '';
      runSearch();
      els.q.focus();
    } else if (b.dataset.action === 'reset-filters') {
      resetFilters();
    }
  });
  els.error.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="retry"]')) load();
  });

  window.addEventListener('popstate', () => {
    if (!index) return;
    readUrl();
    validateState();
    syncControls();
    runSearch();
  });
  setInterval(renderUpdated, 60000);
}

// ---------- boot ----------

function showLoadError(err) {
  els.list.innerHTML = '';
  els.list.setAttribute('aria-busy', 'false');
  els.more.hidden = true;
  els.count.textContent = 'Could not load products';
  els.error.hidden = false;
  els.error.innerHTML = `<p><strong>Couldn't load the product index.</strong></p>
    <p><code>${esc(err && err.message ? err.message : err)}</code></p>
    <p>If you are running this locally, generate the data first with <code>npm run scrape</code>, then serve the folder with <code>npm run serve</code>.</p>
    <p><button type="button" class="btn" data-action="retry">Retry</button></p>`;
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function load() {
  els.error.hidden = true;
  els.count.textContent = 'Loading products…';
  const metaLoad = fetchJson('data/meta.json').catch((err) => {
    console.warn(err);
    return null;
  });
  try {
    const p = await fetchJson('data/products.json');
    if (!p || !p.products || typeof p.products !== 'object') throw new Error('data/products.json has no products');
    data = p;
    const t0 = performance.now();
    data.products = inflateIndex(p); // the file's compact per-retailer form -> flat product records
    index = buildIndex(data.products);
    console.debug(`indexed ${data.products.length} products in ${(performance.now() - t0).toFixed(1)}ms`);
  } catch (err) {
    console.error(err);
    showLoadError(err);
    meta = await metaLoad; // the retailer table can still render (or say meta.json is unavailable)
    renderFooter();
    return;
  }
  meta = await metaLoad;
  validateState();
  buildFilterControls();
  syncControls();
  renderUpdated();
  renderFooter();
  current.key = '';
  runSearch();
}

readUrl();
els.q.value = state.q;
els.clear.hidden = !state.q;
bindEvents();
document.documentElement.dataset.app = 'ready'; // see the boot-error handler in index.html
load();
