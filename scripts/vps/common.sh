#!/usr/bin/env bash
# Sourced by operator scripts. Never run with xtrace: secrets are loaded here.
set +x
set -Eeuo pipefail
OM_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$OM_ROOT"
umask 077
fail() { printf '%s\n' "ERROR: $*" >&2; exit 1; }
load_env() {
  [[ -f .env.production ]] || fail 'Run scripts/vps/init-env.sh first'
  [[ $(stat -c '%a' .env.production) == 600 ]] || fail '.env.production must have mode 600'
  set -a
  # Generated locally, shell-safe hex credentials. Operator config is trusted.
  source .env.production
  set +a
}
dc() {
  local OM_COMPOSE_ARGS=(--env-file "$OM_ROOT/.env.production" -f "$OM_ROOT/deploy/compose.yml")
  if [[ ${OM_INGRESS:-local} == public ]]; then
    [[ ${PUBLIC_G1_READY:-no} == yes ]] || fail 'Public ingress requires verified G1 evidence'
    OM_COMPOSE_ARGS+=(-f "$OM_ROOT/deploy/compose.public.yml")
  elif [[ ${OM_INGRESS:-local} == nginx ]]; then
    OM_COMPOSE_ARGS+=(-f "$OM_ROOT/deploy/compose.nginx.yml")
  elif [[ ${OM_INGRESS:-local} != local ]]; then fail 'Unknown OM_INGRESS'; fi
  docker compose "${OM_COMPOSE_ARGS[@]}" "$@"
}
need() { command -v "$1" >/dev/null || fail "Missing command: $1"; }
lock_ops() {
  mkdir -p .runtime
  exec 9>.runtime/operation.lock
  flock -n 9 || fail 'Another deploy/backup operation is running'
}
