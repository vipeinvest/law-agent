#!/usr/bin/env bash
# Die große Österreich-Expedition – manual rollback to the previous release.
#   bash /opt/oesterreich/current/ops/rollback.sh        (or from any release directory)
# Swaps CURRENT and PREVIOUS in /opt/oesterreich and restarts the previous image.
set -euo pipefail
BASE="${OESTERREICH_BASE:-/opt/oesterreich}"
HOST="${OESTERREICH_HOST:-oesterreich.malelu.io}"
PREV_TAG="$(cat "$BASE/PREVIOUS" 2>/dev/null || true)"
PREV_DIR="$(cat "$BASE/PREVIOUS_DIR" 2>/dev/null || true)"
CUR_TAG="$(cat "$BASE/CURRENT" 2>/dev/null || true)"
CUR_DIR="$(cat "$BASE/CURRENT_DIR" 2>/dev/null || true)"
if [ -z "$PREV_TAG" ] || [ ! -f "$PREV_DIR/docker-compose.yml" ]; then
  echo "no previous release recorded in $BASE – to take the game offline: docker compose -p oesterreich -f $CUR_DIR/docker-compose.yml down"
  exit 1
fi
NET="${TRAEFIK_NETWORK:-}"
if [ -z "$NET" ]; then
  for n in traefik-proxy traefik; do docker network inspect "$n" >/dev/null 2>&1 && { NET="$n"; break; }; done
fi
echo "rolling back $CUR_TAG -> $PREV_TAG (network $NET)"
OESTERREICH_TAG="$PREV_TAG" TRAEFIK_NETWORK="$NET" OESTERREICH_HOST="$HOST" \
  docker compose -p oesterreich -f "$PREV_DIR/docker-compose.yml" up -d --no-build --force-recreate --remove-orphans
for _ in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' oesterreich-web 2>/dev/null)" = "healthy" ] && break
  sleep 2
done
docker inspect -f 'oesterreich-web: {{.State.Health.Status}} ({{.Config.Image}})' oesterreich-web
echo "$PREV_TAG" > "$BASE/CURRENT"; echo "$PREV_DIR" > "$BASE/CURRENT_DIR"
echo "$CUR_TAG" > "$BASE/PREVIOUS"; echo "$CUR_DIR" > "$BASE/PREVIOUS_DIR"
echo "$(date -Is) manual rollback $CUR_TAG -> $PREV_TAG" >> "$BASE/deploy.log"
