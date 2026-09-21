// Normalisation used at build time: canonical brand names, a coarse gear category,
// and title tokens for matching the same product across retailers.

const BRAND_ALIASES = [
  ['aqualung', ['aqua lung', 'aqua-lung', 'aqualung', 'aqua lung australia']],
  ['scubapro', ['scuba pro', 'scubapro', 'scuba-pro', 'uwatec', 'scubapro uwatec australia pty ltd', 'scubapro uwatec', 'scubapro australia']],
  ['atomic aquatics', ['atomic', 'atomic aquatics']],
  ['fourth element', ['4th element', 'fourth element', 'fourthelement']],
  ['ocean reef', ['oceanreef', 'ocean reef']],
  ['dive rite', ['diverite', 'dive rite']],
  ['light & motion', ['light and motion', 'light & motion', 'light&motion']],
  ['xdeep', ['x-deep', 'xdeep', 'x deep']],
  ['underwater kinetics', ['uk', 'underwater kinetics', 'u.k.']],
  ['big blue', ['bigblue', 'big blue', 'bigblue dive lights']],
  ['shearwater', ['shearwater', 'shearwater research']],
  ['sea & sea', ['sea and sea', 'sea & sea', 'sea&sea']],
  ['rob allen', ['rob allen', 'roballen']],
  ['ocean hunter', ['ocean hunter', 'oceanhunter']],
  ['ocean pro', ['ocean pro', 'oceanpro']],
  ['apollo', ['apollo', 'apollo australia', 'apollo sports']],
  ['nauticam', ['nauticam']],
  ['ocean design', ['ocean design', 'oceandesign']],
  ['mako', ['mako', 'mako spearguns']],
  ['adreno', ['adreno']],
  ['seac', ['seac', 'seac sub', 'seacsub']],
  ['mares', ['mares', 'mares xr', 'mares pure passion']],
  ['cressi', ['cressi', 'cressi sub', 'cressi-sub']],
  ['apeks', ['apeks']],
  ['oceanic', ['oceanic']],
  ['hollis', ['hollis']],
  ['suunto', ['suunto']],
  ['garmin', ['garmin']],
  ['tusa', ['tusa']],
  ['halcyon', ['halcyon']],
  ['oms', ['oms', 'ocean management systems']],
  ['waterproof', ['waterproof']],
  ['bare', ['bare']],
  ['sharkskin', ['sharkskin']],
  ['salvimar', ['salvimar']],
  ['beuchat', ['beuchat']],
  ['riffe', ['riffe']],
  ['problue', ['problue', 'pro blue']],
  ['zeagle', ['zeagle']],
  ['sherwood', ['sherwood', 'sherwood scuba']],
  ['poseidon', ['poseidon']],
  ['divesoft', ['divesoft']],
  ['ikelite', ['ikelite']],
  ['sealife', ['sealife', 'sea life']],
  ['paralenz', ['paralenz']],
  ['insta360', ['insta360', 'insta 360']],
  ['gopro', ['gopro', 'go pro']],
  ['kraken', ['kraken', 'kraken sports']],
  ['tecline', ['tecline']],
  ['ratio', ['ratio', 'ratio computers']],
  ['dui', ['dui', 'diving unlimited international']],
  ['santi', ['santi', 'santi diving', 'santi diving australia']],
  ['otter', ['otter', 'otter drysuits']],
  ['princeton tec', ['princeton tec', 'princetontec']],
  ['stahlsac', ['stahlsac']],
  ['orca', ['orca', 'orca torch', 'orcatorch']],
  ['omer', ['omer', 'omersub']],
  ['sporasub', ['sporasub']],
  ['pathos', ['pathos']],
  ['picasso', ['picasso']],
  ['cetma', ['cetma', 'cetma composites']],
  ['leaderfins', ['leaderfins', 'leader fins']],
  ['dive alert', ['dive alert', 'divealert']],
  ['nautilus', ['nautilus', 'nautilus lifeline']],
  ['catalina', ['catalina', 'catalina cylinders']],
  ['faber', ['faber']],
  ['luxfer', ['luxfer']],
  ['metalsub', ['metalsub']],
  ['dirzone', ['dirzone', 'dir zone']],
  ['agir', ['agir', 'agir brokk']],
  ['scubalab', ['scubalab']],
  ['best divers', ['best divers', 'bestdivers']],
  ['ist', ['ist', 'ist sports', 'ist proline']],
  ['gull', ['gull']],
  ['deep blue', ['deep blue', 'deepblue']],
  ['hyperion', ['hyperion']],
  ['ammonite', ['ammonite', 'ammonite system']],
  ['fenix', ['fenix']],
  ['seaskin', ['seaskin']],
  ['probe', ['probe', 'probe wetsuits']],
  ['spetton', ['spetton']],
  ['dive smart', ['dive smart', 'divesmart']],
];

