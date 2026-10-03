#!/usr/bin/env bash
# Called only while scripts/deploy.sh holds inherited operation.lock fd 9.
source "$(dirname "$0")/common.sh"
load_env
case ${BACKUP_BACKEND:-rclone} in
  rclone) bash scripts/vps/backup.sh --already-locked ;;
  github) python3 scripts/vps/github-backup.py --already-locked ;;
  *) fail 'Unknown backup backend; deployment stopped before build/migration' ;;
esac
