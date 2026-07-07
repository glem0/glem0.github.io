/* Sydney Dive Calendar — renders data/events.json produced by scraper/build.py */
(() => {
  'use strict';

  const TZ = 'Australia/Sydney';
  const KNOWN = new Set(['abyss', 'frogdive', 'divebondi', 'divesydney', 'prodive']);
  const PREFS_KEY = 'diveCal.prefs';
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  const MAX_CHIPS = 4;
  const MAX_SPAN_DAYS = 30;

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const srcClass = (id) => 'src-' + (KNOWN.has(id) ? id : 'other');

  const SEP = '\u0000';
  const normTitle = (t) => (t || '').replace(/\s*\(sold out\)\s*$/i, '').trim();
  const hideKey = (ev) => ev.source + SEP + normTitle(ev.title);

  const THEMES = ['auto', 'light', 'dark'];
  const THEME_LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' };
  const SVG_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const THEME_ICONS = {
    auto: SVG_OPEN + '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>',
    light: SVG_OPEN + '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>' +
      '<line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>' +
      '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>' +
      '<line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>' +
      '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    dark: SVG_OPEN + '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  };
  const EYE_OFF_MINI = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
    '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
    '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function compileRule(pattern) {
    try { return new RegExp(pattern, 'i'); } catch { return null; }
  }

  // ---------- date helpers (all rendering pinned to Sydney) ----------
  const fmtDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtTime = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  const fmtDayLong = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  const fmtDayShort = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
  const fmtMonthLabel = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const fmtMonthShort = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'short' });
  const fmtAbs = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  const dayToUTC = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
  const utcToDay = (t) => new Date(t).toISOString().slice(0, 10);
  const addDays = (d, n) => utcToDay(dayToUTC(d) + n * 86400000);
  const daysBetween = (a, b) => Math.round((dayToUTC(b) - dayToUTC(a)) / 86400000);
  const monthOf = (d) => d.slice(0, 7);

  function addMonths(m, n) {
    let [y, mo] = m.split('-').map(Number);
    mo += n;
    y += Math.floor((mo - 1) / 12);
    mo = (((mo - 1) % 12) + 12) % 12 + 1;
    return `${y}-${String(mo).padStart(2, '0')}`;
  }
  const monthLabel = (m) => { const [y, mo] = m.split('-').map(Number); return fmtMonthLabel.format(new Date(Date.UTC(y, mo - 1, 1))); };

  // Sydney calendar day of an event timestamp
  function dayKeyOf(iso) {
    if (!iso) return null;
    if (DATE_ONLY.test(iso)) return iso;
    const d = new Date(iso);
    return isNaN(d) ? null : fmtDayKey.format(d);
  }
  // a Date that falls on the given Sydney calendar day (for weekday/date formatting only)
  const dateOnDay = (dayStr) => new Date(dayStr + 'T00:00:00+10:00');
  const timeOf = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : fmtTime.format(d); };

  // ---------- state ----------
  const state = {
    data: null,
    byDay: new Map(),
    month: null,
    minMonth: null,
    maxMonth: null,
    view: 'month',
    enabled: new Set(),
    q: '',
    theme: 'auto',
    hidden: new Set(),        // "source\0title" exact lookup
    hiddenPairs: [],          // [{s, t}, ...] exact hides, as persisted
    hiddenRules: [],          // [{s: id|'*', p, rx}, ...] regex hides
    todayKey: fmtDayKey.format(new Date()),
  };

  function isHidden(ev) {
    if (state.hidden.has(hideKey(ev))) return true;
    if (!state.hiddenRules.length) return false;
    const t = normTitle(ev.title);
    return state.hiddenRules.some((r) => (r.s === '*' || r.s === ev.source) && r.rx.test(t));
  }
  const hiddenTotal = () => state.hiddenPairs.length + state.hiddenRules.length;

  const sourceById = (id) => state.data.sources.find((s) => s.id === id);
  const sourceName = (id) => (sourceById(id) || {}).name || id;
  const sourceShort = (id) => (sourceById(id) || {}).short || sourceName(id);
  const sourceUrl = (id) => (sourceById(id) || {}).url || '#';

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
  }
  function savePrefs() {
    try {
      const disabled = state.data
        ? state.data.sources.map((s) => s.id).filter((id) => !state.enabled.has(id))
        : [];
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        view: state.view,
        disabled,
        theme: state.theme,
        hidden: state.hiddenPairs.map(({ s, t }) => ({ s, t })),
        hiddenRules: state.hiddenRules.map(({ s, p }) => ({ s, p })),
      }));
    } catch { /* private mode etc. */ }
  }

  function applyTheme(mode) {
    state.theme = THEMES.includes(mode) ? mode : 'auto';
    if (state.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.theme;
    const b = $('#themeBtn');
    if (b) {
      b.innerHTML = THEME_ICONS[state.theme];
      const label = 'Theme: ' + THEME_LABELS[state.theme] + ' — click to change';
      b.title = label;
      b.setAttribute('aria-label', label);
    }
  }

  // ---------- data ----------
  function loadFallbackScript() {
    // file:// fallback: fetch() can't read local files, a <script> can
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'data/events.js';
      s.onload = () => (window.__DIVE_DATA__ ? resolve(window.__DIVE_DATA__) : reject(new Error('events.js is empty')));
      s.onerror = () => reject(new Error('events.json missing'));
      document.head.appendChild(s);
    });
  }

  async function loadData() {
    try {
      const res = await fetch('data/events.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      return loadFallbackScript();
    }
  }

  function buildIndex(events) {
    const byDay = new Map();
    for (const ev of events) {
      const s = dayKeyOf(ev.start);
      if (!s) continue;
      let e = ev.end ? dayKeyOf(ev.end) : s;
      if (!e || e < s) e = s;
      const span = Math.min(daysBetween(s, e), MAX_SPAN_DAYS);
      for (let i = 0; i <= span; i++) {
        const d = addDays(s, i);
        let arr = byDay.get(d);
        if (!arr) byDay.set(d, (arr = []));
        arr.push({ ev, cont: i > 0, spanDays: span + 1 });
      }
    }
    const tkey = (x) => (x.ev.all_day ? '' : '~' + (dayKeyOf(x.ev.start) + 'T' + timeOf24(x.ev.start)));
    for (const arr of byDay.values()) {
      arr.sort((a, b) => tkey(a).localeCompare(tkey(b)) || a.ev.title.localeCompare(b.ev.title));
    }
    return byDay;
  }
  const fmt24 = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const timeOf24 = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : fmt24.format(d); };

  function passes(ev) {
    if (!state.enabled.has(ev.source)) return false;
    if (isHidden(ev)) return false;
    if (state.q) {
      const hay = (ev.title + ' ' + (ev.location || '') + ' ' + (ev.description || '')).toLowerCase();
      if (!hay.includes(state.q)) return false;
    }
    return true;
  }
  const entriesOn = (dayStr) => (state.byDay.get(dayStr) || []).filter((x) => passes(x.ev));

  // ---------- rendering ----------
  function chipTime(ev) {
    return timeOf(ev.start).replace(':00 ', ' ');
  }

  function renderChip(entry) {
    const { ev, cont } = entry;
    const b = el('button', 'chip ' + srcClass(ev.source) + (cont ? ' cont' : ''));
    b.type = 'button';
    const label = ev.title + ' — ' + sourceName(ev.source);
    b.title = label;
    b.setAttribute('aria-label', label);
    if (!ev.all_day && !cont) b.appendChild(el('span', 't', chipTime(ev)));
    b.appendChild(el('span', 'n', (cont ? '↳ ' : '') + ev.title));
    b.addEventListener('click', () => openEvent(ev));
    return b;
  }

  function renderCell(dayStr) {
    const inMonth = monthOf(dayStr) === state.month;
    let cls = 'cell';
    if (!inMonth) cls += ' out';
    if (dayStr === state.todayKey) cls += ' today';
    if (dayStr < state.todayKey) cls += ' past';
    const cell = el('div', cls);
    const dayNum = Number(dayStr.slice(8));
    cell.appendChild(el('div', 'daynum', inMonth ? String(dayNum) : dayNum + ' ' + fmtMonthShort.format(new Date(dayToUTC(dayStr)))));
    const entries = entriesOn(dayStr);
    const visible = entries.length <= MAX_CHIPS + 1 ? entries : entries.slice(0, MAX_CHIPS);
    const evWrap = el('div', 'cell-events');
    for (const entry of visible) evWrap.appendChild(renderChip(entry));
    if (entries.length > visible.length) {
      const more = el('button', 'more-btn', '+' + (entries.length - visible.length) + ' more');
      more.type = 'button';
      more.addEventListener('click', () => openDay(dayStr));
      evWrap.appendChild(more);
    }
    cell.appendChild(evWrap);
    if (entries.length) {
      cell.classList.add('has-events');
      cell.addEventListener('click', (e) => {   // tap anywhere in the cell (mobile dots)
        if (e.target.closest('.chip, .more-btn')) return;
        openDay(dayStr);
      });
    }
    return cell;
  }

  function renderGrid() {
    const grid = $('#grid');
    grid.textContent = '';
    const [y, mo] = state.month.split('-').map(Number);
    const offset = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7; // Monday-start
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const weeks = Math.ceil((offset + daysInMonth) / 7);
    let cursor = addDays(state.month + '-01', -offset);
    for (let w = 0; w < weeks; w++) {
      const week = el('div', 'grid-week');
      for (let i = 0; i < 7; i++) {
        week.appendChild(renderCell(cursor));
        cursor = addDays(cursor, 1);
      }
      grid.appendChild(week);
    }
  }

  function renderRow(entry, dayStr) {
    const { ev, spanDays } = entry;
    const r = el('button', 'row' + (dayStr < state.todayKey ? ' past' : ''));
    r.type = 'button';
    let timeCol = ev.all_day ? 'All day' : timeOf(ev.start);
    if (spanDays > 1) timeCol += ' · ' + spanDays + ' days';
    r.appendChild(el('span', 'time', timeCol));
    const src = el('span', 'src ' + srcClass(ev.source));
    src.appendChild(el('span', 'dot'));
    src.appendChild(el('span', null, sourceShort(ev.source)));
    r.appendChild(src);
    r.appendChild(el('span', 'title', ev.title));
    r.addEventListener('click', () => openEvent(ev));
    return r;
  }

  function emptyNote() {
    const hasAnyThisMonth = [...state.byDay.keys()].some((d) => monthOf(d) === state.month);
    const msg = !hasAnyThisMonth
      ? 'No events found for ' + monthLabel(state.month) + '.'
      : 'No events match — enable more centres or clear the search.';
    return el('div', 'status', msg);
  }

  function renderList() {
    const list = $('#list');
    list.textContent = '';
    const [y, mo] = state.month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    let any = false;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = state.month + '-' + String(d).padStart(2, '0');
      const entries = entriesOn(key).filter((x) => !x.cont);
      if (!entries.length) continue;
      any = true;
      const sec = el('section', 'day-section');
      const head = el('div', 'day-head');
      head.appendChild(el('span', null, fmtDayLong.format(dateOnDay(key))));
      if (key === state.todayKey) head.appendChild(el('span', 'today-tag', 'Today'));
      sec.appendChild(head);
      for (const entry of entries) sec.appendChild(renderRow(entry, key));
      list.appendChild(sec);
    }
    if (!any) list.appendChild(emptyNote());
  }

  function monthCount(sourceId) {
    let n = 0;
    for (const [d, arr] of state.byDay) {
      if (monthOf(d) !== state.month) continue;
      for (const x of arr) {
        if (!x.cont && x.ev.source === sourceId && !isHidden(x.ev)) n++;
      }
    }
    return n;
  }

  function renderFilters() {
    const wrap = $('#filters');
    wrap.textContent = '';
    for (const s of state.data.sources) {
      const b = el('button', 'filter-chip ' + srcClass(s.id));
      b.type = 'button';
      const on = state.enabled.has(s.id);
      b.setAttribute('aria-pressed', String(on));
      b.appendChild(el('span', 'dot'));
      b.appendChild(el('span', null, s.short || s.name));
      b.appendChild(el('span', 'count', String(monthCount(s.id))));
      b.title = (on ? 'Hide ' : 'Show ') + s.name;
      b.addEventListener('click', () => {
        if (state.enabled.has(s.id)) state.enabled.delete(s.id);
        else state.enabled.add(s.id);
        savePrefs();
        render();
      });
      wrap.appendChild(b);
    }
    if (state.data.sources.some((s) => !state.enabled.has(s.id))) {
      const reset = el('button', 'filter-reset', 'show all');
      reset.type = 'button';
      reset.addEventListener('click', () => {
        state.enabled = new Set(state.data.sources.map((s) => s.id));
        savePrefs();
        render();
      });
      wrap.appendChild(reset);
    }
    const n = hiddenTotal();
    const hb = el('button', 'hidden-count-btn');
    hb.type = 'button';
    hb.innerHTML = EYE_OFF_MINI;
    if (n) hb.appendChild(el('span', null, n + ' hidden'));
    hb.title = 'Hidden events and hide patterns';
    hb.setAttribute('aria-label', hb.title + (n ? ' (' + n + ' active)' : ''));
    hb.addEventListener('click', openHiddenManager);
    wrap.appendChild(hb);
  }

  function renderFooter() {
    const wrap = $('#sourceStatus');
    wrap.textContent = '';
    for (const s of state.data.sources) {
      const item = el('span', 's ' + srcClass(s.id));
      item.appendChild(el('span', 'dot'));
      const a = el('a', null, s.name);
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      item.appendChild(a);
      if (s.status === 'ok') {
        item.appendChild(el('span', null, '· ' + s.event_count));
      } else {
        const e = el('span', 'err', '· fetch failed');
        if (s.error) e.title = s.error;
        item.appendChild(e);
      }
      wrap.appendChild(item);
    }
  }

  function renderUpdated() {
    const g = state.data.generated_at;
    if (!g) return;
    const then = new Date(g);
    if (isNaN(then)) return;
    const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
    const rtf = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' });
    let rel;
    if (mins < 60) rel = rtf.format(-mins, 'minute');
    else if (mins < 48 * 60) rel = rtf.format(-Math.round(mins / 60), 'hour');
    else rel = rtf.format(-Math.round(mins / 1440), 'day');
    const n = $('#updatedStamp');
    n.textContent = 'data updated ' + rel;
    n.title = fmtAbs.format(then) + ' Sydney time';
  }

  // ---------- modal ----------
  const modal = () => $('#modal');

  function whenStr(ev) {
    const s = dayKeyOf(ev.start);
    const e = ev.end ? dayKeyOf(ev.end) : s;
    const sDate = fmtDayLong.format(dateOnDay(s));
    if (ev.all_day) {
      if (e && e !== s) return fmtDayShort.format(dateOnDay(s)) + ' – ' + fmtDayShort.format(dateOnDay(e));
      return sDate + ' · all day';
    }
    let out = sDate + ' · ' + timeOf(ev.start);
    if (ev.end) {
      const endTime = DATE_ONLY.test(ev.end) ? '' : timeOf(ev.end);
      if (e === s) out += endTime ? ' – ' + endTime : '';
      else out += ' – ' + fmtDayShort.format(dateOnDay(e)) + (endTime ? ' ' + endTime : '');
    }
    return out;
  }

  const EYE_OFF_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
    '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
    '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function modalHeader(body, ev, onHide) {
    const top = el('div', 'modal-top');
    const src = el('span', 'modal-src ' + srcClass(ev ? ev.source : ''));
    if (ev) {
      src.appendChild(el('span', 'dot'));
      src.appendChild(el('span', null, sourceName(ev.source)));
      top.appendChild(src);
    } else {
      top.appendChild(el('span'));
    }
    const btns = el('div', 'modal-top-btns');
    if (ev && onHide) {
      const hide = el('button', 'icon-btn');
      hide.type = 'button';
      hide.id = 'hideBtn';
      hide.innerHTML = EYE_OFF_SVG;
      const label = 'Hide all "' + normTitle(ev.title) + '" events from ' + sourceName(ev.source);
      hide.title = label + ' — restore via "hidden" in the filter bar';
      hide.setAttribute('aria-label', label);
      hide.addEventListener('click', onHide);
      btns.appendChild(hide);
    }
    const close = el('button', 'modal-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => modal().close());
    btns.appendChild(close);
    top.appendChild(btns);
    body.appendChild(top);
  }

  function openEvent(ev) {
    const body = $('#modalBody');
    body.textContent = '';
    modalHeader(body, ev, () => hideEvent(ev));
    body.appendChild(el('h3', null, ev.title));
    body.appendChild(el('div', 'modal-when', whenStr(ev)));
    if (ev.location) body.appendChild(el('div', 'modal-loc', '📍 ' + ev.location));
    if (ev.description) {
      const d = ev.description.length > 700 ? ev.description.slice(0, 699).trimEnd() + '…' : ev.description;
      body.appendChild(el('div', 'modal-desc', d));
    }
    const act = el('div', 'modal-actions');
    const a = el('a', null, 'View / book on ' + sourceShort(ev.source) + ' site ↗');
    a.href = ev.url || sourceUrl(ev.source);
    a.target = '_blank';
    a.rel = 'noopener';
    act.appendChild(a);
    body.appendChild(act);
    if (!modal().open) modal().showModal();
  }

  function hideEvent(ev) {
    const t = normTitle(ev.title);
    if (!state.hidden.has(ev.source + SEP + t)) {
      state.hiddenPairs.push({ s: ev.source, t });
      state.hidden.add(ev.source + SEP + t);
    }
    savePrefs();
    modal().close();
    render();
  }

  function restorePair(pair) {
    state.hiddenPairs = state.hiddenPairs.filter((p) => !(p.s === pair.s && p.t === pair.t));
    state.hidden.delete(pair.s + SEP + pair.t);
    savePrefs();
    render();
  }

  // wraps a list in a scroll container with a bottom fade while more is below
  function scrollFadeList(listEl) {
    const wrap = el('div', 'modal-scroll');
    listEl.classList.add('scrolly');
    wrap.appendChild(listEl);
    const update = () => {
      const more = listEl.scrollTop + listEl.clientHeight < listEl.scrollHeight - 4;
      wrap.classList.toggle('more-below', more);
    };
    listEl.addEventListener('scroll', update, { passive: true });
    // measure once the dialog is actually laid out (a <dialog> is display:none until shown)
    requestAnimationFrame(() => requestAnimationFrame(update));
    setTimeout(update, 120);
    if (window.ResizeObserver) new ResizeObserver(update).observe(listEl);
    return wrap;
  }

  function openHiddenManager() {
    const body = $('#modalBody');
    body.textContent = '';
    modalHeader(body, null);
    body.appendChild(el('h3', null, 'Hidden events'));
    body.appendChild(el('div', 'modal-when', 'Hidden titles and patterns never show on the calendar.'));

    const counts = new Map();
    for (const ev of (state.data.events || [])) {
      const k = ev.source + SEP + normTitle(ev.title);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const ruleCount = (r) => (state.data.events || []).reduce((n, ev) =>
      n + ((r.s === '*' || r.s === ev.source) && r.rx.test(normTitle(ev.title)) ? 1 : 0), 0);
    const evs = (n) => n + (n === 1 ? ' event' : ' events');

    const list = el('div', 'modal-day-list');
    const reopen = () => (hiddenTotal() ? openHiddenManager() : modal().close());

    for (const pair of state.hiddenPairs) {
      const row = el('div', 'hidden-mgr-row ' + srcClass(pair.s));
      const label = el('span', 'hidden-mgr-label');
      label.appendChild(el('span', 'dot'));
      label.appendChild(el('span', 'hidden-mgr-title', pair.t));
      label.appendChild(el('span', 'hidden-mgr-src', sourceShort(pair.s)));
      row.appendChild(label);
      row.appendChild(el('span', 'hidden-mgr-count', evs(counts.get(pair.s + SEP + pair.t) || 0)));
      const r = el('button', null, 'Restore');
      r.type = 'button';
      r.addEventListener('click', () => { restorePair(pair); reopen(); });
      row.appendChild(r);
      list.appendChild(row);
    }

    state.hiddenRules.forEach((rule, i) => {
      const row = el('div', 'hidden-mgr-row ' + (rule.s === '*' ? 'src-other' : srcClass(rule.s)));
      const label = el('span', 'hidden-mgr-label');
      label.appendChild(el('span', 'dot'));
      const pat = el('code', 'hidden-mgr-title', '/' + rule.p + '/i');
      label.appendChild(pat);
      label.appendChild(el('span', 'hidden-mgr-src', rule.s === '*' ? 'all centres' : sourceShort(rule.s)));
      row.appendChild(label);
      row.appendChild(el('span', 'hidden-mgr-count', evs(ruleCount(rule))));
      const r = el('button', null, 'Remove');
      r.type = 'button';
      r.addEventListener('click', () => {
        state.hiddenRules.splice(i, 1);
        savePrefs();
        render();
        reopen();
      });
      row.appendChild(r);
      list.appendChild(row);
    });

    if (!hiddenTotal()) {
      list.appendChild(el('div', 'hidden-mgr-empty', 'Nothing hidden yet — hide an event via the eye icon in its popup, or add a pattern below.'));
    }
    body.appendChild(scrollFadeList(list));

    // add-a-pattern rule
    const form = el('form', 'hide-rule-form');
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'Hide by pattern… e.g. hire|snorkel';
    input.setAttribute('aria-label', 'Hide events matching pattern (regular expression)');
    const sel = el('select');
    sel.setAttribute('aria-label', 'Which centre the pattern applies to');
    const optAll = el('option', null, 'All centres');
    optAll.value = '*';
    sel.appendChild(optAll);
    for (const s of state.data.sources) {
      const o = el('option', null, s.short || s.name);
      o.value = s.id;
      sel.appendChild(o);
    }
    const add = el('button', null, 'Hide');
    add.type = 'submit';
    form.append(input, sel, add);
    const err = el('div', 'rule-error');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const p = input.value.trim();
      if (!p) return;
      const rx = compileRule(p);
      if (!rx) {
        err.textContent = 'Not a valid regular expression.';
        return;
      }
      state.hiddenRules.push({ s: sel.value, p, rx });
      savePrefs();
      render();
      openHiddenManager();
    });
    body.appendChild(form);
    body.appendChild(err);

    if (hiddenTotal() > 1) {
      const all = el('button', 'btn-secondary', 'Restore all');
      all.type = 'button';
      all.style.marginTop = '12px';
      all.addEventListener('click', () => {
        state.hiddenPairs = [];
        state.hiddenRules = [];
        state.hidden.clear();
        savePrefs();
        render();
        modal().close();
      });
      body.appendChild(all);
    }
    if (!modal().open) modal().showModal();
  }

  function openDay(dayStr) {
    const body = $('#modalBody');
    body.textContent = '';
    modalHeader(body, null);
    body.appendChild(el('h3', null, fmtDayLong.format(dateOnDay(dayStr))));
    const wrap = el('div', 'modal-day-list');
    for (const entry of entriesOn(dayStr)) wrap.appendChild(renderRow(entry, dayStr));
    body.appendChild(scrollFadeList(wrap));
    if (!modal().open) modal().showModal();
  }

  // ---------- view / month ----------
  function setView(v) {
    state.view = v;
    $('#viewMonth').setAttribute('aria-pressed', String(v === 'month'));
    $('#viewList').setAttribute('aria-pressed', String(v === 'list'));
    savePrefs();
    render();
  }

  const clampMonth = (m) => (m < state.minMonth ? state.minMonth : m > state.maxMonth ? state.maxMonth : m);

  function setMonth(m) {
    state.month = clampMonth(m);
    $('#monthLabel').textContent = monthLabel(state.month);
    $('#prevMonth').disabled = state.month <= state.minMonth;
    $('#nextMonth').disabled = state.month >= state.maxMonth;
    if (('#' + state.month) !== location.hash) history.replaceState(null, '', '#' + state.month);
    render();
  }

  function render() {
    if (!state.data || !state.month) return;
    renderFilters();
    const isMonth = state.view === 'month';
    $('#gridWrap').hidden = !isMonth;
    $('#list').hidden = isMonth;
    if (isMonth) renderGrid();
    else renderList();
  }

  function showError(err) {
    const s = $('#status');
    s.classList.add('error');
    s.textContent = '';
    s.appendChild(el('div', null, "Couldn't load event data (" + err.message + ').'));
    const hint = el('div');
    hint.style.marginTop = '8px';
    if (location.protocol === 'file:') {
      hint.append('Generate it first: run ', el('code', null, 'python3 scraper/build.py'), ' in the project folder, then reload.');
    } else {
      hint.append('data/events.json is missing — run ', el('code', null, 'python3 scraper/build.py'), ' (or wait for the GitHub Action) and redeploy.');
    }
    s.appendChild(hint);
  }

  // ---------- init ----------
  async function init() {
    const prefs = loadPrefs();
    applyTheme(prefs.theme);
    // exact hides: migrate the old [source, title] tuple format to {s, t}
    state.hiddenPairs = (Array.isArray(prefs.hidden) ? prefs.hidden : [])
      .map((p) => (Array.isArray(p) ? { s: p[0], t: p[1] } : p))
      .filter((p) => p && typeof p.s === 'string' && typeof p.t === 'string');
    state.hidden = new Set(state.hiddenPairs.map((p) => p.s + SEP + p.t));
    state.hiddenRules = (Array.isArray(prefs.hiddenRules) ? prefs.hiddenRules : [])
      .filter((r) => r && typeof r.s === 'string' && typeof r.p === 'string')
      .map((r) => ({ s: r.s, p: r.p, rx: compileRule(r.p) }))
      .filter((r) => r.rx);
    // best-effort: ask the browser not to evict this origin's storage
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* optional */ }
    $('#themeBtn').addEventListener('click', () => {
      applyTheme(THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length]);
      savePrefs();
    });

    try {
      state.data = await loadData();
    } catch (err) {
      showError(err);
      return;
    }
    if (!state.data || !Array.isArray(state.data.sources)) {
      showError(new Error('bad data format'));
      return;
    }

    const ids = state.data.sources.map((s) => s.id);
    const disabled = new Set(prefs.disabled || []);
    state.enabled = new Set(ids.filter((id) => !disabled.has(id)));
    if (!state.enabled.size) state.enabled = new Set(ids);
    state.view = prefs.view || (window.matchMedia('(max-width: 720px)').matches ? 'list' : 'month');

    state.byDay = buildIndex(state.data.events || []);
    const months = [...new Set([...state.byDay.keys()].map(monthOf))].sort();
    const cur = monthOf(state.todayKey);
    state.minMonth = months.length && months[0] < cur ? months[0] : cur;
    const lastData = months.length ? months[months.length - 1] : cur;
    state.maxMonth = lastData > addMonths(cur, 1) ? lastData : addMonths(cur, 1);

    $('#status').hidden = true;
    $('#viewMonth').setAttribute('aria-pressed', String(state.view === 'month'));
    $('#viewList').setAttribute('aria-pressed', String(state.view === 'list'));

    $('#prevMonth').addEventListener('click', () => setMonth(addMonths(state.month, -1)));
    $('#nextMonth').addEventListener('click', () => setMonth(addMonths(state.month, 1)));
    $('#todayBtn').addEventListener('click', () => setMonth(cur));
    $('#viewMonth').addEventListener('click', () => setView('month'));
    $('#viewList').addEventListener('click', () => setView('list'));

    let debounce;
    $('#search').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.q = e.target.value.trim().toLowerCase();
        render();
      }, 140);
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea') || modal().open) return;
      if (e.key === 'ArrowLeft') setMonth(addMonths(state.month, -1));
      else if (e.key === 'ArrowRight') setMonth(addMonths(state.month, 1));
      else if (e.key.toLowerCase() === 't') setMonth(cur);
    });

    modal().addEventListener('click', (e) => {
      if (e.target === modal()) modal().close();
    });

    window.addEventListener('hashchange', () => {
      const m = /^#(\d{4}-\d{2})$/.exec(location.hash);
      if (m && m[1] !== state.month) setMonth(m[1]);
    });

    const hashM = /^#(\d{4}-\d{2})$/.exec(location.hash);
    setMonth(hashM ? hashM[1] : cur);
    renderFooter();
    renderUpdated();
    setInterval(renderUpdated, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
