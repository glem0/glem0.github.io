#!/usr/bin/env python3
"""
GUE course-map updater — one script to keep schedule.json and geo.js up to date.

    python3 update_geo.py             Fetch the live GUE schedule, write schedule.json
                                      (the parsed class list the site renders — rebuilt
                                      from GUE's page each run, so it self-prunes), geocode
                                      any NEW locations (each verified by reverse-
                                      geocoding the coordinate back into the stated
                                      country before it is accepted), and rebuild
                                      geo.js. Obvious misspellings of already-known
                                      places ("High Springd") reuse the known
                                      coordinate instead of being geocoded blind.
    python3 update_geo.py --validate  Also audit every cached coordinate against the
                                      country named in its location and report mismatches.

Run daily by .github/workflows/update-gue-geo.yml, which commits any DB changes.

APPEND-ONLY DB: geocode_cache.json accumulates every location ever seen. Existing
entries (including hand-fixed ones) are never overwritten or pruned — the script only
adds new locations and retries ones that previously failed. So the coordinate database
gets more complete and robust over time. geo.js is rebuilt from the full cache each run.

Only dependencies: Python 3 stdlib + curl.
"""
import json, os, re, sys, time, html, subprocess, urllib.parse

SCHEDULE_URL = "https://www.gue.com/diver-training/gue-class-schedule?btn=1"
CACHE = "geocode_cache.json"
GEO_JS = "geo.js"
REV_CACHE = "reverse_cache.json"
SCHEDULE_JSON = "schedule.json"   # parsed schedule the site renders (no client scraping)
BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/121 Safari/537.36")
NOMINATIM_UA = "gue-course-map/1.0 (personal mapping project; contact glennmcguire9@gmail.com)"

# Country name (a location's last field) -> ISO2, used to VALIDATE that a geocode result
# actually lands in the right country (stops "PA, Mexico" -> Pennsylvania etc.).
C2 = {
 "germany":"de","united states":"us","usa":"us","mexico":"mx","méxico":"mx","italy":"it",
 "philippines":"ph","china":"cn","norway":"no","netherlands":"nl","canada":"ca","france":"fr",
 "spain":"es","egypt":"eg","croatia":"hr","poland":"pl","switzerland":"ch","indonesia":"id",
 "hungary":"hu","korea (south)":"kr","south korea":"kr","russia":"ru","japan":"jp","greece":"gr",
 "austria":"at","bonaire":"bq","cyprus":"cy","monaco":"mc","taiwan":"tw","united kingdom":"gb",
 "uk":"gb","malaysia":"my","thailand":"th","portugal":"pt","finland":"fi","sweden":"se",
 "singapore":"sg","malta":"mt","australia":"au","morocco":"ma","albania":"al","belgium":"be",
 "kuwait":"kw","uae":"ae","united arab emirates":"ae","ireland":"ie","denmark":"dk",
 "iceland":"is","turkey":"tr","israel":"il","brazil":"br","slovenia":"si","czechia":"cz",
 "new zealand":"nz","south africa":"za",
}
OK_ALT = {"bq": {"nl", "bq"}, "nl": {"nl", "bq"}}  # special territories


def canon(s):
    """Canonical location key: lowercased, whitespace-collapsed."""
    return re.sub(r"\s+", " ", s.strip().lower())


def curl(url, ua, timeout=30):
    return subprocess.run(["curl", "-sS", "--compressed", "--max-time", str(timeout),
                           "-H", "User-Agent: " + ua, url], capture_output=True, text=True)


