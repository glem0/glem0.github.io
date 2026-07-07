#!/usr/bin/env python3
"""
GUE course-map geocoder — one script to keep geo.js up to date.

    python3 update_geo.py             Fetch the live GUE schedule, geocode any NEW
                                      locations (each verified by reverse-geocoding the
                                      coordinate back into the stated country before it
                                      is accepted), and rebuild geo.js. Obvious
                                      misspellings of already-known places ("High
                                      Springd") reuse the known coordinate instead of
                                      being geocoded blind.
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
    for attempt in range(4):
        p = subprocess.run(["curl", "-sS", "--compressed", "--max-time", "30",
                            "-H", "User-Agent: " + BROWSER_UA,
                            "-H", "Referer: https://www.gue.com/diver-training",
                            SCHEDULE_URL], capture_output=True, text=True)
        if p.returncode == 0 and "class-details" in p.stdout:
            return p.stdout
        time.sleep(2 * (attempt + 1))
    sys.exit("ERROR: could not fetch the GUE schedule.")


def parse_locations(page):
    locs = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.I | re.S):
        if "class-details" not in row:
            continue
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.I | re.S)
        if len(cells) < 4:
            continue
        loc = html.unescape(re.sub(r"<[^>]+>", "", cells[2]))
        loc = canon(loc)
        if loc:
            locs.append(loc)
    return sorted(set(locs))


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
    locs = parse_locations(fetch_schedule())
    print(f"Schedule: {len(locs)} unique locations.")

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