const BRAND_MAP = new Map();
for (const [canon, aliases] of BRAND_ALIASES) for (const a of aliases) BRAND_MAP.set(a, canon);
const BRAND_NAMES = [...new Set(BRAND_ALIASES.map(([c]) => c))].sort((a, b) => b.length - a.length);
const BRAND_ALIAS_LIST = [...BRAND_MAP.keys()].sort((a, b) => b.length - a.length);

// Vendors that are the store itself or a multi-brand distributor: not a consumer brand.
const NOT_A_BRAND = new Set(['odg', 'onlinedivegear com au', 'onlinedivegear', 'online dive gear', 'dive swansea', 'diveswansea', 'adventure underwater products',
  'aup', 'perth scuba', 'perthscuba', 'dive bondi', 'divebondi', 'frog dive', 'frogdive', 'scuba doctor', 'the scuba doctor', 'tec dive gear', 'tecdivegear',
  'scuba dive shop', 'scubadiveshop', 'scubadiveshop com au', 'scuba culture', 'dive centre bondi', 'dive center bondi', 'dive gear australia', 'divegearaustralia', 'o', 'pro', 'zd', 'ssi', 'padi', 'unknown', 'n a', 'na', 'none', 'generic', 'various']);

export function normalizeBrand(raw) {
  const s = String(raw || '').toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || NOT_A_BRAND.has(s)) return '';
  if (BRAND_MAP.has(s)) return BRAND_MAP.get(s);
  // "Mares Australia", "Scubapro Sea" etc.
  for (const alias of BRAND_ALIAS_LIST) {
    if (alias.length >= 3 && (s === alias || s.startsWith(alias + ' '))) return BRAND_MAP.get(alias);
  }
  return s;
}

/** Guess brand from the start of the title when the retailer didn't provide one. */
export function brandFromTitle(title) {
  const t = String(title || '').toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const alias of BRAND_ALIAS_LIST) {
    if (alias.length >= 3 && (t === alias || t.startsWith(alias + ' '))) return BRAND_MAP.get(alias);
  }
  return '';
}

/** Display-cased brand label, e.g. 'fourth element' -> 'Fourth Element', 'oms' -> 'OMS'.
 *  For brands the alias table doesn't know, the retailer's own spelling is kept when it looks
 *  deliberate ('McNett / Gear Aid', 'WMD', 'JJ-CCR'); all-lowercase or long all-caps strings are title-cased. */
const UPPER_BRANDS = new Set(['oms', 'dui', 'ist', 'tusa', 'seac', 'xdeep', 'bare', 'omer', 'agir']);
const KNOWN_BRANDS = new Set(BRAND_NAMES);
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
export function displayBrand(canon, raw = '') {
  if (!canon) return '';
  if (KNOWN_BRANDS.has(canon)) {
    if (UPPER_BRANDS.has(canon)) return canon.toUpperCase();
    return titleCase(canon).replace(/\bXdeep\b/, 'XDEEP').replace(/\bGopro\b/, 'GoPro').replace(/\bSealife\b/, 'SeaLife').replace(/\bMcnett\b/, 'McNett');
  }
  const r = String(raw || '').replace(/\s+/g, ' ').trim();
  if (r && normalizeBrand(r) === canon) {
    if (r === r.toLowerCase()) return titleCase(r);
    if (r === r.toUpperCase() && r.length > 5 && !/[-\d]/.test(r)) return titleCase(r.toLowerCase());
    return r;
  }
  return titleCase(canon);
}

