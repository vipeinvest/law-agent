/* Seekarte: der See aus der Vogelschau mit Ländern, Grenzen und allen Orten.
 * Uferlinien: Natural Earth (gemeinfrei). Grenzverläufe und Flüsse sind fürs Spiel vereinfacht.
 */
BE.views.karte = (() => {
  'use strict';
  const { TAU, rngOf, poly, ell, line, grad, flagPlain, sailboat } = BE.art;
  const OBERSEE = [[9.719, 47.547], [9.732, 47.538], [9.744, 47.52], [9.702, 47.522], [9.69, 47.52], [9.687, 47.516], [9.681, 47.503], [9.676, 47.499], [9.67, 47.498], [9.649, 47.499], [9.643, 47.502], [9.641, 47.51], [9.635, 47.512], [9.627, 47.51], [9.615, 47.502], [9.608, 47.499], [9.593, 47.499], [9.579, 47.502], [9.566, 47.506], [9.553, 47.512], [9.518, 47.493], [9.495, 47.488], [9.402, 47.543], [9.398, 47.544], [9.382, 47.57], [9.381, 47.574], [9.371, 47.581], [9.207, 47.647], [9.183, 47.671], [9.206, 47.672], [9.206, 47.682], [9.183, 47.704], [9.175, 47.719], [9.169, 47.733], [9.162, 47.747], [9.149, 47.76], [9.131, 47.768], [9.091, 47.779], [9.073, 47.787], [9.04, 47.811], [9.032, 47.821], [9.072, 47.817], [9.176, 47.766], [9.203, 47.762], [9.211, 47.76], [9.216, 47.751], [9.222, 47.729], [9.227, 47.725], [9.322, 47.682], [9.341, 47.678], [9.384, 47.677], [9.403, 47.675], [9.457, 47.656], [9.488, 47.654], [9.498, 47.65], [9.507, 47.642], [9.511, 47.633], [9.515, 47.623], [9.522, 47.613], [9.538, 47.599], [9.553, 47.593], [9.594, 47.588], [9.635, 47.574], [9.676, 47.554]];
  const UNTERSEE = [[9.066, 47.723], [9.104, 47.701], [9.127, 47.671], [9.016, 47.679], [8.997, 47.674], [8.981, 47.662], [8.945, 47.654], [8.906, 47.652], [8.881, 47.656], [8.915, 47.656], [8.935, 47.668], [8.986, 47.687], [9.005, 47.704], [8.957, 47.728], [8.946, 47.732], [8.943, 47.734], [8.943, 47.738], [8.946, 47.743], [8.949, 47.746], [8.956, 47.747], [8.961, 47.745], [8.966, 47.741], [8.971, 47.739], [8.981, 47.738], [8.989, 47.737], [9.005, 47.732], [9.005, 47.739], [8.984, 47.746], [8.984, 47.752]];
  const ISLANDS = [[9.066, 47.701, 0.026, 0.0085, -0.35], [9.195, 47.704, 0.009, 0.006, 0], [9.684, 47.545, 0.008, 0.005, 0]];
  const CH_LAND = [[8.6, 47.3], [8.6, 47.74], [8.82, 47.72], [8.86, 47.69], [8.885, 47.665], [8.98, 47.672], [9.05, 47.672], [9.1, 47.675], [9.127, 47.668], [9.165, 47.655], [9.19, 47.664], [9.3, 47.625], [9.5, 47.565], [9.58, 47.53], [9.585, 47.495], [9.6, 47.44], [9.6, 47.3]];
  const AT_LAND = [[9.6, 47.3], [9.6, 47.44], [9.585, 47.495], [9.58, 47.53], [9.66, 47.54], [9.7, 47.55], [9.74, 47.58], [9.8, 47.6], [10, 47.6], [10, 47.3]];
  const BORDER_LAND = [
    [[8.6, 47.74], [8.82, 47.72], [8.86, 47.69], [8.885, 47.665], [8.98, 47.672], [9.05, 47.672], [9.1, 47.675], [9.127, 47.668], [9.165, 47.655], [9.19, 47.664]],
    [[9.585, 47.495], [9.6, 47.44], [9.6, 47.3]],
    [[9.7, 47.55], [9.74, 47.58], [9.8, 47.6], [10, 47.6]],
  ];
  const BORDER_LAKE = [[[9.19, 47.664], [9.3, 47.625], [9.5, 47.565], [9.58, 47.53], [9.585, 47.495]], [[9.58, 47.53], [9.66, 47.54], [9.7, 47.55]]];
  const RIVERS = [
    [[9.64, 47.3], [9.63, 47.4], [9.635, 47.46], [9.625, 47.51]],
    [[9.6, 47.44], [9.59, 47.47], [9.575, 47.502]],
    [[9.79, 47.44], [9.76, 47.47], [9.735, 47.525]],
    [[9.64, 47.66], [9.63, 47.61], [9.6, 47.587]],
    [[9.56, 47.86], [9.52, 47.74], [9.49, 47.653]],
    [[9.127, 47.671], [9.175, 47.664]],
    [[8.881, 47.656], [8.82, 47.676], [8.7, 47.69], [8.6, 47.68]],
  ];
  const LON0 = 8.8;
  const LON1 = 9.86;
  const LAT0 = 47.87;
  const LAT1 = 47.43;
  const KX = Math.cos((47.65 * Math.PI) / 180);
  const SPAN_X = (LON1 - LON0) * KX;
  const SPAN_Y = LAT0 - LAT1;

  let k = 1000;
  let mw = 1;
  let mh = 1;
  let ox = 0;
  let oy = 0;
  let W = 1;
  let H = 1;
  let stat = null;
  let labels = [];
  let waves = [];
  let drag = null;
  let boat = { lon: 9.3, lat: 47.625, tx: 9.45, ty: 47.59 };

  const px = (lon) => (lon - LON0) * KX * k;
  const py = (lat) => (LAT0 - lat) * k;

  function inside(pts, lon, lat) {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  function trace(c, pts) {
    pts.forEach((p, i) => (i ? c.lineTo(px(p[0]), py(p[1])) : c.moveTo(px(p[0]), py(p[1]))));
    c.closePath();
  }
  function caption(c, text, x, y, size, col, weight, halo) {
    c.font = `${weight || 700} ${size}px "Trebuchet MS","Avenir Next",system-ui,sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(2.5, size * 0.22);
    c.strokeStyle = halo || 'rgba(255,255,255,0.88)';
    c.strokeText(text, x, y);
    c.fillStyle = col;
    c.fillText(text, x, y);
  }

  function paintStatic() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    stat = document.createElement('canvas');
    stat.width = Math.round(mw * dpr);
    stat.height = Math.round(mh * dpr);
    const c = stat.getContext('2d');
    c.scale(dpr, dpr);
    // land with soft hills
    c.fillStyle = grad(c, 0, 0, 0, mh, ['#bcd98f', '#a8cf86', '#9cc482']);
    c.fillRect(0, 0, mw, mh);
    const r = rngOf(1864);
    for (let i = 0; i < 260; i++) {
      const x = r() * mw;
      const y = r() * mh;
      const s = (12 + r() * 40) * (k / 1400);
      c.fillStyle = r() < 0.5 ? 'rgba(255,255,220,0.07)' : 'rgba(40,90,50,0.07)';
      c.beginPath();
      c.ellipse(x, y, s * 1.6, s, r() * 3, 0, TAU);
      c.fill();
    }
    // countries
    c.beginPath();
    trace(c, CH_LAND);
    c.fillStyle = 'rgba(214,72,60,0.11)';
    c.fill();
    c.beginPath();
    trace(c, AT_LAND);
    c.fillStyle = 'rgba(240,170,70,0.17)';
    c.fill();
    // Alps along the southern edge
    c.save();
    const base = py(47.47);
    c.globalAlpha = 0.8;
    for (let i = 0; i < 24; i++) {
      const lon = 9.02 + i * 0.035 + r() * 0.012;
      const x = px(lon);
      const y = base + (r() - 0.3) * 18 * (k / 1400) + (lon > 9.55 ? -16 : 8) * (k / 1400);
      const s = (24 + r() * 26) * (k / 1400);
      poly(c, [[x - s, y], [x + s, y], [x, y - s * 1.2]], '#8fa6a3');
      poly(c, [[x - s * 0.34, y - s * 0.8], [x + s * 0.34, y - s * 0.8], [x, y - s * 1.2]], '#fff');
    }
    c.restore();
    // rivers
    for (const rv of RIVERS) line(c, rv.map((p) => [px(p[0]), py(p[1])]), '#5fb4cc', Math.max(2.2, k / 420));
    // lake
    for (const lake of [OBERSEE, UNTERSEE]) {
      c.beginPath();
      trace(c, lake);
      c.fillStyle = grad(c, 0, py(47.82), 0, py(47.49), ['#3fa3bd', '#1c7792', '#1f86a2']);
      c.fill();
      c.lineWidth = Math.max(2, k / 500);
      c.strokeStyle = '#efe6c4';
      c.lineJoin = 'round';
      c.stroke();
    }
    // the deep middle of the upper lake
    c.save();
    c.beginPath();
    trace(c, OBERSEE);
    c.clip();
    c.filter = 'none';
    const dg = c.createRadialGradient(px(9.39), py(47.61), 0, px(9.39), py(47.61), 0.13 * k);
    dg.addColorStop(0, 'rgba(6,50,80,0.55)');
    dg.addColorStop(1, 'rgba(6,50,80,0)');
    c.fillStyle = dg;
    c.fillRect(0, 0, mw, mh);
    c.restore();
    for (const [lon, lat, a, b, rot] of ISLANDS) {
      ell(c, px(lon), py(lat), a * KX * k, b * k, '#a8cf86', rot);
      c.lineWidth = 1.5;
      c.strokeStyle = '#efe6c4';
      c.stroke();
    }
    // borders
    c.setLineDash([]);
    for (const b of BORDER_LAND) line(c, b.map((p) => [px(p[0]), py(p[1])]), 'rgba(150,40,40,0.85)', Math.max(2, k / 560));
    c.setLineDash([k / 150, k / 170]);
    for (const b of BORDER_LAKE) line(c, b.map((p) => [px(p[0]), py(p[1])]), 'rgba(255,255,255,0.72)', Math.max(1.6, k / 640));
    c.setLineDash([]);
    // country names with flags
    const big = Math.max(15, k / 62);
    for (const [land, name, lon, lat] of [['de', 'Deutschland', 9.36, 47.8], ['ch', 'Schweiz', 9.17, 47.51], ['at', 'Österreich', 9.77, 47.47]]) {
      caption(c, _t(name), px(lon), py(lat), big, '#29352f');
      flagPlain(c, px(lon) - big * 0.9, py(lat) - big * 1.75, big * 1.8, big * 1.1, land);
    }
    caption(c, _t('Bodensee'), px(9.43), py(47.635), Math.max(13, k / 74), '#f4fbf9', 700, 'rgba(6,50,80,0.8)');
    const arrowX = px(9.54);
    const arrowY = py(47.445);
    flagPlain(c, arrowX - big * 0.5, arrowY - big * 0.34, big, big * 0.62, 'li');
    caption(c, _t('Liechtenstein: weiter südlich'), arrowX, arrowY + big * 0.72, Math.max(10, k / 118), '#29352f', 600);
    caption(c, _t('Karte vereinfacht'), mw - 70, mh - 12, 10.5, '#4a5a4f', 500);
  }

  function layout() {
    const fitW = W / SPAN_X;
    const fitH = (H - 118) / SPAN_Y;
    // Upright phones zoom in and pan, the lake is far wider than tall.
    k = Math.max(Math.min(fitW, fitH), 950, H > W ? fitH : 0);
    mw = SPAN_X * k;
    mh = SPAN_Y * k;
    if (mw > W) {
      const here = (BE.placeAtWalk && BE.placeAtWalk()) || { lon: 9.3 };
      ox = W / 2 - px(here.lon);
    }
    clampPan();
    paintStatic();
    // label only what fits, the bigger places first
    labels = [];
    const size = Math.max(10.5, Math.min(13.5, k / 110));
    const boxes = [];
    const order = [...BE.places].sort((a, b) => (b.big || 0) - (a.big || 0));
    const measure = stat.getContext('2d');
    measure.font = `700 ${size}px "Trebuchet MS",system-ui,sans-serif`;
    for (const p of order) {
      const x = px(p.lon);
      const y = py(p.lat);
      const tw = measure.measureText(_t(p.name)).width + 6;
      const below = p.labelBelow ? 1 : -1;
      const b = { x0: x - tw / 2, x1: x + tw / 2, y0: y + below * 15 - 8, y1: y + below * 15 + 8 };
      if (boxes.some((q) => q.x0 < b.x1 && q.x1 > b.x0 && q.y0 < b.y1 && q.y1 > b.y0)) continue;
      boxes.push(b);
      labels.push({ text: _t(p.name), x, y: y + below * 15, size });
    }
    const rr = rngOf(5);
    waves = [];
    for (let i = 0; i < 400 && waves.length < 90; i++) {
      const lon = 8.88 + rr() * 0.88;
      const lat = 47.48 + rr() * 0.35;
      if (inside(OBERSEE, lon, lat) || inside(UNTERSEE, lon, lat)) waves.push({ x: px(lon), y: py(lat), ph: rr() * TAU, s: 0.6 + rr() });
    }
  }
  function clampPan() {
    ox = mw <= W ? (W - mw) / 2 : Math.min(0, Math.max(W - mw, ox));
    const top = 62;
    const bottom = 62;
    oy = mh <= H - top - bottom ? top + (H - top - bottom - mh) / 2 : Math.min(top, Math.max(H - bottom - mh, oy));
  }

  const pinColor = { at: '#d9503f', de: '#3b3b3b', ch: '#c9281d' };
  function drawPin(c, p, t, near) {
    const x = px(p.lon);
    const y = py(p.lat);
    const got = BE.has(`ort-${p.id}`);
    const r = (p.big ? 7.5 : 6) + (near ? Math.sin(t * 4) * 1.4 : 0);
    ell(c, x, y + 1.5, r + 1.5, r + 1.5, 'rgba(0,0,0,0.25)');
    ell(c, x, y, r + 1.6, r + 1.6, '#fff');
    ell(c, x, y, r, r, got ? '#f4b81c' : pinColor[p.land]);
    if (got) line(c, [[x - r * 0.5, y], [x - r * 0.1, y + r * 0.45], [x + r * 0.55, y - r * 0.45]], '#3a2a00', 1.8);
  }
  function drawSpot(c, s, t) {
    const x = px(s.lon);
    const y = py(s.lat);
    const got = BE.has(s.id);
    const r = 12.5 + (got ? 0 : Math.sin(t * 3 + x) * 1.6);
    ell(c, x, y + 2, r, r, 'rgba(0,0,0,0.25)');
    ell(c, x, y, r, r, got ? '#fff7d6' : '#ffd23f');
    c.lineWidth = 2;
    c.strokeStyle = got ? '#b08a2c' : '#fff';
    c.stroke();
    c.font = '700 13px "Trebuchet MS",system-ui,sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#3a2a00';
    c.fillText(s.icon, x, y + 0.5);
  }

  function hit(x, y) {
    const mx = x - ox;
    const my = y - oy;
    let best = null;
    let bd = 26;
    for (const s of BE.mapSpots) {
      const d = Math.hypot(px(s.lon) - mx, py(s.lat) - my);
      if (d < bd) {
        bd = d;
        best = { spot: s };
      }
    }
    for (const p of BE.places) {
      const d = Math.hypot(px(p.lon) - mx, py(p.lat) - my);
      if (d < bd) {
        bd = d;
        best = { place: p };
      }
    }
    return best;
  }
  function openPlace(p) {
    BE.api.Sound.click();
    if (inside(OBERSEE, p.lon, p.lat)) {
      boat.tx = p.lon;
      boat.ty = p.lat;
    }
    BE.info(`ort-${p.id}`, { action: { label: BE.has(`ort-${p.id}`) ? 'Nochmal hingehen' : 'Hingehen und Stempel holen', run: () => BE.show('ufer', p.id) } });
  }
  function openSpot(s) {
    BE.collect(s.id);
    BE.info(s.id);
  }

  return {
    title: 'Seekarte',
    subtitle: 'Tippe auf einen Ort oder ein gelbes Zeichen',
    enter(w, h) {
      W = w;
      H = h;
      layout();
      if (!BE.store.flags.karteHint) {
        BE.store.flags.karteHint = 1;
        BE.toast(mw > W ? 'Ziehe die Karte mit dem Finger, dort ist noch mehr.' : 'Rot, schwarz oder gelb: Jeder Punkt ist ein Ort. Tippe drauf und geh hin!', 5);
      }
    },
    resize(w, h) {
      W = w;
      H = h;
      layout();
    },
    frame(c, w, h, dt, t) {
      c.fillStyle = '#9cc482';
      c.fillRect(0, 0, w, h);
      c.save();
      c.translate(ox, oy);
      c.drawImage(stat, 0, 0, mw, mh);
      for (const v of waves) {
        const a = 0.14 + 0.14 * Math.sin(t * 0.8 + v.ph);
        const dx = Math.sin(t * 0.25 + v.ph) * 5;
        line(c, [[v.x + dx - 6 * v.s, v.y], [v.x + dx, v.y - 1.3], [v.x + dx + 6 * v.s, v.y]], `rgba(255,255,255,${a.toFixed(3)})`, 1.2);
      }
      for (const s of BE.mapSpots) drawSpot(c, s, t);
      const here = BE.placeAtWalk ? BE.placeAtWalk() : null;
      for (const p of BE.places) drawPin(c, p, t, here && here.id === p.id);
      for (const l of labels) caption(c, l.text, l.x, l.y, l.size, '#22302a');
      // the little research boat follows your taps
      boat.lon += (boat.tx - boat.lon) * Math.min(1, dt * 1.1);
      boat.lat += (boat.ty - boat.lat) * Math.min(1, dt * 1.1);
      if (inside(OBERSEE, boat.lon, boat.lat)) sailboat(c, px(boat.lon), py(boat.lat), 0.42, t, '#ffd23f');
      if (here) {
        const x = px(here.lon);
        const y = py(here.lat);
        const bob = Math.sin(t * 3) * 2;
        BE.art.kid(c, x, y - 8 + bob, 0.5, 1, 0);
      }
      c.restore();
    },
    screenOf(id) {
      const p = BE.places.find((q) => q.id === id);
      return { x: ox + px(p.lon), y: oy + py(p.lat) };
    },
    down(x, y) {
      drag = { x, y, ox, oy, moved: false };
    },
    move(x, y) {
      if (!drag) return;
      if (Math.hypot(x - drag.x, y - drag.y) > 8) drag.moved = true;
      if (drag.moved) {
        ox = drag.ox + x - drag.x;
        oy = drag.oy + y - drag.y;
        clampPan();
      }
    },
    up(x, y) {
      if (drag && !drag.moved) {
        const h = hit(x, y);
        if (h && h.place) openPlace(h.place);
        else if (h && h.spot) openSpot(h.spot);
      }
      drag = null;
    },
  };
})();
