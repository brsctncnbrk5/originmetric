#!/usr/bin/env python3
import datetime as dt
import importlib.util
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode = True
base = Path(__file__).parent
spec = importlib.util.spec_from_file_location('expiry', base/'recovery-retention.py')
x = importlib.util.module_from_spec(spec);spec.loader.exec_module(x)
spec = importlib.util.spec_from_file_location('helpers', base/'test-github-backup.py')
h = importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
NOW = h.NOW


class ExpiryTests(unittest.TestCase):
    def test_age_boundary_and_unrelated_protection(self):
        items = [h.release(1, NOW-dt.timedelta(days=90)), h.release(2, NOW-dt.timedelta(days=89))]
        for i, change in enumerate([{'draft':False},{'body':'{}'},{'name':'phone-recovery'}],3):
            r=h.release(i,NOW-dt.timedelta(days=100));r.update(change);items.append(r)
        self.assertEqual([r['id'] for r in x.expired(items,NOW)],[1])
        self.assertEqual(x.cleanup(None,items,NOW)['deleted_releases'],0)

    def test_changed_assets_block_apply(self):
        item=h.release(1,NOW-dt.timedelta(days=90))
        class Fake:
            def private(self):pass
            def request(self,path,method='GET'):
                if method=='DELETE':raise AssertionError('unsafe deletion')
                return dict(item,assets=item['assets']+[{'name':'unrelated','id':999}])
        with self.assertRaises(RuntimeError):x.cleanup(Fake(),[item],NOW,True)

    def test_only_exact_expired_owned_release_deleted(self):
        item=h.release(1,NOW-dt.timedelta(days=90))
        class Fake:
            def __init__(self):self.deleted=[]
            def private(self):pass
            def request(self,path,method='GET'):
                if method=='DELETE':self.deleted.append(path);return
                return item
        fake=Fake();result=x.cleanup(fake,[item],NOW,True)
        self.assertEqual(result['deleted_releases'],1)
        self.assertTrue(fake.deleted[0].endswith('/releases/1'))


if __name__=='__main__':unittest.main()
