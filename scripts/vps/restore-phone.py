#!/usr/bin/env python3
"""Consume a phone-decrypted dump on stdin; never load production env or secrets."""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
IMAGE = 'postgres:18.6-alpine'
TABLES = sorted(['workspaces', 'projects', 'api_keys', 'events', 'sessions',
                 'customers', 'customer_visitors', 'revenue_events',
                 'customer_attribution', 'ingestion_daily'])
PRODUCTION = ['originmetric-db-1', 'originmetric-app-1', 'originmetric-caddy-1']


class CheckError(Exception):
    pass


def run(args, data=None, stdin=None, capture=True, timeout=120):
    try:
        p = subprocess.run(args, input=data, stdin=stdin,
                           stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                           stderr=subprocess.PIPE, timeout=timeout, cwd=ROOT)
    except (subprocess.TimeoutExpired, OSError) as exc:
        raise CheckError('Tool timeout or unavailable; diagnostics suppressed') from exc
    if p.returncode:
        # pg_restore/psql errors can contain sensitive row values. Never persist/print them.
        raise CheckError(Path(args[0]).name + ' returned exit ' + str(p.returncode)
                         + '; diagnostics suppressed')
    return p.stdout if capture else b''


def protected():
    containers = json.loads(run(['docker', 'inspect', *PRODUCTION]))
    objects = [{'name': c['Name'], 'id': c['Id'], 'start': c['State']['StartedAt'],
                'restarts': c['RestartCount'],
                'mounts': sorted(c['Mounts'], key=lambda m: m['Destination'])}
               for c in containers]
    paths = [ROOT / '.env.production', ROOT / 'docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md',
             Path('/etc/systemd/system/originmetric-github-backup.timer'),
             Path('/etc/systemd/system/originmetric-github-backup.service')]
    paths += [p for p in Path('/etc/nginx').rglob('*originmetric*') if p.is_file()]
    return {'containers': objects, 'files': {str(p): hashlib.sha256(p.read_bytes()).hexdigest()
                                           for p in paths if p.is_file()}}


def identifier(name):
    return '"' + name.replace('"', '""') + '"'


CATALOG = """
SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relrowsecurity)
 ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p','v','m','S')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,
 format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),
 a.attidentity,a.attgenerated) ORDER BY n.nspname,c.relname,a.attnum)
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p','v','m','S')
 AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,
 k.contype,k.convalidated,pg_get_constraintdef(k.oid,true)) ORDER BY n.nspname,c.relname,k.conname)
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','drizzle')),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,pg_get_indexdef(i.indexrelid),
 i.indisvalid,i.indisready) ORDER BY n.nspname,c.relname,pg_get_indexdef(i.indexrelid))
 FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','drizzle')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,
 pg_get_triggerdef(t.oid,true)) ORDER BY n.nspname,c.relname,t.tgname)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_functiondef(p.oid))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
 'enums',(SELECT jsonb_agg(jsonb_build_array(t.typname,e.enumlabel) ORDER BY t.typname,e.enumsortorder)
 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
 JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'));
"""

