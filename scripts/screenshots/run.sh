#!/usr/bin/env bash
# Recapture every desktop screenshot from a seeded demo environment.
#
# Usage: scripts/screenshots/run.sh [image]
#   image  Traefik Manager image to shoot (default: the :dev beta image)
#
# Boots Traefik + TM on a private docker network, seeds realistic demo data
# (routes, middlewares, certs, access log), drives headless Chrome through
# every tab and modal in both themes, and installs the results into
# docs/public/images plus the README carousel GIFs. Never touches git.
set -euo pipefail

IMAGE="${1:-100.77.202.80:9999/traefik-manager:dev}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'docker rm -f tmshot-app tmshot-traefik >/dev/null 2>&1; docker network rm tmshot-net >/dev/null 2>&1; rm -rf "$WORK"' EXIT

mkdir -p "$WORK/config" "$WORK/traefik" "$WORK/out/dark" "$WORK/out/light"
cp "$HERE/config/dynamic.yml" "$WORK/config/"
cp "$HERE/traefik/traefik.yml" "$WORK/traefik/"
sed '/certResolver: letsencrypt/d' "$HERE/config/dynamic.yml" > "$WORK/traefik/dynamic.yml"

HASH=$(docker run --rm --entrypoint python3 "$IMAGE" -c \
  "import bcrypt; print(bcrypt.hashpw(b'screenshots', bcrypt.gensalt()).decode())")
{ cat "$HERE/config/manager.yml"; echo "password_hash: $HASH"; echo "must_change_password: false"; } \
  > "$WORK/config/manager.yml"

docker run --rm -v "$WORK/config:/data" -v "$HERE/gen_data.py:/gen.py:ro" \
  --entrypoint python3 "$IMAGE" /gen.py

docker network create tmshot-net >/dev/null
docker run -d --name tmshot-traefik --network tmshot-net \
  -v "$WORK/traefik:/etc/traefik:ro" traefik:v3.6 >/dev/null
docker run -d --name tmshot-app --network tmshot-net \
  -v "$WORK/config:/config" \
  -e CONFIG_PATH=/config/dynamic.yml \
  -e SETTINGS_PATH=/config/manager.yml \
  "$IMAGE" >/dev/null
sleep 10

docker run --rm --network tmshot-net \
  -v "$HERE:/s:ro" -v "$WORK/out:/out" -w /tmp -e HOME=/tmp node:22-bookworm sh -c '
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2 libatspi2.0-0 fonts-liberation >/dev/null 2>&1
npx --yes puppeteer browsers install chrome >/dev/null 2>&1
npm install --silent puppeteer >/dev/null 2>&1
node /s/capture.mjs'

docker run --rm -v "$WORK/out:/new:ro" -v "$REPO/docs/public/images:/img" \
  -v "$HERE/install_images.py:/install.py:ro" python:3-slim sh -c '
pip install -q pillow >/dev/null 2>&1 && python3 /install.py'

echo "Done. Review with: git -C $REPO status docs/public/images"
