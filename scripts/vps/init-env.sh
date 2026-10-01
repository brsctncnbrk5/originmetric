#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
need flock; lock_ops
[[ ! -e .env.production ]] || fail '.env.production already exists; it was not changed'
need openssl
OM_DB_PASSWORD=$(openssl rand -hex 32)
OM_APP_PASSWORD=$(openssl rand -hex 32)
OM_INTERNAL_TOKEN=$(openssl rand -hex 32)
OM_PROXY_TOKEN=$(openssl rand -hex 32)
cat > .env.production <<ENV
POSTGRES_PASSWORD=$OM_DB_PASSWORD
APP_DB_PASSWORD=$OM_APP_PASSWORD
DATABASE_URL=postgres://originmetric:$OM_APP_PASSWORD@db:5432/originmetric
INTERNAL_TOKEN=$OM_INTERNAL_TOKEN
INGEST_PROXY_TOKEN=$OM_PROXY_TOKEN
INGEST_PROXY_MODE=cloudflare
LOG_LEVEL=info
OM_HTTP_PORT=8088
OM_DOMAIN=
OM_INGRESS=local
PUBLIC_G1_READY=no
AGE_RECIPIENT=
BACKUP_REMOTE=
HEALTHCHECKS_URL=
SELFCHECK_URL=
ENV
chmod 600 .env.production
printf '%s\n' 'Production secrets generated; values were not printed. Save .env.production in your password manager.'
