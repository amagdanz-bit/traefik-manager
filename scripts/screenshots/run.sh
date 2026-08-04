#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:-ghcr.io/chr0nzz/traefik-manager:beta}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
cleanup() {
  docker rm -f tmshot-app tmshot-traefik >/dev/null 2>&1 || true
  docker network rm tmshot-net >/dev/null 2>&1 || true
  docker run --rm -v "$WORK:/w" alpine rm -rf /w/node >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/config" "$WORK/traefik" "$WORK/out/dark" "$WORK/out/light"
cp "$HERE/config/dynamic.yml" "$WORK/config/"
cp "$HERE/traefik/traefik.yml" "$WORK/traefik/"
sed '/certResolver: letsencrypt/d' "$HERE/config/dynamic.yml" > "$WORK/traefik/dynamic.yml"

cp "$HERE/config/manager.yml" "$WORK/config/manager.yml"
cp "$HERE/config/traefik-static.yml" "$WORK/config/traefik-static.yml"

docker run --rm -v "$WORK/config:/data" -v "$HERE/gen_data.py:/gen.py:ro" \
  --entrypoint python3 "$IMAGE" /gen.py

docker run --rm -v "$WORK/config:/c" --entrypoint python3 "$IMAGE" -c "
import bcrypt, io
h = bcrypt.hashpw(b'screenshot-demo-password', bcrypt.gensalt(rounds=12)).decode()
base = io.open('/c/manager.yml', encoding='utf-8').read()
io.open('/c/manager-setup.yml', 'w', encoding='utf-8').write(
    base.replace('auth_enabled: false', 'auth_enabled: true')
        .replace('setup_complete: true', 'setup_complete: false'))
io.open('/c/manager-login.yml', 'w', encoding='utf-8').write(
    base.replace('auth_enabled: false', 'auth_enabled: true')
    + '\npassword_hash: ' + h + '\n')
"

docker network create tmshot-net >/dev/null
docker run -d --name tmshot-traefik --network tmshot-net \
  -v "$WORK/traefik:/etc/traefik:ro" traefik:v3.6 >/dev/null

SETUP_PW=screenshot-demo-password

start_app() {
  docker rm -f tmshot-app >/dev/null 2>&1 || true
  docker run -d --name tmshot-app --network tmshot-net \
    -v "$WORK/config:/config" \
    -e CONFIG_PATH=/config/dynamic.yml \
    -e SETTINGS_PATH="$1" \
    -e STATIC_CONFIG_PATH=/config/traefik-static.yml \
    ${2:+-e ADMIN_PASSWORD=$2} \
    "$IMAGE" >/dev/null
  sleep 10
}

capture() {
  docker run --rm --network tmshot-net \
    -v "$HERE:/s:ro" -v "$WORK/out:/out" -v "$WORK/node:/tmp/node" -w /tmp -e HOME=/tmp node:22-bookworm sh -c "
if [ ! -d /tmp/node/node_modules ]; then
  apt-get update -qq >/dev/null 2>&1
  apt-get install -y -qq libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 fonts-liberation >/dev/null 2>&1
  npx --yes puppeteer browsers install chrome >/dev/null 2>&1
  cd /tmp/node && npm install --silent puppeteer >/dev/null 2>&1
else
  apt-get update -qq >/dev/null 2>&1
  apt-get install -y -qq libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 fonts-liberation >/dev/null 2>&1
  npx --yes puppeteer browsers install chrome >/dev/null 2>&1
fi
cp /s/$1 /tmp/node/run.mjs
cd /tmp/node && node run.mjs"
}

mkdir -p "$WORK/node"

start_app /config/manager.yml
capture capture.mjs

start_app /config/manager-setup.yml "$SETUP_PW"
capture capture_setup.mjs

start_app /config/manager-login.yml
capture capture_login.mjs

docker run --rm -v "$WORK/out:/new:ro" -v "$REPO/docs/public/images:/img" \
  -v "$HERE/install_images.py:/install.py:ro" python:3-slim sh -c '
pip install -q pillow >/dev/null 2>&1 && python3 /install.py'

echo "Done. Review with: git -C $REPO status docs/public/images"
