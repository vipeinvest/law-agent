/* Landgang: der Uferweg einmal rund um den See, als Rundweg in Seitenansicht.
 * Orte geben Stempel, Sehenswürdigkeiten und Tiere landen im Forscherbuch.
 */
BE.views.ufer = (() => {
  'use strict';
  const { TAU, rngOf, box, ell, line, grad, flag, flagPlain, cloud, tree, reed, flower, bird, ridge, house, sailboat, kid } = BE.art;
  const LAND_NAME = { at: 'Österreich', de: 'Deutschland', ch: 'Schweiz' };
  const WELCOME = { at: 'Willkommen in Österreich!', de: 'Willkommen in Deutschland!', ch: 'Willkommen in der Schweiz!' };
  const SPEED = 240;
  const REACH = 120;

  let built = false;
  let objs = [];
  let L = 1;
  let stops = [];
  let sails = [];
  let clouds = [];
  let birds = [];
  let flora = [];
  const me = { x: 0, v: 0, face: 1, walk: 0, target: null };
  const keys = { left: false, right: false };
  let press = null;
  let W = 1;
  let H = 1;
  let S = 1;
  let GY = 1;
  let scan = null;
  let stampFx = null;
  let shownPlace = null;
  let lastLand = null;

  function build() {
    if (built) return;
    built = true;
    const r = rngOf(1900);
    let x = 260;
    for (const stop of BE.shore) {
      const place = BE.places.find((p) => p.id === stop.place);
      if (stop.border) {
        objs.push({ type: 'border', x, w: 90, h: 150, item: stop.border.item, a: stop.border.from, b: place.land, hit: true });
        x += 300;
      }
      stops.push({ place, x, alps: stop.alps === undefined ? 0.5 : stop.alps });
      objs.push({ type: 'sign', x, w: 110, h: 120, place, item: `ort-${place.id}`, hit: true });
      x += 120;
      const count = place.big ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const w = 62 + r() * 46;
        const h = 58 + r() * (place.big ? 74 : 40);
        objs.push({ type: 'house', x: x + w / 2, w, h, style: stop.style || 'plain', seed: Math.floor(r() * 9999) });
        x += w + 8 + r() * 14;
      }
      if (r() < 0.6) objs.push({ type: 'flag', x: x + 14, land: place.land, h: 96 });
      x += 90;
      for (const id of stop.spots || []) {
        const it = BE.spot(id);
        const w = it.size || (it.critter ? 90 : 400);
        x += w / 2;
        objs.push({ type: it.critter ? 'critter' : 'landmark', x, w, h: it.height || (it.critter ? 80 : 300), draw: it.draw || it.critter, item: it.id, where: it.where || 'land', hit: true });
        x += w / 2 + 90;
      }
      // a quiet stretch with trees before the next place
      const gap = 170 + r() * 150;
      const kinds = stop.trees || ['laub', 'pappel', 'laub', 'apfel'];
      for (let i = 0; i < 3; i++) objs.push({ type: 'tree', x: x + (gap / 3) * i + r() * 26, h: 90 + r() * 70, kind: kinds[Math.floor(r() * kinds.length)], seed: Math.floor(r() * 999) });
      x += gap;
    }
    L = x + 240;
    for (let i = 0; i < 10; i++) sails.push({ x: r() * 5200, y: r(), s: 0.45 + r() * 0.5, col: ['#fff', '#ffd23f', '#e8664a', '#7fc2d6'][Math.floor(r() * 4)] });
    for (let i = 0; i < 9; i++) clouds.push({ x: r() * 2600, y: 0.05 + r() * 0.2, s: 0.5 + r() * 0.9 });
    for (let i = 0; i < 6; i++) birds.push({ x: r() * 1800, y: 0.1 + r() * 0.2, s: 4 + r() * 5, ph: r() * 9 });
    const fl = ['#f4a7c1', '#fff', '#ffd23f', '#7fb8ff', '#e8664a'];
    for (let i = 0; i < 300; i++) flora.push({ x: r() * L, y: 8 + r() * 14, kind: r() < 0.28 ? 'reed' : 'flower', s: 9 + r() * 9, col: fl[Math.floor(r() * fl.length)] });
    flora.sort((a, b) => a.x - b.x);
  }

  const wrap = (x) => ((x % L) + L) % L;
  const near = (a, b) => {
    const d = wrap(a - b);
    return d > L / 2 ? d - L : d;
  };
  function layout(w, h) {
    W = w;
    H = h;
    S = Math.max(0.62, Math.min(1.5, h / 640));
    GY = h - Math.max(82, h * 0.17);
  }
  function placeAt(x) {
    let best = stops[0];
    let bd = 1e9;
    for (const s of stops) {
      const d = Math.abs(near(x, s.x));
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }
  BE.placeAtWalk = () => {
    if (BE.store.walkX === null || !built) return null;
    return placeAt(BE.store.walkX).place;
  };
  function alpsAt(x) {
    const s = placeAt(x);
    return s ? s.alps : 0.5;
  }

  // ------------------------------------------------------------------ drawing
  function drawBack(c, t, cam) {
    const horizon = GY - 118 * S;
    c.fillStyle = grad(c, 0, 0, 0, horizon, ['#7fc6e6', '#bfe6ee', '#eef6e8']);
    c.fillRect(0, 0, W, horizon + 4);
    ell(c, W * 0.8, H * 0.13, 30 * S, 30 * S, 'rgba(255,245,190,0.9)');
    for (const m of clouds) {
      const span = W + 500;
      const x = ((m.x - cam * 0.05 + t * 3) % span + span) % span - 250;
      cloud(c, x, H * m.y, m.s * S, 0.85);
    }
    for (const b of birds) {
      const span = W + 200;
      const x = ((b.x - cam * 0.1 + t * 14) % span + span) % span - 100;
      bird(c, x, H * b.y + Math.sin(t + b.ph) * 8, b.s * S, t + b.ph);
    }
    state.alps += (alpsAt(cam) - state.alps) * 0.02;
    const a = state.alps;
    ridge(c, W, horizon, (110 + 150 * a) * S, 0.0046 / S, cam * 0.04, '#a8bfd0', 0.72, 11);
    ridge(c, W, horizon, (70 + 90 * a) * S, 0.0078 / S, cam * 0.07, '#8ca9a6', 0, 57);
    ridge(c, W, horizon, 34 * S, 0.016 / S, cam * 0.1, '#6f9a7f', 0, 3);
    // lake
    c.fillStyle = grad(c, 0, horizon, 0, GY, ['#5bb3c9', '#2f8ea8', '#237a93']);
    c.fillRect(0, horizon, W, GY - horizon + 2);
    for (let i = 0; i < 26; i++) {
      const u = i / 26;
      const y = horizon + 5 + u * u * (GY - horizon - 8);
      const x = ((i * 137 - cam * (0.2 + u * 0.3) + Math.sin(t * 0.6 + i) * 10) % (W + 80) + W + 80) % (W + 80) - 40;
      line(c, [[x - 12 - u * 16, y], [x + 12 + u * 16, y]], `rgba(255,255,255,${(0.12 + 0.2 * Math.abs(Math.sin(t + i))).toFixed(3)})`, 1 + u);
    }
    for (const b of sails) {
      const span = W + 300;
      const x = ((b.x - cam * 0.22 + t * 3) % span + span) % span - 150;
      const y = horizon + 8 + b.y * (GY - horizon - 60 * S);
      sailboat(c, x, y, (0.5 + b.y * 0.6) * b.s * S, t, b.col);
    }
  }

  function drawGround(c, t, cam) {
    c.fillStyle = grad(c, 0, GY - 16 * S, 0, GY + 6 * S, ['#8fb45f', '#7da753']);
    c.fillRect(0, GY - 14 * S, W, 24 * S);
    c.fillStyle = grad(c, 0, GY + 4 * S, 0, GY + 46 * S, ['#e2d3a8', '#d2bf8f']);
    c.fillRect(0, GY + 4 * S, W, 44 * S);
    c.fillStyle = grad(c, 0, GY + 44 * S, 0, H, ['#6f9d4f', '#4f7f40']);
    c.fillRect(0, GY + 44 * S, W, H - GY);
    // pebbles so the path visibly moves
    for (let i = 0; i < 46; i++) {
      const wx = i * 97;
      const span = 46 * 97;
      const x = (((wx - cam) % span + span) % span) * S - 60;
      if (x > W + 20) continue;
      ell(c, x, GY + (10 + (i * 37) % 30) * S, (2 + (i % 3)) * S, (1.2 + (i % 2)) * S, 'rgba(120,100,70,0.35)');
    }
  }

  function drawFlora(c, t, cam, s) {
    const half = W / (2 * S) + 40;
    for (const f of flora) {
      const dx = near(f.x, cam);
      if (Math.abs(dx) > half) continue;
      const x = W / 2 + dx * S;
      if (s === 'back' && f.y < 15) {
        c.save();
        c.translate(x, GY - 8 * S);
        c.scale(S, S);
        if (f.kind === 'reed') reed(c, 0, 0, 34, t, f.x);
        else flower(c, 0, 0, f.s, f.col, t, f.x);
        c.restore();
      } else if (s === 'front' && f.y >= 15) {
        c.save();
        c.translate(x, GY + 52 * S);
        c.scale(S * 1.2, S * 1.2);
        if (f.kind === 'flower') flower(c, 0, 0, f.s, f.col, t, f.x);
        else reed(c, 0, 0, 26, t, f.x);
        c.restore();
      }
    }
  }

  function drawSign(c, o, t) {
    const got = BE.has(o.item);
    box(c, -3, -86, 6, 86, '#7a5c3a');
    box(c, -55, -112, 110, 42, got ? '#fffaf0' : '#f4e7c9', 7);
    c.lineWidth = 2.5;
    c.strokeStyle = '#7a5c3a';
    BE.art.rr(c, -55, -112, 110, 42, 7);
    c.stroke();
    flagPlain(c, -49, -106, 20, 13, o.place.land);
    c.font = '700 14px "Trebuchet MS",system-ui,sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#2a2316';
    const name = _t(o.place.name);
    if (c.measureText(name).width > 76) c.font = '700 11px "Trebuchet MS",system-ui,sans-serif';
    c.fillText(name, 12, -90);
    if (got) ell(c, 44, -106, 5, 5, '#f4b81c');
  }
  function drawObject(c, o, t) {
    if (o.type === 'house') house(c, -o.w / 2, 0, o.w, o.h, o.style, o.seed);
    else if (o.type === 'tree') tree(c, 0, 0, o.h, o.kind, t, o.seed);
    else if (o.type === 'flag') flag(c, 0, 0, o.h, o.land, t);
    else if (o.type === 'sign') drawSign(c, o, t);
    else if (o.type === 'border') {
      flag(c, -30, 0, 120, o.a, t);
      flag(c, 30, 0, 120, o.b, t);
      box(c, -15, -44, 30, 44, '#d8d2c0', 4);
      box(c, -15, -26, 30, 4, '#8d8a80');
    } else if (o.type === 'landmark') {
      const fn = BE.landmarks && BE.landmarks[o.draw];
      if (fn) fn(c, t);
      else box(c, -60, -90, 120, 90, '#c9c2ad', 6);
    } else if (o.type === 'critter') {
      const fn = BE.critters && BE.critters[o.draw];
      if (fn) fn(c, t);
      else ell(c, 0, -14, 22, 14, '#7a6a55');
    }
  }
  function drawObjects(c, t, cam) {
    const half = W / (2 * S) + 260;
    for (const o of objs) {
      const dx = near(o.x, cam);
      if (Math.abs(dx) > half) continue;
      c.save();
      c.translate(W / 2 + dx * S, GY + (o.where === 'water' ? -22 * S : 0));
      c.scale(S, S);
      drawObject(c, o, t);
      c.restore();
    }
  }
  function drawBubble(c, o, dx, t, progress) {
    const got = BE.has(o.item);
    const x = W / 2 + dx * S;
    const y = GY + (o.where === 'water' ? -22 * S : 0) - (o.h + 26 + Math.sin(t * 3) * 3) * S;
    const top = Math.max(y, 80);
    ell(c, x, top, 19, 19, got ? 'rgba(255,250,240,0.92)' : '#ffd23f');
    c.lineWidth = 2;
    c.strokeStyle = got ? '#b08a2c' : '#fff';
    c.stroke();
    if (progress > 0) {
      c.beginPath();
      c.arc(x, top, 23, -Math.PI / 2, -Math.PI / 2 + progress * TAU);
      c.strokeStyle = '#e8664a';
      c.lineWidth = 4;
      c.stroke();
    }
    if (got) {
      line(c, [[x - 7, top], [x - 2, top + 6], [x + 8, top - 6]], '#3a2a00', 3);
    } else {
      c.beginPath();
      c.arc(x - 2, top - 2, 7, 0, TAU);
      c.strokeStyle = '#3a2a00';
      c.lineWidth = 2.6;
      c.stroke();
      line(c, [[x + 3, top + 3], [x + 9, top + 9]], '#3a2a00', 3);
    }
  }
  function drawStamp(c) {
    if (!stampFx) return;
    const u = stampFx.t / 1.5;
    const pop = u < 0.15 ? 1.5 - (u / 0.15) * 0.5 : 1;
    const a = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
    c.save();
    c.globalAlpha = Math.max(0, a);
    c.translate(W / 2, H * 0.36);
    c.rotate(-0.16);
    c.scale(pop, pop);
    const col = '#b5342a';
    c.lineWidth = 5;
    c.strokeStyle = col;
    c.fillStyle = 'rgba(255,250,240,0.92)';
    c.beginPath();
    c.arc(0, 0, 74, 0, TAU);
    c.fill();
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 64, 0, TAU);
    c.stroke();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = col;
    c.font = '700 12px "Trebuchet MS",system-ui,sans-serif';
    c.fillText(_t('BODENSEE-PASS'), 0, -36);
    const name = stampFx.name;
    c.font = `700 ${name.length > 11 ? 15 : 21}px "Trebuchet MS",system-ui,sans-serif`;
    c.fillText(name, 0, -4);
    flagPlain(c, -16, 16, 32, 20, stampFx.land);
    c.restore();
  }

  // ------------------------------------------------------------------ walking and discovering
  function arrive(o) {
    const fresh = BE.collect(o.item);
    if (fresh) BE.info(o.item);
  }
  function update(dt, t) {
    let want = 0;
    if (keys.left) want = -1;
    if (keys.right) want = 1;
    if (press && press.hold) {
      const kidX = W / 2;
      const d = press.x - kidX;
      if (Math.abs(d) > 26) want = Math.sign(d);
    }
    if (want === 0 && me.target !== null) {
      const d = near(me.target, me.x);
      if (Math.abs(d) < 8) me.target = null;
      else want = Math.sign(d);
    }
    // nearest spot still to be discovered, it slows the walk so the scan can finish
    let spot = null;
    let sd = 1e9;
    for (const o of objs) {
      if (!o.item || o.type === 'sign') continue;
      const d = Math.abs(near(o.x, me.x));
      if (d < sd) {
        sd = d;
        spot = o;
      }
    }
    const hunting = spot && sd < REACH && !BE.has(spot.item);
    const top = SPEED * (hunting ? 0.42 : 1);
    me.v += (want * top - me.v) * Math.min(1, dt * 7);
    if (Math.abs(me.v) < 2 && !want) me.v = 0;
    me.x = wrap(me.x + me.v * dt);
    if (want) me.face = want;
    if (me.v) me.walk += (Math.abs(me.v) / 26) * dt;
    else me.walk = 0;
    BE.store.walkX = me.x;
    if (hunting) {
      if (!scan || scan.o !== spot) scan = { o: spot, p: 0 };
      scan.p += dt * 0.95;
      if (scan.p >= 1) {
        scan = null;
        keys.left = keys.right = false;
        press = null;
        me.v = 0;
        me.target = null;
        arrive(spot);
      }
    } else scan = null;
    // signs stamp the pass as you walk by
    for (const o of objs) {
      if (o.type !== 'sign' || Math.abs(near(o.x, me.x)) > 40) continue;
      if (BE.collect(o.item, true)) {
        BE.api.Sound.bloop();
        stampFx = { t: 0, name: _t(o.place.name), land: o.place.land };
        BE.toast(`${_t(o.place.name)}: ${_t(o.place.line)}`, 5);
      }
    }
    if (stampFx) {
      stampFx.t += dt;
      if (stampFx.t > 1.5) stampFx = null;
    }
    const s = placeAt(me.x);
    if (s && s.place !== shownPlace) {
      shownPlace = s.place;
      BE.api.$('extSub').textContent = `${_t(s.place.name)} · ${_t(LAND_NAME[s.place.land])}`;
      if (lastLand && lastLand !== s.place.land) BE.toast(WELCOME[s.place.land], 3);
      lastLand = s.place.land;
    }
  }

  const state = { alps: 0.5 };

  function objectAt(x, y) {
    const wx = (x - W / 2) / S;
    let best = null;
    let bd = 1e9;
    for (const o of objs) {
      if (!o.hit) continue;
      const dx = near(o.x, me.x) - wx;
      const top = GY - (o.h + 50) * S;
      if (Math.abs(dx) > o.w / 2 + 20 || y < top || y > GY + 30 * S) continue;
      if (Math.abs(dx) < bd) {
        bd = Math.abs(dx);
        best = o;
      }
    }
    return best;
  }

  return {
    title: 'Landgang',
    subtitle: '',
    enter(w, h, placeId) {
      build();
      layout(w, h);
      keys.left = keys.right = false;
      press = null;
      me.target = null;
      me.v = 0;
      shownPlace = null;
      lastLand = null;
      if (placeId) {
        const s = stops.find((q) => q.place.id === placeId);
        me.x = wrap(s.x - 110);
        me.face = 1;
        BE.store.walkX = me.x;
      } else if (BE.store.walkX !== null) me.x = wrap(BE.store.walkX);
      else {
        me.x = wrap(stops[0].x - 110);
        BE.store.walkX = me.x;
      }
      state.alps = alpsAt(me.x);
      if (!BE.store.flags.uferHint) {
        BE.store.flags.uferHint = 1;
        BE.toast('Halte den Finger rechts oder links neben deiner Figur, dann läuft sie los!', 5);
      }
    },
    resize: layout,
    frame(c, w, h, dt, t) {
      if (dt) update(dt, t);
      const cam = me.x;
      drawBack(c, t, cam);
      drawGround(c, t, cam);
      drawFlora(c, t, cam, 'back');
      drawObjects(c, t, cam);
      let bubble = null;
      let bd = 1e9;
      for (const o of objs) {
        if (!o.item || o.type === 'sign') continue;
        const dx = near(o.x, cam);
        if (Math.abs(dx) < Math.abs(bd) && Math.abs(dx) < W / (2 * S)) {
          bd = dx;
          bubble = o;
        }
      }
      if (bubble) drawBubble(c, bubble, bd, t, scan && scan.o === bubble ? scan.p : 0);
      c.save();
      kid(c, W / 2, GY + 26 * S, 1.02 * S, me.face, me.walk);
      c.restore();
      drawFlora(c, t, cam, 'front');
      drawStamp(c);
    },
    down(x, y) {
      press = { x, y, t: performance.now(), hold: false, sx: x };
      me.target = null;
      setTimeout(() => {
        if (press && performance.now() - press.t >= 170) press.hold = true;
      }, 180);
    },
    move(x, y) {
      if (!press) return;
      press.x = x;
      press.y = y;
      if (Math.abs(x - press.sx) > 16) press.hold = true;
    },
    up(x, y) {
      const quick = press && !press.hold;
      press = null;
      if (!quick) return;
      const o = objectAt(x, y);
      if (o && BE.has(o.item)) {
        BE.api.Sound.click();
        BE.info(o.item);
      } else if (o && o.type === 'sign') {
        BE.api.Sound.click();
        BE.info(o.item);
      } else {
        me.target = wrap(me.x + (o ? near(o.x, me.x) : (x - W / 2) / S));
      }
    },
    key(e, down) {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = down;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = down;
      else if ((k === ' ' || k === 'Enter') && down) {
        let best = null;
        let bd = REACH + 40;
        for (const o of objs) {
          if (!o.item) continue;
          const d = Math.abs(near(o.x, me.x));
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (best) BE.info(best.item);
      } else return false;
      return true;
    },
    leave() {
      keys.left = keys.right = false;
      press = null;
    },
    get debug() {
      return { x: me.x, L, stops: stops.map((s) => [s.place.id, Math.round(s.x)]), objs: objs.length };
    },
    teleport(x) {
      me.x = wrap(x);
    },
  };
})();
