# REA (Reverse Engineer Anything) – Installation bei MALELU

Quelle: https://github.com/morluto/rea (MIT) · npm `rea-agents` (Stand 13.10.2026: v6.4.0)
Skill-Version: 37 (aus dem npm-Paket kopiert, nicht verändert).

## Was hier liegt
- `SKILL.md` + `references/*.md`: die Skill-Anleitung. Sie wird von Claude Code automatisch geladen,
  **registriert aber nicht den REA-MCP-Server** (siehe SKILL.md „Connect only when needed").

## Vollinstallation auf Peters PC (LOKAL, Cody)
```bash
# Node >= 22.19 erforderlich
npx -y rea-agents@latest setup          # registriert MCP-Server für Claude Code/Codex/Cursor/Gemini CLI + Skill
npx -y rea-agents@latest doctor         # prüft Engines (Ghidra/Hopper/IDA optional)
```
Optional: Ghidra (kostenlos) installieren, damit native Binaries dekompiliert werden können.
Ohne Engine funktionieren: JavaScript/Electron-Apps (ASAR), Go/.NET/Flutter-Statik, APK/IPA-Inventar,
Browser-/Electron-Laufzeitbeobachtung, HAR-Captures.

## Nutzung
In Claude Code: „Reverse engineer <Pfad/App>" – der Skill wählt das richtige Tool (`open_binary`,
`analyze_javascript_application`, `inspect_android_package`, …).

## Grenzen (verbindlich)
Nur eigene Software, Open-Source oder Software mit ausdrücklicher Analyse-Erlaubnis.
Keine Umgehung von Lizenz-/Kopierschutz, keine Fremd-Apps zum Nachbau ohne Freigabe.
