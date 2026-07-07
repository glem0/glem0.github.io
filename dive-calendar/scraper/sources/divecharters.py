"""Sydney Dive Charters — Checkfront booking portal.

Their WordPress site (Cloudflare, blocks non-browser TLS) embeds the hosted
portal at sydneydivecharters.checkfront.com, which answers plain httpx:
    /reserve/inventory/?category_id=N            items of a category (JSON-wrapped HTML)
    /reserve/api/?call=calendar_full&filter_item_id=N&start_date&end_date
                                                 {"calendar_data": {"YYYYMMDD": 0|1}}
The calendar API returns one month-grid per call no matter the range asked,
so it's called per item per window month. Items are a weekly boat schedule
named like "Saturday - Double Boat Dives - Departing 1230pm Little Manly";
the date list is taken from calendar_data (so blackouts/sold-out days drop
out) and the start time is parsed from the item name.

Product categories that aren't dated trips (hire gear, gift certificates,
retail, multi-dive packages, consumables) are excluded up front; "Private ..."
items (on-request charters/guides) are skipped; and anything bookable on
nearly every day of the window is treated as on-demand stock, not schedule,
and dropped — those would spam the calendar with a daily all-day event.
"""
from __future__ import annotations

import calendar as callib
import re
from datetime import date, timedelta

from bs4 import BeautifulSoup

from common import Event, Window, browser_headers, clean_text, get, polite_sleep, sydney_iso

ID = "divecharters"
NAME = "Sydney Dive Charters"
SHORT = "Charters"
URL = "https://www.sydneydivecharters.com.au/bookings/"

PORTAL = "https://sydneydivecharters.checkfront.com/reserve/"
REFERER = PORTAL + "?inline=1"
DELAY = 0.7                 # the API is CDN-cached (cacheable=1); still be polite
ON_DEMAND_DENSITY = 0.85    # available on >85% of window days => on-request stock

# category ids/names that are products, not dated trips
DENY_IDS = {7, 12, 17, 21, 22, 63, 74}
DENY_NAME_RE = re.compile(r"gift|hire|retail|sales|package|rebreather|commercial|charters", re.I)

CATEGORY_RE = re.compile(r"<a href='#(\d+)'[^>]*class='set_category_id'>(.*?)</a>", re.S)
ITEM_RE = re.compile(r'id="cf-item-data-(\d+)"')
WEEKDAY_PREFIX_RE = re.compile(
    r"^(mon|tues|wednes|thurs|fri|satur|sun)day(\s+(morning|afternoon|evening|night))?\s*[-–—]*\s*", re.I)
TIME_RE = re.compile(r"\b(\d{1,2})[.:]?(\d{2})?\s*([ap])\.?m\b", re.I)


def _api(params: dict) -> dict:
    url = PORTAL + "api/"
    q = {"call": "calendar_full", "inline": 1, "header": "hide", "cacheable": 1,
         "start_date": "", "end_date": "", **params}
    r = get(url, params=q, headers=browser_headers(url, referer=REFERER, jquery=True))
    return r.json()


def _inventory(category_id: int | str, day: date) -> str:
    url = PORTAL + "inventory/"
    r = get(url, params={
        "inline": 1, "header": "hide", "cacheable": 1, "category_id": category_id,
        "start_date": day.isoformat(), "end_date": day.isoformat(),
    }, headers=browser_headers(url, referer=REFERER, jquery=True))
    return r.json().get("inventory") or ""


def _hm_from_name(name: str) -> tuple[tuple[int, int] | None, tuple[int, int] | None]:
    """First time token in the item name = start; 'Xpm-Ypm' ranges also give an end."""
    matches = list(TIME_RE.finditer(name))
    if not matches:
        return None, None

    def to24(m) -> tuple[int, int] | None:
        h, mi, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3).lower()
        if h > 12 or mi > 59:
            return None
        if ap == "p" and h != 12:
            h += 12
        if ap == "a" and h == 12:
            h = 0
        return (h, mi)

    start = to24(matches[0])
    end = None
    if start and len(matches) > 1:
        between = name[matches[0].end():matches[1].start()]
        if re.fullmatch(r"\s*[-–]\s*", between):   # "(4pm-9.30pm)" style range
            end = to24(matches[1])
    return start, end


