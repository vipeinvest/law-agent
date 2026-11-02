#!/usr/bin/env bash
# Zero-downtime-ish deploy on the Traefik VPS (two web replicas, rolling restart).
# Usage: ssh vps 'cd /opt/zeitly && ./ops/deploy.sh'   (first time: see ops/RUNBOOK.md)
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
export GIT_SHA=$(git rev-parse --short HEAD)
docker compose build --pull web
docker compose up -d --no-deps --scale web=2 web
docker compose up -d cron
sleep 5
docker compose ps
curl -fsS "https://${ZEITLY_HOST:-zeitly.malelu.io}/api/health" && echo && echo "deploy $GIT_SHA ok"
docker image prune -f >/dev/null