// Exclusions: things that are not gear you can price-compare. Category and title are tested
// separately because words like "travel" or "trip" are fine in a product title ("travel BCD")
// but decisive as a retailer category. "Travel" / "Bags & Travel" collections are luggage and
// travel BCDs, and "Repairs" holds adhesives, so neither excludes on its own.
const CATEGORY_EXCLUDE = /\b(courses?|training|trips?|tours?|holidays?|liveaboards?|certified dives?|memberships?|gift ?cards?|gift vouchers?|vouchers?|events?|experiences?|hire|rentals?|charters?|e-?learning|labou?r|shipping|freight|insurance|bookings?|deposits?)\b/;
// A "Servicing" / "Service Parts" collection holds diaphragms, covers and valves, so a service
// category is not excluded on its own: the title decides ("Regulator Service", "Battery Change").
// Words like "nitrox", "training", "repair" and "divemaster" name products too (a Nitrox regulator, a
// training buoy, repair adhesive, the Divemaster drysuit): the look-aheads keep those.
const TITLE_EXCLUDE = /\b(courses?|certification|padi|ssi|tdi|gue(?! (gas|mod|decal|tape))|raid|naui|training(?! (buoy|board|snorkel|delayed|plate|log|fins?|paddle))|lessons?|e-?learning|theory session|refresher|skills update|charter|liveaboard|vouchers?|gift ?cards?|gift certificate|membership|servicing|service(?! (kit|tool|box|parts?))|labou?r|battery changes?|repair(?! (kit|adhesive|tape|strip|patch|glue|cement|sealant))|hire|rental|deposit|(dive|day|boat|snorkel(ling)?) (trips?|tours?|holidays?)|(boat|shore|shark|fun|guided|night|double|certified|private|weekend|reef|wreck|drift|discovery|intro|try) dives?(?! black)|shipping|postage|insurance|freight|booking|donation|raffle|tickets?|first aid(?! kit)|hltaid\d*|oxygen provider|instructor(?! choice)|divemaster(?! (evolution|filter))|dive master|open water (course|diver|referral|cert)|advanced adventurer|rescue diver|learn to dive|used|second ?hand|pre-?owned|ex[- ]?demo|refurbished|test product|#test|clearance products|getaways?|pressure check|cylinder test(ing)?|hydro(static)? test|visual inspection|air fills?|nitrox fills?|earrings?|tumblers?|fridge magnets?|badges?|bodyboards?|sup board|jet ski|hand paddle|pull board|thongs?)\b/;

// Category rules: first match wins, so accessory-ish patterns go before the main gear nouns, and the
// sport words of 'spearfishing' come last so a freediving mask or wetsuit lands with the other masks
// and wetsuits. Each entry: [category, regex tested against the lowercased title, then against
// `${category} | ${tags}` when the title matched nothing (see classifyCategory)].
const CATEGORY_RULES = [
  ['package', /\b(packages?|bundles?|combos?|(scuba|dive|gear|snorkel(l)?ing|spearfishing|freediving) (sets?|packs?|kits?)|snorkel sets?|starter (sets?|kits?|packs?)|ms sets?|msf sets?|(masks?|snorkels?|fins?)\s*(?:,|&|\+|and|\/)\s*(masks?|snorkels?|fins?)\b(?![^|]*\b(bags?|pouch(es)?|cases?|box(es)?|straps?|buckles?|keepers?|clips?|mouthpieces?|holders?|hangers?|sets? of)\b)|(masks?|snorkels?|fins?) (masks?|snorkels?|fins?)\b(?=[^|]*\b(sets?|packs?|packages?|kits?|combos?)\b)(?![^|]*\b(bags?|pouch(es)?|cases?|box(es)?|straps?|buckles?|keepers?|clips?|mouthpieces?|holders?|hangers?)\b))\b/],
  ['spare part', /\b(o-?rings?|orings?|spares?|spare parts?|replacement|repair kit|service kit|filters?|mouthpiece|hose protector|dust cap|clips?|lanyards?|bolt snaps?|d-?rings?|zip ?ties?|screws?|buckles?|strap only|mask strap|fin straps?|spring straps?|bungee|retractor|swivel|adapt[eo]rs?|converters?|covers?|plugs?|valves?|handwheel|burst disc|weight pockets?|pockets?|tank bands?|cam bands?|hoses?|lp hose|hp hose|inflator|batter(y|ies)|charger|lens caps?|carabiners?|shock lines?|prescription lens|diaphragms?|quick links?|shackles?|retainers?|purge (covers?|valves?)|line arrows?|cookies|scratch guards?|screen protectors?|colou?r kits?|fixing kits?|bolt kits?|upgrade kits?|assembly kits?|colou?r sets?|(replacement|spare|textile|silicone|elastic|zulu|nylon|rubber|wrist|watch|fin|mask|velcro|bungee|spring) straps?|straps? (kit|only|pair|set)s?|straps? (for|\(pair)|wrist ?bands?|watch bands?|(corrective|optical|prescription|bifocal|reading|rx|positive|negative) lens(es)?|lens(es)? (left|right))\b/],
  ['accessories', /\b((?<!spearfishing |speargun |freediving )accessor(y|ies)|headbands?|tank bangers?|tank rattles?|noise ?makers?|shakers?|hangers?|changing mats?|change mats?|tools?|pliers?|spanners?|wrench(es)?|grease|lubricants?|silicone spray|cement|aquaseal|uv tech|sealant|zipper (stick|wax|lube)|dive flags?|flag ?poles?|flags? (and|&) poles?|cray loops?|prawn nets?|viewing buckets?|slates?|wetnotes|wet notes|notebooks?|analy[sz]ers?|reef (pointers?|hooks?)|abalone (irons?|tools?)|gear tags?|stickers?|decals?|magnets?|defog(ger)?s?|anti-?fog (spray|gel|liquid|solution|drops?|wipes?|treatment|cloth|film|foam)|sunscreen|save-?a-?dive|tool kit)\b/],
  ['clothing', /\b(t-?shirts?|tees?(?! complete)|hoodies|hoody|polos?|ponchos?|towels?|changing robes?|dry robes?|thongs?|sandals|sunglasses|merch(andise)?|apparel|board ?shorts|paddling|(?<!dust |valve |trigger |lens |end |purge |port |protective |tank valve )caps?|hats?(?! strap))\b/],
  ['book & media', /\b(books?(?! screws?)|dvds?|blu-?rays?|manuals?|logbooks?|log books?|guides?(?! (line|rope))|charts?|maps?)\b/],
  ['bag', /\b(bags?|backpacks?|duffels?|duffles?|roller (bags?|duffels?)|trolleys?|luggage|cases?|boxes|pouch(es)?|holdalls?|crates?|reg bag|mesh bag|dry ?bag|catch bag|dry ?tubes?|sacks?)\b/],
  ['dive computer', /\b(computers?|shearwater|perdix|petrel|teric|peregrine|tern|suunto d\d|d5\b|d4i|d4f|zoop|vyper|eon core|eon steel|descent mk|garmin|cosmiq|geo 4|veo|i100|i200|i300|i330|i470|i550|i770|puck|quad|genius|dive ?watch|transmitter|tank pod|wrist unit)\b/],
  ['regulator', /\b(regulators?|reg sets?|regs?\b|first stages?|1st stages?|second stages?|2nd stages?|octopus|octo\b|occy|occies|safe second|alternate air|mk\d+|atomic [bmtz]\d|xtx\d*|mtx-?r?c?|ds4|dual adj|balanced adj|deep6 signature|air ?source|stage sets?)\b/],
  // a "jacket" described with wetsuit words (thickness, neoprene, open cell) is a wetsuit top, not a jacket-style BCD
  ['wetsuit', /^(?=.*\bjackets?\b)(?=.*\b(wetsuits?|wet suits?|neoprene|open cell|steamers?|two piece|2 piece|\d+(\.\d+)?(\/\d+(\.\d+)?)?\s*mm)\b)/],
  ['bcd', /\b(bcds?|b\.c\.d|buoyancy|wings?|backplates?|back plates?|harness(es)?|sidemount|\bsms\b|katana|jacket style|bladder|tank systems?|bc systems?|wing systems?|(single|twin|double) tank (systems?|wings?))\b/],
  ['undergarment', /\b(undergarments?|under ?suits?|undersuits?|under ?vests?|base ?layers?|leggings|long sleeve|short sleeve|sleeveless|fleece|sweaters?|performance wear|compression wear|thermal (tops?|pants|long|short|leggings?|layers?|wear)|thermals|jackets?|shorts|shortpants|pants)\b/],
  ['boots', /\b((?<!no |without |w\/o |tank |cylinder )boots?|booties|bootee|dive shoes?|rock boots?|(?<!no |without )socks?|fin socks?|aqua shoes?|reef walkers?)\b/],
  ['drysuit', /\b(drysuits?|dry suits?|dry gloves?|latex seals?|neck seals?|wrist seals?|inflator valve|dump valve|p-?valve|dry ?zip)\b/],
  ['wetsuit', /\b(wetsuits?|wet suits?|steamers?|shorty|shorties|springsuits?|spring suits?|rash ?guards?|rashies?|rash vests?|lycra|skin suits?|dive skins?|hooded vests?|vests?|farmer johns?|long johns?|semi-?dry|core warmers?|chillproof|two piece|2 piece|one piece|open cell|hot ?tops?|swimsuits?)\b/],
  ['fins', /\b(fins?|jet fins?|jetfins?|flippers?|foot pockets?|monofins?)\b/],
  ['mask', /\b(masks?|goggles?|full face)\b/],
  ['snorkel', /\b(snorkels?)\b/],
  ['gloves', /\b(gloves?|mitts?|pogies)\b/],
  ['hood', /\b(hoods?|beanies?|hooded|headwear)\b/],
  ['torch', /\b(torch(es)?|lights?|lamps?|beacons?|flashlights?|dive lites?|goodman|canisters?|lighting|lumens?)\b/],
  ['knife', /\b(kni(fe|ves)|shears|cutters?|line cutters?|scissors|multi-?tools?)\b/],
  ['gauge', /\b(gauges?|spg|pressure gauge|depth gauge|consoles?|compass(es)?)\b/],
  ['tank', /\b(tanks?|cylinders?|steel \d+|aluminium \d+|aluminum \d+|manifolds?|tank boots?|tank valves?|din valves?|yoke valves?|pony|compressors?|fill(ing)? station|boosters?)\b/],
  ['weights', /\b(weight belts?|(?<!w\/|with |w )weights?|lead|weight systems?|ankle weights?)\b/],
  ['reel & smb', /\b((?<!no |without |w\/o )reels?|spools?|smbs?|surface markers?|dsmbs?|safety sausages?|lift bags?|lifting balloons?|bu?oys?|bouys?|markers?|whistles?|signal(ling)?|mirrors?|lifeline|plb|finger reel|dive flags?)\b/],
  ['camera', /\b(cameras?|housings?|gopro|go pro|insta360|strobes?|video|domes?|lens(es)?|trays?|float arms?|photo(graphy)?|sealife|paralenz|action cams?|underwater imaging|nauticam|ikelite|zoom (gears?|rings?)|ports?)\b/],
  ['accessories', /\b(anti-?fog|antifog)\b/], // an anti-fog product; a mask *with* anti-fog coating matched 'mask' above
  ['spearfishing',/\b(spearguns?|spear guns?|spears?|pole ?spears?|hand ?spears?|slings?|shafts?|float ?lines?|speed spikes?|stringers?|rubbers?|rubber bands?|muzzles?|reel lines?|wishbones?|crimps?|mono(filament)?|flashers?|floats?|rigging|free ?div(e|ing)|apnea|hawaiian|blades?|modular fins?|carbon fins?|fibreglass fins?|abalone|crayfish|lobster|gidgee|railguns?|rail guns?|bridles?|dyneema|spearfishing)\b/],
];

// Sports, as opposed to gear. Shops tag a product with every section it is merchandised in
// ("Sport: Freediving", "Kids Spearfishing", "clearance-spear" on a dive computer or a mask), so in
// *tags* these words say nothing about what the product is and are removed before the rules run;
// in the shop's own category or the title they still count ("Free Diving" -> spearfishing).
const SPORT_WORDS = /\b(spears?|spearos?|spearfish(ing)?|free ?div(e|ing|ers?)|apnea)\b/g;

export function classifyCategory(rawCategory, title, tags = []) {
  const cat = String(rawCategory || '').toLowerCase();
  const ttl = String(title || '').toLowerCase();
  if (CATEGORY_EXCLUDE.test(cat) || TITLE_EXCLUDE.test(ttl)) return 'exclude';
  const first = (hay) => { for (const [c, re] of CATEGORY_RULES) if (re.test(hay)) return c; return ''; };
  // The title is the most reliable signal (what comes before "with" / "incl" first, so "Dive Computer
  // with Textile Strap" is a computer), the shop's own category next (multi-noun labels such as
  // "Hoods Boots Gloves & Socks" are still noisy), and tags ("Species Guide: Pelagic" and "video=..."
  // on a speargun, "computer" on a gauge console) only decide when both say nothing.
  const head = ttl.replace(/\s(?:with|w\/|incl\.?|including|includes)(?:\s|(?=[a-z]))[\s\S]*$/, '');
  const tagText = (tags || []).join(' ').toLowerCase().replace(SPORT_WORDS, ' ');
  return (head !== ttl && first(head)) || first(ttl) || first(cat) || first(tagText) || 'other';
}

export const CATEGORIES = [...new Set(CATEGORY_RULES.map(([c]) => c)), 'other'];

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'with', 'in', 'on', 'to', 'by', 'from', 'new', 'sale',
  'scuba', 'dive', 'diving', 'divers', 'diver', 'australia', 'au', 'genuine', 'official', 'free', 'shipping', 'each', 'ea', 'pc', 'pcs',
  'limited', 'stock', 'clearance', 'special', 'only', 'instore', 'online', 'all', 'final', 'discontinued', 'international', 'she', 'dives', 'tm']);
