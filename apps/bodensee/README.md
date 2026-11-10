# Die große Bodensee-Expedition

Ein ruhiges Unterwasser-Forschungsspiel für Kinder, ursprünglich für Leopold gebaut: Mit dem gelben U-Boot **LEO 1** taucht man in den Bodensee, findet fünf verlorene Logbuch-Seiten von Professorin Ida Wellenstein und lernt dabei echte Fakten über den See.

- **Ziel-URL:** https://bodensee.malelu.io (MALELU Traefik-VPS, Docker, Cloudflare)
- **Läuft auf:** iPhone und iPad (Safari, hoch und quer), Android, Desktop – ohne App-Download. Über „Zum Home-Bildschirm“ als Vollbild-App mit Offline-Modus.
- **Datenschutz:** keine Tracker, keine Drittanbieter-Requests, keine personenbezogenen Daten. Gespeichert wird nur der Spielstand lokal im Browser (`localStorage`). Vorgelesen wird mit vorab aufgenommenen Tondateien von unserem eigenen Server (siehe „Vorlesestimme“); was keine Aufnahme hat, liest die Stimme des Geräts. Beim Spielen geht kein Text an fremde Dienste.

## Spielinhalt

| Ort | Tiefe im Spiel | Inhalt |
|---|---|---|
| Pfahlbauten | ca. 9 m | über 5000 Jahre alt, UNESCO-Welterbe seit 2011, nachgebaute Häuser über dem Wasser |
| Felchen-Schwarm | ca. 12 m | wichtigster Fisch der Bodensee-Fischer, Plankton, silberne Tarnung |
| Alter Anker | ca. 22 m | Lädinen (Lastsegler) mit Holz, Salz und Getreide |
| Riesenwels | ca. 29 m | größter Fisch im See, Barteln, nachtaktiv |
| Dampfschiff Jura | rund 38 m (Wrack am Grund) | hölzerner Raddampfer, 1864 im Nebel nach Kollision mit der „Stadt Zürich“ gesunken, 1953 wiederentdeckt |

Alle Fundorte sind im Spiel ausdrücklich als **nicht maßstabsgetreu** gekennzeichnet. Dazu kommt ein Fischbuch mit 7 Arten (Felchen, Rotauge, Flussbarsch, Hecht, Seeforelle, Trüsche, Wels), eine Urkunde am Ende, keine Gegner und kein Zeitdruck.

**Steuerung:** Finger aufs Wasser halten, dann fährt das U-Boot dorthin. Ziehen mit gehaltenem Finger lenkt um. Alternativ gibt es einen Joystick-Modus (Pause → Steuerung). Buttons: Pause, Neustart (mit Rückfrage), Ton, Licht, Sonar-Ping, Logbuch. Tastatur: Pfeile/WASD, Leertaste = Ping, L = Licht, P/Esc = Pause.

**Technik:** HTML5 Canvas 2D, eine JS-Datei ohne Abhängigkeiten. Alle Grafiken werden zur Laufzeit gezeichnet: Tiefenverlauf, Lichtstrahlen, Kaustiken, Scheinwerferkegel mit Dunkelheit je nach Tiefe, Partikel, Schwarm-Verhalten, Sonar. Musik und Geräusche erzeugt die Web Audio API (Ambient-Musik, Wasser, Motor, Blasen, Sonar mit Echo, Funk, Fund-Melodie). Pointer Events mit `setPointerCapture` und `touch-action: none` (Touch-Fallback für alte iOS-Versionen). Auflösung und Lichtqualität passen sich langsamen Geräten automatisch an.

## Ausflüge (Knopf „Karte“)

- **Seekarte:** echte Uferlinie (Natural Earth, gemeinfrei), drei Länder, Grenzen, 28 Orte, Rhein, tiefste Stelle.
- **Landgang:** Rundweg um den ganzen See in Seitenansicht, 28 Stempel, rund 40 Sehenswürdigkeiten und Tiere, Grenzübergänge.
- **Zeitreise:** 13 Zeiten von der Trias bis heute mit rund 40 antippbaren Tieren und Menschen. Am See selbst gibt es keine Dinosaurier-Funde, das Spiel sagt das offen und zeigt die nächsten echten Fundorte.
- **Fossil-Grabung:** Staub von drei Steinplatten aus Öhningen wischen.
- **Forscherbuch:** sammelt alle Funde lokal im Browser.

