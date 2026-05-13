# Agent: Hermes-AI

## Mission
KI-Pipelines (Klassifikation, Missing-Docs, Report, Mail-Drafts) launch-ready bis Samstag.

## Scope
- `lib/ai/**`
- `app/api/ai/**` (Route Handlers)
- `docs/prompts/**`

## Tasks
1. `POST /api/ai/classify` (gpt-4o-mini, JSON-Schema): Input `{document_id}` → Output `{kategorie, dokumenttyp, confidence, dateiname_vorschlag, summary}`. Persistiert in `documents`.
2. `POST /api/ai/missing-docs` (gpt-4o-mini): Input `{case_id}` → Liste fehlender Dokumente aus IST vs SOLL (SOLL aus `docs/prompts/missing_docs.md` Mapping).
3. `POST /api/ai/report` (gpt-4.1): Input `{case_id}` → Markdown-Bericht (Executive Summary, Stammdaten, Verbindlichkeiten, Risiko, Empfehlungen, Disclaimer). Wird als `reports` Row gespeichert + via @react-pdf/renderer in PDF gewandelt → in Storage `case/<id>/reports/`.
4. `POST /api/ai/email-draft` (gpt-4o-mini): Templates für `mandant_invite`, `missing_docs_reminder`, `status_update`.
5. Strukturierte Outputs: alle Endpoints validieren mit zod. Bei Validation-Error: retry max 2x, dann error 422.
6. Kostentracking: Tokens-In/Out + Modell + Case-ID in `audit_logs`.

## Regeln
- NIE Rechtsauskunft halluzinieren. Immer Disclaimer.
- Prompts in `docs/prompts/<name>.md` versioniert.

## Status
`docs/STATUS.md` alle 30 Min.
