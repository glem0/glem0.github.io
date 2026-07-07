/* ============================================================
 * NSW Dive Conditions, site database + data-source zones
 * ============================================================
 * All rating inputs live here so tuning = editing this file.
 *
 * area:      which coastal area a site belongs to (AREAS registry
 *            below drives the UI filter, north to south).
 * exposure: [N, NE, E, SE, S, SW, W, NW], fraction of swell
 *   arriving FROM that direction that actually reaches the site
 *   (1 = fully exposed, 0 = fully sheltered). Interpolated
 *   between sectors. These encode local knowledge: e.g. Kurnell
 *   faces north across Botany Bay, so a big southerly barely
 *   touches it, while Shark Point cops everything.
 *
 * swellTol:  multiplier on the swell a site can absorb before
 *            it is blown out (deep boat sites ride it better).
 * baseVis:   typical good-day visibility in metres.
 * runoff:    0..1 sensitivity of visibility to recent rainfall
 *            (estuary/harbour sites turn to milk after rain).
 * ============================================================ */

/* Coastal areas, ordered north to south. The UI area filter, map bounds,
   day-brief tides and water-temp range all key off this registry.
   bounds: [[southLat, westLng], [northLat, eastLng]] for fitBounds.
   tideZone: marine zone whose modelled sea level feeds the day brief. */
var AREAS = {
  order: ['byron', 'solitary', 'swr', 'portmac', 'forster', 'portstephens',
    'newcastle', 'centralcoast', 'sydney', 'wollongong', 'shellharbour',
    'jervis', 'ulladulla', 'batemans', 'narooma', 'eden'],
  all: { label: 'All NSW', bounds: [[-37.40, 149.70], [-28.45, 153.85]], tideZone: 'heads' },
  info: {
    byron:        { label: 'Byron Bay',                 tideZone: 'julian',      bounds: [[-28.70, 153.55], [-28.40, 153.72]] },
    solitary:     { label: 'Coffs & Solitary Islands',  tideZone: 'ssolitary',   bounds: [[-30.35, 153.05], [-29.65, 153.47]] },
    swr:          { label: 'South West Rocks',          tideZone: 'fishrock',    bounds: [[-31.00, 152.95], [-30.78, 153.15]] },
    portmac:      { label: 'Port Macquarie & Camden Haven', tideZone: 'portmac', bounds: [[-31.75, 152.78], [-31.55, 152.98]] },
    forster:      { label: 'Forster & Seal Rocks',      tideZone: 'forster',     bounds: [[-32.50, 152.45], [-32.15, 152.65]] },
    portstephens: { label: 'Port Stephens',             tideZone: 'tomaree',     bounds: [[-32.80, 152.05], [-32.55, 152.40]] },
    newcastle:    { label: 'Newcastle & Swansea',       tideZone: 'moonisland',  bounds: [[-33.20, 151.55], [-32.90, 151.82]] },
    centralcoast: { label: 'Central Coast',             tideZone: 'terrigal',    bounds: [[-33.55, 151.35], [-33.17, 151.64]] },
    sydney:       { label: 'Sydney',                    tideZone: 'heads',       bounds: [[-34.22, 151.05], [-33.55, 151.45]] },
    wollongong:   { label: 'Wollongong',                tideZone: 'fiveislands', bounds: [[-34.52, 150.85], [-34.42, 151.00]] },
    shellharbour: { label: 'Shellharbour & Kiama',      tideZone: 'basspoint',   bounds: [[-34.70, 150.80], [-34.55, 150.95]] },
    jervis:       { label: 'Jervis Bay & Shoalhaven',   tideZone: 'jervis',      bounds: [[-35.20, 150.65], [-34.90, 150.95]] },
    ulladulla:    { label: 'Ulladulla',                 tideZone: 'ulladulla',   bounds: [[-35.55, 150.35], [-35.30, 150.50]] },
    batemans:     { label: 'Batemans Bay',              tideZone: 'tollgates',   bounds: [[-35.85, 150.15], [-35.70, 150.35]] },
    narooma:      { label: 'Narooma & Montague Island', tideZone: 'montague',    bounds: [[-36.34, 150.10], [-36.18, 150.26]] },
    eden:         { label: 'Tathra, Merimbula & Eden',  tideZone: 'eden',        bounds: [[-37.30, 149.85], [-36.70, 150.10]] }
  }
};

/* Offshore forecast points, one or two per area (the wave model runs at
   ~25 km, more points would add nothing). All verified to return live
   swell + sea level + SST from the Open-Meteo marine API. */
var MARINE_ZONES = {
  order: ['julian', 'nsolitary', 'ssolitary', 'fishrock', 'portmac', 'forster',
    'sealrocks', 'broughton', 'tomaree', 'moonisland', 'norah', 'terrigal',
    'broken', 'north', 'heads', 'east', 'botany', 'south', 'royal',
    'fiveislands', 'basspoint', 'jervis', 'ulladulla', 'tollgates',
    'montague', 'merimbula', 'eden'],
  points: {
    julian:      { lat: -28.590, lon: 153.700, label: 'off Julian Rocks' },
    nsolitary:   { lat: -29.920, lon: 153.500, label: 'off North Solitary' },
    ssolitary:   { lat: -30.210, lon: 153.400, label: 'off South Solitary' },
    fishrock:    { lat: -30.950, lon: 153.180, label: 'off Smoky Cape' },
    portmac:     { lat: -31.680, lon: 152.950, label: 'off Camden Haven' },
    forster:     { lat: -32.200, lon: 152.620, label: 'off Forster' },
    sealrocks:   { lat: -32.470, lon: 152.610, label: 'off Seal Rocks' },
    broughton:   { lat: -32.600, lon: 152.400, label: 'off Broughton Island' },
    tomaree:     { lat: -32.760, lon: 152.280, label: 'off Tomaree Head' },
    moonisland:  { lat: -33.100, lon: 151.750, label: 'off Moon Island' },
    norah:       { lat: -33.290, lon: 151.620, label: 'off Norah Head' },
    terrigal:    { lat: -33.470, lon: 151.520, label: 'off Terrigal' },
    broken: { lat: -33.610, lon: 151.380, label: 'off Broken Bay' },
    north:  { lat: -33.745, lon: 151.345, label: 'off Long Reef' },
    heads:  { lat: -33.830, lon: 151.310, label: 'off Sydney Heads' },
    east:   { lat: -33.930, lon: 151.290, label: 'off Coogee' },
    botany: { lat: -34.005, lon: 151.270, label: 'off Botany Bay' },
    south:  { lat: -34.070, lon: 151.200, label: 'off Cronulla' },
    royal:  { lat: -34.160, lon: 151.130, label: 'off Royal National Park' },
    fiveislands: { lat: -34.470, lon: 151.010, label: 'off the Five Islands' },
    basspoint:   { lat: -34.610, lon: 150.960, label: 'off Bass Point' },
    jervis:      { lat: -35.060, lon: 150.900, label: 'off Point Perpendicular' },
    ulladulla:   { lat: -35.380, lon: 150.560, label: 'off Ulladulla' },
    tollgates:   { lat: -35.780, lon: 150.330, label: 'off the Tollgate Islands' },
    montague:    { lat: -36.280, lon: 150.300, label: 'off Montague Island' },
    merimbula:   { lat: -36.850, lon: 150.030, label: 'off Merimbula' },
    eden:        { lat: -37.150, lon: 150.100, label: 'off Green Cape' }
  }
};

/* River-discharge monitoring (Open-Meteo Flood API / GloFAS). When a river
   runs at flood scale, visibility in its receiving water body is wrecked for
   days, rain gauges can't see upstream catchment rain, discharge can.
   NSW cells were probed for the main stem (nearby cells can be trickles). */
var FLOOD_RIVERS = {
  brunswick:  { lat: -28.53, lon: 153.54, affects: ['byron'] },
  macleay:    { lat: -30.85, lon: 152.95, affects: ['macleay'] },
  karuah:     { lat: -32.65, lon: 151.95, affects: ['portstephens'] },
  hunter:     { lat: -32.85, lon: 151.70, affects: ['newcastle'] },
  hawkesbury: { lat: -33.55, lon: 151.20, affects: ['hawkesbury'] },
  parramatta: { lat: -33.84, lon: 151.05, affects: ['harbour'] },
  georges:    { lat: -33.97, lon: 151.12, affects: ['botany'] },
  hacking:    { lat: -34.07, lon: 151.10, affects: ['hacking'] },
  shoalhaven: { lat: -34.86, lon: 150.55, affects: ['shoalhaven'] },
  clyde:      { lat: -35.71, lon: 150.15, affects: ['batemans'] },
  bega:       { lat: -36.68, lon: 149.85, affects: ['tathra'] }
};

var WEATHER_ZONES = {
  order: ['byron', 'wooli', 'coffs', 'swrocks', 'portmac', 'forster',
    'nelsonbay', 'swansea', 'theentrance',
    'manly', 'harbour', 'east', 'kurnell', 'cronulla',
    'portkembla', 'shellharbour', 'huskisson', 'ulladulla', 'batemans',
    'narooma', 'merimbula', 'eden'],
  points: {
    byron:       { lat: -28.640, lon: 153.610 },
    wooli:       { lat: -29.870, lon: 153.270 },
    coffs:       { lat: -30.300, lon: 153.140 },
    swrocks:     { lat: -30.890, lon: 153.040 },
    portmac:     { lat: -31.650, lon: 152.840 },
    forster:     { lat: -32.260, lon: 152.530 },
    nelsonbay:   { lat: -32.720, lon: 152.150 },
    swansea:     { lat: -33.090, lon: 151.650 },
    theentrance: { lat: -33.360, lon: 151.500 },
    manly:    { lat: -33.800, lon: 151.290 },
    harbour:  { lat: -33.840, lon: 151.260 },
    east:     { lat: -33.920, lon: 151.260 },
    kurnell:  { lat: -34.005, lon: 151.215 },
    cronulla: { lat: -34.060, lon: 151.150 },
    portkembla:   { lat: -34.460, lon: 150.900 },
    shellharbour: { lat: -34.580, lon: 150.870 },
    huskisson:    { lat: -35.040, lon: 150.670 },
    ulladulla:    { lat: -35.360, lon: 150.470 },
    batemans:     { lat: -35.720, lon: 150.180 },
    narooma:      { lat: -36.220, lon: 150.130 },
    merimbula:    { lat: -36.890, lon: 149.930 },
    eden:         { lat: -37.070, lon: 149.910 }
  }
};

