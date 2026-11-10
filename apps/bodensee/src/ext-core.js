/* Ausflüge: Seekarte, Uferweg und Zeitreise neben dem Tauchgang.
 * Dieser Teil hält Sammlung, Forscherbuch, Infokarten und die Zeichenfläche zusammen.
 * Die Ansichten melden sich unter BE.views an, die Inhalte unter BE.def().
 */
const BE = (() => {
  'use strict';

  const STORE_KEY = 'bodensee-expedition-ext-v1';
  const CATS = {
    orte: { label: 'Orte', one: 'Ort', empty: 'Wandere den Uferweg entlang, jeder Ort gibt einen Stempel.' },
    grenzen: { label: 'Länder', one: 'Länder & Grenzen', empty: 'Schau dir die Seekarte genau an.' },
    geschichte: { label: 'Geschichte', one: 'Geschichte', empty: 'Auf dem Uferweg warten alte Burgen, Klöster und Luftschiffe.' },
    natur: { label: 'Natur', one: 'Natur', empty: 'Halte am Ufer Ausschau nach Tieren und Pflanzen.' },
    erde: { label: 'Entstehung', one: 'Entstehung', empty: 'Die Zeitreise zeigt, wie der See entstand.' },
    urzeit: { label: 'Urzeit', one: 'Urzeit-Tier', empty: 'In der Zeitreise warten Saurier und Mammuts.' },
    see: { label: 'Im See', one: 'Fund im See', empty: 'Tauche mit dem U-Boot und halte die Augen offen.' },
  };
  const RANKS = [
    [0, 'Bodensee-Neuling'],
    [8, 'Uferläufer'],
    [20, 'Spurenleser'],
    [40, 'Zeitreisender'],
    [65, 'See-Kenner'],
    [95, 'Großer Bodensee-Forscher'],
  ];

  const items = new Map();
  const views = {};
  const store = { got: {}, walkX: null, flags: {} };
  let api = null;
  let $ = null;
  let cv = null;
  let ctx = null;
  let W = 1;
  let H = 1;
  let DPR = 1;
  let view = null;
  let viewId = null;
  let time = 0;
  let toastT = 0;
  let infoItem = null;
  let bookCat = 'orte';
  let pointer = null;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (d && d.got) Object.assign(store, d);
    } catch (e) { /* storage unavailable: the collection lives for this visit only */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* same */ }
  }

  function def(item) {
    if (!CATS[item.cat]) throw new Error(`unknown category ${item.cat}`);
    if (items.has(item.id)) throw new Error(`duplicate item ${item.id}`);
    items.set(item.id, item);
    return item;
  }
  const has = (id) => !!store.got[id];
  const total = () => items.size;
  const count = () => [...items.keys()].filter(has).length;
  const inCat = (cat) => [...items.values()].filter((i) => i.cat === cat);
  function rankOf(n) {
    let r = RANKS[0][1];
    for (const [min, name] of RANKS) if (n >= min) r = name;
    return r;
  }
  function collect(id, quiet) {
    if (!items.has(id)) throw new Error(`unknown item ${id}`);
    if (has(id)) return false;
    const before = rankOf(count());
    store.got[id] = 1;
    save();
    if (!quiet) api.Sound.discover();
    const after = rankOf(count());
    if (after !== before) {
      api.Sound.fanfare();
      toast(_tf('Neuer Forscher-Rang: {rank}!', { rank: _t(after) }));
    }
    syncCounts();
    return true;
  }
  function syncCounts() {
    const n = count();
    const el = $('extCount');
    if (el) el.textContent = `${n}/${total()}`;
    const map = $('mapCount');
    if (map) map.textContent = `${n}/${total()}`;
  }

  function toast(text, seconds) {
    const el = $('extHint');
    el.textContent = _t(text);
    el.hidden = false;
    toastT = seconds || 3.6;
  }

  function resize() {
    if (!cv) return;
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    if (view && view.resize) view.resize(W, H);
  }

  function show(id, arg) {
    if (view && view.leave) view.leave();
    viewId = id;
    view = views[id];
    $('ausflug').dataset.view = id;
    document.querySelectorAll('.ext-nav button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.view === id)));
    $('extTitle').textContent = _t(view.title);
    $('extSub').textContent = _t(view.subtitle || '');
    closePanels();
    if (view.enter) view.enter(W, H, arg);
  }
  function open(id, arg) {
    if (api.state.mode !== 'ausflug') api.setMode('ausflug');
    resize();
    show(id || 'karte', arg);
    syncCounts();
    save();
  }
  function close() {
    if (view && view.leave) view.leave();
    view = null;
    viewId = null;
    closePanels();
    save();
    api.setMode('play');
  }
  function closePanels() {
    api.Reader.stop();
    infoItem = null;
    $('extInfo').hidden = true;
    $('extBook').hidden = true;
  }
  const panelOpen = () => !$('extInfo').hidden || !$('extBook').hidden;

  // ------------------------------------------------------------------ info card
  function info(id, extra) {
    const it = items.get(id);
    if (!it) throw new Error(`unknown item ${id}`);
    api.Reader.stop();
    infoItem = it;
    const cat = CATS[it.cat];
    $('extInfoEyebrow').textContent = (it.eyebrow || [cat.one]).map(_t).join(' · ');
    $('extInfoTitle').textContent = _t(it.title);
    const ul = $('extInfoFacts');
    ul.textContent = '';
    for (const fact of it.facts) {
      const li = document.createElement('li');
      li.textContent = _t(fact);
      ul.appendChild(li);
    }
    const art = $('extInfoArt');
    if (it.art) {
      art.hidden = false;
      const c = art.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, art.width, art.height);
      it.art(c, art.width, art.height, time);
    } else {
      art.hidden = true;
    }
    const act = $('extInfoAction');
    const action = (extra && extra.action) || it.action;
    act.hidden = !action;
    if (action) {
      act.textContent = _t(action.label);
      act.onclick = (e) => {
        e.preventDefault();
        action.run();
      };
    }
    $('extBook').hidden = true;
    $('extInfo').hidden = false;
    $('extInfoClose').textContent = _t(extra && extra.fromBook ? 'Zurück zum Forscherbuch' : 'Weiter');
    infoFromBook = !!(extra && extra.fromBook);
    setTimeout(() => $('extInfoClose').focus({ preventScroll: true }), 40);
  }
  let infoFromBook = false;
  function closeInfo() {
    api.Reader.stop();
    api.Sound.click();
    $('extInfo').hidden = true;
    const back = infoFromBook;
    infoItem = null;
    if (back) book(bookCat);
    else if (view && view.afterInfo) view.afterInfo();
  }

  // ------------------------------------------------------------------ Forscherbuch
  function book(cat) {
    bookCat = cat || bookCat;
    const tabs = $('extBookTabs');
    tabs.textContent = '';
    for (const key of Object.keys(CATS)) {
      const list = inCat(key);
      if (!list.length) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(key === bookCat));
      b.textContent = `${_t(CATS[key].label)} ${list.filter((i) => has(i.id)).length}/${list.length}`;
      b.addEventListener('click', () => {
        api.Sound.click();
        book(key);
      });
      tabs.appendChild(b);
    }
    const grid = $('extBookGrid');
    grid.textContent = '';
    for (const it of inCat(bookCat)) {
      const b = document.createElement('button');
      b.type = 'button';
      const got = has(it.id);
      b.className = `book-item${got ? ' got' : ''}`;
      b.disabled = !got;
      b.textContent = got ? _t(it.title) : '???';
      if (got) {
        b.addEventListener('click', () => {
          api.Sound.click();
          info(it.id, { fromBook: true });
        });
      }
      grid.appendChild(b);
    }
    const n = count();
    $('extBookRank').textContent = _tf('{rank} · {n} von {m} Entdeckungen', { rank: _t(rankOf(n)), n, m: total() });
    $('extBookNote').textContent = _t(CATS[bookCat].empty);
    $('extInfo').hidden = true;
    $('extBook').hidden = false;
  }

  // ------------------------------------------------------------------ input and frame
  function localPoint(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function bindInput() {
    cv.addEventListener('pointerdown', (e) => {
      if (panelOpen() || !view) return;
      e.preventDefault();
      pointer = e.pointerId;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      api.Sound.resume();
      const p = localPoint(e);
      if (view.down) view.down(p.x, p.y);
    });
    cv.addEventListener('pointermove', (e) => {
      if (pointer !== e.pointerId || !view) return;
      const p = localPoint(e);
      if (view.move) view.move(p.x, p.y);
    });
    const end = (e) => {
      if (pointer !== e.pointerId) return;
      pointer = null;
      const p = localPoint(e);
      if (view && view.up) view.up(p.x, p.y);
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // Returns true when the key belongs to the current trip.
  function key(e, down) {
    if (api.state.mode !== 'ausflug') return false;
    if (down && e.key === 'Escape') {
      if (!$('extInfo').hidden) closeInfo();
      else if (!$('extBook').hidden) closePanels();
      else close();
      return true;
    }
    if (panelOpen()) return false;
    return !!(view && view.key && view.key(e, down));
  }

  function frame(dt) {
    time += dt;
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) $('extHint').hidden = true;
    }
    if (!view || !ctx) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    view.frame(ctx, W, H, panelOpen() ? 0 : dt, time);
  }

  function init(gameApi) {
    api = gameApi;
    $ = gameApi.$;
    load();
    cv = $('extCanvas');
    ctx = cv.getContext('2d', { alpha: false });
    bindInput();
    $('extBack').addEventListener('click', () => {
      api.Sound.click();
      close();
    });
    $('extBookBtn').addEventListener('click', () => {
      api.Sound.click();
      if (!$('extBook').hidden) closePanels();
      else book();
    });
    $('extBookClose').addEventListener('click', () => {
      api.Sound.click();
      closePanels();
    });
    $('extInfoClose').addEventListener('click', closeInfo);
    $('extInfoSpeak').addEventListener('click', () => {
      if (infoItem) api.Reader.toggle(speech(infoItem), $('extInfoSpeak'));
    });
    document.querySelectorAll('.ext-nav button').forEach((b) => b.addEventListener('click', () => {
      api.Sound.click();
      if (b.dataset.view !== viewId) show(b.dataset.view);
    }));
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 250));
    syncCounts();
  }

  // What the speaker button reads for an info card; speechTexts() in game.js lists it for the recorded narration.
  const speech = (it) => `${_t(it.title)}. ${it.facts.map(_t).join(' ')}`;

  // Everything readable in the trips, for the translation checks.
  function textKeys() {
    const out = [];
    for (const c of Object.values(CATS)) out.push(c.label, c.one, c.empty);
    for (const r of RANKS) out.push(r[1]);
    for (const it of items.values()) out.push(it.title, ...it.facts, ...(it.eyebrow || []), ...(it.action ? [it.action.label] : []));
    for (const v of Object.values(views)) out.push(v.title, v.subtitle);
    for (const p of BE.places) out.push(p.name, p.region, p.line);
    for (const e of BE.eras) out.push(e.when, e.short, e.line);
    for (const f of BE.seaFinds) out.push(f.title, f.say);
    return out;
  }

  return {
    textKeys, speech, speechTexts: () => [...items.values()].map(speech), CATS, views, store, def, item: (id) => items.get(id), has, collect, count, total, inCat, rankOf, toast, open, close, show, info, book, init, frame, key, save, resize,
    get api() { return api; },
    get viewId() { return viewId; },
    get size() { return { w: W, h: H }; },
    panelOpen,
  };
})();
