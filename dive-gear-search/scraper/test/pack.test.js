// lib/pack.js: the on-disk form of data/retailers/<key>.json and data/products.json round-trips
// exactly, is written one record per line in id order, and group ids do not renumber.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProduct } from '../lib/product.js';
import { enrich, groupProducts } from '../build.js';
import { commonBase, compactImage, packRetailerFile, unpackRetailerFile, formatRetailerJson, packIndex, formatIndexJson, RETAILER_FORMAT } from '../lib/pack.js';
import { inflateIndex } from '../../assets/search.js';

const byId = (a, b) => (a.id < b.id ? -1 : 1);

const raw = (over) =>
  makeProduct({
    retailer: 'shop',
    sourceId: '1',
    title: 'Apeks XTX50 Regulator',
    brand: 'Apeks',
    category: 'Regulators',
    url: 'https://shop.example/products/apeks-xtx50',
    image: 'https://cdn.shopify.com/s/files/1/0001/0002/files/xtx50.jpg?v=1789691860',
    sku: 'AP0001',
    tags: ['regulator', 'apeks'],
    description: 'A regulator.',
    variants: [
      { title: 'DIN', price: 899, compareAtPrice: 999, available: true, sku: 'AP0001-DIN' },
      { title: 'Yoke', price: 899, compareAtPrice: null, available: false, sku: '' },
    ],
    ...over,
  });

test('commonBase: longest common prefix, cut back to the last / ? & or = (never inside a slug)', () => {
  assert.equal(commonBase(['https://s.example/products/a-b', 'https://s.example/products/a-c']), 'https://s.example/products/');
  assert.equal(
    commonBase(['https://s.example/index.php?main_page=product_info&products_id=1253', 'https://s.example/index.php?main_page=product_info&products_id=7']),
    'https://s.example/index.php?main_page=product_info&products_id=',
  );
  assert.equal(commonBase(['https://s.example/products/only-one']), 'https://s.example/products/');
  assert.equal(commonBase(['https://a.example/x', 'https://b.example/x']), 'https://');
  assert.equal(commonBase(['', 'https://s.example/p/1', undefined, 'https://s.example/p/2']), 'https://s.example/p/');
  assert.equal(commonBase([]), '');
  assert.equal(commonBase(['abc', 'abd']), '');
});

test('retailer file: pack -> text -> parse -> unpack gives the records back (minus description), sorted by id, one per line', () => {
  const products = [
    raw({ sourceId: '10' }),
    raw({ sourceId: '2', image: '', variants: [], tags: [], sku: '', brand: '', category: '', price: 50, inStock: false, url: 'https://shop.example/products/plain' }),
    raw({ sourceId: '1', price: 12.5, variants: [{ title: 'Default', price: 12.5, available: true }] }),
  ];
  const record = {
    retailer: { key: 'shop', name: 'Shop', homepage: 'https://shop.example/', platform: 'shopify' },
    status: 'ok',
    fetchedAt: '2026-09-20T05:40:37.578Z',
    durationMs: 7,
    count: 3,
    error: null,
    products,
  };
  const packed = packRetailerFile(record);
  assert.equal(packed.format, RETAILER_FORMAT);
  assert.deepEqual(packed.base, { url: 'https://shop.example/products/', image: 'https://cdn.shopify.com/s/files/1/0001/0002/files/' });
  assert.deepEqual(packed.products.map((p) => p.id), ['1', '10', '2']); // string order, no retailer prefix
  assert.ok(packed.products.every((p) => !('description' in p) && !('retailer' in p)));
  assert.ok(!('inStock' in packed.products[0]) && packed.products[2].inStock === false);
  assert.ok(!('image' in packed.products[2]) && !('variants' in packed.products[2]) && !('tags' in packed.products[2]));
  assert.equal(packed.products[1].image, 'xtx50.jpg'); // ?v= gone, prefix gone
  assert.deepEqual(packed.products[0].variants, [{ price: 12.5 }]); // Default title, available, empty sku and null compare-at omitted

  const text = formatRetailerJson(packed);
  assert.equal(text.split('\n').filter((l) => l.startsWith('{"id":')).length, 3);
  const back = unpackRetailerFile(JSON.parse(text));
  const expected = products
    .slice()
    .sort(byId)
    .map(({ description, ...p }) => ({ ...p, image: compactImage(p.image) }));
  assert.deepEqual(back.products, expected);
  const { products: _p, ...head } = record;
  const { products: _q, ...backHead } = back;
  assert.deepEqual(backHead, head);
  // stable: packing what was unpacked writes the same bytes
  assert.equal(formatRetailerJson(packRetailerFile(back)), text);
});

