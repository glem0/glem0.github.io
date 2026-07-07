/* ============================================================
 * Tiny SVG charts (no library): twin 48-h sea/wind sparklines
 * with a shared crosshair + one tooltip, and a tide curve.
 * Rendered at container width; rebuilt on resize.
 * ============================================================ */

var Charts = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var INK = { grid: '#223041', axis: '#2c3b4e', muted: '#8394a5', text: '#b8c4d0', strong: '#f2f6fa', surface: '#121a24' };

  /* charts are theme-aware: re-read the CSS tokens each time one is built */
  function refreshInk() {
    try {
      var cs = getComputedStyle(document.body);
      var g = function (name, fb) { var v = cs.getPropertyValue(name).trim(); return v || fb; };
      INK.grid = g('--grid', INK.grid);
      INK.axis = g('--axis', INK.axis);
      INK.muted = g('--muted', INK.muted);
      INK.text = g('--ink-2', INK.text);
      INK.strong = g('--ink', INK.strong);
      INK.surface = g('--surface', INK.surface);
    } catch (e) { /* non-browser context */ }
  }

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function div(cls, parent) {
    var d = document.createElement('div');
    d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }
  function fmtHour(iso) {
    var h = parseInt(iso.slice(11, 13), 10);
    var ap = h < 12 ? 'am' : 'pm';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ap;
  }
  function dayName(iso) {
    return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' });
  }
  return build();

  function build() {

    function computeMax(vals, step) {
      var m = 0;
      for (var i = 0; i < vals.length; i++) if (vals[i] != null && vals[i] > m) m = vals[i];
      return Math.max(step, Math.ceil((m * 1.12) / step) * step);
    }

    /* one line panel; returns geometry for the shared crosshair */
    function panel(wrap, times, s, width) {
      var padL = 38, padR = 14, padT = 10, padB = 18, plotH = 86;
      var W = Math.max(280, width), H = padT + plotH + padB;
      var innerW = W - padL - padR;

      var box = div('chart-panel', wrap);
      var head = div('chart-head', box);
      var t1 = document.createElement('span'); t1.className = 'chart-title'; t1.textContent = s.label; head.appendChild(t1);
      var t2 = document.createElement('span'); t2.className = 'chart-sub'; t2.textContent = s.sub || ''; head.appendChild(t2);

      var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'chart-svg' }, box);

      var maxV = computeMax(s.values, s.step);
      var x = function (i) { return padL + (innerW * i) / (times.length - 1); };
      var y = function (v) { return padT + plotH - (plotH * v) / maxV; };

      /* gridlines + y labels: 0, mid, max, solid hairlines */
      [0, maxV / 2, maxV].forEach(function (gv) {
        el('line', { x1: padL, x2: W - padR, y1: y(gv), y2: y(gv), stroke: INK.grid, 'stroke-width': 1 }, svg);
        el('text', { x: padL - 6, y: y(gv) + 3, 'text-anchor': 'end', fill: INK.muted, 'font-size': 10, class: 'tnum' }, svg)
          .textContent = s.fmtTick ? s.fmtTick(gv) : gv;
      });

      /* x ticks at midnights, plus "now" at the left edge */
      for (var i = 0; i < times.length; i++) {
        if (times[i].slice(11, 13) === '00') {
          el('line', { x1: x(i), x2: x(i), y1: padT, y2: padT + plotH, stroke: INK.grid, 'stroke-width': 1 }, svg);
          el('text', { x: x(i) + 3, y: padT + plotH + 13, fill: INK.muted, 'font-size': 10 }, svg).textContent = dayName(times[i]);
        }
      }
      el('text', { x: padL, y: padT + plotH + 13, fill: INK.muted, 'font-size': 10 }, svg).textContent = 'now';

      /* area wash + 2px line (null-safe path segments) */
      var lineD = '', areaD = '', started = false, lastX = null;
      var maxI = -1, maxVal = -Infinity;
      for (i = 0; i < times.length; i++) {
        var v = s.values[i];
        if (v == null) { started = false; continue; }
        var px = x(i), py = y(v);
        if (!started) { lineD += 'M' + px + ' ' + py; areaD += 'M' + px + ' ' + y(0) + 'L' + px + ' ' + py; started = true; }
        else { lineD += 'L' + px + ' ' + py; areaD += 'L' + px + ' ' + py; }
        lastX = px;
        if (v > maxVal) { maxVal = v; maxI = i; }
      }
      if (lastX != null) areaD += 'L' + lastX + ' ' + y(0) + 'Z';
      el('path', { d: areaD, fill: s.color, 'fill-opacity': 0.1 }, svg);
      el('path', { d: lineD, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);

      /* selective direct label: the extreme only, with a ringed dot */
      if (maxI >= 0) {
        el('circle', { cx: x(maxI), cy: y(maxVal), r: 4.5, fill: s.color, stroke: INK.surface, 'stroke-width': 2 }, svg);
        var lx = Math.min(Math.max(x(maxI), padL + 16), W - padR - 30);
        var ly = Math.max(y(maxVal) - 8, 10);
        el('text', { x: lx, y: ly, 'text-anchor': 'middle', fill: INK.text, 'font-size': 10.5, 'font-weight': 600 }, svg)
          .textContent = s.fmt(maxVal);
      }

      /* crosshair (hidden until hover/focus) */
      var cross = el('line', { x1: -9, x2: -9, y1: padT, y2: padT + plotH, stroke: INK.axis, 'stroke-width': 1, class: 'crosshair' }, svg);
      var dot = el('circle', { r: 4, fill: s.color, stroke: INK.surface, 'stroke-width': 2, opacity: 0 }, svg);

      return {
        setIndex: function (i) {
          if (i == null || s.values[i] == null) { cross.setAttribute('x1', -9); cross.setAttribute('x2', -9); dot.setAttribute('opacity', 0); return; }
          cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
          dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(s.values[i])); dot.setAttribute('opacity', 1);
        },
        xToIndex: function (clientX, rect) {
          var rel = (clientX - rect.left) / rect.width * W;
          var i = Math.round((rel - padL) / innerW * (times.length - 1));
          return Math.max(0, Math.min(times.length - 1, i));
        }
      };
    }

    /* twin panels + shared crosshair + one tooltip listing both series */
    function twin(container, opts) {
      refreshInk();
      container.textContent = '';
      var wrap = div('chart-wrap', container);
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'img');
      wrap.setAttribute('aria-label', opts.ariaLabel || 'Forecast chart');
      var width = container.clientWidth || 380;

      var panels = opts.series.map(function (s) { return panel(wrap, opts.times, s, width); });
      var tip = div('chart-tip', wrap);
      tip.style.display = 'none';
      var focusIdx = null;

      function show(i, px) {
        panels.forEach(function (p) { p.setIndex(i); });
        tip.textContent = '';
        var head = div('tip-time', tip);
        head.textContent = dayName(opts.times[i]) + ' ' + fmtHour(opts.times[i]);
        opts.series.forEach(function (s) {
          var row = div('tip-row', tip);
          var key = document.createElement('span');
          key.className = 'tip-key'; key.style.background = s.color;
          row.appendChild(key);
          var val = document.createElement('strong');
          val.textContent = s.values[i] != null ? s.fmt(s.values[i]) : '-';
          row.appendChild(val);
          var lab = document.createElement('span');
          lab.className = 'tip-lab'; lab.textContent = s.label;
          row.appendChild(lab);
        });
        tip.style.display = 'block';
        var wrect = wrap.getBoundingClientRect();
        var tx = px != null ? px : (wrect.width * i / (opts.times.length - 1));
        var flip = tx > wrect.width / 2;
        tip.style.left = flip ? '' : Math.min(tx + 14, wrect.width - 130) + 'px';
        tip.style.right = flip ? Math.max(wrect.width - tx + 14, 8) + 'px' : '';
      }
      function hide() {
        panels.forEach(function (p) { p.setIndex(null); });
        tip.style.display = 'none';
        focusIdx = null;
      }

      wrap.addEventListener('pointermove', function (ev) {
        var rect = wrap.getBoundingClientRect();
        var i = panels[0].xToIndex(ev.clientX, rect);
        focusIdx = i;
        show(i, ev.clientX - rect.left);
      });
      wrap.addEventListener('pointerleave', hide);
      wrap.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          if (focusIdx == null) focusIdx = 0;
          else focusIdx = Math.max(0, Math.min(opts.times.length - 1, focusIdx + (ev.key === 'ArrowRight' ? 1 : -1)));
          show(focusIdx, null);
        } else if (ev.key === 'Escape') hide();
      });
      wrap.addEventListener('focus', function () { focusIdx = 0; show(0, null); });
      wrap.addEventListener('blur', hide);
    }

    /* tide curve: line + labelled extrema dots */
    function tide(container, opts) {
      refreshInk();
      container.textContent = '';
      var width = Math.max(280, container.clientWidth || 380);
      var padL = 38, padR = 14, padT = 16, padB = 18, plotH = 64;
      var W = width, H = padT + plotH + padB;
      var innerW = W - padL - padR;
      var times = opts.times, vals = opts.values;

      var lo = Infinity, hi = -Infinity;
      for (var i = 0; i < vals.length; i++) if (vals[i] != null) { lo = Math.min(lo, vals[i]); hi = Math.max(hi, vals[i]); }
      if (!isFinite(lo)) { container.textContent = ''; return; }
      var span = Math.max(0.4, hi - lo);
      lo -= span * 0.15; hi += span * 0.15;

      var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'chart-svg' }, container);
      var x = function (i) { return padL + innerW * i / (times.length - 1); };
      var y = function (v) { return padT + plotH - plotH * (v - lo) / (hi - lo); };

      [lo + span * 0.15, hi - span * 0.15].forEach(function (gv) {
        el('line', { x1: padL, x2: W - padR, y1: y(gv), y2: y(gv), stroke: INK.grid, 'stroke-width': 1 }, svg);
        el('text', { x: padL - 6, y: y(gv) + 3, 'text-anchor': 'end', fill: INK.muted, 'font-size': 10, class: 'tnum' }, svg)
          .textContent = gv.toFixed(1);
      });
      for (i = 0; i < times.length; i++) {
        if (times[i].slice(11, 13) === '00') {
          el('line', { x1: x(i), x2: x(i), y1: padT, y2: padT + plotH, stroke: INK.grid, 'stroke-width': 1 }, svg);
          el('text', { x: x(i) + 3, y: padT + plotH + 13, fill: INK.muted, 'font-size': 10 }, svg).textContent = dayName(times[i]);
        }
      }

      var d = '', started = false;
      for (i = 0; i < times.length; i++) {
        if (vals[i] == null) { started = false; continue; }
        d += (started ? 'L' : 'M') + x(i) + ' ' + y(vals[i]);
        started = true;
      }
      el('path', { d: d, fill: 'none', stroke: opts.color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);

      (opts.events || []).forEach(function (evt) {
        var i = evt.i - opts.offset;
        if (i < 0 || i >= times.length) return;
        el('circle', { cx: x(i), cy: y(evt.h), r: 4, fill: opts.color, stroke: INK.surface, 'stroke-width': 2 }, svg);
        var above = evt.type === 'High';
        var tx = Math.min(Math.max(x(i), padL + 24), W - padR - 34);
        el('text', {
          x: tx, y: above ? Math.max(y(evt.h) - 9, 10) : Math.min(y(evt.h) + 16, H - padB + 6),
          'text-anchor': 'middle', fill: INK.text, 'font-size': 10, 'font-weight': 600
        }, svg).textContent = evt.type + ' ' + fmtHour(evt.time);
      });
    }

    return { twin: twin, tide: tide };
  }
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Charts;
