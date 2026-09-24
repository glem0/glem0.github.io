// lib/woocommerce.js as configured for Gold Coast Dive Adventures: per-shop marketing categories,
// variant titles from attribute terms whose slug equals the name, and the module factory. The
// generic parser paths are covered by divegearaustralia.test.js through that shop's bindings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wooRetailer, pickCategory, toProduct, needsVariationPrices } from '../lib/woocommerce.js';
import gcda from '../retailers/goldcoastdiveadventures.js';
import { categoryOf } from '../retailers/infinitydive.js';

const cat = (name, slug, path) => ({ id: 1, name, slug, link: `https://goldcoastdiveadventures.com.au/product-category/${path}/` });
const prices = (price, regular, price_range = null) => ({ price, regular_price: regular, sale_price: price, price_range, currency_code: 'AUD', currency_minor_unit: 2 });

// Trimmed real records captured 2026-09-24.
const REEL = {
  id: 13278,
  name: 'Elite Aluminium Finger Reel',
  type: 'variable',
  sku: 'Elite Aluminium Finger Reel 30m',
  permalink: 'https://goldcoastdiveadventures.com.au/product/elite-aluminium-finger-reel-30m/',
  is_in_stock: true,
  prices: prices('6400', '7900', { min_amount: '6400', max_amount: '7800' }),
  categories: [cat('Accessories', 'accessories-dive-gear', 'accessories-dive-gear'), cat('Dive gear', 'dive-gear', 'dive-gear'), cat('Fave gear', 'fave-gear', 'fave-gear')],
  attributes: [
    { name: 'colour', has_variations: true, terms: [{ name: 'Black', slug: 'Black' }, { name: 'Fuchsia', slug: 'Fuchsia' }] },
    { name: 'Line Length', has_variations: true, terms: [{ name: '15m', slug: '15m' }, { name: '30m', slug: '30m' }] },
  ],
  variations: [
    { id: 13350, attributes: [{ name: 'colour', value: 'Black' }, { name: 'Line Length', value: '30m' }] },
    { id: 13351, attributes: [{ name: 'colour', value: 'Fuchsia' }, { name: 'Line Length', value: '15m' }] },
  ],
  images: [{ src: 'https://goldcoastdiveadventures.com.au/wp-content/uploads/reel.jpg' }],
  tags: [{ name: 'Aluminium reel', slug: 'aluminium-reel' }],
};
const MASK = {
  id: 13325,
  name: 'Hollis M-1 Mask',
  type: 'simple',
  sku: 'F-Dual-1',
  permalink: 'https://goldcoastdiveadventures.com.au/product/hollis-m-1-mask/',
  is_in_stock: true,
  prices: prices('14300', '15900'),
  categories: [cat('Dive gear', 'dive-gear', 'dive-gear'), cat('Fave gear', 'fave-gear', 'fave-gear'), cat('Masks', 'masks', 'dive-gear/masks')],
  attributes: [],
  variations: [],
  images: [],
  tags: [],
};
const CFG = { key: 'goldcoastdiveadventures', marketingSegment: /^fave-gear$/ };

test('goldcoastdiveadventures: module shape and defaults', () => {
  assert.equal(gcda.key, 'goldcoastdiveadventures');
  assert.equal(gcda.platform, 'woocommerce');
  assert.equal(gcda.api, 'https://goldcoastdiveadventures.com.au/wp-json/wc/store/v1/products');
  assert.equal(typeof gcda.fetch, 'function');
  const custom = wooRetailer({ key: 'x', name: 'X', homepage: 'https://x.example/', api: 'https://api.x.example/products' });
  assert.equal(custom.api, 'https://api.x.example/products');
});

test('woocommerce: per-shop marketing categories are skipped, the deepest real one wins', () => {
  assert.equal(pickCategory(MASK, CFG), 'Masks'); // dive-gear/masks, root segment dropped
  assert.equal(pickCategory(REEL, CFG), 'Dive gear'); // fave-gear ignored; dive-gear (root, +0.25) beats accessories-dive-gear at the same depth
  assert.equal(pickCategory({ categories: [cat('Fave gear', 'fave-gear', 'fave-gear')] }, CFG), '');
  assert.equal(pickCategory({ categories: [cat('Fave gear', 'fave-gear', 'fave-gear')] }, { key: 'other' }), 'Fave gear'); // without the override it is a real category (its own name, not the humanised slug)
});

test('woocommerce: GCDA records -> products (cents, RRP, attribute-term variants, price range)', () => {
  const mask = toProduct(MASK, null, CFG);
  assert.equal(mask.id, 'goldcoastdiveadventures:13325');
  assert.equal(mask.retailer, 'goldcoastdiveadventures');
  assert.equal(mask.price, 143);
  assert.equal(mask.compareAtPrice, 159);
  assert.equal(mask.category, 'Masks');
  assert.deepEqual(mask.variants, []);
  assert.ok(needsVariationPrices(REEL));
  const reel = toProduct(REEL, null, CFG);
  assert.equal(reel.price, 64);
  assert.equal(reel.compareAtPrice, 79);
  assert.deepEqual(reel.variants.map((v) => v.title), ['Black / 30m', 'Fuchsia / 15m']);
  assert.deepEqual(reel.tags, ['Aluminium reel', 'Accessories', 'Dive gear', 'Fave gear']);
});

test('infinitydive: the last segment of the taxonomy path is the category', () => {
  assert.equal(categoryOf({ product_type: 'Sporting Goods:Scuba & Snorkelling:Masks' }), 'Masks');
  assert.equal(categoryOf({ product_type: 'Sporting Goods: Spearfishing' }), 'Spearfishing');
  assert.equal(categoryOf({ product_type: 'Sporting Goods > Outdoor Recreation > Scuba Diving & Snorkeling > Gauges' }), 'Gauges');
  assert.equal(categoryOf({ product_type: 'accessory' }), 'accessory');
  assert.equal(categoryOf({ product_type: '' }), '');
  assert.equal(categoryOf({}), '');
});
