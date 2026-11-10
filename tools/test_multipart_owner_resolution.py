#!/usr/bin/env python3
"""Forja65: exact generated multipart owners must not collide by root."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

TOOL=Path(__file__).with_name('integrate-observed-flow.py')
spec=importlib.util.spec_from_file_location('forja_observed_flow',TOOL)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class MultiPart(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.p=Path(tmp.name)
        (self.p/'src').mkdir()
        (self.p/'src/generated_001.cpp').write_text(
            'void sub_B7B00C_E0M0X0CQ_part1(CpuState& cpu) {\n'
            ' // $B7BAE0 NOP\n}\n')
        (self.p/'src/generated_032.cpp').write_text(
            'void sub_B7B00C_E0M0X0CQ_part0(CpuState& cpu) {\n'
            ' // $B7B00C NOP\n}\n')
    def test_exact_symbols_are_distinct(self):
        cache={}
        a=mod._find_existing_owner_source(self.p,'sub_B7B00C_E0M0X0CQ_part0',cache)
        b=mod._find_existing_owner_source(self.p,'sub_B7B00C_E0M0X0CQ_part1',cache)
        self.assertEqual(a.name,'generated_032.cpp')
        self.assertEqual(b.name,'generated_001.cpp')
        self.assertIsNot(a,b)
    def test_dispatch_row_resolves_part(self):
        row='{0xB7BAE0u,false,false,false,false,false,&sub_B7B00C_E0M0X0CQ_part1,0xB7B00Cu},'
        self.assertEqual(mod._row_function(row),'sub_B7B00C_E0M0X0CQ_part1')
    def test_duplicate_exact_definition_still_rejected(self):
        with (self.p/'src/generated_032.cpp').open('a') as f:
            f.write('void sub_B7B00C_E0M0X0CQ_part1(CpuState& cpu) {}\n')
        with self.assertRaisesRegex(ValueError,'expected exactly one'):
            mod._find_existing_owner_source(self.p,'sub_B7B00C_E0M0X0CQ_part1',{})
    def test_missing_function_fails_closed(self):
        with self.assertRaisesRegex(ValueError,'expected exactly one'):
            mod._find_existing_owner_source(self.p,'sub_B7B00C_E0M0X0CQ_part2',{})

if __name__=='__main__':unittest.main()
