#!/usr/bin/env bash
# Local-only preparation. No remote creation/upload/retention; private age key stays offline.
source "$(dirname "$0")/common.sh"
OM_MODE=${1:---inventory}
[[ $OM_MODE == --inventory || $OM_MODE == --measure || $OM_MODE == --encrypt-local ]] || fail 'Use --inventory, --measure or --encrypt-local'
OM_PATHS=(
  opt/originmetric/.env.production
  opt/originmetric/.runtime/current-tag
  opt/originmetric/deploy
  opt/originmetric/scripts/vps
  etc/nginx/sites-available/originmetric
  etc/nginx/sites-available/originmetric-default-deny
  etc/nginx/originmetric-proxy-token.conf
  etc/originmetric/firewall
  etc/systemd/system/originmetric-firewall.service
  etc/systemd/system/originmetric-web-firewall.service
  etc/cron.d/originmetric-cert-renew
  usr/local/sbin/originmetric-firewall
  usr/local/sbin/originmetric-web-firewall
  usr/local/sbin/originmetric-web-firewall-rollback
)
for OM_PATH in "${OM_PATHS[@]}"; do
  [[ -e /$OM_PATH ]] || fail "Recovery member missing: $OM_PATH"
done
if [[ $OM_MODE == --inventory ]]; then
  printf '%s\n' 'Planned DB: production pg_dump -Fc, streamed to age.'
  printf '%s\n' 'Planned configuration members (encrypted separately; values never printed):'
  printf '%s\n' "${OM_PATHS[@]}"
  printf '%s\n' 'Excludes private decryption key, GitHub credentials, shared ACME keys, other projects and host-wide archives.'
  exit 0
fi
load_env
lock_ops
need docker; need tar
export APP_TAG=$(cat .runtime/current-tag)
if [[ $OM_MODE == --measure ]]; then
  OM_DB_BYTES=$(dc exec -T db pg_dump -U originmetric -d originmetric -Fc --no-owner --no-acl | wc -c)
  OM_CONFIG_BYTES=$(tar -C / -cf - -- "${OM_PATHS[@]}" | wc -c)
  printf 'DB custom-dump bytes: %s\nConfiguration tar bytes: %s\n' "$OM_DB_BYTES" "$OM_CONFIG_BYTES"
  exit 0
fi
need age
[[ ${AGE_RECIPIENT:-} =~ ^age1[0-9a-z]+$ ]] || fail 'Provision the offline-owned public age recipient first'
export APP_TAG=$(cat .runtime/current-tag)
OM_STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OM_DEST="$OM_ROOT/backups/recovery-$OM_STAMP"
mkdir -p "$OM_DEST"
chmod 700 "$OM_DEST"
OM_COMPLETE=no
cleanup() {
  if [[ $OM_COMPLETE != yes ]]; then
    rm -f -- "$OM_DEST/database.dump.age" "$OM_DEST/configuration.tar.age"
    printf '%s\n' 'Local encrypted recovery preparation FAILED' >&2
  fi
}
trap cleanup EXIT
# No plaintext dump/config tar is persisted, and no provider or notification is contacted.
dc exec -T db pg_dump -U originmetric -d originmetric -Fc --no-owner --no-acl |
  age -r "$AGE_RECIPIENT" > "$OM_DEST/database.dump.age"
tar -C / -cf - -- "${OM_PATHS[@]}" |
  age -r "$AGE_RECIPIENT" > "$OM_DEST/configuration.tar.age"
[[ -s "$OM_DEST/database.dump.age" && -s "$OM_DEST/configuration.tar.age" ]] || fail 'Empty encrypted recovery object'
(
  cd "$OM_DEST"
  sha256sum database.dump.age configuration.tar.age > SHA256SUMS
)
OM_COMPLETE=yes
printf '%s\n' "$OM_DEST" > .runtime/recovery-local-path
printf '%s\n' 'LOCAL ENCRYPTED objects prepared; no off-VPS upload or restore verification claimed.'
