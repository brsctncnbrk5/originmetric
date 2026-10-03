#!/usr/bin/env python3
"""Isolated nginx header proof: synthetic addresses only, no live site reload."""
import http.server
import json
import re
import socket
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class Backend(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(json.dumps(dict(self.headers)).encode())

    def log_message(self, *_):
        pass


source = Path('deploy/nginx.originmetric.conf').read_text()
geo = source.split('server {', 1)[0]
server = 'server {' + source.split('server {')[-1]
backend = http.server.HTTPServer(('127.0.0.1', 0), Backend)
threading.Thread(target=backend.serve_forever, daemon=True).start()
try:
    for trusted in (False, True):
        with tempfile.TemporaryDirectory(prefix='originmetric-nginx-test-') as directory:
            root = Path(directory)
            port = free_port()
            token = root / 'token.conf'
            token.write_text('proxy_set_header X-OM-Proxy-Token "synthetic-test-token";\n')
            config = re.sub(r'^    ssl_.*\n', '', server, flags=re.M)
            config = config.replace('listen 443 ssl;', f'listen 127.0.0.1:{port};')
            config = config.replace('127.0.0.1:8088', f'127.0.0.1:{backend.server_port}')
            config = config.replace('/etc/nginx/originmetric-proxy-token.conf', str(token))
            test_geo = geo
            if trusted:
                # Simulates a Cloudflare peer only inside this loopback-only harness.
                config = config.replace('real_ip_recursive off;', 'real_ip_recursive off;\n    set_real_ip_from 127.0.0.1;')
                test_geo = test_geo.replace('default 0;', 'default 0;\n    127.0.0.1 1;')
            conf = root / 'nginx.conf'
            conf.write_text(f'pid {root}/nginx.pid;\nerror_log /dev/null;\nevents {{}}\nhttp {{ access_log off;\n' + test_geo + config + '\n}')
            subprocess.run(['nginx', '-t', '-p', directory, '-c', str(conf)], check=True, capture_output=True)
            proc = subprocess.Popen(['nginx', '-p', directory, '-c', str(conf), '-g', 'daemon off;'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                time.sleep(0.2)
                for ip in ('198.51.100.10', '2001:db8::10', '104.16.0.1'):
                    request = Request(f'http://127.0.0.1:{port}/api/health', headers={
                        'Host': 'originmetric.app', 'CF-Connecting-IP': ip,
                        'X-Forwarded-For': '198.51.100.99', 'X-Real-IP': '198.51.100.99',
                        'X-OM-Proxy-Token': 'forged',
                    })
                    if trusted:
                        with urlopen(request, timeout=5) as response:
                            headers = {k.lower(): v for k, v in json.load(response).items()}
                            assert headers['cf-connecting-ip'] == ip
                            assert headers['x-om-proxy-token'] == 'synthetic-test-token'
                            assert 'x-forwarded-for' not in headers and 'x-real-ip' not in headers
                    else:
                        try:
                            urlopen(request, timeout=5)
                            raise AssertionError('Untrusted peer bypassed gate')
                        except HTTPError as error:
                            assert error.code == 403
            finally:
                proc.terminate()
                proc.wait(timeout=5)
finally:
    backend.shutdown()
    backend.server_close()
print('nginx isolated proof PASS: IPv4/IPv6 client forwarding, original-peer gate, XFF stripping, token overwrite')
