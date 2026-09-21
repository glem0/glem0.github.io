// Parser coverage for the Dive Gear Australia (WooCommerce Store API) retailer, without network.
// The fixture is a trimmed copy of real /wp-json/wc/store/v1/products records captured 2026-09-20.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mod, { toProduct, dropReason, pickCategory, rawPrices, needsVariationPrices, variationTitle } from '../retailers/divegearaustralia.js';

const cat = (id, name, slug, path) => ({ id, name, slug, link: `https://divegearaustralia.com.au/product-category/${path}/` });
const prices = (price, regular, price_range = null) => ({ price, regular_price: regular, sale_price: price, price_range, currency_code: 'AUD', currency_minor_unit: 2 });

const SIMPLE = {
  id: 1764,
  name: 'Apeks Lifeline Spool Kit 15mtr',
  slug: 'apeks-lifeline-spool-kit-15-meter',
  type: 'simple',
  parent: 0,
  sku: 'RE121113',
  permalink: 'https://divegearaustralia.com.au/product/apeks-lifeline-spool-kit-15-meter/',
  on_sale: true,
  is_in_stock: true,
  is_purchasable: true,
  prices: prices('18500', '20000'),
  brands: [{ id: 120, name: 'Apeks Dive Gear', slug: 'apeks-dive-gear' }],
  categories: [
    cat(88, 'Accessories', 'accessories', 'dive-gear/accessories'),
    cat(13693, 'Christmas Gift Ideas', 'christmas-gift-ideas', 'gift-ideas/christmas-gift-ideas'),
    cat(198, 'Reels', 'reels', 'dive-gear/accessories/reels'),
    cat(635, 'Surface Marker Buoy', 'surface-marker-buoy', 'dive-gear/accessories/surface-marker-buoy'),
    cat(8632, 'travel scuba gear', 'travel-scuba-gear', 'travel-scuba-gear'),
  ],
  tags: [{ id: 390, name: 'Spool', slug: 'spool' }],
  images: [{ id: 83091, src: 'http://divegearaustralia.com.au/wp-content/uploads/2019/05/Apeks-Lifeline-Spool-Kit-15mtr.jpg' }],
  attributes: [],
  variations: [],
  short_description: '<p>&nbsp;</p>',
  description: '<h2>Apeks Lifeline Spool</h2><p>The Lifeline spool &amp; double-ender clip <script>x()</script>are made from stainless.</p>',
  extensions: { bundles: [], composites: [] },
};

const VARIABLE = {
  id: 1762,
  name: 'Aqualung Reveal UltraFit Dive Masks &#8211; Youth &amp; Adult Sizes',
  slug: 'aqualung-reveal-ultrafit-dive-masks',
  type: 'variable',
  parent: 0,
  sku: 'MS5350106',
  permalink: 'https://divegearaustralia.com.au/product/aqualung-reveal-ultrafit-dive-masks/',
  is_in_stock: true,
  prices: prices('9900', '15000', { min_amount: '9900', max_amount: '12500' }),
  brands: [{ id: 28, name: 'Aqualung', slug: 'aqualung' }],
  categories: [
    cat(9100, 'Aqualung', 'aqualung', 'aqualung'),
    cat(1997, 'Clearance Dive Gear', 'clearance-dive-gear', 'clearance-dive-gear'),
    cat(11027, 'Dive Mask for Small Face', 'dive-mask-for-small-face', 'dive-gear/diving-mask/dive-mask-for-small-face'),
    cat(11028, 'Diving Masks', 'diving-mask', 'dive-gear/diving-mask'),
    cat(9696, 'Snorkel Mask', 'snorkel-mask', 'snorkeling-gear/snorkel-mask'),
    cat(11646, "Women's Dive Masks", 'womens-dive-masks', 'dive-gear/diving-mask/womens-dive-masks'),
  ],
  tags: [{ id: 253, name: 'MASK', slug: 'mask' }],
  images: [{ id: 92673, src: 'https://divegearaustralia.com.au/wp-content/uploads/2019/05/Aqualung-Reveal-UltraFit-Dive-Masks-1.jpg' }],
  attributes: [
    { id: 3, name: 'Colour', terms: [{ name: 'Orange/White/Clear', slug: 'orange-white-clear' }, { name: 'Yellow/White/Asphalt', slug: 'yellow-white-asphalt' }] },
    { id: 4, name: 'Size', terms: [{ name: 'Large', slug: 'large' }, { name: 'Small', slug: 'small' }] },
  ],
  variations: [
    { id: 97622, attributes: [{ name: 'Colour', value: 'orange-white-clear' }, { name: 'Size', value: 'large' }] },
    { id: 97621, attributes: [{ name: 'Colour', value: 'orange-white-clear' }, { name: 'Size', value: 'small' }] },
    { id: 93099, attributes: [{ name: 'Colour', value: 'yellow-white-asphalt' }, { name: 'Size', value: 'large' }] },
  ],
  short_description: '<p>The Reveal UltraFit Negative Dive Mask is perfect for Kids, Youth and Adults.</p>',
  extensions: { bundles: [], composites: [] },
};