var DIVE_SITES = [

  /* ---------- Manly & Northern Beaches ---------- */
  {
    id: 'shelly-beach',
    mc: 326,
    name: 'Shelly Beach (Cabbage Tree Bay)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.8004, lng: 151.2971,
    type: 'shore', depth: '2–12 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'manly',
    exposure: [0.60, 0.90, 0.70, 0.30, 0.15, 0.05, 0.05, 0.20],
    swellTol: 1.0, baseVis: 8, runoff: 0.4,
    blurb: 'Sydney’s most-dived shore site: an easy, very protected aquatic reserve. Juvenile dusky whalers cruise the promenade side in summer, and it gets much livelier at night.',
    highlights: ['Dusky whaler pups (summer)', 'Occasional seadragons', 'Rays on the sand', 'Better as a night dive'],
    hazards: 'Busy with swimmers and snorkellers in summer; surge with NE swell.',
    entry: 'Beach entry on the eastern (right-hand) side, keep the reef on your right.'
  },
  {
    id: 'fairy-bower',
    mc: 488,
    name: 'Fairy Bower',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.800603, lng: 151.293607,   /* Frog Dive entry pin */
    type: 'shore', depth: '4–12 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'manly',
    exposure: [0.60, 0.90, 0.80, 0.45, 0.25, 0.05, 0.05, 0.20],
    swellTol: 1.0, baseVis: 8, runoff: 0.4,
    blurb: 'Out-and-back loop along the low reef and western wall below the Bower, dusky whalers, near-shark-sized flatheads, and some odd artefacts including old pipe sections and a 1980s motorcycle.',
    highlights: ['Dusky whaler sharks', 'Huge flatheads', 'Wall cracks & overhangs', 'Best at night'],
    hazards: 'Rock entry beside the pool; exposed to NE–E swell; parking is scarce.',
    entry: 'Gear up at Bower Lane, stairs down, enter the small bay left of the rock pool.'
  },
  {
    id: 'blue-fish-point',
    name: 'Blue Fish Point',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.807328, lng: 151.306863,   /* OSM cape */
    type: 'boat', depth: '12–28 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'manly',
    exposure: [0.70, 0.95, 1.00, 0.90, 0.45, 0.10, 0.05, 0.30],
    swellTol: 0.9, baseVis: 10, runoff: 0.3,
    blurb: 'Huge boulders, short walls and fish-filled gutters on the open-ocean side of North Head.',
    highlights: ['Big schools of kingfish & yellowtail', 'Sponge gardens', 'Occasional grey nurse'],
    hazards: 'Fully exposed to ocean swell, calm days only. Usually dived by boat.',
    entry: 'Boat anchorage off the point.'
  },
  {
    id: 'the-apartments',
    mc: 339,
    name: 'The Apartments (Long Reef)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.738250, lng: 151.327333,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '8–20 m', level: 'Open Water',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.75, 0.85, 0.85, 0.80, 0.75, 0.10, 0.10, 0.40],
    swellTol: 1.05, baseVis: 12, runoff: 0.2,
    blurb: 'Boulder “apartments” along a ridge off Long Reef, with the Cathedral swim-through, Andys Cave, and fish schools so thick they darken the water.',
    highlights: ['The Cathedral swim-through', 'Andys Cave', 'Vast pomfret & yellowtail schools', 'Big cuttlefish'],
    hazards: 'Boat only; bring a torch for the caves, the schools block the light.',
    entry: 'Boat, anchor in ~10 m on top of the ridge; best in winter.'
  },
  {
    id: 'ss-dee-why',
    mc: 59,
    name: 'SS Dee Why (wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.715642, lng: 151.347253, wreck: true,   /* McFadyen's WGS84 mark, Long Reef wreck site */
    type: 'boat', depth: '43–48 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 15, runoff: 0.2,
    blurb: 'The 1928 Glasgow-built Manly steam ferry, scuttled at the Long Reef wreck site in 1976, swim between her four boilers, 4 km off Narrabeen.',
    highlights: ['Four intact boilers', 'Double-ended bows & rudders', 'Holds & prop-shaft passages', 'Dusky whalers on the ascent'],
    hazards: 'Decompression-range depth, trained, experienced deep divers only; the anchor won’t hold if it lands on sand.',
    entry: 'Charter boat; anchor or shot-line descent.'
  },

  {
    id: 'freshwater',
    viz: '/maps-of-shore-dive-sites/freshwater',
    name: 'Freshwater',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.781884, lng: 151.294051, approx: true,   /* Frog Dive pin; Viz pins the headland ~200 m east */
    type: 'shore', depth: '4–12 m', level: 'Open Water',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.80, 0.85, 0.75, 0.55, 0.10, 0.05, 0.20],
    swellTol: 0.9, baseVis: 8, runoff: 0.35,
    blurb: 'Boulder gutters around the southern Freshwater headland toward Queenscliff, an easy northern-beaches wander when the sea is kind. (Not in McFadyen’s guides; details are local knowledge.)',
    highlights: ['Blue gropers', 'Cuttlefish & octopus', 'PJ sharks (winter)', 'Boulder gutters'],
    hazards: 'Open-coast entry over rocks near the pool, needs a small sea; watch the shorebreak on exit.',
    entry: 'South end of the beach by the ocean pool, out along the headland.'
  },
  {
    id: 'dee-why-wide',
    mc: 277,
    name: 'Dee Why Wide',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.769612, lng: 151.321923,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '23–32 m', level: 'Advanced',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.65, 0.70, 0.70, 0.70, 0.65, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 13, runoff: 0.15,
    blurb: 'One of Sydney’s best reef dives, 2.4 km off Curl Curl: cracks in the reef top open into a 28 m blue-devil cave, with a huge broken ship’s anchor wedged nearby.',
    highlights: ['28 m cave with blue devilfish', 'Giant broken ship’s anchor', 'Gorgonian boulder fields', 'Kingfish & pomfret schools'],
    hazards: 'Deep, exposed offshore reef, watch bottom time.',
    entry: 'Boat, anchor the SE corner of the reef edge.'
  },

  {
    id: 'dee-why-curlie',
    viz: '/maps-of-shore-dive-sites/dee-why-curlie',
    name: 'Dee Why – Curl Curl Drift',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.759857, lng: 151.302051,   /* Viz MyMaps pin */
    type: 'boat', depth: '8–20 m', level: 'Advanced',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.70, 0.80, 0.85, 0.80, 0.70, 0.10, 0.05, 0.25],
    swellTol: 0.95, baseVis: 10, runoff: 0.3,
    blurb: 'A long ocean reef strip from Dee Why Point toward Curl Curl, sponge cover thickening as the sand line drops to 18–20 m at the southern end, a proper scooter-drift adventure. (Documented by Viz, not McFadyen.)',
    highlights: ['Long reef drift', 'Thickening sponge gardens', 'Kingfish country', 'Scooter adventure'],
    hazards: 'Far from any exit, boat or scooter only; a strong rip can run off North Curl Curl. Carry an SMB (a PLB isn’t silly).',
    entry: 'Boat, or sea-scooter from North Curl Curl SLSC in low swell.'
  },

  /* ---------- Sydney Harbour ---------- */
  {
    id: 'fairlight',
    mc: 636,
    name: 'Fairlight',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.799939, lng: 151.274750,   /* Frog Dive entry pin */
    type: 'shore', depth: '3–9 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.15, 0.20, 0.25, 0.25, 0.15, 0.05, 0.05, 0.05],
    swellTol: 1.0, baseVis: 5, runoff: 0.8, tidePref: 'high', waterBody: 'harbour',
    blurb: 'Sponge-and-soft-coral wall on the harbour side of Manly, complete with a sunken speedboat, a dependable fallback when the ocean is unruly.',
    highlights: ['Speedboat wreck', 'Long-snouted boarfish', 'Sponge & soft-coral wall', 'Prolific small fish'],
    hazards: 'Shallow rocky entry, ease in, don’t jump. Best at or near high tide.',
    entry: 'Access path off Fairlight Crescent, across the grass and rock platform.'
  },
  {
    id: 'old-mans-hat',
    mc: 312,
    name: 'Old Man’s Hat',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.820338, lng: 151.294275, approx: true,   /* McFadyen's GPX "NTHHD" mark; his Hat-page AUS66 GPS converts here */
    type: 'boat', depth: '18–24 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.10, 0.20, 0.45, 0.50, 0.30, 0.05, 0.05, 0.05],
    swellTol: 1.0, baseVis: 9, runoff: 0.6, waterBody: 'harbour',
    blurb: 'Brilliant sponge gardens over walls, canyons and swim-throughs just inside North Head, usually dived as a drift with the tide.',
    highlights: ['Sponge gardens & gorgonians', 'Port Jackson sharks (late winter)', 'Weedy seadragons', 'Swim-throughs'],
    hazards: 'Heavy boat traffic at the Heads; swell wraps in when seas are big.',
    entry: 'Boat, drift along North Head with the tide, or anchor where it shallows.'
  },
  {
    id: 'clifton-gardens',
    mc: 271,
    name: 'Clifton Gardens (Chowder Bay)',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.839909, lng: 151.253414,   /* Frog Dive entry pin */
    type: 'shore', depth: '1.5–10 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.05, 0.06, 0.08, 0.08, 0.05, 0.03, 0.03, 0.03],
    swellTol: 1.0, baseVis: 5, runoff: 0.95, tidePref: 'incoming', waterBody: 'harbour',
    blurb: 'Sydney’s muck-diving mecca: seahorses on the net, a dozen anglerfish on a good day, and an underwater junkyard of statues, a motorbike and “seahorse hotels” around the wharf.',
    highlights: ['White’s seahorses', 'Striated anglerfish', 'Blue-lined octopus', 'Dumpling squid & decorator crabs'],
    hazards: 'Stay under the wharf edge or risk fishers’ hooks; vis is usually only 3–5 m and worse after rain.',
    entry: 'Off the right-hand side of the beach; best on an incoming or high tide.'
  },
  {
    id: 'balmoral',
    mc: 251,
    name: 'Balmoral (The Nets)',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.8280, lng: 151.2530,
    type: 'shore', depth: '1–5 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.05, 0.10, 0.22, 0.18, 0.08, 0.03, 0.03, 0.03],
    swellTol: 1.0, baseVis: 5, runoff: 0.8, tidePref: 'high', waterBody: 'harbour',
    blurb: 'A gentle lap of the old baths net, one of Sydney’s great seahorse dives (87 White’s seahorses were once counted here on a single night dive).',
    highlights: ['White’s seahorses on the net', 'Blue-ringed octopus', 'Pygmy leatherjackets', 'Classic night dive'],
    hazards: 'Very shallow, barely 5 m even at high tide; plan around the top of the tide.',
    entry: 'Wade in off the sand at the baths; circle the curved net anti-clockwise.'
  },
  {
    id: 'camp-cove',
    mc: 267,
    name: 'Camp Cove',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.838942, lng: 151.279239,   /* Frog Dive entry pin */
    type: 'shore', depth: '2–7 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.12, 0.12, 0.15, 0.15, 0.10, 0.05, 0.05, 0.05],
    swellTol: 1.0, baseVis: 6, runoff: 0.75, waterBody: 'harbour',
    blurb: 'Boulder reef and sand inside South Head, littered with 50-year-old bottles, one of Sydney’s best and safest night dives, and ideal when a southerly is blowing.',
    highlights: ['White’s seahorses', 'Blue-ringed octopus', 'Dumpling squid', 'Anglerfish & other rarities'],
    hazards: 'Never ascend away from the reef, boats anchor and manoeuvre overhead in summer. Vis drops to 1–2 m after rain.',
    entry: 'Ramp beside the kiosk; enter and exit off the northern end of the beach.'
  },

  {
    id: 'old-mans-shoulder',
    mc: 559,
    name: 'Old Mans Shoulder',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.821893, lng: 151.289913, approx: true,   /* his page's WGS84 GPS (~200 m from the Hat) */
    type: 'boat', depth: '10–27 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.10, 0.20, 0.45, 0.50, 0.30, 0.05, 0.05, 0.05],
    swellTol: 1.0, baseVis: 9, runoff: 0.6, tidePref: 'incoming', waterBody: 'harbour',
    blurb: 'Reef-top at 10–13 m dropping to 27 m along North Head, seadragons on virtually every dive, he ranks this stretch among Sydney’s best, especially when the nor’easter blows.',
    highlights: ['Weedy seadragons every dive', 'Sponge gardens & lace coral', 'Bull rays up to 2 m', 'Small swim-throughs'],
    hazards: 'Heavy boat traffic along North Head, ascend on the anchor line; mild current possible.',
    entry: 'Boat, approach from the south, anchor the deeper side in southerlies.'
  },
  {
    id: 'bottle-and-glass',
    mc: 530,
    name: 'Bottle and Glass Point',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.847903, lng: 151.269823,   /* OSM cape */
    type: 'shore', depth: '5–8 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.08, 0.10, 0.15, 0.12, 0.08, 0.05, 0.05, 0.05],
    swellTol: 1.0, baseVis: 5, runoff: 0.8, waterBody: 'harbour',
    blurb: 'Kelp-edged reef off the eastern end of Nielsen Park, Vaucluse, a shallow harbour wander for when the ocean is unruly, with seahorses on the swim net in season.',
    highlights: ['Seahorses on the net (summer)', 'Kelp reef edge & sponges', 'Easy night dive', 'Harbour fish schools'],
    hazards: 'Simple navigation, little else, but summer parking at Nielsen Park is near impossible.',
    entry: 'Through Nielsen Park to the eastern end of the beach.'
  },

  {
    id: 'middle-head',
    mc: 749,
    name: 'Middle Head',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.8278, lng: 151.2665, approx: true,
    type: 'shore', depth: '3–10 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.06, 0.08, 0.15, 0.12, 0.08, 0.04, 0.04, 0.04],
    swellTol: 1.0, baseVis: 6, runoff: 0.7, waterBody: 'harbour',
    blurb: 'Sponge gardens around the headland between Cobblers and Obelisk, littered with some twenty lost anchors, including two admiralty anchors from the 1834 wreck of the Edward Lombe.',
    highlights: ['1834 Edward Lombe anchors', 'Sponge gardens on the NE face', 'Turtles & gropers', 'Beehive Casemate tunnel'],
    hazards: 'Heavy boat traffic, worst at the eastern corner beside the shipping channel; both entry beaches are clothing-optional.',
    entry: 'Beach entry at Cobblers or Obelisk; car shuttle for the full one-way circumnavigation.'
  },
  {
    id: 'cobblers',
    viz: '/maps-of-shore-dive-sites/middle-head',
    name: 'Cobblers Beach',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.824732, lng: 151.262589,   /* Viz MyMaps pin */
    type: 'shore', depth: '3–9 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.06, 0.08, 0.10, 0.08, 0.05, 0.04, 0.04, 0.04],
    swellTol: 1.0, baseVis: 5, runoff: 0.7, waterBody: 'harbour',
    blurb: 'Easy sand entry on Middle Head’s north side: a corroded 6 m barge 210 m out as a navigation target, hammer octopus and juvenile PJ sharks on the flats. Best at night. (Documented by Viz.)',
    highlights: ['Sunken barge at 210 m out', 'Hammer octopus', 'Juvenile PJ sharks', 'Boulder swim-throughs east'],
    hazards: 'Boating around the headland; the barge is small and easy to overshoot, time your swim. Clothing-optional beach.',
    entry: '450 m walk down from the parking area, easy sand entry.'
  },
  {
    id: 'obelisk',
    viz: '/maps-of-shore-dive-sites/middle-head',
    name: 'Obelisk Beach',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.830385, lng: 151.264083,   /* Viz MyMaps pin */
    type: 'shore', depth: '3–7 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.05, 0.06, 0.12, 0.10, 0.06, 0.04, 0.04, 0.04],
    swellTol: 1.0, baseVis: 5, runoff: 0.7, waterBody: 'harbour',
    blurb: 'The easiest way onto Middle Head’s sponge gardens, follow the sand line east about 200 m and the colour starts. Fairlight-like overhangs with resting PJ and crested horn sharks. (Documented by Viz.)',
    highlights: ['Sponge gardens & overhangs', 'PJ & crested horn sharks', 'Crocodile fish & octopus', 'Squid on night dives'],
    hazards: 'Steep stepped path down (~37 m descent); boat traffic near the shipping channel corner; well-known nude beach.',
    entry: 'Narrow path from the car park above the beach.'
  },
  {
    id: 'dobroyd-head',
    viz: '/maps-of-shore-dive-sites/dobroyd-head',
    name: 'Dobroyd Head',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.808331, lng: 151.275600,   /* Viz MyMaps pin */
    type: 'shore', depth: '5–12 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.08, 0.10, 0.20, 0.18, 0.12, 0.04, 0.04, 0.04],
    swellTol: 1.0, baseVis: 5, runoff: 0.75, waterBody: 'harbour',
    blurb: 'Walk-in-only sponge walls south of Reef Beach, richer toward the point, angelsharks, wobbegongs and a small speedboat wreck at 12 m. Long approaches; a sea scooter earns its keep. (Documented by Viz.)',
    highlights: ['Australian angelsharks', 'Sponge-covered walls', 'Speedboat wreck at 12 m', 'Relocated seahorse colony'],
    hazards: 'Manly ferry passes close at full power; long shoreline with few exits; the wreck sits well offshore, risky surface swims.',
    entry: 'Walk from Beatty Street via Forty Baskets, ~700 m of coast path to Reef Beach.'
  },
  {
    id: 'ss-centennial',
    mc: 55,
    name: 'SS Centennial (wreck)',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.847863, lng: 151.250035, wreck: true,   /* McFadyen's WGS84 mark */
    type: 'shore', depth: '12–15 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.05, 0.06, 0.10, 0.08, 0.05, 0.04, 0.04, 0.04],
    swellTol: 1.0, baseVis: 5, runoff: 0.75, waterBody: 'harbour',
    blurb: 'A 66 m iron passenger steamer run down off Bradleys Head in 1889, blasted flat, now a mussel-crusted mound of ribs and plates with good fishlife, diveable from shore if you’re up for the ~1 km swim.',
    highlights: ['Genuine 1889 shipwreck', 'Ribs, plates & one bollard', 'Bream & nannygai schools', 'Catfish & small morays'],
    hazards: 'About 200 m offshore with ~1 km of surface swimming; featureless dark shoreline at night; boat traffic; vis can drop under 3 m.',
    entry: 'Taylors Bay steps (130 of them) or the Bradleys Head SE rock platform; easy as a short boat dive.'
  },

  /* ---------- Eastern Suburbs ---------- */
  {
    id: 'gordons-bay',
    mc: 282,
    name: 'Gordons Bay',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.9157, lng: 151.2630,
    type: 'shore', depth: '5–12 m', level: 'Open Water',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.45, 0.70, 0.65, 0.45, 0.30, 0.05, 0.05, 0.15],
    swellTol: 1.0, baseVis: 8, runoff: 0.5, tidePref: 'incoming',
    blurb: 'Home of the underwater nature trail, follow the chain past “The Wall” at the sand spit, reef and kelp beds. Vis is usually best on an incoming tide.',
    highlights: ['Underwater nature trail', 'Blue gropers & morwong', '“The Wall” at the sand spit', 'Good night dive'],
    hazards: 'Ramp entry and exit depend on sea state; surgy with NE–E swell.',
    entry: 'Rock ramp at the end of the path from the south end of Clovelly Beach car park.'
  },
  {
    id: 'clovelly',
    mc: 272,
    name: 'Clovelly Bay',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.9141, lng: 151.2669,
    type: 'shore', depth: '2–11 m', level: 'Open Water',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.20, 0.35, 0.50, 0.35, 0.22, 0.05, 0.05, 0.10],
    swellTol: 1.0, baseVis: 9, runoff: 0.5,
    blurb: 'The concrete-edged inlet is Sydney’s easiest ocean dive: 2–6 m inside the pool, 8–11 m past the wall, patrolled by famously tame blue gropers.',
    highlights: ['Tame blue gropers', 'Trevally & yellowtail schools', 'First-night-dive favourite', 'Wobbegongs outside the wall'],
    hazards: 'Scuba banned 8 am–6 pm October–April; slippery steps; ebb-tide outflow over the wall makes the return hard.',
    entry: 'Concrete steps on the south side of the pool, slippery, enter gently.'
  },
  {
    id: 'shark-point',
    mc: 325,
    name: 'Shark Point (Clovelly)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.914522, lng: 151.272543,   /* McFadyen's WGS84 mark */
    type: 'shore', depth: '8–26 m', level: 'Advanced',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.70, 0.90, 1.00, 1.00, 0.90, 0.10, 0.05, 0.30],
    swellTol: 0.8, baseVis: 10, runoff: 0.4,
    blurb: 'Huge boulders, swim-throughs and sponge gardens down to 26 m, the pick of the Clovelly sites when the sea allows, and where pygmy pipehorses were first recognised.',
    highlights: ['Sponge gardens & gorgonians', 'Weedy seadragons', 'Pygmy pipehorses', 'Eastern blue devils'],
    hazards: 'Experienced divers only, calm seas essential; northerly current common; ebb tide hampers the emergency exit into Clovelly.',
    entry: 'Rock platform on the north side of Clovelly Bay, at the point or the fissure; assess before gearing up.'
  },
  {
    id: 'wedding-cake-island',
    mc: 341,
    name: 'Wedding Cake Island',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.925057, lng: 151.266330,   /* midpoint of McFadyen's WGS84 NW/SE anchorages */
    type: 'boat', depth: '5–22 m', level: 'Open Water',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.65, 0.75, 0.80, 0.80, 0.75, 0.10, 0.10, 0.30],
    swellTol: 1.05, baseVis: 10, runoff: 0.3,
    blurb: 'Walls, ledges, gullies and small caves ring the island a kilometre off Coogee, relatively untouched thanks to the boat run required.',
    highlights: ['Eastern blue devils', 'Gullies, overhangs & caves', 'Nudibranchs & sponge life', 'Blue gropers & kingfish'],
    hazards: 'Long, swell-exposed boat run, trips get cancelled; the rocks barely show at high tide.',
    entry: 'Boat, anchor off the SE or NW corner.'
  },
  {
    id: 'magic-point',
    mc: 302,
    name: 'Magic Point (Maroubra)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.956472, lng: 151.265312,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '8–20 m', level: 'Open Water',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.55, 0.70, 0.85, 0.90, 0.85, 0.15, 0.10, 0.25],
    swellTol: 1.0, baseVis: 12, runoff: 0.3,
    blurb: 'A 15 m-long cave at the south end of Maroubra shelters Sydney’s resident grey nurse sharks, anywhere from a handful to two dozen, with yellowtail clouds around them.',
    highlights: ['Grey nurse sharks at the cave', 'Weedy seadragons', 'Giant cuttlefish', 'Yellowtail schools'],
    hazards: 'Hold ~5 m back from the cave; sharks are sometimes absent; short dive, usually paired with a second site.',
    entry: 'Boat only, anchor along the wall in 8–20 m.'
  },

  {
    id: 'north-bondi',
    mc: 313,
    name: 'North Bondi (Ben Buckler)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.892393, lng: 151.282273,   /* Frog Dive entry pin */
    type: 'shore', depth: '5–18 m', level: 'Open Water',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.50, 0.70, 0.90, 0.90, 0.80, 0.10, 0.05, 0.20],
    swellTol: 0.9, baseVis: 9, runoff: 0.4,
    blurb: 'Boulder reef south of Ben Buckler Point with seadragons thick along the sand edge, four or five most dives, plus swim-throughs, blue devils and a wrasse parade.',
    highlights: ['Weedy seadragons aplenty', 'Eastern blue devils', 'Boulder swim-throughs', 'Serpent eels on the sand'],
    hazards: 'Open-coast rock platform, pick the entry to suit the sea; the rough boat ramp is the all-conditions exit. Long swim back from the 18 m mark.',
    entry: 'Stairs from the lower Ramsgate Ave car park: calm = south of the platform, slight = the break left of the stairs, bigger = the boat ramp.'
  },
  {
    id: 'the-colours',
    mc: 273,
    name: 'The Colours',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.849912, lng: 151.294137,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '22–30 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'east',
    exposure: [0.60, 0.65, 0.70, 0.70, 0.65, 0.10, 0.10, 0.25],
    swellTol: 1.1, baseVis: 12, runoff: 0.25,
    blurb: 'Walls below Macquarie Lighthouse carpeted in sponges, ascidians and sea squirts, the colours of the name, with 8 m drops and strange metre-deep holes in the 28 m reef.',
    highlights: ['Colour-carpeted walls', 'Sweep & puller clouds', 'Wobbegongs & gorgonias', 'Short run from the harbour'],
    hazards: 'Depth caps bottom time (~17–22 min no-deco), watch your computer.',
    entry: 'Boat, seaward off Macquarie Lighthouse, anchor the reef top.'
  },

  /* ---------- Botany Bay ---------- */
  {
    id: 'bare-island',
    mc: 252,
    name: 'Bare Island',
    area: 'sydney', region: 'Botany Bay',
    lat: -33.991073, lng: 151.231928,   /* Frog Dive entry pin */
    type: 'shore', depth: '3–19 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.10, 0.25, 0.65, 0.60, 0.40, 0.10, 0.05, 0.05],
    swellTol: 1.0, baseVis: 8, runoff: 0.65, waterBody: 'botany',
    blurb: 'The heritage fort at La Perouse with dives off every side, a macro paradise that stays diveable in almost any sea (the sheltered western side works even in heavy swell).',
    highlights: ['Red indianfish', 'Pygmy pipehorses (Dec–Feb)', 'Weedy seadragons', 'Sponge walls & anglerfish'],
    hazards: 'Boats and jet skis speed under the bridge, never ascend mid-channel, swim back shallow. Outgoing-tide current on the deep sections.',
    entry: 'Left side from the rock platform east of the bridge; right side across the bridge via the boat ramp or western point.'
  },
  {
    id: 'henry-head',
    mc: 286,
    name: 'Henry Head',
    area: 'sydney', region: 'Botany Bay',
    lat: -33.999217, lng: 151.237050,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '12–27 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.12, 0.30, 0.75, 0.70, 0.50, 0.10, 0.05, 0.05],
    swellTol: 1.05, baseVis: 9, runoff: 0.55, tidePref: 'incoming', waterBody: 'botany',
    blurb: 'Sponge gardens rated among Sydney’s best, along the northern side of the Botany Bay entrance, very protected when the nor’easter blows.',
    highlights: ['Sponge gardens', 'Weedy seadragons', 'Red indianfish', 'Blue devilfish overhangs'],
    hazards: 'Undiveable in big southerly seas; the deep edge nudges 27 m, watch bottom time.',
    entry: 'Boat, anchor in ~18 m off the point, or drift the incoming tide.'
  },
  {
    id: 'sutherland-point',
    name: 'Sutherland Point (Kurnell)',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.001599, lng: 151.221244,   /* OSM cape */
    type: 'shore', depth: '4–12 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.35, 0.40, 0.35, 0.20, 0.10, 0.05, 0.05, 0.10],
    swellTol: 1.0, baseVis: 8, runoff: 0.55, waterBody: 'botany',
    blurb: 'The most sheltered of the Kurnell shore dives, kelp, boulders and seadragons inside the point. (Not documented in McFadyen’s guides; details are local knowledge.)',
    highlights: ['Weedy seadragons', 'Blue gropers', 'Moray eels'],
    hazards: 'Boat traffic off the point; easiest around mid-to-high tide.',
    entry: 'Rock platform entry near the point.'
  },
  {
    id: 'the-monuments',
    mc: 311,
    name: 'The Monuments (Kurnell)',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.0008, lng: 151.2226,   /* Frog Dive entry pin */
    type: 'shore', depth: '10–14 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.40, 0.50, 0.35, 0.25, 0.12, 0.05, 0.05, 0.10],
    swellTol: 1.0, baseVis: 8, runoff: 0.55, tidePref: 'incoming', waterBody: 'botany',
    blurb: 'Sponge-covered wall and boulders out from the landing-place monuments in Kamay National Park, dive it out-and-back, or drift west on the incoming tide.',
    highlights: ['Weedy seadragons', 'Pygmy pipehorses', 'Painted anglerfish', 'Overhang caves with catfish schools'],
    hazards: 'The small-inlet entry gets tricky in swell; big N–E seas are the problem here.',
    entry: 'Across the grass from the Monuments car park to the inlet behind the rock point, near the whale sculpture.'
  },
  {
    id: 'the-steps',
    mc: 288,
    name: 'The Steps (Kurnell)',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.0027, lng: 151.2266,   /* Frog Dive entry pin */
    type: 'shore', depth: '3–15 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.45, 0.55, 0.55, 0.30, 0.15, 0.05, 0.05, 0.10],
    swellTol: 0.9, baseVis: 9, runoff: 0.55, tidePref: 'high', waterBody: 'botany',
    blurb: 'Sydney’s famous seadragon dive, stairs down the cliff onto sponge-garden boulders that stay diveable when a southerly closes the open coast. Best about an hour before high tide.',
    highlights: ['Weedy seadragons', 'Pygmy pipehorses', 'Anglerfish', 'Nudibranch-rich sponge boulders'],
    hazards: 'Entry/exit dangerous in swell, locals abort if the wave-buoy max tops ~0.8 m. Steep climb back up; no night dives (park gates lock).',
    entry: 'Stairway below the Inscription Point car park, boardwalk west to the rock platform, one small inlet is the safe spot.'
  },
  {
    id: 'the-leap',
    mc: 295,
    name: 'The Leap (Kurnell)',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.004654, lng: 151.229301,   /* McFadyen's GPX mark (WGS84) */
    type: 'shore', depth: '10–22 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.50, 0.60, 0.65, 0.40, 0.20, 0.05, 0.05, 0.10],
    swellTol: 0.9, baseVis: 9, runoff: 0.55, currentNote: true, tidePref: 'incoming', waterBody: 'botany',
    blurb: 'Leap off the rock platform onto a sponge-garden slope and a spectacular 16–22 m wall, then drift to exit at The Steps. Enter on the incoming tide, 90+ minutes before high.',
    highlights: ['Weedy seadragons', 'Pygmy pipehorses', '16–22 m wall & overhangs', 'Nudibranch-rich sponge gardens'],
    hazards: 'No shore return once you jump, swim clear fast or the swell throws you back. Experienced divers only; unsafe if the wave-buoy max tops ~0.8 m.',
    entry: 'Cliff track and stairs opposite the upper car park; one-way drift to The Steps.'
  },

  {
    id: 'larpa',
    mc: 294,
    name: 'Larpa (Astrolabe Cove)',
    area: 'sydney', region: 'Botany Bay',
    lat: -33.9895, lng: 151.2300, approx: true,
    type: 'shore', depth: '4–14 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.10, 0.15, 0.35, 0.30, 0.20, 0.05, 0.05, 0.05],
    swellTol: 1.0, baseVis: 7, runoff: 0.7, tidePref: 'incoming', waterBody: 'botany',
    blurb: 'One-way drift along the western side of La Perouse point toward Frenchmans Bay, seadragons from the first minutes, and much of Bare Island’s macro cast without the crowds.',
    highlights: ['Weedy seadragons from the start', 'Pineapplefish & big cuttlefish', 'Pygmy pipehorses', 'Red indianfish & seahorses'],
    hazards: 'Vis can be poor; one-way route needs navigation care; blue-ringed octopus about.',
    entry: 'Rock platform west of the Bare Island bridge; exit at the old slipway toward Frenchmans Bay.'
  },

  /* ---------- Cronulla & Port Hacking ---------- */
  {
    id: 'oak-park',
    mc: 314,
    name: 'Oak Park (Cronulla)',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.0705, lng: 151.1579,   /* Frog Dive entry pin */
    type: 'shore', depth: '3–10 m', level: 'Open Water',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.50, 0.55, 0.75, 0.65, 0.45, 0.10, 0.05, 0.10],
    swellTol: 1.0, baseVis: 8, runoff: 0.6, tidePref: 'incoming', waterBody: 'hacking',
    blurb: 'Ledges, overhangs and famously friendly blue gropers off the Oak Park ocean pool, the Shire’s dependable easy dive, dotted with oddball landmarks like the underwater urinal and Meditation Cave.',
    highlights: ['Very friendly blue gropers', 'Blue devilfish overhangs', 'Meditation Cave & oddities', 'Top night dive'],
    hazards: 'East or north swell kills the entry; waves sweep the platform near high tide; give it a miss after heavy rain.',
    entry: 'End of Jibbon Street, the inlet behind the pool’s NE corner (or the pool’s south side at high tide).'
  },
  {
    id: 'shiprock',
    mc: 327,
    name: 'Shiprock (Port Hacking)',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.0691, lng: 151.1300,   /* Shiprock Aquatic Reserve centroid (OSM) */
    type: 'shore', depth: '3–18 m', level: 'Open Water',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
    swellTol: 1.0, baseVis: 6, runoff: 1.0, tideCritical: true, waterBody: 'hacking',
    blurb: 'An aquatic-reserve wall in Port Hacking stacked with estuary life, enter at Fort Denison high-tide time (low-water slack works too, often with good vis).',
    highlights: ['Pineapplefish', 'Striated anglerfish', 'White’s seahorses', 'Nudibranchs & red indianfish'],
    hazards: 'Strong tidal current outside the slack window; constant powerboats overhead, never surface from the deep section.',
    entry: 'Stairway at the end of Shiprock Road, Dolans Bay; exit easiest at the pool.'
  },

  {
    id: 'windy-point',
    mc: 343,
    name: 'Windy Point (Cronulla)',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.0668, lng: 151.1587,   /* OSM cape */
    type: 'shore', depth: '3–12 m', level: 'Open Water',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.50, 0.60, 0.75, 0.65, 0.45, 0.10, 0.05, 0.10],
    swellTol: 0.9, baseVis: 8, runoff: 0.55, waterBody: 'hacking',
    blurb: 'Easy rock-platform dive just north of Oak Park with standout life: seadragons, fiddler, shovelnose and eagle rays, angelsharks and octopus everywhere. Fires when a westerly flattens the sea.',
    highlights: ['Weedy seadragons', 'Rays galore & angelsharks', 'Octopus & cuttlefish', 'Good night dive'],
    hazards: 'Exit gets difficult in nor’easters, check entry and exit before gearing up.',
    entry: 'Path off the street to the rock platform; ease in (too shallow to stride).'
  },
  {
    id: 'jibbon-bombora',
    mc: 290,
    name: 'Jibbon Bombora (Fish Reef)',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.081333, lng: 151.176033,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '12–22 m', level: 'Open Water',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.75, 0.80, 0.85, 0.85, 0.80, 0.10, 0.10, 0.35],
    swellTol: 0.75, baseVis: 10, runoff: 0.3,
    blurb: 'A bombora rising to 2 m just outside Port Hacking, blue devils, giant cuttlefish and very large wobbegongs under the overhangs. Flat seas only: waves break right over the peaks.',
    highlights: ['Eastern blue devils', 'Very large wobbegongs', 'Canyons & overhang walls', 'Giant cuttlefish'],
    hazards: 'Breaks over the 2 m peaks in any size sea, becomes dangerous quickly; boat only.',
    entry: 'Boat, line up the southern peak, anchor in 15–17 m.'
  },

  {
    id: 'minmi-trench',
    mc: 309,
    name: 'Minmi Trench',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.004370, lng: 151.246053,   /* McFadyen's WGS84 mark (GPX MINMIT) */
    type: 'boat', depth: '16–26 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.30, 0.45, 0.75, 0.70, 0.55, 0.10, 0.05, 0.10],
    swellTol: 1.05, baseVis: 11, runoff: 0.5, tidePref: 'incoming', waterBody: 'botany',
    blurb: 'A three-section trench, two metres wide, four deep, between the boulders and the wall near Cape Banks, with swim-throughs, blue devils, and SS Minmi coal still strewn across the sand.',
    highlights: ['The trench itself', 'Blue devilfish caves', 'Angelsharks & PJ sharks', 'SS Minmi wreck coal'],
    hazards: 'Private boats only (no charters run it); bay-entrance murk on the ebb, dive high or incoming tide.',
    entry: 'Boat past Henry Head toward Cape Banks; anchor where the sounder steps 25 → 20 → 16 m.'
  },
  {
    id: 'anchor-reef',
    mc: 249,
    name: 'Anchor Reef',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.009167, lng: 151.232138,   /* McFadyen's WGS84 mark (GPX ANCHOR) */
    type: 'boat', depth: '18–23 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.50, 0.60, 0.70, 0.50, 0.30, 0.10, 0.05, 0.10],
    swellTol: 1.0, baseVis: 10, runoff: 0.5, tidePref: 'incoming', waterBody: 'botany',
    blurb: 'A wall of overhangs and cracks 600 m south of The Leap, named for all the fishing anchors snagged along it, seadragons on the sand line, blue devils and big cuttlefish under the ledges.',
    highlights: ['Snagged-anchor wall', 'Weedy seadragons', 'Blue devilfish', 'Boulder gullies west'],
    hazards: 'Private boats only; Botany Bay entrance turbidity on the wrong tide.',
    entry: 'Boat, run shoreward off the pillbox, anchor where 22 m rises to 18.'
  },
  {
    id: 'cape-banks',
    mc: 268,
    name: 'Cape Banks Caverns',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.001077, lng: 151.251263,   /* McFadyen's WGS84 mark (GPX CAPEBA) */
    type: 'boat', depth: '5–28 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.45, 0.60, 0.85, 0.80, 0.60, 0.10, 0.05, 0.10],
    swellTol: 0.95, baseVis: 10, runoff: 0.45, waterBody: 'botany',
    blurb: 'Gullies, holes and more than six proper caves and tunnels around the Cape Banks headland, winter Port Jackson packs twenty strong, and SS Minmi debris scattered through it. He rates it the equal of anything in Sydney.',
    highlights: ['Six-plus caves & tunnels', 'PJ shark packs (winter)', 'Blue devilfish', 'SS Minmi debris'],
    hazards: 'Fishing lines everywhere along the headland, entanglement risk; the inshore gullies need calm seas.',
    entry: 'Boat, run in 50 m south of the cape tip, anchor at 12–15 m.'
  },
  {
    id: 'voodoo',
    mc: 337,
    name: 'Voodoo (Kurnell)',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.049807, lng: 151.200317,   /* McFadyen's WGS84 mark (GPX "VOODOO") */
    type: 'boat', depth: '20–28 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.60, 0.65, 0.70, 0.70, 0.65, 0.10, 0.10, 0.25],
    swellTol: 1.1, baseVis: 15, runoff: 0.2,
    blurb: 'The densest, most varied gorgonia gardens in Sydney, on the drop-off east of Boat Harbour, vis usually better than 20 m, and almost nobody dives it.',
    highlights: ['Gorgonia fan capital', 'Sea whips & sea tulips', 'Blue devilfish', 'Angelsharks & fiddler rays'],
    hazards: 'Occasional westward bottom current; remote, dive with a live boat watcher.',
    entry: 'Boat, anchor on the mark off the Kurnell cliffs.'
  },
  {
    id: 'osborn-shoals',
    mc: 315,
    name: 'Osborn Shoals',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.058138, lng: 151.187818,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '12–24 m', level: 'Open Water',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.70, 0.75, 0.75, 0.70, 0.10, 0.10, 0.30],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'A shoal in the middle of Bate Bay with sharp drop-offs on three sides and a jewel-anemone-lined cave, dive it off the northern edge, or drift south along the reef.',
    highlights: ['Jewel-anemone cave', 'Friendly blue gropers', 'Weedy seadragons', 'Drop-offs & drift option'],
    hazards: 'Anchor holds poorly on the flat reef top; the 20 m+ edges warrant a safety stop.',
    entry: 'Boat, anchor where the sounder drops from 12 to 18 m.'
  },
  {
    id: 'middle-ground',
    mc: 308,
    name: 'Middle Ground',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.072450, lng: 151.190930,   /* McFadyen's GPX "MIDGND" mark */
    type: 'boat', depth: '28–33 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.70, 0.70, 0.70, 0.65, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 12, runoff: 0.3,
    blurb: 'An isolated 120 m reef off Port Hacking you can lap in ten minutes, up to a hundred Port Jackson sharks pile in during August, and seals crash more dives than not.',
    highlights: ['PJ shark aggregation (Aug)', 'Seals on most dives', 'Sea whips & anemones', 'Zig-zag wall & cave'],
    hazards: 'Deep, barely 17 min no-deco; anchor unreliable in W/N winds, keep a boat watcher.',
    entry: 'Boat from Port Hacking; anchor south of the wall in southerlies.'
  },

  {
    id: 'six-fathom-reef',
    mc: 328,
    name: 'Six Fathom Reef',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.070083, lng: 151.171430,   /* McFadyen's WGS84 mark (GPX SIXFTM) */
    type: 'boat', depth: '11–24 m', level: 'Open Water',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.55, 0.60, 0.60, 0.45, 0.35, 0.10, 0.10, 0.25],
    swellTol: 1.15, baseVis: 10, runoff: 0.3, waterBody: 'hacking',
    blurb: 'Port Hacking’s all-weather boat fallback: Jibbon Bombora shelters it from the southerly seas that close everything else, and the fish schools, pomfret, bullseyes, kingfish, are huge.',
    highlights: ['Huge fish schools', 'Western sponge gardens', 'Pineapplefish', 'Giant boarfish sightings'],
    hazards: 'Anchor is slow to bite on the reef; water dirties after prolonged heavy rain.',
    entry: 'Boat north of Jibbon Point; anchor where the wall drops 11 → 16 m.'
  },
  {
    id: 'pizza-reef',
    mc: 321,
    name: 'Pizza Reef (Fish Reef)',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.082583, lng: 151.179767,   /* McFadyen's WGS84 mark (GPX PIZZA) */
    type: 'boat', depth: '22–27 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.70, 0.75, 0.80, 0.80, 0.75, 0.10, 0.10, 0.30],
    swellTol: 1.05, baseVis: 13, runoff: 0.2,
    blurb: 'A figure-eight reef off Jibbon Bombora ringed by overhangs, exceptionally colourful gorgonians, a resident bastard trumpeter school at the cave, and humpback whale bones that bury and re-emerge from the sand.',
    highlights: ['Resident bastard trumpeters', 'Gorgonian colour', 'Humpback whale bones', 'Seal visits'],
    hazards: 'Small isolated reef, easy to miss without accurate GPS; ~22 min bottom time at depth.',
    entry: 'Boat off Jibbon Bombora’s SE corner; anchor side chosen by the wind.'
  },
  {
    id: 'the-wanderers',
    mc: 340,
    name: 'The Wanderers (Wanda Wide)',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.058697, lng: 151.210595,   /* McFadyen's WGS84 mark (GPX WANDER) */
    type: 'boat', depth: '34–46 m', level: 'Deep / Tech',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.25, baseVis: 15, runoff: 0.15,
    blurb: 'A vast low reef five kilometres off Wanda Beach, rediscovered from 1990s seabed charts, wandering anemones riding sea whips are the signature, over deep sponge gardens and a 39–43 m wall.',
    highlights: ['Wandering anemones on sea whips', 'Deep sponge gardens', '39–43 m wall', 'Usually 20–30 m vis'],
    hazards: 'Decompression territory, deep training required, stay above 40 m; flat reef holds anchors poorly.',
    entry: 'Boat ~60° from Port Hacking; confirm the anchor isn’t dragging before descending.'
  },

  /* ---------- Royal National Park (boat) ---------- */
  {
    id: 'the-split',
    mc: 330,
    name: 'The Split',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.089847, lng: 151.174042,   /* McFadyen's WGS84 mark (GPX SPLIT) */
    type: 'boat', depth: '22–28 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.70, 0.75, 0.80, 0.80, 0.75, 0.10, 0.10, 0.30],
    swellTol: 1.05, baseVis: 14, runoff: 0.25,
    blurb: 'A seventy-metre crack, four deep, two wide, with side cracks, swim-throughs and caves, part of the Barrens Hut complex he calls Sydney’s best reef boat diving. Vis of 15–20 m is normal; 35 m happens.',
    highlights: ['The 70 m crack', 'Blue devils & giant cuttlefish', 'Pygmy pipehorses', 'Winter PJ aggregations'],
    hazards: 'Square 26 m profile, watch bottom time, do the full safety stop; occasional current from the north.',
    entry: 'Boat around Jibbon (seas permitting); anchor on the reef edge.'
  },
  {
    id: 'the-balcony',
    mc: 250,
    name: 'The Balcony',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.098853, lng: 151.163458,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '5–22 m', level: 'Open Water',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.75, 0.80, 0.85, 0.85, 0.80, 0.10, 0.10, 0.30],
    swellTol: 0.75, baseVis: 13, runoff: 0.2,
    blurb: 'One of his favourite Sydney dives: an underwater balcony wall permanently packed with yellowtail, boulder swim-throughs and canyon shallows, but the best of it is under 10 m, so it needs a truly flat sea.',
    highlights: ['Yellowtail-packed “balcony” wall', 'Boulder swim-throughs', 'Weedy seadragons', 'Sheer shallow canyons'],
    hazards: 'Anchoring hard against the shore; surgy under 10 m unless dead calm.',
    entry: 'Boat, anchor close inshore on the mark, flat seas only.'
  },
  {
    id: 'barrens-hut',
    mc: 263,
    name: 'Barrens Hut',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.090362, lng: 151.174208,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '12–28 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.70, 0.75, 0.80, 0.80, 0.75, 0.10, 0.10, 0.30],
    swellTol: 0.95, baseVis: 13, runoff: 0.25,
    blurb: 'A drop-off smothered in invertebrate life with The Cave and The Tunnel (chimney exit at 19 m), he ranks it top-five in NSW, and vis has hit 30 m.',
    highlights: ['The Tunnel & chimney exit', 'Invertebrate-covered wall', 'Famously friendly gropers', 'Kingfish & yellowtail schools'],
    hazards: 'The Tunnel is dark, torch mandatory, and a wobbegong sometimes blocks it; poor anchor holding.',
    entry: 'Boat ~2 km from Port Hacking; anchor where the bottom jumps 28 → 16 m.'
  },
  {
    id: 'marley-point',
    mc: 306,
    name: 'Marley Point',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.115638, lng: 151.151152,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '5–22 m', level: 'Open Water',
    marineZone: 'royal', weatherZone: 'cronulla',
    exposure: [0.70, 0.75, 0.80, 0.80, 0.80, 0.10, 0.10, 0.30],
    swellTol: 0.85, baseVis: 13, runoff: 0.15,
    blurb: 'Pristine national-park boulder reef with a multi-exit cave network under a huge boulder, his logbook here includes grey nurse, seals, pilot whales and a right whale.',
    highlights: ['Multi-exit cave & swim-throughs', 'Huge fish schools', 'Weedy seadragons', 'Two resident friendly gropers'],
    hazards: 'Cannot anchor in southerlies (boat swings onto the shallows); long exposed run home.',
    entry: 'Boat 5.5 km from Port Hacking; anchor just inside the point, best in W/NW winds.'
  },
  {
    id: 'wattamolla-point',
    mc: 338,
    name: 'Wattamolla Point',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.139017, lng: 151.127253,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '18–27 m', level: 'Advanced',
    marineZone: 'royal', weatherZone: 'cronulla',
    exposure: [0.65, 0.70, 0.75, 0.75, 0.70, 0.10, 0.10, 0.30],
    swellTol: 1.1, baseVis: 13, runoff: 0.1,
    blurb: 'The whole reef off Wattamolla’s northern headland is blanketed in sponges, gorgonias and giant jelly ascidians, under clouds of silver sweep and juvenile nannygai.',
    highlights: ['Sponge & gorgonia blanket', 'Thousands of silver sweep', 'Bastard trumpeter schools', 'Chance of red indianfish'],
    hazards: 'Deco limits the full circuit (~35 min); a long settled-weather run down the coast.',
    entry: 'Boat 8.5 km from Port Hacking; anchor off the northern headland.'
  },

  /* ---------- Shipwrecks (positions from McFadyen's WGS84 marks) ---------- */
  {
    id: 'ss-duckenfield',
    mc: 61,
    name: 'SS Duckenfield (wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.718302, lng: 151.323795, wreck: true,
    type: 'boat', depth: '20–23 m', level: 'Open Water',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.60, 0.65, 0.65, 0.65, 0.60, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 12, runoff: 0.2,
    blurb: 'Iron collier that struck Long Reef and sank in 1889, broken up, but the upright two-cylinder engine and scattered copper ingots make a great single-tank wreck.',
    highlights: ['Upright steam engine', 'Boilers & donkey boiler', 'Copper ingots from the cargo', 'Bow anchors & chain'],
    hazards: 'Recreational depth but open ocean, pick a calm day.',
    entry: 'Charter boat, just north of Long Reef.'
  },
  {
    id: 'ss-annie-m-miller',
    mc: 50,
    name: 'SS Annie M Miller (wreck)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.866752, lng: 151.298922, wreck: true,
    type: 'boat', depth: '43–46 m', level: 'Deep / Tech',
    marineZone: 'heads', weatherZone: 'east',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 10, runoff: 0.3,
    blurb: 'Collier that foundered overloaded off South Head in 1929, now lying on her port side below Macquarie Lighthouse, moray central, with stray Bondi golf balls against the hull.',
    highlights: ['Intact boiler & steam engine', 'Dozens of moray eels', 'Wobbegongs & PJ sharks (autumn)', 'Closest deep wreck to the harbour'],
    hazards: '46 m, experienced deep divers only; vis often poorer than the wrecks further south.',
    entry: 'Charter boat from the harbour.'
  },
  {
    id: 'ss-undola',
    mc: 76,
    name: 'SS Undola (wreck)',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.179030, lng: 151.093887, wreck: true,
    type: 'boat', depth: '43–45 m', level: 'Deep / Tech',
    marineZone: 'royal', weatherZone: 'cronulla',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 15, runoff: 0.15,
    blurb: 'Sixty-miler collier lost with all eleven hands in a 1918 gale, 2.5 km off Garie Beach, home of the famous Shanks toilet, maker’s stamp still readable.',
    highlights: ['The Shanks toilet', 'Triple-expansion engine', 'Clouds of nannygai & bullseyes', 'Morays in the boiler pipework'],
    hazards: 'Deep dive; occasional northerly current; the anchor drags easily over the low wreck.',
    entry: 'Charter boat from Port Hacking.'
  },
  {
    id: 'ss-tuggerah',
    mc: 75,
    name: 'SS Tuggerah (wreck)',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.137225, lng: 151.151843, wreck: true,
    type: 'boat', depth: '45–49 m', level: 'Deep / Tech',
    marineZone: 'royal', weatherZone: 'cronulla',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 15, runoff: 0.15,
    blurb: 'Collier that capsized in a 1919 storm off Marley, McFadyen rates it Sydney’s premier dive: fish so thick they hide the wreck, and the engine-room tool rack still stocked.',
    highlights: ['Fish clouds hiding the wreck', 'Tool rack in the engine room', 'Boilers, prop & rudder', 'Seals & winter PJ gatherings'],
    hazards: 'Notoriously strong currents, dives get abandoned; ~49 m decompression territory.',
    entry: 'Charter boat from Port Hacking.'
  },
  {
    id: 'ss-myola',
    mc: 8,
    name: 'SS Myola (wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.761197, lng: 151.363363, wreck: true,
    type: 'boat', depth: '48–50 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 16, runoff: 0.1,
    blurb: 'Collier that rolled and sank in 1919, six kilometres off North Curl Curl, deep, far out, and rewarded with reliably clear water.',
    highlights: ['Shattered four-blade propeller', 'Two huge boilers & engine', 'Piled anchor chain at the bow', 'Reliable 15–20 m vis'],
    hazards: 'Nearly 50 m on rocky reef, deeper just east, well-equipped deep divers only.',
    entry: 'Charter boat; long run offshore.'
  },
  {
    id: 'ss-birchgrove-park',
    mc: 54,
    name: 'SS Birchgrove Park (wreck)',
    area: 'sydney', region: 'Pittwater & Broken Bay',
    lat: -33.638415, lng: 151.378642, wreck: true,
    type: 'boat', depth: '47–51 m', level: 'Deep / Tech',
    marineZone: 'broken', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 12, runoff: 0.35, waterBody: 'hawkesbury',
    blurb: 'Collier and wartime naval auxiliary that foundered in a 1956 gale with ten lives lost, the most intact true shipwreck in Sydney waters, 8 km off Barrenjoey.',
    highlights: ['Swim-through bridge on two levels', 'Prop & rudder at the stern', 'Congers & morays at the boiler', 'Largely intact hull'],
    hazards: '51 m; Hawkesbury outflow can wreck the vis after rain; current usually mild.',
    entry: 'Charter boat from Pittwater.'
  },
  {
    id: 'coolooli',
    mc: 58,
    name: 'Coolooli (dredge wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.718142, lng: 151.349197, wreck: true,
    type: 'boat', depth: '44–48 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 15, runoff: 0.2,
    blurb: 'Giant bucket dredge scuttled at the Long Reef wreck site in 1980, trace the dredge buckets along the cutter arm through jewel-anemone-coated rigging.',
    highlights: ['Dredge buckets & cutter arm', 'Funnel swim-throughs', 'Pink & blue jewel anemones', 'Occasional huge jewfish'],
    hazards: '48 m; the anchor can wedge deep in hatches; largely collapsed since 2009.',
    entry: 'Charter boat; anchor descent.'
  },
  {
    id: 'mv-malabar',
    mc: 68,
    name: 'MV Malabar (wreck)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.968697, lng: 151.263092, wreck: true,
    type: 'shore', depth: '4–10 m', level: 'Open Water',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.45, 0.60, 0.85, 0.85, 0.70, 0.10, 0.05, 0.10],
    swellTol: 0.85, baseVis: 8, runoff: 0.5,
    blurb: 'The Burns Philp liner that ran aground in fog in 1931, and renamed Long Bay’s suburb. A scattered, shallow starter wreck with a swimmable eight-cylinder diesel.',
    highlights: ['Eight-cylinder diesel engine', 'Driveshafts & propeller', 'Anchor-chain mound', 'Luderick & bream schools'],
    hazards: 'Fully exposed to swell; kelp hides the wreckage; a long rock-platform walk if shore diving.',
    entry: 'Northern side of Long Bay, shore via the rock platform, or boat.'
  },
  {
    id: 'valiant',
    mc: 77,
    name: 'Valiant (tug wreck)',
    area: 'sydney', region: 'Pittwater & Broken Bay',
    lat: -33.578413, lng: 151.345587, wreck: true,
    type: 'boat', depth: '22–27 m', level: 'Advanced',
    marineZone: 'broken', weatherZone: 'manly',
    exposure: [0.60, 0.65, 0.70, 0.65, 0.60, 0.10, 0.10, 0.30],
    swellTol: 1.15, baseVis: 10, runoff: 0.4, waterBody: 'hawkesbury',
    blurb: 'A 1945 tug (later a Melbourne fireboat) that sank under tow in 1981, 1.4 km east of Barrenjoey, small, vividly overgrown and very photogenic.',
    highlights: ['Enterable engine room & bridge', 'Bow winch & wheelhouse', 'Thick invertebrate growth', 'Bullseyes & visiting kingfish'],
    hazards: 'Vis swings from excellent to terrible; light tidal current; keep an eye on bottom time.',
    entry: 'Charter boat from Pittwater.'
  },
  {
    id: 'centurion',
    mc: 56,
    name: 'Centurion (wreck)',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.817467, lng: 151.281050, wreck: true,   /* McFadyen's WGS84 mark */
    type: 'boat', depth: '15–18 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.08, 0.15, 0.30, 0.35, 0.20, 0.05, 0.05, 0.05],
    swellTol: 1.0, baseVis: 5, runoff: 0.7, waterBody: 'harbour',
    blurb: 'An 1864 Aberdeen clipper lost under tow off Quarantine Point in 1887, masts, anchor chain, coal and ballast piles inside the Heads, with surprisingly rich fishlife. A great first wreck or night dive.',
    highlights: ['Masts & anchor chain', 'Coal cargo & ballast piles', 'Rich fishlife', 'Sheltered night dive'],
    hazards: 'Vis is never great inside the harbour; small site, explored in ~15 minutes.',
    entry: 'Boat inside the Heads, off Quarantine Point.'
  },
  /* ===== Full-crawl additions, McFadyen complete-site crawl, 2026-07-05 ===== */
  {
    id: 'parsley-bay',
    mc: 318,
    name: 'Parsley Bay',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.8500, lng: 151.2773, approx: true,   /* McFadyen p318 (no GPS printed) */
    type: 'shore', depth: '2–12 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.05, 0.06, 0.10, 0.08, 0.05, 0.04, 0.04, 0.04],
    swellTol: 1.0, baseVis: 5, runoff: 0.85, waterBody: 'harbour',
    blurb: 'A silty, sheltered Vaucluse inlet on his all-weather fallback list, historically seahorse central (fewer lately), big morays around the old sunken crane, and glowing phosphorescence at night.',
    highlights: ['Seahorses (declining)', 'Large moray eels', 'Old sunken crane', 'Night phosphorescence'],
    hazards: 'Very silty, sloppy fins ruin the vis in seconds; watch boat traffic off the wharf.',
    entry: 'Off the Parsley Bay wharf; best as a calm night dive.'
  },
{
    id: 'big-saigon',
    mc: 265,
    name: 'Big Saigon',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.03519, lng: 151.227614,   /* McFadyen p265 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '17–32 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'kurnell',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.1, baseVis: 13, runoff: 0.3,
    blurb: 'Long north-south wall, small swim-throughs & arches and sponges & gorgonias. Calm seas.',
    highlights: ['Long north-south wall', 'Small swim-throughs & arches', 'Sponges & gorgonias', 'Huge scattered boulders'],
    hazards: 'Remote offshore dive; 32 m in places',
    entry: 'Boat, anchor on the reef top north of Cape Baily Lighthouse.'
  },
  {
    id: 'blue-devil-reef',
    mc: 732,
    name: 'Blue Devil Reef',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.074977, lng: 151.178028,   /* McFadyen p732 (WGS84) */
    type: 'boat', depth: '17–25 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 13, runoff: 0.3,
    blurb: 'Blue devilfish overhangs, sponges & sea squirts and curving wall section. Calm seas.',
    highlights: ['Blue devilfish overhangs', 'Sponges & sea squirts', 'Curving wall section'],
    hazards: '25 m limits bottom time; still being explored',
    entry: 'Boat, anchor ~1 km east of Port Hacking.'
  },
  {
    id: 'bypass-reef',
    mc: 850,
    name: 'Bypass Reef',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.004617, lng: 151.253002,   /* McFadyen p850 (WGS84) */
    type: 'boat', depth: '20–33 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.55, 0.65, 0.80, 0.75, 0.60, 0.10, 0.05, 0.15],
    swellTol: 1.2, baseVis: 12, runoff: 0.35,
    blurb: 'Sheer wall & boulders, weedy seadragons and seasonal PJ sharks. Calm, clear days.',
    highlights: ['Sheer wall & boulders', 'Weedy seadragons', 'Seasonal PJ sharks', 'Swim-throughs & caves'],
    hazards: 'Deep, short no-deco window',
    entry: 'Boat, anchor off the Cape Banks headland.'
  },
  {
    id: 'cape-banks-bridge',
    mc: 269,
    name: 'Cape Banks Bridge',
    area: 'sydney', region: 'Botany Bay',
    lat: -33.999087, lng: 151.251793,   /* McFadyen p269 (WGS84) */
    type: 'boat', depth: '10–28 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.55, 0.65, 0.80, 0.75, 0.60, 0.10, 0.05, 0.15],
    swellTol: 1.05, baseVis: 11, runoff: 0.35,
    blurb: 'Big bullrays, blue devilfish and sponges & gorgonias. Calm seas.',
    highlights: ['Big bullrays', 'Blue devilfish', 'Sponges & gorgonias'],
    hazards: 'The rumoured shark cave doesn’t exist, don’t hunt for it',
    entry: 'Boat, anchor off the golfers’ footbridge near Cape Banks.'
  },
  {
    id: 'container-wall',
    mc: 274,
    name: 'Container Wall',
    area: 'sydney', region: 'Botany Bay',
    lat: -33.985363, lng: 151.212537,   /* McFadyen p274 (WGS84) */
    type: 'shore', depth: '3–12 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.06, 0.08, 0.14, 0.12, 0.08, 0.04, 0.04, 0.04],
    swellTol: 1.0, baseVis: 5, runoff: 0.7, waterBody: 'botany',
    blurb: 'Mulloway to 1.5 m, extensive caves & tunnels and crayfish & bream. Calm seas; small tank recommended.',
    highlights: ['Mulloway to 1.5 m', 'Extensive caves & tunnels', 'Crayfish & bream', 'Man-made wall habitat'],
    hazards: 'Overhead tunnels, torch essential; fishing-line entanglement; car break-ins at the car park',
    entry: 'Rock scramble from the Molineaux Point car park, or by boat.'
  },
  {
    id: 'the-cutting',
    mc: 276,
    name: 'The Cutting',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.098805, lng: 151.164083,   /* McFadyen p276 (WGS84) */
    type: 'boat', depth: '5–22 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Boulders with sea whips, seasonal PJ sharks and yellowtail & seapike clouds. Settled seas.',
    highlights: ['Boulders with sea whips', 'Seasonal PJ sharks', 'Yellowtail & seapike clouds', 'Resident large black ray'],
    hazards: 'Calm seas only; shallow sections feel any swell',
    entry: 'Boat, anchor off the crevice-notched bay south of Port Hacking.'
  },
  {
    id: 'desal-inlet',
    mc: 1093,
    name: 'Desalination Plant Inlet',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.02705, lng: 151.232453, approx: true,   /* McFadyen p1093 (WGS84) */
    type: 'boat', depth: '18–25 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.60, 0.65, 0.70, 0.70, 0.65, 0.10, 0.10, 0.25],
    swellTol: 1.05, baseVis: 12, runoff: 0.3,
    blurb: 'Four man-made intake structures, thousands of jewel anemones and resident wobbegong. Good vis days; nitrox helps.',
    highlights: ['Four man-made intake structures', 'Thousands of jewel anemones', 'Resident wobbegong'],
    hazards: 'Overhead structure; watch deco; no charter access',
    entry: 'Boat, anchor near Tabbagai Gap over the intake structures.'
  },
  {
    id: 'the-gap',
    mc: 281,
    name: 'The Gap (South Head)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.843968, lng: 151.286867,   /* McFadyen p281 (WGS84) */
    type: 'boat', depth: '10–23 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.50, 0.70, 0.85, 0.70, 0.45, 0.10, 0.05, 0.20],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Huge boulders & swim-throughs, small caves along the wall and kingfish schools. A good alternative in southerly swell.',
    highlights: ['Huge boulders & swim-throughs', 'Small caves along the wall', 'Kingfish schools', 'Sponges & gorgonias'],
    hazards: 'Boulder swim-throughs need care',
    entry: 'Boat, anchor below the cliffs south of the harbour entrance.'
  },
  {
    id: 'green-point',
    mc: 283,
    name: 'Green Point (Camp Cove)',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.8425, lng: 151.2803, approx: true,   /* McFadyen p283 (WGS84) */
    type: 'shore', depth: '3–19 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.08, 0.12, 0.25, 0.22, 0.12, 0.04, 0.04, 0.04],
    swellTol: 0.95, baseVis: 6, runoff: 0.7, waterBody: 'harbour',
    blurb: 'Overhangs & small caves, occasional seahorses and wWII submarine-net relics. Best in southerlies.',
    highlights: ['Overhangs & small caves', 'Occasional seahorses', 'WWII submarine-net relics', 'Excellent safe night dive'],
    hazards: 'Boat traffic overhead, never surface off the reef; vis drops after rain',
    entry: 'Shore entry from Camp Cove beach via the Pacific Street car park.'
  },
  {
    id: 'green-wheely-bin',
    mc: 604,
    name: 'Green Wheely Bin Reef',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.824872, lng: 151.299587,   /* McFadyen p604 (WGS84) */
    type: 'boat', depth: '11–28 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'manly',
    exposure: [0.60, 0.80, 0.90, 0.80, 0.50, 0.10, 0.05, 0.25],
    swellTol: 1.05, baseVis: 13, runoff: 0.3, tidePref: 'incoming',
    blurb: 'Old Admiralty anchor, leatherjacket schools 60+ and boulders, gullies & overhangs. Incoming tide near high water.',
    highlights: ['Old Admiralty anchor', 'Leatherjacket schools 60+', 'Boulders, gullies & overhangs'],
    hazards: 'Tide-driven current can be strong',
    entry: 'Boat, anchor off the far eastern end of North Head.'
  },
  {
    id: 'the-gullies',
    mc: 285,
    name: 'The Gullies',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.092884, lng: 151.168948,   /* McFadyen p285 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '5–22 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Gully & swim-through maze, mass PJ sharks Aug–Sep and the Marble cave. Anchor 18–22 m when any swell runs.',
    highlights: ['Gully & swim-through maze', 'Mass PJ sharks Aug–Sep', 'The Marble cave', 'Seadragons & nudibranchs'],
    hazards: 'Shallow entry breaks in swell; some overhead sections',
    entry: 'Boat, anchor south of Barrens Hut; go deep-side in swell.'
  },
  {
    id: 'hungry-jacks',
    mc: 525,
    name: 'Hungry Jacks',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.080533, lng: 151.18129,   /* McFadyen p525 (WGS84) */
    type: 'boat', depth: '20–27 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 13, runoff: 0.3,
    blurb: 'Big sponges & gorgonias, admiralty-type anchor and seapike & yellowtail schools. Anchorable in most winds except NE.',
    highlights: ['Big sponges & gorgonias', 'Admiralty-type anchor', 'Seapike & yellowtail schools'],
    hazards: 'Exposed in nor’easters; 27 m on the sand',
    entry: 'Boat, anchor on the reef top south of Jibbon Bombora.'
  },
  {
    id: 'indian-point',
    mc: 287,
    name: 'Indian Point',
    area: 'sydney', region: 'Botany Bay',
    lat: -33.993717, lng: 151.235627,   /* McFadyen p287 (WGS84) */
    type: 'boat', depth: '6.5–15 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.35, 0.50, 0.70, 0.65, 0.50, 0.10, 0.05, 0.10],
    swellTol: 0.85, baseVis: 10, runoff: 0.5, waterBody: 'botany',
    blurb: 'Red indianfish sightings, weedy seadragons and gutters & cracks. Calm conditions for the swim.',
    highlights: ['Red indianfish sightings', 'Weedy seadragons', 'Gutters & cracks', 'Historic bottles & anchors'],
    hazards: 'Shore route suits only fit, air-efficient divers',
    entry: 'Boat is easiest; the shore swim from Congwong Beach is long.'
  },
  {
    id: 'jd-reef-north',
    mc: 978,
    name: 'JD Reef (North)',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.094317, lng: 151.177617,   /* McFadyen p978 (WGS84) */
    type: 'boat', depth: '28–31 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Concrete pyramid modules, jewel anemones and boarfish & blind sharks. Weekdays, decent vis.',
    highlights: ['Concrete pyramid modules', 'Jewel anemones', 'Boarfish & blind sharks', 'Swim inside the hollows'],
    hazards: 'Deep sand bottom; fishers occupy it, avoid weekends',
    entry: 'Boat, anchor on the sand and swim the scattered pyramid modules.'
  },
  {
    id: 'jolong',
    mc: 557,
    name: 'Jolong',
    area: 'sydney', region: 'Botany Bay',
    lat: -33.996468, lng: 151.254068,   /* McFadyen p557 (WGS84) */
    type: 'boat', depth: '20–30 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.55, 0.65, 0.80, 0.75, 0.60, 0.10, 0.05, 0.15],
    swellTol: 1.2, baseVis: 11, runoff: 0.35,
    blurb: 'Weedy seadragons in the kelp, cuttlefish overhangs and one-spot puller schools. Low current and swell.',
    highlights: ['Weedy seadragons in the kelp', 'Cuttlefish overhangs', 'One-spot puller schools'],
    hazards: 'Current more common here than nearby sites; ~25 min at depth',
    entry: 'Boat, anchor the north–south wall north of Cape Banks.'
  },
  {
    id: 'kfc',
    mc: 291,
    name: 'KFC',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.082412, lng: 151.179614,   /* McFadyen p291 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '20–24 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Colourful sponge gardens, gorgonias in the gaps and trumpeters & boarfish. Calm seas.',
    highlights: ['Colourful sponge gardens', 'Gorgonias in the gaps', 'Trumpeters & boarfish'],
    hazards: 'Small reef, easy to miss',
    entry: 'Boat, small reef NW of Pizza Reef.'
  },
  {
    id: 'lilli-pilli',
    mc: 296,
    name: 'Lilli Pilli',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.069547, lng: 151.111076,   /* Lilli Pilli Baths (OSM swimming_pool feature) */   /* McFadyen p296 (WGS84) */
    type: 'shore', depth: '2–20 m', level: 'Open Water',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04],
    swellTol: 1.0, baseVis: 5, runoff: 0.95, tidePref: 'high', waterBody: 'hacking',
    blurb: 'White’s seahorses (declined), the mystery diver statue and old bottle & china dump. Often better near high tide.',
    highlights: ['White’s seahorses (declined)', 'The mystery diver statue', 'Old bottle & china dump', 'Turtle sightings logged'],
    hazards: 'Fishing line near the wharf; slippery ramp; silty',
    entry: 'Shore entry off the Sea Scouts ramp at the end of Lilli Pilli Road.'
  },
  {
    id: 'little-bay',
    mc: 297,
    name: 'Little Bay',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.9787, lng: 151.2535, approx: true,   /* McFadyen p297 (WGS84) */
    type: 'shore', depth: '3.5–13 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 0.85, baseVis: 9, runoff: 0.3,
    blurb: 'Swim-throughs & overhangs, small canyons and luderick & blackfish. Calm, flat seas.',
    highlights: ['Swim-throughs & overhangs', 'Small canyons', 'Luderick & blackfish', 'Golf balls everywhere'],
    hazards: 'Needs fairly flat seas at the bay mouth',
    entry: 'Stairs behind the old hospital chapel; swim out through the bay mouth.'
  },
  {
    id: 'little-bay-4th-hole',
    mc: 298,
    name: 'Little Bay – 4th Hole',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.9822, lng: 151.2540, approx: true,   /* McFadyen p298 (WGS84) */
    type: 'shore', depth: '0.5–12 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 0.75, baseVis: 9, runoff: 0.3,
    blurb: 'Caves & swim-throughs, wobbegongs & PJ sharks and a surging tunnel. Slight seas, no breaking waves at the entry.',
    highlights: ['Caves & swim-throughs', 'Wobbegongs & PJ sharks', 'A surging tunnel'],
    hazards: 'Strong tidal outflow at high tide; tunnel surges, slight seas only',
    entry: 'Small inlet south of Little Bay, reached across the golf fairway.'
  },
  {
    id: 'little-saigon',
    mc: 299,
    name: 'Little Saigon',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.036472, lng: 151.227537,   /* McFadyen p299 (WGS84) */
    type: 'boat', depth: '17–32 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'kurnell',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.1, baseVis: 13, runoff: 0.3,
    blurb: 'Long north–south wall, sponge & gorgonia gardens and wall swim-throughs. Calm open-coast days.',
    highlights: ['Long north–south wall', 'Sponge & gorgonia gardens', 'Wall swim-throughs'],
    hazards: 'Boulder sections drop past 30 m',
    entry: 'Boat, anchor the reef top near Cape Baily Light, NE of the Hilda.'
  },
  {
    id: 'long-bay',
    mc: 300,
    name: 'Long Bay (Malabar)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.96453, lng: 151.252302,   /* McFadyen p300 (WGS84) */
    type: 'shore', depth: '2–10 m', level: 'Open Water',
    marineZone: 'botany', weatherZone: 'east',
    exposure: [0.30, 0.45, 0.70, 0.65, 0.50, 0.05, 0.05, 0.10],
    swellTol: 0.9, baseVis: 8, runoff: 0.45,
    blurb: 'Overhangs full of blackfish, weedy seadragons and pJ sharks. Diveable in all but the biggest E–S swell.',
    highlights: ['Overhangs full of blackfish', 'Weedy seadragons', 'PJ sharks', 'Occasional big crayfish'],
    hazards: 'Slippery rocks at low tide; unsafe in big E/S swell',
    entry: 'Enter from the Malabar ocean pool below the golf clubhouse.'
  },
  {
    id: 'maccas-reef',
    mc: 301,
    name: 'Maccas Reef',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.081575, lng: 151.180473,   /* McFadyen p301 (WGS84) */
    type: 'boat', depth: '21–27 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 13, runoff: 0.3,
    blurb: 'Prominent wall & big schools, pJ sharks & cuttlefish and seadragons on the sand. Light wind and swell.',
    highlights: ['Prominent wall & big schools', 'PJ sharks & cuttlefish', 'Seadragons on the sand', 'Occasional seals'],
    hazards: 'Wind and swell push boats off this small reef',
    entry: 'Boat, anchor the prominent wall NE of Pizza Reef.'
  },
  {
    id: 'mahon-pool',
    mc: 303,
    name: 'Mahon Pool',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.94203, lng: 151.27018,   /* McFadyen p303 (WGS84) */
    type: 'shore', depth: '7–27 m', level: 'Advanced',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.70, 0.85, 1.00, 1.00, 0.90, 0.10, 0.05, 0.25],
    swellTol: 0.7, baseVis: 10, runoff: 0.3, tidePref: 'low',
    blurb: 'Canyon & gutter landform, multi-level ledges and sponge gardens & seadragons. Millpond seas, westerly winds, near low tide.',
    highlights: ['Canyon & gutter landform', 'Multi-level ledges', 'Sponge gardens & seadragons', 'Wrasse & morwong variety'],
    hazards: 'Extremely difficult exit, dead-calm seas near low tide only',
    entry: 'Enter beside the pool, snorkel to the buoy, drop into the canyon.'
  },
  {
    id: 'manly-gasworks',
    mc: 305,
    name: 'Manly Gasworks',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.8099, lng: 151.2872, approx: true,   /* off the Little Manly Point tip (OSM cape) */   /* McFadyen p305 (WGS84) */
    type: 'shore', depth: '4–7 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'manly',
    exposure: [0.08, 0.12, 0.25, 0.22, 0.12, 0.04, 0.04, 0.04],
    swellTol: 0.85, baseVis: 6, runoff: 0.7, waterBody: 'harbour',
    blurb: 'Gasworks-era relics, historic coal & bottles and small octopus & rays. Calm days; treat as a novelty dive.',
    highlights: ['Gasworks-era relics', 'Historic coal & bottles', 'Small octopus & rays'],
    hazards: 'Vis often poor to near-zero; silty, debris-strewn bottom',
    entry: 'Giant-stride off the rocks near Stuart Street, Little Manly Point.'
  },
  {
    id: 'marys-reef',
    mc: 913,
    name: 'Marys Reef',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.108177, lng: 151.156903,   /* McFadyen p913 (WGS84) */
    type: 'boat', depth: '14–24 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Sea tulips & gorgonias, pJ sharks Aug–Oct and blue devilfish overhangs. Anchor side by wind; decent vis.',
    highlights: ['Sea tulips & gorgonias', 'PJ sharks Aug–Oct', 'Blue devilfish overhangs', 'Large bullrays'],
    hazards: 'Private/club boats only; anchor rope can rub on rock',
    entry: 'Boat, anchor the reef top near Marley Point.'
  },
  {
    id: 'middle-ground-north',
    mc: 922,
    name: 'Middle Ground North',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.071683, lng: 151.1921,   /* McFadyen p922 (WGS84) */
    type: 'boat', depth: '28–32 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Tiger anemones on sea whips, gorgonia-covered walls and pineapplefish & blue devils. Calm and clear; 12 m+ vis reported.',
    highlights: ['Tiger anemones on sea whips', 'Gorgonia-covered walls', 'Pineapplefish & blue devils'],
    hazards: 'Small deep reef, easy to miss; boat-only, no charters',
    entry: 'Boat, anchor NE of the original Middle Ground mark.'
  },
  {
    id: 'mistral-point',
    mc: 310,
    name: 'Mistral Point',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.941295, lng: 151.26771,   /* McFadyen p310 (WGS84) */
    type: 'boat', depth: '10–23 m', level: 'Advanced',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.0, baseVis: 11, runoff: 0.3,
    blurb: 'Multi-tier wall system, up to nine seadragons a dive and blue devils & giant cuttlefish. Flexible by boat.',
    highlights: ['Multi-tier wall system', 'Up to nine seadragons a dive', 'Blue devils & giant cuttlefish', 'Kingfish & tropical wrasse'],
    hazards: 'Shore route is expert-only with a long swim, treat as a boat dive',
    entry: 'Boat, anchor at the 15 m mark north of Mahon Pool.'
  },
  {
    id: 'm-and-k-reef',
    mc: 703,
    name: 'M & K Reef',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.985337, lng: 151.257903,   /* McFadyen p703 (WGS84) */
    type: 'boat', depth: '22–30 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Boulder swim-through, sponges & gorgonias and blue devilfish caves. Clear sightline to the transits.',
    highlights: ['Boulder swim-through', 'Sponges & gorgonias', 'Blue devilfish caves', 'Seadragons in the kelp'],
    hazards: '~20 min bottom time; needs accurate marks or GPS',
    entry: 'Boat, anchor on the golf-clubhouse transits north of the bay entrance.'
  },
  {
    id: 'one-spot-reef',
    mc: 763,
    name: 'One Spot Reef',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.096193, lng: 151.166285,   /* McFadyen p763 (WGS84) */
    type: 'boat', depth: '14–21 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Thousands of one-spot pullers, sea dragons on sand edge and small caves and swim-throughs. Calm, flat seas only.',
    highlights: ['Thousands of one-spot pullers', 'Sea dragons on sand edge', 'Small caves and swim-throughs', 'Gorgonias and sea squirts'],
    hazards: 'Only diveable in calm seas; deco limits bottom time beyond about 50 minutes',
    entry: 'Boat dive south of Port Hacking, anchor on boulder reef near The Cutting North.'
  },
  {
    id: 'oporto',
    mc: 730,
    name: 'Oporto',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.077373, lng: 151.182267,   /* McFadyen p730 (WGS84) */
    type: 'boat', depth: '22–26 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 13, runoff: 0.3,
    blurb: 'Large low overhang, small tunnel between rocks and prolific fishlife, big kingfish. Calm seas near the bombora.',
    highlights: ['Large low overhang', 'Small tunnel between rocks', 'Prolific fishlife, big kingfish'],
    hazards: 'Adjacent to dangerous, often-breaking bombora; avoid the reef itself',
    entry: 'Boat dive on north edge of Jibbon Bombora.'
  },

  {
    id: 'pink-floyd',
    mc: 1094,
    name: 'Pink Floyd',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.001343, lng: 151.240102,   /* McFadyen p1094 (WGS84) */
    type: 'boat', depth: '17–26 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.35, 0.50, 0.70, 0.65, 0.50, 0.10, 0.05, 0.10],
    swellTol: 1.05, baseVis: 10, runoff: 0.5, waterBody: 'botany',
    blurb: 'Pink sea tulips and fans, gorgonias and sponges and pygmy pipehorses, sawtooth pipefish. Incoming or high tide.',
    highlights: ['Pink sea tulips and fans', 'Gorgonias and sponges', 'Pygmy pipehorses, sawtooth pipefish'],
    hazards: 'Bay-entrance site; vis can be poor, tidal flow can be strong',
    entry: 'Boat dive on wall near Botany Bay entrance, close to Henry Head.'
  },
  {
    id: 'the-pinnacles',
    mc: 319,
    name: 'The Pinnacles (Bangally Head)',
    area: 'sydney', region: 'Pittwater & Broken Bay',
    lat: -33.623973, lng: 151.343917,   /* McFadyen p319 (WGS84) */
    type: 'boat', depth: '5–18 m', level: 'Advanced',
    marineZone: 'broken', weatherZone: 'manly',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 0.85, baseVis: 11, runoff: 0.3,
    blurb: 'Huge boulder pinnacles, swim-throughs, small caves and wobbegongs. Millpond flat.',
    highlights: ['Huge boulder pinnacles', 'Swim-throughs, small caves', 'Wobbegongs', 'Sea dragons, big schools'],
    hazards: 'Needs flat seas; rising wind complicates the return trip',
    entry: 'Boat drift off Bangally Head, south of Whale Beach.'
  },
  {
    id: 'pistol-crack',
    mc: 320,
    name: 'Pistol Crack',
    area: 'sydney', region: 'Botany Bay',
    lat: -33.992457, lng: 151.25457,   /* McFadyen p320 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '15–27 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.35, 0.50, 0.70, 0.65, 0.50, 0.10, 0.05, 0.10],
    swellTol: 1.05, baseVis: 10, runoff: 0.5, waterBody: 'botany',
    blurb: 'Deep sponge-lined crack, tunnel under huge rock and pJ sharks seasonally. Calm seas.',
    highlights: ['Deep sponge-lined crack', 'Tunnel under huge rock', 'PJ sharks seasonally'],
    hazards: 'Crack reaches 27 m; good buoyancy and gas planning required',
    entry: 'Boat dive along a rock fissure north of Cape Banks.'
  },
  {
    id: 'red-flag',
    mc: 322,
    name: 'Red Flag',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.9627, lng: 151.265817,   /* McFadyen p322 (WGS84) */
    type: 'boat', depth: '7–23 m', level: 'Advanced',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Recovering sponge growth, tunnels and small caves and wobbegongs, PJ sharks. Calm seas.',
    highlights: ['Recovering sponge growth', 'Tunnels and small caves', 'Wobbegongs, PJ sharks'],
    hazards: 'Remote stretch; no charters service this coast',
    entry: 'Boat dive below the rifle-range cliffs north of Long Bay.'
  },
  {
    id: 'red-indian-point',
    mc: 521,
    name: 'Red Indian Point',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.81897, lng: 151.284758,   /* McFadyen p521 (WGS84) */
    type: 'boat', depth: '12–23 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'manly',
    exposure: [0.08, 0.12, 0.25, 0.22, 0.12, 0.04, 0.04, 0.04],
    swellTol: 1.05, baseVis: 6, runoff: 0.7, waterBody: 'harbour',
    blurb: 'Red indianfish often seen, weedy seadragons and old Admiralty anchor. Good in strong NE sea breeze; night dive.',
    highlights: ['Red indianfish often seen', 'Weedy seadragons', 'Old Admiralty anchor', 'Gorgonias and sea tulips'],
    hazards: 'Snagged boat anchors and ropes litter the reef',
    entry: 'Boat dive inside North Head, named for its red indianfish.'
  },
  {
    id: 'red-rooster',
    mc: 323,
    name: 'Red Rooster',
    area: 'sydney', region: 'Cronulla & Port Hacking',
    lat: -34.07945, lng: 151.181117, approx: true,   /* McFadyen p323 (WGS84) */
    type: 'boat', depth: '22–27 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 13, runoff: 0.3,
    blurb: 'Admiralty anchor on wall, resident seal nearby and sponges and gorgonians. Calm seas near the bombora.',
    highlights: ['Admiralty anchor on wall', 'Resident seal nearby', 'Sponges and gorgonians'],
    hazards: '~25 m average depth; 26-29 min no-deco',
    entry: 'Boat dive on the east side of Jibbon Bombora.'
  },
  {
    id: 'south-maroubra',
    mc: 329,
    name: 'South Maroubra',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.9557, lng: 151.2597, approx: true,   /* McFadyen p329 (WGS84) */
    type: 'shore', depth: '6–15 m', level: 'Advanced',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.50, 0.65, 0.75, 0.50, 0.28, 0.05, 0.05, 0.15],
    swellTol: 0.9, baseVis: 9, runoff: 0.3,
    blurb: 'SS Tekapo & Belbowrie wreckage, 50+ fish species logged and rock-blackfish amphitheatre. Calm southerly swell, incoming tide.',
    highlights: ['SS Tekapo & Belbowrie wreckage', '50+ fish species logged', 'Rock-blackfish amphitheatre', 'Old bottles in the sand'],
    hazards: 'Rip near the rock pool; long walk in; swell restricts the exit',
    entry: 'Walk ~250 m along the rock platform to a small inlet, snorkel out, descend.'
  },
  {
    id: 'sow-and-pigs',
    mc: 558,
    name: 'Sow and Pigs Reef',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.836652, lng: 151.271027,   /* McFadyen p558 (WGS84) */
    type: 'boat', depth: '4–8 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.08, 0.12, 0.25, 0.22, 0.12, 0.04, 0.04, 0.04],
    swellTol: 0.95, baseVis: 6, runoff: 0.7, tidePref: 'incoming', waterBody: 'harbour',
    blurb: 'Overhangs & swim-throughs, old shipwreck debris and jewel anemones. Near high tide, incoming, for clearer water.',
    highlights: ['Overhangs & swim-throughs', 'Old shipwreck debris', 'Jewel anemones', 'Harbour landmark reef'],
    hazards: 'Awash at low tide; often ringed by anchored fishing boats',
    entry: 'Boat, anchor beside the reef edge, marked by four cardinal marks.'
  },
  {
    id: 'tabbagai-gap',
    mc: 331,
    name: 'Tabbagai Gap',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.024808, lng: 151.232537,   /* McFadyen p331 (WGS84) */
    type: 'boat', depth: '24–28 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.60, 0.65, 0.70, 0.70, 0.65, 0.10, 0.10, 0.25],
    swellTol: 1.05, baseVis: 12, runoff: 0.3,
    blurb: 'Deep north-south walls, overhangs with cuttlefish and pJ sharks. Settled seas.',
    highlights: ['Deep north-south walls', 'Overhangs with cuttlefish', 'PJ sharks', 'Pomfret schools'],
    hazards: 'Fully exposed offshore reef, rarely visited',
    entry: 'Boat, anchor where the reef rises from 28 to 24 m.'
  },
  {
    id: 'tumbledowns',
    mc: 333,
    name: 'Tumbledowns',
    area: 'sydney', region: 'Royal National Park',
    lat: -34.092482, lng: 151.169622,   /* McFadyen p333 (WGS84) */
    type: 'boat', depth: '7–24 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'cronulla',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Up to 50 PJ sharks, weedy seadragons & fiddler rays and small canyons & swim-throughs. Calm seas for the shallow gullies.',
    highlights: ['Up to 50 PJ sharks', 'Weedy seadragons & fiddler rays', 'Small canyons & swim-throughs', 'A sunfish once (2004)'],
    hazards: 'Boulder swim-throughs; occasional drift current on an exposed coast',
    entry: 'Anchor where the reef rises from 24 m; follow the boulder edge.'
  },
  {
    id: 'tupia-point',
    mc: 335,
    name: 'Tupia Point',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.977307, lng: 151.259202,   /* McFadyen p335 (WGS84) */
    type: 'boat', depth: '5–22 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Extensive swim-throughs & tunnels, possible MV Malabar boiler and pomfret & seapike clouds. Calm seas, winds away from S–E.',
    highlights: ['Extensive swim-throughs & tunnels', 'Possible MV Malabar boiler', 'Pomfret & seapike clouds', 'Large cuttlefish'],
    hazards: 'Hard to anchor in onshore winds; may become a drift',
    entry: 'Boat, anchor off the point; tricky in southerly or easterly winds.'
  },
  {
    id: 'tyre-reef',
    mc: 740,
    name: 'Tyre Reef (Rifle Range)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.964883, lng: 151.266653,   /* McFadyen p740 (WGS84) */
    type: 'boat', depth: '10–25 m', level: 'Advanced',
    marineZone: 'east', weatherZone: 'east',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 13, runoff: 0.3,
    blurb: 'Twin parallel walls, thousands of schooling pomfret and weedy seadragons in the kelp. Calm seas, good vis to see both walls.',
    highlights: ['Twin parallel walls', 'Thousands of schooling pomfret', 'Weedy seadragons in the kelp', 'Boulder overhangs'],
    hazards: 'Private boats only, no charters work this stretch',
    entry: 'Anchor ~18 m where the two parallel walls meet.'
  },
  {
    id: 'watsons-bay-pool',
    mc: 527,
    name: 'Watsons Bay Pool',
    area: 'sydney', region: 'Sydney Harbour',
    lat: -33.845076, lng: 151.281049,   /* McFadyen p527 (WGS84) */
    type: 'shore', depth: '2–6 m', level: 'Open Water',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.08, 0.12, 0.25, 0.22, 0.12, 0.04, 0.04, 0.04],
    swellTol: 0.95, baseVis: 6, runoff: 0.7, waterBody: 'harbour',
    blurb: 'White’s seahorses on the kelp, pygmy leatherjackets and nudibranchs & blue-ringed octopus. Night dive, or when the ocean is blown out.',
    highlights: ['White’s seahorses on the kelp', 'Pygmy leatherjackets', 'Nudibranchs & blue-ringed octopus', 'Junk-pile habitat'],
    hazards: 'Low vis from kelp and silt; submerged debris inside the net',
    entry: 'Walk to the netted baths by the yacht club; step in off the boardwalk.'
  },
  {
    id: 'whale-watching-platform',
    mc: 641,
    name: 'Whale Watching Platform',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.017557, lng: 151.233265,   /* McFadyen p641 (WGS84) */
    type: 'boat', depth: '12–23 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.45, 0.55, 0.75, 0.70, 0.55, 0.10, 0.05, 0.12],
    swellTol: 1.05, baseVis: 10, runoff: 0.5, tidePref: 'incoming', waterBody: 'botany',
    blurb: 'Large swim-through sea caves, sheer wall to 23 m and seadragons & eagle rays. Incoming tide avoids the Botany outflow.',
    highlights: ['Large swim-through sea caves', 'Sheer wall to 23 m', 'Seadragons & eagle rays', 'L-shaped wall crack'],
    hazards: 'Little no-deco left by 40 min; bay outflow can dirty the water',
    entry: 'Anchor off the Cape Solander whale platform; work the wall.'
  },
  {
    id: 'xanadu',
    mc: 344,
    name: 'Xanadu',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.048562, lng: 151.203085,   /* McFadyen p344 (WGS84) */
    type: 'boat', depth: '26–37 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'kurnell',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Wall to 37 m, sydney pygmy pipehorses and gorgonias & colourful sponges. Wind picks the anchoring side.',
    highlights: ['Wall to 37 m', 'Sydney pygmy pipehorses', 'Gorgonias & colourful sponges', 'Sea spiders recorded'],
    hazards: '15–18 min no-deco at depth, plan gas and time carefully',
    entry: 'Anchor the wall top in westerlies, the deep side in easterlies.'
  },
  {
    id: 'yellow-rock',
    mc: 345,
    name: 'Yellow Rock',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.967195, lng: 151.26697,   /* McFadyen p345 (WGS84) */
    type: 'boat', depth: '10–24 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'east',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 11, runoff: 0.3,
    blurb: 'Fish-filled swim-throughs, old car parts in a crack and resident seadragons. Avoid onshore N–E winds.',
    highlights: ['Fish-filled swim-throughs', 'Old car parts in a crack', 'Resident seadragons', 'Rock blackfish & luderick'],
    hazards: 'Notorious rock-fishing point nearby; anchorage needs calm seas',
    entry: 'Anchor ~50 m north of Yellow Rock in 17–20 m.'
  },
  {
    id: 'yena-wall',
    mc: 777,
    name: 'Yena Wall',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.017, lng: 151.233, approx: true,   /* McFadyen p777 (WGS84) */
    type: 'shore', depth: '5–18 m', level: 'Advanced',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.55, 0.65, 0.80, 0.75, 0.60, 0.10, 0.05, 0.15],
    swellTol: 0.7, baseVis: 9, runoff: 0.35,
    blurb: 'Whitish-pink rock wall, cave full of pomfret and pJ sharks common. Flat seas during westerlies.',
    highlights: ['Whitish-pink rock wall', 'Cave full of pomfret', 'PJ sharks common'],
    hazards: 'Skilled navigation needed; safe exit only in calm westerly spells',
    entry: 'Rock-hop entry at Yena Flat, dead-calm seas only.'
  },
  {
    id: 'apollo-barge',
    mc: 51,
    name: 'Apollo Barge (wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.726384, lng: 151.350837, wreck: true,   /* McFadyen p51 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '41–47 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Unpowered hopper barge, scuttled ~1980, Bow anchor winch, hopper hold doors and engine-room skylights.',
    highlights: ['Bow anchor winch', 'Hopper hold doors', 'Engine-room skylights'],
    hazards: 'Tech depth; silt inside the bow and hold spaces',
    entry: 'Charter boat; anchor descent at the Long Reef scuttling ground.'
  },
  {
    id: 'mv-bellubera',
    mc: 53,
    name: 'MV Bellubera (wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.711752, lng: 151.351143, wreck: true,   /* McFadyen p53 (WGS84) */
    type: 'boat', depth: '41–46 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Manly ferry, scuttled 1980, Intact enterable bow section, rudder & prop visible and nannygai & Sergeant Bakers.',
    highlights: ['Intact enterable bow section', 'Rudder & prop visible', 'Nannygai & Sergeant Bakers'],
    hazards: 'Deep penetration wreck; broken, twisted hull sections',
    entry: 'Charter boat to the Long Reef scuttling ground.'
  },
  {
    id: 'meggol',
    mc: 60,
    name: 'Meggol (wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.716218, lng: 151.347003, wreck: true,   /* McFadyen p60 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '43–49 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Ex-minesweeper/ferry hulk, scuttled 1976, Beside the Dee Why, collapsed cargo holds and deep fish haven.',
    highlights: ['Beside the Dee Why', 'Collapsed cargo holds', 'Deep fish haven'],
    hazards: 'Very deep and badly collapsed; serious deep experience required',
    entry: 'Charter boat; lies close beside the SS Dee Why.'
  },
  {
    id: 'ss-hilda',
    mc: 64,
    name: 'SS Hilda (wreck)',
    area: 'sydney', region: 'Botany Bay',
    lat: -34.037768, lng: 151.225443, wreck: true,   /* McFadyen p64 (WGS84) */
    type: 'boat', depth: '21–27 m', level: 'Advanced',
    marineZone: 'south', weatherZone: 'kurnell',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.05, baseVis: 13, runoff: 0.3,
    blurb: 'Steam collier, wrecked 1893, Engine & boiler remains, prop, rudder & anchors and 25+ min no-deco dive.',
    highlights: ['Engine & boiler remains', 'Prop, rudder & anchors', '25+ min no-deco dive'],
    hazards: 'Rough exposed coast; storms keep rearranging the wreckage',
    entry: 'Boat off the Cape Baily lighthouse cliffs.'
  },
  {
    id: 'ss-himma',
    mc: 65,
    name: 'SS Himma (wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.718693, lng: 151.351422, wreck: true,   /* McFadyen p65 (WGS84) */
    type: 'boat', depth: '47–52 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Steam tug, scuttled 1980, Engine & boiler rooms, bridge telegraph remnants and stern winch & prop.',
    highlights: ['Engine & boiler rooms', 'Bridge telegraph remnants', 'Stern winch & prop'],
    hazards: 'Beyond recreational limits; silty interior claimed two divers in 1991',
    entry: 'Charter boat; precise anchor drop.'
  },
  {
    id: 'ss-kelloe',
    mc: 67,
    name: 'SS Kelloe (wreck)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.984807, lng: 151.266423, wreck: true,   /* McFadyen p67 (WGS84) */
    type: 'boat', depth: '48–51 m', level: 'Deep / Tech',
    marineZone: 'botany', weatherZone: 'kurnell',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Iron steam collier, sank 1902, Large intact boiler, twin bow anchors and frequent megafauna visits.',
    highlights: ['Large intact boiler', 'Twin bow anchors', 'Frequent megafauna visits'],
    hazards: 'Mandatory deco; strong currents and variable vis',
    entry: 'Charter boat off Little Bay.'
  },
  {
    id: 'no-frills-barge',
    mc: 71,
    name: 'No Frills Barge (wreck)',
    area: 'sydney', region: 'Manly & Northern Beaches',
    lat: -33.720362, lng: 151.350312, wreck: true,   /* McFadyen p71 (WGS84) */
    type: 'boat', depth: '43–50 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Hopper barge, scuttled 1979, Penetrable central hold, lies on its side and rust-hole entry point.',
    highlights: ['Penetrable central hold', 'Lies on its side', 'Rust-hole entry point'],
    hazards: 'Snag hazards inside; the hold silts to zero visibility',
    entry: 'Charter boat to the Long Reef scuttling ground.'
  },
  {
    id: 'ss-royal-shepherd',
    mc: 72,
    name: 'SS Royal Shepherd (wreck)',
    area: 'sydney', region: 'Eastern Suburbs',
    lat: -33.835638, lng: 151.287812, wreck: true,   /* McFadyen p72 (WGS84) */
    type: 'boat', depth: '27–30 m', level: 'Advanced',
    marineZone: 'heads', weatherZone: 'harbour',
    exposure: [0.35, 0.50, 0.70, 0.60, 0.40, 0.10, 0.05, 0.10],
    swellTol: 1.2, baseVis: 8, runoff: 0.5, waterBody: 'harbour',
    blurb: 'Steam collier, sank 1890, Inverted compound engine, square boiler and propeller & flywheel.',
    highlights: ['Inverted compound engine', 'Square boiler', 'Propeller & flywheel'],
    hazards: 'Water dirties near the harbour entrance after heavy rain',
    entry: 'Short boat run from the harbour to just off South Head.'
  },
  {
    id: 'trio',
    mc: 74,
    name: 'Trio (barge wreck)',
    area: 'sydney', region: 'Pittwater & Broken Bay',
    lat: -33.682027, lng: 151.366142, wreck: true,   /* McFadyen p74 (WGS84) */
    type: 'boat', depth: '46–54 m', level: 'Deep / Tech',
    marineZone: 'north', weatherZone: 'manly',
    exposure: [0.55, 0.60, 0.60, 0.60, 0.55, 0.10, 0.10, 0.30],
    swellTol: 1.2, baseVis: 13, runoff: 0.3,
    blurb: 'Unidentified barge, found 1988, Ferro-cement yacht inside the hold, bridge with intact toilet and bow winch & bollards.',
    highlights: ['Ferro-cement yacht inside the hold', 'Bridge with intact toilet', 'Bow winch & bollards'],
    hazards: 'Deep and isolated; nearest help is a long way off',
    entry: 'Boat; isolated site needing a precise anchor drop.'
  },

  /* ---------- Byron Bay ---------- */
  {
    id: 'julian-rocks',
    mc: 699,
    name: 'Julian Rocks',
    area: 'byron', region: 'Julian Rocks',
    lat: -28.6108, lng: 153.6297,   /* OSM rock feature (Nguthungulli Julian Rocks); no printed GPS on his pages */
    type: 'boat', depth: '5–26 m', level: 'Open Water',
    marineZone: 'julian', weatherZone: 'byron',
    exposure: [0.75, 0.85, 0.85, 0.75, 0.60, 0.15, 0.05, 0.40],
    swellTol: 1.05, baseVis: 12, runoff: 0.5, waterBody: 'byron',
    blurb: 'Byron Bay’s marine-reserve rock group, one site with many moods: grey nurse sharks stack up in the Cod Hole gutters most of the year, wobbegongs carpet the reef, and turtles, eagle rays and the odd manta cruise through. Lee-side moorings (the Nursery, the Needles) keep it diveable in moderate southerlies.',
    highlights: ['Grey nurse sharks at the Cod Hole, near year-round', 'Wobbegongs by the dozen, including the dwarf species', 'Turtles, eagle rays, occasional manta', 'Encrusted Admiralty anchor photo stop'],
    hazards: 'Drift legs can pull past 20 m in current; dives are guided with a 45-minute cap. River flood plumes (Brunswick, Richmond, Tweed) can drop the vis to a few metres.',
    entry: 'Dive-shop inflatables launch through the shorebreak at The Pass, minutes from the rocks; private boats must trailer from Brunswick Heads and pick up a public mooring.'
  },
  {
    id: 'windarra-banks',
    name: 'Windarra Banks',
    area: 'byron', region: 'Brunswick Heads',
    lat: -28.435, lng: 153.671, approx: true,   /* ~16 km NE of the Brunswick Heads bar per Blue Bay Divers; twin bommies 500 m apart */
    type: 'boat', depth: '25–50 m', level: 'Deep / Tech',
    marineZone: 'julian', weatherZone: 'byron',
    exposure: [0.75, 0.85, 0.85, 0.78, 0.68, 0.18, 0.05, 0.35],
    swellTol: 1.25, baseVis: 15, runoff: 0.2,
    blurb: 'Twin bommies near the shelf edge 16 km off Brunswick Heads, an underwater Uluru with gullies and shelves where grey nurse share water with whalers, hammerheads and the odd tiger. Big-animal country. (Not in McFadyen’s guides; from Blue Bay Divers’ site guide.)',
    highlights: ['Grey nurse, whalers & hammerheads', 'Underwater-Uluru twin bommies', 'Shelf-edge pelagics', 'Expedition-grade atmosphere'],
    hazards: 'Deep, remote and current-swept: 25 m to 50-plus with the East Australian Current in charge; special-trip territory with experienced crews only.',
    entry: 'Charter from Brunswick Heads on calm days; live drop onto the bommies.'
  },

  /* ---------- Coffs & Solitary Islands ---------- */
  {
    id: 'anemone-bay-north-solitary',
    mc: 186,
    name: 'Anemone Bay (North Solitary)',
    area: 'solitary', region: 'North Solitary Island',
    lat: -29.923203, lng: 153.388026,   /* McFadyen p186 (WGS84, inner mooring) */
    type: 'boat', depth: '5–30 m', level: 'Advanced',
    marineZone: 'nsolitary', weatherZone: 'wooli',
    exposure: [0.70, 0.85, 0.80, 0.60, 0.45, 0.10, 0.05, 0.30],
    swellTol: 1.0, baseVis: 14, runoff: 0.2,
    blurb: 'The north end of North Solitary, wall to wall with anemones and clownfish, the densest cover in NSW: subtropical meets temperate, with turtles, eagle rays and its own shark gutters off the outer mooring.',
    highlights: ['Carpet anemones & anemonefish everywhere', 'Turtles and eagle rays', 'Subtropical fish on temperate reef', 'Outer-mooring shark gutters'],
    hazards: 'Open-ocean island 12 km out of Wooli; current and surge on the outer moorings. Charter access has thinned since the Mullaway shop closed.',
    entry: 'Charter (traditionally from Wooli), pick up the inner or outer bay mooring.'
  },
  {
    id: 'elbow-cave-north-solitary',
    mc: 181,
    name: 'Elbow Cave (North Solitary)',
    area: 'solitary', region: 'North Solitary Island',
    lat: -29.933, lng: 153.39, approx: true,   /* west side, southern section; no printed GPS */
    type: 'boat', depth: '5–13 m', level: 'Open Water',
    marineZone: 'nsolitary', weatherZone: 'wooli',
    exposure: [0.50, 0.55, 0.50, 0.40, 0.35, 0.10, 0.05, 0.25],
    swellTol: 1.0, baseVis: 13, runoff: 0.2,
    blurb: 'Easy west-side wander through an elbow-shaped cave and boulder gutters, with wreckage of an unidentified trawler (sunk about 1988) on the sand nearby.',
    highlights: ['Elbow-shaped cave swim', 'Trawler wreckage on the sand', 'Anemones & clownfish', 'Sheltered lee-side mooring'],
    hazards: 'Surge pushes through the cave in any swell; open-ocean island weather still applies.',
    entry: 'Charter mooring on the sheltered western side.'
  },
  {
    id: 'bubble-cave-north-solitary',
    mc: 184,
    name: 'Bubble Cave (North Solitary)',
    area: 'solitary', region: 'North Solitary Island',
    lat: -29.927, lng: 153.3895, approx: true,   /* west side, northern end; no printed GPS */
    type: 'boat', depth: '3–15 m', level: 'Open Water',
    marineZone: 'nsolitary', weatherZone: 'wooli',
    exposure: [0.50, 0.55, 0.50, 0.40, 0.35, 0.10, 0.05, 0.25],
    swellTol: 1.0, baseVis: 13, runoff: 0.2,
    blurb: 'Shallow west-side cave named for the exhaust bubbles that stream through its roof cracks, linked by boulder terrain toward Elbow Cave, a favourite second dive.',
    highlights: ['Bubble-streaming cave roof', 'Boulder gutters toward Elbow Cave', 'Clown and barrier anemonefish', 'Big shallow fish schools'],
    hazards: 'Surgy in the shallows; the cave is short but still an overhead.',
    entry: 'Charter mooring on the western lee; often drifted through to Elbow Cave.'
  },
  {
    id: 'boulders-north-solitary',
    mc: 182,
    name: 'The Boulders (North Solitary)',
    area: 'solitary', region: 'North Solitary Island',
    lat: -29.93, lng: 153.3945, approx: true,   /* east side near the mid-island channel; no printed GPS */
    type: 'boat', depth: '12–30 m', level: 'Advanced',
    marineZone: 'nsolitary', weatherZone: 'wooli',
    exposure: [0.65, 0.80, 0.90, 0.85, 0.70, 0.12, 0.05, 0.25],
    swellTol: 1.05, baseVis: 14, runoff: 0.2,
    blurb: 'House-sized boulders stacked down the island’s exposed eastern flank, with canyons between them, big fish traffic, and a drift on toward Bubble Cave when the current runs.',
    highlights: ['House-sized boulder stacks', 'Canyons and swim-betweens', 'Kingfish & jewfish traffic', 'Drift option to Bubble Cave'],
    hazards: 'The ocean side: cops swell and current; save it for settled days.',
    entry: 'Charter, anchored or live drop on the eastern side by the mid-island channel.'
  },
  {
    id: 'fish-soup-north-west-rock',
    mc: 187,
    name: 'Fish Soup (North West Rock)',
    area: 'solitary', region: 'North West Rock',
    lat: -29.91229, lng: 153.383008,   /* his GPX mark FISHSP (WGS84) */
    type: 'boat', depth: '8–16 m', level: 'Advanced',
    marineZone: 'nsolitary', weatherZone: 'wooli',
    exposure: [0.75, 0.85, 0.90, 0.85, 0.78, 0.15, 0.05, 0.30],
    swellTol: 0.95, baseVis: 14, runoff: 0.2,
    blurb: 'A kilometre off North Solitary’s tip, the name says it: the little rock (also called The Mouse) disappears inside bait balls, sweep and pelagics thick enough to lose your buddy in.',
    highlights: ['Fish so dense they block the view', 'Pelagics circling the rock', 'Anemone-covered ledges', 'Quick circuit, big payoff'],
    hazards: 'Fully exposed speck of rock; current picks up fast and there is no lee worth the name.',
    entry: 'Charter drop beside the rock, 1 km north-west of North Solitary.'
  },
  {
    id: 'wrights-reef-solitary',
    mc: 190,
    name: 'Wrights Reef',
    area: 'solitary', region: 'North Solitary Island',
    lat: -29.929, lng: 153.413, approx: true,   /* isolated reef ~2 km east of the island; no printed GPS */
    type: 'boat', depth: '15–30 m', level: 'Advanced',
    marineZone: 'nsolitary', weatherZone: 'wooli',
    exposure: [0.75, 0.85, 0.90, 0.85, 0.78, 0.15, 0.05, 0.30],
    swellTol: 1.1, baseVis: 14, runoff: 0.15,
    blurb: 'Isolated reef east of North Solitary: ridge lines and gutters holding grey nurse, bull rays and passing pelagics, well away from the island crowds.',
    highlights: ['Grey nurse in the gutters', 'Bull rays', 'Pelagic fly-bys', 'Rarely another boat in sight'],
    hazards: 'Isolated and current-prone; charter access is uncertain since the Mullaway operator closed.',
    entry: 'Charter drop about 2 km east of the island; anchor on the reef top.'
  },
  {
    id: 'pimpernel-rock',
    mc: 189,
    name: 'Pimpernel Rock',
    area: 'solitary', region: 'Sandon / Yuraygir coast',
    lat: -29.696218, lng: 153.398948,   /* McFadyen p189 (AGD66→WGS84 shifted) */
    type: 'boat', depth: '10–40 m', level: 'Deep / Tech',
    marineZone: 'nsolitary', weatherZone: 'wooli',
    exposure: [0.75, 0.85, 0.90, 0.85, 0.78, 0.15, 0.05, 0.30],
    swellTol: 1.15, baseVis: 15, runoff: 0.15,
    blurb: 'Remote sea mount off Sandon Point with a blowhole chimney through its crown, grey nurse stacked in the deep gutters and everything from mantas to marlin on the outside. His pick of the far-north deep sites.',
    highlights: ['Blowhole chimney through the rock', 'Grey nurse in the 30 m gutters', 'Mantas & big pelagics', 'Sponge-walled drop-offs'],
    hazards: 'His verdict: experienced divers only. Long exposed run, real current, and the best of it sits past 30 m.',
    entry: 'Long charter run north from Wooli; anchor or live drop on the pinnacle.'
  },
  {
    id: 'manta-arch-south-solitary',
    mc: 192,
    name: 'Manta Arch (South Solitary)',
    area: 'solitary', region: 'South Solitary Island',
    lat: -30.2045, lng: 153.2685, approx: true,   /* NE corner of the island; no printed GPS */
    type: 'boat', depth: '13–29 m', level: 'Advanced',
    marineZone: 'ssolitary', weatherZone: 'coffs',
    exposure: [0.70, 0.85, 0.85, 0.70, 0.50, 0.10, 0.05, 0.28],
    swellTol: 1.05, baseVis: 13, runoff: 0.2,
    blurb: 'The signature South Solitary dive: a stone archway at the island’s north-east corner where grey nurse hang in the surge shadow and mantas cruise through in season.',
    highlights: ['Grey nurse under the arch', 'Seasonal manta traffic', 'Gorgonia-lined walls', 'Big winter fish schools'],
    hazards: 'Current wraps the corner; the arch funnels surge in any size swell.',
    entry: 'Charter from Coffs Harbour (Jetty Dive), mooring off the north-east corner.'
  },
  {
    id: 'boulders-south-solitary',
    mc: 193,
    name: 'The Boulders (South Solitary)',
    area: 'solitary', region: 'South Solitary Island',
    lat: -30.205, lng: 153.265, approx: true,   /* north side, western end toward the gantry; no printed GPS */
    type: 'boat', depth: '6–23 m', level: 'Advanced',
    marineZone: 'ssolitary', weatherZone: 'coffs',
    exposure: [0.70, 0.85, 0.80, 0.60, 0.45, 0.10, 0.05, 0.28],
    swellTol: 1.0, baseVis: 13, runoff: 0.2,
    blurb: 'Boulder slopes off the lighthouse island’s north-west corner, running under the old supply gantry: anemone fields, Bernie the resident green turtle, and wobbegongs wall to wall.',
    highlights: ['Anemone & clownfish fields', 'Bernie the resident green turtle', 'Old lighthouse gantry ruins', 'Wobbegongs everywhere'],
    hazards: 'Open-ocean island; the north side is workable in southerlies but cops NE sea.',
    entry: 'Charter from Coffs Harbour, mooring on the island’s north side.'
  },
  {
    id: 'shark-gutters-south-solitary',
    mc: 195,
    name: 'Shark Gutters & Cleaner Station (South Solitary)',
    area: 'solitary', region: 'South Solitary Island',
    lat: -30.2032, lng: 153.2678, approx: true,   /* north side, east-central; no printed GPS; his page title mislabels the island */
    type: 'boat', depth: '10–23 m', level: 'Advanced',
    marineZone: 'ssolitary', weatherZone: 'coffs',
    exposure: [0.70, 0.85, 0.82, 0.62, 0.45, 0.10, 0.05, 0.28],
    swellTol: 1.0, baseVis: 13, runoff: 0.2,
    blurb: 'Grey nurse parked in parallel gutters with a cleaning station where the residents queue for wrasse service, mid-island on the northern flank.',
    highlights: ['Grey nurse queueing at the cleaner station', 'Parallel shark gutters', 'Eagle rays over the sand', 'Bernie the turtle drops by'],
    hazards: 'Hold position at the gutter edges and keep off the sharks’ line; surge and current with any north in the sea.',
    entry: 'Charter from Coffs Harbour, north-side mooring shared with The Boulders.'
  },
  {
    id: 'the-steps-north-solitary',
    name: 'The Steps (North Solitary)',
    area: 'solitary', region: 'North Solitary Island',
    lat: -29.9222, lng: 153.3885, approx: true,   /* drop-off ~100 m off the Anemone Bay moorings; Dive Quest guide, not in McFadyen */
    type: 'boat', depth: '5–24 m', level: 'Advanced',
    marineZone: 'nsolitary', weatherZone: 'wooli',
    exposure: [0.70, 0.85, 0.80, 0.60, 0.45, 0.10, 0.05, 0.30],
    swellTol: 1.0, baseVis: 14, runoff: 0.2,
    blurb: 'The stepped drop-off just out from Anemone Bay: grey nurse on patrol, big black coral trees and whip gardens on the deeper ledges. (Not in McFadyen’s guides; from Dive Quest’s site guide.)',
    highlights: ['Grey nurse on the drop-off', 'Established black coral trees', 'Eagle & bull rays', 'Sea-whip ledges'],
    hazards: 'Deeper and more current-prone than the bay moorings; charter access has thinned since the Mullaway shop closed.',
    entry: 'Boat, about 100 m seaward of the Anemone Bay moorings.'
  },
  {
    id: 'nw-solitary-island',
    name: 'North West Solitary Island',
    area: 'solitary', region: 'North West Solitary Island',
    lat: -30.0182, lng: 153.2692, approx: true,   /* western-side mooring string; OSM islet; Jetty Dive guide, not in McFadyen */
    type: 'boat', depth: '10–18 m', level: 'Open Water',
    marineZone: 'nsolitary', weatherZone: 'coffs',
    exposure: [0.60, 0.72, 0.65, 0.50, 0.40, 0.10, 0.05, 0.25],
    swellTol: 1.0, baseVis: 13, runoff: 0.2,
    blurb: 'The island McFadyen never wrote up: plate-coral gardens and fish-filled gutters along three western-side moorings, with mantas cruising through in the warm months. (From Jetty Dive’s site guide.)',
    highlights: ['Plate-coral gardens', 'Manta season Jan-Jun', 'Fishy gutters between ridges', 'Macro along the ridgelines'],
    hazards: 'Open-ocean island weather; moorings sit on the lee side but the swell decides the day.',
    entry: 'Charter from Coffs Harbour or Wooli to the western moorings.'
  },
  {
    id: 'split-solitary-island',
    name: 'Split Solitary Island',
    area: 'solitary', region: 'Split Solitary Island',
    lat: -30.2419, lng: 153.1804,   /* OSM island; south-flank moorings; Jetty Dive guide, not in McFadyen */
    type: 'boat', depth: '10–21 m', level: 'Open Water',
    marineZone: 'ssolitary', weatherZone: 'coffs',
    exposure: [0.65, 0.75, 0.80, 0.65, 0.50, 0.10, 0.05, 0.25],
    swellTol: 1.0, baseVis: 13, runoff: 0.25,
    blurb: 'The split-through islet twenty minutes out of Coffs, one site with many moorings: a plateau edge dropping to 18 m sand, Cod Rock’s bommie with its two-metre resident black cod, and plate coral thickening at Coral Corner. (From Jetty Dive’s site guides.)',
    highlights: ['Resident 2 m black cod at Cod Rock', 'Plate coral at Coral Corner', 'Plateau drop-off to the sand', 'Six-plus moorings to pick from'],
    hazards: 'Pick the mooring for the wind; the gutter side runs deeper (21 m) than the plateau.',
    entry: 'Charter from Coffs Harbour, about a 20 minute run; moorings around the island.'
  },
  {
    id: 'sw-solitary-island',
    name: 'South West Solitary Island (Groper Islet)',
    area: 'solitary', region: 'South West Solitary Island',
    lat: -30.258, lng: 153.1428, approx: true,   /* charted islet position, north-side public moorings; Jetty Dive guide, not in McFadyen */
    type: 'boat', depth: '10–18 m', level: 'Open Water',
    marineZone: 'ssolitary', weatherZone: 'coffs',
    exposure: [0.60, 0.70, 0.72, 0.55, 0.42, 0.10, 0.05, 0.22],
    swellTol: 1.0, baseVis: 12, runoff: 0.25,
    blurb: 'Groper Islet’s two north-side public moorings: gravel gutters and rocky nooks off the eastern one, gentle coral-covered ground drifting off the western. (From Jetty Dive’s site guide.)',
    highlights: ['Gravel gutters & rock nooks', 'Heavy coral cover on the west side', 'Gropers, of course', 'Closest island to the mainland'],
    hazards: 'Standard open-island exposure; nothing specific flagged.',
    entry: 'Charter from Coffs Harbour to the north-side public moorings.'
  },
  {
    id: 'buchanans-wall-south-solitary',
    name: 'Buchanans Wall (South Solitary)',
    area: 'solitary', region: 'South Solitary Island',
    lat: -30.2085, lng: 153.2665, approx: true,   /* southern tip of the island, wall faces SW; folds the adjacent Cable Trail mooring; Jetty Dive guides */
    type: 'boat', depth: '12–30 m', level: 'Advanced',
    marineZone: 'ssolitary', weatherZone: 'coffs',
    exposure: [0.55, 0.65, 0.75, 0.72, 0.65, 0.15, 0.05, 0.22],
    swellTol: 1.05, baseVis: 13, runoff: 0.2,
    blurb: 'The lighthouse island’s southern end: a south-west-facing wall from 15 to 30 m thick with soft coral, Spanish dancers and oversized anemones, with the Cable Trail mooring next door tracing old trawler cable across the rocks. (From Jetty Dive’s site guides; not in McFadyen.)',
    highlights: ['Wall 15-30 m in soft coral', 'Spanish dancers & nudibranchs', 'Cable Trail relics next door', 'Grey nurse fly-bys'],
    hazards: 'The exposed end of the island: cops swell from most directions and suits settled days.',
    entry: 'Charter from Coffs Harbour; moorings at the island’s southern tip.'
  },
  {
    id: 'muttonbird-island-coffs',
    name: 'Muttonbird Island (Coffs Harbour)',
    area: 'solitary', region: 'Coffs Harbour',
    lat: -30.3032, lng: 153.1512,   /* PADI listing pin at the island; entry off the breakwall walkway; Jetty Dive guide */
    type: 'shore', depth: '2–12 m', level: 'Open Water',
    marineZone: 'ssolitary', weatherZone: 'coffs',
    exposure: [0.40, 0.50, 0.55, 0.40, 0.25, 0.08, 0.05, 0.15],
    swellTol: 0.9, baseVis: 8, runoff: 0.4,
    blurb: 'Coffs Harbour’s own shore dive off the Muttonbird Island walkway: sand flats edged with rocky patches, gropers and green turtles, and the local training ground when the islands are off. (From Jetty Dive; not in McFadyen.)',
    highlights: ['Blue gropers & green turtles', 'Rock-patch macro life', 'Walkway access from the marina', 'The Coffs fallback dive'],
    hazards: 'Climb down a short rock wall to get in; harbour traffic nearby and it stirs up quickly in any sea.',
    entry: 'Walk the breakwall to Muttonbird Island; scramble in off the rock wall.'
  },

  /* ---------- South West Rocks ---------- */
  {
    id: 'fish-rock',
    mc: 197,
    name: 'Fish Rock',
    area: 'swr', region: 'Fish Rock',
    lat: -30.939233, lng: 153.100243,   /* his GPX mark FISHRK (WGS84) */
    type: 'boat', depth: '7–30 m', level: 'Advanced',
    marineZone: 'fishrock', weatherZone: 'swrocks',
    exposure: [0.75, 0.85, 0.90, 0.85, 0.80, 0.15, 0.05, 0.30],
    swellTol: 1.1, baseVis: 16, runoff: 0.25,
    blurb: 'The famous rock off Smoky Cape: a 120 m tunnel-cave right through the island (shallow end 10 m, deep end 25 m), shark gutters thick with grey nurse, resident turtles, and boulder grounds that can disappear inside fish schools.',
    highlights: ['120 m through-cave with air pockets', 'Grey nurse in the gutters year-round', 'Resident loggerhead & green turtles', 'Queensland groper on the deep routes'],
    hazards: 'A north-setting current runs on most trips and can shut diving down; the cave is a real overhead needing a torch; eastern routes push past 30 m.',
    entry: 'Charter from South West Rocks, an 8 km run; every operator ties into the same gutter on the southern flank.'
  },
  {
    id: 'pinnacle-swr',
    mc: 201,
    name: 'The Pinnacle (South West Rocks)',
    area: 'swr', region: 'Fish Rock',
    lat: -30.93757, lng: 153.100802,   /* McFadyen p201 (WGS84), matches GPX PINSWR */
    type: 'boat', depth: '6–35 m', level: 'Advanced',
    marineZone: 'fishrock', weatherZone: 'swrocks',
    exposure: [0.75, 0.85, 0.90, 0.85, 0.80, 0.15, 0.05, 0.30],
    swellTol: 1.1, baseVis: 16, runoff: 0.25,
    blurb: 'Twin-peaked bommie off Fish Rock’s north-east corner, 6 m on top and 30-plus at the sand: big female grey nurse in the southern gutter, an old Admiralty anchor at 20 m, and Queensland groper encounters he ranks with the best.',
    highlights: ['Big grey nurse females in the gutter', 'Old Admiralty anchor at 20 m', 'Queensland groper', 'Vis from 7 m to 40 m with the current'],
    hazards: 'Same current regime as Fish Rock; experienced divers only when any current runs. Bottom water can turn cold and murky mid-dive.',
    entry: 'Same charter run as Fish Rock; thread the old mooring, anchor against the wall, or arrange a drift pickup.'
  },

  {
    id: 'black-rock-swr',
    mc: 209,
    name: 'Black Rock (South West Rocks)',
    area: 'swr', region: 'Smoky Cape',
    lat: -30.95, lng: 153.083, approx: true,   /* twin rocks south of Fish Rock, closer inshore; no printed GPS */
    type: 'boat', depth: '3–20 m', level: 'Advanced',
    marineZone: 'fishrock', weatherZone: 'swrocks',
    exposure: [0.70, 0.80, 0.88, 0.82, 0.75, 0.15, 0.05, 0.28],
    swellTol: 0.95, baseVis: 14, runoff: 0.25,
    blurb: 'Twin-rock reef inshore of Fish Rock that he rates among the best diving anywhere on the coast: gutters and ledges packed with fish when conditions line up.',
    highlights: ['Dense fish life in the gutters', 'Ledges & swim-betweens', 'Quieter than Fish Rock', 'Good second-dive depth'],
    hazards: 'Shallow sections feel any swell; same north-setting current belt as Fish Rock.',
    entry: 'Same charter run as Fish Rock; anchor beside the rocks.'
  },
  {
    id: 'green-island-swr',
    mc: 210,
    name: 'Green Island (South West Rocks)',
    area: 'swr', region: 'Smoky Cape',
    lat: -30.908403, lng: 153.091634,   /* his GPX mark GREENI (WGS84) */
    type: 'boat', depth: '5–17 m', level: 'Advanced',
    marineZone: 'fishrock', weatherZone: 'swrocks',
    exposure: [0.70, 0.80, 0.88, 0.82, 0.72, 0.15, 0.05, 0.28],
    swellTol: 0.95, baseVis: 14, runoff: 0.3,
    blurb: 'Grey nurse aggregation site off Gap Beach, with counts up to 40 or 50 sharks in its gutters, plus turtles and eagle rays on the sand lines.',
    highlights: ['Grey nurse by the dozen', 'Turtles & eagle rays', 'Sand gutters at easy depth', 'Short run from South West Rocks'],
    hazards: 'Respect the aggregation: stay low, off their line, no flash. Exposed to sea and swell like the rest of this coast.',
    entry: 'Boat off Gap Beach, south of South West Rocks, anchoring clear of the gutters.'
  },
  {
    id: 'bait-reef-swr',
    mc: 211,
    name: 'Bait Reef (Trial Bay)',
    area: 'swr', region: 'Trial Bay',
    lat: -30.876, lng: 153.071, approx: true,   /* <100 m off Trial Bay Gaol; no printed GPS */
    type: 'shore', depth: '4–9 m', level: 'Open Water',
    marineZone: 'fishrock', weatherZone: 'swrocks',
    exposure: [0.55, 0.60, 0.50, 0.30, 0.20, 0.08, 0.05, 0.20],
    swellTol: 0.9, baseVis: 10, runoff: 0.5, waterBody: 'macleay',
    blurb: 'Small reef a swim off Trial Bay Gaol, the local backup when southerlies shut the open coast: easy depths, gropers and bream around the boulders.',
    highlights: ['Backup when southerlies blow', 'Easy 4-9 m boulders', 'Gropers & bream', 'Swim from the gaol beach'],
    hazards: 'NE wind and sea get straight in; after real rain the Macleay stains the whole bay.',
    entry: 'Shore entry from the beach below Trial Bay Gaol, short surface swim north-east.'
  },
  {
    id: 'ladies-reef-swr',
    mc: 643,
    name: 'Ladies Reef (South West Rocks)',
    area: 'swr', region: 'Trial Bay',
    lat: -30.8812, lng: 153.0438, approx: true,   /* off the town headland north of Main Beach; no printed GPS */
    type: 'shore', depth: '5–11 m', level: 'Advanced',
    marineZone: 'fishrock', weatherZone: 'swrocks',
    exposure: [0.60, 0.65, 0.55, 0.35, 0.25, 0.08, 0.05, 0.22],
    swellTol: 0.85, baseVis: 10, runoff: 0.5, waterBody: 'macleay',
    blurb: 'Headland shore dive past Stingray Rock (home to a resident bullray) out to a small reef with rich macro life, right off the South West Rocks township.',
    highlights: ['Resident bullray at Stingray Rock', 'Macro life on the reef', 'Town-beach convenience', 'Nudibranch hunting'],
    hazards: 'A swim to reach it, and the rock hop needs a small sea; murky after rain.',
    entry: 'Off the main headland north of Main Beach, South West Rocks.'
  },
  {
    id: 'macleay-river-drift',
    mc: 208,
    name: 'Macleay River Drift',
    area: 'swr', region: 'Trial Bay',
    lat: -30.8785, lng: 153.0355, approx: true,   /* river entrance training walls; no printed GPS */
    type: 'shore', depth: '9–15 m', level: 'Advanced',
    marineZone: 'fishrock', weatherZone: 'swrocks',
    exposure: [0.20, 0.25, 0.20, 0.12, 0.08, 0.05, 0.05, 0.08],
    swellTol: 1.0, baseVis: 6, runoff: 0.9, tidePref: 'high', waterBody: 'macleay',
    blurb: 'Tide-powered drift along the Macleay entrance wall, famous for mulloway schools stacked in the current shade. Strictly a tide-table dive.',
    highlights: ['Huge mulloway schools', 'Effortless drift', 'Bream & flathead on the sand', 'Different every tide'],
    hazards: 'Get in about twenty minutes before the Fort Denison high and ride the last push; the ebb is dirty, fast and takes you seaward. Boat traffic uses the channel.',
    entry: 'Enter off the training wall inside the river mouth and drift with the flood.'
  },
  {
    id: 'ps-agnes-irving',
    mc: 206,
    name: 'PS Agnes Irving (wreck)',
    area: 'swr', region: 'Trial Bay',
    lat: -30.806496, lng: 153.005059, wreck: true,   /* McFadyen p206 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '11–13 m', level: 'Open Water',
    marineZone: 'fishrock', weatherZone: 'swrocks',
    exposure: [0.55, 0.65, 0.72, 0.60, 0.45, 0.10, 0.05, 0.18],
    swellTol: 0.95, baseVis: 10, runoff: 0.5, waterBody: 'macleay',
    blurb: 'Iron paddle steamer lost crossing the Macleay bar in 1879, now five sections of hull, paddle frames and engine mounts off Stuarts Point in easy depth.',
    highlights: ['Paddle-wheel frames', 'Five hull sections to circuit', 'Schooling bream & tarwhine', 'Easy 13 m maximum'],
    hazards: 'Getting there means the river bar or a long beach run; the wreck itself is benign in calm seas.',
    entry: 'Boat north from the Macleay entrance toward Stuarts Point.'
  },
  /* ---------- Port Macquarie & Camden Haven ---------- */
  {
    id: 'titan-crane',
    mc: 212,
    name: 'Titan Crane (wreck)',
    area: 'portmac', region: 'Camden Haven',
    lat: -31.664301, lng: 152.87342, wreck: true,   /* McFadyen p212 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '30–40 m', level: 'Deep / Tech',
    marineZone: 'portmac', weatherZone: 'portmac',
    exposure: [0.60, 0.70, 0.82, 0.78, 0.68, 0.13, 0.05, 0.20],
    swellTol: 1.2, baseVis: 11, runoff: 0.2,
    blurb: 'The famous Sydney Harbour floating crane, capsized under tow in 1992 and scuttled off Camden Haven: a giant steel lattice and pontoon on the sand at 40 m.',
    highlights: ['Immense crane lattice', 'Pontoon hull to circuit', 'Big snapper & kingfish', 'A genuine piece of Sydney history'],
    hazards: 'Deep, offshore and unserviced: no local operator runs it, his account dates from the 1990s and the wreck has settled, so treat depth and state as unverified.',
    entry: 'Private boat out of Camden Haven (Laurieton); shot line advised.'
  },
  {
    id: 'cod-grounds',
    name: 'Cod Grounds',
    area: 'portmac', region: 'Camden Haven',
    lat: -31.68253, lng: 152.90945,   /* printed mark for the twin pinnacles; Commonwealth marine park (SCUBA Haven + Parks Australia + MLN) */
    type: 'boat', depth: '18–40 m', level: 'Deep / Tech',
    marineZone: 'portmac', weatherZone: 'portmac',
    exposure: [0.70, 0.78, 0.85, 0.80, 0.72, 0.15, 0.05, 0.25],
    swellTol: 1.2, baseVis: 13, runoff: 0.15,
    blurb: 'Twin pinnacles cresting at 18 m inside the Cod Grounds Commonwealth Marine Park, 5.5 km off the Camden Haven bar: grey nurse in every season with jewfish and kingfish schools rolling through. (Not in McFadyen’s guides; operator and Parks Australia documented.)',
    highlights: ['Grey nurse year-round', 'Twin 18 m pinnacles', 'Jewfish & kingfish schools', 'No-take reserve fish density'],
    hazards: 'Deep, current-prone and regulated: anchoring is restricted inside the reserve and charters work the mark live; check current park rules before a private trip.',
    entry: 'Boat from Camden Haven, about 5.5 km off the bar; live drop on the GPS mark.'
  },
  {
    id: 'telegraph-rock',
    name: 'Telegraph Rock (wreck)',
    area: 'portmac', region: 'Camden Haven',
    lat: -31.64197, lng: 152.8535, wreck: true,   /* NSW Maritime Heritage register mark (WGS84, site 347) */
    type: 'boat', depth: '3–17 m', level: 'Open Water',
    marineZone: 'portmac', weatherZone: 'portmac',
    exposure: [0.55, 0.65, 0.78, 0.72, 0.6, 0.12, 0.05, 0.15],
    swellTol: 0.9, baseVis: 9, runoff: 0.55,
    blurb: 'Reef around the rock off Camden Haven’s own Point Perpendicular, strewn with the Telegraph wreck: flywheel pieces, hull ribs and ground tackle over the sand, sponge colour on the deeper ledges.',
    highlights: ['Scattered steamer wreckage', 'Sponge-draped deeper reef', 'Heritage-register site', 'Short run from the bar'],
    hazards: 'Shallow and a little exposed; the river browns it out after rain.',
    entry: 'Boat from Camden Haven onto the reef around the rock.'
  },
  {
    id: 'prince-of-wales-pilot-beach',
    name: 'PS Prince of Wales (Pilot Beach)',
    area: 'portmac', region: 'Camden Haven',
    lat: -31.6387, lng: 152.8367, wreck: true, approx: true,   /* hull remains off Pilot Beach between the breakwalls; MLN guide */
    type: 'shore', depth: '2–3 m', level: 'Open Water',
    marineZone: 'portmac', weatherZone: 'portmac',
    exposure: [0.20, 0.28, 0.40, 0.35, 0.25, 0.08, 0.05, 0.08],
    swellTol: 0.8, baseVis: 7, runoff: 0.55,
    blurb: 'Paddle-steamer bones in waist-to-shoulder water off Pilot Beach: stern framing and boiler pieces still poking from the sand of the sheltered strip between the Camden Haven breakwalls.',
    highlights: ['Paddle-steamer remains at 3 m', 'Snorkel-friendly history', 'Sheltered between the walls', 'Family-easy access'],
    hazards: 'Needs calm weather despite the shelter; parts sit in the surge line.',
    entry: 'Walk in off Pilot Beach, North Haven.'
  },
  {
    id: 'camden-haven-breakwater',
    name: 'Camden Haven Breakwater Drift',
    area: 'portmac', region: 'Camden Haven',
    lat: -31.6377, lng: 152.8348, approx: true,   /* channel beside the southern breakwater; MLN guide; Indant boiler across the entrance */
    type: 'shore', depth: '2–7 m', level: 'Advanced',
    marineZone: 'portmac', weatherZone: 'portmac',
    exposure: [0.10, 0.15, 0.22, 0.20, 0.15, 0.05, 0.04, 0.05],
    swellTol: 1.0, baseVis: 5, runoff: 0.8, tidePref: 'incoming',
    blurb: 'Tide-timed drift up the channel beside the Camden Haven breakwall, fish stacked along the rock face and the old Indant boiler sitting in 3 m across the entrance. The blown-out-day fallback.',
    highlights: ['Effortless flood-tide drift', 'Fish along the wall', 'Indant boiler relic', 'Works when everything else is out'],
    hazards: 'Incoming tide only, and the channel carries every boat entering the river: fly a flag and hold the wall side.',
    entry: 'Enter beside the southern breakwater and ride the flood upstream.'
  },

  /* ---------- Forster & Seal Rocks ---------- */
  {
    id: 'pinnacle-forster',
    mc: 214,
    name: 'The Pinnacle (Forster)',
    area: 'forster', region: 'Forster',
    lat: -32.22844, lng: 152.601726,   /* McFadyen p214 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '24–36 m', level: 'Advanced',
    marineZone: 'forster', weatherZone: 'forster',
    exposure: [0.60, 0.70, 0.80, 0.75, 0.65, 0.13, 0.05, 0.20],
    swellTol: 1.2, baseVis: 13, runoff: 0.15,
    blurb: 'His top Forster reef, 3 km off Cape Hawke: grey nurse circle the mooring by the dozen in the cooler months, with jewfish aggregations 200 strong, big kingfish and the odd cruising marlin.',
    highlights: ['Grey nurse at the mooring (winter)', 'Jewfish schools 200+', 'Big kingfish', 'Vis past 30 m on good days'],
    hazards: 'Reef base runs toward 50 m and typical dives sit 25-35 m, so bottom time is tight and light deco is routine; offshore current possible.',
    entry: 'Charter from Forster to the permanent mooring on the reef top.'
  },
  {
    id: 'spot-a-forster',
    mc: 215,
    name: 'Spot A (Forster)',
    area: 'forster', region: 'Forster',
    lat: -32.209273, lng: 152.570337,   /* McFadyen p215 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '8–22 m', level: 'Open Water',
    marineZone: 'forster', weatherZone: 'forster',
    exposure: [0.70, 0.80, 0.88, 0.80, 0.65, 0.12, 0.05, 0.22],
    swellTol: 1.0, baseVis: 11, runoff: 0.35,
    blurb: 'Wall and reef a kilometre off Cape Hawke, likely part of the Latitude Rock system: inquisitive morays in the wall cracks, octopus and cuttlefish in the overhangs, squid laying eggs over the sand.',
    highlights: ['Inquisitive moray & mosaic eels', 'Octopus and cuttlefish', 'Squid egg-laying on the sand', 'Yellowtail blankets on the reef top'],
    hazards: 'Visibility is the swing factor; some of his visits were very murky.',
    entry: 'Boat, anchor or tie onto the reef about 1 km off Cape Hawke.'
  },
  {
    id: 'latitude-rock-forster',
    mc: 216,
    name: 'Latitude Rock (Forster)',
    area: 'forster', region: 'Forster',
    lat: -32.20844, lng: 152.565614,   /* McFadyen p216 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '5–18 m', level: 'Open Water',
    marineZone: 'forster', weatherZone: 'forster',
    exposure: [0.60, 0.72, 0.82, 0.75, 0.60, 0.10, 0.05, 0.20],
    swellTol: 1.0, baseVis: 11, runoff: 0.35,
    blurb: 'The Forster fallback when The Pinnacle or the Seal Rocks run is blown out: gutters and low walls behind a rock that stands 5 m proud of the sea, with tame blue gropers and plenty of morays.',
    highlights: ['Tame blue gropers', 'Morays in the gutters', 'Bream & snapper over the sand', 'Reliable when better sites are blown'],
    hazards: 'Ordinary boat-diving cautions; it is the calm-ish option, not a heavy-weather site.',
    entry: 'Boat, mooring just off the rock’s northern face.'
  },
  {
    id: 'colours-forster',
    mc: 217,
    name: 'The Colours (Forster)',
    area: 'forster', region: 'Forster',
    lat: -32.205662, lng: 152.559503,   /* McFadyen p217 (AUS66→WGS84 shifted); page prints 33° but the Cape Hawke cluster confirms 32° */
    type: 'boat', depth: '2.5–14 m', level: 'Open Water',
    marineZone: 'forster', weatherZone: 'forster',
    exposure: [0.70, 0.80, 0.88, 0.82, 0.68, 0.12, 0.05, 0.22],
    swellTol: 0.75, baseVis: 11, runoff: 0.3,
    blurb: 'Shallow bombora 50 m off a beach north of Cape Hawke: turtles in the gutters, blue devilfish under the ledges, wobbegongs everywhere. Strictly a settled-sea dive.',
    highlights: ['Turtles in the gutters', 'Eastern blue devilfish', 'Wobbegongs & PJ sharks', 'Bold blue gropers'],
    hazards: 'Most of the circuit is very shallow; any swell makes the gutters and rock top unsafe.',
    entry: 'Boat, usually holding on the north side of the bombora, or the south-east in a northerly.'
  },
  {
    id: 'big-seal-rock',
    mc: 173,
    name: 'Big Seal Rock',
    area: 'forster', region: 'Seal Rocks',
    lat: -32.462, lng: 152.5525, approx: true,   /* OSM Seal Rocks islet, NW (mooring) side; no printed GPS */
    type: 'boat', depth: '12–35 m', level: 'Advanced',
    marineZone: 'sealrocks', weatherZone: 'forster',
    exposure: [0.65, 0.75, 0.85, 0.85, 0.75, 0.15, 0.05, 0.20],
    swellTol: 1.0, baseVis: 13, runoff: 0.2,
    blurb: 'The grey nurse island: a ten-minute run from Seal Rocks beach to gutters that hold sharks in nearly every month of the year, one of the few NSW sites without a real off-season.',
    highlights: ['Grey nurse in almost every month', 'Boulder gutters 12–20 m', 'Big rays over the sand', 'Fur seal fly-bys'],
    hazards: 'Sharks spook easily, hold back and skip the flash; the outer bottom steps away past 20 m; open-ocean island weather.',
    entry: 'Small boats launch off Seal Rocks beach; tie up on the sheltered western side near the northern tip.'
  },
  {
    id: 'jimmys-cave-seal-rocks',
    mc: 174,
    name: 'Jimmys Cave (Seal Rocks)',
    area: 'forster', region: 'Seal Rocks',
    lat: -32.4815, lng: 152.535, approx: true,   /* Outer Edith Breakers, south of the light, past the Satara; position estimated */
    type: 'boat', depth: '10–37 m', level: 'Advanced',
    marineZone: 'sealrocks', weatherZone: 'forster',
    exposure: [0.65, 0.75, 0.85, 0.85, 0.78, 0.15, 0.05, 0.20],
    swellTol: 1.1, baseVis: 13, runoff: 0.2,
    blurb: 'Bommie on Outer Edith Breakers rising from past 40 m to under 10: a cave-and-tunnel run entered down a vertical chimney to 35 m, with no tight squeezes but a short no-deco clock.',
    highlights: ['Chimney entry to a 35 m cave', 'Tunnel swim-through', 'Reef rising to 10 m for the safety stop', 'Pelagics off the breakers'],
    hazards: 'The cave section sits at 35-37 m, roughly 22 minutes of no-deco; overhead environment; remote and current-prone.',
    entry: 'Boat from Seal Rocks, anchor on the reef top south of the lighthouse, beyond the Satara site.'
  },
  {
    id: 'ss-catterthun',
    mc: 82,
    name: 'SS Catterthun (wreck)',
    area: 'forster', region: 'Seal Rocks',
    lat: -32.430907, lng: 152.578328, wreck: true,   /* marks page 526 (WGS84), matches GPX CATTER */
    type: 'boat', depth: '54–60 m', level: 'Deep / Tech',
    marineZone: 'sealrocks', weatherZone: 'forster',
    exposure: [0.55, 0.65, 0.75, 0.70, 0.62, 0.12, 0.05, 0.18],
    swellTol: 1.25, baseVis: 14, runoff: 0.15,
    blurb: 'Iron steamer lost on Little Seal Rock in 1895 with 55 lives: a 92 m hull you can sometimes see end to end, towering engine and boilers, and the Chinese crew quarters near the broken bow. One of NSW’s great deep wrecks.',
    highlights: ['92 m hull, largely intact', 'Towering engine & twin boilers', 'Soft corals glowing under torchlight', 'History: gold sovereigns were salvaged'],
    hazards: 'Genuine tech dive at 54-60 m with staged deco; strong currents; exposed to S-SW swell; bronze whalers have crowded divers on ascent.',
    entry: 'Mostly private tech boats; one Forster operator takes proven deep divers. Shot line near the amidships engine.'
  },
  {
    id: 'ss-satara',
    mc: 175,
    name: 'SS Satara (wreck)',
    area: 'forster', region: 'Seal Rocks',
    lat: -32.479, lng: 152.520888, wreck: true,   /* marks page 526 (WGS84), matches GPX SATARA; page GPS is corrupted */
    type: 'boat', depth: '40–44 m', level: 'Deep / Tech',
    marineZone: 'sealrocks', weatherZone: 'forster',
    exposure: [0.55, 0.65, 0.75, 0.70, 0.62, 0.12, 0.05, 0.18],
    swellTol: 1.25, baseVis: 14, runoff: 0.15,
    blurb: '5,156-ton steamer sunk by Edith Breakers in 1910: triple-expansion engine fallen to port between twin boilers, a mast lying 15 m out over the sand, and a six-metre bronze propeller at the stern.',
    highlights: ['Six-metre bronze prop & rudder post', 'Engine fallen against the boilers', 'Mast running out over the sand', 'Huge bollards and winches'],
    hazards: 'Remote 40 km run from Forster; strong currents have cancelled dives; twin tanks and deco planning expected.',
    entry: 'Own-boat trip for prepared crews; anchor near the midships engine.'
  },
  {
    id: 'haydens-rock-forster',
    name: 'Haydens Rock (Forster)',
    area: 'forster', region: 'Forster',
    lat: -32.178, lng: 152.523, approx: true,   /* ~150 m off, between Pebbly Beach and Main Beach; Forster Dive Centre + Dive Forster guides */
    type: 'shore', depth: '5–10 m', level: 'Open Water',
    marineZone: 'forster', weatherZone: 'forster',
    exposure: [0.65, 0.75, 0.85, 0.80, 0.70, 0.15, 0.05, 0.20],
    swellTol: 0.7, baseVis: 9, runoff: 0.35,
    blurb: 'The town shore dive: a 150 m swim off Pebbly Beach to a rock ringed by a kilometre of reef, gropers and morays below, loggerheads resting in the undercuts, grey nurse passing through. (Not in McFadyen’s guides; from both Forster operators.)',
    highlights: ['Loggerheads in the undercuts', 'Grey nurse fly-bys', 'Kilometre of reef to circle', 'Seasonal tropical strays'],
    hazards: 'Shallow rock everywhere: any swell makes it uncomfortable, and vis can drop to a couple of metres.',
    entry: 'Swim about 150 m out from Pebbly Beach, north end of Forster Main Beach.'
  },
  {
    id: 'bennets-head-north',
    name: 'Bennetts Head North (Forster)',
    area: 'forster', region: 'Forster',
    lat: -32.1835, lng: 152.5368,   /* diver-submitted pin; entries at Marine Drive east end or Bennetts Head Rd corner */
    type: 'shore', depth: '3–7 m', level: 'Open Water',
    marineZone: 'forster', weatherZone: 'forster',
    exposure: [0.55, 0.65, 0.60, 0.40, 0.25, 0.08, 0.05, 0.18],
    swellTol: 0.85, baseVis: 9, runoff: 0.35,
    blurb: 'A long, lazy single-tank wander along Bennetts Head’s northern shoreline, known locally as Fishermans Paradise: yellowtail and bonito overhead, rays and small sharks on the sand. (Not in McFadyen’s guides; diver-documented.)',
    highlights: ['Long easy shallow profile', 'Schooling yellowtail & bonito', 'Rays & small sharks', 'Cleaner-wrasse stations'],
    hazards: 'Shallow the whole way, so the cold bites on long dives; dune vegetation limits where you can cross to the water.',
    entry: 'East end of Marine Drive over the dune, or the Bennetts Head Road and Boundary Street corner.'
  },
  {
    id: 'forster-barge',
    name: 'Forster Barge (wreck)',
    area: 'forster', region: 'Forster',
    lat: -32.171, lng: 152.52, wreck: true, approx: true,   /* just outside the Forster-Tuncurry channel entrance; Forster Dive Centre guide */
    type: 'boat', depth: '24–28 m', level: 'Advanced',
    marineZone: 'forster', weatherZone: 'forster',
    exposure: [0.65, 0.72, 0.80, 0.75, 0.65, 0.10, 0.05, 0.20],
    swellTol: 1.15, baseVis: 9, runoff: 0.5, tidePref: 'high',
    blurb: 'A sunken barge on low reef outside the Forster-Tuncurry breakwalls: sponge-painted hull plates, swim-under sections, and usually a few grey nurse hanging at the thermocline. (Not in McFadyen’s guides; from Forster Dive Centre.)',
    highlights: ['Grey nurse at the layer line', 'Sponge-coated hull textures', 'Collapsed sections to peer under', 'Quick run from the ramp'],
    hazards: 'A steady 28 m with the lake outflow overhead: ascend on the anchor line, never mid-water, and dive it toward high tide when the sea pushes the murk back.',
    entry: 'Boat from Forster; the anchor line drops straight onto the barge.'
  },
  {
    id: 'status-rock-seal-rocks',
    name: 'Status Rock (Seal Rocks)',
    area: 'forster', region: 'Seal Rocks',
    lat: -32.4443, lng: 152.5336, approx: true,   /* ~250 m off Boat Beach in the NE passage; Forster Dive Centre + Dive Forster guides */
    type: 'boat', depth: '10–16 m', level: 'Open Water',
    marineZone: 'sealrocks', weatherZone: 'forster',
    exposure: [0.65, 0.75, 0.85, 0.80, 0.70, 0.15, 0.05, 0.20],
    swellTol: 0.95, baseVis: 12, runoff: 0.25,
    blurb: 'The rock off Boat Beach with a grey nurse cave on its northern end, four-metre eagle rays, and a pronounced overhang stacked with wobbegongs and PJs; the calm fallback when the outer Seal Rocks sites blow out.',
    highlights: ['Grey nurse cave at the north end', 'Four-metre eagle rays', 'Overhang full of wobbegongs', 'Swimmable from Boat Beach'],
    hazards: 'The shore-swim passage funnels current and swell: most dives arrive by boat, and swimmers should hug the reef.',
    entry: 'Boat from Seal Rocks beach, or a 250 m swim through the passage from Boat Beach.'
  },
  {
    id: 'little-seal-rock',
    name: 'Little Seal Rock',
    area: 'forster', region: 'Seal Rocks',
    lat: -32.4295, lng: 152.577, approx: true,   /* the pinnacle the Catterthun struck, beside the wreck mark; Forster Dive Centre + Dive Forster */
    type: 'boat', depth: '16–26 m', level: 'Advanced',
    marineZone: 'sealrocks', weatherZone: 'forster',
    exposure: [0.60, 0.68, 0.78, 0.75, 0.68, 0.13, 0.05, 0.18],
    swellTol: 1.15, baseVis: 13, runoff: 0.15,
    blurb: 'The pinnacle that sank the Catterthun in 1895, circled in one dive past gutters, overhangs and small caves where grey nurse shelter; collision scars were reportedly still visible on the rock.',
    highlights: ['Full-circuit pinnacle dive', 'Grey nurse in the caves', 'Bull & eagle rays', 'History under your fins'],
    hazards: 'Fully exposed to swell and the EAC: carry an SMB in case the current owns your safety stop.',
    entry: 'Boat from Seal Rocks; anchor near the rock and circle back to the line.'
  },

  /* ---------- Port Stephens ---------- */
  {
    id: 'looking-glass-broughton',
    mc: 157,
    name: 'Looking Glass (Broughton Island)',
    area: 'portstephens', region: 'Broughton Island',
    lat: -32.62965, lng: 152.31623,   /* McFadyen p157 (WGS84), matches GPX LOOKING */
    type: 'boat', depth: '12–26 m', level: 'Advanced',
    marineZone: 'broughton', weatherZone: 'nelsonbay',
    exposure: [0.45, 0.60, 0.80, 0.85, 0.75, 0.15, 0.05, 0.12],
    swellTol: 1.0, baseVis: 12, runoff: 0.15,
    blurb: 'A crack running 40-50 m clean through Looking Glass Island, sheer-walled and sky-lit, he compares it to the Poor Knights. Outside, boulders and walls drop to 26 m.',
    highlights: ['The through-island crack', 'Swim-through chamber inside the entrance', 'Sheer walls & big boulders', 'Kingfish sweeping the entrances'],
    hazards: 'Fifty-minute open-water run from Nelson Bay; the crack surges in any swell. Single route in and out of the side chamber.',
    entry: 'Charter, anchoring off the crack entrance on the settled-weather Broughton runs.'
  },
  {
    id: 'bubble-cave-broughton',
    mc: 158,
    name: 'Bubble Cave (Broughton Island)',
    area: 'portstephens', region: 'Broughton Island',
    lat: -32.6215, lng: 152.3155, approx: true,   /* mouth of Esmeralda Cove, south side; no printed GPS */
    type: 'boat', depth: '5–16 m', level: 'Advanced',
    marineZone: 'broughton', weatherZone: 'nelsonbay',
    exposure: [0.30, 0.40, 0.65, 0.80, 0.75, 0.15, 0.05, 0.10],
    swellTol: 0.95, baseVis: 12, runoff: 0.15,
    blurb: 'Sizeable cave cut well back into Broughton’s south side at the mouth of Esmeralda Cove, with a bouldery, fishy approach and an easy 16 m maximum.',
    highlights: ['Deep-set cave to explore', 'Boulder approach with good fish', 'Easy shallow profile', 'Pairs well with Cod Rock'],
    hazards: 'A real overhead: keep the exit in mind. South-side location cops southerly swell.',
    entry: 'Charter anchorage at Esmeralda Cove’s mouth on calm-sea Broughton trips.'
  },
  {
    id: 'cod-rock-broughton',
    mc: 159,
    name: 'Cod Rock (Broughton Island)',
    area: 'portstephens', region: 'Broughton Island',
    lat: -32.6205, lng: 152.323, approx: true,   /* finger reef off the south side toward the SE corner; no printed GPS */
    type: 'boat', depth: '9–18 m', level: 'Open Water',
    marineZone: 'broughton', weatherZone: 'nelsonbay',
    exposure: [0.30, 0.40, 0.65, 0.80, 0.75, 0.15, 0.05, 0.10],
    swellTol: 0.95, baseVis: 12, runoff: 0.15,
    blurb: 'Compact pinnacle at the tip of a finger reef you can lap in one dive, with a companion boulder, a small cave in the south-west corner and sand flats to the west.',
    highlights: ['Circumnavigable pinnacle', 'Small SW-corner cave', 'Companion boulder at 9 m', 'Easy navigation'],
    hazards: 'Nothing specific; save the crossing for settled seas.',
    entry: 'Charter anchorage beside the rock on Broughton runs.'
  },
  {
    id: 'big-shark-gutters-broughton',
    mc: 160,
    name: 'Big Shark Gutters (Little Broughton)',
    area: 'portstephens', region: 'Broughton Island',
    lat: -32.6218, lng: 152.335, approx: true,   /* SE corner of Little Broughton Island; no printed GPS */
    type: 'boat', depth: '12–23 m', level: 'Open Water',
    marineZone: 'broughton', weatherZone: 'nelsonbay',
    exposure: [0.55, 0.70, 0.85, 0.85, 0.75, 0.15, 0.05, 0.15],
    swellTol: 1.0, baseVis: 12, runoff: 0.15,
    blurb: 'The main grey nurse gutter on Little Broughton’s south-east corner, a vertical wall on one side, boulder slope on the other, with more gutters trailing south-west.',
    highlights: ['Grey nurse in the main gutter', 'Wall-and-boulder canyon', 'Extra gutters to explore', 'Sand bottom at 23 m'],
    hazards: 'Give the sharks the right of way and stay off the gutter floor; exposed corner of an exposed island.',
    entry: 'Charter anchorage off the SE corner in settled weather.'
  },
  {
    id: 'little-shark-gutters-broughton',
    mc: 161,
    name: 'Little Shark Gutters (Little Broughton)',
    area: 'portstephens', region: 'Broughton Island',
    lat: -32.6195, lng: 152.3345, approx: true,   /* mid-eastern point of Little Broughton; no printed GPS */
    type: 'boat', depth: '6–12 m', level: 'Open Water',
    marineZone: 'broughton', weatherZone: 'nelsonbay',
    exposure: [0.55, 0.70, 0.85, 0.82, 0.72, 0.15, 0.05, 0.15],
    swellTol: 0.95, baseVis: 12, runoff: 0.15,
    blurb: 'Four or five dead-end gutters in a protected inlet a step north of Big Shark Gutters, shallow enough to watch grey nurse hover at 6-9 m.',
    highlights: ['Grey nurse at snorkel depth', 'Sheltered inlet', 'Simple in-and-out gutters', 'Big rays on the sand'],
    hazards: 'Each gutter dead-ends: swim in, turn, come back out, no through-routes.',
    entry: 'Charter anchorage in the inlet, sharing the run with Big Shark Gutters.'
  },
  {
    id: 'north-rock-broughton',
    name: 'North Rock (Broughton Island)',
    area: 'portstephens', region: 'Broughton Island',
    lat: -32.59982, lng: 152.32326, approx: true,   /* directory fix for the islet north of Broughton; Lets Go Adventures + Grey Nurse Charters guides */
    type: 'boat', depth: '4–20 m', level: 'Advanced',
    marineZone: 'broughton', weatherZone: 'nelsonbay',
    exposure: [0.70, 0.80, 0.75, 0.55, 0.40, 0.10, 0.05, 0.25],
    swellTol: 1.0, baseVis: 12, runoff: 0.15,
    blurb: 'The islet north of Broughton with the area’s big grey nurse gutter, 25-plus sharks on good days past a science tracker bolted at the entrance. Numbers peak March to May. (Not in McFadyen’s guides; from Lets Go Adventures and Grey Nurse Charters.)',
    highlights: ['Grey nurse by the dozen', 'Shark-tracker pole at the gutter', 'Trumpeter schools', 'Autumn peak numbers'],
    hazards: 'Outside the declared critical-habitat zone, so line-scarred sharks and fishers share the water; open-ocean islet weather.',
    entry: 'Charter from Nelson Bay on the Broughton run; anchor off the gutter mouth.'
  },
  {
    id: 'elephant-rock-broughton',
    name: 'Elephant Rock (Broughton Island)',
    area: 'portstephens', region: 'Broughton Island',
    lat: -32.6122, lng: 152.3148, approx: true,   /* north-coast point below the elephant-head rock; Lets Go Adventures + Grey Nurse Charters */
    type: 'boat', depth: '5–15 m', level: 'Open Water',
    marineZone: 'broughton', weatherZone: 'nelsonbay',
    exposure: [0.70, 0.80, 0.75, 0.55, 0.40, 0.10, 0.05, 0.25],
    swellTol: 0.95, baseVis: 12, runoff: 0.15,
    blurb: 'Easy kelp-and-sand ground under the elephant-shaped rock on Broughton’s north coast: red indianfish in the kelp, ornate wobbegongs, shovelnose rays along the sand line.',
    highlights: ['Red indianfish in the kelp', 'Ornate wobbegongs', 'Shovelnose & bull rays', 'Winter PJs and turtles'],
    hazards: 'Fortescue hide on the sand and sting hard: keep buoyancy off the bottom.',
    entry: 'Charter anchorage below the elephant rock formation.'
  },
  {
    id: 'spider-cave-broughton',
    mc: 162,
    name: 'Spider Cave (Broughton Island)',
    area: 'portstephens', region: 'Broughton Island',
    lat: -32.622051, lng: 152.325614,   /* McFadyen p162 (AUS66→WGS84 shifted); depth now documented by Lets Go Adventures (14-18 m) */
    type: 'boat', depth: '14–18 m', level: 'Advanced',
    marineZone: 'broughton', weatherZone: 'nelsonbay',
    exposure: [0.55, 0.70, 0.85, 0.85, 0.75, 0.15, 0.05, 0.15],
    swellTol: 0.95, baseVis: 12, runoff: 0.15,
    blurb: 'Twin parallel tunnels below The Steps on Broughton’s eastern point, joining after 20 m and turning back to open water, with PJs and wobbegongs resting inside.',
    highlights: ['Twin tunnels that merge', 'Side chambers off the passage', 'Resting PJs & wobbegongs', 'The Steps landmark above'],
    hazards: 'A true overhead with passages of different width and light; the outer wall runs on to about 18 m.',
    entry: 'Charter anchorage off the eastern point, seaward of The Steps.'
  },
  {
    id: 'safety-cove-boondelbah',
    name: 'Safety Cove (Boondelbah Island)',
    area: 'portstephens', region: 'Port Stephens heads',
    lat: -32.7102, lng: 152.2278, approx: true,   /* south-coast cove of Boondelbah; Lets Go + Grey Nurse Charters + Pro Dive */
    type: 'boat', depth: '10–30 m', level: 'Advanced',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.25, 0.35, 0.60, 0.75, 0.70, 0.15, 0.05, 0.10],
    swellTol: 1.0, baseVis: 10, runoff: 0.2,
    blurb: 'Rock-lined cove on Boondelbah’s south coast: sponge-and-nudibranch walls, crevice lobsters, and a long-term resident Queensland groper among the boulder swim-throughs.',
    highlights: ['Resident Queensland groper', 'Nudibranch walls', 'Boulder swim-throughs', 'Rock lobster in the cracks'],
    hazards: 'Give the giant cuttlefish room; the swim-throughs are for the experienced end of the boat.',
    entry: 'Charter anchorage in the cove, minutes from the heads.'
  },
  {
    id: 'ne-cabbage-tree-island',
    name: 'North East Cabbage Tree Island',
    area: 'portstephens', region: 'Port Stephens heads',
    lat: -32.6865, lng: 152.2295, approx: true,   /* NE shore of the nature-reserve island; Lets Go + Grey Nurse Charters */
    type: 'boat', depth: '15–20 m', level: 'Open Water',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.60, 0.75, 0.80, 0.65, 0.45, 0.10, 0.05, 0.18],
    swellTol: 1.0, baseVis: 10, runoff: 0.2,
    blurb: 'Sponge gardens climbing the wall on the seabird island’s exposed corner, canyon slots cut into the cliff base, and a small inlet that fills with juvenile groupers in season.',
    highlights: ['Wall-climbing sponge gardens', 'Canyon slots at the cliff base', 'Late-winter PJ breeding', 'Winter fur seals'],
    hazards: 'The exposed side of the island: settled weather only. Landing is prohibited (Gould’s petrel reserve).',
    entry: 'Charter anchorage off the NE shore.'
  },
  {
    id: 'fingal-sponge-gardens',
    mc: 169,
    name: 'Fingal Sponge Gardens',
    area: 'portstephens', region: 'Fingal & Tomaree',
    lat: -32.74094, lng: 152.202559, approx: true,   /* McFadyen p169 (AUS66→WGS84 shifted, his fix flagged approximate); depth now documented 3-35 m by Lets Go/Pro Dive; folds Grey Nurse Charters' adjacent Black Coral Pinnacle */
    type: 'boat', depth: '3–35 m', level: 'Advanced',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.60, 0.72, 0.82, 0.78, 0.68, 0.12, 0.05, 0.18],
    swellTol: 1.05, baseVis: 10, runoff: 0.25,
    blurb: 'The pinnacle-and-drop-off side of Fingal Island: sponge gardens over every summit, a black-coral crack on the north face, and a low seaward cave at depth for calm days.',
    highlights: ['Sponge-carpeted pinnacles', 'Black coral colonies in the crack', 'Baitfish with morwong & groper', 'Late-winter PJ breeding'],
    hazards: 'The deeper gutters and the seaward cave are experienced-only territory; position is approximate, sound around the pinnacles.',
    entry: 'Boat around Fingal Island’s ocean side; anchor off the pinnacle line.'
  },
  {
    id: 'cabbage-tree-trawler',
    mc: 172,
    name: 'Cabbage Tree Island Trawler (wreck)',
    area: 'portstephens', region: 'Port Stephens heads',
    lat: -32.689273, lng: 152.222837, wreck: true,   /* McFadyen p172 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '5–13 m', level: 'Open Water',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.35, 0.30, 0.30, 0.40, 0.50, 0.15, 0.05, 0.15],
    swellTol: 0.95, baseVis: 9, runoff: 0.4, tidePref: 'high', waterBody: 'portstephens',
    blurb: 'Small fishing trawler in two pieces on Cabbage Tree Island’s western side: a broken stern and a peer-inside bow on its flank 20 m away, with pineapplefish in residence.',
    highlights: ['Bow section big enough to peer into', 'Barge & cabin-cruiser wreckage nearby', 'Pineapplefish sightings', 'Easy 13 m maximum'],
    hazards: 'The ebb tide pushes turbid Port Stephens water across the site: dive it at or near high water.',
    entry: 'Short boat run from Nelson Bay to the island’s western (lee) side.'
  },
  {
    id: 'ss-macleay',
    mc: 167,
    name: 'SS Macleay (wreck)',
    area: 'portstephens', region: 'Port Stephens offshore',
    lat: -32.704, lng: 152.246445, wreck: true,   /* McFadyen p167 (WGS84), matches marks 526 + GPX */
    type: 'boat', depth: '37–43 m', level: 'Deep / Tech',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.55, 0.65, 0.72, 0.70, 0.62, 0.12, 0.05, 0.18],
    swellTol: 1.2, baseVis: 11, runoff: 0.15, tidePref: 'high',
    blurb: 'Steamer that struck Boondelbah Island in 1911 taking 15 of her 17 crew: hull split aft of the toppled engine, bow anchors still set, at a serious 43 m.',
    highlights: ['Toppled engine & split hull', 'Bow anchors in place', 'Big fish traffic', 'Genuine deep-wreck atmosphere'],
    hazards: 'Staged-deco territory; tidal current toward the heads around the change plus occasional ocean current. Vis is much better around high tide.',
    entry: 'Charter or private boat north of Boondelbah Island; shot line descent.'
  },
  {
    id: 'ss-oakland',
    mc: 168,
    name: 'SS Oakland (wreck)',
    area: 'portstephens', region: 'Port Stephens offshore',
    lat: -32.67813, lng: 152.233338, wreck: true,   /* McFadyen p168 (WGS84), matches marks 526 + GPX */
    type: 'boat', depth: '24–27 m', level: 'Advanced',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.55, 0.65, 0.72, 0.70, 0.62, 0.12, 0.05, 0.18],
    swellTol: 1.15, baseVis: 12, runoff: 0.15,
    blurb: '1903 wreck off Cabbage Tree Island: triple-expansion engine flanked by molasses tanks, an enterable forecastle with the bowsprit still proud, and catsharks by the dozen.',
    highlights: ['Enterable forecastle & bowsprit', 'Molasses tanks beside the engine', 'Dozens of catsharks', 'Usually 18 m visibility'],
    hazards: 'Occasional southerly current; otherwise the forgiving one among the local wrecks.',
    entry: 'Boat north of Cabbage Tree Island; anchor near the mooring position.'
  },
  {
    id: 'tomaree-head',
    mc: 171,
    name: 'Tomaree Head',
    area: 'portstephens', region: 'Fingal & Tomaree',
    lat: -32.716496, lng: 152.18867,   /* McFadyen p171 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '5–13 m', level: 'Open Water',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.40, 0.55, 0.70, 0.60, 0.45, 0.10, 0.05, 0.12],
    swellTol: 0.9, baseVis: 10, runoff: 0.3,
    blurb: 'Boulders, swim-throughs and overhangs on the ocean face of the southern entrance headland, the local southerly-weather fallback at an easy 5 m average.',
    highlights: ['Swim-throughs & overhangs', 'Easy shallow mooching', 'Good all-round fish life', 'Sheltered second-dive option'],
    hazards: 'Nothing specific; it earns its keep when southerlies shut the better sites.',
    entry: 'Short boat hop from Nelson Bay around Tomaree Head.'
  },
  {
    id: 'govt-wharf-fingal',
    mc: 504,
    name: 'Government Wharf (Fingal Head)',
    area: 'portstephens', region: 'Fingal & Tomaree',
    lat: -32.740551, lng: 152.195198,   /* McFadyen p504 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '4–14 m', level: 'Open Water',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.55, 0.60, 0.50, 0.30, 0.20, 0.08, 0.05, 0.20],
    swellTol: 0.9, baseVis: 10, runoff: 0.3,
    blurb: 'A row of massive timber pilings from the old government wharf in Fingal’s north-facing bay, with spring PJ-shark egg cases in numbers he has not matched anywhere.',
    highlights: ['Giant old wharf pilings', 'PJ sharks & egg cases (spring)', 'Red indianfish sighting', 'Fiddler rays & wobbegongs'],
    hazards: 'Watch for line and snags around the old timbers; open coast, but the bay faces north away from the swell.',
    entry: 'Boat into the bay west of Point Stephens lighthouse; anchor at 9-10 m.'
  },
  {
    id: 'boat-harbour-ps',
    mc: 166,
    name: 'Boat Harbour (Anna Bay)',
    area: 'portstephens', region: 'Fingal & Tomaree',
    lat: -32.7895, lng: 152.1095, approx: true,   /* rock entry just south of Boat Harbour; no printed GPS */
    type: 'shore', depth: '5–17 m', level: 'Advanced',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.45, 0.55, 0.75, 0.85, 0.85, 0.20, 0.05, 0.12],
    swellTol: 0.85, baseVis: 10, runoff: 0.3,
    blurb: 'The area’s open-coast shore dive: a gutter from the shallows to the sand line at 15-17 m, small rays everywhere, and overhangs along the mid-bay rock.',
    highlights: ['Gutter run to the sand line', 'Small rays over the sand', 'Overhangs on the big rock', 'Rarely another diver'],
    hazards: 'Fully exposed to southerly swell, unlike the estuary shore dives: pick a small sea and watch the rock entry.',
    entry: 'Rock platform entry just south of Boat Harbour, Anna Bay.'
  },
  {
    id: 'fly-point',
    mc: 164,
    name: 'Fly Point (Nelson Bay)',
    area: 'portstephens', region: 'Nelson Bay',
    lat: -32.7135, lng: 152.152,   /* entry steps off Victoria Parade; OSM Fly Point locality */
    type: 'shore', depth: '5–18 m', level: 'Advanced',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.06, 0.08, 0.06, 0.04, 0.03, 0.03, 0.03, 0.04],
    swellTol: 1.0, baseVis: 8, runoff: 0.65, tidePref: 'high', waterBody: 'portstephens',
    blurb: 'The famous Nelson Bay sponge gardens: pineapplefish under the ledges (eight in one spot on a good day), finger sponges full of decorator crabs, and fish in clouds. All of it timed to the tide.',
    highlights: ['Pineapplefish under the overhangs', 'Sponge gardens & decorator crabs', 'Huge bream & luderick schools', 'Marine-reserve tameness'],
    hazards: 'Drop in right on the Fort Denison high: slack here lags it by about 20 minutes and big tides run hard. Busy boat channel overhead, never surface mid-dive.',
    entry: 'Steps from the Victoria Parade car park to a rock-cleared path into the water.'
  },
  {
    id: 'halifax-park',
    mc: 163,
    name: 'Halifax Park (Nelson Bay)',
    area: 'portstephens', region: 'Nelson Bay',
    lat: -32.7095, lng: 152.1618,   /* northern end of the beach below Nelson Head */
    type: 'shore', depth: '6–25 m', level: 'Advanced',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.06, 0.08, 0.06, 0.04, 0.03, 0.03, 0.03, 0.04],
    swellTol: 1.0, baseVis: 8, runoff: 0.65, tidePref: 'high', waterBody: 'portstephens',
    blurb: 'Sponge-garden slope under Nelson Head reaching 25 m, deeper and moodier than Fly Point: morays, mosaic eels and blind sharks in the growth, though sand has crept over the shallows since 2010.',
    highlights: ['Deep sponge & sea-pen slope', 'Morays and mosaic eels', 'Wobbegongs & blind sharks', 'Quieter than Fly Point'],
    hazards: 'Marked boat channel overhead and firm tidal flow; current can run opposite ways at different depths. Time it to the Fort Denison high.',
    entry: 'North end of the beach at the road’s end past Fly Point; a flat rock eases the wade.'
  },
  {
    id: 'little-beach-nelson-bay',
    mc: 635,
    name: 'Little Beach (Nelson Bay)',
    area: 'portstephens', region: 'Nelson Bay',
    lat: -32.7118, lng: 152.1575,   /* OSM Little Beach; track before the small wharf */
    type: 'shore', depth: '8–12 m', level: 'Open Water',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.06, 0.08, 0.06, 0.04, 0.03, 0.03, 0.03, 0.04],
    swellTol: 1.0, baseVis: 7, runoff: 0.7, tidePref: 'high', waterBody: 'portstephens',
    blurb: 'Gentle wharf-and-junk dive between Fly Point and Halifax Park: White’s seahorses on the sponges, a sunken A-frame and pontoon, half a houseboat, and pylons packed with luderick.',
    highlights: ['White’s seahorses', 'Sunken A-frame & pontoon', 'Houseboat wreckage', 'Hundreds of luderick under the wharf'],
    hazards: 'Loose rocky footing at the waterline; small-boat traffic. Best right at high tide.',
    entry: 'Worn track just before the small wharf off Victoria Parade.'
  },
  {
    id: 'pipeline-nelson-bay',
    mc: 501,
    name: 'The Pipeline (Nelson Bay)',
    area: 'portstephens', region: 'Nelson Bay',
    lat: -32.7186, lng: 152.142, approx: true,   /* steps at the end of the Teramby Road walkway, west of the marina */
    type: 'shore', depth: '6–18 m', level: 'Advanced',
    marineZone: 'tomaree', weatherZone: 'nelsonbay',
    exposure: [0.06, 0.08, 0.06, 0.04, 0.03, 0.03, 0.03, 0.04],
    swellTol: 1.0, baseVis: 7, runoff: 0.7, tidePref: 'slack', waterBody: 'portstephens',
    blurb: 'Muck-and-macro along a sand-buried old pipe traced by its sponge-crusted supports: sand anemones he calls unique to the spot, seahorses, and an old fish trap.',
    highlights: ['White’s seahorses', 'Sand anemones found nowhere else', 'Nudibranch hunting', 'Old fish trap'],
    hazards: 'Runs under the marina entrance: lost buddies head south to the rocks before surfacing. Only slack windows around high or low are sensible.',
    entry: 'Steps at the far end of the Teramby Road walkway past the cafe.'
  },

  /* ---------- Newcastle & Swansea ---------- */
  {
    id: 'swansea-bridge',
    mc: 144,
    name: 'Swansea Bridge',
    area: 'newcastle', region: 'Swansea & Lake Macquarie',
    lat: -33.0856, lng: 151.6402,   /* OSM Swansea Bridge; punt-ramp entry on the southern bank */
    type: 'shore', depth: '7–11 m', level: 'Advanced',
    marineZone: 'moonisland', weatherZone: 'swansea',
    exposure: [0.10, 0.15, 0.20, 0.18, 0.12, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 6, runoff: 0.7, tidePref: 'slack', waterBody: 'lakemac',
    blurb: 'The Lake Macquarie entrance channel under the highway bridge: pylons packed solid with luderick and tarwhine, pipes crossed by morwong, and pineapplefish a dozen at a time around the bases.',
    highlights: ['Pineapplefish by the dozen', 'Pylon fish in packed schools', 'Big mud crabs', 'Night-dive favourite'],
    hazards: 'Slack water only, the channel runs too hard otherwise, and fast boats cross overhead even at slack. Post-2006 bridge works shallowed parts of the bottom.',
    entry: 'Old punt ramp on the southern bank beside the SLSC boat shed, just west of the bridge.'
  },
  {
    id: 'swansea-channel-drift',
    mc: 145,
    name: 'Swansea Channel Drift',
    area: 'newcastle', region: 'Swansea & Lake Macquarie',
    lat: -33.0878, lng: 151.6418, approx: true,   /* start wharves at the RSL car park, southern bank */
    type: 'shore', depth: '3–14 m', level: 'Advanced',
    marineZone: 'moonisland', weatherZone: 'swansea',
    exposure: [0.10, 0.15, 0.20, 0.18, 0.12, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 6, runoff: 0.7, tidePref: 'incoming', waterBody: 'lakemac',
    blurb: 'A 1.5 km tide ride up the channel past the bridge pylons, over dune-ridged sand with flathead, whiting and kingfish, and a bottom sprinkled with old bridge scrap.',
    highlights: ['Effortless 1.5 km drift', 'Dune-ridge sand waves', 'Kingfish over the flats', 'Bridge-pylon fish en route'],
    hazards: 'He rides the incoming tide (high at Swansea lags Fort Denison by about 150 minutes): stay tight with your buddy, the flow separates pairs fast, and watch boats at the exit ramp.',
    entry: 'Wharves at the Swansea RSL car park off Peel Street; drift to the ramp past the bridge.'
  },
  {
    id: 'ss-bonnie-dundee',
    mc: 146,
    name: 'SS Bonnie Dundee (wreck)',
    area: 'newcastle', region: 'Swansea & Lake Macquarie',
    lat: -33.105551, lng: 151.704003, wreck: true,   /* p146/marks526/GPX agree numerically; his datum labels conflict, value used as printed */
    type: 'boat', depth: '32–35 m', level: 'Advanced',
    marineZone: 'moonisland', weatherZone: 'swansea',
    exposure: [0.55, 0.62, 0.70, 0.68, 0.60, 0.10, 0.05, 0.18],
    swellTol: 1.2, baseVis: 10, runoff: 0.2, waterBody: 'newcastle',
    blurb: '1879 steamer 4.4 km off Caves Beach: boiler, steam dome and compound engine upright in the stern, the bow tipped at 45 degrees a short swim away, and fish life he ranks with the best wrecks.',
    highlights: ['Engine & steam dome upright', 'Tipped bow section', 'Steering gear & prop blade', 'Thick wreck fish life'],
    hazards: 'Small footprint at 32-35 m: anchoring takes patience and bottom time is short.',
    entry: 'Boat out of Swansea Channel, about 115 degrees from the entrance.'
  },
  {
    id: 'arch-moon-island',
    mc: 147,
    name: 'The Arch (Moon Island)',
    area: 'newcastle', region: 'Swansea & Lake Macquarie',
    lat: -33.096, lng: 151.661, approx: true,   /* SE corner of Moon Island off Swansea Heads; no printed GPS */
    type: 'boat', depth: '17–20 m', level: 'Advanced',
    marineZone: 'moonisland', weatherZone: 'swansea',
    exposure: [0.60, 0.70, 0.82, 0.80, 0.72, 0.12, 0.05, 0.20],
    swellTol: 1.0, baseVis: 9, runoff: 0.25, waterBody: 'newcastle',
    blurb: 'A 10 m boulder archway off Moon Island’s south-east corner, walls and roof crusted in colour, with yellowtail and seapike streaming through and a second smaller arch nearby.',
    highlights: ['10 m encrusted archway', 'Seapike through the opening', 'Second small arch', 'Big cuttlefish'],
    hazards: 'Standard boat-dive care; short run from Swansea Channel.',
    entry: 'Anchor east of the two large boulders at the island’s SE corner.'
  },
  {
    id: 'flagstaff-swansea',
    name: 'Flagstaff (Swansea Heads)',
    area: 'newcastle', region: 'Swansea & Lake Macquarie',
    lat: -33.0873, lng: 151.6641,   /* pocket bay off Reids Reserve, tile-verified; Dive Swansea shore-dive guide, not in McFadyen */
    type: 'shore', depth: '5–8 m', level: 'Open Water',
    marineZone: 'moonisland', weatherZone: 'swansea',
    exposure: [0.25, 0.30, 0.38, 0.48, 0.22, 0.06, 0.04, 0.08],
    swellTol: 0.95, baseVis: 8, runoff: 0.3, waterBody: 'newcastle',
    blurb: 'The small bay at Swansea Heads in Moon Island’s lee: rays on the sand, weedy gardens full of nudibranchs, a giant-boulder backdrop, and winter grey nurse cruising the gap toward the island. (Not in McFadyen’s guides; from Dive Swansea’s shore-dive guide.)',
    highlights: ['Winter grey nurse toward Moon Island', 'Rays on the sand patches', 'Weedy nudibranch gardens', 'Twenty-metre walk from the car'],
    hazards: 'Loses its protection in south-easterly wind and sea; watch the rock entry option south of the beach.',
    entry: 'Park at Reids Reserve, Swansea Heads; enter off the sandy beach in the bay, or the rocks just south.'
  },
  {
    id: 'newcastle-ocean-baths',
    name: 'Newcastle Ocean Baths',
    area: 'newcastle', region: 'Newcastle',
    lat: -32.9285, lng: 151.7917,   /* off the baths rock platform, tile-verified; Grey Nurse Charters guide, not in McFadyen */
    type: 'shore', depth: '2–9 m', level: 'Open Water',
    marineZone: 'moonisland', weatherZone: 'swansea',
    exposure: [0.60, 0.68, 0.78, 0.75, 0.65, 0.10, 0.05, 0.20],
    swellTol: 0.8, baseVis: 6, runoff: 0.35, waterBody: 'newcastle',
    blurb: 'Newcastle’s city shore dive off the art-deco ocean baths: gutters and kelp reef to 9 m with the harbour skyline behind you. (Not in McFadyen’s guides; from Grey Nurse Charters’ Newcastle dive guide.)',
    highlights: ['City-convenient rock reef', 'Gutters & kelp to 9 m', 'Octopus and PJ sharks', 'Cafe debrief across the road'],
    hazards: 'An open-coast platform entry: needs a small sea and careful timing; Hunter River floodwater browns it out for days.',
    entry: 'Off the rock platform beside Newcastle Ocean Baths, Shortland Esplanade.'
  },
  {
    id: 'chb-coal-loader',
    name: 'Coal Loader (Catherine Hill Bay)',
    area: 'newcastle', region: 'Catherine Hill Bay',
    lat: -33.1598, lng: 151.6318,   /* jetty footprint per NSW Crown Lands heritage doc; Dive Swansea / Grey Nurse Charters guides */
    type: 'shore', depth: '2–11 m', level: 'Advanced',
    marineZone: 'moonisland', weatherZone: 'swansea',
    exposure: [0.50, 0.60, 0.75, 0.70, 0.55, 0.10, 0.05, 0.15],
    swellTol: 0.75, baseVis: 7, runoff: 0.3, waterBody: 'newcastle',
    blurb: 'The heritage coal jetty on Catherine Hill Bay beach: pylons crusted in growth, mining chain and cable on the sand, and collier wreckage scattered nearby. (Not in McFadyen’s guides; from Dive Swansea and Grey Nurse Charters guides.)',
    highlights: ['Heritage jetty pylons', 'Mining relics on the sand', 'Collier wreckage nearby', 'Photogenic structure dive'],
    hazards: 'Surf-beach entry that needs a small swell; the south side of the loader is the calm way in and out.',
    entry: 'Walk in under the jetty from the beach; enter and exit on its southern side.'
  },
  {
    id: 'honda-hole-chb',
    mc: 150,
    name: 'Honda Hole (Catherine Hill Bay)',
    area: 'newcastle', region: 'Catherine Hill Bay',
    lat: -33.1766, lng: 151.6338, approx: true,   /* narrow inlet on the southern headland; shore access is gone, now boated from CHB */
    type: 'boat', depth: '5–20 m', level: 'Advanced',
    marineZone: 'moonisland', weatherZone: 'swansea',
    exposure: [0.30, 0.40, 0.60, 0.70, 0.65, 0.15, 0.05, 0.10],
    swellTol: 0.6, baseVis: 8, runoff: 0.25, waterBody: 'newcastle',
    blurb: 'The narrow inlet at Catherine Hill Bay’s southern headland, walled with undercut ledges and swim-throughs, named for the wrecked car at its head. Once a shore dive via the mining road, now boated. (Dive Swansea runs it; McFadyen’s old shore write-up survives as the guide link.)',
    highlights: ['Wall-to-wall inlet canyon', 'Undercut ledges & swim-throughs', 'The namesake car wreck', 'PJ sharks in the gutters'],
    hazards: 'Only in genuinely flat seas: any swell closes the narrow mouth. The old clifftop shore access is gated and washed out, do not attempt it.',
    entry: 'Boat from Catherine Hill Bay; work in along one wall of the inlet and back out the other.'
  },

  /* ---------- Central Coast ---------- */
  {
    id: 'the-bull-norah-head',
    mc: 638,
    name: 'The Bull (Norah Head)',
    area: 'centralcoast', region: 'Norah Head',
    lat: -33.2845, lng: 151.582, approx: true,   /* breaking bombora ~1 km off the head; no printed GPS */
    type: 'boat', depth: '12–22 m', level: 'Advanced',
    marineZone: 'norah', weatherZone: 'theentrance',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 0.95, baseVis: 9, runoff: 0.25,
    blurb: 'Boulder wall running off the breaking Bull bombora: pomfret shoals thick enough to hide the reef, kingfish and trevally overhead, PJ sharks under the boulders in winter.',
    highlights: ['Pomfret shoals that hide the reef', 'Kingfish & trevally', 'Winter PJ sharks', 'Room-sized boulders'],
    hazards: 'The boulder field sprawls: easy to lose the anchor line. Norah Head’s beach launch limits weather windows; the bombora breaks, anchor north-east of it.',
    entry: 'Boat 1 km from the Norah Head ramp; anchor NE of the exposed rock.'
  },
  {
    id: 'boulders-norah-head',
    mc: 148,
    name: 'The Boulders (Norah Head)',
    area: 'centralcoast', region: 'Norah Head',
    lat: -33.2725, lng: 151.583333,   /* McFadyen p148 (WGS84) */
    type: 'boat', depth: '17–21 m', level: 'Advanced',
    marineZone: 'norah', weatherZone: 'theentrance',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 1.0, baseVis: 9, runoff: 0.25,
    blurb: 'Table-to-room-sized boulders scattered along a wall north-west of the Bull, dressed in gorgonians and sea squirts with one-spot pullers in clouds.',
    highlights: ['Gorgonian-covered boulders', 'One-spot puller clouds', 'Occasional big luderick', 'Sometimes a mooring in place'],
    hazards: 'Rough beach launch at Norah Head restricts boats and days; check any mooring before trusting it.',
    entry: 'Boat just over 1 km from the ramp, NW of the Bull bombora.'
  },
  {
    id: 'snapper-point-munmorah',
    name: 'Snapper Point (Munmorah)',
    area: 'centralcoast', region: 'Munmorah',
    lat: -33.187, lng: 151.6295, approx: true,   /* off the headland front, car park at the end of Snapper Point Rd; Dive Swansea guide */
    type: 'shore', depth: '5–12 m', level: 'Advanced',
    marineZone: 'norah', weatherZone: 'theentrance',
    exposure: [0.60, 0.70, 0.82, 0.80, 0.72, 0.12, 0.05, 0.20],
    swellTol: 0.6, baseVis: 9, runoff: 0.2,
    blurb: 'The Dive Swansea owner’s favourite local: swim-throughs, arches and sponge walls off the Munmorah headland, earned via a committing giant-stride entry. (Not in McFadyen’s guides; from Dive Swansea’s shore-dive guide.)',
    highlights: ['Swim-throughs & small arches', 'Sponge-covered walls', 'Operator’s pick of the coast', 'Wild conservation-area setting'],
    hazards: 'Advanced-to-expert entry and exit: wants well under a metre of swell and a westerly; first-timers should go guided. Exit rounds the corner onto the beach.',
    entry: 'Giant stride off the rocks at the headland front, from the Snapper Point Road car park, Frazer Park.'
  },
  {
    id: 'cabbage-tree-harbour',
    name: 'Cabbage Tree Harbour (Noraville)',
    area: 'centralcoast', region: 'Norah Head',
    lat: -33.2787, lng: 151.569,   /* in the harbour beside the Bald Street ramp, tile-verified; Dive Swansea guide */
    type: 'shore', depth: '3–9 m', level: 'Open Water',
    marineZone: 'norah', weatherZone: 'theentrance',
    exposure: [0.35, 0.30, 0.20, 0.10, 0.06, 0.04, 0.04, 0.12],
    swellTol: 1.0, baseVis: 7, runoff: 0.35,
    blurb: 'Sheltered little harbour bay tucked south of Norah Head: sandy bottom, a wall-and-reef line to follow out and back, rays and PJs on the way. The beginner-friendly one on this stretch. (Not in McFadyen’s guides; from Dive Swansea’s shore-dive guide.)',
    highlights: ['Easy sheltered bay', 'Wall-and-reef out-and-back', 'Stingrays & PJ sharks', 'Wobbegongs under the ledges'],
    hazards: 'Boat-ramp traffic through the middle of the bay: tow a flag.',
    entry: 'Wade in off the sand beside the Bald Street boat ramp, Noraville.'
  },
  {
    id: 'corinnes-canyon',
    mc: 149,
    name: 'Corinnes Canyon (Norah Head)',
    area: 'centralcoast', region: 'Norah Head',
    lat: -33.325111, lng: 151.568944,   /* McFadyen p149 (WGS84) */
    type: 'boat', depth: '21–33 m', level: 'Advanced',
    marineZone: 'norah', weatherZone: 'theentrance',
    exposure: [0.62, 0.70, 0.78, 0.76, 0.68, 0.10, 0.05, 0.20],
    swellTol: 1.15, baseVis: 10, runoff: 0.2,
    blurb: 'An east-west wall 6 km south of Norah Head dropping past 30 m into paired canyon walls and a boulder field he calls the Seven Apostles, all of it thick with gorgonians.',
    highlights: ['Wall drop 21 to 33 m', 'The Seven Apostles boulders', 'Canyon slots at the base', 'Dense gorgonian growth'],
    hazards: 'No-deco time evaporates if you work both the wall and the Apostles; exposed launch limits days.',
    entry: 'Boat 6 km south of the ramp; anchor on the wall top found on the sounder.'
  },
  {
    id: 'lighthouse-reef-norah',
    mc: 639,
    name: 'Lighthouse Reef (Norah Head)',
    area: 'centralcoast', region: 'Norah Head',
    lat: -33.283, lng: 151.585, approx: true,   /* reef edge off the lighthouse; no printed GPS */
    type: 'boat', depth: '12–19 m', level: 'Advanced',
    marineZone: 'norah', weatherZone: 'theentrance',
    exposure: [0.65, 0.72, 0.80, 0.78, 0.70, 0.10, 0.05, 0.22],
    swellTol: 0.95, baseVis: 9, runoff: 0.25,
    blurb: 'North-south boulder wall under the lighthouse with canyons, cracks and gutters where wobbegongs, cuttlefish and PJ sharks hole up.',
    highlights: ['Boulder wall & canyons', 'Wobbegongs & PJs in the gutters', 'Gorgonians and sponges', 'Rumoured swim-through to find'],
    hazards: 'Heavy surge stirs the sand in any size swell; beach launch limits access.',
    entry: 'Boat 1.5 km from the ramp, anchoring where the reef edge drops.'
  },
  {
    id: 'skillion-cave-terrigal',
    mc: 745,
    name: 'Skillion Cave (Terrigal)',
    area: 'centralcoast', region: 'Terrigal',
    lat: -33.4515, lng: 151.4525, approx: true,   /* rock platform below The Skillion; OSM cape -33.4510, 151.4517 */
    type: 'shore', depth: '8–20 m', level: 'Advanced',
    marineZone: 'terrigal', weatherZone: 'theentrance',
    exposure: [0.55, 0.65, 0.78, 0.72, 0.60, 0.10, 0.05, 0.18],
    swellTol: 0.75, baseVis: 9, runoff: 0.3,
    blurb: 'A house-sized boulder wedged into a reef crack below The Skillion forms a 20 m cave-like swim-through, home to a big male blue groper and his harem.',
    highlights: ['Wedged-boulder swim-through', 'Resident blue groper family', 'Pomfret at the entrance', 'Shallow second reef for the return'],
    hazards: 'Only with zero E-NE swell on the entry rocks; surge in the crack turns dives around and the exit takes local knowledge.',
    entry: 'Rock platform below The Skillion, from the small car park past the sports field.'
  },
  {
    id: 'two-poles-terrigal',
    mc: 746,
    name: 'Two Poles (Terrigal)',
    area: 'centralcoast', region: 'Terrigal',
    lat: -33.457, lng: 151.453, approx: true,   /* ~650 m off the cliffs north of the beach; alignment poles long gone */
    type: 'boat', depth: '12–19 m', level: 'Open Water',
    marineZone: 'terrigal', weatherZone: 'theentrance',
    exposure: [0.62, 0.70, 0.80, 0.76, 0.68, 0.10, 0.05, 0.20],
    swellTol: 1.0, baseVis: 9, runoff: 0.25,
    blurb: 'A sand-floored gutter 10 m wide cut into the reef off Terrigal’s cliffs, edges dotted with dozens of small bright gorgonians, a seadragon spot with a resident wobbegong.',
    highlights: ['Gorgonian-lined gutter', 'Seadragon sighting', 'Resident wobbegong', 'Easy navigation'],
    hazards: 'Nothing specific; named for shore alignment poles that no longer exist.',
    entry: 'Boat about 650 m off the cliffs north of Terrigal Beach.'
  },
  {
    id: 'terrigal-haven',
    name: 'Terrigal Haven',
    area: 'centralcoast', region: 'Terrigal',
    lat: -33.447, lng: 151.4496,   /* in the Haven off the boat-ramp steps, tile-verified; Dive Swansea shore-dive guide, not in McFadyen */
    type: 'shore', depth: '3–15 m', level: 'Open Water',
    marineZone: 'terrigal', weatherZone: 'theentrance',
    exposure: [0.32, 0.35, 0.25, 0.10, 0.05, 0.03, 0.04, 0.12],
    swellTol: 1.0, baseVis: 7, runoff: 0.4,
    blurb: 'The Central Coast’s everyday shore dive, tucked behind the Skillion: seagrass and sand flats under the moorings, a giant anchor at 10 m off the point, and a sunken boat trailer further out with resident seahorses. (Not in McFadyen’s guides; from Dive Swansea’s shore-dive guide.)',
    highlights: ['Giant anchor at 10 m', 'Seahorses on the old trailer', 'Seagrass critter hunting', 'The southerly-day saviour'],
    hazards: 'Moored-boat and ramp traffic overhead, tow a flag; the deeper boulder side over the wall (to 14 m) is best saved for a second lap.',
    entry: 'Steps on the right of the Terrigal Haven boat ramp, following the rocks on the right-hand side out.'
  },
  {
    id: 'foggy-cave-terrigal',
    mc: 151,
    name: 'Foggy Cave (Terrigal)',
    area: 'centralcoast', region: 'Terrigal',
    lat: -33.400637, lng: 151.537523,   /* McFadyen p151 (WGS84), matches GPX FOGGYC */
    type: 'boat', depth: '30–39 m', level: 'Advanced',
    marineZone: 'terrigal', weatherZone: 'theentrance',
    exposure: [0.58, 0.65, 0.72, 0.70, 0.62, 0.10, 0.05, 0.18],
    swellTol: 1.2, baseVis: 11, runoff: 0.15,
    blurb: 'Overhanging wall that elbows around a sand-floored cave 15 m deep and 10 wide, hung with gorgonians in every colour; a planned-deco favourite of the Terrigal boats.',
    highlights: ['Sand-floored cave at 34 m', 'Overhanging corner wall', 'Multicoloured gorgonians', 'Moored site, easy descent'],
    hazards: 'Run as a planned decompression dive at 30-39 m; fin wash clouds the cave floor fast.',
    entry: 'Mooring 3 km north of Terrigal Haven.'
  },
  {
    id: 'ss-galava',
    mc: 701,
    name: 'SS Galava (wreck)',
    area: 'centralcoast', region: 'Terrigal',
    lat: -33.459248, lng: 151.513347, wreck: true,   /* McFadyen p701 (WGS84), matches marks 526 + GPX */
    type: 'boat', depth: '45–51 m', level: 'Deep / Tech',
    marineZone: 'terrigal', weatherZone: 'theentrance',
    exposure: [0.55, 0.62, 0.70, 0.68, 0.60, 0.10, 0.05, 0.18],
    swellTol: 1.25, baseVis: 11, runoff: 0.15,
    blurb: '1927 collier upright on the sand at 51 m: offset engine on its side, one-bladed prop hard aport, and a bow section with winches and raised bowsprit 15 m on. Fish life he compares to the Tuggerah.',
    highlights: ['Engine, boiler & rudder hard aport', 'Bow with standing bowsprit', 'Tuggerah-class fish life', 'Light mooring (small craft, settled days)'],
    hazards: 'Proper deep dive: staged deco after short bottom time; midsection is the most collapsed and snaggy.',
    entry: 'Boat 6.6 km from Terrigal Haven; use the light mooring only in settled weather.'
  },
  {
    id: 'tss-hall-caine',
    mc: 152,
    name: 'TSS Hall Caine (wreck)',
    area: 'centralcoast', region: 'Bouddi',
    lat: -33.541117, lng: 151.423883, wreck: true,   /* marks page 526 (WGS84, TESTED), matches GPX HALLCA */
    type: 'boat', depth: '38–45 m', level: 'Deep / Tech',
    marineZone: 'terrigal', weatherZone: 'theentrance',
    exposure: [0.55, 0.62, 0.70, 0.68, 0.60, 0.10, 0.05, 0.18],
    swellTol: 1.25, baseVis: 11, runoff: 0.15,
    blurb: 'Tug scuttled off Bouddi in 1937: a lone boiler standing to 38 m dressed in sea fans, twin engines showing copper and brass, and conger eels denning in the fireboxes.',
    highlights: ['Boiler draped in sea fans', 'Twin engines, brass showing', 'Conger eels in the fireboxes', 'Quiet, rarely-dived site'],
    hazards: 'Deep and experienced-only; old fishing net and rope snag parts of the wreck.',
    entry: 'Boat off Bouddi National Park; the old marker buoy is likely gone, use GPS.'
  },

  /* ---------- Wollongong ---------- */
  {
    id: 'ss-bombo',
    mc: 81,
    name: 'SS Bombo (wreck)',
    area: 'wollongong', region: 'Port Kembla',
    lat: -34.444672, lng: 150.925772, wreck: true,   /* McFadyen p81 (WGS84), matches GPX BOMBO */
    type: 'boat', depth: '25–32 m', level: 'Advanced',
    marineZone: 'fiveislands', weatherZone: 'portkembla',
    exposure: [0.55, 0.62, 0.72, 0.72, 0.66, 0.10, 0.05, 0.16],
    swellTol: 1.2, baseVis: 8, runoff: 0.25,
    blurb: '540-ton collier and WWII minesweeper HMAS Bombo, capsized in 1949 almost in the Port Kembla shipping channel: an upturned hull split in two, engine, boiler and driveshaft exposed, prop still on the severed stern.',
    highlights: ['Upturned split hull', 'Engine & driveshaft exposed', 'Prop on the broken stern', 'Wartime history'],
    hazards: 'Beside the shipping lane: confirm with the harbourmaster that nothing is due before anchoring. Steady 32 m on a collapsing hull; vis often worse than the surface suggests.',
    entry: 'Boat from Port Kembla; transit marks line up on the stern, the only spot an anchor still bites.'
  },
  {
    id: 'toothbrush-island-cave',
    mc: 140,
    name: 'Toothbrush Island Cave',
    area: 'wollongong', region: 'Five Islands',
    lat: -34.454517, lng: 150.9301,   /* McFadyen p140 (WGS84), matches GPX TOOTH CAVE */
    type: 'boat', depth: '9–16 m', level: 'Advanced',
    marineZone: 'fiveislands', weatherZone: 'portkembla',
    exposure: [0.60, 0.70, 0.80, 0.78, 0.72, 0.12, 0.05, 0.18],
    swellTol: 0.95, baseVis: 8, runoff: 0.3,
    blurb: 'Parallel gutters fan out from Flinders (Toothbrush) Island’s north-east tip into a cave running 15-20 m back under the island, red rock cod at the mouth and seadragons in the kelp outside.',
    highlights: ['15-20 m cave under the island', 'Gutter maze approach', 'Red rock cod at the entrance', 'Seadragons in the kelp'],
    hazards: 'Fine silt floors the cave and clouds fast; the look-alike gutters disorient without a plan.',
    entry: 'Boat from Port Kembla’s outer ramp; anchor south of a gutter in about 9 m on the reef top.'
  },
  {
    id: 'toothpaste-toothbrush-south',
    mc: 568,
    name: 'Toothpaste (Toothbrush Island South)',
    area: 'wollongong', region: 'Five Islands',
    lat: -34.458533, lng: 150.9273,   /* McFadyen p568 (WGS84), matches GPX TOOTHS */
    type: 'boat', depth: '10–24 m', level: 'Advanced',
    marineZone: 'fiveislands', weatherZone: 'portkembla',
    exposure: [0.55, 0.65, 0.80, 0.82, 0.78, 0.14, 0.05, 0.15],
    swellTol: 1.05, baseVis: 8, runoff: 0.3,
    blurb: 'Colour-drenched wall along the island’s southern end, sponges and sea squirts all the way down to the sand at 24 m.',
    highlights: ['Vivid sponge wall', 'Sea-squirt colour beds', 'Gropers & morwong', 'Pairs with the Cave for a two-dive day'],
    hazards: 'Anchor placement depends on the wind; the south end takes the brunt of any southerly swell.',
    entry: 'Boat from Port Kembla, anchoring off the south end to suit the wind.'
  },
  {
    id: 'pig-island-se',
    mc: 141,
    name: 'Pig Island South East',
    area: 'wollongong', region: 'Five Islands',
    lat: -34.465918, lng: 150.946435,   /* McFadyen p141 (WGS84), matches GPX PIGIS */
    type: 'boat', depth: '18–25 m', level: 'Advanced',
    marineZone: 'fiveislands', weatherZone: 'portkembla',
    exposure: [0.58, 0.68, 0.80, 0.82, 0.76, 0.13, 0.05, 0.16],
    swellTol: 1.05, baseVis: 8, runoff: 0.25,
    blurb: 'Dense lace-coral beds and heavy fish traffic on Big Island’s south-eastern flank: pomfret and sweep in schools, gropers working the boulders, wobbegongs parked in the gaps.',
    highlights: ['Lace-coral beds', 'Pomfret & sweep schools', 'Big blue gropers', 'Wobbegongs everywhere'],
    hazards: 'Exposed corner of the group; standard deep-ish boat planning.',
    entry: 'Boat from Port Kembla; anchor off the SE corner.'
  },
  {
    id: 'pig-island-ne',
    mc: 142,
    name: 'Pig Island North East',
    area: 'wollongong', region: 'Five Islands',
    lat: -34.46304, lng: 150.945778,   /* McFadyen p142 (WGS84), matches GPX PIGNTH */
    type: 'boat', depth: '15–26 m', level: 'Advanced',
    marineZone: 'fiveislands', weatherZone: 'portkembla',
    exposure: [0.60, 0.70, 0.80, 0.78, 0.70, 0.12, 0.05, 0.18],
    swellTol: 1.05, baseVis: 8, runoff: 0.25,
    blurb: 'Open sponge slope off Big Island’s north-east side, no wall to follow, just spreading gardens with the odd tropical stray (a bannerfish and Moorish idol turned up one February).',
    highlights: ['Spreading sponge slope', 'Occasional tropical strays', 'Morwong & luderick', 'Quieter than the SE corner'],
    hazards: 'Featureless slope: watch your bearings back to the anchor.',
    entry: 'Boat from Port Kembla; anchor on the NE slope.'
  },
  {
    id: 'martin-island',
    mc: 143,
    name: 'Martin Island',
    area: 'wollongong', region: 'Five Islands',
    lat: -34.49351, lng: 150.938542,   /* McFadyen p143 (WGS84), matches GPX MARTIN */
    type: 'boat', depth: '10–30 m', level: 'Advanced',
    marineZone: 'fiveislands', weatherZone: 'portkembla',
    exposure: [0.58, 0.68, 0.80, 0.85, 0.80, 0.15, 0.05, 0.15],
    swellTol: 1.05, baseVis: 8, runoff: 0.25,
    blurb: 'The southern-most and most exposed of the Five Islands: a wall to 30 m, winter PJ sharks, and since 2009 a haul-out crowd of Australian fur seals, sometimes 50 strong, that buzz divers.',
    highlights: ['Fur seal fly-bys (up to ~50)', 'Wall to 30 m', 'PJ sharks in winter', 'Wildest of the Five Islands'],
    hazards: 'Most exposed of the group: first to blow out in a southerly; keep clear margins from the seal haul-out.',
    entry: 'Boat from Port Kembla; anchor in the island’s lee for the conditions.'
  },
  {
    id: 'pinnacle-port-kembla',
    name: 'The Pinnacle (Port Kembla)',
    area: 'wollongong', region: 'Five Islands',
    lat: -34.465617, lng: 150.950667,   /* his GPX mark PINNACLE PK, never written up; United Divers guide (archived) corroborates */
    type: 'boat', depth: '18–30 m', level: 'Advanced',
    marineZone: 'fiveislands', weatherZone: 'portkembla',
    exposure: [0.58, 0.68, 0.80, 0.82, 0.76, 0.13, 0.05, 0.16],
    swellTol: 1.15, baseVis: 9, runoff: 0.2,
    blurb: 'The bommie 500 m seaward of Pig Island that McFadyen marked but never wrote up: a pinnacle from 18 m falling to 30, patrolled by kingfish with sponge colour down the flanks. (From United Divers Wollongong’s site guide.)',
    highlights: ['Pinnacle 18 to 30 m', 'Kingfish patrols', 'Sponge-clad flanks', 'His own GPS mark, finally used'],
    hazards: 'Open-water pinnacle beyond the islands: current and swell decide the day.',
    entry: 'Boat from Port Kembla, about 500 m east of Pig Island.'
  },
  {
    id: 'flagstaff-point-wollongong',
    name: 'Flagstaff Point (Wollongong)',
    area: 'wollongong', region: 'Wollongong City',
    lat: -34.4254, lng: 150.9094, approx: true,   /* rock platform below Flagstaff Hill; Illawarra Flame diver column */
    type: 'shore', depth: '5–8 m', level: 'Open Water',
    marineZone: 'fiveislands', weatherZone: 'portkembla',
    exposure: [0.55, 0.65, 0.75, 0.70, 0.60, 0.10, 0.05, 0.18],
    swellTol: 0.75, baseVis: 7, runoff: 0.35,
    blurb: 'The city shore dive under the Wollongong lighthouses: kelp gutters and boulder reef off the Flagstaff Hill platform, an easy poke when the sea sits down. (Not in McFadyen’s guides; documented by the Illawarra Flame’s diving column.)',
    highlights: ['Lighthouse-backdrop reef', 'Kelp gutters & boulders', 'Minutes from the harbour', 'Easy when flat'],
    hazards: 'Open platform entry: small seas only, and mind fishers’ lines off the point.',
    entry: 'Short scramble from the Flagstaff Hill reserve to the platform.'
  },

  /* ---------- Shellharbour & Kiama ---------- */
  {
    id: 'the-gutter-bass-point',
    mc: 139,
    name: 'The Gutter (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.593, lng: 150.9, approx: true,   /* NW corner of the main Bass Point Reserve car park; no printed GPS */
    type: 'shore', depth: '3–20 m', level: 'Open Water',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.60, 0.55, 0.45, 0.30, 0.20, 0.08, 0.05, 0.25],
    swellTol: 0.9, baseVis: 8, runoff: 0.3,
    blurb: 'The classic Bass Point shore dive: an incised gutter and canyon system off the north shore, a resident ray at the mouth, seadragons in the colourful side gutter at 20 m.',
    highlights: ['Incised gutter & canyon', 'Weedy seadragons', 'Resident ray at the mouth', 'Sponge Gardens extension for the fit'],
    hazards: 'Kelp has spread where urchins were illegally culled; the Sponge Gardens extension adds real distance and depth, save it for a separate plan.',
    entry: 'From the NW corner of the main car park, across the grass and platform into the gutter.'
  },
  {
    id: 'bushrangers-bay',
    mc: 134,
    name: 'Bushrangers Bay (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.5973, lng: 150.9004, approx: true,   /* stairway from the second (inner) reserve car park; no printed GPS */
    type: 'shore', depth: '3–20 m', level: 'Open Water',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.55, 0.50, 0.42, 0.28, 0.18, 0.08, 0.05, 0.22],
    swellTol: 0.95, baseVis: 8, runoff: 0.3,
    blurb: 'Figure-eight no-take aquatic reserve with a stairway entry, the relaxed first dive of a Bass Point day, and since 2018 a grey nurse hangout (30-plus counted over the 2022-23 summer).',
    highlights: ['Grey nurse in the bay (recent years)', 'No-take reserve tameness', 'Bullseyes & leatherjacket variety', 'Easy stairway entry'],
    hazards: 'Depth falls away fast past the bay mouth; hand-feeding gropers on culled urchins is illegal here. Access road closes on total fire ban days.',
    entry: 'Stairway from the second (inner) car park in Bass Point Reserve.'
  },
  {
    id: 'gravel-loader-bass-point',
    mc: 132,
    name: 'Gravel Loader (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.5932, lng: 150.8895, approx: true,   /* old boat ramp east of the disused loader; no printed GPS */
    type: 'shore', depth: '2–12 m', level: 'Open Water',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.60, 0.55, 0.45, 0.30, 0.20, 0.08, 0.05, 0.25],
    swellTol: 0.9, baseVis: 8, runoff: 0.3,
    blurb: 'Junkyard-easy shore dive under the old gravel loader: girders, pylons, an anchor and chain, and since late 2016 a surprise crowd of mostly juvenile grey nurse at the seaward end.',
    highlights: ['Grey nurse under the loader', 'Old anchor & chain', 'Cuttlefish & squid', 'Sheltered and shallow'],
    hazards: 'Benign in the water; the reserve road shuts on total fire bans.',
    entry: 'Old boat ramp just east of the loader; snorkel out along the structure.'
  },
  {
    id: 'ss-cities-service-boston',
    mc: 137,
    name: 'SS Cities Service Boston (wreck)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.5925, lng: 150.9035, wreck: true, approx: true,   /* NE-tip rock shelf by the memorial; wreckage in the surf zone */
    type: 'shore', depth: '0–5 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.60, 0.65, 0.70, 0.60, 0.45, 0.10, 0.05, 0.20],
    swellTol: 0.6, baseVis: 6, runoff: 0.3,
    blurb: 'US tanker driven onto Bass Point in a 1943 gale, four soldiers died in the rescue attempt: salvage left scattered plate, boiler sections and engine parts in the surf zone by the memorial.',
    highlights: ['Boiler & engine fragments', 'Wartime story and memorial', 'Snorkel-depth history', 'Combine with The Gutter'],
    hazards: 'Sharp metal in the wash zone on an exposed shelf: dead-flat seas only, and even then treat it as a poke around, not a dive.',
    entry: 'Over the rock shelf at the reserve’s north-east tip, near the shipwreck memorial.'
  },
  {
    id: 'bass-point-bommie',
    mc: 131,
    name: 'Bass Point Bommie',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.597187, lng: 150.905007,   /* McFadyen p131 (WGS84), matches GPX BASPTW */
    type: 'boat', depth: '3–30 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.55, 0.65, 0.80, 0.85, 0.80, 0.15, 0.05, 0.15],
    swellTol: 0.95, baseVis: 9, runoff: 0.25,
    blurb: 'Sheer-walled bommie rising to 3 m off the point: nannygai and yellowtail schools around the crest, bull rays over the sand, and ledges cut into the wall at 15-18 m.',
    highlights: ['Sheer bommie wall', 'Nannygai & yellowtail schools', 'Bull rays on the sand', 'Ledge line at 15-18 m'],
    hazards: 'The crest can break in modest swell, keep track of where it sits; boat traffic uses the channel inside it.',
    entry: 'Boat from Shellharbour ramp; anchor off the bommie, never on its top.'
  },
  {
    id: 'bass-point-island-north',
    mc: 133,
    name: 'Bass Point Island North',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.595932, lng: 150.907183,   /* McFadyen p133 (WGS84) */
    type: 'boat', depth: '10–26 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.60, 0.68, 0.80, 0.80, 0.72, 0.13, 0.05, 0.16],
    swellTol: 1.0, baseVis: 9, runoff: 0.25,
    blurb: 'Sponge-and-gorgonia slope off the islet’s north side, with vertical walls closer in and narrow north-south cracks stacked with sweep and winter PJ sharks.',
    highlights: ['Gorgonia slopes', 'Cracks full of sweep', 'PJ sharks in winter', 'Old wife schools'],
    hazards: 'Standard exposure and depth planning; a mooring existed here in 2001, verify before use.',
    entry: 'Boat from Shellharbour; mooring or anchor north of the islet.'
  },
  {
    id: 'bass-point-island-south',
    mc: 565,
    name: 'Bass Point Island South',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.597668, lng: 150.906632,   /* McFadyen p565 (WGS84) */
    type: 'boat', depth: '15–32 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.55, 0.65, 0.80, 0.85, 0.80, 0.15, 0.05, 0.15],
    swellTol: 1.05, baseVis: 9, runoff: 0.25,
    blurb: 'Steep boulder slope and a big vertical wall on the islet’s exposed side, bottoming past 30 m, sponges and gorgonias thickening with depth.',
    highlights: ['Vertical wall to 24 m', 'Big boulders & gorgonias', 'Red rock cod', 'Deeper, moodier sibling of the North side'],
    hazards: 'Bottom reaches 32 m off the edge: plan gas and no-deco accordingly.',
    entry: 'Boat from Shellharbour; anchor off the southern reef edge.'
  },
  {
    id: 'rons-wall-bass-point',
    mc: 567,
    name: 'Rons Wall (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.592837, lng: 150.908498,   /* McFadyen p567 (WGS84), matches GPX RONWAL */
    type: 'boat', depth: '12–29 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.58, 0.66, 0.80, 0.82, 0.75, 0.14, 0.05, 0.16],
    swellTol: 1.0, baseVis: 9, runoff: 0.25,
    blurb: 'Reef-edge wall between Bass Point and the islet, running dense multi-coloured gorgonia gardens, with an unusually friendly male eastern king wrasse working the mooring.',
    highlights: ['Rare tame eastern king wrasse', 'Pink-to-purple gorgonia gardens', 'Old wife in numbers', 'Reef-edge navigation line'],
    hazards: 'High-20s depth between the point and islet; mind no-deco limits.',
    entry: 'Boat from Shellharbour; mooring on the reef edge.'
  },
  {
    id: 'slipper-reef-bass-point',
    mc: 566,
    name: 'Slipper Reef (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.591243, lng: 150.90705,   /* McFadyen p566 (WGS84), matches GPX SLIPRF */
    type: 'boat', depth: '12–29 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.58, 0.66, 0.78, 0.80, 0.72, 0.13, 0.05, 0.16],
    swellTol: 1.0, baseVis: 9, runoff: 0.25,
    blurb: 'Boulder ground north of the Rons Wall mooring, crowded with bigeyes and the occasional cuttlefish, sharing the same king-wrasse celebrity.',
    highlights: ['Bigeye boulders', 'Tame king wrasse', 'Leatherjacket variety', 'Easy pair with Rons Wall'],
    hazards: 'Runs toward 29 m north of the mooring; plan the profile first.',
    entry: 'Boat from Shellharbour; same mooring area as Rons Wall.'
  },
  {
    id: 'hump-one-bass-point',
    mc: 135,
    name: 'Hump One (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.585428, lng: 150.912817,   /* McFadyen p135 (WGS84), matches GPX HUMP1 */
    type: 'boat', depth: '27–35 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.55, 0.63, 0.75, 0.78, 0.70, 0.12, 0.05, 0.15],
    swellTol: 1.15, baseVis: 10, runoff: 0.2,
    blurb: 'Pear-shaped deep reef you can lap in minutes, but you will not want to: the western gorgonia thickets are among the densest he has recorded, every fan crawling with seastars.',
    highlights: ['Densest gorgonia thickets', 'Seastars on every fan', 'Scenic east & south walls', 'Compact, deep, vivid'],
    hazards: 'Right-angle ledges give poor anchor holds; 27-35 m keeps bottom time short.',
    entry: 'Boat from Shellharbour; patient anchoring on the reef top.'
  },
  {
    id: 'hump-wall-bass-point',
    mc: 136,
    name: 'Hump Wall (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.585658, lng: 150.911088,   /* McFadyen p136 (WGS84), matches GPX HUMPW */
    type: 'boat', depth: '23–34 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.55, 0.63, 0.75, 0.78, 0.70, 0.12, 0.05, 0.15],
    swellTol: 1.15, baseVis: 10, runoff: 0.2,
    blurb: 'Wall and slope beside Hump One, blanketed in thousands of 15 mm white feather stars over the sponge beds, cuttlefish and morays in the deep section.',
    highlights: ['Feather-star blanket', 'Cuttlefish & morays deep', 'Mado swarms', 'Nitrox-friendly profile'],
    hazards: 'About 15-20 minutes of no-deco on air at depth; nitrox stretches it to ~30.',
    entry: 'Boat from Shellharbour; anchor on the wall top.'
  },
  {
    id: 'the-arch-bass-point',
    mc: 138,
    name: 'The Arch (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.599633, lng: 150.902002,   /* McFadyen p138 (WGS84), matches GPX ARCHBP */
    type: 'boat', depth: '18–26 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.52, 0.62, 0.78, 0.85, 0.80, 0.15, 0.05, 0.14],
    swellTol: 1.0, baseVis: 9, runoff: 0.25,
    blurb: 'A 20 m arch tunnel, 10 wide and head-high, running seaward over sand, with a two-chamber cave to its west where PJ sharks pack in over winter.',
    highlights: ['20 m arch swim', 'Two-chamber cave', 'Winter PJ shark packs', 'Sand-floored gallery light'],
    hazards: 'Usually a boat dive; the shore approach has a brutal exit if wind rises, the fallback is a long swim east into Bushrangers Bay.',
    entry: 'Boat from Shellharbour, anchoring off the point’s southern face.'
  },
  {
    id: 'afghan-reef-kiama',
    mc: 130,
    name: 'Afghan Reef (Kiama)',
    area: 'shellharbour', region: 'Kiama',
    lat: -34.6706, lng: 150.8628, approx: true,   /* platform gutter north of the Blowhole; no printed GPS */
    type: 'shore', depth: '4–18 m', level: 'Open Water',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.55, 0.70, 0.80, 0.70, 0.55, 0.10, 0.05, 0.15],
    swellTol: 0.85, baseVis: 8, runoff: 0.3,
    blurb: 'Cleared igneous reef off the Blowhole’s north side: seadragons on the sand edge, yellowtail and seapike in bulk, entered through the boulder-backed Afghan Gutter.',
    highlights: ['Seadragons on the sand line', 'Yellowtail & seapike schools', 'Kiama’s pink igneous rock', 'Blowhole-point setting'],
    hazards: 'Rock fishers work the same platform, watch for lines; several similar gutters make it easy to surface in the wrong one.',
    entry: 'North Blowhole car park; cross the platform to the gutter behind the big boulder (also the exit ramp).'
  },
  {
    id: 'kiama-point',
    mc: 762,
    name: 'Kiama Point',
    area: 'shellharbour', region: 'Kiama',
    lat: -34.6692, lng: 150.8624, approx: true,   /* entry beside the ocean pool north of Kiama Harbour */
    type: 'shore', depth: '5–17 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.50, 0.55, 0.50, 0.40, 0.30, 0.08, 0.05, 0.15],
    swellTol: 0.9, baseVis: 8, runoff: 0.35,
    blurb: 'A 45-minute point-to-harbour circuit past a resident bull ray, PJ sharks on the sand ridges and mados thickening as you round into the harbour mouth.',
    highlights: ['Resident bull ray in the gutter', 'PJ & horned sharks', 'Pink igneous walls', 'Pebble-inlet exit inside the harbour'],
    hazards: 'Runs close to the harbour entrance: hug the wall away from boat traffic and plan gas for the long swim.',
    entry: 'Beside the ocean pool north of Kiama Harbour, exiting at the pebble inlet inside the outer wall.'
  },
  {
    id: 'blind-shark-reef-kiama',
    mc: 761,
    name: 'Blind Shark Reef (Kiama)',
    area: 'shellharbour', region: 'Kiama',
    lat: -34.665733, lng: 150.863238,   /* McFadyen p761 (WGS84), matches GPX BLINDS */
    type: 'boat', depth: '10–15 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.55, 0.65, 0.80, 0.82, 0.75, 0.14, 0.05, 0.15],
    swellTol: 0.95, baseVis: 9, runoff: 0.25,
    blurb: 'Walled reef off Kiama named for the blind sharks tucked under its eastern ledges, with pullers in clouds above the sponge growth.',
    highlights: ['Blind sharks under the ledges', 'Eastern wall line', 'One-spot puller clouds', 'Own-boat exclusivity'],
    hazards: 'No charter runs from Kiama: own boat only. Uniform boulders make navigation tricky.',
    entry: 'Own boat from Kiama Harbour; anchor over the eastern wall.'
  },
  {
    id: 'the-olgas-kiama',
    mc: 760,
    name: 'The Olgas (Kiama)',
    area: 'shellharbour', region: 'Kiama',
    lat: -34.62425, lng: 150.876097,   /* McFadyen p760 (WGS84), matches GPX OLGAS */
    type: 'boat', depth: '20–24 m', level: 'Advanced',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.55, 0.65, 0.80, 0.82, 0.75, 0.14, 0.05, 0.15],
    swellTol: 1.0, baseVis: 9, runoff: 0.25,
    blurb: 'Huge close-packed boulders that reminded the naming divers of Kata Tjuta, every dome coated in vivid sponge and sea-squirt colour, numbrays in the gaps.',
    highlights: ['Kata Tjuta boulder domes', 'Vivid sponge coat', 'Numbrays', 'Silver sweep overhead'],
    hazards: 'Own boat only (no Kiama charter); uniform domes with no wall to steer by.',
    entry: 'Own boat north from Kiama Harbour; anchor among the domes.'
  },
  {
    id: 'maloneys-bay-bass-point',
    name: 'Maloneys Bay (Bass Point)',
    area: 'shellharbour', region: 'Bass Point',
    lat: -34.5899, lng: 150.8776, approx: true,   /* western beach of Bass Point Reserve, shared car park; Deep Sensations guide */
    type: 'shore', depth: '3–20 m', level: 'Open Water',
    marineZone: 'basspoint', weatherZone: 'shellharbour',
    exposure: [0.45, 0.40, 0.30, 0.18, 0.12, 0.06, 0.05, 0.20],
    swellTol: 0.95, baseVis: 8, runoff: 0.3,
    blurb: 'The quiet western beach of Bass Point Reserve: seagrass shallows sliding to kelp reef past 10 m, favoured by freedivers for its easy entry and long sightlines. (Not in McFadyen’s guides; from Deep Sensations’ site guide.)',
    highlights: ['Seagrass-to-reef gradient', 'Freediver-friendly lines', 'Rays & squid over the grass', 'Shares the reserve car park'],
    hazards: 'Boat traffic from the nearby ramp on weekends; depth builds steadily toward the point.',
    entry: 'Beach entry at Maloneys Bay, west side of Bass Point Reserve.'
  },

  /* ---------- Jervis Bay & Shoalhaven ---------- */
  {
    id: 'sir-john-young-banks',
    mc: 129,
    name: 'Sir John Young Banks',
    area: 'jervis', region: 'Shoalhaven offshore',
    lat: -34.94819, lng: 150.929392,   /* McFadyen p129 (18 m reef mark, WGS84, matches GPX BANK18) */
    type: 'boat', depth: '16–48 m', level: 'Deep / Tech',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.60, 0.70, 0.80, 0.80, 0.75, 0.15, 0.05, 0.15],
    swellTol: 1.25, baseVis: 14, runoff: 0.2, waterBody: 'shoalhaven',
    blurb: 'Remote bank 17 km off Crookhaven stepping from 16 m past 60: tiger anemones on the sea whips, huge cuttlefish, and a pelagic log that includes hammerheads and an oceanic whitetip.',
    highlights: ['Big-animal pelagic record', 'Tiger anemones on sea whips', 'Stepped reefs 18/30/48 m', 'Nobody else out there'],
    hazards: 'Northerly current is the rule, marks are hard to find, and no charter services it: own boat, own planning, own margin.',
    entry: 'Private boat from Crookhaven/Greenwell Point; three marks for the 18, 30 and 48 m reefs.'
  },
  {
    id: 'tss-merimbula',
    mc: 117,
    name: 'TSS Merimbula (wreck)',
    area: 'jervis', region: 'Currarong',
    lat: -35.002884, lng: 150.829503, wreck: true,   /* marks page 526 (WGS84); his page's AGD66 figure sits ~200 m off, as he warns */
    type: 'boat', depth: '4–13 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.70, 0.80, 0.75, 0.55, 0.35, 0.10, 0.05, 0.25],
    swellTol: 0.85, baseVis: 10, runoff: 0.25,
    blurb: 'Coastal steamer that ran onto Whale Point in 1928: twin engines fallen clear of the hull, a boiler each side, and the historic-listed bow gear in shallow, sunlit water.',
    highlights: ['Twin engines & paired boilers', 'Bow winch and anchor', 'Historic-listed wreck', 'Bright 13 m maximum'],
    hazards: 'Hard against exposed rock with part of the bow above water: surge rules it out in anything but calm seas.',
    entry: 'Boat from Currarong, anchoring off Whale Point clear of the wreckage.'
  },
  {
    id: 'tss-wandra',
    mc: 118,
    name: 'TSS Wandra (wreck)',
    area: 'jervis', region: 'Currarong',
    lat: -35.045035, lng: 150.839142, wreck: true,   /* McFadyen p118 (WGS84), matches GPX WANDRA */
    type: 'boat', depth: '24–26 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.65, 0.80, 0.85, 0.75, 0.60, 0.12, 0.05, 0.20],
    swellTol: 1.1, baseVis: 12, runoff: 0.2,
    blurb: '1915 wreck at the foot of the Beecroft cliffs: a boiler against the reef sheltering morays and congers, tiny twin engines still on their shafts, timber cargo strewn over the sand.',
    highlights: ['Boiler full of eels', 'Twin engines & mini props', 'Timber cargo on the sand', 'Cliff-foot setting'],
    hazards: 'A long way from shelter: settled weather needed just to anchor. Near the Drum and Drumsticks, worth combining.',
    entry: 'Boat from Currarong along the ocean cliffs.'
  },
  {
    id: 'crocodile-head',
    mc: 120,
    name: 'Crocodile Head',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.028, lng: 150.8398, approx: true,   /* headland 1.6 km north of Point Perpendicular; no printed GPS */
    type: 'boat', depth: '5–24 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.50, 0.65, 0.85, 0.90, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.0, baseVis: 12, runoff: 0.15,
    blurb: 'L-shaped arch reaching 20 m up the cliff face, a long north-side cave, and smaller caves where up to seven blue devilfish shelter at once.',
    highlights: ['20 m L-shaped arch', 'Blue devilfish caves', 'Long cliff-foot cave', 'Boulder gardens'],
    hazards: 'Swimming the arch end to end is calm-sea-only; ocean-cliff exposure the whole dive.',
    entry: 'Boat from Currarong; anchor off the headland’s south flank, 15-20 m from the rocks.'
  },
  {
    id: 'crocodile-head-gorge',
    mc: 119,
    name: 'Crocodile Head Gorge',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.0272, lng: 150.8415, approx: true,   /* immediately seaward of Crocodile Head; no printed GPS */
    type: 'boat', depth: '30–55 m', level: 'Deep / Tech',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.48, 0.60, 0.80, 0.85, 0.78, 0.15, 0.05, 0.10],
    swellTol: 1.25, baseVis: 13, runoff: 0.15,
    blurb: 'A dead-end canyon off Crocodile Head, reef top at 30 m stepping past 50, walled in what he rates among the coast’s best fixed growth: gorgonias, sea whips, sea tulips.',
    highlights: ['Western-movie box canyon', 'Best-of-coast fixed growth', 'Ledges at 40 and 45 m', 'Big fish traffic'],
    hazards: 'Genuinely deep (53-55 m at the eastern end): very experienced, properly equipped divers only.',
    entry: 'Boat from Currarong; drop the pick into the gorge itself, the top barely holds.'
  },
  {
    id: 'the-crossroads-jervis',
    mc: 980,
    name: 'The Crossroads (Beecroft)',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.079, lng: 150.8215, approx: true,   /* north of The Arch along the ocean cliff; no published fix */
    type: 'boat', depth: '25–40 m', level: 'Deep / Tech',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.50, 0.65, 0.85, 0.90, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.2, baseVis: 13, runoff: 0.15,
    blurb: 'North-south wall dropping 30 to 40 m that likely joins The Arch’s gully system: tiger anemones on the whips, cracks full of fish, barely dived by anyone.',
    highlights: ['Wall 30 to 40 m', 'Tiger anemones', 'Unexplored feel', 'Links toward The Arch'],
    hazards: 'His crew ran 27% bottom gas with a deco bottle and still owed stops: plan it as a technical dive. No published mark, find the ledge on the sounder.',
    entry: 'Boat along the Beecroft cliffs; anchor on the 25-30 m ledge with generous scope.'
  },
  {
    id: 'the-arch-beecroft',
    mc: 121,
    name: 'The Arch (Beecroft)',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.083143, lng: 150.821172,   /* McFadyen p121 (WGS84), matches GPX ARCHJB */
    type: 'boat', depth: '25–40 m', level: 'Deep / Tech',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.50, 0.65, 0.85, 0.90, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.2, baseVis: 13, runoff: 0.15,
    blurb: 'A rock span bridging a 25 m gully at 37 m, roofed in gorgonias and sponge, with PJ shark counts as high as 60 in season.',
    highlights: ['Rock span at 37 m', 'Up to 60 PJ sharks recorded', 'Gorgonia-roofed gully', 'Seapike streaming through'],
    hazards: 'Twenty-odd minutes of bottom time at best; finding the gully depends on reading the sounder right.',
    entry: 'Boat along the cliffs north of Point Perpendicular.'
  },
  {
    id: 'whorehouse-labyrinth',
    mc: 122,
    name: 'The Whorehouse / Labyrinth',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.085923, lng: 150.817282,   /* McFadyen p122 (WGS84), matches GPX WHORE */
    type: 'boat', depth: '13–26 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.50, 0.65, 0.85, 0.88, 0.78, 0.15, 0.05, 0.12],
    swellTol: 1.05, baseVis: 13, runoff: 0.15,
    blurb: 'A massive flat slab propped on stone columns: a dozen doorways into one central chamber, shafts of sun cutting through at the right hour.',
    highlights: ['Dozen-doorway chamber', 'Sunbeam light show', 'Sweep & pike inside', 'Distinctive navigation puzzle'],
    hazards: 'An overhead cavern with many exits: keep buoyancy tidy and pick your doorway before committing.',
    entry: 'Boat along the Beecroft cliffs; anchor beside the slab.'
  },
  {
    id: 'sponge-gardens-perpendicular',
    mc: 123,
    name: 'Sponge Gardens (Point Perpendicular)',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.092522, lng: 150.799708,   /* McFadyen p123 (WGS84), matches GPX PERPIN */
    type: 'boat', depth: '5–34 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.48, 0.62, 0.82, 0.88, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.05, baseVis: 13, runoff: 0.15,
    blurb: 'Under the lighthouse: boulders draped in sponge to the 34 m sand, swim-throughs and caves from 12 m up, wobbegongs year-round with winter PJs.',
    highlights: ['Sponge-draped boulder field', 'Caves & swim-throughs shallow', 'Wobbegongs & winter PJs', 'Lighthouse cliff backdrop'],
    hazards: 'The lower boulder field runs past recreational no-deco comfort; big cliff swell reflections when any sea runs.',
    entry: 'Boat around Point Perpendicular; anchor over the mid-depth boulders.'
  },
  {
    id: 'inside-point-perpendicular',
    mc: 124,
    name: 'Inside Point Perpendicular',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.0889, lng: 150.7987, approx: true,   /* western corner where the headland bends into the bay; pyramid boulder */
    type: 'boat', depth: '5–32 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.15, 0.25, 0.50, 0.55, 0.35, 0.06, 0.03, 0.06],
    swellTol: 1.0, baseVis: 12, runoff: 0.25, tidePref: 'incoming', waterBody: 'jervisbay',
    blurb: 'Just inside the bay mouth at the Perpendicular bend: parma and sweep on the 20 m walls, shallow caves under the platform, and an easy drift on the flooding tide.',
    highlights: ['Pyramid boulder landmark', 'Shallow caves under the platform', 'Girdled parma schools', 'Gentle incoming-tide drift'],
    hazards: 'Depth depends entirely on where the boat settles, 5 to 32 m: agree the plan first.',
    entry: 'Boat inside the point; anchor north of the bend near the pyramid boulder.'
  },
  {
    id: 'the-docks-jervis',
    mc: 125,
    name: 'The Docks (Jervis Bay)',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.08205, lng: 150.795917,   /* McFadyen p125 (WGS84), between GPX DOCKSW/DOCKSE */
    type: 'boat', depth: '5–21 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.12, 0.20, 0.35, 0.40, 0.25, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 12, runoff: 0.25, waterBody: 'jervisbay',
    blurb: 'Cave city inside the bay: the Double Decker’s stacked caverns, a vertical shaft that doglegs out onto sand, and long overhangs under the big slabs.',
    highlights: ['Double Decker stacked caves', 'Vertical dogleg swim-through', 'Long Cave & Deco Rock Cave', 'Calm inside-bay water'],
    hazards: 'Vis drops after rough weather or rain; the tunnels are optional but want tidy buoyancy.',
    entry: 'Boat from Huskisson or Murrays; moorings inside the north shore.'
  },
  {
    id: 'darts-point-jervis',
    mc: 126,
    name: 'Darts Point (Jervis Bay)',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.0865, lng: 150.756, approx: true,   /* west of Longnose Point, inside the bay; tender drop */
    type: 'boat', depth: '8–20 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.12, 0.20, 0.35, 0.40, 0.25, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 11, runoff: 0.3, waterBody: 'jervisbay',
    blurb: 'Low parallel ridges over bouldered sand west of Longnose Point: cuttlefish, small rays and leatherjackets on an easy inside-bay drift.',
    highlights: ['Giant cuttlefish', 'Parallel ridge lines', 'Small rays on the sand', 'Relaxed drift profile'],
    hazards: 'Coordinate the pickup: the drift crosses several ridges near the end.',
    entry: 'Tender drop near the beach on Longnose Point’s north-west corner.'
  },
  {
    id: 'bombora-reef-jervis',
    mc: 127,
    name: 'Bombora Reef (Jervis Bay)',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.095, lng: 150.768, approx: true,   /* offshore of Longnose Point toward Bowen Island; crest breaks */
    type: 'boat', depth: '5–24 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.20, 0.30, 0.50, 0.55, 0.40, 0.08, 0.03, 0.06],
    swellTol: 0.8, baseVis: 12, runoff: 0.25, waterBody: 'jervisbay',
    blurb: 'Mid-bay bombora stepping from a 5 m crest through ledges to 24 m sand, swim-throughs at 10-12 m and bait schools wrapping the structure.',
    highlights: ['Stepped ledges 10/12/18 m', 'Swim-throughs at mid-depth', 'Yellowtail & sweep schools', 'Sand-boulder fringe'],
    hazards: 'The crest breaks in swell: nobody anchors on it when it is working.',
    entry: 'Boat between Longnose Point and Bowen Island; roll in over the crest or anchor deep.'
  },
  {
    id: 'fairey-firefly',
    mc: 128,
    name: 'Fairey Firefly VX381 (aircraft)',
    area: 'jervis', region: 'Jervis Bay',
    lat: -35.014812, lng: 150.738645, wreck: true,   /* McFadyen p128 (WGS84), matches GPX FAIREY */
    type: 'boat', depth: '13 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.10, 0.15, 0.30, 0.35, 0.22, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 11, runoff: 0.3, waterBody: 'jervisbay',
    blurb: 'A 1956 navy trainer ditched on a gunnery run, sitting flat and intact on the sand at 13 m: prop feathered in an X, canopy open, seatbelt still draped in the cockpit.',
    highlights: ['Intact airframe on sand', 'X-feathered four-blade prop', 'Open cockpit & belt', 'Living-history navy story'],
    hazards: 'Hard to relocate without a good fix; anchor off the airframe, never on it.',
    entry: 'Boat from Huskisson; drop a marker beside the plane, anchor clear.'
  },
  {
    id: 'middle-grounds-jervis',
    mc: 108,
    name: 'Middle Grounds (Jervis Bay)',
    area: 'jervis', region: 'Jervis Bay',
    lat: -35.106496, lng: 150.767837,   /* McFadyen p108 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '20–24 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.15, 0.25, 0.45, 0.50, 0.30, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 12, runoff: 0.3, waterBody: 'jervisbay',
    blurb: 'Isolated reef island in the bay mouth’s sand, terraced toward the ocean side, and one of the few spots still working when a big southerly closes the rest of the bay.',
    highlights: ['Sand-island reef patch', 'Stepped ocean-side terraces', 'Southerly-swell refuge', 'Open-water fish traffic'],
    hazards: 'Open water near the entrance: boat traffic and wind chop are the main factors.',
    entry: 'Boat from Huskisson or Murrays; anchor on the reef top.'
  },
  {
    id: 'the-nursery-jervis',
    mc: 109,
    name: 'The Nursery (Bowen Island)',
    area: 'jervis', region: 'Bowen Island',
    lat: -35.112615, lng: 150.766353,   /* McFadyen p109 (WGS84), matches GPX NURSEY */
    type: 'boat', depth: '3–14 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.12, 0.20, 0.35, 0.40, 0.25, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 12, runoff: 0.3, waterBody: 'jervisbay',
    blurb: 'Sheltered wall and scatter reef on Bowen’s inside corner, dense with bream, luderick and pullers, one of the bay’s favourite easy dives and a great night site.',
    highlights: ['Dense easy-depth fish life', 'Cracks in the low wall', 'Night-dive favourite', 'Mooring on site'],
    hazards: 'Big swell can break over the nearby point: shift further off the island when it does.',
    entry: 'Mooring inside Bowen Island’s northern corner.'
  },
  {
    id: 'aztec-reef-jervis',
    mc: 110,
    name: 'Aztec Reef (Bowen Island)',
    area: 'jervis', region: 'Bowen Island',
    lat: -35.111988, lng: 150.767447,   /* McFadyen p110 (WGS84), matches GPX AZTEC */
    type: 'boat', depth: '5–20 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.12, 0.20, 0.38, 0.42, 0.26, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 12, runoff: 0.3, tidePref: 'incoming', waterBody: 'jervisbay',
    blurb: 'Rock faces patterned with algal growth like Aztec carvings, seadragons by the handful (five within 10 m once), beside the Nursery on Bowen’s inside.',
    highlights: ['Aztec-carving algae patterns', 'Seadragons incl. juveniles', 'Resident rays', 'Pairs with the Nursery'],
    hazards: 'Outgoing tide runs harder through here; waves wrap the point in big swell.',
    entry: 'Boat beside the Nursery mooring area.'
  },
  {
    id: 'north-bowen-island',
    mc: 111,
    name: 'North Bowen Island',
    area: 'jervis', region: 'Bowen Island',
    lat: -35.11231, lng: 150.769785,   /* McFadyen p111 (WGS84), matches GPX NTHBOW */
    type: 'boat', depth: '5–30 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.15, 0.25, 0.50, 0.60, 0.35, 0.05, 0.03, 0.05],
    swellTol: 1.0, baseVis: 12, runoff: 0.25, waterBody: 'jervisbay',
    blurb: 'Boulder ground off Bowen’s north tip at the bay entrance: sea-squirt and gorgonia cover, up to ten seadragons a dive on the sand edge, squid on most visits.',
    highlights: ['Ten-seadragon dives', 'Squid nearly every time', 'Kingfish fly-bys', 'Gorgonia boulder cover'],
    hazards: 'At the mouth it still feels swell despite the shelter; open boulder terrain to 30 m.',
    entry: 'Boat to the island’s north tip; anchor over the boulders.'
  },
  {
    id: 'little-egypt-jervis',
    mc: 112,
    name: 'Little Egypt (Bowen Island)',
    area: 'jervis', region: 'Bowen Island',
    lat: -35.114537, lng: 150.772285,   /* McFadyen p112 (WGS84), matches GPX LITEGY */
    type: 'boat', depth: '5–34 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.25, 0.40, 0.65, 0.75, 0.55, 0.08, 0.03, 0.06],
    swellTol: 1.05, baseVis: 12, runoff: 0.2,
    blurb: 'Five pyramid rocks stepping down Bowen’s ocean corner, reef rising steeply from 34 m to the island, swim-throughs top and bottom.',
    highlights: ['Five pyramid rocks', 'Steep 34 m rise', 'Swim-throughs shallow & deep', 'Entrance-corner fish traffic'],
    hazards: 'The drop-off and swim-throughs ask for experience, his own recommendation.',
    entry: 'Boat off Bowen’s north-east corner.'
  },
  {
    id: 'pyramid-rock-jervis',
    mc: 113,
    name: 'Pyramid Rock (Jervis Bay)',
    area: 'jervis', region: 'Bowen Island',
    lat: -35.123147, lng: 150.772007,   /* McFadyen p113 (WGS84), matches GPX PYRAMD */
    type: 'boat', depth: '20–36 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.40, 0.55, 0.75, 0.85, 0.75, 0.12, 0.05, 0.10],
    swellTol: 1.1, baseVis: 13, runoff: 0.15,
    blurb: 'A 100 m-plus wall each way along Bowen’s ocean side with the state’s best tiger-anemone sea whips on the 36 m sand, boulders and gorgonias all the way up.',
    highlights: ['Best NSW tiger anemones', 'Long wall both directions', 'Gorgonia boulders', 'Seals sometimes drop in'],
    hazards: 'Anchor spot moves with the wind (reef top in westerlies, sand in southerlies); the Murrays gap shortcut needs high tide and care.',
    entry: 'Boat from Murrays Beach ramp, outside Bowen Island.'
  },
  {
    id: 'spider-cave-jervis',
    mc: 114,
    name: 'Spider Cave (Jervis Bay)',
    area: 'jervis', region: 'Jervis Bay south coast',
    lat: -35.137035, lng: 150.764507,   /* McFadyen p114 (WGS84), matches GPX SPIDER */
    type: 'boat', depth: '6–27 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.40, 0.55, 0.75, 0.85, 0.75, 0.12, 0.05, 0.10],
    swellTol: 1.0, baseVis: 13, runoff: 0.15,
    blurb: 'A cave running 80-100 m back under the cliff through three stacked entrances, climbing from 24 m to a final chamber near 7 m; rarely on any charter schedule.',
    highlights: ['80-100 m cave climb', 'Three stacked entrances', 'Final chamber at 7 m', 'Rarely another diver'],
    hazards: 'Long, dark overhead penetration: torches, line discipline and cave-comfort required.',
    entry: 'Boat south of Bowen Island along the outside cliffs.'
  },
  {
    id: 'stoney-creek-jervis',
    mc: 115,
    name: 'Stoney Creek (Jervis Bay)',
    area: 'jervis', region: 'Jervis Bay south coast',
    lat: -35.16537, lng: 150.767285,   /* McFadyen p115 (WGS84), matches GPX STONEY */
    type: 'boat', depth: '34–50 m', level: 'Deep / Tech',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.42, 0.55, 0.70, 0.85, 0.80, 0.15, 0.05, 0.10],
    swellTol: 1.25, baseVis: 15, runoff: 0.1,
    blurb: 'His pick for the single best Jervis dive: a 37 m reef top falling in one sheer face past 50, with 25-35 m visibility often showing the whole wall at once.',
    highlights: ['Sheer 37-to-50 m face', 'Regular 25-35 m vis', 'Gorgonian gallery', 'Big-country atmosphere'],
    hazards: 'Nearly always current, often enough to abort; past-40 m planning is mandatory.',
    entry: 'Boat run south along the cliffs from Murrays.'
  },
  {
    id: 'alyssas-playground-jervis',
    mc: 981,
    name: 'Alyssas Playground (Jervis Bay)',
    area: 'jervis', region: 'Jervis Bay south coast',
    lat: -35.179117, lng: 150.730433,   /* McFadyen p981 (WGS84) */
    type: 'boat', depth: '10–25 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.42, 0.55, 0.70, 0.85, 0.80, 0.15, 0.05, 0.10],
    swellTol: 1.0, baseVis: 13, runoff: 0.15,
    blurb: 'Cliff-fall boulders ending at two fur-seal colonies near Steamers Beach, 30-40 animals that come and play; a mola mola has crashed the party.',
    highlights: ['Playful fur seals', 'Huge cliff-fall boulders', 'Mola mola sighting', 'Wild south-coast scenery'],
    hazards: 'Seals are wild animals, let them run the game; a long exposed run from the ramp.',
    entry: 'Boat toward Steamers Beach; anchor off the colony and let them come.'
  },
  {
    id: 'cathedral-cave-jervis',
    mc: 800,
    name: 'Cathedral Cave (Beecroft)',
    area: 'jervis', region: 'Currarong',
    lat: -35.06124, lng: 150.840325,   /* McFadyen p800 (WGS84); 5 km north of Point Perpendicular */
    type: 'boat', depth: '12–23 m', level: 'Advanced',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.55, 0.75, 0.85, 0.75, 0.55, 0.10, 0.05, 0.15],
    swellTol: 0.95, baseVis: 12, runoff: 0.15,
    blurb: 'A cathedral-scale cave running 100 m under the Beecroft cliffs, 20 m wide with a surface-breaking air chamber at the back; wobbegongs inside all year.',
    highlights: ['100 m cave penetration', 'Air chamber at the rear', 'Wobbegongs year-round', 'Winter PJ sharks'],
    hazards: 'Near-total darkness past the entrance chamber: torches essential through the dogleg.',
    entry: 'Boat from Currarong along the cliffs, anchoring off the entrance.'
  },
  {
    id: 'honeymoon-bay-jervis',
    name: 'Honeymoon Bay (Jervis Bay)',
    area: 'jervis', region: 'Beecroft Peninsula',
    lat: -35.0572, lng: 150.7762,   /* keyhole mouth, tile-verified; not in McFadyen's guides */
    type: 'shore', depth: '2–12 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.05, 0.08, 0.12, 0.15, 0.20, 0.15, 0.05, 0.04],
    swellTol: 1.0, baseVis: 10, runoff: 0.2, waterBody: 'jervisbay',
    blurb: 'A keyhole bay on Beecroft’s bay side, pool-calm inside with the real diving at and outside the narrow mouth: kelp lines with weedy seadragons and sponge-crusted walls at the tiny heads. (Not in McFadyen’s guides; local knowledge, guided shore dives run from Huskisson.)',
    highlights: ['Weedy seadragons off the mouth', 'Pool-calm keyhole lagoon', 'Sponge walls at the entrance', 'Campground-to-water in minutes'],
    hazards: 'Inside the Beecroft Weapons Range: the access road closes for naval firing, check Defence range notices before driving out. Shallow lagoon, busy with campers in holidays.',
    entry: 'Beach inside the keyhole (Currarong Road turn-off); fin out through the narrow mouth.'
  },
  {
    id: 'plantation-point-jervis',
    name: 'Plantation Point (Vincentia)',
    area: 'jervis', region: 'Vincentia',
    lat: -35.07, lng: 150.6975,   /* off the point's fringing reef, tile-verified; not in McFadyen's guides */
    type: 'shore', depth: '2–12 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.12, 0.28, 0.35, 0.25, 0.10, 0.04, 0.03, 0.05],
    swellTol: 1.0, baseVis: 9, runoff: 0.45, waterBody: 'jervisbay',
    blurb: 'Vincentia’s reefy point: sponge gardens and boulders off the fringing reef with seadragons along the kelp-and-sand line, an easy wander that suits any level. (Not in McFadyen’s guides; local knowledge.)',
    highlights: ['Seadragons on the sand line', 'Sponge gardens off the point', 'Banjo rays & octopus', 'Easy grass-reserve access'],
    hazards: 'North-east wind chop across the bay stirs it quickly, and Moona Moona Creek next door stains it after rain; small-boat traffic rounds the point.',
    entry: 'Grass reserve at the end of Plantation Point Parade, sand-and-rock entry at the point.'
  },
  {
    id: 'murrays-beach-jervis',
    name: 'Murrays Beach (Booderee)',
    area: 'jervis', region: 'Booderee',
    lat: -35.1249, lng: 150.759,   /* off the beach's eastern end toward the heads, tile-verified; not in McFadyen's guides */
    type: 'shore', depth: '2–10 m', level: 'Open Water',
    marineZone: 'jervis', weatherZone: 'huskisson',
    exposure: [0.10, 0.18, 0.30, 0.30, 0.15, 0.04, 0.03, 0.04],
    swellTol: 1.0, baseVis: 11, runoff: 0.2, waterBody: 'jervisbay',
    blurb: 'Booderee’s glass-clear corner inside the southern head, opposite Bowen Island: reef and seagrass off the beach’s eastern end with squid, rays and the odd passing penguin. (Not in McFadyen’s guides; local knowledge; the park names it a top snorkel platform.)',
    highlights: ['Crystal water inside the heads', 'Squid over the seagrass', 'Reef toward the entrance channel', 'Rays on the sand'],
    hazards: 'Booderee entry pass required; boat-ramp traffic at the western end; swell sneaks through the entrance channel on big south-east days.',
    entry: 'Beach entry at the eastern end of Murrays Beach, near the entrance-channel reef.'
  },

  /* ---------- Ulladulla ---------- */
  {
    id: 'east-north-bommie-ulladulla',
    mc: 104,
    name: 'East North Bommie (Ulladulla)',
    area: 'ulladulla', region: 'Ulladulla',
    lat: -35.349713, lng: 150.491152,   /* McFadyen p104 (WGS84), matches GPX NEBOMI */
    type: 'boat', depth: '20–26 m', level: 'Advanced',
    marineZone: 'ulladulla', weatherZone: 'ulladulla',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.1, baseVis: 11, runoff: 0.2,
    blurb: 'Reef 2 km off Ulladulla Harbour: seadragons along the sand boundary, heavy sponge and lace-coral cover, and blue devilfish in the northern cracks.',
    highlights: ['Seadragons on the sand line', 'Blue devilfish cracks', 'Lace coral & gorgonias', 'Short harbour run'],
    hazards: 'Surrounding sand sits at 25-26 m, so the clock runs; otherwise standard boat care.',
    entry: 'Boat from Ulladulla Harbour; anchor on the bommie top.'
  },
  {
    id: 'lighthouse-wall-ulladulla',
    mc: 105,
    name: 'Lighthouse Wall (Ulladulla)',
    area: 'ulladulla', region: 'Ulladulla',
    lat: -35.363215, lng: 150.493838,   /* McFadyen p105 (WGS84), matches GPX LIGHTW */
    type: 'boat', depth: '18–23 m', level: 'Advanced',
    marineZone: 'ulladulla', weatherZone: 'ulladulla',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.05, baseVis: 11, runoff: 0.2,
    blurb: 'Four-metre sheer face below Warden Head light, pocked with holes full of life, best ridden as a lazy drift when a gentle south-setter is running.',
    highlights: ['Sheer pocked wall', 'Bullrays & angel sharks on the sand', 'Nudibranch hunting', 'Natural drift line'],
    hazards: 'The south current can add depth along the run and push no-deco limits; arrange the pickup.',
    entry: 'Boat from Ulladulla Harbour; drift the wall off Lighthouse Bommie.'
  },
  {
    id: 'lighthouse-sponge-gardens-ulladulla',
    mc: 106,
    name: 'Lighthouse Sponge Gardens (Ulladulla)',
    area: 'ulladulla', region: 'Ulladulla',
    lat: -35.364093, lng: 150.49437,   /* McFadyen p106 (WGS84), matches GPX LIGHTH */
    type: 'boat', depth: '10–20 m', level: 'Advanced',
    marineZone: 'ulladulla', weatherZone: 'ulladulla',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.0, baseVis: 11, runoff: 0.2,
    blurb: 'Gully-and-canyon reef seaward of Lighthouse Bommie, overhangs stuffed with fish, wobbegongs and PJs in the cracks, devilfish under the ledges.',
    highlights: ['Fish-packed canyons', 'Eastern blue devilfish', 'Wobbegongs & PJs', 'Varied 10-20 m terrain'],
    hazards: 'Terrain rolls around a lot: track your position while working the gullies.',
    entry: 'Boat from Ulladulla Harbour; anchor on the reef top seaward of the bommie.'
  },
  {
    id: 'the-hole-ulladulla',
    mc: 107,
    name: 'The Hole (Ulladulla)',
    area: 'ulladulla', region: 'Burrill',
    lat: -35.393658, lng: 150.476983,   /* McFadyen p107 (WGS84), matches GPX HOLE-U */
    type: 'boat', depth: '25–33 m', level: 'Advanced',
    marineZone: 'ulladulla', weatherZone: 'ulladulla',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.15, baseVis: 11, runoff: 0.2,
    blurb: 'Long wall 400 m east of Burrill Rocks dropping 26 to 33 m: black-coral-like trees, a sponge that flashes crimson under torchlight, boulder swim-throughs. The namesake hole was never found.',
    highlights: ['Crimson torchlight sponge', 'Black coral trees', 'Boulder swim-throughs', 'Wall-edge cruising'],
    hazards: 'Fifteen-odd minutes of no-deco at depth: you will not see it all in one dive.',
    entry: 'Boat from Ulladulla Harbour south to the Burrill grounds.'
  },
  {
    id: 'burrill-rocks-ulladulla',
    mc: 102,
    name: 'Burrill Rocks (Ulladulla)',
    area: 'ulladulla', region: 'Burrill',
    lat: -35.392597, lng: 150.468402,   /* McFadyen p102 (WGS84), matches GPX BURRKS */
    type: 'boat', depth: '9–23 m', level: 'Advanced',
    marineZone: 'ulladulla', weatherZone: 'ulladulla',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.0, baseVis: 11, runoff: 0.2,
    blurb: 'Cave-and-wall complex under a kilometre off the beach: the connected cave system now called The Arch, with side and roof exits, and boulder swim-throughs along the south wall.',
    highlights: ['The Arch cave system', 'Roof & side exits', 'South-wall swim-throughs', 'Old man snapper sightings'],
    hazards: 'Depth swings 9 m north to 23 m south: orient to whichever section you land on.',
    entry: 'Boat south from Ulladulla, anchoring by the rocks.'
  },
  {
    id: 'ss-northern-firth',
    mc: 653,
    name: 'SS Northern Firth (wreck)',
    area: 'ulladulla', region: 'Brush Island',
    lat: -35.526305, lng: 150.415445, wreck: true,   /* p653/marks526/GPX all agree (WGS84) */
    type: 'boat', depth: '18–20 m', level: 'Advanced',
    marineZone: 'ulladulla', weatherZone: 'ulladulla',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 1.0, baseVis: 10, runoff: 0.2,
    blurb: '1930s cargo steamer lost off Brush Island: today a huge open-ended boiler you can swim through side by side, scattered plate below the cliffs, and more wreckage ashore.',
    highlights: ['Swim-through boiler', 'Scattered debris field', 'Shoreline wreckage above', 'Remote, rarely dived'],
    hazards: 'Position is slippery: he failed to re-find it on the sounder in the mid-90s. Exposed open coast a long way from help.',
    entry: 'Own boat from Ulladulla or Kioloa; search off Brush Island’s seaward side.'
  },
  {
    id: 'the-gantry-bawley',
    name: 'The Gantry (Bawley Point)',
    area: 'ulladulla', region: 'Bawley Point',
    lat: -35.5052, lng: 150.3944, approx: true,   /* 1890s mill-jetty ruins, south end of Bawley Beach off Tingira Drive; two operator guides */
    type: 'shore', depth: '6–11 m', level: 'Open Water',
    marineZone: 'ulladulla', weatherZone: 'ulladulla',
    exposure: [0.50, 0.65, 0.70, 0.55, 0.35, 0.08, 0.05, 0.15],
    swellTol: 0.85, baseVis: 9, runoff: 0.3,
    blurb: 'The 1890s timber-mill jetty ruins at Bawley Point: iron and hardwood bones above and below the waterline, home to octopus, seahorses and blind sharks. (Not in McFadyen’s guides; from Dive Adventures Ulladulla and Spirit Divers.)',
    highlights: ['Mill-jetty relics above & below', 'Seahorses on the structure', 'Octopus & blind sharks', 'Simple follow-the-shore navigation'],
    hazards: 'Uneven footing over the old debris on entry; more juveniles and tropicals in late summer.',
    entry: 'From the southern car park off Tingira Drive, in over the old jetty footings.'
  },

  /* ---------- Batemans Bay ---------- */
  {
    id: 'bubble-cave-batemans',
    mc: 97,
    name: 'The Bubble Cave (Black Rock)',
    area: 'batemans', region: 'Black Rock',
    lat: -35.774898, lng: 150.247092,   /* McFadyen p97 (WGS84), matches GPX BUBBLE CAVE */
    type: 'boat', depth: '9–21 m', level: 'Advanced',
    marineZone: 'tollgates', weatherZone: 'batemans',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 0.95, baseVis: 9, runoff: 0.3, waterBody: 'batemans',
    blurb: 'An air-filled cave in Black Rock’s north-west corner roomy enough for three or four divers to surface and chat, reached across a sand-and-rubble amphitheatre. A couple were married in it.',
    highlights: ['Surface-and-talk air chamber', 'Amphitheatre entrance', 'Long sand gutter south', 'Wedding-venue trivia'],
    hazards: 'Standard cave care; the air pocket is exhaled air and sea foam, breathe from your reg.',
    entry: 'Quick run from Batemans Bay ramps to the rock’s NW corner.'
  },
  {
    id: 'the-arch-batemans',
    mc: 96,
    name: 'The Arch (Black Rock)',
    area: 'batemans', region: 'Black Rock',
    lat: -35.775932, lng: 150.247023,   /* McFadyen p96 (WGS84), matches GPX ARCHBB */
    type: 'boat', depth: '10–20 m', level: 'Advanced',
    marineZone: 'tollgates', weatherZone: 'batemans',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 0.95, baseVis: 9, runoff: 0.3, waterBody: 'batemans',
    blurb: 'A low true arch near Black Rock’s southern tip opening into a bowl amphitheatre, yellow zoanthids under the span and a drift option down the rock’s length when a light norther runs.',
    highlights: ['True arch & amphitheatre', 'Yellow zoanthid ceiling', 'Second cave 40 m north', 'Drift the rock in a light norther'],
    hazards: 'The side cave silts quickly and hides wobbegongs: watch your hands.',
    entry: 'Boat from Batehaven; anchor off the southern tip.'
  },
  {
    id: 'the-tunnel-batemans',
    mc: 98,
    name: 'The Tunnel (Black Rock)',
    area: 'batemans', region: 'Black Rock',
    lat: -35.779542, lng: 150.248412,   /* McFadyen p98 (WGS84), matches GPX TUNNEL */
    type: 'boat', depth: '9–21 m', level: 'Advanced',
    marineZone: 'tollgates', weatherZone: 'batemans',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 0.95, baseVis: 9, runoff: 0.3, waterBody: 'batemans',
    blurb: 'A rail-cutting gully south of Black Rock leading into a 15-20 m tunnel with a pebbled slate floor, exiting up a vertical shaft; a juvenile blue devilfish once fed from divers’ hands here.',
    highlights: ['15-20 m tunnel swim', 'Vertical shaft exit', 'Cutting-walled approach', 'Tame juvenile devilfish story'],
    hazards: 'A real overhead with a shaft exit: keep the route clear in your head.',
    entry: 'Boat from Batehaven; anchor south of the rock by the cutting.'
  },
  {
    id: 'the-chimney-batemans',
    mc: 99,
    name: 'The Chimney (Black Rock)',
    area: 'batemans', region: 'Black Rock',
    lat: -35.782873, lng: 150.248692,   /* McFadyen p99 (WGS84), matches GPX CHIMNY */
    type: 'boat', depth: '12–21 m', level: 'Advanced',
    marineZone: 'tollgates', weatherZone: 'batemans',
    exposure: [0.55, 0.65, 0.78, 0.85, 0.80, 0.15, 0.05, 0.12],
    swellTol: 0.95, baseVis: 9, runoff: 0.3, waterBody: 'batemans',
    blurb: 'Gorgonia-walled sand gutter to a dark cave whose chimney vents up through the reef top, three minutes from the ramp; a second sand-filled hole nearby may connect underneath.',
    highlights: ['Chimney venting the reef top', 'Gorgonia & zoanthid walls', 'Mystery second hole', 'Three minutes from the ramp'],
    hazards: 'The gutters look alike: if lost, swim east to pick up the main wall.',
    entry: 'Boat from Batehaven, about 3 minutes to the southern side.'
  },
  {
    id: 'mosquito-bay-batemans',
    name: 'Mosquito Bay (Malua Bay)',
    area: 'batemans', region: 'Malua Bay',
    lat: -35.7545, lng: 150.2128, approx: true,   /* beside the public ramp at 366 George Bass Drive, Lilli Pilli; Spirit Divers guide */
    type: 'shore', depth: '3–12 m', level: 'Open Water',
    marineZone: 'tollgates', weatherZone: 'batemans',
    exposure: [0.25, 0.35, 0.50, 0.45, 0.35, 0.08, 0.05, 0.08],
    swellTol: 0.95, baseVis: 8, runoff: 0.4, waterBody: 'batemans',
    blurb: 'Sheltered little boat-ramp bay south of Batemans: rocky bottom full of residents, diveable across a wide range of conditions. (Not in McFadyen’s guides; from Spirit Divers’ site guide.)',
    highlights: ['All-conditions fallback', 'Rocky-bottom residents', 'Park beside the entry', 'Easy training ground'],
    hazards: 'Boats launch and retrieve through the same small bay: keep to the sides and fly a flag.',
    entry: 'Beside the public ramp at Mosquito Bay, George Bass Drive, Lilli Pilli.'
  },
  {
    id: 'guerilla-bay',
    name: 'Guerilla Bay',
    area: 'batemans', region: 'Guerilla Bay',
    lat: -35.8288, lng: 150.2262, approx: true,   /* the bay with its inner island, midway to Burrewarra Point; Spirit Divers + Batemans Marine Park */
    type: 'shore', depth: '3–14 m', level: 'Open Water',
    marineZone: 'tollgates', weatherZone: 'batemans',
    exposure: [0.30, 0.40, 0.55, 0.50, 0.40, 0.10, 0.05, 0.08],
    swellTol: 0.9, baseVis: 9, runoff: 0.3,
    blurb: 'A pocket bay with its own island to lap: gutters and overhangs stepping off one shore, a sheltered training corner on the other, and marine-park life throughout. (Not in McFadyen’s guides; Spirit Divers and Batemans Marine Park document it.)',
    highlights: ['Circumnavigable inner island', 'Gutters & overhangs', 'Marine-park fish life', 'Swell-flexible entry choice'],
    hazards: 'Pick your side by the swell direction; ordinary bay care otherwise.',
    entry: 'From the beach at Guerilla Bay village; right for the island lap, left for the gutters.'
  },

  /* ---------- Narooma & Montague Island ---------- */
  {
    id: 'montague-island-seals',
    mc: 94,
    name: 'Montague Island Seals',
    area: 'narooma', region: 'Montague Island',
    lat: -36.247, lng: 150.2258, approx: true,   /* seal channel at the island's north end; OSM island -36.2511, 150.2266 */
    type: 'boat', depth: '3–9 m', level: 'Open Water',
    marineZone: 'montague', weatherZone: 'narooma',
    exposure: [0.55, 0.65, 0.80, 0.80, 0.70, 0.15, 0.05, 0.15],
    swellTol: 1.0, baseVis: 13, runoff: 0.15,
    blurb: 'Australian and New Zealand fur seals at the island’s north-end channel and Pebbly Bay: pups zoom in to chew fins and blow bubbles while adults patrol. Peak numbers in September-October.',
    highlights: ['Playful fur seal pups', 'Pebbly Bay & the north channel', 'Grey nurse nearby in season', 'Clear EAC-washed water'],
    hazards: 'The Narooma bar is among the roughest in NSW, cross with respect and local advice; adult seals can get territorial, let them set the terms.',
    entry: 'Charter from Narooma (30-40 min); tender drops in the seal channel.'
  },
  {
    id: 'ss-lady-darling',
    mc: 95,
    name: 'SS Lady Darling (wreck)',
    area: 'narooma', region: 'Narooma',
    lat: -36.316773, lng: 150.169503, wreck: true,   /* McFadyen p95 (AUS66→WGS84 shifted) */
    type: 'boat', depth: '28–30 m', level: 'Advanced',
    marineZone: 'montague', weatherZone: 'narooma',
    exposure: [0.50, 0.60, 0.75, 0.82, 0.80, 0.18, 0.05, 0.10],
    swellTol: 1.2, baseVis: 12, runoff: 0.15,
    blurb: '1880 collier he rates among the best wrecks in the state: stern standing 4-5 m proud with engine and half-buried boiler, dressed head to toe in sponges and jewel anemones.',
    highlights: ['Stern proud of the sand', 'Jewel-anemone coat', 'Engine & driveshaft intact', 'State-best-wreck contender'],
    hazards: 'Heritage permit required and historically granted only to a couple of charters: no private-boat diving. Open-coast exposure at 30 m.',
    entry: 'Permitted charter from Narooma or Bermagui only.'
  },

  /* ---------- Tathra, Merimbula & Eden ---------- */
  {
    id: 'tathra-wharf',
    mc: 93,
    name: 'Tathra Wharf',
    area: 'eden', region: 'Tathra',
    lat: -36.7253, lng: 149.9891,   /* OSM wharf; rock scramble beside it */
    type: 'shore', depth: '3–15 m', level: 'Open Water',
    marineZone: 'merimbula', weatherZone: 'merimbula',
    exposure: [0.40, 0.55, 0.55, 0.45, 0.30, 0.08, 0.05, 0.12],
    swellTol: 0.9, baseVis: 9, runoff: 0.55, waterBody: 'tathra',
    blurb: 'One of the best shore dives he has done anywhere: gorgonian fields in yellow, pink, red and purple under the historic wharf, basket stars perched on the fans, seahorses in the growth.',
    highlights: ['Gorgonian fields under the wharf', 'Basket stars & soft corals', 'Seahorses & big schools', 'Historic timber wharf'],
    hazards: 'Steep rock scramble in and out; anglers cast from above, watch for line. NE wind and swell wreck it.',
    entry: 'Rock scramble beside the wharf at the end of Wharf Road.'
  },
  {
    id: 'kianinny-bay-tathra',
    name: 'Kianinny Bay (Tathra)',
    area: 'eden', region: 'Tathra',
    lat: -36.7376, lng: 149.9842,   /* OSM bay, boat-ramp entry; Merimbula Divers Lodge guides */
    type: 'shore', depth: '3–18 m', level: 'Advanced',
    marineZone: 'merimbula', weatherZone: 'merimbula',
    exposure: [0.35, 0.45, 0.60, 0.60, 0.50, 0.12, 0.05, 0.10],
    swellTol: 0.8, baseVis: 9, runoff: 0.35, waterBody: 'tathra',
    blurb: 'The slot inlet south of Tathra inside Bournda National Park: walls stepping to 18 m outside the mouth, boulders and gutters within, entered off the tiny boat ramp. (Not in McFadyen’s guides; from Merimbula Divers Lodge.)',
    highlights: ['Slot-inlet walls', 'Boulder gutters outside the mouth', 'National-park setting', 'Ramp-side entry'],
    hazards: 'The inlet funnels surge in any real sea, and the good ground sits outside the mouth: pick a settled day.',
    entry: 'Kianinny Bay boat ramp, Bournda NP; swim out through the inlet.'
  },
  {
    id: 'merimbula-wharf',
    mc: 86,
    name: 'Merimbula Wharf',
    area: 'eden', region: 'Merimbula',
    lat: -36.8992, lng: 149.927,   /* OSM pier, Lake Street */
    type: 'shore', depth: '4–15 m', level: 'Open Water',
    marineZone: 'merimbula', weatherZone: 'merimbula',
    exposure: [0.15, 0.25, 0.45, 0.55, 0.45, 0.10, 0.05, 0.08],
    swellTol: 0.95, baseVis: 8, runoff: 0.6, tidePref: 'incoming', waterBody: 'merimbula',
    blurb: 'Pylons, timber debris and old cement-bagged aquarium pipes off the town wharf: a resident bullray, blue gropers and a parade of macro. Honest rather than epic, and best on the flood.',
    highlights: ['Resident bullray', 'Cement-bag pipe trail', 'Blue gropers at the pylons', 'Easy access & parking'],
    hazards: 'Popular fishing wharf, keep clear of lines; the ebb pulls dirty water out of the lake entrance, dive the incoming tide.',
    entry: 'Rock entry beside the wharf off Lake Street, timed between wave sets.'
  },
  {
    id: 'bar-beach-merimbula',
    name: 'Bar Beach (Merimbula)',
    area: 'eden', region: 'Merimbula',
    lat: -36.8957, lng: 149.9242,   /* OSM beach on the lake channel near Spencer Park; Merimbula Divers Lodge guide */
    type: 'shore', depth: '2–10 m', level: 'Open Water',
    marineZone: 'merimbula', weatherZone: 'merimbula',
    exposure: [0.08, 0.12, 0.20, 0.25, 0.18, 0.06, 0.04, 0.05],
    swellTol: 1.0, baseVis: 7, runoff: 0.65, waterBody: 'merimbula',
    blurb: 'Easy channel-side dive on the Merimbula Lake entrance: seagrass edges, rays in the shallows, and calm water when the coast is a mess. (Not in McFadyen’s guides; from Merimbula Divers Lodge.)',
    highlights: ['Seagrass & sand critters', 'Rays in the shallows', 'Calm-water fallback', 'Beach-park convenience'],
    hazards: 'Tidal flow through the channel and small-boat traffic; the ebb drops the vis.',
    entry: 'Off Bar Beach near Spencer Park, on the lake channel.'
  },
  {
    id: 'short-point-merimbula',
    name: 'Short Point (Merimbula)',
    area: 'eden', region: 'Merimbula',
    lat: -36.8835, lng: 149.935, approx: true,   /* off the headland north of town, with the boat bommie beyond; Merimbula Divers Lodge guides */
    type: 'shore', depth: '2–20 m', level: 'Advanced',
    marineZone: 'merimbula', weatherZone: 'merimbula',
    exposure: [0.45, 0.60, 0.75, 0.70, 0.55, 0.12, 0.05, 0.12],
    swellTol: 0.85, baseVis: 9, runoff: 0.3,
    blurb: 'Reef running off Short Point north of Merimbula town, from paddling depth to a 20 m bommie the boats fish: kelp, gutters and the odd seal fly-by. (Not in McFadyen’s guides; from Merimbula Divers Lodge.)',
    highlights: ['Shore-to-bommie reef line', 'Kelp gutters', 'Occasional seals', 'Town-edge access'],
    hazards: 'The point cops NE wind and sea; the outer bommie is a long swim, most treat it as a boat extension.',
    entry: 'Off Short Point headland, Short Point Road.'
  },
  {
    id: 'empire-gladstone',
    mc: 89,
    name: 'SS Empire Gladstone (wreck)',
    area: 'eden', region: 'Merimbula',
    lat: -36.950658, lng: 149.946492, wreck: true,   /* McFadyen p89 (WGS84), matches marks 526 + GPX */
    type: 'boat', depth: '6–10 m', level: 'Open Water',
    marineZone: 'merimbula', weatherZone: 'merimbula',
    exposure: [0.45, 0.60, 0.80, 0.85, 0.75, 0.15, 0.05, 0.10],
    swellTol: 0.75, baseVis: 10, runoff: 0.2,
    blurb: '1950 freighter aground off Haystack Point, NSW’s largest intact wreck at over 100 m: three upright boilers in one photo frame and a mussel-crusted accommodation deck to swim through.',
    highlights: ['100 m of wreck to cover', 'Three boilers in one view', 'Enterable accommodation deck', 'Sheltered approach run'],
    hazards: 'Plating has collapsed steadily since the 80s; shallow water breeds overconfidence, treat the swim-throughs seriously.',
    entry: 'Boat from Merimbula; anchor off the wreck south of Haystack Point.'
  },
  {
    id: 'tasman-hauler',
    mc: 92,
    name: 'Tasman Hauler (wreck)',
    area: 'eden', region: 'Eden',
    lat: -37.109268, lng: 149.963717, wreck: true,   /* McFadyen p92 (WGS84), matches GPX TASMAN */
    type: 'boat', depth: '15–30 m', level: 'Advanced',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.45, 0.55, 0.75, 0.85, 0.82, 0.18, 0.05, 0.10],
    swellTol: 1.15, baseVis: 11, runoff: 0.15,
    blurb: 'Scuttled tug sitting intact with a slight list past Ben Boyd Tower: jewel anemones and lace coral over the superstructure, corridors and engine room open to careful divers.',
    highlights: ['Fully intact tug', 'Jewel-anemone paint job', 'Engine-room penetration', 'Usually a mooring on site'],
    hazards: 'Interior corridors need a torch and wreck sense; 15-30 m spread rewards a computer.',
    entry: 'Boat south from Eden, past Ben Boyd Tower; mooring when maintained.'
  },
  {
    id: 'chipmill-eden',
    name: 'The Chipmill (Eden)',
    area: 'eden', region: 'Eden',
    lat: -37.1025, lng: 149.942, approx: true,   /* near the woodchip wharf, southern Twofold Bay; Merimbula Divers Lodge guide */
    type: 'boat', depth: '8–15 m', level: 'Open Water',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.15, 0.25, 0.40, 0.45, 0.30, 0.08, 0.04, 0.06],
    swellTol: 1.0, baseVis: 9, runoff: 0.35,
    blurb: 'The seadragon paddock beside Eden’s woodchip wharf: weed beds and low reef in the quiet southern corner of Twofold Bay where weedies pose for cameras. (Not in McFadyen’s guides; from Merimbula Divers Lodge.)',
    highlights: ['Weedy seadragons', 'Sheltered bay corner', 'Easy depths', 'Photographer favourite'],
    hazards: 'Working port nearby: observe wharf exclusion zones and fly a flag.',
    entry: 'Short boat run across Twofold Bay toward the chip wharf.'
  },
  {
    id: 'lennards-island-eden',
    name: 'Lennards Island (Eden)',
    area: 'eden', region: 'Eden',
    lat: -37.0163, lng: 149.9438, approx: true,   /* islet off Terrace Beach, northern Twofold Bay, Beowa NP; NPWS + corroborated depths */
    type: 'shore', depth: '5–25 m', level: 'Open Water',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.30, 0.35, 0.55, 0.65, 0.60, 0.15, 0.05, 0.08],
    swellTol: 0.85, baseVis: 10, runoff: 0.25,
    blurb: 'Beowa National Park’s sanctioned dive spot: the islet off Terrace Beach with kelp reef stepping to 25 m in the bay mouth, reached down an unsealed park track. (Not in McFadyen’s guides; NSW National Parks documents the access.)',
    highlights: ['Park-listed dive access', 'Islet reef to 25 m', 'Kelp forests & rays', 'Wild Beowa scenery'],
    hazards: 'Unsealed 4WD-friendly track in; open to southerly swell across the bay mouth; no facilities.',
    entry: 'Terrace Beach track off Edrom Road, Beowa NP; swim to the islet.'
  },
  {
    id: 'henry-bolte',
    mc: 83,
    name: 'Henry Bolte (wreck)',
    area: 'eden', region: 'Eden',
    lat: -37.111488, lng: 149.963158, wreck: true,   /* McFadyen p83 (WGS84), matches marks 526 + GPX */
    type: 'boat', depth: '20–25 m', level: 'Advanced',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.45, 0.55, 0.75, 0.85, 0.82, 0.18, 0.05, 0.10],
    swellTol: 1.15, baseVis: 10, runoff: 0.15,
    blurb: 'Tug scuttled in 1988 beside the Tasman Hauler and broken into four big pieces by a 1997 storm: a wreck-puzzle with prop and shroud, winches and boiler to reassemble in your head.',
    highlights: ['Four-piece wreck puzzle', 'Prop & steering gear', 'Deck winches', 'Pairs with the Tasman Hauler'],
    hazards: 'Sharp collapsing edges since the storm; vis usually a notch below its neighbour.',
    entry: 'Same run as the Tasman Hauler, south of Eden.'
  },
  {
    id: 'jackos-cave-eden',
    mc: 84,
    name: 'Jackos Cave (Eden)',
    area: 'eden', region: 'Eden',
    lat: -37.117327, lng: 149.972327,   /* McFadyen p84 (WGS84), matches GPX JACKCV */
    type: 'boat', depth: '4–22 m', level: 'Advanced',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.45, 0.55, 0.75, 0.85, 0.82, 0.18, 0.05, 0.10],
    swellTol: 0.7, baseVis: 10, runoff: 0.15,
    blurb: 'A boat-sized front cavern on a shallow bombora with a rear tunnel that squeezes to a metre of black headroom: devilfish and cuttlefish at the mouth, hermit crabs on parade.',
    highlights: ['Boat-garage cavern', 'Blue devilfish at the entrance', 'Hermit crabs everywhere', 'Torch-lit rear tunnel'],
    hazards: 'Flat-sea-only bombora; the rear tunnel is tight, dark and optional.',
    entry: 'Boat south of Eden; anchor off the bombora in settled weather.'
  },
  {
    id: 'lanercost-eden',
    mc: 85,
    name: 'Lanercost (wreck)',
    area: 'eden', region: 'Eden',
    lat: -37.136493, lng: 149.992603, wreck: true,   /* McFadyen p85 (WGS84), matches marks 526 + GPX */
    type: 'boat', depth: '5–21 m', level: 'Advanced',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.45, 0.55, 0.75, 0.85, 0.82, 0.18, 0.05, 0.10],
    swellTol: 0.7, baseVis: 10, runoff: 0.15,
    blurb: '1904 barque remains scattered through two gullies off Mowarry Point: iron and copper fragments, an anchor on a mid-wall ledge, the keel showing when the sand pulls back.',
    highlights: ['Anchor on the ledge', 'Two wreckage gullies', 'Keel appears after storms', 'True wreck-hunter dive'],
    hazards: 'Millpond seas with westerly or southerly wind only; casual divers may find it plain, his own admission.',
    entry: 'Boat south from Eden to Mowarry Point.'
  },
  {
    id: 'olive-cam-eden',
    mc: 87,
    name: 'SS Olive Cam (wreck)',
    area: 'eden', region: 'Eden',
    lat: -37.148992, lng: 150.007882, wreck: true,   /* marks page 526 (WGS84), matches GPX OLIVEC; page's AGD66 figure converges here */
    type: 'boat', depth: '3–9 m', level: 'Open Water',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.45, 0.55, 0.75, 0.85, 0.82, 0.18, 0.05, 0.10],
    swellTol: 0.65, baseVis: 10, runoff: 0.15,
    blurb: 'Ex-trawler wrecked south of Mowarry Point in 1954: cylinder blocks, driveshaft and brass in the south gully, and a boiler standing on end that nearly reaches the surface.',
    highlights: ['Upright boiler near the surface', 'Engine cylinders & brass', 'Winch in the gullies', 'Bright shallow ambience'],
    hazards: 'Needs millpond seas; three crew died here trying to reach shore, respect what surge does in these gullies.',
    entry: 'Boat south from Eden, just past Mowarry Point.'
  },
  {
    id: 'ss-city-of-sydney',
    mc: 88,
    name: 'SS City of Sydney (wreck)',
    area: 'eden', region: 'Green Cape',
    lat: -37.256217, lng: 150.012328, wreck: true,   /* McFadyen p88 (WGS84), matches marks 526 + GPX */
    type: 'boat', depth: '15–21 m', level: 'Advanced',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.30, 0.30, 0.40, 0.60, 0.70, 0.25, 0.05, 0.08],
    swellTol: 0.85, baseVis: 10, runoff: 0.15,
    blurb: '1862 steamer in Disaster Bay west of Green Cape: engine and shaft in place, the stern on its side with prop and rudder, blades snapped as she drove on under power.',
    highlights: ['Engine & prop shaft in place', 'Stern with rudder & prop', 'Broken blades tell the story', 'Wild Disaster Bay setting'],
    hazards: 'Dead calm with no southerly swell only; charters rarely come this far, private trips need real planning.',
    entry: 'Long run from Eden, or small boats over the Womboyn bar on a 1.8 m+ high tide.'
  },
  {
    id: 'ss-new-guinea',
    mc: 91,
    name: 'SS New Guinea (wreck)',
    area: 'eden', region: 'Green Cape',
    lat: -37.258717, lng: 150.038997, wreck: true,   /* McFadyen p91 (WGS84), matches marks 526 + GPX */
    type: 'boat', depth: '3–10 m', level: 'Open Water',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.28, 0.28, 0.38, 0.58, 0.68, 0.25, 0.05, 0.08],
    swellTol: 0.65, baseVis: 10, runoff: 0.15,
    blurb: '1884 wreck between two rock ridges in Disaster Bay: keel and hull sections, two huge spare propeller blades carried as cargo, and boxes of mystery lead ingots.',
    highlights: ['Spare prop blades on the sand', 'Perforated lead ingots', 'Keel between the ridges', 'Shallow bright wreckage'],
    hazards: 'Under 10 m hard against the rocks: dead-calm seas only, same long transit as its neighbours.',
    entry: 'As for City of Sydney: Eden run or Womboyn bar at high tide.'
  },
  {
    id: 'ly-ee-moon',
    mc: 90,
    name: 'SS Ly-ee-Moon (wreck)',
    area: 'eden', region: 'Green Cape',
    lat: -37.263715, lng: 150.051495, wreck: true,   /* marks page 526 (WGS84), matches GPX LYEEMN; page's AGD66 figure converges here */
    type: 'boat', depth: '5–14 m', level: 'Open Water',
    marineZone: 'eden', weatherZone: 'eden',
    exposure: [0.50, 0.60, 0.78, 0.88, 0.88, 0.25, 0.05, 0.10],
    swellTol: 0.65, baseVis: 10, runoff: 0.15,
    blurb: '1886 tragedy at the Green Cape bombora, 71 lives lost: bent pipes, bollards and copper jammed among the boulders, an anchor and engine cylinders along the eastern wall.',
    highlights: ['Wreckage jammed in boulders', 'Anchor & cylinder sections', 'Grave-site history', 'Lighthouse cemetery ashore'],
    hazards: 'Diveable only a handful of days a year; kelp shallows surge hard. Unrelated fishing-boat scraps nearby can confuse the picture.',
    entry: 'Boat to the bombora at the tip of Green Cape, flat days only.'
  },
];

