import { test } from 'node:test';
import assert from 'node:assert/strict';
import retailer, { parseSearchPage, productsFromPages, rowToProduct, categoryPath, commonTitle, imageUrl, productUrl, walkPages, BASE } from '../retailers/scubadoctor.js';

// Trimmed real ajax_search.php response (Sep 2026): nine listing rows and their family members,
// with data.filters.category_hierarchy pruned to the branches those rows use. Row fields the parser
// does not read were dropped to keep the fixture small.
const FIXTURE = {
  "success": true,
  "data": {
    "products": [
      {
        "id": "7367",
        "name": "Tusa Neoprene Mask Strap Cover/Tamer | Black",
        "model": "MS-20-BK",
        "image": "tusa/tusa-mask-tamer-ms-20_10-black.jpg",
        "manufacturer": "Tusa",
        "category_id": "475",
        "quantity": "1",
        "has_attributes": false,
        "product_is_call": 0,
        "currentlyUnavailable": 0,
        "products_clearance": 0,
        "rrp": 19.9,
        "sell": 17.91,
        "family_id": 1754,
        "family_url": "index.php?main_page=product_info&products_id=7367",
        "family_name": "Tusa Neoprene Mask Strap Cover Tamer",
        "display_name": "Tusa Neoprene Mask Strap Cover Tamer",
        "availability_flag": ""
      },
      {
        "id": "1253",
        "name": "Gear Aid Antifog Sea Gold Mask Gel - Squeeze Pack (37ml)",
        "model": "M40851",
        "image": "gear-aid/gear-aid-sea-gold.jpg",
        "manufacturer": "Gear Aid",
        "category_id": "126",
        "quantity": "1",
        "has_attributes": false,
        "product_is_call": 0,
        "currentlyUnavailable": 0,
        "products_clearance": 0,
        "rrp": 19.95,
        "sell": 14.5,
        "family_id": 1336,
        "family_url": "index.php?main_page=product_info&products_id=1253",
        "family_name": "Gear Aid Antifog Sea Gold Mask Gel Squeeze Pack 37ml",
        "display_name": "Gear Aid Antifog Sea Gold Mask Gel Squeeze Pack 37ml",
        "availability_flag": ""
      },
      {
        "id": "17394",
        "name": "SSI Open Water Diver Course",
        "model": "SSI-OWD-93700550",
        "image": "mares/SSI-OpenWaterDiverCourseImage.jpg",
        "manufacturer": "SSI",
        "category_id": "668",
        "quantity": "9997",
        "has_attributes": true,
        "product_is_call": 0,
        "currentlyUnavailable": 0,
        "products_clearance": 0,
        "rrp": 795,
        "sell": 795,
        "family_id": null,
        "family_url": "",
        "family_name": "",
        "display_name": "SSI Open Water Diver Course",
        "availability_flag": ""
      },
      {
        "id": "3937",
        "name": "Dolphin Tech Crotch Strap - 50mm (2in)",
        "model": "IST-HB3",
        "image": "dolphin_tech/dolphin-tech-crotch-strap.jpg",
        "manufacturer": "Dolphin Tech",
        "category_id": "65",
        "quantity": "8",
        "has_attributes": false,
        "product_is_call": 0,
        "currentlyUnavailable": 0,
        "products_clearance": 0,
        "rrp": 0,
        "sell": 0,
        "family_id": null,
        "family_url": "",
        "family_name": "",
        "display_name": "Dolphin Tech Crotch Strap - 50mm (2in)",
        "availability_flag": ""
      },
      {
        "id": "4753",
        "name": "Atomic Aquatics Venom Anti-Reflective Coating (ARC) Mask",
        "model": "04-0250-00",
        "image": "atomic/atomic-aquatics-venom-arc-mask.jpg",
        "manufacturer": "Atomic Aquatics",
        "category_id": "125",
        "quantity": "1",
        "has_attributes": false,
        "product_is_call": 1,
        "currentlyUnavailable": 0,
        "products_clearance": 0,
        "rrp": 449.95,
        "sell": 188,
        "family_id": null,
        "family_url": "",
        "family_name": "",
        "display_name": "Atomic Aquatics Venom Anti-Reflective Coating (ARC) Mask",
        "availability_flag": ""
      },
      {
        "id": "5550",
        "name": "Scuba Ninja Cap - Cray King",
        "model": "SNCAP-CRAY-KING",
        "image": "scuba-hub/scuba-hub-cap-cray-king.jpg",
        "manufacturer": "Scuba Ninja",
        "category_id": "378",
        "quantity": "9",
        "has_attributes": false,
        "product_is_call": 0,
        "currentlyUnavailable": 0,
        "products_clearance": 0,
        "rrp": 15,
        "sell": 10,
        "family_id": 268,
        "family_url": "index.php?main_page=product_info&products_id=5549",
        "family_name": "Scuba Ninja Cap",
        "display_name": "Scuba Ninja Cap",
        "availability_flag": "Superseded"
      },
      {
        "id": "3016",
        "name": "Cressi Fin Strap (Single)",
        "model": "BZ170002",
        "image": "cressi-sub/Cressi-Sub_Fin_Strap_FINSTC.jpg",
        "manufacturer": "Cressi",
        "category_id": "471",
        "quantity": "1",
        "has_attributes": false,
        "product_is_call": 0,
        "currentlyUnavailable": 0,
        "products_clearance": 0,
        "rrp": 24.95,
        "sell": 22.45,
        "family_id": null,
        "family_url": "",
        "family_name": "",
        "display_name": "Cressi Fin Strap (Single)",
        "availability_flag": ""
      },
      {
        "id": "5111",
        "name": "Cressi Fast Wetsuit - 7mm Ladies | 4 / L",
        "model": "PA101804",
        "image": "cressi-sub/cressi-fast-wetsuit-womens-7mm.jpg",
        "manufacturer": "Cressi",
        "category_id": "79",
        "quantity": "2",
        "has_attributes": false,
        "product_is_call": 0,
        "currentlyUnavailable": 0,
        "products_clearance": 1,
        "rrp": 469,
        "sell": 422.1,
        "family_id": 84,
        "family_url": "index.php?main_page=product_info&products_id=5111",
        "family_name": "Cressi Fast Wetsuit 7mm Ladies",
        "display_name": "Cressi Fast Wetsuit 7mm Ladies",
        "availability_flag": ""
      },
      {
        "id": "4972",
        "name": "Hyperion 2 Hole Aluminium Ball and Joint Clamp",
        "model": "HY-L-CL-STD",
        "image": "hyperion/hyperion-standard-ball-clamp-1in.jpg",
        "manufacturer": "Hyperion",
        "category_id": "404",
        "quantity": "0",
        "has_attributes": false,
        "product_is_call": 0,
        "currentlyUnavailable": 0,
        "products_clearance": 0,
        "rrp": 46,
        "sell": 38,
        "family_id": null,
        "family_url": "",
        "family_name": "",
        "display_name": "Hyperion 2 Hole Aluminium Ball and Joint Clamp",
        "availability_flag": ""
      }
    ],
    "has_more": false,
    "family_members": {
      "268": [
        {
          "products_id": 5549,
          "products_model": "SN-CAP-DRAGONS",
          "products_name": "Scuba Ninja Cap - Purple",
          "products_image": "scuba-hub/scuba-hub-here-be-dragons-cap.jpg",
          "products_quantity": 0,
          "rrp": 22,
          "sell": 22,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 5550,
          "products_model": "SNCAP-CRAY-KING",
          "products_name": "Scuba Ninja Cap - Cray King",
          "products_image": "scuba-hub/scuba-hub-cap-cray-king.jpg",
          "products_quantity": 9,
          "rrp": 15,
          "sell": 10,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 5551,
          "products_model": "SN-CAP-PPD",
          "products_name": "Scuba Ninja Cap - Port Phillip Diver - White",
          "products_image": "scuba-hub/scuba-hub-port-phillip-diver-cap.jpg",
          "products_quantity": 0,
          "rrp": 22,
          "sell": 22,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 9693,
          "products_model": "SN-CAP-DRAGONS-OR",
          "products_name": "Scuba Ninja Cap - Orange",
          "products_image": "scuba-hub/scuba-hub-here-be-dragons-cap.jpg",
          "products_quantity": 0,
          "rrp": 22,
          "sell": 22,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 9694,
          "products_model": "SN-CAP-PPD-BL",
          "products_name": "Scuba Ninja Cap - Port Phillip Diver - Blue",
          "products_image": "scuba-hub/scuba-hub-port-phillip-diver-cap.jpg",
          "products_quantity": 0,
          "rrp": 22,
          "sell": 22,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 9695,
          "products_model": "SN-CAP-PPD-BK",
          "products_name": "Scuba Ninja Cap - Port Phillip Diver - Black",
          "products_image": "scuba-hub/scuba-hub-port-phillip-diver-cap.jpg",
          "products_quantity": 0,
          "rrp": 22,
          "sell": 22,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        }
      ],
      "84": [
        {
          "products_id": 5111,
          "products_model": "PA101804",
          "products_name": "Cressi Fast Wetsuit - 7mm Ladies | 4 / L",
          "products_image": "cressi-sub/cressi-fast-wetsuit-womens-7mm.jpg",
          "products_quantity": 2,
          "rrp": 469,
          "sell": 422.1,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 7480,
          "products_model": "PA101801",
          "products_name": "Cressi Fast Wetsuit - 7mm Ladies | 1 / XS",
          "products_image": "cressi-sub/cressi-fast-wetsuit-womens-7mm.jpg",
          "products_quantity": 1,
          "rrp": 469,
          "sell": 422.1,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 7481,
          "products_model": "PA101802",
          "products_name": "Cressi Fast Wetsuit - 7mm Ladies | 2 / S",
          "products_image": "cressi-sub/cressi-fast-wetsuit-womens-7mm.jpg",
          "products_quantity": 1,
          "rrp": 469,
          "sell": 422.1,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 7482,
          "products_model": "PA101805",
          "products_name": "Cressi Fast Wetsuit - 7mm Ladies | 5 / XL",
          "products_image": "cressi-sub/cressi-fast-wetsuit-womens-7mm.jpg",
          "products_quantity": 2,
          "rrp": 469,
          "sell": 422.1,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 7483,
          "products_model": "PA101806",
          "products_name": "Cressi Fast Wetsuit - 7mm Ladies | 6 / 2XL",
          "products_image": "cressi-sub/cressi-fast-wetsuit-womens-7mm.jpg",
          "products_quantity": 1,
          "rrp": 469,
          "sell": 422.1,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 7484,
          "products_model": "PA101803",
          "products_name": "Cressi Fast Wetsuit - 7mm Ladies | 3 / M",
          "products_image": "cressi-sub/cressi-fast-wetsuit-womens-7mm.jpg",
          "products_quantity": 1,
          "rrp": 469,
          "sell": 422.1,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        }
      ],
      "1336": [
        {
          "products_id": 1253,
          "products_model": "M40851",
          "products_name": "Gear Aid Antifog Sea Gold Mask Gel - Squeeze Pack (37ml)",
          "products_image": "gear-aid/gear-aid-sea-gold.jpg",
          "products_quantity": 1,
          "rrp": 19.95,
          "sell": 14.5,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 11778,
          "products_model": "M40852",
          "products_name": "SEA GOLD 37ml (1.25oz) LOOSE Submerged Nation SINGLE (FOR BOX QTY ORDER 25)",
          "products_image": "gear-aid/M40852.jpg",
          "products_quantity": -3,
          "rrp": 19.95,
          "sell": 19.5,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        }
      ],
      "1754": [
        {
          "products_id": 2076,
          "products_model": "MS-20-FP",
          "products_name": "Tusa Neoprene Mask Strap Cover/Tamer | Pink",
          "products_image": "tusa/tusa-mask-tamer-ms-20_06-pink.jpg",
          "products_quantity": 0,
          "rrp": 19.9,
          "sell": 17.91,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 7366,
          "products_model": "MS-20-CBL",
          "products_name": "Tusa Neoprene Mask Strap Cover/Tamer | Blue",
          "products_image": "tusa/tusa-mask-tamer-ms-20_02-blue.jpg",
          "products_quantity": 0,
          "rrp": 19.9,
          "sell": 17.91,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 7367,
          "products_model": "MS-20-BK",
          "products_name": "Tusa Neoprene Mask Strap Cover/Tamer | Black",
          "products_image": "tusa/tusa-mask-tamer-ms-20_10-black.jpg",
          "products_quantity": 1,
          "rrp": 19.9,
          "sell": 17.91,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        },
        {
          "products_id": 7368,
          "products_model": "MS-20-FY",
          "products_name": "Tusa Neoprene Mask Strap Cover/Tamer | Yellow",
          "products_image": "tusa/tusa-mask-tamer-ms-20_04-yellow.jpg",
          "products_quantity": 0,
          "rrp": 19.9,
          "sell": 17.91,
          "product_is_call": 0,
          "currentlyUnavailable": 0
        }
      ]
    },
    "filters": {
      "categories": [
        {
          "id": "",
          "text": "Select Category"
        },
        {
          "id": 404,
          "text": "Arms Trays and Mounts"
        },
        {
          "id": 65,
          "text": "Backplate Accessories"
        },
        {
          "id": 126,
          "text": "Mask/Snorkel Accessories"
        },
        {
          "id": 125,
          "text": "Scuba Diving Masks"
        },
        {
          "id": 475,
          "text": "Snorkelling Accessories"
        },
        {
          "id": 471,
          "text": "Snorkelling Fin Accessories"
        },
        {
          "id": 668,
          "text": "SSI - Courses Recreational"
        }
      ],
      "category_hierarchy": [
        {
          "id": 563,
          "text": "Photography and Lighting",
          "parent_id": 0,
          "children": [
            {
              "id": 398,
              "text": "Underwater Photo / Video",
              "parent_id": 563,
              "children": [
                {
                  "id": 404,
                  "text": "Arms Trays and Mounts",
                  "parent_id": 398,
                  "children": []
                }
              ]
            }
          ]
        },
        {
          "id": 562,
          "text": "Scuba and Watersports",
          "parent_id": 0,
          "children": [
            {
              "id": 424,
              "text": "Snorkelling",
              "parent_id": 562,
              "children": [
                {
                  "id": 475,
                  "text": "Snorkelling Accessories",
                  "parent_id": 424,
                  "children": []
                },
                {
                  "id": 428,
                  "text": "Snorkelling Fins",
                  "parent_id": 424,
                  "children": [
                    {
                      "id": 471,
                      "text": "Snorkelling Fin Accessories",
                      "parent_id": 428,
                      "children": []
                    }
                  ]
                }
              ]
            },
            {
              "id": 596,
              "text": "Scuba Diving Recreational",
              "parent_id": 562,
              "children": [
                {
                  "id": 69,
                  "text": "BCDs BCs",
                  "parent_id": 596,
                  "children": [
                    {
                      "id": 65,
                      "text": "Backplate Accessories",
                      "parent_id": 69,
                      "children": []
                    }
                  ]
                },
                {
                  "id": 153,
                  "text": "Masks Snorkels and Fins",
                  "parent_id": 596,
                  "children": [
                    {
                      "id": 126,
                      "text": "Mask/Snorkel Accessories",
                      "parent_id": 153,
                      "children": []
                    },
                    {
                      "id": 597,
                      "text": "Masks",
                      "parent_id": 153,
                      "children": [
                        {
                          "id": 125,
                          "text": "Scuba Diving Masks",
                          "parent_id": 597,
                          "children": []
                        }
                      ]
                    }
                  ]
                },
                {
                  "id": 606,
                  "text": "Exposure wear",
                  "parent_id": 596,
                  "children": [
                    {
                      "id": 79,
                      "text": "Wetsuits",
                      "parent_id": 606,
                      "children": []
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": 568,
          "text": "Training and Guided Diving",
          "parent_id": 0,
          "children": [
            {
              "id": 668,
              "text": "SSI - Courses Recreational",
              "parent_id": 568,
              "children": []
            }
          ]
        }
      ]
    }
  }
};

const byId = (products, id) => products.find((p) => p.id === `scubadoctor:${id}`);

test('scubadoctor: module shape', () => {
  assert.equal(retailer.key, 'scubadoctor');
  assert.equal(retailer.name, 'The Scuba Doctor');
  assert.equal(retailer.homepage, 'https://www.scubadoctor.com.au/diveshop/');
  assert.equal(typeof retailer.fetch, 'function');
});

test('scubadoctor: parseSearchPage extracts rows, families and the category tree', () => {
  const page = parseSearchPage(FIXTURE);
  assert.equal(page.rows.length, 9);
  assert.equal(page.hasMore, false);
  assert.deepEqual(Object.keys(page.families).sort(), ['1336', '1754', '268', '84']);
  assert.deepEqual(categoryPath(page.categories, '125'), ['Scuba and Watersports', 'Scuba Diving Recreational', 'Masks Snorkels and Fins', 'Masks', 'Scuba Diving Masks']);
  assert.deepEqual(categoryPath(page.categories, 668), ['Training and Guided Diving', 'SSI - Courses Recreational']);
  assert.deepEqual(categoryPath(page.categories, '378'), []); // not in the tree
  assert.throws(() => parseSearchPage({ success: false, error: 'No security token provided' }), /unexpected ajax_search response/);
  assert.throws(() => parseSearchPage(null), /unexpected/);
});

test('scubadoctor: url and image helpers', () => {
  assert.equal(productUrl(488), `${BASE}/index.php?main_page=product_info&products_id=488`);
  assert.equal(imageUrl('cressi-sub/cressi-lince-mask-black_black.jpg'), `${BASE}/images/cressi-sub/cressi-lince-mask-black_black.jpg`);
  assert.equal(imageUrl('/images/x.jpg'), `${BASE}/images/x.jpg`);
  assert.equal(imageUrl('https://cdn.example/x.jpg'), 'https://cdn.example/x.jpg');
  assert.equal(imageUrl(''), '');
  // ~700 site image paths contain spaces (and a few parentheses): percent-encode, never twice
  assert.equal(imageUrl('aup/ROB ALLEN/Reels/RAREV40ALW.jpg'), `${BASE}/images/aup/ROB%20ALLEN/Reels/RAREV40ALW.jpg`);
  assert.equal(imageUrl('cressi-sub/cressi-pluma-full-foot-fins_black (1).jpg'), `${BASE}/images/cressi-sub/cressi-pluma-full-foot-fins_black%20(1).jpg`);
  assert.equal(imageUrl('aup/ROB%20ALLEN/x.jpg'), `${BASE}/images/aup/ROB%20ALLEN/x.jpg`);
});

test('scubadoctor: commonTitle finds the family name at a word boundary', () => {
  assert.equal(commonTitle(['Cressi Fast Wetsuit - 7mm Ladies | 4 / L', 'Cressi Fast Wetsuit - 7mm Ladies | 5 / XL']), 'Cressi Fast Wetsuit - 7mm Ladies');
  assert.equal(commonTitle(['Cressi Pro Light Fins - Open Heel - Yellow - XS-S', 'Cressi Pro Light Fins - Open Heel - Black - M-L']), 'Cressi Pro Light Fins - Open Heel');
  assert.equal(commonTitle(['Cressi Rondine Palau Fins-XS/S 35-38 Yellow', 'Cressi Rondine Palau Fins-Mini 29/32 Blue']), 'Cressi Rondine Palau Fins');
  assert.equal(commonTitle(['Gear Aid Antifog Sea Gold Mask Gel - Squeeze Pack (37ml)', 'SEA GOLD 37ml LOOSE SINGLE']), '');
  assert.equal(commonTitle(['Only one name']), '');
  // a trailing qualifier word belongs to the variant, not the family title
  assert.equal(commonTitle(['Ocean Pro Boot | US Size 4', 'Ocean Pro Boot | US Size 5']), 'Ocean Pro Boot');
  assert.equal(commonTitle(['Waterproof D7X Cordura ISS Drysuit | Mens | Size S', 'Waterproof D7X Cordura ISS Drysuit | Mens | Size M']), 'Waterproof D7X Cordura ISS Drysuit | Mens');
  assert.equal(commonTitle(['Dolphin Tech Backplate Bookscrew Pack, Set of Eight', 'Dolphin Tech Backplate Bookscrew Pack, Set of Two']), 'Dolphin Tech Backplate Bookscrew Pack');
  assert.equal(commonTitle(['Backscatter Loc-Line Pliers for 1/2in and 3/4in Flex Arms', 'Backscatter Loc-Line Pliers for 3/4-inch Flex Arms']), 'Backscatter Loc-Line Pliers');
  assert.equal(commonTitle(['MODULAR TRIM POCKET 2 x 1.5kg MODLOCK', 'MODULAR TRIM POCKET 2 x 2.25kg MODLOCK']), 'MODULAR TRIM POCKET');
  // "One Size" is a phrase, "in" is inches and "62X" is a model suffix: none is a qualifier
  assert.equal(commonTitle(['Maui EBS Straps (Pair) - One Size - Blue', 'Maui EBS Straps (Pair) - One Size - Black']), 'Maui EBS Straps (Pair) - One Size');
  assert.equal(commonTitle(['Genuine Cressi LP Hose Safeflex 150cm/59 in - Black', 'Genuine Cressi LP Hose Safeflex 150cm/59 in - Yellow']), 'Genuine Cressi LP Hose Safeflex 150cm/59 in');
  assert.equal(commonTitle(['Twin Balanced Piston Dry Kit 62X - Left', 'Twin Balanced Piston Dry Kit 62X - Right']), 'Twin Balanced Piston Dry Kit 62X');
  // too short once stripped -> '' (the caller falls back to the site's display_name, stripped the same way)
  assert.equal(commonTitle(['Fins NATEEVA - Size L/XL Blue', 'Fins NATEEVA - Size M/L Blue']), '');
  const fam = [{ products_id: 1, products_name: 'Fins NATEEVA - Size L/XL Blue', sell: 99, rrp: 120, products_quantity: 1 }, { products_id: 2, products_name: 'Fins NATEEVA - Size M/L Blue', sell: 99, rrp: 120, products_quantity: 0 }];
  const row = { id: '1', name: 'Fins NATEEVA - Size L/XL Blue', family_id: 9, family_url: 'index.php?main_page=product_info&products_id=1', display_name: 'Fins NATEEVA Size', category_id: '1', manufacturer: 'Seac' };
  const p = rowToProduct(row, { 9: fam }, new Map());
  assert.equal(p.title, 'Fins NATEEVA');
  assert.deepEqual(p.variants.map((v) => v.title), ['Fins NATEEVA - Size L/XL Blue', 'Fins NATEEVA - Size M/L Blue']);
  // a family whose members share only the brand is named by its category, not "Cressi" alone
  const rubbers = [{ products_id: 1, products_name: 'Cressi Bulk Gun Rubber 14mm - Optiband Black - Per Metre', sell: 34.16, products_quantity: 1 }, { products_id: 2, products_name: 'Cressi Blue Water Extreme Bulk Gun Rubber - 16mm - Per Metre', sell: 34.2, products_quantity: 1 }];
  const cats = new Map([['7', { name: 'Spearfishing Rubber', parentId: null }]]);
  const brandRow = { id: '1', name: 'Cressi Bulk Gun Rubber 14mm - Optiband Black - Per Metre', family_id: 8, family_url: 'index.php?main_page=product_info&products_id=1', display_name: 'Cressi', category_id: '7', manufacturer: 'Cressi' };
  assert.equal(rowToProduct(brandRow, { 8: rubbers }, cats).title, 'Cressi Spearfishing Rubber');
  assert.equal(rowToProduct({ id: '2', name: 'MARES', category_id: '7', manufacturer: 'Mares', sell: 10, quantity: 1 }, {}, cats).title, 'MARES Spearfishing Rubber');
});

test('scubadoctor: productsFromPages maps families to variants and drops training rows', () => {
  const page = parseSearchPage(FIXTURE);
  const logs = [];
  const products = productsFromPages([page], { log: (m) => logs.push(m) });
  assert.equal(products.length, 8, 'SSI course row is excluded');
  assert.equal(byId(products, '17394'), undefined);
  assert.ok(products.every((p) => /^scubadoctor:\d+$/.test(p.id)));
  assert.ok(products.every((p) => p.retailer === 'scubadoctor' && p.url.startsWith(`${BASE}/index.php?main_page=product_info&products_id=`)));
  assert.ok(logs.at(-1).includes('8 products from 9 rows'));

  // family: canonical id + common-prefix title + one variant per member (no availability_id in this
  // fixture, so the row flag is the fallback for every member; see the mixed-availability test)
  const tusa = byId(products, '7367');
  assert.equal(tusa.title, 'Tusa Neoprene Mask Strap Cover/Tamer');
  assert.equal(tusa.brand, 'Tusa');
  assert.equal(tusa.category, 'Snorkelling Accessories');
  assert.deepEqual(tusa.variants.map((v) => v.title), ['Pink', 'Blue', 'Black', 'Yellow']);
  assert.deepEqual(tusa.variants.map((v) => v.sku), ['MS-20-FP', 'MS-20-CBL', 'MS-20-BK', 'MS-20-FY']);
  assert.equal(tusa.price, 17.91);
  assert.equal(tusa.compareAtPrice, 19.9);
  assert.equal(tusa.inStock, true);
  assert.equal(tusa.variants[2].available, true); // qty 1
  assert.equal(tusa.variants[0].available, true); // qty 0 but orderable (pre-order), no blocking flag
  assert.equal(tusa.image, `${BASE}/images/tusa/tusa-mask-tamer-ms-20_10-black.jpg`);
  assert.equal(tusa.sku, '');
  assert.deepEqual(tusa.tags, []);

  // family whose family_url points at another member -> that member's id is the product id
  const cap = byId(products, '5549');
  assert.ok(cap, 'row 5550 belongs to family 268 whose canonical product is 5549');
  assert.equal(byId(products, '5550'), undefined);
  assert.equal(cap.title, 'Scuba Ninja Cap');
  assert.equal(cap.category, ''); // category 378 is not in the tree
  assert.equal(cap.variants.length, 6);
  assert.ok(cap.variants.some((v) => v.title === 'Cray King' && v.price === 10 && v.compareAtPrice === 15 && v.available));
  assert.ok(cap.variants.some((v) => v.title === 'Port Phillip Diver - White' && v.available === false), 'Superseded + qty 0 is not orderable');
  assert.equal(cap.price, 10); // cheapest available member
  assert.equal(cap.compareAtPrice, 15);
  assert.equal(cap.inStock, true);
  assert.deepEqual(cap.tags, ['Superseded']);

  // family with no meaningful common prefix -> site display_name, full member names as variants
  const gel = byId(products, '1253');
  assert.equal(gel.title, 'Gear Aid Antifog Sea Gold Mask Gel Squeeze Pack 37ml');
  assert.equal(gel.variants.length, 2);
  assert.equal(gel.variants[0].title, 'Gear Aid Antifog Sea Gold Mask Gel - Squeeze Pack (37ml)');
  assert.equal(gel.price, 14.5);
  assert.equal(gel.compareAtPrice, 19.95);

  const wetsuit = byId(products, '5111');
  assert.equal(wetsuit.title, 'Cressi Fast Wetsuit - 7mm Ladies');
  assert.equal(wetsuit.category, 'Wetsuits');
  assert.deepEqual(wetsuit.variants.map((v) => v.title).sort(), ['1 / XS', '2 / S', '3 / M', '4 / L', '5 / XL', '6 / 2XL']);
  assert.equal(wetsuit.price, 422.1);
  assert.equal(wetsuit.compareAtPrice, 469);

  // standalone rows
  const strap = byId(products, '3016');
  assert.equal(strap.title, 'Cressi Fin Strap (Single)');
  assert.equal(strap.variants.length, 0);
  assert.equal(strap.price, 22.45);
  assert.equal(strap.compareAtPrice, 24.95);
  assert.equal(strap.inStock, true);
  assert.equal(strap.sku, 'BZ170002');
  assert.equal(strap.category, 'Snorkelling Fin Accessories');
  assert.equal(strap.description, '');

  const preorder = byId(products, '4972');
  assert.equal(preorder.price, 38);
  assert.equal(preorder.compareAtPrice, 46);
  assert.equal(preorder.inStock, true, 'qty 0 with an ETA and no blocking flag is orderable');
  assert.deepEqual(preorder.tags, ['Pre-order']);

  // price edge cases: sell 0 and "call for price" -> null, never 0
  assert.equal(byId(products, '3937').price, null);
  assert.equal(byId(products, '3937').compareAtPrice, null);
  const call = byId(products, '4753');
  assert.equal(call.price, null);
  assert.equal(call.compareAtPrice, null);
  assert.equal(call.inStock, false);

  // the same page twice must not duplicate products
  assert.equal(productsFromPages([page, page]).length, 8);
});

test('scubadoctor: a broken row is skipped, not fatal', () => {
  const page = parseSearchPage(FIXTURE);
  const bad = { ...page, rows: [{ id: '1', name: '', category_id: '125' }, ...page.rows] };
  const logs = [];
  const products = productsFromPages([bad], { log: (m) => logs.push(m) });
  assert.equal(products.length, 8);
  assert.ok(logs.some((m) => /skipped row 1/.test(m)));
  assert.throws(() => rowToProduct({ id: '1', name: '' }, {}, new Map()), /title required/);
});

// Real rows (Sep 2026, trimmed) whose family members carry a different availability_id from the
// listing row: 375 "250ml" is Unavailable (id 3, qty 0) beside the stocked 5 litre row 1943, and
// row 4280 is Discontinued (id 1) while its 200 m roll member 5715 has id 0 (orderable). Plus a few
// rows in the "Books Gifts and Certificates" branch for the source-side exclusion.
const MIXED = {
  success: true,
  data: {
    products: [
      { id: '1943', name: 'Adrenalin Wetsuit and Gear Wash Concentrate - 5 litre', model: '68006CP', image: 'adrenalin/adrenalin-wetsuit-and-gear-wash-5-litre.jpg', manufacturer: 'Adrenalin', category_id: '97', quantity: '2', availability_id: 0, has_attributes: false, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 79.95, sell: 65.99, family_id: 1200, family_url: 'index.php?main_page=product_info&products_id=375', family_name: 'Adrenalin Wetsuit and Gear Wash Concentrate', display_name: 'Adrenalin Wetsuit and Gear Wash Concentrate', availability_flag: '' },
      { id: '4280', name: 'Cressi Braided Nylon Line - 2mm (per Metre)', model: 'IT-FA353035', image: 'cressi-sub/cressi-braided-nyline-line-2mm.jpg', manufacturer: 'Cressi', category_id: '326', quantity: '0', availability_id: 1, has_attributes: false, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 2, sell: 1.8, family_id: 1570, family_url: 'index.php?main_page=product_info&products_id=4280', family_name: 'Cressi Braided Nylon Line 2mm - per 1m or 200m', display_name: 'Cressi Braided Nylon Line 2mm - per 1m or 200m', availability_flag: 'Discontinued' },
      { id: '3537', name: 'Dolphin Tech BCD Trim Weight Pocket - 2kg', model: 'IST-WP2', image: 'dolphin_tech/x.jpg', manufacturer: 'Dolphin Tech', category_id: '97', quantity: '23', availability_id: 3, has_attributes: false, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 40, sell: 36, family_id: null, family_url: '', family_name: '', display_name: 'Dolphin Tech BCD Trim Weight Pocket - 2kg', availability_flag: 'Unavailable' },
      { id: '5887', name: 'Cressi 360&deg; Regulator Bag', model: 'UB1', image: 'cressi-sub/360 reg bag (1).jpg', manufacturer: 'Cressi', category_id: '97', quantity: '0', availability_id: 2, has_attributes: false, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 50, sell: 45, family_id: null, family_url: '', family_name: '', display_name: 'Cressi 360&deg; Regulator Bag', availability_flag: 'Superseded' },
      { id: '5477', name: 'Southern Skies: Split Shot Blue Ringed Octopus at Sunset', model: 'PRINT1', image: 'prints/1.jpg', manufacturer: 'Scuba Doctor', category_id: '528', quantity: '5', availability_id: 0, has_attributes: false, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 120, sell: 120, family_id: null, family_url: '', family_name: '', display_name: 'Southern Skies', availability_flag: '' },
      { id: '1623', name: 'The Scuba Doctor Gift Certificate', model: 'GIFT', image: 'gift.jpg', manufacturer: 'Scuba Doctor', category_id: '21', quantity: '9999', availability_id: 0, has_attributes: true, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 50, sell: 50, family_id: null, family_url: '', family_name: '', display_name: 'Gift Certificate', availability_flag: '' },
      { id: '5546', name: 'Scuba Ninja Stubby Holder - HMAS Canberra', model: 'SN-SH', image: 'sn.jpg', manufacturer: 'Scuba Ninja', category_id: '529', quantity: '3', availability_id: 0, has_attributes: false, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 10, sell: 10, family_id: null, family_url: '', family_name: '', display_name: 'Scuba Ninja Stubby Holder', availability_flag: '' },
      { id: '5214', name: 'Mares EOS 10RW Video Set', model: 'MA-EOS10RW', image: 'mares/eos.jpg', manufacturer: 'Mares', category_id: '529', quantity: '1', availability_id: 0, has_attributes: false, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 399, sell: 359, family_id: null, family_url: '', family_name: '', display_name: 'Mares EOS 10RW Video Set', availability_flag: '' },
      { id: '9001', name: 'Muck Diving', model: 'BOOK1', image: 'books/muck.jpg', manufacturer: 'Various', category_id: '172', quantity: '2', availability_id: 0, has_attributes: false, product_is_call: 0, currentlyUnavailable: 0, products_clearance: 0, rrp: 35, sell: 17.5, family_id: null, family_url: '', family_name: '', display_name: 'Muck Diving', availability_flag: '' },
    ],
    has_more: false,
    family_members: {
      1200: [
        { products_id: 375, products_model: '68005', products_name: 'Adrenalin Wetsuit and Gear Wash Concentrate - 250ml', products_image: 'adrenalin/adrenalin-wetsuit-wash.jpg', products_quantity: 0, rrp: 9.95, sell: 8.96, product_is_call: 0, availability_id: 3, currentlyUnavailable: 0 },
        { products_id: 1943, products_model: '68006CP', products_name: 'Adrenalin Wetsuit and Gear Wash Concentrate - 5 litre', products_image: 'adrenalin/adrenalin-wetsuit-and-gear-wash-5-litre.jpg', products_quantity: 2, rrp: 79.95, sell: 65.99, product_is_call: 0, availability_id: 0, currentlyUnavailable: 0 },
      ],
      1570: [
        { products_id: 4280, products_model: 'IT-FA353035', products_name: 'Cressi Braided Nylon Line - 2mm (per Metre)', products_image: 'cressi-sub/cressi-braided-nyline-line-2mm.jpg', products_quantity: 0, rrp: 2, sell: 1.8, product_is_call: 0, availability_id: 1, currentlyUnavailable: 0 },
        { products_id: 5715, products_model: 'FA353035', products_name: 'Cressi Braided Nylon Line - 2mm 200 Metre Roll', products_image: 'cressi-sub/cressi-braided-nyline-line-2mm.jpg', products_quantity: 0, rrp: 99.95, sell: 89.95, product_is_call: 0, availability_id: 0, currentlyUnavailable: 0 },
      ],
    },
    filters: {
      categories: [],
      category_hierarchy: [
        { id: 565, text: 'Hoses Hardware and Care', parent_id: 0, children: [{ id: 97, text: 'Cleaning / Care', parent_id: 565, children: [] }] },
        { id: 764, text: 'Spearfishing and Hunting', parent_id: 0, children: [{ id: 326, text: 'Speargun Line', parent_id: 764, children: [] }] },
        { id: 570, text: 'Books Gifts and Certificates', parent_id: 0, children: [
          { id: 172, text: 'Books', parent_id: 570, children: [] },
          { id: 21, text: 'Gift Certificates', parent_id: 570, children: [] },
          { id: 529, text: 'Gift Ideas / Novelties', parent_id: 570, children: [] },
          { id: 528, text: 'Photographic Prints', parent_id: 570, children: [] },
        ] },
      ],
    },
  },
};

test('scubadoctor: family members use their own availability_id, the row flag is only a fallback', () => {
  const products = productsFromPages([parseSearchPage(MIXED)]);
  const wash = byId(products, '375');
  assert.deepEqual(wash.variants.map((v) => [v.title, v.price, v.available]), [['250ml', 8.96, false], ['5 litre', 65.99, true]]);
  assert.equal(wash.price, 65.99, 'the only member the site sells sets the price, not the cheaper Unavailable one');
  assert.equal(wash.compareAtPrice, 79.95);
  assert.equal(wash.inStock, true);
  assert.deepEqual(wash.tags, []);

  const line = byId(products, '4280');
  assert.equal(line.title, 'Cressi Braided Nylon Line - 2mm');
  assert.deepEqual(line.variants.map((v) => [v.title, v.price, v.available]), [['(per Metre)', 1.8, false], ['200 Metre Roll', 89.95, true]]);
  assert.equal(line.inStock, true, 'row flag Discontinued, but the roll member carries availability_id 0 and an ETA');
  assert.equal(line.price, 89.95);
  assert.deepEqual(line.tags, ['Discontinued', 'Pre-order']);

  // standalone rows: own availability_id (matches the flag text); stock on hand beats a blocking flag
  assert.equal(byId(products, '3537').inStock, true);
  assert.equal(byId(products, '5887').inStock, false, 'Superseded + qty 0');
  // a member without availability_id falls back to the row flag
  const noId = { ...MIXED.data.products[1] };
  const fam = { 1570: MIXED.data.family_members[1570].map(({ availability_id, ...m }) => m) };
  const p = rowToProduct(noId, fam, parseSearchPage(MIXED).categories);
  assert.deepEqual(p.variants.map((v) => v.available), [false, false]);
  assert.equal(p.inStock, false);
});

test('scubadoctor: prints, gift certificates and novelties are dropped at source; gear in the gift leaf and books stay', () => {
  const logs = [];
  const products = productsFromPages([parseSearchPage(MIXED)], { log: (m) => logs.push(m) });
  assert.deepEqual(products.map((p) => p.id).sort(), ['scubadoctor:3537', 'scubadoctor:375', 'scubadoctor:4280', 'scubadoctor:5214', 'scubadoctor:5887', 'scubadoctor:9001']);
  assert.ok(logs.at(-1).includes('6 products from 9 rows (3 training/gifts/novelties excluded'), logs.at(-1));
});

test('scubadoctor: named entities in names are decoded and image paths with spaces are encoded', () => {
  const bag = byId(productsFromPages([parseSearchPage(MIXED)]), '5887');
  assert.equal(bag.title, 'Cressi 360° Regulator Bag');
  assert.equal(bag.image, `${BASE}/images/cressi-sub/360%20reg%20bag%20(1).jpg`);
});

test('scubadoctor: walkPages stops the other worker once one page fails', async () => {
  const LAST = 3;
  const fakePage = (n) => ({ success: true, data: { products: n > LAST ? [] : [{ id: String(n) }], has_more: n < LAST, family_members: {}, filters: {} } });
  const walked = await walkPages(async ({ page }) => fakePage(Number(page)));
  assert.deepEqual(walked.flatMap((p) => p.rows.map((r) => r.id)), ['1', '2', '3'], 'pages come back in order and stop at has_more=false');

  const requested = [];
  const failing = async ({ page }) => {
    const n = Number(page);
    requested.push(n);
    await new Promise((r) => setTimeout(r, n === 5 ? 5 : 30));
    if (n === 5) throw new Error('HTTP 404 for page 5');
    return { success: true, data: { products: [{ id: String(n) }], has_more: n < 40, family_members: {}, filters: {} } };
  };
  await assert.rejects(walkPages(failing), /HTTP 404 for page 5/);
  const atRejection = requested.length;
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(requested.length, atRejection, 'no page is requested after the rejection');
  assert.ok(Math.max(...requested) <= 6, `only the page already in flight may follow the failure (requested ${requested})`);
});
