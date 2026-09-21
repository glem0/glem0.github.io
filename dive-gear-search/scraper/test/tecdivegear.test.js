// Parser tests for the Tec Dive Gear retailer, run against trimmed copies of real responses
// captured on 2026-09-20 (no network access needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCategoryLinks, parseCategoryPage, parseProductPage, toProduct, parseMoney, imageUrl, isPurchasable, stripStockSuffix } from '../retailers/tecdivegear.js';

// /catalogue/index.php (left menu, trimmed)
const INDEX_HTML = `
<div id="leftmenu">
<a class="lv12" href="/catalogue/category_intro.php/1/2">BCD's, Wings &amp; Harnesses</a>
<a class="lv12" href="/catalogue/category_intro.php/1/13">Regulators</a>
<a class="lv12" href="/catalogue/category_intro.php/1/6">Dive Torches & Accessories </a>
<a class="lv12" href="/catalogue/category_intro.php/1/35">Diving Trips</a>
<a class="nav_path_link" href="/catalogue/brand.php/1">Brand</a>
</div>`;

// /catalogue/category_intro.php/1/13 (product grid, trimmed; last item carries the "$0.00" POA price
// and an empty thumbnail as seen on ids 492 / 912)
const CATEGORY_HTML = `
<h1 class="title">Regulators</h1>
<h4>Products:</h4><div class="gridcontainer">
<div class="gridrow">
<div><a href="../../product.php/1/670" class="name">DiveRite FT1/XT2 Set<br/><img src="/images/products_small/RG5800-OW.jpg" alt="DiveRite FT1/XT2 Set" /></a><div class="special_price">$1210.00</div></div>
<div><a href="../../product.php/1/911" class="name">XT1/XT4 Stage Reg <br/><img src="/images/products_small/XT4 stage pkg.jpg" alt="XT1/XT4 Stage Reg " /></a><div class="special_price">$995.00</div></div>
<div><a href="../../product.php/1/492" class="name">Pinnacle 7mm Tempo & Siren<br/><img src="/images/products_small/" alt="Pinnacle 7mm Tempo & Siren" /></a><div class="special_price">$0.00</div></div>
</div>
</div>`;

const shell = (navCat, left, right) => `
<div id="nav_path">
<a class="nav_path_link" href="/catalogue/">Catalogue</a>
 by <a class="nav_path_link" href="/catalogue/brand.php/1">Brand</a> : <a class="nav_path_link" href="/catalogue/brand_intro.php/1/''"></a> : ${navCat} </div>
<div id="contentl">
<div id="pageholder">
<h1 class="title">Gauges, Hoses, Regulator Access.</h1>
<div id="pageleft">
${left}
</div>
<div id="pageright">
${right}
</div>
</div>
<div id="pageholderbottom">
</div>`;

const buyTable = (avail, priceRow, extraRows) => `<p><form method="POST" action="/catalogue/cartadd.php/1/102"><table><tr><td><table width="240" cellpadding="0" cellspacing="0">
<tr>
<td width="100" valign="top">
<div class="buy">Available:</div>
</td>
<td width="140" valign="top">
${avail}<br/><br/>
</td>
</tr>
${priceRow}
${extraRows}
<tr>
<td height="30" valign="top">
<div class="buy">Quantity:</div>
</td>
<td valign="top">
<INPUT TYPE="TEXT" NAME="qty" SIZE="3" MAXLENGTH="4" VALUE="1"></td>
</tr>
</table>
</td><td valign="top"></td></tr></table></form></p>`;

const PRICE_ROW = (p) => `<tr>
<td valign="top">
<div class="buy">Price:</div>
</td>
<td valign="top">
<div id="price">${p}</div>
</td>
</tr>`;

