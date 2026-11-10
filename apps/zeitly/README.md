# Fairhours – Arbeitszeiterfassung für Österreich

> **Name:** Fairhours ist der internationale Produktname (Arbeitstitel bis 10.11.2026: „Zeitly“). Interne Bezeichner bleiben bewusst unverändert: Ordner `apps/zeitly`, Tabellen-Präfix `zt_`, Umgebungsvariablen `ZEITLY_*`, Workflows `zeitly-*.yml`. Marken- und Domainprüfung für „Fairhours“ steht noch aus.

Fairhours ist eine schlanke, mobile-first Web-App (PWA) für die gesetzeskonforme Arbeitszeiterfassung österreichischer KMU – gebaut für Teams, die remote, im Büro und im Außendienst arbeiten, und für Steuerberater:innen, die am Monatsende saubere Daten statt loser Excel-Tabellen wollen.

**Live (Pilot):** https://fairhours.malelu.io · **Demo:** `pnpm dev:demo` → http://localhost:3100 (Demo-Konten auf der Login-Seite)

## Was Fairhours kann

- **Stempeluhr** mit Start/Pause/Stopp, Arbeitsort (Büro · Telearbeit · Außendienst), Reisezeit, Projekt/Kostenstelle, Notiz – offline-fähig, Nachbuchung per Tag/Woche.
- **AZG-Prüfregeln live und im Monat:** 12 h/60 h Höchstgrenzen, Ø 48 h/17 Wochen, Ruhepause ab 6 h, 11 h Ruhezeit, 36 h Wochenendruhe, Sonn-/Feiertags- und Nachtarbeit, Überlappungen, offene Buchungen. Jede Meldung mit Paragraph.
- **Zeitkonto:** Soll aus Vertrag und Arbeitstagen, Gutschriften für Feiertage (AT-Kalender inkl. beweglicher Feiertage), Urlaub, Krankenstand; Zeitausgleich; Saldo-Fortschreibung über freigegebene Monate; Gleitzeit (10 h), Teilzeit-Mehrarbeit (§ 19d), All-in, „nur Dauer“ (§ 26 Abs 3).
- **Monatsabschluss:** Mitarbeiter:in bestätigt → Führungskraft gibt frei → Export; gesperrte Monate, Wiederöffnen nur mit Grund (protokolliert).
- **Exporte für Lohnverrechnung & Buchhaltung:** PDF-Arbeitszeitnachweis je Person (§ 26 AZG, Unterschriftsfelder), Excel mit Lohnarten-Importblatt (Codes konfigurierbar), CSV, Projekt-/Kostenstellen-Excel, Versand per E-Mail an die Steuerberatung mit einem Klick.
- **Mitarbeiter-Onboarding (digitaler Personalfragebogen):** Admin legt die Person an → sie bekommt automatisch einen Link (14 Tage gültig, ohne Login). Am Handy: Ausweis, e-card, Meldezettel, Bankkarte fotografieren, Felder per Spracheingabe diktieren, KI-Extraktion schlägt Werte vor (werden nur nach Bestätigung übernommen), Prüfung von SV-Nummer, IBAN, Alter (KJBG), Beschäftigungsbewilligung (Drittstaaten). Nach dem Absenden: Zugang zur Zeiterfassung per Mail, Personalstammblatt + ÖGK-Mindestangaben als PDF für die Lohnverrechnung, Übergabe an LV mit einem Klick.
- **Dienstplanung SOLL → IST:** Wochenplaner mit Vorlagen, Kopieren der Vorwoche, AZG-Vorabprüfung vor der Veröffentlichung (Höchstgrenzen, Ruhezeiten, Wochenendruhe), Versand des Plans per Mail. Mitarbeiter:innen übernehmen geplante Tage mit einem Tipp als gearbeitet („wie geplant“), optional nachts automatisch (Negativzeiterfassung) – Abweichungen werden gestempelt oder nachgetragen. Soll-Zeit wahlweise aus Vertrag oder aus dem veröffentlichten Plan.
- **Agentische Prüfung Arbeitsrecht:** deterministischer Monats-Prüfbericht je Person (Soll/Ist/Saldo, Zuschlagsbuckets, Verstöße mit Paragraph, Empfehlung) plus optionale KI-Einordnung in Klartext für die Übergabe an die Lohnverrechnung.
- **Schnittstelle LV/BH:** REST-API v1 (read-only, Bearer-Schlüssel mit Scopes, je Mandant unter Einstellungen) für Lohnsoftware/Steuerberatung: Mitarbeiter, Personalstammdaten, Buchungen, Abwesenheiten, Dienstplan, Monatswerte – siehe `ops/API.md`.
- **Verwaltung:** Mitarbeiter mit Arbeitszeitmodell, Projekte/Kostenstellen, Abwesenheitsanträge mit Genehmigung, Excel/CSV-Import bestehender Aufzeichnungen (freie Spaltenzuordnung), Audit-Log, Löschlauf nach Aufbewahrungsfrist.
- **White-Label & Multi-Mandant:** Logo, Farben, App-Name je Betrieb; Mitarbeiter sehen nur eigene Daten, Vorgesetzte ihr Team, Rolle „Lohnverrechnung“ nur Exporte.
- **Datenschutz by design:** kein GPS, keine Screenshots, Login per E-Mail-Code ohne Passwort, EU-Hosting, 7-Jahres-Aufbewahrung mit automatischer Bereinigung. Rechtspaket (AVV, Datenschutzinfo, Betriebsvereinbarung, Pilotvertrag, Checkliste) unter `deliverables/zeitly/`.

