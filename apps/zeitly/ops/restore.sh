#!/bin/sh
# Restore test / disaster recovery: ops/restore.sh /backups/zeitly-YYYYMMDD-HHMMSS.sql.gz.gpg "$TARGET_DATABASE_URL"
# Restores into TARGET (use an empty database or a Supabase branch for the quarterly restore test).
set -eu
FILE=${1:?backup file}; TARGET=${2:?target DATABASE_URL}
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE missing}"
gpg --batch --quiet --decrypt --passphrase "$BACKUP_PASSPHRASE" "$FILE" | gunzip | psql "$TARGET" -v ON_ERROR_STOP=1
echo "restore ok -> $TARGET"