// /catalogue/product.php/1/102 "HP Gauge Hoses": generic brand "*", Product Code, size options with
// different prices and "- out of stock" suffixes.
const PRODUCT_102 = shell(
  '<a class="nav_path_link" href="/catalogue/category_intro.php/1/18">Gauges, Hoses, Regulator Access.</a>',
  `<h1>HP Gauge Hoses</h1>
<p>Manufacturer *</p>
<p>Product Code : #HOHPXX</p>
<p><font size='2'>Finding just the right hose to create a streamlined, efficient diving rig takes some effort. Therefore, we offer hoses for both the recreational and technical diver in 6, 9, 21, 24, 26, 32 and 42-inch lengths.</font></p>
${buyTable('<span class="available">Today</span>', PRICE_ROW('$60.00'), `<tr>
<td height="30" valign="top">
<div class="buy">Size:</div>
</td>
<td valign="top">
<select name="siz" onchange="javascript:setSizePrice(this.form,'price','rrp');"><option value="60.00|0.00">6 Inch </option>
<option value="66.00|0.00">9 Inch - out of stock</option>
<option value="77.00|0.00">21 Inch</option>
<option value="84.00|0.00">24 Inch</option>
<option value="88.00|0.00">26 Inch </option>
<option value="99.00|0.00">32 Inch - out of stock</option>
</select>&nbsp;
<input type="HIDDEN" name="sizn" value="6 Inch "/>
</td>
</tr>`)}`,
  '<center><img src="/images/products//HP Hose.jpg" alt="HP Gauge Hoses" border="0" /></center>',
);

// /catalogue/product.php/1/58 "Dive Rite 20Ib Pockets": product-level "Out of Stock", first option
// (the displayed $275) dearer than the second, nested/malformed description markup.
const PRODUCT_58 = shell(
  '<a class="nav_path_link" href="/catalogue/category_intro.php/1/19">BCD Accessories, Pockets</a>',
  `<h1>Dive Rite 20Ib Pockets</h1>
<p>Manufacturer Dive Rite</p>
<p>Product Code : #AC3220</p>
<p><div id='productText'><p style='margin: 0px'><font size='3'>The 20 lb Quick Buckle (QB) Weight Pockets consist of an insert pocket that easily releases when the handle is pulled.</font></p><div>&nbsp;</div></div></p>
${buyTable('<span class="highlight">Out of Stock</span>', PRICE_ROW('$275.00'), `<tr>
<td height="30" valign="top">
<div class="buy">Size:</div>
</td>
<td valign="top">
<select name="siz" onchange="javascript:setSizePrice(this.form,'price','rrp');"><option value="275.00|0.00">QR System - Out of Stock</option>
<option value="77.00|0.00">Single Insert </option>
</select>&nbsp;
</td>
</tr>`)}`,
  '<center><img src="/images/products//Weight pockets 20LB.jpg" alt="Dive Rite 20Ib Pockets" border="0" /></center>',
);

// /catalogue/product.php/1/492 "Sofnolime 797": price on application (no #price, "$POA" instead).
const PRODUCT_492 = shell(
  '<a class="nav_path_link" href="/catalogue/category_intro.php/1/11">Optima Rebreather</a>',
  `<h1>Sofnolime 797 </h1>
<p>Manufacturer Molecular</p>
<p><p><font size='2'>Sofnolime 797 brought to you by Molecular Products is the carbondioxide absorbent recommended by most closed circuit rebreather (CCR) manufacturers.</font></p><p>&nbsp;</p></p>
<p><form method="POST" action="/catalogue/cartadd.php/1/492"><table><tr><td><table width="240" cellpadding="0" cellspacing="0">
<tr>
<td width="100" valign="top">
<div class="buy">Available:</div>
</td>
<td width="140" valign="top">
<span class="available">Today</span><br/><br/>
</td>
</tr>
<div class="special_price">$POA</div></table>
</td><td valign="top"></td></tr></table></form></p>`,
  '<center><img src="/images/products//sofno20.jpg" alt="Sofnolime 797 " border="0" /></center>',
);

