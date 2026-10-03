#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
load_env
[[ ${1:-} == --already-locked ]] || lock_ops
need docker; need age; need rclone; need sha256sum
[[ $AGE_RECIPIENT == age1* ]] || fail 'Configure AGE_RECIPIENT with an offline-owned public key'
[[ $BACKUP_REMOTE =~ ^[A-Za-z0-9_-]+:[A-Za-z0-9_./-]+/originmetric$ ]] || fail 'BACKUP_REMOTE must end in a dedicated /originmetric prefix'
export APP_TAG=${APP_TAG:-$(cat .runtime/current-tag)}
ping_check() { if [[ -n ${HEALTHCHECKS_URL:-} ]]; then curl -fsS --max-time 10 "${HEALTHCHECKS_URL}${1:-}" >/dev/null 2>&1 || return 1; fi; }
ping_check /start
mkdir -p backups
OM_STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
OM_WORK=$(mktemp -d)
cleanup_backup() {
  OM_RESULT=$?
  rm -rf "$OM_WORK"
  if (( OM_RESULT != 0 )); then ping_check /fail || true; printf '%s\n' 'Backup FAILED' >&2; fi
}
trap cleanup_backup EXIT
# Consistent logical snapshot; never save a plaintext dump to disk.
# Tar stream carries pg_dump output only. age encrypts before any persisted file.
dc exec -T db pg_dump -U originmetric -d originmetric -Fc --no-owner --no-acl |
  age -r "$AGE_RECIPIENT" > "$OM_WORK/originmetric-$OM_STAMP.dump.age"
[[ -s "$OM_WORK/originmetric-$OM_STAMP.dump.age" ]] || fail 'Encrypted backup is empty'
OM_SIZE=$(stat -c %s "$OM_WORK/originmetric-$OM_STAMP.dump.age")
OM_HASH=$(sha256sum "$OM_WORK/originmetric-$OM_STAMP.dump.age" | awk '{print $1}')
OM_PREVIOUS=$(cat .runtime/last-backup-size 2>/dev/null || true)
if [[ $OM_PREVIOUS =~ ^[0-9]+$ && $OM_PREVIOUS -gt 0 ]]; then
  if (( OM_SIZE * 2 < OM_PREVIOUS || OM_SIZE * 2 > OM_PREVIOUS * 3 )); then
    printf '%s\n' 'WARNING: backup size changed by more than 50%; investigate.' >&2
  fi
fi
# Repeat uploads are idempotent by date/week/month. Retention touches only these owned names.
for OM_CLASS in daily weekly monthly; do
  case $OM_CLASS in
    daily) OM_DATE=$(date -u +%Y-%m-%d); OM_KEEP=7 ;;
    weekly) OM_DATE=$(date -u +%G-W%V); OM_KEEP=4 ;;
    monthly) OM_DATE=$(date -u +%Y-%m); OM_KEEP=2 ;;
  esac
  OM_NAME="originmetric-$OM_DATE.dump.age"
  rclone copyto "$OM_WORK/originmetric-$OM_STAMP.dump.age" "$BACKUP_REMOTE/$OM_CLASS/$OM_NAME"
  OM_REMOTE_SIZE=$(rclone ls "$BACKUP_REMOTE/$OM_CLASS/$OM_NAME" | awk '{print $1}')
  [[ $OM_REMOTE_SIZE == "$OM_SIZE" ]] || fail 'Off-VPS encrypted object size mismatch'
  # Stream remote ciphertext back; equal size alone cannot detect corruption.
  # pipefail preserves a failed/truncated read even if sha256sum exits successfully.
  OM_READBACK_HASH=$(rclone cat "$BACKUP_REMOTE/$OM_CLASS/$OM_NAME" | sha256sum | awk '{print $1}')
  [[ $OM_READBACK_HASH == "$OM_HASH" ]] || fail 'Off-VPS encrypted object hash mismatch'
  # Obtain listing exit status separately; process substitution must not hide rclone failures.
  rclone lsf "$BACKUP_REMOTE/$OM_CLASS" --files-only --include 'originmetric-*.dump.age' > "$OM_WORK/list"
  mapfile -t OM_FILES < <(sort -r "$OM_WORK/list")
  for (( OM_I=OM_KEEP; OM_I<${#OM_FILES[@]}; OM_I++ )); do
    OM_OLD_FILE=${OM_FILES[$OM_I]}
    [[ $OM_OLD_FILE =~ ^originmetric-[0-9TWZ-]+\.dump\.age$ ]] || fail 'Unexpected retention filename'
    rclone deletefile "$BACKUP_REMOTE/$OM_CLASS/$OM_OLD_FILE"
  done
done
mv "$OM_WORK/originmetric-$OM_STAMP.dump.age" "backups/originmetric-$OM_STAMP.dump.age"
mapfile -t OM_LOCAL < <(find backups -maxdepth 1 -type f -name 'originmetric-*.dump.age' -printf '%f\n' | sort -r)
for (( OM_I=7; OM_I<${#OM_LOCAL[@]}; OM_I++ )); do rm -- "backups/${OM_LOCAL[$OM_I]}"; done
printf '%s\n' "$OM_SIZE" > .runtime/last-backup-size
ping_check
trap - ERR
printf '%s\n' 'Encrypted off-VPS backup CREATED. Restore verification is a separate operation.'
