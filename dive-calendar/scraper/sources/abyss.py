"""Abyss Scuba Diving — DiveShop360 storefront.

The calendar page hosts <widget data-id=N> placeholders. Each resolves via
POST /ajax/getwidget to a {course,charter,travel}_group_calendar tag carrying
the current product-group ids (these drift over time, so they are re-discovered
every run). The group calendar endpoints return an HTML table of upcoming
events (tr.main-row + tr.expand-row pairs), date-ascending from today; `offset`
is the row cap and `var count = "N"` in the response gives the true total.
All POSTs need X-Requested-With: XMLHttpRequest (errors come back as HTTP 200
with a "Forbidden access error" body).
"""
from __future__ import annotations

import html as htmllib
import re
from datetime import datetime
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup

from common import Event, Window, browser_headers, clean_text, get, parse_time, polite_sleep, post, sydney_iso

ID = "abyss"
NAME = "Abyss Scuba Diving"
SHORT = "Abyss"
URL = "https://www.abyss.com.au/sydney-dive-calendar"

BASE = "https://www.abyss.com.au"


def _ajax_headers(endpoint: str) -> dict:
    # same-origin jQuery POST issued by the calendar page
    return browser_headers(endpoint, referer=URL, method="POST", jquery=True)

WIDGET_RE = re.compile(r'<widget[^>]*data-id="(\d+)"')
INNER_RE = re.compile(
    r"id='([a-z]+_group_calendar_\d+)'>\s*<([a-z]+_group_calendar)\s+"
    r"data-title='([^']*)'\s+data-id=([\d,]+)", re.I)
COUNT_RE = re.compile(r'var\s+count\s*=\s*"(\d+)"')
START_RE = re.compile(r"Start date:\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})(?:\s+(\d{1,2}:\d{2}\s*[AP]\.?M\.?))?", re.I)
# trailing date decorations on specific titles: "10/7/2026", "11/7/26", "-July-26", "Aug 2026", "2027"
TRAILING_DATE_RE = re.compile(
    r"(?:\s*[-–]?\s*\d{1,2}/\d{1,2}/\d{2,4}"
    r"|\s*[-–]?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*[-–]?\s*\d{2,4}"
    r"|\s+20\d{2})\s*$", re.I)


def _strip_trailing_dates(text: str) -> str:
    for _ in range(2):
        text = TRAILING_DATE_RE.sub("", text).strip(" -–·")
    return text


def _clean_url(href: str | None) -> str | None:
    if not href:
        return None
    parts = urlsplit(urljoin(BASE, href))   # drop ?q= (contains per-session cart id)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def _int(text: str) -> int | None:
    try:
        return int(text.strip())
    except (TypeError, ValueError):
        return None


def _fetch_rows(tag: str, title: str, parent_id: str, group_ids: str, offset: int = 500):
    r = post(f"{BASE}/ajax/{tag}", headers=_ajax_headers(f"{BASE}/ajax/{tag}"), data={
        "title": title, "parent_id": parent_id, "group_id": group_ids, "offset": offset,
    })
    if "Forbidden access error" in r.text:
        raise ValueError(f"abyss {tag}: forbidden (missing header or endpoint changed)")
    m = COUNT_RE.search(r.text)
    if m and int(m.group(1)) > offset:
        polite_sleep(2.5)
        return _fetch_rows(tag, title, parent_id, group_ids, offset=int(m.group(1)) + 50)
    soup = BeautifulSoup(r.text, "html.parser")
    return soup.select("tr.main-row")


def _parse_row(main) -> Event | None:
    tds = main.find_all("td")
    if len(tds) < 8:
        return None
    try:
        start_d = datetime.strptime(tds[1].get_text(strip=True), "%d %b %Y").date()
    except ValueError:
        return None
    try:
        end_d = datetime.strptime(tds[2].get_text(strip=True), "%d %b %Y").date()
    except ValueError:
        end_d = start_d

    group = clean_text(tds[3].get_text(" ", strip=True)) or "Dive event"
    available = _int(tds[5].get_text())   # only used for the sold-out flag
    price = htmllib.unescape(tds[6].get_text(strip=True))
    link = tds[7].find("a")
    url = _clean_url(link.get("href") if link else None)

    hm = None
    spec_title = None
    blurb = None
    expand = main.find_next_sibling("tr", class_="expand-row")
    if expand:
        text = expand.get_text("\n", strip=True)
        m = START_RE.search(text)
        if m and m.group(2):
            hm = parse_time(m.group(2))
        ital = expand.find("p", style=lambda s: s and "italic" in s)
        if ital:
            t = clean_text(ital.get_text(" ", strip=True))
            if t:
                left, _, right = t.partition(":")
                left = _strip_trailing_dates(left)
                if left:
                    spec_title = left
                    blurb = clean_text(right)
                else:
                    blurb = t

    title = spec_title or group
    if available == 0:
        title += " (sold out)"

    # the places-left count is deliberately not ingested: it changes daily and
    # would churn a data commit every workflow run
    parts = []
    if price and not re.fullmatch(r"\$0(\.00)?", price):
        parts.append(price)
    if spec_title and group.lower() not in spec_title.lower():
        parts.append(group)
    if blurb:
        parts.append(blurb)

    start_iso = sydney_iso(start_d, hm)
    return Event(
        source=ID,
        title=title,
        start=start_iso,
        end=end_d.isoformat() if end_d > start_d else None,
        all_day=hm is None,
        url=url or URL,
        description=" · ".join(parts) if parts else None,
    )


def fetch(window: Window) -> list[Event]:
    page = get(URL, headers=browser_headers(URL, kind="document")).text
    widget_ids = list(dict.fromkeys(WIDGET_RE.findall(page)))
    if not widget_ids:
        raise ValueError("abyss: no DiveShop360 widgets found on calendar page")

    calendars = []
    for wid in widget_ids:
        polite_sleep(2.5)
        r = post(f"{BASE}/ajax/getwidget", data={"sw_id": wid},
                 headers=_ajax_headers(f"{BASE}/ajax/getwidget"))
        m = INNER_RE.search(r.text)
        if m:
            calendars.append(m.groups())   # (parent_id, tag, title, group_ids)
    if not calendars:
        raise ValueError("abyss: no group calendars resolved from widgets")

    events: list[Event] = []
    seen: set[tuple[str, str]] = set()
    for parent_id, tag, title, group_ids in calendars:
        polite_sleep(2.5)
        for main in _fetch_rows(tag.lower(), title, parent_id, group_ids):
            ev = _parse_row(main)
            if ev is None:
                continue
            key = (ev.title, ev.start)
            if key in seen:
                continue
            seen.add(key)
            events.append(ev)
    return events
