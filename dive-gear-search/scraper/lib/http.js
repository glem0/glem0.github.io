// Small HTTP helper for the scrapers: realistic User-Agent, timeouts, retries with
// backoff, a per-host politeness limiter so we never hammer a retailer, and a response-size cap.
//
// The whole request (headers AND body) is read inside the timeout and while the per-host slot is
// held, so "30 s timeout" and "2 in flight" are true for complete responses, not just for the
// time-to-headers, and a multi-GB or slowly trickling body cannot pin the job until the workflow's
// timeout-minutes. fetchResponse() therefore returns the Response with its body already read into
// `res.bodyText` (never call res.text()/res.json() on it).

// Requests look like a current desktop Chrome. Since Chrome 101 the UA string is "reduced": the
// platform is frozen at 10_15_7 and only the major version moves, so bumping CHROME_MAJOR now and
// then (chrome://version, or https://chromiumdash.appspot.com/releases) keeps it current. The
// sec-ch-ua client hints are what Chrome sends alongside it and are kept consistent with it.
const CHROME_MAJOR = 153; // stable in September 2026
export const USER_AGENT = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`;
export const BROWSER_HEADERS = {
  'user-agent': USER_AGENT,
  'sec-ch-ua': `"Google Chrome";v="${CHROME_MAJOR}", "Chromium";v="${CHROME_MAJOR}", "Not_A Brand";v="24"`,
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'accept-language': 'en-AU,en;q=0.9',
};

const DEFAULTS = {
  timeoutMs: 30_000,
  retries: 4,
  perHostConcurrency: 2,
  perHostMinDelayMs: 350,
  // The largest real page today is ~1.4 MB (a Shopify products.json page) and the previous-data
  // fallback JSON ~3.3 MB; the curl path in scubadoctor.js has a comparable 64 MB maxBuffer.
  maxBodyBytes: 32 * 1024 * 1024,
};

/** Per-host queue: at most N in flight and at least `minDelay` between request starts. */
class HostLimiter {
  constructor(concurrency, minDelayMs) {
    this.concurrency = concurrency;
    this.minDelayMs = minDelayMs;
    this.active = 0;
    this.lastStart = 0;
    this.queue = [];
  }
  async acquire() {
    if (this.active >= this.concurrency) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    // Reserve the start slot before sleeping: two waiters that computed the same wake time used to
    // start together (0 ms apart), so pairs of requests hit the shop every minDelay instead of one.
    const start = Math.max(Date.now(), this.lastStart + this.minDelayMs);
    this.lastStart = start;
    const wait = start - Date.now();
    if (wait > 0) await sleep(wait);
  }
  release() {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

const limiters = new Map();
function limiterFor(url, opts) {
  const host = new URL(url).host;
  if (!limiters.has(host)) {
    limiters.set(host, new HostLimiter(opts.perHostConcurrency, opts.perHostMinDelayMs));
  }
  return limiters.get(host);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(status, url, bodySnippet) {
    super(`HTTP ${status} for ${url}${bodySnippet ? `: ${bodySnippet}` : ''}`);
    this.status = status;
    this.url = url;
  }
}

/** Thrown (and never retried) when a response body exceeds opts.maxBodyBytes. */
export class BodyTooLargeError extends Error {
  constructor(url, bytes, limit) {
    super(`response body exceeds ${limit} bytes (${bytes}${bytes === limit ? '+' : ''} received) for ${url}`);
    this.url = url;
    this.limit = limit;
  }
}

/**
 * Read a Response body as UTF-8 text, at most `limit` bytes. Throws BodyTooLargeError as soon as the
 * limit is passed (Content-Length first, then while streaming) unless `truncate`, in which case the
 * first `limit` bytes are returned. Breaking out of the loop cancels the stream and frees the socket.
 */
async function readBody(res, url, limit, { truncate = false } = {}) {
  const declared = Number(res.headers.get('content-length'));
  if (!truncate && Number.isFinite(declared) && declared > limit) throw new BodyTooLargeError(url, declared, limit);
  const chunks = [];
  let total = 0;
  if (res.body) {
    for await (const chunk of res.body) {
      total += chunk.length;
      if (total > limit) {
        if (!truncate) throw new BodyTooLargeError(url, limit, limit);
        chunks.push(chunk.subarray(0, chunk.length - (total - limit)));
        break;
      }
      chunks.push(chunk);
    }
  }
  // TextDecoder (like Response.text()) drops a leading BOM, which JSON.parse would choke on.
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
}

/**
 * Fetch a URL and return the Response (already checked for 2xx unless opts.allowStatus) with its
 * body read into `res.bodyText` (capped at opts.maxBodyBytes, read within opts.timeoutMs).
 * Retries on network errors, 429 and 5xx with exponential backoff; not on an oversized body.
 */
export async function fetchResponse(url, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const limiter = limiterFor(url, o);
  let lastErr;
  for (let attempt = 0; attempt <= o.retries; attempt += 1) {
    await limiter.acquire();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), o.timeoutMs);
    try {
      const res = await fetch(url, {
        method: o.method || 'GET',
        headers: {
          ...BROWSER_HEADERS,
          accept: o.accept || 'application/json, text/html;q=0.9, */*;q=0.8',
          ...(o.headers || {}),
        },
        body: o.body,
        redirect: 'follow',
        signal: controller.signal,
      });
      if (res.ok || (o.allowStatus && o.allowStatus.includes(res.status))) {
        res.bodyText = await readBody(res, url, o.maxBodyBytes);
        return res;
      }
      const retryable = res.status === 429 || res.status >= 500;
      const snippet = (await readBody(res, url, 4096, { truncate: true }).catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
      lastErr = new HttpError(res.status, url, snippet);
      if (!retryable) throw lastErr;
      // Shopify/Cloudflare send Retry-After on 429/503; honour it (capped) instead of the default backoff.
      const ra = Number(res.headers.get('retry-after'));
      lastErr.retryAfterMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 90) * 1000 : 0;
    } catch (err) {
      if (err instanceof BodyTooLargeError) throw err;
      if (err instanceof HttpError && !(err.status === 429 || err.status >= 500)) throw err;
      lastErr = err;
    } finally {
      clearTimeout(timer);
      limiter.release();
    }
    if (attempt < o.retries) await sleep(Math.max(lastErr?.retryAfterMs || 0, 1000 * 2 ** attempt) + Math.random() * 250);
  }
  throw lastErr;
}

export async function fetchText(url, opts = {}) {
  const res = await fetchResponse(url, opts);
  return res.bodyText;
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchResponse(url, { accept: 'application/json', ...opts });
  const text = res.bodyText;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
}

/** Tiny helper: run `fn` over items with bounded concurrency, preserving order. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
