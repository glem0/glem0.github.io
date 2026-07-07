/* ============================================================
 * Dive NSW, app orchestration
 * ============================================================ */

(function () {
  'use strict';

  function savedArea() {
    try {
      var qs = new URLSearchParams(location.search).get('area');
      if (qs === 'all' || (qs && AREAS.info[qs])) return qs;
    } catch (e) {}
    try {
      var a = localStorage.getItem('sdc.area');
      if (a === 'all' || (a && AREAS.info[a])) return a;
    } catch (e) {}
    return 'sydney';
  }

  var state = {
    feeds: null,        // normalized API data
    results: null,      // Rating.computeAll output
    day: 0,             // selected forecast day 0..6
    area: savedArea(),  // AREAS id | 'all', persisted
    type: 'all',        // all | shore | boat
    search: '',
    sort: 'score',      // score | sea | wind | vis | level | region | name
    sortDir: 1,         // 1 = natural order, -1 = reversed
    open: null,         // open site id
    loading: false
  };

  var map, markers = {}, satLayer, streetLayer, activeBase = 'sat';
  var hoverId = null;
  var SITE_BY_ID = {};
  DIVE_SITES.forEach(function (s) { SITE_BY_ID[s.id] = s; });

  /* ---------------- areas ---------------- */

  function areaInfo(a) { return a === 'all' ? AREAS.all : AREAS.info[a]; }
  function areaIdx(a) { var i = AREAS.order.indexOf(a); return i < 0 ? 99 : i; }
  function areaSites() {
    if (state.area === 'all') return DIVE_SITES;
    return DIVE_SITES.filter(function (s) { return s.area === state.area; });
  }
  /* the weather zone most of the area's sites use (drives the day brief) */
  function areaWeatherZone() {
    var counts = {}, best = 'harbour', n = 0;
    areaSites().forEach(function (s) {
      counts[s.weatherZone] = (counts[s.weatherZone] || 0) + 1;
      if (counts[s.weatherZone] > n) { n = counts[s.weatherZone]; best = s.weatherZone; }
    });
    return best;
  }
  function fitArea() {
    if (!map) return;
    var b = areaInfo(state.area).bounds;
    map.fitBounds(L.latLngBounds(b), { padding: [14, 14] });
  }
  function setArea(a) {
    if (a === state.area) return;
    state.area = a;
    try { localStorage.setItem('sdc.area', a); } catch (e) {}
    if (state.open) {
      var site = SITE_BY_ID[state.open];
      if (site && a !== 'all' && site.area !== a) closeDetail();
    }
    syncAreaUI();
    renderAll();
    fitArea();
  }

  /* keep the two area controls (desktop select, phone button) in step */
  function syncAreaUI() {
    var sel = q('#area');
    if (sel.value !== state.area) sel.value = state.area;
    q('#region-lab').textContent = areaInfo(state.area).label;
    sizeAreaSelect();
  }

  /* the closed select hugs the SELECTED label; left alone it sizes to the
     widest option in the list, a half-screen pill on phones */
  function sizeAreaSelect() {
    var sel = q('#area');
    var opt = sel.options[sel.selectedIndex];
    if (!opt) return;
    var cs = getComputedStyle(sel);
    var probe = h('span', null, opt.textContent);
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'nowrap';
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontWeight = cs.fontWeight;
    document.body.appendChild(probe);
    /* text + 12 left pad + 24 arrow zone + borders; CSS max-width still caps */
    sel.style.width = Math.ceil(probe.offsetWidth + 40) + 'px';
    document.body.removeChild(probe);
  }

  /* ---------------- tiny DOM helpers ---------------- */

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function q(sel) { return document.querySelector(sel); }
  function fmt1(v) { return v == null ? '-' : (Math.round(v * 10) / 10).toFixed(v >= 9.95 ? 0 : 1); }
  function fmtM(v) { return v == null ? '-' : v.toFixed(1) + ' m'; }
  function fmtKn(v) { return v == null ? '-' : Math.round(v) + ' kn'; }
  function fmtVis(v) { return v == null ? '-' : '~' + (v < 3 ? v.toFixed(1) : Math.round(v)) + ' m'; }
  function hour12(hh) {
    var ap = hh < 12 ? 'am' : 'pm';
    var x = hh % 12 === 0 ? 12 : hh % 12;
    return x + ap;
  }
  function timeShort(iso) {
    return hour12(parseInt(iso.slice(11, 13), 10));
  }
  function fmtClock(iso) {
    var hh = parseInt(iso.slice(11, 13), 10), mm = iso.slice(14, 16);
    var ap = hh < 12 ? 'am' : 'pm';
    var h12 = hh % 12 === 0 ? 12 : hh % 12;
    return h12 + ':' + mm + ' ' + ap;
  }
  function dayLabel(d) {
    if (!state.feeds) return '';
    var iso = state.feeds.time[state.feeds.todayIndex + 24 * d];
    if (!iso) return '';
    var dt = new Date(iso.slice(0, 10) + 'T00:00:00');
    if (d === 0) return 'Today';
    return dt.toLocaleDateString('en-AU', { weekday: 'short' }) + ' ' + dt.getDate();
  }

  /* ---- theme: auto (system) / light / dark ---- */
  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }
  function seriesBlue() { return isLight() ? '#2a78d6' : '#3987e5'; }
  function seriesAqua() { return isLight() ? '#1baf7a' : '#199e70'; }
  function themeMode() {
    try { return localStorage.getItem('sdc.theme') || 'auto'; } catch (e) { return 'auto'; }
  }
  function applyTheme(mode) {
    var light = mode === 'light' || (mode !== 'dark' &&
      window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    if (light) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    applyThemeButton();
  }
  function applyThemeButton() {
    var btn = q('#theme-toggle');
    if (!btn) return;
    var mode = themeMode();
    /* ︎ forces text presentation: iOS otherwise renders ☀ as an emoji */
    btn.textContent = mode === 'auto' ? '◐︎' : mode === 'light' ? '☀︎' : '☾︎';
    btn.title = 'Theme: ' + (mode === 'auto' ? 'auto (follows system)' : mode) + ', click to change';
  }
  function toggleTheme() {
    var next = { auto: 'light', light: 'dark', dark: 'auto' }[themeMode()] || 'auto';
    try { localStorage.setItem('sdc.theme', next); } catch (e) {}
    applyTheme(next);
    /* everything else is CSS-token driven; only the open drawer holds
       theme-baked colours (charts, hero text), so rebuild just that */
    if (state.open) renderDetail(true);
  }
  /* status colour as TEXT needs darker steps on a light surface */
  var LEVEL_TEXT_LIGHT = { good: '#1e8a44', fair: '#a06b00', poor: '#c25a2b', nogo: '#c03535' };
  function levelTextColor(level) {
    return isLight() ? (LEVEL_TEXT_LIGHT[level.key] || level.color) : level.color;
  }

  function siteResult(id) { return state.results ? state.results.sites[id] : null; }
  function dayRating(id) {
    var r = siteResult(id);
    return r ? r.days[state.day] : null;
  }

  /* ---------------- filters ---------------- */

  function visibleSites() {
    var text = state.search.trim().toLowerCase();
    return DIVE_SITES.filter(function (s) {
      if (state.area !== 'all' && s.area !== state.area) return false;
      if (state.type === 'shore' && s.type !== 'shore') return false;
      if (state.type === 'boat' && (s.type !== 'boat' || s.wreck)) return false;
      if (state.type === 'wreck' && !s.wreck) return false;
      if (text) {
        var hay = s.name + ' ' + s.region + ' ' + (AREAS.info[s.area] ? AREAS.info[s.area].label : '');
        if (hay.toLowerCase().indexOf(text) < 0) return false;
      }
      return true;
    });
  }

  /* ---------------- map ---------------- */

  function initMap() {
    map = L.map('map', { zoomControl: true, attributionControl: true });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

    satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
    });
    streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    });
    satLayer.addTo(map);

    fitArea();
    requestAnimationFrame(function () {   // refit once layout has settled
      map.invalidateSize();
      if (state.open) {
        var site = DIVE_SITES.find(function (s) { return s.id === state.open; });
        if (site) focusSite(site);
      } else {
        fitArea();
      }
    });
    /* All-NSW markers are thinned at low zoom; refresh them as zoom crosses it */
    map.on('zoomend', function () { if (state.area === 'all') renderMarkers(); });

    /* base layer toggle */
    var Toggle = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function () {
        var box = h('div', 'basemap-toggle leaflet-bar');
        ['sat', 'map'].forEach(function (kind) {
          var btn = h('button', 'bm-btn' + (kind === 'sat' ? ' active' : ''), kind === 'sat' ? 'Satellite' : 'Map');
          btn.type = 'button';
          btn.addEventListener('click', function () {
            if (activeBase === kind) return;
            activeBase = kind;
            if (kind === 'sat') { map.removeLayer(streetLayer); satLayer.addTo(map); }
            else { map.removeLayer(satLayer); streetLayer.addTo(map); }
            box.querySelectorAll('.bm-btn').forEach(function (x) { x.classList.remove('active'); });
            btn.classList.add('active');
          });
          box.appendChild(btn);
        });
        L.DomEvent.disableClickPropagation(box);
        return box;
      }
    });
    map.addControl(new Toggle());

    /* rating legend */
    var Legend = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd: function () {
        var box = h('div', 'map-legend');
        [
          ['#34c163', 'Good', '7–10'], ['#ffc233', 'Fair', '5–7'],
          ['#ff9166', 'Poor', '3–5'], ['#e85c5c', 'No-go', '0–3']
        ].forEach(function (r) {
          var row = h('div', 'lg-row');
          var dot = h('span', 'lg-dot');
          dot.style.background = r[0];
          row.appendChild(dot);
          row.appendChild(h('span', 'lg-lab', r[1]));
          row.appendChild(h('span', 'lg-range', r[2]));
          box.appendChild(row);
        });
        box.appendChild(h('div', 'lg-div'));
        var shapes = h('div', 'lg-shapes');
        [['lg-shore', 'Shore'], ['lg-boat', 'Boat'], ['lg-wreck', 'Wreck']].forEach(function (s) {
          var row = h('div', 'lg-row');
          row.appendChild(h('span', 'lg-shape ' + s[0]));
          row.appendChild(h('span', 'lg-lab', s[1]));
          shapes.appendChild(row);
        });
        box.appendChild(shapes);
        L.DomEvent.disableClickPropagation(box);
        return box;
      }
    });
    map.addControl(new Legend());
  }

  function markerIcon(site) {
    var r = dayRating(site.id);
    var color = r ? r.level.color : '#4a5a6d';
    var cls = 'mk' + (site.wreck ? ' mk-wreck' : site.type === 'boat' ? ' mk-boat' : '');
    if (state.open === site.id) cls += ' mk-sel';
    else if (hoverId === site.id) cls += ' mk-hover';
    var elDiv = h('div', cls);
    elDiv.appendChild(h('span', 'mk-num', r ? fmt1(r.score) : '·'));
    elDiv.style.background = color;
    /* score ink comes from the --score-ink CSS token so theme flips repaint
       without any marker rebuild */
    return L.divIcon({ className: 'mk-wrap', html: elDiv.outerHTML, iconSize: [30, 30], iconAnchor: [15, 15] });
  }

  function refreshMarker(id) {
    var m = markers[id], site = SITE_BY_ID[id];
    if (!m || !site) return;
    m.setIcon(markerIcon(site));
    m.setZIndexOffset(state.open === id ? 1000 : hoverId === id ? 500 : 0);
  }

  /* In All-NSW mode at low zoom, ~270 DOM markers overlap into mush and drag
     panning down; keep only the best-rated site per grid cell until zoom 9. */
  function thinnedVisible() {
    var sites = visibleSites();
    if (state.area !== 'all' || !map || map.getZoom() > 8) return sites;
    var cellSize = map.getZoom() <= 6 ? 0.3 : 0.15;
    var cells = {};
    sites.forEach(function (s) {
      var key = Math.round(s.lat / cellSize) + ':' + Math.round(s.lng / cellSize);
      var r = dayRating(s.id);
      var score = r ? r.score : -1;
      if (!cells[key] || score > cells[key].score) cells[key] = { site: s, score: score };
    });
    var out = Object.keys(cells).map(function (k) { return cells[k].site; });
    if (state.open && SITE_BY_ID[state.open] &&
        sites.indexOf(SITE_BY_ID[state.open]) >= 0 && out.indexOf(SITE_BY_ID[state.open]) < 0) {
      out.push(SITE_BY_ID[state.open]);   // never thin away the open site
    }
    return out;
  }

  function renderMarkers() {
    var vis = {};
    thinnedVisible().forEach(function (s) { vis[s.id] = true; });
    DIVE_SITES.forEach(function (site) {
      var m = markers[site.id];
      if (!m) {
        m = markers[site.id] = L.marker([site.lat, site.lng], { icon: markerIcon(site), keyboard: false });
        m.bindTooltip(site.name, { direction: 'top', offset: [0, -14], opacity: 0.95 });
        m.on('click', function () { openDetail(site.id); });
      }
      if (vis[site.id]) {
        m.setIcon(markerIcon(site));
        m.setZIndexOffset(state.open === site.id ? 1000 : hoverId === site.id ? 500 : 0);
        if (!map.hasLayer(m)) m.addTo(map);
      } else if (map.hasLayer(m)) {
        map.removeLayer(m);
      }
    });
  }

  /* ---------------- header / toolbar ---------------- */

  function renderToolbar() {
    var days = q('#day-chips');
    days.textContent = '';

    /* per-day quality of the SELECTED AREA = mean of its top-5 site scores */
    function dayTopMean(d) {
      if (!state.results) return null;
      var scores = [];
      areaSites().forEach(function (s) {
        var r = state.results.sites[s.id];
        var dr = r && r.days[d];
        if (dr) scores.push(dr.score);
      });
      if (!scores.length) return null;
      scores.sort(function (a, b) { return b - a; });
      var top = scores.slice(0, 5);
      return top.reduce(function (a, b) { return a + b; }, 0) / top.length;
    }
    var means = [], best = -1, bestMean = -1;
    for (var dd = 0; dd < 7; dd++) {
      means[dd] = dayTopMean(dd);
      if (means[dd] != null && means[dd] > bestMean) { bestMean = means[dd]; best = dd; }
    }
    function dayDotColor(d) {
      return means[d] == null ? null : Rating.levelFor(means[d], false).color;
    }

    for (var d = 0; d < 7; d++) {
      (function (d) {
        /* weekday and date are separate spans so the phone layout can stack
           them into a calendar-like cell */
        var lbl = dayLabel(d).split(' ');
        var chip = h('button', 'day-chip' + (state.day === d ? ' active' : ''));
        chip.type = 'button';
        chip.appendChild(h('span', 'day-wd', lbl[0]));
        var sub = h('span', 'day-sub');
        if (lbl[1]) sub.appendChild(h('span', 'day-num', lbl[1]));
        var dot = dayDotColor(d);
        if (dot != null) {
          var ds = h('span', 'day-dot');
          ds.style.background = dot;
          sub.appendChild(ds);
        }
        if (d === best) {
          sub.appendChild(h('span', 'day-star', '★'));
          chip.title = 'Best day this week';
        }
        chip.appendChild(sub);
        chip.addEventListener('click', function () { state.day = d; renderAll(); });
        days.appendChild(chip);
      })(d);
    }

    var types = q('#type-chips');
    types.textContent = '';
    /* marker-shape glyph is its own span so the phone layout can drop it */
    [['all', '', 'All'], ['shore', '○', 'Shore'], ['boat', '□', 'Boat'], ['wreck', '◇', 'Wrecks']].forEach(function (t) {
      var chip = h('button', 'type-chip' + (state.type === t[0] ? ' active' : ''));
      chip.type = 'button';
      if (t[1]) chip.appendChild(h('span', 'tc-ico', t[1]));
      chip.appendChild(h('span', null, t[2]));
      chip.addEventListener('click', function () {
        state.type = t[0];
        renderToolbar();
        renderList();
        renderMarkers();
      });
      types.appendChild(chip);
    });
  }

  function renderStatus() {
    var el = q('#updated');
    if (!state.feeds) { el.textContent = ''; return; }
    var t = new Date(state.feeds.fetchedAt);
    el.textContent = 'Updated ' + t.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });

    var banner = q('#banner');
    if (state.feeds.stale) {
      banner.textContent = 'Live update failed, showing cached data from ' +
        t.toLocaleString('en-AU', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + '.';
      banner.hidden = false;
    } else banner.hidden = true;

    /* water temp = range across the SELECTED AREA's marine zones */
    var sst = q('#water-temp');
    var zoneSet = {};
    areaSites().forEach(function (s) { zoneSet[s.marineZone] = true; });
    var temps = [];
    Object.keys(zoneSet).forEach(function (z) {
      if (!state.feeds.marine[z]) return;
      var v = state.feeds.marine[z].sst[state.feeds.nowIndex];
      if (v != null) temps.push(v);
    });
    if (temps.length) {
      var mn = Math.min.apply(null, temps), mx = Math.max.apply(null, temps);
      sst.textContent = 'Water ' + (mx - mn < 0.5
        ? ((mn + mx) / 2).toFixed(1) + '°C'
        : mn.toFixed(1) + '–' + mx.toFixed(1) + '°C');
      sst.title = 'Sea surface temperature, ' + areaInfo(state.area).label +
        ' (' + temps.length + ' forecast zone' + (temps.length > 1 ? 's' : '') + ')';
    } else sst.textContent = '';
  }

  /* sunrise, air temp + the day's tide turns, the morning brief.
     Two fixed rows so wrapping is always predictable. */
  function renderDayBrief() {
    var el = q('#daybrief');
    el.textContent = '';
    if (!state.feeds) return;
    var f = state.feeds;
    var base = f.todayIndex + 24 * state.day;
    var iso = f.time[base];
    if (!iso) return;
    var dateStr = iso.slice(0, 10);
    var di = f.daily.time.indexOf(dateStr);

    /* each logical block (sun / air / tides / drying) is a bf-group so CSS can
       draw a divider between neighbours */
    function group(row) {
      var g = h('span', 'bf-group');
      row.appendChild(g);
      return g;
    }
    function piece(target, icon, text) {
      var s = h('span', 'bf-item');
      s.appendChild(h('span', 'bf-ico', icon));
      s.appendChild(h('span', null, text));
      target.appendChild(s);
    }

    var row1 = h('div', 'bf-row');
    if (di >= 0) {
      piece(group(row1), '☀︎', fmtClock(f.daily.sunrise[di]) + ' – ' + fmtClock(f.daily.sunset[di]));
    }
    var wzb = f.weather[areaWeatherZone()] || f.weather[WEATHER_ZONES.order[0]];
    if (wzb && wzb.temp) {
      var lo = null, hi = null, loH = 0, hiH = 0;
      for (var hh2 = 0; hh2 < 24; hh2++) {
        var tv = wzb.temp[base + hh2];
        if (tv == null) continue;
        if (lo == null || tv < lo) { lo = tv; loH = hh2; }
        if (hi == null || tv > hi) { hi = tv; hiH = hh2; }
      }
      if (lo != null) {
        /* extremes in time-of-day order */
        var first = loH <= hiH ? [lo, loH] : [hi, hiH];
        var second = loH <= hiH ? [hi, hiH] : [lo, loH];
        piece(group(row1), 'air',
          Math.round(first[0]) + '° ~' + hour12(first[1]) + ' → ' +
          Math.round(second[0]) + '° ~' + hour12(second[1]));
      }
    }
    if (row1.childNodes.length) el.appendChild(row1);

    /* second row: the day's tides (for the selected area) plus gear drying */
    var row2 = h('div', 'bf-row');
    var tideZone = areaInfo(state.area).tideZone;
    if (!f.marine[tideZone]) tideZone = 'heads';
    var evts = Rating.tideEvents(f, tideZone, Math.max(1, base), 24)
      .filter(function (e) { return e.time.slice(0, 10) === dateStr; })
      .slice(0, 4);
    if (evts.length) {
      var tg = group(row2);
      tg.appendChild(h('span', 'bf-ico', 'tides'));
      evts.forEach(function (e) {
        piece(tg, e.type === 'High' ? '▲' : '▼', timeShort(e.time));
      });
    }
    if (wzb && wzb.precip) {
      var rd = 0, rn = 0;
      for (var q1 = 0; q1 < 24; q1++) rd += wzb.precip[base + q1] || 0;
      for (var q2 = 24; q2 < 72; q2++) rn += wzb.precip[base + q2] || 0;
      var dry = (rd < 1 && rn < 2) ? 'easy'
        : (rd < 3 && rn < 10) ? 'fair'
        : (rd < 10 && rn < 25) ? 'slow' : 'grim';
      var dp = h('span', 'bf-item');
      dp.appendChild(h('span', 'bf-ico', 'gear drying'));
      dp.appendChild(h('span', null, dry));
      dp.title = 'Will your wetsuit dry? Rain forecast: ' + rd.toFixed(0) + ' mm this day, ' +
        rn.toFixed(0) + ' mm over the following two days.';
      group(row2).appendChild(dp);
    }
    if (row2.childNodes.length) el.appendChild(row2);
    el.title = 'Sunrise–sunset, air temperature and modelled tide turns (▲ high · ▼ low) for the selected day';
  }

  /* ---------------- sidebar list ---------------- */

  function ratingChip(r, compact) {
    var chip = h('span', 'chip' + (compact ? ' chip-sm' : ''));
    if (!r) {
      chip.classList.add('chip-empty');
      chip.appendChild(h('strong', null, '-'));
      return chip;
    }
    chip.style.background = r.level.color;
    chip.appendChild(h('strong', null, fmt1(r.score)));
    chip.appendChild(h('span', null, r.level.label));
    return chip;
  }

  function renderList() {
    var list = q('#site-list');
    var keepScroll = list.scrollTop;
    list.textContent = '';
    var sites = visibleSites();

    var summary = q('#summary');
    summary.textContent = state.loading ? 'Loading live conditions…'
      : sites.length + ' of ' + areaSites().length +
        (areaSites().length === 1 ? ' site · ' : ' sites · ') + areaInfo(state.area).label;

    var REGION_ORDER = ['Pittwater & Broken Bay', 'Manly & Northern Beaches', 'Sydney Harbour',
      'Eastern Suburbs', 'Botany Bay', 'Cronulla & Port Hacking', 'Royal National Park'];
    sites.sort(function (a, b) {
      var ra = dayRating(a.id), rb = dayRating(b.id);
      var num = function (r, k, bad) { return r && r[k] != null ? r[k] : bad; };
      if (state.sort === 'name') return a.name.localeCompare(b.name);
      if (state.sort === 'region') {
        /* north to south: area order first, Sydney's curated region order
           within Sydney, then plain latitude */
        var ai = areaIdx(a.area) - areaIdx(b.area);
        if (ai) return ai;
        var d = REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region);
        return d || (b.lat - a.lat);   // north to south within a region too
      }
      if (state.sort === 'sea') return num(ra, 'effSea', 99) - num(rb, 'effSea', 99);
      if (state.sort === 'wind') return num(ra, 'effWind', 999) - num(rb, 'effWind', 999);
      if (state.sort === 'vis') return num(rb, 'estVis', -1) - num(ra, 'estVis', -1);
      if (state.sort === 'level') {
        var LR = { 'Open Water': 0, 'Advanced': 1, 'Deep / Tech': 2 };
        return (LR[a.level] - LR[b.level]) || ((rb ? rb.score : -1) - (ra ? ra.score : -1));
      }
      return (rb ? rb.score : -1) - (ra ? ra.score : -1);
    });
    if (state.sortDir === -1) sites.reverse();

    sites.forEach(function (site) {
      var r = dayRating(site.id);
      var card = h('button', 'site-card' + (state.open === site.id ? ' selected' : ''));
      card.type = 'button';

      var top = h('div', 'sc-top');
      top.appendChild(h('span', 'sc-name', site.name));
      top.appendChild(ratingChip(r, true));
      card.appendChild(top);

      var meta = h('div', 'sc-meta',
        site.region + ' · ' + (site.type === 'shore' ? 'Shore' : 'Boat') + ' · ' + site.depth + ' · ');
      meta.appendChild(h('span', 'lvl-badge',
        { 'Open Water': 'OW', 'Advanced': 'ADV', 'Deep / Tech': 'TECH' }[site.level] || site.level));
      card.appendChild(meta);

      if (r) {
        var stats = 'Sea ' + fmtM(r.effSea) + ' · Wind ' + fmtKn(r.effWind) + ' · Vis ' + fmtVis(r.estVis) +
          ' · ' + hour12(r.startH) + '–' + hour12(r.endH);
        card.appendChild(h('div', 'sc-stats', stats));
      }

      if (r && r.score < 3) card.classList.add('dim');
      card.addEventListener('click', function () { openDetail(site.id, { fly: true }); });
      card.addEventListener('mouseenter', function () { hoverId = site.id; refreshMarker(site.id); });
      card.addEventListener('mouseleave', function () {
        if (hoverId === site.id) hoverId = null;
        refreshMarker(site.id);
      });
      list.appendChild(card);
    });

    if (!sites.length) list.appendChild(h('div', 'empty', 'No sites match.'));
    list.scrollTop = keepScroll;
  }

  /* ---------------- detail drawer ---------------- */

  /* nearest Beachwatch-monitored swim site within 2.5 km, if any */
  function beachwatchFor(site) {
    var bw = state.feeds && state.feeds.beachwatch;
    if (!bw || !bw.features) return null;
    var best = null;
    bw.features.forEach(function (ft) {
      var c = ft.geometry && ft.geometry.coordinates;
      if (!c || !ft.properties) return;
      var dLat = (c[1] - site.lat) * 111, dLng = (c[0] - site.lng) * 92;
      var d = Math.sqrt(dLat * dLat + dLng * dLng);
      if (d < 2.5 && (!best || d < best.d)) best = { d: d, p: ft.properties };
    });
    return best ? best.p : null;
  }

  function statTile(ico, label, value, sub) {
    var t = h('div', 'tile');
    var lab = h('div', 'tile-label');
    if (ico) lab.appendChild(h('span', 'tile-ico', ico));
    lab.appendChild(h('span', null, label));
    t.appendChild(lab);
    t.appendChild(h('div', 'tile-value', value));
    if (sub) t.appendChild(h('div', 'tile-sub', sub));
    return t;
  }

  function meterRow(label, part, valueText) {
    var row = h('div', 'meter-row');
    var head = h('div', 'meter-head');
    head.appendChild(h('span', 'meter-label', label));
    head.appendChild(h('span', 'meter-val', valueText));
    row.appendChild(head);
    var track = h('div', 'meter-track');
    var fill = h('div', 'meter-fill');
    var lv = Rating.levelFor(part, false);
    fill.style.width = Math.max(3, part * 10) + '%';
    fill.style.background = lv.color;
    track.appendChild(fill);
    row.appendChild(track);
    return row;
  }

  function tagChip(text, cls) {
    return h('span', 'tag' + (cls ? ' ' + cls : ''), text);
  }

  /* fly to a site, keeping it centred in the part of the map the drawer doesn't cover */
  function focusSite(site) {
    if (!map) return;
    var z = Math.max(map.getZoom(), 14);
    var drawerOffset = window.innerWidth > 920 ? 220 : 0;
    var pt = map.project([site.lat, site.lng], z);
    var target = map.unproject([pt.x + drawerOffset, pt.y], z);
    map.flyTo(target, z, { duration: 0.7 });
  }

  function openDetail(id, opts) {
    var prev = state.open;
    state.open = id;
    if (('#site=' + id) !== location.hash) {
      try { history.replaceState(null, '', '#site=' + id); } catch (e) { /* file:// quirk */ }
    }
    renderList();
    renderDetail();
    q('#drawer').classList.add('open');
    if (prev && prev !== id) refreshMarker(prev);
    refreshMarker(id);
    /* desktop only: reveal the selected card inside the list's own scroll
       box. On phones the page is the scroller, so this would scroll the
       document down to the listing behind the full-screen drawer */
    var selCard = q('.site-card.selected');
    if (selCard && window.innerWidth > 920) selCard.scrollIntoView({ block: 'nearest' });
    var site = SITE_BY_ID[id];
    if (!site || !map) return;
    if (opts && opts.fly) {
      focusSite(site);
    } else {
      var target = L.latLng(site.lat, site.lng);
      if (!map.getBounds().pad(-0.2).contains(target)) map.panTo(target);
    }
  }

  function closeDetail() {
    var prev = state.open;
    state.open = null;
    q('#drawer').classList.remove('open');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    renderList();
    if (prev) refreshMarker(prev);
  }

  function renderDetail(keepScroll) {
    var body = q('#drawer-body');
    var prevScroll = keepScroll ? body.scrollTop : 0;
    body.textContent = '';
    var site = DIVE_SITES.find(function (s) { return s.id === state.open; });
    if (!site) return;
    var res = siteResult(site.id);
    var r = res ? res.days[state.day] : null;

    /* header */
    var head = h('div', 'dd-head');
    var nameRow = h('div', 'dd-name-row');
    nameRow.appendChild(h('h2', 'dd-name', site.name));
    head.appendChild(nameRow);
    head.appendChild(h('div', 'dd-meta', site.region + ' · ' +
      (site.type === 'shore' ? 'Shore dive' : 'Boat dive') + ' · ' + site.depth + ' · ' + site.level));

    var bwp = beachwatchFor(site);
    var tags = h('div', 'dd-tags');
    if (site.wreck) tags.appendChild(tagChip('Shipwreck', 'tag-wreck'));
    if (typeof SEASONAL !== 'undefined' && state.feeds) {
      var mNow = parseInt(state.feeds.time[state.feeds.nowIndex].slice(5, 7), 10);
      SEASONAL.forEach(function (sn) {
        if (sn.months.indexOf(mNow) >= 0 && sn.siteIds.indexOf(site.id) >= 0) {
          tags.appendChild(tagChip('In season: ' + sn.tag, 'tag-season'));
        }
      });
    }
    if (bwp && bwp.pollutionForecast === 'Likely') tags.appendChild(tagChip('Pollution likely today', 'tag-warn'));
    if (site.tideCritical) tags.appendChild(tagChip('Slack tide only', 'tag-warn'));
    if (site.currentNote) tags.appendChild(tagChip('Tidal current, plan the tide', 'tag-warn'));
    if (site.approx) tags.appendChild(tagChip('Approx. location'));
    site.highlights.slice(0, 4).forEach(function (t) { tags.appendChild(tagChip(t)); });
    head.appendChild(tags);
    body.appendChild(head);

    if (res && r) {
      /* hero rating for the selected day */
      var hero = h('div', 'dd-hero');
      var big = h('div', 'hero-score');
      big.appendChild(h('span', 'hero-num', fmt1(r.score)));
      var hr = h('div', 'hero-side');
      var lvl = h('div', 'hero-level', r.blown ? 'Blown out' : r.level.label);
      lvl.style.color = levelTextColor(r.level);
      hr.appendChild(lvl);
      var nowH = state.feeds.nowIndex - state.feeds.todayIndex;
      var windowPast = state.day === 0 && r.endH <= nowH;
      hr.appendChild(h('div', 'hero-when', dayLabel(state.day) +
        (windowPast ? ' · best window was ' : ' · best window ') +
        hour12(r.startH) + '–' + hour12(r.endH)));
      if (state.day === 0 && res.now) {
        hr.appendChild(h('div', 'hero-now', 'Right now: ' + fmt1(res.now.score) + ' ' + res.now.level.label));
      }
      var slz = state.feeds.marine[site.marineZone].seaLevel;
      if (slz && res.tides.length && slz[state.feeds.nowIndex + 1] != null) {
        var rising = slz[state.feeds.nowIndex + 1] >= slz[state.feeds.nowIndex];
        var nxt = res.tides[0];
        var tideTxt = 'Tide ' + (rising ? 'rising' : 'falling') + ' → ' + nxt.type + ' ~' + timeShort(nxt.time);
        if (site.tidePref === 'incoming') tideTxt += rising ? ', favoured (rising) tide now' : ', better on the rising tide';
        else if (site.tidePref === 'high') tideTxt += ', best around high water';
        else if (site.tidePref === 'low') tideTxt += ', best near low water';
        hr.appendChild(h('div', 'hero-now', tideTxt));
      }
      big.appendChild(hr);
      hero.appendChild(big);

      hero.appendChild(meterRow('Sea state', r.parts.sea, fmtM(r.effSea) + ' at site'));
      hero.appendChild(meterRow('Wind', r.parts.wind, fmtKn(r.effWind) + ' effective'));
      hero.appendChild(meterRow('Visibility (est.)', r.parts.vis, fmtVis(r.estVis)));

      /* Beachwatch as bars, same visual language as the score meters */
      if (bwp && bwp.pollutionForecast) {
        var bwBox = h('div', 'bw-box');
        bwBox.appendChild(h('div', 'bw-cap', 'Beachwatch · ' + (bwp.siteName || 'nearby')));
        var pMap = { Unlikely: 9, Possible: 5, Likely: 2 };
        bwBox.appendChild(meterRow('Pollution risk',
          pMap[bwp.pollutionForecast] != null ? pMap[bwp.pollutionForecast] : 5,
          bwp.pollutionForecast.toLowerCase()));
        if (bwp.latestResult) {
          var qMap = { Good: 9, Fair: 5.5, Poor: 2.5 };
          bwBox.appendChild(meterRow('Water quality',
            qMap[bwp.latestResult] != null ? qMap[bwp.latestResult] : 5,
            bwp.latestResult.toLowerCase() + ' at last sample'));
        }
        hero.appendChild(bwBox);
      }
      body.appendChild(hero);

      /* 7-day strip */
      var stripWrap = h('div', 'dd-section');
      stripWrap.appendChild(h('h3', 'dd-h3', '7-day outlook'));
      var strip = h('div', 'day-strip');
      res.days.forEach(function (dr, d) {
        var cell = h('button', 'ds-cell' + (state.day === d ? ' active' : ''));
        cell.type = 'button';
        cell.appendChild(h('div', 'ds-day', dayLabel(d).split(' ')[0]));
        cell.appendChild(ratingChip(dr, true));
        if (dr) {
          cell.appendChild(h('div', 'ds-stat', fmtM(dr.display.swellMax) + ' ' + Rating.compass16(dr.display.swellDir)));
          cell.appendChild(h('div', 'ds-stat', fmtKn(dr.display.windMean) + ' ' + Rating.compass16(dr.display.windDir)));
          cell.appendChild(h('div', 'ds-stat ds-rain', dr.display.rain >= 0.5 ? dr.display.rain.toFixed(0) + ' mm' : '-'));
        }
        cell.addEventListener('click', function () { state.day = d; renderAll(); });
        strip.appendChild(cell);
      });
      stripWrap.appendChild(strip);
      body.appendChild(stripWrap);

      /* offshore observations now */
      var obsWrap = h('div', 'dd-section');
      obsWrap.appendChild(h('h3', 'dd-h3', 'Offshore now (' + MARINE_ZONES.points[site.marineZone].label + ')'));
      var tiles = h('div', 'tile-grid');
      tiles.appendChild(statTile('≋', 'Swell', fmtM(res.obs.swellH),
        Rating.compass16(res.obs.swellDir) + ' @ ' + (res.obs.swellPer != null ? res.obs.swellPer.toFixed(0) + ' s' : '-')));
      tiles.appendChild(statTile('≫', 'Wind', fmtKn(res.obs.wind),
        Rating.compass16(res.obs.windDir) + (res.obs.gust != null ? ', gusts ' + fmtKn(res.obs.gust) : '')));
      tiles.appendChild(statTile('≈', 'Water', res.obs.sst != null ? res.obs.sst.toFixed(1) + ' °C' : '-', 'sea surface'));
      tiles.appendChild(statTile('☂︎', 'Rain 72 h', res.obs.rain72.toFixed(1) + ' mm', 'catchment runoff'));
      tiles.appendChild(statTile('→', 'Current', res.obs.cur != null ? res.obs.cur.toFixed(1) + ' km/h' : '-',
        res.obs.curDir != null ? 'setting ' + Rating.compass16(res.obs.curDir) : 'ocean surface'));
      tiles.appendChild(statTile('☁︎', 'Air', res.obs.temp != null ? Math.round(res.obs.temp) + ' °C' : '-',
        res.obs.cloud != null ? Math.round(res.obs.cloud) + '% cloud' : ''));
      obsWrap.appendChild(tiles);
      body.appendChild(obsWrap);

      /* 48-h charts */
      var chartWrap = h('div', 'dd-section');
      chartWrap.appendChild(h('h3', 'dd-h3', 'Next 48 hours'));
      var chartBox = h('div', 'chart-box');
      chartWrap.appendChild(chartBox);
      body.appendChild(chartWrap);

      var f = state.feeds, i0 = f.nowIndex, i1 = Math.min(i0 + 48, f.time.length);
      var times = f.time.slice(i0, i1);
      Charts.twin(chartBox, {
        times: times,
        ariaLabel: '48 hour sea state and wind forecast for ' + site.name,
        series: [
          {
            label: 'Sea state at site', sub: 'swell adjusted for shelter (m)',
            color: seriesBlue(), step: 0.5,
            values: res.series.effSea.slice(i0, i1),
            fmt: function (v) { return v.toFixed(1) + ' m'; },
            fmtTick: function (v) { return v.toFixed(1); }
          },
          {
            label: 'Wind', sub: 'knots',
            color: seriesAqua(), step: 5,
            values: res.series.effWind.slice(i0, i1).map(function (v, idx) {
              return f.weather[site.weatherZone].wind[i0 + idx];
            }),
            fmt: function (v) { return Math.round(v) + ' kn'; },
            fmtTick: function (v) { return String(Math.round(v)); }
          }
        ]
      });

      /* tide */
      var tideWrap = h('div', 'dd-section');
      var tideTitle = h('h3', 'dd-h3', 'Tide (modelled sea level)');
      tideWrap.appendChild(tideTitle);
      if (site.tideCritical) {
        tideWrap.appendChild(h('p', 'tide-note', 'Only diveable around slack water, time your entry to the top (or bottom) of the tide.'));
      }
      var sl = f.marine[site.marineZone].seaLevel;
      if (sl) {
        var t0 = Math.max(0, i0 - 2), t1 = Math.min(i0 + 36, f.time.length);
        var tideBox = h('div', 'chart-box');
        tideWrap.appendChild(tideBox);
        var evts = res.tides;
        var nextLine = evts.slice(0, 3).map(function (e) {
          return e.type + ' ' + timeShort(e.time);
        }).join(' · ');
        tideWrap.appendChild(h('div', 'tide-events', nextLine));
        body.appendChild(tideWrap);
        Charts.tide(tideBox, {
          times: f.time.slice(t0, t1), values: sl.slice(t0, t1),
          events: evts, offset: t0, color: seriesBlue()
        });
      }
    } else {
      body.appendChild(h('div', 'empty', state.loading ? 'Loading conditions…' : 'No live data available.'));
    }

    /* about the site */
    var info = h('div', 'dd-section');
    info.appendChild(h('h3', 'dd-h3', 'About this site'));
    info.appendChild(h('p', 'dd-blurb', site.blurb));
    var dl = h('dl', 'dd-dl');
    var addRow = function (k, v) {
      dl.appendChild(h('dt', null, k));
      dl.appendChild(h('dd', null, v));
    };
    addRow('Entry', site.entry);
    addRow('Heads up', site.hazards);
    info.appendChild(dl);

    var links = h('div', 'dd-links');
    var gm = h('a', 'link-btn');
    gm.appendChild(h('span', 'link-ico', '⌖'));
    gm.appendChild(h('span', null,
      site.type === 'shore' ? 'Open entry point in Google Maps' : 'Open GPS mark in Google Maps'));
    gm.href = 'https://www.google.com/maps/search/?api=1&query=' + site.lat + ',' + site.lng;
    gm.target = '_blank'; gm.rel = 'noopener';
    links.appendChild(gm);
    if (site.mc) {
      var mg = h('a', 'link-btn');
      mg.appendChild(h('span', 'link-ico', '↗'));
      mg.appendChild(h('span', null, 'Read McFadyen’s full site guide'));
      mg.href = 'https://www.michaelmcfadyenscuba.info/viewpage.php?page_id=' + site.mc;
      mg.target = '_blank'; mg.rel = 'noopener';
      links.appendChild(mg);
    } else if (site.viz) {
      var vg = h('a', 'link-btn');
      vg.appendChild(h('span', 'link-ico', '↗'));
      vg.appendChild(h('span', null, 'Read the Viz site guide'));
      vg.href = 'https://www.viz.net.au' + site.viz;
      vg.target = '_blank'; vg.rel = 'noopener';
      links.appendChild(vg);
    }
    info.appendChild(links);
    body.appendChild(info);

    body.scrollTop = prevScroll;
  }

  /* ---------------- data loading ---------------- */

  function load(force) {
    state.loading = true;
    document.body.classList.add('refreshing');
    renderList();
    Conditions.load(force).then(function (feeds) {
      state.feeds = feeds;
      state.results = Rating.computeAll(DIVE_SITES, feeds, RATING_PARAMS);
      state.loading = false;
      document.body.classList.remove('refreshing');
      renderAll();
    }).catch(function (err) {
      state.loading = false;
      document.body.classList.remove('refreshing');
      var banner = q('#banner');
      banner.textContent = 'Could not load conditions (' + err.message + '). Check your connection and retry.';
      banner.hidden = false;
      renderList();
      if (window.__bootErrors) window.__bootErrors.push(String(err));
    });
  }

  function renderAll() {
    renderToolbar();
    renderStatus();
    renderDayBrief();
    renderList();
    renderMarkers();
    if (state.open) renderDetail(true);
  }

  /* ---------------- boot ---------------- */

  function boot() {
    /* area picker: AREAS order (north to south) + All NSW */
    var areaSel = q('#area');
    AREAS.order.forEach(function (a) {
      var opt = h('option', null, AREAS.info[a].label);
      opt.value = a;
      areaSel.appendChild(opt);
    });
    var allOpt = h('option', null, AREAS.all.label);
    allOpt.value = 'all';
    areaSel.appendChild(allOpt);

    /* deep link into a site outside the saved area: follow the link */
    if (location.hash.indexOf('#site=') === 0) {
      var linked = SITE_BY_ID[location.hash.slice(6)];
      if (linked && state.area !== 'all' && linked.area !== state.area) state.area = linked.area;
    }
    areaSel.value = state.area;
    syncAreaUI();
    areaSel.addEventListener('change', function (e) { setArea(e.target.value); });

    initMap();
    renderToolbar();
    renderList();

    q('#refresh').addEventListener('click', function () { load(true); });
    q('#theme-toggle').addEventListener('click', toggleTheme);
    applyThemeButton();
    if (window.matchMedia) {
      try {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
          if (themeMode() === 'auto') { applyTheme('auto'); renderAll(); }
        });
      } catch (e) { /* older Safari addListener, non-critical */ }
    }
    q('#drawer-close').addEventListener('click', closeDetail);
    q('#about-open').addEventListener('click', function () { q('#about').showModal(); });
    q('#about-close').addEventListener('click', function () { q('#about').close(); });

    /* phone region picker: tappable north-to-south list in a dialog */
    var regionDlg = q('#region');
    function renderRegionList() {
      var list = q('#region-list');
      list.textContent = '';
      AREAS.order.concat(['all']).forEach(function (a) {
        var info = areaInfo(a);
        var n = a === 'all'
          ? DIVE_SITES.length
          : DIVE_SITES.filter(function (s) { return s.area === a; }).length;
        var row = h('button', 'region-row' + (state.area === a ? ' active' : ''));
        row.type = 'button';
        row.appendChild(h('span', 'rr-lab', info.label));
        row.appendChild(h('span', 'rr-n', n + ' sites'));
        row.addEventListener('click', function () {
          regionDlg.close();
          setArea(a);
        });
        list.appendChild(row);
      });
    }
    /* fade cue at the list's bottom edge while more areas are below */
    var regionListEl = q('#region-list');
    function updateRegionFade() {
      regionListEl.classList.toggle('more-below',
        regionListEl.scrollTop + regionListEl.clientHeight < regionListEl.scrollHeight - 4);
    }
    regionListEl.addEventListener('scroll', updateRegionFade);
    q('#region-btn').addEventListener('click', function () {
      renderRegionList();
      regionDlg.showModal();
      updateRegionFade();
    });
    q('#region-close').addEventListener('click', function () { regionDlg.close(); });
    regionDlg.addEventListener('click', function (e) {
      if (e.target === regionDlg) regionDlg.close();
    });
    q('#search').addEventListener('input', function (e) { state.search = e.target.value; renderList(); renderMarkers(); });
    q('#sort').addEventListener('change', function (e) { state.sort = e.target.value; renderList(); });
    q('#sort-dir').addEventListener('click', function () {
      state.sortDir *= -1;
      this.textContent = state.sortDir === 1 ? '↓' : '↑';
      this.title = state.sortDir === 1 ? 'Reverse order' : 'Natural order';
      renderList();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.open) closeDetail();
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.feeds && Date.now() - state.feeds.fetchedAt > Conditions.TTL_MS) load(false);
    });

    if (location.hash.indexOf('#site=') === 0) {
      var id = location.hash.slice(6);
      if (DIVE_SITES.some(function (s) { return s.id === id; })) state.open = id;
    }

    load(false);
    if (state.open) {
      q('#drawer').classList.add('open');
      renderDetail();
    }

    /* dev: ?debug=toggle measures geometry across two real toggle clicks */
    if (location.search.indexOf('debug=toggle') >= 0) {
      var grab = function () {
        var sels = ['header.app-header', '.brand h1', '.tagline', '#water-temp', '#updated', '#theme-toggle',
          '#refresh', '#about-open', '.toolbar', '#day-chips', '#type-chips', '.sidebar', '#search', '#sort',
          '#sort-dir', '#summary', '#daybrief', '#site-list', '#map', '.site-card', '.day-chip', '.type-chip', '.mk'];
        var out = [];
        sels.forEach(function (sel) {
          var els = document.querySelectorAll(sel);
          for (var i = 0; i < Math.min(els.length, 4); i++) {
            var r = els[i].getBoundingClientRect();
            out.push(sel + '[' + i + ']' + r.x.toFixed(2) + ',' + r.y.toFixed(2) + ',' + r.width.toFixed(2) + ',' + r.height.toFixed(2));
          }
        });
        return out;
      };
      setTimeout(function () {
        var A = grab();
        q('#theme-toggle').click();
        setTimeout(function () {
          var B = grab();
          q('#theme-toggle').click();
          setTimeout(function () {
            var C = grab();
            var diffs = [];
            for (var i = 0; i < A.length; i++) {
              if (A[i] !== B[i]) diffs.push('A≠B ' + A[i] + ' -> ' + B[i]);
              if (A[i] !== C[i]) diffs.push('A≠C ' + A[i] + ' -> ' + C[i]);
            }
            document.getElementById('boot-errors').textContent =
              'TOGGLEDIFF|' + (diffs.length ? diffs.join('|') : 'ZERO-MOVEMENT across ' + A.length + ' rects');
          }, 400);
        }, 400);
      }, 6000);
    }

    /* dev: ?debug=rects dumps element geometry into #boot-errors for layout diffing */
    if (location.search.indexOf('debug=rects') >= 0) {
      setTimeout(function () {
        var sels = ['header.app-header', '.brand h1', '.tagline', '#water-temp', '#updated', '#theme-toggle',
          '#refresh', '#about-open', '.toolbar', '#day-chips', '#type-chips', '.sidebar', '.sidebar-controls',
          '#search', '#sort', '#sort-dir', '#summary', '#daybrief', '#site-list', '#map', '.site-card', '.day-chip'];
        var out = [];
        sels.forEach(function (sel) {
          var els = document.querySelectorAll(sel);
          for (var i = 0; i < Math.min(els.length, 3); i++) {
            var r = els[i].getBoundingClientRect();
            out.push(sel + '[' + i + '] ' + r.x.toFixed(2) + ',' + r.y.toFixed(2) + ',' + r.width.toFixed(2) + ',' + r.height.toFixed(2));
          }
        });
        document.getElementById('boot-errors').textContent = 'RECTS|' + out.join('|');
      }, 6000);
    }
  }

  window.__bootErrors = [];
  window.addEventListener('error', function (e) {
    window.__bootErrors.push(e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno);
    var el = document.getElementById('boot-errors');
    if (el) el.textContent = window.__bootErrors.join(' | ');
  });

  document.addEventListener('DOMContentLoaded', boot);
})();
