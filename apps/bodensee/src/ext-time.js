/* Zeitreise: vom Trias-Land mit Plateosaurus bis zum See von heute, dazu die Fossil-Grabung bei Öhningen. */
BE.views.zeit = (() => {
  'use strict';
  const { TAU, ell, line, grad, rr } = BE.art;
  let W = 1;
  let H = 1;
  let S = 1;
  let era = 0;
  let trans = null;
  let actors = [];
  let press = null;
  let walkT = 0;

  const scene = () => BE.eraArt && BE.eraArt[BE.eras[era].id];
  function makeActors() {
    const art = scene();
    actors = [];
    if (!art) return;
    for (const id of Object.keys(art.creatures)) {
      const def = art.creatures[id];
      const item = BE.eras[era].creatures[id];
      actors.push({ id, def, item, off: 0, dir: 1, ph: id.length * 1.7 });
    }
  }
  function layout(w, h) {
    W = w;
    H = h;
    S = Math.max(0.6, Math.min(1.5, h / 640));
  }
  function goTo(i) {
    const next = Math.max(0, Math.min(BE.eras.length - 1, i));
    if (next === era && !trans) return;
    trans = { to: next, t: 0, swapped: false };
    BE.api.Sound.radio();
  }
  function arrive() {
    const e = BE.eras[era];
    BE.store.era = era;
    BE.collect(e.item, true);
    makeActors();
  }
  function trackY() {
    return H - 92;
  }
  function trackX(i) {
    const left = 56;
    return left + ((W - 2 * left) * i) / (BE.eras.length - 1);
  }

  function drawCaption(c) {
    const e = BE.eras[era];
    const top = BE.api.$('extHead').getBoundingClientRect().bottom + 6;
    const maxW = Math.min(W - 24, 620);
    const x = W / 2 - maxW / 2;
    c.font = '600 13.5px "Trebuchet MS","Avenir Next",system-ui,sans-serif';
    const words = _t(e.line).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (c.measureText(test).width > maxW - 28) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    const h = 30 + lines.length * 18 + 8;
    c.fillStyle = 'rgba(4,28,36,0.72)';
    rr(c, x, top, maxW, h, 14);
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffd23f';
    const head = `${_t(e.when)} · ${_t(e.short)}`;
    let size = 16;
    c.font = `700 ${size}px "Trebuchet MS","Avenir Next",system-ui,sans-serif`;
    while (size > 11 && c.measureText(head).width > maxW - 16) {
      size -= 1;
      c.font = `700 ${size}px "Trebuchet MS","Avenir Next",system-ui,sans-serif`;
    }
    c.fillText(head, W / 2, top + 17);
    c.fillStyle = '#eaf6f3';
    c.font = '600 13.5px "Trebuchet MS","Avenir Next",system-ui,sans-serif';
    lines.forEach((l, i) => c.fillText(l, W / 2, top + 36 + i * 18));
    return { x, y: top, w: maxW, h };
  }
  function drawTrack(c, t) {
    const y = trackY();
    c.fillStyle = 'rgba(4,28,36,0.72)';
    rr(c, 8, y - 22, W - 16, 44, 22);
    c.fill();
    line(c, [[trackX(0), y], [trackX(BE.eras.length - 1), y]], 'rgba(255,255,255,0.45)', 3);
    BE.eras.forEach((e, i) => {
      const x = trackX(i);
      const on = i === era;
      const got = BE.has(e.item);
      ell(c, x, y, on ? 10 : 6.5, on ? 10 : 6.5, on ? '#ffd23f' : got ? '#eaf6f3' : 'rgba(255,255,255,0.5)');
      if (on) {
        c.lineWidth = 2;
        c.strokeStyle = '#fff';
        c.stroke();
      }
    });
    for (const [x, d] of [[26, -1], [W - 26, 1]]) {
      const off = (d < 0 && era === 0) || (d > 0 && era === BE.eras.length - 1);
      ell(c, x, y, 18, 18, off ? 'rgba(255,255,255,0.2)' : '#ffd23f');
      line(c, [[x - d * 4, y - 7], [x + d * 4, y], [x - d * 4, y + 7]], '#3a2a00', 3);
    }
  }
  function screenPos(a) {
    // Low screens: feet stay above the timeline.
    return { x: a.def.x * W + a.off * S * (a.def.s || 1), y: Math.min(a.def.y * H, trackY() - 26) };
  }
  function drawActors(c, t, dt) {
    for (const a of actors) {
      const roam = a.def.roam || 0;
      if (roam) {
        a.off += a.dir * dt * 18;
        if (Math.abs(a.off) > roam) a.dir *= -1;
      }
      const p = screenPos(a);
      const k = S * (a.def.s || 1);
      c.save();
      c.translate(p.x, p.y);
      c.scale(k * (a.dir < 0 && roam ? -1 : 1), k);
      a.def.draw(c, t, roam ? t * 3 + a.ph : 0);
      c.restore();
      if (a.item && !BE.has(a.item)) {
        const bx = p.x;
        const by = Math.max(70, p.y - a.def.h * k - 16 + Math.sin(t * 3 + a.ph) * 4);
        ell(c, bx, by, 13, 13, '#ffd23f');
        c.lineWidth = 2;
        c.strokeStyle = '#fff';
        c.stroke();
        c.font = '700 15px "Trebuchet MS",system-ui,sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#3a2a00';
        c.fillText('?', bx, by + 0.5);
      }
    }
  }
  function drawTrans(c) {
    if (!trans) return;
    const u = trans.t / 1.1;
    const a = u < 0.5 ? u / 0.5 : (1 - u) / 0.5;
    c.fillStyle = `rgba(4,20,28,${Math.max(0, Math.min(1, a)).toFixed(3)})`;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = Math.max(0, Math.min(1, a));
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffd23f';
    c.font = '700 26px "Trebuchet MS",system-ui,sans-serif';
    c.fillText(_t(BE.eras[trans.to].when), W / 2, H / 2 - 10);
    for (let i = 0; i < 26; i++) {
      const r = ((trans.t * 300 + i * 53) % 340) + 60;
      const ang = (i / 26) * TAU;
      line(c, [[W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r], [W / 2 + Math.cos(ang) * (r + 26), H / 2 + Math.sin(ang) * (r + 26)]], 'rgba(255,210,63,0.5)', 2);
    }
    c.globalAlpha = 1;
  }

  let captionBox = null;
  return {
    title: 'Zeitreise',
    subtitle: 'Wähle unten eine Zeit und tippe die Tiere an',
    enter(w, h) {
      layout(w, h);
      era = BE.store.era === undefined ? 0 : BE.store.era;
      arrive();
      trans = null;
      if (!BE.store.flags.zeitHint) {
        BE.store.flags.zeitHint = 1;
        BE.toast('Ganz links: die Zeit der Saurier. Ganz rechts: heute.', 4.5);
      }
    },
    resize: layout,
    frame(c, w, h, dt, t) {
      if (trans) {
        trans.t += dt;
        if (!trans.swapped && trans.t > 0.55) {
          trans.swapped = true;
          era = trans.to;
          arrive();
        }
        if (trans.t > 1.1) trans = null;
      }
      walkT += dt;
      const art = scene();
      if (art) art.back(c, w, h, t);
      else {
        c.fillStyle = grad(c, 0, 0, 0, h, ['#8fd0e6', '#2f7f8f']);
        c.fillRect(0, 0, w, h);
      }
      drawActors(c, t, dt);
      captionBox = drawCaption(c);
      drawTrack(c, t);
      drawTrans(c);
    },
    down(x, y) {
      press = { x, y, moved: false };
    },
    move(x, y) {
      if (press && Math.abs(x - press.x) > 50) press.moved = true;
    },
    up(x, y) {
      if (!press) return;
      const dx = x - press.x;
      const swiped = press.moved && Math.abs(dx) > 70;
      press = null;
      if (trans) return;
      if (swiped) {
        goTo(era + (dx < 0 ? 1 : -1));
        return;
      }
      const ty = trackY();
      if (Math.abs(y - ty) < 26) {
        if (x < 46) goTo(era - 1);
        else if (x > W - 46) goTo(era + 1);
        else {
          let best = era;
          let bd = 1e9;
          BE.eras.forEach((e, i) => {
            const d = Math.abs(trackX(i) - x);
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          goTo(best);
        }
        return;
      }
      if (captionBox && x > captionBox.x && x < captionBox.x + captionBox.w && y > captionBox.y && y < captionBox.y + captionBox.h) {
        BE.api.Sound.click();
        BE.info(BE.eras[era].item);
        return;
      }
      let hit = null;
      let bd = 1e9;
      for (const a of actors) {
        const p = screenPos(a);
        const k = S * (a.def.s || 1);
        const hw = (a.def.w * k) / 2 + 12;
        if (Math.abs(x - p.x) > hw || y > p.y + 16 || y < p.y - a.def.h * k - 34) continue;
        const d = Math.abs(x - p.x) + Math.abs(y - (p.y - (a.def.h * k) / 2));
        if (d < bd) {
          bd = d;
          hit = a;
        }
      }
      if (hit && hit.item) {
        BE.collect(hit.item);
        BE.info(hit.item);
      }
    },
    key(e, down) {
      if (!down) return e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (e.key === 'ArrowLeft') goTo(era - 1);
      else if (e.key === 'ArrowRight') goTo(era + 1);
      else return false;
      return true;
    },
    goToEra(id) {
      era = BE.eras.findIndex((e) => e.id === id);
      arrive();
    },
    get debug() {
      return { era: BE.eras[era].id, actors: actors.map((a) => a.id) };
    },
  };
})();

// ------------------------------------------------------------------ Fossil-Grabung: Staub wegwischen, bis der Fund frei liegt
BE.views.grabung = (() => {
  'use strict';
  const { TAU, ell, line, box, grad, rr } = BE.art;
  const FINDS = ['salamander', 'blatt', 'libelle'];
  const CELLS_X = 26;
  const CELLS_Y = 16;
  let W = 1;
  let H = 1;
  let rect = { x: 0, y: 0, w: 1, h: 1 };
  let mask = null;
  let mc = null;
  let found = 0;
  let cells = null;
  let cleared = 0;
  let last = null;
  let done = false;

  // Fossils are drawn in a 0..640 by 0..400 plate.
  const DRAW = {
    salamander(c) {
      const bone = '#f1e6c8';
      line(c, [[120, 215], [210, 205], [330, 200], [440, 205], [540, 235], [590, 275]], bone, 8);
      ell(c, 92, 212, 46, 36, bone);
      ell(c, 80, 205, 8, 8, '#8f7f5c');
      ell(c, 106, 202, 8, 8, '#8f7f5c');
      for (let i = 0; i < 22; i++) {
        const x = 150 + i * 16;
        const y = 208 + Math.sin(i * 0.2) * 4 + (i > 16 ? (i - 16) * 3 : 0);
        const len = Math.max(8, 34 - i);
        line(c, [[x, y - len], [x, y + len]], bone, 3);
      }
      for (const [x, d] of [[200, -1], [200, 1], [400, -1], [400, 1]]) {
        const y0 = 208;
        const y1 = y0 + d * 66;
        line(c, [[x, y0], [x - 14, y0 + d * 34], [x - 6, y1]], bone, 6);
        for (let k = -2; k <= 2; k++) line(c, [[x - 6, y1], [x - 6 + k * 8, y1 + d * 20]], bone, 3);
      }
    },
    blatt(c) {
      const col = '#a98e5a';
      c.beginPath();
      c.moveTo(150, 200);
      c.quadraticCurveTo(320, 60, 500, 200);
      c.quadraticCurveTo(320, 340, 150, 200);
      c.fillStyle = col;
      c.fill();
      line(c, [[130, 200], [510, 200]], '#6f5a35', 5);
      for (let i = 0; i < 7; i++) {
        const x = 200 + i * 42;
        const h = 88 - Math.abs(i - 3) * 16;
        line(c, [[x, 200], [x + 30, 200 - h]], '#6f5a35', 2.4);
        line(c, [[x, 200], [x + 30, 200 + h]], '#6f5a35', 2.4);
      }
    },
    libelle(c) {
      const col = '#5a4a32';
      line(c, [[320, 90], [320, 320]], col, 11);
      ell(c, 320, 86, 17, 15, col);
      for (const d of [-1, 1]) {
        for (const [y, len] of [[135, 210], [175, 190]]) {
          c.beginPath();
          c.moveTo(320, y);
          c.quadraticCurveTo(320 + d * len * 0.6, y - 42, 320 + d * len, y - 12);
          c.quadraticCurveTo(320 + d * len * 0.6, y + 26, 320, y + 12);
          c.fillStyle = 'rgba(120,100,70,0.5)';
          c.fill();
          line(c, [[320, y + 4], [320 + d * len * 0.92, y - 10]], col, 2);
        }
      }
    },
  };

  function reset() {
    done = false;
    cleared = 0;
    last = null;
    cells = new Uint8Array(CELLS_X * CELLS_Y);
    mask = document.createElement('canvas');
    mask.width = 640;
    mask.height = 400;
    mc = mask.getContext('2d');
    mc.fillStyle = '#b39f76';
    mc.fillRect(0, 0, 640, 400);
    const r = BE.art.rngOf(1725 + found);
    for (let i = 0; i < 420; i++) {
      mc.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.17)' : 'rgba(240,225,190,0.15)';
      mc.beginPath();
      mc.ellipse(r() * 640, r() * 400, 6 + r() * 30, 4 + r() * 12, r() * 3, 0, TAU);
      mc.fill();
    }
    mc.globalCompositeOperation = 'destination-out';
  }
  function layout(w, h) {
    W = w;
    H = h;
    const top = 118;
    const bottom = 78;
    const availW = w - 28;
    const availH = h - top - bottom;
    const k = Math.min(availW / 640, availH / 400);
    rect = { w: 640 * k, h: 400 * k, x: (w - 640 * k) / 2, y: top + (availH - 400 * k) / 2 };
  }
  function brush(x, y) {
    if (done) return;
    // A swipe past the edge still clears up to the edge.
    const mx = Math.max(0, Math.min(640, ((x - rect.x) / rect.w) * 640));
    const my = Math.max(0, Math.min(400, ((y - rect.y) / rect.h) * 400));
    const from = last || { x: mx, y: my };
    mc.lineCap = 'round';
    mc.lineWidth = 52;
    mc.strokeStyle = 'rgba(0,0,0,1)';
    mc.beginPath();
    mc.moveTo(from.x, from.y);
    mc.lineTo(mx, my + 0.01);
    mc.stroke();
    // Fast swipes arrive as long jumps, so count the whole stroke and not only its end.
    const steps = Math.max(1, Math.ceil(Math.hypot(mx - from.x, my - from.y) / 18));
    for (let k = 0; k <= steps; k++) {
      const sx = from.x + ((mx - from.x) * k) / steps;
      const sy = from.y + ((my - from.y) * k) / steps;
      for (let j = 0; j < CELLS_Y; j++) {
        for (let i = 0; i < CELLS_X; i++) {
          const n = j * CELLS_X + i;
          if (!cells[n] && Math.hypot(((i + 0.5) / CELLS_X) * 640 - sx, ((j + 0.5) / CELLS_Y) * 400 - sy) < 32) {
            cells[n] = 1;
            cleared++;
          }
        }
      }
    }
    last = { x: mx, y: my };
    if (Math.random() < 0.3) BE.api.Sound.bubble();
    if (cleared / cells.length >= 0.78) finish();
  }
  function finish() {
    done = true;
    mc.fillRect(0, 0, 640, 400);
    const id = `fund-${FINDS[found]}`;
    BE.api.Sound.fanfare();
    setTimeout(() => {
      BE.collect(id, true);
      const more = found < FINDS.length - 1;
      BE.info(id, { action: more ? { label: 'Nächste Steinplatte', run: () => { found += 1; reset(); BE.show('grabung', found); } } : null });
    }, 700);
  }
  return {
    title: 'Fossil-Grabung',
    subtitle: 'Wische den Staub vorsichtig weg',
    enter(w, h, which) {
      layout(w, h);
      if (typeof which === 'number') found = which;
      else {
        const open = FINDS.findIndex((f) => !BE.has(`fund-${f}`));
        found = open < 0 ? 0 : open;
      }
      reset();
    },
    resize: layout,
    frame(c, w, h) {
      c.fillStyle = grad(c, 0, 0, 0, h, ['#ddc99b', '#a98e5f']);
      c.fillRect(0, 0, w, h);
      c.save();
      c.translate(rect.x, rect.y);
      c.scale(rect.w / 640, rect.h / 400);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      rr(c, 6, 10, 640, 400, 18);
      c.fill();
      c.fillStyle = grad(c, 0, 0, 0, 400, ['#d9cdaf', '#c4b591']);
      rr(c, 0, 0, 640, 400, 18);
      c.fill();
      c.save();
      rr(c, 0, 0, 640, 400, 18);
      c.clip();
      for (let i = 1; i < 8; i++) box(c, 0, i * 50, 640, 2, 'rgba(90,70,40,0.14)');
      DRAW[FINDS[found]](c);
      c.drawImage(mask, 0, 0);
      c.restore();
      c.restore();
      const p = Math.min(1, cleared / cells.length / 0.78);
      const bw = Math.min(280, w - 60);
      const x = (w - bw) / 2;
      const y = rect.y - 22;
      c.fillStyle = 'rgba(4,28,36,0.6)';
      rr(c, x, y, bw, 12, 6);
      c.fill();
      c.fillStyle = '#ffd23f';
      rr(c, x, y, Math.max(12, bw * p), 12, 6);
      c.fill();
    },
    down(x, y) {
      last = null;
      brush(x, y);
    },
    move(x, y) {
      brush(x, y);
    },
    up() {
      last = null;
    },
    leave() {
      last = null;
    },
  };
})();
