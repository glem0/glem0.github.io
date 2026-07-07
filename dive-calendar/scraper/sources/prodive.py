"""ProDive Sydney — classic ASP calendar, server-rendered list of the next 30
event starts from a given date. Paginate by advancing From_Date; dedupe on
ScheduleID (boundary days overlap between pages).
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from urllib.parse import parse_qs, urljoin, urlsplit

from bs4 import BeautifulSoup

from common import Event, Window, browser_headers, clean_text, get, parse_time, polite_sleep, sydney_iso

ID = "prodive"
NAME = "ProDive Sydney"
SHORT = "ProDive"
URL = "https://www.prodive.com.au/Calendar.asp?Scubadive=Sydney"

BASE = "https://www.prodive.com.au/"
DATE_HDR_RE = re.compile(r"(\d{1,2}-[A-Za-z]{3}-\d{4})")
PRICE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{2})?)")
TIME_RE = re.compile(r"Start\s*Time:\s*(\d{1,2}:\d{2})", re.I)
LOCATION_RE = re.compile(r"\s*-\s*Sydney\s*-\s*(Alexandria|Manly)\s*$", re.I)
MAX_PAGES = 20


def _page_url(from_date: date) -> str:
    return (f"{BASE}Calendar.asp?Scubadive=Sydney&Divesite=&Category="
            f"&From_Date={from_date.strftime('%d-%b-%Y')}")


def _schedule_id(item) -> str | None:
    for a in item.select("a[href]"):
        href = a["href"]
        if "BookSchedule.asp" in href:
            qs = parse_qs(urlsplit(href).query)
            sid = (qs.get("ScheduleID") or [None])[0]
            if sid:
                return sid
    return None


def fetch(window: Window) -> list[Event]:
    events: list[Event] = []
    seen: set[str] = set()
    from_date = window.start
    current_date: date | None = None
    prev_url: str | None = None   # realistic referer chain while paginating

    for page in range(MAX_PAGES):
        if page:
            polite_sleep()
        url = _page_url(from_date)
        r = get(url, headers=browser_headers(url, kind="document", referer=prev_url))
        r.encoding = "utf-8"
        prev_url = url
        last_date, current_date, n_items = _parse_page(r.text, window, seen, events, current_date)
        if n_items == 0 or last_date is None or last_date > window.end:
            break
        # next page starts from the last date seen; force progress on dense days
        from_date = last_date if last_date > from_date else from_date + timedelta(days=1)

    return events


def _parse_page(html: str, window: Window, seen: set, events: list[Event],
                current_date: date | None) -> tuple[date | None, date | None, int]:
    """Parse one calendar page; returns (last_date_seen, carried_current_date, item_count)."""
    soup = BeautifulSoup(html, "html.parser")
    items = soup.select("div.post-item")
    last_date: date | None = None
    if items:
        for item in items:
            hdr = item.find("div", class_="sticky-header")
            if hdr:
                m = DATE_HDR_RE.search(hdr.get_text(" ", strip=True))
                if m:
                    current_date = datetime.strptime(m.group(1), "%d-%b-%Y").date()
            if current_date is None:
                continue
            last_date = current_date
            if current_date > window.end:
                continue

            title_a = item.select_one(".post-title h3 a") or item.select_one(".post-title a")
            if title_a is None:
                continue
            title = clean_text(title_a.get_text(" ", strip=True))
            if not title:
                continue
            product_url = urljoin(BASE, title_a.get("href") or "")

            location = None
            m = LOCATION_RE.search(title)
            if m:
                location = f"ProDive {m.group(1).title()}"
                title = LOCATION_RE.sub("", title).strip()

            info = item.select_one(".post-info")
            info_text = info.get_text("\n", strip=True) if info else ""
            tm = TIME_RE.search(info_text)
            hm = parse_time(tm.group(1)) if tm else None
            pm = PRICE_RE.search(info_text)

            desc = item.select_one(".post-description")
            desc_text = None
            if desc:
                for junk in desc.select(".post-read-more, a"):
                    junk.decompose()
                desc_text = clean_text(desc.get_text(" ", strip=True))
                if desc_text:
                    desc_text = re.sub(r"\s*(Learn More|Check Availability)\s*$", "", desc_text, flags=re.I).strip() or None
            parts = []
            if pm:
                parts.append(f"${pm.group(1)}")
            if desc_text:
                parts.append(desc_text)
            description = " · ".join(parts) if parts else None

            sid = _schedule_id(item)
            key = sid or f"{title}|{current_date.isoformat()}|{hm}"
            display_key = (title, current_date.isoformat(), hm, product_url)
            if key in seen or display_key in seen:   # page-boundary dupes + repeated listings
                continue
            seen.add(key)
            seen.add(display_key)

            events.append(Event(
                source=ID,
                title=title,
                start=sydney_iso(current_date, hm),
                all_day=hm is None,
                url=product_url or URL,
                location=location,
                description=description,
            ))

    return last_date, current_date, len(items)
