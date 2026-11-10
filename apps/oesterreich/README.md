# Die große Österreich-Expedition

Lernspiel für den Sachunterricht der 4. Klasse Volksschule (mit Stufen für die 2.–3. und die 5.–6. Klasse). Das Kind erkundet eine echte Karte von Österreich, baut Rohstoffe dort ab, wo es sie wirklich gibt, und errichtet damit Block für Block die Wahrzeichen der neun Landeshauptstädte. Dazwischen kommen kurze Wissensfragen.

Läuft im Browser auf Handy, Tablet und PC, ohne Download, ohne Werbung, ohne Datensammlung. Der Spielstand bleibt im Browser des Geräts.

## So wird gespielt

1. **Erkunden:** Finger auf die Karte halten, die Figur läuft dorthin. Oben steht immer, in welchem Bundesland oder Nachbarland man gerade ist.
2. **Abbauen:** An Rohstoffstellen den Knopf gedrückt halten. Holz gibt es im Wald, Stein im Steinbruch, Salz im Salzkammergut, Eisen am Erzberg, Getreide im flachen Osten, Lehm im Vorland.
3. **Bauen:** In jeder Landeshauptstadt wartet eine Baustelle. Sind die Rohstoffe beisammen und eine Frage zum Bundesland beantwortet, entsteht das Wahrzeichen aus Blöcken.
4. **Entdecken:** 37 Orte (9 Landeshauptstädte, 20 Natur-, Geschichts- und Technikorte, 8 Nachbarländer) mit je drei kurzen Fakten.
5. **Ziel:** Alle neun Wahrzeichen bauen und alle acht Nachbarländer besuchen. Dafür gibt es die Urkunde „Österreich-Profi".

Der Kompass und der Auftrag zeigen immer den nächsten sinnvollen Schritt, mit Himmelsrichtung und Entfernung in Kilometern.

## Bezug zum Lehrplan

Die Inhalte sind nach den sechs Kompetenzbereichen des Lehrplans Sachunterricht 2023 geordnet (Volksschule, BGBl. II Nr. 1/2023). Im Spiel heißen sie Raum, Zeit, Gemeinschaft, Wirtschaft, Natur und Technik.

| Bereich | Im Spiel |
|---|---|
| Geografisch (Raum) | Bundesländer und Landeshauptstädte, Nachbarländer und ihre Hauptstädte, Himmelsrichtungen und Kompass, Kartenlesen (Legende, Maßstabsleiste, Übersichtskarte), Flüsse, Seen, Berge, Landschaften |
| Historisch (Zeit) | Hallstattzeit, Römer in Carnuntum, Burgen im Mittelalter, Habsburger und Maria Theresia, Republik 1918, Staatsvertrag 1955, EU-Beitritt 1995 |
| Sozialwissenschaftlich (Gemeinschaft) | Gemeinde, Land und Bund, Demokratie und Wahlen, Bundespräsident, Parlament, Fahne, Nationalfeiertag, Kinderrechte, Volksgruppen |
| Wirtschaftlich | Rohstoffe und was daraus wird (Erz → Stahl, Korn → Brot, Lehm → Ziegel), Salzhandel, Tourismus, Landwirtschaft, Geld, Export |
| Naturwissenschaftlich (Natur) | Gletscher, Wasserkreislauf, Wald und Baumgrenze, Tiere der Alpen, Nationalparks, Vulkane, Steppensee |
| Technisch | Wasserkraft und Stauseen, erneuerbare Energie, Tunnel, Viadukte, Bahn, Verkehr |

Drei Stufen: 2.–3. Klasse (einfache Fragen), 4. Klasse (Kern), 5.–6. Klasse (zusätzlich Maßstab, Binnenland, EU, Republik, Wirtschaftsbereiche). Wer viele Fragen weiß, bekommt auch Fragen der nächsten Stufe.

**Einschränkung:** Der Wortlaut des Lehrplans (RIS) war aus der Entwicklungsumgebung nicht abrufbar. Bestätigt sind die sechs Kompetenzbereiche und die Beschreibung des geografischen Bereichs. Die Auswahl der einzelnen Themen folgt dem üblichen Stoff der 4. Klasse und sollte vor einem Schuleinsatz von einer Lehrkraft gegen den Lehrplan geprüft werden.

## Lernmethoden im Spiel

