import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBrand, brandFromTitle, classifyCategory, modelTokens, tokenSimilarity, normalizeSku, displayBrand, genderOf } from '../lib/normalize.js';
import { makeProduct, parsePrice } from '../lib/product.js';
import { groupProducts, enrich } from '../build.js';

test('brand aliases collapse to a canonical brand', () => {
  assert.equal(normalizeBrand('Aqua Lung'), 'aqualung');
  assert.equal(normalizeBrand('SCUBAPRO'), 'scubapro');
  assert.equal(normalizeBrand('Scuba Pro'), 'scubapro');
  assert.equal(normalizeBrand('Atomic'), 'atomic aquatics');
  assert.equal(normalizeBrand('Fourth Element'), 'fourth element');
  assert.equal(normalizeBrand(''), '');
  assert.equal(brandFromTitle('Mares X-Vision Ultra Liquidskin Mask'), 'mares');
  assert.equal(brandFromTitle('Ocean Reef Neptune III'), 'ocean reef');
  assert.equal(displayBrand('fourth element'), 'Fourth Element');
  assert.equal(displayBrand('oms'), 'OMS');
});

test('category classifier', () => {
  assert.equal(classifyCategory('', 'Mares X-Vision Ultra Liquidskin Mask'), 'mask');
  assert.equal(classifyCategory('Regulators', 'Scubapro MK25 EVO / S620 Ti'), 'regulator');
  assert.equal(classifyCategory('', 'PADI Open Water Course'), 'exclude');
  assert.equal(classifyCategory('Courses', 'Advanced Adventurer'), 'exclude');
  assert.equal(classifyCategory('', 'Mask strap - black'), 'spare part');
  assert.equal(classifyCategory('', 'Shearwater Perdix 2 Ti'), 'dive computer');
  assert.equal(classifyCategory('', 'Regulator Service'), 'exclude');
  assert.equal(classifyCategory('', 'Apeks Service Kit DS4'), 'spare part');
  assert.equal(classifyCategory('', 'Scubapro Hydros Pro BCD'), 'bcd');
  assert.equal(classifyCategory('', 'Bigblue AL1200NP Torch'), 'torch');
  assert.equal(classifyCategory('', 'Gift Card $100'), 'exclude');
  assert.equal(classifyCategory('', 'Scubapro Core Warmer Vest'), 'wetsuit');
});

test('sport words in tags do not override the retailer category or title', () => {
  // Adreno cross-lists gear in its spearfishing / freediving sections via "Sport: *" and campaign tags
  const sportTags = ['Sport: Freediving', 'Sport: Spear', 'Sport: Spearfishing', 'clearance-spear', 'Products: Computers'];
  assert.equal(classifyCategory('ACCESSORIES - DIVE COMPUTERS', 'Suunto D5 Wrist Dive Computer', sportTags), 'dive computer');
  assert.equal(classifyCategory('MSF MASKS - MASKS', 'Cressi Fiji Mask', ['Sport: Freediving', 'Sport: Spearfishing', 'easter-2026-spear', 'Mask Size: Medium']), 'mask');
  assert.equal(classifyCategory('ACCESSORIES - KNIVES', 'Mares Force PLUS Knife', ['Sport: Spear']), 'knife');
  // Dive Gear Australia tags every product with each category it is cross-listed in
  assert.equal(classifyCategory('Diving Masks', 'Aqualung Linea Women’s Dive Masks', ['Freediving', 'Kids Spearfishing']), 'mask');
  assert.equal(classifyCategory('Dive Computer', 'Cressi Goa Dive Computer', ['Freediving Watches', 'Spearfishing Watches']), 'dive computer');
  assert.equal(classifyCategory('Freediving Computers', 'Cressi Nepto Freediving Watch Computer'), 'dive computer');
  assert.equal(classifyCategory('ACCESSORIES - COMPUTERS', 'Suunto D4f Freediving Wrist Computer Black', ['Sport: Freediving']), 'dive computer');
  // ...but real spearfishing gear still counts, and the sport named in the shop's own category
  // decides when nothing else does (a freediving *fin* is a fin)
  assert.equal(classifyCategory('Spearguns', 'Rob Allen Tuna Railgun 110cm', ['Sport: Spearfishing']), 'spearfishing');
  assert.equal(classifyCategory('Freediving Fins', 'Cressi Gara 3000 LD', ['Sport: Freediving']), 'fins');
  assert.equal(classifyCategory('Free Diving', '3 Barb Cluster', ['freediving']), 'spearfishing');
  assert.equal(classifyCategory('Fishing', 'Fibreglass 3pc 12mm Handspear', ['hand spear']), 'spearfishing');
  assert.equal(classifyCategory('', 'Rob Allen Trigger Mech - Cassette Only', ['Speargun Spares']), 'spare part');
  // a wetsuit jacket is a wetsuit, a jacket-style BCD is a BCD
  assert.equal(classifyCategory('WETSUITS MENS ONE PIECE - 1-3MM WARM', 'SALT Element Mens Jacket Wetsuit - 5/4mm', ['Sport: Spearfishing']), 'wetsuit');
  assert.equal(classifyCategory('Spearfishing Gear - Spearfishing Wetsuits - Two Piece Wetsuits', 'Rob Allen Open Cell 3.5mm Hooded Jacket', ['Freediving']), 'wetsuit');
  assert.equal(classifyCategory('Tops', 'Guardian Man 2mm Jacket'), 'wetsuit');
  assert.equal(classifyCategory('BCDs', 'Mares Jacket Style BCD'), 'bcd');
  assert.equal(classifyCategory('', 'Scubapro Hydros Pro BCD', ['Sport: Scubadiving']), 'bcd');
});

