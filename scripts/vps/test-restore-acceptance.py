#!/usr/bin/env python3
"""Semantic restore rejection controls; no production DB, phone key or dump."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('receiver', Path(__file__).with_name('restore-phone.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
spec = importlib.util.spec_from_file_location('capture', Path(__file__).with_name('capture-p2-acceptance.py'))
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)
PROJECT = '00000000-0000-4000-8000-000000000001'
CAMPAIGN = 'p2_acceptance_fixture'
METRICS = dict(sessions=1, customers=1, links=1, attributions=1, payments=2, refunds=1,
               payments_minor=5800, refunds_minor=500, non_test=0, other_currency=0,
               trusted_session_match=True, refund_link_match=True, status='attributed',
               payment_details_match=True, refund_details_match=True,
               source='p2-test', medium='controlled', campaign=CAMPAIGN, first_touch_source='p2-test',
               acquired_at='2026-10-03 12:00:00+00', latest_received_at='2026-10-03 12:05:00+00',
               credited_session_id=PROJECT, first_touch_session_id=PROJECT,
               visitor_id=PROJECT, customer_id=PROJECT, payload_hashes=['a' * 64, 'b' * 64, 'c' * 64])


def baseline():
    return dict(project_id=PROJECT, campaign=CAMPAIGN, expected_metrics=copy.deepcopy(METRICS))


class RestoreAcceptanceTests(unittest.TestCase):
    def test_exact_private_baseline_accepted(self):
        r.verify_acceptance_metrics(copy.deepcopy(METRICS), baseline())

    def test_nonmatching_restore_never_passes_counts_alone(self):
        for patch in [dict(source='wrong'), dict(trusted_session_match=False),
                      dict(trusted_session_match=1), dict(payment_details_match=False),
                      dict(refund_link_match=False), dict(refunds_minor=501),
                      dict(latest_received_at='2026-10-03 12:04:00+00'),
                      dict(credited_session_id='00000000-0000-4000-8000-000000000002'),
                      dict(payload_hashes=['d' * 64, 'b' * 64, 'c' * 64])]:
            with self.subTest(patch=patch), self.assertRaises(r.CheckError):
                r.verify_acceptance_metrics(dict(METRICS, **patch), baseline())

    def test_invalid_baseline_cannot_launder_bad_restore(self):
        for patch in [dict(payments_minor=5801), dict(non_test=1), dict(other_currency=1),
                      dict(source='wrong'), dict(trusted_session_match=1), dict(sessions=True)]:
            bad = dict(METRICS, **patch)
            b = baseline(); b['expected_metrics'] = bad
            with self.subTest(patch=patch), self.assertRaises(r.CheckError):
                r.verify_acceptance_metrics(bad, b)

    def test_missing_private_baseline_and_wrong_clock_rejected(self):
        for metrics in [None, {}, dict(METRICS, acquired_at='2026-10-03T12:00:00'),
                        dict(METRICS, latest_received_at='2026-10-03T12:05:00+03:00')]:
            b = baseline(); b['expected_metrics'] = metrics
            with self.assertRaises(r.CheckError):
                r.verify_acceptance_metrics(METRICS, b)

    def test_fixed_query_rejects_untrusted_identifier_and_campaign(self):
        for project, campaign in [(PROJECT + "'", CAMPAIGN), (PROJECT, "unlabelled"),
                                  (PROJECT, CAMPAIGN + "'; DELETE FROM sessions;")]:
            with self.assertRaises(r.CheckError):
                r.acceptance_metrics_query(project, campaign)

    def test_only_verified_snapshot_inside_quiescent_window_accepted(self):
        before = dict(row_counts={'events': 1}, acceptance_assertions=baseline(),
                      deployed_source_sha='a' * 40, observed_at='2026-10-03T12:00:00+00:00')
        after = dict(before, observed_at='2026-10-03T12:10:00+00:00')
        backup = dict(result='BACKUP_CREATED_REMOTE_READBACK_VERIFIED', state='verified',
                      captured_at='2026-10-03T12:01:00+00:00', verified_at='2026-10-03T12:02:00+00:00',
                      source_sha='a' * 40, sha256='b' * 64, snapshot='om-db-v1-20261003T120100Z-deadbeef')
        capture.validate_window(before, after, backup)
        for patch in [dict(row_counts={'events': 2}), dict(deployed_source_sha='c' * 40)]:
            with self.assertRaises(ValueError):
                capture.validate_window(before, dict(after, **patch), backup)
        for patch in [dict(state='pending'), dict(captured_at='2026-10-03T11:59:00+00:00'),
                      dict(verified_at='2026-10-03T12:11:00+00:00'), dict(source_sha='not-a-sha')]:
            with self.assertRaises(ValueError):
                capture.validate_window(before, after, dict(backup, **patch))


if __name__ == '__main__':
    unittest.main()
