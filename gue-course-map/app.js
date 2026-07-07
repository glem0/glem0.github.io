/* GUE Course Map — static site, no scraping in the browser.
   Renders schedule.json (the parsed GUE class schedule, refreshed a few times a
   day by a GitHub Action), resolves locations against the bundled geo.js lookup
   (geocoding any unknown ones live), and plots everything on the map. */
(function () {
  "use strict";

  /* ============================ config ============================ */
  const SCHEDULE_JSON = "schedule.json";      // same-origin, published by the Action

  const SCHED_CACHE_KEY = "gue_schedule_v2";  // last good schedule, for instant paint
  const GEO_CACHE_KEY = "gue_geo_v1";
  const FETCH_TIMEOUT = 15000;       // ms for the schedule.json fetch
  const GEOCODE_CAP = 40;            // max live geocodes per session (politeness)

  /* ======================= course families ======================= */
  const FAMILIES = [
    ["Recreational", "#3a86ff"], ["Fundamentals", "#17b3a3"], ["Primers", "#f4a52e"],
    ["Specialty", "#59a14f"], ["Cave", "#e8722b"], ["Technical", "#e23b3b"],
    ["CCR", "#9b5de5"], ["Instructor Training", "#ec4899"], ["First Aid", "#8896a6"],
  ];
  const famColor = {}; FAMILIES.forEach(([n, c]) => (famColor[n] = c));

  const FAMILY_OF = {};
  const A = (fam, titles) => titles.forEach(t => (FAMILY_OF[t] = fam));
  A("Recreational", ["Discover Diving", "Scuba Diver", "Scuba Diver Upgrade to OW",
    "Open Water Diver", "Advanced Open Water Diver", "Master Diver",
    "Recreational Dive Leader", "GUE Performance Diver"]);
  A("Fundamentals", ["GUE Basic Fundamentals", "GUE Technical Fundamentals",
    "Upgrade to GUE Basic Fundamentals", "Upgrade to GUE Technical Fundamentals"]);
  A("Primers", ["Doubles Primer", "Drysuit Primer", "Navigation Primer",
    "Rescue Primer", "Deep Primer"]);
  A("Specialty", ["DPV Diver 1", "Documentation Diver", "Photogrammetry Diver",
    "Scientific Diver", "Gas Blender"]);
  A("Cave", ["Cave Diver 1", "Cave Diver 2", "Cave Diver 3", "Cave Sidemount",
    "Triox Cave Upgrade", "Underwater Cave Survey", "DPV Cave", "CCR Cave"]);
  A("Technical", ["Technical Diver 1", "Technical Diver 2", "Technical Diver 3"]);
  A("CCR", ["CCR Fundamentals: JJ-CCR", "CCR Fundamentals: Symbios",
    "CCR Technical Diver 1: JJ-CCR", "CCR Technical Diver 1: Symbios",
    "Upgrade to CCR Tech 1: JJ-CCR", "Upgrade to CCR Tech 1: Symbios",
    "CCR Technical Diver 2", "PSCR Diver"]);
  A("Instructor Training", ["Core Module", "Apprentice Project: Cave 2",
    "Apprentice Project: Tech 2", "ITC Rec 1 / Fundamentals", "ITC Recreational Diver 1",
    "ITC GUE Performance Diver", "ITC GUE Fundamentals", "ITC Technical Diver 1",
    "ITC Cave Diver 1", "BLS-D & Oxygen First Aid Instructor",
    "Advanced Oxygen & Neuro Instructor", "First Aid Instructor"]);
  A("First Aid", ["BLS-D & Oxygen First Aid", "BLS-D & Oxygen First Aid Refresher",
    "Advanced Oxygen First Aid & Neuro", "First Aid & Marine Life Injuries"]);

  function familyFor(title) {
    if (FAMILY_OF[title]) return FAMILY_OF[title];
    const t = title.toLowerCase();
    if (t.includes("ccr") || t.includes("pscr")) return "CCR";
    if (t.includes("cave")) return "Cave";
    if (t.includes("technical diver") || t.includes("tech ")) return "Technical";
    if (t.includes("fundamentals")) return "Fundamentals";
    if (t.includes("primer")) return "Primers";
    if (t.includes("itc") || t.includes("instructor") || t.includes("apprentice")) return "Instructor Training";
    if (t.includes("first aid") || t.includes("bls") || t.includes("oxygen")) return "First Aid";
    return "Specialty";
  }

  /* ======================= geo lookup ======================= */
  function loadGeoCache() { try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY)) || {}; } catch (e) { return {}; } }
  function saveGeoCache(o) { try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(o)); } catch (e) {} }
  // Canonicalise location strings (lowercase, collapse whitespace) so casing/spacing
  // variants like "ALmelo, Netherlands" and "Almelo, Netherlands" resolve to one key.
  const canon = s => String(s).trim().toLowerCase().replace(/\s+/g, " ");
  const geoCache = loadGeoCache();
  const GEO = Object.assign({}, window.GUE_GEO || {}, geoCache);  // bundled + learned (canonical keys)
  const coordsFor = loc => GEO[canon(loc)] || null;              // [lat, lng] | null

  async function geocodeOne(loc) {
    const parts = loc.split(",").map(s => s.trim()).filter(Boolean);
    const cands = [loc];
    if (parts.length >= 3) { cands.push(parts[0] + ", " + parts[parts.length - 1]); cands.push(parts[parts.length - 2] + ", " + parts[parts.length - 1]); }
    if (parts.length >= 2) { cands.push(parts[0]); cands.push(parts[parts.length - 1]); }
    for (const q of cands) {
      try {
        const r = await fetchWithTimeout(
          "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(q), 20000);
        if (!r.ok) continue;
        const d = await r.json();
        if (d && d.length) return [+(+d[0].lat).toFixed(5), +(+d[0].lon).toFixed(5)];
      } catch (e) { /* try next candidate */ }
      await sleep(1100);  // Nominatim: max ~1 req/sec
    }
    return null;
  }

  /* ======================= networking ======================= */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  async function fetchWithTimeout(url, ms, headers) {
    const ac = new AbortController();
    const id = setTimeout(() => ac.abort(), ms);
    try { return await fetch(url, { signal: ac.signal, redirect: "follow", headers: headers || {} }); }
    finally { clearTimeout(id); }
  }

  // schedule.json lives on our own origin, so this is one plain fetch. Cache-bust
  // on manual refresh so the CDN/browser cache can't hand back a stale copy.
  async function fetchScheduleData(bust) {
    const url = SCHEDULE_JSON + (bust ? "?t=" + Date.now() : "");
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT);
    if (!res.ok) throw new Error("schedule data HTTP " + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.classes) || !data.classes.length)
      throw new Error("schedule data is empty");
    return data;
  }
  // families are presentation, so they're assigned here rather than baked into the data
  const withFamilies = rows => rows.map(c => Object.assign({}, c, { family: familyFor(c.course) }));

  /* ============================ map ============================ */
  // Infinite horizontal scroll: the world wraps freely. To keep markers visible in
  // every copy of the world — no "pop-in" when you pan across the antimeridian — each
  // marker is also rendered one world east and west (see WORLD_COPIES in render()).
  // Lock north/south at the map's edge so you can't scroll off into grey space, but
  // leave east/west free (huge longitude range) so horizontal wrapping stays infinite.
  const map = L.map("map", {
    zoomControl: false, minZoom: 2, maxZoom: 19,
    maxBounds: [[-85.05, -1e6], [85.05, 1e6]], maxBoundsViscosity: 1.0,
  }).setView([25, 5], 2);
  L.control.zoom({ position: "topright" }).addTo(map);
  L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
  // Original CARTO Voyager basemap — colourful and clean, with its own tidy labels.
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd", maxZoom: 19,
  }).addTo(map);
  const WORLD_COPIES = [-360, 0, 360];  // longitude offsets each marker is duplicated into

  const cluster = L.markerClusterGroup({
    maxClusterRadius: 45, spiderfyOnMaxZoom: true, showCoverageOnHover: false, chunkedLoading: true,
    // Each marker holds a whole location's worth of classes, so a cluster's number is the
    // SUM of its markers' class counts (not the count of markers).
    iconCreateFunction: c => {
      let total = 0;
      c.getAllChildMarkers().forEach(m => { total += m._classCount || 1; });
      const size = total < 10 ? "small" : total < 100 ? "medium" : "large";
      return L.divIcon({ html: `<div><span>${total}</span></div>`,
        className: "marker-cluster marker-cluster-" + size, iconSize: L.point(40, 40) });
    },
  });
  map.addLayer(cluster);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, m =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
  const classUrl = c => c.cid
    ? `https://www.gue.com/gue-class-schedule/class-details?cid=${encodeURIComponent(c.cid)}` : null;

  // One marker per location — a coloured dot, showing a count when several classes share it.
  function dominantColor(vis) {
    const cnt = {};
    vis.forEach(c => (cnt[c.family] = (cnt[c.family] || 0) + 1));
    const fam = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    return famColor[fam] || "#8896a6";
  }
  function groupIcon(vis) {
    const color = dominantColor(vis);
    if (vis.length > 1) {
      return L.divIcon({ className: "",
        html: `<div class="gue-dot gue-multi" style="background:${color}">${vis.length}</div>`,
        iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12] });
    }
    return L.divIcon({ className: "",
      html: `<div class="gue-dot" style="width:14px;height:14px;background:${color}"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -8] });
  }

  // Popup lists every class at the spot; each row is a link that opens the class page.
  function groupPopupHtml(vis) {
    const loc = vis[0] ? vis[0].location : "";
    const rows = vis.map(c => {
      const url = classUrl(c), color = famColor[c.family] || "#8896a6";
      const inner = `<span class="pl-dot" style="background:${color}"></span>`
        + `<span class="pl-main"><span class="pl-course">${esc(c.course)}</span>`
        + `<span class="pl-meta">${esc(c.date)} · ${esc(c.instructor)}</span></span>`
        + (url ? `<span class="pl-go">↗</span>` : "");
      return url
        ? `<a class="pl-row" href="${url}" target="_blank" rel="noopener">${inner}</a>`
        : `<div class="pl-row">${inner}</div>`;
    }).join("");
    return `<div class="pop"><div class="pl-head">${esc(loc)}`
      + `<span class="pl-count">${vis.length} class${vis.length > 1 ? "es" : ""}</span></div>`
      + `<div class="pl-list">${rows}</div></div>`;
  }

  // Hover opens the popup and keeps it open while the cursor is over the marker or popup.
  // Clicking a single-class marker jumps straight to that class in a new tab.
  let hoverTimer = null;
  function attachHover(mk, group) {
    mk.on("mouseover", () => {
      clearTimeout(hoverTimer);
      // At full zoom-out the map is against the N/S lock; letting the popup auto-pan there
      // makes it fight the bound and jitter up/down. Only auto-pan once we're zoomed in.
      const p = mk.getPopup();
      if (p) p.options.autoPan = map.getZoom() > map.getMinZoom();
      mk.openPopup();
    });
    mk.on("mouseout", () => { hoverTimer = setTimeout(() => mk.closePopup(), 220); });
    mk.on("click", () => {
      const vis = group._vis || [];
      if (vis.length === 1 && classUrl(vis[0])) window.open(classUrl(vis[0]), "_blank", "noopener");
      else mk.openPopup();
    });
  }
  map.on("popupopen", e => {
    const el = e.popup.getElement();
    if (!el) return;
    el.addEventListener("mouseenter", () => clearTimeout(hoverTimer));
    el.addEventListener("mouseleave", () => { hoverTimer = setTimeout(() => map.closePopup(), 220); });
  });

  /* ======================= render (re-entrant) ======================= */
  const activeCourses = new Set();  // specific course titles that are on (persists across refreshes)
  const knownCourses = new Set();   // every course seen so far — new ones default on
  let coursesByFamily = new Map();  // family -> Map(course -> count), for the filter UI
  const activeInstructors = new Set();  // instructors that are on (persists across refreshes)
  const knownInstructors = new Set();   // every instructor seen so far — new ones default on
  let instructorCounts = new Map();     // instructor -> class count, for the filter UI
  const state = { q: "", from: "", to: "" };
  let ALL = [];          // all parsed classes (current)
  let groups = [];       // one entry per location: { lat, lng, classes:[], ms, _vis }
  let placedCount = 0;   // total classes that have coordinates
  let firstFit = true;
  let datesInit = false; // prefill date range only once
  let dataMin = "", dataMax = "";  // dataset's earliest/latest class date (for the Reset button)
  let currentWorld = 0;  // which copy of the world the viewport is centred on

  function passClass(c) {
    if (!activeCourses.has(c.course)) return false;
    if (c.instructor && !activeInstructors.has(c.instructor)) return false;
    if (state.q && c.hay.indexOf(state.q) === -1) return false;
    if (state.from && c.iso && c.iso < state.from) return false;  // unknown-date classes
    if (state.to && c.iso && c.iso > state.to) return false;      // are never date-excluded
    return true;
  }

  function applyFilters(fit) {
    const markers = [], bounds = [];
    let shown = 0;
    for (const g of groups) {
      const vis = g.classes.filter(passClass);
      g._vis = vis;
      if (!vis.length) continue;
      shown += vis.length;
      bounds.push([g.lat, g.lng]);
      if (!g.ms) {  // create the world-copy markers once, then reuse across filters
        g.ms = WORLD_COPIES.map(off => {
          const mk = L.marker([g.lat, g.lng + off], { icon: groupIcon(vis) });
          mk.bindPopup("", { closeButton: false, autoClose: true, closeOnClick: true, maxWidth: 340, className: "gue-pop" });
          attachHover(mk, g);
          return mk;
        });
      }
      const icon = groupIcon(vis), html = groupPopupHtml(vis);
      g.ms.forEach(mk => { mk._classCount = vis.length; mk.setIcon(icon); mk.setPopupContent(html); markers.push(mk); });
    }
    cluster.clearLayers();
    cluster.addLayers(markers);
    document.getElementById("shownCount").textContent = shown;
    document.getElementById("ofCount").textContent = "of " + placedCount + " classes";
    if (fit && bounds.length) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.12), { maxZoom: firstFit ? 4 : 8, animate: !firstFit });
      firstFit = false;
    }
  }

  // Each family is a row that toggles all its courses; the chevron expands it to the
  // individual courses so you can narrow to, say, only "Cave Diver 1".
  function famState(famRow, clist) {
    const rows = [...clist.querySelectorAll(".course")];
    const on = rows.filter(r => activeCourses.has(r.dataset.course)).length;
    famRow.classList.toggle("off", on === 0);
    famRow.classList.toggle("partial", on > 0 && on < rows.length);
  }
  function buildFilterUI() {
    const box = document.getElementById("families");
    box.innerHTML = "";
    FAMILIES.forEach(([fam, color]) => {
      const courses = coursesByFamily.get(fam);
      if (!courses || !courses.size) return;
      const famCount = [...courses.values()].reduce((a, b) => a + b, 0);
      const group = document.createElement("div");
      group.className = "fam-group";

      const famRow = document.createElement("div");
      famRow.className = "fam";
      famRow.innerHTML =
        `<span class="chev">▸</span>` +
        `<span class="swatch" style="background:${color}"></span>` +
        `<span class="name">${esc(fam)}</span>` +
        `<span class="n">${famCount}</span>`;

      const clist = document.createElement("div");
      clist.className = "courses"; clist.hidden = true;
      [...courses.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).forEach(([course, cnt]) => {
        const row = document.createElement("div");
        row.className = "course" + (activeCourses.has(course) ? "" : " off");
        row.dataset.course = course;
        row.innerHTML = `<span class="cbox"></span><span class="cname">${esc(course)}</span><span class="cn">${cnt}</span>`;
        row.addEventListener("click", () => {
          if (activeCourses.has(course)) { activeCourses.delete(course); row.classList.add("off"); }
          else { activeCourses.add(course); row.classList.remove("off"); }
          famState(famRow, clist);
          applyFilters(false);
        });
        clist.appendChild(row);
      });

      const chev = famRow.querySelector(".chev");
      chev.addEventListener("click", (e) => {
        e.stopPropagation();
        clist.hidden = !clist.hidden;
        chev.textContent = clist.hidden ? "▸" : "▾";
      });
      famRow.addEventListener("click", () => {
        const all = [...courses.keys()];
        const allOn = all.every(c => activeCourses.has(c));
        all.forEach(c => (allOn ? activeCourses.delete(c) : activeCourses.add(c)));
        clist.querySelectorAll(".course").forEach(r => r.classList.toggle("off", !activeCourses.has(r.dataset.course)));
        famState(famRow, clist);
        applyFilters(false);
      });

      famState(famRow, clist);
      group.appendChild(famRow); group.appendChild(clist);
      box.appendChild(group);
    });
  }

  // Scrollable, searchable instructor list (reuses the .course row styling).
  function buildInstructorUI() {
    const box = document.getElementById("instructors");
    box.innerHTML = "";
    const q = (document.getElementById("instSearch").value || "").trim().toLowerCase();
    [...instructorCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([name, cnt]) => {
        if (q && name.toLowerCase().indexOf(q) === -1) return;
        const row = document.createElement("div");
        row.className = "course" + (activeInstructors.has(name) ? "" : " off");
        row.dataset.inst = name;
        row.innerHTML = `<span class="cbox"></span><span class="cname">${esc(name)}</span><span class="cn">${cnt}</span>`;
        row.addEventListener("click", () => {
          if (activeInstructors.has(name)) { activeInstructors.delete(name); row.classList.add("off"); }
          else { activeInstructors.add(name); row.classList.remove("off"); }
          applyFilters(false);
        });
        box.appendChild(row);
      });
  }

  // Turn parsed classes into map data; render everything. Safe to call repeatedly.
  function render(classes, fit) {
    ALL = classes;
    const geoStats = { unplaced: 0 };
    const gmap = new Map();   // "lat,lng" -> group (all classes sharing a spot)
    const byFam = new Map();  // family -> Map(course -> count)
    const instMap = new Map(); // instructor -> class count
    placedCount = 0;
    classes.forEach(c => {
      const xy = coordsFor(c.location);
      if (!xy) { geoStats.unplaced++; return; }
      placedCount++;
      const key = xy[0] + "," + xy[1];
      let g = gmap.get(key);
      if (!g) { g = { lat: xy[0], lng: xy[1], classes: [], ms: null, _vis: [] }; gmap.set(key, g); }
      g.classes.push(Object.assign({}, c, {
        hay: (c.course + " " + c.location + " " + c.instructor).toLowerCase(),
      }));
      if (!byFam.has(c.family)) byFam.set(c.family, new Map());
      const cm = byFam.get(c.family);
      cm.set(c.course, (cm.get(c.course) || 0) + 1);
      if (!knownCourses.has(c.course)) { knownCourses.add(c.course); activeCourses.add(c.course); }  // new course defaults on
      if (c.instructor) {
        instMap.set(c.instructor, (instMap.get(c.instructor) || 0) + 1);
        if (!knownInstructors.has(c.instructor)) { knownInstructors.add(c.instructor); activeInstructors.add(c.instructor); }
      }
    });
    groups = [...gmap.values()];
    coursesByFamily = byFam;
    instructorCounts = instMap;
    // Date bounds. The default From is TODAY (clamped to the data's range), not the
    // dataset minimum — the published data can lag behind real time, and classes that
    // already started must not show unless the user widens the range themselves.
    const isos = classes.map(c => c.iso).filter(Boolean).sort();
    if (isos.length) {
      dataMin = isos[0]; dataMax = isos[isos.length - 1];
      const f = document.getElementById("from"), t = document.getElementById("to");
      f.min = t.min = dataMin; f.max = t.max = dataMax;
      if (!datesInit) {  // once only — don't clobber the user's picks on refresh
        const today = todayISO();
        f.value = state.from = dataMin < today ? (today <= dataMax ? today : dataMax) : dataMin;
        t.value = state.to = dataMax;
        datesInit = true;
      }
    }

    buildFilterUI();
    buildInstructorUI();
    applyFilters(fit);
    return geoStats;
  }

  /* ======================= status / UI ======================= */
  function setStatus(kind, text) {
    const el = document.getElementById("status");
    el.className = "status " + kind;
    document.getElementById("statusText").textContent = text;
    // while a fetch is in flight: spin the header refresh glyph and fade the app
    // behind the centred-spinner veil (visual only — the map stays interactive)
    document.getElementById("refreshBtn").classList.toggle("busy", kind === "loading");
    document.getElementById("veil").classList.toggle("hidden", kind !== "loading");
  }
  function statusLive(iso) { setStatus("live", "Schedule updated " + fmtWhen(iso)); }
  function statusCached(iso, stale) {
    setStatus(stale ? "cached" : "live",
      (stale ? "Cached copy · " : "Schedule updated ") + fmtWhen(iso));
  }
  function hideLoader() { document.getElementById("loader").classList.add("hidden"); }
  function showError(msg) {
    const l = document.getElementById("loader");
    l.classList.remove("hidden"); l.classList.add("error");
    document.getElementById("loaderTitle").textContent = "Couldn’t load the schedule";
    document.getElementById("loaderMsg").innerHTML = esc(msg) +
      "<br><br>This is usually temporary — retrying normally works.";
    document.getElementById("loaderRetry").style.display = "";
  }
  function fmtWhen(iso) {
    try { return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
    catch (e) { return iso; }
  }
  function todayISO() {  // local date — "past" means past for the visitor
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /* ======================= schedule cache ======================= */
  function loadSchedCache() { try { return JSON.parse(localStorage.getItem(SCHED_CACHE_KEY)); } catch (e) { return null; } }
  function saveSchedCache(data) {
    try { localStorage.setItem(SCHED_CACHE_KEY, JSON.stringify({ at: data.updated, classes: data.classes })); } catch (e) {}
  }

  /* ======================= background geocoding ======================= */
  async function geocodeUnknowns() {
    // one entry per canonical key (so "ALmelo"/"Almelo" aren't geocoded twice)
    const unknownMap = new Map();
    ALL.forEach(c => { const k = canon(c.location); if (!GEO[k] && !unknownMap.has(k)) unknownMap.set(k, c.location); });
    if (!unknownMap.size) return;
    const note = document.getElementById("geonote");
    const todo = [...unknownMap.values()].slice(0, GEOCODE_CAP);
    let placed = 0;
    for (let i = 0; i < todo.length; i++) {
      note.style.display = "";
      note.textContent = `Locating ${todo.length - i} new location${todo.length - i > 1 ? "s" : ""}…`;
      const xy = await geocodeOne(todo[i]);
      if (xy) { const k = canon(todo[i]); GEO[k] = xy; geoCache[k] = xy; saveGeoCache(geoCache); placed++; render(ALL, false); }
    }
    const missing = [...new Set(ALL.map(c => c.location))].filter(loc => !coordsFor(loc)).length;
    note.textContent = missing
      ? `${missing} location${missing > 1 ? "s" : ""} couldn’t be placed on the map.`
      : "";
    if (!missing) note.style.display = "none";
  }

  /* ============================ main ============================ */
  async function load(force) {
    const loader = document.getElementById("loader");
    loader.classList.remove("error");
    document.getElementById("loaderRetry").style.display = "none";
    document.getElementById("loaderTitle").textContent = "Loading GUE schedule…";

    const cached = loadSchedCache();
    const haveCache = !!(cached && cached.classes && cached.classes.length);
    if (haveCache) { render(withFamilies(cached.classes), true); hideLoader(); }  // instant paint

    // Spinner/veil only for a first load or a manual refresh; with a cached paint
    // on screen the update is quick and quiet.
    if (force || !haveCache) setStatus("loading", haveCache ? "Refreshing…" : "Loading schedule…");
    try {
      const data = await fetchScheduleData(force);
      saveSchedCache(data);
      render(withFamilies(data.classes), !haveCache);  // only auto-fit if we hadn't already painted
      hideLoader();
      statusLive(data.updated);
      geocodeUnknowns();                     // background, non-blocking
    } catch (e) {
      // Data file unreachable → keep the last good schedule on screen.
      if (haveCache) {
        statusCached(cached.at, true);       // stale but usable
        geocodeUnknowns();
      } else {
        showError((e && e.message) || String(e));
      }
    }
  }

  /* ======================= static UI wiring ======================= */
  document.getElementById("allBtn").onclick = () => {
    knownCourses.forEach(c => activeCourses.add(c));
    buildFilterUI();
    applyFilters(false);
  };
  document.getElementById("noneBtn").onclick = () => {
    activeCourses.clear();
    buildFilterUI();
    applyFilters(false);
  };
  document.getElementById("instAll").onclick = () => {
    knownInstructors.forEach(i => activeInstructors.add(i));
    buildInstructorUI();
    applyFilters(false);
  };
  document.getElementById("instNone").onclick = () => {
    activeInstructors.clear();
    buildInstructorUI();
    applyFilters(false);
  };
  let dqi;
  document.getElementById("instSearch").addEventListener("input", () => {
    clearTimeout(dqi); dqi = setTimeout(buildInstructorUI, 120);
  });
  let dq;
  document.getElementById("q").addEventListener("input", e => {
    clearTimeout(dq); const v = e.target.value.trim().toLowerCase();
    dq = setTimeout(() => { state.q = v; applyFilters(false); }, 140);
  });
  const fromEl = document.getElementById("from"), toEl = document.getElementById("to");
  function syncDates() { state.from = fromEl.value || ""; state.to = toEl.value || ""; applyFilters(false); }
  ["change", "input"].forEach(ev => { fromEl.addEventListener(ev, syncDates); toEl.addEventListener(ev, syncDates); });
  document.getElementById("dateReset").onclick = () => {  // restore the full date range
    fromEl.value = state.from = dataMin;
    toEl.value = state.to = dataMax;
    applyFilters(false);
  };
  document.getElementById("toggle").onclick = () => {
    document.getElementById("panel").classList.toggle("collapsed");
    setTimeout(() => map.invalidateSize(), 260);
  };
  // Fade the content just above the footer while the filter pane has more below
  // the fold, so the hard cut-off reads as "scroll for more".
  {
    const body = document.querySelector("#panel .body");
    const foot = document.querySelector("#panel .foot");
    const updateFade = () =>
      foot.classList.toggle("more", body.scrollTop + body.clientHeight < body.scrollHeight - 4);
    body.addEventListener("scroll", updateFade, { passive: true });
    addEventListener("resize", updateFade);
    // attributes too: expanding a course family just flips a [hidden] attribute
    new MutationObserver(updateFade).observe(body, { childList: true, subtree: true, attributes: true });
    updateFade();
  }

  // On phones the open panel covers most of the map, so tapping the exposed map
  // dismisses it — like tapping outside a drawer. (Panning/zooming doesn't fire
  // "click", and on desktop the panel and map coexist, so leave it alone there.)
  map.on("click", () => {
    const panel = document.getElementById("panel");
    if (matchMedia("(max-width: 640px)").matches && !panel.classList.contains("collapsed")) {
      panel.classList.add("collapsed");
      setTimeout(() => map.invalidateSize(), 260);
    }
  });
  document.getElementById("loaderRetry").onclick = () => load(true);
  document.getElementById("refreshBtn").onclick = () => load(true);

  // Keep the 3 marker copies centred on wherever you've panned to, so markers never
  // run out no matter how far you keep scrolling in one direction.
  map.on("moveend", () => {
    const k = Math.round(map.getCenter().lng / 360);
    if (k === currentWorld || !groups.length) return;
    currentWorld = k;
    for (const g of groups) {
      if (!g.ms) continue;
      for (let i = 0; i < g.ms.length; i++) g.ms[i].setLatLng([g.lat, g.lng + (k + i - 1) * 360]);
    }
    applyFilters(false);  // re-cluster at the shifted positions
  });

  load();
})();
