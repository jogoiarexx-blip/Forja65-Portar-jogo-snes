"""Regression for crash trace and hint identity (no address guessing)."""
from pathlib import Path
import importlib.util
import unittest

SOURCE=Path(__file__).resolve().parents[1]/'tools'/'advance-from-crash-trace.py'
spec=importlib.util.spec_from_file_location('trace_flow',SOURCE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
TRACE='FORJA65 RUNTIME TRACE\nreason=unresolved-flow\nframe=23037\ncc03e1 A=0 X=0\n'
HINT='rom=3ce797fd0241fce8 target=cc41d5 from=cc03e1 kind=FLOW e=0 m=0 x=0 c=0\n'

class TraceTargetTests(unittest.TestCase):
    def test_normalizes_exact_trace(self):
        self.assertEqual(mod.select(TRACE,HINT),(HINT.strip()+' observed=1','CC41D5'))
    def test_refuses_ambiguous_targets(self):
        other=HINT.replace('cc41d5','cc41d7')
        with self.assertRaisesRegex(ValueError,'exactly one'):
            mod.select(TRACE,HINT+other)
    def test_refuses_unrelated_trace_or_hint(self):
        with self.assertRaises(ValueError):mod.select(TRACE,HINT.replace('cc03e1','cc03e2'))
        with self.assertRaises(ValueError):mod.select(TRACE.replace('unresolved-flow','other'),HINT)
    def test_second_uploaded_failure(self):
        trace='FORJA65 RUNTIME TRACE\nreason=unresolved-flow\nc0fd80 A=0 X=0\n'
        hint='rom=3ce797fd0241fce8 target=c05639 from=c0fd80 kind=FLOW e=0 m=0 x=0 c=0\n'
        self.assertEqual(mod.select(trace,hint)[1],'C05639')

if __name__=='__main__':unittest.main()
