/* Die große Österreich-Expedition
 * Erkunden, Rohstoffe abbauen, Wahrzeichen bauen – mit kurzen Wissensfragen dazwischen.
 * HTML5 Canvas, ohne Abhängigkeiten, ohne Tracking. Lernlogik: Abrufübung mit erklärendem Feedback,
 * Wiederholung in wachsenden Abständen (Leitner-Kartei), freies Erkunden mit klarem Auftrag.
 */
(() => {
  'use strict';
  const VERSION = '__BUILD_VERSION__';
  const SAVE_KEY = 'oesterreich-expedition-v1';
  const M = window.OE_MAP;
  const C = window.OE_CONTENT;
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function rng32(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ------------------------------------------------------------------ projection (world units; 600 = one degree of latitude ≈ 111 km)
  const KY = 600;
  const KX = KY * Math.cos((47.6 * Math.PI) / 180);
  const KM = 111 / KY; // km per world unit
  const X = (lon) => (lon - M.box.w) * KX;
  const Y = (lat) => (M.box.n - lat) * KY;
  const LON = (x) => x / KX + M.box.w;
  const LAT = (y) => M.box.n - y / KY;
  const WORLD = { w: X(M.box.e), h: Y(M.box.s) };

  function ringPath(rings) {
    const p = new Path2D();
    for (const r of rings) {
      r.forEach((q, i) => (i ? p.lineTo(X(q[0]), Y(q[1])) : p.moveTo(X(q[0]), Y(q[1]))));
      p.closePath();
    }
    return p;
  }
  function inRings(rings, lon, lat) {
    let inside = false;
    for (const r of rings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[i];
        const b = r[j];
        if (a[1] > lat !== b[1] > lat && lon < ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
    }
    return inside;
  }
  const countryPath = {};
  for (const k in M.countries) countryPath[k] = ringPath(M.countries[k]);
  const statePath = {};
  for (const k in M.states) statePath[k] = ringPath(M.states[k]);
  function stateAt(lon, lat) {
    for (const k in M.states) if (inRings(M.states[k], lon, lat)) return k;
    return null;
  }
  function countryAt(lon, lat) {
    // Liechtenstein first: it is tiny and sits on the Swiss border line.
    for (const k of ['LI', 'AT', 'DE', 'CZ', 'SK', 'HU', 'SI', 'IT', 'CH', 'HR', 'FR', 'PL']) if (M.countries[k] && inRings(M.countries[k], lon, lat)) return k;
    return null;
  }

  // ------------------------------------------------------------------ world objects
  const places = C.PLACES.map((p) => ({ ...p, x: X(p.lon), y: Y(p.lat) }));
  const placeById = Object.fromEntries(places.map((p) => [p.id, p]));
  const cityOf = {};
  for (const p of places) if (p.kind === 'stadt') cityOf[p.st] = p;
  const nodes = C.NODES.map(([res, lon, lat, name], i) => ({ i, res, name, x: X(lon), y: Y(lat), ready: 0 }));
  const scenery = [];
  (() => {
    const r = rng32(1955);
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    for (const [kind, lon, lat, rad, n] of C.SCENERY) {
      for (let i = 0; i < n; i++) {
        const lo = lon + gauss() * rad * 1.45;
        const la = lat + gauss() * rad;
        if (!inRings(M.countries.AT, lo, la)) continue;
        scenery.push({ kind, x: X(lo), y: Y(la), s: 0.75 + r() * 0.6, v: r() });
      }
    }
    scenery.sort((a, b) => a.y - b.y);
  })();
  const TOTAL = places.length;
  const N_STATES = 9;
  const N_NEIGH = places.filter((p) => p.kind === 'nachbar').length;

  // ------------------------------------------------------------------ state
  const START = { x: X(16.2), y: Y(48.12) };
  const state = {
    mode: 'title', // title | talk | play | card | quiz | build | book | map | pause | confirm | end
    level: 2,
    muted: false,
    time: 0,
    x: START.x, y: START.y,
    found: new Set(),
    built: new Set(),
    inv: {},
    boxes: {}, // question id -> [box, due tick]
    tick: 0,
    stats: { asked: 0, right: 0, area: {} },
    goal: 'W',
    cards: 0,
    ended: false,
    seenRes: {},
    hinted: false,
  };
  for (const k in C.RES) state.inv[k] = 0;
  const player = { face: 1, walk: 0, moving: false };
  const cam = { x: START.x, y: START.y };
  let W = 1;
  let H = 1;
  let DPR = 1;
  let SCALE = 1;
  let near = null; // { type: 'node'|'city', ref }
  let gather = null; // { node, t }
  let afterCard = null;

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, level: state.level, muted: state.muted, time: Math.round(state.time), x: state.x, y: state.y, found: [...state.found], built: [...state.built],
        inv: state.inv, boxes: state.boxes, tick: state.tick, stats: state.stats, goal: state.goal, cards: state.cards, ended: state.ended, seenRes: state.seenRes,
      }));
    } catch (e) { /* storage unavailable: progress lasts for this visit */ }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return d && d.v === 1 ? d : null;
    } catch (e) {
      return null;
    }
  }
  function apply(d) {
    state.level = clamp(Number(d.level) || 2, 1, 3);
    state.muted = !!d.muted;
    state.time = Number(d.time) || 0;
    state.x = clamp(Number(d.x) || START.x, 0, WORLD.w);
    state.y = clamp(Number(d.y) || START.y, 0, WORLD.h);
    state.found = new Set((d.found || []).filter((id) => placeById[id]));
    state.built = new Set((d.built || []).filter((k) => C.BUILDS[k]));
    for (const k in C.RES) state.inv[k] = Math.max(0, Math.floor(Number(d.inv && d.inv[k]) || 0));
    state.boxes = d.boxes && typeof d.boxes === 'object' ? d.boxes : {};
    state.tick = Number(d.tick) || 0;
    if (d.stats && d.stats.area) state.stats = d.stats;
    state.goal = C.BUILDS[d.goal] ? d.goal : 'W';
    state.cards = Number(d.cards) || 0;
    state.ended = !!d.ended;
    state.seenRes = d.seenRes || {};
    state.hinted = true;
  }
  function reset() {
    state.time = 0;
    state.x = START.x;
    state.y = START.y;
    state.found = new Set();
    state.built = new Set();
    for (const k in C.RES) state.inv[k] = 0;
    state.boxes = {};
    state.tick = 0;
    state.stats = { asked: 0, right: 0, area: {} };
    state.goal = 'W';
    state.cards = 0;
    state.ended = false;
    state.seenRes = {};
    state.hinted = false;
    for (const n of nodes) n.ready = 0;
    cam.x = state.x;
    cam.y = state.y;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------ canvas
  const canvas = $('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  function resize() {
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    SCALE = clamp(Math.min(W, H) / 430, 0.75, 1.5);
    $('scaleBar').style.width = `${Math.round((50 / KM) * SCALE)}px`;
    if (state.mode === 'map') drawOverview();
  }
  const mainView = () => ({ cx: cam.x, cy: cam.y, s: SCALE, w: W, h: H, dpr: DPR });
  function setWorld(c, v) {
    c.setTransform(v.dpr * v.s, 0, 0, v.dpr * v.s, v.dpr * (v.w / 2 - v.cx * v.s), v.dpr * (v.h / 2 - v.cy * v.s));
  }
  const toScreen = (v, x, y) => ({ x: v.w / 2 + (x - v.cx) * v.s, y: v.h / 2 + (y - v.cy) * v.s });

  // ------------------------------------------------------------------ drawing helpers
  function drawFlag(c, code, x, y, w, h) {
    const band = (cols, vertical) => cols.forEach((col, i) => {
      c.fillStyle = col;
      if (vertical) c.fillRect(x + (i * w) / cols.length, y, w / cols.length + 0.3, h);
      else c.fillRect(x, y + (i * h) / cols.length, w, h / cols.length + 0.3);
    });
    if (code === 'AT') band(['#c8102e', '#fff', '#c8102e']);
    else if (code === 'DE') band(['#111', '#d00', '#ffce00']);
    else if (code === 'HU') band(['#ce2939', '#fff', '#477050']);
    else if (code === 'IT') band(['#009246', '#fff', '#ce2b37'], true);
    else if (code === 'SK' || code === 'SI') {
      band(['#fff', '#0b4ea2', '#ee1c25']);
      c.fillStyle = code === 'SK' ? '#ee1c25' : '#0b4ea2';
      c.fillRect(x + w * 0.16, y + h * (code === 'SK' ? 0.25 : 0.08), w * 0.2, h * (code === 'SK' ? 0.5 : 0.36));
      c.fillStyle = '#fff';
      c.fillRect(x + w * 0.24, y + h * (code === 'SK' ? 0.36 : 0.16), w * 0.04, h * 0.22);
    } else if (code === 'CZ') {
      band(['#fff', '#d7141a']);
      c.fillStyle = '#11457e';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w * 0.5, y + h / 2);
      c.lineTo(x, y + h);
      c.closePath();
      c.fill();
    } else if (code === 'CH') {
      c.fillStyle = '#da291c';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#fff';
      c.fillRect(x + w * 0.42, y + h * 0.18, w * 0.16, h * 0.64);
      c.fillRect(x + w * 0.24, y + h * 0.4, w * 0.52, h * 0.2);
    } else if (code === 'LI') {
      band(['#002b7f', '#ce1126']);
      c.fillStyle = '#ffd83d';
      c.fillRect(x + w * 0.14, y + h * 0.14, w * 0.22, h * 0.2);
    }
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = Math.max(0.6, h * 0.05);
    c.strokeRect(x, y, w, h);
  }
  function drawArt(c, key, x, y, cell, count) {
    const art = C.BUILDS[key].art;
    let n = 0;
    for (let row = art.length - 1; row >= 0; row--) {
      for (let col = 0; col < art[row].length; col++) {
        const ch = art[row][col];
        if (ch === '.') continue;
        if (count !== undefined && n >= count) return n;
        n++;
        c.fillStyle = C.PALETTE[ch] || '#888';
        c.fillRect(x + col * cell, y + row * cell, cell + 0.4, cell + 0.4);
        c.fillStyle = 'rgba(255,255,255,0.22)';
        c.fillRect(x + col * cell, y + row * cell, cell, cell * 0.22);
        c.fillStyle = 'rgba(0,0,0,0.16)';
        c.fillRect(x + col * cell, y + row * cell + cell * 0.8, cell, cell * 0.2);
      }
    }
    return n;
  }
  const blocksOf = (key) => C.BUILDS[key].art.join('').replace(/\./g, '').length;
  function drawBlock(c, res, x, y, s) {
    c.fillStyle = C.RES[res].color;
    c.fillRect(x, y, s, s);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(x, y, s, s * 0.2);
    c.fillRect(x, y, s * 0.2, s);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(x, y + s * 0.8, s, s * 0.2);
    c.fillRect(x + s * 0.8, y, s * 0.2, s);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = Math.max(0.8, s * 0.06);
    c.strokeRect(x, y, s, s);
  }

  // ------------------------------------------------------------------ map rendering (shared by game, cards and overview)
  function drawMap(c, v, o) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#a9cfe2';
    c.fillRect(0, 0, v.w * v.dpr, v.h * v.dpr);
    setWorld(c, v);
    const hw = v.w / (2 * v.s);
    const hh = v.h / (2 * v.s);
    const u = Math.max(1, 0.8 / v.s); // keep lines visible when the map is shown small
    const tk = o.big ? Math.max(1, 0.55 / v.s) : 1;
    const vis = (x, y, m) => x > v.cx - hw - m && x < v.cx + hw + m && y > v.cy - hh - m && y < v.cy + hh + m;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const k in countryPath) {
      if (k === 'AT') continue;
      c.fillStyle = C.COUNTRIES[k].color;
      c.fill(countryPath[k]);
      c.strokeStyle = 'rgba(90,80,70,0.55)';
      c.lineWidth = 1.2 * u;
      c.stroke(countryPath[k]);
    }
    for (const k in statePath) {
      c.fillStyle = C.STATES[k].color;
      c.fill(statePath[k]);
    }
    c.strokeStyle = 'rgba(120,90,60,0.7)';
    c.lineWidth = 1.4 * u;
    c.setLineDash([6 * u, 5 * u]);
    for (const k in statePath) c.stroke(statePath[k]);
    c.setLineDash([]);
    // lakes and rivers
    c.fillStyle = '#5aa7d6';
    for (const l of C.LAKES) {
      c.beginPath();
      l.pts.forEach((q, i) => (i ? c.lineTo(X(q[0]), Y(q[1])) : c.moveTo(X(q[0]), Y(q[1]))));
      c.closePath();
      c.fill();
      c.strokeStyle = '#3f86b5';
      c.lineWidth = 1;
      c.stroke();
    }
    for (const r of C.RIVERS) {
      c.strokeStyle = '#5aa7d6';
      c.lineWidth = r.w * 0.9 * Math.sqrt(u);
      c.beginPath();
      r.pts.forEach((q, i) => {
        if (!i) c.moveTo(X(q[0]), Y(q[1]));
        else {
          const p = r.pts[i - 1];
          c.quadraticCurveTo(X(p[0]), Y(p[1]), (X(p[0]) + X(q[0])) / 2, (Y(p[1]) + Y(q[1])) / 2);
        }
      });
      const last = r.pts[r.pts.length - 1];
      c.lineTo(X(last[0]), Y(last[1]));
      c.stroke();
    }
    // the red-white-red state border
    c.strokeStyle = '#fff';
    c.lineWidth = 6 * u;
    c.stroke(countryPath.AT);
    c.strokeStyle = '#c8102e';
    c.lineWidth = 2.6 * u;
    c.stroke(countryPath.AT);

    if (o.decor) {
      for (const s of scenery) {
        if (!vis(s.x, s.y, 40)) continue;
        if (s.kind === 'berg') {
          const hgt = 26 * s.s;
          c.fillStyle = s.v < 0.5 ? '#8f8a80' : '#a39c8e';
          c.beginPath();
          c.moveTo(s.x - hgt * 0.7, s.y);
          c.lineTo(s.x, s.y - hgt);
          c.lineTo(s.x + hgt * 0.7, s.y);
          c.closePath();
          c.fill();
          c.fillStyle = 'rgba(60,55,50,0.35)';
          c.beginPath();
          c.moveTo(s.x, s.y - hgt);
          c.lineTo(s.x + hgt * 0.7, s.y);
          c.lineTo(s.x + hgt * 0.15, s.y);
          c.closePath();
          c.fill();
          c.fillStyle = '#fff';
          c.beginPath();
          c.moveTo(s.x - hgt * 0.24, s.y - hgt * 0.66);
          c.lineTo(s.x, s.y - hgt);
          c.lineTo(s.x + hgt * 0.24, s.y - hgt * 0.66);
          c.lineTo(s.x + hgt * 0.08, s.y - hgt * 0.56);
          c.lineTo(s.x - hgt * 0.06, s.y - hgt * 0.7);
          c.closePath();
          c.fill();
        } else if (s.kind === 'wald') {
          for (let k = 0; k < 3; k++) {
            const tx = s.x + (k - 1) * 8 * s.s;
            const ty = s.y + (k % 2) * 4;
            c.fillStyle = k % 2 ? '#2f6b4f' : '#3d7d55';
            c.beginPath();
            c.moveTo(tx - 6 * s.s, ty);
            c.lineTo(tx, ty - 17 * s.s);
            c.lineTo(tx + 6 * s.s, ty);
            c.closePath();
            c.fill();
            c.fillStyle = '#6f4a28';
            c.fillRect(tx - 1, ty, 2, 3);
          }
        } else {
          c.fillStyle = s.v < 0.5 ? '#e8cf6a' : '#d9c35a';
          c.fillRect(s.x - 12 * s.s, s.y - 6 * s.s, 24 * s.s, 12 * s.s);
          c.strokeStyle = 'rgba(150,120,30,0.5)';
          c.lineWidth = 0.8;
          for (let k = -2; k <= 2; k++) {
            c.beginPath();
            c.moveTo(s.x - 12 * s.s, s.y + k * 2.4 * s.s);
            c.lineTo(s.x + 12 * s.s, s.y + k * 2.4 * s.s);
            c.stroke();
          }
        }
      }
    }
    // names
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (o.labels) {
      for (const k in C.COUNTRIES) {
        const cc = C.COUNTRIES[k];
        if (!cc.label) continue;
        c.font = `700 ${34 * tk}px Rockwell, "Roboto Slab", Georgia, serif`;
        c.fillStyle = 'rgba(70,60,50,0.5)';
        c.fillText(cc.name.toUpperCase(), X(cc.label[0]), Y(cc.label[1]));
      }
      for (const k in C.STATES) {
        if (k === 'W') continue; // the city label says it already
        const st = C.STATES[k];
        c.font = `700 ${(k === 'W' ? 15 : 22) * tk}px Rockwell, "Roboto Slab", Georgia, serif`;
        c.fillStyle = 'rgba(40,38,32,0.5)';
        c.fillText(st.name, X(st.label[0]), Y(st.label[1]));
      }
      c.font = `italic 600 ${13 * Math.sqrt(tk)}px Georgia, serif`;
      c.fillStyle = '#1f5f8a';
      for (const r of C.RIVERS) {
        const q = r.pts[Math.floor(r.pts.length / 2)];
        c.fillText(r.name, X(q[0]) + 4, Y(q[1]) - 9);
      }
    }
  }

  function drawPlaceMarker(c, p, t, big) {
    const found = state.found.has(p.id);
    const k = big || 1;
    if (p.kind === 'stadt') {
      const built = state.built.has(p.st);
      if (built) drawArt(c, p.st, p.x - 21 * k, p.y - 54 * k, 3.5 * k);
      else {
        c.strokeStyle = '#7a5200';
        c.lineWidth = 1.6;
        c.setLineDash([4, 3]);
        c.strokeRect(p.x - 18 * k, p.y - 46 * k, 36 * k, 40 * k);
        c.setLineDash([]);
        c.fillStyle = '#f2b21b';
        c.fillRect(p.x - 18 * k, p.y - 12 * k, 36 * k, 6 * k);
        c.fillStyle = '#2b2924';
        for (let i = 0; i < 4; i++) c.fillRect(p.x - 18 * k + i * 10 * k, p.y - 12 * k, 5 * k, 6 * k);
      }
      c.fillStyle = '#c8102e';
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = (i % 2 ? 4 : 9) * k;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        c.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.font = `700 ${15 * k}px "Avenir Next", system-ui, sans-serif`;
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.strokeText(p.title, p.x, p.y + 18 * k);
      c.fillStyle = '#2b2924';
      c.fillText(p.title, p.x, p.y + 18 * k);
      return;
    }
    const bob = found ? 0 : Math.sin(t * 2.2 + p.x) * 2.5;
    if (p.kind === 'nachbar') {
      c.fillStyle = '#6f4a28';
      c.fillRect(p.x - 1.5, p.y - 26 * k + bob, 3, 26 * k);
      drawFlag(c, p.c, p.x + 1.5, p.y - 26 * k + bob, 26 * k, 16 * k);
    } else {
      c.fillStyle = found ? (p.kind === 'natur' ? '#2f6b4f' : p.kind === 'zeit' ? '#8a5a2b' : '#4a6fa5') : '#fff';
      c.strokeStyle = found ? '#fff' : '#5e574a';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y - 8 + bob, 10 * k, 0, TAU);
      c.fill();
      c.stroke();
      c.font = `800 ${13 * k}px "Avenir Next", system-ui, sans-serif`;
      c.fillStyle = found ? '#fff' : '#c8102e';
      c.fillText(found ? (p.kind === 'natur' ? '▲' : p.kind === 'zeit' ? '♜' : '⚙') : '?', p.x, p.y - 7.5 + bob);
    }
    if (found || p.kind === 'nachbar') {
      c.font = `600 ${12 * k}px "Avenir Next", system-ui, sans-serif`;
      c.lineWidth = 3.5;
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.strokeText(p.title, p.x, p.y + 10 * k);
      c.fillStyle = '#2b2924';
      c.fillText(p.title, p.x, p.y + 10 * k);
    }
  }

  function drawNode(c, n, t) {
    const ready = n.ready <= state.time;
    c.globalAlpha = ready ? 1 : 0.35;
    const s = 9;
    drawBlock(c, n.res, n.x - s - 1, n.y - s, s);
    drawBlock(c, n.res, n.x + 1, n.y - s, s);
    drawBlock(c, n.res, n.x - s / 2, n.y - 2 * s - 1, s);
    c.globalAlpha = 1;
    if (ready) {
      c.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 3 + n.i)})`;
      c.fillRect(n.x + 7, n.y - 22, 2.5, 2.5);
    }
    c.font = '600 11px "Avenir Next", system-ui, sans-serif';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    const label = ready ? C.RES[n.res].name : 'wächst nach';
    c.strokeText(label, n.x, n.y + 9);
    c.fillStyle = '#3d2814';
    c.fillText(label, n.x, n.y + 9);
  }

  function drawPlayer(c, t) {
    const x = state.x;
    const y = state.y;
    const step = player.moving ? Math.sin(player.walk) : 0;
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath();
    c.ellipse(x, y + 1, 9, 3.5, 0, 0, TAU);
    c.fill();
    c.save();
    c.translate(x, y - Math.abs(step) * 1.5);
    c.scale(player.face, 1);
    c.strokeStyle = '#2b3a67';
    c.lineWidth = 3.4;
    c.beginPath();
    c.moveTo(-2, -8);
    c.lineTo(-2 - step * 3, 0);
    c.moveTo(2, -8);
    c.lineTo(2 + step * 3, 0);
    c.stroke();
    c.fillStyle = '#7a4a22';
    c.fillRect(-9, -20, 6, 11);
    c.fillStyle = '#f2b21b';
    c.fillRect(-5, -21, 10, 13);
    c.strokeStyle = '#f2b21b';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(3, -18);
    c.lineTo(7 + step * 2, -12);
    c.stroke();
    c.fillStyle = '#f2c9a0';
    c.beginPath();
    c.arc(0, -25, 5.2, 0, TAU);
    c.fill();
    c.fillStyle = '#c8102e';
    c.beginPath();
    c.arc(0, -26.5, 5.4, Math.PI, TAU);
    c.fill();
    c.fillRect(0, -27.5, 8, 2);
    c.fillStyle = '#fff';
    c.fillRect(-5.4, -28.2, 10.8, 1.6);
    c.restore();
    if (gather) {
      const a = Math.sin(t * 18) * 0.7;
      c.save();
      c.translate(x + player.face * 8, y - 16);
      c.rotate(a * player.face);
      c.strokeStyle = '#6f4a28';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(player.face * 9, -9);
      c.stroke();
      c.strokeStyle = '#6d7b8a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(player.face * 5, -13);
      c.lineTo(player.face * 13, -6);
      c.stroke();
      c.restore();
    }
  }

  function render(t) {
    const v = mainView();
    drawMap(ctx, v, { decor: true, labels: true });
    const hw = W / (2 * SCALE) + 60;
    const hh = H / (2 * SCALE) + 70;
    const vis = (o) => Math.abs(o.x - cam.x) < hw && Math.abs(o.y - cam.y) < hh;
    const items = [];
    for (const n of nodes) if (vis(n)) items.push({ y: n.y, f: () => drawNode(ctx, n, t) });
    for (const p of places) if (vis(p)) items.push({ y: p.y, f: () => drawPlaceMarker(ctx, p, t) });
    items.push({ y: state.y, f: () => drawPlayer(ctx, t) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();
    if (input.active && state.mode === 'play') {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.strokeStyle = 'rgba(200,16,46,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(input.sx, input.sy, 16 + Math.sin(t * 6) * 3, 0, TAU);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------------ quest and compass
  const DIRS = ['Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten', 'Norden', 'Nordosten'];
  const dirName = (dx, dy) => DIRS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const nearestOf = (list) => list.reduce((best, o) => (!best || dist(o, state) < dist(best, state) ? o : best), null);
  const hasAll = (key) => Object.entries(C.BUILDS[key].need).every(([r, n]) => state.inv[r] >= n);
  let quest = { text: '', target: null };
  function updateQuest() {
    let text;
    let target = null;
    if (!state.found.has('wien')) {
      target = placeById.wien;
      text = 'Geh nach Wien, in die Hauptstadt von Österreich.';
    } else if (state.built.size < N_STATES) {
      if (state.built.has(state.goal)) state.goal = nearestOf(Object.keys(C.BUILDS).filter((k) => !state.built.has(k)).map((k) => cityOf[k])).st;
      const b = C.BUILDS[state.goal];
      const city = cityOf[state.goal];
      const missing = Object.entries(b.need).find(([r, n]) => state.inv[r] < n);
      if (!missing) {
        target = city;
        text = `Du hast alles beisammen! Geh nach ${b.city} und baue: ${b.name}.`;
      } else {
        const [r, n] = missing;
        target = nearestOf(nodes.filter((nd) => nd.res === r && nd.ready <= state.time)) || nearestOf(nodes.filter((nd) => nd.res === r));
        text = `Für ${b.name} in ${b.city} fehlt noch ${C.RES[r].name} (${state.inv[r]}/${n}). Hol es hier: ${target.name}.`;
      }
    } else {
      const nb = nearestOf(places.filter((p) => p.kind === 'nachbar' && !state.found.has(p.id)));
      const rest = nearestOf(places.filter((p) => !state.found.has(p.id)));
      if (nb) {
        target = nb;
        text = `Alle Wahrzeichen stehen! Besuche jetzt das Nachbarland ${nb.title}.`;
      } else if (rest) {
        target = rest;
        text = 'Da ist noch ein unbekannter Ort. Finde heraus, was dort ist!';
      } else text = 'Du hast ganz Österreich entdeckt. Schau ins Forscherheft!';
    }
    if (target) {
      const km = Math.round((dist(target, state) * KM) / 5) * 5;
      if (km >= 5) text += ` Richtung ${dirName(target.x - state.x, target.y - state.y)}, etwa ${km} km.`;
    }
    quest = { text, target };
    if ($('questText').textContent !== text) $('questText').textContent = text;
  }
  const compass = $('compass');
  const cc = compass.getContext('2d');
  function drawCompass() {
    const S = compass.width;
    const m = S / 2;
    cc.clearRect(0, 0, S, S);
    cc.fillStyle = '#6f4a28';
    cc.beginPath();
    cc.arc(m, m, m - 2, 0, TAU);
    cc.fill();
    cc.fillStyle = '#fbf4e2';
    cc.beginPath();
    cc.arc(m, m, m - 9, 0, TAU);
    cc.fill();
    cc.fillStyle = '#2b2924';
    cc.font = `800 ${S * 0.17}px "Avenir Next", system-ui, sans-serif`;
    cc.textAlign = 'center';
    cc.textBaseline = 'middle';
    cc.fillText('N', m, S * 0.2);
    cc.fillText('S', m, S * 0.81);
    cc.fillText('W', S * 0.2, m);
    cc.fillText('O', S * 0.8, m);
    if (quest.target) {
      const a = Math.atan2(quest.target.y - state.y, quest.target.x - state.x);
      cc.save();
      cc.translate(m, m);
      cc.rotate(a);
      cc.fillStyle = '#c8102e';
      cc.beginPath();
      cc.moveTo(S * 0.3, 0);
      cc.lineTo(-S * 0.08, -S * 0.1);
      cc.lineTo(-S * 0.08, S * 0.1);
      cc.closePath();
      cc.fill();
      cc.restore();
    }
    cc.fillStyle = '#2b2924';
    cc.beginPath();
    cc.arc(m, m, S * 0.05, 0, TAU);
    cc.fill();
  }

  // ------------------------------------------------------------------ HUD
  function renderBag() {
    const bag = $('bag');
    bag.textContent = '';
    for (const r in C.RES) {
      const el = document.createElement('span');
      el.className = 'slot' + (state.inv[r] ? '' : ' zero');
      el.dataset.res = r;
      el.title = C.RES[r].name;
      const i = document.createElement('i');
      i.style.background = C.RES[r].color;
      el.append(i, document.createTextNode(String(state.inv[r])));
      el.setAttribute('aria-label', `${C.RES[r].name}: ${state.inv[r]}`);
      bag.appendChild(el);
    }
  }
  function bump(res) {
    renderBag();
    const el = $('bag').querySelector(`[data-res="${res}"]`);
    if (el) el.classList.add('bump');
  }
  let toastT = 0;
  function toast(text, sec) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    toastT = sec || 3.5;
  }
  let whereKey = '';
  function updateWhere() {
    const lon = LON(state.x);
    const lat = LAT(state.y);
    const st = stateAt(lon, lat);
    const co = st ? 'AT' : countryAt(lon, lat);
    const key = st || co || '';
    if (key === whereKey) return;
    whereKey = key;
    $('whereName').textContent = st ? C.STATES[st].name : co && C.COUNTRIES[co] ? C.COUNTRIES[co].name : 'an der Grenze';
    document.querySelector('.where-label').textContent = st ? 'Bundesland' : 'Land';
  }
  function updateHud() {
    $('bookCount').textContent = `${state.found.size}/${TOTAL}`;
    const act = $('btnAct');
    let label = null;
    if (near && near.type === 'node') label = near.ref.ready <= state.time ? `${C.RES[near.ref.res].verb} (halten)` : null;
    else if (near && near.type === 'city') label = state.built.has(near.ref.st) ? null : `Baustelle: ${C.BUILDS[near.ref.st].name}`;
    if (label === null) act.hidden = true;
    else {
      if (act.dataset.label !== label) {
        act.dataset.label = label;
        act.textContent = label;
        const bar = document.createElement('i');
        bar.className = 'bar';
        act.appendChild(bar);
      }
      act.hidden = false;
      act.querySelector('.bar').style.width = gather ? `${Math.round((gather.t / 1.2) * 100)}%` : '0';
    }
  }

  // ------------------------------------------------------------------ sound (synthesized)
  const Sound = (() => {
    let ac = null;
    let out = null;
    function init() {
      if (ac) {
        if (ac.state !== 'running') ac.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ac = new AC();
        out = ac.createGain();
        out.gain.value = state.muted ? 0 : 0.5;
        out.connect(ac.destination);
      } catch (e) {
        ac = null;
      }
    }
    function tone(f, t0, dur, type, gain, f2) {
      if (!ac) return;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, ac.currentTime + t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, ac.currentTime + t0 + dur);
      g.gain.setValueAtTime(0.0001, ac.currentTime + t0);
      g.gain.linearRampToValueAtTime(gain || 0.2, ac.currentTime + t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
      o.connect(g);
      g.connect(out);
      o.start(ac.currentTime + t0);
      o.stop(ac.currentTime + t0 + dur + 0.05);
    }
    return {
      init,
      mute(m) { if (out) out.gain.value = m ? 0 : 0.5; },
      click() { tone(900, 0, 0.05, 'sine', 0.12); },
      hit() { tone(180 + Math.random() * 60, 0, 0.07, 'square', 0.1, 90); },
      pick() { tone(520, 0, 0.1, 'triangle', 0.2); tone(780, 0.08, 0.16, 'triangle', 0.2); },
      block() { tone(300 + Math.random() * 200, 0, 0.05, 'square', 0.07); },
      right() { [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.2)); },
      wrong() { tone(260, 0, 0.22, 'sine', 0.16, 200); },
      found() { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.4, 'triangle', 0.2)); },
      fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.5, 'triangle', 0.22)); },
    };
  })();

  // ------------------------------------------------------------------ reading aloud (on-device voice only)
  const Reader = (() => {
    const synth = window.speechSynthesis;
    const U = window.SpeechSynthesisUtterance;
    let voice = null;
    let btn = null;
    function pick() {
      if (!synth || !U) return;
      const all = synth.getVoices().filter((v) => /^de([-_]|$)/i.test(v.lang) && v.localService !== false);
      voice = all.find((v) => /^de[-_]AT/i.test(v.lang)) || all[0] || null;
      document.documentElement.classList.toggle('no-speech', !voice);
    }
    function stop() {
      if (synth) synth.cancel();
      if (btn) btn.setAttribute('aria-pressed', 'false');
      btn = null;
    }
    function toggle(button, text) {
      if (btn === button) return stop();
      stop();
      if (!voice) return;
      const u = new U(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      u.onend = u.onerror = () => { if (btn === button) stop(); };
      btn = button;
      button.setAttribute('aria-pressed', 'true');
      synth.speak(u);
    }
    document.documentElement.classList.add('no-speech');
    if (synth && U) {
      pick();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', pick);
    }
    return { stop, toggle };
  })();

  // ------------------------------------------------------------------ modes
  const SCREENS = ['title', 'talk', 'card', 'quiz', 'build', 'book', 'map', 'pause', 'confirm', 'end'];
  function setMode(m) {
    Reader.stop();
    if (m !== 'play') {
      input.active = false;
      gather = null;
    }
    state.mode = m;
    for (const id of SCREENS) $(id).hidden = id !== m;
    $('hud').hidden = m === 'title' || m === 'map';
    if (m === 'play') {
      updateQuest();
      updateHud();
    }
  }

  // Muri talks
  const talk = { lines: [], i: 0, done: null };
  function say(lines, done) {
    talk.lines = lines;
    talk.i = 0;
    talk.done = done || null;
    $('talkText').textContent = lines[0];
    $('btnTalkNext').textContent = lines.length > 1 ? 'Weiter' : 'Los!';
    setMode('talk');
  }
  function talkNext() {
    Sound.click();
    Reader.stop();
    if (talk.i < talk.lines.length - 1) {
      talk.i++;
      $('talkText').textContent = talk.lines[talk.i];
      $('btnTalkNext').textContent = talk.i < talk.lines.length - 1 ? 'Weiter' : 'Los!';
      return;
    }
    const done = talk.done;
    talk.done = null;
    setMode('play');
    if (done) done();
  }
  function drawMuri(cv) {
    const c = cv.getContext('2d');
    const s = cv.width / 120;
    c.save();
    c.scale(s, s);
    c.fillStyle = '#8a6238';
    c.beginPath();
    c.ellipse(60, 70, 38, 40, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(30, 36, 11, 0, TAU);
    c.arc(90, 36, 11, 0, TAU);
    c.fill();
    c.fillStyle = '#e9d2ad';
    c.beginPath();
    c.ellipse(60, 84, 24, 20, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#2b2924';
    c.beginPath();
    c.arc(45, 60, 5, 0, TAU);
    c.arc(75, 60, 5, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(46.5, 58.5, 1.6, 0, TAU);
    c.arc(76.5, 58.5, 1.6, 0, TAU);
    c.fill();
    c.fillStyle = '#4a2f1a';
    c.beginPath();
    c.ellipse(60, 73, 7, 5, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(55, 84, 10, 11);
    c.strokeStyle = '#4a2f1a';
    c.lineWidth = 1.5;
    c.strokeRect(55, 84, 10, 11);
    c.beginPath();
    c.moveTo(60, 84);
    c.lineTo(60, 95);
    c.stroke();
    c.restore();
  }

  // ------------------------------------------------------------------ discovery cards
  function showCard(p, fresh) {
    $('cardEyebrow').textContent = p.kind === 'stadt' ? `Landeshauptstadt · ${C.STATES[p.st].name}` : p.kind === 'nachbar' ? `Nachbarland im ${C.COUNTRIES[p.c].dir}` : `${C.AREAS[p.area]} · ${C.STATES[stateAt(p.lon, p.lat)] ? C.STATES[stateAt(p.lon, p.lat)].name : 'Österreich'}`;
    $('cardTitle').textContent = p.title;
    const ul = $('cardFacts');
    ul.textContent = '';
    for (const f of p.facts) {
      const li = document.createElement('li');
      li.textContent = f;
      ul.appendChild(li);
    }
    const cv = $('cardArt');
    const c = cv.getContext('2d');
    const far = p.kind === 'nachbar' ? 0.34 : 0.8;
    drawMap(c, { cx: p.x, cy: p.y - 6, s: far, w: cv.width, h: cv.height, dpr: 1 }, { decor: true, labels: true });
    for (const o of places) if (o !== p && state.found.has(o.id) && Math.abs(o.x - p.x) < 520 && Math.abs(o.y - p.y) < 260) drawPlaceMarker(c, o, 0);
    drawPlaceMarker(c, p, 0, 1.5);
    if (p.kind === 'nachbar') {
      c.setTransform(1, 0, 0, 1, 0, 0);
      drawFlag(c, p.c, 16, 16, 96, 60);
    }
    $('btnCardClose').textContent = fresh ? 'Weiter forschen' : 'Zurück';
    setMode('card');
  }
  function discover(p) {
    state.found.add(p.id);
    state.cards++;
    Sound.found();
    save();
    afterCard = () => {
      if (checkEnd()) return;
      if (p.kind === 'nachbar') return askQuiz({ id: `nb-${p.c}` }, 'Muri fragt nach');
      if (state.cards % 2 === 0) return askQuiz({ place: p }, 'Muri fragt nach');
      return null;
    };
    showCard(p, true);
  }

  // ------------------------------------------------------------------ knowledge questions (retrieval practice + Leitner boxes)
  const GAP = [1, 3, 7, 15, 40];
  function allQuestions() {
    const list = C.Q.slice();
    const caps = Object.values(C.STATES).map((s) => s.capital);
    for (const k in C.STATES) {
      const st = C.STATES[k];
      if (k !== 'W') list.push({ id: `cap-${k}`, area: 'geo', lv: k === 'S' ? 1 : 2, st: k, q: `Wie heißt die Landeshauptstadt von ${st.name}?`, a: [st.capital, ...shuffle(caps.filter((c) => c !== st.capital)).slice(0, 2)], e: `${st.capital} ist die Landeshauptstadt von ${st.name}.` });
      list.push({ id: `st-${k}`, area: 'geo', lv: 2, st: k, map: 'state', target: k, q: `Tippe auf der Karte auf das Bundesland ${st.name}.`, e: `Hier liegt ${st.name}.` });
    }
    const ncap = ['Berlin', 'Prag', 'Bratislava', 'Budapest', 'Ljubljana', 'Rom', 'Bern', 'Vaduz'];
    for (const k of ['DE', 'CZ', 'SK', 'HU', 'SI', 'IT', 'CH', 'LI']) {
      const co = C.COUNTRIES[k];
      list.push({ id: `nb-${k}`, area: 'geo', lv: 2, map: 'country', target: k, q: `Tippe auf der Karte auf das Nachbarland ${co.name}.`, e: `${co.name} liegt im ${co.dir} von Österreich.`, p: `n-${k.toLowerCase()}` });
      list.push({ id: `ncap-${k}`, area: 'geo', lv: 3, q: `Wie heißt die Hauptstadt von ${co.name}?`, a: [co.capital, ...shuffle(ncap.filter((c) => c !== co.capital)).slice(0, 2)], e: `${co.capital} ist die Hauptstadt von ${co.name}.`, p: `n-${k.toLowerCase()}` });
    }
    for (const [a, b] of [['wien', 'bregenz'], ['wien', 'graz'], ['linz', 'klagenfurt'], ['innsbruck', 'salzburg'], ['graz', 'linz'], ['klagenfurt', 'wien']]) {
      const pa = placeById[a];
      const pb = placeById[b];
      const right = dirName(pb.x - pa.x, pb.y - pa.y);
      const others = shuffle(DIRS.filter((d) => d !== right && !d.includes(right) && !right.includes(d))).slice(0, 2);
      list.push({ id: `dir-${a}-${b}`, area: 'geo', lv: 2, q: `Du stehst in ${pa.title}. In welcher Himmelsrichtung liegt ${pb.title}?`, a: [`im ${right}`, ...others.map((d) => `im ${d}`)], e: `${pb.title} liegt von ${pa.title} aus im ${right}. Schau auf die Karte: Norden ist oben.` });
    }
    return list;
  }
  let lastArea = '';
  function chooseQuestion(ctxq) {
    const all = allQuestions();
    if (ctxq.id) return all.find((q) => q.id === ctxq.id);
    const acc = state.stats.asked >= 6 ? state.stats.right / state.stats.asked : 0;
    const maxLv = Math.min(3, state.level + (acc > 0.85 ? 1 : 0));
    const known = (q) => !q.p || state.found.has(q.p);
    const pool = all.filter((q) => q.lv <= maxLv && known(q));
    const box = (q) => state.boxes[q.id];
    const score = (q) => {
      const b = box(q);
      let s = Math.random();
      if (b && b[1] <= state.tick) s += 6 - b[0]; // due for repetition: lowest box first
      else if (b) s -= 8; // answered recently: let it rest
      else s += 2; // new
      if (ctxq.st && q.st === ctxq.st) s += 9;
      if (ctxq.place && q.p === ctxq.place.id) s += 5;
      if (q.area === lastArea && !ctxq.st) s -= 1.5; // mix the subject areas
      if (q.lv === state.level) s += 0.8;
      return s;
    };
    return pool.map((q) => [score(q), q]).sort((a, b) => b[0] - a[0])[0][1];
  }
  const quiz = { q: null, tries: 0, done: null, opts: [], solved: false, correct: false };
  function askQuiz(ctxq, eyebrow, done) {
    const q = chooseQuestion(ctxq);
    quiz.q = q;
    quiz.tries = 0;
    quiz.solved = false;
    quiz.correct = false;
    quiz.done = done || null;
    lastArea = q.area;
    $('quizEyebrow').textContent = `${eyebrow} · ${C.AREAS[q.area]}`;
    $('quizQ').textContent = q.q;
    $('quizFb').hidden = true;
    $('btnQuizNext').hidden = true;
    const opts = $('quizOpts');
    opts.textContent = '';
    const mapCv = $('quizMap');
    mapCv.hidden = !q.map;
    if (q.map) drawQuizMap(null, null);
    else {
      quiz.opts = shuffle(q.a);
      for (const text of quiz.opts) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt';
        b.textContent = text;
        b.addEventListener('click', () => answer(text === q.a[0], b));
        opts.appendChild(b);
      }
    }
    setMode('quiz');
  }
  function record(q, right) {
    state.tick++;
    state.stats.asked++;
    const ar = state.stats.area[q.area] || (state.stats.area[q.area] = [0, 0]);
    ar[1]++;
    const b = state.boxes[q.id] || [0, 0];
    if (right) {
      state.stats.right++;
      ar[0]++;
      b[0] = Math.min(GAP.length - 1, b[0] + 1);
    } else b[0] = 0;
    b[1] = state.tick + GAP[b[0]];
    state.boxes[q.id] = b;
    save();
  }
  function answer(right, button) {
    if (quiz.solved) return;
    const q = quiz.q;
    const fb = $('quizFb');
    quiz.tries++;
    if (right) {
      quiz.solved = true;
      quiz.correct = true;
      Sound.right();
      if (button) button.classList.add('right');
      record(q, quiz.tries === 1);
      fb.className = 'fb';
      fb.textContent = `${quiz.tries === 1 ? 'Richtig!' : 'Jetzt stimmt es!'} ${q.e}`;
    } else if (quiz.tries === 1) {
      Sound.wrong();
      if (button) {
        button.classList.add('wrong');
        button.disabled = true;
      }
      fb.className = 'fb retry';
      fb.textContent = q.map ? 'Noch nicht ganz. Schau dir die Umrisse genau an und versuch es noch einmal.' : 'Noch nicht ganz. Überleg noch einmal – du hast einen zweiten Versuch.';
      fb.hidden = false;
      return;
    } else {
      quiz.solved = true;
      Sound.wrong();
      if (button) button.classList.add('wrong');
      record(q, false);
      fb.className = 'fb retry';
      fb.textContent = `Die richtige Antwort: ${q.map ? '' : q.a[0] + '. '}${q.e} Diese Frage kommt bald noch einmal.`;
      if (q.map) drawQuizMap(q.target, null);
    }
    fb.hidden = false;
    for (const b of $('quizOpts').children) {
      b.disabled = true;
      if (b.textContent === q.a[0]) b.classList.add('right');
    }
    $('btnQuizNext').hidden = false;
    $('btnQuizNext').focus({ preventScroll: true });
  }
  // the small tap-map for "find the Bundesland / Nachbarland"
  const QV = { cx: X(13.3), cy: Y(47.75), s: 0.152, w: 640, h: 340, dpr: 1 };
  function drawQuizMap(showRight, showWrong) {
    const cv = $('quizMap');
    const c = cv.getContext('2d');
    drawMap(c, QV, { decor: false, labels: false });
    const paint = (key, col) => {
      const path = statePath[key] || countryPath[key];
      if (!path) return;
      c.fillStyle = col;
      c.fill(path);
      c.strokeStyle = '#2b2924';
      c.lineWidth = 6;
      c.stroke(path);
    };
    if (showWrong) paint(showWrong, 'rgba(180,83,9,0.55)');
    if (showRight) paint(showRight, 'rgba(46,125,79,0.75)');
    if (showRight === 'LI' || quiz.q.target === 'LI') {
      // Liechtenstein is tiny: mark it so it can be found and tapped
      c.strokeStyle = '#2b2924';
      c.lineWidth = 8;
      c.beginPath();
      c.arc(X(9.55), Y(47.15), 60, 0, TAU);
      c.stroke();
    }
  }
  function tapQuizMap(e) {
    const q = quiz.q;
    if (!q || !q.map || quiz.solved) return;
    const cv = $('quizMap');
    const r = cv.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * QV.w;
    const py = ((e.clientY - r.top) / r.height) * QV.h;
    const wx = QV.cx + (px - QV.w / 2) / QV.s;
    const wy = QV.cy + (py - QV.h / 2) / QV.s;
    const lon = LON(wx);
    const lat = LAT(wy);
    let hit = q.map === 'state' ? stateAt(lon, lat) : countryAt(lon, lat);
    if (q.target === 'LI' && Math.hypot(wx - X(9.55), wy - Y(47.15)) < 70) hit = 'LI';
    // Vienna is only a few pixels wide on this map: a tap close to it counts
    if (q.target === 'W' && Math.hypot(wx - X(16.37), wy - Y(48.21)) < 95) hit = 'W';
    if (!hit || (q.map === 'country' && hit === 'AT')) return;
    const right = hit === q.target;
    drawQuizMap(right ? hit : null, right ? null : hit);
    answer(right, null);
  }

  // ------------------------------------------------------------------ building
  let buildKey = null;
  let buildAnim = null;
  function drawBuildArt(count) {
    const cv = $('buildArt');
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#7fb069';
    c.fillRect(0, cv.height - 18, cv.width, 18);
    if (count === undefined || count < blocksOf(buildKey)) {
      c.globalAlpha = 0.16;
      drawArt(c, buildKey, 0, -12, 30);
      c.globalAlpha = 1;
    }
    drawArt(c, buildKey, 0, -12, 30, count === undefined ? 0 : count);
  }
  function openBuild(key) {
    buildKey = key;
    const b = C.BUILDS[key];
    $('buildEyebrow').textContent = `Baustelle in ${b.city}`;
    $('buildTitle').textContent = b.name;
    const need = $('buildNeed');
    need.textContent = '';
    for (const [r, n] of Object.entries(b.need)) {
      const el = document.createElement('span');
      const ok = state.inv[r] >= n;
      el.className = 'slot ' + (ok ? 'ok' : 'miss');
      const i = document.createElement('i');
      i.style.background = C.RES[r].color;
      el.append(i, document.createTextNode(`${C.RES[r].name} ${Math.min(state.inv[r], n)}/${n}`));
      need.appendChild(el);
    }
    const ready = hasAll(key);
    $('buildWhy').textContent = ready ? `${b.why} Beantworte eine Frage, dann geht es los!` : `${b.why} Dir fehlen noch Rohstoffe. Der Kompass zeigt dir, wo du sie findest.`;
    $('btnBuildGo').hidden = !ready;
    $('btnBuildClose').textContent = 'Später';
    $('btnBuildClose').hidden = false;
    drawBuildArt(undefined);
    setMode('build');
  }
  function startBuild() {
    Sound.click();
    const key = buildKey;
    askQuiz({ st: key }, `Baufrage · ${C.STATES[key].name}`, () => {
      const b = C.BUILDS[key];
      for (const [r, n] of Object.entries(b.need)) state.inv[r] -= n;
      renderBag();
      buildKey = key;
      $('buildEyebrow').textContent = `Baustelle in ${b.city}`;
      $('buildTitle').textContent = b.name;
      $('buildNeed').textContent = '';
      $('buildWhy').textContent = 'Block für Block entsteht das Wahrzeichen …';
      $('btnBuildGo').hidden = true;
      $('btnBuildClose').hidden = true;
      setMode('build');
      buildAnim = { key, n: 0, total: blocksOf(key), t: 0 };
    });
  }
  function finishBuild() {
    const key = buildAnim.key;
    buildAnim = null;
    state.built.add(key);
    Sound.fanfare();
    save();
    $('buildWhy').textContent = `Geschafft! ${C.BUILDS[key].name} steht wieder in ${C.BUILDS[key].city}. Das ist Bauwerk ${state.built.size} von ${N_STATES}.`;
    $('btnBuildClose').textContent = 'Weiter';
    $('btnBuildClose').hidden = false;
  }
  function checkEnd() {
    if (state.ended || state.built.size < N_STATES || places.some((p) => p.kind === 'nachbar' && !state.found.has(p.id))) return false;
    state.ended = true;
    save();
    $('statPlaces').textContent = `${state.found.size}/${TOTAL}`;
    $('statQuiz').textContent = `${state.stats.right}/${state.stats.asked}`;
    const s = Math.round(state.time);
    $('statTime').textContent = `${Math.floor(s / 60)} min`;
    Sound.fanfare();
    setMode('end');
    return true;
  }

  // ------------------------------------------------------------------ Forscherheft
  let bookTab = 'laender';
  function renderBook() {
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === bookTab)));
    const body = $('bookBody');
    body.textContent = '';
    const item = (done, title, sub, onClick) => {
      const el = document.createElement(onClick ? 'button' : 'div');
      if (onClick) {
        el.type = 'button';
        el.addEventListener('click', onClick);
      }
      el.className = 'item' + (done ? ' done' : '');
      const b = document.createElement('b');
      b.textContent = title;
      const s = document.createElement('small');
      s.textContent = sub;
      el.append(b, s);
      body.appendChild(el);
      return el;
    };
    if (bookTab === 'laender') {
      for (const k in C.BUILDS) {
        const b = C.BUILDS[k];
        const done = state.built.has(k);
        const el = item(done, C.STATES[k].name, done ? `${b.name} in ${b.city} gebaut` : state.found.has(cityOf[k].id) ? `Hauptstadt ${b.city} – Wahrzeichen fehlt noch` : 'Hauptstadt noch nicht besucht');
        const cv = document.createElement('canvas');
        cv.width = 120;
        cv.height = 140;
        const c = cv.getContext('2d');
        c.globalAlpha = done ? 1 : 0.18;
        drawArt(c, k, 0, 0, 10);
        el.prepend(cv);
      }
    } else if (bookTab === 'nachbarn' || bookTab === 'orte') {
      for (const p of places) {
        if ((bookTab === 'nachbarn') !== (p.kind === 'nachbar') || p.kind === 'stadt') continue;
        const done = state.found.has(p.id);
        const el = item(done, done ? p.title : 'Noch unbekannt', done ? (p.kind === 'nachbar' ? `Hauptstadt: ${C.COUNTRIES[p.c].capital} · im ${C.COUNTRIES[p.c].dir}` : p.facts[0]) : 'Folge dem Fragezeichen auf der Karte.', done ? () => { Sound.click(); afterCard = () => { setMode('book'); renderBook(); }; showCard(p, false); } : null);
        if (done && p.kind === 'nachbar') {
          const cv = document.createElement('canvas');
          cv.width = 120;
          cv.height = 140;
          cv.style.aspectRatio = '3 / 2';
          cv.height = 80;
          drawFlag(cv.getContext('2d'), p.c, 2, 2, 116, 76);
          el.prepend(cv);
        }
      }
    } else {
      for (const a in C.AREAS) {
        const [r, n] = state.stats.area[a] || [0, 0];
        const m = document.createElement('div');
        m.className = 'meter';
        const span = document.createElement('span');
        span.textContent = `${C.AREAS[a]}: ${n ? `${r} von ${n} Fragen beim ersten Versuch gewusst` : 'noch keine Frage'}`;
        const bar = document.createElement('div');
        const i = document.createElement('i');
        i.style.width = `${n ? Math.round((r / n) * 100) : 0}%`;
        bar.appendChild(i);
        m.append(span, bar);
        body.appendChild(m);
      }
      const solid = Object.values(state.boxes).filter((b) => b[0] >= 3).length;
      item(true, `${solid} Fragen sitzen sicher`, 'Fragen, die du mehrmals hintereinander gewusst hast. Die anderen kommen wieder, bis sie sitzen.');
    }
  }

  // ------------------------------------------------------------------ overview map
  function drawOverview() {
    const cv = $('mapCanvas');
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    const s = Math.min(r.width / (X(17.6) - X(9.1)), r.height / (Y(46.1) - Y(49.3)));
    const v = { cx: X(13.35), cy: Y(47.7), s, w: r.width, h: r.height, dpr };
    const c = cv.getContext('2d');
    drawMap(c, v, { decor: false, labels: true, big: true });
    const k = clamp(0.5 / s, 1, 5);
    for (const p of places) drawPlaceMarker(c, p, 0, k);
    c.fillStyle = '#f2b21b';
    c.strokeStyle = '#2b2924';
    c.lineWidth = 2.5 * k;
    c.beginPath();
    c.arc(state.x, state.y, 8 * k, 0, TAU);
    c.fill();
    c.stroke();
  }

  // ------------------------------------------------------------------ simulation
  const input = { active: false, id: null, sx: 0, sy: 0, keys: {} };
  function update(dt) {
    state.time += dt;
    let dx = 0;
    let dy = 0;
    if (input.active) {
      const wx = cam.x + (input.sx - W / 2) / SCALE;
      const wy = cam.y + (input.sy - H / 2) / SCALE;
      dx = wx - state.x;
      dy = wy - state.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) dx = dy = 0;
      else {
        dx /= d;
        dy /= d;
      }
    }
    const kx = (input.keys.right ? 1 : 0) - (input.keys.left ? 1 : 0);
    const ky = (input.keys.down ? 1 : 0) - (input.keys.up ? 1 : 0);
    if (kx || ky) {
      const d = Math.hypot(kx, ky);
      dx = kx / d;
      dy = ky / d;
    }
    player.moving = !!(dx || dy);
    if (player.moving) {
      const SPEED = 130;
      state.x = clamp(state.x + dx * SPEED * dt, 20, WORLD.w - 20);
      state.y = clamp(state.y + dy * SPEED * dt, 20, WORLD.h - 20);
      if (Math.abs(dx) > 0.15) player.face = dx > 0 ? 1 : -1;
      player.walk += dt * 12;
      gather = null;
      if (!state.hinted) {
        state.hinted = true;
        $('hint').hidden = true;
      }
    }
    const hw = W / (2 * SCALE);
    const hh = H / (2 * SCALE);
    cam.x = clamp(lerp(cam.x, state.x, 1 - Math.exp(-6 * dt)), Math.min(hw, WORLD.w / 2), Math.max(WORLD.w - hw, WORLD.w / 2));
    cam.y = clamp(lerp(cam.y, state.y, 1 - Math.exp(-6 * dt)), Math.min(hh, WORLD.h / 2), Math.max(WORLD.h - hh, WORLD.h / 2));
    // discoveries
    for (const p of places) {
      if (!state.found.has(p.id) && dist(p, state) < 26) {
        discover(p);
        return;
      }
    }
    // what is next to the player?
    near = null;
    let best = 34;
    for (const n of nodes) {
      const d = dist(n, state);
      if (d < best) {
        best = d;
        near = { type: 'node', ref: n };
      }
    }
    for (const k in cityOf) {
      const d = dist(cityOf[k], state);
      if (d < Math.min(best, 40) && !state.built.has(k)) {
        best = d;
        near = { type: 'city', ref: cityOf[k] };
      }
    }
    if (gather) {
      if (!near || near.ref !== gather.node) gather = null;
      else {
        gather.t += dt;
        if (Math.floor(gather.t * 6) !== Math.floor((gather.t - dt) * 6)) Sound.hit();
        if (gather.t >= 1.2) {
          const n = gather.node;
          gather = null;
          n.ready = state.time + 40;
          state.inv[n.res] += 2;
          Sound.pick();
          bump(n.res);
          if (!state.seenRes[n.res]) {
            state.seenRes[n.res] = 1;
            toast(`+2 ${C.RES[n.res].name} aus: ${n.name}. ${C.RES[n.res].fact}`, 6);
          } else toast(`+2 ${C.RES[n.res].name} aus: ${n.name}`, 2.2);
          save();
        }
      }
    }
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) $('toast').hidden = true;
    }
  }
  let slow = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
    frame.last = now;
    const t = now / 1000;
    if (state.mode === 'play') {
      update(dt);
      if (state.mode === 'play') {
        slow += dt;
        if (slow > 0.25) {
          slow = 0;
          updateQuest();
          updateWhere();
        }
        updateHud();
        drawCompass();
      }
    } else if (state.mode === 'title') {
      cam.x = X(13.4) + Math.sin(t * 0.08) * 900;
      cam.y = Y(47.7) + Math.cos(t * 0.11) * 160;
    }
    if (buildAnim && state.mode === 'build') {
      buildAnim.t += dt;
      while (buildAnim && buildAnim.t > 0.035) {
        buildAnim.t -= 0.035;
        buildAnim.n++;
        if (buildAnim.n % 2 === 0) Sound.block();
        drawBuildArt(buildAnim.n);
        if (buildAnim.n >= buildAnim.total) finishBuild();
      }
    }
    if (state.mode !== 'map') render(t);
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ input wiring
  canvas.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'play' || (input.active && e.pointerId !== input.id)) return;
    e.preventDefault();
    Sound.init();
    input.active = true;
    input.id = e.pointerId;
    input.sx = e.clientX;
    input.sy = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* best effort */ }
  }, { passive: false });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.active || e.pointerId !== input.id) return;
    e.preventDefault();
    input.sx = e.clientX;
    input.sy = e.clientY;
  }, { passive: false });
  const release = (e) => { if (e.pointerId === input.id) input.active = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  const KEYS = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
  window.addEventListener('keydown', (e) => {
    const k = KEYS[e.key] || KEYS[e.key.toLowerCase()];
    if (k && state.mode === 'play') {
      input.keys[k] = true;
      e.preventDefault();
    } else if (e.key === ' ' && state.mode === 'play' && near) {
      e.preventDefault();
      if (near.type === 'node') startGather();
      else actClick();
    } else if (e.key === 'Escape') {
      if (state.mode === 'play') setMode('pause');
      else if (state.mode === 'pause' || state.mode === 'book' || state.mode === 'map') setMode('play');
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYS[e.key] || KEYS[e.key.toLowerCase()];
    if (k) input.keys[k] = false;
    if (e.key === ' ') gather = null;
  });
  window.addEventListener('blur', () => {
    input.keys = {};
    input.active = false;
  });

  function startGather() {
    if (state.mode !== 'play' || !near || near.type !== 'node' || near.ref.ready > state.time) return;
    Sound.init();
    gather = { node: near.ref, t: 0 };
  }
  function actClick() {
    if (state.mode !== 'play' || !near || near.type !== 'city') return;
    Sound.click();
    openBuild(near.ref.st);
  }
  const act = $('btnAct');
  act.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (near && near.type === 'node') startGather();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) act.addEventListener(ev, () => { gather = null; });
  act.addEventListener('click', actClick);
  act.addEventListener('contextmenu', (e) => e.preventDefault());

  const on = (id, fn) => $(id).addEventListener('click', (e) => {
    e.preventDefault();
    fn(e);
  });
  function setLevel(lv) {
    state.level = lv;
    document.querySelectorAll('.seg').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.level) === lv)));
  }
  document.querySelectorAll('.seg').forEach((b) => b.addEventListener('click', () => {
    Sound.click();
    setLevel(Number(b.dataset.level));
    save();
  }));
  const INTRO = [
    'Servus! Ich bin Muri, das Murmeltier. Ich begleite dich auf deiner Reise durch ganz Österreich.',
    'Österreich hat neun Bundesländer. Jedes hat eine Landeshauptstadt – und überall fehlt das Wahrzeichen!',
    'Sammle Rohstoffe dort, wo es sie wirklich gibt: Holz im Wald, Stein im Steinbruch, Salz im Bergwerk. Damit baust du die Wahrzeichen wieder auf.',
    'Der Kompass oben zeigt dir immer den Weg. Wir starten bei Wien, der Hauptstadt. Los geht’s!',
  ];
  on('btnStart', () => {
    Sound.init();
    Sound.click();
    const lv = state.level;
    reset();
    state.level = lv;
    renderBag();
    say(INTRO, () => {
      $('hint').hidden = false;
      save();
    });
  });
  on('btnContinue', () => {
    Sound.init();
    Sound.click();
    const d = load();
    if (d) apply(d);
    cam.x = state.x;
    cam.y = state.y;
    setLevel(state.level);
    renderBag();
    say([`Willkommen zurück! ${state.built.size} von ${N_STATES} Wahrzeichen stehen schon. Weiter geht die Reise!`]);
  });
  on('btnTalkNext', talkNext);
  on('btnTalkSpeak', () => Reader.toggle($('btnTalkSpeak'), talk.lines[talk.i]));
  on('btnCardSpeak', () => Reader.toggle($('btnCardSpeak'), `${$('cardTitle').textContent}. ${[...$('cardFacts').children].map((li) => li.textContent).join(' ')}`));
  on('btnQuizSpeak', () => Reader.toggle($('btnQuizSpeak'), `${quiz.q.q} ${quiz.q.map ? '' : quiz.opts.join('. Oder: ')}`));
  on('btnCardClose', () => {
    Sound.click();
    const f = afterCard;
    afterCard = null;
    setMode('play');
    if (f) f();
  });
  on('btnQuizNext', () => {
    Sound.click();
    const done = quiz.done;
    const right = quiz.correct;
    quiz.done = null;
    setMode('play');
    if (done && right) done();
  });
  $('quizMap').addEventListener('click', tapQuizMap);
  on('btnBuildGo', startBuild);
  on('btnBuildClose', () => {
    Sound.click();
    setMode('play');
    checkEnd();
  });
  on('btnBook', () => {
    Sound.click();
    setMode('book');
    renderBook();
  });
  on('btnBookClose', () => {
    Sound.click();
    setMode('play');
  });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    Sound.click();
    bookTab = t.dataset.tab;
    renderBook();
  }));
  on('btnMap', () => {
    Sound.click();
    setMode('map');
    drawOverview();
  });
  on('btnMapClose', () => {
    Sound.click();
    setMode('play');
  });
  on('btnPause', () => {
    Sound.click();
    save();
    setMode('pause');
  });
  on('btnResume', () => {
    Sound.click();
    setMode('play');
  });
  on('btnRestart', () => {
    Sound.click();
    setMode('confirm');
  });
  on('btnConfirmNo', () => {
    Sound.click();
    setMode('pause');
  });
  on('btnConfirmYes', () => {
    Sound.click();
    const lv = state.level;
    reset();
    state.level = lv;
    renderBag();
    say(INTRO, () => { $('hint').hidden = false; });
  });
  on('btnEndGo', () => {
    Sound.click();
    setMode('play');
  });
  on('btnSound', () => {
    state.muted = !state.muted;
    Sound.init();
    Sound.mute(state.muted);
    $('btnSound').setAttribute('aria-pressed', String(!state.muted));
    $('btnSound').setAttribute('aria-label', state.muted ? 'Ton einschalten' : 'Ton ausschalten');
    save();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'play') {
      save();
      setMode('pause');
    }
  });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));

  // ------------------------------------------------------------------ boot
  document.querySelectorAll('canvas.muri').forEach(drawMuri);
  resize();
  renderBag();
  const saved = load();
  if (saved && ((saved.found || []).length || Object.values(saved.inv || {}).some(Boolean))) {
    $('btnContinue').hidden = false;
    $('btnContinue').textContent = `Weiterspielen (${(saved.built || []).length}/${N_STATES} Wahrzeichen)`;
    $('btnStart').textContent = 'Neue Expedition';
    $('btnStart').classList.remove('primary');
    setLevel(clamp(Number(saved.level) || 2, 1, 3));
  }
  setMode('title');
  requestAnimationFrame(frame);

  // Read-only hook for the automated smoke test (no personal data).
  window.__oe = {
    version: VERSION,
    get mode() { return state.mode; },
    get pos() { return { x: state.x, y: state.y }; },
    get inv() { return { ...state.inv }; },
    get found() { return [...state.found]; },
    get built() { return [...state.built]; },
    get near() { return near ? { type: near.type, id: near.type === 'node' ? near.ref.i : near.ref.st } : null; },
    get quiz() { return quiz.q ? { id: quiz.q.id, map: quiz.q.map || null, target: quiz.q.target || null, right: quiz.q.a ? quiz.q.a[0] : null, solved: quiz.solved } : null; },
    get quest() { return quest.text; },
    places: places.map((p) => ({ id: p.id, kind: p.kind, st: p.st || null, c: p.c || null, x: p.x, y: p.y, lon: p.lon, lat: p.lat })),
    nodes: nodes.map((n) => ({ i: n.i, res: n.res, x: n.x, y: n.y, lon: LON(n.x), lat: LAT(n.y) })),
    builds: Object.fromEntries(Object.entries(C.BUILDS).map(([k, b]) => [k, b.need])),
    questions: () => allQuestions().map((q) => ({ id: q.id, lv: q.lv, area: q.area, n: q.a ? q.a.length : 0, map: q.map || null, uniq: q.a ? new Set(q.a).size : 0 })),
    stateAt, countryAt,
    teleport(x, y) { state.x = x; state.y = y; cam.x = x; cam.y = y; },
    give(res, n) { state.inv[res] += n; renderBag(); },
    quizPoint(key) { // screen point inside a state/country on the quiz map, for tap tests
      const rings = M.states[key] || M.countries[key];
      const r = $('quizMap').getBoundingClientRect();
      const C0 = key === 'LI' ? [9.55, 47.15] : (C.STATES[key] && key !== 'T' ? C.STATES[key].label : null);
      let lon; let lat;
      if (C0 && (key === 'LI' || inRings(rings, C0[0], C0[1]))) [lon, lat] = C0;
      else {
        const ring = rings.reduce((a, b) => (b.length > a.length ? b : a));
        const xs = ring.map((q) => q[0]); const ys = ring.map((q) => q[1]);
        const x0 = Math.max(Math.min(...xs), 9); const x1 = Math.min(Math.max(...xs), 17.5); const y0 = Math.max(Math.min(...ys), 46); const y1 = Math.min(Math.max(...ys), 49.4);
        for (let i = 0; i < 4000; i++) { lon = x0 + Math.random() * (x1 - x0); lat = y0 + Math.random() * (y1 - y0); if (inRings(rings, lon, lat) && (key === 'AT' || !stateAt(lon, lat) || M.states[key])) break; }
      }
      const px = QV.w / 2 + (X(lon) - QV.cx) * QV.s; const py = QV.h / 2 + (Y(lat) - QV.cy) * QV.s;
      return { x: r.left + (px / QV.w) * r.width, y: r.top + (py / QV.h) * r.height };
    },
  };
})();