Alle Aussagen mit Quelle: `FAKTEN.md`. Bei Änderungen am deutschen Text immer die Sprachdateien mitziehen, der deutsche Satz ist der Schlüssel; `tests/smoke.cjs` bricht ab, wenn eine Übersetzung fehlt oder eine Zahl abweicht.

**Sprachen:** Deutsch (Standard), Englisch, Italienisch, Französisch; Umschalter im Titel und in der Pause, direkt per `?lang=en`. Vorlesen nimmt die Aufnahme der jeweiligen Sprache, sonst die passende Stimme des Geräts; gibt es beides nicht, bleibt der Lautsprecher-Knopf verborgen.

**Name:** Kinder können am Anfang ihren Namen eintragen, er bleibt nur im Browser. Ein Familienlink wie `?name=Leopold` trägt ihn einmal ein. Am Ende lässt sich die Urkunde als Bild speichern oder über das Teilen-Menü des Geräts verschicken, ohne dass eine Adresse über den Server läuft.

**Vollbild:** beim Start und bei jedem Knopf zurück ins Spiel; Esc oder Android-Zurück verlassen es und pausieren; der Knopf im Pausenmenü verlässt es bis zum nächsten Start. iPhone-Safari kann es nicht, dort hilft „Zum Home-Bildschirm“.

## Vorlesestimme

Gerätestimmen klingen oft nach Roboter. Deshalb wird jeder Text einmal vorab mit einer KI-Stimme (OpenAI `gpt-4o-mini-tts`, Stimme „marin“) aufgenommen. Die Dateien liegen auf dem VPS unter `/opt/bodensee/audio` und werden schreibgeschützt in den Container gehängt (`docker-compose.yml`), sie sind also nicht Teil des Images und nicht im Repo.

- `audio/index.json` nennt den Satz (`set`) und je Sprache die vorhandenen Schlüssel; die Datei heißt `audio/<set>/<lang>/<schlüssel>.mp3`. Der Schlüssel ist ein FNV-1a-Wert des angezeigten Texts ohne den Namen des Kindes („Kapitän Mia“ wird als „Kapitän“ nachgeschlagen).
- Fehlt eine Aufnahme, etwa nach einer Textänderung, liest die Gerätestimme. Fehlt der ganze Ordner, antwortet nginx mit einem leeren Index.
- Sobald Aufnahmen da sind, steht im Titel und in der Pause „Vorlesestimme: KI-generiert“. Das verlangen die Nutzungsregeln von OpenAI, und es gehört zur KI-Kennzeichnung.

Neu aufnehmen, zum Beispiel nach Textänderungen (bestehende Dateien bleiben, nur Neues kostet):

```bash
node build.mjs
node tools/voice-texts.cjs --out dist/voice/texts.json      # alle Sprechtexte je Sprache, aus dem laufenden Spiel
node tools/voice.mjs --texts dist/voice/texts.json --out dist/audio --key-file <Datei mit OPENAI_API_KEY=...> --ffmpeg <ffmpeg>
node tools/voice.mjs ... --samples marin,coral,sage --lang de   # nur Hörproben zum Vergleichen
scp -r dist/audio/<set> root@<vps>:/opt/bodensee/audio/ && scp dist/audio/index.json root@<vps>:/opt/bodensee/audio/
```

Die `index.json` zuletzt hochladen, damit sie nie auf Dateien zeigt, die noch fehlen. Eine neue Stimme bekommt einen neuen `--set`, weil die Tondateien 30 Tage im Browser-Cache bleiben. OpenAI schaltet `gpt-4o-mini-tts` laut eigener Doku am 06.01.2027 ab: Fertige Aufnahmen bleiben, für Nachaufnahmen danach braucht `tools/voice.mjs` ein anderes Modell oder einen anderen Dienst.

## Aufbau