FK_QUERY = """
SELECT coalesce(jsonb_agg(jsonb_build_object('name',k.conname,'child',c.relname,
 'parent',p.relname,'child_schema',n.nspname,'parent_schema',pn.nspname,
 'match',k.confmatchtype,
 'child_cols',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.conkey)
 WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=x.num),
 'parent_cols',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.confkey)
 WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=p.oid AND a.attnum=x.num))
 ORDER BY k.conname),'[]'::jsonb)
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
 JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_namespace pn ON pn.oid=p.relnamespace WHERE k.contype='f' AND n.nspname='public';
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true', help='Synthetic only; never real restore evidence')
    parser.add_argument('--snapshot-evidence', type=Path,
                        help='Private verified-transfer JSON for a newer snapshot; no key or dump')
    args = parser.parse_args()
    if not args.self_test and sys.stdin.isatty():
        print('Decrypted dump must arrive via stdin; private key stays on phone')
        return 1
    os.umask(0o077)
    work = Path(tempfile.mkdtemp(prefix='restore-phone-', dir=ROOT / '.runtime'))
    name = 'om-phone-restore-' + uuid.uuid4().hex[:16]
    evidence = {'kind': 'synthetic_receiver_test' if args.self_test else 'real_phone_stream',
                'started_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                'restore_verified': False, 'phone_decrypt_exit': 'PENDING_OWNER_RESULT',
                'isolated_container': name, 'database_checks_verified': False,
                'phase': 'protected_resource_baseline'}
    created = False
    before = None

    def stop(signum, frame):
        raise CheckError('Interrupted; isolated cleanup required')

    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, stop)

    def sql(db, statement):
        raw = run(['docker', 'exec', '-i', name, 'psql', '-X', '-q', '-U', 'postgres',
                   '-d', db, '-v', 'ON_ERROR_STOP=1', '-A', '-t'], data=statement.encode())
        return raw.decode().strip()

    try:
        before = protected()
        evidence['phase'] = 'snapshot_source_migrations'
        source = json.loads((args.snapshot_evidence or
                             ROOT / '.runtime/phone-transfer-phone-pigpm9sw.json').read_text())
        assert source['remote_hash_and_manifest_match']
        # Pin the source commit from the tested snapshot, even if a later backup runs.
        source_sha = source.get('source_sha', '31a370387b9e8a6a61d92d2d156918bbb0451cc2')
        if not re.fullmatch(r'[0-9a-f]{40}', source_sha):
            raise CheckError('Invalid snapshot source commit')
        if not re.fullmatch(r'[0-9a-f]{64}', source['sha256']):
            raise CheckError('Invalid verified ciphertext digest')
        if args.snapshot_evidence and 'source_sha' not in source:
            raise CheckError('New snapshot requires explicit source commit')
        release = run(['git', 'show', source_sha + ':drizzle/meta/_journal.json'])
        journal = json.loads(release)['entries']
        evidence.update({'snapshot': source['snapshot'], 'ciphertext_sha256': source['sha256'],
                         'source_sha': source_sha, 'production_sql_issued': False})
        evidence['phase'] = 'isolated_container_initialization'
        run(['docker', 'run', '-d', '--pull', 'never', '--name', name, '--network', 'none',
             '--log-driver', 'none', '--memory', '512m', '--cpus', '1', '--pids-limit', '128',
             '--tmpfs', '/var/lib/postgresql:rw,size=268435456',
             '--tmpfs', '/tmp:rw,size=33554432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
             IMAGE, '-c', 'log_statement=none', '-c', 'log_min_messages=panic',
             '-c', 'log_min_error_statement=panic'])
        created = True
        isolation = json.loads(run(['docker', 'inspect', name]))[0]
        assert isolation['HostConfig']['NetworkMode'] == 'none'
        assert not isolation['HostConfig']['PortBindings']
        assert all(m['Type'] == 'tmpfs' for m in isolation['Mounts'])
        evidence['isolation'] = {'network': 'none', 'published_ports': 0,
                                 'mount_types': sorted({m['Type'] for m in isolation['Mounts']}),
                                 'postgres_logging': 'disabled docker logs; panic only PostgreSQL',
                                 'memory_bytes': 536870912, 'data_tmpfs_bytes': 268435456}
        for _ in range(40):
            # The image's initialization server is Unix-socket-only and temporary.
            ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise CheckError('Isolated PostgreSQL did not become ready')
        for db in ('reference_schema', 'phone_restore'):
            run(['docker', 'exec', name, 'createdb', '-U', 'postgres', db])
        evidence['phase'] = 'reference_schema_build'
        sql('reference_schema', 'CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations '
            '(id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);')
        expected = []
        for entry in journal:
            body = run(['git', 'show', source_sha + ':drizzle/' + entry['tag'] + '.sql'])
            h = hashlib.sha256(body).hexdigest()
            sql('reference_schema', body.decode())
            sql('reference_schema', "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('"
                + h + "'," + str(entry['when']) + ');')
            expected.append({'hash': h, 'created_at': entry['when']})
        evidence['phase'] = 'pg_restore_stream'
        restore = ['docker', 'exec', '-i', name, 'pg_restore', '-U', 'postgres', '-d',
                   'phone_restore', '--exit-on-error', '--no-owner', '--no-acl']
        if args.self_test:
            with subprocess.Popen(['docker', 'exec', name, 'pg_dump', '-U', 'postgres',
                                   '-d', 'reference_schema', '-Fc', '--no-owner', '--no-acl'],
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) as dump:
                try:
                    run(restore, stdin=dump.stdout, capture=False, timeout=180)
                finally:
                    dump.stdout.close()
                if dump.wait(timeout=10) != 0:
                    raise CheckError('Synthetic dump failed')
        else:
            run(restore, stdin=sys.stdin.buffer, capture=False, timeout=180)
        evidence['pg_restore_exit'] = 0
        evidence['phase'] = 'migration_schema_validation'
        actual = json.loads(sql('phone_restore', 'SELECT jsonb_agg(jsonb_build_object(\'hash\',hash,'
                                "'created_at',created_at) ORDER BY created_at) FROM drizzle.__drizzle_migrations;"))
        if actual != expected:
            raise CheckError('Restored migration hashes/timestamps differ from snapshot source')
        evidence['migrations'] = {'count': len(actual), 'exact_hash_and_timestamp_match': True}
        tables = json.loads(sql('phone_restore', "SELECT jsonb_agg(tablename ORDER BY tablename) "
                                "FROM pg_tables WHERE schemaname='public';"))
        if tables != TABLES:
            raise CheckError('Domain table inventory mismatch')
        restored_catalog = json.loads(sql('phone_restore', CATALOG))
        reference_catalog = json.loads(sql('reference_schema', CATALOG))
        differing = [k for k in reference_catalog if reference_catalog[k] != restored_catalog[k]]
        if differing:
            raise CheckError('Schema mismatch in categories: ' + ','.join(differing))
        evidence['schema'] = {'domain_tables': len(tables), 'matches_snapshot_migrations': True,
                              'categories': sorted(reference_catalog)}
        evidence['row_counts'] = {t: int(sql('phone_restore', 'SELECT count(*) FROM public.'
                                            + identifier(t) + ';')) for t in TABLES}
        expected_counts = source.get('expected_row_counts')
        if expected_counts is not None:
            if (set(expected_counts) != set(TABLES)
                    or any(type(v) is not int or v < 0 for v in expected_counts.values())
                    or expected_counts != evidence['row_counts']):
                raise CheckError('Restored counts differ from quiescent snapshot evidence')
        evidence['row_counts_match_snapshot_evidence'] = expected_counts is not None
        evidence['phase'] = 'row_count_and_relationship_validation'
        keys = json.loads(sql('phone_restore', FK_QUERY))
        orphans = {}
        for fk in keys:
            if fk['match'] != 's':
                raise CheckError('Unsupported FK match type; refuse incomplete integrity proof')
            child = identifier(fk['child_schema']) + '.' + identifier(fk['child'])
            parent = identifier(fk['parent_schema']) + '.' + identifier(fk['parent'])
            nonnull = ' AND '.join('c.' + identifier(c) + ' IS NOT NULL' for c in fk['child_cols'])
            joins = ' AND '.join('c.' + identifier(c) + '=p.' + identifier(p)
                                 for c, p in zip(fk['child_cols'], fk['parent_cols']))
            orphans[fk['name']] = int(sql('phone_restore', 'SELECT count(*) FROM ' + child
                                         + ' c WHERE ' + nonnull + ' AND NOT EXISTS (SELECT 1 FROM '
                                         + parent + ' p WHERE ' + joins + ');'))
        if not keys or any(orphans.values()):
            raise CheckError('Relational integrity failed')
        evidence['relational_integrity'] = {'foreign_keys_checked': len(keys),
                                            'orphan_rows': sum(orphans.values()),
                                            'per_constraint_orphans': orphans}
        evidence['freshness'] = {'latest_revenue_received_at': sql('phone_restore',
                                'SELECT coalesce(max(received_at)::text,\'NO_REVENUE_ROWS\') FROM revenue_events;'),
                                'note': 'Counts/FKs alone do not prove the dogfood attribution chain'}
        if source.get('require_populated_test_restore'):
            if (expected_counts is None or any(evidence['row_counts'][t] == 0 for t in
                    ('sessions', 'events', 'customers', 'customer_visitors',
                     'revenue_events', 'customer_attribution'))):
                raise CheckError('Populated acceptance requires nonempty chain and exact counts')
            if int(sql('phone_restore', 'SELECT count(*) FROM revenue_events WHERE NOT test;')):
                raise CheckError('Acceptance dump includes revenue not labelled test')
            evidence['populated_test_restore_checks'] = True
        evidence['database_checks_verified'] = True
        evidence['phase'] = 'database_checks_complete'
    except CheckError as exc:
        evidence['failure'] = str(exc)
    except Exception:
        # Never expose exception values/tracebacks that might contain sensitive DB records.
        evidence['failure'] = 'Verification failed; diagnostic values suppressed'
    finally:
        if created:
            try:
                run(['docker', 'rm', '-f', '-v', name], timeout=30)
            except CheckError:
                evidence['failure'] = 'Isolated container cleanup failed'
        exists = subprocess.run(['docker', 'inspect', name], stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, timeout=10).returncode == 0
        evidence['isolated_resources_removed'] = not exists
        if before is not None:
            try:
                evidence['protected_resources_unchanged'] = before == protected()
            except CheckError:
                evidence['protected_resources_unchanged'] = False
        evidence['completed_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
        evidence['result'] = ('SYNTHETIC_RECEIVER_CHECKS_COMPLETE' if args.self_test else
                              'ISOLATED_DB_CHECKS_COMPLETE_PHONE_EXIT_PENDING')
        successful = (evidence['database_checks_verified'] and not exists
                      and evidence.get('protected_resources_unchanged') and 'failure' not in evidence)
        if not successful:
            evidence['result'] = 'RESTORE_CHECK_INCOMPLETE'
        with (work / 'result.json').open('x') as out:
            json.dump(evidence, out, indent=2)
            out.write('\n')
        print(json.dumps({'result': evidence['result'], 'evidence': str(work / 'result.json'),
                          'row_counts': evidence.get('row_counts'),
                          'migration_count': evidence.get('migrations', {}).get('count'),
                          'schema_matches': evidence.get('schema', {}).get('matches_snapshot_migrations', False),
                          'foreign_keys_checked': evidence.get('relational_integrity', {}).get('foreign_keys_checked'),
                          'orphan_rows': evidence.get('relational_integrity', {}).get('orphan_rows'),
                          'cleanup': evidence['isolated_resources_removed'],
                          'production_unchanged': evidence.get('protected_resources_unchanged'),
                          'phase': evidence.get('phase'),
                          'failure': evidence.get('failure'), 'restore_verified': False}, indent=2))
        return 0 if successful else 1


if __name__ == '__main__':
    sys.exit(main())
