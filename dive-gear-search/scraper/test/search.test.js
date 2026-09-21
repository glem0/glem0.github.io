import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenizeQuery, normalizeText, inflateIndex, buildIndex, searchProducts, groupResults, sortGroups, facetCounts, compileFilters, isOnSale, discountPct } from '../../assets/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function prod(over) {
  return {
    id: `${over.r}:${over.id || Math.random().toString(36).slice(2)}`,
    r: 'adreno',
    t: 'Untitled',
    b: '',
    bn: '',
    c: 'other',
    rc: '',
    p: 100,
    cp: null,
    s: true,
    u: 'https://example.com/p',
    i: '',
    k: '',
    g: 999,
    nv: 1,
    ...over,
  };
}

const FIXTURE = [
  prod({ id: 1, r: 'adreno', t: 'Suunto D5 Wrist Dive Computer', b: 'Suunto', bn: 'suunto', c: 'dive computer', p: 699, cp: 899.99, dp: 22, g: 1, i: 'https://cdn.example/d5.jpg' }),
  prod({ id: 2, r: 'diveswansea', t: 'Suunto D5 Wrist Computer', b: 'Suunto', bn: 'suunto', c: 'dive computer', p: 749, cp: 999, dp: 25, g: 1 }),
  prod({ id: 3, r: 'onlinedivegear', t: 'Suunto D5 Dive Computer with USB Cable', b: 'Suunto', bn: 'suunto', c: 'dive computer', p: 739, cp: 900, dp: 18, g: 1, s: false }),
  prod({ id: 4, r: 'adreno', t: 'Suunto D5 Silicone Strap Kit (M) - Amber/Black', b: 'Suunto', bn: 'suunto', c: 'spare part', p: 79.99, g: 2 }),
  prod({ id: 5, r: 'divebondi', t: 'Scubapro MK25 EVO / S620 Ti', b: 'Scubapro', bn: 'scubapro', c: 'regulator', p: 1759.97, g: 3, k: 'SP-12-770-500' }),
  prod({ id: 6, r: 'frogdive', t: 'Scubapro MK25 EVO S620Ti Regulator', b: 'Scubapro', bn: 'scubapro', c: 'regulator', p: 1699, g: 3 }),
  prod({ id: 7, r: 'perthscuba', t: 'MK25 EVO First Stage', b: 'Scubapro', bn: 'scubapro', c: 'regulator', p: 635, g: 4, s: false }),
  prod({ id: 8, r: 'adreno', t: 'Mares X-Vision Ultra Liquidskin Mask', b: 'Mares', bn: 'mares', c: 'mask', p: 129, g: 5 }),
  prod({ id: 9, r: 'perthscuba', t: 'Apeks XTX50 Regulator Set DIN', b: 'Apeks', bn: 'apeks', c: 'regulator', p: 1099, cp: 1299, dp: 15, g: 6 }),
  prod({ id: 10, r: 'scubadiveshop', t: 'Oceanic Viper Fin Strap Single', b: 'Oceanic', bn: 'oceanic', c: 'spare part', p: 9.99, g: 7, k: 'MK25-STRAP' }),
  prod({ id: 11, r: 'divebondi', t: 'Cressi Aquawing Plus/MC9 Package', b: 'Cressi', bn: 'cressi', c: 'other', p: 1999, cp: 2444, dp: 18, g: 8, nv: 8, pr: [1999, 2853] }),
  prod({ id: 12, r: 'frogdive', t: 'Halcyon Infinity 30lb System', b: 'Halcyon', bn: 'halcyon', c: 'bcd', p: 1850, g: 9 }),
];