```
src/body.html  src/style.css  src/game.js   Quellcode Tauchgang
src/ext-*.js                                 Seekarte, Landgang, Zeitreise, Zeichnungen, Inhalte
src/i18n*.js                                 Sprachen, deutscher Text als Schlüssel
FAKTEN.md                                    Quellen aller Spieltexte
src/assets/                                  Icons, Manifest, Service Worker, robots.txt
build.mjs                                    -> public/ (Server) und dist/artifact.html (Einzeldatei)
nginx/                                       nginx-Konfiguration, CSP und Sicherheits-Header, /health
Dockerfile  docker-compose.yml               Container (nginx-unprivileged, read-only, ohne Capabilities)
ops/deploy.sh  ops/rollback.sh               Deploy mit automatischem Rollback / manuelles Rollback
tests/smoke.cjs                              Playwright-Smoke-Test (iPhone, iPad, Desktop)
tools/voice-texts.cjs  tools/voice.mjs       Vorlesestimme: Sprechtexte sammeln, aufnehmen
```

## Lokal entwickeln und testen

```bash
cd apps/bodensee
node build.mjs                         # baut public/ und dist/artifact.html
node tests/smoke.cjs --dir public      # Checks auf 5 Geräteprofilen, Screenshots in tests/screenshots/
python3 -m http.server -d public 8000  # zum Ausprobieren
```

## Deployment

### Automatisch (GitHub Actions „Bodensee Deploy“)

Der Workflow startet bei jedem Push auf `main` (oder den Feature-Branch), der `apps/bodensee/**` ändert:

1. **test** – Build, Smoke-Test, Docker-Image bauen und read-only starten, Smoke-Test gegen den Container.
2. **deploy** – kopiert das Release nach `/opt/bodensee/releases/<sha>` und führt `ops/deploy.sh` aus. Braucht die Secrets `BODENSEE_VPS_HOST`, `BODENSEE_VPS_USER`, `BODENSEE_VPS_PORT` und `BODENSEE_VPS_SSH_KEY`, sonst die gemeinsamen `VPS_*`. Fehlen sie, wird der Schritt mit einem Hinweis übersprungen.
3. **dns** – optional mit `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID`: legt den Cloudflare-A-Record `bodensee` (DNS only) auf die VPS-IP an, falls er noch fehlt. Bestehende Einträge werden nie geändert.
4. **verify** – wartet auf `https://bodensee.malelu.io/health` und führt den Smoke-Test gegen die öffentliche URL aus.

### Manuell auf dem VPS (eine Zeile)

```bash
git clone --depth 1 -b claude/bold-hawking-vsp7wz https://github.com/vipeinvest/law-agent /opt/bodensee/src \
  && bash /opt/bodensee/src/apps/bodensee/ops/deploy.sh
# Update später:
cd /opt/bodensee/src && git pull && bash apps/bodensee/ops/deploy.sh
```

`deploy.sh` erkennt das Traefik-Netz (`traefik-proxy` oder `traefik`) und bricht ohne Änderungen ab, wenn keines existiert. Es baut `bodensee:<tag>`, startet den Container `bodensee-web` (Compose-Projekt `bodensee`, keine offenen Ports) und prüft den Container-Health-Check und die Traefik-Route über `127.0.0.1:443`. Schlägt etwas fehl, läuft automatisch wieder das vorherige Release, oder der neue Container wird entfernt. Andere Dienste werden nicht angefasst.

**DNS (einmalig, falls nicht per Workflow):** Cloudflare → `malelu.io` → DNS → `A  bodensee  <VPS-IP>`, DNS only (grau), wie bei `businessone.malelu.io`: Das Zertifikat holt Traefik per HTTP-Prüfung von Let's Encrypt. Live: GastroMarge-VPS `152.239.116.184` (hat das Netz `traefik-proxy`).

Variablen bei abweichender Traefik-Konfiguration: `TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT` (Standard `websecure`), `TRAEFIK_CERTRESOLVER` (Standard `letsencrypt`), `BODENSEE_HOST`.

### Rollback

```bash
bash /opt/bodensee/current/ops/rollback.sh       # vorheriges Release wieder starten
# oder: GitHub Actions → Bodensee Deploy → Run workflow → action = rollback
# Spiel komplett offline nehmen:
docker compose -p bodensee -f /opt/bodensee/current/docker-compose.yml down
```

Status und Historie: `cat /opt/bodensee/CURRENT /opt/bodensee/deploy.log`, `docker ps --filter name=bodensee-web`, `curl -s https://bodensee.malelu.io/health`.