// /products?type=variation&parent=1762 (trimmed)
const VARIATIONS = [
  { id: 97622, type: 'variation', parent: 1762, sku: 'MS5350809L', variation: 'Colour: Orange/White/Clear, Size: Large', is_in_stock: true, prices: prices('9900', '15000') },
  { id: 97621, type: 'variation', parent: 1762, sku: 'MS5350809S', variation: 'Colour: Orange/White/Clear, Size: Small', is_in_stock: true, prices: prices('9900', '15000') },
  { id: 93099, type: 'variation', parent: 1762, sku: 'MS5350106-5DE36D', variation: 'Colour: Yellow/White/Asphalt, Size: Large', is_in_stock: false, prices: prices('12500', '15000') },
];

const BUNDLE = {
  id: 2441,
  name: 'TUSA Sport Splendive Travel Set – Mask, Snorkel &#038; Travel Fins',
  slug: 'tusa-sport-splendive-travel-set',
  type: 'bundle',
  parent: 0,
  sku: 'TS-SPLENDIVE-DRY-TRAVEL-SET',
  permalink: 'https://divegearaustralia.com.au/product/tusa-sport-splendive-travel-set/',
  is_in_stock: true,
  prices: prices('0', '0'),
  brands: [{ id: 31, name: 'TUSA Sport', slug: 'tusa-sport' }],
  categories: [
    cat(13699, 'Gift Ideas', 'gift-ideas', 'gift-ideas'),
    cat(377, 'Snorkelling Packages - Mask, Snorkel And Fins', 'snorkelling-packages', 'snorkeling-gear/snorkelling-packages'),
    cat(14039, 'TUSA Sport', 'tusa-sport', 'tusa-sport'),
  ],
  tags: [],
  images: [{ src: 'https://divegearaustralia.com.au/wp-content/uploads/2019/05/TUSA-Sport-Splendive-Travel-Set.jpg' }],
  attributes: [],
  variations: [],
  short_description: '',
  extensions: {
    bundles: {
      bundle_stock_status: 'instock',
      bundle_price: { price: { min: { incl_tax: '14850', excl_tax: '13500' }, max: { incl_tax: '249285', excl_tax: '226623' } }, regular_price: { min: { incl_tax: '16500', excl_tax: '15000' }, max: { incl_tax: '287795', excl_tax: '261632' } }, currency_code: 'AUD', currency_minor_unit: 2 },
    },
    composites: [],
  },
};

const COMPOSITE = { ...SIMPLE, id: 15942, name: 'TUSA Switch Pro Diving Package', type: 'composite', sku: '', prices: prices('0', '0'), permalink: 'https://divegearaustralia.com.au/product/tusa-switch-pro-diving-package/' };
const EXTERNAL = { ...SIMPLE, id: 75155, name: 'Cressi Zeus Black IRIDIUM Mask', type: 'external', is_purchasable: false, prices: prices('0', '0') };
const GIFT_CARD = { ...SIMPLE, id: 11655, name: 'PADI Learn To Dive Gift Card', type: 'gift-card', prices: prices('0', '0') };
const PLACEHOLDER = { ...SIMPLE, id: 91644, name: 'Gift this product', categories: [], prices: prices('0', '0') };
const TEST_PRODUCT = { ...SIMPLE, id: 69854, name: 'Test Product $1', categories: [], prices: prices('100', '100') };
const CHILD_SIMPLE = { ...SIMPLE, id: 4712, parent: 4698, name: 'LP Rubber Regulator Hose Yellow', prices: prices('5700', '5700'), categories: [cat(1, 'Hoses', 'hoses', 'dive-gear/accessories/hoses')] };
const NO_PRICE = { ...SIMPLE, id: 92751, name: 'Atomic Aquatics Full Foot SplitFins', prices: prices('0', '0') };
const SPARSE = { id: 999, name: 'Mystery &quot;thing&quot;', type: 'simple', permalink: 'https://divegearaustralia.com.au/product/mystery/', prices: { price: '1234' } };

