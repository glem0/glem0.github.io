#!/usr/bin/env python3
"""
Update apple-cve/index.html with new Apple security releases.

Discovers iOS/iPadOS/macOS releases on Apple's security releases index
(https://support.apple.com/en-us/100100), scrapes the advisory page of any
release not yet embedded in index.html, and appends matching DATA.push()
blocks. Prints one "ADDED: <release>" line per new release; touches the file
only when there is something new.

Usage:
  python3 update.py [path/to/index.html]     # default: index.html next to this script

No dependencies beyond Python 3 stdlib (falls back to curl for fetching).
Parsers are shared with the original generator (scrape.py in the source repo).
"""
import html as html_module
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

INDEX_URL = "https://support.apple.com/en-us/100100"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/121 Safari/537.36")


# ---------------------------------------------------------------- fetching

def _fetch_urllib(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8', errors='replace')


def _fetch_curl(url):
    p = subprocess.run(
        ["curl", "-sL", "--compressed", "--max-time", "30",
         "-H", "User-Agent: " + UA, url],
        capture_output=True, text=True)
    if p.returncode == 0 and p.stdout.strip():
        return p.stdout
    return None


def fetch_url(url, retries=3):
    for attempt in range(retries):
        html = None
        try:
            html = _fetch_urllib(url)
        except Exception:
            html = _fetch_curl(url)
        if html:
            # Follow the canonical URL once; support.apple.com sometimes serves
            # a stub at the short URL.
            m = re.search(r'<link rel="canonical" href="([^"]+)"', html)
            if m and m.group(1) != url and 'support.apple.com' in m.group(1):
                try:
                    html2 = _fetch_urllib(m.group(1))
                except Exception:
                    html2 = _fetch_curl(m.group(1))
                if html2:
                    return html2
            return html
        time.sleep(2 * (attempt + 1))
    return None


# ------------------------------------------------- advisory page parsing
# Vendored from scrape.py (the original generator) — keep behavior identical
# so newly scraped entries match the embedded ones.

SKIP_EXACT = {'Impact', 'Description', 'CVE', 'Available for', 'Entry added', 'Entry updated',
              'Note', 'Released', 'This document', 'For our customers'}
SKIP_PREFIXES = ('iOS ', 'iPadOS ', 'macOS ', 'tvOS ', 'watchOS ', 'Safari ', 'Xcode ',
                 'Additional ', 'Entry ', 'About ', 'Apple security', 'Apple Product')


def is_skip_name(name):
    if not name or len(name) < 2 or len(name) > 80:
        return True
    if re.match(r'^\d', name):
        return True
    if name in SKIP_EXACT:
        return True
    return any(name.startswith(p) for p in SKIP_PREFIXES)


def combine_impact_desc(impact, description):
    impact = (impact or '').strip().rstrip('.')
    description = (description or '').strip().rstrip('.')
    if impact and description:
        return f"{impact}. {description}"
    return impact or description or "Security issue addressed"


def extract_impact_and_desc(text):
    text_clean = re.sub(r'<[^>]+>', ' ', text)
    text_clean = re.sub(r'\s+', ' ', text_clean).strip()

    impact = None
    description = None

    m = re.search(r'Impact:\s*(.+?)(?:\s*Description:|\s*CVE-|\s*Available for|\s*Entry|\s*$)', text_clean)
    if m:
        impact = m.group(1).strip().rstrip('.')

    m = re.search(r'Description:\s*(.+?)(?:\s*CVE-|\s*Entry|\s*$)', text_clean)
    if m:
        description = m.group(1).strip().rstrip('.')

    if not impact and not description:
        m = re.search(r'(?:^|\. )([A-Z][^.]*(?:may|could|might|can|able to|addressed|issue|vulnerability|problem|flaw)[^.]*)', text_clean)
        if m:
            return m.group(1).strip().rstrip('.')

    return combine_impact_desc(impact, description)


def parse_h3_format(html):
    text = re.sub(r'<br\s*/?>', '\n', html)
    text = re.sub(r'</?(?:span|div|a|em|i|u)[^>]*>', '', text)
    parts = re.split(r'<(?:h3|strong)[^>]*>\s*([^<]+?)\s*</(?:h3|strong)>', text)
    vulns, comp = [], None
    for i, part in enumerate(parts):
        if i % 2 == 1:
            if not is_skip_name(part.strip()):
                comp = part.strip()
            continue
        if comp and part.strip():
            cves = re.findall(r'CVE-\d{4}-\d+', part)
            if cves:
                vulns.append({'component': comp,
                              'description': extract_impact_and_desc(part),
                              'cves': list(dict.fromkeys(cves))})
                comp = None
    return vulns


def parse_gb_paragraph_format(html):
    paragraphs = re.findall(r'<p[^>]*class="gb-paragraph"[^>]*>(.*?)</p>', html, re.DOTALL)
    if not paragraphs:
        paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL)
    vulns, comp, impact, desc, cves = [], None, None, None, []
    for p in paragraphs:
        p_clean = re.sub(r'<[^>]+>', '', p).strip()
        bold = re.search(r'<b>([^<]+)</b>', p)
        if bold:
            name = bold.group(1).strip()
            if is_skip_name(name):
                continue
            if comp and cves:
                vulns.append({'component': comp,
                              'description': combine_impact_desc(impact, desc),
                              'cves': list(dict.fromkeys(cves))})
            comp, impact, desc, cves = name, None, None, []
            continue
        if not comp:
            continue
        m = re.match(r'^Impact:\s*(.+)', p_clean)
        if m:
            impact = m.group(1).strip().rstrip('.')
            continue
        m = re.match(r'^Description:\s*(.+)', p_clean)
        if m:
            desc = m.group(1).strip().rstrip('.')
            continue
        found = re.findall(r'CVE-\d{4}-\d+', p_clean)
        if found:
            cves.extend(found)
    if comp and cves:
        vulns.append({'component': comp,
                      'description': combine_impact_desc(impact, desc),
                      'cves': list(dict.fromkeys(cves))})
    return vulns


