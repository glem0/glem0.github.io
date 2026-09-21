// Dependency-free helpers for the few sites that only expose HTML.
// Deliberately small: JSON-LD extraction, entity decoding, attribute/tag scraping by regex.

// The XML five plus the named entities retailers actually put in product names ("360&deg;",
// "26&rdquo;", "&ndash;"). Unknown names are left as-is (keys are matched lowercased).
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
  deg: '°', rdquo: '”', ldquo: '“', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
  trade: '™', reg: '®', copy: '©', plusmn: '±', times: '×', laquo: '«', raquo: '»', pound: '£', euro: '€',
  frac12: '½', frac14: '¼', frac34: '¾',
};

export function decodeEntities(s) {
  if (!s) return '';
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return e.toLowerCase() in ENTITIES ? ENTITIES[e.toLowerCase()] : m;
  });
}

// Every regex here that skips over a tag's attributes uses [^<>] rather than [^>]: with [^>] each
// unclosed '<' rescans to the next '>' (or end of input), which is quadratic on hostile or corrupted
// pages (1 MB of '<' took >20 s) and all of this runs on retailer-controlled HTML every night.

/** Drop <script ...>...</script> blocks (and everything after an unclosed <script) in linear time. */
function dropScripts(s) {
  const lower = s.replace(/[A-Z]/g, (c) => c.toLowerCase()); // ASCII-only, so offsets stay aligned with s
  let out = '';
  let i = 0;
  for (;;) {
    const a = lower.indexOf('<script', i);
    if (a < 0) return out + s.slice(i);
    out += s.slice(i, a);
    const b = lower.indexOf('</script', a + 7);
    if (b < 0) return out;
    const gt = lower.indexOf('>', b);
    i = gt < 0 ? s.length : gt + 1;
  }
}

export function stripTags(s) {
  return decodeEntities(dropScripts(String(s || '')).replace(/<[^<>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** All <script type="application/ld+json"> blocks parsed (invalid ones skipped). */
export function extractJsonLd(html) {
  const out = [];
  const re = /<script[^<>]*type=["']application\/ld\+json["'][^<>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed && Array.isArray(parsed['@graph'])) out.push(...parsed['@graph']);
      else out.push(parsed);
    } catch {
      /* ignore malformed block */
    }
  }
  return out;
}

/** First match group of a regex against html, entity-decoded, or ''. */
export function match1(html, re) {
  const m = re.exec(html);
  return m ? decodeEntities(m[1]).trim() : '';
}

/** All match groups of a global regex. */
export function matchAll(html, re) {
  const out = [];
  let m;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = g.exec(html))) out.push(m.slice(1).map((x) => decodeEntities(x ?? '')));
  return out;
}

/** Content of <meta property="..."> or <meta name="..."> */
export function metaContent(html, key) {
  const re = new RegExp(`<meta[^<>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^<>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^<>]+content=["']([^"']*)["'][^<>]*(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
  return match1(html, re) || match1(html, re2);
}

/** Resolve a possibly-relative URL against a base. */
export function absUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

/** Extract <loc> entries from a sitemap XML string. */
export function sitemapLocs(xml) {
  return matchAll(xml, /<loc>\s*([^<\s]+)\s*<\/loc>/gi).map((m) => m[0]);
}
