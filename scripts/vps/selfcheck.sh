#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
load_env
export APP_TAG=$(cat .runtime/current-tag)
OM_FAILED=0
bash scripts/vps/smoke.sh || OM_FAILED=1
OM_DISK=$(df -P "$OM_ROOT" | awk 'NR==2 {gsub(/%/,"",$5);print $5}')
if (( OM_DISK > 80 )); then printf '%s\n' 'WARNING: filesystem over 80%' >&2; OM_FAILED=1; fi
# Metrics accessed inside the app; no token in argv/output or public exposure.
dc exec -T app node --input-type=module - <<'JS' || OM_FAILED=1
const r = await fetch('http://127.0.0.1:3000/api/internal/metrics', {
  headers: {authorization: `Bearer ${process.env.INTERNAL_TOKEN}`}, signal: AbortSignal.timeout(5000)
});
if (!r.ok) process.exit(1);
const {ingestion} = await r.json();
const keys = ['dropped_process_limit','dropped_project_limit','dropped_client_limit','dropped_daily_limit','dropped_limit_capacity','dropped_untrusted_proxy','dropped_internal'];
const alerts = Object.fromEntries(keys.filter(k=>ingestion[k]>0).map(k=>[k,ingestion[k]]));
console.log(JSON.stringify({abuse_or_failure_counters: alerts}));
if (Object.keys(alerts).length) process.exit(1);
JS
if [[ -n ${SELFCHECK_URL:-} ]]; then
  OM_SUFFIX=''; if (( OM_FAILED )); then OM_SUFFIX=/fail; fi
  curl -fsS --max-time 10 "$SELFCHECK_URL$OM_SUFFIX" >/dev/null 2>&1 || OM_FAILED=1
fi
exit "$OM_FAILED"
