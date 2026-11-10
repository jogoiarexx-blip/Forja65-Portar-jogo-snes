#!/usr/bin/env python3
"""Unit/regression tests for R12 fail-closed AOT evidence audit."""
import pathlib
import sys
import unittest
from unittest import mock
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools'))
import rev174_r12_native_gate as gate

class Gate(unittest.TestCase):
    def test_zero_covered(self):
        gate.assert_native({'dep':{'cpu_interpreter_instructions':'0',
                'cpu_aot_instructions':'109386036','instructions':'109386036',
                'CPU_AOT':'YES','CPU_FULLY_NATIVE':'YES'}})
    def test_interpreter_rejected(self):
        with self.assertRaisesRegex(ValueError,'still interpreted'):
            gate.assert_native({'dep':{'cpu_interpreter_instructions':'28'}})
    def test_false_native_flags_rejected(self):
        with self.assertRaisesRegex(ValueError,'native-mode flags'):
            gate.assert_native({'dep':{'cpu_interpreter_instructions':'0','CPU_AOT':'YES','CPU_FULLY_NATIVE':'NO'}})
    def test_misaccounted_total_rejected(self):
        with self.assertRaisesRegex(ValueError,'does not equal'):
            gate.assert_native({'dep':{'cpu_interpreter_instructions':'0','CPU_AOT':'YES','CPU_FULLY_NATIVE':'YES',
                'cpu_aot_instructions':'10','instructions':'11'}})
    def test_identity_hashes_complete(self):
        self.assertEqual(len(gate.R11_PROOFS),6)
        self.assertEqual(len(set(gate.R11_PROOFS.values())),6)
        self.assertTrue(all(len(x)==64 for x in gate.R11_PROOFS.values()))

if __name__=='__main__':unittest.main()
