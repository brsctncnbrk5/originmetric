#!/usr/bin/env python3
"""Dedicated 90-day GitHub expiry backstop. Dry-run by default; no DB or secrets in output."""
import argparse
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import urllib.request

spec = importlib.util.spec_from_file_location('backup_policy', Path(__file__).with_name('github-backup.py'))
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
REPO = policy.REPO


def expired(releases, now):
    return [r for r in releases if (parsed := policy.metadata(r))
            and now >= parsed[1] and now - parsed[1] >= dt.timedelta(days=90)]


class API:
    def request(self, path, method='GET'):
        token = os.environ.get('GH_TOKEN', '')
        if not token:
            raise RuntimeError('Repository credential missing; no deletion')
        request = urllib.request.Request('https://api.github.com/' + path, method=method,
                    headers={'Authorization': 'Bearer ' + token,
                             'User-Agent': 'OriginMetric-owned-expiry',
                             'X-GitHub-Api-Version': '2022-11-28'})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                data = response.read()
        except Exception:
            raise RuntimeError('GitHub request failed; diagnostic body suppressed') from None
        return json.loads(data) if data else None

    def private(self):
        r = self.request('repos/' + REPO)
        if not r.get('private') or r.get('archived') or r.get('full_name') != REPO:
            raise RuntimeError('Expected active private recovery repository; no deletion')


def cleanup(api, releases, now, apply=False):
    candidates = expired(releases, now)
    deleted = 0
    for old in candidates if apply else []:
        api.private()
        current = api.request(f'repos/{REPO}/releases/{old["id"]}')
        if (current.get('body') != old.get('body') or current.get('assets') != old.get('assets')
                or current.get('draft') != old.get('draft')
                or not expired([current], now)):
            raise RuntimeError('Expiry target changed; cleanup stopped')
        api.request(f'repos/{REPO}/releases/{old["id"]}', 'DELETE')
        deleted += 1
    return {'dry_run': not apply, 'owned_expired_candidates': len(candidates),
            'deleted_releases': deleted, 'maximum_age_days': 90,
            'unrelated_records_protected': len(releases) - len(candidates)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        api = API()
        api.private()
        releases = []
        for page in range(1, 101):
            batch = api.request(f'repos/{REPO}/releases?per_page=100&page={page}')
            releases.extend(batch)
            if len(batch) < 100:
                break
        else:
            raise RuntimeError('Inventory too large; no deletion')
        print(json.dumps(cleanup(api, releases, dt.datetime.now(dt.timezone.utc), args.apply)))
    except Exception:
        print('Expiry check failed; credentials/response bodies suppressed; inspect privately')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
