/* Alle Inhalte der Ausflüge. Zahlen und Aussagen stammen aus der geprüften Faktenliste (IGKB, LGRB, UNESCO, Museen, Kantone):
 * nur belegte Aussagen; wo Quellen abweichen, steht eine vorsichtige Formulierung. Quellen je Aussage: FAKTEN.md.
 */
(() => {
  'use strict';
  const { box, ell, line, poly, grad, flag, flagPlain, house, cardBack, reed, kid } = BE.art;

  // ------------------------------------------------------------------ small pictures that only appear here
  BE.miniDraw = {
    fundstein(c) {
      ell(c, 0, -22, 62, 26, '#b3a78b');
      ell(c, -14, -28, 26, 11, '#c5baa0');
      ell(c, 8, -24, 9, 7, '#f6f0dc');
      ell(c, 8, -24, 4, 3, '#d7ccae');
    },
    sturmlampe(c, t) {
      box(c, -5, -120, 10, 120, '#c8c4b6');
      box(c, -14, -136, 28, 18, '#6a6a60', 3);
      const on = Math.sin(t * 8) > 0;
      ell(c, 0, -128, 8, 8, on ? '#ff9a2e' : '#7a4a22');
      if (on) ell(c, 0, -128, 20, 20, 'rgba(255,160,50,0.3)');
    },
    beringung(c, t) {
      box(c, -60, -56, 70, 56, '#8a5e3a', 3);
      poly(c, [[-68, -56], [18, -56], [-25, -88]], '#6f4a2e');
      for (let i = 0; i < 5; i++) line(c, [[30 + i * 15, 0], [30 + i * 15, -72]], 'rgba(90,90,90,0.5)', 1.2);
      for (let i = 0; i < 5; i++) line(c, [[30, -i * 15], [90, -i * 15]], 'rgba(90,90,90,0.35)', 1);
      const y = -92 + Math.sin(t * 2) * 5;
      ell(c, 60, y, 7, 5, '#7c8f6a');
      ell(c, 66, y - 3, 3.5, 3.5, '#7c8f6a');
      line(c, [[54, y], [60, y - Math.abs(Math.sin(t * 9)) * 8], [66, y]], '#55674c', 1.6);
    },
    ried(c, t) {
      for (let i = 0; i < 9; i++) reed(c, -120 + i * 30, 0, 60 + (i % 3) * 16, t, i * 13);
      box(c, -24, -30, 48, 7, '#8a5e3a', 2);
      box(c, -22, -30, 5, 30, '#6f4a2e');
      box(c, 17, -30, 5, 30, '#6f4a2e');
    },
    foehn(c, t) {
      box(c, -3, -110, 6, 110, '#b9b5a6');
      const a = Math.sin(t * 2.5) * 0.15;
      c.save();
      c.translate(0, -106);
      c.rotate(a);
      for (let i = 0; i < 5; i++) poly(c, [[i * 16, -9 + i], [i * 16 + 16, -8 + i], [i * 16 + 16, 8 - i], [i * 16, 9 - i]], i % 2 ? '#fff' : '#e8664a');
      c.restore();
    },
    tiefenlot(c) {
      box(c, -40, -34, 80, 34, '#d9b873', 4);
      box(c, -32, -28, 64, 14, '#2f6f86', 2);
      line(c, [[0, -34], [0, -86]], '#7a5c3a', 3);
      ell(c, 0, -90, 8, 8, '#a33b2c');
    },
  };

  const scaleArt = (draw, zoom, sky, foot) => (c, w, h, t) => {
    cardBack(c, w, h, sky);
    const k = (w / 640) * zoom;
    c.save();
    c.fillStyle = grad(c, 0, h * (foot || 0.86), 0, h, ['#8fb45f', '#6f9d4f']);
    c.fillRect(0, h * (foot || 0.86), w, h);
    c.translate(w / 2, h * (foot || 0.86));
    c.scale(k, k);
    draw(c, t || 0);
    c.restore();
  };
  const lmArt = (id, zoom) => scaleArt((c, t) => {
    const fn = (BE.landmarks && BE.landmarks[id]) || (BE.miniDraw && BE.miniDraw[id]);
    if (fn) fn(c, t);
  }, zoom || 1);
  const critterArt = (id, zoom) => scaleArt((c, t) => {
    const fn = BE.critters && BE.critters[id];
    if (fn) fn(c, t);
  }, zoom || 3.2);
  const eraArt = (era, id) => (c, w, h, t) => {
    const art = BE.eraArt && BE.eraArt[era];
    if (!art) {
      cardBack(c, w, h);
      return;
    }
    art.back(c, w, h, t || 0);
    if (!id || !art.creatures[id]) return;
    const d = art.creatures[id];
    const k = Math.min((w * 0.62) / d.w, (h * 0.66) / d.h);
    c.save();
    c.translate(w / 2, Math.min(h * 0.88, h * 0.2 + d.h * k));
    c.scale(k, k);
    d.draw(c, t || 0, 1);
    c.restore();
  };
  function townArt(p) {
    return (c, w, h, t) => {
      cardBack(c, w, h);
      const k = w / 640;
      const foot = h * 0.86;
      c.fillStyle = grad(c, 0, foot, 0, h, ['#8fb45f', '#6f9d4f']);
      c.fillRect(0, foot, w, h);
      c.save();
      c.translate(w / 2, foot);
      c.scale(k, k);
      const style = p.land === 'at' ? 'holz' : p.land === 'ch' ? 'fresko' : 'fachwerk';
      house(c, -210, 0, 92, 84, style, p.lat * 100);
      house(c, -106, 0, 110, 118, 'plain', p.lon * 100);
      house(c, 16, 0, 84, 74, style, p.lat * 77);
      house(c, 110, 0, 100, 100, 'plain', p.lon * 55);
      flag(c, 240, 0, 130, p.land, t || 0);
      kid(c, -250, 12, 1, 1, 0);
      c.restore();
    };
  }

  // ------------------------------------------------------------------ Orte, in Ufer-Reihenfolge
  const LAND = { at: 'Österreich', de: 'Deutschland', ch: 'Schweiz' };
  BE.places = [
    { id: 'bregenz', name: 'Bregenz', land: 'at', region: 'Vorarlberg', lat: 47.505, lon: 9.749, big: 1, line: 'Hauptstadt von Vorarlberg, mit der Bühne mitten im See.', extra: 'Die Römer nannten den See nach dieser Stadt: lacus Brigantinus, den See von Bregenz.' },
    { id: 'lochau', name: 'Lochau', land: 'at', region: 'Vorarlberg', lat: 47.53, lon: 9.752, labelBelow: 0, line: 'Der Ort liegt zwischen See und Pfänder, kurz vor der deutschen Grenze. Sogar der Pfänder-Gipfel gehört dazu.', extra: 'Gleich dahinter, bei Hörbranz, bildet der kleine Fluss Leiblach die Grenze.' },
    { id: 'lindau', name: 'Lindau', land: 'de', region: 'Bayern', lat: 47.546, lon: 9.684, big: 1, line: 'Eine Altstadt auf einer Insel, die Hafeneinfahrt bewachen Löwe und Leuchtturm.', extra: 'Die Insel ist nur gut einen halben Quadratkilometer groß.' },
    { id: 'wasserburg', name: 'Wasserburg', land: 'de', region: 'Bayern', lat: 47.57, lon: 9.638, line: 'Kirche und Schloss stehen auf einer kleinen Halbinsel, fast rundum Wasser.' },
    { id: 'langenargen', name: 'Langenargen', land: 'de', region: 'Baden-Württemberg', lat: 47.598, lon: 9.539, line: 'Ein Schloss wie aus dem Orient, und hier sitzt das Institut, das den See erforscht.' },
    { id: 'friedrichshafen', name: 'Friedrichshafen', land: 'de', region: 'Baden-Württemberg', lat: 47.654, lon: 9.479, big: 1, labelBelow: 0, line: 'Hier begann 1900 die Geschichte der Zeppeline, heute erzählt ein Museum davon.' },
    { id: 'immenstaad', name: 'Immenstaad', land: 'de', region: 'Baden-Württemberg', lat: 47.667, lon: 9.367, line: 'Von hier segelt eine nachgebaute Lädine, sogar mit Piratenfahrten für Kinder.' },
    { id: 'hagnau', name: 'Hagnau', land: 'de', region: 'Baden-Württemberg', lat: 47.675, lon: 9.317, line: 'Von hier zogen die Menschen im Eiswinter über den See bis in die Schweiz.' },
    { id: 'meersburg', name: 'Meersburg', land: 'de', region: 'Baden-Württemberg', lat: 47.696, lon: 9.271, big: 1, line: 'Eine alte Burg thront über dem See, und eine berühmte Dichterin lebte darin.' },
    { id: 'unteruhldingen', name: 'Unteruhldingen', land: 'de', region: 'Baden-Württemberg', lat: 47.722, lon: 9.232, line: 'Hier stehen Pfahlbauhäuser im Wasser, und du kannst hineingehen.' },
    { id: 'ueberlingen', name: 'Überlingen', land: 'de', region: 'Baden-Württemberg', lat: 47.767, lon: 9.158, big: 1, line: 'Eine alte Stadt, die nur dem Kaiser unterstand. Am riesigen Münster bauten die Menschen über 200 Jahre lang.' },
    { id: 'sipplingen', name: 'Sipplingen', land: 'de', region: 'Baden-Württemberg', lat: 47.796, lon: 9.096, line: 'Hier beginnt die Reise des Trinkwassers für Millionen Menschen.' },
    { id: 'ludwigshafen', name: 'Ludwigshafen', land: 'de', region: 'Baden-Württemberg', lat: 47.818, lon: 9.057, line: 'Der Ort hieß früher Sernatingen und bekam 1826 den Namen eines Großherzogs.' },
    { id: 'bodman', name: 'Bodman', land: 'de', region: 'Baden-Württemberg', lat: 47.801, lon: 9.031, labelBelow: 1, line: 'Dieser kleine Ort hat dem ganzen Bodensee den Namen gegeben.', extra: 'Hier stand früher ein Hof, in dem der König auf Reisen wohnte.' },
    { id: 'konstanz', name: 'Konstanz', land: 'de', region: 'Baden-Württemberg', lat: 47.663, lon: 9.176, big: 1, labelBelow: 0, line: 'Hier traf sich Europa zum Konzil, und hier fließt der Rhein aus dem Obersee.' },
    { id: 'reichenau', name: 'Reichenau', land: 'de', region: 'Baden-Württemberg', lat: 47.693, lon: 9.063, labelBelow: 1, line: 'Die größte Insel im See, ihr Kloster ist rund 1300 Jahre alt.' },
    { id: 'allensbach', name: 'Allensbach', land: 'de', region: 'Baden-Württemberg', lat: 47.715, lon: 9.071, line: 'Im Wildpark leben über 300 heimische Tiere, es gibt eine Riesenrutsche und eine Parkeisenbahn.' },
    { id: 'radolfzell', name: 'Radolfzell', land: 'de', region: 'Baden-Württemberg', lat: 47.739, lon: 8.969, line: 'Auf der Halbinsel Mettnau fangen Forscher Zugvögel, beringen sie und lassen sie wieder fliegen.' },
    { id: 'oehningen', name: 'Öhningen', land: 'de', region: 'Baden-Württemberg', lat: 47.661, lon: 8.889, line: 'Hier fand man den Riesensalamander, den man früher für einen Menschen aus der großen Flut der Bibel hielt.' },
    { id: 'stein', name: 'Stein am Rhein', land: 'ch', region: 'Kanton Schaffhausen', lat: 47.659, lon: 8.859, labelBelow: 1, line: 'Hier verlässt der Rhein den See, und die Häuser sind bunt bemalt.' },
    { id: 'steckborn', name: 'Steckborn', land: 'ch', region: 'Kanton Thurgau', lat: 47.667, lon: 8.983, labelBelow: 1, line: 'Hier lag in einem Gartenstein ein rund 17 Millionen Jahre alter Zahn.' },
    { id: 'kreuzlingen', name: 'Kreuzlingen', land: 'ch', region: 'Kanton Thurgau', lat: 47.646, lon: 9.179, labelBelow: 1, line: 'Grenzstadt zu Konstanz, im Seemuseum erfährst du viel über das Wrack der Jura.' },
    { id: 'romanshorn', name: 'Romanshorn', land: 'ch', region: 'Kanton Thurgau', lat: 47.567, lon: 9.383, labelBelow: 1, line: 'Von hier fährt die Autofähre quer über den See nach Friedrichshafen.' },
    { id: 'arbon', name: 'Arbon', land: 'ch', region: 'Kanton Thurgau', lat: 47.517, lon: 9.433, labelBelow: 1, line: 'Hier stand die römische Festung Arbor Felix, Reste sind noch zu sehen.' },
    { id: 'rorschach', name: 'Rorschach', land: 'ch', region: 'Kanton St. Gallen', lat: 47.479, lon: 9.494, big: 1, labelBelow: 1, line: 'Das große Kornhaus am Hafen lagerte Getreide, das über den See kam.' },
    { id: 'rheineck', name: 'Rheineck', land: 'ch', region: 'Kanton St. Gallen', lat: 47.466, lon: 9.59, labelBelow: 1, line: 'Das Städtchen liegt nicht direkt am See, aber Schiffe fahren den Alten Rhein bis hierher.' },
    { id: 'fussach', name: 'Fußach', land: 'at', region: 'Vorarlberg', lat: 47.478, lon: 9.664, labelBelow: 1, line: 'Hier gruben Menschen dem Rhein 1900 einen neuen, geraden Weg in den See.' },
    { id: 'hard', name: 'Hard', land: 'at', region: 'Vorarlberg', lat: 47.489, lon: 9.692, line: 'Hier ist der alte Raddampfer Hohentwiel zu Hause.' },
  ];
  for (const p of BE.places) {
    BE.def({
      id: `ort-${p.id}`,
      cat: 'orte',
      title: p.name,
      eyebrow: [LAND[p.land], p.region],
      facts: [p.line, ...(p.extra ? [p.extra] : [])],
      art: townArt(p),
    });
  }

  // ------------------------------------------------------------------ Entdeckungen auf der Seekarte
  const map = (id, lon, lat, icon, cat, title, facts) => {
    BE.def({ id, cat, title, facts });
    return { id, lon, lat, icon };
  };
  BE.mapSpots = [
    map('m-drei-laender', 9.58, 47.548, '3', 'grenzen', 'Drei Länder, ein See', [
      'An den Bodensee grenzen drei Länder: Deutschland, Österreich und die Schweiz.',
      'Am Ufer liegen Baden-Württemberg und Bayern, Vorarlberg sowie die Kantone Thurgau, St. Gallen und ganz im Westen Schaffhausen.',
    ]),
    map('m-keine-grenze', 9.47, 47.578, '?', 'grenzen', 'Die Grenze, die es nicht gibt', [
      'Mitten im Obersee gibt es keine vereinbarte Grenze. Die drei Länder haben das nie festgelegt und kommen trotzdem gut miteinander aus.',
      'Österreich sagt: Der See gehört allen zusammen. Die Schweiz sagt: Teilen wir ihn in der Mitte. Deutschland lässt es offen.',
      'Nah am Ufer ist klar, wem das Wasser gehört. Draußen auf dem See nicht. Darum ist die Linie auf der Karte hier nur gestrichelt.',
    ]),
    map('m-untersee-grenze', 8.935, 47.672, '↔', 'grenzen', 'Die Grenze im Untersee', [
      'Im Untersee ist die Grenze zwischen Deutschland und der Schweiz festgelegt. Sie läuft genau durch die Mitte.',
    ]),
    map('m-liechtenstein', 9.5, 47.452, '!', 'grenzen', 'Liegt Liechtenstein am See?', [
      'Nein. Liechtenstein liegt nicht am See, sondern weiter südlich am Rhein.',
      'Aber sein Wasser fließt über den Rhein in den Bodensee.',
    ]),
    map('m-see-zahlen', 9.49, 47.602, 'i', 'erde', 'Der See in Zahlen', [
      'Der Bodensee ist 536 Quadratkilometer groß.',
      'Von Bregenz bis Bodman sind es 63 Kilometer. An der breitesten Stelle sind es 14 Kilometer von Ufer zu Ufer.',
      'Das Ufer ist 273 Kilometer lang. Mehr als die Hälfte davon gehört zu Baden-Württemberg.',
      'Im See stecken rund 48 Milliarden Kubikmeter Wasser, fast alles davon im Obersee.',
    ]),
    map('m-zwei-teile', 9.12, 47.733, '2', 'erde', 'Zwei Seen in einem', [
      'Der See hat zwei Teile: den großen, tiefen Obersee und den kleinen, flachen Untersee.',
      'Der Untersee ist höchstens 40 Meter tief. Der Überlinger See ist ein langer Arm des Obersees.',
    ]),
    map('m-tiefste', 9.385, 47.6, '↓', 'erde', 'Die tiefste Stelle', [
      'An der tiefsten Stelle ist der See 251 Meter tief. Das liegt mitten im Obersee, zwischen Friedrichshafen und der Schweizer Seite.',
      'Vermessen wurde das ganz genau mit Schiffen, von 2013 bis 2015. In älteren Büchern steht darum oft noch eine andere Zahl.',
    ]),
    map('m-rhein-rein', 9.61, 47.515, '→', 'erde', 'Der Rhein kommt an', [
      'Rund 200 Flüsse und Bäche fließen in den See. Jede Sekunde bringen sie etwa 350 Kubikmeter Wasser.',
      'Der Rhein bringt mehr als die Hälfte davon. Er mündet in Vorarlberg in den See.',
      'Er bringt auch Sand mit. In vielen zehntausend Jahren wäre der Obersee voll.',
    ]),
    map('m-rhein-raus', 9.15, 47.684, '←', 'erde', 'Der Rhein fließt weiter', [
      'Bei Konstanz fließt der Rhein aus dem Obersee in den Untersee.',
      'Bei Stein am Rhein verlässt er den See ganz. Später stürzt er den Rheinfall hinunter.',
    ]),
    map('m-seegfroerne', 9.27, 47.655, '*', 'geschichte', 'Wenn der See zufriert', [
      '1963 fror der ganze See zu. Menschen liefen, radelten und fuhren sogar mit dem Auto über das Eis.',
      'Davor fror der See zum Beispiel 1830 und 1880 zu. Der kleine Untersee friert viel öfter.',
    ]),
    map('m-stgallen', 9.37, 47.447, '★', 'geschichte', 'St. Gallen', [
      'St. Gallen liegt nicht am See, aber nicht weit davon. Dort liegt ein berühmter Klosterplan aus dem 9. Jahrhundert.',
      'Das Klostergelände ist seit 1983 Welterbe.',
    ]),
    map('m-name', 8.985, 47.822, 'B', 'geschichte', 'Woher der Name kommt', [
      'Der Name Bodensee kommt vom kleinen Ort Bodman. Dort stand früher ein Hof, in dem der König auf Reisen wohnte.',
      'Die Römer nannten den See noch ganz anders: lacus Brigantinus, den See von Bregenz.',
    ]),
  ];

  // ------------------------------------------------------------------ Entdeckungen am Uferweg
  const lm = (id, draw, cat, title, facts, opts) => BE.def({ id: `lm-${id}`, draw, cat, title, facts, art: lmArt(draw, opts && opts.zoom), ...(opts || {}) });
  const cr = (id, critter, cat, title, facts, opts) => BE.def({ id: `cr-${id}`, critter, cat, title, facts, art: critterArt(critter), ...(opts || {}) });

  lm('seebuehne', 'seebuehne', 'geschichte', 'Die Seebühne', [
    '1946 spielten die Bregenzer Festspiele auf zwei Lastkähnen im See. Ein Sturm riss die erste Bühne auseinander, doch sie machten weiter.',
    'Heute schauen rund 7000 Menschen gleichzeitig zu.',
  ]);
  lm('pfaender', 'pfaender', 'urzeit', 'Der Urelefant vom Pfänder', [
    'Auf dem Pfänder bei Bregenz fand ein Sammler Zähne eines Urelefanten.',
    'Vor rund 15 Millionen Jahren war es hier subtropisch warm, mit Flüssen und kleinen Seen.',
    'Das ist einer der wenigen Urzeit-Funde direkt am See. Und vor gut 20.000 Jahren lag der ganze Berg unter dem Eis.',
  ], { action: { label: 'Zur Zeitreise', run: () => BE.show('zeit') } });
  lm('foehn', 'foehn', 'natur', 'Der Föhn', [
    'Der Föhn ist ein warmer Sturm aus den Alpen. Er rauscht durch das Rheintal auf den See hinaus.',
    '1963 war der ganze See zugefroren. Warme Föhnstürme beendeten die Seegfrörne.',
  ], { size: 120, height: 130, zoom: 2 });
  lm('brigantium', 'brigantium', 'geschichte', 'Die Römer in Brigantium', [
    'Im Jahr 15 vor Christus kamen die Römer an den See. Aus Bregenz machten sie die Stadt Brigantium.',
    'Vor den Römern lebten hier Kelten, vor allem am westlichen See und bei Bregenz.',
  ]);
  lm('insel-lindau', 'insel_lindau', 'geschichte', 'Die Inselstadt', [
    'Lindaus Altstadt liegt auf einer Insel. Eine Brücke und ein Bahndamm führen hinüber.',
    'Die Insel ist nur gut einen halben Quadratkilometer groß.',
  ]);
  lm('lindau-hafen', 'lindau_hafen', 'geschichte', 'Löwe und Leuchtturm', [
    'An der Hafeneinfahrt von Lindau sitzt ein sechs Meter hoher Löwe aus Stein. Er ist das Wappentier von Bayern.',
    'Gegenüber steht ein Leuchtturm von 1856. Er ist über 30 Meter hoch.',
  ]);
  lm('fischer', 'fischerboot', 'natur', 'Die Fischer und die Felchen', [
    'Die Felchen waren jahrzehntelang der wichtigste Fisch der Bodensee-Fischer.',
    'Weil es immer weniger Felchen gab, wurde ihr Fang im Obersee ab 2024 verboten. Für 2027 ist wieder ein kleiner Fang erlaubt.',
  ]);
  lm('montfort', 'schloss_montfort', 'geschichte', 'Schloss Montfort', [
    'Dieses Schloss in Langenargen sieht aus wie aus dem Orient.',
    'In Langenargen sitzt auch das Institut für Seenforschung. Dort untersuchen Fachleute, wie es dem See geht.',
  ]);
  lm('zeppelin', 'zeppelin', 'geschichte', 'Das erste Luftschiff', [
    'Am 2. Juli 1900 stieg über dem Bodensee das erste Zeppelin-Luftschiff auf. Es war 128 Meter lang und flog 18 Minuten.',
    'Es startete aus einer schwimmenden Halle in der Bucht von Manzell bei Friedrichshafen.',
  ]);
  lm('sturm', 'sturmlampe', 'natur', 'Das orange Blinklicht', [
    'Blinkt am Ufer ein oranges Licht, kommt Wind. Blinkt es schnell, kommt Sturm, dann schnell raus aus dem Wasser!',
    'Das merkst du dir am besten: 40 Blitze in der Minute heißt Achtung, 90 Blitze in der Minute heißt Sturm.',
  ], { size: 80, height: 145, zoom: 1.6 });
  lm('ladine', 'ladine', 'geschichte', 'Die Lädine', [
    'Die Lädine war das größte Segelschiff auf dem See, rund 30 Meter lang. Sie trug so viel wie heute mehrere Lastwagen.',
    'Lädinen brachten Getreide, Salz, Wein und Baumaterial über den See.',
    'In Immenstaad gibt es heute einen Nachbau.',
  ]);
  lm('seegfroerne', 'seegfroerne', 'geschichte', 'Die Eisprozession', [
    'Friert der See zu, tragen die Menschen eine Figur des heiligen Johannes über das Eis.',
    'Das machen sie seit 1573, zwischen Hagnau und Münsterlingen. Seit 1963 wartet die Figur in Münsterlingen auf den nächsten Winter, in dem das geht.',
  ]);
  lm('meersburg', 'burg_meersburg', 'geschichte', 'Die Burg Meersburg', [
    'Die Sage sagt, König Dagobert habe den Turm im Jahr 630 gebaut. Sicher belegt ist die Burg erst viel später.',
  ]);
  lm('droste', 'droste', 'geschichte', 'Die Dichterin', [
    'In der Burg lebte die Dichterin Annette von Droste-Hülshoff. Ihr Arbeitszimmer kannst du heute noch ansehen.',
  ]);
  lm('pfahlbau', 'pfahlbau', 'geschichte', 'Die Pfahlbauhäuser', [
    'Die ältesten Pfahlbauten am Bodensee sind fast 6000 Jahre alt, die jüngsten rund 2900 Jahre.',
    'Seit 1922 stehen in Unteruhldingen nachgebaute Pfahlbauhäuser im Wasser. Dort siehst du, wie die Menschen vor Jahrtausenden wohnten.',
    'Rund um die Alpen kennt man über 900 solcher Fundstellen. 111 davon gehören seit 2011 zum Welterbe der UNESCO. Die echten Reste liegen meist unsichtbar im Seegrund.',
  ]);
  lm('wasser', 'wasserwerk', 'erde', 'Trinkwasser aus dem See', [
    'Rund fünf Millionen Menschen trinken Wasser aus dem Bodensee.',
    'Bei Sipplingen wird Wasser aus 60 Metern Tiefe geholt und 310 Meter den Berg hinaufgepumpt. Von dort fließt es bis nach Stuttgart.',
    'Das Trinkwasser senkt den See nur um wenige Zentimeter. Über das Jahr steigt und fällt sein Wasserstand um mehr als einen Meter.',
  ]);
  lm('mainau', 'mainau', 'geschichte', 'Die Blumeninsel Mainau', [
    'Die Mainau ist eine kleine Blumeninsel. Dort gibt es ein Schmetterlingshaus und ein Barockschloss.',
  ]);
  lm('konzil', 'konzil', 'geschichte', 'Das Konzil von Konstanz', [
    'Dreieinhalb Jahre lang, von 1414 bis 1418, trafen sich in Konstanz Fürsten und Bischöfe aus ganz Europa.',
    'Im Haus am Hafen wählten sie 1417 sogar einen Papst. Zeitweise waren mehr Gäste in der Stadt, als sie Einwohner hatte.',
    'Unter dem Konstanzer Münster fanden Archäologen außerdem eine römische Festung. Das Münster steht auf dem Schuttwall, den ein Gletscher hier aufschob.',
  ]);
  lm('ried', 'ried', 'natur', 'Das Wollmatinger Ried', [
    'Zwischen Konstanz und der Reichenau liegt ein riesiges Ried. Bei Führungen kannst du hier Vögel aus der Nähe beobachten.',
    'Es ist das größte Naturschutzgebiet am deutschen Bodenseeufer.',
  ], { size: 280, height: 120, zoom: 1.5 });
  lm('reichenau', 'kloster_reichenau', 'geschichte', 'Die Klosterinsel Reichenau', [
    'Auf der Reichenau wurde 724 ein Kloster gegründet. Seine alten Kirchen mit Wandmalereien stehen noch heute.',
    'Seit dem Jahr 2000 ist die Insel Welterbe der UNESCO. Sie ist die größte Insel im See.',
  ]);
  lm('beringung', 'beringung', 'natur', 'Die Vogelforscher', [
    'Viele Zugvögel fliegen das Rheintal entlang und rasten am See.',
    'Auf der Mettnau bei Radolfzell beringen Forscher sie seit 1968, um ihre Wege zu verstehen.',
    'Im Winter rasten Hunderttausende Wasservögel auf dem See. Freiwillige zählen sie jeden Monat.',
  ], { size: 200, height: 110, zoom: 1.5 });
  lm('hohentwiel', 'hohentwiel', 'erde', 'Der Hohentwiel', [
    'Im Hegau, westlich des Sees, brachen vor rund 13 bis 7 Millionen Jahren Vulkane aus. Der Bodensee selbst war noch lange nicht da.',
    'Der Hohentwiel ist das harte Innere eines Vulkans. Das Eis der Gletscher hat ihn erst freigelegt, darum sieht er heute so spitz aus.',
  ], { action: { label: 'Zur Zeitreise', run: () => BE.show('zeit') } });
  lm('oehningen', 'oehningen_grube', 'urzeit', 'Die Fossilien von Öhningen', [
    'Vor rund 13 Millionen Jahren lag bei Öhningen ein Kratersee voller Leben. Rund 1500 versteinerte Arten kennt man von dort, von Pflanzen über Insekten bis zu Schildkröten.',
    'Ein Arzt hielt ein Skelett von hier 1726 für einen Menschen aus der großen Flut, von der die Bibel erzählt. Gut 80 Jahre später zeigte sich: Es ist ein Riesensalamander.',
  ], { action: { label: 'Selbst ausgraben', run: () => BE.show('grabung') } });
  lm('stein', 'stein_am_rhein', 'erde', 'Hier begann der See', [
    'Der Bodensee begann vor rund 19.000 Jahren als kleiner See aus Schmelzwasser bei Stein am Rhein. Er wuchs mit, während der Gletscher schmolz.',
    'Die Steine rundherum sind Millionen Jahre alt. Der See selbst ist viel jünger.',
    'Heute verlässt der Rhein hier den See.',
  ]);
  lm('kesslerloch', 'kesslerloch', 'urzeit', 'Die Höhle Kesslerloch', [
    'Vor über 15.000 Jahren trafen sich Rentierjäger immer wieder an dieser Höhle bei Thayngen.',
    'Ein Künstler der Eiszeit ritzte einen Rentierhirsch in einen Stab. Er senkt den Kopf, weil er kämpfen will.',
    'In der Höhle fand man Knochen von 54 Tierarten, sogar von Mammut und Wollnashorn. Auch ein Hund lebte schon bei den Menschen.',
  ]);
  lm('rheinfall', 'rheinfall', 'erde', 'Der Rheinfall', [
    'Der Rheinfall ist noch jung: Er entstand gegen Ende der letzten Eiszeit, vor rund 15.000 Jahren.',
    'Der Rhein stürzt dort 23 Meter über eine Kante aus uraltem Kalk, und das auf 150 Metern Breite.',
    'Er liegt nicht mehr am See, aber es ist dasselbe Wasser, das du gerade siehst.',
  ]);
  lm('zahn', 'fundstein', 'urzeit', 'Der winzige Zahn', [
    'In Steckborn lag ein winziger Zahn in einem Stein im Garten, gefunden 2017 beim Hausbau.',
    'Er gehörte wohl einem kleinen Hirschferkel, das vor rund 17 Millionen Jahren hier lebte.',
  ], { size: 130, height: 60, zoom: 3 });
  lm('grenzstein', 'grenzstein', 'grenzen', 'Eine Straße, zwei Länder', [
    'Konstanz und Kreuzlingen hängen zusammen. Du gehst zu Fuß über die Straße und bist in einem anderen Land.',
    'Am Seeufer zeigen große Figuren aus Stahl, wo früher ein Zaun die Grenze war.',
  ]);
  lm('faehre', 'hafen_faehre', 'geschichte', 'Die Fähre', [
    'An der breitesten Stelle sind es 14 Kilometer von Ufer zu Ufer. Die Fähre von Friedrichshafen nach Romanshorn fährt fast genau dort.',
  ]);
  lm('arbon', 'arbon', 'geschichte', 'Arbor Felix', [
    'In Arbon bauten die Römer um das Jahr 300 eine Festung. Sie hieß Arbor Felix, das heißt glücklicher Baum.',
    'Teile der Mauern kannst du noch sehen.',
  ]);
  lm('kornhaus', 'kornhaus', 'geschichte', 'Das Kornhaus', [
    'Das große Kornhaus in Rorschach wurde von 1746 bis 1749 gebaut. Es lagerte Getreide, das über den See kam.',
  ]);
  lm('wilhelm', 'hafen_faehre', 'geschichte', 'Das erste Dampfschiff', [
    '1824 fuhr das erste Dampfschiff über den See. Es hieß Wilhelm und verband Friedrichshafen mit Rorschach.',
  ]);
  lm('rheindurchstich', 'rheinmuendung', 'erde', 'Ein neuer Weg für den Rhein', [
    'Der Rhein überschwemmte das Tal immer wieder. Darum gruben Österreich und die Schweiz ihm gerade Abkürzungen, 1900 bei Fußach und 1923 bei Diepoldsau.',
  ]);
  lm('dampfer', 'hafen_faehre', 'geschichte', 'Der Dampfer Hohentwiel', [
    'Die Hohentwiel fährt seit 1913 und dampft noch heute. Zu Hause ist sie in Hard.',
    'Sie ist das älteste Verkehrsschiff auf dem Bodensee.',
  ]);
  lm('biber', 'biberburg', 'natur', 'Der Biber ist zurück', [
    'Der Biber ist zurück am See! Im Rheindelta findest du seine angenagten Bäume.',
    'Wo der Rhein in den See fließt, liegt das Rheindelta, rund 2000 Hektar groß. Seit 1976 ist es Naturschutzgebiet für Vögel und andere Tiere.',
  ]);
  cr('haubentaucher', 'haubentaucher', 'natur', 'Der Haubentaucher', ['Der Haubentaucher trägt eine Federhaube und taucht nach Fischen.'], { where: 'water' });
  cr('schwan', 'hoeckerschwan', 'natur', 'Der Höckerschwan', ['Die weißen Schwäne waren nicht immer da: Menschen haben sie vor rund 100 Jahren hier ausgesetzt.', 'Sie gehören zu den größten Vögeln am See und bauen ihre Nester aus Schilf.'], { where: 'water' });
  cr('kormoran', 'kormoran', 'natur', 'Der Kormoran', ['Der schwarze Kormoran taucht nach Fischen. Über 1000 Paare brüten am See.'], { where: 'water' });
  cr('reiherente', 'reiherente', 'natur', 'Die Reiherente', ['Im Winter kommen viele Reiherenten und tauchen bis neun Meter tief nach Muscheln.'], { where: 'water' });
  cr('kolbenente', 'kolbenente', 'natur', 'Die Kolbenente', ['Das Männchen der Kolbenente hat einen knallroten Schnabel. Sie frisst die Armleuchteralgen am Seegrund.'], { where: 'water' });
  cr('reiher', 'graureiher', 'natur', 'Der Graureiher', ['Der Graureiher steht reglos im Flachwasser und wartet auf Beute.']);
  cr('eisvogel', 'eisvogel', 'natur', 'Der Eisvogel', ['Mit etwas Glück blitzt am Ufer ein blauer Eisvogel vorbei.']);
  cr('vergissmeinnicht', 'vergissmeinnicht', 'natur', 'Das Bodensee-Vergissmeinnicht', ['Dieses kleine blaue Vergissmeinnicht wächst auf der ganzen Welt fast nur hier.', 'Im Sommer steht es wochenlang unter Wasser und überlebt das.']);
  cr('strandrasen', 'strandschmiele', 'natur', 'Der Strandrasen', ['Auf den Kiesstränden wachsen winzige Pflanzen, die es sonst fast nirgends gibt. Darum nicht auf ihnen herumtrampeln!']);
  cr('schilf', 'schilf', 'natur', 'Das Schilf', ['Schilf hält mit seinen Wurzeln das Ufer fest. Viele Vögel bauen darin ihre Nester.']);

  BE.def({ id: 'grenze-at-de', cat: 'grenzen', title: 'Von Österreich nach Deutschland', facts: ['Der kleine Fluss Leiblach bildet hier die Grenze zwischen Vorarlberg und Bayern.'], art: townArt({ land: 'de', lat: 47.55, lon: 9.7 }) });
  BE.def({ id: 'grenze-de-ch', cat: 'grenzen', title: 'Von Deutschland in die Schweiz', facts: ['Öhningen liegt noch in Deutschland, das Nachbarstädtchen Stein am Rhein schon in der Schweiz.', 'Im Untersee läuft die Grenze genau durch die Mitte des Wassers.'], art: townArt({ land: 'ch', lat: 47.66, lon: 8.87 }) });
  BE.def({ id: 'grenze-ch-at', cat: 'grenzen', title: 'Von der Schweiz nach Österreich', facts: ['Hier trennt der Alte Rhein die Schweiz und Österreich.', 'Beide Länder haben schon 1892 einen Vertrag geschlossen, um den Fluss gemeinsam zu bändigen.'], art: townArt({ land: 'at', lat: 47.47, lon: 9.63 }) });

  // Reihenfolge des Uferwegs. Grenzen stehen vor dem ersten Ort im neuen Land.
  BE.shore = [
    { place: 'bregenz', style: 'holz', alps: 0.95, trees: ['tanne', 'laub'], spots: ['lm-seebuehne', 'cr-haubentaucher', 'lm-brigantium', 'lm-foehn'] },
    { place: 'lochau', style: 'holz', alps: 0.95, trees: ['tanne', 'laub'], spots: ['lm-pfaender', 'cr-reiher'] },
    { place: 'lindau', border: { item: 'grenze-at-de', from: 'at' }, style: 'plain', alps: 0.85, spots: ['lm-insel-lindau', 'lm-lindau-hafen', 'cr-schwan'] },
    { place: 'wasserburg', style: 'plain', alps: 0.8, trees: ['apfel', 'laub'], spots: ['lm-fischer', 'cr-vergissmeinnicht'] },
    { place: 'langenargen', style: 'plain', alps: 0.7, trees: ['apfel', 'pappel'], spots: ['lm-montfort', 'cr-reiherente'] },
    { place: 'friedrichshafen', style: 'plain', alps: 0.65, spots: ['lm-zeppelin', 'lm-sturm'] },
    { place: 'immenstaad', style: 'fachwerk', alps: 0.6, trees: ['apfel', 'laub'], spots: ['lm-ladine', 'cr-kormoran'] },
    { place: 'hagnau', style: 'fachwerk', alps: 0.55, trees: ['apfel', 'laub'], spots: ['lm-seegfroerne'] },
    { place: 'meersburg', style: 'fachwerk', alps: 0.5, spots: ['lm-meersburg', 'lm-droste'] },
    { place: 'unteruhldingen', style: 'plain', alps: 0.45, spots: ['lm-pfahlbau', 'cr-schilf'] },
    { place: 'ueberlingen', style: 'fachwerk', alps: 0.4, spots: ['cr-strandrasen'] },
    { place: 'sipplingen', style: 'plain', alps: 0.35, spots: ['lm-wasser'] },
    { place: 'ludwigshafen', style: 'plain', alps: 0.3, spots: [] },
    { place: 'bodman', style: 'fachwerk', alps: 0.25, trees: ['laub', 'tanne'], spots: ['cr-eisvogel'] },
    { place: 'konstanz', style: 'fachwerk', alps: 0.35, spots: ['lm-mainau', 'lm-konzil', 'lm-ried'] },
    { place: 'reichenau', style: 'plain', alps: 0.25, spots: ['lm-reichenau', 'cr-kolbenente'] },
    { place: 'allensbach', style: 'plain', alps: 0.25, trees: ['laub', 'pappel'], spots: [] },
    { place: 'radolfzell', style: 'fachwerk', alps: 0.2, spots: ['lm-beringung', 'lm-hohentwiel'] },
    { place: 'oehningen', style: 'fachwerk', alps: 0.15, spots: ['lm-oehningen'] },
    { place: 'stein', border: { item: 'grenze-de-ch', from: 'de' }, style: 'fresko', alps: 0.2, spots: ['lm-stein', 'lm-kesslerloch', 'lm-rheinfall'] },
    { place: 'steckborn', style: 'fresko', alps: 0.25, spots: ['lm-zahn'] },
    { place: 'kreuzlingen', style: 'plain', alps: 0.4, spots: ['lm-grenzstein'] },
    { place: 'romanshorn', style: 'plain', alps: 0.6, spots: ['lm-faehre'] },
    { place: 'arbon', style: 'plain', alps: 0.75, spots: ['lm-arbon'] },
    { place: 'rorschach', style: 'plain', alps: 0.85, spots: ['lm-kornhaus', 'lm-wilhelm'] },
    { place: 'rheineck', style: 'fachwerk', alps: 0.95, spots: [] },
    { place: 'fussach', border: { item: 'grenze-ch-at', from: 'ch' }, style: 'holz', alps: 1, spots: ['lm-rheindurchstich', 'lm-biber'] },
    { place: 'hard', style: 'holz', alps: 1, spots: ['lm-dampfer'] },
  ];
  BE.spot = (id) => BE.item(id);

  // ------------------------------------------------------------------ Fossil-Grabung
  const fund = (id, title, facts) => BE.def({ id: `fund-${id}`, cat: 'urzeit', title, facts });
  fund('salamander', 'Der Riesensalamander', [
    'Der berühmteste Fund aus Öhningen ist ein Riesensalamander. Gefunden wurde er 1725.',
    'Ein Arzt hielt das Skelett für einen Menschen aus der großen Flut, von der die Bibel erzählt. Gut 80 Jahre später zeigte sich: Es ist ein Salamander.',
    'Das echte Stück liegt heute in einem Museum in den Niederlanden.',
  ]);
  fund('blatt', 'Das Blatt aus dem Kratersee', ['Rund 500 Pflanzenarten kennt man aus Öhningen. Ihre Blätter sanken vor rund 13 Millionen Jahren auf den Grund des Kratersees.', 'Schon im 16. Jahrhundert sammelten Mönche hier Fossilien.']);
  fund('libelle', 'Das Insekt im Stein', ['Rund 800 Insektenarten kennt man aus Öhningen. So fein sind nur wenige Fundstellen erhalten.', 'Die letzte Grabung fand 2021 statt.']);

  // ------------------------------------------------------------------ Zeitreise
  const era = (id, when, short, line2, cat, facts, creatures) => {
    const made = {};
    for (const [key, title, cfacts, ccat, extra] of creatures) {
      const itemId = `z-${id}-${key}`;
      BE.def({ id: itemId, cat: ccat || cat, eyebrow: [short, when], title, facts: cfacts, art: eraArt(id, key), ...(extra || {}) });
      made[key] = itemId;
    }
    BE.def({ id: `era-${id}`, cat: 'erde', eyebrow: [when], title: short, facts, art: eraArt(id) });
    return { id, when, short, line: line2, item: `era-${id}`, creatures: made };
  };
  const zeit = () => ({ label: 'Selbst ausgraben', run: () => BE.show('grabung') });
  BE.eras = [
    era('trias', 'vor rund 225 bis 205 Mio. Jahren', 'Trias', 'Noch kein See, noch keine Alpen. Nördlich von hier liefen die ersten großen Dinosaurier.', 'urzeit', [
      'Nördlich des heutigen Sees wechselten sich Land und flaches Meer ab, und dort liefen die ersten großen Dinosaurier. Wo heute die Alpen sind, war Meer.',
      'Am Bodensee selbst hat noch niemand einen Dinosaurier gefunden. Die Steine am See sind viel jünger als die Dinosaurier. Die alten Schichten liegen tausende Meter tief unter dir.',
    ], [
      ['plateosaurus', 'Plateosaurus', ['In Trossingen entdeckten spielende Kinder um 1908 Knochen von Plateosaurus, einem bis zu acht Meter langen Dinosaurier. Das sind rund 43 Kilometer Luftlinie vom Bodensee.', 'Auch in einer Tongrube in Frick in der Schweiz liegen Plateosaurier über 200 Millionen Jahre im Boden. Das Museum dort zeigt ein ganzes Skelett.']],
      ['plateosaurus_jung', 'Ein naher Dino-Fund: Schleitheimia', ['Bei Schleitheim, rund 30 Kilometer vom Untersee, fand ein Sammler in den 1950er-Jahren Knochen eines Dinosauriers. Er lebte vor rund 225 Millionen Jahren.', 'Erst 2020 bekam er seinen Namen: Schleitheimia. Das ist der nächste bekannte Dino-Fund vom See aus.'], undefined, { art: eraArt('trias') }],
      ['schachtelhalm', 'Schachtelhalme', ['Schachtelhalme gab es schon zur Zeit der ersten Dinosaurier. Ihre kleinen Verwandten wachsen noch heute.'], 'natur'],
    ]),
    era('jura', 'vor rund 180 Mio. Jahren', 'Jurazeit', 'Ein warmes Meer lag über Süddeutschland. Darin schwammen Fischsaurier und Ammoniten.', 'urzeit', [
      'Im Jura lag ein Meer über Süddeutschland. Darin schwammen Fischsaurier und Ammoniten.',
      'Am berühmtesten ist Holzmaden, rund 100 Kilometer vom See. Die Tiere sanken dort auf den Grund des Jurameers.',
    ], [
      ['ichthyosaurier', 'Der Fischsaurier', ['In Holzmaden lag vor rund 180 Millionen Jahren ein Meer. Dort fand man viele Fischsaurier.', 'Fischsaurier heißen nur so ähnlich. Sie sind Meeresreptilien, keine Dinosaurier.']],
      ['plesiosaurier', 'Der Plesiosaurier', ['Mit langem Hals und vier großen Flossen ruderte er durch das Jurameer.', 'Auch er war ein Meeresreptil und kein Dinosaurier.']],
      ['ammonit', 'Der Ammonit', ['Ammoniten waren Tiere mit einer Spiralschale, verwandt mit den heutigen Tintenfischen.', 'Ihre Versteinerungen findet man auf der Schwäbischen Alb.']],
      ['seelilie', 'Die Seelilie', ['Seelilien sehen aus wie Pflanzen, sind aber Tiere.', 'Aus dem Jurameer kennt man sie versteinert von der Schwäbischen Alb.']],
      ['meereskrokodil', 'Das Meereskrokodil', ['Der Steneosaurier wurde knapp fünf Meter lang und lebte im Jurameer.', 'Ein Skelett stammt aus Holzmaden am Fuß der Schwäbischen Alb, nicht vom See.']],
      ['flugsaurier', 'Der Flugsaurier', ['Über dem Meer flogen Flugsaurier mit Flügeln aus Haut.', 'Auch Flugsaurier sind keine Dinosaurier, sondern ihre Verwandten.']],
    ]),
    era('kreide', 'vor rund 145 bis 66 Mio. Jahren', 'Kreidezeit', 'Hier fehlen die Gesteine, darum weiß man wenig. Im Süden lag ein tropisches Meer, das heute der Säntis ist.', 'urzeit', [
      'Aus dieser Zeit fehlen bei uns die Gesteine. Darum weiß man hier über die Kreidezeit nur wenig.',
      'Vor 66 Millionen Jahren endete die Zeit der großen Dinosaurier.',
    ], [
      ['kreide_ammonit', 'Der Säntis war Meeresboden', ['Der Säntis besteht aus Meeresboden. Oben findest du versteinerte Muscheln und Seeigel aus einem tropisch warmen Meer.', 'Diese Gesteine wurden später in die Alpen geschoben.']],
      ['kreide_meeresschildkroete', 'Ein tropisch warmes Meer', ['Südlich des heutigen Sees lag damals ein tropisch warmes Meer mit Muscheln, Korallen und Seeigeln.']],
      ['komet', 'Das Ende der Dinosaurier', ['Vor 66 Millionen Jahren schlug weit entfernt ein riesiger Brocken aus dem Weltall ein, und die großen Dinosaurier starben aus.', 'Der berühmte T. rex lebte in Nordamerika, nie am Bodensee.', 'Viele Kinder denken, Dinos lebten überall gleichzeitig. Dabei liegen zwischen Plateosaurus und T. rex über 130 Millionen Jahre.', 'Zwischen dem letzten Dinosaurier und den Mammuts der letzten Eiszeit liegen über 65 Millionen Jahre.']],
    ]),
    era('vulkane', 'vor rund 50 bis 7 Mio. Jahren', 'Vulkane und Alpen', 'Westlich des heutigen Sees brachen Vulkane aus, im Süden wuchsen die Alpen.', 'erde', [
      'Vor rund 50 Millionen Jahren schob sich Afrika gegen Europa. Dabei wuchsen die Alpen in die Höhe.',
      'Vor den neuen Bergen entstand eine riesige Mulde. Flüsse füllten sie mit Sand und Steinen, und zweimal stand dort sogar das Meer.',
    ], [
      ['vulkan_kegel', 'Die Hegau-Vulkane', ['Westlich des heutigen Sees brachen vor rund 13 bis 7 Millionen Jahren Vulkane aus.', 'Der Hohentwiel ist das harte Innere eines solchen Vulkans. Das Eis der Gletscher hat ihn erst freigelegt.']],
      ['alpen_wachsen', 'Die Alpen wachsen', ['Vor rund 50 Millionen Jahren schob sich Afrika gegen Europa. Dabei wuchsen die Alpen in die Höhe.']],
      ['hauerelefant', 'Der Hauerelefant', ['Im Hegau, nicht weit vom See, lebten auch Dinotherien und Nashörner. Dinotherien waren riesige Rüsseltiere mit Hauern im Unterkiefer.', 'Am Vulkan Höwenegg lebten vor rund 10 Millionen Jahren außerdem Pferde mit drei Zehen, in großen Herden wie Zebras.'], 'urzeit'],
    ]),
    era('miozaen', 'vor rund 15 bis 13 Mio. Jahren', 'Miozän', 'Subtropisch warm! Bei Öhningen lag ein Kratersee voller Leben. Diese Tiere lebten wirklich hier.', 'urzeit', [
      'Vor rund 13 Millionen Jahren lag bei Öhningen ein Kratersee voller Leben. Rund 1500 versteinerte Arten kennt man von dort.',
      'Einen Bodensee gab es noch nicht. Aber diese Tiere lebten wirklich hier.',
    ], [
      ['riesensalamander', 'Der Riesensalamander', ['Der Riesensalamander lebte im Kratersee von Öhningen und wurde gut einen Meter lang.', 'Sein Skelett hielt man lange für einen Menschen aus der großen Flut, von der die Bibel erzählt.'], 'urzeit', { action: { label: 'Selbst ausgraben', run: () => BE.show('grabung') } }],
      ['urelefant', 'Der Urelefant', ['Auf dem Pfänder bei Bregenz fand ein Sammler Zähne eines Urelefanten, rund 15 Millionen Jahre alt.', 'Dieser Fund liegt direkt am See.']],
      ['schildkroete', 'Die Süßwasserschildkröte', ['Auch Süßwasserschildkröten fand man versteinert in Öhningen.']],
      ['libelle', 'Die Libelle', ['Rund 800 Insektenarten kennt man aus Öhningen.'], 'urzeit', { action: { label: 'Selbst ausgraben', run: () => BE.show('grabung') } }],
      ['urfuchs', 'Der Urfuchs', ['In Öhningen fand man auch den Schädel eines kleinen Raubtiers, das an einen Fuchs erinnert.']],
    ]),
    era('gletscher', 'vor gut 20.000 Jahren', 'Eispanzer', 'Bis zu 1200 Meter dickes Eis lag hier. Sogar der Pfänder verschwand darunter.', 'erde', [
      'Vor gut 20.000 Jahren lag hier ein Eispanzer, bis zu 1200 Meter dick. Sogar der Pfänder verschwand darunter.',
      'Gletscher schürften das Becken immer tiefer aus, in mehreren Eiszeiten. Der Felsgrund liegt stellenweise tiefer als das Meer.',
    ], [
      ['rheingletscher', 'Der Rheingletscher', ['Ein riesiger Eisstrom schob sich aus den Alpen hierher und hobelte das Becken des heutigen Sees aus.']],
      ['findling', 'Der Findling', ['Gletscher trugen große Felsbrocken weit mit sich. Wenn das Eis schmolz, blieben sie liegen. Solche Steine heißen Findlinge.']],
      ['bergspitze', 'Berge im Eis', ['Nur die höchsten Gipfel ragten aus dem Eis heraus. Der Pfänder bei Bregenz lag ganz darunter.']],
    ]),
    era('see_entsteht', 'vor rund 19.000 bis 8.000 Jahren', 'Der See entsteht', 'Das Eis schmilzt, und aus Schmelzwasser wird der Bodensee. Er ist viel jünger als seine Steine.', 'erde', [
      'Der Bodensee begann vor rund 19.000 Jahren als kleiner See aus Schmelzwasser bei Stein am Rhein.',
      'Der Gletscher hielt bei Konstanz an und schob einen Schuttwall auf. Darum gibt es heute zwei Seeteile.',
      'Die Flüsse brachten so viel Schutt, dass der obere Teil des Sees verschwand. Aus Wasser wurde das Land im Rheintal.',
    ], [
      ['schmelzwasser', 'Der See wird geboren', ['Der Bodensee begann vor rund 19.000 Jahren als kleiner See aus Schmelzwasser. Er wuchs mit, während der Gletscher schmolz.', 'Die Steine sind Millionen Jahre alt, der See nur rund 19.000 Jahre.']],
      ['birke', 'Das Eis geht', ['Vor rund 12.000 Jahren endete die letzte Eiszeit. Nach und nach wuchsen wieder Bäume am Ufer.']],
      ['kranich', 'Der Riesensee', ['Vor rund 16.500 Jahren reichte der See weit ins Rheintal bis fast nach Chur. Er war mehr als doppelt so groß wie heute.'], undefined, { art: eraArt('see_entsteht') }],
    ]),
    era('eiszeit', 'vor über 15.000 Jahren', 'Späte Eiszeit', 'Kaltsteppe statt Wald. Mammuts und Rentiere zogen vorbei, Menschen jagten hier.', 'urzeit', [
      'Vor über 15.000 Jahren trafen sich Rentierjäger immer wieder an der Höhle Kesslerloch bei Thayngen.',
      'An der Quelle der Schussen fand man 1866 ein Lager von Rentierjägern. Es zeigte: Menschen konnten in der eiszeitlichen Kälte hier leben.',
    ], [
      ['mammut', 'Das Mammut', ['Mammuts lebten auch hier. Ihre Knochen und Zähne fand man rund um den Bodensee und im Bregenzerwald.', 'Zwischen dem letzten Dinosaurier und den Mammuts der letzten Eiszeit liegen über 65 Millionen Jahre.']],
      ['wollnashorn', 'Das Wollnashorn', ['In der Höhle Kesslerloch fand man auch Knochen vom Wollnashorn.', 'Mit dickem Fell hielt es die Kälte aus.']],
      ['rentier', 'Das Rentier', ['Ein Künstler der Eiszeit ritzte einen Rentierhirsch in einen Stab. Er senkt den Kopf, weil er kämpfen will.']],
      ['wildpferd', 'Das Wildpferd', ['Auch Wildpferde gehören zu den 54 Tierarten aus der Höhle Kesslerloch.']],
      ['jaegerin', 'Die Menschen der Eiszeit', ['Rentierjäger kamen über 4000 Jahre lang immer wieder an dieselbe Höhle. Auch ein Hund lebte schon bei ihnen.', '1875 schickte ein Arbeiter einem Professor angeblich uralte Zeichnungen von Bär und Eisfuchs. Ein Jahr später flog es auf: Die Vorlage stammte aus einem Kinderbuch!'], 'geschichte'],
      ['schneehase', 'Der Schneehase', ['Den Schneehasen fand man im Kesslerloch auch. Mit seinem weißen Fell war er im Schnee kaum zu sehen.']],
    ]),
    era('pfahlbau_zeit', 'um 3900 v. Chr.', 'Pfahlbauten', 'Die ersten Dörfer am Ufer. Die ältesten Häuser standen in Hornstaad auf der Höri.', 'geschichte', [
      'Die ältesten Pfahlbauten am Bodensee sind fast 6000 Jahre alt, die jüngsten rund 2900 Jahre.',
      'Seit 2011 gehören die Reste der Pfahlbauten zum Welterbe der UNESCO.',
    ], [
      ['einbaum', 'Der Einbaum', ['Einbäume sind Boote aus einem einzigen ausgehöhlten Baumstamm. So kamen die Menschen damals über das Wasser.']],
      ['pfahlhaus', 'Das Pfahlhaus', ['Manche dieser Häuser sind älter als die Pyramiden in Ägypten!', 'Unter Wasser verrottet Holz kaum, darum findet man manche Pfähle bis heute.']],
      ['topf', 'Der Kochtopf', ['Aus Funden in den Dörfern weiß man, was die Menschen kochten und aßen.']],
      ['kuh', 'Die Kuh', ['Die Menschen der Pfahlbauten hielten schon Haustiere und bauten Getreide an.']],
    ]),
    era('roemer_zeit', '15 v. Chr. bis um 400', 'Römer', 'Die Römer kommen an den See und nennen ihn nach Bregenz: lacus Brigantinus.', 'geschichte', [
      'Im Jahr 15 vor Christus kamen die Römer an den See. Aus Bregenz machten sie die Stadt Brigantium.',
      'In Arbon und Konstanz bauten sie um das Jahr 300 Festungen.',
    ], [
      ['roemerschiff', 'Die Schlacht auf dem See', ['Ein alter Geschichtsschreiber erzählt von einer Schlacht auf dem See. Ein anderer erwähnt nur, dass Tiberius mit Schiffen übersetzte.', 'Was wirklich geschah, weiß man nicht genau.']],
      ['legionaer', 'Der römische Soldat', ['Soldaten wie er bewachten die römischen Festungen am See, zum Beispiel Arbor Felix in Arbon.']],
      ['roemerhaus', 'Brigantium', ['Die Römer nannten den See „lacus Brigantinus“, den See von Bregenz.', 'Brigantium wurde ein wichtiges Handels- und Verkehrszentrum.']],
    ]),
    era('mittelalter', '724 bis 1418', 'Mittelalter', 'Klöster, Burgen und große Segelschiffe. Und einmal traf sich ganz Europa in Konstanz.', 'geschichte', [
      'Auf der Reichenau wurde 724 ein Kloster gegründet.',
      'Dreieinhalb Jahre lang trafen sich in Konstanz Fürsten und Bischöfe aus ganz Europa. Im Haus am Hafen wählten sie 1417 sogar einen Papst.',
    ], [
      ['moench', 'Die Mönche der Reichenau', ['Auf der Reichenau wurde 724 ein Kloster gegründet. Seine alten Kirchen mit Wandmalereien stehen noch heute.']],
      ['laedine', 'Die Lädine', ['Vom Mittelalter bis ins 19. Jahrhundert brachten diese großen Frachtsegler Getreide, Salz und Wein über den See.']],
      ['ritterburg', 'Die Burgen', ['Die Sage sagt, König Dagobert habe den Turm der Meersburg im Jahr 630 gebaut. Sicher belegt ist die Burg erst viel später.']],
      ['konzil_stadt', 'Das Konzil', ['Von 1414 bis 1418 war Konstanz der Treffpunkt Europas.', 'Zeitweise waren mehr Gäste in der Stadt, als sie Einwohner hatte.']],
    ]),
    era('neuzeit', '1824 bis 1900', 'Dampf und Luftschiffe', 'Die ersten Dampfschiffe fahren, und über dem See steigt ein Luftschiff auf.', 'geschichte', [
      '1824 fuhr das erste Dampfschiff über den See. Es hieß Wilhelm und verband Friedrichshafen mit Rorschach.',
      'Am 2. Juli 1900 stieg über dem Bodensee das erste Zeppelin-Luftschiff auf.',
    ], [
      ['raddampfer', 'Die Jura', ['Die Jura war ein Raddampfer aus Holz, gebaut 1854.', 'Am 12. Februar 1864 stieß sie im dichten Nebel mit der Stadt Zürich zusammen. In nur vier Minuten sank sie. Du kannst ihr Wrack im Tauchgang besuchen.']],
      ['zeppelin_lz1', 'LZ 1', ['Das erste Zeppelin-Luftschiff war 128 Meter lang und flog 18 Minuten.']],
    ]),
    era('heute', 'heute', 'Der See von heute', 'Rund fünf Millionen Menschen trinken sein Wasser. Und 1963 fror er sogar ganz zu.', 'erde', [
      'Der Wasserstand des Sees steigt und fällt über das Jahr um mehr als einen Meter.',
      'Der Rhein füllt den See langsam mit Sand. In vielen zehntausend Jahren wäre der Obersee voll.',
    ], [
      ['segelboot', 'Sturmwarnung', ['Blinkt am Ufer ein oranges Licht, kommt Wind. Dann gehen die Segler schnell in den Hafen.']],
      ['faehre', 'Die Fähre', ['Von Romanshorn fährt die Autofähre 14 Kilometer quer über den See nach Friedrichshafen.']],
      ['seegfroerne_1963', 'Die Seegfrörne', ['1963 fror der ganze See zu. Es war das bisher letzte Mal.', 'Die Menschen liefen, radelten und fuhren sogar mit dem Auto über das Eis.'], 'geschichte'],
      ['trinkwasser', 'Wasser für Millionen', ['Rund fünf Millionen Menschen trinken Wasser aus dem Bodensee.']],
    ]),
  ];

  // ------------------------------------------------------------------ Funde beim Tauchen: x in Welt-Einheiten des Tauchgangs
  const sea = (id, x, title, facts) => {
    BE.def({ id: `see-${id}`, cat: 'see', title, facts });
    return { id: `see-${id}`, x, title, say: facts[0] };
  };
  BE.seaFinds = [
    sea('armleuchter', 760, 'Armleuchteralgen', ['Armleuchteralgen sehen aus wie kleine Kerzenleuchter. Dass sie zurück sind, zeigt: Das Wasser ist wieder sauberer.', 'Sie wachsen auf dem Grund bis in rund 15 Meter Tiefe, so weit das Licht reicht.']),
    sea('stichling', 1780, 'Der Stichling', ['Der winzige Stichling ist nur so lang wie dein Finger. Lange waren im offenen Obersee fast alle Fische Stichlinge. Seit 2024 sind es plötzlich viel weniger, und niemand weiß genau, warum.', 'Er frisst auch die Eier der Blaufelchen. Woher er genau kam, weiß niemand sicher.']),
    sea('quagga', 2850, 'Die Quagga-Muschel', ['Die kleine Quagga-Muschel kam 2016 als blinder Passagier aus der Gegend des Schwarzen Meers. Heute sitzt sie überall im Obersee, sogar tief unten.', 'Sie verstopft die Rohre der Wasserwerke, das Trinkwasser bleibt aber einwandfrei.']),
    sea('aal', 3920, 'Der Aal', ['Früher schlängelten sich junge Aale aus dem Meer bis hierher. Heute versperren Kraftwerke den Weg, darum setzen Menschen sie ein.']),
    sea('saibling', 5250, 'Der Seesaibling', ['Der Seesaibling, hier auch Rötel genannt, liebt kaltes Wasser.']),
    sea('arten', 5850, 'Rund 30 Fischarten', ['Im Bodensee leben rund 30 Fischarten. Die Felchen legen Ende November innerhalb weniger Tage ihre Eier.']),
    sea('bewuchs', 6640, 'Das geschützte Wrack', ['Das Wrack der Jura steht unter Schutz, und man darf nichts mitnehmen. Es liegt fast 40 Meter tief.', '1953 fand ein Taucher es zufällig. Danach geriet es in Vergessenheit, bis es 1976 wiederentdeckt wurde.']),
  ];
})();