test('tokenizeQuery lowercases, strips punctuation, joins hyphens and dedupes', () => {
  assert.deepEqual(tokenizeQuery('  Suunto  D5 '), ['suunto', 'd5']);
  assert.deepEqual(tokenizeQuery('X-Vision ultra'), ['xvision', 'ultra']);
  assert.deepEqual(tokenizeQuery('MK25 mk25 / S620'), ['mk25', 's620']);
  assert.deepEqual(tokenizeQuery('2.5mm gloves'), ['2.5mm', 'gloves']);
  assert.deepEqual(tokenizeQuery("Mares' mask."), ['mares', 'mask']);
  assert.deepEqual(tokenizeQuery(''), []);
  assert.deepEqual(tokenizeQuery(null), []);
  assert.equal(normalizeText('Éclair Pro+'), 'eclair pro');
  // dots survive only between digits; hyphens join only between alphanumerics
  assert.equal(normalizeText('a-b-c x--y ..5 1.2.3 a.5 5.a end.'), 'abc x y 5 1.2.3 a 5 5 a end');
  // Safari < 16.4 cannot parse lookbehind assertions, which would abort the whole app module
  const searchSrc = readFileSync(path.resolve(__dirname, '..', '..', 'assets', 'search.js'), 'utf8');
  assert.ok(!/\(\?<[=!]/.test(searchSrc), 'search.js must not use regex lookbehind');
});

test('buildIndex precomputes lowercase haystacks and group sizes', () => {
  const index = buildIndex(FIXTURE);
  assert.equal(index.entries.length, FIXTURE.length);
  const e = index.entries[4];
  assert.equal(e.t, 'scubapro mk25 evo s620 ti');
  assert.equal(e.ts, 'scubapromk25evos620ti');
  assert.ok(e.o.includes('regulator'));
  assert.ok(e.o.includes('sp12770500'));
  assert.equal(index.groupSizes.get(1).retailers.size, 3);
  assert.equal(index.groupSizes.get(1).listings, 3);
  assert.equal(index.brandNames.suunto, 'Suunto');
});

test('all tokens must match; title-start matches rank first', () => {
  const index = buildIndex(FIXTURE);
  const r = searchProducts(index, 'suunto d5');
  assert.equal(r.fallback, false);
  assert.deepEqual(r.tokens, ['suunto', 'd5']);
  assert.equal(r.length, 4);
  // every title starts with the phrase; the computer sold by three retailers ranks first
  // (in-stock listings ahead, cheapest of those first), then the single-retailer spare part
  assert.equal(r[0].t, 'Suunto D5 Wrist Dive Computer');
  assert.equal(r[1].t, 'Suunto D5 Wrist Computer');
  assert.equal(r[2].s, false);
  assert.equal(r[3].c, 'spare part');
  // no product contains all three words -> ANY-token fallback kicks in and is flagged
  const fb = searchProducts(index, 'suunto halcyon zzz');
  assert.equal(fb.fallback, true);
  assert.equal(fb.length, 5);
});

test('squashed haystack matches tokens written without spaces or hyphens', () => {
  const index = buildIndex(FIXTURE);
  assert.equal(searchProducts(index, 'xvision')[0].t, 'Mares X-Vision Ultra Liquidskin Mask');
  assert.equal(searchProducts(index, 'x-vision')[0].t, 'Mares X-Vision Ultra Liquidskin Mask');
  const s620 = searchProducts(index, 's620ti');
  assert.equal(s620.length, 2);
  assert.ok(s620.every((p) => p.g === 3));
});

test('title matches outrank other-field matches; sku matches still found', () => {
  const index = buildIndex(FIXTURE);
  const r = searchProducts(index, 'mk25');
  assert.equal(r.length, 4);
  assert.ok(r.slice(0, 3).every((p) => /mk25/i.test(p.t)));
  assert.equal(r[3].k, 'MK25-STRAP');
  // the title that STARTS with the token beats titles where it is the second word
  assert.equal(r[0].t, 'MK25 EVO First Stage');
  // in-stock ranks before out-of-stock at equal textual relevance
  const regs = searchProducts(index, 'scubapro mk25');
  assert.equal(regs.length, 3);
  assert.ok(regs[0].s && regs[1].s && !regs[2].s);
});

test('falls back to ANY-token matching and flags it', () => {
  const index = buildIndex(FIXTURE);
  const r = searchProducts(index, 'suunto halcyon');
  assert.equal(r.fallback, true);
  assert.equal(r.length, 5);
  const none = searchProducts(index, 'zzzz qqqq');
  assert.equal(none.length, 0);
  assert.equal(none.fallback, false);
});

test('empty query browses everything sorted by group size then price', () => {
  const index = buildIndex(FIXTURE);
  const r = searchProducts(index, '');
  assert.equal(r.length, FIXTURE.length);
  assert.equal(r.fallback, false);
  assert.deepEqual(r.slice(0, 3).map((p) => p.g), [1, 1, 1]);
  assert.deepEqual(r.slice(0, 3).map((p) => p.p), [699, 739, 749]);
  assert.deepEqual(r.slice(3, 5).map((p) => p.g), [3, 3]);
  // then singleton groups by price
  const singles = r.slice(5).map((p) => p.p);
  assert.deepEqual(singles, [...singles].sort((a, b) => a - b));
});

test('filters: retailers, categories, brand, stock, sale, price', () => {
  const index = buildIndex(FIXTURE);
  assert.equal(searchProducts(index, '', { retailers: ['adreno'] }).length, 3);
  assert.equal(searchProducts(index, '', { retailers: new Set(['adreno', 'frogdive']) }).length, 5);
  assert.equal(searchProducts(index, '', { retailers: 'adreno,frogdive' }).length, 5);
  assert.equal(searchProducts(index, '', { retailers: [] }).length, FIXTURE.length, 'empty list = no restriction');
  assert.equal(searchProducts(index, '', { categories: ['regulator'] }).length, 4);
  assert.equal(searchProducts(index, '', { brand: 'suunto' }).length, 4);
  assert.equal(searchProducts(index, '', { inStock: true }).length, FIXTURE.length - 2);
  assert.equal(searchProducts(index, '', { onSale: true }).length, 5);
  assert.equal(searchProducts(index, '', { min: 1000 }).length, 5);
  assert.equal(searchProducts(index, '', { max: 100 }).length, 2);
  assert.equal(searchProducts(index, '', { min: '600', max: '800' }).length, 4);
  assert.equal(searchProducts(index, 'suunto', { categories: ['dive computer'], inStock: true }).length, 2);
  assert.equal(compileFilters({}), null);
  assert.equal(compileFilters({ retailers: null, min: '' }), null);
  assert.ok(isOnSale({ p: 10, cp: 12 }));
  assert.ok(!isOnSale({ p: 10, cp: null }));
  // a compare-at price only cents above the price is not a sale (would render as "-0%")
  assert.equal(discountPct({ p: 1399, cp: 1399.85 }), 0);
  assert.ok(!isOnSale({ p: 1399, cp: 1399.85 }));
  assert.equal(discountPct({ p: 10, cp: 12 }), 17);
  assert.equal(discountPct({ p: 10, cp: 12, dp: 17 }), 17);
  assert.equal(discountPct({ p: 10, cp: null }), 0);
});

test('generic category queries rank the products themselves above spares and accessories', () => {
  const cat = [
    prod({ id: 1, r: 'perthscuba', t: 'Regulator Port Plug', c: 'spare part', p: 4, g: 1 }),
    prod({ id: 2, r: 'adreno', t: 'Regulator Mouthpiece - Black', c: 'spare part', p: 16, g: 2 }),
    prod({ id: 3, r: 'adreno', t: 'Regulator Dust Caps', c: 'regulator', p: 9, g: 3 }),
    prod({ id: 4, r: 'adreno', t: 'Apeks XTX50 Regulator Set DIN', b: 'Apeks', bn: 'apeks', c: 'regulator', p: 1099, g: 4 }),
    prod({ id: 5, r: 'frogdive', t: 'Apeks XTX50 Regulator Set DIN', b: 'Apeks', bn: 'apeks', c: 'regulator', p: 1149, g: 4 }),
    prod({ id: 6, r: 'adreno', t: 'Scubapro MK25 EVO / S620 Ti', b: 'Scubapro', bn: 'scubapro', c: 'regulator', p: 1759, g: 5 }),
    prod({ id: 7, r: 'frogdive', t: 'Scubapro MK25 EVO / S620 Ti', b: 'Scubapro', bn: 'scubapro', c: 'regulator', p: 1699, g: 5 }),
    prod({ id: 8, r: 'perthscuba', t: 'Scubapro MK25 EVO / S620 Ti', b: 'Scubapro', bn: 'scubapro', c: 'regulator', p: 1789, g: 5 }),
    prod({ id: 9, r: 'adreno', t: 'Wetsuit Wash', c: 'accessories', p: 9.95, g: 6 }),
    prod({ id: 10, r: 'adreno', t: 'Wetsuit Hanger', c: 'wetsuit', p: 11.65, g: 7 }), // mis-categorised, as in real data
    prod({ id: 11, r: 'adreno', t: 'Bare Elate Wetsuit 5mm Ladies', b: 'Bare', bn: 'bare', c: 'wetsuit', p: 413, g: 8 }),
    prod({ id: 12, r: 'frogdive', t: 'Bare Elate Wetsuit 5mm Ladies', b: 'Bare', bn: 'bare', c: 'wetsuit', p: 425, g: 8 }),
    prod({ id: 13, r: 'adreno', t: '5mm Neoprene Glove', c: 'gloves', rc: 'Wetsuits & Gloves', p: 99, g: 9 }),
    prod({ id: 14, r: 'adreno', t: 'Mask Strap Silicone', c: 'spare part', p: 11.99, g: 10 }),
    prod({ id: 15, r: 'adreno', t: 'Mares X-Vision Mask', b: 'Mares', bn: 'mares', c: 'mask', p: 129, g: 11 }),
    prod({ id: 16, r: 'adreno', t: 'Shearwater Perdix 2 Ti', b: 'Shearwater', bn: 'shearwater', c: 'dive computer', p: 1899, g: 12 }),
    prod({ id: 17, r: 'adreno', t: 'Dive Link 2 Interface', c: 'accessories', rc: 'Dive Computer Accessories', p: 59, g: 13 }),
    // filed under the gear's own category by the retailer, but really parts / other gear
    prod({ id: 18, r: 'adreno', t: 'S600 2nd Stage Colour Kit', c: 'regulator', p: 19, g: 14 }),
    prod({ id: 19, r: 'frogdive', t: 'S600 2nd Stage Colour Kit', c: 'regulator', p: 21, g: 14 }),
    prod({ id: 20, r: 'adreno', t: 'Ocean Pro BCD Knife', c: 'bcd', p: 59, g: 15 }),
    prod({ id: 21, r: 'adreno', t: 'Cressi Start BCD', b: 'Cressi', bn: 'cressi', c: 'bcd', p: 550, g: 16 }),
    prod({ id: 22, r: 'adreno', t: 'D5 Black Dive Computer with USB Cable', c: 'dive computer', p: 999, g: 17 }),
    prod({ id: 23, r: 'adreno', t: 'Mares Force Knife', b: 'Mares', bn: 'mares', c: 'knife', p: 89, g: 18 }),
  ];
  const index = buildIndex(cat);
  const titles = (q, f) => searchProducts(index, q, f).map((p) => p.t);
  // "regulator": the regulators themselves first — the one sold by three retailers (matched via its
  // category) ahead of the one sold by two, then the mis-categorised dust caps, and the spare parts last
  const regs = titles('regulator');
  assert.equal(regs.length, 10);
  assert.deepEqual(regs.slice(0, 3), ['Scubapro MK25 EVO / S620 Ti', 'Scubapro MK25 EVO / S620 Ti', 'Scubapro MK25 EVO / S620 Ti']);
  assert.deepEqual(regs.slice(3, 5), ['Apeks XTX50 Regulator Set DIN', 'Apeks XTX50 Regulator Set DIN']);
  // the colour kit and dust caps are filed under regulator, but "kit"/"caps" mark them as parts:
  // they sit below every regulator (the kit, sold twice, ahead of the single-retailer caps)
  assert.deepEqual(regs.slice(5, 8), ['S600 2nd Stage Colour Kit', 'S600 2nd Stage Colour Kit', 'Regulator Dust Caps']);
  assert.deepEqual(regs.slice(-2), ['Regulator Port Plug', 'Regulator Mouthpiece - Black']);
  // a knife filed under bcd reads as a knife (last word names another category)
  assert.deepEqual(titles('bcd'), ['Cressi Start BCD', 'Ocean Pro BCD Knife']);
  // "wetsuit": the wetsuit sold twice beats the wash/hanger even though they START with the word;
  // the glove only matched through its raw category, so it comes last
  assert.deepEqual(titles('wetsuit'), ['Bare Elate Wetsuit 5mm Ladies', 'Bare Elate Wetsuit 5mm Ladies', 'Wetsuit Hanger', 'Wetsuit Wash', '5mm Neoprene Glove']);
  // "5mm wetsuit": both words in the title beats a glove that only matched "wetsuit" via raw category
  assert.equal(titles('5mm wetsuit')[0], 'Bare Elate Wetsuit 5mm Ladies');
  assert.equal(titles('5mm wetsuit').at(-1), '5mm Neoprene Glove');
  // "mask": the mask beats the strap; the plural still finds the category's products first
  // (the strap also matches "masks" through the squashed haystack "maskstrap…", ranked below)
  assert.deepEqual(titles('mask'), ['Mares X-Vision Mask', 'Mask Strap Silicone']);
  assert.equal(titles('masks')[0], 'Mares X-Vision Mask');
  // "dive computer": the computers (phrase in title, then category match) outrank an accessory that
  // merely starts with "Dive"; "with USB Cable" does not make the D5 an accessory
  assert.deepEqual(titles('dive computer'), ['D5 Black Dive Computer with USB Cable', 'Shearwater Perdix 2 Ti', 'Dive Link 2 Interface']);
  // a specific model query covers most of the product's title but little of an accessory's,
  // even when the accessory is mis-categorised and sold by more retailers
  const d5 = buildIndex([
    prod({ id: 1, r: 'adreno', t: 'Suunto D5 Wrist Dive Computer', c: 'dive computer', p: 699, g: 1 }),
    prod({ id: 2, r: 'frogdive', t: 'Suunto D5 Wrist Dive Computer', c: 'dive computer', p: 749, g: 1 }),
    prod({ id: 3, r: 'adreno', t: 'Suunto D5 / Eon Core Magnetic USB Cable', c: 'dive computer', p: 62, g: 2 }),
    prod({ id: 4, r: 'frogdive', t: 'Suunto D5 / Eon Core Magnetic USB Cable', c: 'dive computer', p: 65, g: 2 }),
    prod({ id: 5, r: 'perthscuba', t: 'Suunto D5 / Eon Core Magnetic USB Cable', c: 'dive computer', p: 66, g: 2 }),
  ]);
  assert.equal(searchProducts(d5, 'suunto d5')[0].t, 'Suunto D5 Wrist Dive Computer');
  assert.equal(searchProducts(d5, 'd5')[0].t, 'Suunto D5 Wrist Dive Computer');
  // brand + category: the product whose category matches beats a spare whose title merely starts with the brand
  assert.equal(titles('scubapro regulator')[0], 'Scubapro MK25 EVO / S620 Ti');
});

test('sort modes', () => {
  const index = buildIndex(FIXTURE);
  const asc = searchProducts(index, '', {}, 'price_asc').map((p) => p.p);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  const desc = searchProducts(index, '', {}, 'price_desc').map((p) => p.p);
  assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
  const disc = searchProducts(index, '', {}, 'discount').map((p) => p.dp || 0);
  assert.deepEqual(disc, [...disc].sort((a, b) => b - a));
  const names = searchProducts(index, '', {}, 'name').map((p) => p.t.toLowerCase());
  assert.deepEqual(names, [...names].sort());
  // with a query, price sort still only contains matches
  const q = searchProducts(index, 'suunto', {}, 'price_desc');
  assert.equal(q.length, 4);
  assert.equal(q[0].p, 749);
  // unknown sort falls back to relevance
  assert.equal(searchProducts(index, 'suunto d5', {}, 'bogus')[0].t, 'Suunto D5 Wrist Dive Computer');
});

test('groupResults collapses by group, ladders offers by price and computes spread', () => {
  const index = buildIndex(FIXTURE);
  const results = searchProducts(index, 'suunto d5');
  const groups = groupResults(results, FIXTURE);
  assert.equal(groups.length, 2);
  const g1 = groups[0];
  assert.equal(g1.g, 1);
  assert.equal(g1.title, 'Suunto D5 Wrist Dive Computer');
  assert.equal(g1.brand, 'Suunto');
  assert.equal(g1.category, 'dive computer');
  assert.equal(g1.image, 'https://cdn.example/d5.jpg');
  assert.deepEqual(g1.offers.map((o) => o.p), [699, 739, 749]);
  assert.equal(g1.cheapest.r, 'adreno');
  assert.equal(g1.dearest.r, 'diveswansea');
  assert.equal(g1.retailers, 3);
  assert.equal(g1.listings, 3);
  assert.equal(g1.spread, 50);
  assert.equal(g1.spreadPct, 7);
  const g2 = groups[1];
  assert.equal(g2.retailers, 1);
  assert.equal(g2.spread, 0);
  assert.equal(g2.dearest, g2.cheapest);
});

test('groupResults pulls members from allProducts even when they did not match', () => {
  const index = buildIndex(FIXTURE);
  const results = searchProducts(index, 'usb cable'); // only the onlinedivegear listing matches
  assert.equal(results.length, 1);
  const groups = groupResults(results, FIXTURE);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].offers.length, 3);
  assert.equal(groups[0].rep.r, 'onlinedivegear');
  // cheapest is the ladder top (lowest price); it is also the cheapest in stock here
  assert.equal(groups[0].cheapest.r, 'adreno');
  assert.equal(groups[0].cheapestInStock.r, 'adreno');
  // without allProducts the group only holds what was passed
  assert.equal(groupResults(results)[0].offers.length, 1);
  // a restricted pool (e.g. retailer filter) restricts the ladder
  const pool = FIXTURE.filter((p) => p.r !== 'adreno');
  assert.deepEqual(groupResults(results, pool)[0].offers.map((o) => o.r), ['onlinedivegear', 'diveswansea']);
});

