#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

p=Path(__file__).resolve().parents[1]/'tools/advance-latest-runtime-blocker.py'
spec=importlib.util.spec_from_file_location('blocker',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

S='rom=2f095d162726b5ea target=c0d380 from=c0d376 kind=FLOW e=0 m=0 x=0 c=0'
E='fluxo CFG nao resolvido em pc=12637046 target=12637056'
class TestSelection(unittest.TestCase):
 def test_exact_observed(self):
  line,target=m.select(S,E)
  self.assertEqual(target,'C0D380')
  self.assertEqual(line,S+' observed=1')
 def test_reject_stale(self):
  with self.assertRaises(ValueError):m.select(S,E.replace('12637056','12637057'))
 def test_reject_missing_error(self):
  with self.assertRaises(ValueError):m.select(S,'The game ended cleanly')
 def test_reject_ambiguous_states(self):
  with self.assertRaises(ValueError):m.select(S+'\n'+S.replace(' c=0',' c=1'),E)
 def test_reject_out_of_range(self):
  with self.assertRaises(ValueError):m.select(S,'fluxo CFG nao resolvido em pc=12637046 target=99999999')
 def test_last_error_wins(self):
  another='rom=2f095d162726b5ea target=c0d381 from=c0d376 kind=FLOW e=0 m=0 x=0 c=0'
  line,target=m.select(S+'\n'+another,E+'\n'+E.replace('12637056','12637057'))
  self.assertEqual(target,'C0D381')
 def test_reject_non_observation_kind(self):
  with self.assertRaises(ValueError):m.select(S.replace('FLOW','INVALID'),E)

if __name__=='__main__':unittest.main()
