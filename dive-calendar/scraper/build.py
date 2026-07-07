#!/usr/bin/env python3
"""Fetch all dive-centre calendars and write data/events.json (+ data/events.js).

Usage:  python3 scraper/build.py          (from the repo root, or anywhere)
Env:    MONTHS_AHEAD=4   how many months beyond the current one to cover
"""
from __future__ import annotations

import calendar
import json
import os
import sys
import traceback
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import SYDNEY, Window          # noqa: E402
from sources import SOURCES                # noqa: E402

MONTHS_AHEAD = int(os.environ.get("MONTHS_AHEAD", "4"))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")


def build_window() -> Window:
    today = datetime.now(SYDNEY).date()
    months: list[tuple[int, int]] = []
    y, m = today.year, today.month
    for _ in range(MONTHS_AHEAD + 1):
        months.append((y, m))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    last_y, last_m = months[-1]
    return Window(
        months=months,
        start=date(months[0][0], months[0][1], 1),
        end=date(last_y, last_m, calendar.monthrange(last_y, last_m)[1]),
    )


def main() -> int:
    window = build_window()
    print(f"Scrape window: {window.start} → {window.end} ({len(window.months)} months)")

    sources_out: list[dict] = []
    all_events = []
    lo, hi = window.start.isoformat(), window.end.isoformat()

    for mod in SOURCES:
        entry = {"id": mod.ID, "name": mod.NAME, "short": mod.SHORT, "url": mod.URL}
        try:
            fetched = mod.fetch(window)
            kept = [e for e in fetched if lo <= e.start[:10] <= hi]
            entry.update(status="ok", event_count=len(kept))
            all_events.extend(kept)
            print(f"  ok    {mod.NAME}: {len(kept)} events" +
                  (f" ({len(fetched) - len(kept)} outside window)" if len(fetched) != len(kept) else ""))
        except Exception as exc:   # one broken site must not sink the rest
            traceback.print_exc()
            entry.update(status="error", event_count=0, error=f"{type(exc).__name__}: {exc}")
            print(f"::warning title={mod.NAME} scrape failed::{exc}")
        sources_out.append(entry)

    all_events.sort(key=lambda e: (e.start[:10], not e.all_day, e.start))

    doc = {
        "generated_at": datetime.now(SYDNEY).isoformat(timespec="seconds"),
        "timezone": "Australia/Sydney",
        "window": {"start": lo, "end": hi},
        "sources": sources_out,
        "events": [e.to_dict() for e in all_events],
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    payload = json.dumps(doc, ensure_ascii=False, indent=1)
    with open(os.path.join(DATA_DIR, "events.json"), "w", encoding="utf-8") as f:
        f.write(payload + "\n")
    with open(os.path.join(DATA_DIR, "events.js"), "w", encoding="utf-8") as f:
        f.write("window.__DIVE_DATA__ =\n" + payload + ";\n")

    ok = sum(1 for s in sources_out if s["status"] == "ok")
    print(f"\nWrote {len(all_events)} events from {ok}/{len(sources_out)} sources to data/events.json")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
