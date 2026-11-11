#!/bin/sh
# Triggers the in-app housekeeping (login codes 24 h, sessions 90 d, mail log 1 y).
set -eu
: "${CRON_SECRET:?CRON_SECRET missing}"
curl -fsS -m 60 -X POST -H "Authorization: Bearer $CRON_SECRET" "http://web:3000/api/internal/housekeeping" && echo " $(date -Iseconds) housekeeping ok"
