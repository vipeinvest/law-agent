/* Zeitreise: die gemalten Szenen der Erdgeschichte am Bodensee samt Tieren und Menschen.
 * Jede Szene hat back(c, w, h, t) und creatures. Figuren: Nullpunkt = Mitte am Boden, Blick nach rechts, Bildhöhe entspricht 640 Welt-Einheiten.
 * Das Unbewegte eines Hintergrunds wird einmal in ein eigenes Canvas gemalt, pro Bild kommen nur wenige bewegte Teile dazu.
 */
(() => {
  'use strict';
  const { TAU, hexToRgb, shade, rngOf, wave, rr, box, poly, ell, line, grad, eye, cloud, tree, reed, flower, bird, sailboat } = BE.art;
  const { sin, cos, abs, PI, pow, min, max } = Math;

  // ------------------------------------------------------------------ tools
  const rgba = (hex, a) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };
  const wrap = (v, m) => ((v % m) + m) % m;
  // A leg's swing. Stands still when walk is exactly 0, as kid() does.
  const gait = (walk, ph, amp) => (walk ? sin(walk + ph) * amp : 0);
  const stepBob = (walk, amp) => (walk ? abs(cos(walk)) * amp : 0);

  // Keeps the current and the previous scene only, a phone holds no more than that.
  const stages = new Map();
  function stage(c, w, h, key, paint) {
    const q = min(2, max(1, c.getTransform ? abs(c.getTransform().a) : 1));
    const id = `${key}|${w}|${h}|${q}`;
    let off = stages.get(id);
    if (off) {
      stages.delete(id);
    } else {
      off = document.createElement('canvas');
      off.width = Math.ceil(w * q);
      off.height = Math.ceil(h * q);
      const g = off.getContext('2d');
      g.scale(q, q);
      paint(g, w, h, h / 640);
      while (stages.size >= 2) stages.delete(stages.keys().next().value);
    }
    stages.set(id, off);
    c.drawImage(off, 0, 0, w, h);
  }

  // Smooth closed shape through the midpoints of a control polygon.
  function blob(c, pts, col) {
    const n = pts.length;
    c.beginPath();
    c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    c.closePath();
    if (col) {
      c.fillStyle = col;
      c.fill();
    }
  }

  // A soft limb along [x, y, radius] points: tails, necks, trunks, rivers.
  const TL = new Float64Array(512);
  const TR = new Float64Array(512);
  function tube(c, P, col) {
    const n = P.length;
    const SUB = 6;
    let m = 0;
    let t0 = 0;
    let t1 = 0;
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[i > 0 ? i - 1 : 0];
      const p1 = P[i];
      const p2 = P[i + 1];
      const p3 = P[i + 2 < n ? i + 2 : n - 1];
      const last = i === n - 2 ? SUB + 1 : SUB;
      const ax = 2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0];
      const ay = 2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1];
      const bx = -p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0];
      const by = -p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1];
      const cx = p2[0] - p0[0];
      const cy = p2[1] - p0[1];
      for (let s = 0; s < last; s++) {
        const u = s / SUB;
        const x = p1[0] + 0.5 * (cx * u + ax * u * u + bx * u * u * u);
        const y = p1[1] + 0.5 * (cy * u + ay * u * u + by * u * u * u);
        const r = p1[2] + (p2[2] - p1[2]) * u;
        const dx = cx + 2 * ax * u + 3 * bx * u * u;
        const dy = cy + 2 * ay * u + 3 * by * u * u;
        const d = Math.hypot(dx, dy) || 1;
        if (m === 0) t0 = Math.atan2(dy, dx);
        t1 = Math.atan2(dy, dx);
        TL[m * 2] = x - (dy / d) * r;
        TL[m * 2 + 1] = y + (dx / d) * r;
        TR[m * 2] = x + (dy / d) * r;
        TR[m * 2 + 1] = y - (dx / d) * r;
        m++;
      }
    }
    const a = P[0];
    const b = P[n - 1];
    c.beginPath();
    c.moveTo(TL[0], TL[1]);
    for (let i = 1; i < m; i++) c.lineTo(TL[i * 2], TL[i * 2 + 1]);
    c.arc(b[0], b[1], Math.max(0.01, b[2]), t1 + PI / 2, t1 - PI / 2, true);
    for (let i = m - 1; i >= 0; i--) c.lineTo(TR[i * 2], TR[i * 2 + 1]);
    c.arc(a[0], a[1], Math.max(0.01, a[2]), t0 - PI / 2, t0 - 1.5 * PI, true);
    c.closePath();
    if (col) {
      c.fillStyle = col;
      c.fill();
    }
  }

  // Many small circles as one drawing call.
  function dots(c, list, col) {
    c.beginPath();
    for (const d of list) {
      c.moveTo(d[0] + d[2], d[1]);
      c.arc(d[0], d[1], d[2], 0, TAU);
    }
    c.fillStyle = col;
    c.fill();
  }
  function curve(c, x0, y0, cx, cy, x1, y1, col, w) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo(cx, cy, x1, y1);
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.stroke();
  }
  function blinkEye(c, x, y, r, t, seed, lid) {
    eye(c, x, y, r);
    if (wrap(t + seed, 4.7) < 0.14) {
      ell(c, x, y, r * 1.08, r * 1.08, lid);
      curve(c, x - r * 0.8, y + r * 0.1, x, y + r * 0.5, x + r * 0.8, y + r * 0.1, 'rgba(30,20,10,0.6)', max(1, r * 0.24));
    }
  }
  function shadow(c, x, rx, ry, a) {
    ell(c, x, 0.5, rx, ry, `rgba(30,20,10,${a === undefined ? 0.18 : a})`);
  }
  // Pillar leg with a soft foot. Hip at x,y; foot about len below.
  function stump(c, x, y, len, w0, w1, a, col, foot) {
    const fx = x + sin(a) * len;
    const fy = y + cos(a) * len;
    tube(c, [[x, y, w0], [x + (fx - x) * 0.5 + 1, y + (fy - y) * 0.55, (w0 + w1) * 0.5], [fx, fy - w1 * 0.4, w1]], col);
    if (foot) ell(c, fx + w1 * 0.15, fy - w1 * 0.26, w1 * 1.12, w1 * 0.5, foot);
  }
  // Slim leg with a knee and a hoof, for horses, deer, foxes and cows.
  function shank(c, x, y, l1, l2, w0, w1, a, bend, col, hoof, sock) {
    const kx = x + sin(a) * l1;
    const ky = y + cos(a) * l1;
    const fx = kx + sin(a + bend) * l2;
    const fy = ky + cos(a + bend) * l2;
    tube(c, [[x, y, w0], [kx, ky, (w0 + w1) * 0.5], [fx, fy, w1]], col);
    if (sock) tube(c, [[kx, ky, (w0 + w1) * 0.5], [fx, fy, w1]], sock);
    if (hoof) box(c, fx - w1 * 1.1, fy - 1, w1 * 2.4, w1 * 1.4, hoof, 1.5);
  }
  // Shaggy hanging edge of a wool coat, as one polygon.
  function fringe(c, x0, y0, x1, y1, n, len, col, t) {
    c.beginPath();
    c.moveTo(x0, y0 - 6);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u;
      const ln = len * (0.75 + 0.25 * sin(i * 2.7));
      c.lineTo(x - 2.5, y);
      c.lineTo(x + sin(t * 1.2 + i) * 1.2, y + ln);
    }
    c.lineTo(x1, y1 - 6);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
  // Bent wool strokes, one drawing call.
  function strands(c, list, col, w) {
    c.beginPath();
    for (const s of list) {
      c.moveTo(s[0], s[1]);
      c.quadraticCurveTo(s[0] + s[2] * 0.2, s[1] + s[3] * 0.6, s[0] + s[2], s[1] + s[3]);
    }
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.stroke();
  }

  // ------------------------------------------------------------------ landscape parts
  function glow(g, x, y, r, col, a) {
    const q = g.createRadialGradient(x, y, 0, x, y, r);
    q.addColorStop(0, rgba(col, a));
    q.addColorStop(1, rgba(col, 0));
    g.fillStyle = q;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function fillV(g, x, y, w, h, stops) {
    g.fillStyle = grad(g, 0, y, 0, y + h, stops);
    g.fillRect(x, y, w, h);
  }
  function rolling(g, w, base, amp, freq, seed, col, bottom) {
    g.beginPath();
    g.moveTo(0, bottom);
    for (let x = 0; x <= w + 12; x += 12) g.lineTo(x, base - amp * (0.5 + 0.5 * wave(x * freq + seed)));
    g.lineTo(w, bottom);
    g.closePath();
    g.fillStyle = col;
    g.fill();
  }
  // Real mountain tops with lit and shaded faces and jagged snow caps.
  function peaks(g, w, base, amp, gap, seed, col, snow) {
    const r = rngOf(seed);
    let x = -gap * r();
    while (x < w + gap) {
      const ht = amp * (0.55 + r() * 0.45);
      const bw = ht * (0.9 + r() * 0.5);
      const tx = x + (r() - 0.5) * bw * 0.25;
      const ty = base - ht;
      poly(g, [[x - bw, base + 2], [tx, ty], [x + bw, base + 2]], col);
      poly(g, [[tx, ty], [x + bw, base + 2], [x + bw * 0.1, base + 2]], 'rgba(30,50,80,0.13)');
      if (snow) {
        const k = snow * (0.7 + r() * 0.5);
        const sh = ht * k;
        const y2 = ty + sh;
        const dx = k * bw;
        poly(g, [[tx, ty], [tx + dx, y2], [tx + dx * 0.5, y2 - sh * 0.2], [tx + dx * 0.15, y2 + sh * 0.14], [tx - dx * 0.25, y2 - sh * 0.18], [tx - dx * 0.6, y2 + sh * 0.06], [tx - dx, y2]], '#fbfdff');
      }
      x += gap * (0.7 + r() * 0.6);
    }
  }
  function cycad(g, x, y, s, col) {
    tube(g, [[x, y, s * 0.11], [x, y - s * 0.35, s * 0.09]], '#8a6c49');
    for (let i = 0; i < 7; i++) {
      const a = -PI + (i / 6) * PI;
      const ex = x + cos(a) * s * 0.92;
      const ey = y - s * 0.38 + sin(a) * s * 0.62 + s * 0.2;
      tube(g, [[x, y - s * 0.38, s * 0.03], [x + cos(a) * s * 0.5, y - s * 0.38 + sin(a) * s * 0.6, s * 0.09], [ex, ey, 0.4]], i % 2 ? col : shade(col, 0.14));
    }
  }
  function arauc(g, x, y, h, trunk, leaf) {
    tube(g, [[x, y, h * 0.024], [x + h * 0.01, y - h * 0.5, h * 0.016], [x, y - h * 0.92, h * 0.008]], trunk);
    for (let i = 0; i < 4; i++) {
      const k = i / 3;
      ell(g, x, y - h * (0.6 + 0.34 * k), h * (0.31 - 0.18 * k), h * (0.085 - 0.012 * k), i % 2 ? leaf : shade(leaf, 0.12));
    }
  }
  function fern(c, x, y, s, col, t, seed) {
    const sw = t ? sin(t * 1.1 + seed) * s * 0.05 : 0;
    for (let i = 0; i < 5; i++) {
      const a = -2.65 + i * 0.53;
      const L = s * (0.78 + 0.22 * sin(i * 2.1 + seed));
      const ex = x + cos(a) * L + sw;
      const ey = y + sin(a) * L * 0.82;
      tube(c, [[x, y, s * 0.015], [(x + ex) / 2 + cos(a) * s * 0.03, (y + ey) / 2 - s * 0.1, s * 0.062], [ex, ey + s * 0.1, 0.4]], i % 2 ? col : shade(col, 0.12));
    }
  }
  function palm(c, x, y, h, lean, t, seed, leaf) {
    const sw = t ? sin(t * 0.8 + seed) * h * 0.014 : 0;
    const cx = x + lean + sw;
    const cy = y - h;
    const col = leaf || '#3f8f52';
    tube(c, [[x, y, h * 0.04], [x + lean * 0.35, y - h * 0.5, h * 0.028], [cx, cy, h * 0.022]], '#8a6c49');
    for (let i = 0; i < 7; i++) {
      const a = -PI + (i / 6) * PI;
      const L = h * (0.42 + 0.08 * sin(i * 3.1 + seed));
      const ex = cx + cos(a) * L + sw * 2;
      const ey = cy + sin(a) * L * 0.5 + L * 0.42;
      tube(c, [[cx, cy, h * 0.012], [cx + cos(a) * L * 0.55, cy + sin(a) * L * 0.62, h * 0.036], [ex, ey, 0.5]], i % 2 ? col : shade(col, 0.14));
    }
  }
  // Round tree crown for laurel and cinnamon trees.
  function laurel(g, x, y, h, leaf, tip, seed) {
    const r = rngOf(seed);
    tube(g, [[x, y, h * 0.04], [x + h * 0.01, y - h * 0.45, h * 0.028]], '#6a4f36');
    const dark = shade(leaf, -0.18);
    ell(g, x, y - h * 0.62, h * 0.34, h * 0.32, dark);
    for (let i = 0; i < 6; i++) ell(g, x + (r() - 0.5) * h * 0.5, y - h * (0.5 + r() * 0.42), h * (0.13 + r() * 0.08), h * (0.1 + r() * 0.06), i % 2 ? leaf : shade(leaf, 0.1));
    if (tip) for (let i = 0; i < 12; i++) ell(g, x + (r() - 0.5) * h * 0.56, y - h * (0.46 + r() * 0.46), h * 0.04, h * 0.012, tip, r() * 3);
  }
  // Light dashes on water; longer towards the viewer. One drawing call.
  function glitter(c, w, y0, y1, t, n, seed, col, len) {
    const r = rngOf(seed);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const k = r();
      const y = y0 + (y1 - y0) * k * k;
      const ph = r() * TAU;
      const x = wrap(r() * w + sin(t * 0.25 + ph) * 16, w);
      const l = len * (0.35 + k) * (0.6 + 0.4 * sin(t * 0.9 + ph));
      c.moveTo(x - l, y);
      c.lineTo(x + l, y);
    }
    c.strokeStyle = col;
    c.lineWidth = 1.5;
    c.lineCap = 'round';
    c.stroke();
  }
  // The moving rim where the water meets the air.
  function surface(c, w, y0, t, amp, col, band) {
    c.beginPath();
    c.moveTo(0, y0 + band);
    for (let x = 0; x <= w + 24; x += 24) c.lineTo(x, y0 + wave(x * 0.018 + t * 0.55) * amp);
    c.lineTo(w, y0 + band);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
  function driftX(t, speed, w, phase) {
    const span = w + 240;
    return wrap(phase * span + t * speed, span) - 120;
  }
  function plankton(c, w, y0, y1, t, n, seed, col) {
    const r = rngOf(seed);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = r() * w + sin(t * 0.3 + i) * 8;
      const span = y1 - y0;
      const y = y0 + wrap(r() * span - t * (2 + r() * 3), span);
      const rad = 0.8 + r() * 1.3;
      c.moveTo(x + rad, y);
      c.arc(x, y, rad, 0, TAU);
    }
    c.fillStyle = col;
    c.fill();
  }
  // A small shoal crossing slowly; every fish goes into the same path.
  function shoal(c, x, y, s, n, t, col, seed, dir) {
    const r = rngOf(seed);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const fx = x + (r() - 0.5) * 80 * s + sin(t * 0.7 + i) * 4 * s;
      const fy = y + (r() - 0.5) * 42 * s + cos(t * 0.9 + i * 2) * 3 * s;
      const l = 7 * s;
      c.moveTo(fx + dir * l, fy);
      c.quadraticCurveTo(fx, fy - l * 0.5, fx - dir * l * 0.8, fy);
      c.lineTo(fx - dir * l * 1.35, fy - l * 0.32);
      c.lineTo(fx - dir * l * 1.35, fy + l * 0.32);
      c.lineTo(fx - dir * l * 0.8, fy);
      c.quadraticCurveTo(fx, fy + l * 0.5, fx + dir * l, fy);
    }
    c.fillStyle = col;
    c.fill();
  }
  function rays(g, w, y0, h, n, seed) {
    const r = rngOf(seed);
    for (let i = 0; i < n; i++) {
      const x = w * ((i + 0.2 + r() * 0.6) / n);
      const top = w * 0.018 + r() * w * 0.02;
      const lean = (r() - 0.35) * h * 0.2;
      g.fillStyle = grad(g, 0, y0, 0, y0 + h * 0.62, ['rgba(255,255,240,0.2)', 'rgba(255,255,240,0)']);
      poly(g, [[x - top, y0], [x + top, y0], [x + lean + top * 3.2, y0 + h * 0.62], [x + lean - top * 3.2, y0 + h * 0.62]]);
      g.fill();
    }
  }

  // ------------------------------------------------------------------ figures helper
  const fig = (x, y, s, w, h, roam, draw) => ({
    x, y, s, w, h, roam,
    draw(c, t, walk) {
      c.save();
      draw(c, t, walk);
      c.restore();
    },
  });

  // ================================================================== TRIAS
  const riverAt = (u, w, h) => {
    const hz = h * 0.45;
    return [w * (0.38 - 0.2 * u) + sin(u * 6.2) * w * (0.03 + 0.1 * u), hz + (h * 1.03 - hz) * pow(u, 1.5), h * (0.004 + 0.08 * u * u)];
  };
  function paintTrias(g, w, h, u) {
    const hz = h * 0.45;
    fillV(g, 0, 0, w, hz + 2, [[0, '#6fc3de'], [0.5, '#c7e6d4'], [0.8, '#f8e6b4'], [1, '#f8cd93']]);
    glow(g, w * 0.78, h * 0.16, 170 * u, '#fff4bb', 0.9);
    ell(g, w * 0.78, h * 0.16, 27 * u, 27 * u, '#fffbe0');
    // far table hills in the haze
    for (const [x, a, b, col] of [[0.1, 60, 26, '#e3b896'], [0.46, 90, 18, '#e8c3a0'], [0.9, 80, 32, '#deb08c']]) {
      blob(g, [[w * x - a * u * 1.6, hz + 3], [w * x - a * u, hz - b * u], [w * x + a * u, hz - b * u * 1.05], [w * x + a * u * 1.6, hz + 3]], col);
    }
    for (const x of [0.2, 0.26, 0.33, 0.68, 0.74, 0.8]) arauc(g, w * x, hz + 3, (46 + 22 * sin(x * 40)) * u, '#b49a72', '#a9ab7a');
    fillV(g, 0, hz, w, h - hz, [[0, '#e3b97e'], [0.3, '#d29656'], [0.7, '#b6773f'], [1, '#95592f']]);
    rolling(g, w, h * 0.56, 14 * u, 0.006, 2, 'rgba(240,195,130,0.35)', h * 0.62);
    // river: green banks first, then water, with sand bars
    const pts = [];
    const bank = [];
    for (let i = 0; i <= 7; i++) {
      const p = riverAt(i / 7, w, h);
      pts.push(p);
      bank.push([p[0], p[1], p[2] * 1.45 + 3 * u]);
    }
    tube(g, bank, '#8ea653');
    g.fillStyle = grad(g, 0, hz, 0, h, ['#b9ece2', '#59bcb9', '#2b93a4']);
    tube(g, pts);
    g.fill();
    for (const k of [0.45, 0.72]) {
      const p = riverAt(k, w, h);
      ell(g, p[0] + p[2] * 0.2, p[1], p[2] * 0.42, p[2] * 0.14, '#ecd29a');
    }
    // low dunes where the river comes out of the haze
    ell(g, w * 0.38, hz + 5 * u, 84 * u, 9 * u, '#e6bf86');
    ell(g, w * 0.46, hz + 8 * u, 60 * u, 7 * u, '#deb077');
    // a side channel on the right
    tube(g, [[w * 1.05, h * 0.5, 2 * u], [w * 0.8, h * 0.53, 5 * u], [w * 0.74, h * 0.6, 8 * u], [w * 0.92, h * 0.68, 12 * u], [w * 1.08, h * 0.72, 18 * u]], '#66c0bc');
    // scattered green and stones
    const r = rngOf(21);
    for (let i = 0; i < 26; i++) {
      const k = r();
      const y = hz + (h - hz) * (0.08 + k * 0.9);
      const x = r() * w;
      const s = (8 + 22 * k) * u;
      ell(g, x, y, s, s * 0.34, i % 3 ? 'rgba(122,146,70,0.75)' : 'rgba(150,100,60,0.5)');
    }
    arauc(g, w * 0.93, h * 0.6, 190 * u, '#7a5a3c', '#55794a');
    arauc(g, w * 0.04, h * 0.64, 230 * u, '#6e5035', '#4e7546');
    arauc(g, w * 0.84, h * 0.52, 95 * u, '#8e7350', '#70905a');
    fern(g, w * 0.11, h * 0.72, 70 * u, '#5d8a45', 0, 3);
    fern(g, w * 0.62, h * 0.58, 34 * u, '#6f9650', 0, 5);
    fern(g, w * 0.97, h * 0.76, 66 * u, '#4f7d40', 0, 8);
    // near ground
    rolling(g, w, h * 0.95, 26 * u, 0.008, 7, '#7c4c2a', h);
  }
  function backTrias(c, w, h, t) {
    stage(c, w, h, 'trias', paintTrias);
    const u = h / 640;
    cloud(c, driftX(t, 3, w, 0.15), h * 0.13, 0.75 * u, 0.5);
    cloud(c, driftX(t, 2, w, 0.62), h * 0.23, 0.5 * u, 0.42);
    // light gliding down the river
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const p = riverAt(wrap(i / 12 + t * 0.012, 1), w, h);
      const off = sin(i * 2.4) * p[2] * 0.6;
      const l = p[2] * 0.2 + 1.5 * u;
      c.moveTo(p[0] + off - l, p[1]);
      c.lineTo(p[0] + off + l, p[1]);
    }
    c.strokeStyle = 'rgba(255,255,255,0.65)';
    c.lineWidth = 1.5 * u;
    c.lineCap = 'round';
    c.stroke();
    fern(c, w * 0.03, h * 0.98, 92 * u, '#3f6f38', t, 2);
    fern(c, w * 0.98, h * 0.97, 104 * u, '#44763b', t, 6);
  }
  function plateoLeg(c, x, y, a, col, claw) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    tube(c, [[0, 0, 18], [7, 30, 12], [-4, 58, 7], [2, 80, 5.5]], col);
    blob(c, [[-4, 77], [10, 76], [22, 82], [22, 86], [-4, 86]], col);
    dots(c, [[21, 84, 2], [14, 85, 1.8], [7, 85, 1.8]], claw);
    c.restore();
  }
  function plateoArm(c, x, y, a, col, claw) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    tube(c, [[0, 0, 8], [11, 17, 5], [23, 22, 3.6]], col);
    line(c, [[24, 22], [31, 20], [34, 14]], claw, 2.6);
    line(c, [[25, 23], [31, 27]], col, 2.6);
    c.restore();
  }
  // Plateosaurus: small head, very long neck, bulky body, walks on its hind legs with free hands and a big thumb claw.
  function plateo(c, t, walk, o) {
    const s = o.seed;
    const bob = stepBob(walk, 2);
    const nk = sin(t * 0.7 + s) * 3;
    const nod = sin(t * 1.1 + s) * 1.5;
    const tw = sin(t * 0.9 + s) * 5;
    const n = o.neck;
    const claw = '#d8c8a0';
    shadow(c, -8, 104, 7);
    plateoLeg(c, -14, -85 - bob, gait(walk, PI, 0.42), o.dark, claw);
    plateoArm(c, 32, -88 - bob, -0.2 + gait(walk, 0.5, 0.2), o.dark, claw);
    const hx = 22 + 70 * n + nk;
    const hy = -98 - 62 * n + nod - bob;
    const spine = [[-132, -48 + tw, 1.2], [-102, -64 + tw * 0.6, 6.5], [-68, -80 + tw * 0.2, 14], [-34, -92, 22], [-6, -96, 28], [22, -98, 24], [22 + 22 * n, -98 - 12 * n, 14], [22 + 40 * n + nk * 0.3, -98 - 34 * n, 9], [22 + 56 * n + nk * 0.7, -98 - 52 * n + nod * 0.5, 7.2], [hx, hy, 6.6]];
    for (const p of spine) p[1] -= p[0] > -70 ? bob : 0;
    c.fillStyle = grad(c, 0, -175, 0, -55, [shade(o.body, 0.1), o.body, shade(o.body, -0.12)]);
    tube(c, spine);
    c.fill();
    // pale underside
    tube(c, [[-58, -71 - bob, 2], [-30, -78 - bob, 8], [-4, -84 - bob, 15], [22, -87 - bob, 11], [22 + 26 * n, -98 - 8 * n - bob, 6], [22 + 44 * n + nk * 0.3, -98 - 30 * n - bob, 3.5]], o.belly);
    // soft saddle marks along the back
    const y0 = -bob;
    dots(c, [[-82, -83 + y0 + tw * 0.2, 4], [-62, -90 + y0, 5.4], [-40, -101 + y0, 6.6], [-16, -108 + y0, 7.4], [10, -109 + y0, 6.8], [32, -106 + y0, 4.4]], o.dark);
    plateoLeg(c, -28, -86 - bob, gait(walk, 0, 0.42), o.body, claw);
    plateoArm(c, 26, -84 - bob, 0.05 + gait(walk, PI + 0.5, 0.2), o.body, claw);
    c.save();
    c.translate(hx, hy);
    c.scale(o.head, o.head);
    blob(c, [[-12, 4], [-9, -9], [4, -12], [17, -8], [27, -2], [26, 5], [12, 8], [-4, 9]], shade(o.body, 0.05));
    blinkEye(c, 3, -3.5, 5.4, t, s, o.dark);
    ell(c, 21.5, -2.5, 1.1, 1.1, 'rgba(40,30,15,0.7)');
    curve(c, 25, 2, 15, 5.5, 5, 3.5, 'rgba(50,35,15,0.65)', 1.2);
    ell(c, 9, 3, 3, 2, 'rgba(240,150,110,0.35)');
    c.restore();
  }
  function drawPlateo(c, t, walk) {
    plateo(c, t, walk, { body: '#86a14f', dark: '#5f7d3b', belly: '#e3dca3', neck: 1, head: 1, seed: 0 });
  }
  function drawPlateoJung(c, t, walk) {
    c.scale(0.5, 0.5);
    plateo(c, t, walk, { body: '#a3b960', dark: '#7c9848', belly: '#f0ecb9', neck: 0.62, head: 1.62, seed: 2 });
  }
  function horsetail(c, x, h, t, seed, col) {
    const sw = sin(t * 0.8 + seed) * h * 0.03;
    const rw = h * 0.03 + 1.8;
    tube(c, [[x, 0, rw], [x + sw * 0.4, -h * 0.5, rw * 0.92], [x + sw, -h, rw * 0.5]], col);
    c.beginPath();
    const step = 15;
    for (let y = step; y < h - 8; y += step) {
      const k = y / h;
      const px = x + sw * k * k;
      c.moveTo(px - rw, -y);
      c.lineTo(px + rw, -y);
    }
    c.strokeStyle = shade(col, -0.32);
    c.lineWidth = 1.6;
    c.stroke();
    c.beginPath();
    for (let y = 30; y < h - 16; y += step) {
      const k = y / h;
      const px = x + sw * k * k;
      const L = (14 + 10 * (1 - k)) * 0.95;
      for (const d of [-1, 1]) {
        c.moveTo(px, -y);
        c.quadraticCurveTo(px + d * L * 0.6, -y - 4, px + d * L, -y + 3);
      }
    }
    c.strokeStyle = shade(col, 0.12);
    c.lineWidth = 1.3;
    c.stroke();
    ell(c, x + sw, -h - 4, 3.6, 8, '#9a7a45');
  }
  function drawSchachtelhalm(c, t) {
    shadow(c, 0, 40, 5);
    horsetail(c, -22, 118, t, 1, '#5e9150');
    horsetail(c, 22, 92, t, 3, '#6da05a');
    horsetail(c, 2, 140, t, 2, '#4f8748');
    ell(c, -6, -1, 34, 5, '#5a7a3a');
  }

  // ================================================================== JURA
  const WL_J = 0.3;
  function paintJura(g, w, h, u) {
    const y0 = h * WL_J;
    fillV(g, 0, 0, w, y0 + 2, [[0, '#62c1ea'], [0.65, '#b9e8f2'], [1, '#f2f6dc']]);
    glow(g, w * 0.14, h * 0.07, 130 * u, '#fff6c8', 0.9);
    ell(g, w * 0.14, h * 0.07, 20 * u, 20 * u, '#fffce6');
    // a low green island far away
    blob(g, [[w * 0.42, y0 + 3], [w * 0.5, y0 - 16 * u], [w * 0.66, y0 - 26 * u], [w * 0.86, y0 - 20 * u], [w * 1.04, y0 - 8 * u], [w * 1.04, y0 + 3]], '#8fc4a0');
    for (const x of [0.58, 0.76, 0.93]) arauc(g, w * x, y0 - 14 * u, 50 * u, '#86745c', '#6da888');
    for (const x of [0.52, 0.66, 0.84]) cycad(g, w * x, y0 - 12 * u, 17 * u, '#6da888');
    fillV(g, 0, y0, w, h - y0, [[0, '#43bcd2'], [0.28, '#2298bd'], [0.65, '#12659a'], [1, '#0b3e6e']]);
    rays(g, w, y0, h, 5, 11);
    // sea floor
    rolling(g, w, h * 0.875, 18 * u, 0.007, 4, '#6d9091', h);
    rolling(g, w, h * 0.925, 14 * u, 0.011, 9, '#4f7682', h);
    const r = rngOf(5);
    for (let i = 0; i < 9; i++) {
      const x = r() * w;
      const y = h * (0.88 + r() * 0.1);
      ell(g, x, y, (10 + r() * 22) * u, (5 + r() * 8) * u, i % 2 ? '#476e78' : '#5e8688');
    }
  }
  function backJura(c, w, h, t) {
    stage(c, w, h, 'jura', paintJura);
    const u = h / 640;
    const y0 = h * WL_J;
    cloud(c, driftX(t, 4, w, 0.3), h * 0.1, 0.6 * u, 0.75);
    surface(c, w, y0, t, 3 * u, 'rgba(210,244,246,0.72)', 7 * u);
    shoal(c, driftX(t, 7, w, 0.1), h * 0.42, u, 9, t, 'rgba(210,235,240,0.75)', 3, 1);
    shoal(c, w - driftX(t, 5, w, 0.55), h * 0.74, u * 0.8, 7, t, 'rgba(160,205,215,0.6)', 8, -1);
    plankton(c, w, y0 + 10 * u, h * 0.86, t, 26, 7, 'rgba(255,255,255,0.32)');
    // sea grass on the floor
    for (let i = 0; i < 5; i++) {
      const x = w * (0.08 + i * 0.21) + 8 * u;
      const sw = sin(t * 0.8 + i) * 9 * u;
      tube(c, [[x, h * 0.93, 4 * u], [x + sw * 0.5, h * 0.87, 3.4 * u], [x + sw, h * (0.8 + (i % 2) * 0.03), 1 * u]], i % 2 ? '#3e8a6d' : '#2f7a68');
    }
  }
  function drawIchthyo(c, t, walk) {
    const ph = walk || t * 2.4;
    const wg = sin(ph) * 3.2;
    const k = 0.74 + 0.26 * cos(ph);
    c.translate(0, sin(t * 0.9) * 2.5);
    const top = -70;
    const dark = '#37617f';
    // far flipper
    tube(c, [[26, -24, 6], [20, -11 + wg * 0.4, 5.4], [10, -5 + wg * 0.8, 1.5]], '#2f5470');
    // tail, the lower lobe carries the spine
    const bx = -74;
    const by = -41 + wg;
    c.beginPath();
    c.moveTo(bx + 4, by - 4);
    c.quadraticCurveTo(bx - 12 * k, by - 17, bx - 26 * k, by - 35);
    c.quadraticCurveTo(bx - 19 * k, by - 12, bx - 15 * k, by);
    c.quadraticCurveTo(bx - 19 * k, by + 14, bx - 30 * k, by + 31);
    c.quadraticCurveTo(bx - 10 * k, by + 17, bx + 4, by + 4);
    c.closePath();
    c.fillStyle = dark;
    c.fill();
    // back fin
    blob(c, [[12, -62], [-1, -76], [-16, -86], [-14, -70], [-20, -58]], dark);
    // body as one soft spindle
    c.fillStyle = grad(c, 0, top, 0, -14, [[0, '#3f6d8d'], [0.46, '#5f90aa'], [0.62, '#b9d4d8'], [1, '#f0f4ec']]);
    tube(c, [[-78, -41 + wg, 3], [-52, -43 + wg * 0.55, 7.5], [-22, -43 + wg * 0.2, 19], [12, -42, 26], [42, -41, 18.5], [62, -40, 11], [76, -39, 4.4], [98, -37.5, 1.5]]);
    c.fill();
    // flippers
    tube(c, [[36, -26, 7], [28, -12 + wg * 0.5, 7], [12, -3 + wg, 1.5]], '#4b7c9b');
    tube(c, [[-34, -28, 4.5], [-42, -20 + wg * 0.5, 4], [-52, -15 + wg, 1]], '#4b7c9b');
    // mouth and big eye with its bony ring
    curve(c, 96, -37.5, 78, -33, 60, -35, 'rgba(25,50,70,0.5)', 1.3);
    ell(c, 58, -46, 9.6, 9.6, '#2e536e');
    blinkEye(c, 58, -46, 8, t, 1, '#3f6d8d');
    ell(c, 56, -33, 3.6, 2.2, 'rgba(255,170,150,0.35)');
  }
  function flipper(c, x, y, a, len, wd, col) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    blob(c, [[-wd * 0.3, -wd * 0.5], [len * 0.45, -wd * 0.9], [len * 0.85, -wd * 0.55], [len * 1.05, 0], [len * 0.5, wd * 0.5], [-wd * 0.2, wd * 0.5]], col);
    c.restore();
  }
  function drawPlesio(c, t, walk) {
    const ph = walk || t * 1.3;
    const sw = sin(t * 0.8) * 4;
    c.translate(-6, sin(t * 0.7 + 1) * 2.5);
    const dark = '#2e6b67';
    flipper(c, 26, -36, 0.5 + sin(ph) * 0.42, 48, 13, dark);
    flipper(c, -42, -36, 0.65 + sin(ph + PI) * 0.36, 40, 12, dark);
    const hx = 104;
    const hy = -80 + sw;
    c.fillStyle = grad(c, 0, -100, 0, -14, [[0, '#6ab3a3'], [0.55, '#4f9b90'], [0.72, '#c7e0c2'], [1, '#eff4d8']]);
    tube(c, [[-96, -36 - sw * 0.2, 1], [-74, -38, 7], [-40, -42, 21], [-6, -44, 28], [26, -46, 21], [48, -53, 10.5], [68, -62 + sw * 0.3, 7.6], [88, -72 + sw * 0.7, 6.2], [hx, hy, 5.6]]);
    c.fill();
    dots(c, [[-52, -55, 4], [-30, -62, 5], [-8, -66, 5.4], [14, -64, 4.4], [34, -58, 3], [56, -66 + sw * 0.4, 2.2], [74, -76 + sw * 0.7, 1.8]], '#3f8880');
    flipper(c, 18, -30, 0.35 + sin(ph + 0.5) * 0.45, 54, 14, '#3a8078');
    flipper(c, -48, -30, 0.55 + sin(ph + PI + 0.5) * 0.4, 44, 13, '#3a8078');
    c.save();
    c.translate(hx, hy);
    blob(c, [[-9, 3], [-7, -7], [4, -9.5], [14, -6], [21, -1], [20, 4], [8, 7], [-4, 7]], '#6ab3a3');
    blinkEye(c, 3, -2.5, 5, t, 2, '#3f8880');
    curve(c, 20, 1.8, 11, 5, 3, 3.4, 'rgba(25,60,55,0.65)', 1.2);
    c.restore();
  }
  // Coiled shell with ribs. r = shell radius; the soft body with eye and arms points forward.
  function ammonite(c, t, o) {
    const R = o.r;
    const cy = -R - 4 + sin(t * 0.8 + o.seed) * 3;
    const cx = -R * 0.28;
    const armCol = o.arm;
    // arms behind the shell rim
    for (let i = 0; i < 8; i++) {
      const a = -0.75 + i * 0.21;
      const sw = sin(t * 1.3 + i * 0.9 + o.seed) * R * 0.09;
      const L = R * (0.72 + (i % 2) * 0.16);
      const bx = cx + R * 1.02;
      const by = cy + R * 0.28;
      tube(c, [[bx, by, R * 0.07], [bx + cos(a) * L * 0.6, by + sin(a) * L * 0.6 + sw, R * 0.052], [bx + cos(a) * L, by + sin(a) * L - sw, R * 0.016]], i % 2 ? armCol : shade(armCol, -0.1));
    }
    blob(c, [[cx + R * 0.62, cy - R * 0.28], [cx + R * 1.22, cy - R * 0.3], [cx + R * 1.42, cy + R * 0.16], [cx + R * 1.16, cy + R * 0.66], [cx + R * 0.62, cy + R * 0.62]], armCol);
    c.fillStyle = grad(c, cx, cy - R, cx, cy + R, [o.a, o.b]);
    ell(c, cx, cy, R, R);
    c.fill();
    const K = Math.log(2.3) / TAU;
    // ribs between the whorls
    c.beginPath();
    for (let i = 0; i < o.ribs; i++) {
      const th = i * 0.27;
      const r0 = R * Math.exp(-K * th);
      const r1 = r0 * 0.56;
      if (r1 < R * 0.09) break;
      const a = th + 0.62;
      c.moveTo(cx + cos(a) * r0 * 0.985, cy + sin(a) * r0 * 0.985);
      c.quadraticCurveTo(cx + cos(a + 0.16) * (r0 + r1) * 0.5, cy + sin(a + 0.16) * (r0 + r1) * 0.5, cx + cos(a) * r1, cy + sin(a) * r1);
    }
    c.strokeStyle = o.rib;
    c.lineWidth = o.ribW;
    c.lineCap = 'round';
    c.stroke();
    // the coil line
    c.beginPath();
    for (let i = 0; i <= 58; i++) {
      const th = i * 0.15;
      const r = R * Math.exp(-K * (th + TAU));
      const a = th + 0.62;
      if (i) c.lineTo(cx + cos(a) * r, cy + sin(a) * r);
      else c.moveTo(cx + cos(a) * r, cy + sin(a) * r);
    }
    c.strokeStyle = o.line;
    c.lineWidth = R * 0.05;
    c.stroke();
    // opening rim, eye
    c.beginPath();
    c.arc(cx, cy, R * 0.985, -0.62, 0.62);
    c.strokeStyle = o.line;
    c.lineWidth = R * 0.05;
    c.stroke();
    blinkEye(c, cx + R * 1.1, cy - R * 0.02, R * 0.21, t, o.seed, armCol);
  }
  function drawAmmonit(c, t) {
    ammonite(c, t, { r: 34, a: '#f6c98a', b: '#d9804a', rib: 'rgba(130,60,25,0.65)', ribW: 2.6, line: 'rgba(120,55,25,0.8)', arm: '#f0b49a', ribs: 34, seed: 0 });
  }
  function drawSeelilie(c, t) {
    const bob = sin(t * 0.8) * 2;
    const top = -204 + bob;
    const stems = [[-56, 118, '#c56fa0'], [-22, 156, '#b26bb8'], [14, 132, '#d17a92'], [50, 100, '#a974c4']];
    for (let i = 0; i < stems.length; i++) {
      const [x, ln, col] = stems[i];
      const sw = sin(t * 0.5 + i * 1.5) * 8;
      const ex = x + sw;
      const ey = top + ln;
      curve(c, x, top + 6, x + sw * 1.6, top + ln * 0.5, ex, ey - 4, shade(col, -0.12), 2.6);
      // feathery arms hanging from the crown
      for (let a = -3; a <= 3; a++) {
        const d = a * 8.2;
        const sway = sin(t * 0.9 + a + i) * 2.5;
        const mx = ex + d * 0.8;
        const my = ey + 9 - abs(a) * 0.5;
        const tx = ex + d * 1.32 + sway;
        const ty = ey + 44 - a * a * 1.7;
        c.setLineDash([1.3, 2.7]);
        curve(c, ex, ey, mx, my, tx, ty, rgba(i % 2 ? '#f0cdec' : '#fad4dc', 0.95), 7);
        c.setLineDash([]);
        curve(c, ex, ey, mx, my, tx, ty, shade(col, a % 2 ? 0.08 : -0.05), 2);
      }
      ell(c, ex, ey, 6.4, 5.6, col);
    }
    // the driftwood afloat
    c.fillStyle = grad(c, 0, top - 14, 0, top + 14, ['#8d6b45', '#5a4029']);
    tube(c, [[-82, top + 1, 8], [-30, top - 2, 11.5], [30, top + 1, 12.5], [84, top - 2, 8]]);
    c.fill();
    ell(c, 84, top - 2, 5.5, 8, '#c8a878');
    ell(c, 84, top - 2, 2.6, 4.2, '#9a7a50');
    line(c, [[-60, top - 3], [-20, top - 7], [20, top - 4]], 'rgba(40,25,10,0.32)', 1.6);
    line(c, [[-30, top + 4], [10, top + 6], [58, top + 2]], 'rgba(40,25,10,0.32)', 1.6);
    tube(c, [[-40, top - 9, 3], [-52, top - 18, 2], [-56, top - 27, 0.8]], '#7a5a3a');
    dots(c, [[-14, top + 9, 2], [-4, top + 10, 2.2], [22, top + 9, 2], [40, top + 7, 1.8]], '#d8d0b8');
  }
  // Marine crocodile (Steneosaurus from the Posidonia shale): gharial snout, armoured back, paddling legs, long swimming tail.
  function drawKroko(c, t, walk) {
    const ph = walk || t * 1.6;
    const wg = sin(ph) * 3;
    c.translate(-4, sin(t * 0.6 + 2) * 1.5);
    const body = '#6f8f5e';
    const dark = '#4b6c49';
    stump(c, 34, -22, 22, 5.5, 3.6, 0.9 + gait(ph, 0, 0.4), dark);
    stump(c, -30, -22, 24, 6.5, 4, 0.9 + gait(ph, PI, 0.4), dark);
    c.fillStyle = grad(c, 0, -46, 0, -6, [[0, '#5e7f53'], [0.55, '#7f9e68'], [0.72, '#d9dfb0'], [1, '#eef0cc']]);
    tube(c, [[-108, -22 + wg, 1.6], [-76, -23 + wg * 0.6, 6.5], [-40, -25 + wg * 0.2, 12.5], [-4, -27, 17], [28, -26, 14], [50, -25, 10], [64, -24, 7.5], [80, -22, 3.5], [104, -20, 2.8]]);
    c.fill();
    // bony plates along the back, a row and a row
    c.beginPath();
    for (let i = 0; i < 15; i++) {
      const x = -92 + i * 10.2;
      const k = i / 14;
      const y = -24 - 19 * sin(min(1, k * 1.15) * PI) ** 0.8 + wg * (1 - k) * 0.5;
      c.moveTo(x - 4.2, y + 1.5);
      c.lineTo(x, y - 3.8);
      c.lineTo(x + 4.2, y + 1.5);
    }
    c.fillStyle = dark;
    c.fill();
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = -32 + i * 12;
      c.moveTo(x, -38 + abs(i - 2.4) * 1.1);
      c.lineTo(x - 2, -21);
    }
    c.strokeStyle = 'rgba(45,70,45,0.5)';
    c.lineWidth = 1.7;
    c.stroke();
    stump(c, 26, -18, 24, 6.5, 4, 0.9 + gait(ph, PI, 0.45), body);
    stump(c, -38, -18, 26, 7.5, 4.6, 0.9 + gait(ph, 0, 0.45), body);
    // eye bump and long smile
    ell(c, 56, -31, 9, 7.6, '#7f9e68');
    blinkEye(c, 56.5, -33, 6, t, 3, body);
    curve(c, 104, -19, 84, -19, 64, -19, 'rgba(40,55,30,0.65)', 1.2);
    curve(c, 66, -19, 60, -18, 57, -21, 'rgba(40,55,30,0.65)', 1.2);
    ell(c, 104, -22.5, 1.4, 1.1, 'rgba(30,40,25,0.7)');
  }
  // Dorygnathus-like pterosaur: wing skin stretched from one long finger, a long stiff tail, closed beak.
  function drawFlugsaurier(c, t, walk) {
    const flap = sin(t * 3 + (walk || 0) * 0.3) * (0.65 + 0.35 * sin(t * 0.7));
    c.translate(0, -sin(t * 0.8) * 3 - flap * 3);
    const wing = (lift, col, vein) => {
      const sx = 10;
      const sy = -37;
      const up = abs(lift);
      const ex = 20;
      const ey = sy - 13 * lift - 5;
      const wx = 32 - 5 * up;
      const wy = sy - 31 * lift - 8;
      // the long fourth finger carries the wing skin out to the tip
      const tx = -10 - 42 * (1 - up);
      const ty = sy - 66 * lift - 7;
      const fx = (wx + tx) / 2 + 9;
      const fy = (wy + ty) / 2 - 10 * (lift < 0 ? -1 : 1) * (0.3 + up);
      // back edge curves in towards the body, ending at the leg
      const bx = (tx - 18) * 0.25 + sx * 0.5;
      const by = (ty + sy + 6) * 0.25 + sy * 0.5;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(ex, ey);
      c.lineTo(wx, wy);
      c.quadraticCurveTo(fx, fy, tx, ty);
      c.quadraticCurveTo(bx, by, -18, sy + 6);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      line(c, [[sx, sy], [ex, ey], [wx, wy]], vein, 3.2);
      curve(c, wx, wy, fx, fy, tx, ty, vein, 1.9);
      line(c, [[wx, wy], [wx + 6, wy + 1], [wx + 9, wy - 2]], vein, 1.3);
    };
    wing(-flap * 0.8 + 0.2, '#c98a4e', '#94592f');
    curve(c, -14, -33, -44, -30, -66, -24 + sin(t * 1.6) * 2, '#a2663a', 2.8);
    tube(c, [[-14, -32, 5.6], [2, -35, 9], [16, -39, 7], [27, -45, 5.4]], '#b4753f');
    ell(c, 2, -31.5, 7, 4.5, '#ecd2a0');
    wing(flap, '#eeb06c', '#a9682f');
    c.save();
    c.translate(32, -48);
    blob(c, [[-9, 2], [-7, -8], [5, -10], [14, -6], [30, -1], [30, 2], [13, 6], [-3, 8]], '#cc8a4a');
    blinkEye(c, 2, -2.5, 5.4, t, 4, '#b4753f');
    curve(c, 29, 0.6, 18, 2.6, 8, 2.2, 'rgba(70,35,10,0.7)', 1.1);
    c.restore();
  }

  // ================================================================== KREIDE
  const WL_K = 0.47;
  function paintKreide(g, w, h, u) {
    const hz = h * 0.43;
    const y0 = h * WL_K;
    fillV(g, 0, 0, w, hz + 2, [[0, '#4d75bf'], [0.45, '#8db2e0'], [0.8, '#f1d9c8'], [1, '#fbdcae']]);
    const r = rngOf(31);
    for (let i = 0; i < 26; i++) ell(g, r() * w, r() * h * 0.18, 0.8 + r() * 0.8, 0.8 + r() * 0.8, `rgba(255,255,255,${0.25 + r() * 0.4})`);
    glow(g, w * 0.22, hz, 130 * u, '#ffe6b3', 0.75);
    // far islands with white chalk cliffs and palm-like plants
    for (const [x, a, b] of [[0.14, 90, 30], [0.56, 70, 20], [0.9, 110, 38]]) {
      const cx = w * x;
      blob(g, [[cx - a * u * 1.1, hz + 2], [cx - a * u * 0.6, hz - b * u], [cx + a * u * 0.3, hz - b * u * 1.15], [cx + a * u * 1.1, hz + 2]], '#8fb09b');
      poly(g, [[cx - a * u * 0.62, hz + 1], [cx - a * u * 0.5, hz - b * u * 0.52], [cx - a * u * 0.14, hz - b * u * 0.46], [cx + a * u * 0.1, hz + 1]], '#f3ecdc');
      for (const k of [-0.5, -0.1, 0.3]) palm(g, cx + a * u * k, hz - b * u * 0.86, 22 * u, 1.5 * u, 0, x + k, '#6f9c86');
    }
    fillV(g, 0, hz, w, y0 - hz + 3, ['#a8d8d8', '#5ec0c0', '#39afb2']);
    fillV(g, 0, y0, w, h - y0, [[0, '#35b4b0'], [0.35, '#1b8f9e'], [0.75, '#0f6585'], [1, '#0b4a6c']]);
    rays(g, w, y0, h, 4, 17);
    // white chalk ooze on the sea floor: this mud became chalk
    rolling(g, w, h * 0.89, 15 * u, 0.008, 2, '#d7ddcc', h);
    rolling(g, w, h * 0.935, 10 * u, 0.012, 6, '#aebfb8', h);
    const q = rngOf(13);
    for (let i = 0; i < 7; i++) {
      const x = q() * w;
      const y = h * (0.89 + q() * 0.08);
      ell(g, x, y, 10 * u, 6.5 * u, '#c6a97c');
      for (let k = -2; k <= 2; k++) line(g, [[x + k * 3.6 * u, y - 5 * u], [x + k * 2.3 * u, y + 5 * u]], 'rgba(90,65,35,0.5)', 0.8 * u);
    }
  }
  function backKreide(c, w, h, t) {
    stage(c, w, h, 'kreide', paintKreide);
    const u = h / 640;
    cloud(c, driftX(t, 3, w, 0.5), h * 0.3, 0.55 * u, 0.55);
    glitter(c, w, h * 0.435, h * WL_K - 1, t, 14, 5, 'rgba(255,255,255,0.6)', 8 * u);
    surface(c, w, h * WL_K, t, 3 * u, 'rgba(205,244,240,0.62)', 7 * u);
    shoal(c, w - driftX(t, 6, w, 0.3), h * 0.6, u * 0.9, 10, t, 'rgba(235,245,225,0.75)', 4, -1);
    plankton(c, w, h * 0.5, h * 0.88, t, 22, 12, 'rgba(255,255,255,0.28)');
    // a jellyfish, slowly pulsing
    const jx = w * 0.14 + sin(t * 0.17) * 18 * u;
    const jy = h * 0.6 + sin(t * 0.5) * 8 * u;
    const p = 1 + sin(t * 1.5) * 0.1;
    blob(c, [[jx - 15 * u * p, jy + 5 * u], [jx - 12 * u, jy - 14 * u], [jx + 12 * u, jy - 14 * u], [jx + 15 * u * p, jy + 5 * u]], 'rgba(245,210,235,0.55)');
    c.beginPath();
    for (let i = -2; i <= 2; i++) {
      c.moveTo(jx + i * 5 * u, jy + 4 * u);
      c.quadraticCurveTo(jx + i * 6 * u + sin(t + i) * 4 * u, jy + 16 * u, jx + i * 5 * u, jy + 26 * u);
    }
    c.strokeStyle = 'rgba(245,215,235,0.5)';
    c.lineWidth = 1.3 * u;
    c.stroke();
  }
  function drawKreideAmmonit(c, t) {
    ammonite(c, t, { r: 46, a: '#d9e0b0', b: '#7f9c82', rib: 'rgba(55,85,70,0.6)', ribW: 3.6, line: 'rgba(45,75,65,0.8)', arm: '#e8bca8', ribs: 24, seed: 3 });
  }
  // Allopleuron-like sea turtle of the chalk sea: wide front flippers, shield with ridges, gentle face.
  function drawKreideKroete(c, t, walk) {
    const ph = walk || t * 1.2;
    const fl = sin(ph);
    c.translate(0, sin(t * 0.7) * 3);
    flipper(c, 44, -54, 0.5 - fl * 0.5, 74, 15, '#3f7f77');
    flipper(c, -48, -50, 0.5 + fl * 0.34, 36, 11, '#3f7f77');
    // neck and head behind the shell front
    tube(c, [[46, -56, 13], [72, -60, 11]], '#74b4a2');
    // belly plate
    blob(c, [[-66, -58], [-30, -28], [24, -26], [64, -48], [66, -62], [-60, -66]], '#f2e6b4');
    c.fillStyle = grad(c, 0, -102, 0, -40, ['#6ea98f', '#2f7c78']);
    blob(c, [[-82, -54], [-58, -92], [-6, -108], [46, -98], [76, -64], [50, -50], [-8, -44], [-58, -44]]);
    c.fill();
    // ridges of the leathery shield
    c.beginPath();
    for (const [x0, y0, x1, y1, x2, y2] of [[-62, -56, -18, -102, 40, -86], [-58, -48, -10, -74, 60, -66]]) {
      c.moveTo(x0, y0);
      c.quadraticCurveTo(x1, y1, x2, y2);
    }
    c.strokeStyle = 'rgba(205,235,205,0.5)';
    c.lineWidth = 2.6;
    c.lineCap = 'round';
    c.stroke();
    dots(c, [[-30, -86, 6], [8, -92, 6.5], [40, -80, 5], [-44, -62, 4.5], [-6, -60, 5], [32, -58, 4.2]], 'rgba(20,70,70,0.4)');
    flipper(c, 40, -46, 0.75 - fl * 0.6, 84, 17, '#57a093');
    flipper(c, -50, -42, 0.72 + fl * 0.4, 40, 12, '#57a093');
    c.save();
    c.translate(80, -64);
    blob(c, [[-14, 6], [-12, -10], [4, -15], [20, -9], [26, 2], [18, 10], [-2, 13]], '#7cbba8');
    blinkEye(c, 7, -3.5, 7, t, 5, '#57a093');
    curve(c, 25, 3, 16, 8.5, 6, 6.6, 'rgba(20,70,60,0.65)', 1.4);
    c.restore();
  }
  function drawKomet(c, t) {
    const tw = 0.85 + sin(t * 1.3) * 0.15;
    c.translate(0, -24);
    c.fillStyle = grad(c, 6, 0, -42, 9, ['rgba(255,250,225,0.72)', 'rgba(205,230,255,0)']);
    poly(c, [[3, -3.5], [-42, 3], [-40, 13], [3, 3.5]]);
    c.fill();
    const g = c.createRadialGradient(4, 0, 0, 4, 0, 15);
    g.addColorStop(0, `rgba(255,252,225,${0.9 * tw})`);
    g.addColorStop(1, 'rgba(255,245,205,0)');
    c.fillStyle = g;
    c.fillRect(-11, -15, 30, 30);
    ell(c, 4, 0, 2.8, 2.8, '#fffef2');
  }

  // ================================================================== MIOZAEN
  function paintMiozaen(g, w, h, u) {
    const hz = h * 0.4;
    fillV(g, 0, 0, w, hz + 2, [[0, '#56bbe2'], [0.6, '#bfe9e6'], [1, '#faf1c6']]);
    glow(g, w * 0.2, h * 0.11, 150 * u, '#fff5c0', 0.85);
    ell(g, w * 0.2, h * 0.11, 22 * u, 22 * u, '#fffbe2');
    // low hazy shore, the Alps are still far away and small
    rolling(g, w, hz + 2, 48 * u, 0.006, 1, '#a9cfc0', hz + 3);
    rolling(g, w, hz + 2, 26 * u, 0.012, 5, '#83b596', hz + 3);
    fillV(g, 0, hz, w, h - hz, [[0, '#b4e8e0'], [0.22, '#64c8c9'], [0.65, '#31a7b4'], [1, '#2a97a4']]);
    // sun-warmed shallows in front
    const sh = g.createRadialGradient(w * 0.16, h * 0.9, 0, w * 0.16, h * 0.9, h * 0.34);
    sh.addColorStop(0, 'rgba(236,226,160,0.8)');
    sh.addColorStop(1, 'rgba(236,226,160,0)');
    g.fillStyle = sh;
    g.fillRect(0, h * 0.54, w * 0.7, h * 0.46);
    // the far-left headland with a cinnamon tree
    blob(g, [[-w * 0.12, h * 0.44], [w * 0.14, h * 0.43], [w * 0.22, h * 0.47], [w * 0.1, h * 0.52], [-w * 0.12, h * 0.56]], '#7cab58');
    laurel(g, w * 0.09, h * 0.47, 120 * u, '#7fa655', '#c0683e', 4);
    laurel(g, w * 0.015, h * 0.5, 150 * u, '#5b8f49', 0, 7);
    // the land on the right with a sand rim
    blob(g, [[w * 1.15, h * 0.45], [w * 0.74, h * 0.48], [w * 0.52, h * 0.56], [w * 0.42, h * 0.72], [w * 0.37, h * 0.88], [w * 0.3, h * 1.15], [w * 1.15, h * 1.15]], '#efdba4');
    g.fillStyle = grad(g, 0, h * 0.47, 0, h, ['#b5d26c', '#8dbb54', '#679c44']);
    blob(g, [[w * 1.15, h * 0.46], [w * 0.76, h * 0.49], [w * 0.56, h * 0.57], [w * 0.47, h * 0.72], [w * 0.42, h * 0.88], [w * 0.36, h * 1.15], [w * 1.15, h * 1.15]]);
    g.fill();
    laurel(g, w * 0.86, h * 0.53, 190 * u, '#43804a', 0, 3);
    laurel(g, w * 0.66, h * 0.52, 120 * u, '#5a9150', 0, 9);
    laurel(g, w * 0.78, h * 0.51, 140 * u, '#7fa655', '#c0683e', 11);
    palm(g, w * 0.58, h * 0.56, 150 * u, 14 * u, 0, 1);
    const r = rngOf(9);
    for (let i = 0; i < 22; i++) {
      const y = h * (0.55 + r() * 0.43);
      const x = w * (0.52 + r() * 0.5);
      const s = (6 + r() * 15) * u;
      ell(g, x, y, s, s * 0.32, i % 2 ? 'rgba(90,140,60,0.55)' : 'rgba(190,215,110,0.55)');
    }
    // water lilies in the shallows
    for (let i = 0; i < 10; i++) {
      const x = w * (0.02 + r() * 0.36);
      const y = h * (0.6 + r() * 0.34);
      const s = (7 + r() * 8) * u;
      ell(g, x, y, s, s * 0.4, '#5fa45f');
      if (i % 3 === 0) ell(g, x + s * 0.2, y - s * 0.2, s * 0.36, s * 0.26, '#f8dbe8');
    }
    for (const [x, y] of [[0.03, 0.62], [0.3, 0.6], [0.38, 0.68]]) reed(g, w * x, h * y, 56 * u, 0, x * 40);
  }
  function backMiozaen(c, w, h, t) {
    stage(c, w, h, 'miozaen', paintMiozaen);
    const u = h / 640;
    cloud(c, driftX(t, 3, w, 0.55), h * 0.14, 0.7 * u, 0.8);
    cloud(c, driftX(t, 2, w, 0.1), h * 0.26, 0.45 * u, 0.6);
    glitter(c, w * 0.72, h * 0.41, h * 0.62, t, 20, 3, 'rgba(255,255,255,0.65)', 12 * u);
    palm(c, w * 0.97, h * 0.74, 280 * u, -26 * u, t, 3);
    reed(c, w * 0.02, h * 0.86, 74 * u, t, 12);
  }
  // Andrias scheuchzeri: flat broad head, tiny eyes, wrinkled flank, stubby legs. Lies in the shallows and breathes.
  function drawSalamander(c, t) {
    const br = sin(t * 1.1);
    const ws = sin(t * 0.5) * 2;
    const top = '#7f6a4f';
    const low = '#a9946f';
    tube(c, [[38, -12, 7], [56, -2, 5], [72, -3, 3.5]], top);
    tube(c, [[-34, -12, 8], [-20, -2, 5.5], [-6, -2, 3.6]], top);
    // soft fin along the tail
    blob(c, [[-30, -30], [-58, -30 + ws], [-96, -16 + ws * 2], [-62, -12], [-30, -18]], '#94805f');
    c.fillStyle = grad(c, 0, -46, 0, -6, [top, low, '#d6c6a0']);
    tube(c, [[-98, -13 + ws * 2, 1], [-68, -15 + ws, 7], [-38, -20, 13], [-6, -23 - br * 0.5, 17.5], [24, -24 - br * 0.5, 17.5], [46, -22, 15]]);
    c.fill();
    // wrinkled skin fold along the flank
    c.beginPath();
    c.moveTo(-40, -12);
    for (let i = 1; i <= 7; i++) c.quadraticCurveTo(-40 + i * 11 - 5.5, -7 + (i % 2) * 3, -40 + i * 11, -12);
    c.strokeStyle = 'rgba(70,50,30,0.42)';
    c.lineWidth = 1.8;
    c.stroke();
    dots(c, [[-58, -21, 3], [-38, -28, 4], [-16, -33, 3.4], [6, -32, 4.4], [28, -33, 3.4], [-26, -18, 2.6], [10, -20, 2.8], [34, -20, 2.4]], 'rgba(70,52,34,0.5)');
    // the wide, flat head
    c.fillStyle = grad(c, 0, -46, 0, -6, ['#8b7557', '#b6a07a']);
    blob(c, [[38, -30], [56, -44], [84, -45], [108, -33], [112, -16], [94, -7], [58, -7], [38, -13]]);
    c.fill();
    // throat pumping as it breathes
    ell(c, 74, -9, 25, 4.5 + br * 1.3, '#d9c9a4');
    dots(c, [[62, -36, 2.4], [52, -28, 2.2], [92, -35, 2]], 'rgba(70,52,34,0.45)');
    curve(c, 110, -21, 86, -11, 58, -19, 'rgba(55,38,22,0.75)', 1.7);
    ell(c, 106, -30, 1.3, 1, 'rgba(45,30,20,0.8)');
    ell(c, 66, -18, 6, 3.6, 'rgba(240,150,120,0.35)');
    blinkEye(c, 84, -36, 3.6, t, 2, '#8b7557');
    // water over the lower body, rings drifting outward
    c.fillStyle = 'rgba(85,190,195,0.5)';
    blob(c, [[-112, -8], [0, -13], [120, -8], [122, 3], [0, 6], [-112, 3]]);
    c.fill();
    const rp = wrap(t * 0.2, 1);
    c.beginPath();
    c.ellipse(16, -2, 95 + rp * 40, 8 + rp * 5, 0, 0, TAU);
    c.strokeStyle = `rgba(255,255,255,${0.42 * (1 - rp)})`;
    c.lineWidth = 1.5;
    c.stroke();
  }
  // Gomphotherium: long low body, short legs, long lower jaw, FOUR tusks: two curving down from above, two straight from the lower jaw.
  function drawGompho(c, t, walk) {
    c.translate(-22, 0);
    const body = '#937f69';
    const dark = '#75634f';
    const foot = '#a9977f';
    const sw = sin(t * 1.1) * 3;
    const bob = stepBob(walk, 1.4);
    const tusk = '#f6eed9';
    const tuskF = '#d9cfb6';
    shadow(c, 6, 118, 8);
    tube(c, [[-92, -98 - bob, 4], [-104, -74 + sw * 0.5, 2.6], [-105, -54 + sw, 1.6]], dark);
    ell(c, -105, -50 + sw, 3, 6, '#54463a');
    stump(c, -44, -66 - bob, 66 + bob, 17, 14, gait(walk, PI, 0.24), dark, foot);
    stump(c, 54, -66 - bob, 66 + bob, 16, 13.5, gait(walk, 0, 0.24), dark, foot);
    c.translate(0, -bob);
    // far upper tusk, set apart so all four can be counted
    tube(c, [[116, -90, 4.6], [136, -72, 4.8], [152, -50, 3.2], [156, -32, 0.9]], tuskF);
    // far lower tusk
    tube(c, [[132, -66, 3.6], [156, -66, 3.2], [180, -68, 1]], tuskF);
    c.fillStyle = grad(c, 0, -140, 0, -50, [shade(body, 0.1), body, dark]);
    blob(c, [[-96, -78], [-88, -120], [-44, -136], [6, -138], [50, -136], [76, -120], [80, -82], [52, -56], [-10, -50], [-70, -54]]);
    c.fill();
    c.translate(0, bob);
    stump(c, -62, -68 - bob, 68 + bob, 18.5, 15, gait(walk, 0, 0.24), body, foot);
    stump(c, 38, -68 - bob, 68 + bob, 18, 14.5, gait(walk, PI, 0.24), body, foot);
    c.translate(0, -bob);
    // the long lower jaw with its straight near tusk, like a shovel
    tube(c, [[80, -82, 13], [108, -68, 9.5], [130, -60, 6.5]], dark);
    tube(c, [[126, -60, 4.4], [150, -58, 4.2], [176, -59, 1.2]], tusk);
    c.fillStyle = grad(c, 0, -146, 0, -76, [shade(body, 0.14), body]);
    blob(c, [[56, -134], [90, -148], [114, -134], [122, -106], [108, -84], [78, -80], [56, -100]]);
    c.fill();
    // short trunk, lifted so the lower tusks stay in view
    tube(c, [[112, -110, 13], [132, -102, 10.5], [150, -106 + sw * 0.3, 7.6], [162, -122 + sw, 4.6]], body);
    c.beginPath();
    for (const [x, y] of [[128, -112], [139, -115], [149, -117]]) {
      c.moveTo(x, y);
      c.lineTo(x + 2, y + 15);
    }
    c.strokeStyle = 'rgba(60,45,30,0.3)';
    c.lineWidth = 1.2;
    c.stroke();
    // near upper tusk, curving down in front of everything
    tube(c, [[104, -92, 5.8], [118, -68, 6], [132, -44, 4.2], [136, -26, 1]], tusk);
    // small ear and friendly eye
    blob(c, [[62, -128 + sw * 0.4], [82, -130], [88, -112], [78, -98], [62, -102 + sw * 0.4], [56, -116]], dark);
    blinkEye(c, 99, -122, 6, t, 1, body);
    curve(c, 96, -92, 90, -88, 84, -92, 'rgba(50,38,28,0.5)', 1.3);
  }
  // Pond turtle like the Ptychogaster of Oehningen.
  function drawSchildkroete(c, t, walk) {
    const a = gait(walk, 0, 0.35);
    const look = sin(t * 0.5) * 1.5;
    shadow(c, 0, 38, 3.5);
    c.translate(-6, 0);
    stump(c, 22, -11, 11, 5.4, 3.6, -a, '#5d7a43');
    stump(c, -22, -11, 11, 5.4, 3.6, a, '#5d7a43');
    tube(c, [[-34, -11, 3], [-44, -7, 1]], '#6f8c4f');
    tube(c, [[28, -14, 5.4], [44, -19 + look, 5]], '#7d9a58');
    blob(c, [[-37, -10], [-30, -13], [34, -13], [37, -9], [28, -6], [-28, -6]], '#e4d69a');
    c.fillStyle = grad(c, 0, -38, 0, -10, ['#7b9053', '#4f6a37']);
    blob(c, [[-40, -10], [-28, -32], [0, -42], [26, -34], [40, -10]]);
    c.fill();
    c.beginPath();
    for (const [x, y] of [[-16, -24], [8, -26]]) {
      c.moveTo(x - 10, y);
      c.lineTo(x - 5, y - 8);
      c.lineTo(x + 5, y - 8);
      c.lineTo(x + 10, y);
      c.lineTo(x + 5, y + 8);
      c.lineTo(x - 5, y + 8);
      c.closePath();
    }
    c.strokeStyle = 'rgba(245,235,180,0.5)';
    c.lineWidth = 1.5;
    c.stroke();
    stump(c, 18, -9, 9, 5.4, 3.8, a, '#7d9a58');
    stump(c, -18, -9, 9, 5.4, 3.8, -a, '#7d9a58');
    c.save();
    c.translate(48, -21 + look);
    blob(c, [[-8, 4], [-7, -5], [3, -8], [10, -3], [11, 3], [2, 7]], '#88a561');
    blinkEye(c, 2, -1.5, 4.2, t, 3, '#7d9a58');
    curve(c, 10, 2.6, 6, 5, 1, 4, 'rgba(40,55,25,0.7)', 1);
    c.restore();
  }
  function drawLibelle(c, t, walk) {
    const hov = sin(t * 2.2) * 3;
    c.translate(0, -24 + hov);
    const fl = sin(t * 38);
    const wingA = fl * 0.1;
    const wing = (x, a, L, wd) => {
      c.save();
      c.translate(x, -4);
      c.rotate(a);
      ell(c, L / 2, 0, L / 2, wd, 'rgba(226,248,255,0.62)');
      c.lineWidth = 0.9;
      c.strokeStyle = 'rgba(120,190,205,0.7)';
      c.stroke();
      line(c, [[2, 0], [L - 3, 0]], 'rgba(120,190,205,0.6)', 0.8);
      c.restore();
    };
    wing(6, -2.65 + wingA, 30, 4.2);
    wing(12, -0.52 - wingA, 30, 4.2);
    tube(c, [[8, -1, 3.4], [-12, 1 + hov * 0.1, 2.4], [-40, 6 - hov * 0.2, 1.2]], '#2bb0ae');
    c.beginPath();
    for (let i = 1; i < 6; i++) {
      const x = 4 - i * 7.2;
      c.moveTo(x, -2 + i * 0.5);
      c.lineTo(x, 3.5 + i * 0.5);
    }
    c.strokeStyle = 'rgba(10,70,90,0.55)';
    c.lineWidth = 1.2;
    c.stroke();
    ell(c, 12, -2, 7.5, 5, '#2f8fa8');
    wing(8, -2.92 - wingA, 34, 4.8);
    wing(14, -0.24 + wingA, 34, 4.8);
    ell(c, 21, -3, 6.2, 6, '#3cc2c9');
    blinkEye(c, 22.5, -4, 4.8, t, 4, '#3cc2c9');
  }
  // A small fox-like hunter of the Miocene shore.
  function drawUrfuchs(c, t, walk) {
    const bob = stepBob(walk, 1.5);
    const tw = sin(t * 1.5) * 4;
    const body = '#b9783f';
    const dark = '#7c4c29';
    const pale = '#f1dfbe';
    const nod = sin(t * 0.9) * 1.2;
    shadow(c, -4, 44, 4);
    shank(c, 16, -26 - bob, 13, 13 + bob, 4, 2, gait(walk, 0, 0.5), 0.1, dark, dark);
    shank(c, -22, -26 - bob, 14, 12 + bob, 4.6, 2, gait(walk, PI, 0.5), -0.2, dark, dark);
    tube(c, [[-32, -34 - bob, 4], [-48, -38 - bob + tw * 0.3, 8], [-64, -32 - bob + tw, 7.5], [-80, -24 - bob + tw * 1.3, 2]], body);
    tube(c, [[-68, -29 - bob + tw * 1.1, 6], [-80, -24 - bob + tw * 1.3, 1.6]], pale);
    tube(c, [[-34, -34 - bob, 9], [-10, -35 - bob, 10.5], [14, -37 - bob, 11], [28, -46 - bob, 7.6], [36, -52 - bob + nod, 6.4]], body);
    tube(c, [[-26, -28 - bob, 4], [-6, -29 - bob, 5.5], [16, -31 - bob, 6], [28, -42 - bob, 3.5]], pale);
    shank(c, 22, -28 - bob, 14, 14 + bob, 4.4, 2.1, gait(walk, PI, 0.5), 0.1, body, dark);
    shank(c, -16, -28 - bob, 15, 13 + bob, 5.2, 2.1, gait(walk, 0, 0.5), -0.2, body, dark);
    c.save();
    c.translate(40, -54 - bob + nod);
    poly(c, [[-9, -4], [-6, -21], [3, -8]], dark);
    blob(c, [[-11, 3], [-9, -8], [2, -11], [11, -6], [26, 2], [25, 5], [10, 8], [-5, 8]], body);
    poly(c, [[-5, -6], [-1, -24], [8, -8]], body);
    poly(c, [[-2, -8], [-0.5, -18], [5, -8]], '#f0cda8');
    blob(c, [[6, 1], [24, 3], [24, 5], [10, 8], [0, 7]], pale);
    ell(c, 25, 2.6, 2.1, 1.9, '#2a1f18');
    blinkEye(c, 4, -2.5, 4.4, t, 5, body);
    curve(c, 23, 5.6, 15, 7.6, 9, 5.8, 'rgba(60,35,20,0.7)', 1);
    c.restore();
  }

  // ================================================================== VULKANE
  function cone(g, x, y, b, ht, top, low) {
    g.fillStyle = grad(g, 0, y - ht, 0, y, [top, low]);
    g.beginPath();
    g.moveTo(x - b, y);
    g.quadraticCurveTo(x - b * 0.38, y - ht * 0.45, x - b * 0.13, y - ht);
    g.lineTo(x + b * 0.13, y - ht);
    g.quadraticCurveTo(x + b * 0.38, y - ht * 0.45, x + b, y);
    g.closePath();
    g.fill();
  }
  function paintVulkane(g, w, h, u) {
    const hz = h * 0.54;
    fillV(g, 0, 0, w, hz + 2, [[0, '#6dbce8'], [0.65, '#cfe9e4'], [1, '#f8edc4']]);
    // the young Alps in the far haze
    peaks(g, w, hz + 2, 36 * u, 70 * u, 3, '#bcd0dc', 0);
    cone(g, w * 0.09, hz + 4, 90 * u, 92 * u, '#8c97a0', '#a3b6ad');
    cone(g, w * 0.66, hz + 4, 76 * u, 70 * u, '#94a0a8', '#adbeb4');
    cone(g, w * 0.92, hz + 4, 100 * u, 112 * u, '#818c97', '#9ab0a4');
    rolling(g, w, hz + 2, 28 * u, 0.009, 3, '#9cc38a', hz + 4);
    fillV(g, 0, hz, w, h - hz, [[0, '#bfd97a'], [0.3, '#99c75e'], [0.7, '#73ad4a'], [1, '#5a913f']]);
    rolling(g, w, h * 0.66, 18 * u, 0.007, 8, 'rgba(120,180,80,0.55)', h * 0.72);
    const r = rngOf(4);
    for (let i = 0; i < 30; i++) {
      const k = r();
      ell(g, r() * w, hz + (h - hz) * (0.05 + k * 0.93), (8 + 24 * k) * u, (2.5 + 7 * k) * u, i % 2 ? 'rgba(70,130,55,0.45)' : 'rgba(205,225,120,0.5)');
    }
    laurel(g, w * 0.97, h * 0.72, 190 * u, '#4f8a4a', 0, 6);
    const q = rngOf(14);
    for (let i = 0; i < 18; i++) flower(g, q() * w, h * (0.68 + q() * 0.3), (9 + q() * 6) * u, ['#f6d34a', '#f2f2f2', '#e88fb0'][i % 3], 0, i);
  }
  function backVulkane(c, w, h, t) {
    stage(c, w, h, 'vulkane', paintVulkane);
    const u = h / 640;
    cloud(c, driftX(t, 3, w, 0.72), h * 0.13, 0.7 * u, 0.85);
    cloud(c, driftX(t, 2, w, 0.3), h * 0.24, 0.45 * u, 0.7);
    // grass tufts in the wind
    c.beginPath();
    const r = rngOf(3);
    for (let i = 0; i < 14; i++) {
      const x = r() * w;
      const y = h * (0.72 + r() * 0.26);
      const s = (10 + r() * 8) * u;
      const b = sin(t * 1.3 + i) * 3 * u;
      for (const d of [-3, 0, 3]) {
        c.moveTo(x + d * u, y);
        c.quadraticCurveTo(x + d * u, y - s * 0.6, x + d * 1.8 * u + b, y - s);
      }
    }
    c.strokeStyle = 'rgba(60,120,50,0.8)';
    c.lineWidth = 1.5 * u;
    c.lineCap = 'round';
    c.stroke();
  }
  function drawVulkan(c, t) {
    const pulse = 0.75 + sin(t * 0.9) * 0.25;
    const topY = -226;
    // smoke rising slowly and leaning with the wind
    for (let i = 0; i < 7; i++) {
      const p = wrap(t * 0.07 + i / 7, 1);
      const x = 6 + 62 * p + sin(p * 7 + i) * 7;
      const y = topY - 8 - 130 * p;
      const r = 11 + 27 * p;
      ell(c, x, y, r, r * 0.88, `rgba(238,235,230,${0.62 * (1 - p) * min(1, p * 8)})`);
    }
    c.fillStyle = grad(c, 0, topY, 0, 0, [[0, '#5d4b4d'], [0.4, '#776456'], [0.66, '#7f8f55'], [0.86, '#94bb5d'], [1, '#afd06c']]);
    c.beginPath();
    c.moveTo(-190, 4);
    c.quadraticCurveTo(-68, -80, -36, topY);
    c.quadraticCurveTo(0, topY - 8, 36, topY);
    c.quadraticCurveTo(68, -80, 190, 4);
    c.closePath();
    c.fill();
    // shaded side and gullies
    c.fillStyle = 'rgba(30,20,40,0.13)';
    c.beginPath();
    c.moveTo(6, topY);
    c.lineTo(36, topY);
    c.quadraticCurveTo(68, -92, 178, 0);
    c.lineTo(70, 0);
    c.quadraticCurveTo(26, -90, 6, topY);
    c.closePath();
    c.fill();
    c.beginPath();
    for (const [x0, cx, x1, y1] of [[-22, -40, -64, -64], [-6, -14, -24, -48], [16, 22, 40, -60]]) {
      c.moveTo(x0, topY + 12);
      c.quadraticCurveTo(cx, -130, x1, y1);
    }
    c.strokeStyle = 'rgba(40,28,28,0.2)';
    c.lineWidth = 2.6;
    c.lineCap = 'round';
    c.stroke();
    // crater with a soft glow
    const g = c.createRadialGradient(0, topY, 2, 0, topY, 74);
    g.addColorStop(0, `rgba(255,180,80,${0.7 * pulse})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = g;
    c.fillRect(-74, topY - 74, 148, 148);
    ell(c, 0, topY, 33, 9, '#3f2b2a');
    ell(c, 0, topY + 1, 25, 5.8, `rgb(255,${Math.round(140 + 50 * pulse)},70)`);
    // two thin, slow glowing threads down the flank
    curve(c, -14, topY + 7, -24, topY + 30, -22, topY + 52, `rgba(255,150,60,${0.8 * pulse})`, 3);
    curve(c, 14, topY + 7, 20, topY + 24, 30, topY + 38, `rgba(255,150,60,${0.65 * pulse})`, 2.4);
    // soft bushes round the foot, not a row of beads
    const bush = (x, y, s) => {
      blob(c, [[x - s * 1.6, y + s * 0.3], [x - s * 1.2, y - s * 0.7], [x - s * 0.2, y - s], [x + s * 0.9, y - s * 0.7], [x + s * 1.6, y + s * 0.3]], '#568f45');
      ell(c, x - s * 0.3, y - s * 0.45, s * 0.7, s * 0.34, '#71a854');
    };
    laurel(c, -214, 52, 150, '#5a964e', 0, 8);
    laurel(c, -160, 18, 84, '#6aa256', 0, 2);
    bush(-128, -6, 12);
    bush(-72, -16, 9);
    bush(-30, -5, 11);
    bush(78, -18, 8);
    bush(126, -7, 13);
  }
  function drawAlpen(c, t) {
    // the range grows very slowly, as it really did: a few millimetres a year
    c.scale(1, 1 + sin(t * 0.22) * 0.07);
    const P = [[-96, 58], [-46, 84], [10, 104], [62, 76], [102, 44]];
    for (let i = 0; i < P.length; i++) {
      const [x, ht] = P[i];
      const bw = ht * 0.95;
      c.fillStyle = grad(c, 0, -ht, 0, 2, ['#8ea4bb', '#afc5d0', '#c3d8d2']);
      poly(c, [[x - bw, 2], [x, -ht], [x + bw, 2]]);
      c.fill();
      c.fillStyle = grad(c, 0, -ht, 0, 2, ['rgba(40,60,90,0.2)', 'rgba(40,60,90,0)']);
      poly(c, [[x, -ht], [x + bw, 2], [x + bw * 0.1, 2]]);
      c.fill();
      const k = 0.34;
      const y2 = -ht + ht * k;
      const dx = bw * k;
      poly(c, [[x, -ht], [x + dx, y2], [x + dx * 0.45, y2 - 5], [x + dx * 0.12, y2 + 5], [x - dx * 0.3, y2 - 4], [x - dx * 0.62, y2 + 3], [x - dx, y2]], '#fbfdff');
    }
  }
  // Deinotherium: tall, long-legged, a short trunk and NO upper tusks; its two tusks grow from the lower jaw and bend down and back.
  function drawDeino(c, t, walk) {
    c.translate(-24, 0);
    const body = '#857b70';
    const dark = '#655c55';
    const foot = '#9a9085';
    const sw = sin(t * 1.0) * 2.5;
    const bob = stepBob(walk, 1.6);
    const tusk = '#f4ecd8';
    shadow(c, 10, 110, 8);
    tube(c, [[-82, -160 - bob, 4], [-92, -130 + sw, 2.6], [-92, -106 + sw * 1.4, 1.6]], dark);
    ell(c, -92, -102 + sw * 1.4, 3, 6.5, '#4a433d');
    stump(c, -36, -108 - bob, 108 + bob, 17, 11.5, gait(walk, PI, 0.22), dark, foot);
    stump(c, 46, -112 - bob, 112 + bob, 16, 11.5, gait(walk, 0, 0.22), dark, foot);
    c.translate(0, -bob);
    // far tusk
    tube(c, [[132, -128, 4.6], [144, -104, 4.8], [138, -82, 3.4], [122, -70, 1]], '#cfc6b0');
    // high shoulders, back falling away to the rump
    c.fillStyle = grad(c, 0, -214, 0, -100, [shade(body, 0.14), body, dark]);
    blob(c, [[-86, -134], [-82, -166], [-48, -184], [6, -204], [52, -210], [78, -190], [80, -146], [54, -108], [-14, -100], [-68, -106]]);
    c.fill();
    c.translate(0, bob);
    stump(c, -54, -112 - bob, 112 + bob, 19, 12.5, gait(walk, 0, 0.22), body, foot);
    stump(c, 30, -116 - bob, 116 + bob, 18, 12.5, gait(walk, PI, 0.22), body, foot);
    c.translate(0, -bob);
    // longer neck than an elephant's, small flat head
    tube(c, [[64, -172, 27], [92, -170, 19], [108, -168, 15]], body);
    blob(c, [[92, -184], [114, -190], [134, -176], [138, -154], [124, -140], [102, -142], [90, -160]], shade(body, 0.08));
    // chin, turning down towards the tusks
    tube(c, [[116, -146, 10], [122, -134, 8], [124, -126, 6.5]], dark);
    // the short trunk
    tube(c, [[134, -162, 10], [146, -142, 8], [150, -118 + sw * 0.5, 6], [146, -96 + sw, 4]], body);
    c.beginPath();
    for (const [x, y] of [[138, -150], [143, -134], [145, -118]]) {
      c.moveTo(x, y);
      c.lineTo(x + 13, y + 1);
    }
    c.strokeStyle = 'rgba(50,42,36,0.28)';
    c.lineWidth = 1.2;
    c.stroke();
    // near tusk: out of the lower jaw, down and bent back towards the chest
    tube(c, [[124, -126, 5.6], [130, -102, 5.8], [122, -78, 4.2], [104, -64, 1]], tusk);
    // not large ears: this was no African elephant
    blob(c, [[84, -180 + sw * 0.3], [100, -180], [104, -162], [96, -148], [82, -154 + sw * 0.3], [76, -168]], dark);
    blinkEye(c, 118, -170, 5.6, t, 6, body);
    curve(c, 132, -149, 126, -145, 120, -147, 'rgba(40,32,26,0.45)', 1.2);
  }

  // ================================================================== GLETSCHER
  function crack(g, x, y, L, d, lean, col) {
    poly(g, [[x - L, y + lean], [x - L * 0.55, y - d * 0.55], [x - L * 0.1, y - d], [x + L * 0.4, y - d * 0.45], [x + L, y - lean], [x + L * 0.35, y + d * 0.7], [x - L * 0.25, y + d * 0.5]], col);
    poly(g, [[x - L * 0.7, y - d * 0.42], [x - L * 0.1, y - d * 1.28], [x + L * 0.62, y - d * 0.55], [x - L * 0.1, y - d * 0.72]], 'rgba(255,255,255,0.85)');
  }
  function nunatak(g, x, y, s, seed) {
    const r = rngOf(seed);
    const a = (0.7 + r() * 0.3) * s;
    const pts = [[x - a, y], [x - a * 0.55, y - s * (0.3 + r() * 0.2)], [x - a * 0.18, y - s * (0.7 + r() * 0.2)], [x + a * 0.05, y - s], [x + a * 0.3, y - s * (0.6 + r() * 0.2)], [x + a * 0.62, y - s * (0.34 + r() * 0.1)], [x + a, y]];
    poly(g, pts, '#66778a');
    poly(g, [pts[3], pts[4], pts[5], pts[6], [x + a * 0.2, y]], '#536478');
    poly(g, [[x - a * 0.42, y - s * 0.56], pts[3], [x + a * 0.34, y - s * 0.56], [x + a * 0.14, y - s * 0.66], [x, y - s * 0.52], [x - a * 0.16, y - s * 0.66]], '#fafdff');
    ell(g, x, y, a * 1.15, s * 0.1, '#eaf6fb');
  }
  function paintGletscher(g, w, h, u) {
    const hz = h * 0.36;
    fillV(g, 0, 0, w, hz + 4, [[0, '#7fc2e8'], [0.65, '#cfe9f6'], [1, '#f3fbff']]);
    glow(g, w * 0.82, h * 0.1, 130 * u, '#ffffff', 0.8);
    for (const [x, s, q] of [[0.06, 48, 3], [0.36, 40, 5], [0.5, 66, 8], [0.66, 46, 6], [0.86, 72, 9], [0.97, 44, 2]]) nunatak(g, w * x, hz + 4, s * u, q);
    fillV(g, 0, hz, w, h - hz, [[0, '#f6fcff'], [0.3, '#d9f0f8'], [0.7, '#b0dcee'], [1, '#86c6e2']]);
    rolling(g, w, h * 0.5, 16 * u, 0.006, 3, 'rgba(255,255,255,0.45)', h * 0.56);
    rolling(g, w, h * 0.66, 20 * u, 0.008, 6, 'rgba(255,255,255,0.3)', h * 0.72);
    // crevasses, wider the nearer they are
    const r = rngOf(17);
    for (let i = 0; i < 24; i++) {
      const k = r();
      const y = h * (0.42 + k * 0.55);
      const x = r() * w;
      const L = (10 + k * 44) * u;
      const d = (1.4 + k * 6) * u;
      const lean = (r() - 0.5) * d * 1.5;
      crack(g, x, y, L, d, lean, i % 2 ? '#4fa6cf' : '#3a93c2');
    }
  }
  function backGletscher(c, w, h, t) {
    stage(c, w, h, 'gletscher', paintGletscher);
    const u = h / 640;
    cloud(c, driftX(t, 4, w, 0.25), h * 0.14, 0.7 * u, 0.7);
    cloud(c, driftX(t, 3, w, 0.7), h * 0.24, 0.5 * u, 0.55);
    // wind-blown snow crystals
    const r = rngOf(6);
    c.beginPath();
    for (let i = 0; i < 26; i++) {
      const x = wrap(r() * w + t * (16 + r() * 18) * u, w);
      const y = h * (0.18 + r() * 0.74) + sin(t + i) * 5 * u;
      const s = (0.9 + r() * 1.4) * u;
      c.moveTo(x + s, y);
      c.arc(x, y, s, 0, TAU);
    }
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fill();
  }
  // The Rhine glacier as a broad river of ice, with bands creeping downstream.
  function drawGletscherstrom(c, t) {
    const H = 250;
    // sweeps in from the upper right and leaves past the lower edge, like a frozen river
    const V0 = -0.62;
    const SPAN = 1 - V0;
    const cx = (v) => -44 + 126 * v - sin(v * PI) * 44;
    const hw = (v) => 212 * pow(1 - v, 1.15) + 30;
    const N = 26;
    // jagged white walls of broken ice along both banks
    const r = rngOf(4);
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const v = V0 + (i / N) * SPAN;
      const jag = (i % 2 ? 15 : 3) * (1.1 - v) + r() * 3;
      const x = cx(v) - hw(v) - jag;
      if (i) c.lineTo(x, -v * H);
      else c.moveTo(x, -v * H);
    }
    for (let i = N; i >= 0; i--) {
      const v = V0 + (i / N) * SPAN;
      const jag = (i % 2 ? 15 : 3) * (1.1 - v) + r() * 3;
      c.lineTo(cx(v) + hw(v) + jag, -v * H);
    }
    c.closePath();
    c.fillStyle = '#fafeff';
    c.fill();
    // the stream of blue ice inside
    c.beginPath();
    for (let i = 0; i <= N; i += 2) {
      const v = V0 + (i / N) * SPAN;
      if (i) c.lineTo(cx(v) - hw(v), -v * H);
      else c.moveTo(cx(v) - hw(v), -v * H);
    }
    for (let i = N; i >= 0; i -= 2) {
      const v = V0 + (i / N) * SPAN;
      c.lineTo(cx(v) + hw(v), -v * H);
    }
    c.closePath();
    c.fillStyle = grad(c, 0, -H, 0, -V0 * H, [[0, '#e6f7fc'], [0.3, '#b4e3f4'], [0.62, '#7cc9ec'], [1, '#4aa9dc']]);
    c.fill();
    // stones riding on the ice, the moraines that later built the shores
    c.beginPath();
    for (const k of [-0.52, 0.04, 0.56]) {
      for (let i = 0; i < 26; i++) {
        const v = V0 + wrap(i / 26 - t * 0.004 + k, 1) * SPAN;
        const x = cx(v) + hw(v) * (k + sin(i * 7.3) * 0.03);
        const y = -v * H;
        const rad = (0.6 + 3.2 * (1 - v)) * (0.6 + 0.4 * sin(i * 3.1) ** 2);
        c.moveTo(x + rad, y);
        c.arc(x, y, rad, 0, TAU);
      }
    }
    c.fillStyle = 'rgba(92,92,104,0.6)';
    c.fill();
    // bands of ice creeping towards the viewer
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const v = V0 + wrap(i / 9 - t * 0.008, 1) * SPAN;
      const x0 = cx(v) - hw(v) * 0.94;
      const x1 = cx(v) + hw(v) * 0.94;
      const y = -v * H;
      c.moveTo(x0, y - 6 * (1 - v));
      c.quadraticCurveTo(cx(v) - 12 * (1 - v), y + 34 * (1 - v) + 3, x1, y - 6 * (1 - v));
    }
    c.strokeStyle = 'rgba(245,253,255,0.5)';
    c.lineWidth = 3.4;
    c.lineCap = 'round';
    c.stroke();
    // deep blue cracks with bright lips
    for (const [x, y, L] of [[-150, -26, 44], [84, -30, 54], [-90, -76, 30], [60, -94, 24], [-24, -128, 19], [66, -170, 13], [18, -36, 28], [-60, 50, 56], [120, 76, 62]]) crack(c, x, y, L, L * 0.17, 0, '#1f73ae');
  }
  function drawFindling(c, t) {
    shadow(c, 8, 62, 7, 0.28);
    ell(c, 18, 1, 58, 6, 'rgba(40,110,170,0.35)');
    poly(c, [[-52, -2], [-58, -24], [-40, -50], [-10, -64], [26, -60], [50, -38], [58, -10], [46, -1]], '#7f7b78');
    poly(c, [[-10, -64], [26, -60], [50, -38], [58, -10], [46, -1], [14, -1], [6, -36]], '#676360');
    poly(c, [[-40, -50], [-10, -64], [6, -36], [-20, -26], [-58, -24]], '#99948f');
    poly(c, [[-26, -56], [-10, -64], [26, -60], [38, -49], [18, -48], [8, -54], [-8, -50]], '#fbfeff');
    dots(c, [[-34, -18, 4], [-20, -12, 3], [28, -24, 3.4], [-6, -22, 2.4]], '#a9ac6e');
    const glint = 0.5 + sin(t * 1.2) * 0.5;
    ell(c, 18, -56, 2, 2, `rgba(255,255,255,${glint})`);
  }
  function drawBergspitze(c, t) {
    poly(c, [[-70, 0], [-44, -40], [-26, -48], [-6, -96], [8, -112], [24, -82], [40, -66], [68, 0]], '#6c7d90');
    poly(c, [[8, -112], [24, -82], [40, -66], [68, 0], [14, 0], [2, -56]], '#53657a');
    poly(c, [[-30, -46], [-6, -96], [8, -112], [24, -82], [36, -66], [20, -70], [14, -58], [4, -72], [-8, -56], [-16, -62]], '#fcfeff');
    ell(c, 0, 1, 80, 9, '#eef8fc');
    ell(c, 0, 4, 66, 5, '#d6eef6');
    const a = 0.5 + 0.5 * sin(t * 0.8);
    ell(c, 6, -104, 2.2, 2.2, `rgba(255,255,255,${a})`);
  }

  // ================================================================== EISZEIT
  function iceWall(g, w, y, ht, u, seed) {
    const r = rngOf(seed);
    g.beginPath();
    g.moveTo(0, y + 8 * u);
    let x = 0;
    while (x < w + 30 * u) {
      g.lineTo(x, y - ht * (0.55 + r() * 0.45));
      x += (14 + r() * 26) * u;
    }
    g.lineTo(w, y + 8 * u);
    g.closePath();
    g.fillStyle = grad(g, 0, y - ht, 0, y + 6 * u, ['#fbfeff', '#d6ecf5', '#a9d3e6']);
    g.fill();
  }
  function paintEiszeit(g, w, h, u) {
    const hz = h * 0.45;
    fillV(g, 0, 0, w, hz + 2, [[0, '#9dd0ea'], [0.6, '#d9edf3'], [1, '#f7efda']]);
    glow(g, w * 0.3, h * 0.13, 130 * u, '#fff7d6', 0.8);
    ell(g, w * 0.3, h * 0.13, 19 * u, 19 * u, '#fffdf0');
    peaks(g, w, hz - 6 * u, 92 * u, 120 * u, 5, '#c0d3e1', 0.5);
    iceWall(g, w, hz, 42 * u, u, 3);
    fillV(g, 0, hz, w, h - hz, [[0, '#dcd79c'], [0.22, '#c8c47f'], [0.55, '#aab065'], [1, '#7d8a4b']]);
    // dry grass and dwarf shrubs
    const r = rngOf(8);
    for (let i = 0; i < 34; i++) {
      const k = r();
      const y = hz + (h - hz) * (0.05 + k * 0.95);
      const x = r() * w;
      const s = (9 + 28 * k) * u;
      ell(g, x, y, s, s * 0.28, i % 3 === 0 ? 'rgba(116,128,62,0.55)' : i % 3 === 1 ? 'rgba(226,218,150,0.55)' : 'rgba(160,150,84,0.5)');
    }
    g.beginPath();
    for (let i = 0; i < 90; i++) {
      const k = r();
      const y = hz + (h - hz) * (0.08 + k * 0.92);
      const x = r() * w;
      const s = (3 + 11 * k) * u;
      for (const d of [-1, 0, 1]) {
        g.moveTo(x + d * s * 0.25, y);
        g.lineTo(x + d * s * 0.55, y - s);
      }
    }
    g.strokeStyle = 'rgba(112,112,56,0.6)';
    g.lineWidth = 1.1 * u;
    g.stroke();
    for (let i = 0; i < 7; i++) {
      const k = r();
      const y = hz + (h - hz) * (0.1 + k * 0.8);
      const x = r() * w;
      const s = (10 + 18 * k) * u;
      ell(g, x, y - s * 0.3, s, s * 0.5, '#6e7f4d');
      ell(g, x - s * 0.3, y - s * 0.45, s * 0.55, s * 0.3, '#889a5c');
    }
    for (let i = 0; i < 6; i++) {
      const k = r();
      const s = (5 + 12 * k) * u;
      const x = r() * w;
      const y = hz + (h - hz) * (0.15 + k * 0.82);
      ell(g, x, y, s, s * 0.62, '#a39e93');
      ell(g, x - s * 0.2, y - s * 0.16, s * 0.56, s * 0.3, '#bdb8ae');
    }
  }
  function backEiszeit(c, w, h, t) {
    stage(c, w, h, 'eiszeit', paintEiszeit);
    const u = h / 640;
    cloud(c, driftX(t, 4, w, 0.6), h * 0.14, 0.7 * u, 0.7);
    // grass bending in the cold wind
    c.beginPath();
    const r = rngOf(9);
    for (let i = 0; i < 16; i++) {
      const x = r() * w;
      const y = h * (0.7 + r() * 0.29);
      const s = (12 + r() * 9) * u;
      const b = sin(t * 1.5 + i) * 3.5 * u + 2 * u;
      for (const d of [-3, 0, 3]) {
        c.moveTo(x + d * u, y);
        c.quadraticCurveTo(x + d * u, y - s * 0.6, x + d * 1.6 * u + b, y - s);
      }
    }
    c.strokeStyle = 'rgba(232,224,160,0.9)';
    c.lineWidth = 1.5 * u;
    c.lineCap = 'round';
    c.stroke();
    // a few flakes
    plankton(c, w, h * 0.1, h * 0.96, -t * 3, 18, 5, 'rgba(255,255,255,0.8)');
  }
  // Woolly mammoth: high domed head, shoulder hump, sloping back, shaggy wool, small ears, great curved tusks.
  function drawMammut(c, t, walk) {
    c.translate(-22, 0);
    const fur = '#8a5a32';
    const dark = '#68421f';
    const light = '#a8743f';
    const foot = '#b39a74';
    const bob = stepBob(walk, 1.6);
    const sw = sin(t * 1.0) * 3;
    const tusk = '#f6eed9';
    shadow(c, 10, 122, 8);
    tube(c, [[-90, -116 - bob, 4], [-99, -94 + sw * 0.5, 2.6], [-100, -78 + sw, 1.6]], dark);
    ell(c, -100, -72 + sw, 3.6, 8, '#3f2813');
    stump(c, -46, -84 - bob, 84 + bob, 20, 16.5, gait(walk, PI, 0.22), dark, foot);
    stump(c, 54, -86 - bob, 86 + bob, 20, 16.5, gait(walk, 0, 0.22), dark, foot);
    c.translate(0, -bob);
    // far tusk
    tube(c, [[92, -108, 5.6], [108, -74, 6.4], [142, -60, 5], [168, -82, 1.4]], '#d9cfb6');
    c.fillStyle = grad(c, 0, -190, 0, -56, [light, fur, dark]);
    blob(c, [[-94, -66], [-98, -112], [-74, -142], [-26, -160], [22, -180], [60, -170], [82, -132], [72, -82], [30, -56], [-42, -54]]);
    c.fill();
    c.translate(0, bob);
    stump(c, -66, -86 - bob, 86 + bob, 22, 18, gait(walk, 0, 0.22), fur, foot);
    stump(c, 34, -88 - bob, 88 + bob, 22, 18, gait(walk, PI, 0.22), fur, foot);
    dots(c, [[-74, -5, 2.6], [-64, -4, 2.6], [-54, -5, 2.6], [26, -5, 2.6], [36, -4, 2.6], [46, -5, 2.6]], '#e4d8bd');
    c.translate(0, -bob);
    // long shaggy skirt
    fringe(c, -88, -64, 66, -60, 22, 20, dark, t);
    strands(c, [[-74, -128, -6, 20], [-50, -142, -6, 22], [-22, -150, -6, 24], [6, -162, -6, 24], [30, -164, -4, 22], [-60, -100, -6, 22], [-30, -108, -6, 24], [0, -118, -6, 24], [28, -118, -4, 22], [52, -128, -3, 20], [-42, -74, -4, 16], [-8, -82, -4, 16], [28, -80, -3, 14]], 'rgba(60,36,16,0.45)', 2.2);
    // domed head
    c.fillStyle = grad(c, 0, -198, 0, -100, [light, fur]);
    blob(c, [[50, -172], [76, -200], [104, -184], [114, -148], [106, -116], [80, -102], [58, -122]]);
    c.fill();
    fringe(c, 62, -112, 92, -104, 7, 14, dark, t);
    blob(c, [[60, -166], [74, -168], [78, -152], [68, -142], [56, -150]], dark);
    // trunk
    tube(c, [[106, -130, 14], [118, -98, 11.5], [124, -62, 8.6], [118, -32, 6], [128 + sw * 0.5, -20, 4]], fur);
    c.beginPath();
    for (let i = 1; i < 8; i++) {
      const y = -130 + i * 13;
      const x = 106 + i * 2.6;
      c.moveTo(x - 7, y);
      c.lineTo(x + 8, y + 1.5);
    }
    c.strokeStyle = 'rgba(55,32,14,0.35)';
    c.lineWidth = 1.5;
    c.stroke();
    // near tusk, big and gently curved
    tube(c, [[100, -112, 6.6], [116, -76, 7.4], [150, -62, 5.8], [178, -88, 1.5]], tusk);
    blinkEye(c, 94, -152, 6, t, 7, fur);
    curve(c, 92, -141, 97, -138, 102, -141, 'rgba(50,28,12,0.4)', 1.2);
  }
  // Woolly rhinoceros: low head, shoulder hump, two horns (long front horn), thick rusty wool.
  function drawWollnashorn(c, t, walk) {
    c.translate(-12, 0);
    const fur = '#9c7040';
    const dark = '#76522c';
    const light = '#b9894f';
    const bob = stepBob(walk, 1.4);
    const nod = sin(t * 0.8) * 1.5;
    shadow(c, 4, 96, 6);
    tube(c, [[-88, -66 - bob, 3], [-98, -56, 2], [-100, -46, 1.2]], dark);
    ell(c, -100, -42, 2.6, 5, '#4a3119');
    stump(c, -44, -44 - bob, 44 + bob, 15, 12, gait(walk, PI, 0.26), dark, '#5c4023');
    stump(c, 36, -44 - bob, 44 + bob, 15, 12, gait(walk, 0, 0.26), dark, '#5c4023');
    c.translate(0, -bob);
    c.fillStyle = grad(c, 0, -116, 0, -30, [light, fur, dark]);
    blob(c, [[-94, -40], [-96, -76], [-62, -94], [-14, -98], [22, -116], [52, -102], [66, -70], [50, -40], [-20, -28], [-74, -30]]);
    c.fill();
    c.translate(0, bob);
    stump(c, -58, -44 - bob, 44 + bob, 16.5, 13, gait(walk, 0, 0.26), fur, '#5c4023');
    stump(c, 24, -44 - bob, 44 + bob, 16.5, 13, gait(walk, PI, 0.26), fur, '#5c4023');
    c.translate(0, -bob);
    fringe(c, -82, -36, 50, -36, 18, 14, dark, t);
    strands(c, [[-74, -74, -5, 18], [-48, -82, -5, 20], [-20, -86, -5, 22], [8, -96, -5, 24], [30, -100, -4, 24], [-58, -54, -4, 14], [-26, -58, -4, 16], [8, -62, -4, 16], [40, -74, -3, 18]], 'rgba(62,40,18,0.45)', 2);
    c.save();
    c.translate(0, nod);
    // head
    c.fillStyle = grad(c, 0, -90, 0, -26, [light, fur]);
    blob(c, [[44, -86], [70, -88], [96, -72], [110, -48], [106, -28], [80, -24], [56, -38], [42, -62]]);
    c.fill();
    fringe(c, 56, -32, 86, -24, 7, 9, dark, t);
    // back horn, then the great front horn
    tube(c, [[80, -68, 5.6], [86, -80, 3.6], [90, -92, 0.8]], '#6a553d');
    tube(c, [[98, -52, 8], [112, -74, 5], [126, -92, 2.6], [138, -108, 0.8]], '#7d6548');
    tube(c, [[100, -54, 3], [112, -74, 1.8], [124, -90, 0.8]], 'rgba(255,240,210,0.25)');
    poly(c, [[52, -84], [46, -104], [64, -88]], dark);
    poly(c, [[54, -86], [50, -98], [60, -88]], '#e8c9a0');
    blinkEye(c, 76, -60, 5, t, 8, fur);
    curve(c, 106, -36, 98, -30, 90, -33, 'rgba(50,30,14,0.6)', 1.4);
    ell(c, 104, -44, 1.5, 1.2, 'rgba(40,24,10,0.7)');
    c.restore();
  }
  // One reindeer; both sexes carry antlers. Pale neck mane, broad hooves.
  function reindeer(c, t, walk, seed, body, dark, full) {
    const bob = stepBob(walk, 1.3);
    const nod = sin(t * 0.7 + seed) * 1.4;
    shank(c, 22, -48 - bob, 23, 25 + bob, 5, 2.4, gait(walk, seed, 0.45), 0.08, dark, '#3f3327');
    shank(c, -26, -48 - bob, 24, 24 + bob, 6, 2.4, gait(walk, seed + PI, 0.45), -0.15, dark, '#3f3327');
    tube(c, [[-36, -60 - bob, 12], [-12, -62 - bob, 15], [14, -64 - bob, 15], [30, -80 - bob, 9.5], [40, -94 - bob + nod, 7.5]], body);
    if (full) tube(c, [[-34, -52 - bob, 4], [-10, -52 - bob, 6], [14, -54 - bob, 6]], '#e7dcc3');
    // pale mane along the throat
    if (full) fringe(c, 22, -62 - bob, 38, -84 - bob, 6, 11, '#efe7d4', t);
    ell(c, -42, -68 - bob, 5, 4, '#efe7d4');
    shank(c, 16, -50 - bob, 25, 25 + bob, 5.4, 2.6, gait(walk, seed + PI, 0.45), 0.08, body, '#3f3327');
    shank(c, -20, -50 - bob, 26, 24 + bob, 6.4, 2.6, gait(walk, seed, 0.45), -0.15, body, '#3f3327');
    c.save();
    c.translate(44, -97 - bob + nod);
    // antlers: a sweeping beam with tines, one drawing call
    c.beginPath();
    for (const [x0, y0, cx, cy, x1, y1] of [[-2, -6, -18, -26, -14, -50], [-14, -50, -12, -62, 4, -66], [-14, -36, -4, -40, 2, -50], [-12, -48, -22, -52, -28, -60], [-2, -6, 8, -10, 16, -22], [4, -9, 12, -9, 20, -12]]) {
      c.moveTo(x0, y0);
      c.quadraticCurveTo(cx, cy, x1, y1);
    }
    c.strokeStyle = '#cdb78d';
    c.lineWidth = full ? 3 : 2.4;
    c.lineCap = 'round';
    c.stroke();
    blob(c, [[-8, 3], [-7, -7], [4, -8], [12, -2], [21, 4], [19, 10], [8, 9], [-4, 8]], body);
    ell(c, 18, 6.5, 4.6, 3.8, '#e7dcc3');
    poly(c, [[-5, -5], [-14, -11], [-5, -1]], dark);
    blinkEye(c, 3, -1.5, full ? 4.4 : 3.6, t, seed, body);
    curve(c, 19, 8.5, 14, 10, 9, 8.6, 'rgba(50,35,20,0.6)', 1);
    ell(c, 21, 4.5, 1.5, 1.3, '#2b2018');
    c.restore();
  }
  function drawRentier(c, t, walk) {
    shadow(c, 0, 66, 5);
    c.save();
    c.translate(-46, -8);
    c.scale(0.68, 0.68);
    reindeer(c, t, walk, 2.1, '#8c7a63', '#675644', false);
    c.restore();
    c.save();
    c.translate(44, -6);
    c.scale(0.58, 0.58);
    reindeer(c, t, walk, 4.2, '#9a8870', '#6f5e4a', false);
    c.restore();
    reindeer(c, t, walk, 0.4, '#a3907a', '#6f5e4b', true);
  }
  // Wild horse as drawn in the caves near Lake Constance: stocky and dun, stiff dark mane, dark legs, pale muzzle.
  function drawWildpferd(c, t, walk) {
    const body = '#c49a62';
    const dark = '#4a3a2b';
    const bob = stepBob(walk, 1.5);
    const tw = sin(t * 1.2) * 3;
    const nod = sin(t * 0.8) * 1.5;
    c.translate(-6, 0);
    shadow(c, 2, 60, 5);
    shank(c, 24, -46 - bob, 22, 24 + bob, 5.4, 2.6, gait(walk, 0.4, 0.45), 0.1, dark, '#2d241b');
    shank(c, -30, -46 - bob, 23, 23 + bob, 6, 2.6, gait(walk, PI + 0.4, 0.45), -0.15, dark, '#2d241b');
    tube(c, [[-46, -66 - bob, 4], [-58, -54 - bob + tw * 0.5, 5.4], [-62, -34 - bob + tw, 3]], dark);
    c.fillStyle = grad(c, 0, -100, 0, -40, ['#d3ab74', body, '#e6cfa2']);
    tube(c, [[-42, -60 - bob, 14], [-14, -62 - bob, 17], [16, -64 - bob, 16], [32, -80 - bob, 10.5], [44, -94 - bob + nod, 8]]);
    c.fill();
    // stiff upright mane and back stripe
    c.beginPath();
    c.moveTo(14, -80 - bob);
    for (let i = 0; i <= 7; i++) {
      const u = i / 7;
      const x = 14 + 28 * u;
      const y = -80 - 25 * u - bob + nod * u;
      c.lineTo(x - 5, y - 8);
      c.lineTo(x + 1, y);
    }
    c.lineTo(48, -102 - bob + nod);
    c.lineTo(20, -70 - bob);
    c.closePath();
    c.fillStyle = dark;
    c.fill();
    curve(c, -46, -73 - bob, -16, -80 - bob, 14, -78 - bob, 'rgba(60,44,28,0.75)', 2.6);
    shank(c, 18, -48 - bob, 23, 25 + bob, 5.8, 2.8, gait(walk, PI + 0.4, 0.45), 0.1, body, '#2d241b', dark);
    shank(c, -24, -48 - bob, 24, 24 + bob, 7, 2.8, gait(walk, 0.4, 0.45), -0.15, body, '#2d241b', dark);
    c.save();
    c.translate(48, -96 - bob + nod);
    poly(c, [[-6, -6], [-10, -16], [-1, -8]], body);
    blob(c, [[-8, 4], [-7, -7], [4, -9], [14, 0], [25, 10], [23, 17], [12, 16], [2, 10]], body);
    blob(c, [[12, 7], [25, 10], [24, 18], [12, 17], [8, 12]], '#f0e3c4');
    blinkEye(c, 3, -1.5, 4.6, t, 9, body);
    ell(c, 21, 11, 1.4, 1.2, '#3a2c1f');
    curve(c, 23, 15, 19, 16.5, 14, 15.2, 'rgba(50,35,20,0.65)', 1);
    c.restore();
  }
  // Friendly face in profile used by all people. x,y = centre of the head, r = radius.
  function face(c, x, y, r, skin, t, seed) {
    ell(c, x, y, r, r * 1.06, skin);
    ell(c, x + r * 0.96, y + r * 0.12, r * 0.14, r * 0.2, shade(skin, -0.1));
    const blink = wrap(t + seed, 3.9) < 0.12;
    if (blink) curve(c, x + r * 0.22, y - r * 0.1, x + r * 0.46, y + r * 0.04, x + r * 0.7, y - r * 0.1, '#2b211a', r * 0.11);
    else {
      ell(c, x + r * 0.46, y - r * 0.12, r * 0.15, r * 0.19, '#2b211a');
      ell(c, x + r * 0.5, y - r * 0.2, r * 0.05, r * 0.05, '#fff');
    }
    curve(c, x + r * 0.2, y + r * 0.42, x + r * 0.46, y + r * 0.62, x + r * 0.72, y + r * 0.36, '#8c4a34', r * 0.09);
    ell(c, x + r * 0.08, y + r * 0.26, r * 0.2, r * 0.13, 'rgba(235,120,90,0.32)');
  }
  // Legs and shoes for a walking person. Hip at -38.
  function strideLegs(c, walk, near, far, shoe, bob) {
    const sw = gait(walk, 0, 0.5);
    const leg = (a, col) => {
      c.save();
      c.translate(0, -38 - bob);
      c.rotate(a);
      box(c, -4.8, 0, 9.6, 30, col, 4);
      box(c, -5.4, 29, 15, 8.4 + bob, shoe, 3.6);
      c.restore();
    };
    leg(-sw, far);
    leg(sw, near);
  }
  function armAt(c, x, y, a, len, wd, col, hand) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    box(c, -wd / 2, 0, wd, len, col, wd / 2);
    ell(c, 0, len + 1, wd * 0.52, wd * 0.52, hand);
    c.restore();
  }
  // Ice age hunter: fur clothes, long braid, a spear held straight up; she is out walking, not hunting anyone here.
  function drawJaegerin(c, t, walk) {
    const bob = stepBob(walk, 1.5);
    const fur = '#94683f';
    const dark = '#6f4a2a';
    const trim = '#ece1c9';
    const skin = '#e9bd96';
    shadow(c, 0, 22, 3.4);
    // spear, always upright and held steady
    const sx = 17;
    line(c, [[sx, -2], [sx, -118 - bob]], '#7b5a36', 2.8);
    poly(c, [[sx - 4.2, -116 - bob], [sx, -132 - bob], [sx + 4.2, -116 - bob], [sx, -112 - bob]], '#8c8f94');
    strideLegs(c, walk, '#7a5533', '#5f4128', '#4c3320', bob);
    armAt(c, -3, -74 - bob, -gait(walk, 0, 0.3) + 0.1, 28, 8.4, dark, skin);
    // braid behind the head
    tube(c, [[-10, -94 - bob, 4], [-15, -80 - bob, 3.4], [-14, -66 - bob + sin(t * 2) * 1, 2]], '#3b2a1e');
    blob(c, [[-13, -78 - bob], [13, -78 - bob], [16, -48 - bob], [16, -32 - bob], [-16, -32 - bob], [-15, -50 - bob]], fur);
    // shaggy hem and collar
    c.save();
    c.translate(0, -bob);
    fringe(c, -16, -36, 16, -36, 8, 7, trim, t);
    c.restore();
    box(c, -15.5, -54 - bob, 31, 4, dark);
    dots(c, [[-8, -52 - bob, 1.2], [0, -52 - bob, 1.2], [8, -52 - bob, 1.2]], '#d7b85e');
    face(c, 1, -92 - bob, 13.4, skin, t, 1);
    // hair and fur hood pushed back
    c.beginPath();
    c.arc(0, -94 - bob, 14, PI * 0.82, PI * 1.72);
    c.quadraticCurveTo(-2, -99 - bob, -9, -84 - bob);
    c.closePath();
    c.fillStyle = '#3b2a1e';
    c.fill();
    tube(c, [[-13, -80 - bob, 6], [0, -77 - bob, 6.5], [13, -80 - bob, 5.4]], trim);
    // arm reaching over to the spear
    armAt(c, 2, -72 - bob, -1.0, 21, 8.6, fur, skin);
  }
  function drawHase(c, t, walk) {
    const hop = walk ? abs(sin(walk * 0.5)) * 11 : 0;
    const twitch = sin(t * 5) * 0.6;
    const ear = sin(t * 0.7) * 0.08;
    ell(c, 0, 0.5, 19 - hop * 0.3, 3, 'rgba(40,30,15,0.2)');
    c.translate(0, -hop);
    ell(c, -19, -15, 5.4, 5.4, '#f7fbfc');
    ell(c, -12, -3, 13, 3.8, '#e7eef1');
    c.fillStyle = grad(c, 0, -32, 0, -2, ['#ffffff', '#dfe8ec']);
    blob(c, [[-18, -8], [-19, -22], [-6, -30], [10, -26], [14, -12], [8, -2], [-12, -1]]);
    c.fill();
    ell(c, 9, -3.5, 7, 3, '#eef3f5');
    c.save();
    c.translate(11, -30);
    c.save();
    c.rotate(-0.38 + ear);
    blob(c, [[-4, 0], [-4.6, -18], [-1, -27], [3, -18], [3.6, 0]], '#f7fbfc');
    blob(c, [[-3.4, -19], [-1, -27], [2.4, -19], [-0.6, -21]], '#2a2622');
    c.restore();
    c.save();
    c.rotate(-0.12 - ear);
    blob(c, [[-3, 0], [-3.4, -17], [0.5, -26], [4, -17], [4, 0]], '#ffffff');
    blob(c, [[-2.6, -18], [0.5, -26], [3.4, -18], [0.4, -20]], '#2a2622');
    ell(c, 0.5, -9, 1.5, 6, '#f6d7d6');
    c.restore();
    c.restore();
    blob(c, [[0, -24], [4, -35], [15, -36], [24, -28], [24, -20], [13, -15], [2, -16]], '#ffffff');
    blinkEye(c, 12.5, -28, 4.2, t, 10, '#ffffff');
    ell(c, 24, -24.5 + twitch * 0.5, 2, 1.5, '#e79aa2');
    curve(c, 22, -20.5, 19.5, -19, 17, -20.5, 'rgba(70,50,50,0.55)', 0.9);
  }

  // ================================================================== SEE ENTSTEHT
  const FLOES = [[0.1, 0.5, 26, 7], [0.3, 0.45, 14, 4], [0.5, 0.56, 22, 7], [0.2, 0.58, 12, 4], [0.78, 0.5, 16, 5]];
  function paintSee(g, w, h, u) {
    const hz = h * 0.41;
    const shore = h * 0.63;
    fillV(g, 0, 0, w, hz + 4, [[0, '#6dc5ef'], [0.6, '#c6edf6'], [1, '#fbf8e2']]);
    glow(g, w * 0.2, h * 0.12, 140 * u, '#fff7cc', 0.85);
    ell(g, w * 0.2, h * 0.12, 22 * u, 22 * u, '#fffde8');
    peaks(g, w, hz + 4, 150 * u, 130 * u, 7, '#a9c1d3', 0.42);
    peaks(g, w, hz + 4, 84 * u, 96 * u, 13, '#8aa9be', 0.28);
    // the old glacier, shrinking back into its valley
    const gx = w * 0.72;
    g.fillStyle = grad(g, 0, hz - 116 * u, 0, hz + 6 * u, ['#ffffff', '#d7f0f8', '#9cd4e8']);
    blob(g, [[gx - 130 * u, hz + 8 * u], [gx - 80 * u, hz - 26 * u], [gx - 16 * u, hz - 86 * u], [gx + 50 * u, hz - 120 * u], [gx + 90 * u, hz - 60 * u], [gx + 150 * u, hz + 8 * u]]);
    g.fill();
    g.beginPath();
    g.moveTo(gx - 150 * u, hz + 7 * u);
    let x = gx - 150 * u;
    let up = true;
    const r0 = rngOf(2);
    while (x < gx + 160 * u) {
      x += (5 + r0() * 8) * u;
      g.lineTo(x, hz + (up ? -10 - r0() * 8 : 1) * u);
      up = !up;
    }
    g.lineTo(gx + 160 * u, hz + 7 * u);
    g.closePath();
    g.fillStyle = '#c4e9f4';
    g.fill();
    for (const [dx, dy, L] of [[-40, -18, 24], [20, -50, 20], [52, -22, 26], [-4, -6, 22]]) line(g, [[gx + (dx - L) * u, hz + (dy + 3) * u], [gx + dx * u, hz + dy * u], [gx + (dx + L) * u, hz + (dy + 2) * u]], 'rgba(80,160,200,0.6)', 2 * u);
    // the great bright lake
    fillV(g, 0, hz, w, shore - hz + 16 * u, [[0, '#dcf6f3'], [0.2, '#a4e6e4'], [0.6, '#63d0da'], [1, '#42b9cb']]);
    // the new shore, stones first and young green behind them
    g.fillStyle = '#ddd2b2';
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= w + 14; i += 14) g.lineTo(i, shore + wave(i * 0.012 + 2) * 9 * u);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.fillStyle = grad(g, 0, shore, 0, h, ['#b9cc7d', '#9fbb68', '#7fa353', '#6c8f49']);
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= w + 14; i += 14) g.lineTo(i, shore + 12 * u + wave(i * 0.012 + 2) * 9 * u + wave(i * 0.04) * 4 * u);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    const r = rngOf(12);
    for (let i = 0; i < 26; i++) {
      const k = r();
      const y = shore + (h - shore) * (0.15 + k * 0.85);
      const px = r() * w;
      const s = (5 + 18 * k) * u;
      ell(g, px, y, s, s * 0.3, i % 3 === 0 ? 'rgba(85,125,60,0.5)' : i % 3 === 1 ? 'rgba(215,225,150,0.55)' : 'rgba(235,240,240,0.75)');
    }
    for (let i = 0; i < 9; i++) {
      const k = r();
      const s = (4 + 10 * k) * u;
      const px = r() * w;
      const y = shore + (h - shore) * (0.08 + k * 0.85);
      ell(g, px, y, s, s * 0.62, '#aaa59a');
      ell(g, px - s * 0.2, y - s * 0.18, s * 0.55, s * 0.3, '#c8c3b8');
    }
    const q = rngOf(14);
    for (let i = 0; i < 10; i++) flower(g, q() * w, shore + (h - shore) * (0.2 + q() * 0.7), (8 + q() * 5) * u, i % 2 ? '#f4f0dd' : '#f2d35b', 0, i);
    // young birches far along the shore
    for (const [px, s] of [[0.05, 62], [0.1, 44], [0.42, 36], [0.48, 48], [0.64, 40]]) {
      const bx = w * px;
      const by = shore + 6 * u;
      tube(g, [[bx, by, 1.6 * u], [bx + 1, by - s * u * 0.8, 0.7 * u]], '#efece3');
      ell(g, bx, by - s * u * 0.72, s * u * 0.2, s * u * 0.34, '#9cc66a');
      ell(g, bx - s * u * 0.05, by - s * u * 0.82, s * u * 0.12, s * u * 0.2, '#b8d87f');
    }
  }
  function backSee(c, w, h, t) {
    stage(c, w, h, 'see', paintSee);
    const u = h / 640;
    cloud(c, driftX(t, 3, w, 0.45), h * 0.15, 0.7 * u, 0.85);
    glitter(c, w, h * 0.42, h * 0.62, t, 22, 4, 'rgba(255,255,255,0.75)', 11 * u);
    // ice floes drifting slowly away
    for (let i = 0; i < FLOES.length; i++) {
      const [fx, fy, a, b] = FLOES[i];
      const x = wrap(fx * w + t * (1.2 + i * 0.3) * u, w + 40 * u) - 20 * u;
      const y = h * fy + sin(t * 0.7 + i) * 1.2 * u;
      blob(c, [[x - a * u, y], [x - a * 0.5 * u, y - b * u], [x + a * 0.5 * u, y - b * u * 0.9], [x + a * u, y], [x, y + b * u * 0.5]], '#f6fcff');
      ell(c, x, y + 1 * u, a * 0.8 * u, b * 0.3 * u, 'rgba(90,170,200,0.4)');
    }
    // melt drops along the ice front
    const gx = w * 0.72;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const p = wrap(t * 0.5 + i * 0.37, 1);
      const x = gx + (i - 2.5) * 44 * u;
      const y = h * 0.41 - 6 * u + p * 13 * u;
      c.moveTo(x + 1.5 * u, y);
      c.arc(x, y, 1.5 * u, 0, TAU);
    }
    c.fillStyle = 'rgba(120,200,235,0.9)';
    c.fill();
  }
  // Meltwater running from a last block of ice towards the new lake.
  const BACH = [[-44, -8, 9], [-8, -22, 15], [36, -44, 12.5], [18, -78, 9], [46, -106, 6.5], [32, -140, 5]];
  function drawSchmelzwasser(c, t) {
    dots(c, [[-30, -24, 5], [-2, -38, 4], [60, -38, 5], [58, -58, 3.4], [6, -62, 3], [28, -92, 2.6], [66, -94, 2.8], [24, -118, 2], [54, -124, 2]], '#b3ad9f');
    dots(c, [[-32, -26, 2.6], [-3, -40, 2], [59, -40, 2.6]], '#d4cfc4');
    tube(c, BACH.map((p) => [p[0], p[1], p[2] + 4]), '#d7cfae');
    c.fillStyle = grad(c, 0, -140, 0, 0, ['#8fe0ea', '#4fc0e0', '#35a4d4']);
    tube(c, BACH);
    c.fill();
    // light running down the stream, towards the lake
    c.beginPath();
    const n = BACH.length - 1;
    for (let i = 0; i < 11; i++) {
      const p = wrap(i / 11 + t * 0.09, 1) * n;
      const k = Math.floor(p);
      const f = p - k;
      const a = BACH[k];
      const b = BACH[k + 1];
      const x = a[0] + (b[0] - a[0]) * f + sin(i * 2.3) * a[2] * 0.45;
      const y = a[1] + (b[1] - a[1]) * f;
      const l = a[2] * 0.35;
      c.moveTo(x - l, y);
      c.lineTo(x + l, y - 1);
    }
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1.7;
    c.lineCap = 'round';
    c.stroke();
    // the last ice block with a dripping edge
    ell(c, -58, 0, 34, 5, 'rgba(40,90,110,0.22)');
    c.fillStyle = grad(c, 0, -46, 0, 0, ['#ffffff', '#cdeaf4', '#8fcde4']);
    blob(c, [[-88, -2], [-90, -24], [-70, -44], [-46, -42], [-30, -24], [-28, -2]]);
    c.fill();
    poly(c, [[-70, -40], [-52, -38], [-58, -16], [-72, -20]], 'rgba(255,255,255,0.55)');
    const d = wrap(t * 0.6, 1);
    ell(c, -33, -16 + d * 13, 1.8, 2.5, 'rgba(90,190,230,0.9)');
  }
  function birch(c, x, h, lean, t, seed) {
    const sw = sin(t * 0.9 + seed) * h * 0.012;
    const tx = x + lean + sw;
    const r = rngOf(seed * 31 + 3);
    // airy crown behind the stem
    for (let i = 0; i < 5; i++) ell(c, tx + (r() - 0.5) * h * 0.42 + sw, -h * (0.46 + r() * 0.46), h * (0.09 + r() * 0.05), h * (0.07 + r() * 0.04), i % 2 ? '#8fbf5e' : '#a6d06f');
    tube(c, [[x, 0, h * 0.03], [x + lean * 0.4, -h * 0.5, h * 0.02], [tx, -h * 0.9, h * 0.005]], '#f6f3ea');
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const k = 0.05 + i * 0.09;
      const px = x + lean * k * 0.8;
      const rw = h * 0.03 * (1 - k * 0.6);
      c.moveTo(px - rw * (i % 2 ? 1 : 0.1), -h * k);
      c.lineTo(px + rw * (i % 2 ? 0.1 : 1), -h * k - 1);
    }
    c.strokeStyle = '#2f2c28';
    c.lineWidth = 1.7;
    c.lineCap = 'round';
    c.stroke();
    // thin hanging twigs and bright leaves in front
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const k = 0.5 + i * 0.09;
      const px = x + lean * k * 0.8 + sw * k;
      const d = i % 2 ? 1 : -1;
      c.moveTo(px, -h * k);
      c.quadraticCurveTo(px + d * h * 0.09, -h * k - h * 0.01, px + d * h * 0.13, -h * k + h * 0.07);
    }
    c.strokeStyle = 'rgba(90,60,40,0.55)';
    c.lineWidth = 1;
    c.stroke();
    const list = [];
    for (let i = 0; i < 26; i++) list.push([tx + (r() - 0.5) * h * 0.56 + sw * 1.5, -h * (0.38 + r() * 0.58), h * 0.012 + r() * 1.6]);
    dots(c, list, '#c6e38a');
  }
  function drawBirke(c, t) {
    shadow(c, 0, 50, 5);
    birch(c, 22, 112, 6, t, 3);
    birch(c, -10, 186, -7, t, 1);
    ell(c, 2, -1, 36, 5, '#7fa353');
  }
  // Common crane: long dark legs, grey body, drooping tail plumes, black and white neck, red crown.
  function drawKranich(c, t, walk) {
    const bob = stepBob(walk, 1.2);
    const pk = walk ? 0 : max(0, sin(t * 0.5)) ** 8;
    shadow(c, -2, 32, 3.6);
    const leg = (a, col) => {
      shank(c, 0, -74 - bob, 38, 36 + bob, 2.6, 1.7, a, -0.12, col);
      const fx = sin(a) * 38 + sin(a - 0.12) * (36 + bob);
      line(c, [[fx, -2], [fx + 8, -1]], col, 2);
    };
    leg(gait(walk, PI, 0.42), '#3e3a38');
    // drooping plumes
    blob(c, [[-16, -102 - bob], [-44, -96 - bob], [-62, -66 - bob], [-54, -58 - bob], [-30, -66 - bob], [-14, -72 - bob]], '#4e555e');
    c.fillStyle = grad(c, 0, -112, 0, -62, ['#d4d8db', '#a9b0b6']);
    blob(c, [[-40, -74 - bob], [-28, -104 - bob], [6, -112 - bob], [28, -100 - bob], [28, -78 - bob], [6, -64 - bob], [-24, -64 - bob]]);
    c.fill();
    leg(gait(walk, 0, 0.42), '#514c49');
    const hy = -158 - bob + 26 * pk + sin(t * 0.9);
    const hx = 40 + 8 * pk;
    tube(c, [[22, -96 - bob, 8.5], [32, -118 - bob, 5.4], [28, -140 - bob + 14 * pk, 4.2], [hx, hy, 4.2]], '#c7ccd0');
    tube(c, [[32, -118 - bob, 3.2], [28, -140 - bob + 14 * pk, 3.6], [hx - 1, hy + 2, 3.4]], '#2c2c2e');
    curve(c, 27, -112 - bob, 22, -138 - bob + 14 * pk, hx - 6, hy + 2, '#f5f6f5', 2.4);
    c.save();
    c.translate(hx, hy);
    blob(c, [[-6, 2], [-5, -5], [2, -7], [8, -3], [24, 1], [24, 3], [7, 4], [-1, 5]], '#2c2c2e');
    poly(c, [[7, -2.6], [26, 1.4], [8, 3.6]], '#cfc7a0');
    ell(c, -1, -6, 5, 2.8, '#d63a30');
    blinkEye(c, 1, -1.2, 3.8, t, 4, '#2c2c2e');
    c.restore();
  }

  // ================================================================== PFAHLBAU
  function hut(g, x, y, s) {
    g.fillStyle = 'rgba(40,80,80,0.2)';
    g.fillRect(x - 18 * s, y, 36 * s, 11 * s);
    g.fillStyle = '#6a4e33';
    for (let i = 0; i < 5; i++) g.fillRect(x + (-17 + i * 8) * s, y - 15 * s, 2.2 * s, 16 * s);
    box(g, x - 21 * s, y - 16 * s, 42 * s, 3 * s, '#7f5f3f');
    box(g, x - 15 * s, y - 31 * s, 30 * s, 15 * s, '#d2bc92');
    box(g, x + 2 * s, y - 27 * s, 7 * s, 11 * s, '#6a4e33');
    poly(g, [[x - 21 * s, y - 29 * s], [x, y - 48 * s], [x + 21 * s, y - 29 * s]], '#bf9c56');
    poly(g, [[x, y - 48 * s], [x + 21 * s, y - 29 * s], [x + 5 * s, y - 29 * s]], '#a78547');
  }
  function paintPfahlbau(g, w, h, u) {
    const hz = h * 0.41;
    const shore = h * 0.76;
    fillV(g, 0, 0, w, hz + 3, [[0, '#7fcdec'], [0.6, '#cdecf2'], [1, '#fdf2d3']]);
    glow(g, w * 0.84, h * 0.13, 130 * u, '#fff3c0', 0.85);
    ell(g, w * 0.84, h * 0.13, 21 * u, 21 * u, '#fffbe2');
    rolling(g, w, hz + 2, 62 * u, 0.005, 2, '#a4c7bd', hz + 3);
    rolling(g, w, hz + 2, 36 * u, 0.009, 6, '#7fb08d', hz + 3);
    // wooded far shore
    const r0 = rngOf(23);
    for (let i = 0; i < 26; i++) ell(g, r0() * w, hz - r0() * 5 * u, (9 + r0() * 11) * u, (6 + r0() * 7) * u, i % 2 ? '#5f9a6b' : '#6fa775');
    fillV(g, 0, hz, w, shore - hz + 20 * u, [[0, '#c5ece7'], [0.25, '#8dd8d8'], [0.7, '#4fb9c6'], [1, '#3aa6b6']]);
    for (const [x, y, s] of [[0.06, 0.5, 0.82], [0.17, 0.48, 0.66], [0.62, 0.47, 0.6], [0.71, 0.49, 0.74], [0.8, 0.47, 0.62], [0.93, 0.5, 0.84]]) hut(g, w * x, h * y, s * u);
    // the near shore
    g.fillStyle = '#e8d7a9';
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= w + 14; i += 14) g.lineTo(i, shore + wave(i * 0.01 + 1) * 8 * u);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.fillStyle = grad(g, 0, shore, 0, h, ['#a9cb6a', '#7fb04f', '#5f9140']);
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= w + 14; i += 14) g.lineTo(i, shore + 14 * u + wave(i * 0.01 + 1) * 8 * u + wave(i * 0.05) * 3 * u);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    const r = rngOf(6);
    for (let i = 0; i < 16; i++) {
      const y = shore + (h - shore) * (0.2 + r() * 0.8);
      const s = (8 + r() * 16) * u;
      ell(g, r() * w, y, s, s * 0.3, i % 2 ? 'rgba(70,120,50,0.45)' : 'rgba(190,215,110,0.5)');
    }
    for (const [x, y] of [[0.02, 0.76], [0.97, 0.75], [0.46, 0.76]]) reed(g, w * x, h * y, 62 * u, 0, x * 50 + 3);
    g.save();
    g.translate(w * 0.34, h * 0.81);
    g.scale(-0.66 * u, 0.66 * u);
    drawKuh(g, 9, 0);
    g.restore();
  }
  function smokePuffs(c, x, y, n, t, h, drift, r0, r1, a) {
    for (let i = 0; i < n; i++) {
      const p = wrap(t * 0.11 + i / n, 1);
      const px = x + drift * p + sin(p * 6 + i) * 3;
      const r = r0 + (r1 - r0) * p;
      ell(c, px, y - h * p, r, r, `rgba(245,243,238,${a * (1 - p) * min(1, p * 7)})`);
    }
  }
  function backPfahlbau(c, w, h, t) {
    stage(c, w, h, 'pfahlbau', paintPfahlbau);
    const u = h / 640;
    cloud(c, driftX(t, 3, w, 0.3), h * 0.14, 0.7 * u, 0.85);
    glitter(c, w, h * 0.43, h * 0.75, t, 24, 7, 'rgba(255,255,255,0.65)', 12 * u);
    smokePuffs(c, w * 0.71, h * 0.49 - 36 * u, 3, t, 40 * u, 10 * u, 2.4 * u, 7 * u, 0.6);
    smokePuffs(c, w * 0.06, h * 0.5 - 38 * u, 3, t + 3, 42 * u, 10 * u, 2.4 * u, 7 * u, 0.6);
  }
  function littleKid(c, x, y, hair, shirt, t, ph, wave2) {
    const a = sin(t * 2 + ph) * 0.3;
    // legs dangling from the walkway
    armAt(c, x + 2, y - 3, -0.5 + a, 15, 4.4, '#e6bd96', '#e6bd96');
    armAt(c, x + 6, y - 3, -0.4 - a, 15, 4.4, '#e9c29c', '#e9c29c');
    blob(c, [[x - 7, y + 1], [x - 6, y - 16], [x + 6, y - 16], [x + 8, y + 1]], shirt);
    if (wave2) armAt(c, x + 3, y - 14, PI - 0.45 + sin(t * 4 + ph) * 0.3, 12, 3.6, shirt, '#e9c29c');
    face(c, x + 1, y - 23, 7.6, '#ecc6a0', t, ph);
    c.beginPath();
    c.arc(x, y - 25, 8, PI * 0.9, PI * 1.9);
    c.closePath();
    c.fillStyle = hair;
    c.fill();
  }
  // A house on piles over the water, the walkway with two children and the smoke through the roof.
  function drawPfahlhaus(c, t) {
    c.translate(-14, 0);
    // reflection
    c.fillStyle = 'rgba(30,70,80,0.2)';
    c.fillRect(-98, 0, 196, 10);
    smokePuffs(c, -14, -150, 5, t, 56, 26, 4, 14, 0.75);
    // piles, a dense row: the village stands right on them
    c.fillStyle = '#654a31';
    for (let x = -94; x <= 136; x += 16) c.fillRect(x, -48, 5, 50);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = -94; x <= 136; x += 16) c.fillRect(x + 3, -48, 2, 50);
    // floor and walkway
    box(c, -104, -54, 170, 8, '#8a6946');
    box(c, 60, -50, 86, 6, '#957350');
    c.beginPath();
    for (let x = 66; x < 146; x += 9) {
      c.moveTo(x, -50);
      c.lineTo(x, -44);
    }
    c.strokeStyle = 'rgba(50,30,15,0.4)';
    c.lineWidth = 1;
    c.stroke();
    // long side wall, reed and clay
    c.fillStyle = grad(c, 0, -106, 0, -52, ['#dcc8a0', '#c4ab7f']);
    c.fillRect(-92, -106, 96, 54);
    c.beginPath();
    for (let x = -88; x < 4; x += 8) {
      c.moveTo(x, -106);
      c.lineTo(x, -54);
    }
    c.strokeStyle = 'rgba(100,70,40,0.22)';
    c.lineWidth = 1.2;
    c.stroke();
    // gable end with the doorway
    c.fillStyle = grad(c, 0, -130, 0, -52, ['#ead7b0', '#cfb78b']);
    poly(c, [[4, -52], [4, -106], [32, -142], [60, -106], [60, -52]]);
    c.fill();
    rr(c, 20, -96, 25, 44, 9);
    c.fillStyle = '#4e3a29';
    c.fill();
    c.fillStyle = 'rgba(255,170,90,0.45)';
    c.fillRect(24, -66, 17, 14);
    // thatched roof
    c.fillStyle = grad(c, 0, -160, 0, -98, ['#d7b868', '#b48f4a']);
    poly(c, [[-104, -96], [-68, -148], [32, -158], [8, -96]]);
    c.fill();
    c.beginPath();
    for (let i = 0; i < 13; i++) {
      const k = i / 12;
      c.moveTo(-68 + 100 * k, -148 - 10 * k);
      c.lineTo(-100 + 106 * k, -98);
    }
    c.strokeStyle = 'rgba(110,80,35,0.4)';
    c.lineWidth = 1.5;
    c.stroke();
    poly(c, [[32, -158], [66, -102], [58, -100], [32, -142], [6, -100], [4, -104]], '#c29f57');
    ell(c, -18, -152, 8, 3, '#7a5a30');
    // the two children, legs swinging over the water
    littleKid(c, 92, -50, '#4a3320', '#d9c49a', t, 0, true);
    littleKid(c, 118, -50, '#8a5a2c', '#a9c2a0', t, 2, false);
    const r = wrap(t * 0.16, 1);
    c.beginPath();
    c.ellipse(20, 3, 120 + r * 26, 6 + r * 3, 0, 0, TAU);
    c.strokeStyle = `rgba(255,255,255,${0.42 * (1 - r)})`;
    c.lineWidth = 1.4;
    c.stroke();
  }
  // A dugout hollowed from one tree trunk.
  function drawEinbaum(c, t, walk) {
    const ph = walk || t * 1.3;
    const a = sin(ph) * 0.5;
    c.translate(0, sin(t * 1.1) * 1.2);
    c.save();
    c.rotate(sin(t * 0.9) * 0.012);
    // the paddler behind the near wall
    const bx = 8;
    blob(c, [[bx - 11, -14], [bx - 10, -40], [bx + 9, -40], [bx + 11, -14]], '#cdb489');
    box(c, bx - 10, -28, 20, 3, '#8f6c43');
    face(c, bx + 1, -49, 10, '#e6bd96', t, 2);
    c.beginPath();
    c.arc(bx, -51, 10.4, PI * 0.82, PI * 1.84);
    c.closePath();
    c.fillStyle = '#4b3423';
    c.fill();
    // paddle sweeping through the water
    const hx = bx + 14 + a * 12;
    const hy = -30 - a * 3;
    const ex = hx + 16 + a * 22;
    line(c, [[bx + 5, -33], [hx, hy]], '#cdb489', 5);
    ell(c, hx, hy, 2.8, 2.8, '#e6bd96');
    line(c, [[hx - 5 - a * 8, hy - 16], [ex, 2]], '#7f5f3e', 2.8);
    ell(c, ex + 1.4, 3, 3.6, 9, '#7f5f3e', 0.28 - a * 0.2);
    // hull
    c.fillStyle = grad(c, 0, -18, 0, 3, ['#8d6a45', '#553c26']);
    blob(c, [[-84, -14], [-74, -2], [-44, 3], [50, 3], [80, -2], [88, -14], [50, -11], [-48, -11]]);
    c.fill();
    ell(c, -5, -11.5, 44, 2.4, '#3d2a1a');
    line(c, [[-54, -6], [-10, -4], [40, -6]], 'rgba(30,18,8,0.32)', 1.3);
    c.restore();
    c.fillStyle = 'rgba(70,170,185,0.5)';
    c.fillRect(-82, 1, 164, 3);
    const r = wrap(t * 0.3, 1);
    c.beginPath();
    c.ellipse(ex + 2 - 4, 3, 7 + r * 14, 2 + r * 2.4, 0, 0, TAU);
    c.strokeStyle = `rgba(255,255,255,${0.6 * (1 - r)})`;
    c.lineWidth = 1.2;
    c.stroke();
  }
  function flame(c, x, y, s, t, ph, col) {
    const f = 1 + sin(t * 7 + ph) * 0.14;
    const sw = sin(t * 5 + ph) * 1.4;
    blob(c, [[x - 6 * s, y], [x - 5 * s, y - 9 * s], [x + sw * 0.6, y - 19 * s * f], [x + 5 * s, y - 9 * s], [x + 6 * s, y]], col);
  }
  // A round-bellied clay pot of the first farmers, simmering on three stones.
  function drawTopf(c, t) {
    shadow(c, 0, 36, 4.4);
    const g = c.createRadialGradient(0, -14, 2, 0, -14, 36);
    g.addColorStop(0, 'rgba(255,190,90,0.42)');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    c.fillStyle = g;
    c.fillRect(-36, -50, 72, 72);
    flame(c, -11, -3, 0.92, t, 0, '#f2873a');
    flame(c, 12, -3, 0.9, t, 2, '#f2873a');
    flame(c, 1, -3, 1.1, t, 4, '#f7a640');
    flame(c, 0, -3, 0.62, t, 1, '#ffd76a');
    ell(c, -27, -6, 9.6, 7.6, '#8e8a82');
    ell(c, 27, -6, 9.6, 7.6, '#807c75');
    ell(c, 0, -3, 8, 4.6, '#6e6a64');
    ell(c, -29, -8.5, 5.4, 2.8, '#aaa69e');
    ell(c, 25, -8.5, 5.4, 2.8, '#9b978f');
    // steam
    smokePuffs(c, -6, -56, 3, t * 1.5, 22, 9, 2.6, 7, 0.75);
    smokePuffs(c, 7, -56, 3, t * 1.5 + 2, 20, 7, 2.6, 6, 0.7);
    c.fillStyle = grad(c, -26, 0, 26, 0, ['#b9774a', '#a0623a', '#7e4928']);
    blob(c, [[-20, -12], [-30, -28], [-23, -52], [23, -52], [30, -28], [20, -12]]);
    c.fill();
    ell(c, 0, -52, 20, 5, '#7e4928');
    ell(c, 0, -51.5, 16, 3.6, '#5c371f');
    ell(c, 0, -51, 14, 2.6, 'rgba(235,210,150,0.75)');
    dots(c, [[-20, -36, 2], [-12, -38, 2], [-4, -39, 2], [4, -39, 2], [12, -38, 2], [20, -36, 2]], 'rgba(60,32,14,0.6)');
    ell(c, -28, -36, 3.4, 2.2, '#8e5634');
    ell(c, 28, -36, 3.4, 2.2, '#6d3f23');
  }
  // Small brown stone-age cow with horns. Cattle were kept around the lake already 6000 years ago.
  function drawKuh(c, t, walk) {
    const body = '#a26e41';
    const dark = '#7c5230';
    const bob = stepBob(walk, 1.3);
    const tw = sin(t * 1.3) * 5;
    const graze = walk ? 0 : max(0, sin(t * 0.33)) ** 2;
    c.translate(-14, 0);
    shadow(c, 0, 56, 5);
    shank(c, 26, -40 - bob, 20, 20 + bob, 6, 3.2, gait(walk, 0, 0.36), 0.08, dark, '#3d2a1a');
    shank(c, -32, -40 - bob, 20, 20 + bob, 7, 3.2, gait(walk, PI, 0.36), -0.1, dark, '#3d2a1a');
    tube(c, [[-46, -66 - bob, 2.6], [-56, -48 - bob + tw * 0.4, 2], [-56, -28 - bob + tw, 1.4]], dark);
    ell(c, -56, -24 - bob + tw, 3, 6.5, '#54371f');
    c.fillStyle = grad(c, 0, -80, 0, -32, ['#b57d4c', body, dark]);
    blob(c, [[-50, -42 - bob], [-52, -70 - bob], [-30, -78 - bob], [10, -76 - bob], [38, -80 - bob], [50, -64 - bob], [44, -42 - bob], [8, -32 - bob], [-30, -32 - bob]]);
    c.fill();
    ell(c, -22, -33 - bob, 8, 5, '#e8b9a4');
    shank(c, 20, -40 - bob, 21, 20 + bob, 7, 3.4, gait(walk, PI, 0.36), 0.08, body, '#3d2a1a');
    shank(c, -38, -40 - bob, 21, 20 + bob, 8, 3.4, gait(walk, 0, 0.36), -0.1, body, '#3d2a1a');
    c.save();
    c.translate(50, -66 - bob);
    c.rotate(graze * 0.95);
    tube(c, [[-14, 4, 13], [4, 2, 10]], body);
    // horns, ears, long friendly face
    curve(c, 6, -9, 2, -24, 16, -28, '#efe5c8', 3.4);
    curve(c, 11, -8, 12, -20, 26, -22, '#d8cdb0', 3);
    blob(c, [[-4, 5], [-1, -9], [12, -12], [22, -6], [33, 6], [31, 14], [18, 15], [4, 11]], '#b57d4c');
    blob(c, [[20, 4], [33, 6], [32, 15], [18, 15], [15, 9]], '#e7cfae');
    ell(c, -5 + sin(t * 2) * 0.6, -4, 7.5, 3.4, dark, -0.35);
    blinkEye(c, 10, -3, 5.2, t, 11, '#b57d4c');
    ell(c, 28, 8, 1.5, 1.2, '#4a3324');
    curve(c, 31, 12, 26, 14.2, 21, 12.4, 'rgba(60,35,20,0.7)', 1.1);
    c.restore();
  }

  // ================================================================== ROEMER
  function villa(g, x, y, w, h, u) {
    g.fillStyle = grad(g, x, 0, x + w, 0, ['#fbf8f0', '#ebe6da']);
    g.fillRect(x, y - h, w, h);
    const rf = h * 0.42;
    poly(g, [[x - 5 * u, y - h + 1], [x + w * 0.18, y - h - rf], [x + w * 0.82, y - h - rf], [x + w + 5 * u, y - h + 1]], '#c4583a');
    poly(g, [[x + w * 0.82, y - h - rf], [x + w + 5 * u, y - h + 1], [x + w * 0.7, y - h + 1]], '#a84a30');
    const n = max(2, Math.round(w / (20 * u)));
    for (let i = 0; i < n; i++) box(g, x + (w / n) * (i + 0.5) - 2.6 * u, y - h * 0.72, 5.2 * u, 8 * u, '#7c6a58');
  }
  function amphora(g, x, y, s) {
    blob(g, [[x - 3 * s, y], [x - 8 * s, y - 13 * s], [x - 5 * s, y - 24 * s], [x + 5 * s, y - 24 * s], [x + 8 * s, y - 13 * s], [x + 3 * s, y]], '#c07a4a');
    box(g, x - 2.4 * s, y - 31 * s, 4.8 * s, 8 * s, '#a9673b');
    box(g, x - 3.6 * s, y - 33 * s, 7.2 * s, 2.4 * s, '#c98a58');
    curve(g, x - 2.5 * s, y - 30 * s, x - 9 * s, y - 28 * s, x - 5.6 * s, y - 22 * s, '#a9673b', 1.5 * s);
    curve(g, x + 2.5 * s, y - 30 * s, x + 9 * s, y - 28 * s, x + 5.6 * s, y - 22 * s, '#a9673b', 1.5 * s);
  }
  function paintRoemer(g, w, h, u) {
    const hz = h * 0.42;
    const quay = h * 0.76;
    fillV(g, 0, 0, w, hz + 3, [[0, '#5dbdee'], [0.6, '#bfe7f4'], [1, '#faf3d8']]);
    glow(g, w * 0.16, h * 0.12, 130 * u, '#fff4c4', 0.85);
    ell(g, w * 0.16, h * 0.12, 21 * u, 21 * u, '#fffbe4');
    peaks(g, w, hz + 2, 112 * u, 116 * u, 4, '#a9bfd2', 0.4);
    rolling(g, w, hz + 2, 30 * u, 0.008, 2, '#86b398', hz + 3);
    fillV(g, 0, hz, w, quay - hz + 8 * u, [[0, '#b8e8e6'], [0.3, '#70ccd2'], [1, '#2f9fb4']]);
    // Brigantium on its hill above the harbour
    g.fillStyle = grad(g, 0, h * 0.3, 0, h * 0.72, ['#8fbc66', '#6e9f50']);
    blob(g, [[w * 0.44, h * 0.64], [w * 0.56, h * 0.48], [w * 0.74, h * 0.36], [w * 1.1, h * 0.3], [w * 1.2, h * 0.7], [w * 0.7, h * 0.72]]);
    g.fill();
    for (const [x, y, bw, bh] of [[0.68, 0.42, 34, 16], [0.8, 0.39, 30, 15], [0.91, 0.38, 36, 18], [0.61, 0.5, 30, 15], [0.74, 0.47, 40, 18], [0.89, 0.46, 42, 20]]) villa(g, w * x, h * y, bw * u, bh * u, u);
    for (const [x, y, s] of [[0.64, 0.42, 34], [0.76, 0.39, 28], [0.98, 0.4, 44]]) {
      ell(g, w * x, h * y - s * u * 0.5, s * u * 0.2, s * u * 0.52, '#3d7d55');
    }
    // the white harbour wall with a round tower at its end
    const wy = h * 0.71;
    const wx = w * 0.52;
    const wt = 40 * u;
    g.fillStyle = 'rgba(40,90,100,0.22)';
    g.fillRect(wx - 8 * u, wy, w - wx + 8 * u, 9 * u);
    g.fillStyle = grad(g, 0, wy - wt, 0, wy, ['#fbf8f0', '#d9d3c3']);
    g.fillRect(wx, wy - wt, w - wx, wt);
    g.beginPath();
    for (let x = wx + 6 * u; x < w; x += 22 * u) {
      g.moveTo(x, wy - wt);
      g.lineTo(x, wy);
    }
    for (let k = 1; k < 3; k++) {
      g.moveTo(wx, wy - wt * (k / 3));
      g.lineTo(w, wy - wt * (k / 3));
    }
    g.strokeStyle = 'rgba(110,100,85,0.16)';
    g.lineWidth = 1 * u;
    g.stroke();
    for (let x = wx; x < w; x += 18 * u) box(g, x, wy - wt - 7 * u, 10 * u, 7.5 * u, '#f4f0e6');
    g.fillStyle = grad(g, wx - 22 * u, 0, wx + 18 * u, 0, ['#fdfbf5', '#d3cdbd']);
    g.fillRect(wx - 22 * u, wy - wt - 20 * u, 40 * u, wt + 20 * u);
    for (let k = 0; k < 4; k++) box(g, wx - 22 * u + k * 11.2 * u, wy - wt - 27 * u, 6.4 * u, 7.5 * u, '#f8f5ec');
    rr(g, wx - 7 * u, wy - wt - 8 * u, 9 * u, 16 * u, 4.5 * u);
    g.fillStyle = '#5b6b78';
    g.fill();
    // the stone quay in front
    g.fillStyle = grad(g, 0, quay, 0, h, ['#ded6c2', '#bfb6a0', '#a59c86']);
    g.fillRect(0, quay, w, h - quay);
    box(g, 0, quay, w, 5 * u, '#f0ebdd');
    box(g, 0, quay + 5 * u, w, 3 * u, 'rgba(70,60,45,0.3)');
    g.beginPath();
    const rows = 5;
    for (let j = 1; j <= rows; j++) {
      const y = quay + (h - quay) * pow(j / rows, 1.4);
      g.moveTo(0, y);
      g.lineTo(w, y);
      const step = (40 + j * 18) * u;
      for (let x = (j % 2) * step * 0.5; x < w; x += step) {
        const y0 = quay + (h - quay) * pow((j - 1) / rows, 1.4);
        g.moveTo(x, y0);
        g.lineTo(x, y);
      }
    }
    g.strokeStyle = 'rgba(90,80,60,0.25)';
    g.lineWidth = 1.2 * u;
    g.stroke();
    amphora(g, w * 0.06, h * 0.82, 1.2 * u);
    amphora(g, w * 0.11, h * 0.83, 1.05 * u);
    amphora(g, w * 0.085, h * 0.85, 1.25 * u);
    // a mooring post and rope
    box(g, w * 0.44, h * 0.77, 10 * u, 22 * u, '#6a4e33', 3 * u);
    ell(g, w * 0.44 + 5 * u, h * 0.77, 6 * u, 2.4 * u, '#8a6946');
  }
  function backRoemer(c, w, h, t) {
    stage(c, w, h, 'roemer', paintRoemer);
    const u = h / 640;
    cloud(c, driftX(t, 3, w, 0.6), h * 0.15, 0.7 * u, 0.85);
    glitter(c, w * 0.62, h * 0.44, h * 0.75, t, 20, 9, 'rgba(255,255,255,0.68)', 12 * u);
    surface(c, w, h * 0.762, t, 1.3 * u, 'rgba(70,170,190,0.55)', 3 * u);
  }
  // Roman ship with one big square sail and a row of oars, a painted eye on the bow.
  function drawRoemerschiff(c, t, walk) {
    const ph = walk || t * 1.1;
    c.translate(-6, sin(t * 0.9) * 1.6);
    c.save();
    c.rotate(sin(t * 0.7) * 0.012);
    // far oars
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = -60 + i * 22;
      c.moveTo(x, -28);
      c.lineTo(x + 14 + sin(ph + i * 0.2) * 12, 0);
    }
    c.strokeStyle = '#6a4a2c';
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.stroke();
    // mast and sail
    box(c, -3, -158, 6, 138, '#6d4a2b', 2);
    const bil = sin(t * 0.8) * 3 + 12;
    c.fillStyle = grad(c, 0, -146, 0, -56, ['#f7ecd2', '#e8d5ae']);
    c.beginPath();
    c.moveTo(-62, -146);
    c.lineTo(62, -146);
    c.quadraticCurveTo(62 + bil, -100, 56, -58);
    c.quadraticCurveTo(0, -48 + bil * 0.2, -56, -58);
    c.quadraticCurveTo(-62 + bil, -100, -62, -146);
    c.closePath();
    c.fill();
    for (const [x0, x1, wd] of [[-30, -24, 15], [30, 28, 15]]) {
      c.beginPath();
      c.moveTo(x0 - wd / 2, -146);
      c.lineTo(x0 + wd / 2, -146);
      c.quadraticCurveTo(x1 + wd / 2 + bil * 0.6, -100, x1 + wd / 2, -54);
      c.lineTo(x1 - wd / 2, -54);
      c.quadraticCurveTo(x1 - wd / 2 + bil * 0.6, -100, x0 - wd / 2, -146);
      c.closePath();
      c.fillStyle = '#c23f30';
      c.fill();
    }
    box(c, -68, -149, 136, 4.6, '#6d4a2b', 2);
    line(c, [[-3, -158], [-92, -38]], 'rgba(60,40,20,0.45)', 1);
    line(c, [[3, -158], [92, -38]], 'rgba(60,40,20,0.45)', 1);
    // sailors
    face(c, -30, -44, 8, '#e4b98f', t, 1);
    c.beginPath();
    c.arc(-31, -46, 8.4, PI * 0.86, PI * 1.86);
    c.closePath();
    c.fillStyle = '#4c3323';
    c.fill();
    face(c, 26, -44, 8, '#ecc6a0', t, 3);
    c.beginPath();
    c.arc(25, -46, 8.4, PI * 0.86, PI * 1.86);
    c.closePath();
    c.fillStyle = '#7a4d27';
    c.fill();
    // stern post curled like a swan's neck, hull, bow
    tube(c, [[-92, -28, 8], [-114, -46, 6], [-118, -70, 4], [-104, -80, 3], [-98, -68, 1.6]], '#6d452a');
    c.fillStyle = grad(c, 0, -38, 0, 2, ['#9b6438', '#5e3b22']);
    blob(c, [[-112, -36], [-94, -8], [-40, 2], [50, 2], [96, -10], [126, -38], [80, -30], [-60, -30]]);
    c.fill();
    c.fillStyle = '#c23f30';
    c.beginPath();
    c.moveTo(-108, -30);
    c.quadraticCurveTo(0, -20, 114, -32);
    c.lineTo(109, -25);
    c.quadraticCurveTo(0, -12, -103, -23);
    c.closePath();
    c.fill();
    box(c, -102, -35, 212, 3.4, '#e6d3a8', 1.5);
    // painted eye keeps the ship on its course
    ell(c, 94, -28, 7.6, 5, '#fbf7ea');
    ell(c, 95, -28, 3.4, 3.4, '#22303c');
    ell(c, 96, -29, 1, 1, '#fff');
    // near oars
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = -66 + i * 24;
      c.moveTo(x, -20);
      c.lineTo(x + 8 + sin(ph + i * 0.2) * 14, 7);
    }
    c.strokeStyle = '#7f5a36';
    c.lineWidth = 2.8;
    c.stroke();
    // steering oar
    line(c, [[-96, -32], [-118, 5]], '#6d452a', 3.4);
    ell(c, -119, 6, 4.4, 9, '#6d452a', 0.5);
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = -66 + i * 24 + 8 + sin(ph + i * 0.2) * 14;
      c.ellipse(x, 7, 5, 1.5, 0, 0, TAU);
    }
    c.fill();
  }
  // Legionary, helmet with a red crest, big curved shield. He waves with a raised hand, like a friend across the harbour.
  function drawLegionaer(c, t, walk) {
    const bob = stepBob(walk, 1.5);
    const skin = '#e4b98f';
    shadow(c, 0, 24, 3.6);
    strideLegs(c, walk, '#e4b98f', '#d3a77e', '#6a4326', bob);
    c.save();
    c.translate(0, -bob);
    // sandal straps
    box(c, -18, -58, 14, 4, '#c23f30');
    // tunic and belt strips
    blob(c, [[-14, -32], [-16, -48], [16, -48], [14, -32]], '#c23f30');
    c.beginPath();
    for (let i = -2; i <= 2; i++) {
      c.moveTo(i * 5, -46);
      c.lineTo(i * 5.2, -31);
    }
    c.strokeStyle = '#7a4a26';
    c.lineWidth = 2.4;
    c.stroke();
    // segmented armour
    c.fillStyle = grad(c, 0, -78, 0, -44, ['#e3e6e9', '#a9afb5']);
    blob(c, [[-14, -78], [14, -78], [16, -46], [-16, -46]]);
    c.fill();
    c.beginPath();
    for (let y = -70; y < -46; y += 6) {
      c.moveTo(-15, y);
      c.lineTo(15, y);
    }
    c.strokeStyle = 'rgba(70,75,85,0.55)';
    c.lineWidth = 1.2;
    c.stroke();
    box(c, -16, -49, 32, 4.4, '#7a4a26');
    dots(c, [[-8, -47, 1.3], [0, -47, 1.3], [8, -47, 1.3]], '#d9b24d');
    face(c, 1, -89, 13, skin, t, 2);
    // helmet with neck guard, cheek piece and crest
    tube(c, [[-12, -88, 2.6], [-18, -82, 2.2]], '#c4a050');
    c.beginPath();
    c.arc(0, -94, 13.8, PI * 0.98, PI * 1.92);
    c.closePath();
    c.fillStyle = '#d9b656';
    c.fill();
    box(c, -13.8, -96, 27, 3, '#b08f3f', 1.4);
    blob(c, [[-3, -94], [1, -94], [2, -82], [-2, -79], [-5, -86]], '#c4a050');
    blob(c, [[-17, -102], [-14, -116], [0, -121], [12, -115], [15, -103], [2, -108]], '#c23f30');
    // the waving arm: elbow out, forearm up, hand swaying
    const wv = sin(t * 4.5) * 0.28;
    armAt(c, 12, -74, -1.0, 11, 8, '#c23f30', '#c23f30');
    armAt(c, 21.5, -68, PI + 0.12 + wv, 19, 7, skin, skin);
    // the shield on his other arm, painted with golden wings
    c.fillStyle = grad(c, -22, 0, -2, 0, ['#d64a39', '#a93426']);
    rr(c, -25, -74, 25, 48, 4);
    c.fill();
    box(c, -25, -74, 25, 2.6, '#d9b656');
    box(c, -25, -28.6, 25, 2.6, '#d9b656');
    ell(c, -12.5, -50, 5, 5, '#d9b656');
    curve(c, -9, -50, -3, -60, -3, -68, '#ecd070', 1.8);
    curve(c, -9, -50, -3, -40, -3, -33, '#ecd070', 1.8);
    curve(c, -16, -50, -22, -60, -22, -68, '#ecd070', 1.8);
    curve(c, -16, -50, -22, -40, -22, -33, '#ecd070', 1.8);
    c.restore();
  }
  // Harbour house of Brigantium: white walls, red tiles, a row of columns.
  function drawRoemerhaus(c) {
    shadow(c, 0, 92, 5);
    c.fillStyle = grad(c, -82, 0, 82, 0, ['#fdfaf3', '#efe9dc']);
    c.fillRect(-82, -74, 164, 74);
    // upper floor with windows
    c.fillStyle = '#ece6d9';
    c.fillRect(-60, -104, 120, 32);
    for (let x = -46; x <= 40; x += 22) {
      rr(c, x, -98, 9, 15, 4);
      c.fillStyle = '#5b6b78';
      c.fill();
    }
    // red tile roofs, the upper with long rows of tiles
    const tiles = (x0, y0, x1, y1, ins, n) => {
      c.fillStyle = grad(c, 0, y0, 0, y1, ['#d66a48', '#b84e31']);
      poly(c, [[x0, y1], [x0 + ins, y0], [x1 - ins, y0], [x1, y1]]);
      c.fill();
      c.beginPath();
      for (let i = 1; i < n; i++) {
        const k = i / n;
        c.moveTo(x0 + ins + (x1 - x0 - 2 * ins) * k, y0);
        c.lineTo(x0 + (x1 - x0) * k, y1);
      }
      c.moveTo(x0 + ins * 0.5, (y0 + y1) / 2);
      c.lineTo(x1 - ins * 0.5, (y0 + y1) / 2);
      c.strokeStyle = 'rgba(100,35,15,0.35)';
      c.lineWidth = 1.2;
      c.stroke();
    };
    tiles(-70, -126, 70, -102, 20, 14);
    tiles(-92, -86, 92, -72, 10, 18);
    // shady hall behind a row of columns
    c.fillStyle = 'rgba(70,60,50,0.38)';
    c.fillRect(-76, -70, 152, 70);
    rr(c, -14, -50, 28, 50, 13);
    c.fillStyle = '#5e3f26';
    c.fill();
    for (let x = -72; x <= 72; x += 24) {
      c.fillStyle = grad(c, x - 5, 0, x + 5, 0, ['#ffffff', '#ddd6c7']);
      c.fillRect(x - 4.6, -68, 9.2, 66);
      box(c, x - 6.4, -72, 12.8, 4.5, '#fbf8f0');
      box(c, x - 6.4, -4, 12.8, 4, '#f4efe4');
    }
    box(c, -92, -4, 184, 5, '#d8d1bf');
  }

  // ================================================================== MITTELALTER
  function abbey(g, x, y, s) {
    // long nave
    g.fillStyle = grad(g, x, 0, x + 110 * s, 0, ['#fbf6ea', '#e3dac7']);
    g.fillRect(x, y - 44 * s, 110 * s, 44 * s);
    poly(g, [[x - 4 * s, y - 43 * s], [x + 16 * s, y - 68 * s], [x + 114 * s, y - 68 * s], [x + 114 * s, y - 43 * s]], '#a9593b');
    for (let i = 0; i < 5; i++) {
      rr(g, x + (10 + i * 20) * s, y - 34 * s, 8 * s, 18 * s, 4 * s);
      g.fillStyle = '#51606f';
      g.fill();
    }
    // the square tower
    g.fillStyle = grad(g, x + 96 * s, 0, x + 134 * s, 0, ['#fbf6ea', '#ded4c0']);
    g.fillRect(x + 96 * s, y - 104 * s, 36 * s, 104 * s);
    poly(g, [[x + 92 * s, y - 104 * s], [x + 114 * s, y - 138 * s], [x + 136 * s, y - 104 * s]], '#8f4a30');
    poly(g, [[x + 114 * s, y - 138 * s], [x + 136 * s, y - 104 * s], [x + 118 * s, y - 104 * s]], '#7a3f28');
    for (const [dx, dy] of [[105, -92], [117, -92], [105, -70], [117, -70]]) {
      rr(g, x + dx * s, y + dy * s, 7 * s, 13 * s, 3.5 * s);
      g.fillStyle = '#51606f';
      g.fill();
    }
    line(g, [[x + 114 * s, y - 138 * s], [x + 114 * s, y - 152 * s]], '#6d5a3c', 1.8 * s);
    line(g, [[x + 109 * s, y - 147 * s], [x + 119 * s, y - 147 * s]], '#6d5a3c', 1.8 * s);
  }
  function paintMittelalter(g, w, h, u) {
    const hz = h * 0.47;
    const land = h * 0.75;
    fillV(g, 0, 0, w, hz + 3, [[0, '#67c0ec'], [0.6, '#c5e8f2'], [1, '#fbf2d6']]);
    glow(g, w * 0.5, h * 0.12, 130 * u, '#fff4c6', 0.85);
    ell(g, w * 0.5, h * 0.12, 20 * u, 20 * u, '#fffce6');
    peaks(g, w, hz + 2, 76 * u, 100 * u, 6, '#b4c7d6', 0.36);
    rolling(g, w, hz + 2, 40 * u, 0.008, 3, '#93bc8f', hz + 3);
    rolling(g, w, hz + 2, 22 * u, 0.015, 8, '#78a877', hz + 3);
    fillV(g, 0, hz, w, land - hz + 20 * u, [[0, '#bbe8e6'], [0.3, '#7ad0d4'], [1, '#2f9fb4']]);
    // vineyard rows and meadow on the Reichenau island
    g.fillStyle = '#ead9ad';
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= w + 14; i += 14) g.lineTo(i, land + wave(i * 0.009 + 3) * 8 * u);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.fillStyle = grad(g, 0, land, 0, h, ['#a9cc66', '#82b24d', '#5f923f']);
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= w + 14; i += 14) g.lineTo(i, land + 12 * u + wave(i * 0.009 + 3) * 8 * u);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    // the monastery church on the island, its back to the water
    abbey(g, w * 0.64, land + 8 * u, 0.92 * u);
    tree(g, w * 0.6, land + 10 * u, 76 * u, 'apfel', 0, 4);
    tree(g, w * 0.95, land + 6 * u, 84 * u, 'pappel', 0, 2);
    // the garden fence, woven from willow rods
    const wy = land + 44 * u;
    const fw = w * 0.52;
    g.beginPath();
    for (const dy of [-16, -11, -6]) {
      g.moveTo(0, wy + dy * u);
      for (let x = 12 * u; x <= fw; x += 12 * u) g.quadraticCurveTo(x - 6 * u, wy + (dy + (Math.round(x / u / 12) % 2 ? -2 : 2)) * u, x, wy + dy * u);
    }
    g.strokeStyle = '#9b7a4c';
    g.lineWidth = 2.1 * u;
    g.stroke();
    for (let x = 0; x <= fw; x += 36 * u) box(g, x - 1.8 * u, wy - 22 * u, 3.6 * u, 23 * u, '#6e5232', 1.5 * u);
    const r = rngOf(3);
    for (let i = 0; i < 13; i++) {
      const y = land + (h - land) * (0.2 + r() * 0.8);
      const s = (8 + r() * 14) * u;
      ell(g, r() * w, y, s, s * 0.3, i % 2 ? 'rgba(70,120,50,0.42)' : 'rgba(195,220,115,0.5)');
    }
    reed(g, w * 0.03, land + 2 * u, 58 * u, 0, 8);
    reed(g, w * 0.53, land + 2 * u, 50 * u, 0, 18);
    g.save();
    g.translate(w * 0.8, land + 34 * u);
    g.scale(-0.62 * u, 0.62 * u);
    drawMoench(g, 2);
    g.restore();
  }
  function backMittelalter(c, w, h, t) {
    stage(c, w, h, 'mittelalter', paintMittelalter);
    const u = h / 640;
    cloud(c, driftX(t, 3, w, 0.2), h * 0.17, 0.7 * u, 0.85);
    cloud(c, driftX(t, 2, w, 0.7), h * 0.1, 0.45 * u, 0.7);
    glitter(c, w, h * 0.48, h * 0.74, t, 22, 13, 'rgba(255,255,255,0.68)', 12 * u);
  }
  function pennant(c, x, y, h, a, b, t, seed) {
    line(c, [[x, y], [x, y - h]], '#5d4a35', max(1.2, h * 0.05));
    const fl = h * 0.72;
    const ht = h * 0.3;
    const w1 = sin(t * 3.4 + seed) * ht * 0.2;
    const w2 = sin(t * 3.4 + seed - 1.4) * ht * 0.3;
    c.beginPath();
    c.moveTo(x, y - h);
    c.quadraticCurveTo(x + fl * 0.5, y - h + w1, x + fl, y - h + ht * 0.45 + w2);
    c.quadraticCurveTo(x + fl * 0.5, y - h + ht * 0.82 + w1, x, y - h + ht);
    c.closePath();
    c.fillStyle = a;
    c.fill();
    c.beginPath();
    c.moveTo(x, y - h + ht * 0.5);
    c.quadraticCurveTo(x + fl * 0.5, y - h + ht * 0.62 + w1, x + fl, y - h + ht * 0.45 + w2);
    c.quadraticCurveTo(x + fl * 0.5, y - h + ht * 0.82 + w1, x, y - h + ht);
    c.closePath();
    c.fillStyle = b;
    c.fill();
  }
  // Kneeling monk in the herb garden of the Reichenau, patiently tending sage, lavender and marigolds.
  function drawMoench(c, t) {
    const habit = '#6d5038';
    const dark = '#54392a';
    const skin = '#ecc6a0';
    const bend = sin(t * 0.7) * 1.5;
    c.translate(-18, 0);
    // garden bed with soft earth and herbs
    blob(c, [[-30, 2], [-22, -6], [64, -7], [92, -5], [96, 2], [40, 4]], '#6d4c30');
    ell(c, 34, -2, 56, 3, '#8a6240');
    const herb = (x, h, col, top) => {
      const sw = sin(t * 1.1 + x) * 1.6;
      c.beginPath();
      for (const d of [-5, -2.5, 0, 2.5, 5]) {
        c.moveTo(x + d * 0.5, -4);
        c.quadraticCurveTo(x + d, -h * 0.6, x + d * 1.5 + sw, -h * (1 - abs(d) * 0.05));
      }
      c.strokeStyle = col;
      c.lineWidth = 2.4;
      c.lineCap = 'round';
      c.stroke();
      if (top) {
        const list = [];
        for (const d of [-5, -2.5, 0, 2.5, 5]) list.push([x + d * 1.5 + sw, -h * (1 - abs(d) * 0.05), 2.6]);
        dots(c, list, top);
      }
    };
    herb(46, 26, '#6e9a68', '#a68ad8');
    herb(66, 20, '#8aa77a');
    herb(84, 24, '#5f9a50', '#f2a53a');
    // kneeling body, wrapped in the habit
    blob(c, [[-34, 0], [-40, -18], [-30, -38], [-12, -56], [8, -56], [18, -36], [20, -14], [26, 0]], habit);
    blob(c, [[-40, 0], [-34, -12], [-10, -10], [22, -4], [28, 1]], dark);
    box(c, -24, -33, 40, 3.4, '#d6c58f', 1.5);
    line(c, [[10, -31], [12, -20]], '#d6c58f', 2);
    // the arm reaching down to the herbs
    tube(c, [[8, -46, 7], [24, -32 + bend, 5.6], [36, -18 + bend, 4.6]], dark);
    ell(c, 38, -16 + bend, 4.4, 4, skin);
    // little trowel
    line(c, [[39, -15 + bend], [44, -6 + bend]], '#6d5a44', 2.4);
    c.save();
    c.translate(3 + bend * 0.3, -68 + bend * 0.3);
    // hood fallen back
    blob(c, [[-16, 12], [-15, -2], [-6, 12], [10, 14], [4, 19], [-12, 19]], dark);
    face(c, 0, 0, 13, skin, t, 3);
    // tonsure: a ring of hair round a bare crown
    c.beginPath();
    c.arc(-1, -2, 13.4, PI * 0.9, PI * 1.82);
    c.arc(-1, -9, 8.6, PI * 1.72, PI * 1.02, true);
    c.closePath();
    c.fillStyle = '#5a4230';
    c.fill();
    c.restore();
  }
  // Laedine: the long flat-bottomed cargo boat of the lake with one great square sail, stacked with barrels and sacks.
  function drawLaedine(c, t, walk) {
    c.translate(-4, sin(t * 0.8) * 1.5);
    c.save();
    c.rotate(sin(t * 0.6) * 0.01);
    box(c, -3, -176, 6, 158, '#67492c', 2);
    const bil = sin(t * 0.8) * 4 + 14;
    c.fillStyle = grad(c, 0, -168, 0, -44, ['#f7efdc', '#e9dcc0']);
    c.beginPath();
    c.moveTo(-76, -166);
    c.lineTo(76, -166);
    c.quadraticCurveTo(76 + bil, -104, 70, -46);
    c.quadraticCurveTo(0, -36 + bil * 0.3, -70, -46);
    c.quadraticCurveTo(-76 + bil, -104, -76, -166);
    c.closePath();
    c.fill();
    c.beginPath();
    for (const k of [-0.66, -0.33, 0, 0.33, 0.66]) {
      c.moveTo(76 * k, -166);
      c.quadraticCurveTo(76 * k + bil, -104, 70 * k, -44);
    }
    c.moveTo(-74, -125);
    c.lineTo(74 + bil * 0.5, -125);
    c.moveTo(-70, -86);
    c.lineTo(72 + bil * 0.5, -86);
    c.strokeStyle = 'rgba(120,90,50,0.3)';
    c.lineWidth = 1.3;
    c.stroke();
    // a patched corner
    poly(c, [[20, -86], [52, -86], [50, -62], [18, -62]], 'rgba(205,165,105,0.5)');
    box(c, -84, -170, 168, 5, '#67492c', 2);
    line(c, [[-2, -176], [-100, -28]], 'rgba(60,40,20,0.45)', 1);
    line(c, [[2, -176], [104, -28]], 'rgba(60,40,20,0.45)', 1);
    // cargo: barrels and sacks
    for (const x of [-72, -52, 44, 64]) {
      c.fillStyle = grad(c, x - 9, 0, x + 9, 0, ['#ab7f4f', '#7d5933']);
      rr(c, x - 9, -42, 18, 24, 7);
      c.fill();
      box(c, x - 9, -36, 18, 2, '#4a3a28');
      box(c, x - 9, -26, 18, 2, '#4a3a28');
    }
    dots(c, [[-20, -28, 11], [0, -26, 11], [20, -28, 11]], '#d9caa3');
    dots(c, [[-10, -38, 9.6], [10, -38, 9.6]], '#e8dbb7');
    // sailor at the stern
    blob(c, [[-98, -26], [-96, -50], [-82, -50], [-80, -26]], '#50698a');
    face(c, -88, -60, 9.6, '#ecc6a0', t, 5);
    c.beginPath();
    c.arc(-89, -62, 10, PI * 0.84, PI * 1.86);
    c.closePath();
    c.fillStyle = '#b14231';
    c.fill();
    // long low hull with raised ends
    c.fillStyle = grad(c, 0, -32, 0, 2, ['#a3784c', '#6a4b2d']);
    blob(c, [[-126, -36], [-108, -8], [-50, 2], [60, 2], [112, -8], [130, -36], [74, -22], [-70, -22]]);
    c.fill();
    c.beginPath();
    for (const y of [-14, -7]) {
      c.moveTo(-100, y);
      c.quadraticCurveTo(0, y + 6, 104, y);
    }
    c.strokeStyle = 'rgba(45,28,12,0.35)';
    c.lineWidth = 1.3;
    c.stroke();
    line(c, [[-104, -26], [-122, 4]], '#5e4227', 3.4);
    ell(c, -123, 5, 4, 9, '#5e4227', 0.55);
    c.restore();
    const r = wrap(t * 0.22, 1);
    c.beginPath();
    c.ellipse(0, 3, 124 + r * 20, 3 + r * 2.5, 0, 0, TAU);
    c.strokeStyle = `rgba(255,255,255,${0.45 * (1 - r)})`;
    c.lineWidth = 1.3;
    c.stroke();
  }
  function battlements(c, x, y, w, col, n) {
    const st = w / (n * 2 - 1);
    c.fillStyle = col;
    for (let i = 0; i < n; i++) c.fillRect(x + i * st * 2, y - st * 1.1, st, st * 1.1 + 0.5);
  }
  // Knights' castle on its green hill above the lake.
  function drawBurg(c, t) {
    c.fillStyle = grad(c, 0, -62, 0, 0, ['#8fbf6a', '#6a9c50']);
    blob(c, [[-98, 2], [-66, -34], [-20, -54], [34, -54], [70, -32], [100, 2]]);
    c.fill();
    dots(c, [[-68, -18, 7], [-48, -30, 6], [62, -18, 8], [78, -8, 6], [-82, -6, 7]], '#4f8644');
    const stone = '#d2c8b4';
    const shadeS = '#b4aa96';
    // far tower and curtain wall
    c.fillStyle = grad(c, 0, -112, 0, -48, [stone, shadeS]);
    c.fillRect(-60, -94, 114, 46);
    battlements(c, -60, -94, 114, stone, 10);
    // great keep
    c.fillStyle = grad(c, -24, 0, 12, 0, ['#ded5c2', shadeS]);
    c.fillRect(-26, -136, 40, 92);
    battlements(c, -28, -136, 44, '#ded5c2', 4);
    // round towers with pointed roofs
    const round = (x, y, wd, ht, roof) => {
      c.fillStyle = grad(c, x - wd / 2, 0, x + wd / 2, 0, ['#e6dcc9', shadeS]);
      c.fillRect(x - wd / 2, y - ht, wd, ht);
      c.fillStyle = roof;
      poly(c, [[x - wd * 0.66, y - ht + 1], [x, y - ht - wd * 1.05], [x + wd * 0.66, y - ht + 1]]);
      c.fill();
      rr(c, x - 3, y - ht + 10, 6, 11, 3);
      c.fillStyle = '#3e4a56';
      c.fill();
    };
    round(-58, -46, 24, 62, '#b0553a');
    round(54, -46, 26, 72, '#b0553a');
    // gate with a wooden door
    rr(c, -14, -74, 22, 30, 11);
    c.fillStyle = '#5e3f26';
    c.fill();
    for (const [x, y] of [[-14, -118], [0, -118], [-7, -98]]) {
      rr(c, x, y, 6.6, 12, 3);
      c.fillStyle = '#3e4a56';
      c.fill();
    }
    pennant(c, -6, -146, 28, '#d13a32', '#f4efe2', t, 0);
    pennant(c, 54, -146, 18, '#2d5fa8', '#f0d048', t, 2);
    pennant(c, -58, -131, 16, '#2d5fa8', '#f0d048', t, 4);
  }
  // Konstanz at the time of the Council: a tall minster, gabled houses, the great hall by the water, flags everywhere.
  function drawKonzilStadt(c, t) {
    // the town wall at the water's edge
    c.fillStyle = grad(c, 0, -20, 0, 2, ['#d9cfbb', '#b0a692']);
    c.fillRect(-108, -18, 216, 20);
    battlements(c, -108, -18, 216, '#d9cfbb', 15);
    const gable = (x, wd, ht, wall, roof) => {
      c.fillStyle = wall;
      c.fillRect(x, -18 - ht, wd, ht);
      c.fillStyle = roof;
      poly(c, [[x - 2, -17 - ht], [x + wd / 2, -18 - ht - wd * 0.8], [x + wd + 2, -17 - ht]]);
      c.fill();
      box(c, x + wd * 0.3, -18 - ht * 0.72, wd * 0.16, ht * 0.26, '#51606f');
      box(c, x + wd * 0.58, -18 - ht * 0.72, wd * 0.16, ht * 0.26, '#51606f');
    };
    // the minster with its great tower behind the roofs
    c.fillStyle = grad(c, -30, 0, 8, 0, ['#ece3cf', '#c9bea8']);
    c.fillRect(-30, -130, 36, 112);
    poly(c, [[-34, -130], [-12, -168], [10, -130]], '#6e7d8a');
    poly(c, [[-12, -168], [10, -130], [-8, -130]], '#5a6875');
    for (const y of [-120, -96, -72]) {
      rr(c, -20, y, 6.5, 15, 3.2);
      c.fillStyle = '#51606f';
      c.fill();
      rr(c, -7, y, 6.5, 15, 3.2);
      c.fillStyle = '#51606f';
      c.fill();
    }
    c.fillStyle = '#e7dcc6';
    c.fillRect(6, -70, 54, 52);
    poly(c, [[3, -69], [14, -90], [62, -90], [62, -69]], '#a9593b');
    pennant(c, -12, -166, 22, '#d13a32', '#f4efe2', t, 1);
    gable(-104, 24, 34, '#f2e6cb', '#b5603f');
    gable(-80, 22, 44, '#ead6b4', '#9c4f33');
    gable(-58, 26, 30, '#f4dfcf', '#b5603f');
    // the great hall of the Council
    c.fillStyle = '#efe6d2';
    c.fillRect(26, -46, 80, 28);
    c.fillStyle = grad(c, 0, -88, 0, -44, ['#c9694a', '#a84f33']);
    poly(c, [[22, -45], [40, -86], [92, -86], [110, -45]]);
    c.fill();
    for (let x = 34; x < 100; x += 13) {
      rr(c, x, -40, 7, 14, 3.5);
      c.fillStyle = '#51606f';
      c.fill();
    }
    pennant(c, 42, -86, 18, '#f0d048', '#2d5fa8', t, 3);
    pennant(c, 90, -86, 18, '#d13a32', '#f4efe2', t, 5);
    pennant(c, -70, -80, 15, '#2d8a58', '#f4efe2', t, 6);
    const r = wrap(t * 0.2, 1);
    c.beginPath();
    c.ellipse(0, 4, 104 + r * 12, 2.5 + r * 1.6, 0, 0, TAU);
    c.strokeStyle = `rgba(255,255,255,${0.45 * (1 - r)})`;
    c.lineWidth = 1.2;
    c.stroke();
  }

  // ================================================================== NEUZEIT
  function paintNeuzeit(g, w, h, u) {
    const hz = h * 0.45;
    const bank = h * 0.74;
    fillV(g, 0, 0, w, hz + 3, [[0, '#7cc6ea'], [0.6, '#cdeaf0'], [1, '#fdf0cf']]);
    glow(g, w * 0.12, h * 0.1, 130 * u, '#fff4c4', 0.85);
    ell(g, w * 0.12, h * 0.1, 20 * u, 20 * u, '#fffbe2');
    peaks(g, w, hz + 2, 124 * u, 124 * u, 9, '#adc2d4', 0.42);
    rolling(g, w, hz + 2, 30 * u, 0.008, 5, '#93bb96', hz + 3);
    // the far town with its church
    for (let i = 0; i < 12; i++) {
      const x = w * (0.56 + i * 0.033);
      const s = (8 + (i * 7) % 6) * u;
      box(g, x, hz - s, s * 1.2, s + 2 * u, ['#f2e6cb', '#ead6b4', '#f4dfcf'][i % 3]);
      poly(g, [[x - 1 * u, hz - s + 1 * u], [x + s * 0.6, hz - s * 1.65], [x + s * 1.2 + 1 * u, hz - s + 1 * u]], i % 2 ? '#b5603f' : '#9c4f33');
    }
    box(g, w * 0.74, hz - 34 * u, 8 * u, 34 * u, '#efe6d2');
    poly(g, [[w * 0.74 - 1.5 * u, hz - 34 * u], [w * 0.74 + 4 * u, hz - 52 * u], [w * 0.74 + 9.5 * u, hz - 34 * u]], '#6e7d8a');
    fillV(g, 0, hz, w, bank - hz + 18 * u, [[0, '#c0e9e6'], [0.3, '#84d4d6'], [1, '#3aa6b8']]);
    // grassy bank, stone edge, ballast and rails
    g.fillStyle = grad(g, 0, bank, 0, h, ['#a9cc66', '#86b54f', '#65983f']);
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= w + 14; i += 14) g.lineTo(i, bank + wave(i * 0.009 + 1) * 5 * u);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.fillStyle = '#d9cfb8';
    g.beginPath();
    for (let i = 0; i <= w + 14; i += 14) {
      const y = bank + wave(i * 0.009 + 1) * 5 * u;
      if (i) g.lineTo(i, y);
      else g.moveTo(i, y);
    }
    g.lineTo(w, bank + 8 * u);
    g.lineTo(0, bank + 8 * u);
    g.closePath();
    g.fill();
    const ry = h * 0.82;
    box(g, 0, ry - 1 * u, w, 12 * u, '#a39a88');
    g.fillStyle = '#6a4e33';
    for (let x = 0; x < w; x += 18 * u) g.fillRect(x, ry + 0 * u, 9 * u, 8 * u);
    box(g, 0, ry - 1.5 * u, w, 3.4 * u, '#59606a');
    box(g, 0, ry - 1.5 * u, w, 1 * u, '#aab2bb');
    tree(g, w * 0.03, h * 0.78, 110 * u, 'pappel', 0, 3);
    tree(g, w * 0.96, h * 0.78, 130 * u, 'pappel', 0, 5);
    tree(g, w * 0.5, h * 0.775, 66 * u, 'laub', 0, 2);
    const r = rngOf(5);
    for (let i = 0; i < 9; i++) {
      const y = h * (0.86 + r() * 0.13);
      const s = (10 + r() * 14) * u;
      ell(g, r() * w, y, s, s * 0.3, i % 2 ? 'rgba(70,120,50,0.42)' : 'rgba(195,220,115,0.5)');
    }
  }
  function backNeuzeit(c, w, h, t) {
    stage(c, w, h, 'neuzeit', paintNeuzeit);
    const u = h / 640;
    cloud(c, driftX(t, 4, w, 0.2), h * 0.14, 0.75 * u, 0.9);
    cloud(c, driftX(t, 2, w, 0.75), h * 0.3, 0.55 * u, 0.75);
    glitter(c, w, h * 0.46, h * 0.73, t, 24, 15, 'rgba(255,255,255,0.68)', 12 * u);
    bird(c, wrap(t * 9, w), h * 0.36, 6 * u, t, '#3d4a55');
    bird(c, wrap(t * 9 + 26 * u, w), h * 0.345, 5 * u, t + 1, '#3d4a55');
  }
  // Paddle steamer as on the lake from 1824: black hull, tall funnel with a long plume, turning paddle wheel.
  function drawRaddampfer(c, t, walk) {
    const rot = (walk || t * 1.2) * 0.7;
    c.translate(-4, sin(t * 0.8) * 1.2);
    // smoke plume leaning back
    for (let i = 0; i < 8; i++) {
      const p = wrap(t * 0.12 + i / 8, 1);
      const x = 24 - 120 * p;
      const y = -112 - 30 * p - sin(p * 5 + i) * 3;
      const r = 5 + 19 * p;
      ell(c, x, y, r, r * 0.84, `rgba(95,92,92,${0.55 * (1 - p) * min(1, p * 9) + 0.02})`);
    }
    // mast with a small flag
    line(c, [[-78, -30], [-78, -112]], '#5d4a35', 2.4);
    line(c, [[-78, -108], [24, -66]], 'rgba(60,50,40,0.4)', 1);
    line(c, [[64, -30], [64, -92]], '#5d4a35', 2);
    pennant(c, -78, -102, 26, '#d13a32', '#f4efe2', t, 0);
    // deck house, windows, railing
    c.fillStyle = grad(c, 0, -60, 0, -28, ['#fbf8f0', '#dfd9cb']);
    rr(c, -62, -56, 108, 28, 3);
    c.fill();
    box(c, -66, -60, 116, 4.4, '#7b5d3c', 2);
    for (let x = -52; x < 38; x += 16) {
      rr(c, x, -50, 9, 12, 2.4);
      c.fillStyle = '#4f6878';
      c.fill();
    }
    // tall funnel
    c.fillStyle = grad(c, 12, 0, 30, 0, ['#3b3a3d', '#19181a']);
    c.fillRect(13, -112, 16, 54);
    box(c, 11, -116, 20, 5, '#c9a24a');
    box(c, 13, -94, 16, 3.5, '#c23f30');
    // hull
    c.fillStyle = grad(c, 0, -34, 0, 2, ['#3d3d42', '#17171a']);
    blob(c, [[-122, -38], [-108, -6], [-50, 2], [62, 2], [108, -6], [132, -40], [76, -28], [-66, -28]]);
    c.fill();
    c.fillStyle = '#c23f30';
    c.beginPath();
    c.moveTo(-104, -9);
    c.quadraticCurveTo(0, 2, 108, -9);
    c.lineTo(104, -2);
    c.quadraticCurveTo(0, 7, -98, -2);
    c.closePath();
    c.fill();
    box(c, -112, -31, 228, 2.6, '#e6d3a8', 1);
    // paddle wheel and its half-round box
    const wx = -16;
    const wy = -18;
    const R = 26;
    ell(c, wx, wy, R, R, '#6d3a24');
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * TAU;
      c.moveTo(wx, wy);
      c.lineTo(wx + cos(a) * R, wy + sin(a) * R);
    }
    c.strokeStyle = '#e8cf9a';
    c.lineWidth = 3;
    c.stroke();
    c.beginPath();
    c.arc(wx, wy, R, PI, 0);
    c.lineTo(wx + R + 3, wy);
    c.lineTo(wx - R - 3, wy);
    c.closePath();
    c.fillStyle = '#f1ebdc';
    c.fill();
    c.beginPath();
    for (let i = 1; i < 5; i++) {
      const a = PI + (i / 5) * PI;
      c.moveTo(wx, wy);
      c.lineTo(wx + cos(a) * R, wy + sin(a) * R);
    }
    c.strokeStyle = '#c2483a';
    c.lineWidth = 2;
    c.stroke();
    ell(c, wx, wy, 5, 5, '#c9a24a');
    // foam
    const p = wrap(t * 0.8, 1);
    c.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = wx - 34 - i * 13 - p * 13;
      const y = 3 + sin(i * 2.7) * 2.4;
      const rr2 = (4.8 - i * 0.5) * (0.7 + 0.3 * sin(i * 4.1 + t));
      c.moveTo(x + rr2, y);
      c.arc(x, y, rr2, 0, TAU);
    }
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fill();
  }
  // LZ 1 of 1900: a very long, slender silver hull with two small gondolas.
  function drawZeppelin(c, t) {
    c.translate(0, -36 + sin(t * 0.6) * 3);
    c.rotate(sin(t * 0.3) * 0.008);
    const L = 138;
    // small tail fins
    poly(c, [[-122, -2], [-136, -18], [-112, -9]], '#aeb6bd');
    poly(c, [[-122, 2], [-136, 18], [-112, 9]], '#98a1a9');
    c.fillStyle = grad(c, 0, -19, 0, 19, ['#f7f9fa', '#d9dfe3', '#a9b2ba', '#8d97a0']);
    tube(c, [[-L, 0, 2], [-120, 0, 11], [-84, 0, 17], [0, 0, 18.5], [84, 0, 17], [120, 0, 11], [L, 0, 2.5]]);
    c.fill();
    c.beginPath();
    for (let x = -112; x <= 112; x += 16) {
      const hw = 18.5 * Math.sqrt(1 - (x / L) * (x / L));
      c.moveTo(x, -hw);
      c.quadraticCurveTo(x + 3, 0, x, hw);
    }
    c.strokeStyle = 'rgba(95,105,115,0.28)';
    c.lineWidth = 1;
    c.stroke();
    ell(c, 0, -9, 104, 2.4, 'rgba(255,255,255,0.75)');
    // keel walkway and gondolas
    line(c, [[-54, 19], [54, 19]], '#6d7680', 2.2);
    const gond = (x, ph) => {
      line(c, [[x - 12, 18], [x - 9, 27]], '#6d7680', 1.2);
      line(c, [[x + 12, 18], [x + 9, 27]], '#6d7680', 1.2);
      blob(c, [[x - 16, 26], [x + 16, 26], [x + 12, 34], [x - 12, 34]], '#7b5d3c');
      box(c, x - 13, 25, 26, 2, '#55412a');
      const b = abs(cos(t * 16 + ph)) * 7 + 1;
      ell(c, x - 18, 29, 1.2, b, 'rgba(70,70,80,0.65)');
    };
    gond(-46, 0);
    gond(46, 1);
  }
  // A small steam engine on the shore with its tender.
  function drawBahn(c, t, walk) {
    const rot = (walk || t * 2) * 0.9;
    c.translate(-12, 0);
    const wheel = (x, r, col) => {
      const y = -r;
      ell(c, x, y, r, r, '#23232a');
      ell(c, x, y, r - 2, r - 2, col);
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = rot * (14 / r) * 0.5 + (i / 6) * TAU;
        c.moveTo(x, y);
        c.lineTo(x + cos(a) * (r - 2), y + sin(a) * (r - 2));
      }
      c.strokeStyle = '#23232a';
      c.lineWidth = 1.5;
      c.stroke();
      ell(c, x, y, 2.2, 2.2, '#e8d9a8');
    };
    // puffs of steam going back
    for (let i = 0; i < 6; i++) {
      const p = wrap(t * 0.28 + i / 6, 1);
      const r = 4 + 15 * p;
      ell(c, 56 - 110 * p, -68 - 26 * p - sin(p * 6 + i) * 2, r, r * 0.86, `rgba(248,248,245,${0.8 * (1 - p) * min(1, p * 7)})`);
    }
    // tender behind
    c.fillStyle = grad(c, 0, -46, 0, -14, ['#3f6b52', '#2a4d3b']);
    rr(c, -86, -42, 46, 28, 3);
    c.fill();
    blob(c, [[-84, -42], [-74, -52], [-50, -52], [-42, -42]], '#2c2a28');
    box(c, -88, -15, 50, 3.4, '#23232a');
    wheel(-74, 9, '#b8392b');
    wheel(-52, 9, '#b8392b');
    box(c, -40, -18, 8, 3, '#23232a');
    // cab
    c.fillStyle = grad(c, 0, -66, 0, -14, ['#4a7a5e', '#2f5541']);
    rr(c, -32, -60, 32, 46, 2);
    c.fill();
    box(c, -36, -66, 40, 7, '#23232a', 3);
    rr(c, -26, -52, 20, 17, 2.5);
    c.fillStyle = '#d9ecf0';
    c.fill();
    // driver
    face(c, -16, -44, 7, '#ecc6a0', t, 6);
    c.beginPath();
    c.arc(-17, -46, 7.3, PI * 0.9, PI * 1.9);
    c.closePath();
    c.fillStyle = '#39424f';
    c.fill();
    // boiler with brass bands
    c.fillStyle = grad(c, 0, -50, 0, -18, ['#5a8d6f', '#35624a', '#28493a']);
    rr(c, -2, -48, 66, 30, 11);
    c.fill();
    for (const x of [14, 34, 52]) box(c, x, -48, 3, 30, '#d9b24d');
    box(c, 60, -49, 13, 32, '#2a2a2f', 5);
    // dome, funnel
    blob(c, [[20, -46], [21, -60], [29, -63], [36, -60], [37, -46]], '#d9b24d');
    c.fillStyle = grad(c, 50, 0, 64, 0, ['#3a393d', '#1a191c']);
    poly(c, [[52, -46], [51, -62], [47, -74], [69, -74], [65, -62], [64, -46]]);
    c.fill();
    box(c, 45, -77, 26, 4, '#d9b24d', 2);
    // running board and wheels
    box(c, -36, -18, 112, 3.6, '#23232a');
    wheel(-14, 14, '#c9402f');
    wheel(20, 14, '#c9402f');
    wheel(56, 8, '#c9402f');
    const rx = cos(rot) * 5;
    const ry = sin(rot) * 5;
    line(c, [[-14 + rx, -14 + ry], [20 + rx, -14 + ry]], '#d8d8d8', 2.6);
    // cow catcher
    poly(c, [[72, -16], [88, -1], [68, -1]], '#b8392b');
  }

  // ================================================================== HEUTE
  function paintHeute(g, w, h, u) {
    const hz = h * 0.43;
    fillV(g, 0, 0, w, hz + 3, [[0, '#4db4ec'], [0.6, '#b4e4f6'], [1, '#f6f7e4']]);
    glow(g, w * 0.84, h * 0.11, 130 * u, '#fff4c0', 0.85);
    ell(g, w * 0.84, h * 0.11, 21 * u, 21 * u, '#fffbe2');
    // the snowy Alps with the Saentis
    peaks(g, w, hz + 2, 136 * u, 120 * u, 11, '#9cb8cf', 0.44);
    peaks(g, w, hz + 2, 74 * u, 88 * u, 3, '#86a6bf', 0.2);
    rolling(g, w, hz + 2, 26 * u, 0.008, 7, '#8fbb8d', hz + 3);
    // far-shore towns and harbours
    const r = rngOf(9);
    for (let i = 0; i < 24; i++) {
      const x = r() * w;
      const s = (5 + r() * 6) * u;
      box(g, x, hz - s, s * 1.3, s + 2 * u, ['#fbf7ee', '#f2e6cb', '#f4dfcf', '#e3e7ea'][i % 4]);
      poly(g, [[x - 1 * u, hz - s + 1 * u], [x + s * 0.65, hz - s * 1.6], [x + s * 1.3 + 1 * u, hz - s + 1 * u]], i % 2 ? '#b5603f' : '#8f5a45');
    }
    fillV(g, 0, hz, w, h - hz, [[0, '#c0ecec'], [0.25, '#6fd0dc'], [0.7, '#2a9fc2'], [1, '#1f86ad']]);
    // the right shore with meadow, poplars and a little vineyard
    g.fillStyle = '#efdcaa';
    blob(g, [[w * 1.15, h * 0.6], [w * 0.8, h * 0.64], [w * 0.68, h * 0.76], [w * 0.62, h * 0.92], [w * 0.6, h * 1.15], [w * 1.15, h * 1.15]]);
    g.fill();
    g.fillStyle = grad(g, 0, h * 0.6, 0, h, ['#b6d76e', '#8bc053', '#68a043']);
    blob(g, [[w * 1.15, h * 0.61], [w * 0.83, h * 0.65], [w * 0.72, h * 0.77], [w * 0.67, h * 0.92], [w * 0.65, h * 1.15], [w * 1.15, h * 1.15]]);
    g.fill();
    tree(g, w * 0.96, h * 0.66, 120 * u, 'pappel', 0, 2);
    tree(g, w * 0.88, h * 0.65, 88 * u, 'apfel', 0, 8);
    g.beginPath();
    for (let j = 0; j < 4; j++) {
      const y = h * (0.86 + j * 0.035);
      g.moveTo(w * 0.72, y);
      g.lineTo(w * 1.02, y - 8 * u);
    }
    g.strokeStyle = 'rgba(60,110,50,0.4)';
    g.lineWidth = 2 * u;
    g.setLineDash([3 * u, 5 * u]);
    g.stroke();
    g.setLineDash([]);
    // the frozen part of the lake, as in the winter of 1963
    const ice = [[-w * 0.15, h * 0.68], [w * 0.14, h * 0.645], [w * 0.42, h * 0.67], [w * 0.6, h * 0.78], [w * 0.56, h * 0.96], [w * 0.48, h * 1.15], [-w * 0.15, h * 1.15]];
    blob(g, ice, 'rgba(255,255,255,0.75)');
    g.fillStyle = grad(g, 0, h * 0.64, 0, h, ['#eef9fc', '#d2edf6', '#b9e0ef']);
    blob(g, ice.map(([x, y]) => [x - w * 0.012, y + 6 * u]));
    g.fill();
    const q = rngOf(11);
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const x = q() * w * 0.55;
      const y = h * (0.7 + q() * 0.28);
      const L = (20 + q() * 50) * u;
      g.moveTo(x - L, y);
      g.quadraticCurveTo(x, y + (q() - 0.5) * 14 * u, x + L, y + (q() - 0.5) * 8 * u);
    }
    g.strokeStyle = 'rgba(130,190,215,0.7)';
    g.lineWidth = 1.1 * u;
    g.stroke();
    // far out people walk across the ice to the other shore, as they did that winter
    const y1 = h * 0.685;
    for (let i = 0; i < 11; i++) {
      const x = w * (0.04 + i * 0.033) + sin(i * 3) * 3 * u;
      const y = y1 + i * 0.9 * u + (i % 2) * 2 * u;
      box(g, x - 1.7 * u, y - 7 * u, 3.4 * u, 7 * u, ['#39424f', '#7a3a2c', '#2d5a7a'][i % 3], 1.4 * u);
      ell(g, x, y - 9 * u, 1.8 * u, 1.8 * u, '#ecc6a0');
    }
    // soft snow drifts on the ice
    ell(g, w * 0.06, h * 0.93, 90 * u, 12 * u, 'rgba(255,255,255,0.8)');
    ell(g, w * 0.4, h * 0.88, 60 * u, 7 * u, 'rgba(255,255,255,0.7)');
  }
  function backHeute(c, w, h, t) {
    stage(c, w, h, 'heute', paintHeute);
    const u = h / 640;
    cloud(c, driftX(t, 4, w, 0.15), h * 0.14, 0.75 * u, 0.9);
    cloud(c, driftX(t, 2.5, w, 0.65), h * 0.25, 0.5 * u, 0.75);
    glitter(c, w, h * 0.44, h * 0.66, t, 18, 21, 'rgba(255,255,255,0.72)', 11 * u);
    glitter(c, w * 0.62, h * 0.66, h * 0.76, t, 3, 3, 'rgba(255,255,255,0.72)', 16 * u);
    sailboat(c, driftX(t, 3, w, 0.8), h * 0.47, 0.42 * u, t, '#ffd23f');
    sailboat(c, w - driftX(t, 2, w, 0.3), h * 0.5, 0.55 * u, t, '#fff');
  }
  function drawSegelboot(c, t) {
    c.save();
    c.translate(0, -3 + sin(t * 1.0) * 1.2);
    c.rotate(sin(t * 0.9) * 0.025);
    box(c, -2, -112, 4, 96, '#8d7a62', 1.5);
    // big sail with two bright stripes, small sail in front
    const lean = sin(t * 0.8) * 2;
    c.fillStyle = grad(c, 0, -110, 0, -20, ['#ffffff', '#eef2f4']);
    poly(c, [[-4, -108], [-48 + lean, -20], [-4, -20]]);
    c.fill();
    poly(c, [[-4, -66], [-27 + lean * 0.6, -62], [-34 + lean * 0.8, -48], [-4, -48]], '#e4483a');
    poly(c, [[-4, -48], [-34 + lean * 0.8, -48], [-41 + lean, -34], [-4, -34]], '#ffd23f');
    c.fillStyle = grad(c, 0, -100, 0, -20, ['#ffffff', '#e7eef2']);
    poly(c, [[4, -100], [40 + lean, -22], [4, -22]]);
    c.fill();
    // sailor, then hull
    blob(c, [[-34, -14], [-33, -28], [-19, -28], [-17, -14]], '#2f7fc2');
    face(c, -25, -36, 8.6, '#ecc6a0', t, 2);
    c.beginPath();
    c.arc(-26, -38, 9, PI * 0.9, PI * 1.9);
    c.closePath();
    c.fillStyle = '#d6402f';
    c.fill();
    c.fillStyle = grad(c, 0, -18, 0, 3, ['#ffffff', '#d3dde2']);
    blob(c, [[-50, -18], [-42, -3], [-20, 3], [26, 3], [50, -6], [62, -21], [14, -17]]);
    c.fill();
    c.beginPath();
    c.moveTo(-47, -10);
    c.quadraticCurveTo(4, -5, 56, -14);
    c.lineTo(51, -8);
    c.quadraticCurveTo(4, 0, -44, -5);
    c.closePath();
    c.fillStyle = '#1f6fae';
    c.fill();
    c.restore();
    const r = wrap(t * 0.3, 1);
    c.beginPath();
    c.ellipse(4, 2, 58 + r * 16, 3 + r * 2, 0, 0, TAU);
    c.strokeStyle = `rgba(255,255,255,${0.65 * (1 - r)})`;
    c.lineWidth = 1.3;
    c.stroke();
  }
  // Modern car ferry, open car deck, bridge on top.
  function drawFaehre(c, t) {
    c.translate(0, sin(t * 0.8) * 1.2);
    // cars on the deck
    const car = (x, col) => {
      rr(c, x, -40, 30, 12, 4);
      c.fillStyle = col;
      c.fill();
      rr(c, x + 6, -49, 17, 11, 4);
      c.fillStyle = col;
      c.fill();
      box(c, x + 8.5, -47, 5.4, 7, '#cfe6ee', 1);
      box(c, x + 15, -47, 5.4, 7, '#cfe6ee', 1);
    };
    car(-92, '#e4483a');
    car(-54, '#f0c63a');
    car(52, '#3b84c4');
    // upper deck and bridge on legs across the deck
    box(c, -34, -58, 6, 32, '#dfe6ea');
    box(c, 28, -58, 6, 32, '#dfe6ea');
    c.fillStyle = grad(c, 0, -66, 0, -52, ['#ffffff', '#e4eaee']);
    rr(c, -46, -64, 92, 11, 3);
    c.fill();
    c.fillStyle = grad(c, 0, -86, 0, -64, ['#ffffff', '#e8edf0']);
    rr(c, -22, -84, 44, 21, 4);
    c.fill();
    box(c, -18, -80, 36, 9, '#3f6d84', 2);
    box(c, 26, -82, 9, 19, '#1f6fae', 2);
    box(c, 26, -82, 9, 4, '#f7f9fa');
    // hull, pointing both ways as a real ferry does
    c.fillStyle = grad(c, 0, -30, 0, 2, ['#fbfdfe', '#c8d2d8']);
    blob(c, [[-124, -29], [-110, -6], [-70, 2], [70, 2], [110, -6], [124, -29]]);
    c.fill();
    c.fillStyle = '#1f6fae';
    c.beginPath();
    c.moveTo(-116, -17);
    c.quadraticCurveTo(0, -10, 116, -17);
    c.lineTo(108, -6);
    c.quadraticCurveTo(0, 4, -108, -6);
    c.closePath();
    c.fill();
    box(c, -120, -31, 240, 3.2, '#8d9aa4', 1.4);
    const p = wrap(t * 0.5, 1);
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = 106 + i * 7 - p * 7;
      const y = 2 + sin(i * 2.7) * 1.8;
      const rw = (3.6 - i * 0.5) * (0.75 + 0.25 * sin(i * 3.3 + t));
      c.moveTo(x + rw, y);
      c.arc(x, y, rw, 0, TAU);
      c.moveTo(-x + rw, y);
      c.arc(-x, y, rw, 0, TAU);
    }
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fill();
  }
  function skater(c, x, y, s, coat, hat, A, spd, ph, t) {
    const a = t * spd + ph;
    const px = sin(a) * A;
    const dir = cos(a) < 0 ? -1 : 1;
    const stride = sin(t * 2.2 + ph) * 0.5;
    c.save();
    c.translate(x + px, y);
    c.scale(s * dir, s);
    ell(c, 0, 1, 15, 2.6, 'rgba(50,110,150,0.3)');
    const leg = (ang, col) => {
      c.save();
      c.translate(0, -24);
      c.rotate(ang);
      box(c, -3.2, 0, 6.4, 20, col, 3);
      box(c, -3.6, 19, 10.6, 4.4, '#3a3a40', 2);
      line(c, [[-5, 24.6], [9, 24.6]], '#d4d9dd', 1.5);
      c.restore();
    };
    leg(-0.1 - stride * 0.6, '#35486a');
    leg(0.2 + stride * 0.6, '#3f5478');
    armAt(c, -2, -40, 2.0, 15, 5, coat, '#ecc6a0');
    blob(c, [[-9, -22], [-10, -40], [9, -42], [11, -22]], coat);
    armAt(c, 3, -40, -1.05, 15, 5, coat, '#ecc6a0');
    // scarf streaming behind
    const fl = sin(t * 4 + ph) * 2;
    tube(c, [[-5, -42, 2.6], [-14, -41 + fl * 0.5, 2.2], [-22, -38 + fl, 1]], hat);
    face(c, 1, -51, 9.4, '#f0cdaa', t, ph);
    c.beginPath();
    c.arc(0, -53, 9.8, PI * 0.96, PI * 1.92);
    c.closePath();
    c.fillStyle = hat;
    c.fill();
    ell(c, -3, -63, 2.8, 2.8, '#fff');
    c.restore();
  }
  // Children skating on the frozen lake, as in the Seegfroerne of 1963.
  function drawSeegfroerne(c, t) {
    c.beginPath();
    c.ellipse(-30, -32, 62, 10, 0.1, 0, TAU);
    c.moveTo(90, -14);
    c.ellipse(30, -14, 60, 8, -0.06, 0, TAU);
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 1.2;
    c.stroke();
    skater(c, -46, -58, 1.02, '#3f8f68', '#e4483a', 44, 0.45, 2.1, t);
    skater(c, 60, -36, 1.12, '#d6402f', '#f0c63a', 48, 0.38, 0.5, t);
    skater(c, -26, -4, 1.24, '#f0c63a', '#2f7fc2', 56, 0.32, 4, t);
  }
  // Water tower: the lake gives drinking water to millions of people, a drop on the tank shows it.
  function drawTrinkwasser(c, t) {
    shadow(c, 0, 40, 5);
    c.fillStyle = grad(c, -18, 0, 18, 0, ['#ffffff', '#ccd7de']);
    poly(c, [[-22, 0], [-11, -106], [11, -106], [22, 0]]);
    c.fill();
    rr(c, -8, -30, 16, 30, 7);
    c.fillStyle = '#6d8a9c';
    c.fill();
    for (const y of [-88, -66, -46]) box(c, -3.5, y, 7, 9, '#7fa8bf', 3);
    c.fillStyle = grad(c, -40, 0, 40, 0, ['#d5eef8', '#80c6e4', '#3f9fce']);
    blob(c, [[-40, -114], [-40, -146], [-22, -166], [22, -166], [40, -146], [40, -114], [18, -100], [-18, -100]]);
    c.fill();
    box(c, -41, -119, 82, 4, 'rgba(255,255,255,0.65)');
    ell(c, 0, -166, 18, 3.6, '#e7f4fa');
    // the big drop on the tank, gently swelling
    const k = 1 + sin(t * 1.5) * 0.05;
    c.save();
    c.translate(0, -132);
    c.scale(k, k);
    c.beginPath();
    c.moveTo(0, -22);
    c.bezierCurveTo(5, -11, 14, -6, 14, 4);
    c.bezierCurveTo(14, 12, 7, 16, 0, 16);
    c.bezierCurveTo(-7, 16, -14, 12, -14, 4);
    c.bezierCurveTo(-14, -6, -5, -11, 0, -22);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    ell(c, 0, 4, 9.6, 9.6, '#59b4e4');
    ell(c, -3.4, 0.5, 2.4, 3.4, '#ffffff');
    c.restore();
    // small tap with a falling drop into the grass
    box(c, 22, -30, 16, 4, '#8d9aa4', 2);
    box(c, 34, -30, 4, 8, '#8d9aa4', 1.5);
    const p = wrap(t * 0.7, 1);
    ell(c, 36, -20 + p * 18, 2.4, 3.2, '#59b4e4');
    c.beginPath();
    c.ellipse(36, -1, 3 + p * 8, 1 + p * 2, 0, 0, TAU);
    c.strokeStyle = `rgba(89,180,228,${0.8 * (1 - p)})`;
    c.lineWidth = 1.2;
    c.stroke();
  }

  BE.eraArt = {
    trias: {
      back: backTrias,
      creatures: {
        schachtelhalm: fig(0.14, 0.72, 1, 80, 150, 0, drawSchachtelhalm),
        plateosaurus: fig(0.58, 0.7, 1, 250, 176, 60, drawPlateo),
        plateosaurus_jung: fig(0.3, 0.82, 1, 110, 90, 40, drawPlateoJung),
      },
    },
    jura: {
      back: backJura,
      creatures: {
        flugsaurier: fig(0.56, 0.24, 1, 130, 110, 130, drawFlugsaurier),
        seelilie: fig(0.17, 0.62, 1, 170, 210, 0, drawSeelilie),
        ichthyosaurier: fig(0.64, 0.5, 1, 210, 90, 100, drawIchthyo),
        plesiosaurier: fig(0.42, 0.74, 1, 230, 110, 70, drawPlesio),
        ammonit: fig(0.8, 0.66, 1, 96, 80, 20, drawAmmonit),
        meereskrokodil: fig(0.6, 0.82, 1, 220, 60, 60, drawKroko),
      },
    },
    kreide: {
      back: backKreide,
      creatures: {
        komet: fig(0.72, 0.2, 1, 90, 60, 0, drawKomet),
        kreide_meeresschildkroete: fig(0.42, 0.72, 0.9, 200, 120, 90, drawKreideKroete),
        kreide_ammonit: fig(0.74, 0.82, 1, 130, 104, 24, drawKreideAmmonit),
      },
    },
    miozaen: {
      back: backMiozaen,
      creatures: {
        libelle: fig(0.34, 0.5, 1, 90, 60, 110, drawLibelle),
        urelefant: fig(0.66, 0.66, 0.8, 300, 170, 30, drawGompho),
        riesensalamander: fig(0.24, 0.8, 1, 230, 62, 0, drawSalamander),
        schildkroete: fig(0.5, 0.82, 0.68, 110, 52, 24, drawSchildkroete),
        urfuchs: fig(0.84, 0.82, 1, 130, 80, 50, drawUrfuchs),
      },
    },
    vulkane: {
      back: backVulkane,
      creatures: {
        alpen_wachsen: fig(0.8, 0.54, 1, 260, 110, 0, drawAlpen),
        vulkan_kegel: fig(0.34, 0.6, 1, 340, 300, 0, drawVulkan),
        hauerelefant: fig(0.64, 0.82, 0.86, 270, 220, 44, drawDeino),
      },
    },
    gletscher: {
      back: backGletscher,
      creatures: {
        bergspitze: fig(0.22, 0.42, 1, 150, 120, 0, drawBergspitze),
        rheingletscher: fig(0.5, 0.8, 1, 440, 250, 0, drawGletscherstrom),
        findling: fig(0.76, 0.82, 1, 124, 76, 0, drawFindling),
      },
    },
    eiszeit: {
      back: backEiszeit,
      creatures: {
        rentier: fig(0.8, 0.56, 0.72, 170, 170, 44, drawRentier),
        wildpferd: fig(0.2, 0.6, 0.8, 140, 120, 50, drawWildpferd),
        mammut: fig(0.58, 0.74, 0.86, 300, 210, 36, drawMammut),
        wollnashorn: fig(0.27, 0.8, 0.9, 240, 120, 44, drawWollnashorn),
        jaegerin: fig(0.86, 0.82, 1, 60, 134, 24, drawJaegerin),
        schneehase: fig(0.54, 0.82, 1, 54, 62, 40, drawHase),
      },
    },
    see_entsteht: {
      back: backSee,
      creatures: {
        kranich: fig(0.54, 0.7, 0.92, 100, 170, 40, drawKranich),
        schmelzwasser: fig(0.24, 0.82, 1, 190, 150, 0, drawSchmelzwasser),
        birke: fig(0.82, 0.82, 1, 120, 200, 0, drawBirke),
      },
    },
    pfahlbau_zeit: {
      back: backPfahlbau,
      creatures: {
        einbaum: fig(0.72, 0.56, 1, 180, 70, 50, drawEinbaum),
        pfahlhaus: fig(0.4, 0.68, 1, 280, 200, 0, drawPfahlhaus),
        topf: fig(0.16, 0.82, 1, 80, 90, 0, drawTopf),
        kuh: fig(0.72, 0.82, 1, 130, 96, 36, drawKuh),
      },
    },
    roemer_zeit: {
      back: backRoemer,
      creatures: {
        roemerhaus: fig(0.78, 0.66, 0.9, 190, 130, 0, drawRoemerhaus),
        roemerschiff: fig(0.36, 0.68, 1, 260, 170, 80, drawRoemerschiff),
        legionaer: fig(0.56, 0.82, 1, 70, 124, 36, drawLegionaer),
      },
    },
    mittelalter: {
      back: backMittelalter,
      creatures: {
        ritterburg: fig(0.82, 0.48, 0.8, 200, 180, 0, drawBurg),
        konzil_stadt: fig(0.22, 0.48, 0.86, 230, 180, 0, drawKonzilStadt),
        laedine: fig(0.5, 0.68, 0.86, 260, 180, 70, drawLaedine),
        moench: fig(0.26, 0.82, 1, 140, 90, 0, drawMoench),
      },
    },
    neuzeit: {
      back: backNeuzeit,
      creatures: {
        zeppelin_lz1: fig(0.54, 0.26, 0.86, 290, 76, 50, drawZeppelin),
        raddampfer: fig(0.4, 0.68, 0.9, 270, 150, 70, drawRaddampfer),
        bahn: fig(0.68, 0.82, 1, 190, 84, 60, drawBahn),
      },
    },
    heute: {
      back: backHeute,
      creatures: {
        faehre: fig(0.36, 0.6, 0.86, 260, 90, 60, drawFaehre),
        segelboot: fig(0.74, 0.5, 0.86, 110, 110, 30, drawSegelboot),
        trinkwasser: fig(0.84, 0.8, 1, 90, 170, 0, drawTrinkwasser),
        seegfroerne_1963: fig(0.3, 0.82, 1, 260, 110, 0, drawSeegfroerne),
      },
    },
  };
})();
