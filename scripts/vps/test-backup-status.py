#!/usr/bin/env python3
import datetime as dt
import importlib.util
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('status', Path(__file__).with_name('check-backup-status.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
NOW = dt.datetime(2026, 10, 3, 15, tzinfo=dt.timezone.utc)


def backup(hours=1, **extra):
    return dict(result='BACKUP_CREATED_REMOTE_READBACK_VERIFIED', state='verified',
                verified_at=(NOW-dt.timedelta(hours=hours)).isoformat(), **extra)


class WatchdogTests(unittest.TestCase):
    def test_fresh_and_stale_boundary(self):
        self.assertEqual(s.evaluate(backup(26), {}, NOW)['status'], 'PASS')
        self.assertEqual(s.evaluate(backup(27), {}, NOW)['code'], 'BACKUP_MISSING_OR_STALE')

    def test_failure_supersedes_older_success(self):
        self.assertEqual(s.evaluate(backup(), {'failed_at': NOW.isoformat()}, NOW)['code'], 'BACKUP_JOB_FAILED')
        old = {'failed_at': (NOW-dt.timedelta(hours=2)).isoformat()}
        self.assertEqual(s.evaluate(backup(), old, NOW)['status'], 'PASS')

    def test_unknown_and_future_not_healthy(self):
        self.assertEqual(s.evaluate({}, {}, NOW)['status'], 'UNKNOWN')
        self.assertEqual(s.evaluate(backup(-1), {}, NOW)['status'], 'UNKNOWN')
        self.assertEqual(s.evaluate({'result': 'encrypted_only'}, {}, NOW)['status'], 'UNKNOWN')

    def test_size_warning_is_not_silently_healthy(self):
        self.assertEqual(s.evaluate(backup(warnings=[{'code': 'BACKUP_SIZE_JUMP'}]), {}, NOW)['status'], 'WARN')


if __name__ == '__main__':
    unittest.main()
