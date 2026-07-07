/* ============================================================
 * Rating engine, pure functions, no DOM.
 * Turns offshore model data into per-site, per-hour dive scores.
 *
 * The idea:
 *   1. "Site-effective sea state" = offshore swell x how exposed
 *      this site is to that swell direction (+ a period kick,
 *      long-period groundswell wraps and surges more).
 *   2. Wind is weighted the same way (onshore breeze hurts,
 *      offshore breeze barely matters).
 *   3. Visibility is estimated from the site's typical vis,
 *      knocked down by recent sea state (stirred sediment) and
 *      recent rainfall (runoff), scaled by runoff sensitivity.
 *   4. Score = weighted blend, with hard caps when the sea or
 *      wind alone make the dive a bad idea.
 * ============================================================ */

var Rating = (function () {
  'use strict';

  var LEVELS = [
    { min: 7, key: 'good', label: 'Good',  ink: '#12242f', color: '#34c163', icon: '●' },
    { min: 5, key: 'fair', label: 'Fair',  ink: '#12242f', color: '#ffc233', icon: '◑' },
    { min: 3, key: 'poor', label: 'Poor',  ink: '#12242f', color: '#ff9166', icon: '◔' },
    { min: -Infinity, key: 'nogo', label: 'No-go', ink: '#12242f', color: '#e85c5c', icon: '○' }
  ];

  var COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

  function compass16(deg) {
    if (deg == null || isNaN(deg)) return '-';
    return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* Interpolated exposure factor for a direction, from the site's
     8-sector [N,NE,E,SE,S,SW,W,NW] exposure array. */
  function sectorFactor(deg, sectors) {
    if (deg == null || isNaN(deg)) return avg(sectors);
    var x = (((deg % 360) + 360) % 360) / 45;
    var i = Math.floor(x) % 8;
    var f = x - Math.floor(x);
    return sectors[i] * (1 - f) + sectors[(i + 1) % 8] * f;
  }

  function avg(arr) {
    var s = 0, n = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] != null && !isNaN(arr[i])) { s += arr[i]; n++; }
    return n ? s / n : null;
  }

  /* Surge reach ≈ period²/4 metres (McFadyen's rule): how hard a swell of
     this period works a site of this depth. Deep wrecks ignore short-period
     chop; long-period groundswell reaches 50 m+. */
  function depthPeriodFactor(meanDepth, per) {
    var reach = (per != null && !isNaN(per)) ? (per * per) / 4 : 20;
    return 0.8 + 0.6 * clamp(1 - meanDepth / Math.max(reach, 1), 0, 1);
  }

  function siteMeanDepth(site) {
    var nums = String(site.depth).match(/\d+(?:\.\d+)?/g);
    if (!nums || !nums.length) return 12;
    return (parseFloat(nums[0]) + parseFloat(nums[nums.length - 1])) / 2;
  }

  function levelFor(score, blown) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (score >= LEVELS[i].min) {
        var lv = Object.assign({}, LEVELS[i]);
        if (blown && lv.key === 'nogo') lv.label = 'Blown out';
        return lv;
      }
    }
    return LEVELS[LEVELS.length - 1];
  }

  /* ---------- per-site hourly series ---------- */

  function siteSeries(site, feeds, params) {
    var mz = feeds.marine[site.marineZone];
    var wz = feeds.weather[site.weatherZone];
    var n = Math.min(feeds.time.length, mz.swellH.length, wz.wind.length);
    var P = params;
    var meanDepth = siteMeanDepth(site);
    var maxExp = Math.max.apply(null, site.exposure);
    var oceanConnected = maxExp >= 0.3;

    var effSea = new Array(n), effWind = new Array(n);
    var i;

    /* exposure × refraction wrap × depth/period surge, for one swell partition */
    function partFactor(dir, per) {
      var f = sectorFactor(dir, site.exposure);
      if (oceanConnected && per != null) {
        f = Math.max(f, Math.min(P.swell.wrapMax, Math.max(0, (per - P.swell.wrapStartS) * P.swell.wrapPerS)));
      }
      return f * depthPeriodFactor(meanDepth, per);
    }
    /* wave energy scales with h²·T, a long swell hits far harder than a short
       one of the same height. Normalised to a 10 s reference so effSea stays
       in familiar metres. */
    function periodEnergy(per) {
      return (per != null && !isNaN(per)) ? Math.max(per, 3) / 10 : 1;
    }

    for (i = 0; i < n; i++) {
      if (mz.swellH[i] == null) { effSea[i] = null; }
      else {
        var e = 0, a;
        a = mz.swellH[i] * partFactor(mz.swellDir[i], mz.swellPer[i]);
        e += a * a * periodEnergy(mz.swellPer[i]);
        if (mz.swell2H && mz.swell2H[i] != null) {
          a = mz.swell2H[i] * partFactor(mz.swell2Dir[i], mz.swell2Per[i]);
          e += a * a * periodEnergy(mz.swell2Per[i]);
        }
        if (mz.windWaveH[i] != null) {
          a = mz.windWaveH[i] * partFactor(mz.windWaveDir[i], 5);   // wind chop ≈ 5 s
          e += a * a * periodEnergy(5);
        }
        effSea[i] = Math.sqrt(e);
      }
      effWind[i] = (wz.wind[i] == null) ? null
        : wz.wind[i] * (0.35 + 0.65 * sectorFactor(wz.windDir[i], site.exposure));
    }

    /* recency-weighted rainfall (mm, decaying over ~4 days) */
    var rainW = new Array(n);
    for (i = 0; i < n; i++) {
      var s = 0;
      for (var a = 0; a < P.vis.rainLookbackH; a++) {
        var j = i - 1 - a;
        if (j < 0) break;
        var p = wz.precip[j];
        if (p) s += p * Math.exp(-a / P.vis.rainDecayH);
      }
      rainW[i] = s;
    }

    /* sustained southerly wind upwells clean water onto the open coast */
    var upwell = new Array(n);
    for (i = 0; i < n; i++) {
      var hrs = 0;
      for (var u = Math.max(0, i - 72); u < i; u++) {
        var d = wz.windDir[u];
        if (d != null && d > 150 && d < 250 && wz.wind[u] > 12) hrs++;
      }
      upwell[i] = hrs;
    }

    /* estimated vis: seasonal baseline, knocked down by recent sea state
       (currents dominate at depth) and by rain past a water-body threshold */
    var waterBody = site.waterBody || 'ocean';
    var rainTh = P.vis.rainThreshold[waterBody] != null ? P.vis.rainThreshold[waterBody] : P.vis.rainThreshold.ocean;
    var turbCoef = meanDepth >= 18 ? P.vis.turbidityDeep : P.vis.turbidity;
    var estVis = new Array(n);
    for (i = 0; i < n; i++) {
      var t = 0, c = 0;
      for (var b = Math.max(0, i - P.vis.turbLookbackH); b < i; b++) {
        if (effSea[b] != null) { t += effSea[b]; c++; }
      }
      var turb = c ? t / c : (effSea[i] || 0);
      var month = parseInt(feeds.time[i].slice(5, 7), 10) - 1;
      var seasonal = P.vis.monthly[month] != null ? P.vis.monthly[month] : 1;
      var boost = (waterBody === 'ocean') ? 1 + P.vis.upwellBoost * clamp(upwell[i] / 48, 0, 1) : 1;
      var effRain = Math.max(0, rainW[i] - rainTh);
      var v = site.baseVis * seasonal * boost
        / (1 + turbCoef * turb)
        / (1 + P.vis.rain * site.runoff * effRain);

      /* river in flood -> the receiving water body goes to milk for days */
      var floodArr = feeds.flood ? feeds.flood[waterBody] : null;
      if (floodArr) {
        var fd = Math.max(0, Math.min(floodArr.length - 1, Math.floor((i - feeds.todayIndex) / 24)));
        var fr = floodArr[fd];
        if (fr != null && fr > 3) v *= (1 - 0.85 * clamp((fr - 3) / 12, 0, 1));
      }
      estVis[i] = v;
    }

    return {
      n: n, effSea: effSea, effWind: effWind, rainW: rainW, estVis: estVis,
      mz: mz, wz: wz, meanDepth: meanDepth, maxExp: maxExp
    };
  }

  /* ---------- scoring one hour ---------- */

  function scoreHour(site, S, i, params) {
    if (S.effSea[i] == null || S.effWind[i] == null) return null;
    var P = params;
    var T = P.swell.blowoutBase * (site.swellTol || 1);

    var sea = S.effSea[i] >= T ? 0
      : S.effSea[i] <= P.swell.perfect ? 10
      : 10 * (T - S.effSea[i]) / (T - P.swell.perfect);

    var wind = S.effWind[i] <= P.wind.calm ? 10
      : S.effWind[i] >= P.wind.blownOut ? 0
      : 10 * (P.wind.blownOut - S.effWind[i]) / (P.wind.blownOut - P.wind.calm);

    /* McFadyen's wind gates */
    var kn = S.wz.wind[i], wd = S.wz.windDir[i];
    var isWNW = wd != null && wd > 235 && wd < 340;   // W–NW: offshore, flattens the sea
    var choppy = false;
    if (site.type === 'boat') {
      if (kn > 18) wind = Math.min(wind, 4);                    // rough ride regardless of direction
      if (kn > 15 && !isWNW) wind = Math.min(wind, 2);          // >15 kn non-W/NW: unsuitable for boats
      else if (kn > 10 && !isWNW) wind = Math.min(wind, 6);     // 10–15 kn: caution band
      choppy = S.mz.windWaveH[i] != null && S.mz.windWaveH[i] > 1.1;  // steep wind chop stops the run
    } else if (S.maxExp >= 0.3 && wd != null) {
      var onshore = kn * sectorFactor(wd, site.exposure);       // onshore >10 kn kills exposed shore entries
      if (onshore > 14) wind = Math.min(wind, 1);
      else if (onshore > 10) wind = Math.min(wind, 3);
    }

    var ratio = clamp(S.estVis[i] / site.baseVis, 0, 1);
    var vis = 10 * Math.pow(ratio, 1.25);

    var total = P.weights.sea * sea + P.weights.wind * wind + P.weights.vis * vis;
    var blown = sea <= 0;
    if (blown) total = Math.min(total, 1.0);
    else if (sea < 2) total = Math.min(total, 3.5);
    if (wind <= 0) total = Math.min(total, 3);
    if (choppy) total = Math.min(total, 3.5);

    /* running ocean current makes boat/anchor work marginal */
    var cur = (S.mz.cur && S.mz.cur[i] != null) ? S.mz.cur[i] : null;   // km/h
    if (site.type === 'boat' && cur != null) {
      if (cur > 3.5) total = Math.min(total, 3.5);
      else if (cur > 2.5) total = Math.min(total, 6);
    }

    return {
      score: clamp(total, 0, 10), blown: blown,
      parts: { sea: sea, wind: wind, vis: vis },
      effSea: S.effSea[i], effWind: S.effWind[i], estVis: S.estVis[i]
    };
  }

  /* ---------- day rating = the best diveable window that day ---------- */

  function sunHours(feeds, dateStr) {
    var di = feeds.daily.time.indexOf(dateStr);
    if (di < 0) return { rise: 7, set: 17 };
    var r = feeds.daily.sunrise[di], s = feeds.daily.sunset[di];
    var rh = parseInt(r.slice(11, 13), 10) + (parseInt(r.slice(14, 16), 10) > 0 ? 1 : 0);
    var sh = parseInt(s.slice(11, 13), 10);
    return { rise: rh, set: sh };
  }

  function rateDay(site, S, feeds, d, params) {
    var base = feeds.todayIndex + 24 * d;
    if (base >= S.n) return null;
    var dateStr = feeds.time[base].slice(0, 10);
    var sun = sunHours(feeds, dateStr);
    var W = params.windowHours;

    var firstStart = sun.rise, lastStart = Math.max(sun.rise, sun.set - W);
    if (d === 0) {
      var nowH = feeds.nowIndex - feeds.todayIndex;
      firstStart = Math.max(firstStart, Math.min(nowH, lastStart)); // evening -> fall back to last daylight window
    }

    var best = null;
    for (var s = firstStart; s <= lastStart; s++) {
      var tot = 0, cnt = 0, agg = { sea: 0, wind: 0, vis: 0, effSea: 0, effWind: 0, estVis: 0 }, blown = false;
      for (var h = 0; h < W; h++) {
        var idx = base + s + h;
        if (idx >= S.n) break;
        var r = scoreHour(site, S, idx, params);
        if (!r) continue;
        tot += r.score; cnt++;
        agg.sea += r.parts.sea; agg.wind += r.parts.wind; agg.vis += r.parts.vis;
        agg.effSea += r.effSea; agg.effWind += r.effWind; agg.estVis += r.estVis;
        blown = blown || r.blown;
      }
      if (!cnt) continue;
      var score = tot / cnt;
      if (!best || score > best.score) {
        best = {
          score: score, blown: blown, startH: s, endH: s + W,
          parts: { sea: agg.sea / cnt, wind: agg.wind / cnt, vis: agg.vis / cnt },
          effSea: agg.effSea / cnt, effWind: agg.effWind / cnt, estVis: agg.estVis / cnt
        };
      }
    }
    if (!best) return null;

    /* daylight-hours summary of the raw forecast, for display */
    var mz = S.mz, wz = S.wz;
    var swellMax = null, swellDirAtMax = null, swellPerAtMax = null, windSum = 0, windN = 0, rain = 0;
    var ue = 0, un = 0; // wind direction vector mean
    for (var hh = sun.rise; hh <= sun.set; hh++) {
      var k = base + hh;
      if (k >= S.n) break;
      if (mz.swellH[k] != null && (swellMax == null || mz.swellH[k] > swellMax)) {
        swellMax = mz.swellH[k]; swellDirAtMax = mz.swellDir[k]; swellPerAtMax = mz.swellPer[k];
      }
      if (wz.wind[k] != null) {
        windSum += wz.wind[k]; windN++;
        var rad = (wz.windDir[k] || 0) * Math.PI / 180;
        ue += Math.sin(rad); un += Math.cos(rad);
      }
    }
    for (var kk = base; kk < Math.min(base + 24, S.n); kk++) rain += wz.precip[kk] || 0;
    var windDir = windN ? ((Math.atan2(ue, un) * 180 / Math.PI) + 360) % 360 : null;

    best.date = dateStr;
    best.level = levelFor(best.score, best.blown);
    best.display = {
      swellMax: swellMax, swellDir: swellDirAtMax, swellPer: swellPerAtMax,
      windMean: windN ? windSum / windN : null, windDir: windDir, rain: rain
    };
    return best;
  }

  /* ---------- tides from modelled sea level ---------- */

  function tideEvents(feeds, zoneKey, fromIdx, hours) {
    var sl = feeds.marine[zoneKey].seaLevel;
    if (!sl || sl[fromIdx] == null) return [];
    var out = [];
    var end = Math.min(sl.length - 1, fromIdx + hours);
    for (var i = Math.max(1, fromIdx - 1); i < end; i++) {
      if (sl[i - 1] == null || sl[i] == null || sl[i + 1] == null) continue;
      if (sl[i] >= sl[i - 1] && sl[i] > sl[i + 1]) out.push({ type: 'High', i: i, time: feeds.time[i], h: sl[i] });
      else if (sl[i] <= sl[i - 1] && sl[i] < sl[i + 1]) out.push({ type: 'Low', i: i, time: feeds.time[i], h: sl[i] });
    }
    return out;
  }

  /* ---------- top-level ---------- */

  function computeSite(site, feeds, params) {
    var S = siteSeries(site, feeds, params);
    var now = scoreHour(site, S, feeds.nowIndex, params);
    if (now) now.level = levelFor(now.score, now.blown);

    var days = [];
    for (var d = 0; d < 7; d++) days.push(rateDay(site, S, feeds, d, params));

    var mz = S.mz, wz = S.wz, i = feeds.nowIndex;
    var rain72 = 0;
    for (var j = Math.max(0, i - 72); j < i; j++) rain72 += wz.precip[j] || 0;

    return {
      site: site, series: S, now: now, days: days,
      obs: {
        swellH: mz.swellH[i], swellDir: mz.swellDir[i], swellPer: mz.swellPer[i],
        waveH: mz.waveH[i], sst: mz.sst[i],
        wind: wz.wind[i], windDir: wz.windDir[i], gust: wz.gust[i],
        cur: mz.cur ? mz.cur[i] : null, curDir: mz.curDir ? mz.curDir[i] : null,
        temp: wz.temp ? wz.temp[i] : null, cloud: wz.cloud ? wz.cloud[i] : null,
        rain72: rain72
      },
      tides: tideEvents(feeds, site.marineZone, feeds.nowIndex, 38)
    };
  }

  function computeAll(sites, feeds, params) {
    var out = {};
    for (var s = 0; s < sites.length; s++) out[sites[s].id] = computeSite(sites[s], feeds, params);

    /* best day of the week = highest mean of the top half of sites */
    var bestDay = null;
    for (var d = 0; d < 7; d++) {
      var scores = [];
      for (var id in out) if (out[id].days[d]) scores.push(out[id].days[d].score);
      if (!scores.length) continue;
      scores.sort(function (a, b) { return b - a; });
      var top = scores.slice(0, Math.max(5, Math.floor(scores.length / 2)));
      var mean = top.reduce(function (a, b) { return a + b; }, 0) / top.length;
      if (!bestDay || mean > bestDay.mean) bestDay = { day: d, mean: mean };
    }
    return { sites: out, bestDay: bestDay };
  }

  return {
    computeAll: computeAll, computeSite: computeSite,
    sectorFactor: sectorFactor, compass16: compass16, levelFor: levelFor,
    tideEvents: tideEvents, LEVELS: LEVELS
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Rating;
