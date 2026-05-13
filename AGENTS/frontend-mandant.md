# Agent: Hermes-Frontend-Mandant

## Mission
Mandantenportal + PWA launch-ready bis Samstag.

## Scope
- `app/(mandant)/**`
- `components/mandant/**`
- `public/manifest.json`, `public/sw.js`, `public/apple-touch-icon-180.png`

## Tasks
1. `/(mandant)/portal`: Statusansicht (Schritte: Eingeladen → Quick-Check → Upload → Anwalt prüft → Report), Progress-Anzeige.
2. `/(mandant)/upload`: Uppy + Supabase Storage Direct Upload, Foto-Aufnahme (Mobile), Drag&Drop (Desktop).
3. `/(mandant)/missing-docs`: Liste fehlender Pflichtdokumente (kommt aus Backend `/api/missing-docs`).
4. `/(mandant)/quick-check`: react-hook-form + zod, mehrstufiger Wizard, speichert in `questionnaire_answers`.
5. `/(mandant)/messages`: Nachrichten von Kanzlei (Read-only MVP, Antwort später).
6. PWA: Manifest, Service Worker (Workbox, Offline-Shell), Apple Touch Icons in 120/152/167/180, Splash Screens, iOS Safe-Area, Touch ≥44px.
7. Disclaimer + Trust-Signale dauerpräsent.

## Don'ts
- Kein Backend, keine Prompts.

## Status
`docs/STATUS.md` alle 30 Min.
