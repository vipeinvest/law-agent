# Zeitly – Arbeitszeiterfassung für Österreich

Zeitly ist eine schlanke, mobile-first Web-App (PWA) für die gesetzeskonforme Arbeitszeiterfassung österreichischer KMU – gebaut für Teams, die remote, im Büro und im Außendienst arbeiten, und für Steuerberater:innen, die am Monatsende saubere Daten statt loser Excel-Tabellen wollen.

**Live (Pilot):** https://zeitly.malelu.io · **Demo:** `pnpm dev:demo` → http://localhost:3100 (Demo-Konten auf der Login-Seite)

## Was Zeitly kann

- **Stempeluhr** mit Start/Pause/Stopp, Arbeitsort (Büro · Telearbeit · Außendienst), Reisezeit, Projekt/Kostenstelle, Notiz – offline-fähig, Nachbuchung per Tag/Woche.
- **AZG-Prüfregeln live und im Monat:** 12 h/60 h Höchstgrenzen, Ø 48 h/17 Wochen, Ruhepause ab 6 h, 11 h Ruhezeit, 36 h Wochenendruhe, Sonn-/Feiertags- und Nachtarbeit, Überlappungen, offene Buchungen. Jede Meldung mit Paragraph.
- **Zeitkonto:** Soll aus Vertrag und Arbeitstagen, Gutschriften für Feiertage (AT-Kalender inkl. beweglicher Feiertage), Urlaub, Krankenstand; Zeitausgleich; Saldo-Fortschreibung über freigegebene Monate; Gleitzeit (10 h), Teilzeit-Mehrarbeit (§ 19d), All-in, „nur Dauer“ (§ 26 Abs 3).
- **Monatsabschluss:** Mitarbeiter:in bestätigt → Führungskraft gibt frei → Export; gesperrte Monate, Wiederöffnen nur mit Grund (protokolliert).
- **Exporte für Lohnverrechnung & Buchhaltung:** PDF-Arbeitszeitnachweis je Person (§ 26 AZG, Unterschriftsfelder), Excel mit Lohnarten-Importblatt (Codes konfigurierbar), CSV, Projekt-/Kostenstellen-Excel, Versand per E-Mail an die Steuerberatung mit einem Klick.
- **Verwaltung:** Mitarbeiter mit Arbeitszeitmodell, Projekte/Kostenstellen, Abwesenheitsanträge mit Genehmigung, Excel/CSV-Import bestehender Aufzeichnungen (freie Spaltenzuordnung), Audit-Log, Löschlauf nach Aufbewahrungsfrist.
- **White-Label & Multi-Mandant:** Logo, Farben, App-Name je Betrieb; Mitarbeiter sehen nur eigene Daten, Vorgesetzte ihr Team, Rolle „Lohnverrechnung“ nur Exporte.
- **Datenschutz by design:** kein GPS, keine Screenshots, Login per E-Mail-Code ohne Passwort, EU-Hosting, 7-Jahres-Aufbewahrung mit automatischer Bereinigung. Rechtspaket (AVV, Datenschutzinfo, Betriebsvereinbarung, Pilotvertrag, Checkliste) unter `deliverables/zeitly/`.

## Stack

Next.js 14 (App Router, TypeScript strict), Tailwind, Postgres (Supabase) oder PGlite (Tests/Demo), pdf-lib, ExcelJS, Resend. Docker (standalone, non-root) hinter Traefik, 2 Replikas, Cron-Sidecar für Backups und Housekeeping. Keine externen Skripte, strikte CSP.

## Entwicklung

```bash
pnpm install
pnpm dev:demo        # PGlite in-memory + Demo-Daten, Anmeldecodes werden angezeigt
pnpm test            # Regelwerk (vitest) + Schema (PGlite)
pnpm e2e             # Playwright gegen den Production-Build im Demo-Modus
pnpm check           # typecheck + lint + test + build
```

Gegen echtes Postgres: `.env` mit `DATABASE_URL` (siehe `.env.example`); Migrationen laufen automatisch beim Start (`zt_migrations`).

## Struktur

```
src/domain/     Regelwerk (rules.ts), Feiertage, Zeit-Helfer – reine Funktionen, unit-getestet
src/db/         Migrationen (zt_* Tabellen), Treiber-Adapter pg/PGlite, Demo-Seed, Bootstrap
src/lib/        Auth (E-Mail-Code), Sessions, Repos, Monatsbewertung, Exporte, Mail, Audit, Löschkonzept
src/app/        Login, Mitarbeiter-App (/app), Verwaltung (/admin), Rechtstexte, API-Routen
ops/            Deploy, Backup/Restore, Housekeeping, RUNBOOK.md
e2e/, tests/    Playwright, vitest
```

## Rechtlicher Hinweis

Zeitly unterstützt den Arbeitgeber bei der Aufzeichnungspflicht nach § 26 AZG und zeigt Abweichungen von den gesetzlichen Grenzen. Die Verantwortung für die Einhaltung des Arbeitszeitrechts und die Bewertung von Zuschlägen (Kollektivvertrag) bleibt beim Arbeitgeber bzw. der Lohnverrechnung.