// /catalogue/product.php/1/4 "Transpac Travel Pack": colour select (no prices) + size select (all
// the same price), second image inside the form, entity in the description.
const PRODUCT_4 = shell(
  '<a class="nav_path_link" href="/catalogue/category_intro.php/1/2">BCD\'s, Wings & Harnesses</a>',
  `<h1>Transpac Travel Pack</h1>
<p>Manufacturer Dive Rite</p>
<p>Product Code : PK6325</p>
<p><p>&nbsp;</p><p><font size='2'>The Travel Package is perfect for those who want a single tank system. All you need to do is choose the correct size TransPac harness, and you&rsquo;re done!</font></p></p>
<p><form method="POST" action="/catalogue/cartadd.php/1/4"><table><tr><td><table width="240" cellpadding="0" cellspacing="0">
<tr>
<td width="100" valign="top">
<div class="buy">Available:</div>
</td>
<td width="140" valign="top">
<span class="available">Today</span><br/><br/>
</td>
</tr>
${PRICE_ROW('$1245.00')}
<tr>
<td height="30" valign="middle">
<div class="buy">Colour:</div>
</td>
<td valign="top">
<SELECT NAME="col"><OPTION>Blue Wing </OPTION>
<OPTION>OD Green Wing</OPTION>
<OPTION>Red Wing </OPTION>
<OPTION>Black Wing </OPTION>
</SELECT>&nbsp;
</td>
</tr>
<tr>
<td height="30" valign="top">
<div class="buy">Size:</div>
</td>
<td valign="top">
<select name="siz" onchange="javascript:setSizePrice(this.form,'price','rrp');"><option value="1245.00|0.00">SM </option>
<option value="1245.00|0.00">MED</option>
<option value="1245.00|0.00">LG</option>
</select>&nbsp;
</td>
</tr>
</table>
</td><td valign="top"><p><center><img src="/images/products/BC6025 travel.JPG" border="0" /></center></p></td></tr></table></form></p>`,
  '<center><img src="/images/products//PK6325.jpg" alt="Transpac Travel Pack" border="0" /></center>',
);

// /catalogue/product.php/1/99999: non-existent id still answers HTTP 200 with an empty page.
const PRODUCT_MISSING = shell(
  '<a class="nav_path_link" href="/catalogue/category_intro.php/1/"></a>',
  `<h1></h1>
<p>Manufacturer </p>
<p><form method="POST" action="/catalogue/cartadd.php/1/99999"><table><tr><td><table width="240" cellpadding="0" cellspacing="0">
<div class="special_price">$POA</div></table>
</td><td valign="top"></td></tr></table></form></p>`,
  '',
);

test('tecdivegear: category links from the catalogue index', () => {
  const cats = parseCategoryLinks(INDEX_HTML);
  assert.deepEqual(cats, [
    { id: '2', name: "BCD's, Wings & Harnesses" },
    { id: '13', name: 'Regulators' },
    { id: '6', name: 'Dive Torches & Accessories' },
    { id: '35', name: 'Diving Trips' },
  ]);
});

test('tecdivegear: category page grid (ids, trimmed titles, $0.00 -> null, encoded thumbnails)', () => {
  const items = parseCategoryPage(CATEGORY_HTML);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], { id: '670', title: 'DiveRite FT1/XT2 Set', price: 1210, image: 'https://www.tecdivegear.com.au/images/products_small/RG5800-OW.jpg' });
  assert.equal(items[1].title, 'XT1/XT4 Stage Reg');
  assert.equal(items[1].price, 995);
  assert.equal(items[1].image, 'https://www.tecdivegear.com.au/images/products_small/XT4%20stage%20pkg.jpg');
  assert.equal(items[2].title, 'Pinnacle 7mm Tempo & Siren');
  assert.equal(items[2].price, null);
  assert.equal(items[2].image, '');
});

test('tecdivegear: money / image / availability helpers', () => {
  assert.equal(parseMoney('$1850.00'), 1850);
  assert.equal(parseMoney('$0.00'), null);
  assert.equal(parseMoney('$POA'), null);
  assert.equal(parseMoney(''), null);
  assert.equal(imageUrl('/images/products//Perdix3.jpg'), 'https://www.tecdivegear.com.au/images/products/Perdix3.jpg');
  assert.equal(imageUrl('/images/products_small/'), '');
  assert.equal(isPurchasable('Today'), true);
  assert.equal(isPurchasable('Today 1 in stock'), true);
  assert.equal(isPurchasable('Made to Order'), true);
  assert.equal(isPurchasable('On order'), true);
  assert.equal(isPurchasable(''), true);
  assert.equal(isPurchasable('Out of Stock'), false);
  assert.equal(isPurchasable('out of stock'), false);
  assert.equal(isPurchasable('no longer avaiable'), false);
  assert.equal(isPurchasable('No longer made'), false);
});

