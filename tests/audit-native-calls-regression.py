#!/usr/bin/env python3
"""Focused regression tests for generated direct ROM call auditing."""
import importlib.util
import pathlib
import unittest

module_path = pathlib.Path(__file__).resolve().parents[1]/'tools/audit-native-calls.py'
spec = importlib.util.spec_from_file_location('audit_native_calls', module_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

ROW = '{0xC0BE6Bu,false,false,false,false,false,&sub_C0BE6B_E0M0X0CQ,0xC0BE6Bu},'
CALL = '// $C0BDD8 JSR -> $C0BE6B stack real'

class DirectCallAudit(unittest.TestCase):
    def test_valid_dispatch_entry(self):
        result = mod.audit(CALL, ROW)
        self.assertTrue(result['passed'])
        self.assertEqual(result['direct_calls'], 1)
    def test_missing_entry(self):
        result = mod.audit(CALL, '')
        self.assertFalse(result['passed'])
        self.assertEqual(result['missing_direct_targets'][0]['target'], 'C0BE6B')
    def test_declaration_only_is_not_a_dispatch_entry(self):
        self.assertFalse(mod.audit(CALL, 'void sub_C0BE6B_E0M0X0CQ(...);')['passed'])
    def test_deduplicates_carry_state_variants(self):
        self.assertEqual(mod.audit(CALL+'\n'+CALL, ROW)['direct_calls'], 1)
    def test_case_insensitive_jsl(self):
        self.assertTrue(mod.audit('// $c0bdd8 jsl -> $c0be6b', ROW)['passed'])
    def test_comment_false_positive_rejected(self):
        self.assertTrue(mod.audit('not a generated direct call', '')['passed'])
        self.assertEqual(mod.audit('not a generated direct call', '')['direct_calls'], 0)

if __name__=='__main__':
    unittest.main()
