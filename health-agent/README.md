# Longevity-Tresor

Persönlicher Health-, Longevity- und Performance-Agent als einzelne, selbst enthaltene Web-App (`index.html`).
Läuft als privates claude.ai-Artefakt oder lokal im Browser. Liegt bewusst außerhalb von `public/` und `app/`,
damit es **nicht** mit der Law-Agent-App deployt wird.

## Funktionen

- **Erstgespräch**: 77 Fragen in 10 Abschnitten (Basis, Ziele, Gesundheit & Familie, Schlaf, Ernährung,
  Bewegung, Psyche, Substanzen, Messwerte, Erholung). Frage für Frage, jederzeit pausierbar, sofort verschlüsselt gespeichert.
- **Tages-Check-in**: Schlaf, Energie, Stimmung, Stress, Fokus, Training, Schritte, HRV, Ruhepuls, Gewicht, Alkohol, Koffein.
- **Ernährung**: eigener Fragebogen, Mahlzeiten mit Foto, Nährwertschätzung durch Claude, Protein-Ziel (1,8 g/kg), Wasser, Essensfenster, Pflanzenvielfalt.
- **Supplement-Stack**: Etikett fotografieren, Claude liest Wirkstoffe und Dosis aus, eigene Einnahme
  (Menge, Zeitpunkt, Häufigkeit), tägliches Abhaken, Stack-Check (Höchstmengen, Wechselwirkungen, Timing, Lücken).
- **Laborwerte**: 21 Longevity-Marker (ApoB, Lp(a), HbA1c, hs-CRP, Vitamin D …) mit Zielbereichen und Verlauf.
- **Coach**: Chat mit Claude, der alle Daten als Kontext bekommt, gezielt nachfragt und neue Erkenntnisse selbst im Bereich „Wissen“ speichert.
- **Frage des Tages**: tägliche Frage, die Antwort landet im Wissensspeicher.

## Sicherheit

| | |
|---|---|
| Verschlüsselung | AES-256-GCM, im Browser (WebCrypto) |
| Schlüssel | PBKDF2-SHA-256, 600.000 Runden, zufälliges Salt, aus der PIN abgeleitet |
| PIN | wird **nirgends** gespeichert, steht nicht im Code |
| Speicherort | als Artefakt: privater Bereich `data/users/<id>/` (nur das eigene Konto kann lesen); lokal: `localStorage` |
| Sperre | automatisch nach 2–30 min Inaktivität oder 2 min im Hintergrund; Wartezeiten nach 5 Fehlversuchen |
| Backup | verschlüsselte JSON-Datei, braucht die PIN zum Wiederherstellen |

Hinweise:
- Eine 6-stellige PIN hat 10⁶ Kombinationen. PBKDF2 bremst jeden Versuch, eine längere PIN ist trotzdem sicherer.
- Wer die PIN vergisst, kann die Daten nicht wiederherstellen. Es gibt keinen Generalschlüssel.
- Nutzt man Claude-Funktionen (Coach, Etikett, Mahlzeit), gehen die dafür nötigen Daten entschlüsselt an das eigene Claude-Konto.
- Die App ersetzt keine ärztliche Beratung.