test('tecdivegear: product with priced size options (id 102)', () => {
  const d = parseProductPage(PRODUCT_102);
  assert.equal(d.title, 'HP Gauge Hoses');
  assert.equal(d.brand, ''); // "Manufacturer *" = unbranded
  assert.equal(d.sku, 'HOHPXX');
  assert.ok(d.description.startsWith('Finding just the right hose'));
  assert.ok(!d.description.includes('Manufacturer'));
  assert.ok(!d.description.includes('Product Code'));
  assert.equal(d.availability, 'Today');
  assert.equal(d.inStock, true);
  assert.equal(d.price, 60);
  assert.equal(d.category, 'Gauges, Hoses, Regulator Access.');
  assert.equal(d.categoryId, '18');
  assert.equal(d.image, 'https://www.tecdivegear.com.au/images/products/HP%20Hose.jpg');
  assert.deepEqual(d.variants.map((v) => [v.title, v.price, v.available]), [
    ['6 Inch', 60, true], ['9 Inch', 66, false], ['21 Inch', 77, true], ['24 Inch', 84, true], ['26 Inch', 88, true], ['32 Inch', 99, false],
  ]);
  assert.ok(d.variants.every((v) => v.compareAtPrice === null));

  const p = toProduct({ id: '102', title: 'HP Gauge Hoses', price: 60, image: 'https://www.tecdivegear.com.au/images/products_small/x.jpg', category: 'Gauges, Hoses, Regulator Access.' }, d);
  assert.equal(p.id, 'tecdivegear:102');
  assert.equal(p.url, 'https://www.tecdivegear.com.au/catalogue/product.php/1/102');
  assert.equal(p.price, 60);
  assert.equal(p.compareAtPrice, null);
  assert.equal(p.inStock, true);
  assert.equal(p.variants.length, 6);
  assert.equal(p.variants[1].available, false);
  assert.equal(p.sku, 'HOHPXX');
  assert.deepEqual(p.tags, []);
  assert.equal(p.image, 'https://www.tecdivegear.com.au/images/products/HP%20Hose.jpg');
});

test('tecdivegear: out-of-stock product where the displayed price is not the cheapest option (id 58)', () => {
  const d = parseProductPage(PRODUCT_58);
  assert.equal(d.brand, 'Dive Rite');
  assert.equal(d.sku, 'AC3220');
  assert.equal(d.inStock, false);
  assert.equal(d.price, 275);
  assert.ok(d.description.startsWith('The 20 lb Quick Buckle'));
  assert.deepEqual(d.variants.map((v) => [v.title, v.price]), [['QR System', 275], ['Single Insert', 77]]);
  const p = toProduct({ id: '58', title: 'Dive Rite 20Ib Pockets', price: 275, image: '', category: 'BCD Accessories, Pockets' }, d);
  assert.equal(p.inStock, false);
  assert.equal(p.price, 77); // no purchasable option -> lowest priced option
  assert.ok(p.variants.every((v) => v.available === false));
  assert.deepEqual(p.tags, ['Out of Stock']);
});

test('tecdivegear: price-on-application product (id 492)', () => {
  const d = parseProductPage(PRODUCT_492);
  assert.equal(d.title, 'Sofnolime 797');
  assert.equal(d.brand, 'Molecular');
  assert.equal(d.sku, '');
  assert.equal(d.price, null);
  assert.equal(d.inStock, true);
  const p = toProduct({ id: '492', title: 'Sofnolime 797', price: null, image: '', category: 'Optima Rebreather' }, d);
  assert.equal(p.price, null);
  assert.equal(p.variants.length, 0);
});