# ---------------------------------------------------------------- fetch + parse
def fetch_schedule():
    # Direct first. gue.com sometimes rejects datacenter IPs (e.g. GitHub Actions
    # runners), so fall back to public mirrors that fetch it from their own network.
    # The CORS proxies' egress is datacenter too and often draws the same rejection,
    # so try r.jina.ai first among the mirrors — it renders pages in a real browser,
    # which gets a normal 200 where plain requests get the WAF's 202 stub.
    enc = urllib.parse.quote(SCHEDULE_URL, safe="")
    attempts = [
        ("direct", SCHEDULE_URL), ("direct", SCHEDULE_URL),
        ("jina", "https://r.jina.ai/" + SCHEDULE_URL),
        ("cors.sh", "https://proxy.cors.sh/" + SCHEDULE_URL),
        ("allorigins", "https://api.allorigins.win/raw?url=" + enc),
        ("codetabs", "https://api.codetabs.com/v1/proxy?quest=" + enc),
    ]
    for i, (name, url) in enumerate(attempts):
        timeout = "90" if name == "jina" else "40"  # jina renders, so it's slower
        cmd = ["curl", "-sS", "--compressed", "--http2", "--max-time", timeout,
               "-w", "%{stderr}HTTP %{http_code}, %{size_download} bytes",
               "-H", "User-Agent: " + BROWSER_UA,
               "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
               "-H", "Accept-Language: en-US,en;q=0.9"]
        if name == "direct":
            cmd += ["-H", "Referer: https://www.gue.com/diver-training"]
        elif name == "jina":
            cmd += ["-H", "x-respond-with: html"]  # rendered DOM, not markdown
        else:  # CORS proxies expect browser-shaped requests
            cmd += ["-H", "Origin: https://glennmcgui.re",
                    "-H", "Referer: https://glennmcgui.re/gue-course-map/"]
        p = subprocess.run(cmd + [url], capture_output=True, text=True)
        if p.returncode == 0 and "class-details" in p.stdout:
            if name != "direct":
                print(f"  (fetched via {name})")
            return p.stdout
        print(f"  fetch failed [{name}]: {p.stderr.strip()}")
        time.sleep(2 * (i + 1))
    print("ERROR: could not fetch the GUE schedule (direct and mirrors).", file=sys.stderr)
    sys.exit(3)  # distinct code: source unreachable — the workflow treats it as transient


MONTHS = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
          "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}


