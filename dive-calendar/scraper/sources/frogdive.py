"""Frog Dive Sydney — Event Calendar App embed on the Shopify site.

Open JSON API (CORS *): GET api.eventcalendarapp.com/events with epoch-second
start/end params returns all events overlapping the range, pre-expanded
(no RRULEs). Widget ids come from the /pages/dive-calendar embed script.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta

from bs4 import BeautifulSoup

from common import SYDNEY, Event, Window, browser_headers, clean_text, get

ID = "frogdive"
NAME = "Frog Dive Sydney"
SHORT = "Frog Dive"
URL = "https://www.frogdive.com.au/pages/dive-calendar"

API = "https://api.eventcalendarapp.com/events"
CAL_ID = 5195
WIDGET_UUID = "a9a8f051-045b-466e-80c4-6b9c330d024a"


def _epoch(dt: datetime) -> int:
    return int(dt.timestamp())


def _desc(ev: dict) -> str | None:
    short = clean_text(ev.get("shortDescription"))
    if short:
        return short
    html = ev.get("description") or ev.get("longDescription")
    if not html:
        return None
    return clean_text(BeautifulSoup(html, "html.parser").get_text(" ", strip=True))


def fetch(window: Window) -> list[Event]:
    start_dt = datetime.combine(window.start, time.min, tzinfo=SYDNEY)
    end_dt = datetime.combine(window.end + timedelta(days=1), time.min, tzinfo=SYDNEY)
    r = get(API, params={
        "id": CAL_ID,
        "widgetUuid": WIDGET_UUID,
        "viewmode": "grid",
        "start": _epoch(start_dt),
        "end": _epoch(end_dt),
    }, headers=browser_headers(API, referer=URL))   # cross-site fetch from the Shopify page
    payload = r.json()
    raw = payload.get("events") if isinstance(payload, dict) else payload
    if raw is None:
        raise ValueError(f"unexpected eventcalendarapp response: {str(payload)[:200]}")

    events: list[Event] = []
    seen: set = set()
    for ev in raw:
        eid = ev.get("id") or ev.get("uuid")
        if eid in seen:
            continue
        seen.add(eid)
        parsed = _to_event(ev)
        if parsed is not None:
            events.append(parsed)
    return events


def _to_event(ev: dict) -> Event | None:
    title = clean_text(ev.get("summary"))
    if not title or not ev.get("utcStartTime"):
        return None
    if ev.get("soldOut"):
        title += " (sold out)"

    start = datetime.fromtimestamp(int(ev["utcStartTime"]), SYDNEY)
    end = datetime.fromtimestamp(int(ev["utcEndTime"]), SYDNEY) if ev.get("utcEndTime") else None
    all_day = bool(ev.get("isAllDayEvent"))

    if all_day:
        start_s = start.date().isoformat()
        end_s = None
        if end and end > start:
            end_d = end.date()
            if end.timetz().hour == 0 and end.timetz().minute == 0:
                end_d -= timedelta(days=1)   # exclusive-midnight convention
            if end_d > start.date():
                end_s = end_d.isoformat()
    else:
        start_s = start.isoformat(timespec="minutes")
        end_s = end.isoformat(timespec="minutes") if end and end > start else None

    return Event(
        source=ID,
        title=title,
        start=start_s,
        end=end_s,
        all_day=all_day,
        url=ev.get("url") or URL,
        location=clean_text(ev.get("venueName")),
        description=_desc(ev),
    )