def _clean_title(name: str) -> str:
    t = WEEKDAY_PREFIX_RE.sub("", name).strip(" -–—/·")
    t = re.sub(r"\s{2,}", " ", t)
    return t or name


def _parse_items(inv_html: str) -> list[dict]:
    soup = BeautifulSoup(inv_html, "html.parser")
    items = []
    for blk in soup.select("div.cf-item-data[id^=cf-item-data-]"):
        iid = blk.get("id", "").rsplit("-", 1)[-1]
        h2 = blk.find("h2")
        name = clean_text(h2.get_text(" ", strip=True)) if h2 else None
        if not iid.isdigit() or not name:
            continue
        if name.lower().startswith("private"):
            continue   # on-request charters/guides, not scheduled trips
        price_el = blk.select_one(".cf-price strong span")
        summary_el = blk.find(id=f"cf-item-summary-{iid}")
        summary = None
        if summary_el:
            summary = clean_text(summary_el.get_text(" ", strip=True))
            if summary:
                summary = re.sub(r"\s*\.{3}\s*\(Read More\)\s*$", "…", summary)[:400]
        items.append({
            "id": int(iid),
            "name": name,
            "price": clean_text(price_el.get_text(strip=True)) if price_el else None,
            "summary": summary,
        })
    return items


def fetch(window: Window) -> list[Event]:
    categories = CATEGORY_RE.findall(_inventory("I", window.start))
    if not categories:
        raise ValueError("divecharters: no categories in Checkfront inventory")

    items: list[dict] = []
    for cid, cname in categories:
        cname = clean_text(BeautifulSoup(cname, "html.parser").get_text()) or ""
        if int(cid) in DENY_IDS or DENY_NAME_RE.search(cname):
            continue
        polite_sleep(DELAY)
        items.extend(_parse_items(_inventory(cid, window.start)))

    # the same item can sit in several categories; scan each once
    by_id = {it["id"]: it for it in items}
    if not by_id:
        raise ValueError("divecharters: no trip items found")

    window_days = (window.end - window.start).days + 1
    events: list[Event] = []
    seen: set[tuple[str, str]] = set()
    for it in by_id.values():
        days: list[date] = []
        for year, month in window.months:
            polite_sleep(DELAY)
            first = date(year, month, 1)
            last = date(year, month, callib.monthrange(year, month)[1])
            data = _api({"filter_item_id": it["id"],
                         "start_date": first.isoformat(), "end_date": last.isoformat()})
            for key, avail in (data.get("calendar_data") or {}).items():
                if not avail or len(key) != 8 or not key.isdigit():
                    continue
                d = date(int(key[:4]), int(key[4:6]), int(key[6:]))
                if first <= d <= last:   # the grid spills into adjacent months
                    days.append(d)

        if len(days) > window_days * ON_DEMAND_DENSITY:
            print(f"    divecharters: skipping on-demand item {it['id']} ({it['name'][:50]})")
            continue

        hm, end_hm = _hm_from_name(it["name"])
        title = _clean_title(it["name"])
        desc = " · ".join(p for p in (it["price"], it["summary"]) if p) or None
        for d in sorted(set(days)):
            start_iso = sydney_iso(d, hm)
            key = (title, start_iso)
            if key in seen:
                continue
            seen.add(key)
            end_iso = None
            if hm and end_hm:
                end_d = d if end_hm > hm else d + timedelta(days=1)   # overnight NYE runs
                end_iso = sydney_iso(end_d, end_hm)
            events.append(Event(
                source=ID,
                title=title,
                start=start_iso,
                end=end_iso,
                all_day=hm is None,
                url=f"{PORTAL}?date={d.isoformat()}#{it['id']}@book@",
                description=desc,
            ))
    return events
