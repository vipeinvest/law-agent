/* Die große Österreich-Expedition – Inhalte (Orte, Rohstoffe, Wahrzeichen, Wissensfragen).
 * Stufen: 1 = 2.–3. Klasse, 2 = 4. Klasse, 3 = 5.–6. Klasse.
 * Bereiche wie im Lehrplan Sachunterricht: geo, hist, sozial (Gemeinschaft/Staat), wirt, natur, technik. */
(() => {
  'use strict';

  const STATES = {
    W: { name: 'Wien', capital: 'Wien', color: '#f2b8a8', label: [16.37, 48.26] },
    N: { name: 'Niederösterreich', capital: 'St. Pölten', color: '#bcd7f0', label: [15.75, 48.5] },
    O: { name: 'Oberösterreich', capital: 'Linz', color: '#f6d9a6', label: [13.95, 48.2] },
    S: { name: 'Salzburg', capital: 'Salzburg', color: '#f3e59c', label: [13.15, 47.35] },
    T: { name: 'Tirol', capital: 'Innsbruck', color: '#bfe6dc', label: [11.2, 47.15] },
    V: { name: 'Vorarlberg', capital: 'Bregenz', color: '#e3c6a8', label: [9.92, 47.25] },
    K: { name: 'Kärnten', capital: 'Klagenfurt', color: '#cfe8b4', label: [13.9, 46.8] },
    ST: { name: 'Steiermark', capital: 'Graz', color: '#b9dfb0', label: [14.9, 47.3] },
    B: { name: 'Burgenland', capital: 'Eisenstadt', color: '#f4c4c9', label: [16.42, 47.42] },
  };

  const COUNTRIES = {
    AT: { name: 'Österreich', capital: 'Wien' },
    DE: { name: 'Deutschland', capital: 'Berlin', dir: 'Nordwesten', color: '#e9e2c4', label: [11.6, 48.6] },
    CZ: { name: 'Tschechien', capital: 'Prag', dir: 'Norden', color: '#e2d6ec', label: [15.3, 49.35] },
    SK: { name: 'Slowakei', capital: 'Bratislava', dir: 'Osten', color: '#d3e3ee', label: [17.9, 48.6] },
    HU: { name: 'Ungarn', capital: 'Budapest', dir: 'Osten', color: '#efe3bd', label: [17.6, 47.3] },
    SI: { name: 'Slowenien', capital: 'Ljubljana', dir: 'Süden', color: '#d5ead0', label: [14.9, 46.15] },
    IT: { name: 'Italien', capital: 'Rom', dir: 'Süden', color: '#eed3cf', label: [11.9, 46.25] },
    CH: { name: 'Schweiz', capital: 'Bern', dir: 'Westen', color: '#f0cfcf', label: [8.7, 46.9] },
    LI: { name: 'Liechtenstein', capital: 'Vaduz', dir: 'Westen', color: '#c9c4ee', label: null },
    HR: { name: 'Kroatien', color: '#e6e6e6', label: [16.6, 45.75] },
    FR: { name: 'Frankreich', color: '#e6e6e6', label: null },
    PL: { name: 'Polen', color: '#e6e6e6', label: null },
  };

  // Rohstoffe: wo es sie in Österreich wirklich gibt.
  const RES = {
    holz: { name: 'Holz', color: '#8a5a2b', verb: 'Holz fällen', fact: 'Fast die Hälfte von Österreich ist mit Wald bedeckt.' },
    stein: { name: 'Stein', color: '#9a9a94', verb: 'Stein brechen', fact: 'Granit, Kalk und Marmor werden in Steinbrüchen aus dem Berg gebrochen.' },
    lehm: { name: 'Lehm', color: '#c26a3e', verb: 'Lehm stechen', fact: 'Aus Lehm werden Ziegel gebrannt. Halb Wien ist aus Ziegeln vom Wienerberg gebaut.' },
    eisen: { name: 'Eisen', color: '#6d7b8a', verb: 'Erz abbauen', fact: 'Aus Eisenerz wird im Hochofen Eisen geschmolzen. Daraus macht man Stahl.' },
    salz: { name: 'Salz', color: '#f4f4f0', verb: 'Salz abbauen', fact: 'Salz war früher so wertvoll, dass man es „weißes Gold“ nannte.' },
    korn: { name: 'Getreide', color: '#e2b93b', verb: 'Getreide ernten', fact: 'Im flachen Osten liegen die großen Getreidefelder. Aus dem Korn wird Mehl für Brot.' },
  };

  // [Rohstoff, Länge, Breite, Ortsname]
  const NODES = [
    ['holz', 16.05, 48.17, 'Wienerwald'], ['holz', 15.25, 48.62, 'Waldviertel'], ['holz', 13.95, 48.62, 'Böhmerwald'],
    ['holz', 9.95, 47.38, 'Bregenzerwald'], ['holz', 15.3, 47.55, 'Obersteiermark'], ['holz', 14.2, 46.95, 'Gurktal'], ['holz', 11.75, 47.5, 'Achental'],
    ['holz', 13.35, 47.95, 'Kobernaußerwald'],
    ['stein', 14.55, 48.42, 'Mühlviertel (Granit)'], ['stein', 15.0, 48.68, 'Waldviertel (Granit)'], ['stein', 12.98, 47.72, 'Untersberg (Marmor)'],
    ['stein', 11.3, 47.38, 'Karwendel (Kalk)'], ['stein', 13.75, 46.67, 'Krastal (Marmor)'], ['stein', 16.62, 47.8, 'St. Margarethen (Kalksandstein)'],
    ['stein', 15.2, 47.22, 'Gleinalm'], ['stein', 9.85, 47.22, 'Montafon'],
    ['lehm', 16.37, 48.12, 'Wienerberg'], ['lehm', 13.9, 48.15, 'Alpenvorland'], ['lehm', 15.55, 46.8, 'Leibnitzer Feld'], ['lehm', 16.45, 47.55, 'Mittelburgenland'],
    ['lehm', 15.75, 48.1, 'Traisental'],
    ['eisen', 15.02, 47.46, 'Erzberg'], ['eisen', 14.55, 46.94, 'Hüttenberg'],
    ['salz', 13.76, 47.64, 'Altaussee'], ['salz', 13.09, 47.67, 'Dürrnberg bei Hallein'], ['salz', 11.51, 47.28, 'Hall in Tirol'],
    ['korn', 16.65, 48.3, 'Marchfeld'], ['korn', 16.2, 48.6, 'Weinviertel'], ['korn', 15.9, 48.33, 'Tullnerfeld'], ['korn', 14.0, 48.03, 'Traun-Enns-Platte'],
    ['korn', 16.9, 47.75, 'Seewinkel'], ['korn', 9.68, 47.38, 'Rheintal'],
  ];

  // Wahrzeichen der neun Landeshauptstädte als Block-Bilder. Zeichen: siehe PALETTE.
  const PALETTE = {
    S: '#cfc8b8', s: '#a59d8c', D: '#7d7667', R: '#c0392b', r: '#8e2a20', W: '#f6f1e4', w: '#3b4a5a', G: '#f2c230', g: '#4f9a4a',
    B: '#8a5a2b', b: '#5d3b1a', Y: '#f1dc7a', K: '#2b2b2b', T: '#3f8f8a', L: '#6fb3d9', O: '#e08a2e', P: '#f3d6c2', E: '#6d7b8a',
  };
  const BUILDS = {
    W: {
      name: 'Stephansdom', city: 'Wien', need: { stein: 4, lehm: 2, holz: 2 },
      why: 'Der Stein für den Dom kam aus dem Steinbruch von St. Margarethen im Burgenland.',
      art: ['.....K......', '.....s......', '.....s......', '....sSs.....', '....sSs.....', '....sSs.....', '....sSs.GTGT', '....sSsGTGTG', '...ssSsTGTGT', '...sSSsSSSSS', '...sSwsSwSwS', '...sSSsSSSSS', '...sSwsSwSwS', '...sSSsSSKSS'],
    },
    N: {
      name: 'Dom zu St. Pölten', city: 'St. Pölten', need: { lehm: 2, holz: 2, korn: 2 },
      why: 'Im Alpenvorland gibt es viel Lehm für Ziegel und fruchtbare Felder.',
      art: ['............', '....G.......', '....E.......', '...EEE......', '...EEE......', '...WWW......', '...WwW......', '...WWW.RRRRR', '...WwWRRRRRR', '...WWWWWWWWW', '...WwWWwWWwW', '...WWWWWWWWW', '...WwWWwWWwW', '...WWWWWKWWW'],
    },
    O: {
      name: 'Pöstlingbergkirche', city: 'Linz', need: { stein: 2, eisen: 2, lehm: 2 },
      why: 'Linz ist die Stahlstadt: Hier wird aus Eisenerz vom Erzberg Stahl gemacht.',
      art: ['............', '..G......G..', '..E......E..', '.EEE....EEE.', '.EEE....EEE.', '.YYY....YYY.', '.YwY.RR.YwY.', '.YYYRRRRYYY.', '.YwYYYYYYwY.', '.YYYYwwYYYY.', '.YwYYYYYYwY.', '.YYYYKKYYYY.', 'gggggggggggg', 'gggggggggggg'],
    },
    S: {
      name: 'Festung Hohensalzburg', city: 'Salzburg', need: { stein: 4, salz: 2, holz: 2 },
      why: 'Der Salzhandel machte Salzburg reich. Daher hat die Stadt ihren Namen.',
      art: ['............', '.....RR.....', '.....WW.....', '..R..WW..R..', '..W.WWWW.W..', '.WWWWwWWWWW.', '.WwWWWWWWwW.', '.WWWWwWWWWW.', 'WWWWWWWWWWWW', 'sDsDsDsDsDsD', 'DsDsDsDsDsDs', 'gDsDsDsDsDsg', 'ggDsDsDsDsgg', 'gggggggggggg'],
    },
    T: {
      name: 'Goldenes Dachl', city: 'Innsbruck', need: { holz: 2, stein: 2, salz: 2 },
      why: 'Das Salz aus Hall und das Silber aus Schwaz machten Tirol einst sehr reich.',
      art: ['............', 'WWWWWWWWWWWW', 'WwWWWWWWWWwW', 'WWWGGGGGGWWW', 'WWGGGGGGGGWW', 'WGGGGGGGGGGW', 'WWPPPPPPPPWW', 'WWPwPwwPwPWW', 'WWPPPPPPPPWW', 'WWWRWRRWRWWW', 'WwWWWWWWWWwW', 'WWWWsKKsWWWW', 'WwWWsKKsWWwW', 'WWWWsKKsWWWW'],
    },
    V: {
      name: 'Seebühne Bregenz', city: 'Bregenz', need: { holz: 4, eisen: 2, korn: 2 },
      why: 'Die Seebühne steht auf Pfählen im Bodensee. Dafür braucht man viel Holz und Stahl.',
      art: ['............', '....OOOO....', '...OYYYYO...', '..OYYOOYYO..', '..OYOKKOYO..', '..OYYOOYYO..', '...OYYYYO...', '....OEEO....', '.....EE.....', 'BBBBBBBBBBBB', 'bBbBbBbBbBbB', 'LbLLbLLbLLbL', 'LLLLLLLLLLLL', 'LLLLLLLLLLLL'],
    },
    K: {
      name: 'Lindwurmbrunnen', city: 'Klagenfurt', need: { stein: 4, eisen: 2 },
      why: 'Der Lindwurm wurde aus einem einzigen großen Steinblock gehauen.',
      art: ['............', '........gg..', '.......gggK.', '..g....ggggR', '.ggg..gggg..', 'ggggggggg...', '.gggggggg...', '..gggggggg..', '..gg.g..gg..', '..g..g...g..', 'ssssssssssss', 'sLLLLLLLLLLs', 'sLLLLLLLLLLs', 'DDDDDDDDDDDD'],
    },
    ST: {
      name: 'Grazer Uhrturm', city: 'Graz', need: { stein: 2, holz: 2, eisen: 2 },
      why: 'Beim Uhrturm sind die Zeiger vertauscht: Der große zeigt die Stunden.',
      art: ['.....G......', '.....E......', '....RRR.....', '...RRRRR....', '..RRRRRRR...', '.BBBBBBBBB..', '.bWWWWWWWb..', '..WWKKKWW...', '..WKWKWKW...', '..WKWWKKW...', '..WWKKKWW...', '..WWWWWWW...', '..WWWKWWW...', 'gggggggggggg'],
    },
    B: {
      name: 'Schloss Esterházy', city: 'Eisenstadt', need: { stein: 2, lehm: 2, korn: 2 },
      why: 'Im sonnigen Burgenland wächst viel Getreide. Im Schloss spielte Joseph Haydn Musik.',
      art: ['............', '............', 'R..........R', 'RR........RR', 'YY.RRRRRR.YY', 'YYRRRRRRRRYY', 'YYYYYYYYYYYY', 'YwYwYwwYwYwY', 'YYYYYYYYYYYY', 'YwYwYwwYwYwY', 'YYYYYYYYYYYY', 'YwYwYKKYwYwY', 'YYYYYKKYYYYY', 'gggggggggggg'],
    },
  };

  // Orte: [id, Art, Länge, Breite, Titel, Bereich, Fakten]. Art: stadt (Landeshauptstadt), ort, natur, zeit (Geschichte), nachbar.
  const PLACES = [
    { id: 'wien', kind: 'stadt', st: 'W', lon: 16.37, lat: 48.21, title: 'Wien', area: 'sozial', facts: [
      'Wien ist die Hauptstadt von Österreich und gleichzeitig ein eigenes Bundesland.',
      'Hier arbeiten der Bundespräsident, die Regierung und das Parlament.',
      'In Wien leben rund 2 Millionen Menschen. Das ist mehr als jeder fünfte Mensch in Österreich.',
    ] },
    { id: 'stpoelten', kind: 'stadt', st: 'N', lon: 15.63, lat: 48.2, title: 'St. Pölten', area: 'geo', facts: [
      'St. Pölten ist die Landeshauptstadt von Niederösterreich – aber erst seit 1986. Davor wurde das Land von Wien aus verwaltet.',
      'Niederösterreich ist das größte Bundesland. Es hat vier Viertel: Weinviertel, Waldviertel, Mostviertel und Industrieviertel.',
      'Die Stadt liegt am Fluss Traisen.',
    ] },
    { id: 'linz', kind: 'stadt', st: 'O', lon: 14.29, lat: 48.31, title: 'Linz', area: 'wirt', facts: [
      'Linz ist die Landeshauptstadt von Oberösterreich und liegt an der Donau.',
      'Linz ist die „Stahlstadt“: In einem riesigen Werk wird aus Eisenerz Stahl gemacht.',
      'Die Linzer Torte gilt als eines der ältesten bekannten Tortenrezepte der Welt.',
    ] },
    { id: 'salzburg', kind: 'stadt', st: 'S', lon: 13.04, lat: 47.8, title: 'Salzburg', area: 'hist', facts: [
      'Salzburg ist Landeshauptstadt des gleichnamigen Bundeslandes und liegt an der Salzach.',
      'Der Komponist Wolfgang Amadeus Mozart wurde hier 1756 geboren.',
      'Hoch über der Stadt steht die Festung Hohensalzburg, eine der größten erhaltenen Burgen Europas.',
    ] },
    { id: 'innsbruck', kind: 'stadt', st: 'T', lon: 11.39, lat: 47.27, title: 'Innsbruck', area: 'geo', facts: [
      'Innsbruck ist die Landeshauptstadt von Tirol. Der Name bedeutet „Brücke über den Inn“.',
      'Die Stadt liegt mitten in den Alpen, zwischen hohen Bergen.',
      'Hier fanden zweimal Olympische Winterspiele statt: 1964 und 1976.',
    ] },
    { id: 'bregenz', kind: 'stadt', st: 'V', lon: 9.75, lat: 47.5, title: 'Bregenz', area: 'geo', facts: [
      'Bregenz ist die Landeshauptstadt von Vorarlberg, dem westlichsten Bundesland.',
      'Die Stadt liegt am Bodensee, am Fuß des Berges Pfänder.',
      'Jeden Sommer wird auf der Seebühne Theater mit Musik gespielt – auf einer Bühne im Wasser.',
    ] },
    { id: 'klagenfurt', kind: 'stadt', st: 'K', lon: 14.31, lat: 46.62, title: 'Klagenfurt', area: 'geo', facts: [
      'Klagenfurt am Wörthersee ist die Landeshauptstadt von Kärnten, dem südlichsten Bundesland.',
      'Das Wahrzeichen ist der Lindwurm, ein Drache aus Stein. Eine Sage erzählt, dass er einst im Sumpf hauste.',
      'Kärnten ist das Land der Seen: Es gibt dort über 1000 Seen.',
    ] },
    { id: 'graz', kind: 'stadt', st: 'ST', lon: 15.44, lat: 47.07, title: 'Graz', area: 'geo', facts: [
      'Graz ist die Landeshauptstadt der Steiermark und die zweitgrößte Stadt Österreichs.',
      'Die Stadt liegt an der Mur. Auf dem Schlossberg steht der Uhrturm.',
      'Die Steiermark heißt auch „grünes Herz Österreichs“, weil es dort so viel Wald gibt.',
    ] },
    { id: 'eisenstadt', kind: 'stadt', st: 'B', lon: 16.52, lat: 47.85, title: 'Eisenstadt', area: 'hist', facts: [
      'Eisenstadt ist die Landeshauptstadt des Burgenlandes und die kleinste aller Landeshauptstädte.',
      'Das Burgenland ist das jüngste Bundesland: Es gehört erst seit 1921 zu Österreich.',
      'Im Schloss Esterházy arbeitete der Komponist Joseph Haydn viele Jahre lang.',
    ] },

    { id: 'glockner', kind: 'natur', lon: 12.69, lat: 47.07, title: 'Großglockner', area: 'geo', facts: [
      'Der Großglockner ist mit 3.798 Metern der höchste Berg Österreichs.',
      'Er steht in den Hohen Tauern, an der Grenze zwischen Kärnten und Tirol.',
      'An seinem Fuß liegt die Pasterze, der größte Gletscher Österreichs. Sie schmilzt jedes Jahr ein Stück.',
    ] },
    { id: 'neusiedl', kind: 'natur', lon: 16.84, lat: 47.86, title: 'Neusiedler See', area: 'natur', facts: [
      'Der Neusiedler See ist der größte See Österreichs. Ein Teil gehört zu Ungarn.',
      'Er ist ein Steppensee und sehr flach: An den meisten Stellen kann ein Erwachsener stehen.',
      'Im breiten Schilfgürtel brüten viele Vögel. In Rust nisten Störche auf den Dächern.',
    ] },
    { id: 'bodensee', kind: 'natur', lon: 9.62, lat: 47.53, title: 'Bodensee', area: 'geo', facts: [
      'Am Bodensee treffen drei Länder zusammen: Österreich, Deutschland und die Schweiz.',
      'Der Rhein fließt in den See hinein und im Westen wieder hinaus.',
      'An seiner tiefsten Stelle ist der Bodensee 251 Meter tief.',
    ] },
    { id: 'hallstatt', kind: 'zeit', lon: 13.65, lat: 47.56, title: 'Hallstatt', area: 'hist', facts: [
      'In Hallstatt wird seit rund 7000 Jahren Salz abgebaut. Es ist eines der ältesten Salzbergwerke der Welt.',
      'Die Funde von hier sind so berühmt, dass eine ganze Zeit danach benannt ist: die Hallstattzeit vor etwa 2800 bis 2450 Jahren.',
      'Der Ort gehört zum Welterbe der UNESCO.',
    ] },
    { id: 'erzberg', kind: 'ort', lon: 14.91, lat: 47.53, title: 'Erzberg', area: 'wirt', facts: [
      'Am Erzberg in der Steiermark wird seit über 1000 Jahren Eisenerz abgebaut.',
      'Der Berg sieht aus wie eine Stufenpyramide, weil das Erz in Stufen abgetragen wird.',
      'Das Erz kommt mit dem Zug nach Linz und Leoben. Dort wird daraus Stahl gemacht.',
    ] },
    { id: 'wachau', kind: 'natur', lon: 15.41, lat: 48.36, title: 'Wachau', area: 'geo', facts: [
      'Die Wachau ist das Tal der Donau zwischen Melk und Krems.',
      'An den steilen Hängen wachsen Wein und Marillen auf Terrassen.',
      'In der Burg Dürnstein war vor über 800 Jahren der englische König Richard Löwenherz gefangen.',
    ] },
    { id: 'carnuntum', kind: 'zeit', lon: 16.86, lat: 48.11, title: 'Carnuntum', area: 'hist', facts: [
      'Carnuntum war vor rund 1800 Jahren eine große Stadt der Römer mit etwa 50.000 Menschen.',
      'Die Donau war damals die Grenze des Römischen Reiches.',
      'Die Römer brachten Straßen, Steinhäuser, Bäder und den Weinbau ins Land.',
    ] },
    { id: 'krimml', kind: 'natur', lon: 12.17, lat: 47.21, title: 'Krimmler Wasserfälle', area: 'natur', facts: [
      'Die Krimmler Wasserfälle sind die höchsten Wasserfälle Österreichs.',
      'Das Wasser stürzt in drei Stufen insgesamt 380 Meter in die Tiefe.',
      'Das Wasser kommt von den Gletschern. Im Sommer, wenn viel Eis schmilzt, ist der Wasserfall am stärksten.',
    ] },
    { id: 'dachstein', kind: 'natur', lon: 13.62, lat: 47.45, title: 'Dachstein', area: 'natur', facts: [
      'Der Dachstein ist 2.995 Meter hoch. Über ihn läuft die Grenze zwischen Oberösterreich und der Steiermark.',
      'Im Berg gibt es riesige Höhlen, in denen das ganze Jahr Eis liegt.',
      'Ganz oben liegen Gletscher. Gletscher entstehen aus Schnee, der viele Jahre lang zusammengepresst wird.',
    ] },
    { id: 'osterwitz', kind: 'zeit', lon: 14.45, lat: 46.76, title: 'Burg Hochosterwitz', area: 'hist', facts: [
      'Die Burg Hochosterwitz in Kärnten steht auf einem steilen Felsen, hoch über dem Tal.',
      'Wer hinauf will, muss durch 14 Tore gehen. So konnte die Burg nie erobert werden.',
      'Im Mittelalter schützten Burgen die Menschen vor Feinden.',
    ] },
    { id: 'semmering', kind: 'ort', lon: 15.83, lat: 47.63, title: 'Semmeringbahn', area: 'technik', facts: [
      'Die Semmeringbahn wurde 1854 eröffnet. Sie war die erste Gebirgsbahn Europas für große Züge.',
      'Der Ingenieur Carl von Ghega plante sie mit vielen Tunneln und hohen Brücken, den Viadukten.',
      'Die Bahn gehört zum Welterbe der UNESCO und fährt noch heute.',
    ] },
    { id: 'kaprun', kind: 'ort', lon: 12.72, lat: 47.2, title: 'Stauseen von Kaprun', area: 'technik', facts: [
      'Hoch in den Bergen bei Kaprun halten Staumauern das Wasser in großen Stauseen zurück.',
      'Fließt das Wasser durch Rohre ins Tal, treibt es Turbinen an. Die erzeugen Strom.',
      'Mehr als die Hälfte des Stroms in Österreich kommt aus Wasserkraft.',
    ] },
    { id: 'auen', kind: 'natur', lon: 16.7, lat: 48.14, title: 'Nationalpark Donau-Auen', area: 'natur', facts: [
      'Zwischen Wien und Bratislava darf die Donau noch frei fließen. Rundherum liegt ein Auwald.',
      'Ein Auwald wird regelmäßig überschwemmt. Dort leben Biber, Seeadler und Eisvögel.',
      'In einem Nationalpark wird die Natur besonders geschützt. Österreich hat sechs Nationalparks.',
    ] },
    { id: 'woerthersee', kind: 'natur', lon: 14.04, lat: 46.61, title: 'Wörthersee', area: 'natur', facts: [
      'Der Wörthersee ist der größte See Kärntens.',
      'Im Sommer wird das Wasser sehr warm. Darum kommen viele Urlaubsgäste zum Baden.',
      'Der Tourismus ist in Österreich ein wichtiger Teil der Wirtschaft: Viele Menschen arbeiten in Hotels und Gasthäusern.',
    ] },
    { id: 'arlberg', kind: 'ort', lon: 10.21, lat: 47.13, title: 'Arlberg', area: 'technik', facts: [
      'Der Arlberg ist ein Pass zwischen Tirol und Vorarlberg. Daher kommt der Name „Vor-Arlberg“.',
      'Unter dem Berg führt der längste Straßentunnel Österreichs durch: Er ist fast 14 Kilometer lang.',
      'Am Arlberg lernten schon vor über 100 Jahren viele Menschen das Skifahren.',
    ] },
    { id: 'eisriesen', kind: 'natur', lon: 13.19, lat: 47.5, title: 'Eisriesenwelt', area: 'natur', facts: [
      'Die Eisriesenwelt bei Werfen ist die größte Eishöhle der Erde.',
      'Die Höhle ist über 40 Kilometer lang. Im vorderen Teil stehen Figuren aus Eis.',
      'Kalte Winterluft strömt in die Höhle und lässt das Tropfwasser gefrieren.',
    ] },
    { id: 'brenner', kind: 'ort', lon: 11.51, lat: 47.0, title: 'Brennerpass', area: 'wirt', facts: [
      'Der Brenner ist einer der wichtigsten Übergänge über die Alpen. Er verbindet Österreich mit Italien.',
      'Jeden Tag fahren hier Tausende Lastwagen und viele Züge durch.',
      'Unter dem Pass wird ein Tunnel für die Eisenbahn gebaut, damit mehr Waren mit dem Zug fahren.',
    ] },
    { id: 'lienz', kind: 'ort', lon: 12.77, lat: 46.83, title: 'Lienz in Osttirol', area: 'hist', facts: [
      'Osttirol gehört zu Tirol, ist aber nicht mit dem Rest von Tirol verbunden.',
      'Dazwischen liegt Südtirol. Es gehört seit dem Ende des Ersten Weltkriegs zu Italien.',
      'Lienz liegt an der Drau und hat besonders viele Sonnentage.',
    ] },
    { id: 'riegersburg', kind: 'zeit', lon: 15.93, lat: 47.0, title: 'Riegersburg', area: 'natur', facts: [
      'Die Riegersburg steht auf einem Felsen aus erkalteter Lava. Hier gab es vor Millionen Jahren Vulkane.',
      'Der Boden im steirischen Vulkanland ist sehr fruchtbar.',
      'Hier wachsen Äpfel und Kürbisse. Aus den Kürbiskernen wird das dunkelgrüne Kernöl gepresst.',
    ] },
    { id: 'blockheide', kind: 'natur', lon: 14.98, lat: 48.77, title: 'Blockheide', area: 'natur', facts: [
      'In der Blockheide im Waldviertel liegen riesige runde Felsen aus Granit.',
      'Manche heißen „Wackelsteine“: Sie sind tonnenschwer und lassen sich trotzdem bewegen.',
      'Das Granit- und Gneishochland im Norden ist die älteste Landschaft Österreichs.',
    ] },

    { id: 'n-de', kind: 'nachbar', c: 'DE', lon: 13.42, lat: 48.6, title: 'Deutschland', area: 'geo', facts: [
      'Deutschland ist das größte Nachbarland. Die Hauptstadt ist Berlin.',
      'Mit Deutschland hat Österreich die längste gemeinsame Grenze.',
      'In beiden Ländern spricht man Deutsch und bezahlt mit dem Euro.',
    ] },
    { id: 'n-cz', kind: 'nachbar', c: 'CZ', lon: 14.5, lat: 48.8, title: 'Tschechien', area: 'geo', facts: [
      'Tschechien liegt im Norden. Die Hauptstadt ist Prag.',
      'Durch Prag fließt die Moldau. Man spricht Tschechisch.',
      'Bezahlt wird nicht mit dem Euro, sondern mit der Tschechischen Krone.',
    ] },
    { id: 'n-sk', kind: 'nachbar', c: 'SK', lon: 17.11, lat: 48.15, title: 'Slowakei', area: 'geo', facts: [
      'Die Slowakei liegt im Osten. Die Hauptstadt Bratislava liegt direkt an der Grenze.',
      'Wien und Bratislava sind nur etwa 55 Kilometer voneinander entfernt. Beide liegen an der Donau.',
      'Die Slowakei gibt es als eigenen Staat seit 1993. Man spricht Slowakisch.',
    ] },
    { id: 'n-hu', kind: 'nachbar', c: 'HU', lon: 16.75, lat: 47.66, title: 'Ungarn', area: 'geo', facts: [
      'Ungarn liegt im Osten. Die Hauptstadt ist Budapest und liegt an der Donau.',
      'Das Land ist sehr flach. Die weite Ebene heißt Puszta.',
      'Man spricht Ungarisch und bezahlt mit dem Forint.',
    ] },
    { id: 'n-si', kind: 'nachbar', c: 'SI', lon: 15.62, lat: 46.6, title: 'Slowenien', area: 'geo', facts: [
      'Slowenien liegt im Süden. Die Hauptstadt ist Ljubljana.',
      'Das Land ist klein, hat aber hohe Berge und ein kurzes Stück Meeresküste.',
      'Slowenien ist seit 1991 ein eigener Staat. Man spricht Slowenisch.',
    ] },
    { id: 'n-it', kind: 'nachbar', c: 'IT', lon: 11.45, lat: 46.88, title: 'Italien', area: 'geo', facts: [
      'Italien liegt im Süden. Die Hauptstadt ist Rom.',
      'Auf der Landkarte sieht Italien aus wie ein Stiefel.',
      'Gleich hinter der Grenze liegt Südtirol. Dort sprechen viele Menschen Deutsch.',
    ] },
    { id: 'n-ch', kind: 'nachbar', c: 'CH', lon: 9.42, lat: 47.3, title: 'Schweiz', area: 'geo', facts: [
      'Die Schweiz liegt im Westen. Die Hauptstadt ist Bern – nicht Zürich, wie viele glauben.',
      'In der Schweiz gibt es vier Landessprachen: Deutsch, Französisch, Italienisch und Rätoromanisch.',
      'Die Schweiz gehört nicht zur Europäischen Union. Bezahlt wird mit dem Schweizer Franken.',
    ] },
    { id: 'n-li', kind: 'nachbar', c: 'LI', lon: 9.52, lat: 47.14, title: 'Liechtenstein', area: 'geo', facts: [
      'Liechtenstein ist das kleinste Nachbarland. Die Hauptstadt ist Vaduz.',
      'Im ganzen Land leben nur etwa 40.000 Menschen – so viele wie in einer kleinen Stadt.',
      'Liechtenstein ist ein Fürstentum: An der Spitze steht ein Fürst.',
    ] },
  ];

  // Flüsse und Seen (grob nachgezeichnet, für die Spielkarte).
  const RIVERS = [
    { name: 'Donau', w: 7, pts: [[11.9, 48.95], [12.6, 48.88], [13.47, 48.57], [13.85, 48.5], [14.29, 48.31], [14.52, 48.24], [15.08, 48.18], [15.33, 48.23], [15.6, 48.4], [16.05, 48.33], [16.4, 48.22], [16.95, 48.15], [17.11, 48.14], [17.8, 47.75], [18.9, 47.8]] },
    { name: 'Inn', w: 4, pts: [[10.1, 46.75], [10.57, 47.14], [10.9, 47.23], [11.4, 47.27], [11.85, 47.4], [12.17, 47.58], [12.13, 47.86], [12.6, 48.2], [13.03, 48.26], [13.47, 48.57]] },
    { name: 'Salzach', w: 3, pts: [[12.17, 47.24], [12.75, 47.29], [13.2, 47.4], [13.13, 47.6], [13.04, 47.8], [12.93, 48.12], [12.95, 48.21]] },
    { name: 'Enns', w: 3, pts: [[13.45, 47.38], [13.69, 47.39], [14.24, 47.57], [14.75, 47.6], [14.55, 47.85], [14.42, 48.04], [14.5, 48.23]] },
    { name: 'Mur', w: 3.5, pts: [[13.6, 47.1], [14.17, 47.11], [14.66, 47.17], [15.09, 47.38], [15.27, 47.41], [15.4, 47.2], [15.44, 47.07], [15.63, 46.7], [15.99, 46.69], [16.6, 46.5]] },
    { name: 'Drau', w: 3.5, pts: [[12.3, 46.74], [12.77, 46.83], [13.5, 46.8], [13.85, 46.61], [14.63, 46.65], [14.94, 46.64], [15.65, 46.56], [16.8, 46.3]] },
    { name: 'Rhein', w: 4, pts: [[9.3, 46.6], [9.53, 46.85], [9.5, 47.1], [9.58, 47.3], [9.62, 47.49]] },
    { name: 'March', w: 2.5, pts: [[17.05, 48.9], [16.93, 48.6], [16.9, 48.35], [16.97, 48.17]] },
    { name: 'Traun', w: 2, pts: [[13.65, 47.6], [13.78, 47.85], [14.0, 48.15], [14.35, 48.27]] },
  ];
  const LAKES = [
    { name: 'Bodensee', pts: [[9.75, 47.5], [9.65, 47.56], [9.45, 47.62], [9.2, 47.68], [9.0, 47.78], [9.05, 47.72], [9.2, 47.62], [9.4, 47.53], [9.55, 47.49], [9.68, 47.48]] },
    { name: 'Neusiedler See', pts: [[16.7, 47.94], [16.8, 47.93], [16.86, 47.85], [16.83, 47.75], [16.76, 47.68], [16.7, 47.7], [16.72, 47.8], [16.68, 47.88]] },
    { name: 'Attersee', pts: [[13.5, 47.92], [13.57, 47.9], [13.58, 47.8], [13.53, 47.78]] },
    { name: 'Traunsee', pts: [[13.78, 47.92], [13.82, 47.9], [13.8, 47.81], [13.76, 47.82]] },
    { name: 'Wörthersee', pts: [[14.03, 46.63], [14.15, 46.64], [14.27, 46.62], [14.15, 46.61], [14.03, 46.6]] },
  ];
  // Landschaften: [Art, Länge, Breite, Radius in Grad, Anzahl]
  const SCENERY = [
    ['berg', 10.05, 46.95, 0.16, 16], ['berg', 10.5, 47.22, 0.2, 18], ['berg', 10.9, 46.95, 0.2, 22], ['berg', 11.35, 47.4, 0.14, 12], ['berg', 11.9, 47.1, 0.2, 20],
    ['berg', 12.4, 47.42, 0.18, 14], ['berg', 12.65, 47.1, 0.24, 26], ['berg', 13.2, 47.15, 0.2, 18], ['berg', 13.6, 47.47, 0.14, 14], ['berg', 14.0, 47.3, 0.24, 20],
    ['berg', 14.05, 47.7, 0.15, 12], ['berg', 13.0, 46.68, 0.18, 12], ['berg', 13.75, 46.9, 0.15, 10], ['berg', 14.3, 46.45, 0.2, 12], ['berg', 15.1, 47.62, 0.18, 14],
    ['berg', 15.75, 47.75, 0.1, 8], ['berg', 15.0, 46.87, 0.12, 8], ['berg', 12.25, 46.95, 0.15, 12], ['berg', 9.95, 47.15, 0.13, 10], ['berg', 14.6, 47.45, 0.18, 12],
    ['wald', 14.2, 48.56, 0.2, 22], ['wald', 15.2, 48.65, 0.28, 30], ['wald', 16.05, 48.15, 0.12, 14], ['wald', 13.4, 47.98, 0.12, 12], ['wald', 15.4, 47.5, 0.16, 14],
    ['wald', 14.25, 46.95, 0.16, 12], ['wald', 9.95, 47.4, 0.1, 10], ['wald', 15.8, 47.3, 0.18, 14], ['wald', 14.7, 48.05, 0.14, 10], ['wald', 16.3, 47.4, 0.12, 8],
    ['feld', 16.35, 48.6, 0.25, 22], ['feld', 16.7, 48.3, 0.14, 12], ['feld', 15.9, 48.33, 0.12, 10], ['feld', 14.0, 48.05, 0.16, 12], ['feld', 16.88, 47.75, 0.1, 8],
    ['feld', 13.5, 48.3, 0.14, 10], ['feld', 15.6, 46.8, 0.12, 8], ['feld', 16.4, 47.6, 0.1, 8],
  ];

  // Wissensfragen. a: richtige Antwort zuerst (wird beim Stellen gemischt). e: Erklärung. p: passender Ort.
  const Q = [
    // ---- Geografie
    { id: 'g1', area: 'geo', lv: 1, q: 'Wie viele Bundesländer hat Österreich?', a: ['9', '7', '12'], e: 'Österreich hat neun Bundesländer.' },
    { id: 'g2', area: 'geo', lv: 1, q: 'Wie heißt die Hauptstadt von Österreich?', a: ['Wien', 'Graz', 'Salzburg'], e: 'Wien ist die Bundeshauptstadt.' },
    { id: 'g3', area: 'geo', lv: 2, q: 'Wie viele Nachbarländer hat Österreich?', a: ['8', '6', '10'], e: 'Deutschland, Tschechien, Slowakei, Ungarn, Slowenien, Italien, Schweiz und Liechtenstein.' },
    { id: 'g4', area: 'geo', lv: 2, q: 'Welches ist das größte Bundesland?', a: ['Niederösterreich', 'Steiermark', 'Tirol'], e: 'Niederösterreich hat die größte Fläche.' },
    { id: 'g5', area: 'geo', lv: 2, q: 'Welches ist das kleinste Bundesland?', a: ['Wien', 'Vorarlberg', 'Burgenland'], e: 'Wien ist am kleinsten, hat aber die meisten Einwohner.' },
    { id: 'g6', area: 'geo', lv: 1, q: 'Wie heißt der höchste Berg Österreichs?', a: ['Großglockner', 'Dachstein', 'Schneeberg'], e: 'Der Großglockner ist 3.798 Meter hoch.', p: 'glockner' },
    { id: 'g7', area: 'geo', lv: 2, q: 'Welcher große Fluss fließt durch Linz und Wien?', a: ['Donau', 'Inn', 'Mur'], e: 'Die Donau fließt von Westen nach Osten durch Österreich.' },
    { id: 'g8', area: 'geo', lv: 2, q: 'In welche Richtung fließt die Donau durch Österreich?', a: ['von Westen nach Osten', 'von Norden nach Süden', 'von Osten nach Westen'], e: 'Sie kommt aus Deutschland und fließt weiter in die Slowakei.' },
    { id: 'g9', area: 'geo', lv: 2, q: 'Welches Bundesland liegt ganz im Westen?', a: ['Vorarlberg', 'Burgenland', 'Kärnten'], e: 'Vorarlberg liegt im Westen, das Burgenland ganz im Osten.' },
    { id: 'g10', area: 'geo', lv: 2, q: 'Welches Bundesland liegt ganz im Osten?', a: ['Burgenland', 'Tirol', 'Salzburg'], e: 'Das Burgenland grenzt an Ungarn.' },
    { id: 'g11', area: 'geo', lv: 2, q: 'Welches Gebirge bedeckt den größten Teil von Österreich?', a: ['die Alpen', 'die Karpaten', 'der Böhmerwald'], e: 'Fast zwei Drittel von Österreich liegen in den Alpen.' },
    { id: 'g12', area: 'geo', lv: 2, q: 'An welchem Fluss liegt Graz?', a: ['Mur', 'Donau', 'Drau'], e: 'Die Mur fließt durch die Steiermark.', p: 'graz' },
    { id: 'g13', area: 'geo', lv: 2, q: 'An welchem Fluss liegt Innsbruck?', a: ['Inn', 'Enns', 'Salzach'], e: 'Innsbruck heißt „Brücke über den Inn“.', p: 'innsbruck' },
    { id: 'g14', area: 'geo', lv: 2, q: 'Welches ist der größte See Österreichs?', a: ['Neusiedler See', 'Attersee', 'Wörthersee'], e: 'Der Neusiedler See liegt im Burgenland. Ein Teil gehört zu Ungarn.', p: 'neusiedl' },
    { id: 'g15', area: 'geo', lv: 1, q: 'Wo geht die Sonne auf?', a: ['im Osten', 'im Westen', 'im Norden'], e: 'Im Osten geht die Sonne auf, im Westen geht sie unter.' },
    { id: 'g16', area: 'geo', lv: 1, q: 'Wo ist auf den meisten Landkarten Norden?', a: ['oben', 'unten', 'links'], e: 'Norden ist oben, Süden unten, Westen links, Osten rechts.' },
    { id: 'g17', area: 'geo', lv: 2, q: 'Was zeigt die Legende einer Landkarte?', a: ['was die Zeichen und Farben bedeuten', 'wie das Wetter wird', 'wer die Karte gemalt hat'], e: 'In der Legende steht zum Beispiel: blaue Linie = Fluss.' },
    { id: 'g18', area: 'geo', lv: 3, q: 'Was gibt der Maßstab einer Karte an?', a: ['wie stark die Wirklichkeit verkleinert ist', 'wie alt die Karte ist', 'wie hoch die Berge sind'], e: 'Bei 1 : 100.000 ist 1 cm auf der Karte 1 km in der Natur.' },
    { id: 'g19', area: 'geo', lv: 2, q: 'Welche Farbe haben hohe Berge auf einer Höhenkarte?', a: ['braun', 'grün', 'blau'], e: 'Grün ist das Tiefland, gelb und braun sind Hügel und Berge.' },
    { id: 'g20', area: 'geo', lv: 3, q: 'Welches Bundesland besteht aus zwei getrennten Teilen?', a: ['Tirol', 'Kärnten', 'Salzburg'], e: 'Nordtirol und Osttirol sind nicht miteinander verbunden.', p: 'lienz' },
    { id: 'g21', area: 'geo', lv: 3, q: 'Welche drei Länder teilen sich den Bodensee?', a: ['Österreich, Deutschland, Schweiz', 'Österreich, Italien, Schweiz', 'Österreich, Deutschland, Liechtenstein'], e: 'Darum heißt er auch Dreiländersee.', p: 'bodensee' },
    { id: 'g22', area: 'geo', lv: 2, q: 'Welches Nachbarland ist das kleinste?', a: ['Liechtenstein', 'Slowenien', 'Schweiz'], e: 'In Liechtenstein leben nur etwa 40.000 Menschen.', p: 'n-li' },
    { id: 'g23', area: 'geo', lv: 3, q: 'Welche zwei Nachbarländer gehören nicht zur Europäischen Union?', a: ['Schweiz und Liechtenstein', 'Ungarn und Slowakei', 'Italien und Slowenien'], e: 'Alle anderen sechs Nachbarn sind in der EU.' },
    { id: 'g24', area: 'geo', lv: 2, q: 'Auf welchem Kontinent liegt Österreich?', a: ['Europa', 'Asien', 'Afrika'], e: 'Österreich liegt in der Mitte Europas.' },
    { id: 'g25', area: 'geo', lv: 3, q: 'Österreich hat keine Küste am Meer. Wie nennt man so ein Land?', a: ['Binnenland', 'Inselstaat', 'Halbinsel'], e: 'Ein Binnenland ist ganz von anderen Ländern umgeben.' },
    { id: 'g26', area: 'geo', lv: 3, q: 'Wie heißt die hügelige Landschaft zwischen den Alpen und der Donau?', a: ['Alpenvorland', 'Wiener Becken', 'Hochland'], e: 'Im Alpenvorland liegen viele Felder und Städte.' },
    // ---- Geschichte
    { id: 'h1', area: 'hist', lv: 2, q: 'Welches Volk baute vor rund 2000 Jahren die Stadt Carnuntum?', a: ['die Römer', 'die Wikinger', 'die Ägypter'], e: 'Die Donau war die Grenze des Römischen Reiches.', p: 'carnuntum' },
    { id: 'h2', area: 'hist', lv: 2, q: 'Warum bauten die Menschen im Mittelalter Burgen?', a: ['zum Schutz vor Feinden', 'als Schulen', 'als Fabriken'], e: 'Hinter dicken Mauern waren die Menschen sicher.', p: 'osterwitz' },
    { id: 'h3', area: 'hist', lv: 3, q: 'Seit welchem Jahr ist Österreich eine Republik?', a: ['1918', '1955', '1995'], e: '1918 endete die Zeit der Kaiser. Seither wählt das Volk.' },
    { id: 'h4', area: 'hist', lv: 3, q: 'Was wurde 1955 unterschrieben?', a: ['der Staatsvertrag', 'der Beitritt zur EU', 'die erste Verfassung'], e: 'Mit dem Staatsvertrag wurde Österreich wieder frei und unabhängig.' },
    { id: 'h5', area: 'hist', lv: 2, q: 'Seit wann gehört Österreich zur Europäischen Union?', a: ['1995', '1955', '2010'], e: 'Österreich trat 1995 der EU bei.' },
    { id: 'h6', area: 'hist', lv: 2, q: 'Welche Herrscherin führte die Schulpflicht für alle Kinder ein?', a: ['Maria Theresia', 'Kaiserin Sisi', 'Königin Viktoria'], e: 'Seit 1774 müssen alle Kinder in die Schule gehen.' },
    { id: 'h7', area: 'hist', lv: 2, q: 'Welches Bundesland kam als letztes zu Österreich?', a: ['Burgenland', 'Vorarlberg', 'Kärnten'], e: 'Das Burgenland gehört seit 1921 dazu.', p: 'eisenstadt' },
    { id: 'h8', area: 'hist', lv: 1, q: 'Welcher berühmte Komponist wurde in Salzburg geboren?', a: ['Mozart', 'Beethoven', 'Bach'], e: 'Wolfgang Amadeus Mozart kam 1756 in Salzburg zur Welt.', p: 'salzburg' },
    { id: 'h9', area: 'hist', lv: 3, q: 'Wie heißt die Zeit, die nach einem Ort in Oberösterreich benannt ist?', a: ['Hallstattzeit', 'Linzzeit', 'Welszeit'], e: 'In Hallstatt fand man berühmte Gräber aus der Eisenzeit.', p: 'hallstatt' },
    { id: 'h10', area: 'hist', lv: 3, q: 'Welche Familie regierte Österreich über 600 Jahre lang?', a: ['die Habsburger', 'die Babenberger', 'die Esterházy'], e: 'Die Habsburger herrschten von 1282 bis 1918. Vor ihnen regierten die Babenberger.' },
    { id: 'h11', area: 'hist', lv: 2, q: 'Wie nennt man eine Linie, auf der Ereignisse der Reihe nach eingetragen sind?', a: ['Zeitleiste', 'Legende', 'Maßstab'], e: 'Auf der Zeitleiste sieht man, was früher und was später war.' },
    // ---- Gemeinschaft und Staat
    { id: 's1', area: 'sozial', lv: 1, q: 'Welche Farben hat die Fahne von Österreich?', a: ['Rot-Weiß-Rot', 'Schwarz-Rot-Gold', 'Blau-Weiß'], e: 'Die Fahne hat drei Streifen: rot, weiß, rot.' },
    { id: 's2', area: 'sozial', lv: 2, q: 'Wer ist das Staatsoberhaupt von Österreich?', a: ['der Bundespräsident oder die Bundespräsidentin', 'der Bürgermeister', 'der Kaiser'], e: 'Das Volk wählt das Staatsoberhaupt alle sechs Jahre.' },
    { id: 's3', area: 'sozial', lv: 2, q: 'Wer leitet eine Gemeinde?', a: ['die Bürgermeisterin oder der Bürgermeister', 'der Landeshauptmann', 'die Direktorin'], e: 'Die Gemeinde kümmert sich zum Beispiel um Wasser, Müll und Kindergärten.' },
    { id: 's4', area: 'sozial', lv: 2, q: 'Wer steht an der Spitze eines Bundeslandes?', a: ['der Landeshauptmann oder die Landeshauptfrau', 'der Bundeskanzler', 'der Bürgermeister'], e: 'Jedes Bundesland hat eine eigene Landesregierung.' },
    { id: 's5', area: 'sozial', lv: 2, q: 'Was bedeutet Demokratie?', a: ['Das Volk bestimmt mit, zum Beispiel durch Wahlen.', 'Ein König bestimmt alles allein.', 'Niemand muss sich an Regeln halten.'], e: 'In einer Demokratie wählen die Menschen ihre Vertreterinnen und Vertreter.' },
    { id: 's6', area: 'sozial', lv: 3, q: 'Ab welchem Alter darf man in Österreich wählen?', a: ['ab 16 Jahren', 'ab 12 Jahren', 'ab 21 Jahren'], e: 'Österreich war eines der ersten Länder mit Wählen ab 16.' },
    { id: 's7', area: 'sozial', lv: 2, q: 'Wann ist der österreichische Nationalfeiertag?', a: ['am 26. Oktober', 'am 1. Mai', 'am 24. Dezember'], e: 'Am 26. Oktober 1955 beschloss Österreich, immer neutral zu bleiben.' },
    { id: 's8', area: 'sozial', lv: 3, q: 'Wo werden in Österreich die Gesetze beschlossen?', a: ['im Parlament', 'im Rathaus', 'im Gericht'], e: 'Im Parlament in Wien sitzen die gewählten Abgeordneten.', p: 'wien' },
    { id: 's9', area: 'sozial', lv: 2, q: 'Welche Rechte haben alle Kinder auf der Welt?', a: ['die Kinderrechte', 'die Verkehrsregeln', 'die Hausordnung'], e: 'Dazu gehören das Recht auf Schule, Schutz und Spiel.' },
    { id: 's10', area: 'sozial', lv: 3, q: 'Welche Minderheitensprache wird in Teilen Kärntens gesprochen?', a: ['Slowenisch', 'Französisch', 'Spanisch'], e: 'In Kärnten gibt es zweisprachige Ortstafeln. Im Burgenland spricht man auch Kroatisch und Ungarisch.' },
    // ---- Wirtschaft
    { id: 'w1', area: 'wirt', lv: 2, q: 'Woraus wird Stahl gemacht?', a: ['aus Eisenerz', 'aus Salz', 'aus Lehm'], e: 'Das Erz wird im Hochofen geschmolzen.', p: 'erzberg' },
    { id: 'w2', area: 'wirt', lv: 1, q: 'Woraus wird Brot gebacken?', a: ['aus Mehl von Getreide', 'aus Lehm', 'aus Holz'], e: 'Der Bauer erntet das Korn, die Mühle mahlt es zu Mehl, der Bäcker bäckt Brot.' },
    { id: 'w3', area: 'wirt', lv: 2, q: 'Warum kommen so viele Gäste nach Österreich?', a: ['wegen der Berge, Seen und Städte', 'wegen des Meeres', 'wegen der Wüste'], e: 'Der Tourismus gibt vielen Menschen Arbeit.', p: 'woerthersee' },
    { id: 'w4', area: 'wirt', lv: 2, q: 'Mit welchem Geld bezahlt man in Österreich?', a: ['mit dem Euro', 'mit dem Schilling', 'mit dem Franken'], e: 'Den Euro gibt es als Bargeld seit 2002. Davor gab es den Schilling.' },
    { id: 'w5', area: 'wirt', lv: 2, q: 'Was nannte man früher „weißes Gold“?', a: ['Salz', 'Schnee', 'Milch'], e: 'Mit Salz konnte man Essen haltbar machen. Es war sehr wertvoll.', p: 'hallstatt' },
    { id: 'w6', area: 'wirt', lv: 3, q: 'Was bedeutet „Export“?', a: ['Waren in andere Länder verkaufen', 'Waren im Keller lagern', 'Waren selbst verbrauchen'], e: 'Österreich exportiert zum Beispiel Maschinen, Holz und Stahl.' },
    { id: 'w7', area: 'wirt', lv: 2, q: 'In welchem Teil Österreichs liegen die meisten großen Getreidefelder?', a: ['im flachen Osten', 'im Hochgebirge', 'in Vorarlberg'], e: 'Im Marchfeld und im Weinviertel ist das Land flach und warm.' },
    { id: 'w8', area: 'wirt', lv: 2, q: 'Was passiert auf einer Alm im Sommer?', a: ['Kühe weiden auf den Bergwiesen.', 'Es wird Getreide geerntet.', 'Es wird Salz abgebaut.'], e: 'Aus der Almmilch wird Käse und Butter gemacht.' },
    { id: 'w9', area: 'wirt', lv: 3, q: 'Welche drei Bereiche hat die Wirtschaft?', a: ['Landwirtschaft, Industrie, Dienstleistungen', 'Sommer, Herbst, Winter', 'Berg, Tal, See'], e: 'Die meisten Menschen in Österreich arbeiten in Dienstleistungen, etwa im Handel oder in der Pflege.' },
    // ---- Natur
    { id: 'n1', area: 'natur', lv: 1, q: 'Welches Tier pfeift laut, wenn Gefahr droht, und schläft den ganzen Winter?', a: ['das Murmeltier', 'der Steinbock', 'der Adler'], e: 'Murmeltiere leben in den Alpen in Bauen unter der Erde.' },
    { id: 'n2', area: 'natur', lv: 2, q: 'Wie entsteht ein Gletscher?', a: ['aus Schnee, der zu Eis gepresst wird', 'aus gefrorenem Regen', 'aus Salzwasser'], e: 'Weil es wärmer wird, schmelzen die Gletscher der Alpen.', p: 'dachstein' },
    { id: 'n3', area: 'natur', lv: 2, q: 'Was passiert beim Wasserkreislauf zuerst?', a: ['Wasser verdunstet und steigt auf.', 'Es schneit im Tal.', 'Der Fluss friert zu.'], e: 'Der Dampf wird zu Wolken, es regnet, das Wasser fließt zurück ins Meer.' },
    { id: 'n4', area: 'natur', lv: 2, q: 'Was ist ein Nationalpark?', a: ['ein Gebiet, in dem die Natur besonders geschützt ist', 'ein großer Spielplatz', 'ein Parkplatz für Reisebusse'], e: 'Österreich hat sechs Nationalparks.', p: 'auen' },
    { id: 'n5', area: 'natur', lv: 2, q: 'Welcher Baum wächst in Österreichs Wäldern am häufigsten?', a: ['die Fichte', 'die Palme', 'die Birke'], e: 'Die Fichte ist ein Nadelbaum. Ihr Holz wird zum Bauen verwendet.' },
    { id: 'n6', area: 'natur', lv: 2, q: 'Warum wachsen ganz oben auf hohen Bergen keine Bäume?', a: ['Es ist zu kalt und zu windig.', 'Es gibt zu viel Sonne.', 'Die Kühe fressen alle auf.'], e: 'Die Grenze heißt Baumgrenze. Sie liegt in den Alpen bei etwa 2000 Metern.' },
    { id: 'n7', area: 'natur', lv: 3, q: 'Woraus entstand der Felsen der Riegersburg?', a: ['aus Lava eines Vulkans', 'aus Gletschereis', 'aus Muschelkalk'], e: 'In der Oststeiermark gab es vor Millionen Jahren Vulkane.', p: 'riegersburg' },
    { id: 'n8', area: 'natur', lv: 1, q: 'Welcher Vogel nistet in Rust auf den Dächern?', a: ['der Storch', 'der Pinguin', 'der Papagei'], e: 'Im Herbst fliegen die Störche nach Afrika.', p: 'neusiedl' },
    { id: 'n9', area: 'natur', lv: 3, q: 'Was misst man in Grad Celsius?', a: ['die Temperatur', 'den Niederschlag', 'den Wind'], e: 'Mit dem Thermometer misst man, wie warm oder kalt es ist.' },
    { id: 'n10', area: 'natur', lv: 2, q: 'Welches Tier mit großen Hörnern klettert in den Felsen der Alpen?', a: ['der Steinbock', 'der Biber', 'der Fischotter'], e: 'Steinböcke leben oberhalb der Baumgrenze.' },
    // ---- Technik
    { id: 't1', area: 'technik', lv: 2, q: 'Wie wird in Österreich der meiste Strom erzeugt?', a: ['mit Wasserkraft', 'mit Kohle', 'mit Atomkraft'], e: 'Das Wasser treibt Turbinen an. In Österreich gibt es kein Atomkraftwerk in Betrieb.', p: 'kaprun' },
    { id: 't2', area: 'technik', lv: 2, q: 'Wozu dient ein Tunnel?', a: ['Man kommt schnell durch einen Berg.', 'Man speichert dort Wasser.', 'Man baut dort Getreide an.'], e: 'Der Arlbergtunnel ist fast 14 Kilometer lang.', p: 'arlberg' },
    { id: 't3', area: 'technik', lv: 3, q: 'Welche Energie ist erneuerbar?', a: ['Sonne, Wind und Wasser', 'Erdöl', 'Kohle'], e: 'Erneuerbare Energie geht nicht aus und schont das Klima.' },
    { id: 't4', area: 'technik', lv: 2, q: 'Wie heißt eine hohe Brücke für Züge mit vielen Bögen?', a: ['Viadukt', 'Aquädukt', 'Tunnel'], e: 'Die Semmeringbahn fährt über 16 Viadukte.', p: 'semmering' },
    { id: 't5', area: 'technik', lv: 2, q: 'Welches Verkehrsmittel ist am besten für die Umwelt?', a: ['der Zug', 'das Flugzeug', 'das Auto'], e: 'Ein Zug bringt viele Menschen mit wenig Energie ans Ziel.' },
    { id: 't6', area: 'technik', lv: 1, q: 'Was hält in einem Stausee das Wasser zurück?', a: ['eine Staumauer', 'ein Zaun', 'ein Netz'], e: 'Die Mauer muss sehr dick sein, weil das Wasser stark drückt.', p: 'kaprun' },
  ];

  const AREAS = { geo: 'Raum', hist: 'Zeit', sozial: 'Gemeinschaft', wirt: 'Wirtschaft', natur: 'Natur', technik: 'Technik' };

  window.OE_CONTENT = { STATES, COUNTRIES, RES, NODES, PALETTE, BUILDS, PLACES, RIVERS, LAKES, SCENERY, Q, AREAS };
})();
