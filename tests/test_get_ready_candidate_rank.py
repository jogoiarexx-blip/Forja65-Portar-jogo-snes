import unittest,tempfile,importlib.util
from pathlib import Path
src=Path(__file__).resolve().parents[1]/'tools/get-ready-candidate-rank.py'
spec=importlib.util.spec_from_file_location('get_ready_rank',src)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class TestCandidates(unittest.TestCase):
 def test_sequence_is_ranked_but_not_confirmed(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);w=p/'w.csv';v=p/'v.csv'
   w.write_text('frame,address,old,new,writer_pc\n10,7E1234,3,2,C0ABCD\n20,7E1234,2,1,C0ABCD\n30,7E1234,1,0,C0ABCD\n',encoding='utf-8')
   v.write_text('frame,framebuffer\n10,A\n20,B\n30,C\n',encoding='utf-8')
   data=mod.analyze(w,v);c=data['candidates'][0]
   self.assertTrue(c['ordered_03_02_01_00_observed']);self.assertFalse(data['get_ready_confirmed']);self.assertFalse(c['timer_confirmed'])
 def test_bad_address_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);w=p/'w.csv';v=p/'v.csv'
   w.write_text('frame,address,old,new,writer_pc\n1,001234,3,2,C0ABCD\n',encoding='utf-8')
   v.write_text('frame,framebuffer\n1,A\n',encoding='utf-8')
   with self.assertRaises(ValueError):mod.analyze(w,v)
 def test_duplicate_video_frame_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);w=p/'w.csv';v=p/'v.csv'
   w.write_text('frame,address,old,new,writer_pc\n1,7E1234,3,2,C0ABCD\n')
   v.write_text('frame,framebuffer\n1,A\n1,B\n')
   with self.assertRaises(ValueError):mod.analyze(w,v)
 def test_invalid_byte_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);w=p/'w.csv';v=p/'v.csv'
   w.write_text('frame,address,old,new,writer_pc\n1,7E1234,300,299,C0ABCD\n')
   v.write_text('frame,framebuffer\n1,A\n')
   with self.assertRaises(ValueError):mod.analyze(w,v)
if __name__=='__main__': unittest.main()

