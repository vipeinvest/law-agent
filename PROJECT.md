# Law Agent – Master Brief (Source of Truth)

> Multi-Agent Sprint Plan zur Lieferung eines launch-fähigen MVP bis Sa/So.
> Diese Datei ist die unverhandelbare Quelle der Wahrheit für alle Agents.

## Vision
LegalTech-Plattform für österreichische Kanzleien zur strukturierten, KI-gestützten Aufnahme von Insolvenz-/Krisen-Mandaten. Kanzlei + Mandant arbeiten gemeinsam an einem digitalen Akt; KI klassifiziert Dokumente, erkennt fehlende Unterlagen, erstellt Verbindlichkeitsspiegel + Chronologie + Status-Report.

## MVP Scope (Sa/So launch-ready)

### Pflicht
1. **Auth & Tenancy:** Supabase Auth mit Rollen `super_admin`, `kanzlei_admin`, `kanzlei_user`, `mandant`. Strikte RLS-Trennung.
2. **Kanzlei-Dashboard:** Case-Liste, Filter, Suche, Case-Detail mit 6 Tabs.
3. **Mandantenportal:** Status, Upload, Missing Docs, Krisen-Quick-Check, Nachrichten. PWA.
4. **Dokumenten-Upload:** Drag & Drop (Web), Foto/Datei (Mobile). Storage `legal-intake`.
5. **KI-Klassifikation:** `gpt-4o-mini` → Kategorie, Dokumenttyp, Confidence, Dateinamen-Vorschlag.
6. **Missing-Docs-Analyse:** Vergleich IST vs SOLL pro Fallkategorie.
7. **Verbindlichkeitsspiegel + Chronologie + Risiko-Matrix:** strukturierte Daten, manuell/KI gefüllt.
8. **Report-Generator:** `gpt-4.1` → PDF (Executive Summary, Kapitel, Disclaimer).
9. **E-Mail-Funnel:** Einladung, Missing-Docs-Mahnung, Status, Launch-Mail via SMTP `office@law-agent.at` + IMAP-Sync „Sent".
10. **Audit-Log + Backups + Disclaimer-Banner.**
11. **Demo-Daten:** IO-Kanzlei + PV Hotel GmbH (alle Dokumente als MUSTER).

### Sprint 2 (nach Launch)
- Multi-Kanzlei-Self-Service-Onboarding, Pricing/Stripe, Skribble eSig, DocRaptor-PDF, Custom Domains pro Kanzlei, OCR-Fallback Tesseract.

## Stack
- **Frontend:** Next.js 14 App Router, TypeScript strict, Tailwind, **shadcn/ui**, TanStack Table v8, Recharts, react-hook-form + zod, Uppy, Workbox.
- **Backend:** Next.js Route Handlers, Supabase (Postgres + Auth + Storage + Edge Functions), Node 20.
- **KI:** OpenAI (`gpt-4o-mini`, `gpt-4.1`), strukturierte Outputs via JSON Schema/zod.
- **Mail:** SMTP/IMAP Hostinger (office@law-agent.at).
- **Infra:** Hostinger VPS Ubuntu 24.04, Docker, Docker Compose, Caddy (Auto-HTTPS), ClamAV, daily backups.
- **CI/CD:** GitHub Actions → SSH-Deploy.

## Branding
- Primary `#4F46E5` (Indigo 600)
- Text `#0F172A` (Slate 900)
- Background `#FAFAF9` (Stone 50)
- Accent `#10B981` (Emerald 500)
- Logo: `public/brand/logo.svg` (Wortmarke + Schild-Icon mit KI-Punkt-Cluster)
- Sprache: Deutsch (AT)

## Domänen-Trennung der Agents
| Agent | Pfade |
|---|---|
| Backend | `app/api/*`, `lib/db/*`, `supabase/*`, `tests/sql/*` |
| Frontend Kanzlei | `app/(kanzlei)/*`, `components/kanzlei/*` |
| Frontend Mandant | `app/(mandant)/*`, `components/mandant/*`, `public/manifest.json`, `public/sw.js` |
| AI | `lib/ai/*`, `app/api/ai/*`, `docs/prompts/*` |
| Orchestrator (Hermes) | Infra, CI/CD, Caddy, VPS, `docs/STATUS.md`, Statusmails, QA-Gate |

## Regeln für alle Agents
1. **Repo ist Source of Truth.** Branches feat/<domäne>-<task>. PR nach main. CI muss grün.
2. **Schnittstellen-Verträge** in `docs/api-contracts.md` immer aktuell halten. Wer einen Endpoint braucht, der noch nicht existiert: PR auf api-contracts.md zuerst.
3. **Schema-Änderungen** ausschließlich via Backend-Agent. Andere Agents committen niemals auf `supabase/migrations/` oder `docs/schema.sql`.
4. **Secrets** niemals im Code. Nur via env. Beispielwerte in `.env.example`.
5. **Sprache:** deutsch (AT) im UI. Englisch in Code/Commits/Docs.
6. **Disclaimer-Banner** dauerpräsent: „KI-Vorschlag, anwaltlich zu prüfen. Keine Rechtsberatung."
7. **Statusupdate** alle 30 Min in `docs/STATUS.md` (Append-only Log, Format unten).
8. **Blocker** → GitHub Issue mit Label `blocker` + Mention `@hermes-orchestrator`.

## STATUS.md Format
```
### YYYY-MM-DD HH:MM | <agent-name>
- Done: ...
- WIP: ...
- Next: ...
- Blocker: keine | <text>
```

## Definition of Done (Samstag)
- [ ] Landing live (`https://www.law-agent.at`)
- [ ] App live (`https://app.law-agent.at`), PWA installierbar
- [ ] Demo-Logins funktionieren (IO-Kanzlei + PV Hotel)
- [ ] Upload → KI-Klassifikation → Case-Detail
- [ ] Verbindlichkeitsspiegel, Chronologie, Missing-Docs
- [ ] Report-Generator → PDF
- [ ] E-Mail-Funnel komplett
- [ ] Backup + Audit-Log
- [ ] Lighthouse Performance > 85, Accessibility > 90
- [ ] Launch-Mail an peter@heutal.at
