# Zeitly – Betriebshandbuch (Runbook)

Stand: November 2026 · Betreiber: MALELU AI · Produkt-Slug `zeitly` · Domain `zeitly.malelu.io`

## 1. Architektur

| Schicht | Komponente | Redundanz / Schutz |
|---|---|---|
| Edge | Cloudflare (DNS, Proxy, TLS, DDoS) | Anycast, Caching statischer Assets |
| App | 2 × Docker-Container `zeitly-web` hinter Traefik (Let's Encrypt), Health-Check `/api/health`, automatischer Neustart | Rolling-Restart ohne Ausfall, Container-Limits 512 MB |
| Daten | Supabase Postgres (Projekt `zoantrfzmzhvrasuhvrd`, eu-west-1 Irland), Tabellen `zt_*`, RLS ohne Policies (nur Service-Zugang) | Supabase-Infrastruktur + eigenes tägliches verschlüsseltes Backup (30 Tage) im Volume `zeitly-backups`, optional Off-site via rclone |
| Mail | Resend (Absender `notify@malelu.io`) | Fehler werden in `zt_mail_log` protokolliert |
| Jobs | Sidecar `zeitly-cron` (Backup 02:15, Housekeeping 03:45) | läuft unabhängig von den Web-Containern |

Alle Grenzwerte und Rechtsgrundlagen des Regelwerks: `src/domain/rules.ts`. Datenmodell: `src/db/migrations/0001_init.sql`.

## 2. Erstinstallation auf dem Traefik-VPS

```bash
# 1) DNS: Cloudflare → A-Record zeitly.malelu.io → <VPS-IP> (Proxy orange), wie hoststatement.malelu.io
# 2) VPS
ssh root@<traefik-vps>
git clone https://github.com/vipeinvest/law-agent.git /opt/law-agent   # Branch mit apps/zeitly
ln -s /opt/law-agent/apps/zeitly /opt/zeitly && cd /opt/zeitly
cp .env.example .env && nano .env
#   DATABASE_URL   = Supabase → Project Settings → Database → Connection string (Transaction pooler, Port 6543)
#   SESSION_SECRET = openssl rand -base64 48
#   CRON_SECRET    = openssl rand -hex 24
#   BACKUP_PASSPHRASE = openssl rand -base64 32   (SICHER ABLEGEN – ohne sie sind Backups wertlos)
#   RESEND_API_KEY = aus Resend (gleicher Key wie HostStatement/Fibuly)
#   APP_URL=https://zeitly.malelu.io, MAIL_FROM="Zeitly <notify@malelu.io>"
#   ZEITLY_SEED=production  (legt MALELU AI + STEINERfood GmbH an; KEINE Mails – ZEITLY_SEED_SEND bleibt 0)
#   ANTHROPIC_API_KEY = optional (Dokument-Extraktion im Onboarding, KI-Einordnung im Prüfbericht)
docker network inspect traefik >/dev/null || docker network create traefik
export GIT_SHA=$(git rev-parse --short HEAD)
docker compose up -d --build --scale web=2
curl -fsS https://zeitly.malelu.io/api/health
```

Das Schema wurde bereits per Migration im Supabase-Projekt angelegt (`zeitly_0001_init`, `zeitly_0002_onboarding_roster_api`); die App prüft beim Start `zt_migrations` und spielt neue Migrationen automatisch ein.

**Mandanten beim Erststart (`ZEITLY_SEED=production`, `src/db/seed-production.ts`):**

| Mandant | Login-URL | Personen |
| --- | --- | --- |
| MALELU AI (`malelu`) | https://zeitly.malelu.io/login?org=malelu | Peter Vitzthum – Inhaber (office@malelu.io), Admin (vipeinvestag@gmail.com) |
| STEINERfood GmbH (`steinerfood`) | https://zeitly.malelu.io/login?org=steinerfood | Inge Monika Steiner & Matthias Steiner – Inhaber (Platzhalter-Adressen `inge.steiner@` / `matthias.steiner@steinerfood.com`, **inaktiv** bis bestätigt → Admin → Mitarbeiter → aktivieren/E-Mail korrigieren); Manuela Behr – Admin + erste Mitarbeiterin, **ohne** automatische Mail; Fragebogen-Link und Zugangs-Einladung schickt Peter erst nach Abstimmung mit STEINERfood von Hand (Admin → Mitarbeiter → Person → Onboarding → „Link senden“ bzw. Einladung) |

Der Seed ist idempotent: vorhandene Mandanten/Personen werden nie überschrieben; Mails gehen nur mit `ZEITLY_SEED_SEND=1` beim ersten Anlegen raus (Standard: aus). **Regel (Peter, 02.11.2026): Nichts an die STEINERfood-Geschäftsführung oder Manuela senden, bevor der Pilot ausgemacht ist.** Weitere Mitarbeiter:innen legt Manuela selbst an (Admin → Mitarbeiter → Neu, „Fragebogen senden“ ist vorausgewählt).

## 3. Deploy eines Updates

**Per GitHub Actions (empfohlen):** Actions → „Zeitly Deploy" → Run workflow (Branch wählen, Replikas 2). Nutzt dieselben Secrets wie der bestehende Deploy-Workflow (`VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`); beim allerersten Lauf kann der komplette Inhalt der `.env` als Secret `ZEITLY_ENV` hinterlegt werden, er wird nur geschrieben, wenn auf dem VPS noch keine `.env` liegt. Der Workflow klont/aktualisiert `/opt/law-agent`, legt `/opt/zeitly` an, baut das Image, startet `web` (2×) und `cron` und prüft `/api/health`.

**Per SSH (manuell):**

```bash
ssh root@<traefik-vps> 'cd /opt/zeitly && ./ops/deploy.sh'
```
`deploy.sh` zieht den Branch, baut das Image, startet die zwei Web-Replikas rollierend und prüft `/api/health`.

## 4. Monitoring & Checks

- `GET /api/health` → `{ ok, db, dbMs, mail, problems[] }`; `ok=false` bei fehlender Konfiguration oder DB-Fehler (HTTP 503). In Uptime-Monitor (z. B. Cloudflare Health Check / Betterstack) eintragen, Intervall 1 min.
- `docker compose ps`, `docker compose logs -f web`
- Backup-Log: `docker compose exec cron cat /backups/backup.log`
- Mail-Fehler: `select * from zt_mail_log where status='failed' order by created_at desc`

## 5. Backup & Restore

- Täglich 02:15 Uhr: `ops/backup.sh` → `pg_dump` der `zt_*`-Tabellen, gzip, AES-256 (gpg symmetric), 30 Tage Aufbewahrung, Integritätstest nach jedem Lauf.
- Off-site: `BACKUP_RCLONE_REMOTE` setzen (z. B. Hetzner Storage Box oder Cloudflare R2) – dann wird jede Sicherung zusätzlich kopiert.
- **Wiederherstellungstest vierteljährlich** (Löschkonzept): `ops/restore.sh <datei> <leere Test-DB-URL>` ausführen und in `docs/STATUS.md` protokollieren.
- Disaster Recovery: neues Supabase-Projekt oder beliebiges Postgres 15+, Migration läuft beim App-Start, danach `restore.sh` einspielen, `DATABASE_URL` tauschen, `deploy.sh`.

## 6. Sicherheit

- Login nur per E-Mail-Einmalcode (6 Stellen, 10 min, max. 5 Versuche, Rate-Limit je E-Mail/IP); Sitzungen 30 Tage, httpOnly/SameSite=Lax/Secure.
- CSP, HSTS, X-Frame-Options DENY, keine Third-Party-Skripte, keine Tracker.
- Rollen: owner/admin/manager/payroll/employee; serverseitige Prüfung in jeder Route; Mitarbeiter sehen nur eigene Daten.
- Alle schreibenden Aktionen im Audit-Log (`zt_audit_log`, append-only aus Sicht der App).
- Secrets ausschließlich in `.env` auf dem VPS (Rechte 600) – nie im Repo.
- Incident: Container stoppen (`docker compose stop web`), Session-Tabelle leeren (`delete from zt_sessions`), Ursache analysieren, Kunden binnen 24 h informieren (AVV), Datenschutzbehörde ggf. binnen 72 h.

## 7. Datenschutz-Automatik

- Housekeeping täglich (Cron-Sidecar 03:45 → `POST /api/internal/housekeeping`): Login-Codes > 24 h, Sitzungen > 90 Tage, Mail-Log > 1 Jahr, Import-Jobs > 1 Jahr; außerdem **Auto-Übernahme Dienstplan** für Personen mit „automatisch übernehmen“ (veröffentlichte Schichten der letzten 7 Tage ohne Buchung → Ist-Buchung Quelle `plan`, protokolliert als `plan.auto_adopt`).
- Onboarding-Dokumente (Ausweisfotos usw.) liegen als bytea in `zt_files` (max. 8 MB, SHA-256) – Löschung über den Löschlauf bzw. beim Löschen der Person (cascade). Zugriff nur für Admin/Inhaber und die Person selbst über den Fragebogen-Link.
- Jährlicher Löschlauf (7 Jahre nach Jahresende, § 132 BAO): Einstellungen → „Aufbewahrung & Löschlauf" (nur Inhaber:in), mit Vorschau und Protokolleintrag.
- Datenauskunft/Export je Mitarbeiter:in: Profil → „Meine Aufzeichnungen" (§ 26 Abs 8 AZG, Art. 15/20 DSGVO).

## 8. Schnittstelle Lohnverrechnung (API v1)

Dokumentation in `ops/API.md`. Schlüssel je Mandant unter Einstellungen → Schnittstelle (nur Inhaber:in); nur Hash gespeichert, Scopes pro Schlüssel, Widerruf sofort wirksam, `last_used_at` sichtbar. Für BMD/DATEV/Steuerberatung reicht in der Regel `read:payroll`.

## 9. Bekannte Grenzen (R2M-Status)

- Zuschlagshöhen (50 %/100 %, KV-Sonderregeln, Durchrechnungszeiträume) werden als Buckets geliefert, die Bewertung macht die Lohnverrechnung.
- KJBG (Jugendliche) wird im Onboarding erkannt (Alter < 18 → Hinweis), die KJBG-Grenzwerte selbst und Mutterschutz-Sonderregeln sind im Regelwerk nicht abgebildet.
- ÖGK-Anmeldung (ELDA) wird vorbereitet (Mindestangaben-PDF), nicht elektronisch übermittelt – das macht die Lohnverrechnung mit ihrer ELDA-Software.
- KI-Funktionen (Extraktion, Prüfbericht-Einordnung) sind Vorschläge; verbindlich wird nur, was Mitarbeiter:in bzw. Admin bestätigt.
- Kein Single-Sign-on, keine native App (PWA installierbar, Offline-Stempeln mit Nachsynchronisation).
- Supabase Free-Plan hat keine Point-in-Time-Recovery → eigenes Backup ist Pflicht; für zahlende Kunden Supabase Pro (PITR) oder eigenes Projekt je Kunde empfehlen.
