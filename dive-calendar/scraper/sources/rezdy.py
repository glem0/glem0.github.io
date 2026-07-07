"""Shared parser for Rezdy 'productsMonthlyCalendar' widgets.

Used by Dive Bondi and Dive Centre Manly. One POST per month:
    POST {base}/productsMonthlyCalendar/{catalog_id}?iframe=true
    form: calMonth=<1-12> calYear=<YYYY>   header: X-Requested-With: XMLHttpRequest
Response is JSON (mislabelled text/html): {"monthlyAvailability": {"MM-DD-YYYY": [<a> snippets]}}
"""
from __future__ import annotations

import html as htmllib
import json
import os
import re
import tempfile
from datetime import date, datetime
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit

from bs4 import BeautifulSoup

from common import Event, Window, browser_headers, curl_fetch, parse_time, polite_sleep, sydney_iso

SOLD_OUT_RE = re.compile(r"\(\s*sold\s*out\s*\)", re.I)


def _clean_url(base: str, href: str) -> str | None:
    if not href:
        return None
    parts = urlsplit(href)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k not in ("PHPSESSID", "iframe")]
    b = urlsplit(base)
    return urlunsplit((b.scheme, b.netloc, parts.path or "/", urlencode(query), ""))


def _parse_snippet(source_id: str, base: str, day_key: str, snippet: str) -> Event | None:
    soup = BeautifulSoup(snippet, "html.parser")
    a = soup.find("a")
    if a is None:
        return None

    strong = a.find("strong")
    time_text = strong.get_text(" ", strip=True) if strong else ""
    full_text = htmllib.unescape(a.get_text(" ", strip=True))
    sold_out = bool(SOLD_OUT_RE.search(full_text))

    title = full_text
    if time_text:
        title = title.replace(time_text, "", 1)
    title = SOLD_OUT_RE.sub("", title).strip("  -–·")
    if not title:
        return None

    href = a.get("href") or ""
    qs = parse_qs(urlsplit(href).query)
    pref_date = (qs.get("preferredDate") or [None])[0]      # YYYY-MM-DD
    pref_time = (qs.get("preferredTime") or [None])[0]      # "9:00 AM" | "All day"

    day = None
    if pref_date:
        try:
            day = date.fromisoformat(pref_date)
        except ValueError:
            day = None
    if day is None:
        try:
            day = datetime.strptime(day_key, "%m-%d-%Y").date()   # US-order keys
        except ValueError:
            return None

    hm = parse_time(pref_time) or parse_time(time_text)
    return Event(
        source=source_id,
        title=title + (" (sold out)" if sold_out else ""),
        start=sydney_iso(day, hm),
        all_day=hm is None,
        url=_clean_url(base, href),
    )


def fetch_rezdy(source_id: str, base: str, catalog_id: int, window: Window) -> list[Event]:
    events: list[Event] = []
    seen: set[tuple[str, str]] = set()
    endpoint = f"{base}/productsMonthlyCalendar/{catalog_id}"
    page_url = f"{endpoint}?iframe=true"   # the widget page whose jQuery issues the XHRs
    jar_fd, jar = tempfile.mkstemp(suffix=".cookies")
    os.close(jar_fd)
    try:
        for i, (year, month) in enumerate(window.months):
            if i:
                polite_sleep()
            body = curl_fetch(   # via curl: Rezdy's WAF rejects Python TLS stacks
                endpoint,
                params={"iframe": "true"},
                data={"calMonth": month, "calYear": year},
                headers=browser_headers(endpoint, referer=page_url, method="POST", jquery=True),
                cookie_jar=jar,   # keep AWSALB/PHPSESSID across months like a browser
            )
            data = json.loads(body)   # content-type lies; body is JSON
            avail = (data or {}).get("monthlyAvailability") or {}
            for day_key, snippets in avail.items():
                for snippet in snippets:
                    ev = _parse_snippet(source_id, base, day_key, snippet)
                    if ev is None:
                        continue
                    key = (ev.title, ev.start)
                    if key in seen:
                        continue
                    seen.add(key)
                    events.append(ev)
    finally:
        try:
            os.unlink(jar)
        except OSError:
            pass
    return events
