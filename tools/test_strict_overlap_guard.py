#!/usr/bin/env python3
"""Regression for carry-domain and opcode verification before preserving old CFG."""
from pathlib import Path
import importlib.util
import tempfile
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('forja_observed', ROOT/'integrate-observed-flow.py')
strict = importlib.util.module_from_spec(spec)
spec.loader.exec_module(strict)
PC = 0xB8A075

def row(known, carry, name='sub_B8A070_E0M0X0CQ'):
    return f'{{0x{PC:06X}u,false,false,false,{str(known).lower()},{str(carry).lower()},&{name},0xB8A070u}},'

class VerifiedSharedDispatch(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.project = Path(self.tmp.name)
        (self.project/'src').mkdir()
        self.owner = self.project/'src'/'generated_000.cpp'
        self.mini = self.project/'mini.cpp'

    def source(self, opcode='LDA', copies=1):
        body=f'void sub_B8A070_E0M0X0CQ(CpuState&,SnesRuntime&,unsigned) {{\n// $B8A075 {opcode} #42\n}}\n'
        self.owner.write_text(body)
        if copies == 2:
            (self.project/'src'/'generated_001.cpp').write_text(body)
        self.mini.write_text('void sub_B8A075_E0M0X0C1(CpuState&,SnesRuntime&,unsigned){\n// $B8A075 LDA #42\n}\n')

    def verify(self, old, new):
        return strict.verify_overlap(self.project,[old],[new],{PC},self.mini)

    def test_wildcard_owner_covers_both_carries(self):
        self.source()
        self.verify(row(False, False),row(True, True,'sub_B8A075_E0M0X0C1'))

    def test_single_carry_cannot_cover_opposite_state(self):
        self.source()
        with self.assertRaisesRegex(ValueError,'missing compatible CPU state'):
            self.verify(row(True, False),row(True, True,'sub_B8A075_E0M0X0C1'))

    def test_opcode_mismatch_rejected(self):
        self.source('STA')
        with self.assertRaisesRegex(ValueError,'opcode mismatch'):
            self.verify(row(False, False),row(True, True,'sub_B8A075_E0M0X0C1'))

    def test_duplicate_existing_symbol_rejected(self):
        self.source(copies=2)
        with self.assertRaisesRegex(ValueError,'expected exactly one'):
            self.verify(row(False, False),row(True, True,'sub_B8A075_E0M0X0C1'))

if __name__ == '__main__':
    unittest.main()
