# Sydney Dive Operator Calendar

One page that shows what's on at six Sydney dive operators — month grid or agenda list, filter by operator, click an event for details and a booking link.

| Operator | Calendar system | Scraped from |
|---|---|---|
| Abyss Scuba Diving | DiveShop360 storefront | `abyss.com.au/ajax/*_group_calendar` (courses, charters, trips) |
| Frog Dive Sydney | Event Calendar App (Shopify embed) | `api.eventcalendarapp.com/events` |
| Dive Bondi | Rezdy booking widget | `divebondi.rezdy.com/productsMonthlyCalendar/597076` |
| Dive Centre Manly (divesydney.com.au) | Rezdy booking widget | `divecentremanly50.rezdy.com/productsMonthlyCalendar/494484` |
| ProDive Sydney | Classic ASP, server-rendered | `prodive.com.au/Calendar.asp?Scubadive=Sydney` |
| Sydney Dive Charters | Checkfront booking portal | `sydneydivecharters.checkfront.com/reserve/api/?call=calendar_full` per item |

## How it works

```
GitHub Action (every 6 h, or run locally)
  └─ scraper/build.py  →  fetches all 6 sites, normalises to one schema
       └─ data/events.json  (+ data/events.js fallback for file:// use)
            └─ index.html + assets/app.js render it — no backend, no build step
```

Static files only. The webapp fetches `data/events.json` from its own origin, so there are no CORS issues and page loads are instant. Of the six sites, only Frog Dive's calendar API allows cross-origin browser requests — the others block them — which is why the data is pre-fetched instead of fetched live from the browser (see "Live client-side fetching" below).

## Run it locally

```bash
pip3 install -r scraper/requirements.txt
python3 scraper/build.py        # a few minutes: fetches all six calendars politely
python3 -m http.server 8000     # then open http://localhost:8000
```

(Double-clicking `index.html` also works — the app falls back to `data/events.js` when `fetch()` is unavailable over `file://`.)

## Deploy free on GitHub Pages

1. Push this folder to a GitHub repo.
2. **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. **Actions** tab → enable workflows. `update-calendar.yml` re-scrapes every 6 hours and commits `data/events.json` only when events actually changed; each commit redeploys Pages automatically. Use *Run workflow* for a manual refresh.

## Using the app

- **Filter chips** toggle operators; the count is events this month. **Search** filters by title/location/description.
- **Hide events**: click an event → the eye-off icon in the popup header hides every event with that title from that operator (e.g. spammy gear-hire listings). The eye button in the page header (badge = active hides) reviews and restores them, and also takes regex hide patterns scoped per operator. Stored in localStorage.
- **Theme button** cycles Auto (follow OS) → Light → Dark.
- **Keyboard**: ←/→ change month, `t` jumps to today.

## Configuration

- **Months covered**: current month + 4 by default. `MONTHS_AHEAD=6 python3 scraper/build.py` (or edit the env in the workflow). Most operators publish 3–8 months ahead.
- **Colours / names**: operator names live in each `scraper/sources/*.py`; colours in `assets/styles.css` (`--c-<id>`) keyed by source id.
- **Refresh cadence**: edit the cron in `.github/workflows/update-calendar.yml`.

## Adding a dive operator

Create `scraper/sources/<id>.py` exposing `ID`, `NAME`, `SHORT`, `URL` and `fetch(window) -> list[Event]` (see `common.py` for the `Event` fields), register it in `scraper/sources/__init__.py`, and add a `--c-<id>` colour + `.src-<id>` rule in `assets/styles.css` and the id in `KNOWN` in `assets/app.js`.

## Live client-side fetching instead?

A fully client-side version (no GitHub Action) is possible by routing the four CORS-blocked sites through a proxy such as cors.sh, but it means slower loads, a third-party dependency with rate limits, every visitor re-hitting the dive centres' servers, and re-implementing the four parsers in JS (two of them parse HTML). The pre-built JSON keeps the webapp static-only, loads instantly, and hits each centre ~4×/day total. Frog Dive's API could be fetched live from the browser today if fresher data for that one centre ever matters.

