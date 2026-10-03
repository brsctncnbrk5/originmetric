"""Packet-level apply/idempotence/rollback proof, only in an isolated net namespace.

Run: unshare -n python3 scripts/vps/test-web-firewall.py <validated-range-directory>
"""

import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


assert os.geteuid() == 0
assert os.readlink('/proc/self/ns/net') != os.readlink('/proc/1/ns/net'), 'Use unshare -n'
env = dict(os.environ, OM_CF_RANGE_DIR=str(Path(sys.argv[1]).resolve()))
script = Path(__file__).with_name('originmetric-web-firewall.sh').resolve()
peer = subprocess.Popen(['unshare', '-n', 'sleep', '45'])
servers = []
try:
    for _ in range(100):
        if os.readlink(f'/proc/{peer.pid}/ns/net') != os.readlink('/proc/self/ns/net'):
            break
        time.sleep(.01)
    else:
        raise RuntimeError('Peer namespace was not created')

    def remote(*args):
        return run('nsenter', '-t', str(peer.pid), '-n', *args)

    run('ip', 'link', 'add', 'eth0', 'type', 'veth', 'peer', 'name', 'sender')
    run('ip', 'link', 'set', 'sender', 'netns', str(peer.pid))
    run('ip', 'link', 'set', 'lo', 'up')
    run('ip', 'link', 'set', 'eth0', 'up')
    remote('ip', 'link', 'set', 'lo', 'up')
    remote('ip', 'link', 'set', 'sender', 'up')
    families = (
        (4, socket.AF_INET, '192.0.2.1', '192.0.2.2', '173.245.48.1', '24'),
        (6, socket.AF_INET6, '2001:db8:1::1', '2001:db8:1::2', '2400:cb00::1', '64'),
    )
    for version, family, target, direct, cf, prefix in families:
        run('ip', f'-{version}', 'addr', 'add', target + '/' + prefix, 'dev', 'eth0', *(['nodad'] if version == 6 else []))
        remote('ip', f'-{version}', 'addr', 'add', direct + '/' + prefix, 'dev', 'sender', *(['nodad'] if version == 6 else []))
        remote('ip', f'-{version}', 'addr', 'add', cf + ('/32' if version == 4 else '/128'), 'dev', 'sender', *(['nodad'] if version == 6 else []))
        run('ip', f'-{version}', 'route', 'add', cf + ('/32' if version == 4 else '/128'), 'dev', 'eth0')
        tool = 'iptables' if version == 4 else 'ip6tables'
        run(tool, '-A', 'INPUT', '-p', 'tcp', '--dport', '3000', '-j', 'DROP')
        run(tool, '-A', 'INPUT', '-p', 'tcp', '--dport', '22', '-j', 'ACCEPT')
        run(tool, '-A', 'INPUT', '-j', 'ACCEPT')
        for port in (22, 80, 443, 3000):
            server = socket.socket(family)
            server.bind((target, port))
            server.listen(64)
            servers.append(server)
        udp = socket.socket(family, socket.SOCK_DGRAM)
        udp.bind((target, 443))
        servers.append(udp)

        def echo(server):
            try:
                while True:
                    data, addr = server.recvfrom(128)
                    server.sendto(data, addr)
            except OSError:
                pass

        threading.Thread(target=echo, args=(udp,), daemon=True).start()

    client = '''
import socket,sys
version,source,target,port,protocol=sys.argv[1:]
s=socket.socket(socket.AF_INET if version=='4' else socket.AF_INET6,
                socket.SOCK_STREAM if protocol=='tcp' else socket.SOCK_DGRAM)
s.settimeout(.5);s.bind((source,0))
try:
    if protocol=='tcp':s.connect((target,int(port)))
    else:s.sendto(b'probe',(target,int(port)));assert s.recv(128)==b'probe'
    print('allowed')
except (TimeoutError,ConnectionError,OSError):print('blocked')
'''
    checks = 0

    def check(version, source, target, port, expected, protocol='tcp'):
        global checks
        result = remote('python3', '-c', client, str(version), source, target, str(port), protocol)
        assert result.stdout.strip() == expected, (version, port, protocol, expected)
        checks += 1

    # Malformed second-family input must leave both live rulesets untouched.
    before = {tool: run(tool, '-S').stdout for tool in ('iptables', 'ip6tables')}
    with tempfile.TemporaryDirectory() as invalid:
        Path(invalid, 'cloudflare-v4.txt').write_text('173.245.48.0/20\n')
        Path(invalid, 'cloudflare-v6.txt').write_text('::/0\n')
        rejected = subprocess.run(
            ['bash', str(script), 'apply'],
            env=dict(env, OM_CF_RANGE_DIR=invalid),
            capture_output=True,
        )
        assert rejected.returncode != 0, 'Invalid input was accepted'
        for tool in before:
            assert run(tool, '-S').stdout == before[tool], 'Mutation before validation'
    for _ in range(2):
        subprocess.run(['bash', str(script), 'apply'], env=env, check=True)
    for version, _, target, direct, cf, _ in families:
        for port in (80, 443):
            check(version, cf, target, port, 'allowed')
            check(version, direct, target, port, 'blocked')
        for source in (cf, direct):
            check(version, source, target, 22, 'allowed')
            check(version, source, target, 3000, 'blocked')
            check(version, source, target, 443, 'blocked', 'udp')
        tool = 'iptables' if version == 4 else 'ip6tables'
        rules = run(tool, '-S', 'INPUT').stdout
        assert rules.count('originmetric-cloudflare-web') == 2, 'Duplicate jumps'
    for _ in range(2):
        subprocess.run(['bash', str(script), 'remove'], env=env, check=True)
    for version, _, target, direct, _, _ in families:
        check(version, direct, target, 80, 'allowed')
        check(version, direct, target, 443, 'allowed')
        check(version, direct, target, 22, 'allowed')
        check(version, direct, target, 3000, 'blocked')
        check(version, direct, target, 443, 'allowed', 'udp')
    print(f'PASS: {checks} packet checks; invalid input leaves rules unchanged; repeat apply/remove; SSH/private rules survive rollback')
finally:
    for server in servers:
        server.close()
    peer.terminate()
    peer.wait(timeout=5)
