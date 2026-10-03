#!/usr/bin/env python3
"""Read-only local backup watchdog. No email/independent dead-man delivery is implied."""
import datetime as dt
import json
from pathlib import Path
import subprocess

UTC = dt.timezone.utc
ROOT = Path(__file__).resolve().parents[2]


def stamp(value):
    try:
        result = dt.datetime.fromisoformat(value)
        return result if result.tzinfo and result.utcoffset() == dt.timedelta(0) else None
    except (TypeError, ValueError):
        return None


def evaluate(success, failure, now):
    ok = (success.get('result') == 'BACKUP_CREATED_REMOTE_READBACK_VERIFIED'
          and success.get('state') == 'verified')
    last = stamp(success.get('verified_at')) if ok else None
    failed = stamp(failure.get('failed_at'))
    if failed and (last is None or failed > last):
        return {'status': 'FAIL', 'code': 'BACKUP_JOB_FAILED'}
    if not last:
        return {'status': 'UNKNOWN', 'code': 'NO_VERIFIED_BACKUP'}
    if now < last:
        return {'status': 'UNKNOWN', 'code': 'FUTURE_BACKUP_TIMESTAMP'}
    if now - last > dt.timedelta(hours=26):
        return {'status': 'FAIL', 'code': 'BACKUP_MISSING_OR_STALE'}
    warning = any(w.get('code') == 'BACKUP_SIZE_JUMP' for w in success.get('warnings', [])
                  if isinstance(w, dict))
    return {'status': 'WARN' if warning else 'PASS',
            'code': 'BACKUP_SIZE_JUMP' if warning else 'FRESH_REMOTE_VERIFIED_BACKUP'}


def read(path):
    try:
        result = json.loads(path.read_text())
        return result if isinstance(result, dict) else {}
    except (OSError, ValueError):
        return {}


def main():
    now = dt.datetime.now(UTC)
    r = evaluate(read(ROOT / '.runtime/github-db/last-backup.json'),
                 read(ROOT / '.runtime/github-db/last-failure.json'), now)
    r.update({'checked_at': now.isoformat(), 'source': 'vps_local_readonly',
              'independent_missing_run_monitor': False, 'email_delivery_verified': False})
    p = subprocess.run(['systemctl', 'show', 'originmetric-github-backup.timer',
                        '-p', 'LastTriggerUSec', '--value'], stdout=subprocess.PIPE,
                       stderr=subprocess.DEVNULL, timeout=5)
    r['first_scheduled_backup'] = 'NOT_YET_OBSERVED' if not p.stdout.strip() else 'TRIGGER_SEEN_CHECK_SERVICE_RESULT'
    print(json.dumps(r, indent=2))
    return 1 if r['status'] in ('FAIL', 'UNKNOWN') else 0


if __name__ == '__main__':
    raise SystemExit(main())
