"""Shared plumbing for the dive-calendar scrapers."""
from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass
from datetime import date, datetime
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from curl_cffi.requests import Response, Session
from curl_cffi.requests.exceptions import HTTPError, RequestException

SYDNEY = ZoneInfo("Australia/Sydney")

# Every request goes through curl_cffi impersonating the newest Chrome profile it
# ships: TLS/HTTP2 fingerprint plus the matching User-Agent, sec-ch-ua client hints
# and Accept-Encoding come from the profile, so they never drift apart (Rezdy sits
# behind Cloudflare Bot Management, which blocks plain curl/Python TLS stacks).
IMPERSONATE = "chrome"

# sent on every request on top of the profile's own headers
BASE_HEADERS = {
    "Accept-Language": "en-AU,en;q=0.9",
}
REQUEST_DELAY = 1.2   # seconds between paginated requests to the same site
TIMEOUT = 30
RETRIES = 4
BACKOFF_429 = 20      # base seconds to wait after a 429/503 (×attempt, or Retry-After)
MAX_BACKOFF = 120


@dataclass
class Window:
    """Scrape window: whole calendar months from the 1st of the current month."""
    months: list[tuple[int, int]]   # [(year, month), ...] in order
    start: date                     # first day of first month
    end: date                       # last day of last month


@dataclass
class Event:
    source: str
    title: str
    start: str                 # ISO-8601 with offset, or YYYY-MM-DD when all_day
    end: str | None = None
    all_day: bool = False
    url: str | None = None
    location: str | None = None
    description: str | None = None

    @property
    def uid(self) -> str:
        h = hashlib.sha1(f"{self.source}|{self.title}|{self.start}|{self.url or ''}".encode()).hexdigest()[:12]
        return f"{self.source}-{h}"

    def to_dict(self) -> dict:
        d = {"id": self.uid, "source": self.source, "title": self.title,
             "start": self.start, "all_day": self.all_day}
        for k in ("end", "url", "location", "description"):
            v = getattr(self, k)
            if v:
                d[k] = v
        return d


_session: Session | None = None


def _origin(url: str) -> str:
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}"


def browser_headers(url: str, *, kind: str = "xhr", referer: str | None = None,
                    method: str = "GET", jquery: bool = False) -> dict:
    """Per-request headers a real Chrome would add on top of BASE_HEADERS.

    kind="document": top-level navigation (address bar / link click).
    kind="xhr": fetch/XMLHttpRequest issued by a page (pass that page as referer);
    jquery=True adds X-Requested-With like jQuery does.
    A None value tells curl_cffi to drop that header from the profile defaults.
    """
    h: dict[str, str | None] = {}
    if kind == "document":
        h["Accept"] = ("text/html,application/xhtml+xml,application/xml;q=0.9,"
                       "image/avif,image/webp,image/apng,*/*;q=0.8,"
                       "application/signed-exchange;v=b3;q=0.7")
        same = referer is not None and _origin(referer) == _origin(url)
        h["Sec-Fetch-Site"] = "same-origin" if same else "none"
        h["Sec-Fetch-Mode"] = "navigate"
        h["Sec-Fetch-Dest"] = "document"
        h["Sec-Fetch-User"] = "?1"
        h["Upgrade-Insecure-Requests"] = "1"
    else:
        h["Accept"] = "*/*"
        page_origin = _origin(referer) if referer else _origin(url)
        cross = page_origin != _origin(url)
        h["Sec-Fetch-Site"] = "cross-site" if cross else "same-origin"
        h["Sec-Fetch-Mode"] = "cors"
        h["Sec-Fetch-Dest"] = "empty"
        h["Sec-Fetch-User"] = None              # navigation-only headers in the profile
        h["Upgrade-Insecure-Requests"] = None
        if cross or method.upper() != "GET":   # Chrome's Origin rules for CORS/POST
            h["Origin"] = page_origin
        if jquery:
            h["X-Requested-With"] = "XMLHttpRequest"
    if referer:
        h["Referer"] = referer
    return h


def session() -> Session:
    # One session for the whole run: cookies (Rezdy's AWSALB/PHPSESSID, Cloudflare's
    # __cf_bm) persist across requests like a browser tab; HTTP/2 via ALPN.
    global _session
    if _session is None:
        _session = Session(
            impersonate=IMPERSONATE,
            allow_redirects=True,
            timeout=TIMEOUT,
            headers=BASE_HEADERS,
        )
    return _session


def _request(method: str, url: str, **kw) -> Response:
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            r = session().request(method, url, **kw)
        except RequestException as exc:   # transport errors (DNS, TLS, timeout)
            last = exc
            if attempt < RETRIES - 1:
                time.sleep(2 * (attempt + 1))
            continue
        if r.ok:
            return r
        status = r.status_code
        last = HTTPError(f"HTTP {status} for {r.url}", 0, r)
        if attempt >= RETRIES - 1:
            break
        if status in (429, 503):   # rate limited — honour Retry-After, else back off hard
            ra = r.headers.get("retry-after", "")
            wait = int(ra) if ra.isdigit() else BACKOFF_429 * (attempt + 1)
            print(f"    rate limited ({status}) on {url} — waiting {min(wait, MAX_BACKOFF)}s")
            time.sleep(min(wait, MAX_BACKOFF))
        elif status >= 500:
            time.sleep(2 * (attempt + 1))
        else:
            break   # other 4xx — retrying identical requests won't help
    raise last


def get(url: str, **kw) -> Response:
    return _request("GET", url, **kw)


def post(url: str, **kw) -> Response:
    return _request("POST", url, **kw)


def polite_sleep(seconds: float | None = None) -> None:
    time.sleep(REQUEST_DELAY if seconds is None else seconds)


def clean_text(s: str | None) -> str | None:
    if not s:
        return None
    s = s.replace("\xa0", " ")
    s = re.sub(r"[ \t\r\f]+", " ", s)
    s = re.sub(r"\s*\n\s*", "\n", s).strip()
    return s or None


TIME_12H = re.compile(r"^\s*(\d{1,2})[:.](\d{2})\s*([AaPp])\.?[Mm]\.?\s*$")
TIME_24H = re.compile(r"^\s*(\d{1,2}):(\d{2})\s*$")


def parse_time(text: str | None) -> tuple[int, int] | None:
    """'9:00 AM' / '18:30' -> (hour, minute); None for 'All day'/unparseable."""
    if not text:
        return None
    m = TIME_12H.match(text)
    if m:
        h, mi, ap = int(m.group(1)), int(m.group(2)), m.group(3).lower()
        if h > 12:   # "13:00 PM" — already 24-hour despite the suffix (seen on DiveShop360)
            return (h, mi) if h < 24 and mi < 60 else None
        if ap == "p" and h != 12:
            h += 12
        if ap == "a" and h == 12:
            h = 0
        return (h, mi)
    m = TIME_24H.match(text)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        if h < 24 and mi < 60:
            return (h, mi)
    return None


def sydney_iso(d: date, hm: tuple[int, int] | None) -> str:
    """ISO string for a Sydney-local date(+time). Date-only when hm is None."""
    if hm is None:
        return d.isoformat()
    dt = datetime(d.year, d.month, d.day, hm[0], hm[1], tzinfo=SYDNEY)
    return dt.isoformat(timespec="minutes")