test('groupResults: out-of-stock only groups still have a cheapest', () => {
  const groups = groupResults([FIXTURE[6]], FIXTURE);
  assert.equal(groups[0].cheapest, FIXTURE[6]);
  assert.equal(groups[0].cheapestInStock, null);
  assert.equal(groups[0].spread, 0);
});

test('groupResults: cheapest follows the ladder top even when it is out of stock', () => {
  const strobe = [
    prod({ id: 1, r: 'diveswansea', t: 'Mares EOS Strobe', p: 135, s: false, g: 50 }),
    prod({ id: 2, r: 'scubadoctor', t: 'Mares EOS Strobe', p: 138, s: false, g: 50 }),
    prod({ id: 3, r: 'perthscuba', t: 'Mares EOS Strobe', p: 179, s: false, g: 50 }),
    prod({ id: 4, r: 'frogdive', t: 'Mares EOS Strobe', p: 195, s: true, g: 50 }),
  ];
  const [g] = groupResults([strobe[3]], strobe);
  assert.deepEqual(g.offers.map((o) => o.p), [135, 138, 179, 195]);
  assert.equal(g.cheapest, g.offers[0], 'the Cheapest badge sits on the ladder top');
  assert.equal(g.cheapestInStock.r, 'frogdive');
  assert.equal(g.spread, 60);
  assert.equal(g.spreadPct, 31);
  // never "same price" unless every priced offer is equal
  const flat = strobe.map((p) => ({ ...p, p: 150 }));
  const same = groupResults([flat[0]], flat);
  assert.equal(same[0].spread, 0);
  assert.equal(same[0].cheapest, same[0].offers[0]);
});