const COLOURS = new Set(['black', 'white', 'blue', 'red', 'yellow', 'pink', 'green', 'orange', 'grey', 'gray', 'silver', 'clear',
  'transparent', 'purple', 'teal', 'aqua', 'navy', 'lime', 'camo', 'gold', 'turquoise', 'coral', 'mint', 'brown', 'charcoal', 'graphite', 'sand',
  'bk', 'wh', 'bl', 'blk', 'cl', 'colour', 'color', 'colours', 'colors', 'amber', 'sakura', 'wildberry', 'copper', 'stealth', 'bronze', 'olive', 'burgundy', 'rose', 'lilac', 'gry', 'frnch', 'french', 'metallic', 'lemon']);
const SIZES = new Set(['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl', '4xl', 'small', 'medium', 'large', 'regular', 'short', 'tall',
  'ml', 'ls', 'xs/s', 'm/l', 'l/xl', 'xl/xxl', 'mens', 'womens', 'men', 'women', 'ladies', 'lady', 'female', 'male', 'man', 'woman', 'womans', 'mans', 'menss', 'unisex', 'junior', 'kids', 'adult', 'jr', 'size', 'sizes']);

const SYNONYMS = new Map([
  ['reg', 'regulator'], ['regs', 'regulator'], ['regulators', 'regulator'], ['comp', 'computer'], ['computers', 'computer'],
  ['bc', 'bcd'], ['bcds', 'bcd'], ['masks', 'mask'], ['fin', 'fins'], ['snorkels', 'snorkel'], ['torches', 'torch'],
  ['boot', 'boots'], ['glove', 'gloves'], ['wetsuits', 'wetsuit'], ['drysuits', 'drysuit'], ['lights', 'light'],
  ['octo', 'octopus'], ['occy', 'octopus'], ['occies', 'octopus'], ['evo', 'evolution'], ['2nd', 'second'], ['1st', 'first'], ['lh', 'left'], ['rh', 'right'], ['w', 'with'], ['&', 'and'], ['lumens', 'lumen'], ['lm', 'lumen'],
  // plurals of the differentiators, so "Wrist Strap" and "Wrist Straps" are the same part
  ['straps', 'strap'], ['lenses', 'lens'], ['hoses', 'hose'], ['orings', 'oring'], ['pockets', 'pocket'], ['blades', 'blade'], ['sets', 'set'], ['guards', 'guard'],
  ['dsmb', 'smb'], ['smbs', 'smb'], ['spools', 'spool'], ['reels', 'reel'], ['wings', 'wing'],
]);

