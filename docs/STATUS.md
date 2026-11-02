# Status Log

> Append-only. Jeder Agent schreibt alle 30 Min einen Eintrag.

### 2026-05-13 15:50 | hermes-orchestrator
- Done: Repo-Initialisierung, PROJECT.md, AGENTS/*, docs/schema.sql, docs/api-contracts.md, docs/prompts/*, CI-Workflow.
- WIP: Next.js Skelett, Caddy/Compose-Deploy.
- Next: Push, Agents starten (manuell durch User in Orgo).
- Blocker: keine.

### 2026-11-02 13:40 | chief-of-staff-cloud (Zeitly)
- Done: apps/zeitly – AZG-konforme Zeiterfassung (PWA, Regelwerk, Zeitkonto, Monatsabschluss, Exporte LV/BH, Verwaltung, Import, Löschlauf, White-Label, Multi-Mandant). 39 Unit-/DB-Tests + 9 E2E grün gegen Production-Build. Schema `zt_*` im Supabase-Projekt zoantrfzmzhvrasuhvrd angelegt (Migration zeitly_0001_init). Rechtspaket deliverables/zeitly (8 Dokumente MD/DOCX/PDF). Ops: Dockerfile, Compose (Traefik, 2 Replikas, Backup/Housekeeping), RUNBOOK, CI-Workflow.
- WIP: Go-Live (DNS zeitly.malelu.io + VPS-Deploy) als LOKAL-Task 5e6dc0f5 in vault_agent_tasks; GitHub-Push/PR sobald die GitHub-App Zugriff auf vipeinvest/law-agent hat (derzeit 403).
- Next: Pilot mit STEINERfood (AVV + Pilotvereinbarung unterschreiben, Mitarbeiter einladen, erster Monatsabschluss), MALELU als zweiter Mandant.
- Blocker: GitHub-Zugriff (Peter), VPS/Cloudflare nur lokal erreichbar.