def parse_bold_format(html):
    parts = re.split(r'<(?:b|strong)>([^<]{2,60})</(?:b|strong)>', html)
    vulns, comp = [], None
    for i, part in enumerate(parts):
        if i % 2 == 1:
            if not is_skip_name(part.strip()):
                comp = part.strip()
            continue
        if comp and part:
            cves = re.findall(r'CVE-\d{4}-\d+', part)
            if cves:
                vulns.append({'component': comp,
                              'description': extract_impact_and_desc(part),
                              'cves': list(dict.fromkeys(cves))})
                comp = None
    return vulns


def parse_security_page(html):
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    for parser in (parse_h3_format, parse_gb_paragraph_format, parse_bold_format):
        vulns = parser(html)
        if vulns:
            return vulns
    return []


def escape_js(s):
    s = s.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'").replace('\n', ' ').replace('\r', '')
    return re.sub(r'\s+', ' ', s).strip()


def format_entry(name, os_type, date, vulns):
    if not vulns:
        return None
    lines = [f'DATA.push({{r:"{escape_js(name)}",os:"{os_type}",d:"{date}",v:[']
    for v in vulns:
        cve_str = ','.join(f'"{c}"' for c in v['cves'])
        lines.append(f'  {{c:"{escape_js(v["component"])}",desc:"{escape_js(v["description"])}",cve:[{cve_str}]}},')
    lines.append(']});')
    return '\n'.join(lines)


# ------------------------------------------------- release index parsing

def clean_text(fragment):
    t = re.sub(r'<[^>]+>', ' ', fragment)
    t = html_module.unescape(t).replace('\u00a0', ' ')
    return re.sub(r'\s+', ' ', t).strip()


def parse_release_index(html):
    """Rows of the 100100 table -> [{name, url, date, os}] for iOS/iPadOS/macOS.
    Rows without a link have no published CVE entries and are skipped."""
    releases = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if len(cells) < 3:
            continue
        link = re.search(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', cells[0], re.DOTALL)
        if not link:
            continue
        name = clean_text(link.group(2))
        date = clean_text(cells[2])
        if not re.match(r'^\d{1,2} [A-Z][a-z]{2,8} \d{4}$', date):
            continue
        if name.startswith(('iOS ', 'iPadOS ')):
            os_type = 'ios'
        elif name.startswith('macOS '):
            os_type = 'macos'
        else:
            continue
        name = name.replace(' and iPadOS', ' / iPadOS')
        url = link.group(1)
        if url.startswith('/'):
            url = 'https://support.apple.com' + url
        releases.append({'name': name, 'url': url, 'date': date, 'os': os_type})
    return releases


# ----------------------------------------------------------------- main

def main():
    default_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')
    index_path = sys.argv[1] if len(sys.argv) > 1 else default_path

    with open(index_path, encoding='utf-8') as f:
        page = f.read()

    existing = set(re.findall(r'DATA\.push\(\{r:"([^"]*)"', page))
    if not existing:
        sys.exit("ERROR: no existing DATA.push blocks found — wrong file?")

    index_html = fetch_url(INDEX_URL)
    if not index_html:
        sys.exit("ERROR: could not fetch " + INDEX_URL)

    releases = parse_release_index(index_html)
    if not releases:
        sys.exit("ERROR: release table parsed empty — page layout may have changed")

    seen = set()
    new = []
    for r in releases:
        if r['name'] in existing or r['name'] in seen:
            continue
        seen.add(r['name'])
        new.append(r)

    if not new:
        print("No new releases.")
        return

    blocks = []
    for r in reversed(new):  # oldest first, keeping the file roughly chronological
        html = fetch_url(r['url'])
        vulns = parse_security_page(html) if html else []
        if not vulns:
            print(f"WARN: no CVE entries parsed for {r['name']} ({r['url']})", file=sys.stderr)
            continue
        blocks.append(format_entry(r['name'], r['os'], r['date'], vulns))
        ncve = sum(len(v['cves']) for v in vulns)
        print(f"ADDED: {r['name']} ({ncve} CVEs)")
        time.sleep(0.5)

    if not blocks:
        print("No new releases.")
        return

    anchor = page.index('</script>', page.index('const DATA = [];'))
    page = page[:anchor] + '\n'.join(blocks) + '\n' + page[anchor:]
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    page = re.sub(r'const DATA_UPDATED = "[^"]*";',
                  'const DATA_UPDATED = "' + stamp + '";', page, count=1)
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(page)


if __name__ == '__main__':
    main()