function splitAlnum(t) {
  // unit sizes ("5mm", "5x3mm", "7x5x3mm", "80cf") and "2xl".."5xl" stay whole
  if (!/\d/.test(t) || !/[a-z]/.test(t) || /^\d+(\.\d+)?(x\d+(\.\d+)?){0,2}(mm|cm|m|l|lt|ltr|cf|kg|g|lb|lbs|w|v|lm|ah|mah|in|ft)$/.test(t) || /^[2-5]x[sl]$/.test(t)) return [t];
  const runs = t.match(/[a-z]+|\d+/g) || [t];
  const out = [];
  let cur = '';
  for (const r of runs) {
    if (/[a-z]/.test(r) && r.length === 1) cur += r; // single letter sticks to neighbouring digits
    else if (/\d/.test(r)) cur += r;
    else { if (cur) out.push(cur); out.push(r); cur = ''; }
  }
  if (cur) out.push(cur);
  // a single trailing letter after digits ("i300c") stays with the number: merge if pattern letter+digits then letter
  return out;
}

/** Lowercase, ASCII-fold, split into tokens. Hyphenated compounds are joined ("x-vision" -> "xvision"). */
// Phrases spelled several ways across shops are folded to one token before splitting.
const COMPOUNDS = [
  [/\bsurface marker buoys?\b|\bsafety sausages?\b|\bd\.a\.m\.?\b|\bdsmbs?\b/g, 'smb'],
  [/\banti[- ]?fog\b/g, 'antifog'], [/\bclosed[- ]circuit\b/g, 'closedcircuit'], [/\bopen[- ]circuit\b/g, 'opencircuit'],
  [/\bfull[- ]face\b/g, 'fullface'], [/\bopen[- ]heel\b|\bo\/h(eel)?\b/g, 'openheel'], [/\bfull[- ]foot\b|\bf\/f\b/g, 'fullfoot'],
  [/\bwith hood\b/g, 'hooded'], [/\bneck seals?\b/g, 'neckseal'], [/\bwrist seals?\b/g, 'wristseal'], [/\blong[- ]sleeved?\b|\bl\/s\b/g, 'longsleeve'], [/\bshort[- ]sleeved?\b|\bs\/s(leeve)?\b/g, 'shortsleeve'],
  [/\b(\d+(?:\.\d+)?)\s*(?:mm)?\s*\/\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*\/\s*(\d+(?:\.\d+)?)\s*mm\b/g, '$1x$2x$3mm'],
  [/\b(\d+(?:\.\d+)?)\s*(?:mm)?\s*\/\s*(\d+(?:\.\d+)?)\s*mm\b/g, '$1x$2mm'],
  [/\b(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(?=\s+(wetsuit|steamer|hood|vest|gloves?|boots?|suit|shorty|jacket|pants|mens|womens|ladies|man|lady))/g, '$1x$2mm'],
  [/\b(\d{3,})\s*cm\b/g, (m, d) => (Number(d) / 100) + 'm'],
  [/\b(\d+)\.0+(?=\D|$)/g, '$1'],
];
export function tokenize(s) {
  let str = String(s || '').replace(/[\u2122\u00ae\u00a9\u2120]/g, '').replace(/\s\+\s/g, ' and ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const [re, to] of COMPOUNDS) str = str.replace(re, to);
  if (/\bfins?\b/.test(str)) str = str.replace(/\boh\b/g, 'openheel');
  const base = str
    .replace(/[\u2019']/g, '')
    .replace(/(?<=[a-z0-9])-(?=[a-z0-9])/g, '')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9.&+]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.+&]+|[.+&]+$/g, ''))
    .filter(Boolean);
  const out = [];
  for (let t of base) {
    if (SYNONYMS.has(t)) t = SYNONYMS.get(t);
    if (!t) continue;
    // Split letter/digit runs when the letter run is 2+ chars so "xtx50" == "xtx 50",
    // "mk25" == "mk 25", "s620ti" -> "s620" + "ti"; single letters stay attached ("d5", "i300c").
    for (const part of splitAlnum(t)) out.push(part);
  }
  return out;
}