## Stack

Next.js 14 (App Router, TypeScript strict), Tailwind, Postgres (Supabase) oder PGlite (Tests/Demo), pdf-lib, ExcelJS, Resend, Anthropic SDK (optional: Dokument-Extraktion, Prüfbericht). Docker (standalone, non-root) hinter Traefik, 2 Replikas, Cron-Sidecar für Backups und Housekeeping. Keine externen Skripte, strikte CSP.

## Entwicklung

```bash
pnpm install
pnpm dev:demo        # PGlite in-memory + Demo-Daten, Anmeldecodes werden angezeigt
pnpm test            # Regelwerk (vitest) + Schema (PGlite)
pnpm e2e             # Playwright gegen den Production-Build im Demo-Modus
pnpm check           # typecheck + lint + test + build
```

Gegen echtes Postgres: `.env` mit `DATABASE_URL` (siehe `.env.example`); Migrationen laufen automatisch beim Start (`zt_migrations`). Erststart in Produktion mit `ZEITLY_SEED=production` legt die Mandanten MALELU AI und STEINERfood GmbH samt Geschäftsführung an (idempotent, ohne Mailversand; Einladungen später von Hand aus dem Admin-Bereich).

## Struktur

```
src/domain/     Regelwerk (rules.ts), Feiertage, Zeit-Helfer – reine Funktionen, unit-getestet
src/db/         Migrationen (zt_* Tabellen), Treiber-Adapter pg/PGlite, Demo-Seed, Produktions-Seed (MALELU + STEINERfood), Bootstrap
src/lib/        Auth (E-Mail-Code), Sessions, Repos, Monatsbewertung, Exporte, Mail, Audit, Löschkonzept, Onboarding, Dienstplan, API-Schlüssel, KI
src/app/        Login, Mitarbeiter-App (/app), Verwaltung (/admin), Onboarding (/onboarding/[token]), Rechtstexte, API-Routen (/api, /api/v1)
ops/            Deploy, Backup/Restore, Housekeeping, RUNBOOK.md
e2e/, tests/    Playwright, vitest
```

## Rechtlicher Hinweis

Fairhours unterstützt den Arbeitgeber bei der Aufzeichnungspflicht nach § 26 AZG und zeigt Abweichungen von den gesetzlichen Grenzen. Die Verantwortung für die Einhaltung des Arbeitszeitrechts und die Bewertung von Zuschlägen (Kollektivvertrag) bleibt beim Arbeitgeber bzw. der Lohnverrechnung.