| Befund aus der Lernforschung | Umsetzung |
|---|---|
| Abrufen prägt besser ein als Wiederlesen (Dunlosky u. a. 2013; Adesope u. a. 2017) | Kurze Fragen vor dem Bauen und nach Entdeckungen, ohne Noten |
| Verteiltes Üben schlägt geballtes (Cepeda u. a. 2006) | Leitner-Kartei: gewusste Fragen kommen nach 3, 7, 15 und 40 weiteren Fragen wieder, nicht gewusste sofort |
| Erklärendes Feedback wirkt stärker als „richtig/falsch" (Van der Kleij u. a. 2015) | Nach jeder Antwort ein Satz „warum", auch bei richtiger Antwort |
| Fehler mit Korrektur fördern das Lernen (Metcalfe 2017) | Keine Strafe, zweiter Versuch, danach die Lösung mit Erklärung |
| Angeleitetes Entdecken ist besser als freies (Alfieri u. a. 2011) | Freie Karte, aber immer ein klarer Auftrag mit Kompass |
| Wissen an Ort und Handlung binden (Brown, Collins, Duguid 1989) | Salz wird im Salzkammergut abgebaut und in Salzburg verbaut |
| Wenig Ablenkung, Beschriftung am Objekt (Mayer 2019) | Namen direkt auf der Karte, keine Animation während der Frage, kurze Texte, Vorlesen möglich |
| Belohnungen sollen informieren, nicht ködern (Deci, Koestner, Ryan 1999) | Kein Punktekonto, keine Rangliste: Das Bauwerk steht für das Gelernte |
| Mischen verwechselbarer Inhalte (Brunmair & Richter 2019) | Bundesländer und Nachbarländer werden auf einer stummen Karte angetippt, die Bereiche wechseln sich ab |

Die Quellen sind bibliografisch geprüft, die Volltexte wurden nicht gelesen. Lernspiele haben in Metaanalysen kleine bis mittlere Effekte (Wouters u. a. 2013; Clark u. a. 2016): Das Spiel ergänzt den Unterricht und ersetzt ihn nicht.

## Technik

```
src/content.js   Orte, Rohstoffe, Wahrzeichen, 72 feste Fragen (dazu 39 aus den Daten erzeugte)
src/map-data.js  Kartendaten (erzeugt von tools/make-map.mjs)
src/game.js      Spiel: Karte, Figur, Abbauen, Bauen, Fragen, Forscherheft
build.mjs        baut public/ (Webserver) und dist/artifact.html (Einzeldatei)
tests/smoke.cjs  Playwright-Test: prüft die Daten und spielt das Spiel einmal ganz durch
```

```bash
cd apps/oesterreich
node build.mjs && node tests/smoke.cjs      # 102 Checks
```

Der Test prüft unter anderem, dass jede Landeshauptstadt in ihrem Bundesland liegt, jedes Nachbarland an der richtigen Stelle, dass alle Fragen drei verschiedene Antworten haben und kein Fakt länger als 32 Wörter ist.

**Kartendaten:** Staatsgrenzen aus Natural Earth 1:10m (gemeinfrei, über `world-atlas`). Bundesländer nach MapSVG (CC BY 4.0, über `@svg-maps/austria`), auf die Staatsgrenze eingepasst. Flüsse und Seen sind von Hand grob nachgezeichnet, die Karte ist nicht maßstabsgetreu im Detail.

## Deployment

Wie bei der Bodensee-Expedition: Container mit nginx (read-only, strikte CSP, `/health`), Traefik-Labels für `oesterreich.malelu.io` (Vorschlag, änderbar über `OESTERREICH_HOST`), `ops/deploy.sh` mit automatischem Rollback.

```bash
bash apps/oesterreich/ops/deploy.sh          # auf dem VPS, aus einem Checkout
bash /opt/oesterreich/current/ops/rollback.sh
```

Noch nicht deployt. Der GitHub-Workflow „Oesterreich Test" baut und testet nur.

## Noch offen

- Nur Deutsch, keine aufgenommene Erzählstimme (Vorlesen nutzt die Stimme des Geräts, wenn eine deutsche vorhanden ist).
- Die Fakten stammen aus Allgemeinwissen und wurden nicht einzeln gegen Quellen geprüft.
- Auf echten Geräten und mit Kindern noch nicht erprobt.
