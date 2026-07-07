"""Shared plumbing for the dive-calendar scrapers."""
from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from datetime import date, datetime
from urllib.parse import urlencode, urlsplit
from zoneinfo import ZoneInfo

import httpx

SYDNEY = ZoneInfo("Australia/Sydney")

# One consistent Chrome identity — bump CHROME_MAJOR periodically; a stale UA is
# itself a bot signal. (Chrome froze the macOS platform token at 10_15_7.)
CHROME_MAJOR = "138"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      f"(KHTML, like Gecko) Chrome/{CHROME_MAJOR}.0.0.0 Safari/537.36")
SEC_CH_UA = (f'"Google Chrome";v="{CHROME_MAJOR}", '
             f'"Chromium";v="{CHROME_MAJOR}", "Not=A?Brand";v="8"')

# sent on every request, like Chrome's client hints
BASE_HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "en-AU,en;q=0.9",
    "sec-ch-ua": SEC_CH_UA,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
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


_session: httpx.Client | None = None


def _origin(url: str) -> str:
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}"


def browser_headers(url: str, *, kind: str = "xhr", referer: str | None = None,
                    method: str = "GET", jquery: bool = False) -> dict:
    """Per-request headers a real Chrome would add on top of BASE_HEADERS.

    kind="document": top-level navigation (address bar / link click).
    kind="xhr": fetch/XMLHttpRequest issued by a page (pass that page as referer);
    jquery=True adds X-Requested-With like jQuery does.
    """
    h: dict[str, str] = {}
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
        if cross or method.upper() != "GET":   # Chrome's Origin rules for CORS/POST
            h["Origin"] = page_origin
        if jquery:
            h["X-Requested-With"] = "XMLHttpRequest"
    if referer:
        h["Referer"] = referer
    return h


def session() -> httpx.Client:
    # HTTP/2 is required: Rezdy's load balancer answers 405/bot-wall on HTTP/1.1.
    # With brotli+zstandard installed httpx advertises Chrome's full
    # "gzip, deflate, br, zstd" Accept-Encoding. Cookies persist like a browser tab.
    global _session
    if _session is None:
        _session = httpx.Client(
            http2=True,
            follow_redirects=True,
            timeout=TIMEOUT,
            headers=BASE_HEADERS,
        )
    return _session


def _request(method: str, url: str, **kw) -> httpx.Response:
    last = None
    for attempt in range(RETRIES):
        try:
            r = session().request(method, url, **kw)
            r.raise_for_status()
            return r
        except httpx.HTTPStatusError as exc:
            last = exc
            if attempt >= RETRIES - 1:
                break
            status = exc.response.status_code
            if status in (429, 503):   # rate limited — honour Retry-After, else back off hard
                ra = exc.response.headers.get("retry-after", "")
                wait = int(ra) if ra.isdigit() else BACKOFF_429 * (attempt + 1)
                print(f"    rate limited ({status}) on {url} — waiting {min(wait, MAX_BACKOFF)}s")
                time.sleep(min(wait, MAX_BACKOFF))
            elif status >= 500:
                time.sleep(2 * (attempt + 1))
            else:
                break   # other 4xx — retrying identical requests won't help
        except httpx.HTTPError as exc:   # transport errors
            last = exc
            if attempt < RETRIES - 1:
                time.sleep(2 * (attempt + 1))
    raise last


def get(url: str, **kw) -> httpx.Response:
    return _request("GET", url, **kw)


def post(url: str, **kw) -> httpx.Response:
    return _request("POST", url, **kw)


def curl_fetch(url: str, *, params: dict | None = None, data: dict | None = None,
               headers: dict | None = None, cookie_jar: str | None = None) -> str:
    """HTTP/2 fetch via the system curl.

    Rezdy's AWS WAF fingerprints the TLS client and rejects Python HTTP stacks
    (405 + human-verification page) while accepting curl, so those requests
    shell out. Sends the same browser identity headers as the httpx session;
    pass cookie_jar (a file path) to persist cookies across calls like a
    browser session. Returns the response body; raises on curl error/non-200.
    """
    if shutil.which("curl") is None:
        raise RuntimeError("curl not found on PATH (needed for Rezdy sources)")
    if params:
        url = f"{url}?{urlencode(params)}"
    cmd = ["curl", "-sS", "--http2", "--compressed", "--max-time", str(TIMEOUT),
           "-A", UA, "-D", "-", "-w", "\n%{http_code}"]
    if cookie_jar:
        cmd += ["-b", cookie_jar, "-c", cookie_jar]
    all_headers = {k: v for k, v in BASE_HEADERS.items() if k != "User-Agent"}
    all_headers.update(headers or {})
    for k, v in all_headers.items():
        cmd += ["-H", f"{k}: {v}"]
    if data is not None:
        cmd += ["--data", urlencode(data)]
    cmd.append(url)

    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT + 15)
            if out.returncode != 0:
                raise RuntimeError(f"curl exit {out.returncode}: {out.stderr.strip()[:200]}")
            raw, _, status = out.stdout.rpartition("\n")
            # -D - prefixes response headers; blank-line boundary may be \n\n or \r\n\r\n
            parts = re.split(r"\r?\n\r?\n", raw, maxsplit=1)
            head, body = (parts[0], parts[1]) if len(parts) == 2 else ("", raw)
            status = status.strip()
            if status == "200":
                return body
            if status in ("429", "503") and attempt < RETRIES - 1:
                m = re.search(r"^retry-after:\s*(\d+)", head, re.I | re.M)
                wait = int(m.group(1)) if m else BACKOFF_429 * (attempt + 1)
                print(f"    rate limited ({status}) on {url} — waiting {min(wait, MAX_BACKOFF)}s")
                time.sleep(min(wait, MAX_BACKOFF))
                last = RuntimeError(f"curl HTTP {status} for {url}")
                continue
            raise RuntimeError(f"curl HTTP {status} for {url}")
        except RuntimeError as exc:
            last = exc
            if "curl HTTP" in str(exc):
                raise                      # non-retryable status already decided above
            if attempt < RETRIES - 1:
                time.sleep(2 * (attempt + 1))
        except subprocess.TimeoutExpired as exc:
            last = exc
            if attempt < RETRIES - 1:
                time.sleep(2 * (attempt + 1))
    raise last


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
