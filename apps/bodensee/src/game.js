/* Leopolds Bodensee-Expedition
 * Ein ruhiges Unterwasser-Forschungsspiel (HTML5 Canvas, ohne Abhängigkeiten, ohne Tracking).
 * Alle Grafiken werden zur Laufzeit gezeichnet, alle Klänge mit der Web Audio API erzeugt.
 */
(() => {
  'use strict';

  const VERSION = '__BUILD_VERSION__';
  const SAVE_KEY = 'bodensee-expedition-save-v1';
  const SETTINGS_KEY = 'bodensee-expedition-settings-v1';

  // ------------------------------------------------------------------ helpers
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  const $ = (id) => document.getElementById(id);

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = mulberry32(1864);
  const R = (a, b) => (b === undefined ? rng() * a : a + rng() * (b - a));
  function makeNoise(seed) {
    const r = mulberry32(seed);
    const p = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) p[i] = r() * 2 - 1;
    return (x) => {
      const i = Math.floor(x);
      const f = x - i;
      const a = p[i & 1023];
      const b = p[(i + 1) & 1023];
      return a + (b - a) * smooth(f);
    };
  }
  const n1 = makeNoise(7);
  const n2 = makeNoise(21);
  const n3 = makeNoise(99);
  const n4 = makeNoise(314);
  const fbm = (x) => n1(x) * 0.6 + n2(x * 2.3) * 0.3 + n3(x * 5.1) * 0.1;

  function lowerBound(arr, x) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].x < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function rgba(hex, a) {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  }

  // ------------------------------------------------------------------ world
  const WORLD_W = 7400;
  const M_PER_UNIT = 38 / 1365; // the Jura rests at y = 1365 -> 38 m
  const toMeters = (y) => Math.max(0, y * M_PER_UNIT);
  const START = { x: 520, y: 62 };
  const RIGHT_LIMIT = 7000;

  const GROUND_PTS = [
    [-200, -90], [0, -70], [120, -34], [230, 34], [380, 170], [560, 246], [800, 296],
    [1000, 322], [1250, 338], [1500, 362], [1750, 430], [2050, 560], [2350, 640], [2700, 702],
    [3000, 760], [3350, 806], [3700, 880], [4050, 962], [4350, 1040], [4700, 1104], [5000, 1150],
    [5400, 1232], [5800, 1308], [6250, 1365], [6650, 1394], [6950, 1418], [7080, 1470],
    [7180, 1640], [7300, 1760], [7600, 1800],
  ];

  // Five discovery sites. Positions are a playful map, explicitly not to scale.
  const SITES = [
    {
      id: 'pfahlbauten', x: 1250, flat: 320, title: 'Die Pfahlbauten', short: 'Pfahlbauten',
      facts: [
        'Vor über 5000 Jahren bauten Menschen am Bodensee ihre Häuser auf Holzpfählen – direkt am Ufer, über dem Wasser.',
        'Die Pfähle steckten tief im weichen Seegrund. Unter Wasser verrottet Holz kaum, darum findet man manche Reste bis heute.',
        'Seit 2011 gehören die Pfahlbauten rund um die Alpen zum UNESCO-Welterbe.',
        'Oben auf dem Wasser siehst du nachgebaute Pfahlbau-Häuser, wie es sie im Museum gibt.',
      ],
      praise: 'Manche dieser Pfähle sind älter als die Pyramiden in Ägypten!',
      hint: 'Ganz in der Nähe der Station, im flachen Wasser, stehen uralte Holzpfähle.',
    },
    {
      id: 'felchen', x: 2350, flat: 120, title: 'Der Felchen-Schwarm', short: 'Felchen',
      facts: [
        'Felchen sind die wichtigsten Fische für die Fischer am Bodensee. Besonders bekannt ist der Blaufelchen.',
        'Sie schwimmen in großen Schwärmen im freien Wasser und fressen winzig kleines Plankton.',
        'Ihre silbernen Schuppen spiegeln das Licht. So sind sie für Raubfische schwer zu entdecken.',
      ],
      praise: 'Was für ein glitzernder Schwarm!',
      hint: 'Im offenen Wasser glitzert ein großer silberner Schwarm.',
    },
    {
      id: 'anker', x: 3350, flat: 240, title: 'Der alte Anker', short: 'Anker',
      facts: [
        'Ein Anker hält ein Schiff an seinem Platz, damit Wind und Wellen es nicht forttreiben.',
        'Früher brachten große Lastsegelschiffe, die Lädinen, Holz, Salz und Getreide über den Bodensee.',
        'Dieser Anker ist von Rost und Schlamm bedeckt. Wem er wohl einmal gehört hat?',
      ],
      praise: 'Ein echtes Stück Seefahrts-Geschichte!',
      hint: 'Weiter draußen am Grund liegt etwas Schweres aus Eisen.',
    },
    {
      id: 'wels', x: 4700, flat: 300, title: 'Der Riesenwels', short: 'Wels',
      facts: [
        'Der Wels ist der größte Fisch im Bodensee. Welse können über 2 Meter lang werden!',
        'Mit den langen Barteln an seinem Maul tastet und schmeckt er im dunklen Wasser nach Futter.',
        'Tagsüber ruht er gern in Verstecken am Grund. Nachts geht er auf die Jagd.',
      ],
      praise: 'Was für ein Riese – und so friedlich!',
      hint: 'In der Tiefe, bei einem versunkenen Baumstamm, wohnt ein Riese mit langen Barteln.',
    },
    {
      id: 'jura', x: 6250, flat: 380, title: 'Das Dampfschiff Jura', short: 'Jura',
      facts: [
        'Die Jura war ein hölzernes Dampfschiff mit großen Schaufelrädern an den Seiten.',
        'Im Februar 1864 stieß sie bei dichtem Nebel mit dem Dampfer „Stadt Zürich“ zusammen und sank in wenigen Minuten.',
        'Heute liegt das Wrack in rund 38 Metern Tiefe. Dort unten ist es kalt, still und fast dunkel.',
        'Erst 1953 wurde das Wrack wiederentdeckt. Für Forscher ist es ein wertvolles Stück Geschichte.',
      ],
      praise: '',
      hint: 'Ganz hinten, in rund 38 Metern Tiefe, liegt ein altes Dampfschiff.',
    },
  ];
  const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));

  const GSTEP = 4;
  const GN = Math.ceil((WORLD_W + 400) / GSTEP) + 2;
  const GOFF = 200; // table starts at x = -200
  const groundTab = new Float32Array(GN);

  function baseGround(x) {
    const P = GROUND_PTS;
    let i = 0;
    while (i < P.length - 2 && x > P[i + 1][0]) i++;
    const p0 = P[Math.max(0, i - 1)][1];
    const p1 = P[i][1];
    const p2 = P[i + 1][1];
    const p3 = P[Math.min(P.length - 1, i + 2)][1];
    const t = clamp((x - P[i][0]) / (P[i + 1][0] - P[i][0]), 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  for (let i = 0; i < GN; i++) {
    const x = i * GSTEP - GOFF;
    let amp = 1;
    for (const s of SITES) amp *= 0.25 + 0.75 * smoothstep(s.flat * 0.5, s.flat, Math.abs(x - s.x));
    amp *= smoothstep(150, 420, x); // calm shore
    const deep = smoothstep(500, 1400, baseGround(x));
    groundTab[i] = baseGround(x) + fbm(x * 0.0032) * (14 + 16 * deep) * amp + n3(x * 0.05) * 2.5 * amp;
  }
  function groundY(x) {
    const f = (clamp(x, -GOFF, WORLD_W + 190) + GOFF) / GSTEP;
    const i = Math.floor(f);
    const a = groundTab[i];
    const b = groundTab[Math.min(GN - 1, i + 1)];
    return a + (b - a) * (f - i);
  }
  function maxGround(x0, x1) {
    let m = -1e9;
    for (let x = x0; x <= x1; x += 32) m = Math.max(m, groundY(x));
    return Math.max(m, groundY(x1));
  }

  // Page (glowing logbook sheet) positions and site focus points
  const PAGE_POS = {
    pfahlbauten: () => ({ x: 1290, y: groundY(1290) - 58 }),
    felchen: () => ({ x: 2350, y: 400 }),
    anker: () => ({ x: 3400, y: groundY(3400) - 66 }),
    wels: () => ({ x: 4560, y: groundY(4560) - 70 }),
    jura: () => ({ x: 6330, y: groundY(6330) - 150 }),
  };
  const FOCUS = {
    pfahlbauten: () => ({ x: 1220, y: 170, s: 0.62 }),
    felchen: () => ({ x: 2350, y: 400, s: 1.05 }),
    anker: () => ({ x: 3370, y: groundY(3370) - 70, s: 1.25 }),
    wels: () => {
      const w = fishes.find((f) => f.mode === 'wels');
      return w ? { x: w.x - 20, y: w.y - 30, s: 0.95 } : { x: 4680, y: groundY(4680) - 70, s: 0.92 };
    },
    jura: () => ({ x: 6240, y: groundY(6240) - 110, s: 0.66 }),
  };
  for (const s of SITES) {
    Object.assign(s, PAGE_POS[s.id]());
    s.r = s.id === 'felchen' ? 120 : 105;
    s.scan = 0;
    s.depthLabel = s.id === 'jura' ? 'rund 38 m Tiefe' : `ca. ${Math.round(toMeters(s.y + 40))} m Tiefe`;
  }

  // ------------------------------------------------------------------ static scenery (seeded)
  const plants = [];
  const reeds = [];
  const rocks = [];
  const pebbles = [];
  const stumps = [];
  const shards = [];
  const rays = [];
  const boats = [];
  const clouds = [];

  (function generateScenery() {
    rng = mulberry32(1864);
    for (let x = 250; x < 3000; x += R(16, 54)) {
      const g = groundY(x);
      if (g > 650 || g < 60) continue;
      if (x > 3280 && x < 3520) continue;
      const shallow = 1 - smoothstep(250, 650, g);
      if (rng() > 0.35 + shallow * 0.65) continue;
      plants.push({
        x, y: g + 4,
        h: R(36, 140) * (0.55 + shallow * 0.6),
        n: 2 + Math.floor(R(0, 4)),
        kind: rng() < 0.28 ? 'chara' : 'weed',
        ph: R(0, TAU),
        hue: R(0, 1),
        front: rng() < 0.16,
      });
    }
    for (let x = 140; x < 420; x += R(4, 11)) {
      const g = groundY(x);
      if (g > 130) continue;
      reeds.push({ x, base: g + 2, top: R(-110, -55), ph: R(0, TAU), lean: R(-0.08, 0.08) });
    }
    reeds.sort((a, b) => a.x - b.x);
    for (let x = 300; x < 7050; x += R(40, 190)) {
      const g = groundY(x);
      const deep = smoothstep(300, 1300, g);
      const big = rng() < 0.18;
      rocks.push({
        x, y: g + R(2, 8),
        rx: (big ? R(26, 52) : R(7, 20)) * (0.8 + deep * 0.5),
        ry: 0, rot: R(-0.25, 0.25), tone: R(0, 1),
      });
    }
    for (let i = 0; i < 9; i++) {
      const x = 4420 + R(0, 520);
      rocks.push({ x, y: groundY(x) + R(4, 10), rx: R(30, 66), ry: 0, rot: R(-0.3, 0.3), tone: R(0, 1) });
    }
    for (const r of rocks) r.ry = r.rx * R(0.48, 0.72);
    rocks.sort((a, b) => a.x - b.x);
    for (let x = 240; x < 7060; x += R(6, 22)) {
      pebbles.push({ x, dy: R(1, 12), r: R(0.8, 2.6), c: Math.floor(R(0, 4)) });
    }
    for (let x = 1040; x < 1480; x += R(15, 34)) {
      const rows = rng() < 0.5 ? 2 : 1;
      for (let k = 0; k < rows; k++) {
        const xx = x + k * R(6, 12);
        stumps.push({ x: xx, y: groundY(xx) + 3, h: R(10, 48), w: R(8, 14), lean: R(-0.12, 0.12) });
      }
    }
    for (let i = 0; i < 6; i++) {
      const x = 1180 + R(0, 220);
      shards.push({ x, y: groundY(x) + 1, s: R(5, 10), rot: R(-0.8, 0.8) });
    }
    for (let x = 200; x < WORLD_W; x += R(180, 340)) rays.push({ x, w: R(40, 110), ph: R(0, TAU), slant: R(0.12, 0.32) });
    boats.push({ kind: 'sail', x: 1500, v: 7 }, { kind: 'ship', x: 4200, v: -11 }, { kind: 'sail', x: 6100, v: 5 });
    for (let i = 0; i < 9; i++) clouds.push({ x: R(0, WORLD_W), y: R(-330, -190), w: R(120, 260), v: R(2, 6) });
  })();

  // ------------------------------------------------------------------ fish
  const SPECIES = {
    felchen: {
      name: 'Felchen', len: 44, h: 0.27, back: '#516f80', flank: '#b9ccd6', belly: '#f2f7f8', fin: '#9fb3bd', eye: '#dde6ea',
      pattern: 'silver', dorsal: 'normal', cruise: 52, wag: 0.5, freq: 1.1,
      fact: 'Lebt im Schwarm im freien Wasser und frisst Plankton. Der wichtigste Fisch der Bodensee-Fischer.',
    },
    rotauge: {
      name: 'Rotauge', len: 34, h: 0.36, back: '#3f5e4f', flank: '#b8c7bd', belly: '#eef1ea', fin: '#d4573c', eye: '#d6352a',
      pattern: 'silver', dorsal: 'normal', cruise: 46, wag: 0.55, freq: 1.25,
      fact: 'Hat leuchtend rote Augen und schwimmt gern in Schwärmen nahe am Ufer.',
    },
    barsch: {
      name: 'Flussbarsch', len: 42, h: 0.38, back: '#4d6a2c', flank: '#a6b25e', belly: '#ece3b6', fin: '#e86a2a', eye: '#e8c33a',
      pattern: 'stripes', dorsal: 'spiky', cruise: 40, wag: 0.5, freq: 1.2,
      fact: 'Hat dunkle Streifen und eine stachelige Rückenflosse. In der Schweiz heißt er „Egli“.',
    },
    hecht: {
      name: 'Hecht', len: 120, h: 0.17, back: '#47582a', flank: '#8e9a4e', belly: '#e6e1b9', fin: '#9b7b3d', eye: '#e2c447',
      pattern: 'spotsLight', dorsal: 'back', snout: true, cruise: 30, wag: 0.4, freq: 0.8,
      fact: 'Ein Lauerjäger: Er wartet reglos zwischen Wasserpflanzen und schießt dann blitzschnell los.',
    },
    seeforelle: {
      name: 'Seeforelle', len: 86, h: 0.25, back: '#4b5a66', flank: '#aab4ba', belly: '#eef0ee', fin: '#7d8a92', eye: '#d9dfe2',
      pattern: 'spotsDark', dorsal: 'normal', cruise: 58, wag: 0.45, freq: 0.95,
      fact: 'Schwimmt zum Laichen weit in Flüsse hinauf, zum Beispiel in den Alpenrhein.',
    },
    truesche: {
      name: 'Trüsche', len: 62, h: 0.19, back: '#4a4128', flank: '#857a50', belly: '#d8cfa4', fin: '#6d6340', eye: '#c9b973',
      pattern: 'mottled', dorsal: 'long', barbels: 'chin', analLong: true, cruise: 22, wag: 0.55, freq: 0.9,
      fact: 'Die einzige Verwandte des Dorsches, die im Süßwasser lebt. Sie mag kaltes, tiefes Wasser.',
    },
    wels: {
      name: 'Wels', len: 236, h: 0.18, back: '#2f3324', flank: '#5c5f3e', belly: '#b9b48f', fin: '#3c3e2a', eye: '#b7ad6a',
      pattern: 'mottled', dorsal: 'small', barbels: 'wels', analLong: true, flatHead: true, cruise: 16, wag: 0.35, freq: 0.55,
      fact: 'Der größte Fisch im See. Er ertastet sein Futter mit langen Barteln.',
    },
  };
  for (const k in SPECIES) SPECIES[k].key = k;
  const FISH_ORDER = ['felchen', 'rotauge', 'barsch', 'hecht', 'seeforelle', 'truesche', 'wels'];

  const fishes = [];
  const groups = [];
  let felchenRing = null;

  function addGroup(sp, n, x, y, zone) {
    const g = { sp, x, y, vx: 0, vy: 0, ang: R(0, TAU), zone, spread: SPECIES[sp].len * 1.15, members: [] };
    groups.push(g);
    for (let i = 0; i < n; i++) {
      const f = makeFish(sp, x + R(-60, 60), y + R(-30, 30));
      f.group = g;
      f.slot = { a: R(0, TAU), r: R(0.2, 1), z: R(-1, 1) };
      g.members.push(f);
    }
    return g;
  }
  function makeFish(sp, x, y) {
    const f = {
      sp: SPECIES[sp], key: sp, x, y, vx: 0, vy: 0, face: 1, faceT: 1, pitch: 0,
      tail: R(0, TAU), size: R(0.82, 1.18), seenT: 0, mode: 'cruise', tx: x, ty: y, timer: R(1, 4), home: { x, y }, boost: 0,
    };
    fishes.push(f);
    return f;
  }

  (function populate() {
    rng = mulberry32(2026);
    addGroup('rotauge', 9, 700, 150, { x0: 420, x1: 1500, y0: 50, y1: 300 });
    addGroup('rotauge', 8, 1600, 220, { x0: 1100, x1: 2300, y0: 60, y1: 360 });
    addGroup('rotauge', 7, 2100, 160, { x0: 1500, x1: 2700, y0: 60, y1: 340 });
    addGroup('felchen', 11, 3000, 420, { x0: 2600, x1: 4200, y0: 240, y1: 640 });
    addGroup('felchen', 10, 4400, 520, { x0: 3800, x1: 5600, y0: 300, y1: 800 });
    addGroup('barsch', 5, 1400, 280, { x0: 1000, x1: 2000, y0: 180, y1: 340 });
    addGroup('barsch', 5, 3300, 700, { x0: 2900, x1: 3800, y0: 520, y1: 780 });
    addGroup('barsch', 6, 6200, 1220, { x0: 5900, x1: 6600, y0: 1100, y1: 1330 });
    addGroup('barsch', 4, 4800, 980, { x0: 4300, x1: 5300, y0: 850, y1: 1080 });
    for (const [x, y] of [[640, 170], [1520, 260], [2020, 420]]) {
      const f = makeFish('hecht', x, y);
      f.mode = 'lurk';
    }
    for (const x of [2400, 3600, 5000, 6000]) {
      const f = makeFish('seeforelle', x, R(320, 900));
      f.mode = 'roam';
      f.home = { x, y: f.y };
    }
    for (const x of [4300, 5400, 6050, 6600]) {
      const f = makeFish('truesche', x, groundY(x) - 20);
      f.mode = 'bottom';
      f.home = { x, y: groundY(x) - 20 };
    }
    const w = makeFish('wels', 4700, groundY(4700) - 40);
    w.mode = 'wels';
    w.size = 1;
    w.home = { x: 4700, y: groundY(4700) - 40 };

    // the special Felchen ring at site 2
    felchenRing = { x: 2350, y: 400, swell: 0, members: [] };
    for (let i = 0; i < 34; i++) {
      const f = makeFish('felchen', 2350 + R(-150, 150), 400 + R(-60, 60));
      f.mode = 'ring';
      f.slot = { a: (i / 34) * TAU + R(-0.1, 0.1), r: R(85, 175), z: R(-1, 1), sp: R(0.85, 1.15) };
      felchenRing.members.push(f);
    }
  })();

  // ------------------------------------------------------------------ dynamic state
  const sub = { x: START.x, y: START.y, vx: 0, vy: 0, face: 1, faceT: 1, tilt: 0, prop: 0, light: true, speed: 0 };
  const cam = { x: 900, y: 160 };
  const state = {
    mode: 'title', // title | dialog | play | pause | card | logbook | ending | confirm
    prevMode: 'play',
    time: 0,
    elapsed: 0,
    found: [],
    seen: new Set(),
    maxDepth: 0,
    flags: {},
    finished: false,
    idle: 0,
    control: 'hold',
    muted: false,
  };
  const bubbles = [];
  const sparkles = [];
  const plankton = [];
  let ping = null; // { t, x, y }
  let pingInfo = null; // { t, site }
  let pingCooldown = 0;
  let discovering = null;
  let fishTag = null;

  for (let i = 0; i < 150; i++) plankton.push({ x: R(0, 2000), y: R(0, 1400), z: R(0.4, 1.4), ph: R(0, TAU) });

  // ------------------------------------------------------------------ canvas setup
  const canvas = $('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const lightCv = document.createElement('canvas');
  const lctx = lightCv.getContext('2d');
  const vignetteCv = document.createElement('canvas');
  let W = 0;
  let H = 0;
  let DPR = 1;
  let SCALE = 1;
  const quality = { maxDpr: 2, light: 0.5, slowT: 0, ema: 16 };

  function computeScale(w, h) {
    const big = clamp((Math.min(w, h) - 500) / 1000, 0, 0.3);
    const base = 740 * (1 + big);
    const wide = (w < h ? 470 : 620) * (1 + big);
    return clamp(Math.min(h / base, w / wide), 0.42, 1.6);
  }

  function resize() {
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    SCALE = computeScale(W, H);
    lightCv.width = Math.max(1, Math.round(W * quality.light));
    lightCv.height = Math.max(1, Math.round(H * quality.light));
    vignetteCv.width = Math.max(1, Math.round(W / 2));
    vignetteCv.height = Math.max(1, Math.round(H / 2));
    const v = vignetteCv.getContext('2d');
    const g = v.createRadialGradient(vignetteCv.width / 2, vignetteCv.height / 2, Math.min(W, H) * 0.18, vignetteCv.width / 2, vignetteCv.height / 2, Math.max(W, H) * 0.42);
    g.addColorStop(0, 'rgba(0,10,16,0)');
    g.addColorStop(1, 'rgba(0,10,16,0.55)');
    v.fillStyle = g;
    v.fillRect(0, 0, vignetteCv.width, vignetteCv.height);
    needsStaticRender = true;
  }
  let needsStaticRender = true;

  function mainView() {
    return { ctx, cx: cam.x, cy: cam.y, s: SCALE, w: W, h: H, dpr: DPR, photo: false };
  }
  function worldTransform(c, v) {
    c.setTransform(v.dpr * v.s, 0, 0, v.dpr * v.s, v.dpr * (v.w / 2 - v.cx * v.s), v.dpr * (v.h / 2 - v.cy * v.s));
  }
  function screenTransform(c, v) {
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  }
  const syOf = (v, wy) => v.h / 2 + (wy - v.cy) * v.s;
  const sxOf = (v, wx) => v.w / 2 + (wx - v.cx) * v.s;
  function viewRect(v) {
    const hw = v.w / (2 * v.s);
    const hh = v.h / (2 * v.s);
    return { x0: v.cx - hw, x1: v.cx + hw, y0: v.cy - hh, y1: v.cy + hh };
  }

  // caustics tile (Voronoi edges), generated once
  const causticCv = (() => {
    const N = 192;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const c = cv.getContext('2d');
    const img = c.createImageData(N, N);
    const r = mulberry32(5);
    const pts = [];
    for (let i = 0; i < 14; i++) pts.push([r() * N, r() * N]);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let d1 = 1e9;
        let d2 = 1e9;
        for (const [px, py] of pts) {
          for (let ox = -N; ox <= N; ox += N) {
            for (let oy = -N; oy <= N; oy += N) {
              const dx = x - px - ox;
              const dy = y - py - oy;
              const d = dx * dx + dy * dy;
              if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
            }
          }
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        const v = clamp(1 - e / 7, 0, 1);
        const a = Math.pow(v, 2.2) * 255;
        const k = (y * N + x) * 4;
        img.data[k] = 230;
        img.data[k + 1] = 255;
        img.data[k + 2] = 240;
        img.data[k + 3] = a;
      }
    }
    c.putImageData(img, 0, 0);
    return cv;
  })();
  let causticPattern = null;

  // ------------------------------------------------------------------ drawing: environment
  const WATER_STOPS = [
    [0, '#58b8a9'], [160, '#3a9e98'], [420, '#1f7a80'], [800, '#125565'], [1200, '#0a3a49'], [1600, '#041f2a'],
  ];

  function drawBackground(c, v, t) {
    screenTransform(c, v);
    const sySurf = syOf(v, 0);
    // water
    const g = c.createLinearGradient(0, syOf(v, 0), 0, syOf(v, 1600));
    for (const [y, col] of WATER_STOPS) g.addColorStop(y / 1600, col);
    c.fillStyle = g;
    c.fillRect(0, Math.max(0, sySurf - 4), v.w, v.h);
    if (sySurf > 0) drawSky(c, v, t, sySurf);
  }

  function drawSky(c, v, t, sySurf) {
    const sg = c.createLinearGradient(0, syOf(v, -420), 0, sySurf);
    sg.addColorStop(0, '#6fb4e3');
    sg.addColorStop(0.75, '#bfe3f2');
    sg.addColorStop(1, '#e8f5f6');
    c.fillStyle = sg;
    c.fillRect(0, 0, v.w, sySurf + 2);
    // sun
    const sunX = v.w * 0.78 - v.cx * v.s * 0.02;
    const sunY = syOf(v, -300);
    const sun = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, 120 * v.s);
    sun.addColorStop(0, 'rgba(255,253,235,0.95)');
    sun.addColorStop(0.15, 'rgba(255,248,215,0.8)');
    sun.addColorStop(1, 'rgba(255,248,215,0)');
    c.fillStyle = sun;
    c.fillRect(sunX - 130 * v.s, sunY - 130 * v.s, 260 * v.s, 260 * v.s);
    // clouds
    worldTransform(c, v);
    for (const cl of clouds) {
      const x = ((cl.x + t * cl.v) % (WORLD_W + 600)) - 300;
      const px = v.cx + (x - v.cx) * 0.55;
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.ellipse(px, cl.y, cl.w * 0.5, cl.w * 0.12, 0, 0, TAU);
      c.ellipse(px + cl.w * 0.15, cl.y - cl.w * 0.08, cl.w * 0.24, cl.w * 0.12, 0, 0, TAU);
      c.ellipse(px - cl.w * 0.16, cl.y - cl.w * 0.05, cl.w * 0.2, cl.w * 0.1, 0, 0, TAU);
      c.fill();
    }
    // Alps across the lake (far) and green hills (near), parallax
    screenTransform(c, v);
    drawRange(c, v, 0.06, 15, 150, 0.0042, '#8aa3bd', true, sySurf);
    drawRange(c, v, 0.14, 4, 46, 0.011, '#6f9a86', false, sySurf);
  }

  function drawRange(c, v, par, base, amp, freq, col, snow, sySurf) {
    const step = 10;
    const pts = [];
    for (let sx = -step; sx <= v.w + step; sx += step) {
      const wx = v.cx * par + (sx - v.w / 2) / v.s;
      const n = Math.abs(n4(wx * freq)) * 0.7 + Math.abs(n2(wx * freq * 2.7)) * 0.3;
      const hgt = base + amp * n;
      pts.push([sx, sySurf - hgt * v.s]);
    }
    c.beginPath();
    c.moveTo(-step, sySurf + 2);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(v.w + step, sySurf + 2);
    c.closePath();
    c.fillStyle = col;
    c.fill();
    if (snow) {
      c.save();
      c.clip();
      c.fillStyle = 'rgba(250,252,255,0.92)';
      c.beginPath();
      c.moveTo(-step, sySurf - (base + amp * 0.62) * v.s);
      for (const [x, y] of pts) c.lineTo(x, Math.min(y + 3 * v.s, sySurf - (base + amp * 0.62) * v.s + Math.sin(x * 0.07) * 4 * v.s));
      c.lineTo(v.w + step, sySurf - (base + amp * 0.62) * v.s);
      c.lineTo(v.w + step, 0);
      c.lineTo(-step, 0);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  function drawRidges(c, v, t) {
    screenTransform(c, v);
    const layers = [
      { par: 0.3, off: 900, amp: 260, freq: 0.0021, col: 'rgba(6,44,56,0.45)' },
      { par: 0.58, off: 600, amp: 200, freq: 0.0033, col: 'rgba(5,36,46,0.55)' },
    ];
    for (const L of layers) {
      const step = 14;
      c.beginPath();
      c.moveTo(-step, v.h + 2);
      for (let sx = -step; sx <= v.w + step; sx += step) {
        const wxPar = v.cx * L.par + (sx - v.w / 2) / v.s;
        const wxReal = v.cx + (sx - v.w / 2) / v.s;
        const gy = groundY(clamp(wxReal, 0, WORLD_W));
        const wy = gy - L.off * (0.35 + 0.65 * smoothstep(300, 1200, gy)) + n1(wxPar * L.freq) * L.amp * 0.5;
        const wyPar = v.cy + (wy - v.cy) * (0.6 + L.par * 0.4);
        c.lineTo(sx, Math.max(syOf(v, 30), syOf(v, wyPar)));
      }
      c.lineTo(v.w + step, v.h + 2);
      c.closePath();
      const fg = c.createLinearGradient(0, syOf(v, 40), 0, syOf(v, 420));
      fg.addColorStop(0, rgba('#05303c', 0));
      fg.addColorStop(1, L.col);
      c.fillStyle = fg;
      c.fill();
    }
  }

  function drawRays(c, v, t) {
    const vr = viewRect(v);
    if (vr.y0 > 700) return;
    worldTransform(c, v);
    c.globalCompositeOperation = 'lighter';
    for (const r of rays) {
      if (r.x < vr.x0 - 400 || r.x > vr.x1 + 200) continue;
      const L = 760;
      const x = r.x + Math.sin(t * 0.25 + r.ph) * 30;
      const a = 0.09 + 0.06 * Math.sin(t * 0.6 + r.ph * 2);
      const g = c.createLinearGradient(0, 0, 0, L);
      g.addColorStop(0, `rgba(210,255,235,${a})`);
      g.addColorStop(1, 'rgba(210,255,235,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x - r.w / 2, 0);
      c.lineTo(x + r.w / 2, 0);
      c.lineTo(x + r.w * 0.9 + r.slant * L, L);
      c.lineTo(x - r.w * 0.4 + r.slant * L, L);
      c.closePath();
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }

  const wave = (x, t) => Math.sin(x * 0.012 + t * 1.3) * 3.2 + Math.sin(x * 0.031 - t * 0.9) * 1.6;

  function drawSurface(c, v, t) {
    const vr = viewRect(v);
    if (vr.y0 > 60) return;
    worldTransform(c, v);
    const x0 = Math.floor(vr.x0 / 12) * 12 - 12;
    // the water body just below the waves
    c.beginPath();
    c.moveTo(x0, wave(x0, t));
    for (let x = x0; x <= vr.x1 + 12; x += 12) c.lineTo(x, wave(x, t));
    c.lineTo(vr.x1 + 12, 40);
    c.lineTo(x0, 40);
    c.closePath();
    const g = c.createLinearGradient(0, -4, 0, 40);
    g.addColorStop(0, 'rgba(220,255,245,0.55)');
    g.addColorStop(0.25, 'rgba(160,230,215,0.25)');
    g.addColorStop(1, 'rgba(160,230,215,0)');
    c.fillStyle = g;
    c.fill();
    // bright wave line
    c.beginPath();
    for (let x = x0; x <= vr.x1 + 12; x += 12) {
      if (x === x0) c.moveTo(x, wave(x, t));
      else c.lineTo(x, wave(x, t));
    }
    c.strokeStyle = 'rgba(240,255,250,0.85)';
    c.lineWidth = 1.6 / v.s;
    c.stroke();
    // shimmering sparkles under the surface
    c.globalCompositeOperation = 'lighter';
    for (let x = Math.floor(vr.x0 / 37) * 37; x < vr.x1; x += 37) {
      const s = Math.sin(x * 1.7 + t * 2.2) * Math.sin(x * 0.33 - t * 1.1);
      if (s < 0.55) continue;
      c.fillStyle = `rgba(255,255,255,${(s - 0.55) * 1.2})`;
      c.fillRect(x, wave(x, t) + 3 + (x % 5), 10, 1.4);
    }
    c.globalCompositeOperation = 'source-over';
  }

  function drawTerrain(c, v, t) {
    const vr = viewRect(v);
    worldTransform(c, v);
    const x0 = Math.floor(vr.x0 / GSTEP / 2) * GSTEP * 2 - 8;
    const x1 = vr.x1 + 8;
    const bottom = vr.y1 + 10;
    const path = new Path2D();
    path.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += 8) path.lineTo(x, groundY(x));
    path.lineTo(x1, bottom);
    path.closePath();
    const g = c.createLinearGradient(0, 0, 0, 1700);
    g.addColorStop(0, '#d6c48f');
    g.addColorStop(0.12, '#bba776');
    g.addColorStop(0.3, '#8a7c57');
    g.addColorStop(0.6, '#4f4934');
    g.addColorStop(1, '#25241a');
    c.fillStyle = g;
    c.fill(path);

    // shading band under the surface of the ground
    c.save();
    c.clip(path);
    const top = new Path2D();
    top.moveTo(x0, groundY(x0) + 60);
    for (let x = x0; x <= x1; x += 8) top.lineTo(x, groundY(x) + 60);
    top.lineTo(x1, bottom);
    top.lineTo(x0, bottom);
    top.closePath();
    c.fillStyle = 'rgba(20,18,10,0.28)';
    c.fill(top);
    // dancing caustics on the shallow lake bed, fading out with depth
    if (vr.y0 < 700 && causticPattern) {
      c.globalCompositeOperation = 'lighter';
      const CH = 40;
      for (let pass = 0; pass < 2; pass++) {
        const k = pass === 0 ? 0.55 : 0.8;
        const ox = t * (pass === 0 ? 9 : -6);
        const oy = t * (pass === 0 ? 4 : 7);
        c.save();
        c.translate(ox, oy);
        c.scale(k, k);
        c.fillStyle = causticPattern;
        for (let x = Math.floor(x0 / CH) * CH; x < x1; x += CH) {
          const gy = groundY(x + CH / 2);
          const a = (pass === 0 ? 0.36 : 0.26) * (1 - smoothstep(140, 640, gy));
          if (a < 0.01) continue;
          c.globalAlpha = a;
          c.fillRect((x - ox) / k, (gy - 30 - oy) / k, CH / k, 120 / k);
        }
        c.restore();
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();

    // highlight along the ground line
    c.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      if (x === x0) c.moveTo(x, groundY(x));
      else c.lineTo(x, groundY(x));
    }
    c.strokeStyle = 'rgba(255,240,200,0.18)';
    c.lineWidth = 3;
    c.stroke();

    // pebbles
    const PC = ['#7e735a', '#a49879', '#5d5745', '#c8bc98'];
    for (let i = lowerBound(pebbles, x0); i < pebbles.length && pebbles[i].x < x1; i++) {
      const p = pebbles[i];
      c.fillStyle = PC[p.c];
      c.beginPath();
      c.ellipse(p.x, groundY(p.x) + p.dy, p.r * 1.4, p.r, 0, 0, TAU);
      c.fill();
    }
    // rocks
    for (let i = lowerBound(rocks, x0 - 70); i < rocks.length && rocks[i].x < x1 + 70; i++) drawRock(c, rocks[i]);
  }

  function drawRock(c, r) {
    const g = c.createRadialGradient(r.x - r.rx * 0.35, r.y - r.ry * 0.5, r.rx * 0.1, r.x, r.y, r.rx * 1.1);
    const light = r.tone < 0.5 ? '#9c9a8a' : '#8e8470';
    const dark = r.tone < 0.5 ? '#3c3d36' : '#3f3628';
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(r.x, r.y, r.rx, r.ry, r.rot, Math.PI, TAU, false);
    c.ellipse(r.x, r.y, r.rx, r.ry * 0.35, r.rot, 0, Math.PI, false);
    c.closePath();
    c.fill();
    if (r.rx > 24) {
      c.fillStyle = 'rgba(90,120,60,0.35)';
      c.beginPath();
      c.ellipse(r.x - r.rx * 0.2, r.y - r.ry * 0.82, r.rx * 0.45, r.ry * 0.16, r.rot, 0, TAU);
      c.fill();
    }
  }

  function drawPlants(c, v, t, front) {
    const vr = viewRect(v);
    worldTransform(c, v);
    for (let i = lowerBound(plants, vr.x0 - 80); i < plants.length && plants[i].x < vr.x1 + 80; i++) {
      const p = plants[i];
      if (p.front !== front) continue;
      if (p.kind === 'chara') drawChara(c, p, t);
      else drawWeed(c, p, t);
    }
  }

  function drawWeed(c, p, t) {
    for (let k = 0; k < p.n; k++) {
      const bx = p.x + (k - p.n / 2) * 5;
      const h = p.h * (0.7 + 0.3 * Math.sin(k * 7.3 + p.ph));
      const sway = Math.sin(t * 0.9 + p.ph + k * 0.8) * h * 0.16 + Math.sin(t * 2.1 + k) * 2;
      const tx = bx + sway;
      const ty = p.y - h;
      const mx = bx + sway * 0.35 + Math.sin(k + p.ph) * 6;
      const my = p.y - h * 0.5;
      const w = 3.2 + (k % 2);
      const hue = p.hue;
      const col = `hsl(${88 + hue * 30},${42 + hue * 18}%,${30 + hue * 10}%)`;
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(bx - w, p.y);
      c.quadraticCurveTo(mx - w, my, tx, ty);
      c.quadraticCurveTo(mx + w, my, bx + w, p.y);
      c.closePath();
      c.fill();
      // leaves
      c.fillStyle = `hsl(${92 + hue * 30},48%,${36 + hue * 10}%)`;
      for (let j = 1; j < 5; j++) {
        const q = j / 5;
        const lx = lerp(lerp(bx, mx, q), lerp(mx, tx, q), q);
        const ly = lerp(lerp(p.y, my, q), lerp(my, ty, q), q);
        const side = j % 2 ? 1 : -1;
        c.beginPath();
        c.ellipse(lx + side * 5, ly, 6, 2.2, side * 0.6 + Math.sin(t + j) * 0.15, 0, TAU);
        c.fill();
      }
    }
  }

  function drawChara(c, p, t) {
    const h = p.h * 0.45;
    for (let k = 0; k < 5; k++) {
      const bx = p.x + (k - 2) * 4;
      const sway = Math.sin(t * 0.8 + p.ph + k) * 4;
      c.strokeStyle = `hsl(${110 + p.hue * 20},38%,${34 + p.hue * 8}%)`;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(bx, p.y);
      c.quadraticCurveTo(bx + sway * 0.5, p.y - h * 0.5, bx + sway, p.y - h);
      c.stroke();
      for (let j = 1; j < 5; j++) {
        const y = p.y - (h * j) / 5;
        const x = bx + (sway * j) / 5;
        c.beginPath();
        c.moveTo(x - 6, y - 3);
        c.lineTo(x, y);
        c.lineTo(x + 6, y - 3);
        c.stroke();
      }
    }
  }

  function drawReeds(c, v, t) {
    const vr = viewRect(v);
    if (vr.x0 > 1500 || vr.y0 > 300) return;
    worldTransform(c, v);
    c.lineCap = 'round';
    for (let i = lowerBound(reeds, vr.x0 - 40); i < reeds.length && reeds[i].x < vr.x1 + 40; i++) {
      const r = reeds[i];
      const sway = Math.sin(t * 0.8 + r.ph) * (r.top < -30 ? 5 : 2);
      const tx = r.x + r.lean * (r.base - r.top) + sway;
      c.strokeStyle = '#6f7d3a';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(r.x, r.base);
      c.quadraticCurveTo(r.x + sway * 0.2, (r.base + r.top) / 2, tx, r.top);
      c.stroke();
      if (!r.short) {
        c.fillStyle = '#8b6a3e';
        c.beginPath();
        c.ellipse(tx + 1, r.top - 9, 3.2, 11, r.lean + sway * 0.02, 0, TAU);
        c.fill();
      }
      c.strokeStyle = '#869443';
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(lerp(r.x, tx, 0.55), lerp(r.base, r.top, 0.55));
      c.quadraticCurveTo(lerp(r.x, tx, 0.55) + 16, lerp(r.base, r.top, 0.6), lerp(r.x, tx, 0.55) + 22 + sway, lerp(r.base, r.top, 0.5));
      c.stroke();
    }
  }

  function drawShore(c, v, t) {
    const vr = viewRect(v);
    if (vr.x0 > 600 || vr.y0 > 80) return;
    worldTransform(c, v);
    // grass on the land part
    c.fillStyle = '#5f8b45';
    c.beginPath();
    c.moveTo(-260, groundY(-200));
    for (let x = -200; x <= 230; x += 10) c.lineTo(x, Math.min(groundY(x), 2) - 3);
    for (let x = 230; x >= -200; x -= 10) c.lineTo(x, Math.min(groundY(x), 2) + 8);
    c.closePath();
    c.fill();
    // research station
    const hx = 30;
    const hy = groundY(hx) - 2;
    c.fillStyle = '#e9e1cf';
    c.fillRect(hx - 50, hy - 62, 100, 62);
    c.fillStyle = '#b5523b';
    c.beginPath();
    c.moveTo(hx - 60, hy - 60);
    c.lineTo(hx, hy - 100);
    c.lineTo(hx + 60, hy - 60);
    c.closePath();
    c.fill();
    c.fillStyle = '#2f5d6b';
    c.fillRect(hx - 36, hy - 46, 20, 18);
    c.fillRect(hx + 14, hy - 46, 20, 18);
    c.fillStyle = '#6b4a2b';
    c.fillRect(hx - 9, hy - 34, 18, 34);
    c.fillStyle = '#1f3d48';
    c.font = 'bold 9px "Avenir Next", system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('SEEFORSCHUNG', hx, hy - 52);
    // radio mast with pulsing waves (the professor's radio)
    c.strokeStyle = '#7a7f86';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(hx + 34, hy - 70);
    c.lineTo(hx + 34, hy - 150);
    c.stroke();
    c.fillStyle = '#e04b3a';
    c.beginPath();
    c.arc(hx + 34, hy - 152, 3, 0, TAU);
    c.fill();
    const pulse = (t * 0.6) % 1;
    c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - pulse)})`;
    c.lineWidth = 1.5;
    for (let k = 0; k < 2; k++) {
      const rr = 10 + (pulse + k * 0.5) * 18;
      c.beginPath();
      c.arc(hx + 34, hy - 152, rr, -0.7, 0.7);
      c.stroke();
      c.beginPath();
      c.arc(hx + 34, hy - 152, rr, Math.PI - 0.7, Math.PI + 0.7);
      c.stroke();
    }
    // pier
    c.fillStyle = '#7a5a36';
    c.fillRect(140, -26, 340, 7);
    c.strokeStyle = '#5a4126';
    c.lineWidth = 5;
    for (let x = 160; x <= 470; x += 52) {
      c.beginPath();
      c.moveTo(x, -20);
      c.lineTo(x, groundY(x) + 4);
      c.stroke();
    }
    // three flags: Austria, Germany, Switzerland share the lake
    const flags = [
      ['#ed2939', '#ffffff', '#ed2939'],
      ['#111111', '#dd0000', '#ffce00'],
      ['ch'],
    ];
    flags.forEach((f, i) => {
      const fx = 330 + i * 46;
      c.strokeStyle = '#ddd';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(fx, -26);
      c.lineTo(fx, -96);
      c.stroke();
      const flap = Math.sin(t * 3 + i) * 2;
      if (f[0] === 'ch') {
        c.fillStyle = '#da291c';
        c.fillRect(fx + 1, -96 + flap * 0.3, 22, 22);
        c.fillStyle = '#fff';
        c.fillRect(fx + 10, -92 + flap * 0.3, 4, 14);
        c.fillRect(fx + 5, -87 + flap * 0.3, 14, 4);
      } else {
        for (let k = 0; k < 3; k++) {
          c.fillStyle = f[k];
          c.fillRect(fx + 1, -96 + k * 6 + flap * 0.3, 28, 6);
        }
      }
    });
  }

  function drawPfahlbauten(c, v, t) {
    const vr = viewRect(v);
    if (vr.x1 < 900 || vr.x0 > 1560) return;
    worldTransform(c, v);
    // archaeological stumps on the lake bed
    for (const s of stumps) {
      if (s.x < vr.x0 - 20 || s.x > vr.x1 + 20) continue;
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.lean);
      const g = c.createLinearGradient(-s.w / 2, 0, s.w / 2, 0);
      g.addColorStop(0, '#2c2014');
      g.addColorStop(0.45, '#5b4229');
      g.addColorStop(1, '#2a1e12');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-s.w / 2, 2);
      c.lineTo(-s.w / 2, -s.h + 4);
      c.quadraticCurveTo(-s.w * 0.2, -s.h - 3, 0, -s.h + 1);
      c.quadraticCurveTo(s.w * 0.3, -s.h - 2, s.w / 2, -s.h + 5);
      c.lineTo(s.w / 2, 2);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(110,140,60,0.45)';
      c.fillRect(-s.w / 2, -s.h + 2, s.w, 4);
      c.restore();
    }
    for (const sh of shards) {
      c.save();
      c.translate(sh.x, sh.y);
      c.rotate(sh.rot);
      c.fillStyle = '#9a5b34';
      c.beginPath();
      c.moveTo(-sh.s, 0);
      c.quadraticCurveTo(0, -sh.s * 0.9, sh.s, 0);
      c.lineTo(sh.s * 0.7, sh.s * 0.25);
      c.quadraticCurveTo(0, -sh.s * 0.45, -sh.s * 0.7, sh.s * 0.25);
      c.closePath();
      c.fill();
      c.restore();
    }
    // reconstructed stilt houses above the water
    const huts = [{ x: 1030, w: 104 }, { x: 1185, w: 120 }, { x: 1340, w: 100 }];
    c.lineCap = 'butt';
    for (const h of huts) {
      for (let k = -3; k <= 3; k++) {
        const px = h.x + (k * h.w) / 7;
        c.strokeStyle = '#4a3420';
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(px, -52);
        c.lineTo(px + k * 0.6, groundY(px) + 6);
        c.stroke();
      }
    }
    c.fillStyle = '#7b5a34';
    c.fillRect(940, -58, 470, 8);
    c.strokeStyle = 'rgba(40,25,10,0.5)';
    c.lineWidth = 1;
    for (let x = 944; x < 1410; x += 9) {
      c.beginPath();
      c.moveTo(x, -58);
      c.lineTo(x, -50);
      c.stroke();
    }
    for (const h of huts) {
      const l = h.x - h.w / 2 + 6;
      const r = h.x + h.w / 2 - 6;
      c.fillStyle = '#a2814f';
      c.fillRect(l, -112, r - l, 54);
      c.strokeStyle = 'rgba(70,45,20,0.55)';
      c.lineWidth = 1.2;
      for (let y = -108; y < -58; y += 7) {
        c.beginPath();
        c.moveTo(l, y);
        c.quadraticCurveTo(h.x, y + 3, r, y);
        c.stroke();
      }
      c.fillStyle = '#2d1e10';
      c.fillRect(h.x - 9, -92, 18, 34);
      c.fillStyle = '#c4a057';
      c.beginPath();
      c.moveTo(h.x - h.w / 2 - 16, -104);
      c.lineTo(h.x, -182);
      c.lineTo(h.x + h.w / 2 + 16, -104);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(120,90,35,0.7)';
      c.lineWidth = 1.2;
      for (let k = -6; k <= 6; k++) {
        c.beginPath();
        c.moveTo(h.x + k * 3, -178);
        c.lineTo(h.x + k * (h.w / 12 + 1.5), -104);
        c.stroke();
      }
    }
    // smoke
    for (let k = 0; k < 5; k++) {
      const q = (t * 0.12 + k / 5) % 1;
      c.fillStyle = `rgba(230,230,225,${0.35 * (1 - q)})`;
      c.beginPath();
      c.arc(1196 + Math.sin(q * 6 + k) * 10 + q * 30, -185 - q * 120, 6 + q * 16, 0, TAU);
      c.fill();
    }
  }

  function drawAnchor(c, v, t) {
    const vr = viewRect(v);
    const ax = 3360;
    if (vr.x1 < ax - 320 || vr.x0 > ax + 320) return;
    worldTransform(c, v);
    const gy = groundY(ax);
    // chain lying on the bottom
    c.lineWidth = 2.6;
    for (let k = 0; k < 26; k++) {
      const x = ax + 14 + k * 9;
      const y = groundY(x) - 2 - Math.max(0, 40 - k * 6) * 0.9;
      c.strokeStyle = k % 2 ? '#5e3b1e' : '#7a4c25';
      c.beginPath();
      if (k % 2) c.ellipse(x, y, 5.5, 2.4, 0, 0, TAU);
      else c.ellipse(x, y, 5.5, 3.6, 0, 0, TAU);
      c.stroke();
    }
    c.save();
    c.translate(ax, gy + 8);
    c.rotate(-0.32);
    const rust = c.createLinearGradient(-30, -150, 30, 0);
    rust.addColorStop(0, '#8a5a2e');
    rust.addColorStop(0.5, '#5c381b');
    rust.addColorStop(1, '#3d2410');
    c.fillStyle = rust;
    c.strokeStyle = rust;
    // shank
    c.fillRect(-6, -150, 12, 140);
    // stock (cross bar)
    c.fillRect(-58, -134, 116, 10);
    c.beginPath();
    c.arc(-58, -129, 6, 0, TAU);
    c.arc(58, -129, 6, 0, TAU);
    c.fill();
    // ring
    c.lineWidth = 6;
    c.beginPath();
    c.arc(0, -164, 13, 0, TAU);
    c.stroke();
    // arms and flukes
    c.lineWidth = 11;
    c.beginPath();
    c.moveTo(-70, -48);
    c.quadraticCurveTo(-52, -6, 0, -10);
    c.quadraticCurveTo(52, -6, 70, -48);
    c.stroke();
    c.beginPath();
    c.moveTo(-70, -48);
    c.lineTo(-88, -64);
    c.lineTo(-62, -70);
    c.closePath();
    c.moveTo(70, -48);
    c.lineTo(88, -64);
    c.lineTo(62, -70);
    c.closePath();
    c.fill();
    // rust spots and growth
    c.fillStyle = 'rgba(160,110,60,0.55)';
    for (let k = 0; k < 14; k++) c.fillRect(-5 + ((k * 7) % 10), -146 + k * 9, 3, 3);
    c.fillStyle = 'rgba(100,130,70,0.5)';
    c.fillRect(-58, -136, 30, 3);
    c.restore();
    // sediment covering the lower fluke
    c.fillStyle = '#5d5540';
    c.beginPath();
    c.ellipse(ax + 22, gy + 4, 70, 14, -0.05, Math.PI, TAU);
    c.fill();
  }

  function drawWelsHome(c, v, t) {
    const vr = viewRect(v);
    const tx0 = 4470;
    if (vr.x1 < tx0 - 200 || vr.x0 > tx0 + 600) return;
    worldTransform(c, v);
    // sunken tree trunk with roots
    const y0 = groundY(tx0);
    const y1 = groundY(tx0 + 380);
    c.save();
    const ang = Math.atan2(y1 - y0, 380);
    c.translate(tx0, y0 - 18);
    c.rotate(ang);
    const g = c.createLinearGradient(0, -22, 0, 22);
    g.addColorStop(0, '#5a4630');
    g.addColorStop(0.5, '#3d2f20');
    g.addColorStop(1, '#221a10');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -24);
    c.lineTo(380, -14);
    c.quadraticCurveTo(394, 0, 380, 14);
    c.lineTo(0, 24);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(20,14,6,0.6)';
    c.lineWidth = 1.5;
    for (let k = 0; k < 7; k++) {
      c.beginPath();
      c.moveTo(20 + k * 50, -18 + (k % 3) * 4);
      c.lineTo(60 + k * 50, -14 + (k % 2) * 5);
      c.stroke();
    }
    c.strokeStyle = '#3a2c1c';
    c.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const a = -1.4 + k * 0.35;
      c.lineWidth = 7 - k * 0.4;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(Math.cos(a + Math.PI) * 40, Math.sin(a + Math.PI) * 40 - 6, Math.cos(a + Math.PI) * 78, Math.sin(a + Math.PI) * 70 + 8);
      c.stroke();
    }
    c.restore();
  }

  function drawJura(c, v, t) {
    const vr = viewRect(v);
    const jx = 6250;
    if (vr.x1 < jx - 420 || vr.x0 > jx + 420) return;
    worldTransform(c, v);
    const gy = groundY(jx);
    c.save();
    c.translate(jx, gy + 14);
    c.rotate(-0.045);
    // hull
    const hull = new Path2D();
    hull.moveTo(-270, -78);
    hull.lineTo(250, -84);
    hull.quadraticCurveTo(292, -82, 300, -96);
    hull.lineTo(282, -40);
    hull.quadraticCurveTo(250, 6, 170, 10);
    hull.lineTo(-210, 10);
    hull.quadraticCurveTo(-276, 4, -284, -50);
    hull.closePath();
    const hg = c.createLinearGradient(0, -96, 0, 10);
    hg.addColorStop(0, '#4c4a40');
    hg.addColorStop(0.5, '#33322b');
    hg.addColorStop(1, '#1d1d18');
    c.fillStyle = hg;
    c.fill(hull);
    // planks
    c.save();
    c.clip(hull);
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 1.2;
    for (let y = -70; y < 10; y += 11) {
      c.beginPath();
      c.moveTo(-290, y);
      c.lineTo(300, y - 4);
      c.stroke();
    }
    // cabin windows
    c.fillStyle = 'rgba(10,14,12,0.9)';
    for (let x = -230; x < 230; x += 30) {
      if (Math.abs(x) < 80) continue;
      c.fillRect(x, -66, 13, 9);
    }
    // encrustation (mussels)
    for (let k = 0; k < 120; k++) {
      const x = -270 + ((k * 137) % 560);
      const y = -80 + ((k * 61) % 86);
      c.fillStyle = k % 3 ? 'rgba(170,165,140,0.35)' : 'rgba(110,120,90,0.4)';
      c.beginPath();
      c.ellipse(x, y, 2.6, 1.6, k, 0, TAU);
      c.fill();
    }
    c.restore();
    // faded name on the bow
    c.fillStyle = 'rgba(210,200,160,0.55)';
    c.font = 'bold 18px Georgia, "Times New Roman", serif';
    c.textAlign = 'center';
    c.fillText('JURA', 200, -54);
    // deck railing
    c.strokeStyle = 'rgba(60,58,50,0.9)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-262, -96);
    c.lineTo(230, -102);
    c.stroke();
    for (let x = -260; x < 230; x += 22) {
      if (x > 60 && x < 110) continue;
      c.beginPath();
      c.moveTo(x, -80);
      c.lineTo(x, -97 - (x * 6) / 490);
      c.stroke();
    }
    // paddle box and wheel
    c.fillStyle = '#3e3529';
    c.beginPath();
    c.moveTo(-82, -80);
    c.arc(0, -80, 82, Math.PI, TAU);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(120,70,40,0.6)';
    c.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      c.beginPath();
      c.moveTo(0, -80);
      c.lineTo(Math.cos(a) * 74, -80 + Math.sin(a) * 74);
      c.stroke();
    }
    c.strokeStyle = 'rgba(30,26,20,0.9)';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(0, -80, 80, Math.PI, TAU);
    c.stroke();
    c.fillStyle = '#2a241c';
    c.beginPath();
    c.arc(0, -80, 10, 0, TAU);
    c.fill();
    // funnel, tilted
    c.save();
    c.translate(-130, -90);
    c.rotate(-0.22);
    c.fillStyle = '#1c1b18';
    c.fillRect(-12, -118, 24, 120);
    c.fillStyle = 'rgba(150,80,40,0.55)';
    c.fillRect(-12, -104, 24, 9);
    c.restore();
    // broken mast near the bow
    c.save();
    c.translate(170, -96);
    c.rotate(0.35);
    c.fillStyle = '#3b3123';
    c.fillRect(-4, -96, 8, 96);
    c.restore();
    // algae strands waving from the deck
    c.strokeStyle = 'rgba(90,120,70,0.6)';
    c.lineWidth = 1.4;
    for (let k = 0; k < 16; k++) {
      const x = -250 + k * 31;
      const hgt = 18 + ((k * 13) % 26);
      const sway = Math.sin(t * 0.7 + k) * 6;
      c.beginPath();
      c.moveTo(x, -92 - (x * 6) / 490);
      c.quadraticCurveTo(x + sway * 0.4, -100 - hgt * 0.5, x + sway, -100 - hgt);
      c.stroke();
    }
    c.restore();
    // sediment piled against the hull
    c.fillStyle = '#3a3626';
    c.beginPath();
    c.moveTo(jx - 320, groundY(jx - 320));
    c.quadraticCurveTo(jx - 120, gy - 26, jx + 40, gy - 10);
    c.quadraticCurveTo(jx + 200, gy - 22, jx + 330, groundY(jx + 330));
    c.lineTo(jx + 330, gy + 60);
    c.lineTo(jx - 320, gy + 60);
    c.closePath();
    c.fill();
  }

  function drawDeepEdge(c, v, t) {
    const vr = viewRect(v);
    if (vr.x1 < 6880) return;
    worldTransform(c, v);
    const x = 6985;
    const y = groundY(x);
    c.fillStyle = '#5e4a2f';
    c.fillRect(x - 3, y - 70, 6, 72);
    c.fillStyle = '#c9a76a';
    c.fillRect(x - 46, y - 92, 92, 34);
    c.fillStyle = '#2b2214';
    c.font = 'bold 11px "Avenir Next", system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('TIEFSTE STELLE', x, y - 78);
    c.fillText('251 m  ↓', x, y - 64);
  }

  function drawBoats(c, v, t) {
    const vr = viewRect(v);
    if (vr.y0 > 40) return;
    worldTransform(c, v);
    for (const b of boats) {
      const span = WORLD_W + 600;
      const x = ((((b.x + t * b.v) % span) + span) % span) - 300;
      if (x < vr.x0 - 200 || x > vr.x1 + 200) continue;
      const bob = wave(x, t) * 0.8;
      const tilt = (wave(x + 20, t) - wave(x - 20, t)) / 60;
      c.save();
      c.translate(x, bob);
      c.rotate(tilt);
      if (b.kind === 'sail') {
        c.fillStyle = '#f4f1ea';
        c.beginPath();
        c.moveTo(-46, -6);
        c.lineTo(48, -6);
        c.quadraticCurveTo(38, 12, 20, 12);
        c.lineTo(-34, 12);
        c.quadraticCurveTo(-44, 8, -46, -6);
        c.fill();
        c.fillStyle = '#1f4f7a';
        c.fillRect(-46, -2, 94, 3);
        c.strokeStyle = '#ccc';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -6);
        c.lineTo(0, -120);
        c.stroke();
        c.fillStyle = '#fbfbf8';
        c.beginPath();
        c.moveTo(2, -116);
        c.lineTo(2, -12);
        c.lineTo(46, -12);
        c.closePath();
        c.fill();
        c.fillStyle = '#e8e2d2';
        c.beginPath();
        c.moveTo(-2, -100);
        c.lineTo(-2, -12);
        c.lineTo(-34, -12);
        c.closePath();
        c.fill();
      } else {
        c.fillStyle = '#f2f2ee';
        c.beginPath();
        c.moveTo(-110, -14);
        c.lineTo(112, -14);
        c.lineTo(100, 14);
        c.lineTo(-96, 14);
        c.closePath();
        c.fill();
        c.fillStyle = '#c0392b';
        c.fillRect(-110, 4, 222, 4);
        c.fillStyle = '#e9e9e3';
        c.fillRect(-70, -38, 130, 24);
        c.fillStyle = '#35505e';
        for (let k = -64; k < 56; k += 14) c.fillRect(k, -32, 9, 8);
        c.fillStyle = '#fbfbf8';
        c.fillRect(-30, -56, 60, 18);
        c.fillStyle = '#c0392b';
        c.fillRect(10, -74, 14, 20);
      }
      c.restore();
    }
  }

  // ------------------------------------------------------------------ drawing: fish
  function drawFish(c, f, t) {
    const sp = f.sp;
    const L = sp.len * f.size;
    const H = L * sp.h;
    const wag = Math.sin(f.tail) * sp.wag;
    const tb = wag * L * 0.05;
    const tb2 = tb + wag * L * 0.1;
    c.save();
    c.translate(f.x, f.y);
    c.rotate(f.pitch * Math.sign(f.face || 1));
    c.scale(f.face, 1);

    const nose = sp.snout ? 0.56 : sp.flatHead ? 0.5 : 0.5;
    // tail fin
    c.fillStyle = sp.fin;
    c.beginPath();
    c.moveTo(-0.38 * L, tb);
    if (sp.key === 'wels' || sp.barbels) {
      c.quadraticCurveTo(-0.5 * L, tb2 - 0.5 * H, -0.56 * L, tb2 - 0.3 * H);
      c.quadraticCurveTo(-0.6 * L, tb2, -0.56 * L, tb2 + 0.35 * H);
      c.quadraticCurveTo(-0.48 * L, tb2 + 0.4 * H, -0.38 * L, tb);
    } else {
      c.quadraticCurveTo(-0.48 * L, tb2 - 0.3 * H, -0.6 * L, tb2 - 0.55 * H);
      c.quadraticCurveTo(-0.53 * L, tb2, -0.6 * L, tb2 + 0.55 * H);
      c.quadraticCurveTo(-0.48 * L, tb2 + 0.3 * H, -0.38 * L, tb);
    }
    c.fill();

    // fins behind body
    c.fillStyle = sp.fin;
    if (sp.dorsal === 'spiky') {
      c.beginPath();
      c.moveTo(0.18 * L, -0.42 * H);
      for (let k = 0; k <= 6; k++) {
        const x = 0.18 * L - (k * 0.3 * L) / 6;
        c.lineTo(x + 0.02 * L, -0.85 * H);
        c.lineTo(x - 0.025 * L, -0.48 * H);
      }
      c.lineTo(-0.12 * L, -0.42 * H);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(-0.14 * L, -0.42 * H);
      c.quadraticCurveTo(-0.2 * L, -0.78 * H, -0.3 * L, -0.3 * H);
      c.fill();
    } else if (sp.dorsal === 'back') {
      c.beginPath();
      c.moveTo(-0.2 * L, -0.4 * H);
      c.quadraticCurveTo(-0.26 * L, -0.95 * H, -0.36 * L, -0.25 * H);
      c.fill();
    } else if (sp.dorsal === 'small') {
      c.beginPath();
      c.moveTo(0.12 * L, -0.42 * H);
      c.quadraticCurveTo(0.08 * L, -0.75 * H, 0.03 * L, -0.42 * H);
      c.fill();
    } else if (sp.dorsal === 'long') {
      c.beginPath();
      c.moveTo(0.1 * L, -0.42 * H);
      c.quadraticCurveTo(0.05 * L, -0.66 * H, 0, -0.5 * H);
      c.lineTo(-0.34 * L, -0.38 * H);
      c.quadraticCurveTo(-0.36 * L, -0.22 * H, -0.38 * L, -0.15 * H);
      c.closePath();
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(0.08 * L, -0.46 * H);
      c.quadraticCurveTo(0.0, -1.0 * H, -0.12 * L, -0.42 * H);
      c.fill();
      if (sp.key === 'felchen' || sp.key === 'seeforelle') {
        c.beginPath();
        c.ellipse(-0.27 * L, -0.38 * H, 0.03 * L, 0.12 * H, -0.4, 0, TAU);
        c.fill();
      }
    }
    if (sp.analLong) {
      c.beginPath();
      c.moveTo(0.05 * L, 0.42 * H);
      c.lineTo(-0.36 * L, 0.2 * H + tb * 0.5);
      c.quadraticCurveTo(-0.2 * L, 0.72 * H, 0.05 * L, 0.42 * H);
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(-0.1 * L, 0.42 * H);
      c.quadraticCurveTo(-0.16 * L, 0.85 * H, -0.24 * L, 0.32 * H);
      c.fill();
    }
    const flap = Math.sin(f.tail * 1.3) * 0.3;
    c.beginPath();
    c.ellipse(0.08 * L, 0.42 * H, 0.06 * L, 0.12 * H, 0.6 + flap * 0.2, 0, TAU);
    c.fill();

    // body
    const body = new Path2D();
    const ny = sp.flatHead ? 0.08 * H : 0.04 * H;
    body.moveTo(nose * L, ny);
    if (sp.flatHead) {
      body.bezierCurveTo(0.48 * L, -0.4 * H, 0.3 * L, -0.5 * H, 0.1 * L, -0.48 * H);
    } else if (sp.snout) {
      body.bezierCurveTo(0.5 * L, -0.18 * H, 0.32 * L, -0.48 * H, 0.08 * L, -0.5 * H);
    } else {
      body.bezierCurveTo(0.46 * L, -0.42 * H, 0.22 * L, -0.54 * H, 0.0, -0.5 * H);
    }
    body.bezierCurveTo(-0.2 * L, -0.46 * H, -0.32 * L, -0.2 * H + tb, -0.4 * L, tb - 0.1 * H);
    body.lineTo(-0.4 * L, tb + 0.1 * H);
    body.bezierCurveTo(-0.3 * L, 0.24 * H + tb, -0.16 * L, 0.5 * H, 0.0, 0.5 * H);
    if (sp.snout) body.bezierCurveTo(0.3 * L, 0.48 * H, 0.48 * L, 0.2 * H, nose * L, ny);
    else body.bezierCurveTo(0.22 * L, 0.48 * H, 0.44 * L, 0.36 * H, nose * L, ny);
    body.closePath();
    const bg = c.createLinearGradient(0, -0.5 * H, 0, 0.5 * H);
    bg.addColorStop(0, sp.back);
    bg.addColorStop(0.5, sp.flank);
    bg.addColorStop(1, sp.belly);
    c.fillStyle = bg;
    c.fill(body);

    // patterns
    c.save();
    c.clip(body);
    if (sp.pattern === 'stripes') {
      c.fillStyle = 'rgba(30,40,15,0.55)';
      for (let k = 0; k < 6; k++) {
        const x = 0.26 * L - k * 0.11 * L;
        c.beginPath();
        c.moveTo(x, -0.6 * H);
        c.lineTo(x + 0.04 * L, -0.6 * H);
        c.lineTo(x + 0.01 * L, 0.25 * H);
        c.lineTo(x - 0.03 * L, 0.25 * H);
        c.closePath();
        c.fill();
      }
    } else if (sp.pattern === 'spotsLight') {
      c.fillStyle = 'rgba(230,226,170,0.55)';
      for (let k = 0; k < 22; k++) {
        const x = 0.35 * L - ((k * 0.73) % 1) * 0.72 * L;
        const y = -0.3 * H + ((k * 0.41) % 1) * 0.55 * H;
        c.beginPath();
        c.ellipse(x, y, 0.022 * L, 0.06 * H, 0.3, 0, TAU);
        c.fill();
      }
    } else if (sp.pattern === 'spotsDark') {
      c.fillStyle = 'rgba(25,25,30,0.7)';
      for (let k = 0; k < 18; k++) {
        const x = 0.3 * L - ((k * 0.61) % 1) * 0.62 * L;
        const y = -0.36 * H + ((k * 0.37) % 1) * 0.42 * H;
        c.beginPath();
        c.arc(x, y, 0.012 * L + 0.4, 0, TAU);
        c.fill();
      }
    } else if (sp.pattern === 'mottled') {
      c.fillStyle = 'rgba(20,22,12,0.4)';
      for (let k = 0; k < 26; k++) {
        const x = 0.4 * L - ((k * 0.57) % 1) * 0.8 * L;
        const y = -0.45 * H + ((k * 0.29) % 1) * 0.7 * H;
        c.beginPath();
        c.ellipse(x, y, 0.035 * L, 0.12 * H, k, 0, TAU);
        c.fill();
      }
    }
    if (sp.pattern === 'silver' || sp.key === 'seeforelle') {
      const sh = c.createLinearGradient(0, -0.2 * H, 0, 0.15 * H);
      sh.addColorStop(0, 'rgba(255,255,255,0)');
      sh.addColorStop(0.5, 'rgba(255,255,255,0.4)');
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sh;
      c.fillRect(-0.4 * L, -0.2 * H, 0.9 * L, 0.35 * H);
    }
    c.restore();
    // lateral line + gill
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = Math.max(0.6, L * 0.008);
    c.beginPath();
    c.moveTo(0.3 * L, -0.08 * H);
    c.quadraticCurveTo(0, -0.12 * H, -0.38 * L, tb);
    c.stroke();
    c.beginPath();
    c.arc(0.2 * L, 0.02 * H, 0.32 * H, -0.9, 0.9);
    c.stroke();
    // eye
    const ex = (sp.snout ? 0.36 : sp.flatHead ? 0.4 : 0.36) * L;
    const ey = (sp.flatHead ? -0.12 : -0.14) * H;
    const er = Math.max(1.4, (sp.flatHead ? 0.06 : 0.11) * H);
    c.fillStyle = sp.eye;
    c.beginPath();
    c.arc(ex, ey, er, 0, TAU);
    c.fill();
    c.fillStyle = '#0b0b0b';
    c.beginPath();
    c.arc(ex + er * 0.15, ey, er * 0.55, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.arc(ex + er * 0.35, ey - er * 0.35, er * 0.22, 0, TAU);
    c.fill();
    // barbels
    if (sp.barbels) {
      c.strokeStyle = sp.back;
      c.lineCap = 'round';
      const wig = Math.sin(t * 1.4 + f.tail * 0.2);
      if (sp.barbels === 'wels') {
        c.lineWidth = 2.4;
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(0.47 * L, 0.0);
          c.bezierCurveTo(0.55 * L, -0.25 * H + side * 4, 0.42 * L, 0.6 * H + wig * 6, 0.2 * L + side * 6, 0.9 * H + wig * 8);
          c.stroke();
        }
        c.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.moveTo(0.44 * L - k * 3, 0.22 * H);
          c.quadraticCurveTo(0.45 * L - k * 4, 0.45 * H, 0.38 * L - k * 5 + wig * 2, 0.62 * H);
          c.stroke();
        }
      } else {
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(0.46 * L, 0.18 * H);
        c.quadraticCurveTo(0.47 * L, 0.45 * H, 0.42 * L + wig * 2, 0.62 * H);
        c.stroke();
      }
    }
    // mouth
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = Math.max(0.6, L * 0.008);
    c.beginPath();
    c.moveTo(nose * L, ny + 0.02 * H);
    c.lineTo(nose * L - 0.06 * L, ny + 0.06 * H);
    c.stroke();
    c.restore();
  }

  function drawFishes(c, v, t) {
    const vr = viewRect(v);
    worldTransform(c, v);
    for (const f of fishes) {
      const m = f.sp.len * 0.8;
      if (f.x < vr.x0 - m || f.x > vr.x1 + m || f.y < vr.y0 - m || f.y > vr.y1 + m) continue;
      drawFish(c, f, t);
    }
  }

  // ------------------------------------------------------------------ drawing: submarine
  function subGeometry() {
    const sgn = sub.face >= 0 ? 1 : -1;
    const a = sub.tilt;
    const lx = 62 * Math.abs(sub.face);
    const ly = 6;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // local -> world: scale(face) then rotate(a)
    const px = sgn * lx;
    const lampX = sub.x + px * ca - ly * sa;
    const lampY = sub.y + px * sa + ly * ca;
    const dirx = sgn * ca;
    const diry = sgn * sa;
    return { lampX, lampY, ang: Math.atan2(diry, dirx) };
  }

  function drawSub(c, v, t) {
    worldTransform(c, v);
    const gy = groundY(sub.x);
    const hgt = gy - sub.y;
    if (hgt < 260) {
      c.fillStyle = `rgba(0,10,10,${0.28 * (1 - hgt / 260)})`;
      c.beginPath();
      c.ellipse(sub.x, gy + 2, 70 * (0.6 + hgt / 600), 9, 0, 0, TAU);
      c.fill();
    }
    c.save();
    c.translate(sub.x, sub.y + Math.sin(t * 1.6) * 1.2);
    c.rotate(sub.tilt);
    c.scale(sub.face, 1);

    // propeller
    c.save();
    c.translate(-66, 2);
    c.fillStyle = '#6e5320';
    c.fillRect(-4, -3, 8, 6);
    for (let k = 0; k < 3; k++) {
      const a = sub.prop + (k * TAU) / 3;
      const s = Math.sin(a);
      c.fillStyle = s > 0 ? '#c99a2c' : '#a77c1c';
      c.beginPath();
      c.ellipse(-4, s * 9, 3.2, Math.abs(Math.cos(a)) * 9 + 1.5, 0, 0, TAU);
      c.fill();
    }
    c.strokeStyle = '#8a6a22';
    c.lineWidth = 2.4;
    c.beginPath();
    c.ellipse(-4, 0, 5, 14, 0, 0, TAU);
    c.stroke();
    c.restore();

    // tail fins
    c.fillStyle = '#e8ae1a';
    c.beginPath();
    c.moveTo(-50, -10);
    c.lineTo(-66, -26);
    c.lineTo(-60, -8);
    c.closePath();
    c.moveTo(-50, 12);
    c.lineTo(-66, 26);
    c.lineTo(-60, 10);
    c.closePath();
    c.fill();

    // body
    const body = new Path2D();
    body.moveTo(-60, 0);
    body.bezierCurveTo(-60, -20, -34, -24, 0, -24);
    body.bezierCurveTo(40, -24, 64, -16, 64, 2);
    body.bezierCurveTo(64, 18, 40, 23, 0, 23);
    body.bezierCurveTo(-34, 23, -60, 18, -60, 0);
    body.closePath();
    const bg = c.createLinearGradient(0, -24, 0, 23);
    bg.addColorStop(0, '#fff3a0');
    bg.addColorStop(0.35, '#ffd83f');
    bg.addColorStop(0.75, '#f0b414');
    bg.addColorStop(1, '#b97f00');
    c.fillStyle = bg;
    c.fill(body);
    c.save();
    c.clip(body);
    c.fillStyle = 'rgba(150,95,0,0.5)';
    c.fillRect(-70, 12, 140, 14);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(4, -15, 46, 4, 0, 0, TAU);
    c.fill();
    c.restore();
    c.strokeStyle = '#8a5d00';
    c.lineWidth = 1.4;
    c.stroke(body);
    // seams and rivets
    c.strokeStyle = 'rgba(120,80,0,0.45)';
    c.lineWidth = 1;
    for (const x of [-36, 40]) {
      c.beginPath();
      c.moveTo(x, -22);
      c.quadraticCurveTo(x + 4, 0, x, 22);
      c.stroke();
    }
    c.fillStyle = 'rgba(120,80,0,0.6)';
    for (let k = -50; k <= 54; k += 8) {
      c.beginPath();
      c.arc(k, 15, 0.9, 0, TAU);
      c.fill();
    }

    // conning tower
    const tg = c.createLinearGradient(0, -42, 0, -20);
    tg.addColorStop(0, '#ffe680');
    tg.addColorStop(1, '#e9a90f');
    c.fillStyle = tg;
    c.beginPath();
    c.moveTo(-24, -21);
    c.lineTo(-20, -40);
    c.quadraticCurveTo(-18, -44, -12, -44);
    c.lineTo(12, -44);
    c.quadraticCurveTo(20, -44, 22, -36);
    c.lineTo(26, -21);
    c.closePath();
    c.fill();
    c.strokeStyle = '#8a5d00';
    c.stroke();
    c.fillStyle = '#3a2a00';
    c.font = 'bold 8px "Avenir Next", system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('LEO 1', 1, -29);
    // hatch and periscope
    c.fillStyle = '#c99312';
    c.beginPath();
    c.ellipse(-4, -45, 8, 3, 0, 0, TAU);
    c.fill();
    c.strokeStyle = '#7d6a3a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(10, -44);
    c.lineTo(10, -60);
    c.lineTo(18, -60);
    c.stroke();
    c.fillStyle = '#9ad1e6';
    c.fillRect(17, -62, 3, 4);

    // portholes
    for (const [px, kid] of [[-26, false], [-2, false], [22, true]]) {
      c.fillStyle = '#b07d22';
      c.beginPath();
      c.arc(px, -2, 8.5, 0, TAU);
      c.fill();
      const gg = c.createRadialGradient(px - 2, -4, 1, px, -2, 7);
      gg.addColorStop(0, '#9fe3ee');
      gg.addColorStop(1, '#1d5a70');
      c.fillStyle = gg;
      c.beginPath();
      c.arc(px, -2, 6.3, 0, TAU);
      c.fill();
      if (kid) {
        c.save();
        c.beginPath();
        c.arc(px, -2, 6.3, 0, TAU);
        c.clip();
        c.fillStyle = '#f2c49b';
        c.beginPath();
        c.arc(px + 1, 0, 3.2, 0, TAU);
        c.fill();
        c.fillStyle = '#d6332a';
        c.beginPath();
        c.arc(px + 1, -2.2, 3.4, Math.PI, TAU);
        c.fill();
        c.fillRect(px + 1, -2.6, 4.2, 1.2);
        c.fillStyle = '#2d6fb5';
        c.fillRect(px - 3, 3.3, 8, 4);
        c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(px - 2.5, -4.5, 1.6, 0, TAU);
      c.fill();
    }
    // dive planes
    c.fillStyle = '#e8ae1a';
    c.beginPath();
    c.moveTo(44, 8);
    c.lineTo(58, 16);
    c.lineTo(42, 14);
    c.closePath();
    c.fill();
    // lamp
    c.fillStyle = '#6e5320';
    c.fillRect(58, 2, 8, 8);
    c.fillStyle = sub.light ? '#fffbe0' : '#6f6a55';
    c.beginPath();
    c.arc(65, 6, 3.4, 0, TAU);
    c.fill();
    c.restore();
  }

  function drawBubbles(c, v) {
    worldTransform(c, v);
    c.strokeStyle = 'rgba(230,255,250,0.7)';
    c.lineWidth = 1;
    for (const b of bubbles) {
      c.fillStyle = `rgba(220,255,250,${0.18 * b.life})`;
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, TAU);
      c.fill();
      c.stroke();
    }
  }

  // logbook pages, scan rings
  function drawPages(c, v, t) {
    worldTransform(c, v);
    for (const s of SITES) {
      if (state.found.includes(s.id)) continue;
      const bob = Math.sin(t * 1.6 + s.x) * 4;
      const x = s.x;
      const y = s.y + bob;
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(x, y, 2, x, y, 60);
      const pulse = 0.55 + 0.25 * Math.sin(t * 2.4 + s.x);
      g.addColorStop(0, `rgba(255,220,130,${0.65 * pulse})`);
      g.addColorStop(1, 'rgba(255,220,130,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, 60, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      c.save();
      c.translate(x, y);
      c.rotate(Math.sin(t * 0.9 + s.x) * 0.2);
      c.fillStyle = '#fbf1d6';
      c.fillRect(-12, -16, 24, 32);
      c.fillStyle = '#e2cf9b';
      c.beginPath();
      c.moveTo(12, -16);
      c.lineTo(12, -8);
      c.lineTo(4, -16);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(80,60,30,0.6)';
      c.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.moveTo(-8, -9 + k * 5);
        c.lineTo(k === 4 ? 2 : 8, -9 + k * 5);
        c.stroke();
      }
      c.restore();
      // scan ring
      const d = Math.hypot(sub.x - x, sub.y - y);
      if (d < s.r * 2.2 || s.scan > 0) {
        c.strokeStyle = `rgba(125,255,176,${0.35 * (1 - clamp((d - s.r) / (s.r * 1.2), 0, 1))})`;
        c.lineWidth = 2;
        c.setLineDash([8, 10]);
        c.lineDashOffset = -t * 20;
        c.beginPath();
        c.arc(x, y, s.r, 0, TAU);
        c.stroke();
        c.setLineDash([]);
        if (s.scan > 0) {
          c.strokeStyle = 'rgba(125,255,176,0.95)';
          c.lineWidth = 5;
          c.lineCap = 'round';
          c.beginPath();
          c.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + s.scan * TAU);
          c.stroke();
        }
      }
    }
  }

  // ------------------------------------------------------------------ lighting
  function drawLighting(c, v, t, opts) {
    const lc = opts && opts.lightCtx ? opts.lightCtx : lctx;
    const lcv = lc.canvas;
    const k = lcv.width / v.w;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, lcv.width, lcv.height);
    const dim = v.photo ? 0.42 : 1;
    const syTop = syOf(v, 0) * k;
    const g = lc.createLinearGradient(0, syTop, 0, syOf(v, 1500) * k);
    for (let i = 0; i <= 10; i++) {
      const wy = i * 150;
      const m = toMeters(wy);
      const a = Math.pow(clamp((m - 3) / 33, 0, 1), 1.15) * 0.9 * dim;
      g.addColorStop(i / 10, `rgba(1,12,20,${a.toFixed(3)})`);
    }
    lc.fillStyle = g;
    lc.fillRect(0, Math.max(0, syTop), lcv.width, lcv.height);

    lc.globalCompositeOperation = 'destination-out';
    lc.setTransform(k * v.s, 0, 0, k * v.s, k * (v.w / 2 - v.cx * v.s), k * (v.h / 2 - v.cy * v.s));
    if (v.photo) {
      const r = 520;
      const pg = lc.createRadialGradient(v.cx, v.cy, 10, v.cx, v.cy, r);
      pg.addColorStop(0, 'rgba(0,0,0,0.95)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = pg;
      lc.fillRect(v.cx - r, v.cy - r, r * 2, r * 2);
    } else {
      const geo = subGeometry();
      if (sub.light) {
        const L = 560;
        const cg = lc.createRadialGradient(geo.lampX, geo.lampY, 4, geo.lampX, geo.lampY, L);
        cg.addColorStop(0, 'rgba(0,0,0,1)');
        cg.addColorStop(0.55, 'rgba(0,0,0,0.8)');
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = cg;
        lc.beginPath();
        lc.moveTo(geo.lampX, geo.lampY);
        lc.arc(geo.lampX, geo.lampY, L, geo.ang - 0.44, geo.ang + 0.44);
        lc.closePath();
        lc.fill();
      }
      const ag = lc.createRadialGradient(sub.x, sub.y, 10, sub.x, sub.y, 150);
      ag.addColorStop(0, 'rgba(0,0,0,0.6)');
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = ag;
      lc.fillRect(sub.x - 150, sub.y - 150, 300, 300);
      for (const s of SITES) {
        if (state.found.includes(s.id)) continue;
        const pg = lc.createRadialGradient(s.x, s.y, 4, s.x, s.y, 95);
        pg.addColorStop(0, 'rgba(0,0,0,0.85)');
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = pg;
        lc.fillRect(s.x - 95, s.y - 95, 190, 190);
      }
      for (const sp of sparkles) {
        lc.fillStyle = 'rgba(0,0,0,0.5)';
        lc.beginPath();
        lc.arc(sp.x, sp.y, 26, 0, TAU);
        lc.fill();
      }
    }
    screenTransform(c, v);
    c.drawImage(lcv, 0, 0, v.w, v.h);

    if (!v.photo && sub.light) {
      // visible beam + backscatter
      worldTransform(c, v);
      const geo = subGeometry();
      c.globalCompositeOperation = 'lighter';
      const depthK = 0.35 + 0.65 * smoothstep(80, 900, sub.y);
      const bg = c.createRadialGradient(geo.lampX, geo.lampY, 2, geo.lampX, geo.lampY, 520);
      bg.addColorStop(0, `rgba(255,240,200,${0.2 * depthK})`);
      bg.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(geo.lampX, geo.lampY);
      c.arc(geo.lampX, geo.lampY, 520, geo.ang - 0.4, geo.ang + 0.4);
      c.closePath();
      c.fill();
      c.fillStyle = `rgba(255,250,225,${0.55 * depthK})`;
      for (const p of plankton) {
        const dx = p.x - geo.lampX;
        const dy = p.y - geo.lampY;
        const d = Math.hypot(dx, dy);
        if (d > 480 || d < 8) continue;
        let da = Math.atan2(dy, dx) - geo.ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > 0.42) continue;
        const a = (1 - d / 480) * (1 - Math.abs(da) / 0.42);
        c.globalAlpha = a;
        c.fillRect(p.x, p.y, 1.8 * p.z, 1.8 * p.z);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
  }

  function drawPlankton(c, v, t) {
    worldTransform(c, v);
    c.fillStyle = 'rgba(220,240,230,0.35)';
    for (const p of plankton) {
      if (p.y < 6) continue;
      c.fillRect(p.x, p.y, 1.3 * p.z, 1.3 * p.z);
    }
  }

  function drawSparkles(c, v) {
    worldTransform(c, v);
    c.globalCompositeOperation = 'lighter';
    for (const s of sparkles) {
      c.fillStyle = `rgba(255,${200 + Math.floor(s.hue * 55)},120,${s.life})`;
      c.beginPath();
      c.arc(s.x, s.y, s.r * s.life + 0.5, 0, TAU);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }

  function drawPing(c, v) {
    if (!ping) return;
    worldTransform(c, v);
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const r = (ping.t - k * 0.18) * 1100;
      if (r <= 0) continue;
      const a = clamp(1 - r / 1600, 0, 1) * 0.6;
      c.strokeStyle = `rgba(125,255,176,${a})`;
      c.lineWidth = (4 - k) / v.s;
      c.beginPath();
      c.arc(ping.x, ping.y, r, 0, TAU);
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }

  function drawStick(c, v) {
    if (!(input.active && state.control === 'stick' && state.mode === 'play')) return;
    screenTransform(c, v);
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(input.ox, input.oy, 70, 0, TAU);
    c.stroke();
    let dx = input.sx - input.ox;
    let dy = input.sy - input.oy;
    const d = Math.hypot(dx, dy);
    if (d > 70) {
      dx = (dx / d) * 70;
      dy = (dy / d) * 70;
    }
    c.fillStyle = 'rgba(255,214,63,0.85)';
    c.beginPath();
    c.arc(input.ox + dx, input.oy + dy, 26, 0, TAU);
    c.fill();
  }

  function drawHoldTarget(c, v, t) {
    if (!(input.active && state.control === 'hold' && state.mode === 'play')) return;
    screenTransform(c, v);
    const r = 18 + Math.sin(t * 6) * 3;
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(input.sx, input.sy, r, 0, TAU);
    c.stroke();
  }

  function render(v, t) {
    const c = v.ctx;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    drawBackground(c, v, t);
    drawRidges(c, v, t);
    drawRays(c, v, t);
    drawBoats(c, v, t);
    drawSurface(c, v, t);
    drawShore(c, v, t);
    drawPfahlbauten(c, v, t);
    drawTerrain(c, v, t);
    drawDeepEdge(c, v, t);
    drawWelsHome(c, v, t);
    drawAnchor(c, v, t);
    drawJura(c, v, t);
    drawPlants(c, v, t, false);
    drawPlankton(c, v, t);
    drawFishes(c, v, t);
    if (!v.photo) {
      drawBubbles(c, v);
      drawSub(c, v, t);
    }
    drawPlants(c, v, t, true);
    drawReeds(c, v, t);
    if (!v.photo) drawPages(c, v, t);
    drawLighting(c, v, t, v.photo ? { lightCtx: v.lightCtx } : null);
    if (!v.photo) {
      drawSparkles(c, v);
      drawPing(c, v);
      screenTransform(c, v);
      c.drawImage(vignetteCv, 0, 0, v.w, v.h);
      drawHoldTarget(c, v, t);
      drawStick(c, v);
    }
  }

  // ------------------------------------------------------------------ simulation
  function updateSub(dt) {
    const MAXV = 190;
    let dvx = 0;
    let dvy = 0;
    let steering = false;
    if (state.mode === 'play') {
      if (input.active) {
        steering = true;
        if (state.control === 'stick') {
          const dx = input.sx - input.ox;
          const dy = input.sy - input.oy;
          const d = Math.hypot(dx, dy);
          const m = clamp((d - 6) / 64, 0, 1);
          if (d > 0.01) {
            dvx = (dx / d) * MAXV * m;
            dvy = (dy / d) * MAXV * m;
          }
        } else {
          const wx = cam.x + (input.sx - W / 2) / SCALE;
          const wy = cam.y + (input.sy - H / 2) / SCALE;
          const dx = wx - sub.x;
          const dy = wy - sub.y;
          const d = Math.hypot(dx, dy);
          const m = clamp((d - 8) / 150, 0, 1);
          if (d > 0.01) {
            dvx = (dx / d) * MAXV * m;
            dvy = (dy / d) * MAXV * m;
          }
        }
      }
      const kx = (input.keys.right ? 1 : 0) - (input.keys.left ? 1 : 0);
      const ky = (input.keys.down ? 1 : 0) - (input.keys.up ? 1 : 0);
      if (kx || ky) {
        steering = true;
        const d = Math.hypot(kx, ky);
        dvx = (kx / d) * MAXV;
        dvy = (ky / d) * MAXV;
      }
    }
    if (steering) {
      const ax = clamp((dvx - sub.vx) * 2.6, -480, 480);
      const ay = clamp((dvy - sub.vy) * 2.6, -480, 480);
      sub.vx += ax * dt;
      sub.vy += ay * dt;
    } else {
      sub.vx *= Math.exp(-1.6 * dt);
      sub.vy *= Math.exp(-1.6 * dt);
    }
    sub.x += sub.vx * dt;
    sub.y += sub.vy * dt;
    // world limits
    if (sub.x < 230) { sub.x = 230; sub.vx = Math.max(0, sub.vx); }
    if (sub.x > RIGHT_LIMIT) {
      sub.x = RIGHT_LIMIT;
      sub.vx = Math.min(0, sub.vx);
      if (!state.flags.edge) {
        state.flags.edge = true;
        say('Stopp, Kapitän! Dahinter fällt der See steil ab. An seiner tiefsten Stelle ist der Bodensee 251 Meter tief – zu tief für unser kleines U-Boot.');
      }
    }
    if (sub.y < 26) { sub.y = 26; sub.vy = Math.max(0, sub.vy); }
    const g = groundY(sub.x) - 26;
    if (sub.y > g) {
      sub.y = g;
      if (sub.vy > 0) sub.vy *= -0.15;
    }
    // look and feel
    sub.speed = Math.hypot(sub.vx, sub.vy);
    if (Math.abs(sub.vx) > 14) sub.faceT = Math.sign(sub.vx);
    sub.face = damp(sub.face, sub.faceT, 6, dt);
    if (Math.abs(sub.face) < 0.05) sub.face = sub.faceT * 0.05;
    const tiltT = clamp(sub.vy / 320, -0.32, 0.32) * Math.sign(sub.faceT);
    sub.tilt = damp(sub.tilt, tiltT, 4, dt);
    sub.prop += dt * (2 + sub.speed * 0.12);
    // bubbles from the propeller
    if (sub.speed > 25 && sub.y > 30 && Math.random() < dt * (4 + sub.speed * 0.08)) {
      const bx = sub.x - sub.face * 70;
      bubbles.push({ x: bx + R(-4, 4), y: sub.y + R(-6, 6), r: R(1.5, 4), vy: R(-50, -30), life: 1, wob: R(0, TAU) });
      if (Math.random() < 0.12) Sound.bubble();
    }
  }

  function updateBubbles(dt) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.vy -= 20 * dt;
      b.y += b.vy * dt;
      b.wob += dt * 5;
      b.x += Math.sin(b.wob) * 12 * dt;
      b.r += dt * 0.5;
      if (b.y < 4) b.life -= dt * 6;
      else b.life -= dt * 0.12;
      if (b.life <= 0) bubbles.splice(i, 1);
    }
    if (bubbles.length > 160) bubbles.splice(0, bubbles.length - 160);
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.exp(-1.5 * dt);
      s.vy = s.vy * Math.exp(-1.5 * dt) - 12 * dt;
      s.life -= dt * 0.7;
      if (s.life <= 0) sparkles.splice(i, 1);
    }
  }

  function updatePlankton(dt, t) {
    const vr = viewRect(mainView());
    const spanX = vr.x1 - vr.x0 + 200;
    const spanY = vr.y1 - vr.y0 + 200;
    for (const p of plankton) {
      p.x += Math.sin(t * 0.3 + p.ph) * 4 * dt;
      p.y += (Math.cos(t * 0.25 + p.ph) * 3 + 2) * dt;
      if (p.x < vr.x0 - 100) p.x += spanX;
      else if (p.x > vr.x1 + 100) p.x -= spanX;
      if (p.y < vr.y0 - 100) p.y += spanY;
      else if (p.y > vr.y1 + 100) p.y -= spanY;
    }
  }

  function steerFish(f, tx, ty, speed, dt, k) {
    const dx = tx - f.x;
    const dy = ty - f.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(speed, d * 1.6);
    f.vx += ((dx / d) * sp - f.vx) * Math.min(1, k * dt);
    f.vy += ((dy / d) * sp - f.vy) * Math.min(1, k * dt);
  }

  function updateFishes(dt, t) {
    // groups wander
    for (const g of groups) {
      g.ang += (n1(t * 0.1 + g.x * 0.001) * 0.8) * dt;
      const sp = SPECIES[g.sp].cruise * 0.7;
      g.vx = Math.cos(g.ang) * sp;
      g.vy = Math.sin(g.ang) * sp * 0.4;
      const z = g.zone;
      const floor = groundY(g.x) - 60;
      if (g.x < z.x0) g.ang = damp(g.ang, 0, 1.2, dt);
      if (g.x > z.x1) g.ang = damp(g.ang, Math.PI, 1.2, dt);
      if (g.y < Math.max(z.y0, 50)) g.vy += 20;
      if (g.y > Math.min(z.y1, floor)) g.vy -= 26;
      const ds = Math.hypot(sub.x - g.x, sub.y - g.y);
      if (ds < 220) {
        g.vx += ((g.x - sub.x) / ds) * 60;
        g.vy += ((g.y - sub.y) / ds) * 40;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.y = clamp(g.y, 50, Math.max(60, floor));
    }
    felchenRing.swell = damp(felchenRing.swell, Math.hypot(sub.x - felchenRing.x, sub.y - felchenRing.y) < 220 ? 1 : 0, 1.5, dt);

    for (const f of fishes) {
      const sp = f.sp;
      let speed = sp.cruise;
      if (f.group) {
        const g = f.group;
        f.slot.a += dt * 0.25;
        const tx = g.x + Math.cos(f.slot.a) * g.spread * 1.6 * f.slot.r;
        const ty = g.y + Math.sin(f.slot.a * 1.3) * g.spread * 0.7 * f.slot.r + f.slot.z * 10;
        steerFish(f, tx, ty, sp.cruise * 1.5, dt, 2.2);
      } else if (f.mode === 'ring') {
        const R0 = felchenRing;
        f.slot.a += dt * 0.42 * f.slot.sp;
        const rr = f.slot.r + R0.swell * 70;
        const tx = R0.x + Math.cos(f.slot.a) * rr;
        const ty = R0.y + Math.sin(f.slot.a) * rr * 0.42 + f.slot.z * 16;
        steerFish(f, tx, ty, 110, dt, 2.5);
      } else if (f.mode === 'lurk') {
        f.timer -= dt;
        if (f.timer < 0) {
          f.timer = R(3, 7);
          f.tx = f.home.x + R(-160, 160);
          f.ty = clamp(f.home.y + R(-60, 60), 60, groundY(f.home.x) - 50);
          f.boost = Math.random() < 0.3 ? 1 : 0;
        }
        speed = f.boost ? 160 : 18;
        f.boost = Math.max(0, f.boost - dt * 0.8);
        steerFish(f, f.tx, f.ty, speed, dt, 1.4);
      } else if (f.mode === 'roam') {
        f.timer -= dt;
        if (f.timer < 0 || Math.hypot(f.tx - f.x, f.ty - f.y) < 30) {
          f.timer = R(5, 10);
          f.tx = clamp(f.home.x + R(-700, 700), 400, 6900);
          f.ty = clamp(R(250, 1150), 120, groundY(f.tx) - 80);
        }
        steerFish(f, f.tx, f.ty, speed, dt, 0.8);
      } else if (f.mode === 'bottom' || f.mode === 'wels') {
        f.timer -= dt;
        const range = f.mode === 'wels' ? 260 : 300;
        if (f.timer < 0 || Math.hypot(f.tx - f.x, f.ty - f.y) < 20) {
          f.timer = R(6, 12);
          f.tx = f.home.x + R(-range, range);
          f.ty = groundY(f.tx) - (f.mode === 'wels' ? R(36, 70) : R(18, 34));
        }
        steerFish(f, f.tx, f.ty, speed, dt, 0.6);
      }
      // gentle flee from the submarine
      const dx = f.x - sub.x;
      const dy = f.y - sub.y;
      const d = Math.hypot(dx, dy);
      const fleeR = f.mode === 'wels' ? 110 : 150;
      if (d < fleeR && d > 0.1 && state.mode !== 'title') {
        const k = (1 - d / fleeR) * (f.mode === 'wels' ? 50 : 160);
        f.vx += (dx / d) * k * dt * 4;
        f.vy += (dy / d) * k * dt * 4;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const floor = groundY(f.x) - sp.len * f.size * sp.h * 0.6 - 4;
      if (f.y > floor) { f.y = floor; f.vy = Math.min(0, f.vy); }
      if (f.y < 34) { f.y = 34; f.vy = Math.max(0, f.vy); }
      f.x = clamp(f.x, 260, RIGHT_LIMIT + 40);
      const sp2 = Math.hypot(f.vx, f.vy);
      if (Math.abs(f.vx) > 4) f.faceT = Math.sign(f.vx);
      f.face = damp(f.face, f.faceT, 5, dt);
      if (Math.abs(f.face) < 0.04) f.face = f.faceT * 0.04;
      f.pitch = damp(f.pitch, clamp(f.vy / (sp2 + 20), -0.45, 0.45) * 0.6, 4, dt);
      f.tail += dt * (2.5 + sp2 * 0.09) * sp.freq * 2;
    }
  }

  function updateGame(dt) {
    state.elapsed += dt;
    const m = toMeters(sub.y);
    if (m > state.maxDepth) state.maxDepth = m;
    // story triggers
    const F = state.flags;
    if (!F.dived && m > 4) {
      F.dived = true;
      say('Super, du tauchst! Siehst du die goldenen Lichter? Das sind meine Logbuch-Seiten. Das Sonar unten links zeigt sie als grüne Punkte.');
    }
    if (!F.deep && m > 20) {
      F.deep = true;
      say('Hier unten kommt kaum noch Sonnenlicht an. Darum wachsen keine Pflanzen mehr – die brauchen Licht zum Leben.');
    }
    if (F.deep && !F.surfaced && m < 1.2) {
      F.surfaced = true;
      say('Aufgetaucht! Schau mal nach oben: Hinter dem See siehst du die Berge der Alpen.');
    }
    if (!sub.light && m > 18 && !F.lightHint) {
      F.lightHint = true;
      say('Es ist ganz schön dunkel hier. Tipp auf „Licht“, dann leuchtet dein Scheinwerfer.');
    }
    // idle hint
    if (sub.speed < 8 && !input.active) state.idle += dt;
    else state.idle = 0;
    if (state.idle > 22 && !radio.cur && state.found.length < SITES.length) {
      state.idle = -40;
      say('Tipp: Drück auf „Ping“. Dann zeigt dir ein grüner Pfeil, wo die nächste Logbuch-Seite liegt.');
      $('btnPing').classList.add('pulse');
    }
    // scanning pages
    let scanning = 0;
    for (const s of SITES) {
      if (state.found.includes(s.id)) continue;
      const d = Math.hypot(sub.x - s.x, sub.y - s.y);
      if (d < s.r && !discovering) {
        s.scan = Math.min(1, s.scan + dt / 1.3);
        scanning = Math.max(scanning, s.scan);
        if (s.scan >= 1) beginDiscovery(s);
      } else {
        s.scan = Math.max(0, s.scan - dt * 0.9);
      }
    }
    Sound.scan(scanning);
    if (discovering) {
      discovering.t += dt;
      if (discovering.t > 1.0) {
        const s = discovering.site;
        discovering = null;
        openCard(s, true);
      }
    }
    // fish book
    for (const f of fishes) {
      const d = Math.hypot(f.x - sub.x, f.y - sub.y);
      const visible = sub.light || toMeters(f.y) < 16 || d < 120;
      if (d < 210 && visible) {
        f.seenT += dt;
        if (f.seenT > 0.35 && !state.seen.has(f.key)) markSeen(f.key);
      } else f.seenT = 0;
    }
    if (fishTag) {
      fishTag.t -= dt;
      if (fishTag.t <= 0) {
        fishTag = null;
        $('fishTag').hidden = true;
      }
    }
    // ping
    if (ping) {
      ping.t += dt;
      if (ping.t > 1.6) ping = null;
    }
    if (pingInfo) {
      pingInfo.t -= dt;
      if (pingInfo.t <= 0) {
        pingInfo = null;
        $('pingHint').hidden = true;
      }
    }
    pingCooldown = Math.max(0, pingCooldown - dt);
    $('btnPing').classList.toggle('cooling', pingCooldown > 0);
    // autosave
    autosaveT += dt;
    if (autosaveT > 8) {
      autosaveT = 0;
      saveProgress();
    }
  }
  let autosaveT = 0;

  function updateCamera(dt, instant) {
    const hw = W / (2 * SCALE);
    const hh = H / (2 * SCALE);
    let tx;
    let ty;
    if (state.mode === 'title') {
      tx = 1050 + Math.sin(state.time * 0.07) * 380;
      ty = hh * 0.45 + 40;
    } else {
      tx = sub.x + clamp(sub.vx * 0.6, -160, 160);
      ty = sub.y + clamp(sub.vy * 0.3, -80, 80) + 20;
    }
    const k = state.mode === 'title' ? 0.6 : 2.4;
    cam.x = instant ? tx : damp(cam.x, tx, k, dt);
    cam.y = instant ? ty : damp(cam.y, ty, k, dt);
    cam.x = clamp(cam.x, hw - 60, WORLD_W - hw);
    const minY = hh * 0.32;
    const maxY = Math.max(minY, maxGround(cam.x - hw, cam.x + hw) + 70 - hh);
    cam.y = clamp(cam.y, minY, maxY);
  }

  // ------------------------------------------------------------------ discoveries
  function beginDiscovery(s) {
    discovering = { site: s, t: 0 };
    state.found.push(s.id);
    Sound.discover();
    for (let i = 0; i < 60; i++) {
      const a = R(0, TAU);
      const sp = R(40, 220);
      sparkles.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: R(2, 5), life: R(0.7, 1.2), hue: R(0, 1) });
    }
    saveProgress();
    updateHud(true);
  }

  function nearestUnfound(fromX, fromY) {
    let best = null;
    let bd = 1e9;
    for (const s of SITES) {
      if (state.found.includes(s.id)) continue;
      const d = Math.hypot(s.x - fromX, s.y - fromY);
      if (d < bd) { bd = d; best = s; }
    }
    return best ? { site: best, d: bd } : null;
  }

  const artCache = {};
  function renderSiteArt(id, cv) {
    const f = FOCUS[id]();
    const w = cv.width;
    const h = cv.height;
    const c = cv.getContext('2d');
    const lcv = document.createElement('canvas');
    lcv.width = Math.round(w / 2);
    lcv.height = Math.round(h / 2);
    const v = { ctx: c, cx: f.x, cy: f.y, s: f.s * (w / 640), w, h, dpr: 1, photo: true, lightCtx: lcv.getContext('2d') };
    render(v, state.time);
    screenTransform(c, v);
    const vg = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,10,15,0.5)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
    try {
      artCache[id] = cv.toDataURL('image/jpeg', 0.82);
    } catch (e) {
      artCache[id] = null;
    }
  }

  let cardFromPlay = false;
  let cardSpeech = '';
  function openCard(s, fresh) {
    cardFromPlay = fresh;
    cardSpeech = `${s.title}. ${s.facts.join(' ')}`;
    const n = state.found.indexOf(s.id) + 1;
    $('cardEyebrow').textContent = `Logbuch-Seite ${n} von ${SITES.length} · ${s.depthLabel}`;
    $('cardTitle').textContent = s.title;
    const ul = $('cardFacts');
    ul.textContent = '';
    for (const fact of s.facts) {
      const li = document.createElement('li');
      li.textContent = fact;
      ul.appendChild(li);
    }
    renderSiteArt(s.id, $('cardArt'));
    setMode('card');
    $('btnCardClose').textContent = fresh ? 'Weiter forschen' : 'Zurück zum Logbuch';
    setTimeout(() => $('btnCardClose').focus({ preventScroll: true }), 50);
  }

  function closeCard() {
    if (!cardFromPlay) {
      setMode('logbook');
      return;
    }
    const last = state.found[state.found.length - 1];
    const s = SITE_BY_ID[last];
    if (state.found.length >= SITES.length && !state.finished) {
      state.finished = true;
      saveProgress();
      runDialog(FINALE, showEnding);
      return;
    }
    setMode('play');
    const nx = nearestUnfound(sub.x, sub.y);
    if (nx) say(`${s.praise} ${nx.site.hint}`.trim());
  }

  function markSeen(key) {
    state.seen.add(key);
    Sound.bloop();
    const sp = SPECIES[key];
    if (!state.flags.fishFirst) {
      state.flags.fishFirst = true;
      say(`Schau mal, ein ${sp.name}! Ich trage jeden neuen Fisch in dein Fischbuch ein. Es steckt im Logbuch.`);
    } else {
      say(`Neu im Fischbuch: ${sp.name}! ${sp.fact}`);
    }
    saveProgress();
    updateHud(true);
  }

  // ------------------------------------------------------------------ radio + dialogs
  const radio = { queue: [], cur: null, shown: 0, hold: 0 };
  function say(text) {
    if (radio.queue.some((q) => q === text) || (radio.cur && radio.cur.text === text)) return;
    radio.queue.push(text);
  }
  function updateRadio(dt) {
    const el = $('radio');
    if (state.mode !== 'play') {
      return;
    }
    if (!radio.cur && radio.queue.length) {
      radio.cur = { text: radio.queue.shift() };
      radio.shown = 0;
      radio.hold = Math.max(4.5, radio.cur.text.length * 0.07);
      el.hidden = false;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
      Sound.radio();
    }
    if (radio.cur) {
      const before = Math.floor(radio.shown);
      radio.shown = Math.min(radio.cur.text.length, radio.shown + dt * 48);
      if (Math.floor(radio.shown) !== before) $('radioText').textContent = radio.cur.text.slice(0, Math.floor(radio.shown));
      if (radio.shown >= radio.cur.text.length) {
        const reading = Reader.isActive($('btnRadioSpeak'));
        if (!reading) radio.hold -= dt;
        if (radio.hold <= 0) {
          if (reading) Reader.stop();
          radio.cur = null;
          el.hidden = true;
        }
      }
    }
  }
  function skipRadio() {
    if (!radio.cur) return;
    if (radio.shown < radio.cur.text.length) {
      radio.shown = radio.cur.text.length;
      $('radioText').textContent = radio.cur.text;
    } else {
      radio.hold = 0;
    }
  }
  function clearRadio() {
    if (Reader.isActive($('btnRadioSpeak'))) Reader.stop();
    radio.queue.length = 0;
    radio.cur = null;
    $('radio').hidden = true;
  }

  const INTRO = [
    'Funkspruch an das gelbe U-Boot LEO 1! Hallo Kapitän Leopold, hier spricht Professorin Ida Wellenstein von der Seeforschungsstation.',
    'Heute Nacht hat ein Sturm mein Forscher-Logbuch über Bord geweht. Fünf Seiten sind auf den Grund des Bodensees gesunken!',
    'Jede Seite liegt an einem besonderen Ort: bei uralten Pfählen, in einem Fischschwarm, an einem Anker, beim größten Fisch des Sees und bei einem versunkenen Dampfschiff.',
    'Die Seiten leuchten golden. Fahr ganz nah heran, dann scannt dein U-Boot die Seite automatisch und du erfährst ihr Geheimnis.',
    'Keine Eile, Kapitän – hier unten gibt es keine Gefahren, nur viel zu entdecken. Leinen los!',
  ];
  const FINALE = [
    'Kapitän Leopold, du hast es geschafft! Alle fünf Seiten sind wieder da. Mein Logbuch ist vollständig!',
    'Pfahlbauten, Felchen, Anker, Wels und die Jura: Du kennst jetzt die Geheimnisse des Bodensees besser als viele Erwachsene.',
    'Dafür bekommst du von der Seeforschungsstation eine echte Urkunde. Herzlichen Glückwunsch!',
  ];
  const dialog = { lines: [], i: 0, shown: 0, done: null, read: false };
  function readDialog() {
    Reader.speak(dialog.lines[dialog.i], $('btnDialogSpeak'));
  }
  function runDialog(lines, done) {
    dialog.read = false;
    dialog.lines = lines;
    dialog.i = 0;
    dialog.shown = 0;
    dialog.done = done;
    $('dialogText').textContent = '';
    setMode('dialog');
    Sound.radio();
    updateDialogStep();
  }
  function updateDialogStep() {
    $('dialogStep').textContent = `${dialog.i + 1} / ${dialog.lines.length}`;
    $('btnDialogNext').textContent = dialog.i === dialog.lines.length - 1 ? (dialog.lines === INTRO ? 'Los geht’s!' : 'Weiter') : 'Weiter';
  }
  function updateDialog(dt) {
    if (state.mode !== 'dialog') return;
    const line = dialog.lines[dialog.i];
    if (dialog.shown < line.length) {
      const before = Math.floor(dialog.shown);
      dialog.shown = Math.min(line.length, dialog.shown + dt * 52);
      if (Math.floor(dialog.shown) !== before) $('dialogText').textContent = line.slice(0, Math.floor(dialog.shown));
    }
  }
  function dialogNext() {
    Sound.click();
    const line = dialog.lines[dialog.i];
    if (dialog.shown < line.length) {
      dialog.shown = line.length;
      $('dialogText').textContent = line;
      return;
    }
    if (dialog.i < dialog.lines.length - 1) {
      dialog.i++;
      dialog.shown = 0;
      $('dialogText').textContent = '';
      Sound.radio();
      updateDialogStep();
      if (dialog.read) readDialog();
      return;
    }
    const done = dialog.done;
    dialog.done = null;
    if (done) done();
  }

  // ------------------------------------------------------------------ HUD
  const depthGauge = $('depthGauge');
  const dg = depthGauge.getContext('2d');
  let lastGaugeDepth = -1;
  function drawGauge(m) {
    if (Math.abs(m - lastGaugeDepth) < 0.05) return;
    lastGaugeDepth = m;
    const c = dg;
    const S = depthGauge.width;
    const cx = S / 2;
    c.clearRect(0, 0, S, S);
    const rim = c.createLinearGradient(0, 0, S, S);
    rim.addColorStop(0, '#f3d58f');
    rim.addColorStop(0.5, '#a67c34');
    rim.addColorStop(1, '#5e4214');
    c.fillStyle = rim;
    c.beginPath();
    c.arc(cx, cx, S * 0.48, 0, TAU);
    c.fill();
    const face = c.createRadialGradient(cx - 10, cx - 12, 4, cx, cx, S * 0.42);
    face.addColorStop(0, '#163f47');
    face.addColorStop(1, '#03161b');
    c.fillStyle = face;
    c.beginPath();
    c.arc(cx, cx, S * 0.41, 0, TAU);
    c.fill();
    const a0 = Math.PI * 0.75;
    const span = Math.PI * 1.5;
    c.strokeStyle = '#e9e1c8';
    c.fillStyle = '#e9e1c8';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${Math.round(S * 0.1)}px "Avenir Next", system-ui, sans-serif`;
    for (let d = 0; d <= 45; d += 5) {
      const a = a0 + (d / 45) * span;
      const r1 = S * 0.39;
      const r2 = d % 10 === 0 ? S * 0.31 : S * 0.35;
      c.lineWidth = d % 10 === 0 ? 2.5 : 1.4;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1);
      c.lineTo(cx + Math.cos(a) * r2, cx + Math.sin(a) * r2);
      c.stroke();
      if (d % 10 === 0) c.fillText(String(d), cx + Math.cos(a) * S * 0.23, cx + Math.sin(a) * S * 0.23);
    }
    // the Jura's depth marked on the dial
    const aj = a0 + (38 / 45) * span;
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.arc(cx + Math.cos(aj) * S * 0.4, cx + Math.sin(aj) * S * 0.4, S * 0.025, 0, TAU);
    c.fill();
    const a = a0 + (clamp(m, 0, 45) / 45) * span;
    c.strokeStyle = '#e8463a';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx - Math.cos(a) * S * 0.08, cx - Math.sin(a) * S * 0.08);
    c.lineTo(cx + Math.cos(a) * S * 0.36, cx + Math.sin(a) * S * 0.36);
    c.stroke();
    c.fillStyle = '#c9a35a';
    c.beginPath();
    c.arc(cx, cx, S * 0.06, 0, TAU);
    c.fill();
  }

  const sonarCv = $('sonarScope');
  const sc = sonarCv.getContext('2d');
  function drawSonar(t) {
    const S = sonarCv.width;
    const cx = S / 2;
    const R0 = S * 0.46;
    sc.clearRect(0, 0, S, S);
    sc.fillStyle = '#c9a35a';
    sc.beginPath();
    sc.arc(cx, cx, S * 0.5, 0, TAU);
    sc.fill();
    const g = sc.createRadialGradient(cx, cx, 4, cx, cx, R0);
    g.addColorStop(0, '#0b3d2c');
    g.addColorStop(1, '#021710');
    sc.fillStyle = g;
    sc.beginPath();
    sc.arc(cx, cx, R0, 0, TAU);
    sc.fill();
    sc.strokeStyle = 'rgba(125,255,176,0.25)';
    sc.lineWidth = 1;
    for (const k of [0.33, 0.66]) {
      sc.beginPath();
      sc.arc(cx, cx, R0 * k, 0, TAU);
      sc.stroke();
    }
    sc.beginPath();
    sc.moveTo(cx - R0, cx);
    sc.lineTo(cx + R0, cx);
    sc.moveTo(cx, cx - R0);
    sc.lineTo(cx, cx + R0);
    sc.stroke();
    const sweep = (t * 1.5) % TAU;
    sc.save();
    sc.beginPath();
    sc.arc(cx, cx, R0, 0, TAU);
    sc.clip();
    for (let k = 0; k < 14; k++) {
      sc.fillStyle = `rgba(125,255,176,${0.16 * (1 - k / 14)})`;
      sc.beginPath();
      sc.moveTo(cx, cx);
      sc.arc(cx, cx, R0, sweep - (k + 1) * 0.07, sweep - k * 0.07);
      sc.closePath();
      sc.fill();
    }
    const range = 3200;
    const next = nearestUnfound(sub.x, sub.y);
    for (const s of SITES) {
      const found = state.found.includes(s.id);
      let dx = (s.x - sub.x) / range;
      let dy = (s.y - sub.y) / range;
      const d = Math.hypot(dx, dy);
      let edge = false;
      if (d > 0.92) {
        dx = (dx / d) * 0.92;
        dy = (dy / d) * 0.92;
        edge = true;
      }
      const bx = cx + dx * R0;
      const by = cx + dy * R0;
      if (found) {
        sc.strokeStyle = 'rgba(255,214,120,0.6)';
        sc.lineWidth = 1.5;
        sc.beginPath();
        sc.arc(bx, by, 3.5, 0, TAU);
        sc.stroke();
        continue;
      }
      const ang = Math.atan2(dy, dx);
      let since = sweep - ang;
      since = ((since % TAU) + TAU) % TAU;
      const glow = 1 - since / TAU;
      const isNext = next && next.site === s;
      sc.fillStyle = `rgba(125,255,176,${0.35 + 0.65 * glow})`;
      sc.beginPath();
      sc.arc(bx, by, (isNext ? 5 : 3.5) + glow * 2, 0, TAU);
      sc.fill();
      if (edge) {
        sc.strokeStyle = 'rgba(125,255,176,0.5)';
        sc.beginPath();
        sc.arc(bx, by, 8, 0, TAU);
        sc.stroke();
      }
    }
    sc.restore();
    sc.fillStyle = '#ffd23f';
    sc.beginPath();
    sc.moveTo(cx + 6 * Math.sign(sub.faceT || 1), cx);
    sc.lineTo(cx - 4 * Math.sign(sub.faceT || 1), cx - 4);
    sc.lineTo(cx - 4 * Math.sign(sub.faceT || 1), cx + 4);
    sc.closePath();
    sc.fill();
  }

  let lastDepthText = '';
  function updateHud(force) {
    const m = toMeters(sub.y);
    const txt = `${Math.round(m)} m`;
    if (txt !== lastDepthText || force) {
      lastDepthText = txt;
      $('depthVal').textContent = txt;
    }
    drawGauge(m);
    if (force) {
      const pgs = $('pageRow').children;
      const next = nearestUnfound(sub.x, sub.y);
      SITES.forEach((s, i) => {
        pgs[i].classList.toggle('found', state.found.includes(s.id));
        pgs[i].classList.toggle('next', !!next && next.site === s);
      });
      $('logCount').textContent = `${state.found.length}/${SITES.length}`;
    }
  }

  function updatePingHint() {
    if (!pingInfo) return;
    const s = pingInfo.site;
    const sx = sxOf(mainView(), s.x);
    const sy = syOf(mainView(), s.y);
    const ux = sxOf(mainView(), sub.x);
    const uy = syOf(mainView(), sub.y);
    const el = $('pingHint');
    const arrow = $('pingArrow');
    const margin = 70;
    let px;
    let py;
    let ang;
    if (sx > margin && sx < W - margin && sy > margin + 40 && sy < H - margin - 60) {
      px = sx;
      py = sy - 54;
      ang = Math.PI / 2;
    } else {
      ang = Math.atan2(sy - uy, sx - ux);
      const r = Math.min(W, H) * 0.3;
      px = clamp(ux + Math.cos(ang) * r, margin, W - margin);
      py = clamp(uy + Math.sin(ang) * r, margin + 40, H - margin - 60);
    }
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    arrow.style.transform = `rotate(${ang}rad)`;
  }

  function doPing() {
    if (state.mode !== 'play' || pingCooldown > 0) return;
    pingCooldown = 2.2;
    $('btnPing').classList.remove('pulse');
    ping = { t: 0, x: sub.x, y: sub.y };
    const nx = nearestUnfound(sub.x, sub.y);
    Sound.ping(nx ? nx.d : 3000);
    if (!nx) {
      say('Alle Seiten sind gefunden! Das Sonar findet nur noch Fische – erkunde den See, so lange du magst.');
      return;
    }
    const dist = nx.d < 450 ? 'ganz nah' : nx.d < 1400 ? 'nah' : nx.d < 3000 ? 'mittel' : 'weit';
    pingInfo = { t: 5.5, site: nx.site };
    $('pingText').textContent = `Logbuch-Seite · ${dist}`;
    $('pingHint').hidden = false;
    updatePingHint();
  }

  function toggleLight() {
    sub.light = !sub.light;
    Sound.click();
    const b = $('btnLight');
    b.setAttribute('aria-pressed', String(sub.light));
    b.setAttribute('aria-label', sub.light ? 'Scheinwerfer ausschalten' : 'Scheinwerfer einschalten');
  }

  // ------------------------------------------------------------------ logbook UI
  function fishThumb(key) {
    if (artCache['fish-' + key]) return artCache['fish-' + key];
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 200;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, '#2c8c8c');
    g.addColorStop(1, '#0c4552');
    c.fillStyle = g;
    c.fillRect(0, 0, 320, 200);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 30; i++) c.fillRect((i * 97) % 320, (i * 53) % 200, 2, 2);
    const sp = SPECIES[key];
    const L = sp.len;
    const k = Math.min(240 / (L * 1.2), 3.2);
    c.save();
    c.translate(160 + L * k * 0.05, 104);
    c.scale(k, k);
    drawFish(c, { sp, key, x: 0, y: 0, face: 1, pitch: 0, tail: 0.6, size: 1 }, 0);
    c.restore();
    let url = null;
    try {
      url = cv.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      url = null;
    }
    artCache['fish-' + key] = url;
    return url;
  }

  function buildLogbook() {
    const sites = $('logSites');
    sites.textContent = '';
    for (const s of SITES) {
      const found = state.found.includes(s.id);
      const el = document.createElement(found ? 'button' : 'div');
      el.className = 'log-item' + (found ? ' found' : '');
      if (found) {
        el.type = 'button';
        if (!artCache[s.id]) renderSiteArt(s.id, Object.assign(document.createElement('canvas'), { width: 960, height: 540 }));
        const img = document.createElement('img');
        img.alt = '';
        if (artCache[s.id]) img.src = artCache[s.id];
        el.appendChild(img);
        el.addEventListener('click', () => {
          Sound.click();
          openCard(s, false);
        });
      } else {
        const u = document.createElement('span');
        u.className = 'unknown';
        u.textContent = '?';
        el.appendChild(u);
      }
      const b = document.createElement('b');
      b.textContent = found ? s.title : 'Noch nicht gefunden';
      const sm = document.createElement('small');
      sm.textContent = found ? s.depthLabel : 'Tipp: Benutze den Sonar-Ping.';
      el.append(b, sm);
      sites.appendChild(el);
    }
    const fish = $('logFish');
    fish.textContent = '';
    for (const key of FISH_ORDER) {
      const seen = state.seen.has(key);
      const el = document.createElement('div');
      el.className = 'log-item' + (seen ? ' found' : '');
      if (seen) {
        const img = document.createElement('img');
        img.alt = '';
        const u = fishThumb(key);
        if (u) img.src = u;
        el.appendChild(img);
      } else {
        const u = document.createElement('span');
        u.className = 'unknown';
        u.textContent = '?';
        el.appendChild(u);
      }
      const b = document.createElement('b');
      b.textContent = seen ? SPECIES[key].name : '???';
      const sm = document.createElement('small');
      sm.textContent = seen ? SPECIES[key].fact : 'Noch nicht entdeckt. Schwimm nah an Fische heran!';
      if (seen) {
        const speakBtn = $('btnCardSpeak').cloneNode(true);
        speakBtn.removeAttribute('id');
        speakBtn.classList.add('fish-speak');
        speakBtn.setAttribute('aria-label', `${SPECIES[key].name} vorlesen`);
        speakBtn.setAttribute('aria-pressed', 'false');
        speakBtn.addEventListener('click', () => Reader.toggle(`${SPECIES[key].name}. ${SPECIES[key].fact}`, speakBtn));
        el.appendChild(speakBtn);
      }
      el.append(b, sm);
      fish.appendChild(el);
    }
    $('tabSitesCount').textContent = `${state.found.length}/${SITES.length}`;
    $('tabFishCount').textContent = `${state.seen.size}/${FISH_ORDER.length}`;
  }
  function selectTab(which) {
    Reader.stop();
    const fish = which === 'fish';
    $('tabSites').setAttribute('aria-selected', String(!fish));
    $('tabFish').setAttribute('aria-selected', String(fish));
    $('logSites').hidden = fish;
    $('logFish').hidden = !fish;
  }

  // ------------------------------------------------------------------ modes
  const SCREENS = ['title', 'dialog', 'pause', 'card', 'logbook', 'ending', 'confirm'];
  function setMode(m) {
    Reader.stop();
    if (state.mode === 'play' && m !== 'play') releaseInput();
    state.mode = m;
    for (const id of SCREENS) $(id).hidden = id !== m;
    const showHud = m === 'play' || m === 'pause' || m === 'card' || m === 'logbook' || m === 'confirm';
    $('hud').hidden = !showHud;
    if (m !== 'play') {
      $('radio').hidden = true;
      $('touchHint').hidden = true;
    } else if (radio.cur) {
      $('radio').hidden = false;
    }
    if (m === 'logbook') buildLogbook();
    Sound.setPlaying(m !== 'pause' && m !== 'confirm');
  }

  function startExpedition(fromSave) {
    Sound.init();
    Sound.click();
    resetWorld(!fromSave);
    if (fromSave) {
      setMode('play');
      const left = SITES.length - state.found.length;
      if (left > 0) say(`Willkommen zurück, Kapitän Leopold! Noch ${left === 1 ? 'eine Seite fehlt' : left + ' Seiten fehlen'}. ${nearestUnfound(sub.x, sub.y).site.hint}`);
      else say('Willkommen zurück, Ehren-Seeforscher! Erkunde den See, so lange du magst.');
      updateHud(true);
    } else {
      runDialog(INTRO, () => {
        setMode('play');
        $('touchHint').hidden = false;
        state.flags.hintShown = true;
        say(nearestUnfound(sub.x, sub.y).site.hint);
      });
    }
  }

  function resetWorld(clear) {
    if (clear) {
      state.found = [];
      state.seen = new Set();
      state.elapsed = 0;
      state.maxDepth = 0;
      state.finished = false;
      for (const k in artCache) delete artCache[k];
      clearSave();
    }
    state.flags = {};
    state.idle = 0;
    for (const s of SITES) s.scan = 0;
    sub.x = START.x;
    sub.y = START.y;
    sub.vx = 0;
    sub.vy = 0;
    sub.face = 1;
    sub.faceT = 1;
    sub.tilt = 0;
    if (!sub.light) toggleLight();
    discovering = null;
    ping = null;
    pingInfo = null;
    $('pingHint').hidden = true;
    sparkles.length = 0;
    bubbles.length = 0;
    clearRadio();
    updateCamera(0, true);
    updateHud(true);
  }

  function restartExpedition() {
    Sound.click();
    resetWorld(true);
    setMode('play');
    say('Neue Expedition! Ich habe die fünf Logbuch-Seiten zum Üben wieder im See versteckt. Viel Spaß, Kapitän!');
    updateHud(true);
  }

  function showEnding() {
    $('statSites').textContent = `${state.found.length}/${SITES.length}`;
    $('statFish').textContent = `${state.seen.size}/${FISH_ORDER.length}`;
    $('statDepth').textContent = `${Math.round(state.maxDepth)} m`;
    const sec = Math.round(state.elapsed);
    $('statTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    try {
      $('certDate').textContent = new Date().toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      $('certDate').textContent = new Date().toDateString();
    }
    setMode('ending');
    Sound.fanfare();
  }

  // ------------------------------------------------------------------ persistence
  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, found: state.found, seen: [...state.seen], elapsed: Math.round(state.elapsed), maxDepth: state.maxDepth, finished: state.finished,
      }));
    } catch (e) { /* storage unavailable: progress lives for this visit only */ }
  }
  function loadProgress() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!d || d.v !== 1) return null;
      return d;
    } catch (e) {
      return null;
    }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: state.muted, control: state.control })); } catch (e) { /* ignore */ }
  }
  function loadSettings() {
    try {
      const d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (d) {
        state.muted = !!d.muted;
        if (d.control === 'stick' || d.control === 'hold') state.control = d.control;
      }
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------ sound (Web Audio, all synthesized)
  const Sound = (() => {
    let ac = null;
    let master = null;
    let music = null;
    let sfx = null;
    let reverb = null;
    let engineGain = null;
    let engineFilter = null;
    let ambGain = null;
    let scanOsc = null;
    let scanGain = null;
    let musicTimer = null;
    let nextChordT = 0;
    let chordI = 0;
    let noiseBuf = null;
    let playing = true;
    const CHORDS = [
      [50, 57, 62, 66, 69], // D maj9 colour
      [47, 54, 59, 62, 66], // B min
      [43, 50, 55, 59, 62], // G maj7
      [45, 52, 57, 61, 64], // A
      [50, 57, 62, 64, 69], // D add9
      [42, 49, 54, 57, 61], // F# min
      [43, 50, 55, 59, 64], // G maj7/9
      [45, 52, 57, 59, 64], // A sus
    ];
    const SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function makeImpulse(sec, decay) {
      const rate = ac.sampleRate;
      const len = Math.floor(rate * sec);
      const buf = ac.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    function init() {
      if (ac) {
        resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ac = new AC();
      } catch (e) {
        ac = null;
        return;
      }
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      comp.connect(ac.destination);
      master = ac.createGain();
      master.gain.value = state.muted ? 0 : 0.9;
      master.connect(comp);
      reverb = ac.createConvolver();
      reverb.buffer = makeImpulse(3.2, 2.6);
      const revGain = ac.createGain();
      revGain.gain.value = 0.55;
      reverb.connect(revGain);
      revGain.connect(master);
      music = ac.createGain();
      music.gain.value = 0.3;
      music.connect(master);
      music.connect(reverb);
      sfx = ac.createGain();
      sfx.gain.value = 0.75;
      sfx.connect(master);

      // noise source shared by ambience and engine
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < nd.length; i++) {
        last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
        nd[i] = last * 6;
      }
      const amb = ac.createBufferSource();
      amb.buffer = noiseBuf;
      amb.loop = true;
      const ambF = ac.createBiquadFilter();
      ambF.type = 'lowpass';
      ambF.frequency.value = 420;
      ambGain = ac.createGain();
      ambGain.gain.value = 0.22;
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoG = ac.createGain();
      lfoG.gain.value = 160;
      lfo.connect(lfoG);
      lfoG.connect(ambF.frequency);
      amb.connect(ambF);
      ambF.connect(ambGain);
      ambGain.connect(master);
      amb.start();
      lfo.start();

      const eng = ac.createBufferSource();
      eng.buffer = noiseBuf;
      eng.loop = true;
      engineFilter = ac.createBiquadFilter();
      engineFilter.type = 'bandpass';
      engineFilter.frequency.value = 120;
      engineFilter.Q.value = 1.4;
      engineGain = ac.createGain();
      engineGain.gain.value = 0;
      eng.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(sfx);
      const hum = ac.createOscillator();
      hum.type = 'triangle';
      hum.frequency.value = 46;
      const humG = ac.createGain();
      humG.gain.value = 0.25;
      hum.connect(humG);
      humG.connect(engineGain);
      eng.start();
      hum.start();

      scanOsc = ac.createOscillator();
      scanOsc.type = 'sine';
      scanGain = ac.createGain();
      scanGain.gain.value = 0;
      scanOsc.connect(scanGain);
      scanGain.connect(sfx);
      scanGain.connect(reverb);
      scanOsc.start();

      // unlock on iOS with a silent blip
      const b = ac.createBuffer(1, 1, 22050);
      const s = ac.createBufferSource();
      s.buffer = b;
      s.connect(ac.destination);
      s.start(0);
      resume();
      nextChordT = ac.currentTime + 0.3;
      musicTimer = setInterval(scheduleMusic, 250);
    }

    function resume() {
      if (ac && ac.state !== 'running' && playing) ac.resume().catch(() => {});
    }

    function voice(freq, t0, dur, type, gain, dest, attack, release, detune) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      if (detune) o.detune.value = detune;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + attack);
      g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(dest);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
      return o;
    }

    function scheduleMusic() {
      if (!ac || ac.state !== 'running') return;
      const now = ac.currentTime;
      const depth = clamp(toMeters(sub.y) / 40, 0, 1);
      if (nextChordT < now - 0.5) nextChordT = now + 0.1;
      while (nextChordT < now + 1.2) {
        const ch = CHORDS[chordI % CHORDS.length];
        chordI++;
        const dur = 9;
        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400 - depth * 800;
        lp.Q.value = 0.4;
        lp.connect(music);
        ch.forEach((m, i) => {
          if (i === 0) {
            voice(mtof(m - 12), nextChordT, dur, 'sine', 0.16, music, 2.5, 3.5);
          } else {
            voice(mtof(m), nextChordT + i * 0.12, dur, 'triangle', 0.045, lp, 2.8, 3.5, -6);
            voice(mtof(m), nextChordT + i * 0.12, dur, 'sine', 0.04, lp, 2.8, 3.5, 7);
          }
        });
        // a few glassy notes over each chord
        const notes = 2 + Math.floor(Math.random() * 3 * (1 - depth * 0.6));
        for (let k = 0; k < notes; k++) {
          const t0 = nextChordT + 1 + Math.random() * 7;
          const m = SCALE[Math.floor(Math.random() * SCALE.length)] - (depth > 0.6 ? 12 : 0);
          voice(mtof(m), t0, 2.6, 'sine', 0.05, music, 0.02, 2.4);
          voice(mtof(m) * 2, t0, 1.4, 'sine', 0.012, music, 0.02, 1.3);
        }
        nextChordT += dur - 1.2;
      }
    }

    function engine(speed) {
      if (!ac) return;
      const t = ac.currentTime;
      const k = clamp(speed / 190, 0, 1);
      engineGain.gain.setTargetAtTime(playing && state.mode === 'play' ? 0.05 + k * 0.32 : 0, t, 0.15);
      engineFilter.frequency.setTargetAtTime(90 + k * 160, t, 0.2);
      const depth = clamp(toMeters(sub.y) / 40, 0, 1);
      ambGain.gain.setTargetAtTime(0.18 + depth * 0.12, t, 0.5);
    }

    function ping(dist) {
      if (!ac) return;
      const t = ac.currentTime;
      voice(1180, t, 1.1, 'sine', 0.32, sfx, 0.005, 1.05);
      voice(2360, t, 0.5, 'sine', 0.06, sfx, 0.005, 0.45);
      const echo = ac.createBiquadFilter();
      echo.type = 'lowpass';
      echo.frequency.value = 1500;
      echo.connect(reverb);
      echo.connect(sfx);
      voice(1180, t + 0.28 + clamp(dist / 4000, 0, 1.2), 1.0, 'sine', 0.12, echo, 0.01, 0.95);
    }

    function bubble() {
      if (!ac || !playing) return;
      const t = ac.currentTime;
      const o = ac.createOscillator();
      o.type = 'sine';
      const f0 = 280 + Math.random() * 300;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 2.6, t + 0.07);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g);
      g.connect(sfx);
      o.start(t);
      o.stop(t + 0.12);
    }

    function bloop() {
      if (!ac) return;
      const t = ac.currentTime;
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(640, t);
      o.frequency.exponentialRampToValueAtTime(300, t + 0.18);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g);
      g.connect(sfx);
      g.connect(reverb);
      o.start(t);
      o.stop(t + 0.3);
      voice(mtof(81), t + 0.12, 0.6, 'sine', 0.05, sfx, 0.01, 0.55);
    }

    function radio() {
      if (!ac) return;
      const t = ac.currentTime;
      const n = ac.createBufferSource();
      n.buffer = noiseBuf;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 0.8;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      n.connect(bp);
      bp.connect(g);
      g.connect(sfx);
      n.start(t, Math.random());
      n.stop(t + 0.25);
      voice(880, t + 0.2, 0.08, 'square', 0.025, sfx, 0.005, 0.05);
      voice(1320, t + 0.3, 0.1, 'square', 0.025, sfx, 0.005, 0.07);
    }

    function discover() {
      if (!ac) return;
      const t = ac.currentTime;
      [62, 66, 69, 74, 78].forEach((m, i) => {
        voice(mtof(m), t + i * 0.11, 1.6, 'triangle', 0.13, sfx, 0.01, 1.5);
        voice(mtof(m + 12), t + i * 0.11, 1.0, 'sine', 0.04, reverb, 0.01, 0.95);
      });
      const n = ac.createBufferSource();
      n.buffer = noiseBuf;
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 2;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(3000, t + 0.8);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      n.connect(f);
      f.connect(g);
      g.connect(reverb);
      n.start(t);
      n.stop(t + 1);
    }

    function fanfare() {
      if (!ac) return;
      const t = ac.currentTime;
      const seq = [[62, 0], [66, 0.18], [69, 0.36], [74, 0.6], [69, 0.9], [74, 1.08], [78, 1.3]];
      for (const [m, dt] of seq) {
        voice(mtof(m), t + dt, 0.9, 'triangle', 0.14, sfx, 0.01, 0.8);
        voice(mtof(m - 12), t + dt, 0.9, 'sine', 0.08, sfx, 0.01, 0.8);
      }
      for (const m of [50, 57, 62, 66]) voice(mtof(m), t + 1.3, 3.2, 'sine', 0.07, music, 0.3, 2.8);
    }

    function click() {
      if (!ac) return;
      voice(1500, ac.currentTime, 0.04, 'sine', 0.06, sfx, 0.002, 0.035);
    }

    function scan(p) {
      if (!ac) return;
      const t = ac.currentTime;
      scanGain.gain.setTargetAtTime(p > 0 && state.mode === 'play' ? 0.05 : 0, t, 0.08);
      scanOsc.frequency.setTargetAtTime(330 + p * 520, t, 0.05);
    }

    let ducked = false;
    function setMuted(m) {
      if (!ac) return;
      master.gain.setTargetAtTime(m ? 0 : ducked ? 0.25 : 0.9, ac.currentTime, 0.05);
    }
    function duck(on) {
      ducked = on;
      setMuted(state.muted);
    }

    function setPlaying(p) {
      playing = p;
      if (!ac) return;
      if (!p) {
        engineGain.gain.setTargetAtTime(0, ac.currentTime, 0.05);
        scanGain.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      }
    }

    function suspend() {
      if (ac && ac.state === 'running') ac.suspend().catch(() => {});
    }

    return { init, resume, engine, ping, bubble, bloop, radio, discover, fanfare, click, scan, setMuted, duck, setPlaying, suspend, get ready() { return !!ac; } };
  })();

  // ------------------------------------------------------------------ read aloud
  // Web Speech API with on-device voices only: no audio files, and no game text leaves the device.
  const Reader = (() => {
    const synth = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    const FATAL = ['synthesis-unavailable', 'language-unavailable', 'voice-unavailable'];
    const SPOKEN = [
      [/\bLEO 1\b/g, 'Leo Eins'],
      [/\bca\.\s*/g, 'circa '],
      [/(\d)\s?m\b/g, '$1 Meter'],
      [/\s[–—]\s/g, ', '],
    ];
    let voice = null;
    let activeBtn = null;
    let run = 0;
    let watchdog = 0;
    let keep = null; // Safari loses utterances without a reference and then never fires onend

    function disable() {
      document.documentElement.classList.add('no-speech');
    }
    const langOf = (v) => v.lang.replace('_', '-');
    function pickVoice() {
      const all = synth.getVoices();
      if (!all.length) return; // the list often arrives later, see voiceschanged
      const de = all.filter((v) => /^de(-|$)/i.test(langOf(v)) && v.localService !== false);
      voice = de.find((v) => /^de-AT/i.test(langOf(v))) || de.find((v) => /^de-DE/i.test(langOf(v))) || de[0] || null;
      document.documentElement.classList.toggle('no-speech', !voice);
    }
    function init() {
      if (!synth || !Utterance) {
        disable();
        return;
      }
      pickVoice();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
    }
    function chunks(text) {
      const spoken = SPOKEN.reduce((t, [from, to]) => t.replace(from, to), text);
      const out = [];
      for (const sentence of spoken.match(/[^.!?]+[.!?]*\s*/g) || [spoken]) {
        if (out.length && out[out.length - 1].length + sentence.length < 160) out[out.length - 1] += sentence;
        else out.push(sentence);
      }
      return out.map((s) => s.trim()).filter(Boolean);
    }
    function release() {
      clearTimeout(watchdog);
      if (activeBtn) activeBtn.setAttribute('aria-pressed', 'false');
      activeBtn = null;
      Sound.duck(false);
    }
    function stop() {
      run++;
      if (!activeBtn) return;
      synth.cancel();
      release();
    }
    function speak(text, btn) {
      if (!synth || !Utterance) return;
      stop();
      const id = run;
      const parts = chunks(text);
      activeBtn = btn;
      btn.setAttribute('aria-pressed', 'true');
      Sound.duck(true);
      if (synth.paused) synth.resume();
      const speakPart = (i) => {
        if (id !== run) return;
        if (i >= parts.length) {
          release();
          return;
        }
        const u = new Utterance(parts[i]);
        u.lang = voice ? voice.lang : 'de-DE';
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.onend = () => speakPart(i + 1);
        u.onerror = (e) => {
          if (id !== run) return;
          if (FATAL.includes(e.error)) disable();
          release();
        };
        keep = u;
        clearTimeout(watchdog);
        // Some browsers drop onend, for example after the page was in the background.
        watchdog = setTimeout(() => {
          if (id === run) stop();
        }, 5000 + parts[i].length * 150);
        synth.speak(u);
      };
      speakPart(0);
    }
    function toggle(text, btn) {
      if (activeBtn === btn) {
        stop();
        return false;
      }
      speak(text, btn);
      return true;
    }
    return { init, speak, toggle, stop, isActive: (btn) => activeBtn === btn };
  })();
  Reader.init();

  // ------------------------------------------------------------------ avatar
  function drawAvatar(cv) {
    const c = cv.getContext('2d');
    const S = cv.width;
    c.clearRect(0, 0, S, S);
    const g = c.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#2b7f86');
    g.addColorStop(1, '#0b3a44');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    const k = S / 96;
    c.save();
    c.scale(k, k);
    // coat
    c.fillStyle = '#f1f4f2';
    c.beginPath();
    c.moveTo(14, 96);
    c.quadraticCurveTo(20, 66, 48, 64);
    c.quadraticCurveTo(76, 66, 82, 96);
    c.closePath();
    c.fill();
    c.fillStyle = '#2c6e7a';
    c.beginPath();
    c.moveTo(40, 66);
    c.lineTo(48, 80);
    c.lineTo(56, 66);
    c.closePath();
    c.fill();
    // neck and face
    c.fillStyle = '#e8b994';
    c.fillRect(42, 54, 12, 12);
    c.beginPath();
    c.ellipse(48, 42, 17, 20, 0, 0, TAU);
    c.fill();
    // hair with bun
    c.fillStyle = '#b9bcc2';
    c.beginPath();
    c.arc(48, 18, 9, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(30, 44);
    c.quadraticCurveTo(28, 20, 48, 22);
    c.quadraticCurveTo(68, 20, 66, 44);
    c.quadraticCurveTo(62, 30, 48, 30);
    c.quadraticCurveTo(36, 30, 30, 44);
    c.fill();
    // glasses
    c.strokeStyle = '#3a2a1a';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(41, 42, 5.5, 0, TAU);
    c.arc(55, 42, 5.5, 0, TAU);
    c.moveTo(46.5, 42);
    c.lineTo(49.5, 42);
    c.stroke();
    c.fillStyle = '#2b2018';
    c.beginPath();
    c.arc(41, 42, 1.6, 0, TAU);
    c.arc(55, 42, 1.6, 0, TAU);
    c.fill();
    // smile
    c.strokeStyle = '#9b4a3a';
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(48, 50, 6, 0.25, Math.PI - 0.25);
    c.stroke();
    // headset
    c.strokeStyle = '#222';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(48, 40, 21, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
    c.fillStyle = '#222';
    c.fillRect(25, 38, 6, 12);
    c.fillRect(65, 38, 6, 12);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(28, 50);
    c.quadraticCurveTo(30, 60, 40, 58);
    c.stroke();
    c.fillStyle = '#e04b3a';
    c.beginPath();
    c.arc(41, 58, 2.4, 0, TAU);
    c.fill();
    c.restore();
  }

  // ------------------------------------------------------------------ input
  const input = { active: false, id: null, sx: 0, sy: 0, ox: 0, oy: 0, downT: 0, downX: 0, downY: 0, moved: false, keys: {} };

  function pointerDown(id, x, y) {
    if (state.mode !== 'play') return false;
    if (input.active && id !== input.id) return false;
    input.active = true;
    input.id = id;
    input.sx = input.ox = input.downX = x;
    input.sy = input.oy = input.downY = y;
    input.downT = performance.now();
    input.moved = false;
    Sound.resume();
    if (!$('touchHint').hidden) $('touchHint').hidden = true;
    return true;
  }
  function pointerMove(id, x, y) {
    if (!input.active || id !== input.id) return;
    input.sx = x;
    input.sy = y;
    if (Math.hypot(x - input.downX, y - input.downY) > 12) input.moved = true;
  }
  function pointerUp(id) {
    if (!input.active || id !== input.id) return;
    const quick = performance.now() - input.downT < 260 && !input.moved;
    const tx = input.sx;
    const ty = input.sy;
    releaseInput();
    if (quick) handleTap(tx, ty);
  }
  function releaseInput() {
    input.active = false;
    input.id = null;
  }
  function handleTap(sx, sy) {
    const wx = cam.x + (sx - W / 2) / SCALE;
    const wy = cam.y + (sy - H / 2) / SCALE;
    let best = null;
    let bd = 60;
    for (const f of fishes) {
      const d = Math.hypot(f.x - wx, f.y - wy) - f.sp.len * f.size * 0.3;
      if (d < bd) { bd = d; best = f; }
    }
    if (best) {
      fishTag = { f: best, t: 2.6 };
      const el = $('fishTag');
      el.textContent = best.sp.name;
      el.hidden = false;
      if (!state.seen.has(best.key)) markSeen(best.key);
    }
  }

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', (e) => {
      if (!pointerDown(e.pointerId, e.clientX, e.clientY)) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is best effort */ }
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => {
      if (input.active && e.pointerId === input.id) {
        e.preventDefault();
        pointerMove(e.pointerId, e.clientX, e.clientY);
      }
    }, { passive: false });
    const up = (e) => pointerUp(e.pointerId);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === input.id) releaseInput(); });
    canvas.addEventListener('lostpointercapture', (e) => { if (e.pointerId === input.id) releaseInput(); });
  } else {
    // very old iOS: plain touch events
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      if (pointerDown(t.identifier, t.clientX, t.clientY)) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) pointerMove(t.identifier, t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => { for (const t of e.changedTouches) pointerUp(t.identifier); });
    canvas.addEventListener('touchcancel', () => releaseInput());
    canvas.addEventListener('mousedown', (e) => pointerDown('m', e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => pointerMove('m', e.clientX, e.clientY));
    window.addEventListener('mouseup', () => pointerUp('m'));
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.key]) {
      input.keys[KEYMAP[e.key]] = true;
      if (state.mode === 'play') {
        e.preventDefault();
        $('touchHint').hidden = true;
      }
    } else if (e.key === ' ' && state.mode === 'play') {
      e.preventDefault();
      doPing();
    } else if ((e.key === 'l' || e.key === 'L') && state.mode === 'play') {
      toggleLight();
    } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (state.mode === 'play') pauseGame(false);
      else if (state.mode === 'pause') resumeGame();
      else if (state.mode === 'logbook') closeLogbook();
      else if (state.mode === 'card') { Sound.click(); closeCard(); }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.key]) input.keys[KEYMAP[e.key]] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = {};
    releaseInput();
  });

  function pauseGame(silent) {
    if (state.mode !== 'play') return;
    if (!silent) Sound.click();
    saveProgress();
    setMode('pause');
    if (!silent) setTimeout(() => $('btnResume').focus({ preventScroll: true }), 30);
  }
  function resumeGame() {
    Sound.resume();
    Sound.click();
    setMode('play');
  }
  function openLogbook(from) {
    state.logReturn = from;
    Sound.click();
    selectTab('sites');
    setMode('logbook');
  }
  function closeLogbook() {
    Sound.click();
    setMode(state.logReturn === 'pause' ? 'pause' : 'play');
  }
  function openConfirm(from) {
    state.confirmReturn = from;
    Sound.click();
    setMode('confirm');
  }

  function bind(id, fn) {
    $(id).addEventListener('click', (e) => {
      e.preventDefault();
      fn(e);
    });
  }
  bind('btnStart', () => startExpedition(false));
  bind('btnContinue', () => {
    const d = loadProgress();
    if (d) {
      state.found = (d.found || []).filter((id) => SITE_BY_ID[id]);
      state.seen = new Set((d.seen || []).filter((k) => SPECIES[k]));
      state.elapsed = d.elapsed || 0;
      state.maxDepth = d.maxDepth || 0;
      state.finished = !!d.finished;
    }
    startExpedition(true);
  });
  bind('btnDialogNext', dialogNext);
  bind('btnDialogSpeak', () => {
    dialog.read = Reader.toggle(dialog.lines[dialog.i], $('btnDialogSpeak'));
  });
  bind('btnCardSpeak', () => Reader.toggle(cardSpeech, $('btnCardSpeak')));
  bind('btnEndSpeak', () => {
    const text = `${document.querySelector('.cert-text').textContent} ${document.querySelector('.cert-title').textContent}.`;
    Reader.toggle(text, $('btnEndSpeak'));
  });
  $('btnRadioSpeak').addEventListener('click', (e) => {
    e.stopPropagation(); // a tap on the bubble itself skips the message
    if (radio.cur) Reader.toggle(radio.cur.text, $('btnRadioSpeak'));
  });
  bind('btnPause', () => pauseGame(false));
  bind('btnResume', resumeGame);
  bind('btnRestart', () => openConfirm('pause'));
  bind('btnConfirmYes', restartExpedition);
  bind('btnConfirmNo', () => {
    Sound.click();
    setMode(state.confirmReturn === 'ending' ? 'ending' : 'pause');
  });
  bind('btnLog', () => openLogbook('play'));
  bind('btnPauseLog', () => openLogbook('pause'));
  bind('btnLogClose', closeLogbook);
  bind('tabSites', () => { Sound.click(); selectTab('sites'); });
  bind('tabFish', () => { Sound.click(); selectTab('fish'); });
  bind('btnCardClose', () => {
    Sound.click();
    closeCard();
  });
  bind('btnLight', toggleLight);
  bind('btnPing', doPing);
  bind('btnSound', () => {
    state.muted = !state.muted;
    Sound.init();
    Sound.setMuted(state.muted);
    if (state.muted) Reader.stop();
    const b = $('btnSound');
    b.setAttribute('aria-pressed', String(!state.muted));
    b.setAttribute('aria-label', state.muted ? 'Ton einschalten' : 'Ton ausschalten');
    saveSettings();
  });
  bind('btnRoam', () => {
    Sound.click();
    setMode('play');
    const missing = FISH_ORDER.length - state.seen.size;
    say(missing > 0 ? `Dir fehlen noch ${missing} Fischarten im Fischbuch. Erkunde den See in Ruhe weiter!` : 'Du hast alle Fischarten entdeckt! Genieß die Aussicht, Kapitän.');
  });
  bind('btnNewGame', () => openConfirm('ending'));
  $('radio').addEventListener('click', skipRadio);
  document.querySelectorAll('.seg').forEach((b) => {
    b.addEventListener('click', () => {
      state.control = b.dataset.control;
      Sound.click();
      syncControlButtons();
      saveSettings();
    });
  });
  function syncControlButtons() {
    document.querySelectorAll('.seg').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.control === state.control)));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Reader.stop();
      if (state.mode === 'play') pauseGame(true);
      saveProgress();
      Sound.suspend();
    } else if (state.mode !== 'pause') {
      Sound.resume();
    }
  });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  // ------------------------------------------------------------------ main loop
  let lastT = performance.now();
  function frame(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    const live = state.mode === 'play' || state.mode === 'title' || state.mode === 'dialog' || state.mode === 'ending';
    if (live) {
      state.time += dt;
      updateFishes(dt, state.time);
      updatePlankton(dt, state.time);
      updateBubbles(dt);
      updateSub(dt);
      if (state.mode === 'play') updateGame(dt);
      updateCamera(dt, false);
      updateRadio(dt);
      updateDialog(dt);
    }
    if (live || needsStaticRender) {
      render(mainView(), state.time);
      needsStaticRender = false;
    }
    if (state.mode !== 'title') {
      updateHud(false);
      drawSonar(state.time);
      updatePingHint();
      if (fishTag) {
        const el = $('fishTag');
        el.style.left = `${sxOf(mainView(), fishTag.f.x)}px`;
        el.style.top = `${syOf(mainView(), fishTag.f.y)}px`;
      }
    }
    Sound.engine(state.mode === 'play' ? sub.speed : 0);
    // adaptive quality: lower the resolution if frames are slow
    quality.ema = lerp(quality.ema, (now - (frame.prev || now)) || 16, 0.05);
    frame.prev = now;
    if (quality.ema > 26 && live) {
      quality.slowT += dt;
      if (quality.slowT > 2.5 && (quality.maxDpr > 1 || quality.light > 0.34)) {
        quality.slowT = 0;
        if (quality.maxDpr > 1) quality.maxDpr = Math.max(1, quality.maxDpr - 0.5);
        else quality.light = 0.34;
        resize();
      }
    } else quality.slowT = 0;
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    loadSettings();
    syncControlButtons();
    const sb = $('btnSound');
    sb.setAttribute('aria-pressed', String(!state.muted));
    sb.setAttribute('aria-label', state.muted ? 'Ton einschalten' : 'Ton ausschalten');
    causticPattern = ctx.createPattern(causticCv, 'repeat');
    document.querySelectorAll('canvas.avatar').forEach(drawAvatar);
    resize();
    const save = loadProgress();
    if (save && (save.found || []).length + (save.seen || []).length > 0) {
      $('btnContinue').hidden = false;
      $('btnContinue').textContent = save.finished ? 'Weiter erkunden' : `Weiterspielen (${(save.found || []).length}/5 Seiten)`;
      $('btnStart').textContent = 'Neue Expedition';
      $('btnStart').classList.remove('btn-primary');
    }
    setMode('title');
    updateCamera(0, true);
    if (window.innerWidth < window.innerHeight && window.innerWidth < 600) {
      const n = $('rotateNote');
      n.hidden = false;
      setTimeout(() => { n.hidden = true; }, 5000);
    }
    requestAnimationFrame((t) => {
      lastT = t;
      requestAnimationFrame(frame);
    });
    if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window.self) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // Small read-only hook for automated smoke tests (no personal data involved).
  window.__bodensee = {
    version: VERSION,
    get mode() { return state.mode; },
    get found() { return state.found.slice(); },
    get seen() { return [...state.seen]; },
    get sub() { return { x: sub.x, y: sub.y, vx: sub.vx, vy: sub.vy, light: sub.light, depth: toMeters(sub.y) }; },
    get cam() { return { x: cam.x, y: cam.y, scale: SCALE }; },
    get sites() { return SITES.map((s) => ({ id: s.id, x: s.x, y: s.y, r: s.r })); },
    teleport(x, y) { sub.x = x; sub.y = y; sub.vx = 0; sub.vy = 0; updateCamera(0, true); },
    worldToScreen(x, y) { const v = mainView(); return { x: sxOf(v, x), y: syOf(v, y) }; },
    say,
    see(key) { state.seen.add(key || FISH_ORDER[0]); },
  };

  boot();
})();
