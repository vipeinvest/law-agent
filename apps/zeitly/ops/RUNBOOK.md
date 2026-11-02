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
#   BOOTSTRAP_ORG_SLUG=steinerfood  BOOTSTRAP_ORG_NAME="STEINERfood GmbH"
#   BOOTSTRAP_OWNER_EMAIL=m.behr@steinerfood.com  BOOTSTRAP_OWNER_NAME="Manuela Behr"
docker network inspect traefik >/dev/null || docker network create traefik
export GIT_SHA=$(git rev-parse --short HEAD)
docker compose up -d --build --scale web=2
curl -fsS https://zeitly.malelu.io/api/health
```

Das Schema wurde bereits per Migration im Supabase-Projekt angelegt (`zeitly_0001_init`); die App prüft beim Start `zt_migrations` und spielt neue Migrationen automatisch ein.

Zweiten Mandanten (MALELU) anlegen: direkt in SQL (`insert into zt_orgs (slug,name) …; insert into zt_users (org_id,email,name,role) … 'owner'`) oder BOOTSTRAP-Variablen einmalig umstellen und neu starten.

## 3. Deploy eines Updates

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

- Housekeeping täglich: Login-Codes > 24 h, Sitzungen > 90 Tage, Mail-Log > 1 Jahr, Import-Jobs > 1 Jahr.
- Jährlicher Löschlauf (7 Jahre nach Jahresende, § 132 BAO): Einstellungen → „Aufbewahrung & Löschlauf" (nur Inhaber:in), mit Vorschau und Protokolleintrag.
- Datenauskunft/Export je Mitarbeiter:in: Profil → „Meine Aufzeichnungen" (§ 26 Abs 8 AZG, Art. 15/20 DSGVO).

## 8. Bekannte Grenzen (R2M-Status)

- Zuschlagshöhen (50 %/100 %, KV-Sonderregeln, Durchrechnungszeiträume) werden als Buckets geliefert, die Bewertung macht die Lohnverrechnung.
- KJBG (Jugendliche) und Mutterschutz-Sonderregeln sind nicht abgebildet.
- Kein Single-Sign-on, keine native App (PWA installierbar, Offline-Stempeln mit Nachsynchronisation).
- Supabase Free-Plan hat keine Point-in-Time-Recovery → eigenes Backup ist Pflicht; für zahlende Kunden Supabase Pro (PITR) oder eigenes Projekt je Kunde empfehlen.
