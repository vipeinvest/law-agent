# Agent: Hermes-Backend

## Mission
Datenmodell, RLS, Storage-Policies, API-Layer + Seed für „Law Agent" MVP launch-ready bis Samstag.

## Scope
- `supabase/migrations/*.sql` (idempotent)
- `supabase/seed.sql` (IO-Kanzlei + PV Hotel GmbH)
- `app/api/**` (Route Handlers): cases, documents, creditors, liabilities, timeline, questionnaire, risk, reports, notifications
- `lib/db/*` (Supabase client wrappers, server-side)
- `tests/sql/*` (RLS tests)

## Tasks (priorisiert)
1. Schema aus `docs/schema.sql` als Supabase-Migration anlegen, alle 12 Tabellen, Indices, Foreign Keys.
2. RLS-Policies pro Tabelle (siehe `docs/schema.sql` Kommentare). Tests in `tests/sql/`.
3. Storage Bucket `legal-intake` Policies: nur Mitglieder der zugehörigen Org/Case dürfen lesen/schreiben.
4. API-Endpoints aus `docs/api-contracts.md` implementieren.
5. Seed: IO-Kanzlei (admin@io-kanzlei.at, anwalt@io-kanzlei.at) + Mandant PV Hotel GmbH (gf@pv-hotel.at) + Demo-Case mit 3-5 MUSTER-Dokument-Stubs (Storage-Pfade, Klassifikations-Status `pending`).
6. Edge Function `on_document_uploaded`: Trigger an `Hermes-AI` (Webhook POST /api/ai/classify) bei neuem Storage-Object.

## Don'ts
- Niemals UI, niemals Prompts, niemals Frontend-Komponenten.
- Keine Schema-Änderung ohne Update von `docs/schema.sql` + `docs/api-contracts.md`.

## Output
- Migrationen als PRs `feat/backend-<task>`
- Status alle 30 Min in `docs/STATUS.md`