test('divegearaustralia: module shape', () => {
  assert.equal(mod.key, 'divegearaustralia');
  assert.equal(mod.name, 'Dive Gear Australia');
  assert.equal(mod.homepage, 'https://divegearaustralia.com.au/');
  assert.equal(mod.platform, 'woocommerce');
  assert.equal(typeof mod.fetch, 'function');
});

test('divegearaustralia: simple product (cents -> dollars, RRP, category, description)', () => {
  const p = toProduct(SIMPLE);
  assert.equal(p.id, 'divegearaustralia:1764');
  assert.equal(p.retailer, 'divegearaustralia');
  assert.equal(p.title, 'Apeks Lifeline Spool Kit 15mtr');
  assert.equal(p.brand, 'Apeks Dive Gear');
  assert.equal(p.price, 185);
  assert.equal(p.compareAtPrice, 200);
  assert.equal(p.inStock, true);
  assert.equal(p.url, 'https://divegearaustralia.com.au/product/apeks-lifeline-spool-kit-15-meter/');
  assert.equal(p.image, 'https://divegearaustralia.com.au/wp-content/uploads/2019/05/Apeks-Lifeline-Spool-Kit-15mtr.jpg');
  assert.equal(p.sku, 'RE121113');
  assert.deepEqual(p.variants, []);
  // deepest non-marketing category, entity-decoded (nbsp), "dive-gear" root dropped
  assert.equal(p.category, 'Accessories - Reels');
  assert.ok(p.tags.includes('Spool') && p.tags.includes('Surface Marker Buoy'));
  // empty short_description falls back to the long one; tags/scripts stripped, entities decoded
  assert.equal(p.description, 'Apeks Lifeline Spool The Lifeline spool & double-ender clip are made from stainless.');
});

test('divegearaustralia: variable product from the listing alone (from-price on every variant)', () => {
  const p = toProduct(VARIABLE);
  assert.equal(p.title, 'Aqualung Reveal UltraFit Dive Masks – Youth & Adult Sizes');
  assert.equal(p.price, 99);
  assert.equal(p.compareAtPrice, 150);
  assert.equal(p.category, 'Diving Masks'); // parent beats the audience-qualified leaves; brand/clearance ignored
  assert.equal(p.variants.length, 3);
  assert.equal(p.variants[0].title, 'Orange/White/Clear / Large');
  assert.equal(p.variants[2].title, 'Yellow/White/Asphalt / Large');
  assert.ok(p.variants.every((v) => v.price === 99 && v.compareAtPrice === 150 && v.available === true));
  assert.equal(needsVariationPrices(VARIABLE), true);
  assert.equal(needsVariationPrices({ ...VARIABLE, prices: prices('9900', '15000') }), false);
  assert.equal(needsVariationPrices(SIMPLE), false);
});

test('divegearaustralia: variable product with real per-variation prices', () => {
  const p = toProduct(VARIABLE, VARIATIONS);
  assert.equal(p.variants.length, 3);
  assert.deepEqual(p.variants[2], { title: 'Yellow/White/Asphalt / Large', price: 125, compareAtPrice: 150, available: false, sku: 'MS5350106-5DE36D' });
  assert.equal(p.price, 99); // cheapest available variant
  assert.equal(p.compareAtPrice, 150);
  assert.equal(p.sku, 'MS5350106'); // product sku kept
  assert.equal(p.inStock, true);
  assert.equal(variationTitle('Colour: Orange/White/Clear, Size: Large'), 'Orange/White/Clear / Large');
  assert.equal(variationTitle('Size: Large Mens US 7-12+'), 'Large Mens US 7-12+');
  assert.equal(variationTitle(''), '');
});

