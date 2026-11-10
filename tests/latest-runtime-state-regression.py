#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).resolve().parents[1]/'tools/advance-latest-runtime-blocker.py'
spec=importlib.util.spec_from_file_location('advance_latest',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class LatestState(unittest.TestCase):
 def test_observed_state(self):
  hint='rom=3a574807afbad761 target=bbd054 from=bbd054 kind=STATE e=0 m=0 x=0 c=1\n'
  got,target=m.select(hint,'estado M/X/C nao recompilado em pc=12308564')
  self.assertEqual(target,'BBD054')
  self.assertIn('observed=1',got)
 def test_reject_unmatched_state(self):
  with self.assertRaises(ValueError):m.select('rom=3a574807afbad761 target=bbd055 from=bbd055 kind=STATE e=0 m=0 x=0 c=1','estado M/X/C nao recompilado em pc=12308564')
 def test_reject_unmatched_kind(self):
  with self.assertRaises(ValueError):m.select('rom=3a574807afbad761 target=bbd054 from=bbd054 kind=FLOW e=0 m=0 x=0 c=1','estado M/X/C nao recompilado em pc=12308564')
if __name__=='__main__':unittest.main()
