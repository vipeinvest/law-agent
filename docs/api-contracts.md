# API Contracts (Source of Truth)

Alle Endpoints unter `/api/*`. Authentifizierung via Supabase Session-Cookie (`@supabase/ssr`).

Schemas in TypeScript via `zod`. Bei Änderung → Backend-PR + Doku-Update in einem Commit.

## Auth
Wird via Supabase Auth gehandhabt. Keine eigenen Endpoints im MVP.

## Organizations
- `GET /api/organizations/me` → eigene Org + Rolle
- `PATCH /api/organizations/me` → kanzlei_admin only

## Cases
- `GET /api/cases` (Kanzlei: alle der Kanzlei-Org; Mandant: nur eigene)
- `POST /api/cases` (kanzlei_admin|kanzlei_user) `{mandant_org_id, case_number}`
- `GET /api/cases/[id]` → Case mit aggregierten Counts
- `PATCH /api/cases/[id]` → status, responsible_user_id, summary, risk_score

## Documents
- `GET /api/cases/[id]/documents`
- `POST /api/cases/[id]/documents` (Multipart oder presigned URL) → erzeugt Storage-Pfad, Row, triggert Klassifikation
- `PATCH /api/documents/[id]` → category, doc_type, status, proposed_filename
- `DELETE /api/documents/[id]`
- `POST /api/documents/[id]/reclassify` → ruft Hermes-AI

## Creditors / Liabilities / Timeline / Questionnaire / Risk
- Standard CRUD `/api/cases/[id]/<entity>` (GET, POST) und `/api/<entity>/[id]` (PATCH, DELETE)

## Missing Docs
- `GET /api/cases/[id]/missing-docs` → Liste fehlender SOLL-Dokumente (von Hermes-AI berechnet, gecached)

## Reports
- `POST /api/cases/[id]/reports` → generiert neue Version (gpt-4.1) → Markdown + PDF
- `GET /api/cases/[id]/reports` → Liste Versionen
- `GET /api/reports/[id]` → Detail inkl. signed URL für PDF

## Notifications / Mails
- `POST /api/notifications` (server-only, via Edge Function) → SMTP-Versand + IMAP-Sync + Log

## AI (interne Endpoints, called server-side)
- `POST /api/ai/classify` `{document_id}` → siehe `docs/prompts/classify.md`
- `POST /api/ai/missing-docs` `{case_id}` → siehe `docs/prompts/missing_docs.md`
- `POST /api/ai/report` `{case_id}` → siehe `docs/prompts/report.md`
- `POST /api/ai/email-draft` `{template, context}` → siehe `docs/prompts/email_*.md`

## Conventions
- Alle POST/PATCH: JSON body
- Errors: RFC7807 (`application/problem+json`)
- Pagination: `?limit=20&cursor=...`
- Timestamps: ISO 8601 UTC
