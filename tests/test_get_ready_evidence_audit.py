import importlib.util,tempfile,csv,unittest
from pathlib import Path
TOOL=Path(__file__).resolve().parents[1]/'tools/get-ready-evidence-audit.py'
spec=importlib.util.spec_from_file_location('audit_v27',TOOL);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class EvidenceTest(unittest.TestCase):
 def test_missing_not_confirmed(self):
  with tempfile.TemporaryDirectory() as d:
   r=mod.report(d);self.assertFalse(r['capture_complete']);self.assertFalse(r['timer_identified'])
 def test_records_are_not_proof(self):
  with tempfile.TemporaryDirectory() as d:
   names={'neutral-wram.csv':'kind,frame,wram_address\ndelta,1,7E1234\n','controlled-wram.csv':'kind,frame,wram_address\ndelta,1,7E1234\n','writers.csv':'frame,address,writer_pc\n1,7E1234,C0F923\n','video.csv':'frame\n1\n'}
   for n,v in names.items():(Path(d)/n).write_text(v)
   r=mod.report(d);self.assertTrue(r['capture_complete']);self.assertFalse(r['c0_f923_resolved']);self.assertFalse(r['gameplay_verified'])
if __name__=='__main__':unittest.main()