test('tecdivegear: colour + size selects and two images (id 4)', () => {
  const d = parseProductPage(PRODUCT_4);
  assert.equal(d.sku, 'PK6325');
  assert.ok(d.description.includes('you’re done!'), d.description);
  assert.deepEqual(d.colours, ['Blue Wing', 'OD Green Wing', 'Red Wing', 'Black Wing']);
  assert.equal(d.variants.length, 3);
  assert.equal(d.image, 'https://www.tecdivegear.com.au/images/products/PK6325.jpg'); // #pageright image, not the in-form one
  const p = toProduct({ id: '4', title: 'Transpac Travel Pack', price: 1245, image: '', category: "BCD's, Wings & Harnesses" }, d);
  assert.equal(p.price, 1245);
  assert.deepEqual(p.variants.map((v) => v.title), ['SM', 'MED', 'LG']);
  assert.equal(p.inStock, true);
});

test('tecdivegear: colour-only select becomes same-price variants; colour stock suffix is honoured (id 23 style)', () => {
  const html = PRODUCT_4.replace(/<select name="siz"[\s\S]*?<\/select>/i, '').replace('<OPTION>Red Wing </OPTION>', '<OPTION>Red Wing - Out of Stock</OPTION>');
  const d = parseProductPage(html);
  assert.equal(d.variants.length, 0);
  assert.deepEqual(d.colours, ['Blue Wing', 'OD Green Wing', 'Red Wing - Out of Stock', 'Black Wing']);
  const p = toProduct({ id: '4', title: 'Transpac Travel Pack', price: 1245, image: '', category: 'x' }, d);
  assert.deepEqual(p.variants.map((v) => [v.title, v.price, v.available]), [['Blue Wing', 1245, true], ['OD Green Wing', 1245, true], ['Red Wing', 1245, false], ['Black Wing', 1245, true]]);
  assert.equal(p.price, 1245);
  assert.equal(p.inStock, true);
  // product-level "Out of Stock" wins over an unmarked colour
  const oos = toProduct({ id: '4', title: 'x', price: 1245, image: '', category: 'x' }, { ...d, availability: 'Out of Stock', inStock: false });
  assert.ok(oos.variants.every((v) => v.available === false));
});

test('tecdivegear: every stock-annotation spelling is stripped from option labels', () => {
  const cases = [
    ['9 Inch - out of stock', '9 Inch'], ['11 Inch - On order', '11 Inch'], ['XXL - 2 left in stock', 'XXL'], ['XX Large - 1 in stock', 'XX Large'],
    ['MD   1 left in stock', 'MD'], ['3-5  1set in stock', '3-5'], ['6-7 1 set in stock', '6-7'], ['11-13  2 sets in stock', '11-13'], ['8-10 out of stock', '8-10'],
    ['114 ml  Out of stock', '114 ml'], ['Light Monkey 35.100.008 out of stock', 'Light Monkey 35.100.008'], ['7 US - 6 UK - EU 39  1 in Stock', '7 US - 6 UK - EU 39'],
    ['Adult Medium - 6 in Stock', 'Adult Medium'], ['Blue - Out of Stock', 'Blue'], ['RE4520 - Orange Line - Out of stock', 'RE4520 - Orange Line'], ['Large - Sold Out', 'Large'],
    // genuine label words survive, and a label that is nothing but the annotation is kept
    ['XT4 Left Hand', 'XT4 Left Hand'], ['84 Inch Left - 22 Inch Right', '84 Inch Left - 22 Inch Right'], ['San-O-Sub Left Hand - Notched', 'San-O-Sub Left Hand - Notched'], ['Out of Stock', 'Out of Stock'],
  ];
  for (const [input, want] of cases) assert.equal(stripStockSuffix(input), want, input);

  // through the page parser: titles stripped, availability still taken from the full label
  const sel = `<select name="siz"><option value="29.00|0.00">3-5  1set in stock</option>
<option value="29.00|0.00">8-10 out of stock</option>
<option value="30.00|0.00">XXL - 2 left in stock</option>
<option value="18.00|0.00">114 ml  Out of stock</option>
<option value="66.00|0.00">11 Inch - On order</option>
</select>`;
  const d = parseProductPage(PRODUCT_102.replace(/<select name="siz"[\s\S]*?<\/select>/i, sel));
  assert.deepEqual(d.variants.map((v) => [v.title, v.price, v.available]), [['3-5', 29, true], ['8-10', 29, false], ['XXL', 30, true], ['114 ml', 18, false], ['11 Inch', 66, true]]);
  const p = toProduct({ id: '102', title: 'x', price: 60, image: '', category: 'x' }, d);
  assert.ok(p.variants.every((v) => !/\b(in stock|out of stock|on order)\b/i.test(v.title)));
  assert.equal(p.price, 29);
});

