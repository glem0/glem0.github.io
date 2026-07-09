/* ============================================================
 * Conditions loader, Open-Meteo marine + weather, no API key.
 * Two batched requests cover every site via 5 offshore marine
 * points and 5 land weather points. Responses are cached in
 * localStorage for 30 min; on network failure we fall back to
 * whatever cache exists (marked stale).
 * ============================================================ */

var Conditions = (function () {
  'use strict';

  var TTL_MS = 30 * 60 * 1000;
  var BW_TTL_MS = 60 * 60 * 1000;       // Beachwatch: forecasts reissue twice daily; recheck hourly
  var PAST_DAYS = 3, FORECAST_DAYS = 7;
  var CACHE_PREFIX = 'sdc.v4.';   // bump when zones or requested variables change

  var MARINE_HOURLY = [
    'wave_height', 'swell_wave_height', 'swell_wave_direction', 'swell_wave_period',
    'secondary_swell_wave_height', 'secondary_swell_wave_direction', 'secondary_swell_wave_period',
    'wind_wave_height', 'wind_wave_direction', 'sea_surface_temperature', 'sea_level_height_msl',
    'ocean_current_velocity', 'ocean_current_direction'
  ];
  var WEATHER_HOURLY = ['precipitation', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    'temperature_2m', 'cloud_cover'];

  /* Beachwatch's API sends no CORS headers, so a scheduled GitHub Action
     (update-dive-nsw-data.yml in the Pages repo) snapshots the feed into
     data/beachwatch.json after each forecast reissue, wrapped as
     {source, data}. Same origin, so no CORS and the Pages CDN is one
     shared cache for every visitor. The snapshot is the only source: if
     it can't be fetched we fall back to whatever localStorage holds,
     else the Beachwatch panel simply doesn't render. (Means no panel
     when developing from a checkout without a data/ dir.) */
  var BW_SNAPSHOT_URL = 'data/beachwatch.json';

  function zoneCsv(zones, key) {
    return zones.order.map(function (z) { return zones.points[z][key === 'lat' ? 'lat' : 'lon']; }).join(',');
  }

  function marineUrl() {
    return 'https://marine-api.open-meteo.com/v1/marine' +
      '?latitude=' + zoneCsv(MARINE_ZONES, 'lat') + '&longitude=' + zoneCsv(MARINE_ZONES, 'lon') +
      '&hourly=' + MARINE_HOURLY.join(',') +
      '&timezone=Australia%2FSydney&past_days=' + PAST_DAYS + '&forecast_days=' + FORECAST_DAYS;
  }

  function weatherUrl() {
    return 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + zoneCsv(WEATHER_ZONES, 'lat') + '&longitude=' + zoneCsv(WEATHER_ZONES, 'lon') +
      '&hourly=' + WEATHER_HOURLY.join(',') + '&daily=sunrise,sunset,precipitation_sum' +
      '&timezone=Australia%2FSydney&past_days=' + PAST_DAYS + '&forecast_days=' + FORECAST_DAYS +
      '&wind_speed_unit=kn';
  }

  function floodUrl() {
    var keys = Object.keys(FLOOD_RIVERS);
    var lats = keys.map(function (k) { return FLOOD_RIVERS[k].lat; }).join(',');
    var lons = keys.map(function (k) { return FLOOD_RIVERS[k].lon; }).join(',');
    return 'https://flood-api.open-meteo.com/v1/flood?latitude=' + lats + '&longitude=' + lons +
      '&daily=river_discharge&past_days=31&forecast_days=' + FORECAST_DAYS;
  }

  /* per-waterBody array of daily discharge ratios vs a 31-day quiet baseline;
     ratio >> 1 means the catchment is in flood and vis will be wrecked */
  function normalizeFlood(resp) {
    var arr = asArray(resp);
    var keys = Object.keys(FLOOD_RIVERS);
    var out = {};
    keys.forEach(function (k, idx) {
      var loc = arr[idx];
      if (!loc || !loc.daily || !loc.daily.river_discharge) return;
      var q = loc.daily.river_discharge;
      var past = q.slice(0, 31).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
      if (past.length < 10) return;
      var baseline = Math.max(past[Math.floor(past.length * 0.25)], 0.5);
      var ratios = [];
      for (var d = 0; d < FORECAST_DAYS; d++) {
        var v = q[31 + d];
        ratios.push(v != null ? v / baseline : null);
      }
      FLOOD_RIVERS[k].affects.forEach(function (body) { out[body] = ratios; });
    });
    return out;
  }

  function loadBeachwatch(force) {
    var hit = cacheGet('beachwatch');
    if (!force && hit && Date.now() - hit.t < BW_TTL_MS) return Promise.resolve(hit.data);
    return fetchJson(BW_SNAPSHOT_URL).then(function (j) {
      j = j && j.data;
      if (!j || !j.features || !j.features.length) throw new Error('bad payload');
      cachePut('beachwatch', j);
      return j;
    }).catch(function () {
      return hit ? hit.data : null;
    });
  }

  /* ---------- tiny cache (works even if localStorage is unavailable) ---------- */

  function cacheGet(key) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function cachePut(key, data) {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), data: data })); }
    catch (e) { /* private mode / quota, fine, just no cache */ }
  }

  function fetchJson(url, init) {
    return fetch(url, init).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + url.split('?')[0]);
      return r.json();
    });
  }

  function getFeed(key, url, force) {
    var hit = cacheGet(key);
    if (!force && hit && Date.now() - hit.t < TTL_MS) {
      return Promise.resolve({ data: hit.data, fetchedAt: hit.t, stale: false, fromCache: true });
    }
    return fetchJson(url).then(function (data) {
      cachePut(key, data);
      return { data: data, fetchedAt: Date.now(), stale: false, fromCache: false };
    }).catch(function (err) {
      if (hit) return { data: hit.data, fetchedAt: hit.t, stale: true, fromCache: true, error: err };
      throw err;
    });
  }

  /* ---------- "now" in Sydney, independent of the viewer's timezone ---------- */

  function sydneyNowParts() {
    var fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    var parts = {};
    fmt.formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    if (parts.hour === '24') parts.hour = '00';
    return { date: parts.year + '-' + parts.month + '-' + parts.day, hour: parseInt(parts.hour, 10) };
  }

  /* ---------- normalize the two responses into aligned zone series ---------- */

  function asArray(resp) { return Array.isArray(resp) ? resp : [resp]; }

  function normalize(marineResp, weatherResp) {
    var marineArr = asArray(marineResp), weatherArr = asArray(weatherResp);
    var time = marineArr[0].hourly.time;

    var marine = {};
    MARINE_ZONES.order.forEach(function (z, i) {
      var h = marineArr[i].hourly;
      marine[z] = {
        swellH: h.swell_wave_height, swellDir: h.swell_wave_direction, swellPer: h.swell_wave_period,
        swell2H: h.secondary_swell_wave_height || null, swell2Dir: h.secondary_swell_wave_direction || null,
        swell2Per: h.secondary_swell_wave_period || null,
        windWaveH: h.wind_wave_height, windWaveDir: h.wind_wave_direction,
        waveH: h.wave_height, sst: h.sea_surface_temperature, seaLevel: h.sea_level_height_msl || null,
        cur: h.ocean_current_velocity || null, curDir: h.ocean_current_direction || null
      };
    });

    var weather = {};
    WEATHER_ZONES.order.forEach(function (z, i) {
      var h = weatherArr[i].hourly;
      /* weather + marine timelines both start at 00:00 (past_days ago) local;
         align defensively in case array lengths ever differ */
      var offset = h.time.indexOf(time[0]);
      var slice = function (arr) { return offset > 0 ? arr.slice(offset) : arr; };
      weather[z] = {
        precip: slice(h.precipitation), wind: slice(h.wind_speed_10m),
        windDir: slice(h.wind_direction_10m), gust: slice(h.wind_gusts_10m),
        temp: h.temperature_2m ? slice(h.temperature_2m) : null,
        cloud: h.cloud_cover ? slice(h.cloud_cover) : null
      };
    });

    var d0 = weatherArr[0].daily;
    var daily = { time: d0.time, sunrise: d0.sunrise, sunset: d0.sunset, precipSum: d0.precipitation_sum };

    var now = sydneyNowParts();
    var todayIndex = time.indexOf(now.date + 'T00:00');
    if (todayIndex < 0) todayIndex = Math.min(PAST_DAYS * 24, time.length - 1);
    var nowIndex = Math.min(todayIndex + now.hour, time.length - 1);

    return {
      time: time, marine: marine, weather: weather, daily: daily,
      todayIndex: todayIndex, nowIndex: nowIndex, sydneyNow: now
    };
  }

  function load(force) {
    return Promise.all([
      getFeed('marine', marineUrl(), force),
      getFeed('weather', weatherUrl(), force),
      getFeed('flood', floodUrl(), force).catch(function () { return null; }),
      loadBeachwatch(force).catch(function () { return null; })
    ]).then(function (res) {
      var feeds = normalize(res[0].data, res[1].data);
      feeds.fetchedAt = Math.min(res[0].fetchedAt, res[1].fetchedAt);
      feeds.stale = !!(res[0].stale || res[1].stale);
      feeds.flood = res[2] ? normalizeFlood(res[2].data) : null;
      feeds.beachwatch = res[3];
      return feeds;
    });
  }

  return { load: load, TTL_MS: TTL_MS, normalize: normalize, sydneyNowParts: sydneyNowParts };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Conditions;
