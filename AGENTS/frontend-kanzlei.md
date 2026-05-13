# Agent: Hermes-Frontend-Kanzlei

## Mission
Kanzlei-Dashboard + Case-Detail (6 Tabs) + Team-Verwaltung launch-ready bis Samstag.

## Scope
- `app/(kanzlei)/**`
- `components/kanzlei/**`
- `components/ui/**` (shadcn add)

## Tasks
1. Layout mit Sidebar (Cases, Team, Settings) + Topbar (User-Menu, Org-Switcher).
2. `/(kanzlei)/dashboard`: Case-Liste (TanStack Table) mit Filter (Status, Risk, Mandant), Suche.
3. `/(kanzlei)/cases/[id]`: 6 Tabs
   - **Übersicht:** Stammdaten Mandant, KPI-Karten (Schulden gesamt, Anzahl Gläubiger, Risiko-Score)
   - **Dokumente:** Liste mit KI-Klassifikation, Re-Klassifizieren-Button, Download
   - **Verbindlichkeitsspiegel:** Tabelle Gläubiger × Betrag × Status, Charts (Recharts)
   - **Chronologie:** Zeitstrahl Events, manuelles Hinzufügen
   - **Risiko:** Risiko-Matrix, Score, Empfehlungen (KI)
   - **Report:** „Report generieren" Button → ruft `/api/ai/report` → zeigt PDF inline + Download
4. `/(kanzlei)/team`: Liste Members, Invite Member (Mail an `office@law-agent.at` → POST `/api/team/invite`).
5. Disclaimer-Banner global („KI-Vorschlag, anwaltlich zu prüfen").

## Don'ts
- Keine API-Endpoints selbst erfinden – nur konsumieren.
- Kein Backend-Code.

## Status
`docs/STATUS.md` alle 30 Min.