test('model tokens and similarity', () => {
  const sim = (a, b, brand) => tokenSimilarity(modelTokens(a, brand), modelTokens(b, brand));
  assert.ok(sim('Scubapro MK25 EVO / S620 Ti Regulator', 'SCUBAPRO MK25 EVO S620Ti Reg', 'scubapro') >= 0.9);
  assert.ok(sim('Apeks XTX50 Regulator Set DIN', 'Apeks XTX 50 Reg DIN', 'apeks') >= 0.8);
  assert.ok(sim('Apeks XTX50 Regulator Set DIN', 'Apeks XTX200 Regulator Set DIN', 'apeks') < 0.5);
  assert.ok(sim('Mares Puck Pro Plus', 'Mares Puck Pro+ Dive Computer', 'mares') >= 0.8);
  assert.ok(sim('Suunto D5 Dive Computer', 'Suunto D4i Novo', 'suunto') < 0.2);
  assert.ok(sim('Scubapro Jet Fins', 'Scubapro Go Sport Fins', 'scubapro') < 0.3);
  assert.ok(sim('Mares X-Vision Ultra Liquidskin Mask - Black/Clear', 'Mares X Vision Ultra LiquidSkin Mask Blue', 'mares') >= 0.6);
  // model suffix letters are not sizes; sizes next to "size" are
  assert.ok(sim('Suunto Nautic S Wrist Dive Computer', 'Suunto Nautic Dive Computer', 'suunto') < 0.55);
  assert.ok(sim('Suunto Nautic S Wrist Dive Computer', 'Nautic S Dive Computer', 'suunto') >= 0.9);
  assert.ok(sim('Scubapro Hydros Pro BCD Womens Size M', 'Scubapro Hydros Pro BCD Womens', 'scubapro') >= 0.9);
  // bundles, generations and inclusions are kept apart
  assert.equal(sim('Cressi Aquawing Plus Scuba Diving - Pack', 'Cressi Aquawing Plus BCD', 'cressi'), 0);
  assert.equal(sim('Scubapro MK25 EVO / S620 Ti with Octopus', 'Scubapro MK25 EVO / S620 Ti', 'scubapro'), 0);
  assert.equal(sim('Scubapro Hydros Pro BCD', 'Scubapro Hydros BCD', 'scubapro'), 0);
  assert.ok(sim('Suunto Nautic Dive Computer with Textile Wristband', 'Suunto Nautic Dive Computer', 'suunto') >= 0.9);
  assert.ok(sim('Suunto Nautic Wrist Dive Computer with Nylon Textile Strap', 'SUUNTO Nautic Elastic Textile Strap', 'suunto') < 0.55);
});

