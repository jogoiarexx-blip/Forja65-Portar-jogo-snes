import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE=Path(__file__).resolve().parents[1]/'tools/validate-cfg-replay-gate.py'
spec=importlib.util.spec_from_file_location('gate',MODULE)
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)

class GateTest(unittest.TestCase):
 def setUp(self):
  self.dir=tempfile.TemporaryDirectory();self.addCleanup(self.dir.cleanup)
  p=Path(self.dir.name);self.base=p/'old.txt';self.new=p/'new.txt'
  self.template='frame={n} framebuffer={fb:016x} wram={wram:016x} pc=b8a493\n'
 def write(self,path,n,diverge_at=None):
  path.write_text(''.join(self.template.format(n=i,fb=i+1 if i!=diverge_at else 99,wram=i+3) for i in range(n)))
 def test_extended(self):
  self.write(self.base,2);self.write(self.new,4)
  report=gate.evaluate(self.base,self.new,candidate_exit_code=2)
  self.assertTrue(report['verified_execution_advance'])
  self.assertEqual(report['identical_prefix_frames'],2)
  self.assertFalse(report['cfg_global_grade_certified'])
  self.assertFalse(report['replay_completed_without_error'])
 def test_divergence(self):
  self.write(self.base,2);self.write(self.new,4,diverge_at=1)
  result=gate.evaluate(self.base,self.new)
  self.assertEqual(result['status'],'diverged')
  self.assertFalse(result['baseline_preserved'])
 def test_truncation(self):
  self.write(self.base,4);self.write(self.new,2)
  result=gate.evaluate(self.base,self.new)
  self.assertEqual(result['status'],'truncated')
  self.assertEqual(result['first_unmatched_frame'],2)
 def test_same(self):
  self.write(self.base,2);self.write(self.new,2)
  self.assertEqual(gate.evaluate(self.base,self.new)['status'],'unchanged')
 def test_real_unpadded_hex_signatures(self):
  self.base.write_text("frame=0 framebuffer=24298b2db6200383 wram=1301329043a59ff pc=827c\n")
  self.new.write_text(self.base.read_text())
  self.assertEqual(gate.evaluate(self.base,self.new)["status"],"unchanged")
 def test_modified_rom(self):
  self.write(self.base,2);self.write(self.new,2)
  with self.assertRaisesRegex(ValueError,'different ROM'):
   gate.evaluate(self.base,self.new,baseline_rom='a'*64,candidate_rom='b'*64)
 def test_unverified_length_and_reorder(self):
  self.write(self.base,2);self.new.write_text('frame=1 framebuffer=0000000000000001 wram=0000000000000003 pc=b8a493\n')
  with self.assertRaisesRegex(ValueError,'Invalid or missing frame'):
   gate.evaluate(self.base,self.new)
 def test_duplicate_line_not_accepted(self):
  self.write(self.base,2);self.write(self.new,2)
  self.new.write_text(self.new.read_text()+self.new.read_text().splitlines(True)[-1])
  with self.assertRaises(ValueError):gate.evaluate(self.base,self.new)

if __name__=='__main__':unittest.main()
