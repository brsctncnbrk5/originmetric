#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
need git; need docker; need curl; need flock
load_env
export APP_TAG=${APP_TAG:-preflight}
docker compose version >/dev/null
docker info >/dev/null 2>&1 || fail 'Docker daemon unavailable'
[[ $(git status --porcelain) == '' ]] || fail 'Working tree is not clean'
[[ $POSTGRES_PASSWORD =~ ^[a-f0-9]{64}$ ]] || fail 'Invalid generated DB secret'
[[ $APP_DB_PASSWORD =~ ^[a-f0-9]{64}$ ]] || fail 'Invalid generated app DB secret'
[[ $INTERNAL_TOKEN =~ ^[a-f0-9]{64}$ ]] || fail 'Invalid generated internal token'
[[ $INGEST_PROXY_TOKEN =~ ^[a-f0-9]{64}$ ]] || fail 'Invalid generated proxy token'
[[ $INGEST_PROXY_MODE == cloudflare ]] || fail 'Use cloudflare proxy mode for the production package'
[[ $DATABASE_URL == "postgres://originmetric:$APP_DB_PASSWORD@db:5432/originmetric" ]] || fail 'DB configuration mismatch'
[[ $OM_HTTP_PORT =~ ^[0-9]{4,5}$ && $OM_HTTP_PORT -le 65535 ]] || fail 'Invalid loopback review port'
if [[ ${OM_INGRESS:-local} == public ]]; then
  [[ $OM_DOMAIN =~ ^[a-zA-Z0-9.-]+$ && $OM_DOMAIN == *.* ]] || fail 'Invalid public hostname'
  [[ -f secrets/cloudflare/origin.crt && -f secrets/cloudflare/origin.key ]] || fail 'Origin TLS certificate/key required'
  [[ $(stat -c '%a' secrets/cloudflare/origin.key) == 600 ]] || fail 'TLS private key must have mode 600'
fi
dc config --quiet
printf '%s\n' 'Preflight PASS. No firewall, DNS, cron or existing service was changed.'
printf 'Memory available: '; awk '/MemAvailable/ {printf "%.1f GiB\n", $2/1024/1024}' /proc/meminfo
df -h "$OM_ROOT"
printf '%s\n' 'Review existing listeners before public ingress:'
ss -ltn '( sport = :80 or sport = :443 or sport = :8088 )'