test('displayBrand keeps deliberate retailer spellings for unknown brands', () => {
  assert.equal(displayBrand('wmd', 'WMD'), 'WMD');
  assert.equal(displayBrand('jj ccr', 'JJ-CCR'), 'JJ-CCR');
  assert.equal(displayBrand('omniswivel', 'OMNISWIVEL'), 'Omniswivel');
  assert.equal(displayBrand('mcnett gear aid', 'McNett / Gear Aid'), 'McNett / Gear Aid');
  assert.equal(displayBrand('cressi', 'CRESSI'), 'Cressi');
});

test('sku normalisation', () => {
  assert.equal(normalizeSku('ab-12345'), 'AB12345');
  assert.equal(normalizeSku('1234'), '');
  assert.equal(normalizeSku('abcdef'), '');
});

test('parsePrice', () => {
  assert.equal(parsePrice('$1,299.95'), 1299.95);
  assert.equal(parsePrice('59.00'), 59);
  assert.equal(parsePrice(5900, { cents: true }), 59);
  assert.equal(parsePrice('abc'), null);
  assert.equal(parsePrice(null), null);
});

test('makeProduct derives price and stock from variants', () => {
  const p = makeProduct({
    retailer: 'x', sourceId: '1', title: 'Thing', url: 'https://x.test/p',
    variants: [
      { title: 'S', price: '10', available: false },
      { title: 'M', price: '12', available: true, compareAtPrice: '15' },
    ],
  });
  assert.equal(p.id, 'x:1');
  assert.equal(p.price, 12);
  assert.equal(p.compareAtPrice, 15);
  assert.equal(p.inStock, true);
  const q = makeProduct({ retailer: 'x', sourceId: '2', title: 'Thing', url: 'https://x.test/p', price: 10, compareAtPrice: 8 });
  assert.equal(q.compareAtPrice, null);
  assert.throws(() => makeProduct({ retailer: 'x', sourceId: '3', title: 'T', url: '/relative' }));
});

test('groupProducts joins the same product across retailers only', () => {
  const mk = (r, id, title, brand, sku = '') => enrich(makeProduct({ retailer: r, sourceId: id, title, brand, sku, url: 'https://x.test/' + id, price: 100 }));
  const items = [
    mk('a', '1', 'Scubapro MK25 EVO / S620 Ti Regulator', 'Scubapro'),
    mk('b', '2', 'SCUBAPRO MK25 EVO S620Ti Reg', 'Scuba Pro'),
    mk('c', '3', 'Scubapro MK17 EVO / S620 Ti Regulator', 'Scubapro'),
    mk('a', '4', 'Cressi Big Eyes Evolution Mask', 'Cressi'),
    mk('b', '5', 'Cressi Big Eyes Evo Mask', 'Cressi'),
    mk('a', '6', 'Widget', '', 'ZZ-99999'),
    mk('b', '7', 'Some other widget name', '', 'zz99999'),
  ];
  groupProducts(items);
  assert.equal(items[0].g, items[1].g);
  assert.notEqual(items[0].g, items[2].g);
  assert.equal(items[3].g, items[4].g);
  assert.equal(items[5].g, items[6].g);
});

