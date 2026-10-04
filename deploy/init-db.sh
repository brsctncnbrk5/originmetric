#!/usr/bin/env bash
# Official PostgreSQL entrypoint runs this only on an empty OriginMetric volume.
set +x
set -Eeuo pipefail
[[ $APP_DB_PASSWORD =~ ^[a-f0-9]{64}$ ]] || exit 1
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE originmetric LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
ALTER DATABASE originmetric OWNER TO originmetric;
GRANT USAGE, CREATE ON SCHEMA public TO originmetric;
SQL