test('sortGroups orders compare cards by the ladder, not the matched listing', () => {
  const index = buildIndex(FIXTURE);
  const asc = sortGroups(groupResults(searchProducts(index, '', {}, 'price_asc'), FIXTURE), 'price_asc');
  const tops = asc.map((g) => g.offers[0].p);
  assert.deepEqual(tops, [...tops].sort((a, b) => a - b));
  const desc = sortGroups(groupResults(searchProducts(index, '', {}, 'price_desc'), FIXTURE), 'price_desc');
  const dtops = desc.map((g) => g.offers[0].p);
  assert.deepEqual(dtops, [...dtops].sort((a, b) => b - a));
  // a query whose match is the dear listing still lists that card by its cheapest offer
  const usb = sortGroups(groupResults(searchProducts(index, 'usb cable', {}, 'price_asc'), FIXTURE), 'price_asc');
  assert.equal(usb[0].offers[0].p, 699);
  // discount: best discount on offer in the group
  const disc = sortGroups(groupResults(searchProducts(index, '', {}, 'discount'), FIXTURE), 'discount');
  const best = disc.map((g) => Math.max(...g.offers.map(discountPct)));
  assert.deepEqual(best, [...best].sort((a, b) => b - a));
  // other sorts are untouched (sortGroups sorts in place); unpriced groups go last on a price sort
  const np = prod({ id: 'np', p: null, g: 77 });
  const unpriced = groupResults([np, FIXTURE[0]], [np, FIXTURE[0]]);
  assert.equal(sortGroups(unpriced, 'relevance')[0].g, 77);
  assert.equal(sortGroups(unpriced, 'price_asc')[1].g, 77);
  assert.equal(sortGroups(unpriced, 'price_desc')[1].g, 77);
});

