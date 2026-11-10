#!/usr/bin/env bash
# Die große Österreich-Expedition – deploy on the MALELU Traefik VPS with automatic rollback.
#
#   bash ops/deploy.sh [TAG]
#
# Runs from any checkout/release of apps/oesterreich. Builds the image oesterreich:TAG, starts it as
# container "oesterreich-web" (compose project "oesterreich") on the existing Traefik network and checks
#   1. the container health check (/health inside the container),
#   2. the Traefik route on this host (https://$OESTERREICH_HOST/health via 127.0.0.1:443).
# If either check fails, the previous release is started again (or the new container is removed
# when there was none), so other services on the host are never affected.
# Optional env: OESTERREICH_HOST (default oesterreich.malelu.io), TRAEFIK_NETWORK (auto: traefik-proxy|traefik),
#               TRAEFIK_ENTRYPOINT (websecure), TRAEFIK_CERTRESOLVER (letsencrypt), OESTERREICH_BASE (/opt/oesterreich)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${OESTERREICH_BASE:-/opt/oesterreich}"
HOST="${OESTERREICH_HOST:-oesterreich.malelu.io}"
TAG="${1:-}"
if [ -z "$TAG" ]; then
  TAG="$(git -C "$APP_DIR" rev-parse --short=12 HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
fi
TAG="$(printf '%s' "$TAG" | tr -cd 'A-Za-z0-9._-' | cut -c1-40)"
[ -n "$TAG" ] || { echo "invalid tag" >&2; exit 2; }

log() { printf '[oesterreich %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
mkdir -p "$BASE"

command -v docker >/dev/null || { log "docker not found – abort, nothing changed"; exit 2; }
docker compose version >/dev/null 2>&1 || { log "docker compose plugin not found – abort, nothing changed"; exit 2; }

# --- Traefik network --------------------------------------------------------------------------
NET="${TRAEFIK_NETWORK:-}"
if [ -z "$NET" ]; then
  for n in traefik-proxy traefik; do
    if docker network inspect "$n" >/dev/null 2>&1; then NET="$n"; break; fi
  done
fi
if [ -z "$NET" ] || ! docker network inspect "$NET" >/dev/null 2>&1; then
  log "no Traefik network (traefik-proxy/traefik) on this host – abort, nothing changed"
  exit 3
fi
if ! docker ps --filter "network=$NET" --format '{{.Image}} {{.Names}}' | grep -qi traefik; then
  log "warning: no running Traefik container found on network $NET"
fi
log "network=$NET host=$HOST tag=$TAG dir=$APP_DIR"

PREV_TAG="$(cat "$BASE/CURRENT" 2>/dev/null || true)"
PREV_DIR="$(cat "$BASE/CURRENT_DIR" 2>/dev/null || true)"

compose_up() { # $1 tag, $2 app dir
  OESTERREICH_TAG="$1" TRAEFIK_NETWORK="$NET" OESTERREICH_HOST="$HOST" \
    docker compose -p oesterreich -f "$2/docker-compose.yml" up -d --no-build --force-recreate --remove-orphans
}

wait_healthy() {
  local s="none"
  for _ in $(seq 1 30); do
    s="$(docker inspect -f '{{.State.Health.Status}}' oesterreich-web 2>/dev/null || echo none)"
    [ "$s" = "healthy" ] && return 0
    sleep 2
  done
  log "container health: $s"
  return 1
}

route_ok() {
  for _ in $(seq 1 15); do
    if curl -fsSk --max-time 5 --resolve "$HOST:443:127.0.0.1" "https://$HOST/health" 2>/dev/null | grep -q '"status":"ok"'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback() {
  if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$TAG" ] && docker image inspect "oesterreich:$PREV_TAG" >/dev/null 2>&1 && [ -f "$PREV_DIR/docker-compose.yml" ]; then
    log "ROLLBACK to $PREV_TAG"
    compose_up "$PREV_TAG" "$PREV_DIR" || true
    wait_healthy && log "rollback healthy" || log "rollback container not healthy – check 'docker logs oesterreich-web'"
  else
    log "ROLLBACK: no previous release – removing the new container"
    OESTERREICH_TAG="$TAG" TRAEFIK_NETWORK="$NET" docker compose -p oesterreich -f "$APP_DIR/docker-compose.yml" down --remove-orphans || true
  fi
  echo "$(date -Is) $TAG FAILED, rolled back to ${PREV_TAG:-nothing}" >> "$BASE/deploy.log"
}

# --- build & start -----------------------------------------------------------------------------
log "building image oesterreich:$TAG"
docker build --pull --build-arg GIT_SHA="$TAG" -t "oesterreich:$TAG" "$APP_DIR"

log "starting container"
if ! compose_up "$TAG" "$APP_DIR"; then
  rollback
  exit 1
fi
if ! wait_healthy; then
  docker logs --tail 40 oesterreich-web 2>&1 || true
  rollback
  exit 1
fi
log "container healthy"
if ! route_ok; then
  log "Traefik route https://$HOST/health not reachable on this host (router not picked up?)"
  rollback
  exit 1
fi
log "Traefik route ok"

if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$TAG" ]; then
  echo "$PREV_TAG" > "$BASE/PREVIOUS"
  echo "$PREV_DIR" > "$BASE/PREVIOUS_DIR"
fi
echo "$TAG" > "$BASE/CURRENT"
echo "$APP_DIR" > "$BASE/CURRENT_DIR"
ln -sfn "$APP_DIR" "$BASE/current"
echo "$(date -Is) $TAG deployed (previous: ${PREV_TAG:-none})" >> "$BASE/deploy.log"

# --- public check through Cloudflare (informational: DNS may still be missing) ------------------
if curl -fsS --max-time 10 "https://$HOST/health" 2>/dev/null | grep -q '"status":"ok"'; then
  log "public check ok: https://$HOST"
else
  log "warning: public URL https://$HOST not reachable yet (Cloudflare DNS record for $HOST missing or certificate pending)"
fi

# --- housekeeping: keep the 5 newest images and releases -----------------------------------------
docker images oesterreich --format '{{.CreatedAt}}|{{.Tag}}' | sort -r | awk -F'|' 'NR>5 {print $2}' | while read -r old; do
  [ "$old" = "$TAG" ] || [ "$old" = "$PREV_TAG" ] || docker rmi "oesterreich:$old" >/dev/null 2>&1 || true
done
if [ -d "$BASE/releases" ]; then
  ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +6 | while read -r d; do
    [ "${d%/}" = "$APP_DIR" ] || [ "${d%/}" = "$PREV_DIR" ] || rm -rf "$d"
  done
fi
log "deploy $TAG ok"