test('tecdivegear: named entities in copy are decoded and unknown ones never leak', () => {
  const html = PRODUCT_58.replace('<p><div id=\'productText\'>', '<p><div id=\'productText\'><p>Dive Rite&acute;s pocket &bull; accuracy &lt; &plusmn;2 ppm &ndash; 10&deg;C &acirc;&ndash;&nbsp;Splash &raquo; &bogusentity; end</p>');
  const d = parseProductPage(html);
  assert.ok(d.description.startsWith('Dive Rite´s pocket • accuracy < ±2 ppm – 10°C • Splash » end'), d.description);
  assert.ok(!/&[a-zA-Z0-9#]+;/.test(d.description), d.description);
  assert.equal(parseProductPage(PRODUCT_58.replace('<h1>Dive Rite 20Ib Pockets</h1>', '<h1>Dive Rite &ldquo;QB&rdquo; Pockets &amp; Inserts</h1>')).title, 'Dive Rite “QB” Pockets & Inserts');
});

test('tecdivegear: size options without a price in their value fall back to the displayed price', () => {
  const sel = `<select name="siz"><option value="">Small</option>
<option value="0.00|0.00">Large</option>
<option value="66.00|0.00">XL - out of stock</option>
</select>`;
  const d = parseProductPage(PRODUCT_102.replace(/<select name="siz"[\s\S]*?<\/select>/i, sel));
  assert.equal(d.price, 60);
  assert.deepEqual(d.variants.map((v) => [v.title, v.price]), [['Small', null], ['Large', null], ['XL', 66]]);
  const p = toProduct({ id: '102', title: 'x', price: 60, image: '', category: 'x' }, d);
  assert.deepEqual(p.variants.map((v) => [v.title, v.price, v.available]), [['Small', 60, true], ['Large', 60, true], ['XL', 66, false]]);
  assert.equal(p.price, 60); // not null -> build.js keeps it
  // ...but a price-on-application page whose options carry no price either stays null
  const poa = toProduct({ id: '102', title: 'x', price: null, image: '', category: 'x' }, { ...d, price: null, variants: d.variants.map((v) => ({ ...v, price: null })) });
  assert.equal(poa.price, null);
  assert.ok(poa.variants.every((v) => v.price === null));
});

test('tecdivegear: missing product id yields null; listing-only fallback still builds a product', () => {
  assert.equal(parseProductPage(PRODUCT_MISSING), null);
  const p = toProduct({ id: '911', title: 'XT1/XT4 Stage Reg', price: 995, image: 'https://www.tecdivegear.com.au/images/products_small/XT4%20stage%20pkg.jpg', category: 'Regulators' }, null);
  assert.equal(p.id, 'tecdivegear:911');
  assert.equal(p.price, 995);
  assert.equal(p.inStock, true);
  assert.equal(p.category, 'Regulators');
  assert.equal(p.image, 'https://www.tecdivegear.com.au/images/products_small/XT4%20stage%20pkg.jpg');
  assert.equal(p.brand, '');
  assert.deepEqual(p.variants, []);
});

test('tecdivegear: category parsers stay linear on a page full of unclosed tags (backtracking regression)', () => {
  const hostile = '<a '.repeat(100_000); // 300 KB; with [^>]* this took >20 s per MB
  for (const [name, fn] of [['parseCategoryLinks', parseCategoryLinks], ['parseCategoryPage', parseCategoryPage], ['parseProductPage', parseProductPage]]) {
    const t0 = performance.now();
    const out = fn(hostile);
    const ms = performance.now() - t0;
    assert.ok(ms < 2000, `${name} took ${ms.toFixed(0)} ms`);
    assert.ok(out === null || (Array.isArray(out) && out.length === 0));
  }
});