/**
 * Tokens that identify a *model*, for cross-retailer grouping: brand words, colours,
 * sizes and stopwords removed; numeric tokens kept (they distinguish models).
 * Single-letter tokens are also joined to their successor ("x", "vision" -> extra "xvision")
 * so "X Vision" and "X-Vision" still overlap.
 */
export function modelTokens(title, brandCanon) {
  // Brand words are stripped from the start of the title ("Scuba Pro MK25" -> "MK25"); single-word
  // brand names are stripped anywhere, but the parts of multi-word aliases are not, so the "pro"
  // of "Scuba Pro" doesn't delete the "Pro" of "Hydros Pro".
  const prefixToks = new Set(tokenize(brandCanon));
  const anywhereToks = new Set();
  for (const alias of [brandCanon, ...BRAND_MAP.keys()]) {
    if (alias !== brandCanon && BRAND_MAP.get(alias) !== brandCanon) continue;
    const at = tokenize(alias);
    for (const t of at) prefixToks.add(t);
    if (at.length === 1) anywhereToks.add(at[0]);
    anywhereToks.add(at.join(''));
  }
  const all = tokenize(title);
  let lead = 0;
  while (lead < all.length && prefixToks.has(all[lead])) lead += 1;
  const raw = all.slice(lead).filter((t) => !anywhereToks.has(t));
  const brandToks = new Set();
  // 's' / 'm' / 'l' are sizes only next to another size word or "size" ("Size M", "S/M"); otherwise they
  // are model suffixes ("Nautic S", "Peregrine TX") and must be kept. "One Size" is a size too.
  const isSize = (t, i) => {
    const prev = raw[i - 1];
    const next = raw[i + 1];
    if (t === 'one' && next === 'size') return true;
    if (t === 'onesize') return true;
    if (!SIZES.has(t)) return false;
    if (t.length > 1) return true;
    return Boolean((prev && SIZES.has(prev)) || (next && SIZES.has(next)) || prev === 'size' || prev === 'sz');
  };
  // After "with" / "incl" a title lists what is included; only tokens that change the product
  // (differentiators, model codes) are kept from that part. The rest is returned as `tail` so the
  // grouping can still tell "w/Snap Clip" from "w/Pigtail Clip" when nothing else differs.
  const withAt = raw.findIndex((t, i) => i > 0 && (t === 'with' || t === 'incl' || t === 'including' || t === 'includes'));
  const toks = [];
  const tail = [];
  raw.forEach((t, i) => {
    if (brandToks.has(t) || STOP.has(t) || COLOURS.has(t) || isSize(t, i)) return;
    if (withAt > 0 && i > withAt && !(DIFFERENTIATORS.has(t) || /\d/.test(t))) {
      tail.push(t);
      return;
    }
    toks.push(t);
  });
  const tl = String(title || '').toLowerCase();
  // A mask/snorkel/fins set is a product of its own, and which of the three it includes is part of
  // what it is: "Mask Snorkel Fin Set" is not "Snorkel & Fin Set". "MS set" / "MSF set" spell it out.
  const msf = [/\bmasks?\b/, /\bsnorkels?\b/, /\bfins?\b/].map((re) => re.test(tl));
  if (/\bms sets?\b/.test(tl)) msf.splice(0, 2, true, true);
  if (/\bmsf sets?\b/.test(tl)) msf.fill(true);
  if ((/\b(set|package|combo|kit)\b/.test(tl) && msf.filter(Boolean).length >= 2) || /\bmsf? sets?\b/.test(tl)) {
    toks.push('msfset');
    ['setmask', 'setsnorkel', 'setfins'].forEach((t, k) => { if (msf[k]) toks.push(t); });
  }
  if (/\bcolou?r (kit|set)s?\b/.test(tl)) toks.push('colourkit');
  // "(1st & 2nd stage)" describes a complete set, not a part: both words together carry no information.
  if (toks.includes('octopus')) for (const w of ['second', 'stage', 'stages']) { const k = toks.indexOf(w); if (k >= 0) toks.splice(k, 1); }
  if (toks.includes('first') && toks.includes('second')) for (const w of ['first', 'second', 'stage', 'stages']) { const k = toks.indexOf(w); if (k >= 0) toks.splice(k, 1); }
  // A single letter followed by a model word is a prefix ("X Vision" -> "xvision", "S 620" -> "s620"),
  // matching the hyphen-joined spelling; before a generic word it is a suffix ("Nautic S Wrist") and stays.
  const out = [];
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    const next = toks[i + 1];
    if (t.length === 1 && /^[a-z]$/.test(t) && next && !GENERIC.has(next) && !DIFFERENTIATORS.has(next) && next.length > 1 && !('sml'.includes(t) && !/\d/.test(next))) {
      out.push(t + next);
      i += 1;
    } else {
      out.push(t);
    }
  }
  const result = [...new Set(out)];
  Object.defineProperty(result, 'tail', { value: [...new Set(tail)], enumerable: false });
  return result;
}

