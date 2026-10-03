#!/usr/bin/env python3
import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import sys

sys.dont_write_bytecode = True
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('github-backup.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
NOW = dt.datetime(2026, 10, 3, 2, tzinfo=b.UTC)


def release(rid, stamp, state='verified'):
    tag = 'om-db-v1-' + stamp.strftime('%Y%m%dT%H%M%SZ') + '-deadbeef'
    classes = ['daily']
    if stamp.weekday() == 6:
        classes.append('weekly')
    if stamp.day == 1:
        classes.append('monthly')
    m = dict(managed_by=b.MARKER, snapshot=tag, captured_at=stamp.isoformat(), state=state,
             classes=classes, sha256='a' * 64, size_bytes=100)
    return dict(id=rid, name=tag, tag_name=tag, draft=True, body=json.dumps(m),
                assets=[{'id': rid * 10 + 1, 'name': 'database.dump.age'},
                        {'id': rid * 10 + 2, 'name': 'SHA256SUMS'}])


class RetentionTests(unittest.TestCase):
    def test_counts_calendar_periods_and_latest_duplicate(self):
        items = [release(i + 1, NOW - dt.timedelta(days=i)) for i in range(80)]
        items.append(release(100, NOW + dt.timedelta(minutes=1)))  # future not deleted
        old_duplicate = release(101, NOW - dt.timedelta(minutes=1))
        items.append(old_duplicate)
        removed = {r['id'] for r in b.retention(items, NOW, 1)}
        self.assertIn(101, removed)
        self.assertNotIn(100, removed)
        kept = [r for r in items[:-2] if r['id'] not in removed]
        self.assertLessEqual(len(kept), 13)
        for kind, limit in [('daily', 7), ('weekly', 4), ('monthly', 2)]:
            eligible = [(r, *b.metadata(r)) for r in items[:-2] if kind in b.metadata(r)[0]['classes']]
            period = lambda date: date.strftime({'daily':'%Y-%m-%d','weekly':'%G-W%V','monthly':'%Y-%m'}[kind])
            periods = sorted({period(stamp) for _, _, stamp in eligible}, reverse=True)[:limit]
            for p in periods:
                self.assertTrue(any(r['id'] not in removed and period(stamp) == p for r, _, stamp in eligible))

    def test_absolute_90_days_and_partial_grace(self):
        items = [release(1, NOW), release(2, NOW - dt.timedelta(days=90)),
                 release(3, NOW - dt.timedelta(days=2), 'pending'),
                 release(4, NOW - dt.timedelta(hours=1), 'pending')]
        self.assertEqual({r['id'] for r in b.retention(items, NOW, 1)}, {2, 3})

    def test_unrelated_phone_unmarked_extra_asset_and_published_protected(self):
        current = release(1, NOW)
        cases = [release(i, NOW - dt.timedelta(days=100)) for i in range(2, 7)]
        cases[0]['tag_name'] = 'phone-recovery-original'
        cases[1]['body'] = '{}'
        cases[2]['assets'].append({'id': 44, 'name': 'unrelated.txt'})
        cases[3]['draft'] = False
        cases[4]['body'] = 'not-json'
        self.assertEqual(b.retention([current] + cases, NOW, 1), [])

    def test_github_temporary_draft_tag_requires_exact_own_title(self):
        r = release(1, NOW)
        r['tag_name'] = 'untagged-' + 'a' * 20
        self.assertIsNotNone(b.metadata(r))
        r['name'] = 'unrelated release'
        self.assertIsNone(b.metadata(r))

    def test_no_prune_without_verified_current(self):
        with self.assertRaises(b.BackupError):
            b.retention([release(1, NOW, 'pending')], NOW, 1)
        with self.assertRaises(b.BackupError):
            b.retention([], NOW, 1)

    def test_old_verified_snapshot_cannot_authorize_cleanup(self):
        with self.assertRaises(b.BackupError):
            b.retention([release(1, NOW - dt.timedelta(days=2))], NOW, 1)

    def test_bad_date_class_marker_and_duplicate_assets_rejected(self):
        for field, value in [('managed_by', 'other'), ('classes', ['daily', 'weekly']),
                             ('captured_at', 'bad-date'), ('sha256', 'bad-hash')]:
            r = release(1, NOW)
            m = json.loads(r['body']);m[field] = value;r['body'] = json.dumps(m)
            self.assertIsNone(b.metadata(r))
        r = release(1, NOW);r['assets'].append(r['assets'][0])
        self.assertIsNone(b.metadata(r))


class FakeGitHub:
    def __init__(self, corrupt=False):
        self.corrupt = corrupt
        self.objects = {}
        self.release = None
        self.deleted = []
        self.visibility_checks = 0
        self.old = release(2, dt.datetime.now(b.UTC) - dt.timedelta(days=100))

    def private(self):
        self.visibility_checks += 1

    def api(self, path, method='GET', payload=None, upload=None, output=None):
        if upload:
            aid = len(self.objects) + 1
            data = upload.read_bytes()
            self.objects[aid] = data
            self.release['assets'].append({'id': aid, 'name': upload.name})
            return {'id': aid}
        if output:
            aid = int(path.rsplit('/', 1)[1]); data = self.objects[aid]
            if self.corrupt:
                data = b'X' + data[1:]
            output.write(data)
            return None
        if method == 'POST':
            self.release = dict(id=999, assets=[], html_url='https://github.com/example/release', **payload)
            return copy.deepcopy(self.release)
        if method == 'PATCH':
            self.release.update(payload)
            return copy.deepcopy(self.release)
        if method == 'DELETE':
            self.deleted.append(path)
            return None
        if path.endswith('/999'):
            return copy.deepcopy(self.release)
        return copy.deepcopy(self.old)

    def releases(self):
        return [copy.deepcopy(self.release), copy.deepcopy(self.old)]


class ChainTests(unittest.TestCase):
    def dump(self, args, **kwargs):
        self.assertIn('pg_dump', args[-1])
        self.assertNotIn('tar ', args[-1])
        kwargs['stdout'].write(b'age-encryption.org/v1\nsynthetic-encrypted-dump')
        class Result:
            returncode = 0
        return Result()

    def test_real_chain_control_with_doubles_success(self):
        gh = FakeGitHub()
        with tempfile.TemporaryDirectory() as folder, patch.object(b.subprocess, 'run', self.dump), patch.object(b.subprocess, 'check_output', return_value='a'*40):
            result = b.backup(gh, Path(folder))
        self.assertFalse(result['restore_verified'])
        self.assertEqual(result['pruned'], 1)
        self.assertEqual(len(gh.deleted), 1)
        self.assertGreaterEqual(gh.visibility_checks, 4)

    def test_corrupt_readback_never_marks_verified_or_prunes(self):
        gh = FakeGitHub(corrupt=True)
        with tempfile.TemporaryDirectory() as folder, patch.object(b.subprocess, 'run', self.dump), patch.object(b.subprocess, 'check_output', return_value='a'*40):
            with self.assertRaises(b.BackupError):
                b.backup(gh, Path(folder))
        self.assertEqual(gh.deleted, [])
        self.assertEqual(json.loads(gh.release['body'])['state'], 'pending')

    def test_dump_failure_does_not_create_release(self):
        gh = FakeGitHub()
        class Failed:
            returncode = 1
        with tempfile.TemporaryDirectory() as folder, patch.object(b.subprocess, 'run', return_value=Failed()):
            with self.assertRaises(b.BackupError):
                b.backup(gh, Path(folder))
        self.assertIsNone(gh.release)
        self.assertEqual(gh.deleted, [])

    def test_visibility_failure_prevents_upload(self):
        gh = FakeGitHub()
        gh.private = lambda: (_ for _ in ()).throw(b.BackupError('Not private'))
        with tempfile.TemporaryDirectory() as folder, patch.object(b.subprocess, 'run', self.dump), patch.object(b.subprocess, 'check_output', return_value='a'*40):
            with self.assertRaises(b.BackupError):
                b.backup(gh, Path(folder))
        self.assertIsNone(gh.release)

    def test_retention_detects_changed_assets_before_delete(self):
        gh = FakeGitHub()
        original = gh.api
        def changed(path, method='GET', payload=None, **kwargs):
            result = original(path, method, payload, **kwargs)
            if path == f'repos/{b.REPO}/releases/2' and method == 'GET':
                result['assets'].append({'id': 123, 'name': 'unrelated.txt'})
            return result
        gh.api = changed
        with tempfile.TemporaryDirectory() as folder, patch.object(b.subprocess, 'run', self.dump), patch.object(b.subprocess, 'check_output', return_value='a'*40):
            with self.assertRaises(b.BackupError):
                b.backup(gh, Path(folder))
        self.assertEqual(gh.deleted, [])


class GuardTests(unittest.TestCase):
    def test_operation_lock_blocks_before_any_github_request(self):
        import fcntl
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); (root / '.runtime').mkdir()
            with (root / '.runtime/operation.lock').open('a') as held:
                fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
                with patch.object(b, 'ROOT', root), patch.object(b, 'GitHub') as github, patch.object(sys, 'argv', ['backup']):
                    with self.assertRaises(SystemExit):
                        b.main()
                    github.assert_not_called()

    def test_missing_service_token_has_no_operator_fallback(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(b, 'AUTH', Path(folder)), patch.dict(b.os.environ, {'CREDENTIALS_DIRECTORY': folder}):
            with self.assertRaises(b.BackupError):
                b.GitHub(False)



if __name__ == '__main__':
    unittest.main()
