#!/usr/bin/env python3
"""Prepare a narrowly gated real-domain consent test; activation needs owner approval."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time

sys.dont_write_bytecode = True

ROOT = Path('/opt/originmetric')
SITE = Path('/etc/nginx/sites-available/originmetric')
DURATION = 600
CLOSED = '''    location = /api/v1/e {
        add_header Cache-Control "no-store" always;
        return 202;
    }'''


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_private(path, text):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as file:
        file.write(text)


def render(source, token, label, start):
    assert source.count(CLOSED) == 1
    assert len(token) == 64 and all(c in '0123456789abcdef' for c in token)
    assert label.startswith('p2_acceptance_') and label.replace('_', '').isalnum()
    # Server-side expiry is independent of browser cookies and rollback execution.
    windows = []
    for chunk in range(0, DURATION, 100):
        seconds = '|'.join(str(start + n) for n in range(chunk, min(chunk + 100, DURATION)))
        windows.append(f'    ~^({seconds})\\.[0-9]+$ 1;')
    expiry_rules = '\n'.join(windows)
    maps = f'''map $msec $originmetric_p2_time {{
    default 0;
{expiry_rules}
}}
map $http_cookie $originmetric_p2_cookie {{
    default 0;
    "~(?:^|;\\s*)p2_acceptance_access={token}(?:;|$)" 1;
}}
map "$request_method|$http_origin|$http_referer" $originmetric_p2_request {{
    default 0;
    "~^POST\\|https://originmetric\\.app\\|https://originmetric\\.app/dogfood(?:\\?|$)" 1;
}}
'''
    location = f'''    location = /api/v1/e {{
        if ($originmetric_p2_time = 0) {{ return 202; }}
        if ($originmetric_p2_cookie = 0) {{ return 202; }}
        if ($originmetric_p2_request = 0) {{ return 202; }}
        client_max_body_size 8k;
        add_header Cache-Control "no-store" always;
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host originmetric.app;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For "";
        proxy_set_header X-Real-IP "";
        proxy_set_header CF-Connecting-IP $remote_addr;
        include /etc/nginx/originmetric-proxy-token.conf;
        proxy_connect_timeout 5s;
        proxy_read_timeout 15s;
    }}
    location = /p2-consent-{token} {{
        if ($originmetric_p2_time = 0) {{ return 404; }}
        add_header Cache-Control "no-store" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Set-Cookie "p2_acceptance_access={token}; Path=/api/v1/e; Max-Age=600; Secure; HttpOnly; SameSite=Strict" always;
        return 303 https://originmetric.app/dogfood?utm_source=p2-test&utm_medium=controlled&utm_campaign={label};
    }}'''
    return maps + source.replace(CLOSED, location)


def safe_run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError('Operation failed: ' + args[0])


def replace_site(text, mode=0o644):
    temp = SITE.with_name('originmetric.p2-staged')
    temp.write_text(text)
    temp.chmod(mode)
    os.replace(temp, SITE)


def restore(directory):
    active = directory / 'active-sha'
    if not active.exists():
        return
    if SITE.read_bytes() == (directory / 'closed.conf').read_bytes():
        return
    if digest(SITE.read_bytes()) != active.read_text().strip():
        raise RuntimeError('Site changed; refusing unrelated configuration overwrite')
    replace_site((directory / 'closed.conf').read_text())
    safe_run(['nginx', '-t'])
    safe_run(['systemctl', 'reload', 'nginx'])
    write_private(directory / 'rollback-result.json', json.dumps({'closedConfigRestored': True, 'ingestionAcceptance': 'NOT_INFERRED', 'recordedAtEpoch': time.time()}) + '\n')


def activate(directory):
    # Agent must obtain the exact owner approval before invoking this operation.
    import fcntl
    with (ROOT / '.runtime/operation.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        plan = json.loads((directory / 'window.json').read_text())
        assert not (directory / 'active-sha').exists(), 'Window cannot be reused'
        assert digest(SITE.read_bytes()) == plan['closedConfigSha']
        assert 'PUBLIC_G1_READY=no' in (ROOT / '.env.production').read_text()
        start = int(time.time())
        candidate = render((directory / 'closed.conf').read_text(), (directory / 'access-token').read_text().strip(), plan['label'], start)
        write_private(directory / 'candidate.conf', candidate)
        write_private(directory / 'active-sha', digest(candidate.encode()) + '\n')
        # Arm independent recovery BEFORE touching the live site.
        try:
            safe_run(['systemd-run', '--unit=' + plan['rollbackUnit'], '--on-active=600s', '/usr/bin/python3', str(ROOT / 'scripts/vps/prepare-controlled-consent.py'), 'rollback', str(directory)])
        except Exception:
            (directory / 'active-sha').unlink()
            raise
        try:
            replace_site(candidate, mode=0o600)
            safe_run(['nginx', '-t'])
            safe_run(['systemctl', 'reload', 'nginx'])
        except Exception:
            replace_site((directory / 'closed.conf').read_text())
            safe_run(['nginx', '-t'])
            safe_run(['systemctl', 'reload', 'nginx'])
            raise
        write_private(directory / 'activation.json', json.dumps({'startEpoch': start, 'expiresEpoch': start + DURATION, 'formalG1': 'PENDING', 'publicGoLive': False}) + '\n')
        print(json.dumps({'result': 'CONTROLLED_WINDOW_ACTIVE', 'expiresEpoch': start + DURATION, 'privateEntryFile': str(directory / 'entry-url')}))


def prepare():
    os.chdir(ROOT)
    source = SITE.read_text()
    assert source == (ROOT / 'deploy/nginx.originmetric.conf').read_text()
    assert 'PUBLIC_G1_READY=no' in (ROOT / '.env.production').read_text()
    prior = ROOT / (ROOT / '.runtime/p2-prepared-last-path').read_text().strip()
    scenario = json.loads((prior / 'plan.json').read_text())
    directory = ROOT / '.runtime' / ('p2-consent-window-' + secrets.token_hex(6))
    directory.mkdir(mode=0o700)
    token = secrets.token_hex(32)
    label = scenario['label']
    plan = {'kind': 'PREPARATION_ONLY', 'status': 'AWAITING_OWNER_APPROVAL', 'canonicalItem': 1, 'durationSeconds': DURATION, 'closedConfigSha': digest(source.encode()), 'label': label, 'scenario': str(prior / 'plan.json'), 'rollbackUnit': 'originmetric-p2-consent-' + secrets.token_hex(4), 'productionWritesAllowedNow': False, 'ownerGpc': 'NOT_EXPOSED', 'enabledOwnerGpc': 'NOT_PASSED', 'formalG1': 'PENDING', 'phoneIndependentRecovery': 'DEFERRED', 'realAcceptance': 'NOT_RUN'}
    spec = importlib.util.spec_from_file_location('receiver', ROOT / 'scripts/vps/restore-phone.py')
    receiver = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(receiver)
    write_private(directory / 'protected-before.json', json.dumps(receiver.protected()) + '\n')
    write_private(directory / 'window.json', json.dumps(plan, indent=2) + '\n')
    write_private(directory / 'closed.conf', source)
    write_private(directory / 'access-token', token + '\n')
    write_private(directory / 'entry-url', 'https://originmetric.app/p2-consent-' + token + '\n')
    write_private(directory / 'candidate.conf', render(source, token, label, int(time.time())))
    write_private(ROOT / '.runtime/p2-consent-window-last-path', str(directory) + '\n')
    print(json.dumps({'result': 'PREPARATION_ONLY', 'privateDirectory': str(directory), 'durationSeconds': DURATION, 'ingestionOpened': False, 'realAcceptance': 'NOT_RUN'}))


if __name__ == '__main__':
    try:
        if len(sys.argv) == 1:
            prepare()
        else:
            action, path = sys.argv[1:]
            directory = Path(path).resolve()
            assert directory.parent == ROOT / '.runtime' and directory.name.startswith('p2-consent-window-')
            {'activate': activate, 'rollback': restore}[action](directory)
    except Exception as error:
        # No request bodies, candidate secrets or subprocess diagnostics in output.
        print(json.dumps({'result': 'FAILED', 'failureClass': type(error).__name__}))
        sys.exit(1)
