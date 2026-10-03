#!/usr/bin/env python3
"""Read-only P2 semantic baseline and snapshot evidence; never writes application data."""
import argparse
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('receiver', ROOT / 'scripts/vps/restore-phone.py')
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


def sql(statement):
    p = subprocess.run(['docker', 'exec', '-i', 'originmetric-db-1', 'psql', '-X', '-q',
                        '-U', 'originmetric', '-d', 'originmetric', '-At', '-v', 'ON_ERROR_STOP=1'],
                       input=statement, text=True, capture_output=True, timeout=20)
    if p.returncode:
        raise ValueError('Read-only query failed; diagnostic values suppressed')
    return p.stdout.strip()


def private_json(path):
    path = path.resolve()
    if not path.is_relative_to((ROOT / '.runtime').resolve()) or path.is_symlink():
        raise ValueError('Evidence must be a private runtime file')
    return json.loads(path.read_text())


def validate_window(before, after, backup):
    if (before['row_counts'] != after['row_counts']
            or before['acceptance_assertions'] != after['acceptance_assertions']
            or before['deployed_source_sha'] != after['deployed_source_sha']):
        raise ValueError('Counts/source/semantics changed across backup; repeat quiescent window')
    if (backup.get('result') != 'BACKUP_CREATED_REMOTE_READBACK_VERIFIED'
            or backup.get('state') != 'verified'):
        raise ValueError('Remote backup/readback is not verified')
    stamps = [dt.datetime.fromisoformat(v) for v in
              [before['observed_at'], backup['captured_at'], backup['verified_at'], after['observed_at']]]
    if any(t.utcoffset() != dt.timedelta(0) for t in stamps) or stamps != sorted(stamps):
        raise ValueError('Snapshot/readback must fall inside UTC pre/post evidence window')
    if (not re.fullmatch(r'[0-9a-f]{40}', backup.get('source_sha', ''))
            or not re.fullmatch(r'[0-9a-f]{64}', backup.get('sha256', ''))
            or not re.fullmatch(r'om-db-v1-\d{8}T\d{6}Z-[0-9a-f]{8}', backup.get('snapshot', ''))):
        raise ValueError('Invalid snapshot/source/hash metadata')
    receiver.verify_acceptance_metrics(after['acceptance_assertions']['expected_metrics'],
                                       after['acceptance_assertions'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--before', type=Path, help='Earlier private baseline; requires verified backup in its window')
    args = parser.parse_args()
    os.umask(0o077)
    try:
        plan = private_json(args.plan)
        label = plan['label']
        config = (ROOT / '.env.production').read_text()
        site = re.search(r'^OM_DOGFOOD_SITE_KEY=[\'"]?(pk_[A-Za-z0-9]{22})[\'"]?$', config, re.M)
        if not site:
            raise ValueError('Registered dogfood site missing')
        project = sql("SELECT id FROM projects WHERE site_key='" + site[1]
                      + "' AND deleted_at IS NULL AND allowed_domains=ARRAY['originmetric.app'];")
        query = receiver.acceptance_metrics_query(project, label)
        metrics = json.loads(sql(query))
        assertions = dict(project_id=project, campaign=label, expected_metrics=metrics)
        receiver.verify_acceptance_metrics(metrics, assertions)
        counts = {t: int(sql('SELECT count(*) FROM public.' + receiver.identifier(t)))
                  for t in receiver.TABLES}
        if sql('SELECT count(*) FROM revenue_events WHERE NOT test') != '0':
            raise ValueError('Unlabelled revenue prevents test-only snapshot acceptance')
        tag = (ROOT / '.runtime/current-tag').read_text().strip()
        result = dict(kind='PRIVATE_READONLY_BASELINE', observed_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                      deployed_source_sha=tag, row_counts=counts, acceptance_assertions=assertions,
                      production_sql_writes=False, actual_restore_verified=False)
        if args.before:
            before = private_json(args.before)
            backup = private_json(ROOT / '.runtime/github-db/last-backup.json')
            validate_window(before, result, backup)
            check = subprocess.run(['git', 'diff', '--exit-code', tag, backup['source_sha'], '--',
                                    'src', 'tracker', 'drizzle'], cwd=ROOT, capture_output=True)
            if check.returncode:
                raise ValueError('Snapshot source differs from tested deployed application/schema')
            result.update(kind='PRIVATE_POPULATED_SNAPSHOT_PREPARED', snapshot=backup['snapshot'],
                          sha256=backup['sha256'], source_sha=backup['source_sha'],
                          remote_hash_and_manifest_match=True, expected_row_counts=counts,
                          require_populated_test_restore=True)
        out = args.plan.resolve().parent / ('snapshot-evidence-' if args.before else 'pre-backup-')
        out = out.with_name(out.name + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
        with out.open('x') as f:
            json.dump(result, f, indent=2); f.write('\n')
        print(json.dumps({'result': result['kind'], 'private_evidence': str(out),
                          'production_sql_writes': False, 'restore_verified': False}))
        return 0
    except Exception:
        print(json.dumps({'result': 'PREPARATION_BLOCKED', 'reason':
                          'No valid populated labelled chain or matching snapshot window; no values disclosed',
                          'production_sql_writes': False, 'restore_verified': False}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
