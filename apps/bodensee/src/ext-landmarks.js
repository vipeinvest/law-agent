/* Sehenswürdigkeiten und Tiere des Uferwegs. Nullpunkt ist die Mitte am Boden, y nach oben negativ, Blick nach rechts.
 * BE.landmarks.<id>(c, t) passt in etwa 420 x 340, BE.critters.<id>(c, t) in etwa 90 x 70. t ist die Zeit in Sekunden.
 */
(() => {
  'use strict';
  const { TAU, hexToRgb, box, poly, ell, line, grad, shade, rngOf, flagPlain, tree, flower, bird } = BE.art;
  const PI = Math.PI;
  const lerp = (a, b, u) => a + (b - a) * u;

  // ------------------------------------------------------------------ Grundformen
  // Weiche Kuppe durch die Punkte, unten gerade geschlossen.
  function hill(c, pts, fill) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    const e = pts[pts.length - 1];
    c.lineTo(e[0], e[1]);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
  }
  function hoehe(pts, x) {
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const a = pts[i - 1];
        const b = pts[i];
        return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
      }
    }
    return pts[pts.length - 1][1];
  }
  function glanz(c, hw, y0, y1, t, n, seed, a) {
    const r = rngOf((seed || 5) + n);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.6) / n;
      const y = lerp(y0, y1, u);
      const x = (r() * 2 - 1) * hw * (0.45 + 0.55 * u);
      const l = 6 + r() * (10 + 18 * u);
      const d = Math.sin(t * 0.6 + i * 2.1) * 5;
      c.moveTo(x - l + d, y);
      c.lineTo(x + l + d, y);
    }
    c.strokeStyle = `rgba(255,255,255,${a || 0.42})`;
    c.lineWidth = 1.3;
    c.lineCap = 'round';
    c.stroke();
  }
  // Wasser mit geradem Horizont, blendet zu den Seiten weich aus und hat so keine harte Kante.
  function wasser(c, hw, top, t, c0, c1, n) {
    const a = hexToRgb(c0 || '#a9dde6');
    const b = hexToRgb(c1 || '#4a9db5');
    const bands = Math.max(6, Math.min(22, Math.round(-top / 5)));
    const fade = Math.min(0.2, 46 / (2 * hw));
    const h = -top / bands;
    for (let i = 0; i < bands; i++) {
      const u = (i + 0.5) / bands;
      const rgb = `${Math.round(lerp(a[0], b[0], u))},${Math.round(lerp(a[1], b[1], u))},${Math.round(lerp(a[2], b[2], u))}`;
      const g = c.createLinearGradient(-hw, 0, hw, 0);
      g.addColorStop(0, `rgba(${rgb},0)`);
      g.addColorStop(fade, `rgba(${rgb},1)`);
      g.addColorStop(1 - fade, `rgba(${rgb},1)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.fillRect(-hw, top + i * h, hw * 2, h + (i < bands - 1 ? 0.5 : 0));
    }
    glanz(c, hw - 46, top + 2, -1, t, n || Math.max(5, Math.round(-top / 7)));
  }
  // Ferne Berge; Schnee liegt nur auf dem, was über schneeY hinausragt.
  function fern(c, pts, col, schneeY) {
    hill(c, pts, col);
    if (schneeY === undefined) return;
    c.save();
    hill(c, pts);
    c.clip();
    const x0 = pts[0][0];
    const x1 = pts[pts.length - 1][0];
    c.beginPath();
    c.moveTo(x0, schneeY - 200);
    c.lineTo(x1, schneeY - 200);
    let z = 0;
    for (let x = x1; x >= x0; x -= 9) c.lineTo(x, schneeY + (z++ % 2 ? 7 : -3) + Math.sin(x * 0.07) * 4);
    c.closePath();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fill();
    c.restore();
  }
  // Gezeichnete Spiegelung: fn zeichnet mit Fuß bei y=0.
  function mirror(c, y0, k, a, fn) {
    c.save();
    c.beginPath();
    c.rect(-260, y0, 520, -y0);
    c.clip();
    c.globalAlpha = a;
    c.translate(0, y0);
    c.scale(1, -k);
    fn();
    c.restore();
  }
  // Billige Spiegelung als zitternde Streifen.
  function spiegel(c, x, y0, w, h, col, a, t) {
    const n = Math.max(3, Math.round(h / 5));
    c.save();
    c.globalAlpha = a;
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const off = Math.sin((t || 0) * 0.9 + i * 1.4) * (1 + u * 3);
      const ww = w * (1 - u * 0.25);
      c.fillRect(x - ww / 2 + off, y0 + u * h, ww, (h / n) * 0.72);
    }
    c.restore();
  }
  function fenster(c, x, y, w, h, rahmen, glas) {
    const f = rahmen || '#f8f2e4';
    box(c, x - 1, y - 1, w + 2, h + 2, f);
    box(c, x, y, w, h, glas || '#5d8697');
    box(c, x, y, w, h * 0.42, 'rgba(255,255,255,0.2)');
    box(c, x + w / 2 - 0.5, y, 1, h, f);
  }
  // Rundbogen, Fuß bei cx,by.
  function bogen(c, cx, by, w, h, col) {
    const r = w / 2;
    c.beginPath();
    c.moveTo(cx - r, by);
    c.lineTo(cx - r, by - h + r);
    c.arc(cx, by - h + r, r, PI, 0);
    c.lineTo(cx + r, by);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
  // Spitzbogen, Fuß bei cx,by.
  function spitz(c, cx, by, w, h, col) {
    const r = w / 2;
    const k = by - h * 0.55;
    c.beginPath();
    c.moveTo(cx - r, by);
    c.lineTo(cx - r, k);
    c.quadraticCurveTo(cx - r, by - h * 0.85, cx, by - h);
    c.quadraticCurveTo(cx + r, by - h * 0.85, cx + r, k);
    c.lineTo(cx + r, by);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
  function zinnen(c, x, y, w, n, zh, col) {
    const b = w / (2 * n - 1);
    for (let i = 0; i < n; i++) box(c, x + i * 2 * b, y - zh, b, zh + 0.5, col);
  }
  function quader(c, x, y, w, h, seed, n, col) {
    const r = rngOf(seed);
    c.fillStyle = col || 'rgba(60,40,20,0.1)';
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const sw = 6 + r() * 12;
      const sh = 3 + r() * 4;
      c.rect(x + r() * Math.max(1, w - sw), y + r() * Math.max(1, h - sh), sw, sh);
    }
    c.fill();
  }
  // Satteldach oder Walmdach von der Traufseite.
  function dach(c, x0, x1, ye, yr, inset, col, over) {
    const o = over === undefined ? 5 : over;
    const pts = [[x0 - o, ye], [x0 + inset, yr], [x1 - inset, yr], [x1 + o, ye]];
    poly(c, pts, grad(c, 0, yr, 0, ye, [shade(col, 0.1), shade(col, -0.07)]));
    c.save();
    poly(c, pts);
    c.clip();
    c.strokeStyle = 'rgba(50,20,8,0.13)';
    c.lineWidth = 1;
    c.beginPath();
    for (let y = ye - 6; y > yr; y -= 6) {
      c.moveTo(x0 - o, y);
      c.lineTo(x1 + o, y);
    }
    c.stroke();
    c.restore();
  }
  function gaube(c, x, y, w, h, wand, roof) {
    box(c, x - w / 2, y - h, w, h, wand || '#efe6d2');
    box(c, x - w / 2 + 1.4, y - h + 1.4, w - 2.8, h - 2.8, '#4f6f7f');
    poly(c, [[x - w / 2 - 1.5, y - h], [x + w / 2 + 1.5, y - h], [x, y - h - w * 0.6]], roof || '#8a4a2f');
  }
  // Rundung für Türme: legt Schatten und Licht über ein Rechteck.
  function rund(c, x, y, w, h) {
    c.fillStyle = grad(c, x, 0, x + w, 0, [[0, 'rgba(40,25,10,0.2)'], [0.32, 'rgba(255,255,255,0.14)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(40,25,10,0.32)']]);
    c.fillRect(x, y, w, h);
  }
  function kegel(c, cx, y, r, h, col) {
    poly(c, [[cx - r, y], [cx + r, y], [cx, y - h]], grad(c, cx - r, 0, cx + r, 0, [shade(col, 0.12), col, shade(col, -0.22)]));
  }
  function busch(c, x, y, s, col, seed) {
    const r = rngOf(seed || 9);
    const b = col || '#4f9150';
    ell(c, x, y - s * 0.45, s, s * 0.55, shade(b, -0.14));
    for (let i = 0; i < 5; i++) {
      ell(c, x + (r() - 0.5) * s * 1.5, y - s * (0.32 + r() * 0.5), s * (0.3 + r() * 0.25), s * (0.25 + r() * 0.2), i % 2 ? b : shade(b, 0.14));
    }
  }
  // Schilf mit federiger Rispe (kein Rohrkolben).
  function schilf(c, x, y, h, t, seed, n) {
    const r = rngOf((seed || 3) * 17);
    const k = n || 7;
    for (let i = 0; i < k; i++) {
      const dx = (r() - 0.5) * h * 0.42;
      const hh = h * (0.72 + r() * 0.34);
      const lean = (r() - 0.45) * h * 0.1;
      const b = Math.sin((t || 0) * 0.8 + i * 1.3 + (seed || 3)) * h * 0.028 + lean;
      const tx = x + dx + b;
      const ty = y - hh;
      c.beginPath();
      c.moveTo(x + dx, y);
      c.quadraticCurveTo(x + dx, y - hh * 0.6, tx, ty);
      c.strokeStyle = i % 2 ? '#a8ad62' : '#8f9c52';
      c.lineWidth = Math.max(1, h * 0.016);
      c.lineCap = 'round';
      c.stroke();
      const s = i % 2 ? 1 : -1;
      c.beginPath();
      c.moveTo(x + dx + b * 0.5, y - hh * 0.52);
      c.quadraticCurveTo(x + dx + b * 0.5 + s * h * 0.09, y - hh * 0.66, x + dx + b * 0.5 + s * h * 0.2, y - hh * 0.56);
      c.quadraticCurveTo(x + dx + b * 0.5 + s * h * 0.09, y - hh * 0.6, x + dx + b * 0.5, y - hh * 0.48);
      c.fillStyle = '#93a358';
      c.fill();
      // Rispe: lockerer, überhängender Federbusch
      const ax = tx + h * 0.05;
      const ay = ty - h * 0.03;
      c.strokeStyle = i % 3 ? 'rgba(128,92,74,0.9)' : 'rgba(158,122,96,0.9)';
      c.lineWidth = Math.max(0.6, h * 0.011);
      c.beginPath();
      c.moveTo(tx, ty + h * 0.05);
      c.quadraticCurveTo(tx + h * 0.005, ty - h * 0.05, ax, ay);
      for (let q = 0; q < 6; q++) {
        const u = q / 6;
        const qx = lerp(tx, ax, u);
        const qy = lerp(ty + h * 0.04, ay, u);
        const l = h * (0.1 - u * 0.05);
        c.moveTo(qx, qy);
        c.quadraticCurveTo(qx + l * 0.7, qy - l * 0.2, qx + l, qy + l * 0.42);
        c.moveTo(qx, qy);
        c.quadraticCurveTo(qx - l * 0.25, qy - l * 0.1, qx - l * 0.4, qy + l * 0.52);
      }
      c.stroke();
    }
  }
  // Kleine Spielzeugfigur, 35 hoch bei s=1, Fuß bei x,y.
  function figur(c, x, y, s, kleid, hose, muetze) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    box(c, -3.6, -12, 3.2, 12, hose || '#44566b', 1.4);
    box(c, 0.4, -12, 3.2, 12, hose || '#44566b', 1.4);
    box(c, -5, -26, 10, 16, kleid, 4);
    ell(c, 0, -30.5, 4.6, 4.8, '#f4cfa9');
    if (muetze) {
      c.beginPath();
      c.arc(0, -31.5, 4.9, PI, 0);
      c.closePath();
      c.fillStyle = muetze;
      c.fill();
    }
    c.restore();
  }
  // Falter von oben, Kopf nach rechts; schlägt ruhig mit den Flügeln.
  function falter(c, x, y, s, t, a, b) {
    const f = 0.35 + 0.65 * Math.abs(Math.cos(t * 2.6));
    c.save();
    c.translate(x, y);
    c.rotate(-0.3 + Math.sin(t * 1.3) * 0.08);
    for (const side of [-1, 1]) {
      c.save();
      c.scale(1, side * f);
      ell(c, 2.5 * s, -6.5 * s, 5.4 * s, 7.4 * s, a, 0.3);
      ell(c, -3.6 * s, -4.8 * s, 4.2 * s, 5.2 * s, b || a, -0.3);
      ell(c, 3.2 * s, -8 * s, 1.5 * s, 1.5 * s, 'rgba(255,255,255,0.7)');
      c.restore();
    }
    ell(c, 0, 0, 6.2 * s, 1.2 * s, '#3a2a1c');
    c.restore();
  }
  // Fahne mit einmal gemalter Vorlage. BE.art.flag legt bei jedem Aufruf eine neue Zeichenfläche an, darum hier gecacht.
  const flagCanvas = {};
  function fahne(c, x, y, h, land, t, w) {
    if (!flagCanvas[land]) {
      const o = document.createElement('canvas');
      o.width = 80;
      o.height = 52;
      flagPlain(o.getContext('2d'), 0, 0, 80, 52, land);
      flagCanvas[land] = o;
    }
    const img = flagCanvas[land];
    box(c, x - 1.2, y - h, 2.4, h, '#8d8a80');
    ell(c, x, y - h, 2.2, 2.2, '#d9b64a');
    const fw = w || h * 0.5;
    const fh = fw * 0.65;
    const col = 8;
    for (let i = 0; i < col; i++) {
      const u = i / col;
      const dy = Math.sin(u * 5 - (t || 0) * 2.2) * fh * 0.08 * u;
      c.drawImage(img, u * 80, 0, 80 / col + 0.5, 52, x + 1 + u * fw, y - h + 2 + dy, fw / col + 0.7, fh);
    }
  }
  function stern(c, x, y, r, col) {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = -PI / 2 + (i * PI) / 5;
      const q = i % 2 ? r * 0.45 : r;
      p.push([x + Math.cos(a) * q, y + Math.sin(a) * q]);
    }
    poly(c, p, col);
  }
  function wolke(c, x, y, s, a) {
    c.fillStyle = `rgba(255,255,255,${a || 0.8})`;
    c.beginPath();
    for (const [dx, dy, q] of [[-30, 4, 14], [-10, -4, 20], [14, -2, 17], [32, 5, 11], [0, 6, 18]]) {
      c.moveTo(x + (dx + q) * s, y + dy * s);
      c.arc(x + dx * s, y + dy * s, q * s, 0, TAU);
    }
    c.fill();
  }

  // ------------------------------------------------------------------ Sehenswürdigkeiten
  const L = {};

  L.seebuehne = (c, t) => {
    fern(c, [[-186, -126], [-150, -170], [-85, -150], [5, -198], [100, -160], [186, -126]], '#c3d6dc', -178);
    wasser(c, 211, -130, t);
    const set = () => {
      // Riesiges, offenes Märchenbuch als Kulisse
      poly(c, [[-132, -4], [0, 2], [132, -4], [132, -214], [0, -192], [-132, -214]], grad(c, 0, -214, 0, 0, ['#5a4aa8', '#2f2b70']));
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(0, -4);
        c.quadraticCurveTo(s * 60, -18, s * 122, -12);
        c.lineTo(s * 122, -204);
        c.quadraticCurveTo(s * 60, -214, 0, -186);
        c.closePath();
        c.fillStyle = grad(c, 0, 0, s * 122, 0, [[0, '#cfb98f'], [0.18, '#fbf1d8'], [1, '#f3e4bf']]);
        c.fill();
      }
      // Mond und Sterne aus Goldpapier
      c.beginPath();
      c.arc(84, -150, 30, 0.7, 5.6);
      c.quadraticCurveTo(64, -150, 84 + 30 * Math.cos(0.7), -150 + 30 * Math.sin(0.7));
      c.closePath();
      c.fillStyle = grad(c, 60, -180, 100, -120, ['#ffe27a', '#e8a92e']);
      c.fill();
      stern(c, -84, -168, 13, '#f0b93a');
      stern(c, -48, -142, 8, '#e58a3c');
      stern(c, -104, -122, 7, '#f0b93a');
      stern(c, 44, -176, 7, '#e58a3c');
      // Märchenschloss, das aus dem Buch wächst
      const tuerme = [[-58, 26, 92, '#e9a0a8', '#7d4bb0'], [58, 26, 104, '#8fd0c8', '#c0486a']];
      for (const [x, w, h, col, roof] of tuerme) {
        box(c, x - w / 2, -h - 6, w, h, col);
        rund(c, x - w / 2, -h - 6, w, h);
        kegel(c, x, -h - 6, w * 0.66, 40, roof);
        bogen(c, x, -h + 28, 9, 16, '#ffd96a');
      }
      box(c, -46, -66, 92, 60, '#f4c9a0');
      zinnen(c, -46, -66, 92, 7, 8, '#f4c9a0');
      box(c, -16, -130, 32, 66, '#f7dda0');
      rund(c, -16, -130, 32, 66);
      kegel(c, 0, -130, 23, 48, '#3f7fc4');
      ell(c, 0, -180, 3, 3, '#ffe27a');
      bogen(c, -5, -96, 8, 16, '#ffd96a');
      bogen(c, 8, -96, 8, 16, '#ffd96a');
      bogen(c, -30, -36, 9, 14, '#ffd96a');
      bogen(c, 30, -36, 9, 14, '#ffd96a');
      bogen(c, 0, -6, 24, 34, '#6d3f7a');
      // Große Papierwellen
      for (const [y, col, ph] of [[-22, '#74c2d6', 0], [-12, '#3f97b8', 1.8]]) {
        c.beginPath();
        c.moveTo(-128, 0);
        for (let x = -128; x <= 128; x += 16) c.lineTo(x, y + Math.sin(x * 0.05 + ph + t * 0.5) * 4);
        c.lineTo(128, 0);
        c.closePath();
        c.fillStyle = col;
        c.fill();
      }
      box(c, -148, -3, 296, 8, '#6d543c', 2);
      box(c, -148, -3, 296, 2, '#e3b552');
    };
    mirror(c, -84, 0.62, 0.32, set);
    box(c, -130, -80, 6, 18, '#40352c');
    box(c, -60, -80, 6, 20, '#40352c');
    box(c, 54, -80, 6, 20, '#40352c');
    box(c, 124, -80, 6, 18, '#40352c');
    c.save();
    c.translate(0, -84);
    set();
    c.fillStyle = '#ffe9a0';
    for (let i = 0; i < 15; i++) {
      c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 1.4 + i * 1.7);
      c.beginPath();
      c.arc(-140 + i * 20, 2.5, 1.9, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    c.restore();
    // Scheinwerfer von den Masten
    const a = 0.13 + 0.05 * Math.sin(t * 0.7);
    for (const s of [-1, 1]) {
      c.fillStyle = grad(c, s * 190, -146, s * 40, -110, [`rgba(255,240,180,${a})`, 'rgba(255,240,180,0)']);
      poly(c, [[s * 188, -148], [s * 16, -236], [s * 6, -92]]);
      c.fill();
    }
    // Zuschauerränge im Halbrund
    for (const s of [-1, 1]) {
      line(c, [[s * 188, -34], [s * 188, -148]], '#56616c', 3.4);
      box(c, s * 188 - 6, -152, 12, 7, '#2f3942', 2);
      ell(c, s * 188 - s * 7, -148.5, 2.6, 2.6, '#ffefb0');
    }
    for (let i = 0; i < 5; i++) {
      const rx = 208 - i * 15;
      const ry = 36 - i * 5.8;
      c.beginPath();
      c.ellipse(0, -36, rx, ry, 0, 0, PI);
      c.ellipse(0, -36, rx - 15, ry - 5.8, 0, PI, 0, true);
      c.closePath();
      c.fillStyle = i % 2 ? '#51647a' : '#5f748b';
      c.fill();
      c.save();
      c.beginPath();
      c.ellipse(0, -36, rx - 7.5, ry - 2.9, 0, 0, PI);
      c.setLineDash([0.1, 7.5]);
      c.lineDashOffset = i * 3;
      c.lineCap = 'round';
      c.lineWidth = 3.4;
      c.strokeStyle = ['#e7c35a', '#e06e55', '#f2eee2', '#6fb7c7', '#e7a25a'][i];
      c.stroke();
      c.restore();
    }
  };

  const PF_H = [[-212, 0], [-172, -24], [-60, -122], [30, -224], [92, -292], [150, -284], [196, -150], [214, -30], [214, 0]];
  const PF_T = (() => {
    const r = rngOf(21);
    const a = [];
    for (let i = 0; i < 32; i++) {
      const x = -186 + r() * 386;
      const top = hoehe(PF_H, x);
      const y = top + 16 + r() * (-top - 16) * 0.92;
      a.push([x, y, 30 + (1 + y / 300) * 40, i]);
    }
    return a.sort((p, q) => p[1] - q[1]);
  })();
  L.pfaender = (c, t) => {
    hill(c, [[-212, 0], [-130, -70], [-20, -190], [60, -250], [150, -224], [212, -60], [214, 0]], '#b7cdbf');
    hill(c, PF_H, grad(c, 0, -298, 0, 0, ['#6ea667', '#4c8a55']));
    for (const [x, y, h, i] of PF_T) {
      if (i % 6 === 0) tree(c, x, y, h * 0.95, 'laub', t, i + 3);
      else tree(c, x, y, h, 'tanne', t, i + 3);
    }
    // Bergstation
    box(c, 74, -298, 62, 40, '#ece4d2');
    box(c, 70, -301, 70, 4, '#a2988a');
    for (let i = 0; i < 4; i++) box(c, 80 + i * 13, -292, 9, 20, '#5d8697');
    fahne(c, 144, -262, 42, 'at', t, 18);
    // Talstation
    box(c, -200, -46, 52, 30, '#f0e8d8');
    box(c, -204, -49, 60, 4, '#a2988a');
    box(c, -194, -40, 34, 15, '#5d8697');
    box(c, -194, -40, 34, 6, 'rgba(255,255,255,0.2)');
    // Tragseile und zwei Kabinen, die sich in der Mitte begegnen
    const A = [-152, -46];
    const B = [76, -286];
    const seil = (d) => line(c, [[A[0], A[1] + d], [B[0], B[1] + d]], '#4b4f52', 1.5);
    seil(0);
    seil(7);
    const u = 0.5 + 0.42 * Math.sin(t * 0.07);
    const kabine = (q, d, b) => {
      const x = lerp(A[0], B[0], q);
      const y = lerp(A[1], B[1], q) + d;
      ell(c, x - 3.5, y + 0.8, 2.6, 2.6, '#676c70');
      ell(c, x + 3.5, y - 3, 2.6, 2.6, '#676c70');
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 7, y + 8, x, y + 15);
      c.strokeStyle = '#b6bcc0';
      c.lineWidth = 3;
      c.stroke();
      box(c, x - 18, y + 14, 36, 24, '#f6f8f8', 5);
      box(c, x - 18, y + 31, 36, 7, b, 3);
      box(c, x - 15, y + 17, 30, 12, '#3f6175', 2);
      box(c, x - 15, y + 17, 30, 4.5, 'rgba(255,255,255,0.25)');
      box(c, x - 5.5, y + 17, 1.2, 12, '#f6f8f8');
      box(c, x + 4.5, y + 17, 1.2, 12, '#f6f8f8');
    };
    kabine(1 - u, 7, '#2b7fc0');
    kabine(u, 0, '#2b7fc0');
  };

  function saeule(c, x, y, h, w) {
    box(c, x - w * 0.8, y - 6, w * 1.6, 6, '#d8ccb0', 1);
    ell(c, x, y - 7, w * 0.66, 3, '#e6dcc4');
    c.fillStyle = grad(c, x - w / 2, 0, x + w / 2, 0, ['#d3c6a8', '#f4ecd9', '#b9ab8c']);
    c.beginPath();
    c.moveTo(x - w / 2, y - 7);
    c.lineTo(x - w / 2 + 0.6, y - h + 5);
    c.lineTo(x - w * 0.18, y - h - 3);
    c.lineTo(x + w * 0.08, y - h + 2);
    c.lineTo(x + w * 0.34, y - h - 6);
    c.lineTo(x + w / 2 - 0.6, y - h + 4);
    c.lineTo(x + w / 2, y - 7);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(100,84,56,0.22)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 1; i < 5; i++) {
      const fx = x - w / 2 + (w * i) / 5;
      c.moveTo(fx, y - 9);
      c.lineTo(fx, y - h + 7);
    }
    c.stroke();
  }
  L.brigantium = (c, t) => {
    hill(c, [[-212, 0], [-178, -26], [-70, -48], [80, -52], [176, -30], [212, 0]], grad(c, 0, -52, 0, 0, ['#a7bd70', '#7f9d52']));
    hill(c, [[-186, 0], [-146, -22], [-46, -36], [92, -38], [156, -20], [190, 0]], grad(c, 0, -38, 0, 0, ['#e0cda3', '#c9b185']));
    // Niedrige Mauer mit Ziegelbändern
    const w = [[-168, -24], [-168, -74], [-140, -86], [-112, -78], [-84, -94], [-46, -86], [-14, -98], [20, -84], [46, -68], [76, -60], [84, -24]];
    poly(c, w, grad(c, 0, -98, 0, -24, ['#d8c6a2', '#bda986']));
    c.save();
    poly(c, w);
    c.clip();
    quader(c, -170, -98, 256, 74, 12, 60, 'rgba(90,66,36,0.14)');
    quader(c, -170, -98, 256, 74, 31, 26, 'rgba(255,245,220,0.3)');
    box(c, -170, -62, 256, 4, '#b5664a');
    box(c, -170, -56, 256, 2, '#c98064');
    box(c, -170, -38, 256, 4, '#b5664a');
    c.restore();
    busch(c, -152, -78, 9, '#7ea65c', 4);
    busch(c, 62, -60, 7, '#7ea65c', 7);
    // Säulenstümpfe
    saeule(c, 118, -16, 118, 24);
    saeule(c, -120, -16, 54, 24);
    saeule(c, -62, -14, 82, 24);
    saeule(c, 36, -14, 40, 24);
    saeule(c, 170, -10, 44, 22);
    // Liegende Trommel
    ell(c, -176, -12, 7, 12, '#b9ab8c');
    box(c, -176, -24, 28, 24, '#e4d9c0');
    ell(c, -148, -12, 7, 12, '#f1e8d3');
    // Stück Mosaik am Boden
    const q = (u, v) => [lerp(lerp(-84, 84, u), lerp(-62, 62, u), v), lerp(-3, -30, v)];
    poly(c, [q(-0.02, -0.04), q(1.02, -0.04), q(1.02, 1.04), q(-0.02, 1.04)], '#a89470');
    const N = 14;
    const M = 6;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        if (i > 11 - (j > 3 ? 4 : 0) && j > 2) continue;
        const border = i === 0 || j === 0 || i === N - 1 || j === M - 1;
        const d = Math.abs(i - 6.5) / 1.6 + Math.abs(j - 2.5);
        let col = (i + j) % 2 ? '#f3e9d2' : '#e9dcbc';
        if (d < 1.2) col = '#c4553b';
        else if (d < 2.2) col = '#e0ab3f';
        else if (d < 2.9) col = '#31506b';
        if (border) col = '#31506b';
        poly(c, [q(i / N + 0.004, j / M + 0.01), q((i + 1) / N - 0.004, j / M + 0.01), q((i + 1) / N - 0.004, (j + 1) / M - 0.01), q(i / N + 0.004, (j + 1) / M - 0.01)], col);
      }
    }
    flower(c, -190, -2, 12, '#e8c23a', t, 3);
    flower(c, 192, -2, 13, '#d45a7a', t, 5);
  };

  L.rheinmuendung = (c, t) => {
    fern(c, [[-186, -150], [-150, -212], [-92, -180], [-30, -246], [44, -196], [112, -232], [186, -150]], '#b9c9d8', -206);
    wasser(c, 211, -152, t, '#bfe6ec', '#6fb9c8', 8);
    // Trübes Flusswasser fächert in den See
    ell(c, 16, -136, 74, 11, 'rgba(176,186,140,0.55)');
    const rand = (y, s) => {
      const u = -y / 130;
      return s < 0 ? lerp(-126, -8, u) : lerp(116, 32, u);
    };
    poly(c, [[rand(0, -1), 0], [rand(0, 1), 0], [rand(-130, 1), -130], [rand(-130, -1), -130]], grad(c, 0, -130, 0, 0, ['#a7c5a4', '#6fa79a']));
    // Sandbänke an der Mündung
    ell(c, 60, -128, 38, 4.5, '#e8d9ae');
    ell(c, -30, -134, 26, 3.2, '#e8d9ae');
    ell(c, 44, -84, 24, 6, '#e2d2a4');
    ell(c, 44, -85.5, 18, 3.4, '#efe3bf');
    ell(c, -36, -48, 30, 7, '#e2d2a4');
    ell(c, -36, -50, 22, 4, '#efe3bf');
    // Strömung läuft zum See
    c.beginPath();
    for (let k = 0; k < 16; k++) {
      const u = (t * 0.045 + k * 0.137) % 1;
      const y = -6 - u * 118;
      const lx = rand(y, -1);
      const rx = rand(y, 1);
      const x = lerp(lx, rx, 0.08 + ((k * 0.381) % 0.84));
      const l = 12 * (1 - u) + 2;
      c.moveTo(x - l * 0.3, y + l);
      c.quadraticCurveTo(x, y + l * 0.2, x + l * 0.3, y + l);
    }
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 1.2;
    c.lineCap = 'round';
    c.stroke();
    // Linkes Ufer: Damm mit Weg
    poly(c, [[-212, 0], [-126, 0], [-8, -130], [-42, -136], [-150, -112], [-206, -60]], grad(c, 0, -136, 0, 0, ['#a8c67a', '#7ea65a']));
    poly(c, [[-126, 0], [-100, 0], [-6, -130], [-8, -130]], '#6f9650');
    poly(c, [[-176, 0], [-136, 0], [-15, -130], [-22, -131]], grad(c, 0, -131, 0, 0, ['#efe2c0', '#dcc898']));
    figur(c, -56, -66, 0.5, '#d6402f', '#33506e');
    figur(c, -96, -28, 0.8, '#3f8fb0', '#444', '#ffd23f');
    // Rechtes Ufer mit Schilf
    poly(c, [[212, 0], [116, 0], [32, -130], [70, -136], [150, -116], [206, -60]], grad(c, 0, -136, 0, 0, ['#b7cd86', '#8fb063']));
    ell(c, 130, -14, 44, 8, '#e2d2a4');
    schilf(c, 72, -112, 26, t, 2, 5);
    schilf(c, 108, -86, 36, t, 3, 6);
    schilf(c, 150, -58, 52, t, 4, 7);
    schilf(c, 182, -24, 76, t, 5, 8);
    schilf(c, 128, -28, 62, t, 6, 7);
    schilf(c, -186, -6, 72, t, 7, 7);
    bird(c, 20 + Math.sin(t * 0.2) * 26, -176, 7, t * 0.4);
    bird(c, 60 + Math.sin(t * 0.2 + 1) * 22, -188, 5, t * 0.45);
  };

  L.biberburg = (c, t) => {
    hill(c, [[56, 0], [100, -26], [170, -38], [212, 0]], grad(c, 0, -38, 0, 0, ['#9dbb68', '#7a9a4e']));
    tree(c, 158, -30, 140, 'laub', t, 4);
    wasser(c, 211, -46, t, '#a3d8de', '#4f9fae');
    // Burg: Lehmkuppe mit Ästen kreuz und quer
    const cx = -40;
    const rx = 118;
    const ry = 104;
    c.beginPath();
    c.moveTo(cx - rx, -18);
    c.bezierCurveTo(cx - rx * 0.86, -ry * 0.8, cx - rx * 0.4, -ry, cx, -ry);
    c.bezierCurveTo(cx + rx * 0.4, -ry, cx + rx * 0.86, -ry * 0.8, cx + rx, -18);
    c.closePath();
    c.fillStyle = grad(c, 0, -ry, 0, -18, ['#8a6a48', '#5e4630']);
    c.fill();
    const r = rngOf(77);
    const cols = ['#7a5a3a', '#a07c52', '#5a412a', '#b8946a'];
    c.save();
    c.beginPath();
    c.rect(-210, -130, 340, 118);
    c.clip();
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      for (let i = 0; i < 26; i++) {
        const a = r() * PI;
        const q = Math.sqrt(r()) * 0.96;
        const x = cx + Math.cos(a) * q * rx;
        const y = -18 - Math.sin(a) * q * (ry - 12);
        const dir = r() * PI - PI / 2 + (x - cx) * 0.006;
        const l = 14 + r() * 26;
        c.moveTo(x - Math.cos(dir) * l, y - Math.sin(dir) * l);
        c.lineTo(x + Math.cos(dir) * l, y + Math.sin(dir) * l);
      }
      c.strokeStyle = cols[k];
      c.lineWidth = 3.4 - k * 0.5;
      c.lineCap = 'round';
      c.stroke();
    }
    c.restore();
    // Abstehende Astspitzen
    for (const [x, y, dx, dy] of [[-100, -86, -14, -16], [-60, -102, -4, -18], [-20, -104, 8, -20], [24, -88, 14, -14], [60, -60, 18, -8], [-140, -50, -16, -6]]) {
      line(c, [[x, y], [x + dx, y + dy]], '#7a5a3a', 3);
    }
    // Eingang knapp überm Wasser
    bogen(c, -18, -14, 34, 22, '#2c2118');
    c.fillStyle = 'rgba(79,159,174,0.72)';
    c.fillRect(-160, -20, 240, 7);
    c.fillStyle = grad(c, 0, -22, 0, -6, ['rgba(120,190,200,0.75)', 'rgba(120,190,200,0)']);
    c.fillRect(-170, -22, 260, 16);
    // Abgenagter Baumstumpf
    const sx = 122;
    const sy = -22;
    poly(c, [[sx - 21, sy], [sx - 15, sy - 34], [sx + 15, sy - 34], [sx + 21, sy]], grad(c, sx - 21, 0, sx + 21, 0, ['#6a4c30', '#8b6a44', '#57402a']));
    poly(c, [[sx - 15, sy - 34], [sx + 15, sy - 34], [sx + 3, sy - 66], [sx - 2, sy - 66]], grad(c, sx - 15, 0, sx + 15, 0, ['#e3c48e', '#f6e0b0', '#d0ad76']));
    c.strokeStyle = 'rgba(130,90,45,0.5)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      c.moveTo(sx - 12 + i * 2.2, sy - 35);
      c.lineTo(sx - 4 + i * 1.3, sy - 58);
      c.moveTo(sx + 12 - i * 2.2, sy - 35);
      c.lineTo(sx + 4 - i * 1.3, sy - 58);
    }
    c.stroke();
    c.fillStyle = '#ecd19c';
    c.beginPath();
    const s2 = rngOf(5);
    for (let i = 0; i < 12; i++) c.rect(sx - 44 + s2() * 92, sy - 2 + s2() * 8, 3 + s2() * 4, 1.8);
    c.fill();
    // Schwimmender Biberkopf zieht ein V ins Wasser
    const bx = -170 + Math.sin(t * 0.12) * 16;
    const by = -6;
    const dirB = Math.cos(t * 0.12) >= 0 ? 1 : -1;
    line(c, [[bx - dirB * 8, by + 1], [bx - dirB * 30, by + 6]], 'rgba(255,255,255,0.5)', 1.3);
    line(c, [[bx - dirB * 8, by - 1], [bx - dirB * 30, by - 5]], 'rgba(255,255,255,0.5)', 1.3);
    ell(c, bx, by - 2, 10, 6.5, '#7a5230');
    ell(c, bx + dirB * 8, by - 2, 4.2, 3.6, '#8d6238');
    ell(c, bx - dirB * 4, by - 8, 1.9, 1.9, '#5a3c22');
    ell(c, bx + dirB * 3, by - 4, 1.4, 1.4, '#1b1a18');
    schilf(c, 188, -8, 60, t, 8, 6);
    schilf(c, -190, -8, 76, t, 9, 6);
  };

  // Bayerischer Löwe, sitzend, Blick zum See nach rechts. Fuß bei 0,0.
  function loewe(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    const a = '#b8ab92';
    const b = '#cfc3ab';
    const d = '#94866d';
    // Schwanz
    c.beginPath();
    c.moveTo(-30, -12);
    c.quadraticCurveTo(-52, -6, -46, -26);
    c.strokeStyle = d;
    c.lineWidth = 4.5;
    c.lineCap = 'round';
    c.stroke();
    ell(c, -45, -29, 4.2, 5.4, d);
    // Körper
    c.beginPath();
    c.moveTo(-34, -2);
    c.bezierCurveTo(-42, -30, -22, -54, 0, -74);
    c.lineTo(22, -64);
    c.bezierCurveTo(28, -44, 26, -22, 24, -2);
    c.closePath();
    c.fillStyle = grad(c, -34, 0, 26, 0, [d, a, b]);
    c.fill();
    ell(c, -16, -20, 19, 20, a);
    ell(c, -13, -24, 12, 13, b);
    // Hinterpfote und Vorderbeine
    box(c, -22, -7, 28, 7, d, 3.4);
    box(c, 4, -54, 10, 50, a, 4);
    box(c, 15, -54, 10, 50, b, 4);
    box(c, 2, -7, 15, 7, a, 3);
    box(c, 13, -7, 17, 7, b, 3);
    // Mähne
    const r = rngOf(8);
    for (let i = 0; i < 12; i++) {
      const w = (i / 12) * TAU;
      ell(c, 8 + Math.cos(w) * 17, -74 + Math.sin(w) * 19, 8 + r() * 2, 9 + r() * 2, i % 2 ? d : a);
    }
    ell(c, 8, -74, 18, 20, a);
    // Gesicht
    ell(c, 16, -76, 11, 11, b);
    ell(c, 25, -71, 7.5, 6, b);
    ell(c, 30, -73, 2.4, 2, '#6e6252');
    c.beginPath();
    c.moveTo(24, -67.5);
    c.quadraticCurveTo(27, -65.5, 30, -68);
    c.strokeStyle = '#6e6252';
    c.lineWidth = 1.2;
    c.stroke();
    ell(c, 19, -80, 2.2, 2.4, '#4d4438');
    ell(c, 19.6, -80.8, 0.7, 0.7, '#e8e2d2');
    ell(c, 7, -90, 4, 4.4, d);
    c.restore();
  }
  L.lindau_hafen = (c, t) => {
    fern(c, [[-186, -102], [-150, -146], [-70, -122], [10, -180], [90, -132], [150, -150], [186, -102]], '#c9dae3', -146);
    wasser(c, 211, -104, t);
    // Spiegelungen
    spiegel(c, -112, -48, 74, 44, '#a99d86', 0.3, t);
    spiegel(c, 112, -48, 52, 46, '#efe6d2', 0.42, t);
    // Molen
    for (const [x0, x1] of [[-200, -28], [40, 200]]) {
      box(c, x0, -66, x1 - x0, 20, '#a8a194');
      box(c, x0, -70, x1 - x0, 5, '#c6bfb0');
      quader(c, x0, -64, x1 - x0, 16, x0 + 400, 16, 'rgba(50,50,50,0.12)');
      for (let x = x0 + 6; x < x1; x += 22) box(c, x, -48, 4, 12, '#5d4a34');
    }
    // Sockel und Löwe
    box(c, -152, -108, 80, 38, '#bdb19a');
    box(c, -156, -112, 88, 6, '#d2c7b1');
    box(c, -142, -176, 60, 64, '#c9bda6');
    box(c, -122, -176, 40, 64, 'rgba(255,250,235,0.12)');
    bogen(c, -112, -116, 18, 36, '#8c8069');
    box(c, -148, -184, 72, 9, '#d7ccb6');
    loewe(c, -114, -184, 1.06);
    // Neuer Leuchtturm: heller, gebänderter Turm mit bunter Krone und Uhr
    const X = 118;
    box(c, X - 38, -100, 76, 30, '#8e8a80');
    zinnen(c, X - 38, -100, 76, 7, 6, '#a8a498');
    c.fillStyle = grad(c, X - 25, 0, X + 25, 0, ['#ddd2bb', '#f5eedd', '#d9cdb5']);
    c.beginPath();
    c.moveTo(X - 27, -100);
    c.lineTo(X - 22, -284);
    c.lineTo(X + 22, -284);
    c.lineTo(X + 27, -100);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(120,110,90,0.28)';
    for (let i = 0; i < 16; i++) {
      const y = -112 - i * 11;
      const q = 27 - ((i * 11 + 12) / 184) * 5;
      c.fillRect(X - q, y, q * 2, 3);
    }
    rund(c, X - 26, -284, 52, 184);
    // Uhr
    ell(c, X, -196, 15, 15, '#6d6456');
    ell(c, X, -196, 13, 13, '#fbf7ea');
    const ang = t * 0.05;
    line(c, [[X, -196], [X + Math.sin(ang) * 9.5, -196 - Math.cos(ang) * 9.5]], '#2a2622', 1.6);
    line(c, [[X, -196], [X + Math.sin(ang / 12 + 1) * 6, -196 - Math.cos(ang / 12 + 1) * 6]], '#2a2622', 2.2);
    fenster(c, X - 4, -248, 8, 14, '#d8cdb6');
    fenster(c, X - 4, -150, 8, 14, '#d8cdb6');
    bogen(c, X, -100, 18, 30, '#6d5e4a');
    // Krone mit bunten Zinnen
    box(c, X - 28, -300, 56, 16, '#7a4a3c');
    for (let i = 0; i < 8; i++) box(c, X - 28 + i * 7, -298, 7, 6, ['#d9c25a', '#2f6f6a', '#c5503c', '#f2ebd8'][i % 4]);
    box(c, X - 30, -304, 60, 4, '#5c4438');
    zinnen(c, X - 30, -304, 60, 6, 6, '#7a4a3c');
    // Laterne
    box(c, X - 10, -326, 20, 22, '#2f4f4c');
    const lampe = 0.65 + 0.35 * Math.sin(t * 1.1);
    box(c, X - 7, -324, 14, 15, `rgba(255,226,120,${lampe})`);
    box(c, X - 0.8, -324, 1.6, 15, '#2f4f4c');
    kegel(c, X, -326, 13, 11, '#3f8a7d');
    line(c, [[X, -336], [X, -340]], '#2f4f4c', 1.6);
    // Segelboot fährt durch die Hafeneinfahrt
    const sb = Math.sin(t * 0.13) * 8;
    c.save();
    c.translate(sb, -26 + Math.sin(t * 0.9) * 0.8);
    c.rotate(Math.sin(t * 1.1) * 0.02);
    poly(c, [[-22, 0], [22, 0], [14, 8], [-16, 8]], '#f7f3e8');
    box(c, -1, -56, 2, 56, '#6d5a42');
    poly(c, [[1.5, -54], [24, -5], [1.5, -5]], '#fff');
    poly(c, [[-1.5, -46], [-17, -5], [-1.5, -5]], '#ffd9a0');
    c.restore();
  };

  L.zeppelin = (c, t) => {
    hill(c, [[-212, 0], [-120, -14], [120, -14], [212, 0]], '#a4c070');
    // Halle
    c.beginPath();
    c.moveTo(-196, -6);
    c.lineTo(-196, -110);
    c.quadraticCurveTo(0, -178, 196, -110);
    c.lineTo(196, -6);
    c.closePath();
    c.fillStyle = grad(c, 0, -160, 0, -6, ['#c9d2d6', '#99a7ad']);
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(60,75,85,0.22)';
    c.lineWidth = 1.4;
    c.beginPath();
    for (let x = -186; x < 196; x += 18) {
      c.moveTo(x, -170);
      c.lineTo(x, -6);
    }
    c.stroke();
    // Offenes Tor
    bogen(c, 0, -6, 250, 116, '#2d3b48');
    c.fillStyle = grad(c, 0, -122, 0, -6, ['rgba(120,150,170,0.45)', 'rgba(40,50,60,0)']);
    c.fillRect(-125, -122, 250, 116);
    box(c, -146, -112, 21, 106, '#7f8e96');
    box(c, 125, -112, 21, 106, '#7f8e96');
    // Dachbinder im Dunkel
    c.strokeStyle = 'rgba(150,175,195,0.3)';
    c.lineWidth = 2;
    c.beginPath();
    for (const k of [0.56, 0.72, 0.88]) {
      c.moveTo(-125 * k, 3);
      c.arc(0, 3, 125 * k, PI, 0);
    }
    c.stroke();
    c.restore();
    box(c, -196, -112, 392, 3, 'rgba(255,255,255,0.3)');
    // Schatten aufs Hallendach und Menschen zum Größenvergleich
    figur(c, -166, -4, 1, '#ffd23f', '#44566b', '#d6402f');
    figur(c, 160, -4, 1, '#4c80a8', '#3b3f44');
    figur(c, 176, -4, 0.82, '#d6402f', '#3b3f44');
    // Luftschiff
    const dy = Math.sin(t * 0.5) * 3.5;
    c.save();
    c.translate(0, -238 + dy);
    c.rotate(Math.sin(t * 0.32) * 0.012);
    const body = new Path2D();
    body.moveTo(-190, 0);
    body.bezierCurveTo(-130, -40, 60, -46, 124, -38);
    body.bezierCurveTo(172, -30, 192, -10, 190, 0);
    body.bezierCurveTo(192, 10, 172, 30, 124, 38);
    body.bezierCurveTo(60, 46, -130, 40, -190, 0);
    body.closePath();
    // Leitwerk hinter dem Körper
    poly(c, [[-118, -24], [-178, -46], [-186, -10], [-150, -8]], '#a9b4bc');
    poly(c, [[-118, 24], [-178, 46], [-186, 10], [-150, 8]], '#8b98a2');
    c.fillStyle = grad(c, 0, -46, 0, 46, [[0, '#f7f9fa'], [0.34, '#e3e8ec'], [0.68, '#b8c2ca'], [1, '#808d98']]);
    c.fill(body);
    c.save();
    c.clip(body);
    c.strokeStyle = 'rgba(60,72,84,0.14)';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = -180; x < 190; x += 24) {
      c.moveTo(x, -46);
      c.lineTo(x, 46);
    }
    for (const q of [-30, -16, 0, 16, 30]) {
      c.moveTo(-190, q * 0.9);
      c.quadraticCurveTo(0, q * 1.25, 190, q * 0.9);
    }
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.ellipse(26, -27, 118, 6, 0, 0, TAU);
    c.fill();
    c.restore();
    // Mittelflosse quer
    poly(c, [[-132, -3], [-190, -2], [-190, 2], [-132, 3]], '#7f8d98');
    poly(c, [[-160, -2], [-184, -32], [-188, -6]], '#c5503c');
    // Gondel mit Fenstern
    line(c, [[60, 41], [66, 50]], '#6b757e', 1.5);
    line(c, [[116, 38], [108, 50]], '#6b757e', 1.5);
    box(c, 50, 49, 70, 17, '#eef1f3', 6);
    box(c, 50, 60, 70, 6, '#9aa6b0', 3);
    for (let i = 0; i < 6; i++) box(c, 56 + i * 10.3, 52, 7.2, 6.2, '#3f6175', 1);
    // Motorgondel mit Propeller
    line(c, [[-52, 41], [-52, 48]], '#6b757e', 1.5);
    box(c, -68, 47, 30, 12, '#d7dde1', 5);
    const f = Math.abs(Math.cos(t * 9));
    ell(c, -70, 53, 1.6, 2 + f * 7, 'rgba(70,80,90,0.55)');
    c.restore();
  };

  L.burg_meersburg = (c, t) => {
    // Fels
    const fels = [[-212, 0], [-200, -46], [-160, -96], [-70, -116], [70, -120], [160, -98], [198, -48], [212, 0]];
    hill(c, fels, grad(c, 0, -120, 0, 0, ['#b3a58f', '#85775f']));
    c.save();
    hill(c, fels);
    c.clip();
    poly(c, [[-180, -90], [-120, -116], [-100, -60], [-150, -30]], 'rgba(255,245,225,0.16)');
    poly(c, [[-40, -116], [30, -116], [10, -60], [-30, -70]], 'rgba(255,245,225,0.12)');
    poly(c, [[60, -116], [150, -96], [120, -40], [80, -60]], 'rgba(40,30,20,0.13)');
    poly(c, [[-90, -90], [-50, -80], [-70, -30], [-110, -40]], 'rgba(40,30,20,0.1)');
    c.restore();
    busch(c, -176, -60, 16, '#5f9050', 3);
    busch(c, 178, -66, 18, '#5f9050', 5);
    const stein = '#d9cfbb';
    // Hintere Ecktürmchen
    for (const x of [-28, 28]) {
      box(c, x - 6, -318, 12, 40, shade('#c7bca6', 0.05));
      kegel(c, x, -318, 8.5, 18, '#92573a');
    }
    // Rechter Flügel mit rotem Dach
    box(c, 40, -188, 134, 84, '#e7dcc6');
    dach(c, 40, 174, -188, -222, 26, '#a9552f', 5);
    for (let i = 0; i < 5; i++) {
      fenster(c, 56 + i * 23, -176, 10, 14, '#f8f2e4');
      fenster(c, 56 + i * 23, -146, 10, 14, '#f8f2e4');
    }
    gaube(c, 86, -200, 10, 9, '#efe6d2', '#8a4a2f');
    gaube(c, 124, -200, 10, 9, '#efe6d2', '#8a4a2f');
    // Linker Flügel und Rundturm
    box(c, -150, -180, 104, 76, '#ddd2bb');
    dach(c, -150, -46, -180, -206, 20, '#a9552f', 4);
    for (let i = 0; i < 3; i++) fenster(c, -110 + i * 21, -164, 10, 14, '#f8f2e4');
    const tx = -158;
    box(c, tx - 27, -214, 54, 112, '#e6dcc8');
    rund(c, tx - 27, -214, 54, 112);
    kegel(c, tx, -214, 33, 44, '#b55a31');
    fenster(c, tx - 5, -196, 10, 13, '#f8f2e4');
    fenster(c, tx - 12, -160, 10, 13, '#f8f2e4');
    // Bergfried (Dagobertsturm)
    c.fillStyle = grad(c, -52, 0, 52, 0, ['#d9cfbb', '#ece4d3', '#c4b9a3']);
    c.fillRect(-52, -282, 104, 178);
    quader(c, -52, -282, 104, 178, 41, 46, 'rgba(90,76,56,0.1)');
    // Treppengiebel
    for (let i = 0; i < 5; i++) {
      const w = 104 - i * 20;
      box(c, -w / 2, -282 - (i + 1) * 9, w, 9.5, stein);
    }
    box(c, -8, -282 - 4 * 9 - 3, 16, 8, '#efe6d3');
    box(c, -6, -312, 12, 16, '#4f6f7f');
    box(c, -0.6, -312, 1.2, 16, stein);
    box(c, -52, -284, 104, 4, '#b6ab95');
    // Vordere Ecktürmchen
    for (const x of [-52, 52]) {
      box(c, x - 7, -304, 14, 34, '#e7decb');
      rund(c, x - 7, -304, 14, 34);
      kegel(c, x, -304, 10, 22, '#a9552f');
      ell(c, x, -326, 1.4, 1.4, '#d9b64a');
    }
    for (const [x, y] of [[-24, -258], [14, -258], [-24, -220], [14, -220], [-5, -180]]) fenster(c, x, y, 10, 15, '#f8f2e4');
    bogen(c, 0, -112, 22, 30, '#5d4a34');
    // Wehrmauer
    box(c, -196, -122, 372, 20, '#c7bca6');
    zinnen(c, -196, -122, 372, 25, 6, '#c7bca6');
    quader(c, -196, -122, 372, 20, 52, 30, 'rgba(90,76,56,0.13)');
    bogen(c, 104, -102, 22, 18, '#5d4a34');
    // Reben davor
    hill(c, [[-212, 0], [-160, -46], [-10, -60], [150, -48], [212, 0]], grad(c, 0, -60, 0, 0, ['#9dbb68', '#779a4a']));
    for (const [yy, a] of [[-40, 0.8], [-25, 0.9], [-9, 1]]) {
      const R = 186 * a;
      const pts = [];
      for (let x = -R; x <= R; x += 14) pts.push([x, yy + 5 - 9 * (1 - (x / R) * (x / R))]);
      c.strokeStyle = '#7a5f3e';
      c.lineWidth = 1.4;
      c.beginPath();
      pts.forEach((q, i) => {
        if (i % 2) return;
        c.moveTo(q[0], q[1] + 3);
        c.lineTo(q[0], q[1] - 10 * a);
      });
      c.stroke();
      rebzeile(c, pts, 11 * a, 11 * a, '#4f8a3f', '#74ab55');
      const r = rngOf(-yy * 3);
      c.fillStyle = '#5b2f6e';
      c.beginPath();
      for (let i = 0; i < 14; i++) {
        const q = pts[Math.floor(r() * pts.length)];
        const x = q[0] + r() * 6;
        const y = q[1] + 3 + r() * 3;
        c.moveTo(x + 2, y);
        c.arc(x, y, 2 * a, 0, TAU);
      }
      c.fill();
    }
    // Wimpel auf dem Treppengiebel
    line(c, [[0, -327], [0, -339]], '#5a564e', 1.4);
    poly(c, [[0, -339], [15, -336 + Math.sin(t * 1.7) * 1.4], [0, -332]], '#c23b2e');
  };

  L.pfahlbau = (c, t) => {
    wasser(c, 211, -56, t, '#a6dce2', '#4a9cb0');
    const hut = (x, w, s) => {
      // Pfähle
      for (let k = -3; k <= 3; k++) {
        const px = x + (k * w) / 6.6;
        spiegel(c, px, -6, 6, 6, '#3a2a18', 0.25, t);
        c.strokeStyle = '#4a3420';
        c.lineWidth = 6;
        c.lineCap = 'butt';
        c.beginPath();
        c.moveTo(px, -66);
        c.lineTo(px + k * 0.7, -6);
        c.stroke();
        ell(c, px + k * 0.7, -6, 6, 1.6, 'rgba(255,255,255,0.45)');
      }
      // Wand aus Flechtwerk
      const l = x - w / 2 + 6;
      const r = x + w / 2 - 6;
      box(c, l, -120, r - l, 54, '#a2814f');
      c.strokeStyle = 'rgba(70,45,20,0.5)';
      c.lineWidth = 1.2;
      c.beginPath();
      for (let y = -116; y < -68; y += 7) {
        c.moveTo(l, y);
        c.quadraticCurveTo(x, y + 3, r, y);
      }
      c.stroke();
      box(c, x - 10, -102, 20, 36, '#2d1e10', 2);
      box(c, x - 12, -104, 3, 38, '#5a3f22');
      box(c, x + 9, -104, 3, 38, '#5a3f22');
      // Schilfdach
      const top = -120 - w * 0.72;
      const roof = [[x - w / 2 - 15, -112], [x, top], [x + w / 2 + 15, -112]];
      poly(c, roof, grad(c, 0, top, 0, -112, ['#d7b86c', '#b8934d']));
      c.save();
      poly(c, roof);
      c.clip();
      c.strokeStyle = 'rgba(115,85,35,0.55)';
      c.lineWidth = 1.2;
      c.beginPath();
      for (let k = -9; k <= 9; k++) {
        c.moveTo(x + k * (w / 18) * 0.15, top);
        c.lineTo(x + k * (w / 18) * 1.25, -110);
      }
      c.stroke();
      c.restore();
      line(c, [[x - 8, top + 4], [x + 9, top - 8]], '#6a4c30', 2.5);
      line(c, [[x + 8, top + 4], [x - 9, top - 8]], '#6a4c30', 2.5);
      if (s) {
        // Rauch nur als zarter Hauch
        for (let i = 0; i < 3; i++) {
          const u = (t * 0.08 + i / 3) % 1;
          c.fillStyle = `rgba(255,255,255,${0.32 * (1 - u)})`;
          c.beginPath();
          c.arc(x + 4 + Math.sin(u * 5) * 4, top - 8 - u * 26, 3 + u * 5, 0, TAU);
          c.fill();
        }
      }
    };
    hut(-96, 110, false);
    hut(58, 128, true);
    // Plattform
    box(c, -168, -72, 318, 8, '#7b5a34');
    c.strokeStyle = 'rgba(40,25,10,0.45)';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = -164; x < 150; x += 9) {
      c.moveTo(x, -72);
      c.lineTo(x, -64);
    }
    c.stroke();
    // Steg zum Ufer
    for (let i = 0; i < 4; i++) {
      const u = (i + 0.5) / 4;
      const x = lerp(150, 206, u);
      line(c, [[x, lerp(-66, -2, u)], [x, -2]], '#4a3420', 4, 'butt');
    }
    poly(c, [[148, -72], [152, -64], [212, -2], [204, -2]], '#8a6840');
    line(c, [[150, -86], [206, -18]], '#5a3f22', 2);
    line(c, [[150, -86], [150, -72]], '#5a3f22', 2);
    // Fischtrockengestell und Einbaum
    line(c, [[-156, -72], [-156, -100]], '#5a3f22', 2.4);
    line(c, [[-134, -72], [-134, -100]], '#5a3f22', 2.4);
    line(c, [[-160, -99], [-130, -99]], '#5a3f22', 2.4);
    for (let i = 0; i < 3; i++) ell(c, -151 + i * 9, -91, 2.2, 6, '#b9c6c8');
    const bob = Math.sin(t * 0.9) * 0.8;
    c.save();
    c.translate(-150, -18 + bob);
    c.rotate(Math.sin(t * 0.7) * 0.012);
    c.beginPath();
    c.moveTo(-40, -5);
    c.quadraticCurveTo(0, 12, 42, -6);
    c.quadraticCurveTo(0, 0, -40, -5);
    c.closePath();
    c.fillStyle = '#5a3c20';
    c.fill();
    c.beginPath();
    c.moveTo(-40, -5);
    c.quadraticCurveTo(0, 15, 42, -6);
    c.quadraticCurveTo(0, 22, -40, -5);
    c.closePath();
    c.fillStyle = '#6e4a28';
    c.fill();
    c.restore();
    schilf(c, -190, -6, 72, t, 3, 6);
    schilf(c, 180, -4, 48, t, 4, 5);
  };

  L.wasserwerk = (c, t) => {
    wasser(c, 211, -60, t);
    const H = [[-98, 0], [-52, -40], [30, -130], [104, -216], [170, -206], [206, -90], [214, 0]];
    hill(c, H, grad(c, 0, -214, 0, 0, ['#9cc070', '#6f9a50']));
    for (const [x, y, h] of [[-16, -32, 56], [34, -74, 64], [160, -160, 64], [186, -74, 70], [120, -60, 72], [84, -40, 56], [146, -24, 64]]) {
      tree(c, x, y, h, x > 150 ? 'tanne' : 'laub', t, x + 40);
    }
    // Gebäude
    box(c, 66, -270, 72, 62, '#efe8d8');
    box(c, 62, -274, 80, 5, '#9aa39f');
    for (let i = 0; i < 5; i++) box(c, 72 + i * 13, -263, 9, 42, '#5d8697');
    box(c, 72, -263, 61, 12, 'rgba(255,255,255,0.2)');
    box(c, 138, -252, 62, 44, '#e3dccb');
    box(c, 134, -256, 70, 4, '#9aa39f');
    box(c, 146, -244, 46, 11, '#5d8697');
    box(c, 158, -228, 20, 20, '#7d8a87', 2);
    // Große blaue Leitung vom See den Hang hinauf
    const A = [-66, -22];
    const B = [76, -212];
    box(c, A[0] - 18, A[1] - 12, 30, 26, '#a7b0ac', 3);
    box(c, A[0] - 22, A[1] - 16, 38, 5, '#8b9490', 2);
    const nx = 0.8;
    const ny = 0.6;
    for (let i = 1; i < 6; i++) {
      const x = lerp(A[0], B[0], i / 6);
      const y = lerp(A[1], B[1], i / 6);
      box(c, x - 5, y + 4, 10, 14, '#b4b9b0');
      box(c, x - 9, y + 16, 18, 4, '#9aa09a');
    }
    line(c, [A, B], '#1f6aa8', 18, 'butt');
    line(c, [[A[0] - 2, A[1] - 2.6], [B[0] - 2, B[1] - 2.6]], '#2f8ad0', 12, 'butt');
    line(c, [[A[0] - 4, A[1] - 5], [B[0] - 4, B[1] - 5]], '#88c8f0', 2.6, 'butt');
    for (let i = 0; i <= 8; i++) {
      const x = lerp(A[0], B[0], i / 8);
      const y = lerp(A[1], B[1], i / 8);
      line(c, [[x - nx * 11, y - ny * 11], [x + nx * 11, y + ny * 11]], '#175a90', 3.4, 'butt');
    }
    // Wasser im Rohr, als helle Punkte sichtbar
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath();
    for (let i = 0; i < 7; i++) {
      const u = (t * 0.06 + i / 7) % 1;
      const x = lerp(A[0], B[0], u);
      const y = lerp(A[1], B[1], u);
      c.moveTo(x + 2.2, y);
      c.arc(x, y, 2.2, 0, TAU);
    }
    c.fill();
    // Wassertropfen darüber
    const dy = Math.sin(t * 0.8) * 2.5;
    c.save();
    c.translate(112, -296 + dy);
    c.beginPath();
    c.moveTo(0, -34);
    c.bezierCurveTo(5, -18, 22, -6, 22, 8);
    c.arc(0, 8, 22, 0, PI);
    c.bezierCurveTo(-22, -6, -5, -18, 0, -34);
    c.closePath();
    c.fillStyle = grad(c, 0, -34, 0, 30, ['#9fdcf8', '#2f8ad0']);
    c.fill();
    ell(c, -8, 8, 4.4, 8, 'rgba(255,255,255,0.65)', 0.3);
    ell(c, 2, 22, 7, 2.4, 'rgba(255,255,255,0.3)');
    c.restore();
    // Mündung im See
    ell(c, A[0] - 4, A[1] + 12, 24, 3, 'rgba(255,255,255,0.45)');
    const rp = (t * 0.25) % 1;
    c.strokeStyle = `rgba(255,255,255,${0.45 * (1 - rp)})`;
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(A[0] - 4, A[1] + 12, 24 + rp * 30, 3 + rp * 3, 0, 0, TAU);
    c.stroke();
  };

  function beet(c, x, y, w, h, art) {
    box(c, x, y - h, w, h, '#6b4a30', 2);
    box(c, x + 3, y - h + 3, w - 6, h - 5, '#4a3424', 1);
    box(c, x, y - 3, w, 3, '#8a6642');
    const n = Math.round(w / 15);
    for (let j = 0; j < 2; j++) {
      const yy = y - h + 7 + j * (h - 8) * 0.55;
      for (let i = 0; i < n; i++) {
        const px = x + 8 + (i * (w - 16)) / Math.max(1, n - 1) + (j ? 3 : 0);
        if (art === 'salat') {
          ell(c, px, yy, 6.2, 4.6, '#8fcf62');
          ell(c, px - 1, yy - 1, 3.4, 2.5, '#bfe68a');
        } else if (art === 'kohl') {
          ell(c, px, yy, 6.4, 5, '#6d9f8c');
          ell(c, px, yy - 0.6, 3.6, 3, '#9cc7b4');
        } else if (art === 'karotte') {
          line(c, [[px, yy + 2], [px - 2.6, yy - 5]], '#6fae48', 1.3);
          line(c, [[px, yy + 2], [px + 2.6, yy - 5]], '#6fae48', 1.3);
          line(c, [[px, yy + 2], [px, yy - 6]], '#83c256', 1.3);
          ell(c, px, yy + 2.6, 2.4, 2, '#e9852f');
        } else {
          line(c, [[px, yy + 4], [px, yy - 12]], '#a98a58', 1.3);
          ell(c, px, yy - 5, 4.6, 6, '#5f9c4c');
          ell(c, px - 1.8, yy - 3, 1.8, 1.8, '#d8402f');
          ell(c, px + 1.8, yy - 7, 1.8, 1.8, '#e0533c');
        }
      }
    }
  }
  L.kloster_reichenau = (c, t) => {
    hill(c, [[-212, 0], [-196, -30], [-70, -46], [120, -46], [198, -30], [212, 0]], grad(c, 0, -46, 0, 0, ['#a4c56c', '#7fa452']));
    tree(c, 142, -34, 170, 'laub', t, 5);
    const wand = '#ddd3bc';
    const lisene = '#b96d4f';
    // Langhaus mit Satteldach
    dach(c, -76, 170, -142, -192, 12, '#7c6250', 5);
    box(c, -76, -142, 246, 104, wand);
    for (let i = 0; i < 7; i++) bogen(c, -48 + i * 33, -112, 9, 22, '#4c5f6b');
    // Seitenschiff
    dach(c, -76, 170, -92, -112, 2, '#8f6a52', 5);
    box(c, -76, -92, 246, 54, shade(wand, -0.05));
    for (let i = 0; i < 6; i++) bogen(c, -44 + i * 40, -60, 9, 19, '#4c5f6b');
    // Querhaus mit Giebel
    poly(c, [[96, -142], [132, -194], [168, -142]], shade(wand, 0.02));
    box(c, 96, -142, 72, 104, shade(wand, 0.02));
    line(c, [[94, -140], [132, -196], [170, -140]], '#6a5242', 5);
    bogen(c, 116, -92, 12, 30, '#4c5f6b');
    bogen(c, 148, -92, 12, 30, '#4c5f6b');
    bogen(c, 132, -150, 11, 24, '#4c5f6b');
    box(c, 96, -86, 72, 2.5, lisene);
    bogen(c, 132, -38, 18, 26, '#6a4a30');
    // Massiger Westturm
    const x0 = -176;
    const x1 = -84;
    // Dachfläche nach hinten und Seitenwand
    poly(c, [[-130, -326], [x1, -270], [-62, -282], [-108, -338]], grad(c, 0, -338, 0, -270, ['#ad5f3e', '#8c4a2f']));
    poly(c, [[x1, -270], [-62, -282], [-62, -40], [x1, -40]], shade(wand, -0.16));
    box(c, x0, -270, x1 - x0, 232, wand);
    poly(c, [[x0, -270], [x1, -270], [-130, -326]], wand);
    line(c, [[x0 - 3, -267], [-130, -328], [x1 + 3, -267]], '#8c4a2f', 5);
    line(c, [[-130, -328], [-130, -339]], '#5a564e', 1.8);
    line(c, [[-134, -335], [-126, -335]], '#5a564e', 1.8);
    quader(c, x0, -270, x1 - x0, 232, 61, 42, 'rgba(100,84,60,0.08)');
    // Lisenen und Gesimse
    for (const x of [x0, -133, x1 - 6]) box(c, x, -270, 6, 232, lisene);
    box(c, x0, -176, x1 - x0, 4, lisene);
    box(c, x0, -112, x1 - x0, 4, lisene);
    box(c, x0, -210, x1 - x0, 3, '#c9bda3');
    // Drillingsfenster oben
    for (const cx of [-155, -105]) {
      for (const d of [-13, 0, 13]) {
        bogen(c, cx + d, -222, 12.5, 30, '#c1684a');
        bogen(c, cx + d, -222, 8.6, 26, '#2f3c44');
      }
    }
    bogen(c, -130, -282, 10, 20, '#2f3c44');
    for (const cx of [-155, -105]) bogen(c, cx, -130, 9, 22, '#3f4f58');
    bogen(c, -130, -38, 22, 30, '#6a4a30');
    // Gemüsebeete davor
    beet(c, -196, -1, 112, 22, 'salat');
    beet(c, -78, -1, 112, 22, 'kohl');
    beet(c, 40, -1, 88, 22, 'karotte');
    beet(c, 134, -1, 66, 22, 'tomate');
  };

  function palme(c, x, y, s, t) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    poly(c, [[-11, -18], [11, -18], [8, 0], [-8, 0]], grad(c, -11, 0, 11, 0, ['#c9713e', '#a65a30']));
    box(c, -12, -20, 24, 4, '#d9834c', 1);
    poly(c, [[-3, -18], [3, -18], [2, -62], [-2, -62]], '#7d6242');
    c.strokeStyle = 'rgba(50,35,20,0.35)';
    c.lineWidth = 1;
    c.beginPath();
    for (let y2 = -24; y2 > -60; y2 -= 6) {
      c.moveTo(-3, y2);
      c.lineTo(3, y2 - 2);
    }
    c.stroke();
    const sw = Math.sin(t * 0.8 + x) * 1.6;
    for (const [dx, dy, col] of [[-30, -6, '#4c9050'], [30, -4, '#4c9050'], [-24, -24, '#5aa35a'], [24, -24, '#5aa35a'], [-8, -32, '#6cb564'], [10, -32, '#6cb564']]) {
      c.beginPath();
      c.moveTo(0, -62);
      c.quadraticCurveTo(dx * 0.5, -62 + dy - 12, dx + sw, -62 + dy + 8);
      c.quadraticCurveTo(dx * 0.5, -62 + dy + 2, 0, -62);
      c.closePath();
      c.fillStyle = col;
      c.fill();
    }
    c.restore();
  }
  L.mainau = (c, t) => {
    hill(c, [[-212, 0], [-200, -40], [-80, -56], [90, -56], [200, -40], [212, 0]], grad(c, 0, -56, 0, 0, ['#9cc765', '#6fa548']));
    const gelb = '#f4e0a8';
    const rosa = '#dc8d78';
    const dachf = '#8c5c46';
    const yb = -50;
    // Schlosskirche mit grüner Zwiebel
    box(c, 134, -158, 58, 108, '#efb9a2');
    dach(c, 134, 192, -158, -186, 6, '#6d4a3a', 3);
    bogen(c, 162, -70, 13, 44, '#54707e');
    box(c, 158, -270, 32, 112, '#efb9a2');
    box(c, 154, -272, 40, 4, '#f8efd8');
    box(c, 156, -210, 36, 3, '#f8efd8');
    bogen(c, 174, -222, 13, 30, '#54707e');
    ell(c, 174, -254, 7.5, 7.5, '#fbf7ea');
    ell(c, 174, -254, 6, 6, '#3b3a35');
    c.beginPath();
    c.moveTo(158, -272);
    c.bezierCurveTo(150, -294, 172, -296, 174, -318);
    c.bezierCurveTo(176, -296, 198, -294, 190, -272);
    c.closePath();
    c.fillStyle = grad(c, 150, 0, 198, 0, ['#4f9a84', '#2f7a68']);
    c.fill();
    line(c, [[174, -316], [174, -332]], '#d9b64a', 2);
    ell(c, 174, -326, 2.4, 2.4, '#e8c55a');
    // Mittelbau
    dach(c, -100, 46, -176, -214, 8, dachf, 2);
    box(c, -100, -176, 146, 176 + yb, gelb);
    // Seitenflügel
    const fluegel = (x0, w) => {
      dach(c, x0, x0 + w, -184, -238, 24, dachf, 6);
      gaube(c, x0 + w / 2, -198, 12, 10, '#f8efd8', dachf);
      box(c, x0, -184, w, 184 + yb, gelb);
      box(c, x0 - 3, -187, w + 6, 4, '#f8efd8');
      for (const px of [x0, x0 + w - 7]) box(c, px, -184, 7, 184 + yb, rosa);
      box(c, x0, -134, w, 3, rosa);
      box(c, x0, -92, w, 3, rosa);
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const fx = x0 + 15 + i * ((w - 40) / 2);
          const fy = -174 + j * 44;
          box(c, fx - 2, fy - 2, 14, 25, rosa, 1);
          fenster(c, fx, fy, 10, 21, '#fbf7ea', '#6a8a97');
        }
      }
    };
    fluegel(-196, 96);
    fluegel(46, 92);
    // Fensterreihen im Mittelbau
    for (let j = 0; j < 3; j++) {
      for (const fx of [-92, -74, 8, 26]) {
        const fy = -164 + j * 40;
        box(c, fx - 2, fy - 2, 14, 24, rosa, 1);
        fenster(c, fx, fy, 10, 20, '#fbf7ea', '#6a8a97');
      }
    }
    // Pavillon mit Wappen
    const px0 = -54;
    const px1 = 8;
    box(c, px0, -190, px1 - px0, 190 + yb, shade(gelb, 0.25));
    for (const px of [px0, px1 - 7]) box(c, px, -190, 7, 190 + yb, rosa);
    const mx = (px0 + px1) / 2;
    c.beginPath();
    c.moveTo(px0 - 4, -190);
    c.quadraticCurveTo(mx, -240, px1 + 4, -190);
    c.closePath();
    c.fillStyle = rosa;
    c.fill();
    c.beginPath();
    c.moveTo(px0 + 5, -192);
    c.quadraticCurveTo(mx, -232, px1 - 5, -192);
    c.closePath();
    c.fillStyle = gelb;
    c.fill();
    ell(c, mx, -203, 11, 8.5, '#d8a93a');
    ell(c, mx, -203, 6.4, 5.4, '#f7e6ae');
    box(c, mx - 1.2, -207, 2.4, 8, '#3b3a35');
    box(c, mx - 3.4, -204, 6.8, 2.2, '#3b3a35');
    for (let j = 0; j < 2; j++) {
      fenster(c, mx - 7, -178 + j * 44, 14, 28, '#fbf7ea', '#6a8a97');
    }
    box(c, mx - 12, -110, 24, 3, '#3b3a35');
    for (const d of [-18, 0, 18]) {
      bogen(c, mx + d, yb, 15, 34, rosa);
      bogen(c, mx + d, yb, 11, 30, '#3f4f58');
    }
    // Rasen und Blumenteppich
    hill(c, [[-212, 0], [-190, -30], [-60, -36], [80, -36], [190, -30], [212, 0]], grad(c, 0, -36, 0, 0, ['#a9d170', '#7db64f']));
    const reihe = (y, a, col, d, w) => {
      c.save();
      c.beginPath();
      c.moveTo(-a, y);
      c.quadraticCurveTo(0, y - 8, a, y);
      c.lineCap = 'round';
      c.setLineDash([0.1, d]);
      c.lineWidth = w;
      c.strokeStyle = col;
      c.stroke();
      c.restore();
    };
    hill(c, [[-160, -3], [-120, -24], [0, -32], [120, -24], [160, -3]], '#7a5a3a');
    reihe(-22, 118, '#f2c83a', 7, 6);
    reihe(-17, 134, '#e4572e', 7, 6);
    reihe(-12, 146, '#b24dc4', 7, 6);
    reihe(-7, 152, '#f28ab2', 7, 6);
    reihe(-3, 156, '#fff1d0', 7, 6);
    for (const [x, col, s] of [[-186, '#e4572e', 15], [-170, '#f2c83a', 12], [172, '#b24dc4', 13], [190, '#f28ab2', 15]]) flower(c, x, -2, s, col, t, x);
    palme(c, -176, -4, 1.04, t);
    palme(c, 112, -3, 1, t);
    const bx = 70 + Math.sin(t * 0.33) * 56;
    const by = -74 + Math.sin(t * 0.61) * 20;
    falter(c, bx, by, 1.5, t, '#ff8a2a', '#ffb347');
  };

  L.konzil = (c, t) => {
    wasser(c, 211, -46, t);
    // Hafenkai
    box(c, -206, -60, 412, 22, '#a8a194');
    box(c, -206, -64, 412, 5, '#c6bfb0');
    quader(c, -206, -58, 412, 18, 83, 30, 'rgba(50,50,50,0.12)');
    spiegel(c, 0, -36, 340, 34, '#8c5038', 0.2, t);
    // Mächtiges Walmdach
    const eave = -152;
    const ridge = -296;
    dach(c, -188, 188, eave, ridge, 92, '#ad5636', 10);
    // Dachgauben in drei Reihen
    for (let i = 0; i < 10; i++) gaube(c, -135 + i * 30, -164, 11, 10, '#efe6d2', '#8a4326');
    for (let i = 0; i < 8; i++) gaube(c, -105 + i * 30, -202, 10, 9, '#efe6d2', '#8a4326');
    for (let i = 0; i < 6; i++) gaube(c, -75 + i * 30, -240, 9, 8, '#efe6d2', '#8a4326');
    box(c, -52, -310, 10, 18, '#8a4f39');
    box(c, 44, -310, 10, 18, '#8a4f39');
    // Dunkles Holzgeschoss
    box(c, -194, eave, 388, 36, '#4a3322');
    c.strokeStyle = 'rgba(0,0,0,0.22)';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = -190; x < 194; x += 7) {
      c.moveTo(x, eave);
      c.lineTo(x, eave + 36);
    }
    c.stroke();
    for (let i = 0; i < 15; i++) {
      if (i === 7) continue;
      fenster(c, -176 + i * 24.4, eave + 9, 9, 13, '#d9cdb5', '#51707f');
    }
    box(c, -194, eave + 34, 388, 3, '#2f2015');
    // Heller Steinbau unten
    box(c, -186, -116, 372, 58, '#eee7d6');
    box(c, 96, -116, 90, 58, 'rgba(0,0,0,0.04)');
    for (const x of [-186, 174]) {
      for (let i = 0; i < 5; i++) box(c, x + (i % 2 ? 0 : x < 0 ? 0 : -4), -116 + i * 11.6, i % 2 ? 12 : 16, 10.6, '#b9ae97');
    }
    for (const x of [-150, -106, -62, 52, 96, 140]) {
      box(c, x - 2, -106, 24, 26, '#a79c86');
      fenster(c, x, -104, 9, 22, '#c9bda6', '#5f7d8b');
      fenster(c, x + 11, -104, 9, 22, '#c9bda6', '#5f7d8b');
    }
    // Spitzbogen-Portal mit Freitreppe
    spitz(c, 0, -60, 34, 48, '#a79c86');
    spitz(c, 0, -60, 26, 42, '#54402c');
    box(c, -44, -68, 88, 8, '#c6bfb0');
    box(c, -54, -62, 108, 4, '#b5ad9e');
    // Eckerker mit Spitzdach
    for (const x of [-190, 190]) {
      box(c, x - 15, -200, 30, 50, '#4a3322');
      box(c, x - 6, -190, 12, 18, '#51707f');
      poly(c, [[x - 19, -200], [x + 19, -200], [x, -240]], grad(c, x - 19, 0, x + 19, 0, ['#b5593a', '#8f4228']));
      line(c, [[x, -240], [x, -254]], '#4e4a44', 1.6);
      poly(c, [[x, -254], [x + 9, -251], [x, -248]], '#c5503c');
    }
    // Pfähle und Boot im Hafenbecken
    for (const [x, h] of [[-176, 34], [-120, 30], [-66, 34], [64, 34], [122, 30], [178, 34]]) {
      box(c, x - 3, -38, 6, h, '#6a4c30');
      box(c, x - 3, -38, 6, 5, '#f4efe2');
      ell(c, x, -5, 7, 1.7, 'rgba(255,255,255,0.45)');
    }
    const b = Math.sin(t * 0.9) * 0.8;
    poly(c, [[-48, -18 + b], [32, -18 + b], [22, -6 + b], [-38, -6 + b]], '#f7f3e8');
    box(c, -48, -19 + b, 80, 3, '#2b7fc0');
    box(c, -18, -30 + b, 26, 11, '#e9eef0', 2);
    box(c, -14, -28 + b, 18, 6, '#4f6f7f');
  };

  L.grenzstein = (c, t) => {
    hill(c, [[-212, -44], [-140, -96], [-60, -74], [40, -112], [130, -82], [212, -44]], '#c1d6c8');
    hill(c, [[-212, 0], [-196, -40], [-100, -58], [100, -58], [196, -40], [212, 0]], grad(c, 0, -58, 0, 0, ['#add078', '#7fb052']));
    // Weg durch den offenen Durchgang
    poly(c, [[-74, 0], [74, 0], [15, -56], [-15, -56]], grad(c, 0, -56, 0, 0, ['#efe3c2', '#dcc798']));
    c.fillStyle = 'rgba(140,110,70,0.25)';
    c.beginPath();
    const r = rngOf(4);
    for (let i = 0; i < 26; i++) {
      const v = r();
      const hw = lerp(70, 13, v);
      const x = (r() * 2 - 1) * hw;
      const y = -v * 54 - 1;
      c.rect(x, y, 3 - v * 1.8, 1.4);
    }
    c.fill();
    // Hecken links und rechts lassen eine breite Lücke
    busch(c, -162, -30, 42, '#5b9750', 3);
    busch(c, -108, -34, 30, '#6aa657', 6);
    busch(c, 162, -30, 42, '#5b9750', 5);
    busch(c, 108, -34, 30, '#6aa657', 8);
    // Fahnen
    fahne(c, -134, -30, 176, 'de', t, 76);
    fahne(c, 134, -30, 176, 'ch', t, 76);
    // Geöffneter Schlagbaum
    box(c, -52, -92, 8, 56, '#7c6a52', 1);
    box(c, -55, -36, 14, 4, '#5e503e');
    c.save();
    c.translate(-48, -84);
    c.rotate(-1.05 + Math.sin(t * 0.5) * 0.008);
    for (let i = 0; i < 8; i++) box(c, i * 13, -2.6, 13, 5.2, i % 2 ? '#fff' : '#d6402f');
    ell(c, 0, 0, 5, 5, '#3f3a33');
    c.restore();
    box(c, 44, -72, 8, 36, '#7c6a52', 1);
    box(c, 41, -36, 14, 4, '#5e503e');
    box(c, 41, -74, 14, 3, '#5e503e');
    // Gelber Wanderwegweiser, ohne Schrift
    box(c, 76, -92, 5, 60, '#8a7a62');
    poly(c, [[62, -92], [96, -92], [106, -83], [96, -74], [62, -74]], '#f2c62e');
    poly(c, [[70, -86.5], [88, -86.5], [88, -91], [98, -83], [88, -75], [88, -79.5], [70, -79.5]], '#2a2622');
    // Der Grenzstein am Weg
    const sx = 66;
    const sy = -4;
    ell(c, sx, sy + 1, 28, 5, 'rgba(0,0,0,0.16)');
    c.beginPath();
    c.moveTo(sx - 21, sy);
    c.lineTo(sx - 18, sy - 44);
    c.quadraticCurveTo(sx, sy - 66, sx + 18, sy - 44);
    c.lineTo(sx + 21, sy);
    c.closePath();
    c.fillStyle = grad(c, sx - 21, 0, sx + 21, 0, ['#d6cdb9', '#efe8d8', '#b5ab96']);
    c.fill();
    line(c, [[sx, sy - 56], [sx, sy - 8]], '#8c8270', 2.4, 'butt');
    line(c, [[sx - 9, sy - 38], [sx + 9, sy - 38]], '#8c8270', 2.4, 'butt');
    ell(c, sx - 13, sy - 6, 7, 4, '#7ea65c');
    ell(c, sx + 15, sy - 4, 8, 3.6, '#7ea65c');
    for (const [x, col, s] of [[-92, '#e8c23a', 12], [-84, '#d45a7a', 15], [-108, '#ffffff', 11], [100, '#b24dc4', 13], [118, '#e8c23a', 15], [-180, '#d45a7a', 14], [182, '#ffffff', 13]]) flower(c, x, -3, s, col, t, x);
  };

  L.hohentwiel = (c, t) => {
    fern(c, [[-206, -6], [-178, -66], [-140, -104], [-102, -66], [-62, -6]], '#c3d5cf');
    fern(c, [[70, -6], [116, -54], [164, -68], [206, -6]], '#d3dfd9');
    wolke(c, 142, -268, 0.8, 0.85);
    const H = [[-212, 0], [-164, -20], [-118, -62], [-98, -128], [-82, -196], [-54, -244], [0, -262], [54, -244], [84, -194], [100, -126], [122, -60], [168, -20], [212, 0]];
    hill(c, H, grad(c, 0, -262, 0, 0, ['#86a96a', '#5f8f50']));
    c.save();
    hill(c, H);
    c.clip();
    // Felder am Fuß
    poly(c, [[-212, 0], [-110, -34], [-24, -24], [-40, 0]], '#c9cf78');
    poly(c, [[-24, -24], [62, -34], [122, 0], [-40, 0]], '#a9c868');
    poly(c, [[62, -34], [150, -24], [212, 0], [122, 0]], '#d4c77a');
    // Dichter Wald an den Flanken
    const w = rngOf(14);
    const gruen = ['#4f8a4c', '#568f50', '#5d9554', '#4a8549'];
    for (let i = 0; i < 58; i++) {
      const y = -34 - w() * 150;
      const x = (w() * 2 - 1) * lerp(150, 90, -y / 190);
      ell(c, x, y, 11 + w() * 8, 9 + w() * 6, gruen[i % 4]);
    }
    // Nackter Fels unter der Burg
    poly(c, [[-96, -178], [-72, -266], [72, -266], [96, -174], [66, -192], [48, -158], [24, -188], [-2, -152], [-28, -188], [-52, -162], [-72, -192]], grad(c, 0, -266, 0, -152, ['#cdc4b0', '#a39985']));
    c.strokeStyle = 'rgba(70,60,45,0.25)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (const x of [-58, -38, -18, 4, 24, 44, 62]) {
      c.moveTo(x, -254);
      c.lineTo(x + 2, -194 + Math.abs(x) * 0.2);
    }
    c.stroke();
    c.restore();
    // Burgruine auf dem Gipfel
    const y0 = -248;
    poly(c, [[-68, y0 + 14], [-66, y0 - 18], [-50, y0 - 14], [-38, y0 - 22], [-14, y0 - 18], [-2, y0 - 28], [18, y0 - 22], [34, y0 - 28], [46, y0 - 18], [64, y0 - 16], [68, y0 + 14]], grad(c, 0, y0 - 28, 0, y0 + 14, ['#d6cdb9', '#ada38d']));
    quader(c, -64, y0 - 18, 128, 32, 92, 24, 'rgba(70,60,45,0.15)');
    for (const x of [-16, 2, 20, 34]) bogen(c, x, y0 + 4, 8, 16, '#5c5546');
    // Großer Rundturm
    const tx = -44;
    box(c, tx - 21, y0 - 48, 42, 62, '#ddd4c0');
    rund(c, tx - 21, y0 - 48, 42, 62);
    zinnen(c, tx - 21, y0 - 48, 42, 5, 6, '#d3cab6');
    quader(c, tx - 21, y0 - 46, 42, 58, 15, 14, 'rgba(70,60,45,0.13)');
    bogen(c, tx - 5, y0 - 22, 7, 13, '#4f4839');
    bogen(c, tx + 9, y0 - 8, 7, 13, '#4f4839');
    // Halber Eckturm rechts
    poly(c, [[42, y0 + 14], [42, y0 - 36], [48, y0 - 42], [53, y0 - 36], [58, y0 - 46], [66, y0 - 38], [68, y0 + 14]], '#cbc2ad');
    bogen(c, 55, y0 - 12, 7, 13, '#4f4839');
    busch(c, 12, y0 - 24, 7, '#5f9a55', 6);
    busch(c, -70, y0 + 16, 8, '#5f9a55', 7);
    busch(c, 70, y0 + 16, 9, '#5f9a55', 8);
    bird(c, 104 + Math.sin(t * 0.17) * 24, -214 + Math.sin(t * 0.23) * 8, 7, t * 0.4);
  };

  // Abdruck eines großen Riesensalamanders, Kopf nach rechts.
  function salamander(c) {
    const col = '#6d5a42';
    const sp = (u) => {
      const x = lerp(-92, 54, u);
      return [x, -62 + Math.sin(u * PI * 1.3 + 0.6) * 9];
    };
    // Schwanz und Wirbelsäule
    c.strokeStyle = col;
    c.lineCap = 'round';
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i <= 26; i++) {
      const p = sp(i / 26);
      if (i) c.lineTo(p[0], p[1]);
      else c.moveTo(p[0], p[1]);
    }
    c.stroke();
    c.lineWidth = 1.6;
    c.beginPath();
    for (let i = 0; i <= 44; i++) {
      const u = i / 44;
      const p = sp(u);
      const l = u < 0.4 ? 2 + u * 7 : u < 0.92 ? 13 : 7;
      if (u < 0.4) {
        c.moveTo(p[0], p[1] - l);
        c.lineTo(p[0], p[1] + l);
      } else {
        // Rippen, leicht nach hinten gebogen
        c.moveTo(p[0], p[1]);
        c.quadraticCurveTo(p[0] - 1, p[1] - l * 0.8, p[0] - 4, p[1] - l);
        c.moveTo(p[0], p[1]);
        c.quadraticCurveTo(p[0] - 1, p[1] + l * 0.8, p[0] - 4, p[1] + l);
      }
    }
    c.stroke();
    // Beine mit Zehen
    const bein = (x, y, sx, sy) => {
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + sx * 8, y + sy * 12);
      c.lineTo(x + sx * 15, y + sy * 21);
      c.stroke();
      c.lineWidth = 1.5;
      c.beginPath();
      for (let k = -2; k <= 2; k++) {
        c.moveTo(x + sx * 15, y + sy * 21);
        c.lineTo(x + sx * 15 + k * 3.4 + sx * 3, y + sy * 29);
      }
      c.stroke();
    };
    bein(30, -64, 1, -1);
    bein(30, -58, 1, 1);
    bein(-28, -60, -1, -1);
    bein(-28, -54, -1, 1);
    // Breiter, runder Schädel mit großen Augenhöhlen
    ell(c, 72, -64, 23, 20, col);
    ell(c, 72, -64, 20.5, 17.5, '#e7ddc4');
    ell(c, 76, -72, 6.4, 5.6, col);
    ell(c, 76, -56, 6.4, 5.6, col);
    ell(c, 76, -72, 3.6, 3, '#e7ddc4');
    ell(c, 76, -56, 3.6, 3, '#e7ddc4');
    line(c, [[56, -64], [68, -64]], col, 2);
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(74, -64, 15, -0.8, 0.8);
    c.stroke();
  }
  L.oehningen_grube = (c, t) => {
    const O = [[-212, 0], [-206, -42], [-176, -44], [-170, -104], [-132, -106], [-126, -172], [-78, -174], [-70, -228], [78, -230], [86, -172], [134, -170], [140, -104], [178, -102], [184, -42], [206, -40], [212, 0]];
    tree(c, -104, -170, 84, 'laub', t, 2);
    tree(c, 112, -168, 92, 'laub', t, 3);
    tree(c, 36, -226, 78, 'tanne', t, 6);
    tree(c, -30, -226, 64, 'tanne', t, 8);
    poly(c, O, '#d9cdb0');
    c.save();
    poly(c, O);
    c.clip();
    // Waagrechte Gesteinsschichten
    const lagen = ['#f3ebd6', '#cbbd9d', '#e8dec5', '#b9a98a', '#f6f0df', '#d4c6a6', '#ece2ca', '#c0b192', '#f1e9d3', '#cdbf9f', '#e4d9bf', '#bcad8e'];
    let y = -240;
    lagen.forEach((col, i) => {
      const h = 12 + ((i * 7) % 11);
      c.beginPath();
      c.moveTo(-220, y + Math.sin(i * 1.7) * 3);
      for (let x = -200; x <= 220; x += 40) c.lineTo(x, y + Math.sin(x * 0.02 + i) * 1.8);
      c.lineTo(220, y + h + 40);
      c.lineTo(-220, y + h + 40);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.strokeStyle = 'rgba(90,70,40,0.25)';
      c.lineWidth = 1.2;
      c.stroke();
      y += h;
    });
    box(c, -220, -60, 440, 70, '#dccfae');
    c.restore();
    // Grasnarbe auf den Stufen
    for (const [x0, x1, y2] of [[-206, -176, -42], [-170, -132, -104], [-126, -78, -172], [-70, 78, -228], [86, 134, -170], [140, 178, -102], [184, 206, -40]]) {
      box(c, x0 - 1, y2 - 2.4, x1 - x0 + 2, 6, '#8fb35e', 2.4);
      box(c, x0 - 1, y2 + 2.4, x1 - x0 + 2, 3, 'rgba(70,50,25,0.22)');
    }
    // Boden der Grube
    hill(c, [[-212, 0], [-176, -46], [-60, -56], [90, -56], [176, -46], [212, 0]], grad(c, 0, -56, 0, 0, ['#e6d9b6', '#c9b78d']));
    const r = rngOf(31);
    c.fillStyle = '#efe6cc';
    c.beginPath();
    for (let i = 0; i < 24; i++) c.rect(-180 + r() * 360, -44 + r() * 42, 3 + r() * 7, 2 + r() * 2);
    c.fill();
    // Steinplatte mit Abdruck
    c.save();
    c.translate(44, -14);
    c.rotate(-0.035);
    poly(c, [[-118, 8], [-112, -128], [-54, -136], [40, -130], [122, -136], [126, -60], [120, 8]], '#b7a988');
    poly(c, [[-114, 2], [-108, -130], [-54, -140], [40, -134], [116, -140], [122, -60], [116, 2]], grad(c, 0, -140, 0, 2, ['#f2ead5', '#ddd1b4']));
    c.strokeStyle = 'rgba(120,100,70,0.2)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-108, -100);
    c.lineTo(118, -106);
    c.moveTo(-112, -18);
    c.lineTo(118, -22);
    c.stroke();
    c.translate(4, 0);
    salamander(c);
    c.restore();
    // Holzkiste
    const kx = -186;
    box(c, kx, -38, 66, 34, '#a87f4d');
    c.fillStyle = 'rgba(70,45,20,0.4)';
    c.fillRect(kx, -28, 66, 1.4);
    c.fillRect(kx, -17, 66, 1.4);
    box(c, kx - 1, -40, 6, 37, '#8a6438');
    box(c, kx + 61, -40, 6, 37, '#8a6438');
    ell(c, kx + 18, -41, 12, 6, '#cfc3a6');
    ell(c, kx + 40, -42, 14, 7, '#e0d5ba');
    // Hammer an der Kiste
    line(c, [[-104, -3], [-120, -52]], '#8a5e34', 4.5);
    c.save();
    c.translate(-121, -56);
    c.rotate(-0.32);
    box(c, -13, -5, 26, 10, '#7f8589', 2);
    box(c, -13, -5, 26, 3, '#a4aaad', 1);
    c.restore();
    // Pinsel
    c.save();
    c.translate(-92, -8);
    c.rotate(-0.1);
    box(c, 0, -2, 34, 4, '#c9863f', 2);
    box(c, 30, -3.5, 7, 7, '#a0a4a6');
    poly(c, [[37, -4], [49, -6], [52, 0], [49, 5], [37, 4]], '#6a4c30');
    c.restore();
  };

  // Bunt bemalte Hausfront, x linke Kante, Fuß bei y.
  function bemalt(c, x, y, w, h, wand, roof, kind, seed) {
    const r = rngOf(seed * 37);
    const gh = w * 0.62;
    poly(c, [[x - 2, y - h], [x + w + 2, y - h], [x + w / 2, y - h - gh]], roof);
    poly(c, [[x + w / 2, y - h - gh], [x + w + 2, y - h], [x + w * 0.74, y - h]], 'rgba(0,0,0,0.13)');
    box(c, x, y - h, w, h, wand);
    box(c, x + w * 0.8, y - h, w * 0.2, h, 'rgba(0,0,0,0.05)');
    if (kind === 'fach') {
      const beam = '#5a3b24';
      for (let i = 0; i <= 4; i++) box(c, x + ((w - 2.4) * i) / 4, y - h, 2.4, h - 26, beam);
      for (let j = 0; j <= 3; j++) box(c, x, y - h + ((h - 26) * j) / 3, w, 2.4, beam);
      for (let i = 0; i < 4; i++) {
        const q = (h - 26) / 3;
        line(c, [[x + (w * i) / 4, y - h + q], [x + (w * (i + 1)) / 4, y - h + 2]], beam, 1.8, 'butt');
      }
    } else if (kind === 'fresko') {
      // Gemaltes Band mit Figuren und Ranken
      const fy = y - h + 26;
      const fh = h * 0.28;
      box(c, x + 3, fy, w - 6, fh, '#bfe0e6');
      box(c, x + 3, fy + fh * 0.62, w - 6, fh * 0.38, '#8fbf72');
      const q = Math.round(w / 15);
      for (let i = 0; i < q; i++) {
        const fx = x + 8 + (i * (w - 16)) / Math.max(1, q - 1);
        const col = ['#c5503c', '#2f6f8a', '#d9a93b', '#7a4a9a'][Math.floor(r() * 4)];
        box(c, fx - 2.4, fy + fh * 0.32, 4.8, fh * 0.46, col, 1.4);
        ell(c, fx, fy + fh * 0.24, 2.3, 2.5, '#f4cfa9');
      }
      box(c, x + 3, fy - 2, w - 6, 2.4, '#b5533c');
      box(c, x + 3, fy + fh, w - 6, 2.4, '#b5533c');
      // gemalte Eckpfeiler
      box(c, x, y - h, 4, h - 22, '#d9a93b');
      box(c, x + w - 4, y - h, 4, h - 22, '#d9a93b');
    } else {
      // Ranken und Medaillons
      for (let j = 0; j < 2; j++) {
        const fy = y - h + 20 + j * 40;
        for (let i = 0; i < 2; i++) {
          const fx = x + w * (0.28 + i * 0.44);
          ell(c, fx, fy, 7, 7, '#fbf0c8');
          ell(c, fx, fy, 4.4, 4.4, ['#c5503c', '#2f6f8a', '#7a4a9a'][(i + j + seed) % 3]);
        }
      }
      c.strokeStyle = '#a5543c';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x + 4, y - h + 42);
      c.bezierCurveTo(x + w * 0.3, y - h + 30, x + w * 0.6, y - h + 54, x + w - 4, y - h + 42);
      c.stroke();
    }
    // Giebelfenster und Sockel
    fenster(c, x + w / 2 - 4, y - h - gh * 0.48, 8, 10, '#fbf7ea');
    box(c, x, y - 22, w, 22, shade(wand, -0.2));
    bogen(c, x + w * 0.3, y, 12, 18, '#4a3322');
    fenster(c, x + w * 0.62, y - 18, 11, 11, '#fbf7ea');
    if (kind !== 'fresko') fenster(c, x + w * 0.2, y - h + 8, 9, 11, '#fbf7ea');
    if (kind !== 'fresko') fenster(c, x + w * 0.62, y - h + 8, 9, 11, '#fbf7ea');
    fenster(c, x + w * 0.2, y - 42, 9, 12, '#fbf7ea');
    fenster(c, x + w * 0.62, y - 42, 9, 12, '#fbf7ea');
  }
  function erker(c, x, y, w, h, col, roof) {
    box(c, x, y - h, w, h, col);
    box(c, x, y - h, w, 3, shade(col, 0.25));
    box(c, x, y - 4, w, 4, shade(col, -0.25));
    for (let i = 0; i < 2; i++) fenster(c, x + 3 + i * ((w - 6) / 2), y - h + 5, (w - 8) / 2, h - 12, '#fbf7ea');
    poly(c, [[x, y], [x + w, y], [x + w * 0.5, y + 9]], shade(col, -0.2));
    poly(c, [[x - 2, y - h], [x + w + 2, y - h], [x + w * 0.5, y - h - w * 0.75]], roof);
  }
  L.stein_am_rhein = (c, t) => {
    hill(c, [[-212, -44], [-176, -130], [-110, -226], [-46, -270], [24, -258], [110, -186], [176, -112], [212, -44]], grad(c, 0, -270, 0, -44, ['#8eb56e', '#67984e']));
    // Burg Hohenklingen
    const by = -256;
    box(c, -84, by - 16, 98, 22, '#d3c9b4');
    zinnen(c, -84, by - 16, 98, 8, 5, '#d3c9b4');
    dach(c, -24, 26, by - 16, by - 36, 6, '#a9552f', 2);
    box(c, -24, by - 16, 50, 20, '#e5dcc9');
    fenster(c, -12, by - 12, 8, 9);
    fenster(c, 6, by - 12, 8, 9);
    box(c, -76, by - 60, 34, 66, '#ddd3be');
    rund(c, -76, by - 60, 34, 34);
    poly(c, [[-79, by - 60], [-39, by - 60], [-59, by - 84]], '#a9552f');
    fenster(c, -63, by - 48, 8, 11);
    for (const [x, y, s] of [[-140, -150, 22], [-108, -196, 16], [66, -212, 18], [124, -150, 22], [174, -92, 20], [-186, -90, 20]]) busch(c, x, y, s, '#5a9050', x + 300);
    wasser(c, 211, -52, t, '#9fd6dc', '#3f93a6');
    // Häuserreihe mit bemalten Fassaden und Erkern
    const yb = -48;
    bemalt(c, -196, yb, 54, 116, '#e9c46a', '#a0502f', 'orn', 1);
    bemalt(c, -142, yb, 60, 136, '#f3e6c6', '#8c452b', 'fach', 2);
    bemalt(c, -82, yb, 56, 124, '#e8a58f', '#a0502f', 'fresko', 3);
    bemalt(c, -26, yb, 66, 148, '#f1dcb0', '#94452b', 'fresko', 4);
    bemalt(c, 40, yb, 52, 118, '#8fc0b4', '#a0502f', 'orn', 5);
    bemalt(c, 92, yb, 58, 134, '#f4ead2', '#8c452b', 'fach', 6);
    bemalt(c, 150, yb, 48, 112, '#d3a0ae', '#a0502f', 'fresko', 7);
    erker(c, -66, -112, 26, 30, '#c9543a', '#b5532e');
    erker(c, -6, -110, 28, 32, '#3f7d8c', '#2f7a68');
    erker(c, 54, -100, 24, 28, '#d9a93b', '#b5532e');
    erker(c, 110, -116, 24, 28, '#a0443a', '#7d4a33');
    // Rhein und Brücke
    spiegel(c, 0, -44, 380, 42, '#e8c08a', 0.24, t);
    const BX = -212;
    const brW = 196;
    box(c, BX + 4, -32, brW, 8, '#d3cab6');
    box(c, BX + 4, -36, brW, 4, '#efe8d8');
    c.fillStyle = '#d3cab6';
    c.beginPath();
    c.rect(BX + 4, -26, brW, 26);
    c.fill();
    for (let i = 0; i < 4; i++) {
      c.save();
      c.beginPath();
      c.arc(BX + 34 + i * 48, -1, 20, PI, 0);
      c.closePath();
      c.fillStyle = grad(c, 0, -22, 0, 0, ['#316f80', '#5aa8b6']);
      c.fill();
      c.restore();
    }
    for (let x = BX + 8; x < BX + brW; x += 16) box(c, x, -44, 2.4, 9, '#8d8a80');
    box(c, BX + 4, -46, brW, 2.2, '#8d8a80');
    figur(c, -116, -36, 0.6, '#d6402f');
    // Schwimmendes Boot
    const b = Math.sin(t * 0.8) * 0.8;
    poly(c, [[66, -14 + b], [136, -14 + b], [126, -3 + b], [76, -3 + b]], '#8a5e34');
    box(c, 66, -15 + b, 70, 2.4, '#d9c08a');
  };

  L.arbon = (c, t) => {
    wasser(c, 211, -40, t);
    // Ufer rechts
    hill(c, [[-120, 0], [-96, -30], [40, -42], [170, -38], [212, 0]], grad(c, 0, -42, 0, 0, ['#a8c673', '#7ea552']));
    tree(c, 142, -34, 170, 'laub', t, 3);
    // Schlossbau: weiß mit roten Läden
    const wand = '#f6f1e6';
    const yb = -32;
    dach(c, -76, 142, -176, -254, 26, '#a35a3a', 6);
    for (let i = 0; i < 5; i++) gaube(c, -32 + i * 34, -190, 13, 11, '#f6f1e6', '#8a4326');
    for (let i = 0; i < 3; i++) gaube(c, -6 + i * 34, -220, 11, 9, '#f6f1e6', '#8a4326');
    box(c, -76, -176, 218, 176 + yb, wand);
    box(c, 96, -176, 46, 176 + yb, 'rgba(0,0,0,0.04)');
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 6; i++) {
        if (j === 2 && i === 1) continue;
        const x = -60 + i * 34;
        const y = -164 + j * 44;
        box(c, x - 7, y - 1, 6, 22, '#c23b2e');
        box(c, x + 11, y - 1, 6, 22, '#c23b2e');
        fenster(c, x, y, 10, 20, '#fbf7ea', '#58707f');
      }
    }
    bogen(c, -21, yb, 26, 38, '#5a4632');
    // Treppengiebel an der Stirnseite
    for (let i = 0; i < 6; i++) {
      box(c, lerp(148, 116, i / 6) - 7, -176 - (i + 1) * 13.2, 13, 14, '#f6f1e6');
    }
    // Mächtiger Quaderturm
    const x0 = -158;
    const x1 = -70;
    c.fillStyle = grad(c, x0, 0, x1, 0, ['#b3a68e', '#cfc3ab', '#9c8f77']);
    c.fillRect(x0, -268, x1 - x0, 268 + yb + 8);
    const r = rngOf(19);
    for (let j = 0; j < 22; j++) {
      const y = -268 + j * 11;
      let x = x0 - (j % 2 ? 8 : 0);
      while (x < x1) {
        const w = 14 + r() * 12;
        const a = Math.max(x, x0);
        const b = Math.min(x + w - 1.4, x1);
        if (b > a) {
          c.fillStyle = `rgba(${r() > 0.5 ? '255,245,225' : '70,55,35'},${0.06 + r() * 0.1})`;
          c.fillRect(a, y, b - a, 9.6);
        }
        x += w;
      }
    }
    c.fillStyle = 'rgba(60,45,28,0.2)';
    c.beginPath();
    for (let j = 1; j < 22; j++) c.rect(x0, -268 + j * 11 - 1.2, x1 - x0, 1.2);
    c.fill();
    dach(c, x0, x1, -268, -316, 40, '#9c5032', 5);
    line(c, [[(x0 + x1) / 2, -316], [(x0 + x1) / 2, -328]], '#4e4a44', 1.6);
    poly(c, [[(x0 + x1) / 2, -328], [(x0 + x1) / 2 + 10, -325], [(x0 + x1) / 2, -322]], '#c23b2e');
    bogen(c, -114, -218, 12, 24, '#3f4436');
    bogen(c, -132, -150, 10, 20, '#3f4436');
    bogen(c, -96, -100, 10, 20, '#3f4436');
    spiegel(c, -114, -22, 86, 22, '#a89a80', 0.3, t);
    // Stück alte Römermauer im Vordergrund
    const m = [[6, 0], [6, -28], [28, -36], [54, -30], [80, -40], [112, -36], [140, -44], [166, -34], [190, -24], [204, -10], [208, 0]];
    poly(c, m, grad(c, 0, -44, 0, 0, ['#c8b693', '#a6936f']));
    c.save();
    poly(c, m);
    c.clip();
    quader(c, 6, -44, 204, 44, 44, 46, 'rgba(70,50,28,0.2)');
    quader(c, 6, -44, 204, 44, 45, 18, 'rgba(255,245,220,0.3)');
    box(c, 6, -21, 204, 3.4, '#b5664a');
    box(c, 6, -16, 204, 2, '#c98064');
    box(c, 6, -8, 204, 3.4, '#b5664a');
    c.restore();
    busch(c, 152, -34, 7, '#7ea65c', 4);
    busch(c, 16, -28, 6, '#7ea65c', 5);
    // Segelboot auf dem See
    const sx = -192 + Math.sin(t * 0.1) * 6;
    c.save();
    c.translate(sx, -18 + Math.sin(t * 0.9) * 0.6);
    c.rotate(Math.sin(t * 1.1) * 0.02);
    poly(c, [[-13, 0], [13, 0], [9, 5], [-10, 5]], '#f7f3e8');
    box(c, -0.7, -32, 1.4, 32, '#6d5a42');
    poly(c, [[1, -31], [14, -3], [1, -3]], '#fff');
    c.restore();
  };

  // Rentier wie in das Geweih geritzt: grast mit gesenktem Kopf, Blick nach rechts.
  function rentier(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    const col = '#5a4630';
    c.strokeStyle = col;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = 1.5;
    c.beginPath();
    // Rücken und Kruppe
    c.moveTo(-42, -2);
    c.quadraticCurveTo(-46, -22, -34, -30);
    c.quadraticCurveTo(-12, -38, 8, -34);
    c.quadraticCurveTo(20, -32, 26, -24);
    // Hals gesenkt zum Kopf
    c.quadraticCurveTo(34, -12, 44, -2);
    c.quadraticCurveTo(50, 6, 54, 12);
    c.lineTo(50, 15);
    c.quadraticCurveTo(44, 12, 38, 7);
    c.quadraticCurveTo(30, 2, 22, -2);
    // Brust und Bauch
    c.quadraticCurveTo(18, 2, 14, 4);
    c.quadraticCurveTo(-12, 8, -30, 2);
    c.stroke();
    c.beginPath();
    // Beine
    c.moveTo(-40, -2);
    c.lineTo(-44, 14);
    c.lineTo(-40, 28);
    c.moveTo(-30, 2);
    c.lineTo(-29, 14);
    c.lineTo(-32, 28);
    c.moveTo(14, 4);
    c.lineTo(12, 16);
    c.lineTo(14, 28);
    c.moveTo(5, 5);
    c.lineTo(2, 16);
    c.lineTo(-2, 28);
    // Schwanz
    c.moveTo(-43, -24);
    c.lineTo(-50, -18);
    c.stroke();
    // Geweih ragt nach hinten oben
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(40, -8);
    c.quadraticCurveTo(30, -26, 36, -44);
    c.moveTo(35, -36);
    c.lineTo(26, -44);
    c.moveTo(34, -26);
    c.lineTo(24, -30);
    c.moveTo(36, -44);
    c.lineTo(44, -50);
    c.moveTo(36, -44);
    c.lineTo(30, -52);
    c.moveTo(44, -6);
    c.quadraticCurveTo(52, -20, 50, -34);
    c.moveTo(50, -24);
    c.lineTo(58, -30);
    c.moveTo(51, -32);
    c.lineTo(56, -38);
    c.stroke();
    // Fellstriche am Bauch
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const px = -26 + i * 3.6;
      c.moveTo(px, 2);
      c.lineTo(px - 2, -8);
    }
    for (let i = 0; i < 5; i++) {
      c.moveTo(24 + i * 3, -14 + i * 3);
      c.lineTo(28 + i * 3, -6 + i * 3);
    }
    c.stroke();
    ell(c, 47, 3, 1.3, 1.3, col);
    c.restore();
  }
  L.kesslerloch = (c, t) => {
    tree(c, -150, -170, 110, 'laub', t, 2);
    tree(c, -30, -206, 100, 'laub', t, 3);
    tree(c, 34, -130, 86, 'tanne', t, 7);
    const F = [[-212, 0], [-202, -86], [-160, -180], [-90, -226], [-14, -220], [54, -168], [84, -86], [100, 0]];
    hill(c, F, grad(c, 0, -226, 0, 0, ['#ded4bc', '#b6aa8e']));
    c.save();
    hill(c, F);
    c.clip();
    poly(c, [[-170, -160], [-120, -220], [-80, -170], [-120, -110]], 'rgba(255,250,235,0.32)');
    poly(c, [[-30, -210], [40, -170], [10, -120], [-50, -150]], 'rgba(255,250,235,0.24)');
    poly(c, [[30, -130], [90, -80], [90, 0], [50, 0], [40, -70]], 'rgba(70,55,35,0.16)');
    poly(c, [[-210, -80], [-160, -90], [-170, 0], [-212, 0]], 'rgba(70,55,35,0.12)');
    c.strokeStyle = 'rgba(70,55,35,0.2)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (const [a, b, d, e] of [[-190, -60, -140, -130], [-130, -170, -90, -130], [-60, -190, -20, -150], [20, -140, 56, -90], [-200, -30, -170, -90]]) {
      c.moveTo(a, b);
      c.lineTo(d, e);
    }
    c.stroke();
    c.restore();
    // Grün auf dem Fels
    busch(c, -180, -130, 18, '#5f9050', 3);
    busch(c, 62, -112, 18, '#5f9050', 4);
    // Weiter, niedriger Höhleneingang
    c.beginPath();
    c.moveTo(-154, 0);
    c.bezierCurveTo(-160, -60, -116, -116, -44, -118);
    c.bezierCurveTo(14, -118, 44, -60, 40, 0);
    c.closePath();
    c.fillStyle = grad(c, 0, -118, 0, 0, ['#2d241a', '#574631']);
    c.fill();
    c.fillStyle = grad(c, -154, 0, 40, 0, ['rgba(120,100,70,0.35)', 'rgba(0,0,0,0)', 'rgba(120,100,70,0.3)']);
    c.fill();
    poly(c, [[-160, 0], [-140, -22], [-60, -26], [10, -20], [44, 0]], grad(c, 0, -26, 0, 0, ['#8c7a5a', '#c4b28d']));
    ell(c, -108, -14, 28, 14, '#a79a80');
    ell(c, -112, -18, 18, 8, '#c0b49a');
    ell(c, -10, -8, 20, 8, '#a79a80');
    // Geritztes Bild auf einem großen Geweihstück
    c.save();
    c.translate(116, -146);
    c.rotate(-0.06);
    // Zinke
    c.beginPath();
    c.moveTo(62, -22);
    c.quadraticCurveTo(76, -54, 104, -66);
    c.quadraticCurveTo(84, -40, 84, -8);
    c.closePath();
    c.fillStyle = '#d9c9a4';
    c.fill();
    // Stange
    c.beginPath();
    c.moveTo(-100, -18);
    c.bezierCurveTo(-50, -44, 40, -46, 88, -30);
    c.quadraticCurveTo(104, 4, 92, 34);
    c.bezierCurveTo(40, 52, -50, 54, -96, 36);
    c.quadraticCurveTo(-112, 12, -100, -18);
    c.closePath();
    c.fillStyle = grad(c, 0, -46, 0, 52, ['#f1e6c9', '#dccba4']);
    c.fill();
    c.strokeStyle = 'rgba(120,95,55,0.25)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-94, -28 + 20);
    c.quadraticCurveTo(0, -38, 94, -14);
    c.moveTo(-94, 30);
    c.quadraticCurveTo(0, 46, 90, 26);
    c.stroke();
    // Bohrung des Lochstabs
    ell(c, -84, 10, 11, 15, '#8d7a55');
    ell(c, -84, 10, 7.6, 11.4, '#3a2f22');
    rentier(c, 8, 4, 1.02);
    c.restore();
    // Halterung aus Steinen
    line(c, [[62, -112], [54, -6]], '#7a5f3e', 7, 'butt');
    line(c, [[176, -112], [182, -6]], '#7a5f3e', 7, 'butt');
    ell(c, 56, -6, 16, 6, '#a79a80');
    ell(c, 182, -6, 16, 6, '#a79a80');
    flower(c, 130, -2, 14, '#e8c23a', t, 1);
    flower(c, 150, -2, 11, '#ffffff', t, 2);
  };

  L.rheinfall = (c, t) => {
    // Rechtes Ufer mit Schloss Laufen
    const R = [[-120, -120], [-40, -148], [30, -208], [90, -262], [160, -268], [204, -200], [212, -110], [214, 0], [-120, 0]];
    hill(c, R, grad(c, 0, -268, 0, -110, ['#6da05c', '#4f8a4c']));
    const sy = -258;
    box(c, 56, sy - 40, 92, 46, '#f2e8d2');
    dach(c, 56, 148, sy - 40, sy - 70, 8, '#8f4a30', 4);
    for (let i = 0; i < 3; i++) gaube(c, 78 + i * 24, sy - 46, 8, 7, '#f2e8d2', '#7a3e28');
    for (let j = 0; j < 2; j++) for (let i = 0; i < 5; i++) fenster(c, 64 + i * 16, sy - 32 + j * 15, 7, 10);
    box(c, 148, sy - 30, 38, 36, '#e9dec6');
    dach(c, 148, 186, sy - 30, sy - 50, 6, '#8f4a30', 3);
    box(c, 186, sy - 44, 12, 50, '#ddd3bc');
    poly(c, [[183, sy - 44], [201, sy - 44], [192, sy - 80]], '#7d3f2a');
    fahne(c, 46, sy + 4, 56, 'ch', t, 22);
    const gr = rngOf(9);
    const baum = ['#4f8a4c', '#5a964f', '#62a058', '#46804a'];
    for (let i = 0; i < 34; i++) {
      const x = -30 + gr() * 214;
      const tp = hoehe(R.slice(0, 8), x);
      const y = tp + 16 + gr() * Math.max(10, -tp - 160);
      ell(c, x, Math.min(y, -136), 14 + gr() * 9, 11 + gr() * 7, baum[i % 4]);
    }
    // Der Fluss kommt ruhig und grün an
    const kY = -142;
    poly(c, [[-206, kY - 14], [206, kY - 10], [212, kY + 8], [-212, kY + 8]], grad(c, 0, kY - 14, 0, kY + 8, ['#3fa6a8', '#7fd2cc']));
    glanz(c, 170, kY - 10, kY - 2, t, 3, 4, 0.5);
    // Breite Wasserwand: oben glasgrün, dann schäumend weiß
    c.fillStyle = grad(c, 0, kY, 0, -34, [[0, '#6ccbc6'], [0.14, '#bdecE8'], [0.36, '#f2fbfa'], [1, '#ffffff']]);
    c.fillRect(-212, kY, 424, -kY);
    // Bänder laufen im Strichmuster nach unten
    c.save();
    c.beginPath();
    c.rect(-212, kY + 1, 424, -kY - 30);
    c.clip();
    c.lineCap = 'round';
    for (const [col, w, a, b, v, dx] of [['rgba(84,178,186,0.3)', 4.6, 34, 40, 34, 0], ['rgba(130,204,210,0.4)', 3, 22, 54, 46, 9], ['rgba(50,150,160,0.2)', 2, 16, 62, 58, 4]]) {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.setLineDash([a, b]);
      c.lineDashOffset = -t * v;
      c.beginPath();
      for (let i = 0; i < 26; i++) {
        const x = -208 + i * 17 + dx;
        const y0 = kY - ((i * 37) % 70);
        c.moveTo(x, y0);
        c.bezierCurveTo(x + 2, y0 + 60, x - 3, -80, x + Math.sin(i * 1.7) * 5, -30);
      }
      c.stroke();
    }
    c.restore();
    // Schaumstufen brechen die Wand
    for (const [y, a, ph] of [[-104, 0.75, 0], [-72, 0.9, 2]]) {
      c.fillStyle = `rgba(255,255,255,${a})`;
      c.beginPath();
      for (let i = 0; i < 26; i++) {
        const x = -204 + i * 16.4 + Math.sin(i * 2.3 + ph) * 5;
        const q = 5 + ((i * 7) % 7) + Math.sin(t * 1.3 + i + ph) * 1;
        const yy = y + Math.sin(i * 1.1 + ph) * 5;
        c.moveTo(x + q, yy);
        c.arc(x, yy, q, 0, TAU);
      }
      c.fill();
    }
    // Felsnasen in der Wasserwand, Schaum drumherum
    for (const [x, y, w, h] of [[-128, -86, 11, 8], [62, -100, 13, 9], [150, -78, 12, 8]]) {
      poly(c, [[x - w, y + h], [x - w * 0.5, y - h * 0.5], [x + w * 0.1, y - h], [x + w * 0.7, y - h * 0.3], [x + w, y + h]], '#9c9182');
      poly(c, [[x - w * 0.4, y], [x + w * 0.1, y - h], [x + w * 0.25, y]], '#b5aa9b');
      ell(c, x, y + h, w * 1.25, h * 0.55, '#fff');
    }
    // Becken unten
    hill(c, [[-212, 0], [-208, -36], [-100, -46], [100, -44], [208, -36], [212, 0]], grad(c, 0, -46, 0, 0, ['#8fdcd8', '#2f8ea0']));
    glanz(c, 190, -22, -2, t, 6);
    // Fels in der Mitte, oben bewaldet
    const Fe = [[-100, -30], [-96, -80], [-84, -124], [-68, -152], [-40, -170], [-12, -166], [10, -140], [24, -96], [34, -30]];
    poly(c, Fe, grad(c, -100, 0, 34, 0, ['#8f8571', '#b3a78e', '#6e6452']));
    poly(c, [[-62, -142], [-30, -152], [-22, -92], [-44, -56], [-70, -92]], 'rgba(255,248,230,0.16)');
    poly(c, [[-8, -130], [20, -96], [28, -40], [-2, -60]], 'rgba(40,30,20,0.14)');
    c.strokeStyle = 'rgba(50,40,28,0.3)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-74, -110);
    c.lineTo(-50, -70);
    c.lineTo(-58, -40);
    c.moveTo(-20, -120);
    c.lineTo(-4, -76);
    c.moveTo(-88, -66);
    c.lineTo(-70, -48);
    c.stroke();
    busch(c, -64, -130, 20, '#4f8a4c', 3);
    busch(c, -14, -132, 19, '#62a058', 4);
    busch(c, -40, -152, 22, '#4f8a4c', 5);
    busch(c, 12, -100, 11, '#4f8a4c', 7);
    busch(c, -86, -82, 11, '#62a058', 6);
    fahne(c, -38, -172, 44, 'ch', t, 24);
    // Linkes Ufer, dunkel im Vordergrund
    hill(c, [[-214, 0], [-214, -176], [-184, -188], [-152, -130], [-142, -70], [-124, -26], [-94, 0]], grad(c, 0, -188, 0, 0, ['#5a9450', '#3f7a48']));
    busch(c, -188, -146, 24, '#4f8a4c', 7);
    busch(c, -168, -92, 22, '#5f9a55', 8);
    busch(c, -146, -34, 20, '#4f8a4c', 9);
    // Schaumkante am Fuß des Falls
    c.fillStyle = '#fff';
    c.beginPath();
    for (let i = 0; i < 38; i++) {
      const x = -202 + i * 11;
      const q = 7 + ((i * 5) % 6) + Math.sin(t * 1.4 + i * 1.3) * 1.3;
      const y = -38 + ((i * 3) % 5);
      c.moveTo(x + q, y);
      c.arc(x, y, q, 0, TAU);
    }
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    for (let i = 0; i < 26; i++) {
      const x = -204 + i * 16.4 + Math.sin(t * 0.5 + i) * 3;
      const q = 5 + ((i * 7) % 5);
      const y = -25 + ((i * 2) % 5);
      c.moveTo(x + q, y);
      c.arc(x, y, q, 0, TAU);
    }
    c.fill();
    // Weiche Gischt steigt auf
    for (let i = 0; i < 12; i++) {
      const u = (t * 0.1 + i / 12) % 1;
      const x = -176 + ((i * 67) % 360) + Math.sin(u * 5 + i) * 8;
      const y = -34 - u * 74;
      const q = 16 + u * 30;
      const a = 0.62 * (1 - u) * Math.min(1, u * 5 + 0.2);
      const g = c.createRadialGradient(x, y, 0, x, y, q);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, q, 0, TAU);
      c.fill();
    }
    // Wellen im Becken
    c.strokeStyle = 'rgba(255,255,255,0.65)';
    c.lineWidth = 1.6;
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const x = -170 + i * 48 + Math.sin(t * 0.5 + i) * 6;
      const y = -12 + (i % 3) * 3;
      c.moveTo(x - 12, y);
      c.quadraticCurveTo(x, y - 4, x + 12, y);
    }
    c.stroke();
  };

  // Kind auf Schlittschuhen, gleitet mit ausgebreiteten Armen.
  function laeufer(c, x, y, s, dir, jacke, muetze, t) {
    c.save();
    c.translate(x, y);
    c.scale(s * dir, s);
    c.rotate(0.14 + Math.sin(t * 0.8 + x) * 0.03);
    ell(c, -2, 1, 14, 2.2, 'rgba(70,110,140,0.2)');
    // Standbein, Spielbein nach hinten
    box(c, -1, -18, 5, 17, '#3a5168', 2);
    line(c, [[0, -16], [-13, -7]], '#3a5168', 5);
    line(c, [[-6, 0], [9, 0]], '#7b8a94', 1.8);
    box(c, -2, -3, 8, 3, '#f6f2e8', 1);
    line(c, [[-17, -3], [-7, -9]], '#7b8a94', 1.6);
    // Oberkörper und Arme
    box(c, -6, -36, 13, 20, jacke, 5);
    line(c, [[-2, -32], [-15, -26]], jacke, 4.4);
    line(c, [[3, -32], [16, -30]], jacke, 4.4);
    ell(c, -16, -25.5, 2.3, 2.3, muetze);
    ell(c, 17.5, -29.5, 2.3, 2.3, muetze);
    // Schal weht nach hinten
    const w = Math.sin(t * 3 + x) * 1.6;
    poly(c, [[-5, -36], [6, -36], [5, -32], [-4, -32]], muetze);
    poly(c, [[-4, -35], [-15, -32 + w], [-14, -28 + w], [-4, -32]], muetze);
    ell(c, 1, -41.5, 6, 6.2, '#f6d4b4');
    c.beginPath();
    c.arc(1, -43, 6.3, PI, 0);
    c.closePath();
    c.fillStyle = muetze;
    c.fill();
    ell(c, 1, -50, 2.4, 2.4, '#fff');
    ell(c, 4, -41.5, 0.9, 1, '#28231d');
    c.beginPath();
    c.arc(3, -39, 1.8, 0.2, PI - 0.6);
    c.strokeStyle = '#a4593e';
    c.lineWidth = 0.8;
    c.stroke();
    c.restore();
  }
  L.seegfroerne = (c, t) => {
    fern(c, [[-190, -104], [-150, -150], [-70, -128], [20, -178], [110, -136], [170, -152], [196, -104]], '#d5e3ea', -138);
    // Verschneites Ufer mit Dorf und Kirche
    hill(c, [[-212, -92], [-170, -116], [-60, -122], [80, -120], [170, -114], [212, -92]], '#f2f6f8');
    for (const [x, w, h] of [[-168, 26, 18], [-138, 24, 16], [-82, 22, 15]]) {
      box(c, x, -112 - h, w, h, '#e7d8c0');
      poly(c, [[x - 3, -112 - h], [x + w + 3, -112 - h], [x + w / 2, -112 - h - w * 0.45]], '#f7fafc');
      box(c, x + w * 0.35, -112 - h * 0.7, 6, 6, '#6f8fa2');
    }
    box(c, -114, -158, 18, 46, '#efe6d4');
    poly(c, [[-117, -158], [-93, -158], [-105, -186]], '#a9554a');
    line(c, [[-105, -186], [-105, -194]], '#6a665e', 1.4);
    box(c, -96, -132, 34, 20, '#efe6d4');
    poly(c, [[-98, -132], [-60, -132], [-68, -144], [-96, -144]], '#f7fafc');
    tree(c, 96, -112, 40, 'tanne', t, 5);
    tree(c, 118, -112, 52, 'tanne', t, 6);
    tree(c, 144, -112, 38, 'tanne', t, 8);
    // Spitze Schneekappen auf den Tannen
    for (const [x, h] of [[96, 40], [118, 52], [144, 38]]) poly(c, [[x - h * 0.1, -112 - h * 0.82], [x + h * 0.1, -112 - h * 0.82], [x, -112 - h * 0.92]], '#fff');
    // Eisfläche
    c.beginPath();
    c.moveTo(-212, 0);
    c.bezierCurveTo(-205, -70, -190, -110, -150, -112);
    c.lineTo(150, -112);
    c.bezierCurveTo(190, -110, 205, -70, 212, 0);
    c.closePath();
    c.fillStyle = grad(c, 0, -112, 0, 0, ['#e6f5fa', '#a9d6e6']);
    c.fill();
    // Spuren und Risse im Eis
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(-170, -14);
    c.bezierCurveTo(-120, -44, -70, 6, -10, -24);
    c.moveTo(20, -8);
    c.bezierCurveTo(70, -36, 120, -6, 176, -30);
    c.moveTo(-120, -92);
    c.bezierCurveTo(-60, -104, 10, -84, 90, -100);
    c.stroke();
    c.strokeStyle = 'rgba(90,150,180,0.35)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-170, -70);
    c.lineTo(-120, -60);
    c.lineTo(-90, -68);
    c.moveTo(120, -74);
    c.lineTo(150, -64);
    c.lineTo(190, -66);
    c.stroke();
    // Prozession mit der Büste
    const dx = Math.sin(t * 0.06) * 8;
    const px = 16 + dx;
    const py = -66;
    const lauf = (i) => Math.sin(t * 1.4 + i) * 0.5;
    figur(c, px - 94, py + lauf(0), 0.68, '#7a4a9a', '#33404f');
    line(c, [[px - 89, py - 34], [px - 89, py - 2]], '#8a6642', 1.6);
    box(c, px - 89, py - 40, 12, 9, '#d8402f');
    box(c, px - 89, py - 37, 12, 3, '#ffe27a');
    figur(c, px - 70, py + lauf(1), 0.68, '#2f6f8a', '#33404f', '#2f3a44');
    figur(c, px - 50, py + lauf(2), 0.68, '#c5503c', '#33404f');
    // Vier Träger mit Trage
    for (const [q, col] of [[-26, '#46618a'], [-8, '#8a5a3a'], [10, '#46618a'], [28, '#8a5a3a']]) figur(c, px + q, py + lauf(q), 0.72, col, '#33404f', '#2f3a44');
    const ty = py - 24 + Math.sin(t * 1.4) * 0.5;
    box(c, px - 36, ty, 74, 4, '#7a5a3a', 1);
    box(c, px - 14, ty - 5, 30, 5, '#c79a3a', 1);
    // Die Büste: Goldglanz, schlichtes Gesicht, Heiligenschein
    c.save();
    c.translate(px + 1, ty - 5);
    c.scale(1.4, 1.4);
    ell(c, 0, -19, 11, 11, 'rgba(255,226,120,0.6)');
    poly(c, [[-11, 0], [11, 0], [7, -12], [-7, -12]], grad(c, -11, 0, 11, 0, ['#d9a93b', '#f7dc7c', '#c08b2a']));
    box(c, -2.6, -15, 5.2, 4, '#e6bd58');
    ell(c, 0, -19, 5.4, 6, '#f2d27a');
    ell(c, 2, -20, 0.8, 0.9, '#7a5a20');
    c.beginPath();
    c.arc(0, -22, 5.5, PI, 0);
    c.closePath();
    c.fillStyle = '#c79a3a';
    c.fill();
    c.restore();
    for (const [q, col] of [[52, '#3f8a6a'], [70, '#b5533c']]) figur(c, px + q, py + lauf(q), 0.66, col, '#33404f');
    // Kinder auf Schlittschuhen
    const a = -128 + Math.sin(t * 0.21) * 22;
    const b = 112 + Math.sin(t * 0.17 + 1) * 26;
    const d1 = Math.cos(t * 0.21) >= 0 ? 1 : -1;
    const d2 = Math.cos(t * 0.17 + 1) >= 0 ? 1 : -1;
    laeufer(c, a, -12, 1, d1, '#d6402f', '#3f7fc4', t);
    laeufer(c, b, -8, 1.06, d2, '#ffd23f', '#d6402f', t);
    laeufer(c, -28 + Math.sin(t * 0.13) * 20, -22, 0.82, 1, '#3f8a6a', '#f28ab2', t);
    // Schneemann am Rand
    ell(c, 176, -10, 16, 13, '#fbfdff');
    ell(c, 176, -30, 11, 10, '#fff');
    ell(c, 179, -32, 1, 1, '#28231d');
    poly(c, [[181, -29], [190, -28], [181, -27]], '#e9852f');
    box(c, 168, -46, 16, 5, '#3f3a33');
    box(c, 171, -54, 10, 9, '#3f3a33');
    // Vereinzelte Flocken
    const r = rngOf(3);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const x = -200 + r() * 400 + Math.sin(t * 0.5 + i) * 6;
      const y = -((t * 7 + r() * 300) % 300);
      c.moveTo(x + 1.5, y);
      c.arc(x, y, 1.5, 0, TAU);
    }
    c.fill();
  };

  function traube(c, x, y, s) {
    const col = ['#5b2f6e', '#6d3a82'];
    for (let j = 0; j < 4; j++) {
      const n = 4 - j;
      for (let i = 0; i < n; i++) {
        ell(c, x + (i - (n - 1) / 2) * 3.8 * s, y + j * 3.4 * s, 2.3 * s, 2.3 * s, col[(i + j) % 2]);
      }
    }
    ell(c, x - 1.6 * s, y + 0.2 * s, 0.7 * s, 0.7 * s, 'rgba(255,255,255,0.6)');
    line(c, [[x, y - 1], [x + 1, y - 5 * s]], '#6a5a32', 1);
  }
  // Rebzeile quer im Bild: durchgehende Laubwand mit Buckeln.
  function rebzeile(c, pts, w, d, col0, col1) {
    c.save();
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = w * 0.8;
    c.strokeStyle = col0;
    c.stroke();
    c.setLineDash([0.1, d * 0.62, 0.1, d]);
    c.lineWidth = w;
    c.stroke();
    c.setLineDash([0.1, d * 0.9, 0.1, d * 0.7]);
    c.lineDashOffset = d * 0.4;
    c.lineWidth = w * 0.58;
    c.strokeStyle = col1;
    c.stroke();
    c.restore();
  }
  // Rebzeile in Fluchtrichtung: oben schmal, unten breit, mit Trauben.
  function zeile(c, x0, y0, x1, y1, w0, w1, seed) {
    const r = rngOf(seed * 13);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    poly(c, [[x0 + nx * w0 * 0.5, y0 + ny * w0 * 0.5], [x1 + nx * w1 * 0.5, y1 + ny * w1 * 0.5], [x1 - nx * w1 * 0.5, y1 - ny * w1 * 0.5], [x0 - nx * w0 * 0.5, y0 - ny * w0 * 0.5]], '#4f8a3f');
    const steps = Math.max(5, Math.round(l / 22));
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * (i / steps) * 0.3 + (i / steps) * 0.7;
      const x = lerp(x0, x1, u);
      const y = lerp(y0, y1, u);
      const w = lerp(w0, w1, u);
      ell(c, x + (r() - 0.5) * w * 0.3, y, w * 0.66, w * 0.54, i % 2 ? '#5f9a4a' : '#79b058');
      if (r() < 0.55) ell(c, x + (r() - 0.5) * w * 0.8, y + w * 0.16, w * 0.17, w * 0.17, '#5b2f6e');
    }
  }
  const WB_H = [[-212, 0], [-168, -40], [-70, -142], [16, -228], [70, -256], [128, -234], [184, -110], [212, 0]];
  L.weinberg = (c, t) => {
    hill(c, WB_H, grad(c, 0, -256, 0, 0, ['#a6c56c', '#7ea652']));
    // Rebzeilen laufen in der Falllinie den Hang hinab
    c.save();
    hill(c, WB_H);
    c.clip();
    for (let k = -8; k <= 8; k++) {
      zeile(c, 70 + k * 7, -226 + Math.abs(k) * 9, 6 + k * 30, 6, 3, 17, k + 20);
    }
    c.restore();
    // Kleine Kapelle oben
    const kx = 70;
    const ky = -244;
    box(c, kx - 21, ky - 34, 42, 36, '#fbf6ea');
    box(c, kx + 12, ky - 34, 9, 36, 'rgba(0,0,0,0.06)');
    poly(c, [[kx - 25, ky - 34], [kx + 25, ky - 34], [kx, ky - 62]], '#b5532e');
    poly(c, [[kx, ky - 62], [kx + 25, ky - 34], [kx + 8, ky - 34]], 'rgba(0,0,0,0.13)');
    bogen(c, kx, ky + 2, 12, 22, '#6a4a30');
    bogen(c, kx, ky - 40, 7, 11, '#5d8697');
    box(c, kx - 3, ky - 72, 6, 12, '#fbf6ea');
    poly(c, [[kx - 5, ky - 72], [kx + 5, ky - 72], [kx, ky - 84]], '#8f4228');
    line(c, [[kx, ky - 84], [kx, ky - 92]], '#5a564e', 1.4);
    line(c, [[kx - 2.6, ky - 89], [kx + 2.6, ky - 89]], '#5a564e', 1.4);
    // Reben im Vordergrund
    const reb = (x, y) => {
      line(c, [[x, y], [x, y - 44]], '#8a6642', 2.6);
      line(c, [[x - 28, y - 30], [x + 28, y - 30]], '#a58a5a', 1);
      busch(c, x, y - 18, 17, '#5f9a4a', x + 300);
      traube(c, x - 9, y - 16, 1.15);
      traube(c, x + 9, y - 13, 1.25);
      traube(c, x, y - 7, 1);
    };
    reb(-150, -4);
    reb(-92, -4);
    reb(-34, -4);
    // Holzbottich mit Trauben
    const bx = 130;
    const by = -2;
    for (let j = 0; j < 7; j++) {
      const q = j / 6;
      ell(c, bx - 26 + q * 52, by - 40 - Math.sin(q * PI) * 8, 8, 7, j % 2 ? '#5b2f6e' : '#6d3a82');
    }
    for (let j = 0; j < 5; j++) ell(c, bx - 18 + j * 9, by - 48, 5, 5, j % 2 ? '#7a4592' : '#5b2f6e');
    poly(c, [[bx - 34, by - 42], [bx + 34, by - 42], [bx + 28, by], [bx - 28, by]], grad(c, bx - 34, 0, bx + 34, 0, ['#8a5e34', '#b98a54', '#7a5230']));
    c.strokeStyle = 'rgba(60,35,15,0.4)';
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = -3; i <= 3; i++) {
      c.moveTo(bx + i * 9.2, by - 42);
      c.lineTo(bx + i * 7.8, by);
    }
    c.stroke();
    box(c, bx - 33.5, by - 34, 67, 4, '#6f7478');
    box(c, bx - 30, by - 12, 60, 4, '#6f7478');
    // Griffe
    box(c, bx - 40, by - 38, 7, 4, '#6a4a2a', 1);
    box(c, bx + 33, by - 38, 7, 4, '#6a4a2a', 1);
    traube(c, bx + 44, by - 16, 1.3);
    falter(c, -10 + Math.sin(t * 0.3) * 20, -70 + Math.sin(t * 0.47) * 10, 1.1, t, '#fff4c8');
  };

  L.apfelgarten = (c, t) => {
    hill(c, [[-212, 0], [-196, -46], [-90, -66], [80, -68], [196, -48], [212, 0]], grad(c, 0, -68, 0, 0, ['#add078', '#83b458']));
    // Hintere Baumreihe
    for (const [x, y, h, s] of [[-146, -50, 128, 11], [-58, -56, 146, 12], [60, -56, 140, 13], [150, -50, 130, 14]]) tree(c, x, y, h, 'apfel', t, s);
    // Vordere Baumreihe
    tree(c, -130, -14, 196, 'apfel', t, 3);
    tree(c, -6, -14, 226, 'apfel', t, 4);
    tree(c, 132, -14, 200, 'apfel', t, 5);
    // Zusätzliche Früchte in den großen Kronen
    const r = rngOf(12);
    for (const [x, y, h] of [[-130, -14, 196], [-6, -14, 226], [132, -14, 200]]) {
      for (let i = 0; i < 8; i++) {
        const ax = x + (r() - 0.5) * h * 0.5;
        const ay = y - h * (0.58 + r() * 0.3);
        ell(c, ax, ay, 4.4, 4.4, i % 3 ? '#d8402f' : '#e8a02f');
        ell(c, ax - 1.3, ay - 1.3, 1.2, 1.2, 'rgba(255,255,255,0.55)');
      }
    }
    // Leiter lehnt am Baum
    const A = [18, -4];
    const B = [52, -148];
    const off = 15;
    c.save();
    line(c, [A, B], '#9a7040', 4, 'butt');
    line(c, [[A[0] + off, A[1]], [B[0] + off * 0.78, B[1]]], '#9a7040', 4, 'butt');
    for (let i = 1; i < 9; i++) {
      const u = i / 9;
      const x = lerp(A[0], B[0], u);
      const y = lerp(A[1], B[1], u);
      line(c, [[x, y], [x + lerp(off, off * 0.78, u), y]], '#b98a54', 3, 'butt');
    }
    c.restore();
    // Korb voll Äpfel
    const kx = 86;
    const ky = -3;
    ell(c, kx, ky + 1, 40, 5, 'rgba(0,0,0,0.13)');
    const apf = [[-22, -38], [-8, -40], [8, -40], [22, -37], [-14, -48], [2, -50], [16, -47], [-4, -58]];
    apf.forEach(([x, y], i) => {
      ell(c, kx + x, ky + y, 10.5, 10, i % 3 === 1 ? '#e8a02f' : i % 3 === 2 ? '#c8342a' : '#d8402f');
      ell(c, kx + x - 3, ky + y - 3.4, 2.6, 2.2, 'rgba(255,255,255,0.5)');
      line(c, [[kx + x, ky + y - 9], [kx + x + 1.6, ky + y - 13]], '#5a4128', 1.4);
    });
    c.beginPath();
    c.moveTo(kx - 38, ky - 36);
    c.lineTo(kx - 28, ky);
    c.lineTo(kx + 28, ky);
    c.lineTo(kx + 38, ky - 36);
    c.quadraticCurveTo(kx, ky - 24, kx - 38, ky - 36);
    c.closePath();
    c.fillStyle = grad(c, kx - 38, 0, kx + 38, 0, ['#a87a42', '#d3a768', '#94693a']);
    c.fill();
    c.strokeStyle = 'rgba(90,55,20,0.42)';
    c.lineWidth = 1;
    c.beginPath();
    for (let j = 1; j < 5; j++) {
      const y = ky - 34 + j * 7;
      const hw = lerp(37, 28, j / 5);
      c.moveTo(kx - hw, y);
      c.quadraticCurveTo(kx, y + 8 - j, kx + hw, y);
    }
    for (let i = -4; i <= 4; i++) {
      c.moveTo(kx + i * 8.2, ky - 30);
      c.lineTo(kx + i * 6.2, ky);
    }
    c.stroke();
    c.beginPath();
    c.moveTo(kx - 38, ky - 36);
    c.quadraticCurveTo(kx, ky - 24, kx + 38, ky - 36);
    c.strokeStyle = '#8a5e30';
    c.lineWidth = 3.4;
    c.stroke();
    // Fallobst im Gras
    for (const [x, y, col] of [[-90, -8, '#d8402f'], [-68, -4, '#e8a02f'], [136, -6, '#d8402f'], [-124, -16, '#c8342a'], [186, -8, '#e8a02f'], [40, -2, '#d8402f']]) {
      ell(c, x, y, 5, 4.8, col);
      ell(c, x - 1.5, y - 1.6, 1.2, 1, 'rgba(255,255,255,0.5)');
    }
  };

  L.hafen_faehre = (c, t) => {
    fern(c, [[-186, -116], [-140, -152], [-40, -134], [60, -166], [150, -134], [186, -116]], '#c5d9c8');
    wasser(c, 211, -118, t);
    // Passagierschiff weiter hinten
    const b1 = Math.sin(t * 0.7) * 0.8;
    c.save();
    c.translate(52, -72 + b1);
    c.rotate(Math.sin(t * 0.5) * 0.004);
    poly(c, [[-108, -22], [132, -22], [150, -32], [126, 6], [-98, 6]], grad(c, 0, -32, 0, 6, ['#ffffff', '#d7e1e6']));
    box(c, -102, -4, 228, 3, '#2b7fc0');
    box(c, -88, -46, 186, 24, '#fafcfc');
    box(c, -74, -68, 150, 22, '#f3f6f7');
    box(c, -52, -86, 76, 18, '#eef2f4');
    box(c, -92, -49, 194, 3, '#c9d2d6');
    box(c, -78, -70, 158, 3, '#c9d2d6');
    for (let i = 0; i < 15; i++) box(c, -80 + i * 12, -40, 8, 11, '#4f7486');
    for (let i = 0; i < 11; i++) box(c, -66 + i * 12.6, -62, 8, 10, '#4f7486');
    for (let i = 0; i < 5; i++) box(c, -46 + i * 14, -82, 9, 9, '#4f7486');
    box(c, -22, -106, 16, 20, '#d6402f', 1);
    box(c, -22, -106, 16, 5, '#2f3a44', 1);
    line(c, [[56, -68], [56, -104]], '#8d8a80', 1.6);
    c.restore();
    spiegel(c, 52, -66, 200, 28, '#ffffff', 0.3, t);
    // Mole mit Laterne
    box(c, 118, -56, 96, 12, '#a8a194');
    box(c, 118, -59, 96, 4, '#c6bfb0');
    for (let x = 124; x < 212; x += 22) box(c, x, -44, 4, 12, '#5d4a34');
    box(c, 178, -96, 3.4, 38, '#4e565c');
    ell(c, 179.7, -100, 5.5, 6, '#ffe9a0');
    box(c, 174, -106, 11.4, 2.6, '#4e565c');
    // Große weiße Autofähre
    const b2 = Math.sin(t * 0.85 + 1) * 1;
    c.save();
    c.translate(-36, -22 + b2);
    c.rotate(Math.sin(t * 0.6) * 0.006);
    // Rumpf mit Rampen an beiden Enden
    poly(c, [[-152, -14], [146, -14], [166, -28], [172, -22], [146, 12], [-146, 12], [-172, -22], [-166, -28]], grad(c, 0, -28, 0, 12, ['#ffffff', '#c8d4da']));
    box(c, -148, 2, 296, 4, '#2b7fc0');
    box(c, -150, -16, 300, 3, '#8ea0aa');
    // Autodeck
    box(c, -132, -44, 264, 28, '#e7ecef');
    box(c, -132, -44, 264, 3, '#fff');
    for (let i = 0; i < 9; i++) box(c, -128 + i * 30, -38, 3, 22, '#c0ccd2');
    const auto = (x, col) => {
      box(c, x, -26, 34, 10, col, 3);
      c.beginPath();
      c.moveTo(x + 6, -26);
      c.lineTo(x + 11, -34);
      c.lineTo(x + 25, -34);
      c.lineTo(x + 30, -26);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      box(c, x + 12, -32.4, 5.4, 6, '#b8d4de');
      box(c, x + 19, -32.4, 5.4, 6, '#b8d4de');
      ell(c, x + 8, -15.5, 3.4, 3.4, '#2a2622');
      ell(c, x + 26, -15.5, 3.4, 3.4, '#2a2622');
    };
    auto(-118, '#d6402f');
    auto(-72, '#ffd23f');
    auto(38, '#3f7fc4');
    auto(82, '#5fa05a');
    // Oberdeck, Brücke quer drüber
    box(c, -60, -66, 120, 22, '#fbfcfc');
    box(c, -64, -68, 128, 3, '#c9d2d6');
    for (let i = 0; i < 9; i++) box(c, -54 + i * 12.2, -61, 8.4, 10, '#4f7486');
    box(c, -30, -88, 60, 20, '#ffffff');
    box(c, -34, -91, 68, 4, '#2b7fc0');
    box(c, -26, -83, 52, 9, '#3f6175');
    box(c, -26, -83, 52, 3, 'rgba(255,255,255,0.25)');
    box(c, 42, -82, 12, 16, '#2b7fc0', 1);
    box(c, 42, -82, 12, 4, '#2f3a44', 1);
    line(c, [[-46, -66], [-46, -96]], '#8d8a80', 1.6);
    fahne(c, -46, -76, 22, 'de', t, 16);
    c.restore();
    spiegel(c, -36, -8, 280, 8, '#ffffff', 0.32, t);
    // Möwen
    bird(c, 90 + Math.sin(t * 0.21) * 34, -210 + Math.sin(t * 0.33) * 8, 15, t * 0.42, '#fff');
    bird(c, -70 + Math.sin(t * 0.17 + 1) * 40, -232 + Math.sin(t * 0.29) * 7, 18, t * 0.36, '#fff');
    bird(c, 16 + Math.sin(t * 0.25 + 2) * 24, -186, 11, t * 0.46, '#fff');
    // Sitzende Möwe auf der Laterne
    ell(c, 180, -110, 6, 3.4, '#fff');
    ell(c, 184, -113, 2.6, 2.4, '#fff');
    poly(c, [[186, -113.5], [190, -113], [186, -112]], '#e8b52a');
  };

  L.schloss_montfort = (c, t) => {
    wasser(c, 211, -46, t);
    // Große Bäume hinter der Terrasse
    tree(c, 138, -80, 170, 'laub', t, 3);
    tree(c, -186, -70, 130, 'pappel', t, 5);
    // Steinkai im Wasser
    poly(c, [[-180, -18], [-176, -62], [178, -62], [188, -18]], grad(c, 0, -62, 0, -18, ['#cbbf9f', '#9c8f72']));
    quader(c, -176, -60, 352, 40, 12, 34, 'rgba(60,46,28,0.14)');
    box(c, -180, -66, 362, 5, '#dbd0b2');
    spiegel(c, -30, -16, 230, 16, '#e6c39a', 0.38, t);
    const streifen = (x, y, w, h, s, a, b) => {
      box(c, x, y, w, h, a);
      c.fillStyle = b;
      c.beginPath();
      for (let q = y + s; q < y + h; q += s * 2) c.rect(x, q, w, s);
      c.fill();
    };
    const gelb = '#efcf8e';
    const rot = '#c9663e';
    // Hoher Turm: rot-gelb gebändert, Zinnenkranz und kleine Kuppel
    const X = -30;
    streifen(X - 26, -306, 52, 186, 5, gelb, rot);
    rund(c, X - 26, -306, 52, 186);
    for (const k of [-11, 0, 11]) {
      bogen(c, X + k, -252, 8, 26, '#2f3c44');
    }
    bogen(c, X, -190, 11, 26, '#2f3c44');
    // Kragkranz
    box(c, X - 31, -318, 62, 12, '#d9b77c');
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.arc(X - 27 + i * 9, -306, 4.5, 0, PI);
      c.closePath();
      c.fillStyle = '#b75f3a';
      c.fill();
    }
    zinnen(c, X - 31, -318, 62, 7, 5, '#cda66c');
    // Kuppel
    c.beginPath();
    c.moveTo(X - 15, -320);
    c.quadraticCurveTo(X - 15, -334, X, -340);
    c.quadraticCurveTo(X + 15, -334, X + 15, -320);
    c.closePath();
    c.fillStyle = grad(c, X - 15, 0, X + 15, 0, ['#6fb0a0', '#3f8a7d']);
    c.fill();
    // Ecktürmchen am Turm
    for (const s of [-1, 1]) {
      box(c, X + s * 31 - 5, -320, 10, 22, '#e3c289');
      zinnen(c, X + s * 31 - 6, -320, 12, 2, 4, '#cda66c');
      poly(c, [[X + s * 31 - 5, -298], [X + s * 31 + 5, -298], [X + s * 28, -288]], '#b75f3a');
    }
    // Hauptbau mit Maurenbögen
    const hx0 = -146;
    const hx1 = 86;
    streifen(hx0, -176, hx1 - hx0, 110, 6, gelb, '#e3ae73');
    box(c, hx0 - 4, -182, hx1 - hx0 + 8, 6, '#d8bd8a');
    zinnen(c, hx0 - 4, -182, hx1 - hx0 + 8, 19, 5, '#cda66c');
    box(c, hx0, -128, hx1 - hx0, 4, rot);
    const mauren = (cx, by, w, h) => {
      // Hufeisenbogen
      const r = w / 2;
      c.beginPath();
      c.moveTo(cx - r * 0.82, by);
      c.lineTo(cx - r * 0.82, by - h + r * 1.35);
      c.bezierCurveTo(cx - r * 1.28, by - h + r * 0.55, cx - r * 0.4, by - h + r * 0.26, cx, by - h);
      c.bezierCurveTo(cx + r * 0.4, by - h + r * 0.26, cx + r * 1.28, by - h + r * 0.55, cx + r * 0.82, by - h + r * 1.35);
      c.lineTo(cx + r * 0.82, by);
      c.closePath();
    };
    for (let j = 0; j < 2; j++) {
      const by = j ? -74 : -134;
      for (let i = 0; i < 9; i++) {
        const cx = hx0 + 16 + (i * (hx1 - hx0 - 32)) / 8;
        mauren(cx, by, 20, 38);
        c.fillStyle = '#b75f3a';
        c.fill();
        mauren(cx, by, 13, 32);
        c.fillStyle = '#34505c';
        c.fill();
      }
    }
    // Mittelrisalit mit Terrasse
    streifen(-60, -194, 60, 128, 5, '#f4d9a0', rot);
    zinnen(c, -60, -194, 60, 6, 5, '#cda66c');
    mauren(-30, -74, 30, 54);
    c.fillStyle = '#b75f3a';
    c.fill();
    mauren(-30, -74, 22, 46);
    c.fillStyle = '#34505c';
    c.fill();
    mauren(-30, -134, 26, 44);
    c.fillStyle = '#b75f3a';
    c.fill();
    mauren(-30, -134, 18, 38);
    c.fillStyle = '#34505c';
    c.fill();
    // Niedrige Eckpavillons
    for (const px of [hx0 - 14, hx1 - 14]) {
      streifen(px, -196, 28, 130, 5, gelb, rot);
      zinnen(c, px - 2, -196, 32, 3, 5, '#cda66c');
      mauren(px + 14, -100, 16, 36);
      c.fillStyle = '#34505c';
      c.fill();
      mauren(px + 14, -146, 16, 36);
      c.fillStyle = '#34505c';
      c.fill();
    }
    // Terrasse mit Sonnenschirmen rechts
    box(c, 100, -72, 70, 3, '#8d7a5a');
    for (const [x, col] of [[118, '#d6402f'], [150, '#fff4d0']]) {
      box(c, x - 1, -94, 2, 24, '#6a5a42');
      poly(c, [[x - 14, -92], [x + 14, -92], [x, -104]], col);
    }
    busch(c, 176, -66, 16, '#5a9050', 6);
  };

  L.kornhaus = (c, t) => {
    wasser(c, 211, -44, t);
    box(c, -200, -56, 400, 18, '#a8a194');
    box(c, -200, -60, 400, 5, '#c6bfb0');
    for (let x = -192; x < 200; x += 28) box(c, x, -38, 4, 12, '#5d4a34');
    spiegel(c, 0, -34, 340, 32, '#fbf7ea', 0.42, t);
    const wand = '#f7f3e8';
    const pil = '#c5b895';
    const roof = '#a0583c';
    const yb = -58;
    const x0 = -190;
    const x1 = 190;
    // Großes Walmdach
    dach(c, x0, x1, -210, -282, 60, roof, 8);
    box(c, x0 - 4, -214, x1 - x0 + 8, 6, '#ece4d0');
    for (const x of [-120, -86, 86, 120]) gaube(c, x, -224, 12, 12, '#f7f3e8', '#7d4530');
    for (const x of [-96, 96]) gaube(c, x, -252, 10, 9, '#f7f3e8', '#7d4530');
    box(c, x0, -210, x1 - x0, 210 + yb, wand);
    // Lisenen und Gurtgesimse
    for (let i = 0; i <= 10; i++) {
      const px = x0 + (i * (x1 - x0 - 10)) / 10;
      box(c, px, -210, 10, 210 + yb, pil);
    }
    box(c, x0, -166, x1 - x0, 4, pil);
    box(c, x0, -122, x1 - x0, 4, pil);
    box(c, x0, -84, x1 - x0, 4, pil);
    // Vier Geschosse Fenster
    for (let j = 0; j < 4; j++) {
      const y = [-202, -156, -112, -78][j];
      const h = [26, 26, 24, 14][j];
      for (let i = 0; i < 10; i++) {
        if (i === 4 || i === 5) continue;
        const px = x0 + 10 + (i + 0.5) * ((x1 - x0 - 10) / 10) - 8;
        fenster(c, px, y, 12, h, '#fff', '#4d7183');
      }
    }
    // Mittelrisalit mit Giebel und Krone
    const m0 = -52;
    const m1 = 52;
    box(c, m0, -218, m1 - m0, 218 + yb, '#fbf8ef');
    for (const px of [m0, m1 - 10]) box(c, px, -218, 10, 218 + yb, pil);
    poly(c, [[m0 - 8, -218], [m1 + 8, -218], [0, -270]], '#efe7d3');
    poly(c, [[m0 + 4, -222], [m1 - 4, -222], [0, -264]], '#fbf8ef');
    line(c, [[m0 - 8, -218], [0, -270], [m1 + 8, -218]], pil, 3.5);
    box(c, m0 - 8, -222, m1 - m0 + 16, 4, pil);
    ell(c, 0, -238, 8, 8, '#c5b895');
    ell(c, 0, -238, 5.4, 5.4, '#4d7183');
    // Kleines Krönchen über dem Giebel
    box(c, -14, -298, 28, 30, '#f7f3e8');
    poly(c, [[-18, -298], [18, -298], [0, -320]], roof);
    box(c, -6, -292, 12, 18, '#4d7183');
    line(c, [[0, -320], [0, -332]], '#d9b64a', 1.8);
    ell(c, 0, -334, 2.4, 2.4, '#e8c55a');
    for (const x of [-130, 130]) {
      line(c, [[x, -282], [x, -294]], '#6a665e', 2);
      ell(c, x, -296, 3, 3, '#e8c55a');
    }
    for (let j = 0; j < 3; j++) {
      const y = [-206, -158, -114][j];
      for (const px of [-32, -6, 20]) fenster(c, px, y, 12, 26, '#fff', '#4d7183');
    }
    // Rundbogentor
    bogen(c, 0, yb, 40, 40, pil);
    bogen(c, 0, yb, 30, 34, '#54402c');
    box(c, -0.8, yb - 30, 1.6, 30, '#3a2c1e');
    fenster(c, -42, -82, 10, 16, '#fff', '#4d7183');
    fenster(c, 32, -82, 10, 16, '#fff', '#4d7183');
    // Boote im Hafen
    const boot = (x, y, ph) => {
      const b = Math.sin(t * 0.9 + ph) * 0.8;
      poly(c, [[x - 28, y + b], [x + 30, y + b], [x + 22, y + 11 + b], [x - 22, y + 11 + b]], '#fff');
      box(c, x - 26, y + 4 + b, 50, 2, '#2b7fc0');
      box(c, x - 10, y - 11 + b, 22, 11, '#e9eef0', 2);
      box(c, x - 7, y - 9 + b, 16, 5, '#4f6f7f');
    };
    boot(-112, -18, 0);
    boot(120, -14, 2);
    boot(10, -12, 4);
  };

  L.fischerboot = (c, t) => {
    wasser(c, 211, -60, t, '#a8dde4', '#4e9fb4');
    // Ufer links mit Kies
    hill(c, [[-212, 0], [-206, -56], [-120, -72], [10, -62], [84, -26], [120, 0]], grad(c, 0, -72, 0, 0, ['#b6cf7d', '#d8c79a']));
    const r = rngOf(6);
    c.fillStyle = '#bfae88';
    c.beginPath();
    for (let i = 0; i < 26; i++) c.rect(-190 + r() * 280, -26 + r() * 24, 2 + r() * 4, 1.6 + r() * 1.6);
    c.fill();
    // Netz zum Trocknen auf Stangen
    const nx0 = -184;
    const nx1 = -66;
    const ny = -158;
    for (const x of [nx0, nx1]) {
      line(c, [[x, -48], [x, ny - 12]], '#7a5a36', 5, 'butt');
    }
    line(c, [[nx0 - 8, ny], [nx1 + 8, ny]], '#8a6642', 4);
    const sw = Math.sin(t * 0.7) * 2;
    c.save();
    c.beginPath();
    c.moveTo(nx0 + 2, ny);
    c.lineTo(nx1 - 2, ny);
    c.quadraticCurveTo(nx1 + sw, ny + 40, nx1 - 6 + sw, ny + 88);
    c.quadraticCurveTo((nx0 + nx1) / 2 + sw, ny + 104, nx0 + 6 + sw, ny + 88);
    c.quadraticCurveTo(nx0 + sw, ny + 40, nx0 + 2, ny);
    c.closePath();
    c.fillStyle = 'rgba(214,202,168,0.45)';
    c.fill();
    c.clip();
    c.strokeStyle = 'rgba(112,92,60,0.75)';
    c.lineWidth = 0.9;
    c.beginPath();
    for (let i = -14; i < 26; i++) {
      c.moveTo(nx0 + i * 9, ny);
      c.lineTo(nx0 + i * 9 + 110, ny + 110);
      c.moveTo(nx0 + i * 9, ny);
      c.lineTo(nx0 + i * 9 - 110, ny + 110);
    }
    c.stroke();
    c.restore();
    c.fillStyle = '#e9c46a';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = lerp(nx0 + 12, nx1 - 12, i / 5) + sw;
      c.moveTo(x + 3.4, ny + 95 - Math.sin((i / 5) * PI) * -7);
      c.arc(x, ny + 95 + Math.sin((i / 5) * PI) * 7, 3.4, 0, TAU);
    }
    c.fill();
    // Holzboot
    const b = Math.sin(t * 0.85) * 1;
    c.save();
    c.translate(112, -26 + b);
    c.rotate(Math.sin(t * 0.65) * 0.012);
    c.beginPath();
    c.moveTo(-84, -16);
    c.quadraticCurveTo(-20, -8, 88, -24);
    c.lineTo(68, 12);
    c.quadraticCurveTo(0, 18, -72, 10);
    c.closePath();
    c.fillStyle = grad(c, 0, -22, 0, 16, ['#b98a54', '#7a5230']);
    c.fill();
    c.strokeStyle = 'rgba(60,35,15,0.4)';
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      c.moveTo(-80 + i * 2.6, -8 + i * 6);
      c.quadraticCurveTo(0, 2 + i * 5.4, 84 - i * 5.6, -15 + i * 7);
    }
    c.stroke();
    c.beginPath();
    c.moveTo(-84, -16);
    c.quadraticCurveTo(-20, -8, 88, -24);
    c.strokeStyle = '#5a3c20';
    c.lineWidth = 3.4;
    c.stroke();
    box(c, -50, -13, 22, 3, '#5a3c20');
    box(c, 28, -17, 22, 3, '#5a3c20');
    line(c, [[-44, -13], [-74, -2]], '#9a7040', 2.6);
    ell(c, -80, 1, 6, 2.6, '#9a7040', -0.3);
    // Stange mit kleinem Wimpel
    line(c, [[70, -22], [70, -68]], '#6a4c30', 2.4);
    const wa = Math.sin(t * 1.6) * 2;
    poly(c, [[70, -68], [92, -63 + wa], [70, -58]], '#d6402f');
    c.restore();
    spiegel(c, 112, -8, 160, 8, '#6d4a28', 0.28, t);
    // Fischkiste
    const kx = -24;
    const ky = -4;
    ell(c, kx + 27, ky + 1, 38, 4, 'rgba(0,0,0,0.13)');
    const fisch = (x, y, rot) => {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      ell(c, 0, 0, 12, 4.2, '#c6d4d8');
      ell(c, 1, -1.4, 9, 2, '#eaf2f2');
      poly(c, [[-11, 0], [-17, -4], [-17, 4]], '#a4b6bc');
      ell(c, 8, -1, 1, 1, '#28231d');
      c.restore();
    };
    fisch(kx + 12, ky - 34, 0.1);
    fisch(kx + 32, ky - 37, -0.14);
    fisch(kx + 44, ky - 33, 0.18);
    fisch(kx + 22, ky - 39, 0.3);
    box(c, kx - 2, ky - 32, 58, 32, '#a87f4d');
    c.fillStyle = 'rgba(70,45,20,0.4)';
    c.fillRect(kx - 2, ky - 22, 58, 1.4);
    c.fillRect(kx - 2, ky - 11, 58, 1.4);
    box(c, kx - 3, ky - 34, 5, 34, '#8a6438');
    box(c, kx + 52, ky - 34, 5, 34, '#8a6438');
    // Der Fischer mit Mütze und Bart, freundlich
    const fx = 56;
    const fy = -2;
    c.save();
    c.translate(fx, fy);
    ell(c, 0, 1, 15, 3, 'rgba(0,0,0,0.16)');
    box(c, -9, -30, 8, 30, '#3a4f5f', 3);
    box(c, 1, -30, 8, 30, '#3a4f5f', 3);
    box(c, -10, -6, 10, 6, '#2c2a26', 2);
    box(c, 0, -6, 13, 6, '#2c2a26', 2);
    box(c, -11, -60, 22, 34, '#2f6f8a', 7);
    box(c, -8, -42, 16, 16, '#48566a', 2);
    line(c, [[-7, -60], [-7, -44]], '#48566a', 2.6);
    line(c, [[7, -60], [7, -44]], '#48566a', 2.6);
    line(c, [[-9, -54], [-15, -36]], '#2f6f8a', 6);
    ell(c, -15, -33, 3.2, 3.2, '#f1c9a4');
    // Arm winkt ruhig mit einem Fisch
    const arm = Math.sin(t * 0.9) * 0.1;
    c.save();
    c.translate(9, -55);
    c.rotate(-0.9 + arm);
    box(c, -3, -1, 6, 19, '#2f6f8a', 3);
    ell(c, 0, 20, 3.2, 3.2, '#f1c9a4');
    c.restore();
    ell(c, 0, -72, 11, 11.6, '#f6d4b4');
    c.beginPath();
    c.moveTo(-9, -70);
    c.quadraticCurveTo(-11, -56, 1, -55);
    c.quadraticCurveTo(12, -56, 10, -70);
    c.quadraticCurveTo(1, -64, -9, -70);
    c.closePath();
    c.fillStyle = '#e9e4d8';
    c.fill();
    ell(c, 4, -73, 1.4, 1.7, '#28231d');
    c.beginPath();
    c.arc(3, -66.5, 3, 0.2, PI - 0.5);
    c.strokeStyle = '#a4593e';
    c.lineWidth = 1.2;
    c.stroke();
    c.beginPath();
    c.arc(0, -76, 11.5, PI, 0);
    c.closePath();
    c.fillStyle = '#26415a';
    c.fill();
    box(c, 2, -77, 14, 3.4, '#1d3347', 1.6);
    c.restore();
    // Möwe auf dem Pfahl
    box(c, 186, -60, 6, 46, '#6a4c30');
    ell(c, 189, -66, 8, 4.4, '#fff');
    ell(c, 195, -70, 3.4, 3.2, '#fff');
    poly(c, [[198, -70.5], [203, -70], [198, -68.8]], '#e8b52a');
    poly(c, [[186, -68], [176, -66], [186, -63]], '#b6c2c8');
    ell(c, 196, -71, 0.8, 0.8, '#28231d');
  };

  L.ladine = (c, t) => {
    wasser(c, 211, -64, t);
    const b = Math.sin(t * 0.7) * 1;
    c.save();
    c.translate(6, -38 + b);
    c.rotate(Math.sin(t * 0.5) * 0.006);
    // Rah und hohes Rahsegel
    const mx = -6;
    const yT = -284;
    line(c, [[mx, 0], [mx, yT - 8]], '#5e4228', 6, 'butt');
    ell(c, mx, yT - 10, 4, 4, '#3f2c1a');
    const ws = Math.sin(t * 0.6) * 5;
    c.beginPath();
    c.moveTo(mx - 72, yT);
    c.lineTo(mx + 72, yT);
    c.bezierCurveTo(mx + 74 + ws, yT + 80, mx + 64 + ws, yT + 170, mx + 56, yT + 240);
    c.quadraticCurveTo(mx + ws * 0.4, yT + 246, mx - 56, yT + 240);
    c.bezierCurveTo(mx - 62 + ws * 0.6, yT + 170, mx - 70 + ws * 0.6, yT + 80, mx - 72, yT);
    c.closePath();
    c.fillStyle = grad(c, mx - 72, 0, mx + 72, 0, ['#e5d9bd', '#f7f0dc', '#dfd2b4']);
    c.fill();
    // Bahnen im Segeltuch
    c.strokeStyle = 'rgba(130,110,75,0.22)';
    c.lineWidth = 1.1;
    c.beginPath();
    for (let i = -4; i <= 4; i++) {
      c.moveTo(mx + i * 16, yT + 2);
      c.quadraticCurveTo(mx + i * 16 + ws * 0.5, yT + 120, mx + i * 12.4, yT + 240);
    }
    c.stroke();
    // Wappenschild auf dem Segel, ohne Schrift
    const sy = yT + 66;
    c.beginPath();
    c.moveTo(mx - 28 + ws * 0.4, sy);
    c.lineTo(mx + 28 + ws * 0.4, sy);
    c.lineTo(mx + 28 + ws * 0.4, sy + 34);
    c.quadraticCurveTo(mx + 26 + ws * 0.4, sy + 58, mx + ws * 0.4, sy + 70);
    c.quadraticCurveTo(mx - 26 + ws * 0.4, sy + 58, mx - 28 + ws * 0.4, sy + 34);
    c.closePath();
    c.fillStyle = '#c23b2e';
    c.fill();
    c.save();
    c.clip();
    box(c, mx - 30 + ws * 0.4, sy + 24, 60, 14, '#f7f0dc');
    c.fillStyle = '#26486e';
    c.beginPath();
    for (let i = 0; i < 4; i++) c.rect(mx - 26 + i * 14 + ws * 0.4, sy + 6, 7, 10);
    c.fill();
    c.restore();
    // Rah
    line(c, [[mx - 82, yT - 2], [mx + 82, yT - 2]], '#6a4c30', 5.5);
    // Taue
    c.strokeStyle = 'rgba(60,45,30,0.75)';
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(mx, yT + 2);
    c.lineTo(-170, -22);
    c.moveTo(mx, yT + 2);
    c.lineTo(170, -22);
    c.moveTo(mx - 72, yT - 2);
    c.lineTo(-120, -18);
    c.moveTo(mx + 72, yT - 2);
    c.lineTo(136, -18);
    c.moveTo(mx - 56, yT + 240);
    c.lineTo(-86, -14);
    c.moveTo(mx + 56, yT + 240);
    c.lineTo(84, -14);
    c.stroke();
    // Wimpel an der Mastspitze
    const wi = Math.sin(t * 1.8) * 3;
    poly(c, [[mx, yT - 8], [mx + 34, yT - 5 + wi], [mx, yT + 0]], '#d6402f');
    // Rumpf: lang, flach, dunkel
    c.beginPath();
    c.moveTo(-196, -30);
    c.quadraticCurveTo(-180, -16, -140, -16);
    c.lineTo(140, -16);
    c.quadraticCurveTo(178, -16, 200, -34);
    c.lineTo(176, 8);
    c.quadraticCurveTo(120, 22, 0, 22);
    c.quadraticCurveTo(-120, 22, -170, 8);
    c.closePath();
    c.fillStyle = grad(c, 0, -34, 0, 22, ['#6a4728', '#35241a']);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.28)';
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      c.moveTo(-182 + i * 6, -14 + i * 7);
      c.quadraticCurveTo(0, 6 + i * 6.6, 186 - i * 8, -18 + i * 8);
    }
    c.stroke();
    line(c, [[-194, -28], [-180, -18], [-140, -18], [140, -18], [178, -18], [198, -32]], '#8a6238', 3.4);
    // Ladung: Säcke und Fässer
    const sack = (x, y, w, col) => {
      c.beginPath();
      c.moveTo(x - w, y);
      c.quadraticCurveTo(x - w * 1.15, y - 15, x - w * 0.5, y - 18);
      c.quadraticCurveTo(x, y - 21, x + w * 0.5, y - 18);
      c.quadraticCurveTo(x + w * 1.15, y - 15, x + w, y);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      line(c, [[x - w * 0.4, y - 18], [x - w * 0.1, y - 22], [x + w * 0.3, y - 18]], '#7d6a42', 1.4);
    };
    for (const [x, y, w, col] of [[-146, -16, 14, '#d2bd8c'], [-120, -16, 15, '#c7b07c'], [-92, -16, 14, '#d9c595'], [-132, -32, 14, '#dcc99b'], [-106, -32, 14, '#c7b07c'], [-118, -48, 13, '#d2bd8c'], [46, -16, 15, '#d9c595'], [74, -16, 14, '#c7b07c'], [102, -16, 15, '#d2bd8c'], [60, -32, 14, '#c7b07c'], [88, -32, 14, '#dcc99b']]) sack(x, y, w, col);
    box(c, 124, -38, 20, 22, '#8a5e34', 7);
    box(c, 124, -30, 20, 2, '#5f6468');
    box(c, 124, -23, 20, 2, '#5f6468');
    box(c, -60, -36, 20, 20, '#8a5e34', 7);
    box(c, -60, -29, 20, 2, '#5f6468');
    box(c, -60, -22, 20, 2, '#5f6468');
    figur(c, 152, -18, 0.8, '#b5533c', '#3a4f5f', '#26415a');
    // Steuerruder
    line(c, [[-180, -26], [-212, 8]], '#6a4c30', 4);
    c.restore();
    spiegel(c, 6, -14, 320, 14, '#3f2c1a', 0.26, t);
    // Steg im Vordergrund
    for (const x of [-190, -130, -70, -10, 50, 110, 170]) {
      box(c, x - 3, -13, 6, 13, '#4a3420');
    }
    box(c, -204, -14, 408, 7, '#a07b4d');
    c.strokeStyle = 'rgba(40,25,10,0.4)';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = -200; x < 204; x += 11) {
      c.moveTo(x, -14);
      c.lineTo(x, -7);
    }
    c.stroke();
    box(c, -204, -8, 408, 2, '#6d5230');
    // Poller mit Tau
    box(c, -148, -26, 7, 13, '#4a3420', 2);
    line(c, [[-144, -22], [-120, -38 + b]], '#7d6a42', 1.6);
    box(c, 140, -26, 7, 13, '#4a3420', 2);
    line(c, [[143, -22], [120, -36 + b]], '#7d6a42', 1.6);
  };

  L.droste = (c, t) => {
    // Sanfter Hang, blickt über den See
    c.save();
    c.translate(0, -84);
    wasser(c, 206, -30, t, '#c6e8ee', '#8fd0dc', 3);
    c.restore();
    const H = [[-212, 0], [-190, -70], [-110, -128], [0, -146], [110, -128], [190, -70], [212, 0]];
    hill(c, H, grad(c, 0, -146, 0, 0, ['#add078', '#83b458']));
    // Fürstenhäusle: kleines lachsrotes Haus mit steilem Giebel
    const wand = '#e49070';
    const X = 0;
    const yb = -126;
    poly(c, [[X - 66, yb - 88], [X, yb - 158], [X + 66, yb - 88]], grad(c, 0, yb - 158, 0, yb - 88, ['#b6512f', '#8f3f26']));
    box(c, X - 56, yb - 88, 112, 88, wand);
    poly(c, [[X - 52, yb - 88], [X + 52, yb - 88], [X, yb - 148]], wand);
    line(c, [[X - 64, yb - 86], [X, yb - 156], [X + 64, yb - 86]], '#7d3620', 5);
    box(c, X + 36, yb - 88, 20, 88, 'rgba(0,0,0,0.05)');
    // Holzklappläden und weiße Tür
    for (const [x, y] of [[-34, -80], [14, -80]]) {
      fenster(c, X + x, yb + y, 20, 24, '#fbf7ea', '#5f7d8b');
    }
    fenster(c, X - 8, yb - 128, 16, 20, '#fbf7ea', '#5f7d8b');
    bogen(c, X, yb, 26, 44, '#f6f2e6');
    box(c, X - 10, yb - 36, 20, 36, '#dfe6e6');
    box(c, X - 0.8, yb - 36, 1.6, 36, '#b9c2c2');
    // Stufen zwischen den Reben
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      const y0 = lerp(0, yb, u);
      const y1 = lerp(0, yb, u + 1 / steps);
      const w0 = lerp(40, 14, u);
      const w1 = lerp(40, 14, u + 1 / steps);
      poly(c, [[-w0, y0], [w0, y0], [w1, y1 + 2], [-w1, y1 + 2]], i % 2 ? '#d9cfba' : '#c9beaa');
    }
    line(c, [[46, -2], [18, yb + 4]], '#5c6168', 2.4);
    for (let i = 1; i < 4; i++) {
      const u = i / 4;
      line(c, [[lerp(46, 18, u), lerp(-2, yb + 4, u)], [lerp(46, 18, u), lerp(-2, yb + 4, u) + 10]], '#5c6168', 1.6);
    }
    // Reben links und rechts, die Zeilen laufen auf das Haus zu
    c.save();
    hill(c, H);
    c.clip();
    for (const s of [-1, 1]) {
      for (let k = 5; k >= 0; k--) {
        zeile(c, s * (30 + k * 15), -116 + k * 2.4, s * (56 + k * 31), 4, 3, 16, k + (s > 0 ? 40 : 60));
      }
    }
    c.restore();
    // Feder und Tintenfass als Symbol
    const dy = Math.sin(t * 0.7) * 2;
    c.save();
    c.translate(136, -282 + dy);
    ell(c, 0, 8, 46, 46, 'rgba(255,250,230,0.82)');
    // Tintenfass
    ell(c, 0, 37, 24, 5.5, '#23304a');
    box(c, -24, 18, 48, 19, '#2f3f62', 6);
    box(c, -12, 8, 24, 12, '#2f3f62', 2);
    box(c, -15, 5, 30, 5, '#46587e', 2);
    ell(c, 0, 5, 11, 2.6, '#101828');
    ell(c, -12, 26, 3.4, 6, 'rgba(255,255,255,0.32)');
    // Feder taucht ein
    c.save();
    c.translate(3, 4);
    c.rotate(0.36 + Math.sin(t * 0.7) * 0.015);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(-13, -22, -9, -44);
    c.quadraticCurveTo(-1, -54, 5, -60);
    c.quadraticCurveTo(13, -40, 8, -22);
    c.quadraticCurveTo(5, -8, 0, 0);
    c.closePath();
    c.fillStyle = grad(c, -12, 0, 13, 0, ['#fff', '#e7dcc4']);
    c.fill();
    c.strokeStyle = '#a8946e';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(0, -30, 4, -58);
    c.moveTo(-1, -14);
    c.lineTo(-7, -22);
    c.moveTo(0, -24);
    c.lineTo(-8, -33);
    c.moveTo(1, -34);
    c.lineTo(-6, -44);
    c.moveTo(1, -16);
    c.lineTo(6, -24);
    c.moveTo(2, -28);
    c.lineTo(8, -36);
    c.stroke();
    c.restore();
    c.restore();
  };

  L.insel_lindau = (c, t) => {
    fern(c, [[-186, -94], [-150, -172], [-90, -142], [-24, -222], [46, -164], [120, -204], [186, -94]], '#c9d9e4', -182);
    wasser(c, 211, -96, t);
    // Straßenbrücke, Bögen von rechts
    const by = -60;
    box(c, 130, by - 6, 84, 8, '#c4bba8');
    c.fillStyle = '#c4bba8';
    c.fillRect(130, by, 84, 18);
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.arc(142 + i * 17, by + 19, 7, PI, 0);
      c.closePath();
      c.fillStyle = '#6fb0bf';
      c.fill();
    }
    box(c, 130, by - 9, 84, 2, '#8d8a80');
    // Insel
    const yi = -58;
    poly(c, [[-138, yi + 6], [-126, yi - 2], [138, yi - 2], [152, yi + 6], [146, yi + 16], [-130, yi + 16]], grad(c, 0, yi - 2, 0, yi + 16, ['#8a9d6a', '#7f7a68']));
    busch(c, 110, yi - 2, 16, '#5f9a55', 3);
    // Altstadthäuser als bunte Silhouette
    const r = rngOf(29);
    const cols = ['#f0d9a8', '#e8a58f', '#f4e6c8', '#d9c0a0', '#e9c46a', '#cfe0d6', '#f2c6b0'];
    let x = -112;
    let n = 0;
    while (x < 106) {
      const w = 15 + r() * 11;
      const h = 22 + r() * 22;
      if (x < -44 || x > -18) {
        box(c, x, yi - 2 - h, w, h, cols[n % cols.length]);
        poly(c, [[x - 1, yi - 2 - h], [x + w + 1, yi - 2 - h], [x + w / 2, yi - 2 - h - w * 0.55]], n % 3 ? '#b5532e' : '#94452b');
        c.fillStyle = '#5f7d8b';
        c.fillRect(x + w * 0.2, yi - h + 5, 3.4, 4.4);
        c.fillRect(x + w * 0.6, yi - h + 5, 3.4, 4.4);
        c.fillRect(x + w * 0.2, yi - 14, 3.4, 4.4);
        c.fillRect(x + w * 0.6, yi - 14, 3.4, 4.4);
      }
      x += w + 0.6;
      n++;
    }
    // Mangturm mit buntem Spitzdach
    const mt = -96;
    box(c, mt - 10, yi - 96, 20, 94, '#d9cdb5');
    quader(c, mt - 10, yi - 96, 20, 94, 3, 8, 'rgba(70,55,35,0.14)');
    poly(c, [[mt - 12, yi - 96], [mt + 12, yi - 96], [mt, yi - 132]], grad(c, mt - 12, 0, mt + 12, 0, ['#d9a93b', '#3f8a7d', '#b5532e']));
    bogen(c, mt, yi - 80, 5, 10, '#3c4a52');
    // Münster und Stephanskirche mit grüner Haube
    const st = -36;
    box(c, st - 18, yi - 64, 46, 62, '#efe8d8');
    poly(c, [[st - 22, yi - 64], [st + 32, yi - 64], [st + 22, yi - 80], [st - 12, yi - 80]], '#a9552f');
    box(c, st - 10, yi - 118, 22, 60, '#f4ecd9');
    bogen(c, st + 1, yi - 90, 7, 16, '#4c5f6b');
    ell(c, st + 1, yi - 106, 4, 4, '#2f3c44');
    c.beginPath();
    c.moveTo(st - 12, yi - 118);
    c.bezierCurveTo(st - 12, yi - 132, st - 2, yi - 134, st + 1, yi - 150);
    c.bezierCurveTo(st + 4, yi - 134, st + 14, yi - 132, st + 14, yi - 118);
    c.closePath();
    c.fillStyle = '#4f9a84';
    c.fill();
    line(c, [[st + 1, yi - 148], [st + 1, yi - 158]], '#5a564e', 1.4);
    // Altes Rathaus mit Treppengiebel
    const rh = 30;
    box(c, rh, yi - 60, 40, 58, '#f4d9a0');
    for (let i = 0; i < 4; i++) box(c, rh + i * 4.6, yi - 60 - (i + 1) * 7, 40 - i * 9.2, 7.5, '#f4d9a0');
    c.fillStyle = '#5f7d8b';
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) c.fillRect(rh + 5 + i * 8, yi - 54 + j * 14, 4.6, 7.4);
    // Diebsturm: rund mit Erkerchen
    const dt = 88;
    box(c, dt - 9, yi - 72, 18, 70, '#d3c9b4');
    rund(c, dt - 9, yi - 72, 18, 70);
    kegel(c, dt, yi - 72, 13, 22, '#a9552f');
    for (const s of [-1, 1]) {
      box(c, dt + s * 11 - 3, yi - 78, 6, 12, '#e4dbc8');
      kegel(c, dt + s * 11, yi - 78, 4.4, 9, '#a9552f');
    }
    // Leuchtturm und Löwe an der Hafenspitze
    box(c, 124, yi - 70, 8, 62, '#f4ecd9');
    box(c, 123, yi - 74, 10, 4, '#7a4a3c');
    box(c, 125.5, yi - 80, 5, 6, '#ffe27a');
    kegel(c, 128, yi - 80, 4.5, 5, '#3f8a7d');
    box(c, 104, yi - 24, 12, 20, '#c9bda6');
    ell(c, 110, yi - 30, 6, 7, '#b8ab92');
    ell(c, 113, yi - 36, 4.4, 4.6, '#94866d');
    // Spiegelung der Stadt
    spiegel(c, 0, yi + 16, 250, 30, '#e7c9a0', 0.26, t);
    // Bahndamm von links
    const dy = -26;
    poly(c, [[-214, dy + 18], [-210, dy + 2], [-100, dy - 26], [-74, dy - 18], [-96, dy - 12], [-190, dy + 18]], grad(c, 0, dy - 26, 0, dy + 18, ['#a8b888', '#7f8f6a']));
    line(c, [[-212, dy + 2], [-98, dy - 26]], '#9a8f7a', 3);
    // Zug fährt ganz langsam zur Insel
    const u = (Math.sin(t * 0.06) + 1) * 0.5;
    const zx = lerp(-186, -128, u);
    const zy = (x2) => lerp(dy + 2, dy - 26, (x2 + 212) / 114);
    const ang = Math.atan2(-28, 114);
    for (let i = 0; i < 2; i++) {
      c.save();
      c.translate(zx + i * 27, zy(zx + i * 27));
      c.rotate(ang);
      box(c, -13, -13, 26, 12, i ? '#e8e6de' : '#d6402f', 3);
      box(c, -13, -6, 26, 2.4, i ? '#d6402f' : '#fff');
      for (let k = 0; k < 3; k++) box(c, -10 + k * 7, -11, 5, 4, '#3f6175');
      c.restore();
    }
    // Ein kleines Segel
    const sx = 16 + Math.sin(t * 0.09) * 14;
    c.save();
    c.translate(sx, -14 + Math.sin(t * 0.9) * 0.6);
    poly(c, [[-12, 0], [12, 0], [8, 4], [-9, 4]], '#f7f3e8');
    box(c, -0.7, -28, 1.4, 28, '#6d5a42');
    poly(c, [[1, -27], [13, -3], [1, -3]], '#fff');
    poly(c, [[-1, -22], [-9, -3], [-1, -3]], '#ffd9a0');
    c.restore();
  };

  // ------------------------------------------------------------------ Tiere und Pflanzen
  const K = {};

  // Vogel schaukelt auf der Wasserlinie: Körper wird bei y=0 abgeschnitten, darunter liegt der Wasserring.
  function schwimmt(c, t, seed, breit, fn) {
    c.save();
    c.beginPath();
    c.rect(-70, -90, 140, 90.5);
    c.clip();
    c.translate(0, Math.sin(t * 1.05 + seed) * 0.9);
    c.rotate(Math.sin(t * 0.8 + seed * 1.7) * 0.022);
    fn();
    c.restore();
    ring(c, breit, t, seed);
  }
  function ring(c, breit, t, seed) {
    c.fillStyle = 'rgba(70,150,175,0.28)';
    c.beginPath();
    c.ellipse(0, 1.2, breit, 2.4, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 1.1;
    c.beginPath();
    c.ellipse(0, 0.6, breit * (0.94 + Math.sin(t * 0.9 + seed) * 0.03), 1.7, 0, 0, TAU);
    c.stroke();
  }

  K.haubentaucher = (c, t) => {
    schwimmt(c, t, 1, 33, () => {
      // Körper, flach im Wasser
      c.beginPath();
      c.moveTo(-32, -4);
      c.quadraticCurveTo(-28, -16, -6, -15);
      c.quadraticCurveTo(14, -15, 22, -6);
      c.lineTo(22, 4);
      c.lineTo(-30, 4);
      c.closePath();
      c.fillStyle = grad(c, 0, -16, 0, 4, ['#6a5748', '#a8703f']);
      c.fill();
      ell(c, 14, -5, 10, 8, '#fbf7ee');
      // Schlanker weißer Hals
      c.beginPath();
      c.moveTo(6, -10);
      c.quadraticCurveTo(14, -24, 15, -44);
      c.lineTo(22, -44);
      c.quadraticCurveTo(24, -24, 22, -6);
      c.closePath();
      c.fillStyle = '#fbf7ee';
      c.fill();
      c.beginPath();
      c.moveTo(6, -10);
      c.quadraticCurveTo(13, -24, 15, -42);
      c.lineTo(17.5, -42);
      c.quadraticCurveTo(15, -24, 10, -8);
      c.closePath();
      c.fillStyle = '#6a5748';
      c.fill();
      // Rostroter Kragen
      poly(c, [[14, -50], [5, -44], [3, -36], [8, -32], [15, -36], [21, -38]], '#c9672f');
      poly(c, [[13, -46], [6, -40], [5, -36], [8, -33], [11, -38]], '#2e2520');
      // Kopf und Haube
      ell(c, 19, -49, 7, 6.2, '#fbf7ee');
      c.beginPath();
      c.moveTo(25, -52);
      c.quadraticCurveTo(17, -58, 10, -53);
      c.lineTo(5, -60);
      c.lineTo(12, -59);
      c.lineTo(10, -66);
      c.lineTo(17, -60);
      c.quadraticCurveTo(24, -58, 25, -52);
      c.closePath();
      c.fillStyle = '#2e2520';
      c.fill();
      poly(c, [[24, -50], [37, -47.5], [24, -46.5]], '#c9544a');
      ell(c, 21, -50.4, 1.5, 1.5, '#c23b2e');
      ell(c, 21.2, -50.4, 0.7, 0.7, '#1b1a18');
    });
  };

  K.hoeckerschwan = (c, t) => {
    schwimmt(c, t, 2, 38, () => {
      // Leicht gewölbte Flügel
      c.beginPath();
      c.moveTo(-42, -13);
      c.quadraticCurveTo(-34, -30, -8, -30);
      c.quadraticCurveTo(14, -28, 26, -8);
      c.lineTo(22, 4);
      c.lineTo(-32, 4);
      c.quadraticCurveTo(-36, -6, -42, -13);
      c.closePath();
      c.fillStyle = grad(c, 0, -30, 0, 4, ['#ffffff', '#dfe8ee']);
      c.fill();
      c.beginPath();
      c.moveTo(-28, -10);
      c.quadraticCurveTo(-12, -28, 10, -22);
      c.quadraticCurveTo(-4, -8, -28, -10);
      c.closePath();
      c.fillStyle = 'rgba(190,210,222,0.55)';
      c.fill();
      // S-Hals
      c.beginPath();
      c.moveTo(16, -10);
      c.bezierCurveTo(32, -22, 8, -36, 16, -54);
      c.strokeStyle = '#f7fafc';
      c.lineWidth = 8.4;
      c.lineCap = 'round';
      c.stroke();
      ell(c, 20, -57, 7, 5.8, '#fff');
      // Oranger Schnabel mit schwarzem Höcker
      poly(c, [[24, -60], [39, -53.5], [37, -51.5], [24, -53]], '#ec7f2c');
      ell(c, 26, -61, 3.5, 3, '#1f1d1b');
      poly(c, [[21, -60], [26, -59.5], [26, -55], [22, -56]], '#1f1d1b');
      ell(c, 21.5, -58.2, 1.5, 1.5, '#1f1d1b');
    });
  };

  K.kormoran = (c, t) => {
    // Steht auf einem Pfahl und trocknet die Flügel
    box(c, -4.5, -24, 9, 24, '#6a4c30');
    box(c, -4.5, -24, 9, 3, '#8a6642');
    ring(c, 10, t, 3);
    const f = Math.sin(t * 0.7) * 0.04;
    const flug = (s) => {
      c.save();
      c.translate(s * 5, -46);
      c.rotate(s * (0.16 + f));
      c.beginPath();
      c.moveTo(0, -5);
      c.lineTo(s * 16, -13);
      c.lineTo(s * 34, -8);
      c.lineTo(s * 39, 0);
      c.lineTo(s * 33, 2);
      c.lineTo(s * 36, 8);
      c.lineTo(s * 28, 7);
      c.lineTo(s * 28, 13);
      c.lineTo(s * 19, 10);
      c.lineTo(s * 17, 15);
      c.lineTo(0, 8);
      c.closePath();
      c.fillStyle = grad(c, 0, -13, 0, 15, ['#2f3a36', '#1f2422']);
      c.fill();
      c.strokeStyle = 'rgba(120,150,130,0.4)';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(s * 6, -4);
      c.lineTo(s * 29, -5);
      c.moveTo(s * 6, 1);
      c.lineTo(s * 25, 2);
      c.stroke();
      c.restore();
    };
    flug(-1);
    flug(1);
    // Aufrechter Körper
    ell(c, 0, -40, 9.5, 17, '#232a27');
    ell(c, 2.5, -34, 5, 10, 'rgba(90,120,100,0.3)');
    poly(c, [[-5, -26], [5, -26], [3, -18], [-3, -18]], '#1b201e');
    line(c, [[-3, -26], [-3, -23]], '#1b1a18', 2.4);
    line(c, [[3, -26], [3, -23]], '#1b1a18', 2.4);
    // Hals, Kopf, weiße Wange, Hakenschnabel
    c.beginPath();
    c.moveTo(-2, -52);
    c.quadraticCurveTo(3, -58, 2, -62);
    c.strokeStyle = '#232a27';
    c.lineWidth = 6.4;
    c.lineCap = 'round';
    c.stroke();
    ell(c, 3, -65, 5.4, 4.6, '#232a27');
    ell(c, 4.4, -62.8, 3.2, 2.6, '#f7f3e8');
    poly(c, [[7, -67], [18, -65.5], [19, -63], [17, -63.5], [7, -63.4]], '#6c6a60');
    ell(c, 7.5, -64.6, 2, 1.6, '#e5b13b');
    ell(c, 5, -66, 1.3, 1.3, '#2fa08a');
    ell(c, 5.2, -66, 0.6, 0.6, '#101010');
  };

  K.reiherente = (c, t) => {
    schwimmt(c, t, 4, 27, () => {
      // Weiße Flanke, schwarzer Rücken
      ell(c, -3, -7, 25, 13.4, '#1f1e22');
      c.beginPath();
      c.moveTo(-23, 2);
      c.quadraticCurveTo(-20, -14, -2, -14);
      c.quadraticCurveTo(12, -14, 15, -2);
      c.lineTo(14, 4);
      c.lineTo(-22, 4);
      c.closePath();
      c.fillStyle = '#fbfaf6';
      c.fill();
      poly(c, [[-26, -9], [-33, -10], [-24, -2]], '#1f1e22');
      ell(c, 15, -10, 7, 8, '#1f1e22');
      // Kopf mit hängendem Schopf
      ell(c, 17, -23, 9, 8.4, '#27243a');
      ell(c, 19, -26, 3.6, 2.4, 'rgba(120,90,170,0.5)');
      // Hängender Federschopf am Hinterkopf
      c.beginPath();
      c.moveTo(13, -30);
      c.quadraticCurveTo(5, -30, 1, -19);
      c.quadraticCurveTo(6, -21, 10, -21);
      c.closePath();
      c.fillStyle = '#27243a';
      c.fill();
      // Blaugrauer Schnabel mit schwarzer Spitze
      poly(c, [[24, -24], [33, -21.5], [33, -18.5], [24, -19]], '#8fa4b8');
      poly(c, [[30, -22], [34, -21], [34, -18.5], [30, -18.8]], '#1f1e22');
      ell(c, 20, -24.5, 2, 2, '#f2c62e');
      ell(c, 20.3, -24.5, 0.9, 0.9, '#101010');
    });
  };

  K.kolbenente = (c, t) => {
    schwimmt(c, t, 5, 30, () => {
      // Brauner Rücken, weiße Flanke, schwarze Brust und schwarzes Heck
      ell(c, -3, -8, 28, 14, '#7a5c3e');
      c.beginPath();
      c.moveTo(-24, 2);
      c.quadraticCurveTo(-18, -12, 4, -11);
      c.quadraticCurveTo(14, -10, 18, 0);
      c.lineTo(16, 4);
      c.lineTo(-24, 4);
      c.closePath();
      c.fillStyle = '#fbfaf6';
      c.fill();
      c.beginPath();
      c.moveTo(-32, -8);
      c.quadraticCurveTo(-30, 0, -22, 4);
      c.lineTo(-20, -6);
      c.quadraticCurveTo(-24, -12, -32, -8);
      c.closePath();
      c.fillStyle = '#1b1a18';
      c.fill();
      c.beginPath();
      c.moveTo(12, -19);
      c.quadraticCurveTo(26, -12, 22, 4);
      c.lineTo(12, 4);
      c.quadraticCurveTo(14, -8, 8, -14);
      c.closePath();
      c.fillStyle = '#1b1a18';
      c.fill();
      ell(c, 12, -19, 7, 7, '#1b1a18');
      // Großer, kugeliger Fuchskopf
      ell(c, 17, -30, 13, 12.4, '#d97f2e');
      ell(c, 15, -37, 8.4, 5.4, '#f2b45a');
      // Korallenroter Schnabel
      poly(c, [[27, -32], [39, -27.5], [39, -24], [27, -25]], '#d6332e');
      ell(c, 22, -31.5, 2, 2, '#c8242a');
      ell(c, 22.3, -31.5, 0.9, 0.9, '#101010');
    });
  };

  K.graureiher = (c, t) => {
    ring(c, 7, t, 6);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.ellipse(7, 0.6, 5, 1.4, 0, 0, TAU);
    c.fill();
    // Lange Beine stehen im Flachwasser
    line(c, [[-4, 0], [-5, -22]], '#b38f4a', 2.4);
    line(c, [[6, 0], [2, -11], [-1, -22]], '#a57f3d', 2.4);
    const sw = Math.sin(t * 0.45) * 0.6;
    c.save();
    c.translate(0, sw * 0.4);
    // Körper schräg
    c.beginPath();
    c.moveTo(-36, -16);
    c.quadraticCurveTo(-18, -42, 6, -40);
    c.quadraticCurveTo(14, -32, 8, -24);
    c.quadraticCurveTo(-8, -18, -36, -16);
    c.closePath();
    c.fillStyle = grad(c, 0, -42, 0, -16, ['#a8b4bc', '#7f8d97']);
    c.fill();
    c.beginPath();
    c.moveTo(-36, -16);
    c.quadraticCurveTo(-16, -30, 2, -30);
    c.quadraticCurveTo(-10, -22, -36, -16);
    c.closePath();
    c.fillStyle = '#4d5760';
    c.fill();
    // S-Hals
    c.beginPath();
    c.moveTo(4, -36);
    c.bezierCurveTo(18, -40, 0, -50, 10, -60);
    c.strokeStyle = '#e6eaec';
    c.lineWidth = 5.4;
    c.lineCap = 'round';
    c.stroke();
    c.beginPath();
    c.moveTo(7, -36);
    c.bezierCurveTo(18, -42, 2, -50, 11, -59);
    c.strokeStyle = 'rgba(70,75,85,0.6)';
    c.lineWidth = 0.9;
    c.setLineDash([2.2, 2.2]);
    c.stroke();
    c.setLineDash([]);
    // Kopf, schwarzer Überaugenstreif mit Schopf, Dolchschnabel
    ell(c, 13, -63, 6.2, 4.4, '#f4f6f7');
    c.beginPath();
    c.moveTo(19, -65.4);
    c.quadraticCurveTo(10, -68, 6, -65);
    c.lineTo(-7, -60);
    c.lineTo(5, -62.4);
    c.quadraticCurveTo(12, -65, 19, -64);
    c.closePath();
    c.fillStyle = '#23262a';
    c.fill();
    poly(c, [[18, -65], [39, -61], [18, -60.6]], '#e8b52a');
    ell(c, 15.2, -63.2, 1.2, 1.2, '#f2d34a');
    ell(c, 15.4, -63.2, 0.6, 0.6, '#101010');
    c.restore();
  };

  K.eisvogel = (c, t) => {
    // Sitzt auf einem Ast über dem Wasser
    line(c, [[-30, -6], [32, -24]], '#6a4c30', 5);
    line(c, [[12, -18], [24, -8]], '#6a4c30', 3);
    line(c, [[-30, -6], [-32, 0]], '#6a4c30', 5);
    ring(c, 12, t, 7);
    c.save();
    c.translate(-30, 0);
    ring(c, 7, t, 8);
    c.restore();
    const n = Math.sin(t * 0.5) > 0.86 ? 0.14 : 0;
    c.save();
    c.translate(0, -19);
    c.scale(1.25, 1.25);
    // Korallenrote Füße
    line(c, [[-3, 0], [-3, 2.4]], '#d9533c', 1.8);
    line(c, [[3, -1], [3, 1.4]], '#d9533c', 1.8);
    // Kurzer Schwanz
    poly(c, [[-11, -9], [-24, -5], [-20, 0], [-8, -5]], '#2563c4');
    // Bauch orange
    ell(c, 0, -10, 11, 10, '#ec7f2c');
    // Rücken in Eisblau
    c.beginPath();
    c.moveTo(-13, -5);
    c.quadraticCurveTo(-14, -18, -2, -23);
    c.quadraticCurveTo(4, -22, 4, -14);
    c.quadraticCurveTo(0, -5, -13, -5);
    c.closePath();
    c.fillStyle = grad(c, -13, -23, 4, -5, ['#1f8fe0', '#1f5fc0']);
    c.fill();
    c.beginPath();
    c.moveTo(-11, -9);
    c.quadraticCurveTo(-7, -18, -2, -21);
    c.strokeStyle = '#7fe0f4';
    c.lineWidth = 2;
    c.stroke();
    c.save();
    c.translate(4, -22);
    c.rotate(n);
    // Kopf
    ell(c, 0, 0, 9, 8, '#1f7ed4');
    // Pünktchen auf dem Kopf
    c.fillStyle = '#9ce6f7';
    c.beginPath();
    for (const [x, y] of [[-4, -4], [0, -5.4], [4, -4.4], [-5, -1], [-1, -2.4]]) {
      c.moveTo(x + 0.8, y);
      c.arc(x, y, 0.8, 0, TAU);
    }
    c.fill();
    ell(c, 2, 3.4, 6, 3.6, '#ec7f2c');
    ell(c, -2.4, 4.2, 3.4, 2.6, '#fbf7ee');
    ell(c, 3.4, 0.6, 2.6, 1.8, '#ec7f2c');
    // Langer Dolchschnabel
    poly(c, [[7, -2.4], [24, 1.4], [7, 2.6]], '#1f1d1b');
    ell(c, 3.6, -1, 1.5, 1.5, '#1b1a18');
    ell(c, 4.1, -1.5, 0.5, 0.5, '#fff');
    c.restore();
    c.restore();
  };

  K.biber = (c, t) => {
    // Bodenschatten
    ell(c, -8, 0.8, 38, 2.4, 'rgba(0,0,0,0.16)');
    // Flacher Kelle-Schwanz mit Schuppen
    c.save();
    c.translate(-22, -6);
    c.rotate(0.12 + Math.sin(t * 0.5) * 0.015);
    c.beginPath();
    c.moveTo(0, -3);
    c.quadraticCurveTo(-12, -9, -22, -6);
    c.quadraticCurveTo(-27, 0, -22, 6);
    c.quadraticCurveTo(-12, 8, 0, 3);
    c.closePath();
    c.fillStyle = '#4a4438';
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(160,150,120,0.55)';
    c.lineWidth = 0.8;
    c.beginPath();
    for (let i = -6; i < 8; i++) {
      c.moveTo(-28 + i * 5, -10);
      c.lineTo(-28 + i * 5 + 18, 10);
      c.moveTo(-28 + i * 5 + 18, -10);
      c.lineTo(-28 + i * 5, 10);
    }
    c.stroke();
    c.restore();
    c.restore();
    // Runder Körper
    c.beginPath();
    c.moveTo(-26, 0);
    c.bezierCurveTo(-34, -22, -10, -36, 10, -30);
    c.bezierCurveTo(22, -26, 26, -12, 22, 0);
    c.closePath();
    c.fillStyle = grad(c, 0, -36, 0, 0, ['#8d5f35', '#6d4726']);
    c.fill();
    ell(c, -6, -18, 12, 6, 'rgba(180,130,85,0.3)', -0.3);
    // Hinterfuß, Vorderpfoten halten einen Zweig
    ell(c, -12, -2, 11, 3.6, '#4d311b');
    const k = Math.sin(t * 2.2) * 0.35;
    line(c, [[38, -9 + k], [12, -14 - k]], '#a58153', 2.6);
    ell(c, 42, -13 + k, 3.4, 2.2, '#75a35a', -0.4);
    ell(c, 18, -2, 4, 2.6, '#4d311b');
    ell(c, 14, -12, 4.2, 3.6, '#5e3d21');
    // Kopf
    ell(c, 22, -22, 13, 11, '#7d5230');
    ell(c, 11, -31, 3.4, 3.4, '#5e3d21');
    ell(c, 11, -31, 1.8, 1.8, '#8d5f35');
    ell(c, 32, -18, 6.6, 5.6, '#94683c');
    ell(c, 37, -20.5, 2.2, 1.8, '#2c1e14');
    // Große orange Zähne
    box(c, 33.4, -13.4 + k * 0.5, 2.6, 5, '#ef8a2c', 0.8);
    box(c, 36.2, -13.4 + k * 0.5, 2.6, 5, '#ef8a2c', 0.8);
    // Auge und Schnurrhaare
    ell(c, 25, -25, 2.4, 2.4, '#1b1a18');
    ell(c, 25.8, -25.8, 0.8, 0.8, '#fff');
    c.strokeStyle = 'rgba(40,25,15,0.6)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(32, -16);
    c.lineTo(23, -13);
    c.moveTo(33, -15);
    c.lineTo(25, -10);
    c.stroke();
  };

  K.moewe = (c, t) => {
    // Sitzt auf einem Pfosten im Wasser
    box(c, -5, -18, 10, 18, '#7a5a3a');
    box(c, -5, -18, 10, 3, '#9a7a56');
    ring(c, 11, t, 9);
    line(c, [[-3, -24], [-3, -18]], '#e0856a', 2);
    line(c, [[3, -24], [3, -18]], '#e0856a', 2);
    // Weißer Körper
    ell(c, 2, -32, 19, 11, '#fdfcf8');
    // Grauer Flügel, schwarze Spitze mit weißen Flecken
    c.beginPath();
    c.moveTo(11, -38);
    c.quadraticCurveTo(-6, -44, -18, -32);
    c.lineTo(-37, -24);
    c.lineTo(-20, -24);
    c.quadraticCurveTo(-2, -22, 11, -30);
    c.closePath();
    c.fillStyle = grad(c, 0, -44, 0, -22, ['#c2ccd2', '#9eabb3']);
    c.fill();
    poly(c, [[-22, -31], [-38, -23.5], [-20, -24]], '#1f1e22');
    ell(c, -29, -26, 1.2, 0.9, '#fff');
    ell(c, -24, -26, 1.2, 0.9, '#fff');
    // Kopf, Schnabel, Auge
    ell(c, 17, -46, 7.8, 7.2, '#fdfcf8');
    ell(c, 13, -38, 7, 7, '#fdfcf8');
    poly(c, [[23, -48], [35, -45.5], [36, -42.5], [31, -42], [23, -43.5]], '#f0c02a');
    ell(c, 32.4, -43.4, 1.5, 1.2, '#d6332e');
    ell(c, 19.5, -48, 1.5, 1.5, '#e8d58a');
    ell(c, 19.8, -48, 0.8, 0.8, '#101010');
  };

  K.schmetterling = (c, t) => {
    // Schwalbenschwanz schaukelt über dem Boden
    const x = Math.sin(t * 0.45) * 7;
    const y = -40 + Math.sin(t * 0.7) * 3;
    const f = 0.42 + 0.58 * Math.abs(Math.cos(t * 2.2));
    c.save();
    c.translate(x, y);
    c.rotate(-0.22 + Math.sin(t * 0.7) * 0.05);
    for (const s of [-1, 1]) {
      c.save();
      c.scale(1, s * f);
      // Hinterflügel mit kurzem Schwänzchen
      c.beginPath();
      c.moveTo(-2, -1);
      c.quadraticCurveTo(-6, -20, -14, -24);
      c.quadraticCurveTo(-23, -25, -25, -15);
      c.lineTo(-32, -12);
      c.lineTo(-25, -8.5);
      c.quadraticCurveTo(-14, -3, -2, 1);
      c.closePath();
      c.fillStyle = '#ffd94a';
      c.fill();
      c.strokeStyle = '#26221e';
      c.lineWidth = 1.6;
      c.stroke();
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-13, -23);
      c.quadraticCurveTo(-22, -23, -23.5, -14);
      c.stroke();
      ell(c, -18, -16, 3.2, 3, '#3f7fc4');
      ell(c, -18, -11.5, 2, 2, '#d6402f');
      // Vorderflügel
      c.beginPath();
      c.moveTo(1, -1);
      c.quadraticCurveTo(0, -18, 11, -30);
      c.quadraticCurveTo(24, -31, 27, -24);
      c.quadraticCurveTo(21, -10, 3, -1);
      c.closePath();
      c.fillStyle = '#ffe05a';
      c.fill();
      c.lineWidth = 1.6;
      c.stroke();
      c.lineWidth = 3.4;
      c.beginPath();
      c.moveTo(12, -29);
      c.quadraticCurveTo(23, -30, 25.5, -24);
      c.quadraticCurveTo(22, -16, 18, -13);
      c.stroke();
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(2, -3);
      c.lineTo(10, -27);
      c.moveTo(3, -3);
      c.lineTo(16, -21);
      c.moveTo(4, -2);
      c.lineTo(18, -14);
      c.stroke();
      c.restore();
    }
    // Körper und Fühler
    ell(c, 0, 0, 10, 2.1, '#26221e');
    ell(c, 9, 0, 2.5, 2.2, '#26221e');
    c.strokeStyle = '#26221e';
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(11, -1);
    c.quadraticCurveTo(16, -4, 19, -8);
    c.moveTo(11, 1);
    c.quadraticCurveTo(16, 4, 19, 8);
    c.stroke();
    c.restore();
  };

  K.libelle = (c, t) => {
    const x = Math.sin(t * 0.38) * 5;
    const y = -36 + Math.sin(t * 0.62) * 3;
    c.save();
    c.translate(x, y);
    c.rotate(-0.06 + Math.sin(t * 0.5) * 0.03);
    // Vier durchsichtige Flügel, ruhig zitternd
    const zit = Math.sin(t * 11) * 0.06;
    const fl = (w, l, hoch) => {
      c.save();
      c.translate(4, 0);
      c.rotate(w + zit);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(l * 0.5, -hoch, l, -hoch * 0.3);
      c.quadraticCurveTo(l * 1.02, hoch * 0.3, l * 0.86, hoch * 0.36);
      c.quadraticCurveTo(l * 0.4, hoch * 0.46, 0, 0);
      c.closePath();
      c.fillStyle = 'rgba(200,232,248,0.62)';
      c.fill();
      c.strokeStyle = 'rgba(40,110,150,0.8)';
      c.lineWidth = 0.8;
      c.stroke();
      c.lineWidth = 0.45;
      c.beginPath();
      for (let i = 1; i < 5; i++) {
        const u = i / 5;
        c.moveTo(l * u, -hoch * 0.6);
        c.lineTo(l * u, hoch * 0.36);
      }
      c.moveTo(0, 0);
      c.lineTo(l, -hoch * 0.05);
      c.stroke();
      ell(c, l * 0.88, -hoch * 0.28, 1.9, 1.1, '#1d4f70');
      c.restore();
    };
    fl(-1.28, 30, 5);
    fl(1.28, 30, -5);
    fl(-1.7, 28, 5);
    fl(1.7, 28, -5);
    // Langer, blauer Hinterleib
    c.fillStyle = grad(c, -40, 0, 0, 0, ['#2563c4', '#2fa0dc']);
    c.beginPath();
    c.moveTo(0, -2.4);
    c.quadraticCurveTo(-22, -1.6, -41, -1);
    c.lineTo(-41, 1);
    c.quadraticCurveTo(-22, 1.6, 0, 2.4);
    c.closePath();
    c.fill();
    c.strokeStyle = '#123a70';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 1; i < 8; i++) {
      c.moveTo(-i * 5.2, -2);
      c.lineTo(-i * 5.2, 2);
    }
    c.stroke();
    // Brust und große Facettenaugen
    ell(c, 6, 0, 7, 4.2, '#1f6f8a');
    ell(c, 6, 0, 4, 2.2, '#7bd0c8');
    ell(c, 14.4, -2.4, 3.8, 3.2, '#3fc08a');
    ell(c, 14.4, 2.4, 3.8, 3.2, '#3fc08a');
    ell(c, 15.2, -3, 1, 0.9, '#fff');
    ell(c, 15.2, 1.8, 1, 0.9, '#fff');
    c.restore();
  };

  K.vergissmeinnicht = (c, t) => {
    // Kies
    c.beginPath();
    c.moveTo(-45, 0);
    c.quadraticCurveTo(-36, -10, -12, -11);
    c.quadraticCurveTo(22, -12, 38, -8);
    c.quadraticCurveTo(44, -4, 45, 0);
    c.closePath();
    c.fillStyle = grad(c, 0, -12, 0, 0, ['#d9d2c0', '#b8b09c']);
    c.fill();
    const r = rngOf(16);
    for (const col of ['#ece6d6', '#a59c88', '#c9c1ae']) {
      c.fillStyle = col;
      c.beginPath();
      for (let i = 0; i < 12; i++) {
        const x = -38 + r() * 76;
        const y = -9 + r() * 8;
        c.moveTo(x + 2.4, y);
        c.ellipse(x, y, 1.4 + r() * 2.4, 1 + r() * 1.2, 0, 0, TAU);
      }
      c.fill();
    }
    // Polster aus Blättern
    for (const [x, y, w, h] of [[-20, -11, 21, 12], [12, -13, 25, 15], [-2, -21, 15, 9], [30, -9, 11, 7]]) {
      ell(c, x, y, w, h, '#6f9f54');
      ell(c, x - w * 0.2, y - h * 0.26, w * 0.6, h * 0.46, '#8ab968');
    }
    // Himmelblaue Blütchen mit gelbem Auge
    const q = rngOf(23);
    const blu = [];
    const pol = [[-20, -11, 21, 12, 19], [12, -13, 25, 15, 26], [-2, -21, 15, 9, 11], [30, -9, 11, 7, 7]];
    for (const [x, y, w, h, n] of pol) {
      for (let i = 0; i < n; i++) {
        const a = q() * TAU;
        const d = Math.sqrt(q()) * 0.96;
        blu.push([x + Math.cos(a) * w * d, y + Math.sin(a) * h * d]);
      }
    }
    const sway = Math.sin(t * 0.8) * 0.4;
    c.fillStyle = '#6cc0f0';
    c.beginPath();
    for (const [x, y] of blu) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU - PI / 2;
        const px = x + sway + Math.cos(a) * 1.6;
        const py = y + Math.sin(a) * 1.6;
        c.moveTo(px + 1.15, py);
        c.arc(px, py, 1.15, 0, TAU);
      }
    }
    c.fill();
    c.fillStyle = '#ffe066';
    c.beginPath();
    for (const [x, y] of blu) {
      c.moveTo(x + sway + 0.75, y);
      c.arc(x + sway, y, 0.75, 0, TAU);
    }
    c.fill();
  };

  K.schilf = (c, t) => {
    ring(c, 24, t, 12);
    schilf(c, -14, 0, 52, t, 3, 5);
    schilf(c, 12, 0, 58, t, 5, 6);
    schilf(c, 0, 0, 46, t, 8, 4);
  };

  K.strandschmiele = (c, t) => {
    // Feines Gras mit silbrigen Rispen
    ell(c, 0, 0.4, 26, 3, 'rgba(120,110,80,0.28)');
    c.lineCap = 'round';
    c.strokeStyle = '#7da06a';
    c.lineWidth = 1.1;
    c.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = -1 + (i / 19) * 2;
      const hh = 16 + (1 - Math.abs(a)) * 10 + (i % 3) * 3;
      c.moveTo(a * 8, 0);
      c.quadraticCurveTo(a * 14, -hh * 0.6, a * 28, -hh + Math.abs(a) * 12);
    }
    c.stroke();
    // Halme
    for (let i = 0; i < 11; i++) {
      const a = -1 + (i / 10) * 2;
      const hh = 44 + (1 - Math.abs(a)) * 18 + ((i * 5) % 7);
      const sw = Math.sin(t * 0.9 + i * 0.8) * 1.6;
      const tx = a * 26 + sw;
      const ty = -hh;
      c.strokeStyle = '#94ab78';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(a * 6, 0);
      c.quadraticCurveTo(a * 9, -hh * 0.6, tx, ty);
      c.stroke();
      // Rispe: viele feine, silbrige Zweiglein
      c.strokeStyle = i % 2 ? 'rgba(205,210,218,0.95)' : 'rgba(180,170,198,0.9)';
      c.lineWidth = 0.75;
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const u = k / 8;
        const bx = lerp(a * 12 + sw * 0.6, tx, u);
        const by = lerp(-hh * 0.66, ty, u);
        const l = (1 - u) * 9 + 2;
        c.moveTo(bx, by);
        c.lineTo(bx - l * 0.72 + a * 2, by - l * 0.52);
        c.moveTo(bx, by);
        c.lineTo(bx + l * 0.72 + a * 2, by - l * 0.52);
      }
      c.stroke();
      c.fillStyle = 'rgba(232,236,242,0.95)';
      c.beginPath();
      for (let k = 0; k < 9; k++) {
        const u = k / 9;
        const l = (1 - u) * 9 + 2;
        const bx = lerp(a * 12 + sw * 0.6, tx, u) + (k % 2 ? l * 0.72 : -l * 0.72) + a * 2;
        const by = lerp(-hh * 0.66, ty, u) - l * 0.52;
        c.moveTo(bx + 0.9, by);
        c.arc(bx, by, 0.9, 0, TAU);
      }
      c.fill();
    }
  };

  K.seerose = (c, t) => {
    const b = Math.sin(t * 0.8) * 0.6;
    const blatt = (x, y, rx, ry, cut, col) => {
      c.beginPath();
      c.ellipse(x, y + b * 0.5, rx, ry, 0, cut + 0.24, cut - 0.24 + TAU);
      c.lineTo(x, y + b * 0.5);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.strokeStyle = 'rgba(30,70,40,0.35)';
      c.lineWidth = 0.8;
      c.beginPath();
      for (let i = 1; i < 6; i++) {
        const a = cut + (i / 6) * TAU;
        c.moveTo(x, y + b * 0.5);
        c.lineTo(x + Math.cos(a) * rx * 0.88, y + b * 0.5 + Math.sin(a) * ry * 0.88);
      }
      c.stroke();
    };
    ring(c, 42, t, 13);
    blatt(-27, -3, 17, 5.4, -0.4, '#4f9158');
    blatt(30, -2.4, 15, 4.8, 3.6, '#5a9f60');
    blatt(8, -1.4, 18, 5, 1.2, '#46874f');
    // Knospe
    line(c, [[-34, -3], [-36, -13]], '#6fa35c', 1.4);
    c.beginPath();
    c.moveTo(-40, -13);
    c.quadraticCurveTo(-36, -24, -32, -13);
    c.quadraticCurveTo(-36, -9, -40, -13);
    c.closePath();
    c.fillStyle = '#f6d7df';
    c.fill();
    // Offene Blüte in Weiß und Rosa, Schichten von hinten nach vorn
    c.save();
    c.translate(3, -7 + b);
    const blu = (w, l, col) => {
      c.save();
      c.rotate(w);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(-5.4, -l * 0.55, 0, -l);
      c.quadraticCurveTo(5.4, -l * 0.55, 0, 0);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.restore();
    };
    c.scale(1, 0.92);
    for (const w of [-1.45, -1.05, -0.65, -0.25, 0.25, 0.65, 1.05, 1.45]) blu(w, 25, '#f2c2d0');
    for (const w of [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2]) blu(w, 22, '#fbe3ea');
    for (const w of [-0.9, -0.45, 0, 0.45, 0.9]) blu(w, 17, '#fff8f5');
    ell(c, 0, -4, 6, 4, '#f7c93a');
    c.fillStyle = '#e8a02f';
    c.beginPath();
    for (let i = 0; i < 7; i++) {
      c.moveTo(-4.2 + i * 1.4 + 0.5, -5);
      c.arc(-4.2 + i * 1.4, -5, 0.5, 0, TAU);
    }
    c.fill();
    c.restore();
  };

  K.rotmilan = (c, t) => {
    // Gleitet ruhig, schräg von unten gesehen: lange Flügel, tief gegabelter Schwanz
    const w = 1 + Math.sin(t * 0.42) * 0.025;
    c.save();
    c.translate(Math.sin(t * 0.28) * 2, -37 + Math.sin(t * 0.5) * 2);
    c.rotate(-0.06 + Math.sin(t * 0.37) * 0.03);
    c.scale(1, 0.72);
    // Schwanz
    c.beginPath();
    c.moveTo(-8, -3.4);
    c.lineTo(-26, -7);
    c.quadraticCurveTo(-35, -11, -44, -10);
    c.quadraticCurveTo(-36, -3, -29, 0);
    c.quadraticCurveTo(-36, 3, -44, 10);
    c.quadraticCurveTo(-35, 11, -26, 7);
    c.lineTo(-8, 3.4);
    c.closePath();
    c.fillStyle = grad(c, -44, 0, -8, 0, ['#b84a20', '#dd6d30']);
    c.fill();
    // Lange, am Handgelenk abgewinkelte Flügel
    for (const s of [-1, 1]) {
      c.save();
      c.scale(1, s * w);
      c.translate(0, -2);
      c.rotate(-0.24);
      c.beginPath();
      c.moveTo(9, -3);
      c.quadraticCurveTo(13, -14, 11, -25);
      c.lineTo(6, -35);
      c.lineTo(4, -47);
      c.lineTo(0, -40);
      c.lineTo(-3, -49);
      c.lineTo(-5, -41);
      c.lineTo(-9, -47);
      c.lineTo(-10, -36);
      c.quadraticCurveTo(-9, -18, -9, -3);
      c.closePath();
      c.fillStyle = '#2b2622';
      c.fill();
      // Weißes Fenster
      c.beginPath();
      c.moveTo(11, -25);
      c.quadraticCurveTo(0, -28, -10, -26);
      c.lineTo(-10, -34);
      c.quadraticCurveTo(-2, -36, 6, -34);
      c.closePath();
      c.fillStyle = '#f7efe0';
      c.fill();
      // Rostrotes Armfeld
      c.beginPath();
      c.moveTo(9, -3);
      c.quadraticCurveTo(13, -12, 11, -23);
      c.quadraticCurveTo(0, -25, -10, -23);
      c.lineTo(-9, -3);
      c.closePath();
      c.fillStyle = grad(c, 0, -24, 0, -3, ['#a84a24', '#d0692f']);
      c.fill();
      c.strokeStyle = 'rgba(60,25,10,0.45)';
      c.lineWidth = 0.8;
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        c.moveTo(7 - i * 4.6, -6);
        c.lineTo(7 - i * 4.6, -21);
      }
      c.stroke();
      c.restore();
    }
    // Körper und heller Kopf
    ell(c, 0, 0, 14, 5, '#c9642e');
    ell(c, 14, 0, 5.8, 4.4, '#ece3d3');
    poly(c, [[18.5, -2], [24, 0], [18.5, 2]], '#e8b52a');
    poly(c, [[22, -0.9], [25, 0.8], [22, 0.9]], '#2a2622');
    ell(c, 16, -2.2, 0.9, 0.9, '#1b1a18');
    ell(c, 16, 2.2, 0.9, 0.9, '#1b1a18');
    c.restore();
  };

  BE.landmarks = L;
  BE.critters = K;
})();