test('exclusions keep gear whose title or category merely mentions a service word', () => {
  // over-broad words dropped ~200 real products: Nitrox regulators, travel bags, service parts, repair adhesive
  assert.equal(classifyCategory('Regulators', 'Scubapro MK2 EVO / R195 Nitrox Regulator'), 'regulator');
  assert.equal(classifyCategory('Dive Computers', 'Mares Puck Pro + Nitrox Wrist Dive Computer'), 'dive computer');
  assert.equal(classifyCategory('Dive Gear and Travel Bags', 'Mares Cruise Backpack Pro'), 'bag');
  assert.equal(classifyCategory('Travel', 'Scubapro Hydros Pro 2 BCD'), 'bcd');
  assert.equal(classifyCategory('Service Parts', 'Apeks DIN to Yoke Converter'), 'spare part');
  assert.equal(classifyCategory('Servicing', 'D9 Drysuit Outlet Valve'), 'spare part');
  assert.equal(classifyCategory('Repairs', 'Aquaseal FD Repair Adhesive'), 'accessories');
  assert.equal(classifyCategory('', 'Freediving Training Buoy'), 'reel & smb');
  assert.equal(classifyCategory('Drysuits', 'Northern Diver Divemaster Evolution 12 Drysuit'), 'drysuit');
  assert.notEqual(classifyCategory('', 'Scuba First Aid Kit'), 'exclude');
  // ...while services, courses, trips and non-gear are still dropped
  assert.equal(classifyCategory('', 'Regulator Service - 1st and 2nd stage'), 'exclude');
  assert.equal(classifyCategory('Service', 'Battery Change'), 'exclude');
  assert.equal(classifyCategory('Scuba Packages', 'Learn to Dive for Free Package (Axiom L)'), 'exclude');
  assert.equal(classifyCategory('', 'South West Rocks - June 2027 Long Weekend Getaway'), 'exclude');
  assert.equal(classifyCategory('Drysuit', 'Bare Aqua Trek 1 Drysuit: EX DEMO MENS XS'), 'exclude');
  assert.equal(classifyCategory('Jewellery', 'Mola Mola Earrings'), 'exclude');
  assert.equal(classifyCategory('', 'Cylinder Pressure Check'), 'exclude');
});

test('the title outranks retailer labels and tags; sets and undergarments are their own categories', () => {
  assert.equal(classifyCategory('Hoods Boots Gloves & Socks', 'Halcyon Hood'), 'hood');
  assert.equal(classifyCategory('Regulators - Full Face Diving Masks', 'Ocean Reef Neptune III Full Face Mask'), 'mask');
  assert.equal(classifyCategory('', 'Cressi DIGI 2 Digital Gauge Console', ['computer']), 'gauge');
  assert.equal(classifyCategory('SPEARGUNS - CLOSED MUZZLE', 'Rob Allen Sparid Evo', ['Species Guide: Pelagic', 'video=abc']), 'spearfishing');
  assert.equal(classifyCategory('Spearfishing Gear - Spearfishing Accessories', 'Rob Allen Gun Grip'), 'spearfishing');
  assert.equal(classifyCategory('', 'Cressi Big Eyes Evo + Alpha Ultra Dry MS Set'), 'package');
  assert.equal(classifyCategory('', 'Ocean Pro Woolamai Junior Mask Snorkel Fin Set'), 'package');
  assert.equal(classifyCategory('', 'Fourth Element Arctic Leggings'), 'undergarment');
  assert.equal(classifyCategory('', 'Enth Degree Mens Atoll Hooded Thermal Vest'), classifyCategory('', 'Enth Degree Atoll Hooded Vest Mens'));
  assert.equal(classifyCategory('', 'Oceanic Alpha 8 Occy'), 'regulator');
  assert.equal(classifyCategory('', 'Hollis SMS Katana 2'), 'bcd');
  assert.equal(classifyCategory('', 'Suunto Nautic Wrist Dive Computer with Nylon Textile Strap'), 'dive computer');
  assert.equal(classifyCategory('', 'SUUNTO Nautic Elastic Textile Strap'), 'spare part');
  assert.equal(classifyCategory('', 'Seac Wild Anti-Fog Freediving Mask'), 'mask');
  assert.equal(classifyCategory('', 'Adreno Mask Anti-Fog Liquid'), 'accessories');
  assert.equal(classifyCategory('', 'Hollis M3 Lens Right +4.0'), 'spare part');
  assert.equal(classifyCategory('', 'Rob Allen Timberline Havoc Triple Rubber 130cm No Reel'), 'spearfishing');
  assert.equal(classifyCategory('', 'Tank Banger'), 'accessories');
  assert.equal(classifyCategory('', 'Scubapro FS-2 Compass Capsule (No Boot)'), 'gauge');
  assert.equal(classifyCategory('', 'Rob Allen 16mm Roller Speargun Powerband'), 'spearfishing');
});