const GENERIC = new Set(['regulator', 'computer', 'mask', 'snorkel', 'fins', 'bcd', 'wetsuit', 'drysuit', 'torch', 'light', 'boots',
  'gloves', 'hood', 'set', 'kit', 'din', 'yoke', 'gauge', 'console', 'knife', 'bag', 'watch', 'steamer', 'jacket', 'wing', 'reel', 'spool',
  'tank', 'cylinder', 'strobe', 'camera', 'housing', 'suit', 'top', 'vest', 'and', 'with', 'plus', 'pro', 'evolution', 'system', 'version',
  'style', 'model', 'series', 'edition', 'type', 'complete', 'full', 'standard', 'classic', 'wrist', 'compact', 'amoled', 'oled', 'colour', 'color', 'digital',
  'ai', 'wireless', 'technology', 'rechargeable', 'professional', 'performance', 'premium', 'silicone', 'silicon', 'neoprene', 'nylon', 'polyester', 'stainless', 'research']);

// Tokens that change what the product *is*: if only one of two titles has one of these, they are
// different products even when everything else matches ("R195 Octopus" vs "R195 Second Stage").
export const DIFFERENTIATORS = new Set(['octopus', 'spare', 'replacement', 'used', 'secondhand', 'exdemo', 'demo', 'refurbished',
  'transmitter', 'prescription', 'upgrade', 'twin', 'double', 'doubles', 'pair', 'left', 'right', 'strap', 'cover', 'case', 'bag',
  'battery', 'charger', 'adapter', 'mount', 'holder', 'protector', 'blade', 'lens', 'hose', 'oring',
  'service', 'first', 'second', 'stage', 'trial', 'rental', 'hire', 'refill', 'valve', 'mouthpiece', 'msfset', 'setmask', 'setsnorkel', 'setfins', 'colourkit', 'harness', 'bladder',
  'backplate', 'pocket', 'sleeve', 'hood', 'hooded', 'boots', 'socks', 'gloves', 'shorty', 'shorts', 'jacket', 'pants',
  'john', 'vest', 'inflator', 'gauge', 'console', 'compass', 'handle', 'grip', 'reel', 'spool', 'float', 'flag', 'line', 'pod', 'weighted',
  'sidemount', 'backmount', 'travel', 'lite', 'mini', 'micro', 'nano', 'max', 'youth', 'kids', 'junior',
  'pro', 'plus', 'evolution', 'ii', 'iii', 'iv', 'pack', 'package', 'bundle', 'combo', 'mkii', 'aluminium', 'carbon', 'fibreglass', 'plastic', 'rubber', 'metal', 'titanium', 'brass',
  'housing', 'video', 'capsule', 'module', 'interface', 'wing', 'neckseal', 'wristseal', 'film', 'sensor', 'extension', 'accessories', 'parts', 'body', 'closedcircuit', 'opencircuit', 'longsleeve', 'shortsleeve', 'sleeveless', 'leggings']);

