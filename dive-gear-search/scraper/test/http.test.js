// lib/http.js against a local server: per-host spacing, the response-size cap and the whole-request timeout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchText, fetchJson, fetchResponse, BodyTooLargeError } from '../lib/http.js';

/** Start a throwaway server (its own port = its own host limiter), run fn(baseUrl, hits), close it. */
async function withServer(handler, fn) {
  const hits = [];
  const srv = http.createServer((req, res) => {
    hits.push({ url: req.url, at: Date.now() });
    res.on('error', () => {});
    handler(req, res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    return await fn(`http://127.0.0.1:${srv.address().port}`, hits);
  } finally {
    srv.closeAllConnections?.();
    await new Promise((r) => srv.close(r));
  }
}

test('http: request starts on one host are spaced by perHostMinDelayMs even with two in flight', async () => {
  await withServer((req, res) => setTimeout(() => res.end('ok'), 30), async (base, hits) => {
    const opts = { perHostMinDelayMs: 100, retries: 0 };
    const out = await Promise.all(Array.from({ length: 6 }, (_, i) => fetchText(`${base}/p${i}`, opts)));
    assert.deepEqual(out, Array(6).fill('ok'));
    const times = hits.map((h) => h.at).sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    // Before the slot was reserved up front, two waiters woke together and the smallest gap was 0 ms.
    assert.ok(Math.min(...gaps) >= 80, `gaps between request starts were ${gaps.join(', ')} ms`);
  });
});

test('http: a body above maxBodyBytes is rejected up front from Content-Length and not retried', async () => {
  const body = 'x'.repeat(1000);
  await withServer((req, res) => res.end(body), async (base, hits) => {
    await assert.rejects(fetchText(`${base}/big`, { maxBodyBytes: 500, retries: 3 }), BodyTooLargeError);
    assert.equal(hits.length, 1, 'oversized responses must not burn the retry ladder');
    assert.equal(await fetchText(`${base}/ok`, { maxBodyBytes: 1000, retries: 0 }), body, 'a body exactly at the cap is fine');
  });
});

test('http: a chunked body that grows past maxBodyBytes is cut off mid-stream', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'transfer-encoding': 'chunked' });
    for (let i = 0; i < 20; i += 1) res.write('y'.repeat(1024));
    res.end();
  }, async (base, hits) => {
    await assert.rejects(fetchText(`${base}/stream`, { maxBodyBytes: 4096, retries: 2 }), BodyTooLargeError);
    assert.equal(hits.length, 1);
  });
});

test('http: fetchJson/fetchResponse read the body once, BOM stripped, headers still available', async () => {
  await withServer((req, res) => {
    res.setHeader('x-wp-total', '42');
    res.end(req.url === '/bom' ? '﻿{"a":1}' : '{"a":2}');
  }, async (base) => {
    assert.deepEqual(await fetchJson(`${base}/bom`, { retries: 0 }), { a: 1 });
    const res = await fetchResponse(`${base}/plain`, { retries: 0 });
    assert.equal(res.bodyText, '{"a":2}');
    assert.equal(res.headers.get('x-wp-total'), '42');
  });
});

test('http: the timeout covers the body, not just the headers', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.write('partial'); // then never finishes
    req.on('close', () => res.destroy());
  }, async (base, hits) => {
    const t0 = Date.now();
    await assert.rejects(fetchText(`${base}/trickle`, { timeoutMs: 300, retries: 0 }));
    assert.ok(Date.now() - t0 < 5000, 'aborted by the timer rather than hanging on the body');
    assert.equal(hits.length, 1);
  });
});
