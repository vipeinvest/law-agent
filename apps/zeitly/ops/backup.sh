#!/bin/sh
# Logical backup of the zt_* tables (Supabase/Postgres) – encrypted with BACKUP_PASSPHRASE, 30-day retention,
# optional off-site copy via rclone remote (BACKUP_RCLONE_REMOTE, e.g. "hetzner-storagebox:zeitly").
set -eu
: "${DATABASE_URL:?DATABASE_URL missing}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE missing}"
DIR=/backups
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$DIR/zeitly-$STAMP.sql.gz.gpg"
mkdir -p "$DIR"
# pooler URIs (port 6543) are fine for pg_dump of a few tables; session pooler recommended for large DBs
pg_dump "$DATABASE_URL" --no-owner --no-privileges --data-only=false \
  -t 'zt_*' | gzip -9 | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "$OUT"
SIZE=$(stat -c %s "$OUT")
echo "$(date -Iseconds) backup ok $OUT ($SIZE bytes)"
# integrity check: decrypt + gunzip test
gpg --batch --quiet --decrypt --passphrase "$BACKUP_PASSPHRASE" "$OUT" | gunzip -t
find "$DIR" -name 'zeitly-*.sql.gz.gpg' -mtime +30 -delete
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$OUT" "$BACKUP_RCLONE_REMOTE" && echo "$(date -Iseconds) offsite copy ok"
fi
if [ -n "${BACKUP_HEALTHCHECK_URL:-}" ]; then curl -fsS -m 10 "$BACKUP_HEALTHCHECK_URL" >/dev/null || true; fi
