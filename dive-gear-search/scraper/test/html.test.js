// lib/html.js: tag stripping must be correct AND linear, because it runs on retailer-controlled HTML
// (Shopify body_html, WooCommerce descriptions, every Tec Dive Gear page) every night.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTags, extractJsonLd, metaContent, matchAll } from '../lib/html.js';

const timed = (fn) => {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
};

test('html: stripTags removes tags and script blocks and decodes entities', () => {
  assert.equal(stripTags('<p>Hello <b>world</b> &amp; 360&deg;</p>'), 'Hello world & 360°');
  assert.equal(stripTags('<SCRIPT type="text/javascript">alert(1)</SCRIPT>after<script>x</script >end'), 'afterend');
  assert.equal(stripTags('before<script>never closed'), 'before', 'an unclosed <script> drops the rest, never leaks its code');
  assert.equal(stripTags('a < b and <i>c</i> > d'), 'a < b and c > d', 'lone angle brackets in text survive');
  assert.equal(stripTags('<a href="x" title="q>r">t</a>'), 'r">t', 'same result as before for a > inside an attribute');
  assert.equal(stripTags(null), '');
});

test('html: stripTags and matchAll stay linear on hostile input (quadratic backtracking regression)', () => {
  const n = 300_000;
  for (const [label, input] of [
    ['<', '<'.repeat(n)],
    ['<a ', '<a '.repeat(n / 3)],
    ['<script', '<script'.repeat(n / 7)],
  ]) {
    const ms = timed(() => stripTags(input));
    assert.ok(ms < 2000, `stripTags on ${n} bytes of '${label}' took ${ms.toFixed(0)} ms`);
  }
  const ms = timed(() => matchAll('<'.repeat(n), /<[^<>]+>/g));
  assert.ok(ms < 2000, `matchAll tag scan took ${ms.toFixed(0)} ms`);
});

test('html: extractJsonLd and metaContent still parse normal markup', () => {
  const html = `<html><head>
    <meta property="og:title" content="Apeks XTX50">
    <meta content="A reg" name="description">
    <script type="application/ld+json">{"@type":"Product","name":"XTX50"}</script>
    <script type="application/ld+json">not json</script>
  </head></html>`;
  assert.deepEqual(extractJsonLd(html), [{ '@type': 'Product', name: 'XTX50' }]);
  assert.equal(metaContent(html, 'og:title'), 'Apeks XTX50');
  assert.equal(metaContent(html, 'description'), 'A reg');
  const ms = timed(() => extractJsonLd('<script type="application/ld+json"'.repeat(10_000)));
  assert.ok(ms < 2000, `extractJsonLd on unclosed script tags took ${ms.toFixed(0)} ms`);
});
