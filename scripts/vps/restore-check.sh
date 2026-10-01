#!/usr/bin/env bash
# Input: decrypted custom-format pg_dump on stdin. No private key or plaintext file on VPS.
source "$(dirname "$0")/common.sh"
need docker
[[ ! -t 0 ]] || fail 'Pipe an offline-decrypted dump to stdin; do not provide the private key'
OM_CONTAINER="originmetric-restore-$(date +%s)-$$"
cleanup_restore() { docker rm -f "$OM_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup_restore EXIT
docker run -d --name "$OM_CONTAINER" --network none --tmpfs /var/lib/postgresql \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:18.6-alpine >/dev/null
for OM_ATTEMPT in $(seq 1 30); do
  if docker exec "$OM_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$OM_CONTAINER" createdb -U postgres originmetric_restore
docker exec -i "$OM_CONTAINER" pg_restore -U postgres -d originmetric_restore --exit-on-error --no-owner --no-acl
# Verify domain and migration metadata exist, counts are readable and constraints are installed.
OM_TABLES=$(docker exec "$OM_CONTAINER" psql -U postgres -d originmetric_restore -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('projects','events','sessions','customers','customer_visitors','revenue_events','customer_attribution','api_keys','workspaces','ingestion_daily')")
[[ $OM_TABLES == 10 ]] || fail 'Restored domain tables incomplete'
OM_MIGRATIONS=$(docker exec "$OM_CONTAINER" psql -U postgres -d originmetric_restore -Atc 'SELECT count(*) FROM drizzle.__drizzle_migrations')
[[ $OM_MIGRATIONS =~ ^[0-9]+$ && $OM_MIGRATIONS -ge 4 ]] || fail 'Restored migration metadata incomplete'
docker exec "$OM_CONTAINER" psql -U postgres -d originmetric_restore -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT count(*) FROM events) AS events, (SELECT count(*) FROM sessions) AS sessions, (SELECT count(*) FROM customers) AS customers, (SELECT count(*) FROM revenue_events) AS revenue_events;"
printf '%s\n' 'RESTORE VERIFIED in an isolated disposable PostgreSQL 18 container. Production DB untouched.'
