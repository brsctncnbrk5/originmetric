#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
load_env
OM_DEFAULT_URL=http://127.0.0.1:$OM_HTTP_PORT
if [[ ${OM_INGRESS:-local} == public ]]; then OM_DEFAULT_URL=https://$OM_DOMAIN; fi
OM_URL=${1:-$OM_DEFAULT_URL}
[[ $OM_URL == http://127.0.0.1:* || $OM_URL == https://* ]] || fail 'Smoke needs loopback HTTP or HTTPS'
[[ $(curl -fsS --max-time 10 "$OM_URL/api/health") == '{"status":"ok"}' ]] || fail 'Health/DB check failed'
curl -fsS --max-time 10 "$OM_URL/js/v1/om.js" >/dev/null
[[ $(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$OM_URL/internal/projects/00000000-0000-4000-8000-000000000000") == 404 ]] || fail 'Internal page must be blocked'
[[ $(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$OM_URL/api/internal/metrics") == 404 ]] || fail 'Metrics must be private'
[[ $(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$OM_URL/fixtures/basic") == 404 ]] || fail 'Non-consent fixture must be blocked'
[[ $(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: text/plain' --data '{}' "$OM_URL/api/v1/e") == 202 ]] || fail 'Ingestion drop response failed'
printf '%s\n' 'Smoke PASS: DB health, tracker, private routes, consent fixture guard, ingestion drop.'