test('retailer file: a file written before the packed format is read as it is', () => {
  const legacy = { retailer: { key: 'shop' }, status: 'ok', products: [{ id: 'shop:1', title: 'X', price: 1 }] };
  assert.deepEqual(unpackRetailerFile(legacy), legacy);
  assert.equal(unpackRetailerFile(null), null);
  // and repacks to the new format (the one-off conversion of an old data/ directory)
  const repacked = packRetailerFile(legacy);
  assert.equal(repacked.format, RETAILER_FORMAT);
  assert.deepEqual(repacked.products, [{ id: '1', title: 'X', price: 1, inStock: false }]);
});

test('index: packIndex -> text -> inflateIndex gives the enriched records back (dp recomputed, nv dropped), grouped by retailer, stable g', () => {
  const mk = (r, id, title, brand, over = {}) =>
    enrich(
      makeProduct({
        retailer: r,
        sourceId: id,
        title,
        brand,
        url: `https://${r}.example/products/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        image: `https://cdn.example/${r}/${id}.jpg`,
        price: 100,
        ...over,
      }),
    );
  const items = [
    mk('bshop', '2', 'Apeks XTX50 Regulator Set', 'Apeks', { compareAtPrice: 150, variants: [{ title: 'A', price: 100, available: true }, { title: 'B', price: 120, available: true }] }),
    mk('ashop', '1', 'Apeks XTX50 Regulator Set', 'Apeks'),
    mk('ashop', '3', 'Halcyon Infinity 30lb System', 'Halcyon', { inStock: false, image: '', sku: 'HAL-30' }),
    mk('ashop', '12', 'Mystery Widget', 'Some Shop Brand'),
  ];
  assert.equal(groupProducts(items), 3);
  assert.equal(items[0].g, 'ashop:1'); // the same product at two shops: the smallest member id names the group
  assert.equal(items[1].g, 'ashop:1');
  assert.equal(items[2].g, 'ashop:3'); // on its own: its own id
  assert.equal(items[3].g, 'ashop:12');

  const retailers = {
    bshop: { name: 'B', homepage: 'https://bshop.example/', platform: 'shopify', live: true },
    ashop: { name: 'A', homepage: 'https://ashop.example/', platform: 'custom', live: false },
  };
  const doc = packIndex({ generatedAt: '2026-09-20T06:46:24.950Z', retailers, items });
  assert.deepEqual(Object.keys(doc.products), ['ashop', 'bshop']);
  assert.deepEqual(doc.products.ashop.map((r) => r.id), ['1', '12', '3']);
  assert.equal(doc.retailers.ashop.u, 'https://ashop.example/products/');
  assert.equal(doc.retailers.ashop.i, 'https://cdn.example/ashop/');
  assert.equal(doc.retailers.ashop.name, 'A');
  assert.deepEqual(doc.brands, { apeks: 'Apeks', halcyon: 'Halcyon', 'some shop brand': 'Some Shop Brand' });
  const row = doc.products.ashop[0];
  assert.deepEqual(Object.keys(row).sort(), ['bn', 'c', 'i', 'id', 'p', 't', 'u']); // b, cp, s, k, rc, g at their defaults are left out
  assert.equal(row.u, 'apeks-xtx50-regulator-set');
  assert.equal(row.i, '1.jpg');
  assert.equal(doc.products.ashop[2].s, false);
  assert.ok(!('i' in doc.products.ashop[2]));
  assert.equal(doc.products.ashop[2].k, 'HAL-30');
  assert.equal(doc.products.bshop[0].g, 'ashop:1');
  assert.equal(doc.products.bshop[0].cp, 150);
  assert.deepEqual(doc.products.bshop[0].pr, [100, 120]);
  assert.ok(!('dp' in doc.products.bshop[0]) && !('nv' in doc.products.bshop[0]) && !('r' in doc.products.bshop[0]));

  const text = formatIndexJson(doc);
  assert.equal(text.split('\n').filter((l) => l.startsWith('{"id":')).length, 4);
  const back = inflateIndex(JSON.parse(text));
  const expected = items
    .slice()
    .sort(byId)
    .map(({ nv, ...p }) => p);
  assert.deepEqual(back, expected);
  assert.equal(back[3].dp, 33);
  // stable: the same catalogue writes the same bytes
  assert.equal(formatIndexJson(packIndex({ generatedAt: '2026-09-20T06:46:24.950Z', retailers, items: items.slice().reverse() })), text);
});

test('inflateIndex tolerates an empty or partial document', () => {
  assert.deepEqual(inflateIndex({}), []);
  assert.deepEqual(inflateIndex({ products: { x: [] } }), []);
  const [p] = inflateIndex({ products: { x: [{ id: '1', t: 'T', p: 5, u: 'a' }] } });
  assert.deepEqual(p, { id: 'x:1', r: 'x', t: 'T', b: '', bn: '', c: '', rc: '', p: 5, cp: null, s: true, u: 'a', i: '', k: '', g: 'x:1' });
});
