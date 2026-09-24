# dive-gear-search

A static price-comparison search for scuba gear sold by Australian online dive shops.
One search box, every retailer at once, and when the same product is found in more than one
shop it is grouped so the cheapest price is obvious.

There is no server. A GitHub Actions workflow scrapes each shop's public catalogue once a week,
merges everything into one JSON file and commits it; GitHub Pages serves this folder, like the
other apps in the repository, at https://glennmcgui.re/dive-gear-search/. The page does all
searching, filtering and sorting in the browser.

No npm dependencies anywhere: the scraper is plain Node.js (20+) ES modules, the front end is
plain HTML/CSS/JS.

## Retailers

Which retailers are indexed is decided by the modules in `scraper/retailers/`. One module per shop.

| Retailer | Key | Platform | How the catalogue is read |
|---|---|---|---|
| [Adreno](https://adreno.com.au/) | `adreno` | Shopify | `/products.json`, filtered to scuba/spearfishing/freediving product types (Adreno also sells surf and swim gear) |
| [Dive Bondi](https://divebondi.com.au/) | `divebondi` | Shopify | `/products.json` |
| [Dive Swansea](https://diveswansea.com.au/) | `diveswansea` | Shopify | `/products.json`; tags fill in the category where `product_type` is blank |
| [Frog Dive](https://www.frogdive.com.au/) | `frogdive` | Shopify | `/products.json` (the `/pages/scuba-diving-list` URL is a static landing page; the whole store is indexed) |
| [My Dive Gear](https://www.mydivegear.com.au/) | `mydivegear` | Shopify | `/products.json`; `product_type` is always "General", so the tags stand in for the category and a third of the catalogue (untagged) is classified from the title alone; the vendor is "Not specified" for a third of products and TUSA is listed as its distributor "Tabata Australia Pty Ltd" (both handled in `normalize.js`) |
| [Online Dive Gear](https://www.onlinedivegear.com.au/) | `onlinedivegear` | Shopify | `/products.json` |
| [Infinity Dive](https://infinitydive.com/) | `infinitydive` | Shopify | `/products.json`; `product_type` is a taxonomy path ("Sporting Goods:Scuba & Snorkelling:Masks") whose last segment is the category; courses, hire and swimwear are dropped or filed as clothing by the classifier |
| [Extreme Watersport Shop](https://extremewatersportshop.com/) | `extremewatersportshop` | Shopify | `/products.json` (clean product types; "Rental" and "Course" listings are dropped by the classifier) |
| [Perth Scuba](https://perthscuba.com/) | `perthscuba` | Shopify | `/products.json` |
| [Scuba Dive Shop](https://scubadiveshop.com.au/) | `scubadiveshop` | Shopify | `/products.json` (the vendor field is usually the shop itself, so the shared title-prefix brand rule does the work) |
| [Dive Gear Australia](https://divegearaustralia.com.au/) | `divegearaustralia` | WooCommerce | public Store API `/wp-json/wc/store/v1/products` (the only path not behind the site's Cloudflare challenge), plus per-variation prices for products whose variants differ in price; throttled to one request every 1.5 s (~170 requests, 4-5 minutes). **Not indexed:** the shop's ~65 build-your-own scuba and snorkelling *packages* (WooCommerce "composite" products): the API carries no price for them and the page that does is Cloudflare-challenged |
| [Gold Coast Dive Adventures](https://goldcoastdiveadventures.com.au/) | `goldcoastdiveadventures` | WooCommerce | public Store API, one page (a dive charter with a ~36-product gear shop); its "Fave gear" staff-picks category is treated as merchandising |
| [Tec Dive Gear](https://www.tecdivegear.com.au/) | `tecdivegear` | custom (legacy PHP) | no JSON feed: category pages are parsed for the product list, then one HTML product page per item for brand, SKU, sizes and availability (~530 requests, about 2 minutes) |
| [The Scuba Doctor](https://www.scubadoctor.com.au/diveshop/) | `scubadoctor` | Zen Cart | the shop's own JSON search endpoint (`POST /diveshop/ajax_search.php`) pages the whole catalogue in ~51 requests, each row a product family with every size/colour as a variant. Cloudflare blocks Node's `fetch` on this host by TLS fingerprint, so the module falls back to the system `curl --http1.1` with the same User-Agent and rate limit; if the GitHub Actions runner's curl is blocked too, the run keeps the previously published data (see *Data freshness*) |

`data/meta.json` (and the footer of the site) records, per retailer, when it was last fetched and
whether that run was `ok`, `stale` (previous data kept) or `failed`.

## How it works

```
GitHub Actions  (weekly, Monday ~04:23 AEST / 05:23 AEDT, or run by hand;
 |               .github/workflows/update-dive-gear-search.yml at the repository root)
 |- npm test
 |- node scraper/index.js
 |     |- scraper/retailers/<key>.js  -> data/retailers/<key>.json   (all shops fetched in parallel,
 |     |                                                              each shop rate-limited separately)
 |     `- scraper/build.js            -> data/products.json           (one compact record per product)
 |                                       data/meta.json               (per-retailer status + totals)
 `- commit data/ and push; GitHub Pages redeploys the branch

Browser
 `- index.html downloads data/products.json once (~4 MB, ~1 MB compressed on the wire: ~17.9k
    listings in ~12.8k product groups), expands it into product records and does search / brand /
    category / price / in-stock filtering and sorting locally
```

### Why the search isn't live

The page never searches a retailer directly. A script on `github.io` is blocked by the browser's
same-origin policy from reading most of the shops (they don't send `Access-Control-Allow-Origin`
headers, and Cloudflare challenges non-browser clients on some of them), and a live search would hit
fourteen shops on every keystroke anyway. So the fetching happens once a week on a GitHub Actions runner,
where there is no browser and no CORS, and the site only ever loads its own JSON. Prices are therefore
up to a week old; the exact time is in the header and the footer.

The one exception is the **Check live** button on offers from Shopify stores: Shopify's
`/products/<handle>.js` endpoint does allow cross-origin reads, so the page can re-fetch that one
product's current price and stock on demand (pinned to Australian pricing, wherever the viewer is).

### Repository layout

```
index.html, assets/       the web app (static, relative paths, works from any sub-path)
scraper/index.js          orchestrator: runs the retailer modules, then build.js
scraper/build.js          merges data/retailers/*.json -> data/products.json + data/meta.json
scraper/retailers/*.js    one module per shop
scraper/lib/product.js    makeProduct(): the Product record every module must return; parsePrice()
scraper/lib/shopify.js    shopifyRetailer(): a complete module for any Shopify store in one call
scraper/lib/woocommerce.js wooRetailer(): the same for any WooCommerce shop with the public Store API
scraper/lib/http.js       fetch with UA, timeout, retries/backoff and per-host rate limiting
scraper/lib/html.js       regex/JSON-LD helpers for shops that only expose HTML
scraper/lib/normalize.js  brand aliases, category classifier, title tokeniser, similarity
scraper/lib/pack.js       the on-disk form of data/*.json (see *Data files*) and its inverse
scraper/test/             node --test unit tests
data/                     generated by the workflow and committed
../.github/workflows/update-dive-gear-search.yml   the weekly workflow (repository root)
```

### Data files

Both files are committed after every run, so they are written to diff well: one record per line,
in a fixed order (retailer key, then id), with everything derivable left out. `scraper/lib/pack.js`
writes them and reads them back; nothing else in the code sees the compact form.

`data/products.json` is what the browser downloads:

```
{
"generatedAt":"2026-09-21T02:12:12.353Z",
"retailers":{
"adreno":{"name":"Adreno","homepage":"https://adreno.com.au/","platform":"shopify","live":true,"u":"https://adreno.com.au/products/","i":"https://cdn.shopify.com/s/files/1/2218/1285/files/"},
...
},
"brands":{
"apeks":"Apeks",
...
},
"products":{
"adreno":[
{"id":"7032578932870","t":"BigBlue HL1000XWN Changeable Focus Waterproof Headmounted Dive Torch","bn":"big blue","c":"torch","rc":"LIGHTING - TORCHES","p":229.99,"u":"bigblue-hl1000xwn-changeable-focus-waterproof-headmounted-dive-torch","i":"HL1000XWN_Bigblue-HL1000XWN.jpg"},
...
```

Products sit under their retailer key and carry the source id only. Each retailer's common URL
and image prefix is stored once (`u`, `i` in `retailers`) and every record keeps what follows it.
`brands` maps a canonical brand (`bn`) to its display name so records don't repeat it. Fields at
their default are left out: `s` when in stock, `cp` when there is no compare-at price, `i` when
there is no image, `k` / `rc` / `bn` when empty, `b` when it is the brand table's spelling, `g` when
the product is in no group. `inflateIndex()` in `assets/search.js` expands all this into one flat
record per product with the short keys documented at the top of `scraper/build.js`
(`id r t b bn c rc p cp s u i k g pr dp`; `g` is the group id, `p` the price in AUD, `cp` the
compare-at/RRP price). A group is named after the smallest id among its members, so a product
added or removed elsewhere never renumbers the others.

`data/retailers/<key>.json` is each shop's raw catalogue as the scraper last saw it (`"format":2`),
stored the same way (`base` holds the two prefixes; `description` is not kept because nothing reads
it). It is what the build merges and what a failed scrape falls back to.

## Local development

Requires Node.js 20 or newer (the workflow uses 22) and, for serving the page, Python 3. Run
these from this folder (`cd dive-gear-search`):

```sh
npm test                                   # unit tests (node --test), no install step needed
node scraper/index.js                      # scrape every retailer, then build data/*.json
node scraper/index.js --only adreno        # one retailer (comma-separate for several)
npm run scrape:one adreno                  # the same via npm
node scraper/index.js --no-build           # scrape only
node scraper/build.js                      # rebuild the index from data/retailers/*.json
python3 -m http.server 8080                # then open http://localhost:8080/
```

The page must be served over HTTP: it loads ES modules and fetches JSON, which browsers refuse
from `file://`. Serving from the repository root instead puts it at
http://localhost:8080/dive-gear-search/.

A full scrape takes about five minutes (Tec Dive Gear is fetched page by page, Dive Gear Australia
is throttled to one request every 1.5 s). `data/` is committed, so a fresh clone already has the
last published data and the page works without scraping; a local scrape overwrites it, and
`git checkout -- data` puts the published data back.

A failed scrape reuses the `data/retailers/<key>.json` already there. Add
`--previous-url https://glennmcgui.re/dive-gear-search` to fetch the deployed data instead when
there is no local file. The exit code is 0 when at least one retailer in the run came
back `ok` and 1 when none did (every one `stale` or `failed`), so `--only <key>` on a shop that
is down exits 1 even though its previous data was kept; the log line for the retailer says which.

## Deployment

This folder is part of the `glem0.github.io` user site, which GitHub Pages serves straight from
the `main` branch, so there is no build or deploy step of its own. The workflow
`.github/workflows/update-dive-gear-search.yml` at the repository root runs the scraper on a
schedule and commits `data/`:

```sh
gh workflow run update-dive-gear-search.yml   # run it now
gh run watch                                  # or: gh run list --workflow update-dive-gear-search.yml
```

Each run's Summary tab shows a per-retailer status table, and the commit message carries the totals.

- **Schedule.** `23 18 * * 0` UTC, which is Monday 04:23 AEST (April-October) or 05:23 AEDT
  (October-April) in Sydney. GitHub cron has no time-zone support and scheduled runs are
  sometimes delayed by several minutes or skipped under load; use `gh workflow run` if you need
  data now. Scheduled workflows are paused automatically after 60 days without a commit, which
  the repository's daily bot commits from the other apps prevent.
- **Permissions.** `contents: write`, the minimum needed to push the data commit. The push is
  retried with a rebase because the other scheduled workflows in the repository may push in between.
- **Concurrency.** Runs share the `update-dive-gear-search` group with `cancel-in-progress: false`,
  so a manual run during the weekly scrape waits instead of killing it.
- **Nothing to commit.** When no retailer returned fresh data the scraper exits 1, the job fails and
  nothing is committed, so the site keeps serving the previous week's data.

## Adding a retailer

Create `scraper/retailers/<key>.js` whose default export is:

```js
export default {
  key: 'myshop',                 // must equal the file name
  name: 'My Shop',               // display name
  homepage: 'https://myshop.com.au/',
  platform: 'custom',            // informational: 'shopify', 'woocommerce', 'custom', ...
  async fetch({ log }) {         // return Product[] built with makeProduct()
    // ...
  },
};
```

Every record must come from `makeProduct()` in `scraper/lib/product.js` so field types are
consistent (`id` becomes `<key>:<sourceId>`, prices are parsed to numbers, `price`/`inStock` are
derived from variants when not given, relative URLs are rejected). Use `fetchJson`/`fetchText` from
`scraper/lib/http.js` for every request so the rate limiter and User-Agent apply, and
`scraper/lib/html.js` (`extractJsonLd`, `metaContent`, `matchAll`, `sitemapLocs`, ...) when the
shop has no JSON feed. Nothing needs registering: the orchestrator loads every `*.js` in the
directory (files starting with `_` are ignored).

For a Shopify store the whole module is one call, because every Shopify storefront exposes
`/products.json?limit=250&page=N`:

```js
import { shopifyRetailer } from '../lib/shopify.js';

export default shopifyRetailer({ key: 'myshop', name: 'My Shop', homepage: 'https://myshop.com.au/' });
```

Optional `shopifyRetailer` settings: `base` (the store URL to read `/products.json` from and to
build product links on, when it differs from `homepage`), `collection` (index one collection
instead of the whole store), `keep(raw)` (drop non-dive products), `category(raw)` and
`brand(raw)` (override how the raw product maps to those fields). `scraper/retailers/adreno.js` uses `keep` and `category`.

A WooCommerce shop is one call too, as long as its public Store API (`/wp-json/wc/store/v1/products`)
answers; `scraper/lib/woocommerce.js` documents what the API gives and how prices, variants and
categories are read from it:

```js
import { wooRetailer } from '../lib/woocommerce.js';

export default wooRetailer({ key: 'myshop', name: 'My Shop', homepage: 'https://myshop.com.au/' });
```

Optional `wooRetailer` settings: `api` (when the Store API is not under the homepage), `rootSegment`
(the category tree's root slug, default `dive-gear`), `marketingSegment` (a RegExp of extra category
slugs to treat as merchandising, like Gold Coast Dive Adventures' `fave-gear`), `http` (rate-limit
overrides) and `skipVariationsEnv`. `scraper/retailers/divegearaustralia.js` keeps that shop's
Cloudflare notes on top of the same module.

Then:

```sh
node scraper/index.js --only myshop        # writes data/retailers/myshop.json, prints counts
npm test
```

Check the JSON for sensible titles, prices and URLs. If the shop's vendor names or category labels
are unusual, add aliases to `BRAND_ALIASES` / rules to `CATEGORY_RULES` in
`scraper/lib/normalize.js` and cover them in `scraper/test/normalize.test.js`. A run that returns
fewer than 15 products (or under 40% of the previous run) is treated as broken and the previous
data is kept; if there is no previous data yet the products are kept and the retailer is marked
`ok` with a warning in `meta.json` (see *Data freshness* below).

## How matching works

Grouping the same product across shops happens at build time in `scraper/build.js` and
`scraper/lib/normalize.js`, with no external data or machine learning.

1. **Brand normalisation.** The vendor string is lower-cased and looked up in an alias table
   (`Aqua Lung` / `Aqua-Lung` / `aqualung` -> `aqualung`, `Scuba Pro` / `Uwatec` -> `scubapro`,
   `Atomic` -> `atomic aquatics`, ...). Vendors that are really the shop's own name are discarded,
   and if no brand is left it is guessed from the start of the title.
2. **Category.** Each product gets one of ~27 coarse categories (`regulator`, `bcd`, `mask`,
   `dive computer`, `package`, `undergarment`, `spare part`, ...) from regex rules, tested against
   the title first (the part before `with` / `incl` first of all, so "Dive Computer with Textile
   Strap" is a computer), then the shop's own category, then its tags: a multi-noun shop label
   ("Hoods Boots Gloves & Socks") or a blanket tag ("Sport: Spearfishing" on every mask) only
   decides when the title says nothing. Courses, trips, services, gift cards, hire, second-hand
   items and merchandise that isn't dive gear (earrings, tumblers, bodyboards) are classified
   `exclude` and dropped from the index, as is anything without a price. Words that also name
   products are not enough on their own: a `nitrox` regulator, a `training` buoy, `repair`
   adhesive and a "Servicing" collection full of diaphragms stay in.
3. **SKU match.** Two products from *different* shops with the same brand (or both unbranded) and
   the same normalised SKU (letters and digits only, at least five characters including a digit) are
   the same product, unless the shop has plainly reused the SKU: the titles disagree on a bare
   number or short code (`Steel 27` vs `Steel 34`, `R195` vs `R095`) or the prices are more than
   3x apart.
4. **Title similarity.** Titles are tokenised (lower-case, accents and ™/® folded, hyphens joined so
   `X-Vision` = `X Vision`, letter/digit runs split so `XTX50` = `XTX 50`, spellings folded so
   `Closed-Circuit` = `Closed Circuit`, `Surface Marker Buoy` = `SMB`, `5/4/3mm` = `5x4x3mm` and
   `180cm` = `1.8m`, plus a few synonyms such as `reg` -> `regulator`, `occy` -> `octopus`,
   `straps` -> `strap`). Brand words, colours, sizes, gender words and stop words are removed,
   leaving the *model tokens*. Two products in the same brand bucket are compared with a Jaccard
   score over the non-generic tokens, with hard rules layered on top: any token containing a digit,
   and any *differentiator* word (`octopus`, `strap`, `battery`, `wing`, `housing`, `left`/`right`,
   `twin`, `hooded`, ...), must appear on both sides or the score is 0, and a mask/snorkel/fins set
   carries a token per included item so "Mask Snorkel Fin Set" is not "Snorkel & Fin Set". The
   categories must agree (a product classified `other` may pair with any category), men's/women's/
   kids' versions are kept apart, prices more than 3x apart never match, what follows `with` tells
   otherwise identical listings apart (`w/Snap Clip` vs `w/Pigtail Clip`), and cross-shop pairs need
   a score of at least 0.55 (0.9 within one shop, so a shop's colour variants merge but its distinct
   listings don't).
5. **Clustering** is complete-linkage: two groups merge only when *every* cross pair passes, which
   stops "A looks like B, B looks like C" chains from swallowing related but different models. The
   clusters formed by the SKU step take part as they are; a cross pair that fails on its own is
   tolerated only when a SKU twin of one side (same SKU, another shop) passes against the other, so
   a terse title (`Alpha 8 Occy`) rides on its SKU without letting title matches chain through the
   SKU cluster to unrelated products.

Groups are numbered with the multi-retailer ones first; the page uses the group id (`g`) to show the
cheapest price in a group alongside the others.

**Limits.** This is heuristic string matching, so expect some misses and a few false merges:

- Shops that omit the model code (`Scubapro regulator set` vs `Scubapro MK25 EVO / S620 Ti`) never
  match, and abbreviations not in the synonym list (`HP` vs `Hydros Pro`) don't either.
- Different generations sold under the same name (last year's model vs this year's) usually merge.
- A bundle (`mask + snorkel + fins`) is kept apart from its parts, but a shop that lists a
  regulator set as one product and another that lists first and second stages separately will not
  line up.
- The compared price is each shop's lowest available variant. When variants differ in price (sizes
  of a wetsuit, a computer with or without transmitter) the data carries a `pr` min/max range, but the
  cheapest variant at shop A may not be the same size as the cheapest at shop B.
- Products with no recognisable brand are bucketed by their first remaining title token (after
  brand, colour, size and stop words are removed), which is a much weaker signal, so unbranded
  items rarely group.

## Data freshness and fallback

- Data is rebuilt once a week (see *Schedule*), or whenever the workflow is run by hand. `data/meta.json`
  carries `generatedAt` and, per retailer, `fetchedAt`, `durationMs`, `status`, `count` and any
  `error`; the site footer shows the same.
- A retailer's `status` is `ok`, `stale` or `failed`. When a scrape throws (site down, Cloudflare,
  layout change) **or looks suspicious** (fewer than 15 products, or under 40% of the previous
  run's count, which is what a broken pagination or a bot block usually looks like) the
  orchestrator keeps the committed `data/retailers/<key>.json` from the last run and marks the
  retailer `stale` with `staleSince` set to the last good fetch. The previous data is the file in
  the checkout (the workflow's, or a developer's), or the live site's via `--previous-url` when
  there is none. Only if there is no previous data at all is the retailer `failed` with zero
  products.
- The workflow commits as long as at least one retailer succeeded. If no retailer returned fresh
  data (every one is `stale` or `failed`) the scraper exits 1 and nothing is committed, so the
  last good data stays online. When `--previous-url` is given and cannot be fetched the log says
  `<key>: previous data not available from <url>: ...`.
- **Currency.** Shopify Markets lets a shop answer in another currency, and with other prices,
  depending on the country a request comes from, and the GitHub runner is in the United States:
  Perth Scuba's whole catalogue came back in USD on the first scheduled run. Every Shopify request
  now carries `?country=AU&currency=AUD`, and `scraper/lib/shopify.js` first reads the store's own
  `Shopify.currency` marker under those parameters; a store that still answers in another currency
  is marked `stale` (previous data kept) instead of being published.
- The very first run has nothing to fall back to, so a retailer that fails then simply shows as
  `failed` until a later run succeeds, and a suspiciously small result (fewer than 15 products) is
  kept rather than discarded: the retailer is `ok` with `error: "warning: only N products"`.
- The site keeps working while the scraper is broken; it just gets older. If a retailer stays
  `stale` for weeks, the shop has probably changed something: run `node scraper/index.js --only
  <key>` locally, read the error, and fix the module.

## Respectful scraping

The scraper is designed to be a light, honest guest:

- **Public endpoints only.** Shopify's `/products.json`, WooCommerce's Store API and The Scuba
  Doctor's search endpoint are the storefronts' own public catalogue feeds. No logins, carts, checkout pages, customer data or anything behind a form is touched.
- **Rate-limited per host.** At most 2 requests in flight and at least 350 ms between request
  starts per shop (`scraper/lib/http.js`; Dive Gear Australia is throttled harder, one request
  every 1.5 s), 30 s timeouts covering the whole response (bodies are capped at 32 MB), and
  exponential backoff on 429/5xx that honours `Retry-After`.
  A full run is roughly a thousand requests, most of them Tec Dive Gear's
  one-page-per-product catalogue, once a week in the small hours Sydney time.
- **Looks like a browser.** Requests carry a current desktop Chrome user agent and the matching
  client-hint headers (`USER_AGENT` / `BROWSER_HEADERS` in `scraper/lib/http.js`; bump
  `CHROME_MAJOR` there now and then). The endpoints are the shops' own public catalogue feeds,
  fetched at a browser's pace or slower.
- **Caches instead of retrying hard.** Failures fall back to last week's data rather than
  hammering the site.
- **Removal.** If a shop asks not to be included, delete its module from `scraper/retailers/` and
  the next run drops it. Respecting each site's terms of use and `robots.txt` is the responsibility
  of whoever runs the workflow.

## Disclaimer

This is a personal, unofficial tool. It is not affiliated with, endorsed by, or maintained by any
of the retailers listed. Prices, stock levels and product details are copied from the shops'
public catalogues at scrape time and can be wrong, out of date, exclusive of shipping, or already
changed. **Always confirm the price and availability on the retailer's own site before buying.**
Product names and images belong to the respective retailers and manufacturers.

## License

[MIT](LICENSE).
