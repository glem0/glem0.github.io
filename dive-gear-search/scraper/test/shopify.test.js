// lib/shopify.js: the pinned market context on storefront URLs, and the currency guard that keeps a
// catalogue served in another currency (Shopify Markets, seen from a US runner) out of the index.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { MARKET, withMarket, parseStoreCurrency, assertMarket, shopifyToProduct } from '../lib/shopify.js';

test('withMarket appends country and currency whether or not the URL has a query already', () => {
  assert.equal(withMarket('https://s.example/products.json?limit=250&page=2'), 'https://s.example/products.json?limit=250&page=2&country=AU&currency=AUD');
  assert.equal(withMarket('https://s.example/'), 'https://s.example/?country=AU&currency=AUD');
  assert.deepEqual(MARKET, { country: 'AU', currency: 'AUD' });
});

test('parseStoreCurrency reads the theme marker and tolerates its absence or junk', () => {
  assert.deepEqual(parseStoreCurrency('<script>Shopify.currency = {"active":"USD","rate":"0.72688872"};</script>'), { active: 'USD', rate: 0.72688872 });
  assert.deepEqual(parseStoreCurrency('var x; Shopify.currency={"active":"AUD","rate":"1.0"}'), { active: 'AUD', rate: 1 });
  assert.equal(parseStoreCurrency('<html>no marker</html>'), null);
  assert.equal(parseStoreCurrency('Shopify.currency = {broken'), null);
  assert.equal(parseStoreCurrency(''), null);
});

async function withStore(html, fn) {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(typeof html === 'function' ? html(req) : html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('assertMarket: AUD passes, another currency throws (so the retailer goes stale), no marker is only logged', async () => {
  await withStore('<script>Shopify.currency = {"active":"AUD","rate":"1.0"};</script>', async (base) => {
    assert.deepEqual(await assertMarket(base), { active: 'AUD', rate: 1 });
  });
  let seenUrl = '';
  await withStore((req) => { seenUrl = req.url; return 'Shopify.currency = {"active":"USD","rate":"0.72688872"};'; }, async (base) => {
    await assert.rejects(() => assertMarket(base), /storefront answers in USD \(rate 0\.72688872\) despite \?country=AU&currency=AUD/);
    assert.equal(seenUrl, '/?country=AU&currency=AUD'); // the check uses the same context as the catalogue requests
  });
  await withStore('<html>theme without the marker</html>', async (base) => {
    const lines = [];
    assert.equal(await assertMarket(base, { log: (l) => lines.push(l) }), null);
    assert.match(lines[0], /no Shopify\.currency marker/);
  });
});

test('shopifyToProduct: variant prices stay dollar strings parsed by makeProduct, zero and null become null', () => {
  const p = shopifyToProduct(
    { id: 1, title: 'Mk25 EVO / S600 Regulator', handle: 'mk25', vendor: 'Scubapro', product_type: 'Regs', variants: [{ title: 'Yoke', price: '1529.00', compare_at_price: null, available: true, sku: 'A' }, { title: 'DIN', price: '0', compare_at_price: '0', available: false, sku: '' }], images: [], tags: [] },
    { retailer: 'shop', base: 'https://shop.example' },
  );
  assert.equal(p.price, 1529);
  assert.equal(p.compareAtPrice, null);
  assert.deepEqual(p.variants[1], { title: 'DIN', price: null, compareAtPrice: null, available: false, sku: '' });
  assert.equal(p.url, 'https://shop.example/products/mk25');
});

test('shopifyToProduct: the vendor is the brand only when it is a real one; a title prefix wins; casing survives', () => {
  const raw = (over) => ({ id: 1, title: 'Widget', handle: 'w', vendor: '', product_type: 'General', variants: [{ title: 'Default Title', price: '10.00', available: true }], images: [], tags: [], ...over });
  const brandOf = (over) => shopifyToProduct(raw(over), { retailer: 'shop', base: 'https://shop.example' }).brand;
  assert.equal(brandOf({ vendor: 'Not specified' }), ''); // My Dive Gear's placeholder
  assert.equal(brandOf({ vendor: 'My Dive Gear' }), ''); // the shop itself
  assert.equal(brandOf({ vendor: 'K01' }), 'K01'); // unknown to the alias table: kept as written
  assert.equal(brandOf({ vendor: 'Tabata Australia Pty Ltd' }), 'Tabata Australia Pty Ltd'); // distributor alias -> tusa at build time
  assert.equal(brandOf({ vendor: 'Not specified', title: 'Apeks XTX50 Regulator' }), 'apeks');
});
