/* Zeichen-Werkzeuge für die Ausflüge. Flacher, freundlicher Stil wie im Tauchgang: klare Formen, weiche Verläufe, kaum Umrisse. */
BE.art = (() => {
  'use strict';
  const TAU = Math.PI * 2;

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // shade('#336699', 0.2) lightens, shade('#336699', -0.2) darkens
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const to = amt < 0 ? 0 : 255;
    const k = Math.abs(amt);
    const m = (v) => Math.round(v + (to - v) * k);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }
  function mix(a, b, t) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    const m = (i) => Math.round(x[i] + (y[i] - x[i]) * t);
    return `#${((1 << 24) + (m(0) << 16) + (m(1) << 8) + m(2)).toString(16).slice(1)}`;
  }
  function rngOf(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function wave(x) {
    return Math.sin(x) * 0.5 + Math.sin(x * 2.3 + 1.3) * 0.3 + Math.sin(x * 4.1 + 2.1) * 0.2;
  }

  const rr = (c, x, y, w, h, r) => {
    const q = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + q, y);
    c.arcTo(x + w, y, x + w, y + h, q);
    c.arcTo(x + w, y + h, x, y + h, q);
    c.arcTo(x, y + h, x, y, q);
    c.arcTo(x, y, x + w, y, q);
    c.closePath();
  };
  function box(c, x, y, w, h, col, r) {
    c.fillStyle = col;
    if (r) {
      rr(c, x, y, w, h, r);
      c.fill();
    } else c.fillRect(x, y, w, h);
  }
  function poly(c, pts, col) {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    if (col) {
      c.fillStyle = col;
      c.fill();
    }
  }
  function ell(c, x, y, rx, ry, col, rot) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    if (col) {
      c.fillStyle = col;
      c.fill();
    }
  }
  function line(c, pts, col, w, cap) {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = cap || 'round';
    c.lineJoin = 'round';
    c.stroke();
  }
  function grad(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s, i) => g.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s));
    return g;
  }
  function eye(c, x, y, r) {
    ell(c, x, y, r, r, '#fff');
    ell(c, x + r * 0.25, y, r * 0.6, r * 0.6, '#1b1a18');
    ell(c, x + r * 0.45, y - r * 0.3, r * 0.2, r * 0.2, '#fff');
  }

  // ------------------------------------------------------------------ flags
  const FLAGS = {
    at: (c, w, h) => {
      box(c, 0, 0, w, h, '#c8102e');
      box(c, 0, h / 3, w, h / 3, '#fff');
    },
    de: (c, w, h) => {
      box(c, 0, 0, w, h / 3 + 0.5, '#1a1a1a');
      box(c, 0, h / 3, w, h / 3 + 0.5, '#d00');
      box(c, 0, h * 2 / 3, w, h / 3, '#ffce00');
    },
    ch: (c, w, h) => {
      box(c, 0, 0, w, h, '#d52b1e');
      const s = h * 0.56;
      const t = s / 3;
      box(c, w / 2 - t / 2, h / 2 - s / 2, t, s, '#fff');
      box(c, w / 2 - s / 2, h / 2 - t / 2, s, t, '#fff');
    },
    li: (c, w, h) => {
      box(c, 0, 0, w, h / 2, '#002b7f');
      box(c, 0, h / 2, w, h / 2, '#ce1126');
    },
  };
  function flagPlain(c, x, y, w, h, land) {
    c.save();
    c.translate(x, y);
    rr(c, 0, 0, w, h, Math.min(3, h * 0.12));
    c.clip();
    FLAGS[land](c, w, h);
    c.restore();
  }
  const flagTiles = {};
  function flagTile(land) {
    if (!flagTiles[land]) {
      const off = document.createElement('canvas');
      off.width = 80;
      off.height = 52;
      FLAGS[land](off.getContext('2d'), 80, 52);
      flagTiles[land] = off;
    }
    return flagTiles[land];
  }
  // Flag on a pole, foot at x,y. Waves with t.
  function flag(c, x, y, h, land, t) {
    box(c, x - 1.5, y - h, 3, h, '#8d8a80');
    const w = h * 0.5;
    const fh = h * 0.32;
    const col = 10;
    const off = flagTile(land);
    for (let i = 0; i < col; i++) {
      const u = i / col;
      const dy = Math.sin(u * 5 - (t || 0) * 3.5) * fh * 0.1 * u;
      c.drawImage(off, u * 80, 0, 80 / col + 0.5, 52, x + 1.5 + u * w, y - h + 2 + dy, w / col + 0.8, fh);
    }
  }

  // ------------------------------------------------------------------ nature
  function cloud(c, x, y, s, a) {
    c.globalAlpha = a === undefined ? 0.9 : a;
    c.fillStyle = '#fff';
    for (const [dx, dy, r] of [[-40, 6, 22], [-14, -6, 30], [18, -2, 26], [44, 8, 18], [2, 10, 30]]) {
      c.beginPath();
      c.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  // Deciduous, conifer, poplar or apple tree. Foot at x,y; sway with t.
  function tree(c, x, y, h, kind, t, seed) {
    const sway = Math.sin((t || 0) * 0.9 + (seed || x) * 0.13) * h * 0.012;
    if (kind === 'tanne') {
      box(c, x - h * 0.03, y - h * 0.2, h * 0.06, h * 0.2, '#5a4128');
      for (let i = 0; i < 3; i++) {
        const b = y - h * (0.14 + i * 0.26);
        const w = h * (0.27 - i * 0.06);
        poly(c, [[x - w, b], [x + w, b], [x + sway * (i + 1), b - h * 0.38]], i === 2 ? '#2f6f4b' : i === 1 ? '#2a6444' : '#25593c');
      }
      return;
    }
    box(c, x - h * 0.035, y - h * 0.5, h * 0.07, h * 0.5, '#6a4c30');
    if (kind === 'pappel') {
      ell(c, x + sway, y - h * 0.62, h * 0.15, h * 0.42, '#4c8a4a');
      ell(c, x + sway - h * 0.03, y - h * 0.68, h * 0.08, h * 0.26, '#6aa35c');
      return;
    }
    const col = kind === 'apfel' ? '#5f9c4c' : '#4f9150';
    ell(c, x + sway - h * 0.17, y - h * 0.58, h * 0.22, h * 0.2, shade(col, -0.1));
    ell(c, x + sway + h * 0.17, y - h * 0.6, h * 0.23, h * 0.21, shade(col, -0.05));
    ell(c, x + sway, y - h * 0.78, h * 0.27, h * 0.24, col);
    ell(c, x + sway - h * 0.05, y - h * 0.84, h * 0.14, h * 0.11, shade(col, 0.18));
    if (kind === 'apfel') {
      const r = rngOf(seed || 7);
      for (let i = 0; i < 9; i++) ell(c, x + sway + (r() - 0.5) * h * 0.6, y - h * (0.5 + r() * 0.42), h * 0.022, h * 0.022, '#d8402f');
    }
  }
  function reed(c, x, y, h, t, seed) {
    const r = rngOf(seed || x * 7);
    for (let i = 0; i < 6; i++) {
      const dx = (r() - 0.5) * 16;
      const hh = h * (0.7 + r() * 0.4);
      const bend = Math.sin((t || 0) * 1.2 + i + dx) * 3;
      line(c, [[x + dx, y], [x + dx + bend, y - hh]], '#8f9c52', 1.7);
      if (i % 2 === 0) ell(c, x + dx + bend, y - hh, 1.8, 6, '#7a4f2a');
    }
  }
  function flower(c, x, y, s, col, t, seed) {
    const sway = Math.sin((t || 0) * 1.4 + (seed || x)) * s * 0.15;
    line(c, [[x, y], [x + sway, y - s]], '#4f8f4e', Math.max(1, s * 0.09));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      ell(c, x + sway + Math.cos(a) * s * 0.2, y - s + Math.sin(a) * s * 0.2, s * 0.16, s * 0.16, col);
    }
    ell(c, x + sway, y - s, s * 0.11, s * 0.11, '#ffe066');
  }
  function bird(c, x, y, s, t, col) {
    const f = Math.sin(t * 8) * s * 0.5;
    line(c, [[x - s, y - f], [x - s * 0.3, y], [x, y + s * 0.1], [x + s * 0.3, y], [x + s, y - f]], col || '#26343a', Math.max(1.2, s * 0.14));
  }

  // Sharp ridges behind everything. base = y of the foot; shift = parallax offset; snow = 0..1.
  function ridge(c, w, base, amp, freq, shift, col, snow, seed) {
    const peak = (x) => 1 - Math.abs(Math.sin(x));
    const top = (x) => base - amp * (0.34 + 0.66 * (peak((x + seed) * freq) * 0.62 + peak((x + seed) * freq * 2.7 + 1) * 0.28 + peak((x + seed) * freq * 6.1 + 2) * 0.1));
    c.beginPath();
    c.moveTo(0, base + 2);
    for (let i = 0; i <= w + 10; i += 10) c.lineTo(i, top(i + shift));
    c.lineTo(w, base + 2);
    c.closePath();
    c.fillStyle = col;
    c.fill();
    if (snow) {
      c.save();
      c.beginPath();
      for (let i = 0; i <= w + 10; i += 10) {
        const y = top(i + shift);
        if (i === 0) c.moveTo(i, y);
        else c.lineTo(i, y);
      }
      for (let i = w + 10 - ((w + 10) % 10); i >= 0; i -= 10) {
        const y = top(i + shift);
        const snowline = base - amp * snow;
        c.lineTo(i, y >= snowline ? y : Math.min(y + amp * 0.16, snowline));
      }
      c.closePath();
      c.fillStyle = 'rgba(255,255,255,0.86)';
      c.fill();
      c.restore();
    }
  }

  // ------------------------------------------------------------------ buildings and boats
  const WALLS = ['#f2e3c4', '#e7c9a0', '#dfe6d6', '#f4d8c6', '#d9dfe6', '#efe9dc'];
  const ROOFS = ['#b0522f', '#94452b', '#a85f3a', '#7d4a33'];
  // style: 'plain', 'fachwerk' (half-timbered), 'holz' (Vorarlberg timber), 'fresko' (painted Swiss front). Foot at x,y; x is the left edge.
  function house(c, x, y, w, h, style, seed) {
    const r = rngOf((seed || 1) * 131);
    const wall = style === 'holz' ? '#8a5e3a' : WALLS[Math.floor(r() * WALLS.length)];
    const roof = ROOFS[Math.floor(r() * ROOFS.length)];
    box(c, x, y - h, w, h, wall);
    box(c, x + w * 0.72, y - h, w * 0.28, h, 'rgba(0,0,0,0.07)');
    poly(c, [[x - w * 0.08, y - h], [x + w * 1.08, y - h], [x + w * 0.5, y - h - w * 0.55]], roof);
    poly(c, [[x + w * 0.5, y - h - w * 0.55], [x + w * 1.08, y - h], [x + w * 0.72, y - h]], 'rgba(0,0,0,0.12)');
    if (style === 'fachwerk') {
      const beam = '#5e3f26';
      for (let i = 0; i <= 4; i++) box(c, x + (w - 3) * (i / 4), y - h, 3, h, beam);
      for (let j = 1; j <= 2; j++) box(c, x, y - h + (h / 3) * j, w, 3, beam);
      for (let i = 0; i < 4; i += 2) line(c, [[x + (w / 4) * i, y - h + 3], [x + (w / 4) * (i + 1), y - h * 0.67]], beam, 2.4, 'butt');
    }
    if (style === 'holz') for (let i = 1; i < 7; i++) box(c, x, y - h + (h / 7) * i, w, 1.2, 'rgba(0,0,0,0.18)');
    if (style === 'fresko') {
      const col = ['#c9543a', '#3f7d8c', '#d9a93b'][Math.floor(r() * 3)];
      box(c, x + w * 0.14, y - h * 0.94, w * 0.72, h * 0.2, col);
      for (let i = 0; i < 5; i++) ell(c, x + w * (0.2 + i * 0.15), y - h * 0.84, w * 0.04, h * 0.05, '#fff5d6');
    }
    const cols = Math.max(2, Math.round(w / 26));
    const rows = Math.max(1, Math.round(h / 34));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const wx = x + (w / cols) * (i + 0.5) - 6;
        const wy = y - h + 10 + j * ((h - 14) / rows);
        if (j === rows - 1 && i === Math.floor(cols / 2)) {
          box(c, wx - 1, y - 24, 14, 24, '#5e3f26', 2);
          continue;
        }
        box(c, wx, wy, 12, 15, '#e9f2f2');
        box(c, wx, wy, 12, 15, 'rgba(50,90,110,0.45)');
        box(c, wx + 5.2, wy, 1.5, 15, wall);
      }
    }
  }
  function sailboat(c, x, y, s, t, col) {
    const rock = Math.sin(t * 1.1 + x) * 0.03;
    c.save();
    c.translate(x, y);
    c.rotate(rock);
    poly(c, [[-22 * s, 0], [22 * s, 0], [14 * s, 8 * s], [-16 * s, 8 * s]], '#f5f1e6');
    box(c, -1 * s, -46 * s, 2 * s, 46 * s, '#6d5a42');
    poly(c, [[1.5 * s, -44 * s], [20 * s, -4 * s], [1.5 * s, -4 * s]], col || '#fff');
    poly(c, [[-1.5 * s, -38 * s], [-15 * s, -4 * s], [-1.5 * s, -4 * s]], '#e7e2d3');
    c.restore();
  }

  // ------------------------------------------------------------------ Leopold on land. Feet at x,y; walk is a running phase, 0 stands still.
  function kid(c, x, y, s, face, walk) {
    c.save();
    c.translate(x, y);
    c.scale(s * (face < 0 ? -1 : 1), s);
    const swing = Math.sin(walk) * (walk ? 0.55 : 0);
    const bob = walk ? Math.abs(Math.cos(walk)) * 2.2 : 0;
    ell(c, 0, 1, 15, 3.4, 'rgba(0,0,0,0.2)');
    const leg = (a, col) => {
      c.save();
      c.translate(0, -24 - bob);
      c.rotate(a);
      box(c, -3.6, 0, 7.2, 19, col, 3);
      box(c, -4, 17, 11, 6.5, '#a33b2c', 3);
      c.restore();
    };
    leg(-swing, '#2e526f');
    const arm = (a, col) => {
      c.save();
      c.translate(0, -44 - bob);
      c.rotate(a);
      box(c, -3, 0, 6, 17, col, 3);
      ell(c, 0, 18, 3.2, 3.2, '#f1c9a4');
      c.restore();
    };
    arm(swing, '#e0b01e');
    leg(swing, '#34607f');
    box(c, -10, -49 - bob, 20, 27, '#ffd23f', 7);
    box(c, -10, -30 - bob, 20, 4, '#e0b01e');
    box(c, -1, -48 - bob, 2, 25, '#e0b01e');
    arm(-swing, '#ffd23f');
    ell(c, 1, -60 - bob, 12, 12.5, '#f6d4b4');
    ell(c, 11.5, -59 - bob, 2.2, 3, '#f1c9a4');
    c.beginPath();
    c.arc(1, -63 - bob, 12.6, Math.PI, 0);
    c.lineTo(13.6, -61 - bob);
    c.lineTo(-11.6, -61 - bob);
    c.closePath();
    c.fillStyle = '#d6402f';
    c.fill();
    box(c, 3, -64 - bob, 15, 3.6, '#b53325', 2);
    ell(c, 5.5, -58 - bob, 1.7, 2, '#28231d');
    c.beginPath();
    c.arc(4, -53.5 - bob, 3.4, 0.25, Math.PI - 0.5);
    c.strokeStyle = '#a4593e';
    c.lineWidth = 1.2;
    c.stroke();
    c.restore();
  }

  // A plain painted background for info cards: sky, hills, water.
  function cardBack(c, w, h, sky, land) {
    c.fillStyle = grad(c, 0, 0, 0, h, sky || ['#8fd0e6', '#e6f5ef']);
    c.fillRect(0, 0, w, h);
    ridge(c, w, h * 0.68, h * 0.34, 0.012, 40, '#a9c0cf', 0.62, 3);
    c.fillStyle = grad(c, 0, h * 0.6, 0, h, land || ['#5ea8b6', '#2f7f8f']);
    c.fillRect(0, h * 0.62, w, h * 0.38);
  }

  return { TAU, hexToRgb, shade, mix, rngOf, wave, rr, box, poly, ell, line, grad, eye, flagPlain, flag, cloud, tree, reed, flower, bird, ridge, house, sailboat, kid, cardBack };
})();