def _clean(s):
    """Strip tags, decode entities, collapse whitespace (mirrors the old in-browser parser)."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def _title(s):
    """Title Case so casing variants of an instructor collapse to one entry."""
    return re.sub(r"(^|[\s\-'])(\S)", lambda m: m.group(1) + m.group(2).upper(), s.lower())


def _iso(s):
    m = re.search(r"([A-Za-z]+)\s+(\d+),?\s+(\d{4})", s)
    mo = MONTHS.get(m.group(1).lower()) if m else None
    return f"{m.group(3)}-{mo:02d}-{int(m.group(2)):02d}" if mo else None


def parse_classes(page):
    """Schedule table -> class dicts in the exact shape the site renders."""
    out = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.I | re.S):
        if "class-details" not in row:
            continue
        tds = re.findall(r"<td[^>]*>(.*?)</td>", row, re.I | re.S)
        if len(tds) < 4:
            continue
        cid = re.search(r"cid=(\d+)", tds[0])
        iid = re.search(r"id=(\d+)", tds[3])
        date = _clean(tds[1])
        out.append({"cid": cid.group(1) if cid else None, "course": _clean(tds[0]),
                    "date": date, "iso": _iso(date), "location": _clean(tds[2]),
                    "instructor": _title(_clean(tds[3])),
                    "instructor_id": iid.group(1) if iid else None})
    out.sort(key=lambda c: (c["iso"] or "9999", c["course"], c["location"], c["instructor"]))
    return out


def write_schedule(classes):
    """Write schedule.json, but only when the class list actually changed — so
    check-only runs stay commit-free and 'updated' means 'data last changed'."""
    try:
        old = json.load(open(SCHEDULE_JSON))["classes"]
    except Exception:
        old = None
    if old == classes:
        print("Schedule unchanged.")
        return
    payload = {"updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
               "classes": classes}
    save_json(payload, SCHEDULE_JSON)
    print(f"schedule.json updated ({len(classes)} classes).")


# ---------------------------------------------------------------- geocoding
def expected_iso(loc):
    return C2.get(loc.split(",")[-1].strip().lower())


def nominatim(params):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        p = curl(url, NOMINATIM_UA)
        if p.returncode == 0 and p.stdout.strip():
            try:
                return json.loads(p.stdout)
            except json.JSONDecodeError:
                pass
        time.sleep(1.5 * (attempt + 1))
    return None


def candidates(loc):
    parts = [p.strip() for p in loc.split(",") if p.strip()]
    out = [loc]
    if len(parts) >= 3:
        out += [f"{parts[0]}, {parts[-1]}", f"{parts[-2]}, {parts[-1]}"]
    if len(parts) >= 2:
        out += [parts[0], parts[-1]]
    seen, uniq = set(), []
    for c in out:
        if c not in seen:
            seen.add(c); uniq.append(c)
    return uniq


def geocode(loc):
    """Country-validated geocode: rejects results in the wrong country."""
    expect = expected_iso(loc)
    city = loc.split(",")[0].strip().lower()
    for cand in candidates(loc):
        params = {"format": "jsonv2", "limit": 1, "addressdetails": 1, "q": cand}
        if expect:
            params["countrycodes"] = expect
        data = nominatim(params)
        time.sleep(1.1)  # be polite to the free service
        if not data:
            continue
        got = (data[0].get("address") or {}).get("country_code")
        if expect and got and got not in OK_ALT.get(expect, {expect}):
            continue  # landed in the wrong country
        return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"]),
                "display": data[0].get("display_name", ""), "country": got,
                "matched_query": cand,
                # the city itself didn't match — this is a region/country-level pin
                # (fine for "TBD, Germany", suspicious for a real town — flagged in logs)
                "approx": city not in cand.lower()}
    return None


def lev(a, b, maxd):
    """Levenshtein distance, or None if it exceeds maxd (early exit)."""
    if abs(len(a) - len(b)) > maxd:
        return None
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (ca != cb)))
        if min(cur) > maxd:
            return None
        prev = cur
    return prev[-1] if prev[-1] <= maxd else None


def typo_match(loc, cache):
    """Conservative misspelling repair: reuse a known coordinate when the city part
    is 1–2 edits away from an already-located entry whose rest-of-address is
    IDENTICAL (so 'high springd, florida, …' → 'high springs, florida, …', but
    nothing ever jumps to a different state or country). Returns the matched key."""
    parts = [p.strip() for p in loc.split(",")]
    city = parts[0]
    if len(parts) < 2 or len(city) < 5:      # too little signal — don't guess
        return None
    tail = ", ".join(parts[1:])
    maxd = 1 if len(city) <= 8 else 2
    best = []
    for k, v in cache.items():
        if not v or v.get("lat") is None or v.get("approx") or k == loc:
            continue
        kp = [p.strip() for p in k.split(",")]
        if len(kp) < 2 or ", ".join(kp[1:]) != tail or kp[0] == city:
            continue
        d = lev(city, kp[0], maxd)
        if d:
            best.append((d, k))
    best.sort()
    if best:
        top = [k for d, k in best if d == best[0][0]]
        if len({(cache[k]["lat"], cache[k]["lng"]) for k in top}) == 1:
            return top[0]                    # unique place (maybe several spellings of it)
    return None                              # none, or ambiguous — geocode normally


def reverse_country(lat, lng, rcache):
    """ISO2 country at a coordinate, via cached Nominatim reverse lookups."""
    key = f"{lat},{lng}"
    if key in rcache:
        return rcache[key]
    url = ("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=5&"
           + urllib.parse.urlencode({"lat": lat, "lon": lng}))
    p = curl(url, NOMINATIM_UA)
    got = None
    if p.returncode == 0 and p.stdout.strip():
        try:
            got = (json.loads(p.stdout).get("address") or {}).get("country_code")
        except json.JSONDecodeError:
            pass
    time.sleep(1.1)
    rcache[key] = got
    save_json(rcache, REV_CACHE)
    return got


# ---------------------------------------------------------------- outputs
def save_json(obj, path):
    tmp = path + ".tmp"
    json.dump(obj, open(tmp, "w"), indent=1, ensure_ascii=False)
    os.replace(tmp, path)  # atomic — a kill can't corrupt the DB


def write_geo_js(cache):
    geo = {canon(k): [round(v["lat"], 5), round(v["lng"], 5)]
           for k, v in cache.items() if v and v.get("lat") is not None}
    with open(GEO_JS, "w", encoding="utf-8") as f:
        f.write("// Static location -> [lat, lng] lookup for the GUE schedule.\n")
        f.write("// Generated by update_geo.py (append-only DB). Do not edit by hand.\n")
        f.write("window.GUE_GEO = ")
        json.dump(geo, f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        f.write(";\n")
    return len(geo)


# ---------------------------------------------------------------- commands
def run_update():
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    rcache = json.load(open(REV_CACHE)) if os.path.exists(REV_CACHE) else {}
    print(f"DB: {len(cache)} locations on record.")
    print("Fetching live GUE schedule…")
    classes = parse_classes(fetch_schedule())
    if not classes:
        sys.exit("ERROR: parsed 0 classes from the schedule page.")
    locs = sorted({canon(c["location"]) for c in classes if c["location"]})
    print(f"Schedule: {len(classes)} classes at {len(locs)} unique locations.")
    write_schedule(classes)  # before geocoding, so a geocode hiccup can't lose it

    # NEW = not in the DB yet, or previously failed (retry). Existing good entries are
    # left untouched — append-only, so manual fixes and old locations are preserved.
    todo = [l for l in locs if l not in cache or cache[l].get("lat") is None]
    if not todo:
        print("Nothing new to geocode.")
    for i, loc in enumerate(todo, 1):
        alias = typo_match(loc, cache)
        if alias:  # misspelling of a place we already know — reuse its coordinate
            cache[loc] = dict(cache[alias], alias_of=alias)
            save_json(cache, CACHE)
            print(f"  [{i}/{len(todo)}] OK   {loc}  (typo of '{alias}')")
            continue
        res = geocode(loc)
        note = ""
        if res:
            # verify before adding: the coordinate must reverse-geocode into the
            # country the location names (second, independent check)
            exp = expected_iso(loc)
            got = reverse_country(res["lat"], res["lng"], rcache)
            if exp and got and got not in OK_ALT.get(exp, {exp}):
                note = f"  (rejected: coord is in '{got}', expected '{exp}')"
                res = None
            elif res.get("approx"):
                note = f"  (approx — only matched '{res['matched_query']}')"
            if res:
                res["verified"] = bool(exp and got)
        cache[loc] = res if res else {"lat": None, "lng": None, "display": ""}
        save_json(cache, CACHE)
        print(f"  [{i}/{len(todo)}] {'OK  ' if res else 'FAIL'} {loc}{note}")

    n = write_geo_js(cache)
    fails = [l for l, v in cache.items() if v.get("lat") is None]
    print(f"\nDone. geo.js has {n} located places · DB holds {len(cache)} "
          f"({len(fails)} unresolved).")
    if fails:
        print("Unresolved (kept for a future retry):")
        for f in fails:
            print("   ", f)


def run_validate():
    """Reverse-geocode every cached coordinate and flag any in the wrong country."""
    cache = json.load(open(CACHE))
    rcache = json.load(open(REV_CACHE)) if os.path.exists(REV_CACHE) else {}
    located = [(k, v) for k, v in cache.items() if v.get("lat") is not None]
    print(f"Validating {len(located)} coordinates against their stated country…")
    flags, unknown = [], []
    for i, (loc, v) in enumerate(located, 1):
        got = reverse_country(v["lat"], v["lng"], rcache)
        exp = expected_iso(loc)
        if exp is None:
            unknown.append((loc, got))
        elif got and got not in OK_ALT.get(exp, {exp}):
            flags.append((loc, exp, got, v))
        if i % 25 == 0:
            print(f"  …{i}/{len(located)}")
    print("\n=== MISMATCHES (coordinate is in the wrong country) ===")
    for loc, exp, got, v in flags:
        print(f"  {loc!r}: expected {exp}, coord is in {got}  ({v['lat']},{v['lng']})")
    print(f"\n=== UNKNOWN country field (couldn't map) ===")
    for loc, got in unknown:
        print(f"  {loc!r} (coord in {got})")
    print(f"\n{len(flags)} mismatches, {len(unknown)} unknown-country, "
          f"{len(located) - len(flags) - len(unknown)} ok.")


if __name__ == "__main__":
    if "--validate" in sys.argv:
        run_validate()
    else:
        run_update()
