#!/usr/bin/env python3
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

mfile=Path(__file__).resolve().parents[1]/'tools'/'check-native-object-freshness.py'
spec=importlib.util.spec_from_file_location('object_guard',mfile)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class TestObjectFreshness(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root=Path(self.temp.name)
        self.src=root/'dispatch.cpp';self.obj=root/'dispatch.cpp.o'
        self.src.write_text('new code');self.obj.write_bytes(b'OBJ')
    def mtime(self,p,t):os.utime(p,ns=(t,t))
    def test_object_newer_passes(self):
        self.mtime(self.src,1_000_000_000);self.mtime(self.obj,2_000_000_000)
        self.assertEqual(m.check_pairs([(self.src,self.obj)])['status'],'PASS')
    def test_stale_dispatch_fails(self):
        self.mtime(self.src,2_000_000_000);self.mtime(self.obj,1_000_000_000)
        self.assertEqual(m.check_pairs([(self.src,self.obj)])['status'],'FAIL')
    def test_missing_object_fails(self):
        self.obj.unlink()
        self.assertIn('missing object',m.check_pairs([(self.src,self.obj)])['errors'][0])
    def test_missing_source_fails(self):
        self.src.unlink()
        self.assertEqual(m.check_pairs([(self.src,self.obj)])['status'],'FAIL')
    def test_empty_fails(self):
        with self.assertRaises(ValueError):m.check_pairs([])

if __name__=='__main__':unittest.main()