test('tokeniser folds trademark symbols, compounds, plurals and gender words', () => {
  const sim = (a, b, brand) => tokenSimilarity(modelTokens(a, brand), modelTokens(b, brand));
  assert.ok(sim('Garmin Descent™ Mk3i', 'Garmin Descent Mk3i', 'garmin') >= 0.9);
  assert.ok(sim('Halcyon 1.4m SMB Closed Circuit', 'Halcyon Closed-Circuit Surface Marker Buoy 1.4m', 'halcyon') >= 0.9);
  assert.equal(sim('Halcyon 1m SMB Closed Circuit', 'Halcyon Open Circuit SMB 1m', 'halcyon'), 0);
  assert.ok(sim('Cressi Fast Man 5mm Steamer Wetsuit', "Cressi Fast 5mm Steamer Mens's", 'cressi') >= 0.9);
  assert.ok(sim('Apeks XTX50 Regulator', 'XTX50 DIN Regulator (1st & 2nd stage)', 'apeks') >= 0.9);
  assert.ok(sim('Apeks XTX 50 Occy', 'Apeks XTX50 Octopus 2nd Stage Regulator', 'apeks') >= 0.9);
  assert.ok(sim('Cressi Leonardo Wrist Strap', 'Cressi Leonardo Wrist Straps', 'cressi') >= 0.9);
  assert.ok(sim('TUSA Hyperdry Elite II Dry Top Snorkel', 'Tusa Hyperdry Elite II Snorkel', 'tusa') >= 0.55);
  assert.ok(sim('Shearwater Swift Wireless AI Transmitter', 'Shearwater Swift Transmitter', 'shearwater') >= 0.9);
  assert.ok(sim('Cressi Big Eyes Evo + Alpha Ultra Dry MS Set', 'Cressi Big Eyes Evolution & Alpha Ultra Dry Mask Snorkel Set', 'cressi') >= 0.8);
  assert.ok(sim('Suunto D5 Wrist Dive Computer', 'D5 Wildberry Dive Computer', 'suunto') >= 0.9);
  // differentiators: a wing is not the system it goes on, a colour kit is not the BCD, a set's contents matter
  assert.equal(sim('Hollis ST22 Wing With Slots', 'Hollis ST 22 System', 'hollis'), 0);
  assert.equal(sim('Scubapro Hydros Pro BC', 'Scubapro Hydros Pro Colour Kit', 'scubapro'), 0);
  assert.equal(sim('Waterproof Silicone Neck Seals', 'Waterproof Silicone Wrist Seals', 'waterproof'), 0);
  assert.equal(sim('Ocean Pro Woolamai Junior Mask Snorkel Fin Set', 'Ocean Pro Woolamai Junior Snorkel & Fin Set', 'ocean pro'), 0);
  assert.equal(genderOf('Cressi Fast Man 5mm Steamer'), 'm');
  assert.equal(genderOf('Fourth Element Thermocline Jacket - Female'), 'w');
  assert.equal(genderOf('Gloves (MALE & FEMALE)'), '');
  assert.deepEqual(modelTokens('Ocean Hunter Muzzle Bungee w/Snap clip', 'ocean hunter').tail, ['snap', 'clip']);
});

