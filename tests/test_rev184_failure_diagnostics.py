#!/usr/bin/env python3
"""REV184: differentiate timeouts from AOT/ABI/checkpoint failures."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

RUNNER=Path(__file__).resolve().parents[1]/'tools/verify-native-campaign.py'
spec=importlib.util.spec_from_file_location('campaign_runner_rev184',RUNNER)
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)

class DiagnosticTests(unittest.TestCase):
 def test_timeout_with_partial_progress(self):
  with TemporaryDirectory() as tmp:
   p=Path(tmp);(p/'game.log').write_text('')
   (p/'frame-progress.csv').write_text('frame,pc\n60,abcd\n120,dcba\n')
   r=runner.classify_failure(124,p/'game.log',p/'frame-progress.csv',False,False)
   self.assertEqual((r['reason'],r['last_progress_frame'],r['gameplay_completed']),('timeout',120,False))
 def test_checkpoint_and_missing_aot_not_merged(self):
  with TemporaryDirectory() as tmp:
   p=Path(tmp)
   (p/'game.log').write_text('checkpoint unsafe: pending 65816 native return frames')
   r=runner.classify_failure(2,p/'game.log',p/'missing.csv',True,False)
   self.assertEqual(r['reason'],'unsafe_native_checkpoint')
   (p/'game.log').write_text('retorno 65C816 nao corresponde ao frame C++ recompilado')
   r=runner.classify_failure(2,p/'game.log',p/'missing.csv',True,False)
   self.assertEqual(r['reason'],'native_return_mismatch')
   (p/'game.log').write_text('FORJA65_CPU_AOT_ONLY missing target B39520')
   r=runner.classify_failure(2,p/'game.log',p/'missing.csv',False,False)
   self.assertEqual(r['reason'],'aot_route_missing')
 def test_real_cfg_frontier_report_classified_as_aot(self):
  with TemporaryDirectory() as tmp:
   p=Path(tmp)
   (p/'game.log').write_text('fluxo CFG nao resolvido em pc=11970714 target=11971248')
   (p/'forja65-aot-frontier.txt').write_text('FORJA65_CPU_AOT_FRONTIER 1\nB6AAB0 M0X0 from=B6A89A count=1\n')
   result=runner.classify_failure(2,p/'game.log',p/'not-present.csv',False,False)
   self.assertEqual(result['reason'],'aot_route_missing')
 def test_nonmonotone_marker_rejected(self):
  with TemporaryDirectory() as tmp:
   p=Path(tmp);(p/'game.log').write_text('')
   (p/'p.csv').write_text('frame,pc\n120,abcd\n60,abcd\n')
   r=runner.classify_failure(124,p/'game.log',p/'p.csv',False,False)
   self.assertEqual(r['reason'],'invalid_progress_log')
 def test_normal_end_without_checkpoint(self):
  with TemporaryDirectory() as tmp:
   p=Path(tmp);(p/'game.log').write_text('')
   r=runner.classify_failure(0,p/'game.log',p/'none.csv',True,False)
   self.assertEqual(r['reason'],'checkpoint_not_written')
if __name__=='__main__': unittest.main()
