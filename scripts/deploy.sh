#!/usr/bin/env bash
source "$(dirname "$0")/vps/common.sh"
need git; need docker; need curl; need flock
load_env; lock_ops
OM_SHA=${1:-}
[[ $OM_SHA =~ ^[a-f0-9]{40}$ ]] || fail 'Usage: scripts/deploy.sh <full reviewed commit SHA>'
[[ $(git rev-parse HEAD) == "$OM_SHA" ]] || fail 'Checkout the exact reviewed commit first'
[[ $(git status --porcelain) == '' ]] || fail 'Working tree must be clean'
export APP_TAG=$OM_SHA
bash scripts/vps/preflight.sh
OM_OLD=$(cat .runtime/current-tag 2>/dev/null || true)
if [[ -n $OM_OLD ]]; then
  # Prevent rollback from silently dropping newly accepted daily-cap semantics.
  [[ $OM_OLD =~ ^[a-f0-9]{40}$ ]] || fail 'Invalid previous image tag'
  bash scripts/vps/predeploy-backup.sh
fi
# Build at exact SHA on the VPS; no GHCR account or paid build service required.
docker build --pull --tag "originmetric:$APP_TAG" .
dc run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile
dc up -d --wait --wait-timeout 120 db
dc run --rm --no-deps app node dist/ops.mjs migrate
rollback() {
  trap - ERR
  if [[ -n $OM_OLD ]]; then
    export APP_TAG=$OM_OLD
    dc up -d --no-deps app caddy || true
    if bash scripts/vps/smoke.sh; then
      printf '%s\n' 'Previous app restored. Forward-only migrations remain applied.' >&2
    else
      printf '%s\n' 'ROLLBACK HEALTH FAILED; inspect OriginMetric containers.' >&2
    fi
  else
    dc stop app caddy || true
    printf '%s\n' 'First deployment failed; app/proxy stopped, DB preserved.' >&2
  fi
  exit 1
}
trap rollback ERR
# Exact image, no second build and no restart of unrelated projects.
dc up -d app caddy
for OM_ATTEMPT in $(seq 1 30); do
  if dc exec -T app node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then break; fi
  sleep 2
done
bash scripts/vps/smoke.sh
printf '%s\n' "$APP_TAG" > .runtime/current-tag
if [[ -n $OM_OLD && $OM_OLD != "$APP_TAG" ]]; then printf '%s\n' "$OM_OLD" > .runtime/previous-tag; fi
trap - ERR
printf '%s\n' 'Deployment smoke PASS. Record VPS evidence; public G1/dogfood acceptance remains a separate step.'