test('groupProducts: SKU-joined clusters take part in complete linkage, with a price veto and SKU sanity checks', () => {
  const mk = (r, id, title, brand, sku = '', price = 100) => enrich(makeProduct({ retailer: r, sourceId: id, title, brand, sku, url: 'https://x.test/' + id, price }));
  // a shop's generic "Safety Octopus 2nd Stage" listings, SKU-joined to two different TUSA octos, used to chain the two together
  const chain = [
    mk('a', '1', 'TUSA SS0001 Occy', 'TUSA', 'SS0001', 319),
    mk('b', '2', 'Safety Octopus 2nd Stage', 'TUSA', 'SS-0001', 279),
    mk('a', '3', 'TUSA SS0007 Octopus', 'TUSA', 'SS0007', 219),
    mk('b', '4', 'Safety Octopus 2nd Stage', 'TUSA', 'SS-0007', 219),
  ];
  groupProducts(chain);
  assert.equal(chain[0].g, chain[1].g);
  assert.equal(chain[2].g, chain[3].g);
  assert.notEqual(chain[0].g, chain[2].g);
  // ...but a terse title still rides on its SKU twin's title
  const twins = [
    mk('a', '1', 'Oceanic Alpha 8 Octopus', 'Oceanic', 'OC-88801', 200),
    mk('b', '2', 'Alpha 8 SP5 Yoke Octo', 'Oceanic', 'OC88801', 210),
    mk('c', '3', 'Oceanic Alpha 8 Octopus', 'Oceanic', '', 205),
  ];
  groupProducts(twins);
  assert.equal(twins[0].g, twins[1].g);
  assert.equal(twins[0].g, twins[2].g);
  // the same name at 4x the price is an accessory or a mistake, not the same product
  const priced = [mk('a', '1', 'Halcyon Storage Pak', 'Halcyon', '', 149), mk('b', '2', 'Halcyon Storage Pak', 'Halcyon', '', 35), mk('c', '3', 'Halcyon Storage Pak', 'Halcyon', '', 139)];
  groupProducts(priced);
  assert.equal(priced[0].g, priced[2].g);
  assert.notEqual(priced[0].g, priced[1].g);
  // a shop's SKU reused for another size or a related part does not join them
  const skus = [
    mk('a', '1', 'Stahlsac Steel 27 wheeled bag', 'Stahlsac', '888910BLK', 425),
    mk('b', '2', 'Stahlsac Steel 34 Dive Roller Bag', 'Stahlsac', '888910BLK', 599),
    mk('a', '3', 'Light & Motion Sola Dive Pro 2000', 'Light & Motion', 'LM8040228', 799),
    mk('b', '4', 'Light & Motion GoBe S 2.2 Body', 'Light & Motion', 'LM8040228', 170),
    mk('a', '5', 'Scubapro R095 Octopus', 'Scubapro', '11.331.000', 275),
    mk('b', '6', 'Scubapro R195 Octopus', 'Scubapro', '11331000', 319),
    mk('c', '7', 'Scubapro R195 Octo', 'Scubapro', '11331000', 329),
  ];
  groupProducts(skus);
  assert.notEqual(skus[0].g, skus[1].g);
  assert.notEqual(skus[2].g, skus[3].g);
  assert.notEqual(skus[4].g, skus[5].g);
  assert.equal(skus[5].g, skus[6].g);
  // what follows "with" tells otherwise identical listings apart, and a set is defined by its contents
  const tails = [
    mk('a', '1', 'Ocean Hunter Muzzle Bungee w/Snap clip', 'Ocean Hunter', '', 13.99),
    mk('a', '2', 'Ocean Hunter Muzzle Bungee w/Pigtail Clip', 'Ocean Hunter', '', 15.99),
    mk('b', '3', 'Ocean Hunter Muzzle Bungee with Snap Clip', 'Ocean Hunter', '', 14),
    mk('b', '4', 'Ocean Hunter Muzzle Bungee with Pigtail Clip', 'Ocean Hunter', '', 16),
    mk('c', '5', 'Ocean Pro Woolamai Junior Mask Snorkel Fin Set', 'Ocean Pro', '', 99.99),
    mk('d', '6', 'Ocean Pro Woolamai Junior Snorkel & Fin Set', 'Ocean Pro', '', 75),
  ];
  groupProducts(tails);
  assert.equal(tails[0].g, tails[2].g);
  assert.equal(tails[1].g, tails[3].g);
  assert.notEqual(tails[0].g, tails[1].g);
  assert.notEqual(tails[4].g, tails[5].g);
});

test('brand: My Dive Gear placeholders and TUSA distributor name', () => {
  assert.equal(normalizeBrand('Not specified'), '');
  assert.equal(normalizeBrand('My Dive Gear'), '');
  assert.equal(normalizeBrand('Tabata Australia Pty Ltd'), 'tusa');
  assert.equal(displayBrand('tusa', 'Tabata Australia Pty Ltd'), 'TUSA');
});

test('classify: a trip advertised by its number of nights is excluded whatever its category says', () => {
  assert.equal(classifyCategory('Dive Travel', "Raja Ampat 6-Night X'mas Dive Adventure - December 20-26, 2026"), 'exclude');
  assert.equal(classifyCategory('Dive Travel', 'Fourth Element Expedition Duffel Bag Grey'), 'bag');
  assert.equal(classifyCategory('Dive Lights', 'Apollo Nightfish Flash Light - 1200 Lumens'), 'torch');
});
