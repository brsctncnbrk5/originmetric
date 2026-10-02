#!/usr/bin/env bash
# CI ONLY: isolated ephemeral Docker project, fake offline key and local rclone remote.
source "$(dirname "$0")/common.sh"
[[ ${CI:-} == true ]] || fail 'This destructive ephemeral-fixture helper is CI-only'
need age; need rclone; need docker
bash scripts/vps/init-env.sh
load_env
export APP_TAG=$(git rev-parse HEAD)
cleanup_ci() {
  dc down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f .env.production
}
trap cleanup_ci EXIT
bash scripts/deploy.sh "$APP_TAG"
# Validate the authenticated host-nginx listener without publishing ports.
INGEST_PROXY_TOKEN=$INGEST_PROXY_TOKEN docker run --rm -e INGEST_PROXY_TOKEN \
  -v "$OM_ROOT/deploy/Caddyfile.nginx:/etc/caddy/Caddyfile:ro" caddy:2.11.2-alpine \
  caddy validate --config /etc/caddy/Caddyfile
# Validate the optional public Caddy config with a synthetic cert, without publishing ports.
mkdir -p secrets/cloudflare
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=ci.originmetric.invalid \
  -keyout secrets/cloudflare/origin.key -out secrets/cloudflare/origin.crt >/dev/null 2>&1
chmod 600 secrets/cloudflare/origin.key
OM_DOMAIN=ci.originmetric.invalid INGEST_PROXY_TOKEN=$INGEST_PROXY_TOKEN docker run --rm \
  -e OM_DOMAIN=ci.originmetric.invalid -e INGEST_PROXY_TOKEN \
  -v "$OM_ROOT/deploy/Caddyfile.public:/etc/caddy/Caddyfile:ro" \
  -v "$OM_ROOT/secrets/cloudflare:/certs:ro" caddy:2.11.2-alpine \
  caddy validate --config /etc/caddy/Caddyfile
[[ $(dc exec -T app id -u) != 0 ]] || fail 'App is root'
for OM_SERVICE in db app; do
  OM_ID=$(dc ps -q "$OM_SERVICE")
  [[ $(docker inspect --format '{{json .HostConfig.PortBindings}}' "$OM_ID") == '{}' || $(docker inspect --format '{{json .HostConfig.PortBindings}}' "$OM_ID") == null ]] || fail "$OM_SERVICE port was published"
done
node scripts/vps/docker-dogfood-proof.mjs
mkdir -p .runtime/offsite/originmetric
age-keygen -o .runtime/offline-test-key >/dev/null 2>&1
OM_RECIPIENT=$(age-keygen -y .runtime/offline-test-key)
OM_REMOTE_CONF=$OM_ROOT/.runtime/rclone-ci.conf
printf '[ci_local]\ntype = local\n' > "$OM_REMOTE_CONF"
export RCLONE_CONFIG=$OM_REMOTE_CONF
# Append only synthetic fixture config. Production never generates/stores an offline private key.
printf 'AGE_RECIPIENT=%s\nBACKUP_REMOTE=ci_local:%s/.runtime/offsite/originmetric\n' "$OM_RECIPIENT" "$OM_ROOT" >> .env.production
bash scripts/vps/backup.sh
OM_LATEST=$(find .runtime/offsite/originmetric/daily -type f -name '*.dump.age' | sort | tail -n 1)
age -d -i .runtime/offline-test-key "$OM_LATEST" | bash scripts/vps/restore-check.sh
# Encrypted upload failure must never be reported as a successful backup.
printf 'BACKUP_REMOTE=ci_missing:unavailable/originmetric\n' >> .env.production
if bash scripts/vps/backup.sh >/dev/null 2>&1; then fail 'Missing remote falsely reported backup success'; fi
printf '%s\n' 'Docker package / synthetic dogfood / encrypted backup / isolated restore / failure-path proof: PASS'