test('divegearaustralia: bundle price comes from extensions.bundles', () => {
  assert.deepEqual(rawPrices(BUNDLE), { price: 148.5, compareAtPrice: 165 });
  const p = toProduct(BUNDLE);
  assert.equal(p.price, 148.5);
  assert.equal(p.compareAtPrice, 165);
  assert.equal(p.title, 'TUSA Sport Splendive Travel Set – Mask, Snorkel & Travel Fins');
  // long SEO name with a comma is replaced by the slug-derived name; brand category ignored
  assert.equal(p.category, 'Snorkeling Gear - Snorkelling Packages');
});

test('divegearaustralia: unpriceable types and placeholders are dropped, child simples kept', () => {
  assert.equal(dropReason(COMPOSITE), 'type:composite');
  assert.equal(dropReason(EXTERNAL), 'type:external');
  assert.equal(dropReason(GIFT_CARD), 'type:gift-card');
  assert.equal(dropReason(PLACEHOLDER), 'placeholder');
  assert.equal(dropReason(TEST_PRODUCT), 'placeholder');
  assert.equal(dropReason({ ...SIMPLE, type: 'variation', parent: 1 }), 'variation');
  assert.equal(dropReason(null), 'malformed');
  assert.equal(dropReason(CHILD_SIMPLE), '');
  assert.equal(dropReason(SIMPLE), '');
  assert.equal(toProduct(CHILD_SIMPLE).price, 57);
  assert.equal(toProduct(CHILD_SIMPLE).category, 'Accessories - Hoses');
});

test('divegearaustralia: zero / missing prices become null, sparse records do not throw', () => {
  assert.equal(toProduct(NO_PRICE).price, null);
  assert.equal(toProduct(NO_PRICE).compareAtPrice, null);
  const p = toProduct(SPARSE);
  assert.equal(p.id, 'divegearaustralia:999');
  assert.equal(p.title, 'Mystery "thing"');
  assert.equal(p.price, 12.34);
  assert.equal(p.brand, '');
  assert.equal(p.category, '');
  assert.equal(p.image, '');
  assert.equal(p.inStock, false);
  assert.deepEqual(p.tags, []);
  assert.throws(() => toProduct({ ...SIMPLE, name: '' }), /title required/);
});

test('divegearaustralia: category selection ignores marketing / brand categories', () => {
  const only = (...cats) => pickCategory({ brands: [{ name: 'Cressi', slug: 'cressi' }], categories: cats });
  assert.equal(only(cat(1, 'travel scuba gear', 'travel-scuba-gear', 'travel-scuba-gear'), cat(2, 'Christmas Sale', 'christmas-sale', 'christmas-sale')), '');
  assert.equal(only(cat(1, 'Dive Travel Accessories', 'dive-travel-accessories', 'dive-gear/accessories/dive-travel-accessories'), cat(2, 'Dive Torches', 'dive-torches', 'dive-gear/dive-torches')), 'Dive Torches');
  assert.equal(only(cat(1, 'Travel BCD', 'travel-bcd', 'dive-gear/bcd/travel-bcd'), cat(2, "BCD Rear Inflation, Jacket Style and Travel BCD's", 'bcd', 'dive-gear/bcd')), 'BCD');
  assert.equal(only(cat(1, 'Cressi Spearfishing', 'cressi-spearfishing', 'spearfishing-gear/cressi-spearfishing'), cat(2, 'Spearfishing Masks', 'spearfishing-masks', 'spearfishing-gear/spearfishing-masks')), 'Spearfishing Gear - Spearfishing Masks');
  assert.equal(only(cat(1, 'Cressi Spearfishing', 'cressi-spearfishing', 'spearfishing-gear/cressi-spearfishing')), 'Spearfishing Gear - Cressi Spearfishing');
  assert.equal(only(cat(1, 'Scuba Diving Course', 'scuba-diving-course', 'scuba-diving-course')), 'Scuba Diving Course');
  assert.equal(pickCategory({ categories: [] }), '');
  assert.equal(pickCategory({}), '');
});
