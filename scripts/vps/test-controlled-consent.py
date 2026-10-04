#!/usr/bin/env python3
"""Loopback-only candidate/expiry checks; never exercise production ingestion."""
import http.server
import importlib.util
from pathlib import Path
import re
import socket
import sys
import subprocess
import tempfile
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('window', 'scripts/vps/prepare-controlled-consent.py')
window = importlib.util.module_from_spec(spec)
spec.loader.exec_module(window)
TOKEN = '0' * 64
source = Path('deploy/nginx.originmetric.conf').read_text()

class Backend(http.server.BaseHTTPRequestHandler):
    accepted = 0
    def do_POST(self):
        Backend.accepted += 1
        self.send_response(202)
        self.end_headers()
    def log_message(self, *_):
        pass

backend = http.server.HTTPServer(('127.0.0.1', 0), Backend)
threading.Thread(target=backend.serve_forever, daemon=True).start()
try:
    for expired in (False, True):
        candidate = window.render(source, TOKEN, 'p2_acceptance_synthetic', int(time.time()) - (601 if expired else 0))
        prefix = candidate.split('server {', 1)[0].replace('default 0;\n    173.245.', 'default 0;\n    127.0.0.1 1;\n    173.245.')
        server = 'server {' + candidate.split('server {')[-1]
        server = re.sub(r'^    ssl_.*\n', '', server, flags=re.M)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
        with tempfile.TemporaryDirectory(prefix='originmetric-consent-test-') as name:
            directory = Path(name)
            tokenfile = directory / 'proxy.conf'
            tokenfile.write_text('proxy_set_header X-OM-Proxy-Token "synthetic-only";\n')
            server = server.replace('listen 443 ssl;', f'listen 127.0.0.1:{port};')
            server = server.replace('real_ip_recursive off;', 'real_ip_recursive off;\n    set_real_ip_from 127.0.0.1;')
            server = server.replace('127.0.0.1:8088', f'127.0.0.1:{backend.server_port}')
            server = server.replace('/etc/nginx/originmetric-proxy-token.conf', str(tokenfile))
            conf = directory / 'nginx.conf'
            conf.write_text(f'pid {directory}/nginx.pid;\nerror_log /dev/null;\nevents {{}}\nhttp {{ access_log off;\n' + prefix + server + '\n}')
            check = subprocess.run(['nginx', '-t', '-p', name, '-c', str(conf)], capture_output=True)
            assert check.returncode == 0, check.stderr.decode()
            process = subprocess.Popen(['nginx', '-p', name, '-c', str(conf), '-g', 'daemon off;'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                time.sleep(.2)
                headers = {'Host': 'originmetric.app', 'Origin': 'https://originmetric.app', 'Referer': 'https://originmetric.app/dogfood?utm_campaign=p2_acceptance_synthetic', 'Cookie': 'p2_acceptance_access=' + TOKEN}
                for variant in ('no-cookie', 'wrong-cookie', 'wrong-origin', 'wrong-page', 'wrong-method', 'valid', 'oversized'):
                    request_headers = dict(headers)
                    method = 'POST'
                    data = b'{}'
                    if variant == 'no-cookie': request_headers.pop('Cookie')
                    if variant == 'wrong-cookie': request_headers['Cookie'] = 'p2_acceptance_access=wrong'
                    if variant == 'wrong-origin': request_headers['Origin'] = 'https://example.invalid'
                    if variant == 'wrong-page': request_headers['Referer'] = 'https://originmetric.app/'
                    if variant == 'wrong-method': method = 'GET'; data = None
                    if variant == 'oversized': data = b'x' * 8193
                    before = Backend.accepted
                    try:
                        with urlopen(Request(f'http://127.0.0.1:{port}/api/v1/e', data=data, method=method, headers=request_headers), timeout=5) as response:
                            status = response.status
                    except HTTPError as error:
                        status = error.code
                    forwarded = variant == 'valid' and not expired
                    assert Backend.accepted - before == int(forwarded), variant
                    assert status == (413 if variant == 'oversized' else 202), (variant, status, expired)
            finally:
                process.terminate(); process.wait(timeout=5)
finally:
    backend.shutdown(); backend.server_close()
print('PREPARATION PASS: 14 loopback controls, cookie/origin/page/method/body limits and server-side expiry; real acceptance NOT_RUN')