/** A token that must appear on both sides: model codes, numbers, unit sizes, differentiators. */
function isHard(t) {
  return DIFFERENTIATORS.has(t) || /\d/.test(t);
}

/**
 * Similarity of two model-token arrays in [0,1]:
 *  - 0 if any "hard" token (model code, number, size, differentiator) is on one side only;
 *  - otherwise Jaccard over the *core* tokens (generic gear nouns removed), requiring at least
 *    one shared core token, and two when both names have three or more.
 */
export function tokenSimilarity(a, b) {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  for (const t of A) if (isHard(t) && !B.has(t)) return 0;
  for (const t of B) if (isHard(t) && !A.has(t)) return 0;
  let CA = [...A].filter((t) => !GENERIC.has(t));
  let CB = [...B].filter((t) => !GENERIC.has(t));
  if (!CA.length || !CB.length) {
    CA = [...A];
    CB = [...B];
  }
  const SB = new Set(CB);
  const shared = CA.filter((t) => SB.has(t)).length;
  if (shared === 0) return 0;
  if (Math.min(CA.length, CB.length) >= 3 && shared < 2) return 0;
  const union = new Set([...CA, ...CB]).size;
  return shared / union;
}

/** 'm' | 'w' | 'k' | '' from a product title, for keeping men's / women's / kids' versions apart. */
export function genderOf(title) {
  const t = String(title || '').toLowerCase();
  const w = /\b(women'?s?|womens|ladies|lady|female|her|woman)\b/.test(t);
  const m = /\b(men'?s?|mens|male|his|man)\b/.test(t);
  if (w && m) return ''; // "(male & female)" is a unisex listing
  if (w) return 'w';
  if (m) return 'm';
  if (/\b(kids?|junior|jr|youth|child|children)\b/.test(t)) return 'k';
  return '';
}

/** Cheap SKU normaliser used for exact cross-retailer matches. */
export function normalizeSku(sku) {
  const s = String(sku || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 5 && /\d/.test(s) ? s : '';
}