/* Seasonal wildlife (from McFadyen's species pages): shown as an
   "in season" tag on matching sites during the listed months. */
var SEASONAL = [
  { tag: 'Seadragon breeding season', months: [6, 7, 8, 9, 10, 11, 12],
    siteIds: ['the-steps', 'the-leap', 'the-monuments', 'bare-island', 'henry-head', 'minmi-trench',
      'north-bondi', 'shark-point', 'the-split', 'south-maroubra', 'the-balcony', 'larpa', 'mistral-point'] },
  { tag: 'PJ shark aggregations', months: [7, 8, 9, 10],
    siteIds: ['middle-ground', 'the-gullies', 'bare-island', 'ss-tuggerah', 'cape-banks', 'tumbledowns', 'marys-reef',
      'the-bull-norah-head', 'govt-wharf-fingal', 'the-arch-bass-point', 'the-arch-beecroft'] },
  { tag: 'Dusky whaler pups', months: [12, 1, 2, 3],
    siteIds: ['shelly-beach', 'fairy-bower'] },
  { tag: 'Pygmy pipehorse peak', months: [12, 1, 2],
    siteIds: ['bare-island', 'larpa', 'the-steps'] },
  { tag: 'Grey nurse season', months: [4, 5, 6, 7, 8, 9],
    siteIds: ['magic-point', 'fish-rock', 'pinnacle-swr', 'pinnacle-forster', 'flagstaff-swansea'] },
  { tag: 'Grey nurse summer visitors', months: [12, 1, 2],
    siteIds: ['gravel-loader-bass-point', 'bushrangers-bay'] },
  { tag: 'Peak fur seal numbers', months: [9, 10],
    siteIds: ['montague-island-seals'] },
  { tag: 'Manta season', months: [1, 2, 3, 4, 5, 6],
    siteIds: ['nw-solitary-island'] }
];