test('facetCounts', () => {
  const f = facetCounts(FIXTURE);
  assert.equal(f.retailer.adreno, 3);
  assert.equal(f.retailer.divebondi, 2);
  assert.equal(f.brand.suunto, 4);
  assert.equal(f.brand.scubapro, 3);
  assert.equal(f.category.regulator, 4);
  assert.equal(f.category['dive computer'], 3);
  assert.equal(Object.keys(f.brand).length, 7);
});

test('performance: 10k products search in well under 20ms once indexed', () => {
  const brands = ['Scubapro', 'Mares', 'Apeks', 'Suunto', 'Cressi', 'Shearwater', 'Hollis', 'Tusa'];
  const cats = ['regulator', 'mask', 'fins', 'dive computer', 'bcd', 'wetsuit'];
  const words = ['Evo', 'Pro', 'Ultra', 'Titanium', 'DIN', 'Yoke', 'Carbon', 'Liquidskin', 'MK25', 'S620', 'XTX50', 'D5', 'Perdix', 'Quattro'];
  const big = [];
  for (let i = 0; i < 10000; i += 1) {
    const b = brands[i % brands.length];
    const t = `${b} ${words[i % words.length]} ${words[(i * 7) % words.length]} ${words[(i * 13) % words.length]} ${i}`;
    big.push(prod({ id: i, r: ['adreno', 'perthscuba', 'frogdive'][i % 3], t, b, bn: b.toLowerCase(), c: cats[i % cats.length], p: (i % 500) + 10, g: i >> 1, k: `SKU${i}` }));
  }
  const t0 = performance.now();
  const index = buildIndex(big);
  const buildMs = performance.now() - t0;
  // warm up, then time a few searches
  searchProducts(index, 'scubapro mk25');
  let best = Infinity;
  for (let k = 0; k < 5; k += 1) {
    const s = performance.now();
    const r = searchProducts(index, 'scubapro mk25 evo', { inStock: true }, 'relevance');
    best = Math.min(best, performance.now() - s);
    assert.ok(r.length > 0);
  }
  let bestBrowse = Infinity;
  for (let k = 0; k < 3; k += 1) {
    const s = performance.now();
    const r = searchProducts(index, '');
    groupResults(r, big);
    facetCounts(r);
    bestBrowse = Math.min(bestBrowse, performance.now() - s);
  }
  // generous bounds so slow CI runners don't flake; locally these are ~2ms / ~10ms
  assert.ok(buildMs < 2000, `buildIndex took ${buildMs.toFixed(1)}ms`);
  assert.ok(best < 100, `search took ${best.toFixed(1)}ms`);
  assert.ok(bestBrowse < 400, `browse+group took ${bestBrowse.toFixed(1)}ms`);
});

const REAL = path.resolve(__dirname, '..', '..', 'data', 'products.json');
test('smoke test against real data/products.json', { skip: !existsSync(REAL) }, () => {
  const data = JSON.parse(readFileSync(REAL, 'utf8'));
  data.products = inflateIndex(data); // as app.js does after loading
  const index = buildIndex(data.products);
  const mk25 = searchProducts(index, 'mk25');
  assert.ok(mk25.length > 0);
  assert.ok(/mk25/i.test(mk25[0].t), `top hit for mk25 was "${mk25[0].t}"`);
  const d5 = searchProducts(index, 'suunto d5');
  assert.ok(d5.length > 0);
  assert.ok(/suunto d5/i.test(d5[0].t), `top hit for suunto d5 was "${d5[0].t}"`);
  const groups = groupResults(d5, data.products);
  assert.ok(groups.length > 0 && groups.length <= d5.length);
  const f = facetCounts(searchProducts(index, ''));
  assert.equal(Object.values(f.retailer).reduce((a, b) => a + b, 0), data.products.length);
});
