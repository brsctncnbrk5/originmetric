#!/usr/bin/env python3
"""DB-only GitHub draft backup. Secrets are never arguments, output or Git objects."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
REPO = 'brsctncnbrk5/originmetric-recovery'
AUTH = ROOT / '.runtime/github-auth'
MARKER = 'originmetric-github-db/v1'
ASSETS = {'database.dump.age', 'SHA256SUMS'}
UTC = dt.timezone.utc


class BackupError(Exception):
    pass


def metadata(release):
    """Only exact system markers, dates and DB-only assets are eligible for deletion."""
    try:
        m = json.loads(release['body'])
        stamp = dt.datetime.fromisoformat(m['captured_at'])
        tag = m['snapshot']
        if (not release['draft'] or m['managed_by'] != MARKER
                or m['state'] not in ('pending', 'verified')
                or stamp.utcoffset() != dt.timedelta(0)
                or release.get('name') != tag
                or not (release['tag_name'] == tag or re.fullmatch(r'untagged-[a-f0-9]{20,40}', release['tag_name']))
                or not re.fullmatch(r'om-db-v1-\d{8}T\d{6}Z-[a-f0-9]{8}', tag)
                or stamp.strftime('%Y%m%dT%H%M%SZ') != tag[9:25]
                or not re.fullmatch(r'[a-f0-9]{64}', m['sha256'])
                or type(m['size_bytes']) is not int or m['size_bytes'] <= 0):
            return None
        expected = ['daily']
        if stamp.weekday() == 6:
            expected.append('weekly')
        if stamp.day == 1:
            expected.append('monthly')
        if m['classes'] != expected:
            return None
        names = [a['name'] for a in release['assets']]
        if len(names) != len(set(names)) or not set(names) <= ASSETS:
            return None
        if m['state'] == 'verified' and set(names) != ASSETS:
            return None
        return m, stamp
    except (KeyError, ValueError, TypeError):
        return None


def retention(releases, now, protected_id):
    """Keep newest snapshot per calendar period; never prune without current verified backup."""
    current = next((r for r in releases if r['id'] == protected_id), None)
    parsed = metadata(current) if current else None
    if (not parsed or parsed[0]['state'] != 'verified' or parsed[1] > now
            or now - parsed[1] >= dt.timedelta(days=1)):
        raise BackupError('Retention requires a newly verified backup')
    valid = []
    expired = []
    for r in releases:
        p = metadata(r)
        if not p or r['id'] == protected_id or p[1] > now:
            continue
        m, stamp = p
        age = now - stamp
        if age >= dt.timedelta(days=90):
            expired.append(r)
        elif m['state'] == 'pending':
            if age >= dt.timedelta(days=1):
                expired.append(r)
        else:
            valid.append((r, m, stamp))
    valid.append((current, *parsed))
    keep = {protected_id}
    for kind, count in [('daily', 7), ('weekly', 4), ('monthly', 2)]:
        periods = set()
        for r, m, stamp in sorted(valid, key=lambda v: (v[2], v[0]['id']), reverse=True):
            if kind not in m['classes']:
                continue
            period = (stamp.strftime('%Y-%m-%d') if kind == 'daily' else
                      stamp.strftime('%G-W%V') if kind == 'weekly' else stamp.strftime('%Y-%m'))
            if period in periods:
                continue
            if len(periods) >= count:
                break
            periods.add(period)
            keep.add(r['id'])
    return expired + [r for r, _, _ in valid if r['id'] not in keep]


class GitHub:
    def __init__(self, operator_once=False):
        self.env = os.environ.copy()
        for name in ('GH_TOKEN', 'GITHUB_TOKEN', 'GH_HOST'):
            self.env.pop(name, None)
        self.env['GH_CONFIG_DIR'] = str(AUTH)
        if not operator_once:
            token_path = Path(os.environ.get('CREDENTIALS_DIRECTORY', str(AUTH))) / 'backup-token'
            if not token_path.is_file() or token_path.is_symlink():
                raise BackupError('Scoped backup-token missing; service remains disabled')
            info = token_path.stat()
            if info.st_uid != 0 or stat.S_IMODE(info.st_mode) not in (0o400, 0o600):
                raise BackupError('Scoped backup-token must be root-owned mode 600')
            token = token_path.read_text().strip()
            if not token.startswith('github_pat_'):
                raise BackupError('Unattended backup requires fine-grained credential, not broad login')
            self.env['GH_TOKEN'] = token
        user = self.api('user')
        if user.get('login') != 'brsctncnbrk5':
            raise BackupError('Unexpected GitHub account')
        self.private()

    def private(self):
        r = self.api('repos/' + REPO)
        if not r.get('private') or r.get('archived') or r.get('full_name') != REPO:
            raise BackupError('Backup target is not the authorized active private repo')

    def api(self, path, method='GET', payload=None, upload=None, output=None, paginate=False):
        cmd = ['gh', 'api', path, '--method', method]
        if payload is not None:
            cmd += ['--input', '-']
        if upload:
            cmd += ['-H', 'Content-Type: application/octet-stream', '--input', str(upload)]
        if output:
            cmd += ['-H', 'Accept: application/octet-stream']
        if paginate:
            cmd += ['--paginate', '--slurp']
        try:
            r = subprocess.run(cmd, env=self.env,
                               input=json.dumps(payload).encode() if payload is not None else None,
                               stdout=output or subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
        except subprocess.TimeoutExpired as exc:
            raise BackupError('GitHub operation timed out; no retention performed') from exc
        if r.returncode:
            raise BackupError('GitHub operation failed; inspect account permissions privately')
        if output or not r.stdout:
            return None
        return json.loads(r.stdout)

    def releases(self):
        return [r for page in self.api('repos/' + REPO + '/releases?per_page=100', paginate=True) for r in page]


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def size_warning(previous, current):
    """Warn on an inclusive 50% change; no baseline is not an invented success."""
    if type(previous) is not int or previous <= 0:
        return []
    if abs(current - previous) * 2 < previous:
        return []
    return [{'code': 'BACKUP_SIZE_JUMP', 'previous_bytes': previous,
             'current_bytes': current, 'threshold_percent': 50}]


def deployed_source():
    """Pin recovery migrations to the running image, not a newer development checkout."""
    try:
        tag = (ROOT / '.runtime/current-tag').read_text().strip()
        if not re.fullmatch(r'[a-f0-9]{40}', tag):
            raise ValueError('Invalid deployed tag')
        committed = subprocess.check_output(['git', 'rev-parse', tag + '^{commit}'],
                                            cwd=ROOT, text=True, stderr=subprocess.PIPE, timeout=10).strip()
        running = subprocess.check_output(['docker', 'inspect', '--format', '{{.Image}}',
                                           'originmetric-app-1'], text=True,
                                          stderr=subprocess.PIPE, timeout=10).strip()
        expected = subprocess.check_output(['docker', 'image', 'inspect', '--format', '{{.Id}}',
                                            'originmetric:' + tag], text=True,
                                           stderr=subprocess.PIPE, timeout=10).strip()
        if committed != tag or not re.fullmatch(r'sha256:[a-f0-9]{64}', running) or running != expected:
            raise ValueError('Deployed image mismatch')
        return tag
    except Exception:
        raise BackupError('Deployed source/image not verified; no upload/retention') from None


def backup(gh, work, previous_size=None, skip_retention=False):
    source_sha = deployed_source()
    now = dt.datetime.now(UTC).replace(microsecond=0)
    snapshot = 'om-db-v1-' + now.strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    cipher = work / 'database.dump.age'
    # pg_dump creates a consistent snapshot; age encrypts before any persisted bytes.
    command = '''source scripts/vps/common.sh
load_env
[[ ${AGE_RECIPIENT:-} == age1* ]] || fail 'Public age recipient missing'
export APP_TAG=$(cat .runtime/current-tag)
dc exec -T db pg_dump -U originmetric -d originmetric -Fc --no-owner --no-acl | age -r "$AGE_RECIPIENT"
'''
    with cipher.open('wb') as out:
        r = subprocess.run(['bash', '-c', command], cwd=ROOT, stdout=out,
                           stderr=subprocess.PIPE, timeout=300)
    if r.returncode or not cipher.stat().st_size:
        raise BackupError('DB encryption failed; no upload/retention')
    if deployed_source() != source_sha:
        raise BackupError('Deployed source changed during dump; no upload/retention')
    with cipher.open('rb') as f:
        if f.read(22) != b'age-encryption.org/v1\n':
            # Header is 22 bytes including newline.
            raise BackupError('Not an age ciphertext')
    if cipher.stat().st_size >= 2 * 1024 ** 3:
        raise BackupError('Ciphertext exceeds GitHub asset limit; no upload/retention')
    m = {'managed_by': MARKER, 'snapshot': snapshot, 'captured_at': now.isoformat(),
         'state': 'pending', 'classes': ['daily'], 'sha256': digest(cipher),
         'size_bytes': cipher.stat().st_size,
         'warnings': size_warning(previous_size, cipher.stat().st_size),
         'source_sha': source_sha}
    if now.weekday() == 6:
        m['classes'].append('weekly')
    if now.day == 1:
        m['classes'].append('monthly')
    manifest = work / 'SHA256SUMS'
    manifest.write_text(m['sha256'] + '  database.dump.age\n')
    gh.private()
    release = gh.api('repos/' + REPO + '/releases', 'POST',
                     {'tag_name': snapshot, 'name': snapshot, 'draft': True,
                      'target_commitish': 'main', 'body': json.dumps(m, sort_keys=True)})
    rid = release['id']
    uploaded_ids = set()
    for path in (cipher, manifest):
        gh.private()  # Fail closed if target visibility changes before either upload.
        asset = gh.api(f'https://uploads.github.com/repos/{REPO}/releases/{rid}/assets?name={path.name}',
                       'POST', upload=path)
        uploaded_ids.add(asset['id'])
        downloaded = work / ('readback-' + path.name)
        with downloaded.open('wb') as out:
            gh.api(f'repos/{REPO}/releases/assets/{asset["id"]}', output=out)
        if digest(downloaded) != digest(path) or downloaded.stat().st_size != path.stat().st_size:
            raise BackupError('Remote readback mismatch; pending release preserved, no retention')
    gh.private()
    check = gh.api(f'repos/{REPO}/releases/{rid}')
    if (not metadata(check) or check['body'] != json.dumps(m, sort_keys=True)
            or {a['name'] for a in check['assets']} != ASSETS
            or {a['id'] for a in check['assets']} != uploaded_ids):
        raise BackupError('Remote snapshot changed; no retention')
    m['state'] = 'verified'
    m['verified_at'] = dt.datetime.now(UTC).isoformat()
    gh.api(f'repos/{REPO}/releases/{rid}', 'PATCH', {'tag_name': snapshot, 'draft': True, 'body': json.dumps(m, sort_keys=True)})
    final = gh.api(f'repos/{REPO}/releases/{rid}')
    return finish(gh, rid, m, final['html_url'], skip_retention=skip_retention)


def finish(gh, rid, m, url, skip_retention=False):
    candidates = retention(gh.releases(), dt.datetime.now(UTC), rid)
    if skip_retention:
        return dict(m, release_id=rid, url=url, pruned=0,
                    retention_applied=False, retention_deferred_candidates=len(candidates),
                    result='BACKUP_CREATED_REMOTE_READBACK_VERIFIED', restore_verified=False)
    for old in candidates:
        gh.private()
        fresh = gh.api(f'repos/{REPO}/releases/{old["id"]}')
        # Protect against assets/metadata added since listing. Do not delete refs/tags.
        if fresh['body'] != old['body'] or fresh['assets'] != old['assets'] or not metadata(fresh):
            raise BackupError('Retention target changed; cleanup stopped')
        gh.api(f'repos/{REPO}/releases/{old["id"]}', 'DELETE')
    return dict(m, release_id=rid, url=url, pruned=len(candidates),
                result='BACKUP_CREATED_REMOTE_READBACK_VERIFIED', restore_verified=False)


def verify_existing(gh, snapshot, work):
    # Resume an exact owned complete snapshot after a failed final metadata/cleanup step.
    matches = [r for r in gh.releases() if r.get('name') == snapshot and metadata(r)]
    if len(matches) != 1:
        raise BackupError('Exact owned complete snapshot not found')
    r = matches[0]
    m, stamp = metadata(r)
    if dt.datetime.now(UTC) - stamp >= dt.timedelta(days=1):
        raise BackupError('Resume requires a recently uploaded snapshot; create a new backup')
    if {a['name'] for a in r['assets']} != ASSETS:
        raise BackupError('Incomplete snapshot cannot be resumed; create a new backup')
    gh.private()
    for a in r['assets']:
        with (work / a['name']).open('wb') as out:
            gh.api(f'repos/{REPO}/releases/assets/{a["id"]}', output=out)
    cipher = work / 'database.dump.age'
    expected_manifest = m['sha256'] + '  database.dump.age\n'
    if (digest(cipher) != m['sha256'] or cipher.stat().st_size != m['size_bytes']
            or (work / 'SHA256SUMS').read_text() != expected_manifest):
        raise BackupError('Existing remote snapshot hash/manifest mismatch; no retention')
    with cipher.open('rb') as f:
        if f.read(22) != b'age-encryption.org/v1\n':
            raise BackupError('Existing object is not an age ciphertext')
    fresh = gh.api(f'repos/{REPO}/releases/{r["id"]}')
    if fresh['body'] != r['body'] or fresh['assets'] != r['assets']:
        raise BackupError('Snapshot changed during readback; no retention')
    m['state'] = 'verified'
    m['verified_at'] = dt.datetime.now(UTC).isoformat()
    gh.private()
    gh.api(f'repos/{REPO}/releases/{r["id"]}', 'PATCH',
           {'tag_name': snapshot, 'draft': True, 'body': json.dumps(m, sort_keys=True)})
    final = gh.api(f'repos/{REPO}/releases/{r["id"]}')
    return finish(gh, r['id'], m, final['html_url'])



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operator-once', action='store_true',
                        help='Explicit one-time owner project login; never use in scheduled service')
    parser.add_argument('--check-credential', action='store_true')
    parser.add_argument('--already-locked', action='store_true',
                        help='Deployment only: require inherited fd 9 for the exact operation lock')
    parser.add_argument('--verify-existing-snapshot', help='Exact owned snapshot name; reverify ciphertext, then safe retention')
    parser.add_argument('--skip-retention', action='store_true',
                        help='One-time new backup: preserve older snapshots for restore audit; cleanup is deferred')
    args = parser.parse_args()
    if args.skip_retention and args.verify_existing_snapshot:
        parser.error('--skip-retention requires a new backup')
    os.umask(0o077)
    state = ROOT / '.runtime/github-db'
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        # The same operation lock is shared with existing deploy/rclone backup scripts.
        lock_path = ROOT / '.runtime/operation.lock'
        if args.already_locked:
            try:
                held = os.fstat(9)
                expected = lock_path.stat()
                if (held.st_dev, held.st_ino) != (expected.st_dev, expected.st_ino):
                    raise BackupError('Exact inherited deployment lock is required')
                lock_file = os.fdopen(os.dup(9), 'a')
            except OSError as exc:
                raise BackupError('Inherited deployment lock missing; no backup action') from exc
        else:
            lock_file = lock_path.open('a')
        with lock_file as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise BackupError('Another deploy/backup operation is running') from exc
            gh = GitHub(args.operator_once)
            if args.check_credential:
                print('Authorized private target/credential check PASS; scope must match owner token setup')
                return
            previous_size = None
            previous = state / 'last-backup.json'
            if previous.is_file():
                try:
                    last = json.loads(previous.read_text())
                    if last.get('result') == 'BACKUP_CREATED_REMOTE_READBACK_VERIFIED':
                        previous_size = last.get('size_bytes')
                except (OSError, ValueError):
                    pass
            with tempfile.TemporaryDirectory(prefix='snapshot-', dir=state) as folder:
                result = (verify_existing(gh, args.verify_existing_snapshot, Path(folder))
                          if args.verify_existing_snapshot else backup(gh, Path(folder), previous_size,
                                                                       skip_retention=args.skip_retention))
            target = state / 'last-backup.json'
            tmp = state / 'last-backup.json.tmp'
            tmp.write_text(json.dumps(result, indent=2) + '\n')
            tmp.replace(target)
            print(json.dumps(result))
    except (BackupError, subprocess.TimeoutExpired, OSError, ValueError, KeyError) as exc:
        # Only our fixed safe errors are reported; never emit API bodies, subprocess stderr or secrets.
        message = str(exc) if isinstance(exc, BackupError) else 'Backup command or response failed; no secret details printed'
        (state / 'last-failure.json').write_text(json.dumps({'failed_at': dt.datetime.now(UTC).isoformat(), 'reason': message}) + '\n')
        print('Backup FAILED: ' + message)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