/* Rating model parameters, tune here, not in code.
 * Calibrated against McFadyen's published Sydney statistics:
 * - monthly vis factors from his 1,758-dive P(vis>10m) table (damped 50%)
 * - surge reach ≈ period²/4 m; long-period swell wraps headlands
 * - rain thresholds by water body (ocean shrugs off <100mm/4days;
 *   Port Hacking is the most rain-sensitive)
 * - wind gates: boats need <15kn unless W/NW; onshore >10kn kills
 *   open-ocean shore entries; steep wind-chop stops boat runs      */
var RATING_PARAMS = {
  weights: { sea: 0.45, wind: 0.20, vis: 0.35 },
  swell: {
    perfect: 0.25, blowoutBase: 1.7,            // metres of site-effective swell
    wrapStartS: 11, wrapPerS: 0.06, wrapMax: 0.35   // refraction: exposure floor grows with period
  },
  wind: { calm: 8, blownOut: 26 },              // knots of exposure-weighted wind
  vis: {
    turbidity: 0.55, turbidityDeep: 0.30,       // deep sites: currents dominate over stirred sand
    turbLookbackH: 48,
    rain: 0.085, rainDecayH: 30, rainLookbackH: 96,
    rainThreshold: {   // decayed-mm before vis suffers, per water body
      ocean: 55, harbour: 30, botany: 20, hacking: 15, hawkesbury: 25,
      byron: 40, macleay: 18, portstephens: 32, lakemac: 28, newcastle: 45,
      jervisbay: 42, shoalhaven: 45, batemans: 38, tathra: 35, merimbula: 28
    },
    upwellBoost: 0.15,                          // sustained southerlies upwell clean water (ocean sites)
    monthly: [0.72, 0.97, 0.93, 1.03, 1.10, 1.11, 1.10, 1.11, 1.07, 0.84, 0.81, 0.96]  // Jan..Dec
  },
  windowHours: 3
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AREAS: AREAS, MARINE_ZONES: MARINE_ZONES, WEATHER_ZONES: WEATHER_ZONES, DIVE_SITES: DIVE_SITES, RATING_PARAMS: RATING_PARAMS, SEASONAL: SEASONAL, FLOOD_RIVERS: FLOOD_RIVERS };
}