r.jina.ai is another option in this space: it renders pages through its own browsers (verified to get past Rezdy's WAF) and returns CORS-enabled markdown, but it is GET-only — it cannot drive Rezdy's POST month navigation — and the keyless tier is 20 req/min. Useful as a break-glass fallback (e.g. if GitHub-runner curl ever gets blocked by Rezdy, current-month data is still reachable via `https://r.jina.ai/<url>`), not as the pipeline.

## API assessment (2026-07, so we don't re-litigate)

- **Abyss / DiveShop360**: no JSON/ICS/API exists — their own page harvests the widgets' HTML client-side. The vendor (ds360.biz) has no developer API. The `/ajax/*` endpoints are the only machine-readable source; note `robots.txt` disallows `/ajax/` — acceptable for low-volume personal use (~8 req/run, 2.5 s apart, 429-aware), but don't crank the cron.
- **Rezdy**: official Supplier API (100 calls/min) exists but needs each shop to issue a key — realistic to ask a friendly shop, not assumed. Verified unofficial `POST /availabilityAjax` (`showdate`, `productId`, `quantity`) returns clean JSON with seats + prices per product — good future enrichment, but it's per-product (~35 products × months = too many calls to be the primary feed). The monthly-calendar endpoint stays.
- **ProDive / DiveEngine**: CodeCharge-generated classic ASP; no API, no feeds, and the "Next 30" page size is hard-coded (all page-size params tested → byte-identical responses). Pagination by `From_Date` is the only way.
- **Frog Dive / Event Calendar App**: already the clean case — open JSON API with CORS `*`.
- **Sydney Dive Charters / Checkfront**: the WP site sits behind Cloudflare bot management (drops curl and `HeadlessChrome` UAs), but the hosted portal `sydneydivecharters.checkfront.com` answers plain httpx. No public bulk feed: `calendar_full` returns one month-grid of 0/1 availability per call regardless of the range asked, so the scraper walks item × month (~150 small cached JSON calls per run at 0.7 s pacing — the same calls their own widget fires per visitor). Their Elfsight homepage calendar widget is over its view quota (`APP_VIEWS_LIMIT_REACHED`), so the booking portal is also the only working calendar they have. checkfront.com robots.txt only throttles AI-crawler UAs; `/reserve/` isn't disallowed. Trip schedule is encoded in item names ("Saturday - Double Boat Dives - Departing 1230pm …"): weekday prefixes are stripped for display, start times parsed from the name. Non-trip categories (hire, gift certificates, retail, packages), "Private …" on-request items, and anything bookable on >85% of window days (on-demand stock) are excluded.

## Notes & fair use

- Requests are indistinguishable from a real Chrome at the header level: consistent UA + `sec-ch-ua` client hints on every request, full `Accept-Encoding: gzip, deflate, br, zstd` (brotli/zstandard installed), and per-request-type metadata — document navigations send the HTML `Accept` + `Sec-Fetch-Mode: navigate` (+ referer chain when paginating ProDive), AJAX calls send `Accept: */*`, `Sec-Fetch-Mode: cors`, correct `Origin`/`Referer` (same-origin for the Rezdy/Abyss widgets, cross-site for Frog Dive's API) and `X-Requested-With` where the site's own jQuery sends it. Cookies persist per run (httpx session; curl cookie jar for Rezdy). Bump `CHROME_MAJOR` in `scraper/common.py` occasionally — a stale UA is a bot signal. TLS fingerprints are the one thing headers can't fix; that's the curl story above.
- The scraper sleeps ~1.2 s between paginated requests (2.5 s for Abyss, 0.7 s for Checkfront's cached JSON) and makes ~20 requests per full refresh across the first five sites plus ~150 tiny per-item calendar calls to Checkfront's API. On HTTP 429/503 it honours `Retry-After` (else backs off 20/40/60 s, capped at 120 s) before retrying; other 4xx fail fast.
- Some quirks are handled per site: Rezdy's `MM-DD-YYYY` day keys and session ids stripped from booking URLs; Abyss's drifting widget/group ids re-discovered each run; ProDive's page-boundary duplicates deduped by ScheduleID; Frog Dive's placeholder prices ignored.
- The two Rezdy sources are fetched through the **system `curl`** (present on macOS and GitHub runners): Rezdy's AWS WAF fingerprints the TLS client and answers Python HTTP stacks with a 405/human-verification page, while curl over HTTP/2 passes. Everything else uses `httpx`.
- All times are Australia/Sydney. This is an unofficial aggregator for personal use — always confirm details and book with the dive centre.
